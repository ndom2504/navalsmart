import "server-only";

import { financialSummary, resolveLine } from "@/domain/calculations";
import { emptyProject } from "@/domain/demo";
import { marketContext, projectMarketRegion } from "@/domain/market";
import { documentQuantity, documentWorkWindow, generatePlanning, milestonesFromAnalysis, refreshBlockedStatus } from "@/domain/planning";
import { mergeFindings } from "@/domain/review";
import type { AiMarketActivity, Analysis, AuditEntry, Database, EstimateLine, Project, ProjectAvatar, ProjectMilestone, TenderDocument, WorkOrder } from "@/domain/types";
import { costLine, userSourcesFor } from "@/domain/unit-costs";
import { formatMoney, formatNumber } from "@/lib/format";
import type { QuantityItem } from "@/lib/validation/tender-analysis.schema";
import { parseEstimate, parseMissingInformation, parseRisk } from "@/lib/validation";
import { assumptionSchema } from "@/lib/validation/assumption.schema";
import { parseWith } from "@/lib/validation/result";
import { findProject, readDatabase, updateDatabase } from "@/server/store";
import { id } from "@/lib/utils";

export class ServiceError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function touch(project: Project, now: string) {
  project.updatedAt = now;
}

function audit(project: Project, entry: Omit<AuditEntry, "id" | "createdAt">, now: string) {
  project.audit.unshift({ ...entry, id: id("audit"), createdAt: now });
}

async function mutateProject(projectId: string, mutate: (project: Project, database: Database, now: string) => void): Promise<Project> {
  let updated: Project | undefined;
  await updateDatabase((database) => {
    const project = findProject(database, projectId);
    if (!project) throw new ServiceError("Estimation introuvable.", 404);
    const now = new Date().toISOString();
    mutate(project, database, now);
    touch(project, now);
    updated = project;
  });
  if (!updated) throw new ServiceError("Estimation introuvable.", 404);
  return updated;
}

export async function listWorkspace() {
  const database = await readDatabase();
  return database;
}

export async function getProject(projectId: string): Promise<Project> {
  const database = await readDatabase();
  const project = findProject(database, projectId);
  if (!project) throw new ServiceError("Estimation introuvable.", 404);
  return project;
}

export async function createEstimate(input: {
  name: string;
  client: string;
  vessel: string;
  type: Project["type"];
  location: string;
  receivedAt: string | null;
  submissionDeadline: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  currency: string;
  description: string;
  learningMode: boolean;
}): Promise<Project> {
  const now = new Date().toISOString();
  let created: Project | undefined;
  await updateDatabase((database) => {
    created = emptyProject({ ...input, id: id("proj"), settings: database.settings, now });
    database.projects.unshift(created);
  });
  if (!created) throw new ServiceError("La création a échoué.");
  return created;
}

export async function patchProject(projectId: string, patch: Partial<Project>): Promise<Project> {
  return mutateProject(projectId, (project, _database, now) => {
    const before = project.learningMode;
    Object.assign(project, patch);
    if (patch.learningMode !== undefined && patch.learningMode !== before) {
      audit(project, {
        actor: "Morel",
        entity: "Mode apprentissage",
        summary: patch.learningMode ? "Mode apprentissage activé." : "Mode apprentissage désactivé.",
        source: "USER",
      }, now);
    }
    audit(project, {
      actor: "Morel",
      entity: "Estimation",
      summary: "Informations générales ou paramètres mis à jour.",
      source: "USER MODIFIED",
    }, now);
  });
}

export async function saveLines(projectId: string, lines: Project["lines"]): Promise<Project> {
  return mutateProject(projectId, (project, _database, now) => {
    for (const next of lines) {
      const previous = project.lines.find((line) => line.id === next.id);
      if (!previous) continue;
      const changed = previous.hours !== next.hours || previous.hourlyRateCents !== next.hourlyRateCents || previous.quantity !== next.quantity || previous.materialsCents !== next.materialsCents || previous.equipmentCents !== next.equipmentCents || previous.subcontractCents !== next.subcontractCents || previous.logisticsCents !== next.logisticsCents || previous.otherCents !== next.otherCents;
      if (changed && next.status !== "USER_VERIFIED") next.status = "USER_MODIFIED";
      if (previous.hours !== next.hours) {
        audit(project, {
          actor: "Morel",
          entity: "Main-d'œuvre",
          summary: `Morel a modifié ${next.description} : ${previous.hours} h → ${next.hours} h.`,
          source: "USER MODIFIED",
        }, now);
        const labor = project.labor.find((item) => item.estimateLineId === next.id);
        if (labor && project.labor.filter((item) => item.estimateLineId === next.id).length === 1) {
          labor.hours = next.hours;
          labor.hourlyRateCents = next.hourlyRateCents;
        }
      }
    }
    project.lines = lines;
    if (project.status === "DRAFT" || project.status === "IN_ANALYSIS") project.status = "IN_ESTIMATION";
  });
}

