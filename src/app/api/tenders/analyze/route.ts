import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeTenderText } from "@/server/ai";
import { applyAnalysis, getProject, ServiceError } from "@/server/estimates";
import { apiError, rateLimit, requireApiUser } from "@/server/http";

const bodySchema = z.object({ projectId: z.string().min(1) });

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError(401, "Authentification requise.");
  if (!rateLimit(`analyze:${user.id}`, 8)) return apiError(429, "Trop d'analyses.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Identifiant invalide.");
  try {
    const project = await getProject(parsed.data.projectId);
    const text = project.tender?.documents[0]?.extractedText;
    if (!text) return apiError(400, "Aucun document à analyser.");
    const analysis = await analyzeTenderText(text, new Date().toISOString());
    const updated = await applyAnalysis(project.id, analysis);
    return NextResponse.json({ analysis: updated.analysis });
  } catch (error) {
    if (error instanceof ServiceError) return apiError(error.status, error.message);
    return apiError(500, "Analyse impossible.");
  }
}
