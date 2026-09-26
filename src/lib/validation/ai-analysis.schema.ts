import { z } from "zod";
import { documentFactSchema, riskLevelSchema, trustedList } from "@/lib/validation/common";

const optionalLabel = z.union([z.string(), z.null()]).optional().transform((value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed.slice(0, 160) : null;
});

const projectFactSchema = z.object({
  name: optionalLabel,
  client: optionalLabel,
  vessel: optionalLabel,
  deadline: optionalLabel,
});

const aiWorkPackageSchema = z.object({
  value: z.string().trim().min(1).max(160),
  tasks: z.array(z.string().trim().min(1).max(160)).default([]),
  source: z.string().trim().min(1).max(2000),
  page: documentFactSchema.shape.page,
  section: documentFactSchema.shape.section,
  status: documentFactSchema.shape.status,
});

const aiRiskSchema = z.object({
  value: z.string().trim().min(3).max(180),
  source: z.string().trim().min(1).max(2000),
  page: documentFactSchema.shape.page,
  section: documentFactSchema.shape.section,
  status: documentFactSchema.shape.status,
  probability: riskLevelSchema,
  impact: riskLevelSchema,
  level: riskLevelSchema,
}).strict();

const aiAssumptionSchema = z.object({
  value: z.string().trim().min(3).max(500),
  source: z.string().trim().max(2000).nullable().optional(),
  page: documentFactSchema.shape.page,
  section: documentFactSchema.shape.section,
  status: documentFactSchema.shape.status,
  impact: z.string().trim().max(500).default(""),
});

const aiMissingSchema = z.object({
  value: z.string().trim().min(3).max(500),
  source: z.string().trim().max(2000).nullable().optional(),
  page: documentFactSchema.shape.page,
  section: documentFactSchema.shape.section,
  status: documentFactSchema.shape.status,
  importance: riskLevelSchema,
  action: z.string().trim().min(1).max(400),
});

export const aiAnalysisSchema = z.object({
  summary: z.string().trim().max(4000).default(""),
  project: projectFactSchema,
  scope: trustedList(documentFactSchema),
  requirements: trustedList(documentFactSchema),
  workPackages: trustedList(aiWorkPackageSchema),
  tasks: trustedList(documentFactSchema),
  quantities: trustedList(documentFactSchema),
  deadlines: trustedList(documentFactSchema),
  documentsRequired: trustedList(documentFactSchema),
  constraints: trustedList(documentFactSchema),
  risks: trustedList(aiRiskSchema),
  assumptions: trustedList(aiAssumptionSchema),
  missingInformation: trustedList(aiMissingSchema),
}).strip();

export type AIAnalysis = z.infer<typeof aiAnalysisSchema>;
