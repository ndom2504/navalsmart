import { z } from "zod";
import { reviewSeveritySchema, reviewStatusSchema } from "@/lib/validation/common";

export const aiReviewSchema = z.object({
  id: z.string().min(1).max(80),
  code: z.string().trim().min(1).max(40),
  severity: reviewSeveritySchema,
  title: z.string().trim().min(1).max(180),
  detail: z.string().max(2000),
  status: reviewStatusSchema,
  note: z.string().max(1000),
  createdAt: z.string().min(1),
});

export type AIReviewInput = z.infer<typeof aiReviewSchema>;