export async function savePackages(projectId: string, packages: Project["workPackages"]): Promise<Project> {
  return mutateProject(projectId, (project, _database, now) => {
    project.workPackages = packages;
    audit(project, { actor: "Morel", entity: "Lots", summary: "Structure des travaux mise à jour.", source: "USER MODIFIED" }, now);
  });
}

export async function saveLabor(projectId: string, labor: Project["labor"]): Promise<Project> {
  return mutateProject(projectId, (project, _database, now) => {
    project.labor = labor;
    for (const item of labor) {
      if (!item.estimateLineId) continue;
      const siblings = labor.filter((candidate) => candidate.estimateLineId === item.estimateLineId);
      if (siblings.length !== 1) continue;
      const line = project.lines.find((candidate) => candidate.id === item.estimateLineId);
      if (!line) continue;
      if (line.hours !== item.hours) {
        audit(project, {
          actor: "Morel",
          entity: "Main-d'œuvre",
          summary: `Morel a modifié ${line.description} : ${line.hours} h → ${item.hours} h.`,
          source: "USER MODIFIED",
        }, now);
      }
      line.hours = item.hours;
      line.hourlyRateCents = item.hourlyRateCents;
      line.quantity = item.hours;
      line.status = "USER_MODIFIED";
    }
  });
}

export async function saveMaterials(projectId: string, materials: Project["materials"]): Promise<Project> {
  return mutateProject(projectId, (project, _database, now) => {
    project.materials = materials;
    audit(project, { actor: "Morel", entity: "Matériaux", summary: "Matériaux mis à jour.", source: "USER MODIFIED" }, now);
  });
}

export async function saveEquipment(projectId: string, equipment: Project["equipment"]): Promise<Project> {
  return mutateProject(projectId, (project, _database, now) => {
    project.equipment = equipment;
    audit(project, { actor: "Morel", entity: "Équipements", summary: "Équipements mis à jour.", source: "USER MODIFIED" }, now);
  });
}

export async function saveQuotes(projectId: string, quotes: Project["quotes"]): Promise<Project> {
  return mutateProject(projectId, (project, _database, now) => {
    project.quotes = quotes;
    audit(project, { actor: "Morel", entity: "Fournisseurs", summary: "Soumissions fournisseurs mises à jour.", source: "USER MODIFIED" }, now);
  });
}

export async function addSubcontractor(
  projectId: string,
  input: { name: string; contact: string; category: string; description: string; priceCents: number | null; currency: string },
): Promise<Project> {
  return mutateProject(projectId, (project, _database, now) => {
    project.subcontractors.push({
      id: id("sub"),
      workPackageId: null,
      estimateLineId: null,
      name: input.name,
      contact: input.contact,
      category: input.category,
      description: input.description,
      priceCents: input.priceCents,
      currency: input.currency,
      validUntil: null,
      leadTime: "",
      included: "",
      excluded: "",
      documentName: null,
      status: "REQUESTED",
    });
    audit(project, { actor: "Morel", entity: "Sous-traitants", summary: `${input.name} ajouté au dossier.`, source: "USER MODIFIED" }, now);
  });
}

export async function saveSubcontractors(projectId: string, subcontractors: Project["subcontractors"]): Promise<Project> {
  return mutateProject(projectId, (project, _database, now) => {
    project.subcontractors = subcontractors;
    audit(project, { actor: "Morel", entity: "Sous-traitants", summary: "Sous-traitants mis à jour.", source: "USER MODIFIED" }, now);
  });
}

export async function saveRisks(projectId: string, risks: Project["risks"]): Promise<Project> {
  return mutateProject(projectId, (project, _database, now) => {
    project.risks = risks;
    audit(project, { actor: "Morel", entity: "Risques", summary: "Registre des risques mis à jour.", source: "USER MODIFIED" }, now);
  });
}

