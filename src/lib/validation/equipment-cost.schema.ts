import { z } from "zod";

export const equipmentCostSchema = z.object({
  id: z.string().min(1).max(80),
  estimateLineId: z.string().nullable(),
  name: z.string().trim().min(1).max(160),
  quantity: z.number().finite().nonnegative(),
  duration: z.number().finite().nonnegative(),
  durationUnit: z.string().trim().min(1).max(40),
  rateCents: z.number().int().nonnegative(),
  transportCents: z.number().int().nonnegative(),
});

export type EquipmentCostInput = z.infer<typeof equipmentCostSchema>;
