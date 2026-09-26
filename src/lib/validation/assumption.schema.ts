import { z } from "zod";
import { provenanceSchema, recordStatusSchema } from "@/lib/validation/common";

export const assumptionSchema = z.object({
  id: z.string().min(1).max(80),
  description: z.string().trim().min(3).max(500),
  sourceLabel: z.string().max(240),
  page: z.string().nullable(),
  section: z.string().nullable(),
  potentialImpact: z.string().max(500),
  status: recordStatusSchema,
  provenance: provenanceSchema,
});

export type AssumptionInput = z.infer<typeof assumptionSchema>;
