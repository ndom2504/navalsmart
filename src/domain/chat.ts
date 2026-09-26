import { describeLabor, financialSummary, resolveLine } from "@/domain/calculations";
import { formatMoney } from "@/lib/format";
import { lineStatusLabels, provenanceLabels, riskLevelLabels } from "@/lib/labels";
import type { Project } from "@/domain/types";

const FALLBACK = "Je ne dispose pas de cette information dans les données du projet.";

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

export function answerFromProject(question: string, project: Project): string {
  const normalized = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  const summary = financialSummary(project);
  const currency = project.currency;

  if (!normalized.trim()) return FALLBACK;

  if (includesAny(normalized, ["manquant", "manquante", "informations manquantes"])) {
    const open = project.missing.filter((item) => item.status === "OPEN");
    if (!project.missing.length) return "Aucune information manquante n'est enregistrée dans ce projet. " + FALLBACK.replace("Je ne dispose pas de cette information", "Je ne vois pas d'autre manque");
    const lines = open.map((item) => `- ${item.description} — importance ${riskLevelLabels[item.importance]} — ${provenanceLabels.DOCUMENT === item.sourceLabel ? "" : ""}source : ${item.sourceLabel}`);
    return [
      "DONNÉE UTILISATEUR / SOURCE DOCUMENT",
      `Informations manquantes encore ouvertes (${open.length}) :`,
      ...lines,
      "Ce relevé décrit l'état du projet. Il ne comble pas les manques.",
    ].join("\n");
  }

  if (includesAny(normalized, ["risque"])) {
    if (!project.risks.length) return "Aucun risque n'est enregistré dans ce projet.";
    return [
      "Registre des risques du projet courant :",
      ...project.risks.map((risk) => {
        const cost = risk.potentialCostCents == null ? "coût potentiel non chiffré" : formatMoney(risk.potentialCostCents, currency);
        return `- ${risk.title} — niveau ${riskLevelLabels[risk.level]} — ${cost} — ${provenanceLabels[risk.provenance]}. Justification : ${risk.justification}`;
      }),
    ].join("\n");
  }

  if (includesAny(normalized, ["main-d'oeuvre", "main d'oeuvre", "main-doeuvre", "labor", "heures"])) {
    if (summary.laborCents === 0) return "Aucune main-d'œuvre chiffrée dans ce projet.";
    const details = project.labor.length
      ? project.labor.map((item) => `- ${item.trade} : ${describeLabor(item, currency)} — CALCUL SYSTÈME`)
      : project.lines
          .filter((line) => line.hours > 0)
          .map((line) => `- ${line.description} : ${resolveLine(project, line.id).laborFormula} — CALCUL SYSTÈME`);
    return [`Main-d'œuvre du projet : ${formatMoney(summary.laborCents, currency)} — CALCUL SYSTÈME`, ...details].join("\n");
  }

  if (includesAny(normalized, ["tuyauterie"])) {
    const lines = project.lines.filter((line) => /tuyau/i.test(`${line.lot} ${line.description}`));
    if (!lines.length) return FALLBACK;
    const total = lines.reduce((sum, line) => sum + resolveLine(project, line.id).directCents, 0);
    return [
      `Coût des lignes de tuyauterie : ${formatMoney(total, currency)} — CALCUL SYSTÈME`,
      ...lines.map((line) => {
        const resolved = resolveLine(project, line.id);
        return `- ${line.description} : ${formatMoney(resolved.directCents, currency)}. Main-d'œuvre : ${resolved.laborFormula}. Matériaux : ${resolved.materialsFormula}. Statut : ${lineStatusLabels[line.status]}.`;
      }),
      "Le montant est élevé lorsque les heures et les matériaux liés sont élevés. Ce n'est pas un jugement sur le juste prix.",
    ].join("\n");
  }

  if (includesAny(normalized, ["pas encore valide", "non valide", "non verifie", "a valider", "généré", "genere"])) {
    const pending = project.lines.filter((line) => line.status !== "USER_VERIFIED");
    if (!pending.length) return "Toutes les lignes ont le statut USER VERIFIED.";
    return [
      "Lignes qui ne sont pas encore au statut USER VERIFIED :",
      ...pending.map((line) => `- ${line.lot} / ${line.description} — ${lineStatusLabels[line.status]}`),
    ].join("\n");
  }

  if (includesAny(normalized, ["resume", "résume", "synthese", "synthèse", "cout", "coût", "total"])) {
    return [
      `Synthèse de « ${project.name} » pour ${project.client}, navire ${project.vessel}.`,
      `Coût direct : ${formatMoney(summary.directCents, currency)} — CALCUL SYSTÈME`,
      `Frais indirects (${project.overheadPct} %) : ${formatMoney(summary.indirectCents, currency)} — CALCUL SYSTÈME`,
      `Provision pour risques (${project.contingencyPct} %) : ${formatMoney(summary.riskAllowanceCents, currency)} — CALCUL SYSTÈME`,
      `Coût estimé : ${formatMoney(summary.estimatedCents, currency)} — CALCUL SYSTÈME`,
      `Prix de soumission proposé (${project.marginPct} % de marge) : ${formatMoney(summary.bidCents, currency)} — CALCUL SYSTÈME`,
      "Ces montants reprennent les données du projet et les paramètres saisis. Ils ne sont pas une validation de l'estimation.",
    ].join("\n");
  }

  if (includesAny(normalized, ["hypothese", "hypothèse"])) {
    if (!project.assumptions.length) return "Aucune hypothèse n'est enregistrée dans ce projet.";
    return project.assumptions
      .map((item) => `- ${item.description} — ${provenanceLabels[item.provenance]} — source : ${item.sourceLabel}`)
      .join("\n");
  }

  return FALLBACK;
}
