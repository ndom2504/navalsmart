import { z } from "zod";
import { lineStatusSchema, provenanceSchema } from "@/lib/validation/common";

const originsSchema = z.object({
  hours: provenanceSchema,
  rate: provenanceSchema,
  materials: provenanceSchema,
  equipment: provenanceSchema,
  subcontract: provenanceSchema,
  logistics: provenanceSchema,
  other: provenanceSchema,
});

export const estimateSchema = z.object({
  id: z.string().min(1).max(80),
  workPackageId: z.string().nullable(),
  taskId: z.string().nullable(),
  lot: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(240),
  quantity: z.number().finite().nonnegative(),
  unit: z.string().trim().min(1).max(40),
  hours: z.number().finite().nonnegative(),
  hourlyRateCents: z.number().int().nonnegative(),
  materialsCents: z.number().int().nonnegative(),
  equipmentCents: z.number().int().nonnegative(),
  subcontractCents: z.number().int().nonnegative(),
  logisticsCents: z.number().int().nonnegative(),
  otherCents: z.number().int().nonnegative(),
  sourceLabel: z.string().max(240),
  page: z.string().max(20).nullable(),
  section: z.string().max(40).nullable(),
  provenance: provenanceSchema,
  status: lineStatusSchema,
  explanation: z.string().max(2000),
  origins: originsSchema,
});

export type EstimateInput = z.infer<typeof estimateSchema>;
