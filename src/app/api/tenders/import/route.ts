import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { safeExtension, uploadLimit } from "@/server/documents";
import { ServiceError } from "@/server/estimates";
import { apiError, rateLimit, requireApiUser } from "@/server/http";
import { createProjectFromTender } from "@/server/tender-pipeline";

export const maxDuration = 300;

/** Nouvelle estimation depuis un appel d'offres : le projet est créé, prérempli et planifié. */
export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError(401, "Authentification requise.");
  if (!rateLimit(`import:${user.id}`, 6)) return apiError(429, "Trop d'imports. Réessayez dans une minute.");
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return apiError(400, "Fichier manquant.");
  const extension = safeExtension(file.name);
  if (!extension) return apiError(400, "Format accepté : PDF, DOCX, XLSX ou TXT.");
  if (file.size <= 0 || file.size > uploadLimit()) return apiError(400, "La taille du fichier dépasse la limite de 20 Mo.");

  try {
    const project = await createProjectFromTender({
      name: file.name,
      type: file.type,
      size: file.size,
      buffer: Buffer.from(await file.arrayBuffer()),
      extension,
    });
    revalidatePath("/dashboard");
    revalidatePath("/estimations");
    revalidatePath("/planning");
    return NextResponse.json({
      id: project.id,
      name: project.name,
      workPackages: project.workPackages.length,
      workOrders: project.workOrders.length,
      milestones: project.milestones.length,
      engine: project.analysis?.engine ?? null,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) return apiError(error.status, error.message);
    console.error("[NavalSmart] Import d'appel d'offres impossible", error);
    return apiError(500, "Import impossible.");
  }
}