export async function saveAssumptions(projectId: string, assumptions: Project["assumptions"]): Promise<Project> {
  return mutateProject(projectId, (project, _database, now) => {
    project.assumptions = assumptions;
    audit(project, { actor: "Morel", entity: "Hypothèses", summary: "Hypothèses mises à jour.", source: "USER MODIFIED" }, now);
  });
}

export async function saveMissing(projectId: string, missing: Project["missing"]): Promise<Project> {
  return mutateProject(projectId, (project, _database, now) => {
    project.missing = missing;
    project.workOrders = refreshBlockedStatus(project.workOrders, missing);
    audit(project, { actor: "Morel", entity: "Informations manquantes", summary: "Suivi des informations manquantes mis à jour.", source: "USER MODIFIED" }, now);
  });
}

export async function addSupplier(input: { name: string; contact: string; category: string; description: string; currency: string }) {
  let createdId = "";
  await updateDatabase((database) => {
    createdId = id("sup");
    database.suppliers.unshift({ id: createdId, ...input });
  });
  return createdId;
}

export async function updateSettings(settings: Database["settings"]) {
  await updateDatabase((database) => {
    database.settings = settings;
  });
}

export async function recalculate(projectId: string): Promise<Project> {
  return mutateProject(projectId, (project, _database, now) => {
    const snapshot = financialSummary(project);
    project.revisions.unshift({
      id: id("rev"),
      label: "Recalcul",
      snapshot,
      createdAt: now,
    });
    audit(project, {
      actor: "Système",
      entity: "Calcul",
      summary: "Recalcul déterministe des coûts à partir des quantités, des taux et des paramètres saisis.",
      source: "CALCUL SYSTÈME",
    }, now);
  });
}

export async function runReview(projectId: string): Promise<Project> {
  return mutateProject(projectId, (project, _database, now) => {
    project.reviews = mergeFindings(project, now);
    audit(project, { actor: "NavalSmart AI", entity: "Revue", summary: "Revue de cohérence enregistrée. Les recommandations restent à accepter ou à écarter.", source: "AI" }, now);
  });
}

export async function decideReview(projectId: string, reviewId: string, status: "ACCEPTED" | "IGNORED" | "MODIFIED", note: string): Promise<Project> {
  return mutateProject(projectId, (project, _database, now) => {
    const review = project.reviews.find((item) => item.id === reviewId);
    if (!review) throw new ServiceError("Recommandation introuvable.", 404);
    review.status = status;
    review.note = note;
    audit(project, { actor: "Morel", entity: "Revue", summary: `Recommandation « ${review.title} » : ${status}.`, source: "USER MODIFIED" }, now);
  });
}

function hoursFromQuantities(analysis: Analysis, taskName: string): number | null {
  const pattern = new RegExp(taskName.normalize("NFD").replace(/\p{Diacritic}/gu, "").slice(0, 6), "i");
  for (const quantity of analysis.quantities) {
    const text = `${quantity.text} ${quantity.excerpt ?? ""}`;
    const folded = text.normalize("NFD").replace(/\p{Diacritic}/gu, "");
    const match = folded.match(/(\d[\d\s]*)\s*heures/i);
    if (!match) continue;
    if (!pattern.test(folded.normalize("NFD").replace(/\p{Diacritic}/gu, ""))) continue;
    const hours = Number((match[1] ?? "").replace(/\s/g, ""));
    if (Number.isFinite(hours)) return hours;
  }
  return null;
}

export interface PricingSummary {
  fromLibrary: number;
  fromMarket: number;
  quantified: number;
  market: string | null;
}

const COST_FIELDS = [
  ["hours", "hours"],
  ["rate", "hourlyRateCents"],
  ["materials", "materialsCents"],
  ["equipment", "equipmentCents"],
  ["subcontract", "subcontractCents"],
] as const;

/**
 * Chiffre les lignes retenues : quantités du document, puis vos coûts unitaires et vos taux,
 * puis le référentiel de marché du projet. Seules les valeurs fournies par une source remplacent
 * celles en place ; les forfaits en pourcentage sont calculés en dernier, sur les autres lignes.
 */
