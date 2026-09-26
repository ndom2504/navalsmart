import { NextResponse } from "next/server";
import { createEstimateSchema } from "@/domain/schemas";
import { createEstimate } from "@/server/estimates";
import { apiError, requireApiUser } from "@/server/http";

export async function POST(request: Request) {
  if (!(await requireApiUser())) return apiError(401, "Authentification requise.");
  const parsed = createEstimateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Données invalides.");
  const project = await createEstimate(parsed.data);
  return NextResponse.json({ id: project.id }, { status: 201 });
}
