import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { AVATAR_MAX_BYTES, deleteProjectAvatar, readProjectAvatar, saveProjectAvatar } from "@/server/avatars";
import { ServiceError } from "@/server/estimates";
import { apiError, requireApiUser } from "@/server/http";

type Context = { params: Promise<{ id: string }> };

function refreshProjectViews(id: string) {
  for (const route of ["/dashboard", "/estimations", "/appels-offres", "/parametres", `/estimations/${id}`]) revalidatePath(route);
}

export async function GET(_request: Request, context: Context) {
  if (!(await requireApiUser())) return apiError(401, "Authentification requise.");
  try {
    const { id } = await context.params;
    const image = await readProjectAvatar(id);
    if (!image) return apiError(404, "Aucune image pour ce projet.");
    return new Response(new Uint8Array(image.buffer), {
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ServiceError) return apiError(error.status, error.message);
    return apiError(500, "Lecture impossible.");
  }
}

export async function POST(request: Request, context: Context) {
  if (!(await requireApiUser())) return apiError(401, "Authentification requise.");
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return apiError(400, "Image manquante.");
  if (file.size > AVATAR_MAX_BYTES) return apiError(400, "L'image doit peser au plus 10 Mo.");
  try {
    const { id } = await context.params;
    await saveProjectAvatar(id, Buffer.from(await file.arrayBuffer()));
    refreshProjectViews(id);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) return apiError(error.status, error.message);
    return apiError(500, "Import impossible.");
  }
}

export async function DELETE(_request: Request, context: Context) {
  if (!(await requireApiUser())) return apiError(401, "Authentification requise.");
  try {
    const { id } = await context.params;
    await deleteProjectAvatar(id);
    refreshProjectViews(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ServiceError) return apiError(error.status, error.message);
    return apiError(500, "Suppression impossible.");
  }
}
