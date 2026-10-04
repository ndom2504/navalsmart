import "server-only";

import { documentWorkWindow, milestonesFromAnalysis } from "@/domain/planning";
import { plain } from "@/domain/tender-extraction";
import type { Analysis, Project, ProjectType } from "@/domain/types";
import { id } from "@/lib/utils";
import { analyzeTenderText } from "@/server/ai";
import { debugAnalysis } from "@/server/analysis-debug";
import { documentTextForAnalysis, extractDocument, saveUpload } from "@/server/documents";
import { applyAnalysis, costProjectLines, createEstimate, getProject, ServiceError, storeDocument } from "@/server/estimates";
import { suggestMarketActivities } from "@/server/market-ai";
import { readDatabase } from "@/server/store";

function logSaved(updated: Project) {
  debugAnalysis("8. Données enregistrées", {
    projectId: updated.id,
    engine: updated.analysis?.engine ?? null,
    projectHints: updated.analysis?.projectHints ?? null,
    analysis: updated.analysis
      ? {
        detectedWork: updated.analysis.detectedWork.length,
        quantities: updated.analysis.quantities.length,
        deadlines: updated.analysis.deadlines.length,
        requirements: updated.analysis.requirements.length,
        requiredDocuments: updated.analysis.requiredDocuments.length,
        constraints: updated.analysis.constraints.length,
        risks: updated.analysis.risks.length,
        missing: updated.analysis.missing.length,
        assumptions: updated.analysis.assumptions.length,
        questionsForClient: updated.analysis.structured?.questionsForClient.length ?? 0,
      }
      : null,
    project: {
      workPackages: updated.workPackages.map((item) => `${item.code} ${item.name} (${item.tasks.length} tâches)`),
      lines: updated.lines.length,
      risks: updated.risks.length,
      missing: updated.missing.length,
      assumptions: updated.assumptions.length,
      submissionDeadline: updated.submissionDeadline,
      plannedStart: updated.plannedStart,
      plannedEnd: updated.plannedEnd,
      milestones: updated.milestones.length,
      workOrders: updated.workOrders.length,
    },
  });
}

/** Analyse le dernier document importé et enregistre le résultat validé. */
export async function analyzeProjectTender(projectId: string): Promise<Project> {
  const project = await getProject(projectId);
  const document = project.tender?.documents[0];
  if (!document) throw new ServiceError("Aucun document à analyser.");
  const source = await documentTextForAnalysis(document);
  if (!source.text.trim()) throw new ServiceError("Aucun document à analyser.");
  debugAnalysis("0. Document", {
    fileName: document.fileName,
    pageCount: source.pageCount,
    reExtracted: source.refreshed,
  });

  const analysis = await analyzeTenderText(source.text, new Date().toISOString());
  await applyAnalysis(
    projectId,
    analysis,
    source.refreshed ? { extractedText: source.text, pageCount: source.pageCount } : undefined,
  );
  const updated = await withMarketSuggestions(projectId);
  logSaved(updated);
  return updated;
}

/** Ouvrages restés sans coût après l'import : propositions du modèle, puis nouveau chiffrage. */
async function withMarketSuggestions(projectId: string): Promise<Project> {
  const outcome = await suggestMarketActivities(projectId).catch(() => ({ added: 0, error: null }));
  if (outcome.added) await costProjectLines(projectId);
  return getProject(projectId);
}

const TYPE_RULES: { type: ProjectType; pattern: RegExp }[] = [
  { type: "CONVERSION", pattern: /conversion|transformation/ },
  { type: "CONSTRUCTION", pattern: /construction neuve|construction d'un|nouvelle construction/ },
  { type: "MAINTENANCE", pattern: /maintenance|entretien|arret technique|carenage/ },
  { type: "REPAIR", pattern: /reparation|renovation|remise en etat|refonte|modernisation/ },
  { type: "ELECTRICAL", pattern: /electri/ },
  { type: "MECHANICAL", pattern: /mecani|propulsion|moteur/ },
];

/** Type déduit des mots du titre et de l'objet ; « Autre » sans indice. */
function inferType(analysis: Analysis): ProjectType {
  const text = plain([analysis.projectHints.name ?? "", ...analysis.scope.slice(0, 3).map((item) => item.text)].join(" "));
  return TYPE_RULES.find((rule) => rule.pattern.test(text))?.type ?? "OTHER";
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 160);
}

/**
 * Crée une estimation à partir d'un appel d'offres : extraction, analyse, projet
 * prérempli avec les seuls faits du document, lots, risques, jalons et ordres de travail.
 */
export async function createProjectFromTender(file: { name: string; type: string; size: number; buffer: Buffer; extension: string }): Promise<Project> {
  const extracted = await extractDocument(file.buffer, file.extension);
  if (!extracted.text.trim()) throw new ServiceError("Aucun texte lisible dans ce document. Importez un PDF texte, un DOCX ou un TXT.");
  const now = new Date().toISOString();
  debugAnalysis("0. Document", { fileName: file.name, pageCount: extracted.pageCount, newProject: true });
  const analysis = await analyzeTenderText(extracted.text, now);
  const data = analysis.structured;
  const settings = (await readDatabase()).settings;
  const window = documentWorkWindow(milestonesFromAnalysis(analysis, id));
  const reference = data?.project.reference?.value;

  const project = await createEstimate({
    name: data?.project.name?.value ?? analysis.projectHints.name ?? baseName(file.name),
    client: data?.project.client?.value ?? "",
    vessel: data?.project.vessel?.value ?? "",
    type: inferType(analysis),
    location: data?.project.location?.value ?? "",
    receivedAt: now.slice(0, 10),
    submissionDeadline: data?.submission.deadline?.value ?? null,
    plannedStart: window.start,
    plannedEnd: window.end,
    currency: data?.submission.currency?.value ?? settings.currency,
    description: [reference ? `Référence : ${reference}.` : "", `Créée depuis ${file.name}.`].filter(Boolean).join(" "),
    learningMode: settings.defaultLearningMode,
  });

  const storedPath = await saveUpload(project.id, file.buffer, file.extension);
  await storeDocument(project.id, {
    id: id("doc"),
    fileName: file.name.replace(/[^\w.\- ()àâäéèêëïîôùûüç]/gi, "_").slice(0, 180),
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    pageCount: extracted.pageCount,
    storedPath,
    extractedText: extracted.text,
    status: "PROCESSING",
    importedAt: now,
  });
  await applyAnalysis(project.id, analysis);
  const updated = await withMarketSuggestions(project.id);
  logSaved(updated);
  return updated;
}
