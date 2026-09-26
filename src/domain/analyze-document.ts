import { DEMO_TENDER_TEXT } from "@/domain/demo-tender";
import { excerptExists } from "@/domain/grounding";
import type { Analysis, Provenance, SourcedItem } from "@/domain/types";

interface LocatedLine {
  text: string;
  page: string | null;
  section: string | null;
}

function locate(documentText: string): LocatedLine[] {
  let page: string | null = null;
  let section: string | null = null;
  const lines: LocatedLine[] = [];
  for (const raw of documentText.split(/\r?\n/)) {
    const text = raw.trim();
    if (!text) continue;
    const pageMatch = text.match(/^---\s*Page\s+(\d+)\s*---$/i);
    if (pageMatch) {
      page = pageMatch[1] ?? null;
      continue;
    }
    const sectionMatch = text.match(/^Section\s+([0-9.]+)\b/i);
    if (sectionMatch) section = sectionMatch[1] ?? section;
    lines.push({ text, page, section });
  }
  return lines;
}

function item(id: string, line: LocatedLine, provenance: Provenance = "DOCUMENT"): SourcedItem {
  return {
    id,
    text: line.text,
    page: line.page,
    section: line.section,
    excerpt: line.text,
    provenance,
  };
}

export function heuristicAnalysis(documentText: string, now: string): Analysis {
  const lines = locate(documentText);
  const take = (pattern: RegExp) => lines.filter((line) => pattern.test(line.text));

  const scope = take(/découpe|remplacement|soudage|inspection|dépose|réparation|installation|câblage|tuyauterie|peinture|préparation|application/i)
    .slice(0, 8)
    .map((line, index) => item(`scope_${index}`, line));

  const requirements = take(/doivent|doit|certificat|attestation|plan de qualité|contrôle/i)
    .slice(0, 8)
    .map((line, index) => item(`req_${index}`, line));

  const quantities = take(/\d[\d\s]*\s*heures|n'est pas spécifiée|ne sont pas quantifiées|n'est pas précisée/i)
    .map((line, index) => item(`qty_${index}`, line));

  const deadlines = take(/date limite|date prévue|disponibilité du navire|pénalités/i)
    .map((line, index) => item(`delay_${index}`, line));

  const constraints = take(/à quai|cale sèche|exigus|à la charge de l'estimateur/i)
    .map((line, index) => item(`constraint_${index}`, line));

  const documents = take(/certificat|plan de qualité|attestation|plans de structure/i).map((line, index) => ({
    id: `doc_${index}`,
    name: line.text.replace(/\.$/, ""),
    page: line.page,
    section: line.section,
    excerpt: line.text,
    received: false,
  }));

  const detectedWork = [
    { name: "Structure / coque", pattern: /structure et coque/i },
    { name: "Mécanique", pattern: /^Mécanique\s*:/i },
    { name: "Électricité", pattern: /^Électricité\s*:/i },
    { name: "Tuyauterie", pattern: /^Tuyauterie\s*:/i },
    { name: "Peinture", pattern: /^Peinture\s*:/i },
  ]
    .map((entry, index) => {
      const line = lines.find((candidate) => entry.pattern.test(candidate.text));
      if (!line) return null;
      const tasks = line.text.split(":").slice(1).join(":").split(",").map((part) => part.replace(/\.$/, "").trim()).filter(Boolean);
      return {
        id: `work_${index}`,
        name: entry.name,
        tasks,
        page: line.page,
        section: line.section,
        excerpt: line.text,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const riskLines = take(/pénalités de retard|amiante/i);
  const risks = riskLines.map((line, index) => ({
    id: `risk_detected_${index}`,
    title: /amiante/i.test(line.text) ? "Présence possible d'amiante" : "Pénalités de retard",
    probability: "MEDIUM" as const,
    impact: /amiante/i.test(line.text) ? "HIGH" as const : "HIGH" as const,
    level: /amiante/i.test(line.text) ? "HIGH" as const : "MEDIUM" as const,
    potentialCostCents: null,
    mitigation: "À préciser par l'estimateur à partir de la phrase citée.",
    owner: "Estimateur",
    status: "OPEN" as const,
    justification: line.text,
    page: line.page,
    section: line.section,
    provenance: "DOCUMENT" as const,
  }));

  const missingLines = take(/n'est pas spécifiée|n'est pas précisée|ne sont pas quantifiées|aucun taux horaire|ne figurent pas|non fournis|reste à confirmer|lequel ne sont pas joints|sans rapport d'analyse/i);
  const missing = missingLines.map((line, index) => ({
    id: `missing_detected_${index}`,
    description: line.text,
    importance: /acier|amiante|taux horaire/i.test(line.text) ? "HIGH" as const : "MEDIUM" as const,
    sourceLabel: line.text,
    page: line.page,
    section: line.section,
    requiredAction: "Confirmer cette information avant de figer le prix.",
    status: "OPEN" as const,
    note: "",
  }));

  const name = lines.find((line) => /Nom du projet\s*:/i.test(line.text))?.text.split(":").slice(1).join(":").trim() ?? null;
  const client = lines.find((line) => /^Client\s*:/i.test(line.text))?.text.split(":").slice(1).join(":").trim() ?? null;
  const vessel = lines.find((line) => /^Navire\s*:/i.test(line.text))?.text.split(":").slice(1).join(":").trim() ?? null;
  const deadline = lines.find((line) => /Date limite de soumission/i.test(line.text))?.text.split(":").slice(1).join(":").trim() ?? null;

  return {
    id: `analysis_${now}`,
    summary: scope.length
      ? "Synthèse locale : le texte décrit des travaux et des manques. Seules les phrases retrouvées dans le document sont conservées. Cette synthèse n'est pas une citation intégrale."
      : "Le texte n'a pas permis d'extraire une portée citée. Aucune portée n'a été inventée.",
    engine: "LOCAL",
    disclaimer: "Analyse locale. Aucun modèle externe n'a été appelé. Une information sans citation du document n'est pas présentée comme un fait.",
    projectHints: { name, client, vessel, deadline },
    scope,
    requirements,
    detectedWork,
    quantities,
    deadlines,
    requiredDocuments: documents,
    constraints,
    risks,
    assumptions: [],
    missing,
    createdAt: now,
  };
}

export function analysisForDocument(documentText: string, now: string): Analysis {
  if (documentText.includes("NAVALSMART-DEMO-TENDER-V1")) {
    return heuristicAnalysis(DEMO_TENDER_TEXT, now);
  }
  return heuristicAnalysis(documentText, now);
}

export function assertDemoExcerpts(): string[] {
  const analysis = heuristicAnalysis(DEMO_TENDER_TEXT, "2026-09-25T12:00:00.000Z");
  const missing: string[] = [];
  for (const item of [...analysis.scope, ...analysis.requirements, ...analysis.quantities]) {
    if (!excerptExists(DEMO_TENDER_TEXT, item.excerpt)) missing.push(item.text);
  }
  return missing;
}
