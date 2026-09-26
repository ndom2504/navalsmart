import { NextResponse } from "next/server";
import { z } from "zod";
import { getProject, ServiceError, storeDocument } from "@/server/estimates";
import { apiError, requireApiUser } from "@/server/http";
import { id } from "@/lib/utils";

const bodySchema = z.object({ projectId: z.string().min(1), title: z.string().trim().min(2).max(180).optional() });

export async function POST(request: Request) {
  if (!(await requireApiUser())) return apiError(401, "Authentification requise.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Données invalides.");
  try {
    const project = await getProject(parsed.data.projectId);
    if (project.tender) return NextResponse.json(project.tender);
    const updated = await storeDocument(project.id, {
      id: id("doc"),
      fileName: "en-attente",
      mimeType: "text/plain",
      sizeBytes: 0,
      pageCount: null,
      storedPath: "",
      extractedText: "",
      status: "PENDING",
      importedAt: new Date().toISOString(),
    });
    if (parsed.data.title && updated.tender) updated.tender.title = parsed.data.title;
    return NextResponse.json(updated.tender, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) return apiError(error.status, error.message);
    return apiError(500, "Création impossible.");
  }
}
