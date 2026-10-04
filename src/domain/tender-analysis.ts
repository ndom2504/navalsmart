import {
  documentContains,
  locateExcerpt,
  normalizeForMatch,
  type DocumentBlock,
  type StructuredDocument,
} from "@/domain/document-structure";
import { unitKey } from "@/domain/tender-extraction";
import type { Analysis, Provenance } from "@/domain/types";
import type {
  QuantityItem,
  QuantityQualifier,
  SourceRef,
  SourceType,
  TenderAnalysis,
  TextFact,
} from "@/lib/validation/tender-analysis.schema";

export const PROVENANCE_BY_SOURCE: Record<SourceType, Provenance> = {
  SOURCE_DOCUMENT: "DOCUMENT",
  USER_DATA: "USER",
  AI_DATA: "AI",
  SYSTEM_CALCULATION: "SYSTEM",
};

export interface GroundingReport {
  dropped: string[];
  reclassified: string[];
}

interface Traced {
  source: SourceRef;
  sourceType: SourceType;
}

/** Recalcule page et section depuis le bloc retrouvé ; le modèle ne fait pas foi. */
function anchor<T extends Traced>(item: T, block: DocumentBlock): T {
  return { ...item, source: { ...item.source, page: block.page, section: block.section } };
}

function numberAppears(text: string, value: number): boolean {
  const compact = text.replace(/(\d)[\s\u00a0\u202f](?=\d{3}\b)/g, "$1").replace(/(\d),(\d)/g, "$1.$2");
  return (compact.match(/\d+(?:\.\d+)?/g) ?? []).some((token) => Number(token) === value);
}

const EXPLICIT_RISK = /risque|penalit|pénalit|danger|amiante|incertitude|aléa|alea/i;

/**
 * Ancre chaque élément du modèle dans le document. Un fait SOURCE_DOCUMENT sans
 * citation retrouvée est écarté. Une proposition sans citation reste AI_DATA.
 */
