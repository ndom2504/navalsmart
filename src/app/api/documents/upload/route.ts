import { NextResponse } from "next/server";
import { storeDocument, ServiceError } from "@/server/estimates";
import { extractDocument, safeExtension, saveUpload, uploadLimit } from "@/server/documents";
import { apiError, requireApiUser } from "@/server/http";
import { id } from "@/lib/utils";

export async function POST(request: Request) {
  if (!(await requireApiUser())) return apiError(401, "Authentification requise.");
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const projectId = form?.get("projectId");
  if (!(file instanceof File) || typeof projectId !== "string" || !projectId) {
    return apiError(400, "Fichier ou estimation manquant.");
  }
  const extension = safeExtension(file.name);
  if (!extension) return apiError(400, "Format accepté : PDF, DOCX, XLSX ou TXT.");
  if (file.size <= 0 || file.size > uploadLimit()) return apiError(400, "La taille du fichier dépasse la limite de 20 Mo.");

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractDocument(buffer, extension);
    const storedPath = await saveUpload(projectId, buffer, extension);
    const document = {
      id: id("doc"),
      fileName: file.name.replace(/[^\w.\- ()àâäéèêëïîôùûüç]/gi, "_").slice(0, 180),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      pageCount: extracted.pageCount,
      storedPath,
      extractedText: extracted.text,
      status: "PENDING" as const,
      importedAt: new Date().toISOString(),
    };
    const project = await storeDocument(projectId, document);
    return NextResponse.json({ document: project.tender?.documents[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) return apiError(error.status, error.message);
    return apiError(500, "Import impossible.");
  }
}
