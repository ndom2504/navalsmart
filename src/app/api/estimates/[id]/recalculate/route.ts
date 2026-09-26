import { NextResponse } from "next/server";
import { recalculate, ServiceError } from "@/server/estimates";
import { apiError, requireApiUser } from "@/server/http";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireApiUser())) return apiError(401, "Authentification requise.");
  try {
    const { id } = await context.params;
    return NextResponse.json(await recalculate(id));
  } catch (error) {
    if (error instanceof ServiceError) return apiError(error.status, error.message);
    return apiError(500, "Recalcul impossible.");
  }
}
