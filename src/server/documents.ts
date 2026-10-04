import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { extractTextItems, getMeta } from "unpdf";
import type { TenderDocument } from "@/domain/types";

const allowed = new Set(["pdf", "docx", "xlsx", "txt"]);

export function uploadLimit(): number {
  const parsed = Number(process.env.MAX_UPLOAD_BYTES ?? 20 * 1024 * 1024);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20 * 1024 * 1024;
}

export function safeExtension(fileName: string): string | null {
  const base = path.basename(fileName).toLowerCase();
  if (base.includes("\0") || base.startsWith(".")) return null;
  const extension = base.split(".").pop() ?? "";
  if (!allowed.has(extension)) return null;
  if (base.split(".").length > 2 && extension !== "txt") {
    const parts = base.split(".");
    if (parts.some((part) => ["exe", "js", "html", "svg", "php"].includes(part))) return null;
  }
  return extension;
}

interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
}

function dominantFontSize(pages: PdfTextItem[][]): number {
  const weights = new Map<number, number>();
  for (const item of pages.flat()) {
    if (!item.str.trim()) continue;
    const size = Math.round(item.fontSize * 10) / 10;
    weights.set(size, (weights.get(size) ?? 0) + item.str.length);
  }
  let best = 10;
  let bestWeight = -1;
  for (const [size, weight] of weights) {
    if (weight > bestWeight) {
      best = size;
      bestWeight = weight;
    }
  }
  return best;
}

/**
 * Reconstruit les lignes d'une page PDF à partir des positions. Un grand écart
 * horizontal devient « | » afin de conserver les colonnes des tableaux.
 */
function pdfPageLines(items: PdfTextItem[], bodySize: number): string[] {
  const visible = items.filter((item) => item.str.trim());
  const rows: { y: number; size: number; items: PdfTextItem[] }[] = [];
  for (const item of visible) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= Math.max(2, item.fontSize * 0.4));
    if (row) {
      row.items.push(item);
      row.size = Math.max(row.size, item.fontSize);
    } else {
      rows.push({ y: item.y, size: item.fontSize, items: [item] });
    }
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((row) => {
    const sorted = row.items.sort((a, b) => a.x - b.x);
    let line = "";
    let previous: PdfTextItem | null = null;
    for (const item of sorted) {
      if (previous) {
        const gap = item.x - (previous.x + previous.width);
        if (gap > Math.max(previous.fontSize, item.fontSize) * 1.6) line = `${line.trimEnd()} | `;
        else if (gap > item.fontSize * 0.15 && !/\s$/.test(line) && !/^\s/.test(item.str)) line += " ";
      }
      line += item.str;
      previous = item;
    }
    const text = line.replace(/\s+/g, " ").trim();
    if (row.size >= bodySize * 1.7) return `# ${text}`;
    if (row.size >= bodySize * 1.2 && text.length <= 140 && !text.includes(" | ")) return `## ${text}`;
    return text;
  });
}

async function extractPdf(buffer: Buffer): Promise<{ text: string; pageCount: number | null }> {
  const { totalPages, items } = await extractTextItems(new Uint8Array(buffer));
  const pages = items as PdfTextItem[][];
  const bodySize = dominantFontSize(pages);
  const meta = await getMeta(new Uint8Array(buffer)).catch(() => null);
  const info = (meta?.info ?? {}) as Record<string, unknown>;
  const metadata = [["Titre", info.Title], ["Auteur", info.Author], ["Sujet", info.Subject], ["Mots-clés", info.Keywords]]
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0)
    .map(([key, value]) => `${key} : ${value.trim()}`);
  const body = pages.map((page, index) => `--- Page ${index + 1} ---\n${pdfPageLines(page, bodySize).join("\n")}`).join("\n\n");
  const text = metadata.length ? `--- Métadonnées ---\n${metadata.join("\n")}\n\n${body}` : body;
  return { text, pageCount: totalPages };
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

/** DOCX : titres, listes et tableaux conservés via le HTML de mammoth. Word ne fournit pas de pagination. */
async function extractDocx(buffer: Buffer): Promise<{ text: string; pageCount: number | null }> {
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const lines: string[] = [];
  const pattern = /<table\b[^>]*>([\s\S]*?)<\/table>|<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\2>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    if (match[1] !== undefined) {
      for (const row of match[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const cells = [...row[1]!.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => stripTags(cell[1]!)).filter(Boolean);
        if (cells.length) lines.push(cells.join(" | "));
      }
      continue;
    }
    const tag = match[2]!.toLowerCase();
    const text = stripTags(match[3]!);
    if (!text) continue;
    if (tag === "h1") lines.push(`# ${text}`);
    else if (tag.startsWith("h")) lines.push(`## ${text}`);
    else if (tag === "li") lines.push(`• ${text}`);
    else lines.push(text);
  }
  return { text: lines.join("\n").replace(/\0/g, ""), pageCount: null };
}

export async function extractDocument(buffer: Buffer, extension: string): Promise<{ text: string; pageCount: number | null }> {
  if (extension === "txt") {
    const text = buffer.toString("utf8").replace(/\0/g, "");
    const pages = text.match(/^---\s*Page\s+\d+\s*---$/gim);
    return { text, pageCount: pages?.length ?? null };
  }
  if (extension === "pdf") return extractPdf(buffer);
  if (extension === "docx") return extractDocx(buffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheets = workbook.worksheets.map((sheet) => {
    const rows = sheet.getSheetValues()
      .filter((row) => Array.isArray(row))
      .map((row) => (row as unknown[]).filter((cell) => cell != null).join(" | "))
      .filter(Boolean);
    return `--- Feuille ${sheet.name} ---\n${rows.join("\n")}`;
  });
  return { text: sheets.join("\n\n"), pageCount: workbook.worksheets.length };
}

/** Relit le fichier importé avec l'extracteur courant ; à défaut, le texte enregistré à l'import. */
export async function documentTextForAnalysis(document: TenderDocument): Promise<{ text: string; pageCount: number | null; refreshed: boolean }> {
  const fallback = { text: document.extractedText, pageCount: document.pageCount, refreshed: false };
  if (!document.storedPath) return fallback;
  const uploads = path.join(process.cwd(), "uploads");
  const resolved = path.resolve(document.storedPath);
  const relative = path.relative(uploads, resolved);
  const extension = path.extname(resolved).slice(1).toLowerCase();
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || !allowed.has(extension)) return fallback;
  try {
    const extracted = await extractDocument(await fs.readFile(resolved), extension);
    return extracted.text.trim() ? { ...extracted, refreshed: true } : fallback;
  } catch {
    return fallback;
  }
}

/** Supprime les fichiers importés d'un dossier (documents et image). */
export async function removeProjectUploads(projectId: string): Promise<void> {
  if (!/^[\w-]+$/.test(projectId)) return;
  await fs.rm(path.join(process.cwd(), "uploads", projectId), { recursive: true, force: true });
}

export async function saveUpload(projectId: string, buffer: Buffer, extension: string): Promise<string> {
  const directory = path.join(process.cwd(), "uploads", projectId);
  await fs.mkdir(directory, { recursive: true });
  const storedPath = path.join(directory, `${crypto.randomUUID()}.${extension}`);
  await fs.writeFile(storedPath, buffer);
  return storedPath;
}
