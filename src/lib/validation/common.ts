import { z } from "zod";

export const lineStatusSchema = z.enum(["AI_GENERATED", "USER_VERIFIED", "USER_MODIFIED"]);

export const riskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const reviewSeveritySchema = z.enum(["CRITICAL", "WARNING", "INFO"]);

export const provenanceSchema = z.enum(["DOCUMENT", "USER", "AI", "SYSTEM"]);

export const recordStatusSchema = z.enum(["OPEN", "ACCEPTED", "RESOLVED", "IGNORED", "REJECTED"]);

export const reviewStatusSchema = z.enum(["PENDING", "ACCEPTED", "IGNORED", "MODIFIED"]);

const nullableText = (max: number) =>
  z.union([z.string().trim().max(max), z.null()]).optional().transform((value) => value || null);

/** Fait cité dans un document. La source est l'extrait, jamais un montant calculé. */
export const documentFactSchema = z.object({
  value: z.string().trim().min(1).max(2000),
  source: z.string().trim().min(1).max(2000),
  page: nullableText(20),
  section: nullableText(40),
  status: lineStatusSchema.default("AI_GENERATED"),
});

export function trustedList<T>(schema: z.ZodType<T>) {
  return z.array(z.unknown()).optional().transform((items) => {
    if (!items) return [];
    return items.flatMap((item) => {
      const parsed = schema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  });
}
