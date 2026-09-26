import { z } from "zod";

export const taskSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  description: z.string().max(1000),
  sortOrder: z.number().int().nonnegative(),
});

export const workPackageSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(20),
  sortOrder: z.number().int().nonnegative(),
  tasks: z.array(taskSchema),
});

export type WorkPackageInput = z.infer<typeof workPackageSchema>;
