import { z } from "zod";
import { recordStatusSchema, riskLevelSchema } from "@/lib/validation/common";

export const missingInformationSchema = z.object({
  id: z.string().min(1).max(80),
  description: z.string().trim().min(3).max(2000),
  importance: riskLevelSchema,
  sourceLabel: z.string().max(2000),
  page: z.string().nullable(),
  section: z.string().nullable(),
  requiredAction: z.string().max(400),
  status: recordStatusSchema,
  note: z.string().max(1000),
});

export type MissingInformationInput = z.infer<typeof missingInformationSchema>;