export function groundTenderAnalysis(document: StructuredDocument, data: TenderAnalysis): { data: TenderAnalysis; report: GroundingReport } {
  const report: GroundingReport = { dropped: [], reclassified: [] };

  const sourced = <T extends Traced>(label: string, item: T, check?: (block: DocumentBlock) => boolean): T | null => {
    const normalized = item.sourceType === "SOURCE_DOCUMENT" || item.sourceType === "AI_DATA" ? item : { ...item, sourceType: "AI_DATA" as const };
    const block = locateExcerpt(document, normalized.source.excerpt);
    if (!block || (check && !check(block))) {
      report.dropped.push(`${label} : citation absente du document (« ${normalized.source.excerpt ?? "aucune"} »)`);
      return null;
    }
    return anchor(normalized, block);
  };

  const proposal = <T extends Traced>(label: string, item: T): T => {
    const block = locateExcerpt(document, item.source.excerpt);
    if (block) return anchor(item.sourceType === "SOURCE_DOCUMENT" ? item : { ...item, sourceType: "AI_DATA" as const }, block);
    if (item.sourceType !== "AI_DATA") report.reclassified.push(`${label} : sans citation retrouvée, classé AI_DATA`);
    return { ...item, sourceType: "AI_DATA" as const, source: { page: null, section: null, excerpt: null } };
  };

  const textFact = (label: string, fact: TextFact | null): TextFact | null => {
    if (!fact) return null;
    if (!documentContains(document, fact.value)) {
      report.dropped.push(`${label} : valeur « ${fact.value} » absente du document`);
      return null;
    }
    return sourced(label, { ...fact, sourceType: "SOURCE_DOCUMENT" });
  };

  const submission = data.submission;
  const result: TenderAnalysis = {
    project: {
      name: textFact("project.name", data.project.name),
      reference: textFact("project.reference", data.project.reference),
      client: textFact("project.client", data.project.client),
      vessel: textFact("project.vessel", data.project.vessel),
      location: textFact("project.location", data.project.location),
    },
    submission: {
      deadline: submission.deadline
        ? sourced("submission.deadline", { ...submission.deadline, sourceType: "SOURCE_DOCUMENT" as const }, (block) => {
          if (!submission.deadline?.value) return true;
          const [year, , day] = submission.deadline.value.split("-");
          return block.text.includes(year!) && numberAppears(block.text, Number(day));
        })
        : null,
      currency: submission.currency
        ? sourced("submission.currency", { ...submission.currency, sourceType: "SOURCE_DOCUMENT" as const }, (block) =>
          block.text.includes(submission.currency!.value) || /euro|dollar/i.test(block.text))
        : null,
      validityDays: submission.validityDays
        ? sourced("submission.validityDays", { ...submission.validityDays, sourceType: "SOURCE_DOCUMENT" as const }, (block) =>
          numberAppears(block.text, submission.validityDays!.value))
        : null,
    },
    workPackages: data.workPackages.flatMap((item, index) => {
      const kept = sourced(`workPackages[${index}]`, { ...item, sourceType: "SOURCE_DOCUMENT" as const });
      return kept ? [kept] : [];
    }),
    quantities: data.quantities.flatMap((item, index) => {
      const kept = sourced(`quantities[${index}]`, { ...item, sourceType: "SOURCE_DOCUMENT" as const }, (block) =>
        numberAppears(item.source.excerpt ?? "", item.value) || numberAppears(block.text, item.value));
      return kept ? [kept] : [];
    }),
    requirements: data.requirements.flatMap((item, index) => {
      const kept = sourced(`requirements[${index}]`, { ...item, sourceType: "SOURCE_DOCUMENT" as const });
      return kept ? [kept] : [];
    }),
    schedule: data.schedule.flatMap((item, index) => {
      const kept = sourced(`schedule[${index}]`, { ...item, sourceType: "SOURCE_DOCUMENT" as const });
      return kept ? [kept] : [];
    }),
    requiredDocuments: data.requiredDocuments.flatMap((item, index) => {
      const kept = sourced(`requiredDocuments[${index}]`, { ...item, sourceType: "SOURCE_DOCUMENT" as const });
      return kept ? [kept] : [];
    }),
    constraints: data.constraints.flatMap((item, index) => {
      const kept = sourced(`constraints[${index}]`, { ...item, sourceType: "SOURCE_DOCUMENT" as const });
      return kept ? [kept] : [];
    }),
    risks: data.risks.flatMap((item, index) => {
      const kept = sourced(`risks[${index}]`, item);
      if (!kept) return [];
      const explicit = EXPLICIT_RISK.test(kept.source.excerpt ?? "");
      if (kept.sourceType === "SOURCE_DOCUMENT" && !explicit) {
        report.reclassified.push(`risks[${index}] : risque déduit, classé AI_DATA`);
        return [{ ...kept, sourceType: "AI_DATA" as const }];
      }
      return [kept];
    }),
    missingInformation: data.missingInformation.map((item, index) => proposal(`missingInformation[${index}]`, item)),
    assumptions: data.assumptions.map((item, index) => proposal(`assumptions[${index}]`, item)),
    questionsForClient: data.questionsForClient.map((item, index) => {
      const kept = proposal(`questionsForClient[${index}]`, item);
      return { ...kept, sourceType: "AI_DATA" as const };
    }),
  };
  return { data: result, report };
}

// ---------- Fusion ----------

const QUALIFIER_ORDER: QuantityQualifier[] = ["APPROXIMATE", "MINIMUM", "MAXIMUM", "TOLERANCE", "INDICATIVE", "TO_CONFIRM", "EXACT"];

function blockIndex(document: StructuredDocument, source: SourceRef): number {
  return locateExcerpt(document, source.excerpt)?.index ?? Number.MAX_SAFE_INTEGER;
}

function quantityScore(item: QuantityItem): number {
  return (item.tolerancePct !== null ? 4 : 0) + (item.confidence === "HIGH" ? 2 : 0) + (item.workPackageCode ? 1 : 0);
}

