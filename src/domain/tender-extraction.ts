import { splitSentences } from "@/domain/chunking";
import { foldText, type DocumentBlock, type StructuredDocument } from "@/domain/document-structure";
import type {
  Confidence,
  MissingItem,
  QuantityItem,
  QuantityQualifier,
  QuestionItem,
  RiskItem,
  ScheduleItem,
  SourceRef,
  TenderAnalysis,
  TextFact,
  WorkPackageItem,
} from "@/lib/validation/tender-analysis.schema";
import { emptyTenderAnalysis } from "@/lib/validation/tender-analysis.schema";
import type { RiskLevel } from "@/domain/types";

/** Texte replié, sans accents et en minuscules, pour les expressions régulières. */
export function plain(value: string): string {
  return foldText(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function ref(block: DocumentBlock, excerpt?: string): SourceRef {
  return { page: block.page, section: block.section, excerpt: excerpt ?? block.text };
}

function fact(value: string, block: DocumentBlock, confidence: Confidence, excerpt?: string): TextFact {
  return { value, source: ref(block, excerpt), sourceType: "SOURCE_DOCUMENT", confidence };
}

const CONTENT_KINDS = new Set(["paragraph", "list_item", "table_row"]);

function contentBlocks(document: StructuredDocument): DocumentBlock[] {
  return document.blocks.filter((block) => CONTENT_KINDS.has(block.kind));
}

function labelValue(block: DocumentBlock): { label: string; value: string } | null {
  if (block.kind === "table_row" && block.cells?.length === 2) {
    return { label: block.cells[0]!, value: block.cells[1]! };
  }
  if (block.kind !== "list_item" && block.kind !== "paragraph") return null;
  const match = block.text.match(/^([^:]{2,80}?)\s*:\s*(.+)$/);
  if (!match) return null;
  return { label: match[1]!.trim(), value: match[2]!.trim() };
}

function sectionMatches(block: DocumentBlock, pattern: RegExp): boolean {
  return Boolean(block.sectionTitle && pattern.test(plain(block.sectionTitle)));
}

interface TableRow {
  block: DocumentBlock;
  /** En-tête du tableau, en texte simplifié ; vide si le tableau n'en a pas. */
  header: string[];
}

/** Lignes de tableau avec l'en-tête de leur tableau (première ligne sans nombre). */
function tableRows(document: StructuredDocument): TableRow[] {
  const rows: TableRow[] = [];
  let header: string[] = [];
  let previous: DocumentBlock | null = null;
  for (const block of document.blocks) {
    if (block.kind !== "table_row" || !block.cells) {
      previous = null;
      continue;
    }
    const startsTable = !previous || previous.section !== block.section;
    if (startsTable) header = [];
    if (startsTable && block.cells.every((cell) => parseNumber(cell) === null)) {
      header = block.cells.map((cell) => plain(cell).trim());
    } else {
      rows.push({ block, header });
    }
    previous = block;
  }
  return rows;
}

function column(header: string[], pattern: RegExp): number {
  return header.findIndex((cell) => pattern.test(cell));
}

// ---------- Nombres et dates ----------

export function parseNumber(raw: string): number | null {
  const cleaned = foldText(raw).replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

const pad = (value: number) => String(value).padStart(2, "0");

export function parseFrenchDate(text: string): { date: string; time: string | null } | null {
  const value = plain(text);
  let date: string | null = null;
  let end = 0;
  const written = value.match(/(\d{1,2})(?:er)?\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(\d{4})/);
  if (written) {
    const day = Number(written[1]);
    const month = MONTHS[written[2]!]!;
    if (day >= 1 && day <= 31) date = `${written[3]}-${pad(month)}-${pad(day)}`;
    end = (written.index ?? 0) + written[0].length;
  } else {
    const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
    const numeric = value.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
    if (iso) {
      date = `${iso[1]}-${iso[2]}-${iso[3]}`;
      end = (iso.index ?? 0) + iso[0].length;
    } else if (numeric) {
      date = `${numeric[3]}-${pad(Number(numeric[2]))}-${pad(Number(numeric[1]))}`;
      end = (numeric.index ?? 0) + numeric[0].length;
    }
  }
  if (!date) return null;
  const timeMatch = value.slice(end).match(/^\s*(?:a|,)?\s*(\d{1,2})\s*h\s*(\d{2})?/);
  const time = timeMatch ? `${pad(Number(timeMatch[1]))}:${timeMatch[2] ?? "00"}` : null;
  return { date, time };
}

// ---------- Projet et soumission ----------

const CLIENT_LABEL = /^(client|emetteur|acheteur|donneur d'ordre|maitre d'ouvrage|armateur|proprietaire|pouvoir adjudicateur|organisme acheteur|demandeur)$/;
const VESSEL_LABEL = /^(navire|nom du navire|batiment|vessel|unite navale)$/;
const LOCATION_LABEL = /^(port(?: principal)? des travaux|lieu(?: principal)? des travaux|lieu d'execution(?: des travaux)?|site des travaux|chantier|lieu de realisation|localisation(?: du projet| des travaux)?|lieu(?: du projet)?|emplacement(?: du projet)?|site(?: du projet)?)$/;
const NAME_LABEL = /^(nom du projet|projet|intitule|intitule du projet|titre du projet)$/;
const REFERENCE_LABEL = /^(reference|ref\.?|numero|n°|no)(?: de l'appel d'offres| de l'ao| du marche| du dossier)?$/;
const DEADLINE_LABEL = /^(date limite(?: de (?:reception|soumission|depot|remise)(?: des offres)?)?|remise des offres|date de remise(?: des offres)?)$/;

function mostlyUppercase(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length < 4) return false;
  const upper = letters.replace(/[^\p{Lu}]/gu, "").length;
  return upper / letters.length > 0.6;
}

/** Remet un titre en capitales en casse de phrase, en gardant les noms écrits en capitales ailleurs (ex. HORIZON). */
function sentenceCase(title: string, document: StructuredDocument, titleBlock: DocumentBlock): string {
  if (!mostlyUppercase(title)) return title;
  const evidence = document.blocks
    .filter((block) => block !== titleBlock && !mostlyUppercase(block.text))
    .map((block) => block.text)
    .join(" ");
  const words = title.split(/(\s+)/);
  let first = true;
  return words.map((word) => {
    if (/^\s+$/.test(word) || !word) return word;
    const core = word.replace(/[^\p{L}\d-]/gu, "");
    const keep = core.length >= 4 && new RegExp(`(^|[^\\p{L}])${core.replace(/[-]/g, "\\-")}([^\\p{L}]|$)`, "u").test(evidence);
    let result = keep ? word : word.toLowerCase();
    if (first && !keep) result = result.charAt(0).toUpperCase() + result.slice(1);
    first = false;
    return result;
  }).join("");
}

function cleanParty(value: string): string {
  return value.replace(/\s*\([^)]*\)\s*\.?$/, "").replace(/;$/, "").trim();
}

function extractProject(document: StructuredDocument, result: TenderAnalysis) {
  for (const block of contentBlocks(document)) {
    const pair = labelValue(block);
    if (!pair) continue;
    const label = plain(pair.label).replace(/\s+/g, " ");
    if (!result.project.name && NAME_LABEL.test(label)) {
      result.project.name = fact(pair.value.replace(/[.;]$/, ""), block, "HIGH");
    }
    if (!result.project.reference && REFERENCE_LABEL.test(label)) {
      const code = foldText(pair.value).match(/[A-Z0-9][A-Z0-9_/.-]{2,}/);
      if (code) result.project.reference = fact(code[0].replace(/[.-]$/, ""), block, "HIGH");
    }
    if (!result.project.client && CLIENT_LABEL.test(label)) {
      const value = cleanParty(pair.value);
      if (value) result.project.client = fact(value, block, "HIGH");
    }
    if (!result.project.vessel && VESSEL_LABEL.test(label)) {
      const value = pair.value.split(/\s+[-–—]\s+/)[0]!.replace(/[.;]$/, "").trim();
      if (value) result.project.vessel = fact(value, block, "HIGH");
    }
    if (!result.project.location && LOCATION_LABEL.test(label)) {
      const value = pair.value.replace(/[.;]$/, "").trim();
      if (value) result.project.location = fact(value, block, "HIGH");
    }
    if (!result.submission.deadline && DEADLINE_LABEL.test(label)) {
      const parsed = parseFrenchDate(pair.value);
      if (parsed) {
        result.submission.deadline = {
          value: parsed.date,
          time: parsed.time,
          text: pair.value.replace(/[.;]$/, ""),
          source: ref(block),
          sourceType: "SOURCE_DOCUMENT",
          confidence: "HIGH",
        };
      }
    }
    if (!result.submission.currency && /^(devise|monnaie)/.test(label)) {
      const iso = pair.value.match(/\b([A-Z]{3})\b/);
      const word = plain(pair.value);
      const code = iso?.[1] ?? (/euro/.test(word) ? "EUR" : /dollars? canadiens?/.test(word) ? "CAD" : /dollars? americains?|usd/.test(word) ? "USD" : null);
      if (code) result.submission.currency = { value: code, source: ref(block), sourceType: "SOURCE_DOCUMENT", confidence: "HIGH" };
    }
    if (!result.submission.validityDays && /validite/.test(label)) {
      const days = plain(pair.value).match(/(\d{1,4})\s*jours/);
      if (days) result.submission.validityDays = { value: Number(days[1]), source: ref(block), sourceType: "SOURCE_DOCUMENT", confidence: "HIGH" };
    }
  }

  if (!result.project.name) {
    const titleBlock = document.blocks.find((block) => block.kind === "title");
    if (titleBlock) {
      const stripped = foldText(titleBlock.text)
        .replace(/^appel d'offres\s*(?:public|restreint)?\s*[-:]\s*/i, "")
        .replace(/\s*\((?:document )?fictif\)\s*$/i, "")
        .trim();
      const original = titleBlock.text.slice(titleBlock.text.length - stripped.length);
      if (stripped.length >= 4) result.project.name = fact(sentenceCase(original, document, titleBlock), titleBlock, "MEDIUM");
    }
  }
}

// ---------- Lots de travaux ----------

const WP_LINE = /^((?:WP|LOT)\s*-?\s*\d+[A-Z]?)\s*[-:]\s*([^:]+?)\s*:\s*(.+)$/i;

function normalizeCode(raw: string): string {
  const match = raw.toUpperCase().replace(/\s+/g, "").match(/^(WP|LOT)-?(\d+[A-Z]?)$/);
  if (!match) return raw.trim();
  const number = match[2]!.replace(/^(\d)(?=\D|$)/, "0$1");
  return `${match[1]}-${number}`;
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function workPackageOf(block: DocumentBlock): { code: string; title: string; description: string } | null {
  if (block.kind !== "list_item" && block.kind !== "paragraph") return null;
  // foldText conserve la longueur : les positions valent pour le texte d'origine.
  const folded = foldText(block.text);
  const match = folded.match(WP_LINE);
  if (!match) return null;
  const titleStart = folded.indexOf(match[2]!, match[1]!.length);
  const colon = folded.indexOf(":", titleStart);
  return {
    code: normalizeCode(match[1]!),
    title: block.text.slice(titleStart, colon).trim(),
    description: block.text.slice(colon + 1).trim(),
  };
}

const LOT_HEADER = /^(lots?|n°|no|numero|code|item|poste|article|wp)$/;
const WORK_HEADER = /travaux|designation|description|libelle|intitule|nature|ouvrage/;

/** Code de lot d'une ligne de tableau : « 3 » devient LOT-03, « WP-2 » devient WP-02. */
function tableLotCode(row: TableRow): string | null {
  const index = column(row.header, LOT_HEADER);
  const raw = index < 0 ? null : row.block.cells![index]?.trim();
  if (!raw) return null;
  const code = normalizeCode(/^\d{1,3}[A-Z]?$/i.test(raw) ? `LOT-${raw}` : raw);
  return /^(WP|LOT)-\d+[A-Z]?$/.test(code) ? code : null;
}

function tableWorkPackages(document: StructuredDocument): WorkPackageItem[] {
  return tableRows(document).flatMap((row) => {
    const titleIndex = column(row.header, WORK_HEADER);
    const code = tableLotCode(row);
    const title = titleIndex < 0 ? "" : row.block.cells![titleIndex]?.trim() ?? "";
    if (!code || title.length < 3) return [];
    return [{
      code,
      title,
      description: null,
      tasks: [],
      source: ref(row.block),
      sourceType: "SOURCE_DOCUMENT" as const,
      confidence: "HIGH" as const,
    }];
  });
}

function extractWorkPackages(document: StructuredDocument): WorkPackageItem[] {
  const seen = new Set<string>();
  const items: WorkPackageItem[] = [];
  for (const block of contentBlocks(document)) {
    const wp = workPackageOf(block);
    if (!wp || seen.has(wp.code)) continue;
    seen.add(wp.code);
    const firstSentence = splitSentences(wp.description)[0] ?? wp.description;
    const tasks = firstSentence
      .replace(/[.]$/, "")
      .split(/\s*[;,]\s*/)
      .map((task) => task.trim())
      .filter((task) => task.length > 2)
      .map(capitalize);
    items.push({
      code: wp.code,
      title: wp.title,
      description: wp.description,
      tasks,
      source: ref(block),
      sourceType: "SOURCE_DOCUMENT",
      confidence: "HIGH",
    });
  }
  for (const item of tableWorkPackages(document)) {
    if (seen.has(item.code!)) continue;
    seen.add(item.code!);
    items.push(item);
  }
  return items;
}

// ---------- Quantités ----------

const UNIT = "m²|m2|m³|m3|ml|mm|cm|km|kg|tonnes?|litres?|unités?|pièces?|pcs|heures?|m|u|l";
const QUANTITY = new RegExp(`(\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})+|\\d+(?:[.,]\\d+)?)\\s*(${UNIT})(?![\\p{L}\\d²³])`, "giu");
const COUNT = /(\d+)\s+([a-zà-ÿ]{4,}(?:\s+[a-zà-ÿ]{5,})?)/giu;
const NOT_COUNT_NOUN = /^(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre|jours?|semaines?|mois|heures?|minutes?|ans|annees?|pour|fois)\b/;
const QUANTITY_SECTION = /quantit|bordereau|metre|devis quantitatif|annexe|donnees structurees/;

export function unitKey(unit: string): string {
  const value = plain(unit).trim();
  if (value === "m2") return "m²";
  if (value === "m3") return "m³";
  if (/^(unite|unites|u|pieces?|pcs)$/.test(value)) return "unités";
  if (/^heures?$/.test(value)) return "heures";
  return unit.trim();
}

function qualifiersAround(text: string, start: number, end: number) {
  const before = plain(text.slice(Math.max(0, start - 30), start));
  const after = foldText(text.slice(end, end + 24));
  const qualifiers: QuantityQualifier[] = [];
  const words: string[] = [];
  const approx = before.match(/(environ|approximativement|approximatif|approx\.?|pres de|de l'ordre de|~)\s*(?:d')?\s*$/);
  if (approx) {
    qualifiers.push("APPROXIMATE");
    words.push(approx[1]!);
  }
  const minimum = before.match(/(au moins|minimum de|minimum|minimal|>=|≥)\s*$/);
  if (minimum) {
    qualifiers.push("MINIMUM");
    words.push(minimum[1]!);
  }
  const maximum = before.match(/(au plus|maximum de|maximum|jusqu'a|<=|≤)\s*$/);
  if (maximum) {
    qualifiers.push("MAXIMUM");
    words.push(maximum[1]!);
  }
  let tolerancePct: number | null = null;
  const tolerance = after.match(/^\s*\(?\s*(±|\+\/-)\s*(\d+(?:[.,]\d+)?)\s*%/);
  if (tolerance) {
    qualifiers.push("TOLERANCE");
    tolerancePct = parseNumber(tolerance[2]!);
    words.push(`±${tolerance[2]} %`);
  }
  return { qualifiers, words, tolerancePct };
}

function quantityLabelFromPhrase(text: string, end: number): string | null {
  const after = foldText(text.slice(end));
  const match = after.match(/^\s+(?:de\s+|d')\s*([^,.;]+)/i);
  if (!match) return null;
  const phrase = match[1]!.split(/\s+(?:et|dans|sur|pour|avec)\s+/)[0]!.trim();
  return phrase.length > 2 ? capitalize(phrase) : null;
}

function pushQuantity(items: QuantityItem[], item: QuantityItem) {
  items.push(item);
}

/** Unités de bordereau, reconnues seulement dans une cellule « Unité ». */
const TABLE_UNIT = new RegExp(`^(${UNIT}|ha|t|ls|forfaits?|ens|global)$`, "iu");

function extractQuantities(document: StructuredDocument, pendingBlocks: Set<string>): QuantityItem[] {
  const items: QuantityItem[] = [];
  const rowsById = new Map(tableRows(document).map((row) => [row.block.id, row]));
  for (const block of contentBlocks(document)) {
    const plainText = plain(block.text);
    const indicative = sectionMatches(block, /indicati/) || /indicati/.test(plainText);
    const blockToConfirm = pendingBlocks.has(block.id) && /quantit/.test(plainText);

    if (block.kind === "table_row" && block.cells && block.cells.length >= 3) {
      const cells = block.cells;
      const numberIndex = cells.findIndex((cell, index) => index > 0 && parseNumber(cell) !== null);
      if (numberIndex < 0) continue;
      const unitCell = cells[numberIndex + 1];
      if (!unitCell || !TABLE_UNIT.test(unitCell.trim())) continue;
      const row = rowsById.get(block.id);
      const lotCode = row ? tableLotCode(row) : null;
      const numberedLot = lotCode !== null && parseNumber(cells[0]!) !== null;
      const labelCell = cells.slice(numberedLot ? 1 : 0, numberIndex).join(" ");
      const codeMatch = foldText(labelCell).match(/^((?:WP|LOT)\s*-?\s*\d+[A-Z]?)\s*/i);
      const rest = cells.slice(numberIndex + 2).join(" ");
      const tolerance = foldText(rest).match(/(±|\+\/-)\s*(\d+(?:[.,]\d+)?)\s*%/);
      const toConfirm = /a confirmer|a verifier|a preciser/.test(plain(rest));
      const qualifiers: QuantityQualifier[] = [];
      const words: string[] = [];
      if (tolerance) {
        qualifiers.push("TOLERANCE");
        words.push(`±${tolerance[2]} %`);
      }
      if (toConfirm) {
        qualifiers.push("TO_CONFIRM");
        words.push("à confirmer");
      }
      if (indicative) qualifiers.push("INDICATIVE");
      pushQuantity(items, {
        label: codeMatch ? labelCell.slice(codeMatch[0].length).trim() || labelCell : labelCell,
        value: parseNumber(cells[numberIndex]!)!,
        unit: unitKey(unitCell),
        qualifiers,
        qualifierText: words.length ? words.join(", ") : null,
        tolerancePct: tolerance ? parseNumber(tolerance[2]!) : null,
        workPackageCode: codeMatch ? normalizeCode(codeMatch[1]!) : lotCode,
        toConfirm,
        source: ref(block),
        sourceType: "SOURCE_DOCUMENT",
        confidence: "HIGH",
      });
      continue;
    }
    if (block.kind === "table_row") continue;

    const wp = workPackageOf(block);
    const inQuantitySection = sectionMatches(block, QUANTITY_SECTION);
    if (!wp && !inQuantitySection) continue;

    const scanned = wp ? block.text.replace(/^[^:]*:/, (head) => " ".repeat(head.length)) : block.text;
    const pair = labelValue(block);
    const found: { start: number; end: number; value: number; unit: string; label: string | null }[] = [];

    for (const match of scanned.matchAll(QUANTITY)) {
      const value = parseNumber(match[1]!);
      if (value === null) continue;
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const label = wp ? quantityLabelFromPhrase(block.text, end) ?? wp.title : pair?.label ?? null;
      found.push({ start, end, value, unit: unitKey(match[2]!), label });
    }
    if (wp) {
      for (const match of scanned.matchAll(COUNT)) {
        const start = match.index ?? 0;
        if (found.some((item) => start >= item.start && start < item.end)) continue;
        const noun = match[2]!;
        if (NOT_COUNT_NOUN.test(plain(noun)) || new RegExp(`^(${UNIT})\\b`, "iu").test(noun)) continue;
        found.push({ start, end: start + match[0].length, value: Number(match[1]), unit: "unités", label: capitalize(noun) });
      }
    }

    for (const item of found) {
      const around = qualifiersAround(block.text, item.start, item.end);
      const qualifiers = [...around.qualifiers];
      if (indicative) qualifiers.push("INDICATIVE");
      if (blockToConfirm) qualifiers.push("TO_CONFIRM");
      const sentence = splitSentences(block.text).find((part) => part.includes(block.text.slice(item.start, item.end).trim())) ?? block.text;
      pushQuantity(items, {
        label: item.label ?? (wp ? wp.title : "Quantité"),
        value: item.value,
        unit: item.unit,
        qualifiers,
        qualifierText: [...around.words, ...(blockToConfirm ? ["à confirmer"] : [])].join(", ") || null,
        tolerancePct: around.tolerancePct,
        workPackageCode: wp?.code ?? null,
        toConfirm: blockToConfirm,
        source: ref(block, sentence),
        sourceType: "SOURCE_DOCUMENT",
        confidence: wp ? "MEDIUM" : "HIGH",
      });
    }
  }
  return items;
}

// ---------- Calendrier ----------

const SCHEDULE_SECTION = /calendrier|echeancier|planning|dates? cles|chronologie|delais d'execution/;
const SCHEDULE_LABEL = /date|visite|remise|livraison|debut|fin |mobilisation|notification|achevement|questions|reponses|ouverture|attribution|demarrage|reception/;
const STOP_WORDS = new Set(["date", "dates", "les", "des", "de", "la", "le", "du", "prevue", "prevu", "cible"]);

function extractSchedule(document: StructuredDocument, pendingBlocks: Set<string>): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  const blocks = contentBlocks(document);
  for (const block of blocks) {
    const pair = labelValue(block);
    if (!pair) continue;
    const inSection = sectionMatches(block, SCHEDULE_SECTION);
    const label = plain(pair.label);
    const parsed = parseFrenchDate(pair.value);
    const duration = plain(pair.value).match(/^(?:environ\s+)?\d+\s*(jours?|semaines?|mois)\b/);
    const durationLabel = /duree|delai d'execution|delai contractuel/.test(label);
    if (!parsed && !((inSection || durationLabel) && duration)) continue;
    if (!inSection && !durationLabel && !SCHEDULE_LABEL.test(`${label} `)) continue;
    const kind: ScheduleItem["kind"] = /duree/.test(label) || (!parsed && duration)
      ? "DURATION"
      : /date limite|au plus tard|echeance/.test(`${label} ${plain(pair.value)}`) ? "DEADLINE" : "MILESTONE";
    const keyWord = label.split(/[^a-z]+/).find((word) => word.length >= 4 && !STOP_WORDS.has(word));
    const toConfirm = Boolean(keyWord) && blocks.some((other) =>
      pendingBlocks.has(other.id) && other.section === block.section && other !== block && plain(other.text).includes(keyWord!.slice(0, 7)),
    );
    items.push({
      label: pair.label,
      date: parsed?.date ?? null,
      time: parsed?.time ?? null,
      text: pair.value.replace(/[.;]$/, ""),
      kind,
      toConfirm,
      source: ref(block),
      sourceType: "SOURCE_DOCUMENT",
      confidence: inSection ? "HIGH" : "MEDIUM",
    });
  }
  return items;
}

const RELATIVE_TIME = /(mois|semaine|jour)\s*(\d{1,3})/;

/** Tableau « Activité | Début | Fin » : dates écrites ou rang relatif (« Mois 2 »). */
function tableSchedule(document: StructuredDocument): ScheduleItem[] {
  return tableRows(document).flatMap((row) => {
    const startIndex = column(row.header, /^(debut|date de debut|demarrage)/);
    const endIndex = column(row.header, /^(fin|date de fin|achevement)/);
    if (startIndex < 0 || endIndex < 0) return [];
    const cells = row.block.cells!;
    const label = cells.find((_, index) => index !== startIndex && index !== endIndex)?.trim();
    const from = cells[startIndex]?.trim();
    const to = cells[endIndex]?.trim();
    if (!label || !from || !to) return [];
    const parsed = parseFrenchDate(from);
    if (!parsed && !(RELATIVE_TIME.test(plain(from)) && RELATIVE_TIME.test(plain(to)))) return [];
    return [{
      label,
      date: parsed?.date ?? null,
      time: null,
      text: `${from} → ${to}`,
      kind: "PERIOD" as const,
      toConfirm: false,
      source: ref(row.block),
      sourceType: "SOURCE_DOCUMENT" as const,
      confidence: "HIGH" as const,
    }];
  });
}

// ---------- Informations manquantes ----------

const PENDING: [RegExp][] = [
  [/(?:reste(?:nt)? )?a confirmer/],
  [/a verifier/],
  [/a preciser|a definir|a determiner/],
  [/sujet(?:te)?s? a confirmation/],
  [/(?:sera|seront|doit etre|doivent etre) (?:confirmee?s?|confirmes)/],
  [/(?:sera|seront) (?:communiquee?s?|transmise?s?|fournie?s?|precisee?s?|definie?s?|approuvee?s?)/],
  [/non precisee?s?|ne precise pas(?: encore)?|n'est pas (?:specifiee?|precisee?|definie?|indiquee?)|ne sont pas (?:specifiee?s|precisee?s|quantifiee?s|definie?s)|non specifiee?s?|non definie?s?/],
  [/pas encore (?:definie?s?|connue?s?|precisee?s?|disponibles?)/],
  [/non fournie?s?|non disponibles?|non jointe?s?|ne sont pas joints/],
  [/en attente d/],
];

const DEPENDENCY = /(?:sera|seront) (?:communique|transmis|fourni|approuve)|selon la disponibilite|apres (?:la visite|l'inspection|inspection|releve)/;

/** Expression d'attente trouvée, citée telle qu'elle figure dans le texte. */
export function pendingTrigger(text: string): string | null {
  const source = text.normalize("NFC");
  const value = plain(source);
  if (/par le soumissionnaire|le soumissionnaire doit/.test(value)) return null;
  for (const [pattern] of PENDING) {
    const match = value.match(pattern);
    if (match) return source.slice(match.index ?? 0, (match.index ?? 0) + match[0].length);
  }
  return null;
}

/** Section qui liste ce que le donneur d'ordre n'a pas encore fourni. */
const MISSING_SECTION = /informations? (?:manquantes?|a (?:confirmer|obtenir|fournir|preciser))|elements? manquants?|donnees manquantes|points? (?:a confirmer|ouverts)/;

function extractMissing(document: StructuredDocument, pendingBlocks: Set<string>): MissingItem[] {
  const items: MissingItem[] = [];
  for (const block of contentBlocks(document)) {
    if (block.kind === "table_row") continue;
    const listed = block.kind === "list_item" && sectionMatches(block, MISSING_SECTION) && !/soumissionnaire/.test(plain(block.text));
    const sentences = splitSentences(block.text);
    const flagged = sentences.some((sentence) => pendingTrigger(sentence));
    for (const sentence of flagged || !listed ? sentences : [block.text]) {
      const trigger = pendingTrigger(sentence);
      if (!trigger && (flagged || !listed)) continue;
      pendingBlocks.add(block.id);
      const wp = workPackageOf(block);
      const value = plain(sentence);
      const kind = DEPENDENCY.test(value) ? "DEPENDENCY" : "MISSING_INFORMATION";
      const description = wp && !sentence.startsWith(wp.code) ? `${wp.code} — ${sentence}` : sentence;
      items.push({
        description,
        kind,
        importance: /quantit|epaisseur|tole|acier|dates?|fenetre|acces|mobilisation|achevement|classification/.test(value) ? "HIGH" : "MEDIUM",
        action: kind === "DEPENDENCY"
          ? "Suivre cette dépendance, l'inscrire comme réserve dans l'offre et intégrer l'information dès réception."
          : "Demander la confirmation au client avant de figer le prix.",
        trigger,
        source: ref(block, sentence),
        sourceType: "SOURCE_DOCUMENT",
        confidence: "HIGH",
      });
    }
  }
  return items;
}

// ---------- Exigences, contraintes, documents, hypothèses ----------

const REQUIREMENT_VERB = /\b(doit|doivent|devra|devront|obligatoire|obligatoirement|exige|exigee?s?|requise?s?|fournir|presenter|identifier|soumettre|inclure|signaler)\b/;
const REQUIREMENT_SECTION = /exigence|critere/;
const CONSTRAINT = /immobilisation|coactivite|acces au navire|a quai|cale seche|exigu|approuves? par ecrit|retenue de|paiement propose|taxes doivent|procedures de securite|personnel qualifie|horaires de travail|travail de nuit|week-end|non conformes?/;
const DOCUMENT_SECTION = /documents? a (?:remettre|fournir|joindre|produire)|pieces? (?:a fournir|a joindre|requises)|livrables|contenu de l'offre/;
const ASSUMPTION = /indicati|sous reserve|sauf indication contraire|est suppose|on suppose|par hypothese/;

function extractTexts(document: StructuredDocument, pendingBlocks: Set<string>, factBlocks: Set<string>) {
  const requirements: TenderAnalysis["requirements"] = [];
  const constraints: TenderAnalysis["constraints"] = [];
  const requiredDocuments: TenderAnalysis["requiredDocuments"] = [];
  const assumptions: TenderAnalysis["assumptions"] = [];

  for (const block of contentBlocks(document)) {
    if (block.kind === "table_row") continue;
    const value = plain(block.text);
    if (sectionMatches(block, DOCUMENT_SECTION)) {
      requiredDocuments.push({ name: block.text.replace(/[.;]$/, ""), source: ref(block), sourceType: "SOURCE_DOCUMENT", confidence: "HIGH" });
      continue;
    }
    const pending = pendingBlocks.has(block.id);
    const isWorkPackage = Boolean(workPackageOf(block));
    if (!pending && !isWorkPackage && !factBlocks.has(block.id)
      && (REQUIREMENT_VERB.test(value) || sectionMatches(block, REQUIREMENT_SECTION))) {
      requirements.push({ text: block.text, category: block.sectionTitle, source: ref(block), sourceType: "SOURCE_DOCUMENT", confidence: "HIGH" });
    }
    if (!pending && CONSTRAINT.test(value)) {
      constraints.push({ text: block.text, source: ref(block), sourceType: "SOURCE_DOCUMENT", confidence: "MEDIUM" });
    }
    if ((ASSUMPTION.test(value) || (block.kind === "list_item" && sectionMatches(block, /hypothese/))) && !isWorkPackage) {
      assumptions.push({
        description: block.text,
        impact: /quantit/.test(value) ? "Les quantités peuvent varier : l'offre doit préciser sa base de calcul." : null,
        source: ref(block),
        sourceType: "SOURCE_DOCUMENT",
        confidence: "HIGH",
      });
    }
  }
  return { requirements, constraints, requiredDocuments, assumptions };
}

// ---------- Risques et questions (propositions marquées AI_DATA) ----------

const RANK: Record<RiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export function riskLevel(probability: RiskLevel, impact: RiskLevel): RiskLevel {
  const score = RANK[probability] * RANK[impact];
  if (score >= 12) return "CRITICAL";
  if (score >= 6) return "HIGH";
  if (score >= 3) return "MEDIUM";
  return "LOW";
}

interface RiskRule {
  pattern: RegExp;
  title: string;
  description: string;
  probability: RiskLevel;
  impact: RiskLevel;
  mitigation: string;
}

const RISK_RULES: RiskRule[] = [
  {
    pattern: /quantites? finales?.*confirm|apres (?:inspection|releve)/,
    title: "Quantités définitives connues seulement après inspection",
    description: "Le document annonce une confirmation des quantités après inspection : un prix forfaitaire fondé sur la quantité indicative peut être dépassé.",
    probability: "HIGH",
    impact: "HIGH",
    mitigation: "Chiffrer sur la base indicative et proposer des prix unitaires pour les écarts.",
  },
  {
    pattern: /epaisseur exacte|epaisseur.*(?:non precis|ne precise pas)/,
    title: "Épaisseur des tôles non spécifiée",
    description: "Sans épaisseur, le poids d'acier, le temps de soudage et le prix des tôles restent incertains.",
    probability: "HIGH",
    impact: "MEDIUM",
    mitigation: "Demander l'épaisseur au client ou inscrire une hypothèse d'épaisseur dans l'offre.",
  },
  {
    pattern: /disponibilite du navire|dates? .*sujettes? a confirmation/,
    title: "Calendrier dépendant de la disponibilité du navire",
    description: "Les dates de mobilisation et d'achèvement ne sont pas garanties par le donneur d'ordre.",
    probability: "MEDIUM",
    impact: "HIGH",
    mitigation: "Inscrire les dates comme hypothèse et prévoir une clause de révision du planning.",
  },
  {
    pattern: /coactivite/,
    title: "Coactivité et accès au navire non définis",
    description: "Les fenêtres d'accès et la coactivité influencent la productivité des équipes à bord.",
    probability: "MEDIUM",
    impact: "MEDIUM",
    mitigation: "Demander les fenêtres d'accès et intégrer une hypothèse de productivité.",
  },
  {
    pattern: /classification.*(?:a confirmer|sont a confirmer)|exigences .*classification/,
    title: "Exigences de la société de classification non connues",
    description: "Des exigences de classe peuvent ajouter des essais, des inspections ou des matériaux certifiés.",
    probability: "MEDIUM",
    impact: "HIGH",
    mitigation: "Obtenir les exigences de classe avant de figer les méthodes, les essais et les matériaux.",
  },
  {
    pattern: /systeme de peinture definitif|specifications de preparation de surface/,
    title: "Système de peinture non arrêté",
    description: "Le système et la préparation de surface définitifs conditionnent la main-d'œuvre et les produits.",
    probability: "MEDIUM",
    impact: "MEDIUM",
    mitigation: "Chiffrer un système de référence et présenter l'écart possible en option.",
  },
  {
    pattern: /retenue de \d+/,
    title: "Retenue sur paiements jusqu'à l'acceptation finale",
    description: "Une retenue décale l'encaissement d'une partie du prix.",
    probability: "MEDIUM",
    impact: "LOW",
    mitigation: "Intégrer l'effet de trésorerie dans les conditions de paiement de l'offre.",
  },
  {
    pattern: /penalite/,
    title: "Pénalités de retard",
    description: "Le document prévoit des pénalités liées au délai.",
    probability: "MEDIUM",
    impact: "HIGH",
    mitigation: "Vérifier le plafond des pénalités et sécuriser le planning.",
  },
  {
    pattern: /amiante|plomb|pcb|matieres? dangereuses?/,
    title: "Présence possible de matières dangereuses",
    description: "Des matières dangereuses imposent des procédures et des délais spécifiques.",
    probability: "MEDIUM",
    impact: "HIGH",
    mitigation: "Exiger un diagnostic et chiffrer le désamiantage ou la dépollution séparément.",
  },
];

const WRITTEN_LEVELS: [RegExp, RiskLevel][] = [
  [/critique|tres eleve|majeur/, "CRITICAL"],
  [/eleve|fort|haut/, "HIGH"],
  [/moyen|modere/, "MEDIUM"],
  [/faible|bas|mineur/, "LOW"],
];

/** Tableau de risques du document : le niveau écrit sert de probabilité et d'impact. */
function tableRisks(document: StructuredDocument): RiskItem[] {
  return tableRows(document).flatMap((row) => {
    const titleIndex = column(row.header, /^(risques?|risques? identifies?|nature du risque)$/);
    if (titleIndex < 0) return [];
    const cells = row.block.cells!;
    const title = cells[titleIndex]?.trim() ?? "";
    if (title.length < 3) return [];
    const cell = (pattern: RegExp) => {
      const index = column(row.header, pattern);
      return index < 0 ? null : cells[index]?.trim() || null;
    };
    const levelText = plain(cell(/niveau|criticite|gravite|cotation/) ?? "");
    const level = WRITTEN_LEVELS.find(([pattern]) => pattern.test(levelText))?.[1];
    if (!level) return [];
    return [{
      title,
      description: cell(/description|detail|cause|commentaire/),
      probability: level,
      impact: level,
      level,
      mitigation: cell(/mesure|attenuation|mitigation|parade|traitement/),
      source: ref(row.block),
      sourceType: "SOURCE_DOCUMENT" as const,
      confidence: "HIGH" as const,
    }];
  });
}

function extractRisks(document: StructuredDocument, quantities: QuantityItem[]): RiskItem[] {
  const risks: RiskItem[] = tableRisks(document);
  const blocks = contentBlocks(document);
  const seen = new Set<string>();
  for (const quantity of quantities) {
    if (quantity.tolerancePct === null || quantity.tolerancePct < 20) continue;
    const key = `${quantity.value}|${unitKey(quantity.unit)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const impact: RiskLevel = quantity.tolerancePct >= 25 ? "HIGH" : "MEDIUM";
    risks.push({
      title: `Écart de quantité : ${quantity.label} (±${quantity.tolerancePct} %)`,
      description: `La quantité indicative peut varier de ±${quantity.tolerancePct} % ; un forfait fondé sur la valeur nominale expose à un dépassement.`,
      probability: "MEDIUM",
      impact,
      level: riskLevel("MEDIUM", impact),
      mitigation: "Prévoir un prix unitaire pour les quantités hors tolérance ou une réserve dédiée.",
      source: quantity.source,
      sourceType: "AI_DATA",
      confidence: "MEDIUM",
    });
  }
  for (const rule of RISK_RULES) {
    for (const block of blocks) {
      const sentence = splitSentences(block.text).find((part) => rule.pattern.test(plain(part)));
      if (!sentence) continue;
      const explicit = /risque|penalite|danger|amiante/.test(plain(sentence));
      risks.push({
        title: rule.title,
        description: rule.description,
        probability: rule.probability,
        impact: rule.impact,
        level: riskLevel(rule.probability, rule.impact),
        mitigation: rule.mitigation,
        source: ref(block, sentence),
        sourceType: explicit ? "SOURCE_DOCUMENT" : "AI_DATA",
        confidence: "MEDIUM",
      });
      break;
    }
  }
  return risks;
}

function questionsFromMissing(missing: MissingItem[]): QuestionItem[] {
  return missing.map((item) => {
    const excerpt = item.source.excerpt ?? item.description;
    return {
      question: item.kind === "DEPENDENCY"
        ? `À quelle date cette information sera-t-elle transmise : « ${excerpt} » ?`
        : `Pouvez-vous confirmer ou préciser ce point : « ${excerpt} » ?`,
      reason: item.trigger ? `Le document indique « ${item.trigger} ».` : null,
      source: item.source,
      sourceType: "AI_DATA" as const,
      confidence: "MEDIUM" as const,
    };
  });
}

/**
 * Extraction déterministe : uniquement des faits retrouvés dans les blocs.
 * Les risques et les questions sont des propositions (AI_DATA) reliées à une citation.
 */
export function extractTenderFacts(document: StructuredDocument): TenderAnalysis {
  const result = emptyTenderAnalysis();
  extractProject(document, result);
  const factBlocks = new Set<string>();
  const pendingBlocks = new Set<string>();
  result.missingInformation = extractMissing(document, pendingBlocks);
  result.workPackages = extractWorkPackages(document);
  result.quantities = extractQuantities(document, pendingBlocks);
  result.schedule = [...extractSchedule(document, pendingBlocks), ...tableSchedule(document)];
  for (const block of contentBlocks(document)) {
    const pair = labelValue(block);
    if (pair && sectionMatches(block, SCHEDULE_SECTION)) factBlocks.add(block.id);
    if (pair && /^(devise|monnaie|reference|emetteur|navire|client)/.test(plain(pair.label))) factBlocks.add(block.id);
  }
  Object.assign(result, extractTexts(document, pendingBlocks, factBlocks));
  result.risks = extractRisks(document, result.quantities);
  result.questionsForClient = questionsFromMissing(result.missingInformation);
  return result;
}
