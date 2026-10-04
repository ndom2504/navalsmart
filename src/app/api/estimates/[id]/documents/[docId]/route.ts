import fs from "node:fs/promises";
import path from "node:path";
import { getProject, ServiceError } from "@/server/estimates";
import { apiError, requireApiUser } from "@/server/http";

type Context = { params: Promise<{ id: string; docId: string }> };

const TYPES: Record<string, { mime: string; inline: boolean }> = {
  pdf: { mime: "application/pdf", inline: true },
  txt: { mime: "text/plain; charset=utf-8", inline: true },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", inline: false },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", inline: false },
};

export async function GET(request: Request, context: Context) {
  if (!(await requireApiUser())) return apiError(401, "Authentification requise.");
  try {
    const { id, docId } = await context.params;
    const project = await getProject(id);
    const document = project.tender?.documents.find((item) => item.id === docId);
    if (!document?.storedPath) return apiError(404, "Fichier original non conservé pour ce document.");
    const uploads = path.join(process.cwd(), "uploads");
    const resolved = path.resolve(document.storedPath);
    const relative = path.relative(uploads, resolved);
    const type = TYPES[path.extname(resolved).slice(1).toLowerCase()];
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || !type) return apiError(404, "Fichier introuvable.");
    const buffer = await fs.readFile(resolved).catch(() => null);
    if (!buffer) return apiError(404, "Fichier introuvable.");
    const download = new URL(request.url).searchParams.has("telecharger") || !type.inline;
    const fileName = encodeURIComponent(document.fileName);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": type.mime,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${fileName}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ServiceError) return apiError(error.status, error.message);
    return apiError(500, "Lecture impossible.");
  }
}