function mergeQuantity(base: QuantityItem, other: QuantityItem): QuantityItem {
  const [rich, poor] = quantityScore(other) > quantityScore(base) ? [other, base] : [base, other];
  const qualifiers = QUALIFIER_ORDER.filter((qualifier) => rich.qualifiers.includes(qualifier) || poor.qualifiers.includes(qualifier));
  const words = [rich.qualifierText, poor.qualifierText]
    .flatMap((text) => (text ?? "").split(/\s*,\s*/))
    .filter(Boolean);
  return {
    ...rich,
    qualifiers: qualifiers.length > 1 ? qualifiers.filter((qualifier) => qualifier !== "EXACT") : qualifiers,
    qualifierText: [...new Set(words)].join(", ") || null,
    tolerancePct: rich.tolerancePct ?? poor.tolerancePct,
    workPackageCode: rich.workPackageCode ?? poor.workPackageCode,
    toConfirm: rich.toConfirm || poor.toConfirm,
  };
}

function quantityKey(item: QuantityItem): string {
  return `${item.value}|${unitKey(item.unit)}`;
}

function dedupeQuantities(items: QuantityItem[]): QuantityItem[] {
  const result: QuantityItem[] = [];
  for (const item of items) {
    const index = result.findIndex((current) => quantityKey(current) === quantityKey(item)
      && (!current.workPackageCode || !item.workPackageCode || current.workPackageCode === item.workPackageCode));
    if (index < 0) result.push({ ...item, unit: unitKey(item.unit) });
    else result[index] = mergeQuantity(result[index]!, item);
  }
  return result;
}

const CONFIDENCE_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const;

/** Garde un élément par clé ; à clé égale, le plus fiable l'emporte. */
function dedupeBy<T extends { confidence: keyof typeof CONFIDENCE_RANK }>(items: T[], key: (item: T) => string): T[] {
  const kept = new Map<string, T>();
  for (const item of items) {
    const value = key(item);
    if (!value) continue;
    const current = kept.get(value);
    if (!current || CONFIDENCE_RANK[item.confidence] > CONFIDENCE_RANK[current.confidence]) kept.set(value, item);
  }
  return [...kept.values()];
}

function sortByDocument<T extends { source: SourceRef }>(document: StructuredDocument, items: T[]): T[] {
  return items
    .map((item, order) => ({ item, order, position: blockIndex(document, item.source) }))
    .sort((a, b) => a.position - b.position || a.order - b.order)
    .map((entry) => entry.item);
}

/**
 * Fusionne deux extractions. Le premier argument est prioritaire pour les faits
 * uniques ; les listes sont réunies, dédoublonnées et triées dans l'ordre du document.
 */
