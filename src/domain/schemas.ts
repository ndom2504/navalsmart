import { z } from "zod";

export const projectTypeSchema = z.enum([
  "CONSTRUCTION",
  "REPAIR",
  "MAINTENANCE",
  "CONVERSION",
  "MECHANICAL",
  "ELECTRICAL",
  "OTHER",
]);

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

export const createEstimateSchema = z.object({
  name: z.string().trim().min(3).max(160),
  client: z.string().trim().min(2).max(160),
  vessel: z.string().trim().min(2).max(160),
  type: projectTypeSchema,
  location: z.string().trim().max(160),
  receivedAt: dateSchema,
  submissionDeadline: dateSchema,
  plannedStart: dateSchema,
  plannedEnd: dateSchema,
  currency: z.string().trim().regex(/^[A-Z]{3}$/),
  description: z.string().trim().max(4000),
  learningMode: z.boolean(),
});

export const projectPatchSchema = createEstimateSchema.partial().extend({
  status: z.enum(["DRAFT", "IN_ANALYSIS", "IN_ESTIMATION", "TO_VALIDATE", "VALIDATED", "SUBMITTED"]).optional(),
  learningMode: z.boolean().optional(),
  contingencyPct: z.number().min(0).max(100).optional(),
  overheadPct: z.number().min(0).max(100).optional(),
  marginPct: z.number().min(0).max(100).optional(),
  overtimeFactor: z.number().min(1).max(3).optional(),
  validationNote: z.string().max(4000).optional(),
  marketRegion: z.string().min(2).max(10).nullable().optional(),
});

const originsSchema = z.object({
  hours: z.enum(["DOCUMENT", "USER", "AI", "SYSTEM"]),
  rate: z.enum(["DOCUMENT", "USER", "AI", "SYSTEM"]),
  materials: z.enum(["DOCUMENT", "USER", "AI", "SYSTEM"]),
  equipment: z.enum(["DOCUMENT", "USER", "AI", "SYSTEM"]),
  subcontract: z.enum(["DOCUMENT", "USER", "AI", "SYSTEM"]),
  logistics: z.enum(["DOCUMENT", "USER", "AI", "SYSTEM"]),
  other: z.enum(["DOCUMENT", "USER", "AI", "SYSTEM"]),
});

export const estimateLineSchema = z.object({
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
  provenance: z.enum(["DOCUMENT", "USER", "AI", "SYSTEM"]),
  status: z.enum(["AI_GENERATED", "USER_VERIFIED", "USER_MODIFIED"]),
  explanation: z.string().max(2000),
  origins: originsSchema,
});

export const workPackageSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(20),
  sortOrder: z.number().int().nonnegative(),
  tasks: z.array(z.object({
    id: z.string().min(1).max(80),
    name: z.string().trim().min(1).max(160),
    description: z.string().max(1000),
    sortOrder: z.number().int().nonnegative(),
  })),
});

