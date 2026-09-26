import { NextResponse } from "next/server";
import { runReview, ServiceError } from "@/server/estimates";
import { apiError, rateLimit, requireApiUser } from "@/server/http";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return apiError(401, "Authentification requise.");
  if (!rateLimit(`review:${user.id}`, 10)) return apiError(429, "Trop de revues.");
  try {
    const { id } = await context.params;
    return NextResponse.json(await runReview(id));
  } catch (error) {
    if (error instanceof ServiceError) return apiError(error.status, error.message);
    return apiError(500, "Revue impossible.");
  }
}
