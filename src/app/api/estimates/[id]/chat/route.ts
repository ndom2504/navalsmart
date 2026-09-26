import { NextResponse } from "next/server";
import { chatSchema } from "@/domain/schemas";
import { answerQuestion } from "@/server/ai";
import { addMessage, getProject, ServiceError } from "@/server/estimates";
import { apiError, rateLimit, requireApiUser } from "@/server/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return apiError(401, "Authentification requise.");
  if (!rateLimit(`chat:${user.id}`, 20)) return apiError(429, "Trop de messages.");
  const parsed = chatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Message invalide.");
  try {
    const { id } = await context.params;
    await addMessage(id, "USER", parsed.data.message);
    const project = await getProject(id);
    const answer = await answerQuestion(project, parsed.data.message);
    const updated = await addMessage(id, "ASSISTANT", answer);
    return NextResponse.json({ answer, messages: updated.messages });
  } catch (error) {
    if (error instanceof ServiceError) return apiError(error.status, error.message);
    return apiError(500, "Assistant indisponible.");
  }
}
