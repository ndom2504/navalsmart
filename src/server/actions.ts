"use server";

import { revalidatePath } from "next/cache";
import { auth, signOut } from "@/auth";
import {
  assumptionSchema,
  chatSchema,
  createEstimateSchema,
  equipmentSchema,
  estimateLineSchema,
  laborSchema,
  materialSchema,
  missingSchema,
  projectPatchSchema,
  quoteSchema,
  reviewDecisionSchema,
  riskSchema,
  settingsSchema,
  subcontractorSchema,
  supplierSchema,
  workPackageSchema,
} from "@/domain/schemas";
import { answerQuestion, analyzeTenderText } from "@/server/ai";
import {
  addMessage,
  addSubcontractor,
  addSupplier,
  applyAnalysis,
  createEstimate,
  decideReview,
  patchProject,
  recalculate,
  runReview,
  saveAssumptions,
  saveEquipment,
  saveLabor,
  saveLines,
  saveMaterials,
  saveMissing,
  savePackages,
  saveQuotes,
  saveRisks,
  saveSubcontractors,
  ServiceError,
  updateSettings,
} from "@/server/estimates";
import { getProject } from "@/server/estimates";
import { rateLimit } from "@/server/http";
import { switchWorkspace } from "@/server/store";
import type { WorkspaceMode } from "@/domain/types";
import { z } from "zod";

async function actor() {
  const session = await auth();
  if (!session?.user?.id) throw new ServiceError("Authentification requise.", 401);
  return session.user;
}

function fail(error: unknown): { error: string } {
  if (error instanceof ServiceError || error instanceof Error) return { error: error.message };
  return { error: "Opération impossible." };
}

export async function logout() {
  await signOut({ redirectTo: "/connexion" });
}

export async function createEstimateAction(input: unknown) {
  try {
    await actor();
    const parsed = createEstimateSchema.parse(input);
    const project = await createEstimate(parsed);
    revalidatePath("/dashboard");
    revalidatePath("/estimations");
    return { id: project.id };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Vérifiez les champs du formulaire." };
    return fail(error);
  }
}