function priceLines(project: Project, database: Database, now: string, eligible: (line: EstimateLine) => boolean): PricingSummary {
  const market = marketContext(projectMarketRegion(project, database.settings), project.currency, database.aiMarketActivities ?? []);
  const userSources = userSourcesFor(database.settings, project.currency);
  const linked = new Set([...project.labor, ...project.materials, ...project.equipment, ...project.subcontractors].map((item) => item.estimateLineId).filter(Boolean));
  const used = new Set<QuantityItem>();
  const percentLines: { line: EstimateLine; percent: number }[] = [];
  const summary: PricingSummary = { fromLibrary: 0, fromMarket: 0, quantified: 0, market: market?.label ?? null };
  for (const workPackage of [...project.workPackages].sort((a, b) => a.sortOrder - b.sortOrder)) {
    for (const task of [...workPackage.tasks].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const quantity = documentQuantity(project.analysis, workPackage.code, task.name, used);
      if (quantity) used.add(quantity);
      const line = project.lines.find((item) => item.taskId === task.id);
      if (!line || !eligible(line) || linked.has(line.id)) continue;
      const costing = costLine({
        texts: [task.name, workPackage.name],
        quantity,
        quotedHours: project.analysis ? hoursFromQuantities(project.analysis, task.name) : null,
        settings: userSources,
        market,
        currency: project.currency,
      });
      const previousHours = line.hours;
      if (costing.quoted) {
        if (costing.unit !== line.unit || costing.quantity !== line.quantity) summary.quantified += 1;
        line.quantity = costing.quantity;
        line.unit = costing.unit;
      }
      for (const [key, field] of COST_FIELDS) {
        if (!costing.filled[key]) continue;
        line[field] = costing[field];
        line.origins[key] = costing.origins[key];
      }
      if (costing.quoted || costing.unitCost) {
        line.sourceLabel = costing.sourceLabel;
        line.provenance = costing.provenance;
        line.explanation = costing.explanation;
      }
      if (costing.percentOfDirect !== null) percentLines.push({ line, percent: costing.percentOfDirect });
      else if (costing.unitCost) summary[costing.provenance === "AI" ? "fromMarket" : "fromLibrary"] += 1;
      const order = project.workOrders.find((item) => item.taskId === task.id);
      if (order && line.hours > 0 && (order.plannedHours === null || order.plannedHours === previousHours)) {
        order.plannedHours = line.hours;
        order.updatedAt = now;
      }
      if (order && !order.trade && costing.trade) {
        order.trade = costing.trade;
        order.updatedAt = now;
      }
    }
  }
  if (percentLines.length) {
    const percentIds = new Set(percentLines.map((item) => item.line.id));
    const base = project.lines.filter((line) => !percentIds.has(line.id)).reduce((sum, line) => sum + resolveLine(project, line.id).directCents, 0);
    for (const { line, percent } of percentLines) {
      line.otherCents = Math.round((base * percent) / 100);
      line.origins.other = "AI";
      line.explanation = `${line.explanation} Calcul : ${formatMoney(base, project.currency)} × ${formatNumber(percent, 1)} % = ${formatMoney(line.otherCents, project.currency)}.`.slice(0, 2000);
      summary.fromMarket += 1;
    }
  }
  return summary;
}

function pricingAuditSummary(summary: PricingSummary): string {
  const parts = [
    summary.quantified ? `${summary.quantified} quantité(s) reprise(s) du document` : "",
    summary.fromLibrary ? `${summary.fromLibrary} ligne(s) chiffrée(s) avec votre bibliothèque` : "",
    summary.fromMarket ? `${summary.fromMarket} ligne(s) chiffrée(s) avec la ${summary.market ?? "référence de marché"} (indicative, à valider)` : "",
  ].filter(Boolean);
  if (!parts.length) return "Chiffrage automatique : aucune nouvelle valeur. Saisissez les quantités ou complétez la bibliothèque.";
  return `Chiffrage automatique : ${parts.join(", ")}. Les lignes vérifiées ou modifiées restent inchangées.`;
}

