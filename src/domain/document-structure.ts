export type BlockKind = "title" | "heading" | "paragraph" | "list_item" | "table_row" | "metadata";

export interface DocumentBlock {
  id: string;
  index: number;
  kind: BlockKind;
  /** Texte complet du bloc : les lignes coupées par la mise en page sont recollées. */
  text: string;
  cells: string[] | null;
  page: number | null;
  section: string | null;
  sectionTitle: string | null;
}

export interface DocumentSection {
  number: string | null;
  title: string;
  page: number | null;
}

export interface StructuredDocument {
  blocks: DocumentBlock[];
  sections: DocumentSection[];
  pageCount: number | null;
  title: string | null;
  metadata: Record<string, string>;
}

const PAGE_MARKER = /^---\s*Page\s+(\d+)\s*---$/i;
const SHEET_MARKER = /^---\s*Feuille\s+(.+?)\s*---$/i;
const METADATA_MARKER = /^---\s*Métadonnées\s*---$/i;
const BULLET = /^(?:[•●▪◦‣∙·*–-]|\d+[).]\s|[a-z][).]\s)\s*/;
const NUMBERED_HEADING = /^(?:Section\s+)?(\d+(?:\.\d+)*)\.?\s+([A-ZÀ-ÖØ-Þ«"].{1,140})$/;
const ANNEX_HEADING = /^(Annexe\s+[A-Z0-9]+)\b\s*[—–:-]?\s*(.*)$/i;
const SENTENCE_END = /[.!?:;»]$/;
const DANGLING_END = /(?:[,'-]|\s(?:de|du|des|la|le|les|et|ou|à|au|aux|en|pour|par|sur|avec|d'|l'))$/i;

/** Apostrophes et espaces typographiques ramenés à une forme comparable. */
export function foldText(value: string): string {
  return value
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u00a0\u202f\u2007]/g, " ")
    .replace(/[\u2013\u2014]/g, "-");
}

export function normalizeForMatch(value: string): string {
  return foldText(value)
    .replace(/\s*\|\s*/g, " ")
    .replace(/^[•●▪◦‣∙·*]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function headingParts(line: string): { number: string | null; title: string } | null {
  const marked = line.match(/^(#{1,2})\s+(.+)$/);
  const text = marked ? marked[2]!.trim() : line;
  const annex = text.match(ANNEX_HEADING);
  if (annex && text.length <= 160) return { number: annex[1]!.replace(/\s+/g, " "), title: annex[2]?.trim() || annex[1]! };
  const numbered = text.match(NUMBERED_HEADING);
  if (numbered && !/[.;,]$/.test(text) && !text.includes(" | ")) {
    return { number: numbered[1]!, title: numbered[2]!.trim() };
  }
  if (marked) return { number: null, title: text };
  return null;
}

/**
 * Découpe le texte extrait en blocs. Il reconnaît les marqueurs de page, les titres
 * numérotés, les annexes, les puces et les lignes de tableau (« | »).
 */
export function structureDocument(text: string): StructuredDocument {
  const blocks: DocumentBlock[] = [];
  const sections: DocumentSection[] = [];
  const metadata: Record<string, string> = {};
  let page: number | null = null;
  let section: string | null = null;
  let sectionTitle: string | null = null;
  let inMetadata = false;
  let maxPage = 0;

  const push = (kind: BlockKind, value: string, cells: string[] | null = null) => {
    blocks.push({
      id: `b${blocks.length}`,
      index: blocks.length,
      kind,
      text: value,
      cells,
      page,
      section,
      sectionTitle,
    });
  };

  for (const raw of text.replace(/\0/g, "").split(/\r?\n/)) {
    const line = raw.replace(/\s+$/g, "").trim();
    if (!line) continue;

    const pageMatch = line.match(PAGE_MARKER);
    if (pageMatch) {
      page = Number(pageMatch[1]);
      maxPage = Math.max(maxPage, page);
      inMetadata = false;
      continue;
    }
    const sheetMatch = line.match(SHEET_MARKER);
    if (sheetMatch) {
      section = sheetMatch[1]!;
      sectionTitle = sheetMatch[1]!;
      sections.push({ number: section, title: section, page });
      inMetadata = false;
      continue;
    }
    if (METADATA_MARKER.test(line)) {
      inMetadata = true;
      continue;
    }
    if (inMetadata) {
      const [key, ...rest] = line.split(":");
      if (key && rest.length) metadata[key.trim()] = rest.join(":").trim();
      push("metadata", line);
      continue;
    }

    // Un titre Word de niveau 1 numéroté (« # 3. Étendue des travaux ») ouvre une section.
    const numberedTop = /^#\s+/.test(line) && NUMBERED_HEADING.test(line.replace(/^#\s+/, "").trim());
    if (/^#\s+/.test(line) && !numberedTop) {
      const value = line.replace(/^#\s+/, "").trim();
      const previous = blocks.at(-1);
      if (previous?.kind === "title" && previous.page === page) {
        previous.text = `${previous.text} ${value}`;
      } else {
        push("title", value);
      }
      continue;
    }

    const heading = headingParts(line);
    if (heading) {
      section = heading.number ?? heading.title;
      sectionTitle = heading.title;
      sections.push({ number: heading.number, title: heading.title, page });
      push("heading", heading.number ? `${heading.number}. ${heading.title}`.replace(/^(Annexe [A-Z0-9]+)\. /i, "$1 — ") : heading.title);
      continue;
    }

    if (line.includes(" | ")) {
      const cells = line.split(" | ").map((cell) => cell.trim()).filter(Boolean);
      push("table_row", cells.join(" | "), cells);
      continue;
    }

    if (BULLET.test(line) && !/^\d+[.,]\d/.test(line)) {
      push("list_item", line.replace(BULLET, "").trim());
      continue;
    }

    const previous = blocks.at(-1);
    const continues = previous
      && (previous.kind === "paragraph" || previous.kind === "list_item")
      && !SENTENCE_END.test(previous.text)
      && (/^[a-zà-ÿ0-9(«"'’,]/.test(line) || DANGLING_END.test(foldText(previous.text)));
    if (continues) {
      previous.text = `${previous.text} ${line}`;
      continue;
    }
    push("paragraph", line);
  }

  const firstTitle = blocks.find((block) => block.kind === "title");
  return {
    blocks,
    sections,
    pageCount: maxPage || null,
    title: firstTitle?.text ?? null,
    metadata,
  };
}

/** Retrouve le bloc qui contient l'extrait. Les cellules de tableau sont comparées sans « | ». */
export function locateExcerpt(document: StructuredDocument, excerpt: string | null | undefined): DocumentBlock | null {
  if (!excerpt) return null;
  const needle = normalizeForMatch(excerpt).replace(/[.;,:]$/, "");
  if (needle.length < 3) return null;
  for (const block of document.blocks) {
    if (normalizeForMatch(block.text).includes(needle)) return block;
  }
  // Extrait à cheval sur deux blocs consécutifs (fin de page, puce coupée).
  for (let index = 0; index < document.blocks.length - 1; index += 1) {
    const joined = normalizeForMatch(`${document.blocks[index]!.text} ${document.blocks[index + 1]!.text}`);
    if (joined.includes(needle)) return document.blocks[index]!;
  }
  return null;
}

export function documentContains(document: StructuredDocument, value: string): boolean {
  const needle = normalizeForMatch(value);
  if (!needle) return false;
  return document.blocks.some((block) => normalizeForMatch(block.text).includes(needle));
}