export function mergeTenderAnalyses(document: StructuredDocument, primary: TenderAnalysis, secondary: TenderAnalysis): TenderAnalysis {
  const located = (source: SourceRef, fallback: string) => {
    const block = locateExcerpt(document, source.excerpt);
    return block ? block.id : normalizeForMatch(fallback);
  };
  const scheduleKey = (item: TenderAnalysis["schedule"][number]) =>
    item.date ? `${item.date}|${item.time ?? ""}|${item.kind === "DURATION" ? item.label : ""}` : `${normalizeForMatch(item.label)}|${normalizeForMatch(item.text)}`;

  const workPackages = dedupeBy(
    [...primary.workPackages, ...secondary.workPackages],
    (item) => item.code ? item.code.toUpperCase().replace(/\s+/g, "") : normalizeForMatch(item.title),
  );

  return {
    project: {
      name: primary.project.name ?? secondary.project.name,
      reference: primary.project.reference ?? secondary.project.reference,
      client: primary.project.client ?? secondary.project.client,
      vessel: primary.project.vessel ?? secondary.project.vessel,
      location: primary.project.location ?? secondary.project.location,
    },
    submission: {
      deadline: primary.submission.deadline ?? secondary.submission.deadline,
      currency: primary.submission.currency ?? secondary.submission.currency,
      validityDays: primary.submission.validityDays ?? secondary.submission.validityDays,
    },
    workPackages: sortByDocument(document, workPackages).sort((a, b) => (a.code ?? "~").localeCompare(b.code ?? "~", "fr", { numeric: true })),
    quantities: sortByDocument(document, dedupeQuantities([...primary.quantities, ...secondary.quantities])),
    requirements: sortByDocument(document, dedupeBy([...primary.requirements, ...secondary.requirements], (item) => located(item.source, item.text))),
    schedule: sortByDocument(document, dedupeBy([...primary.schedule, ...secondary.schedule], scheduleKey)),
    requiredDocuments: sortByDocument(document, dedupeBy([...primary.requiredDocuments, ...secondary.requiredDocuments], (item) => normalizeForMatch(item.name))),
    constraints: sortByDocument(document, dedupeBy([...primary.constraints, ...secondary.constraints], (item) => located(item.source, item.text))),
    risks: sortByDocument(document, dedupeBy([...primary.risks, ...secondary.risks], (item) => normalizeForMatch(item.title))),
    missingInformation: sortByDocument(document, dedupeBy(
      [...primary.missingInformation, ...secondary.missingInformation],
      (item) => item.source.excerpt ? normalizeForMatch(item.source.excerpt) : normalizeForMatch(item.description),
    )),
    assumptions: sortByDocument(document, dedupeBy([...primary.assumptions, ...secondary.assumptions], (item) => located(item.source, item.description))),
    questionsForClient: sortByDocument(document, dedupeBy(
      [...primary.questionsForClient, ...secondary.questionsForClient],
      (item) => item.source.excerpt ? `q|${normalizeForMatch(item.source.excerpt)}` : normalizeForMatch(item.question),
    )),
  };
}

// ---------- Projection vers le modèle existant ----------

const QUALIFIER_LABELS: Record<QuantityQualifier, string> = {
  EXACT: "exact",
  APPROXIMATE: "environ",
  MINIMUM: "minimum",
  MAXIMUM: "maximum",
  TOLERANCE: "tolérance",
  INDICATIVE: "indicatif",
  TO_CONFIRM: "à confirmer",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 3 }).format(value).replace(/\u202f|\u00a0/g, " ");
}

export function describeQuantity(item: QuantityItem): string {
  const written = (item.qualifierText ?? "").split(/\s*,\s*/).filter(Boolean);
  const qualifiers = new Set(item.qualifiers);
  if (item.tolerancePct !== null) qualifiers.add("TOLERANCE");
  if (item.toConfirm) qualifiers.add("TO_CONFIRM");
  const notes = QUALIFIER_ORDER.filter((qualifier) => qualifiers.has(qualifier) && qualifier !== "EXACT").map((qualifier) => {
    if (qualifier === "TOLERANCE") return item.tolerancePct !== null ? `±${formatNumber(item.tolerancePct)} %` : written.find((word) => word.includes("±")) ?? "tolérance";
    if (qualifier === "APPROXIMATE") return written.find((word) => /environ|approx|près|ordre/i.test(word)) ?? "environ";
    return QUALIFIER_LABELS[qualifier];
  });
  const code = item.workPackageCode ? `${item.workPackageCode} · ` : "";
  return `${code}${item.label} : ${formatNumber(item.value)} ${item.unit}${notes.length ? ` (${notes.join(", ")})` : ""}`;
}

function page(source: SourceRef): string | null {
  return source.page === null ? null : String(source.page);
}

export function structuredSummary(data: TenderAnalysis): string {
  const confirm = data.missingInformation.length;
  return [
    `Extraction structurée : ${data.workPackages.length} lots de travaux, ${data.quantities.length} quantités, ${data.schedule.length} jalons de calendrier,`,
    `${data.requirements.length} exigences, ${data.requiredDocuments.length} documents à remettre, ${confirm} points à confirmer,`,
    `${data.risks.length} risques et ${data.questionsForClient.length} questions pour le client.`,
  ].join(" ");
}

