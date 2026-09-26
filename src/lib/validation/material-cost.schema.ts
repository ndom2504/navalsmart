import { z } from "zod";

export const materialCostSchema = z.object({
  id: z.string().min(1).max(80),
  estimateLineId: z.string().nullable(),
  supplierId: z.string().nullable(),
  description: z.string().trim().min(1).max(200),
  quantity: z.number().finite().nonnegative(),
  unit: z.string().trim().min(1).max(40),
  unitPriceCents: z.number().int().nonnegative(),
  transportCents: z.number().int().nonnegative(),
  wasteCents: z.number().int().nonnegative(),
});

export type MaterialCostInput = z.infer<typeof materialCostSchema>;