/** Met en cache les propositions de marché du modèle et trace l'appel dans l'historique du projet. */
export async function recordMarketSuggestions(projectId: string, activities: AiMarketActivity[], error: string | null): Promise<{ added: number; error: string | null }> {
  await mutateProject(projectId, (project, database, now) => {
    const cache = (database.aiMarketActivities ??= []);
    for (const activity of activities) {
      const index = cache.findIndex((item) => item.region === activity.region && item.unit === activity.unit && item.name === activity.name);
      if (index >= 0) cache[index] = activity;
      else cache.push(activity);
    }
    audit(project, {
      actor: "NavalSmart AI",
      entity: "Référence marché",
      summary: error
        ? `Propositions de marché du modèle indisponibles (${error}) : le référentiel intégré reste appliqué.`
        : `${activities.length} ouvrage(s) sans référence chiffré(s) par le modèle : valeurs unitaires indicatives, à valider.`,
      source: "AI",
    }, now);
  });
  return { added: activities.length, error };
}

/** Chiffre les lignes encore proposées (ni vérifiées ni modifiées). */
export async function costProjectLines(projectId: string): Promise<PricingSummary> {
  let summary: PricingSummary | undefined;
  await mutateProject(projectId, (project, database, now) => {
    if (!project.lines.length) throw new ServiceError("Aucune ligne d'estimation à chiffrer.");
    summary = priceLines(project, database, now, (line) => line.status === "AI_GENERATED");
    audit(project, { actor: "Système", entity: "Estimation", summary: pricingAuditSummary(summary), source: "CALCUL SYSTÈME" }, now);
  });
  return summary!;
}

/** Retire le dossier de l'espace actif ; renvoie son nom pour la confirmation. */
export async function deleteProject(projectId: string): Promise<string> {
  let name: string | null = null;
  await updateDatabase((database) => {
    const index = database.projects.findIndex((project) => project.id === projectId);
    if (index < 0) throw new ServiceError("Estimation introuvable.", 404);
    name = database.projects[index]!.name;
    database.projects.splice(index, 1);
  });
  if (name === null) throw new ServiceError("Estimation introuvable.", 404);
  return name;
}

/** Remplace (ou retire) l'image du projet ; renvoie l'ancienne pour que son fichier soit supprimé. */
export async function setProjectAvatar(projectId: string, avatar: ProjectAvatar | null): Promise<ProjectAvatar | null> {
  let previous: ProjectAvatar | null = null;
  await mutateProject(projectId, (project, _database, now) => {
    previous = project.avatar ?? null;
    project.avatar = avatar;
    audit(project, { actor: "Morel", entity: "Estimation", summary: avatar ? "Image du projet importée." : "Image du projet retirée.", source: "USER" }, now);
  });
  return previous;
}

export async function storeDocument(projectId: string, document: TenderDocument): Promise<Project> {
  return mutateProject(projectId, (project, _database, now) => {
    if (!project.tender) {
      project.tender = { id: id("tender"), title: project.name, documents: [] };
    }
    project.tender.documents.unshift(document);
    project.status = project.status === "DRAFT" ? "IN_ANALYSIS" : project.status;
    audit(project, { actor: "Morel", entity: "Document", summary: `Import de ${document.fileName}.`, source: "USER" }, now);
  });
}