export async function saveProjectAction(projectId: string, input: unknown) {
  try {
    await actor();
    const parsed = projectPatchSchema.parse(input);
    await patchProject(projectId, parsed);
    revalidatePath(`/estimations/${projectId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Données invalides." };
    return fail(error);
  }
}

async function saveList<T>(projectId: string, schema: z.ZodType<T>, input: unknown, persist: (id: string, value: T) => Promise<unknown>) {
  await actor();
  const parsed = schema.parse(input);
  await persist(projectId, parsed);
  revalidatePath(`/estimations/${projectId}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function saveLinesAction(projectId: string, input: unknown) {
  try {
    return await saveList(projectId, z.array(estimateLineSchema), input, saveLines);
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Une ligne d'estimation est invalide." };
    return fail(error);
  }
}

export async function savePackagesAction(projectId: string, input: unknown) {
  try {
    return await saveList(projectId, z.array(workPackageSchema), input, savePackages);
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Un lot est invalide." };
    return fail(error);
  }
}

export async function saveLaborAction(projectId: string, input: unknown) {
  try {
    return await saveList(projectId, z.array(laborSchema), input, saveLabor);
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Une ligne de main-d'œuvre est invalide." };
    return fail(error);
  }
}

export async function saveMaterialsAction(projectId: string, input: unknown) {
  try {
    return await saveList(projectId, z.array(materialSchema), input, saveMaterials);
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Un matériau est invalide." };
    return fail(error);
  }
}

export async function saveEquipmentAction(projectId: string, input: unknown) {
  try {
    return await saveList(projectId, z.array(equipmentSchema), input, saveEquipment);
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Un équipement est invalide." };
    return fail(error);
  }
}

export async function saveQuotesAction(projectId: string, input: unknown) {
  try {
    return await saveList(projectId, z.array(quoteSchema), input, saveQuotes);
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Une soumission est invalide." };
    return fail(error);
  }
}

const addSubcontractorSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(2).max(160),
  contact: z.string().trim().max(160),
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000),
  priceCents: z.number().int().nonnegative().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

export async function addSubcontractorAction(input: unknown) {
  try {
    await actor();
    const parsed = addSubcontractorSchema.parse(input);
    await addSubcontractor(parsed.projectId, parsed);
    revalidatePath("/sous-traitants");
    revalidatePath(`/estimations/${parsed.projectId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Fiche sous-traitant invalide." };
    return fail(error);
  }
}

export async function saveSubcontractorsAction(projectId: string, input: unknown) {
  try {
    return await saveList(projectId, z.array(subcontractorSchema), input, saveSubcontractors);
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Un sous-traitant est invalide." };
    return fail(error);
  }
}

export async function saveRisksAction(projectId: string, input: unknown) {
  try {
    return await saveList(projectId, z.array(riskSchema), input, saveRisks);
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Un risque est invalide." };
    return fail(error);
  }
}

export async function saveAssumptionsAction(projectId: string, input: unknown) {
  try {
    return await saveList(projectId, z.array(assumptionSchema), input, saveAssumptions);
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Une hypothèse est invalide." };
    return fail(error);
  }
}

export async function saveMissingAction(projectId: string, input: unknown) {
  try {
    return await saveList(projectId, z.array(missingSchema), input, saveMissing);
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Une information manquante est invalide." };
    return fail(error);
  }
}

export async function recalculateAction(projectId: string) {
  try {
    await actor();
    await recalculate(projectId);
    revalidatePath(`/estimations/${projectId}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function reviewAction(projectId: string) {
  try {
    await actor();
    if (!rateLimit(`review:${projectId}`, 10)) return { error: "Trop de revues. Réessayez dans une minute." };
    await runReview(projectId);
    revalidatePath(`/estimations/${projectId}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function decideReviewAction(projectId: string, input: unknown) {
  try {
    await actor();
    const parsed = reviewDecisionSchema.parse(input);
    await decideReview(projectId, parsed.reviewId, parsed.status, parsed.note);
    revalidatePath(`/estimations/${projectId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Décision invalide." };
    return fail(error);
  }
}

export async function analyzeAction(projectId: string) {
  try {
    const user = await actor();
    if (!rateLimit(`analyze:${user.id}`, 8)) return { error: "Trop d'analyses. Réessayez dans une minute." };
    const project = await getProject(projectId);
    const text = project.tender?.documents[0]?.extractedText;
    if (!text) return { error: "Aucun document à analyser." };
    const analysis = await analyzeTenderText(text, new Date().toISOString());
    await applyAnalysis(projectId, analysis);
    revalidatePath(`/estimations/${projectId}`);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function chatAction(projectId: string, input: unknown) {
  try {
    const user = await actor();
    if (!rateLimit(`chat:${user.id}`, 20)) return { error: "Trop de messages. Réessayez dans une minute." };
    const parsed = chatSchema.parse(input);
    await addMessage(projectId, "USER", parsed.message);
    const project = await getProject(projectId);
    const answer = await answerQuestion(project, parsed.message);
    await addMessage(projectId, "ASSISTANT", answer);
    revalidatePath(`/estimations/${projectId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Message invalide." };
    return fail(error);
  }
}

export async function createSupplierAction(input: unknown) {
  try {
    await actor();
    const parsed = supplierSchema.parse(input);
    await addSupplier(parsed);
    revalidatePath("/fournisseurs");
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Fiche fournisseur invalide." };
    return fail(error);
  }
}

export async function switchWorkspaceAction(mode: WorkspaceMode) {
  try {
    await actor();
    const parsed = z.enum(["demo", "real"]).parse(mode);
    await switchWorkspace(parsed);
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Mode d'espace inconnu." };
    return fail(error);
  }
}

export async function saveSettingsAction(input: unknown) {
  try {
    await actor();
    const parsed = settingsSchema.parse(input);
    await updateSettings(parsed);
    revalidatePath("/parametres");
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Paramètres invalides." };
    return fail(error);
  }
}
