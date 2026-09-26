import { NextResponse } from "next/server";
import { getProject, ServiceError } from "@/server/estimates";
import { apiError, requireApiUser } from "@/server/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireApiUser())) return apiError(401, "Authentification requise.");
  try {
    const { id } = await context.params;
    const project = await getProject(id);
    if (!project.tender) return apiError(404, "Appel d'offres introuvable.");
    return NextResponse.json({ tender: project.tender, analysis: project.analysis });
  } catch (error) {
    if (error instanceof ServiceError) return apiError(error.status, error.message);
    return apiError(500, "Lecture impossible.");
  }
}