export async function applyAnalysis(
  projectId: string,
  analysis: Analysis,
  documentUpdate?: { extractedText: string; pageCount: number | null },
): Promise<Project> {
  return mutateProject(projectId, (project, database, now) => {
    project.analysis = analysis;
    const document = project.tender?.documents[0];
    if (document) {
      document.status = "COMPLETED";
      if (documentUpdate) {
        document.extractedText = documentUpdate.extractedText;
        document.pageCount = documentUpdate.pageCount ?? document.pageCount;
      }
    }
    const filled = fillEmptyFields(project, analysis);
    const hadPackages = project.workPackages.length > 0;
    const newLines = new Set<string>();
    if (!hadPackages && analysis.detectedWork.length > 0) {
      analysis.detectedWork.forEach((work, packageIndex) => {
        const packageId = id("wp");
        const tasks = (work.tasks.length ? work.tasks : [work.name]).map((task, taskIndex) => ({
          id: id("task"),
          name: task,
          description: "",
          sortOrder: taskIndex + 1,
        }));
        project.workPackages.push({
          id: packageId,
          name: work.name,
          code: work.code ?? String(packageIndex + 1).padStart(2, "0"),
          sortOrder: packageIndex + 1,
          tasks,
        });
        for (const task of tasks) {
          const line = {
            id: id("line"),
            workPackageId: packageId,
            taskId: task.id,
            lot: work.name,
            description: task.name,
            quantity: 0,
            unit: "forfait",
            hours: 0,
            hourlyRateCents: 0,
            materialsCents: 0,
            equipmentCents: 0,
            subcontractCents: 0,
            logisticsCents: 0,
            otherCents: 0,
            sourceLabel: "Portée détectée — quantité non citée",
            page: work.page,
            section: work.section,
            provenance: "AI" as const,
            status: "AI_GENERATED" as const,
            explanation: "Tâche détectée dans la portée. Aucune quantité n'est citée : saisissez-la pour obtenir un chiffrage.",
            origins: { hours: "AI", rate: "AI", materials: "AI", equipment: "AI", subcontract: "AI", logistics: "AI", other: "AI" } as const,
          };
          const parsedLine = parseEstimate(line);
          if (parsedLine.success) {
            project.lines.push(parsedLine.data);
            newLines.add(parsedLine.data.id);
          }
        }
      });
    }
    if (newLines.size) {
      const pricing = priceLines(project, database, now, (line) => newLines.has(line.id));
      audit(project, { actor: "Système", entity: "Estimation", summary: pricingAuditSummary(pricing), source: "CALCUL SYSTÈME" }, now);
    }
    for (const risk of analysis.risks) {
      if (project.risks.some((item) => item.title === risk.title)) continue;
      const parsedRisk = parseRisk({
        ...risk,
        potentialCostCents: risk.provenance === "USER" ? risk.potentialCostCents : null,
      });
      if (parsedRisk.success) project.risks.push({ ...parsedRisk.data, id: id("risk") });
    }
    for (const item of analysis.missing) {
      if (project.missing.some((current) => current.description === item.description)) continue;
      const parsedMissing = parseMissingInformation(item);
      if (parsedMissing.success) project.missing.push({ ...parsedMissing.data, id: id("miss") });
    }
    for (const item of analysis.assumptions) {
      if (project.assumptions.some((current) => current.description === item.description)) continue;
      const parsedAssumption = parseWith(assumptionSchema, item);
      if (parsedAssumption.success) project.assumptions.push({ ...parsedAssumption.data, id: id("assum") });
    }
    if (project.status === "DRAFT" || project.status === "IN_ANALYSIS") project.status = "IN_ESTIMATION";
    const planning = project.workPackages.length ? applyPlanning(project, database, now) : null;
    if (planning?.created) {
      audit(project, { actor: "Système", entity: "Planning", summary: planningAuditSummary(planning), source: "CALCUL SYSTÈME" }, now);
    }
    audit(project, {
      actor: "NavalSmart AI",
      entity: "Analyse",
      summary: hadPackages
        ? "Analyse enregistrée. Les lots déjà présents n'ont pas été écrasés."
        : "Analyse enregistrée et lots proposés à partir des extraits retenus.",
      source: analysis.engine === "OPENAI" ? "AI" : "LOCAL",
    }, now);
    if (filled.length) {
      audit(project, {
        actor: "NavalSmart AI",
        entity: "Estimation",
        summary: `Champs vides complétés depuis l'appel d'offres : ${filled.join(", ")}.`,
        source: "DOCUMENT",
      }, now);
    }
  });
}

/** Complète uniquement les champs vides du projet avec les faits sourcés du document. */
function fillEmptyFields(project: Project, analysis: Analysis): string[] {
  const data = analysis.structured;
  const filled: string[] = [];
  const set = (key: "client" | "vessel" | "location", value: string | null | undefined, label: string) => {
    if (value && !project[key].trim()) {
      project[key] = value;
      filled.push(label);
    }
  };
  if (data) {
    set("client", data.project.client?.value, "client");
    set("vessel", data.project.vessel?.value, "navire");
    set("location", data.project.location?.value, "lieu");
  }
  const deadline = data?.submission.deadline?.value;
  if (!project.submissionDeadline && deadline) {
    project.submissionDeadline = deadline;
    filled.push("date limite");
  }
  const window = documentWorkWindow(milestonesFromAnalysis(analysis, id));
  if (!project.plannedStart && window.start) {
    project.plannedStart = window.start;
    filled.push("début prévu");
  }
  if (!project.plannedEnd && window.end && (!project.plannedStart || project.plannedStart <= window.end)) {
    project.plannedEnd = window.end;
    filled.push("fin prévue");
  }
  return filled;
}

