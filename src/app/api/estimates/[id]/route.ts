import { NextResponse } from "next/server";
import { projectPatchSchema } from "@/domain/schemas";
import { getProject, patchProject, ServiceError } from "@/server/estimates";
import { apiError, requireApiUser } from "@/server/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  if (!(await requireApiUser())) return apiError(401, "Authentification requise.");
  try {
    const { id } = await context.params;
    return NextResponse.json(await getProject(id));
  } catch (error) {
    if (error instanceof ServiceError) return apiError(error.status, error.message);
    return apiError(500, "Lecture impossible.");
  }
}

export async function PATCH(request: Request, context: Context) {
  if (!(await requireApiUser())) return apiError(401, "Authentification requise.");
  const parsed = projectPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Données invalides.");
  try {
    const { id } = await context.params;
    return NextResponse.json(await patchProject(id, parsed.data));
  } catch (error) {
    if (error instanceof ServiceError) return apiError(error.status, error.message);
    return apiError(500, "Mise à jour impossible.");
  }
}