export const laborSchema = z.object({
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

export const materialSchema = z.object({
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

export const equipmentSchema = z.object({
  id: z.string().min(1).max(80),
  estimateLineId: z.string().nullable(),
  name: z.string().trim().min(1).max(160),
  quantity: z.number().finite().nonnegative(),
  duration: z.number().finite().nonnegative(),
  durationUnit: z.string().trim().min(1).max(40),
  rateCents: z.number().int().nonnegative(),
  transportCents: z.number().int().nonnegative(),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(160),
  contact: z.string().trim().max(160),
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

export const quoteSchema = z.object({
  id: z.string().min(1).max(80),
  supplierId: z.string().min(1),
  workPackageId: z.string().nullable(),
  priceCents: z.number().int().nonnegative().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  leadTime: z.string().max(120),
  included: z.string().max(500),
  excluded: z.string().max(500),
  documentName: z.string().max(200).nullable(),
  status: z.enum(["REQUESTED", "RECEIVED", "TO_VERIFY", "VALIDATED"]),
});

export const subcontractorSchema = quoteSchema.extend({
  estimateLineId: z.string().nullable(),
  name: z.string().trim().min(2).max(160),
  contact: z.string().max(160),
  category: z.string().max(80),
  description: z.string().max(1000),
});

export const riskSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().trim().min(3).max(180),
  probability: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  impact: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  potentialCostCents: z.number().int().nonnegative().nullable(),
  mitigation: z.string().max(1000),
  owner: z.string().max(120),
  status: z.enum(["OPEN", "ACCEPTED", "RESOLVED", "IGNORED", "REJECTED"]),
  justification: z.string().max(2000),
  page: z.string().nullable(),
  section: z.string().nullable(),
  provenance: z.enum(["DOCUMENT", "USER", "AI", "SYSTEM"]),
});

export const assumptionSchema = z.object({
  id: z.string().min(1).max(80),
  description: z.string().trim().min(3).max(500),
  sourceLabel: z.string().max(240),
  page: z.string().nullable(),
  section: z.string().nullable(),
  potentialImpact: z.string().max(500),
  status: z.enum(["OPEN", "ACCEPTED", "RESOLVED", "IGNORED", "REJECTED"]),
  provenance: z.enum(["DOCUMENT", "USER", "AI", "SYSTEM"]),
});

export const missingSchema = z.object({
  id: z.string().min(1).max(80),
  description: z.string().trim().min(3).max(300),
  importance: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  sourceLabel: z.string().max(300),
  page: z.string().nullable(),
  section: z.string().nullable(),
  requiredAction: z.string().max(400),
  status: z.enum(["OPEN", "ACCEPTED", "RESOLVED", "IGNORED", "REJECTED"]),
  note: z.string().max(1000),
});

const provenanceSchema = z.enum(["DOCUMENT", "USER", "AI", "SYSTEM"]);

export const workOrderSchema = z.object({
  id: z.string().min(1).max(80),
  number: z.string().trim().min(1).max(20),
  workPackageId: z.string().nullable(),
  taskId: z.string().nullable(),
  code: z.string().max(20),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(2000),
  trade: z.string().trim().max(120),
  assignee: z.string().trim().max(160),
  status: z.enum(["TO_PLAN", "PLANNED", "IN_PROGRESS", "DONE", "BLOCKED"]),
  plannedStart: dateSchema,
  plannedEnd: dateSchema,
  actualStart: dateSchema,
  actualEnd: dateSchema,
  datesProvenance: provenanceSchema,
  plannedHours: z.number().finite().nonnegative().nullable(),
  actualHours: z.number().finite().nonnegative().nullable(),
  quantity: z.number().finite().nonnegative().nullable(),
  unit: z.string().max(40).nullable(),
  progressPct: z.number().min(0).max(100),
  dependsOn: z.array(z.string().max(80)).max(50),
  blockers: z.array(z.string().max(80)).max(50),
  page: z.string().max(20).nullable(),
  section: z.string().max(120).nullable(),
  excerpt: z.string().max(2000).nullable(),
  provenance: provenanceSchema,
  createdAt: z.string().max(40),
  updatedAt: z.string().max(40),
}).refine((order) => !order.plannedStart || !order.plannedEnd || order.plannedStart <= order.plannedEnd, {
  message: "La fin prévue précède le début prévu.",
  path: ["plannedEnd"],
}).refine((order) => !order.actualStart || !order.actualEnd || order.actualStart <= order.actualEnd, {
  message: "La fin réelle précède le début réel.",
  path: ["actualEnd"],
});

export const milestoneSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().trim().min(1).max(200),
  date: dateSchema,
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  kind: z.enum(["DEADLINE", "MILESTONE", "DURATION", "PERIOD"]),
  toConfirm: z.boolean(),
  page: z.string().max(20).nullable(),
  section: z.string().max(120).nullable(),
  excerpt: z.string().max(2000).nullable(),
  provenance: provenanceSchema,
});

const perUnit = z.number().nonnegative().max(1_000_000_000).nullable();

export const unitCostSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(2, "Nommez chaque ouvrage de la bibliothèque.").max(120),
  keywords: z.array(z.string().trim().min(2).max(60)).max(20),
  unit: z.string().trim().min(1, "Indiquez l'unité de chaque ouvrage.").max(20),
  trade: z.string().trim().max(80),
  hoursPerUnit: perUnit,
  materialsCentsPerUnit: perUnit,
  equipmentCentsPerUnit: perUnit,
  subcontractCentsPerUnit: perUnit,
});

export const settingsSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  contingencyPct: z.number().min(0).max(100),
  overheadPct: z.number().min(0).max(100),
  marginPct: z.number().min(0).max(100),
  overtimeFactor: z.number().min(1).max(3),
  defaultLearningMode: z.boolean(),
  notifications: z.object({
    missingInfo: z.boolean(),
    risks: z.boolean(),
    supplierQuotes: z.boolean(),
  }),
  laborRates: z.array(z.object({
    trade: z.string().trim().min(2).max(80),
    hourlyRateCents: z.number().int().nonnegative(),
  })),
  unitCosts: z.array(unitCostSchema).default([]),
  market: z.object({ enabled: z.boolean(), defaultRegion: z.string().min(2).max(10) }).default({ enabled: true, defaultRegion: "CA-QC" }),
  units: z.array(z.string().trim().min(1).max(20)),
  aiModel: z.string().trim().min(2).max(80),
  completenessWeights: z.record(z.string(), z.number().positive()),
});

export const chatSchema = z.object({
  message: z.string().trim().min(2).max(2000),
});

export const reviewDecisionSchema = z.object({
  reviewId: z.string().min(1),
  status: z.enum(["ACCEPTED", "IGNORED", "MODIFIED"]),
  note: z.string().max(1000),
});

const sourcedSchema = z.object({
  text: z.string(),
  page: z.string().nullable(),
  section: z.string().nullable(),
  excerpt: z.string().nullable(),
});

export const modelAnalysisSchema = z.object({
  summary: z.string(),
  project: z.object({
    name: z.string().nullable(),
    client: z.string().nullable(),
    vessel: z.string().nullable(),
    deadline: z.string().nullable(),
  }),
  scope: z.array(sourcedSchema),
  requirements: z.array(sourcedSchema),
  workPackages: z.array(z.object({
    name: z.string(),
    tasks: z.array(z.string()),
    page: z.string().nullable(),
    section: z.string().nullable(),
    excerpt: z.string().nullable(),
  })),
  quantities: z.array(sourcedSchema),
  deadlines: z.array(sourcedSchema),
  requiredDocuments: z.array(z.object({
    name: z.string(),
    page: z.string().nullable(),
    section: z.string().nullable(),
    excerpt: z.string().nullable(),
  })),
  constraints: z.array(sourcedSchema),
  risks: z.array(z.object({
    title: z.string(),
    probability: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    impact: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    justification: z.string(),
    page: z.string().nullable(),
    section: z.string().nullable(),
  })),
  assumptions: z.array(z.object({
    description: z.string(),
    impact: z.string(),
  })),
  missingInformation: z.array(z.object({
    description: z.string(),
    importance: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    excerpt: z.string().nullable(),
    page: z.string().nullable(),
    section: z.string().nullable(),
    action: z.string(),
  })),
});