export function toAnalysis(data: TenderAnalysis, options: { id: string; now: string; engine: Analysis["engine"]; disclaimer: string }): Analysis {
  const fact = (value: TextFact | null) => value?.value ?? null;
  return {
    id: options.id,
    summary: structuredSummary(data),
    engine: options.engine,
    disclaimer: options.disclaimer,
    projectHints: {
      name: fact(data.project.name),
      client: fact(data.project.client),
      vessel: fact(data.project.vessel),
      deadline: data.submission.deadline?.text ?? null,
    },
    scope: data.workPackages.map((item, index) => ({
      id: `scope_${index}`,
      text: `${item.code ? `${item.code} – ` : ""}${item.title}${item.description ? ` : ${item.description}` : ""}`,
      page: page(item.source),
      section: item.source.section,
      excerpt: item.source.excerpt,
      provenance: PROVENANCE_BY_SOURCE[item.sourceType],
    })),
    requirements: data.requirements.map((item, index) => ({
      id: `req_${index}`,
      text: item.text,
      page: page(item.source),
      section: item.source.section,
      excerpt: item.source.excerpt,
      provenance: PROVENANCE_BY_SOURCE[item.sourceType],
    })),
    detectedWork: data.workPackages.map((item, index) => ({
      id: `work_${index}`,
      code: item.code,
      name: item.title,
      tasks: item.tasks.length ? item.tasks : [item.title],
      page: page(item.source),
      section: item.source.section,
      excerpt: item.source.excerpt,
    })),
    quantities: data.quantities.map((item, index) => ({
      id: `qty_${index}`,
      text: describeQuantity(item),
      page: page(item.source),
      section: item.source.section,
      excerpt: item.source.excerpt,
      provenance: PROVENANCE_BY_SOURCE[item.sourceType],
    })),
    deadlines: data.schedule.map((item, index) => ({
      id: `delay_${index}`,
      text: `${item.label} : ${item.text}${item.toConfirm ? " (à confirmer)" : ""}`,
      page: page(item.source),
      section: item.source.section,
      excerpt: item.source.excerpt,
      provenance: PROVENANCE_BY_SOURCE[item.sourceType],
    })),
    requiredDocuments: data.requiredDocuments.map((item, index) => ({
      id: `docreq_${index}`,
      name: item.name,
      page: page(item.source),
      section: item.source.section,
      excerpt: item.source.excerpt,
      received: false,
    })),
    constraints: data.constraints.map((item, index) => ({
      id: `constraint_${index}`,
      text: item.text,
      page: page(item.source),
      section: item.source.section,
      excerpt: item.source.excerpt,
      provenance: PROVENANCE_BY_SOURCE[item.sourceType],
    })),
    risks: data.risks.map((item, index) => ({
      id: `risk_${index}`,
      title: item.title,
      probability: item.probability,
      impact: item.impact,
      level: item.level,
      potentialCostCents: null,
      mitigation: item.mitigation ?? "",
      owner: "Estimateur",
      status: "OPEN" as const,
      justification: item.source.excerpt ?? item.description ?? "",
      page: page(item.source),
      section: item.source.section,
      provenance: PROVENANCE_BY_SOURCE[item.sourceType],
    })),
    assumptions: data.assumptions.map((item, index) => ({
      id: `assum_${index}`,
      description: item.description,
      sourceLabel: item.source.excerpt ?? "Proposition à valider — elle n'est pas une citation du document",
      page: page(item.source),
      section: item.source.section,
      potentialImpact: item.impact ?? "",
      status: "OPEN" as const,
      provenance: PROVENANCE_BY_SOURCE[item.sourceType],
    })),
    missing: data.missingInformation.map((item, index) => ({
      id: `missing_${index}`,
      description: item.description,
      importance: item.importance,
      sourceLabel: item.source.excerpt ?? "",
      page: page(item.source),
      section: item.source.section,
      requiredAction: item.action ?? "Obtenir l'information auprès du client.",
      status: "OPEN" as const,
      note: item.kind === "DEPENDENCY" ? "Dépendance envers le donneur d'ordre." : "",
    })),
    structured: data,
    createdAt: options.now,
  };
}
