import type { ZodType } from "zod";

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export function parseWith<T>(schema: ZodType<T>, input: unknown): ParseResult<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { success: true, data: parsed.data };
  const error = parsed.error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "valeur";
      return `${path}: ${issue.message}`;
    })
    .join(" ");
  return { success: false, error: error || "Donnée invalide." };
}
