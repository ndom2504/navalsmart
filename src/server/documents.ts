import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { extractText } from "unpdf";

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

export async function extractDocument(buffer: Buffer, extension: string): Promise<{ text: string; pageCount: number | null }> {
  if (extension === "txt") {
    const text = buffer.toString("utf8").replace(/\0/g, "");
    const pages = text.match(/^---\s*Page\s+\d+\s*---$/gim);
    return { text, pageCount: pages?.length ?? null };
  }
  if (extension === "pdf") {
    const result = await extractText(new Uint8Array(buffer), { mergePages: false });
    const pages = Array.isArray(result.text) ? result.text : [result.text];
    const text = pages.map((page, index) => `--- Page ${index + 1} ---\n${page}`).join("\n\n");
    return { text, pageCount: result.totalPages };
  }
  if (extension === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value.replace(/\0/g, ""), pageCount: null };
  }
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

export async function saveUpload(projectId: string, buffer: Buffer, extension: string): Promise<string> {
  const directory = path.join(process.cwd(), "uploads", projectId);
  await fs.mkdir(directory, { recursive: true });
  const storedPath = path.join(directory, `${crypto.randomUUID()}.${extension}`);
  await fs.writeFile(storedPath, buffer);
  return storedPath;
}
