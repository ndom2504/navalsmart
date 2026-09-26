import { z } from "zod";
import { provenanceSchema, recordStatusSchema, riskLevelSchema } from "@/lib/validation/common";

export const riskSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().trim().min(3).max(180),
  probability: riskLevelSchema,
  impact: riskLevelSchema,
  level: riskLevelSchema,
  potentialCostCents: z.number().int().nonnegative().nullable(),
  mitigation: z.string().max(1000),
  owner: z.string().max(120),
  status: recordStatusSchema,
  justification: z.string().max(2000),
  page: z.string().nullable(),
  section: z.string().nullable(),
  provenance: provenanceSchema,
});

export type RiskInput = z.infer<typeof riskSchema>;
