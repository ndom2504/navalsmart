import type { DocumentBlock, StructuredDocument } from "@/domain/document-structure";

export interface DocumentChunk {
  index: number;
  total: number;
  pages: [number | null, number | null];
  sections: string[];
  blockCount: number;
  /** Texte annoté envoyé au modèle : marqueurs de page, titres et contenu intégral des blocs. */
  text: string;
}

export interface ChunkOptions {
  /** Taille cible d'un morceau, en caractères. */
  maxChars?: number;
  /** En dessous de ce seuil, le document entier est envoyé en un seul morceau. */
  wholeDocumentChars?: number;
}

const SENTENCE_BOUNDARY = /([.!?;])\s+(?=[A-ZÀ-ÖØ-Þ«"(•\d])/g;

/** Découpe un bloc trop long en phrases entières. Une phrase n'est jamais coupée. */
export function splitSentences(text: string): string[] {
  return text.replace(SENTENCE_BOUNDARY, "$1\u2029").split("\u2029").map((part) => part.trim()).filter(Boolean);
}

function renderBlock(block: DocumentBlock): string {
  if (block.kind === "title") return `# ${block.text}`;
  if (block.kind === "heading") return `## ${block.text}`;
  if (block.kind === "list_item") return `• ${block.text}`;
  if (block.kind === "table_row") return `| ${block.cells?.join(" | ") ?? block.text} |`;
  if (block.kind === "metadata") return `[Métadonnée] ${block.text}`;
  return block.text;
}

interface Piece {
  block: DocumentBlock;
  text: string;
}

function pieces(document: StructuredDocument, maxChars: number): Piece[] {
  return document.blocks.flatMap((block) => {
    const rendered = renderBlock(block);
    if (rendered.length <= maxChars) return [{ block, text: rendered }];
    const parts: Piece[] = [];
    let current = "";
    for (const sentence of splitSentences(rendered)) {
      if (current && current.length + sentence.length + 1 > maxChars) {
        parts.push({ block, text: current });
        current = "";
      }
      current = current ? `${current} ${sentence}` : sentence;
    }
    if (current) parts.push({ block, text: current });
    return parts;
  });
}

function outline(document: StructuredDocument): string {
  if (!document.sections.length) return "";
  return document.sections
    .map((section) => `- ${section.number ? `${section.number}. ` : ""}${section.title}${section.page ? ` (page ${section.page})` : ""}`)
    .join("\n");
}

function contextHeader(document: StructuredDocument, index: number, total: number, first: Piece | undefined): string {
  const lines = [
    `Document : ${document.title ?? "titre non détecté"}`,
    `Pages : ${document.pageCount ?? "non paginé"}`,
    `Morceau ${index + 1} sur ${total}`,
  ];
  if (total > 1) {
    const plan = outline(document);
    if (plan) lines.push("Plan du document :", plan);
    if (first?.block.section) lines.push(`Ce morceau reprend dans la section ${first.block.section}${first.block.sectionTitle ? ` — ${first.block.sectionTitle}` : ""}.`);
  }
  return lines.join("\n");
}

/**
 * Regroupe les blocs en morceaux sans couper de phrase. Chaque morceau rappelle
 * la page et la section en cours, et le plan du document quand il y a plusieurs morceaux.
 */
export function chunkDocument(document: StructuredDocument, options: ChunkOptions = {}): DocumentChunk[] {
  const maxChars = options.maxChars ?? 14_000;
  const wholeDocumentChars = options.wholeDocumentChars ?? 60_000;
  const all = pieces(document, maxChars);
  const totalChars = all.reduce((sum, piece) => sum + piece.text.length + 1, 0);
  const limit = totalChars <= wholeDocumentChars ? Number.POSITIVE_INFINITY : maxChars;

  const groups: Piece[][] = [];
  let current: Piece[] = [];
  let size = 0;
  for (const piece of all) {
    if (current.length && size + piece.text.length + 1 > limit) {
      groups.push(current);
      current = [];
      size = 0;
    }
    current.push(piece);
    size += piece.text.length + 1;
  }
  if (current.length) groups.push(current);

  return groups.map((group, index) => {
    const lines: string[] = [];
    let page: number | null | undefined;
    let section: string | null | undefined;
    for (const piece of group) {
      if (piece.block.page !== page) {
        page = piece.block.page;
        if (page !== null) lines.push(`=== PAGE ${page} ===`);
      }
      if (piece.block.section !== section) {
        section = piece.block.section;
        if (section && piece.block.kind !== "heading" && lines.length && !lines.at(-1)?.startsWith("## ")) {
          lines.push(`[Section ${section}${piece.block.sectionTitle && piece.block.sectionTitle !== section ? ` — ${piece.block.sectionTitle}` : ""}, suite]`);
        }
      }
      lines.push(piece.text);
    }
    const pages = group.map((piece) => piece.block.page).filter((value): value is number => value !== null);
    const sections = [...new Set(group.map((piece) => piece.block.section).filter((value): value is string => Boolean(value)))];
    return {
      index,
      total: groups.length,
      pages: [pages[0] ?? null, pages.at(-1) ?? null],
      sections,
      blockCount: new Set(group.map((piece) => piece.block.id)).size,
      text: `${contextHeader(document, index, groups.length, group[0])}\n\n${lines.join("\n")}`,
    };
  });
}
