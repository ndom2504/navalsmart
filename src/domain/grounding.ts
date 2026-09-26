import type { Analysis, Provenance, SourcedItem } from "@/domain/types";

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function excerptExists(documentText: string, excerpt: string | null): boolean {
  if (!excerpt || !excerpt.trim()) return false;
  return normalizeText(documentText).includes(normalizeText(excerpt));
}

function keepItem(documentText: string, item: SourcedItem): SourcedItem | null {
  if (item.provenance === "USER" || item.provenance === "SYSTEM") return item;
  if (!excerptExists(documentText, item.excerpt)) return null;
  return { ...item, provenance: "DOCUMENT" };
}

function hint(documentText: string, value: string | null): string | null {
  if (!value) return null;
  return excerptExists(documentText, value) ? value : null;
}

export function groundAnalysis(documentText: string, analysis: Analysis): Analysis {
  return {
    ...analysis,
    projectHints: {
      name: hint(documentText, analysis.projectHints.name),
      client: hint(documentText, analysis.projectHints.client),
      vessel: hint(documentText, analysis.projectHints.vessel),
      deadline: hint(documentText, analysis.projectHints.deadline),
    },
    scope: analysis.scope.map((item) => keepItem(documentText, item)).filter((item): item is SourcedItem => Boolean(item)),
    requirements: analysis.requirements.map((item) => keepItem(documentText, item)).filter((item): item is SourcedItem => Boolean(item)),
    quantities: analysis.quantities.map((item) => keepItem(documentText, item)).filter((item): item is SourcedItem => Boolean(item)),
    deadlines: analysis.deadlines.map((item) => keepItem(documentText, item)).filter((item): item is SourcedItem => Boolean(item)),
    constraints: analysis.constraints.map((item) => keepItem(documentText, item)).filter((item): item is SourcedItem => Boolean(item)),
    detectedWork: analysis.detectedWork.filter((item) => excerptExists(documentText, item.excerpt)),
    requiredDocuments: analysis.requiredDocuments.filter((item) => excerptExists(documentText, item.excerpt)),
    risks: analysis.risks.filter((item) => item.provenance === "USER" || excerptExists(documentText, item.justification)),
    assumptions: analysis.assumptions.map((item) => {
      if (item.provenance === "USER") return item;
      if (excerptExists(documentText, item.description) || (item.section && excerptExists(documentText, item.sourceLabel))) {
        return item;
      }
      return {
        ...item,
        provenance: "AI" as Provenance,
        sourceLabel: "Hypothèse proposée — elle n'est pas une citation du document",
        page: null,
        section: null,
      };
    }),
    missing: analysis.missing.filter((item) => excerptExists(documentText, item.description) || excerptExists(documentText, item.sourceLabel)),
  };
}
