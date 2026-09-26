import "server-only";

import { financialSummary } from "@/domain/calculations";
import { emptyProject } from "@/domain/demo";
import { mergeFindings } from "@/domain/review";
import type { Analysis, AuditEntry, Database, Project, TenderDocument } from "@/domain/types";
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

export async function applyAnalysis(projectId: string, analysis: Analysis): Promise<Project> {
  return mutateProject(projectId, (project, database, now) => {
    project.analysis = analysis;
    const document = project.tender?.documents[0];
    if (document) document.status = "COMPLETED";
    if (project.workPackages.length === 0 && analysis.detectedWork.length > 0) {
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
          code: String(packageIndex + 1).padStart(2, "0"),
          sortOrder: packageIndex + 1,
          tasks,
        });
        for (const task of tasks) {
          const quotedHours = hoursFromQuantities(analysis, task.name);
          const rate = database.settings.laborRates[0]?.hourlyRateCents ?? 0;
          const lineId = id("line");
          const line = {
            id: lineId,
            workPackageId: packageId,
            taskId: task.id,
            lot: work.name,
            description: task.name,
            quantity: quotedHours ?? 0,
            unit: quotedHours ? "heures" : "forfait",
            hours: quotedHours ?? 0,
            hourlyRateCents: quotedHours ? rate : 0,
            materialsCents: 0,
            equipmentCents: 0,
            subcontractCents: 0,
            logisticsCents: 0,
            otherCents: 0,
            sourceLabel: quotedHours ? "Appel d'offres" : "Portée détectée — quantité non citée",
            page: work.page,
            section: work.section,
            provenance: quotedHours ? "DOCUMENT" as const : "AI" as const,
            status: "AI_GENERATED" as const,
            explanation: quotedHours
              ? "Heures citées dans le document. Le taux vient du barème, pas du modèle."
              : "Tâche détectée dans la portée. Aucune quantité chiffrée n'a été inventée.",
            origins: {
              hours: quotedHours ? "DOCUMENT" as const : "AI" as const,
              rate: quotedHours ? "USER" as const : "AI" as const,
              materials: "AI" as const,
              equipment: "AI" as const,
              subcontract: "AI" as const,
              logistics: "AI" as const,
              other: "AI" as const,
            },
          };
          const parsedLine = parseEstimate(line);
          if (parsedLine.success) project.lines.push(parsedLine.data);
        }
      });
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
    audit(project, {
      actor: "NavalSmart AI",
      entity: "Analyse",
      summary: project.workPackages.length
        ? "Analyse enregistrée. Les lots déjà présents n'ont pas été écrasés."
        : "Analyse enregistrée et lots proposés à partir des extraits retenus.",
      source: analysis.engine === "OPENAI" ? "AI" : "LOCAL",
    }, now);
  });
}

export async function addMessage(projectId: string, role: "USER" | "ASSISTANT", content: string): Promise<Project> {
  return mutateProject(projectId, (project) => {
    project.messages.push({ id: id("msg"), role, content, createdAt: new Date().toISOString() });
  });
}