function applyPlanning(project: Project, database: Database, now: string) {
  const result = generatePlanning(project, {
    now,
    makeId: id,
    knownTrades: database.settings.laborRates.map((rate) => rate.trade),
  });
  project.milestones = result.milestones;
  project.workOrders = result.workOrders;
  return result;
}

export async function planProject(projectId: string): Promise<Project> {
  return mutateProject(projectId, (project, database, now) => {
    if (!project.workPackages.length) throw new ServiceError("Aucun lot à planifier. Analysez l'appel d'offres ou créez les lots.");
    const result = applyPlanning(project, database, now);
    audit(project, { actor: "Système", entity: "Planning", summary: planningAuditSummary(result), source: "CALCUL SYSTÈME" }, now);
  });
}

function planningAuditSummary(result: ReturnType<typeof generatePlanning>): string {
  const window = result.window ? ` du ${result.window.start} au ${result.window.end}` : "";
  const method = result.scheduledFromDocument ? "selon le calendrier du document" : "par répartition des lots";
  const parts = [
    result.created ? `${result.created} ordre(s) de travail créé(s)` : "",
    result.redated ? `${result.redated} date(s) proposée(s) recalculée(s)` : "",
  ].filter(Boolean);
  if (!parts.length) return "Planning à jour : chaque tâche a déjà son ordre de travail. Jalons du document actualisés.";
  if (!result.window) return `${parts.join(", ")}. Dates à fixer : le document ne donne pas de date de début des travaux.`;
  return `${parts.join(", ")}. Dates proposées ${method}${window}, à valider.`;
}

/** Date de début (et de fin facultative) des travaux, puis recalcul des dates proposées. */
export async function setPlanningWindow(projectId: string, start: string, end: string | null): Promise<Project> {
  return mutateProject(projectId, (project, database, now) => {
    if (end && end < start) throw new ServiceError("La fin prévue doit suivre le début.");
    project.plannedStart = start;
    project.plannedEnd = end;
    const result = project.workPackages.length ? applyPlanning(project, database, now) : null;
    audit(project, {
      actor: "Morel",
      entity: "Planning",
      summary: `Début des travaux fixé au ${start}${end ? `, fin au ${end}` : ""}.${result ? ` ${planningAuditSummary(result)}` : ""}`,
      source: "USER MODIFIED",
    }, now);
  });
}

export async function saveWorkOrders(projectId: string, orders: WorkOrder[]): Promise<Project> {
  return mutateProject(projectId, (project, _database, now) => {
    const ids = new Set(orders.map((order) => order.id));
    const previous = new Map(project.workOrders.map((order) => [order.id, order]));
    project.workOrders = refreshBlockedStatus(orders.map((order) => {
      const before = previous.get(order.id);
      const datesChanged = before && (before.plannedStart !== order.plannedStart || before.plannedEnd !== order.plannedEnd);
      const changed = !before || JSON.stringify({ ...before, updatedAt: "" }) !== JSON.stringify({ ...order, updatedAt: "" });
      return {
        ...order,
        datesProvenance: datesChanged ? "USER" as const : order.datesProvenance,
        progressPct: order.status === "DONE" ? 100 : order.progressPct,
        dependsOn: order.dependsOn.filter((dependency) => dependency !== order.id && ids.has(dependency)),
        blockers: order.blockers.filter((blocker) => project.missing.some((item) => item.id === blocker)),
        updatedAt: changed ? now : order.updatedAt,
      };
    }), project.missing);
    audit(project, { actor: "Morel", entity: "Ordres de travail", summary: "Ordres de travail mis à jour.", source: "USER MODIFIED" }, now);
  });
}

export async function saveMilestones(projectId: string, milestones: ProjectMilestone[]): Promise<Project> {
  return mutateProject(projectId, (project, _database, now) => {
    project.milestones = milestones;
    audit(project, { actor: "Morel", entity: "Planning", summary: "Jalons mis à jour.", source: "USER MODIFIED" }, now);
  });
}

export async function addMessage(projectId: string, role: "USER" | "ASSISTANT", content: string): Promise<Project> {
  return mutateProject(projectId, (project) => {
    project.messages.push({ id: id("msg"), role, content, createdAt: new Date().toISOString() });
  });
}
