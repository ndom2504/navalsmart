import { z } from "zod";

export const laborCostSchema = z.object({
  id: z.string().min(1).max(80),
  taskId: z.string().nullable(),
  estimateLineId: z.string().nullable(),
  category: z.string().trim().min(1).max(120),
  trade: z.string().trim().min(1).max(120),
  workers: z.number().finite().nonnegative(),
  hours: z.number().finite().nonnegative(),
  hourlyRateCents: z.number().int().nonnegative(),
  overtimeHours: z.number().finite().nonnegative(),
  productivityFactor: z.number().finite().positive(),
  overtimeFactor: z.number().finite().positive(),
});

export type LaborCostInput = z.infer<typeof laborCostSchema>;
