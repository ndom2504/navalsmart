import { financialSummary, resolveLine } from "@/domain/calculations";
import type { AIReviewItem, Project, ReviewSeverity } from "@/domain/types";

interface DraftFinding {
  code: string;
  severity: ReviewSeverity;
  title: string;
  detail: string;
}

export function generateFindings(project: Project): DraftFinding[] {
  const summary = financialSummary(project);
  const findings: DraftFinding[] = [];

  const openCritical = project.missing.filter((item) => item.status === "OPEN" && (item.importance === "HIGH" || item.importance === "CRITICAL"));
  if (openCritical.length) {
    findings.push({
      code: "missing-critical",
      severity: "CRITICAL",
      title: "Informations manquantes importantes",
      detail: openCritical.map((item) => item.description).join(" "),
    });
  }

  const unpriced = project.lines.filter((line) => resolveLine(project, line.id).directCents === 0);
  if (unpriced.length) {
    findings.push({
      code: "zero-lines",
      severity: "CRITICAL",
      title: "Lignes sans montant",
      detail: `${unpriced.length} ligne(s) ont un coût total de 0 : ${unpriced.map((line) => line.description).join(", ")}.`,
    });
  }

  const noSource = project.lines.filter((line) => !line.sourceLabel.trim() || line.sourceLabel === "Non précisée");
  if (noSource.length) {
    findings.push({
      code: "missing-source",
      severity: "WARNING",
      title: "Postes sans source",
      detail: noSource.map((line) => line.description).join(", "),
    });
  }

  const names = new Map<string, number>();
  for (const line of project.lines) {
    const key = line.description.trim().toLowerCase();
    names.set(key, (names.get(key) ?? 0) + 1);
  }
  const duplicates = [...names.entries()].filter(([, count]) => count > 1).map(([name]) => name);
  if (duplicates.length) {
    findings.push({
      code: "duplicates",
      severity: "WARNING",
      title: "Descriptions en double",
      detail: duplicates.join(", "),
    });
  }

  const unusual = project.lines.filter((line) => line.hourlyRateCents > 0 && (line.hourlyRateCents < 2000 || line.hourlyRateCents > 25000));
  if (unusual.length) {
    findings.push({
      code: "unusual-rates",
      severity: "WARNING",
      title: "Taux horaires inhabituels",
      detail: `Des taux sont inférieurs à 20 $ ou supérieurs à 250 $ : ${unusual.map((line) => line.description).join(", ")}. Vérifier le barème.`,
    });
  }

  const suspiciousQty = project.lines.filter((line) => line.quantity > 0 && line.quantity % 100 === 0 && line.status === "AI_GENERATED");
  if (suspiciousQty.length) {
    findings.push({
      code: "round-quantities",
      severity: "INFO",
      title: "Quantités rondes non vérifiées",
      detail: suspiciousQty.map((line) => `${line.description} (${line.quantity})`).join(", "),
    });
  }

  if (!project.quotes.length) {
    findings.push({
      code: "no-suppliers",
      severity: "WARNING",
      title: "Aucun fournisseur associé",
      detail: "L'estimation ne contient aucune soumission fournisseur.",
    });
  }

  const pendingQuotes = project.quotes.filter((quote) => quote.status === "REQUESTED" || quote.priceCents == null);
  if (pendingQuotes.length) {
    findings.push({
      code: "quotes-pending",
      severity: "WARNING",
      title: "Prix fournisseurs manquants",
      detail: `${pendingQuotes.length} soumission(s) sans prix validé.`,
    });
  }

  if (!project.assumptions.length) {
    findings.push({
      code: "no-assumptions",
      severity: "WARNING",
      title: "Aucune hypothèse documentée",
      detail: "Une estimation sans hypothèse explicite est difficile à défendre.",
    });
  }

  const bareRisks = project.risks.filter((risk) => !risk.mitigation.trim());
  if (bareRisks.length) {
    findings.push({
      code: "risks-without-mitigation",
      severity: "WARNING",
      title: "Risques sans mitigation",
      detail: bareRisks.map((risk) => risk.title).join(", "),
    });
  }

  if (!project.risks.length && project.analysis) {
    findings.push({
      code: "no-risks",
      severity: "INFO",
      title: "Aucun risque au registre",
      detail: "L'analyse existe, mais le registre des risques est vide.",
    });
  }

  const unverified = project.lines.filter((line) => line.status === "AI_GENERATED");
  if (unverified.length) {
    findings.push({
      code: "unverified-lines",
      severity: "INFO",
      title: "Lignes encore générées par l'IA",
      detail: `${unverified.length} ligne(s) n'ont pas été vérifiées : ${unverified.map((line) => line.description).join(", ")}.`,
    });
  }

  const emptyPackages = project.workPackages.filter((pkg) => !project.lines.some((line) => line.workPackageId === pkg.id));
  if (emptyPackages.length) {
    findings.push({
      code: "empty-packages",
      severity: "INFO",
      title: "Lots sans ligne de coût",
      detail: emptyPackages.map((pkg) => pkg.name).join(", "),
    });
  }

  if (summary.laborCents === 0 && summary.directCents > 0) {
    findings.push({
      code: "no-labor",
      severity: "WARNING",
      title: "Coût direct sans main-d'œuvre",
      detail: "Le coût direct est positif alors qu'aucune heure n'est chiffrée.",
    });
  }

  return findings;
}

export function mergeFindings(project: Project, now: string): AIReviewItem[] {
  const previous = new Map(project.reviews.map((item) => [item.code, item]));
  return generateFindings(project).map((finding) => {
    const existing = previous.get(finding.code);
    if (existing && existing.status !== "PENDING") {
      return { ...existing, title: finding.title, detail: finding.detail, severity: finding.severity };
    }
    return {
      id: existing?.id ?? `review_${finding.code}`,
      code: finding.code,
      severity: finding.severity,
      title: finding.title,
      detail: finding.detail,
      status: existing?.status ?? "PENDING",
      note: existing?.note ?? "",
      createdAt: existing?.createdAt ?? now,
    };
  });
}
