import { z } from "zod";
import { riskLevelSchema } from "@/lib/validation/common";

export const sourceTypeSchema = z.enum(["SOURCE_DOCUMENT", "USER_DATA", "AI_DATA", "SYSTEM_CALCULATION"]);
export const confidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export const quantityQualifierSchema = z.enum(["EXACT", "APPROXIMATE", "MINIMUM", "MAXIMUM", "TOLERANCE", "INDICATIVE", "TO_CONFIRM"]);
export const scheduleKindSchema = z.enum(["DEADLINE", "MILESTONE", "DURATION", "PERIOD"]);
export const missingKindSchema = z.enum(["MISSING_INFORMATION", "DEPENDENCY"]);

const PLACEHOLDER = /^(non spécifié|non précisé|non indiqué|non renseigné|information absente|n\/a|inconnu|aucun|null|-)(\s+dans le document)?\.?$/i;

/** Texte facultatif : une chaîne vide ou un marqueur d'absence devient null. */
const optionalText = (max: number) =>
  z.union([z.string(), z.null()]).optional().transform((value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed || PLACEHOLDER.test(trimmed)) return null;
    return trimmed.slice(0, max);
  });

/** Texte obligatoire : un marqueur d'absence n'est pas une donnée. */
const requiredText = (max: number) =>
  z.string().trim().min(1).max(max).refine((value) => !PLACEHOLDER.test(value), "Marqueur d'absence au lieu d'une donnée : utiliser null ou [].");

const pageSchema = z.preprocess((value) => {
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  return value;
}, z.number().int().positive().nullable().optional().transform((value) => value ?? null));

const numberSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const cleaned = value.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : value;
}, z.number().finite());

export const sourceRefSchema = z.object({
  page: pageSchema,
  section: optionalText(80),
  excerpt: optionalText(1500),
}).default({ page: null, section: null, excerpt: null });

const traced = {
  source: sourceRefSchema,
  sourceType: sourceTypeSchema.default("SOURCE_DOCUMENT"),
  confidence: confidenceSchema.default("MEDIUM"),
};

const isoDate = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional().transform((value) => value ?? null);

export const textFactSchema = z.object({ value: requiredText(200), ...traced });

const deadlineFactSchema = z.object({
  value: isoDate,
  time: z.union([z.string().regex(/^\d{2}:\d{2}$/), z.null()]).optional().transform((value) => value ?? null),
  text: requiredText(200),
  ...traced,
});

const currencyFactSchema = z.object({ value: z.string().trim().regex(/^[A-Z]{3}$/), ...traced });
const validityFactSchema = z.object({ value: numberSchema.pipe(z.number().int().positive().max(3650)), ...traced });

export const workPackageItemSchema = z.object({
  code: optionalText(20),
  title: requiredText(200),
  description: optionalText(1500),
  tasks: z.array(z.string().trim().min(1).max(300)).default([]),
  ...traced,
});

export const quantityItemSchema = z.object({
  label: requiredText(200),
  value: numberSchema.pipe(z.number().nonnegative()),
  unit: requiredText(40),
  qualifiers: z.array(quantityQualifierSchema).default([]),
  qualifierText: optionalText(120),
  tolerancePct: numberSchema.pipe(z.number().nonnegative().max(1000)).nullable().optional().transform((value) => value ?? null),
  workPackageCode: optionalText(20),
  toConfirm: z.boolean().default(false),
  ...traced,
});

export const requirementItemSchema = z.object({ text: requiredText(1500), category: optionalText(120), ...traced });

export const scheduleItemSchema = z.object({
  label: requiredText(200),
  date: isoDate,
  time: z.union([z.string().regex(/^\d{2}:\d{2}$/), z.null()]).optional().transform((value) => value ?? null),
  text: requiredText(200),
  kind: scheduleKindSchema.default("MILESTONE"),
  toConfirm: z.boolean().default(false),
  ...traced,
});

export const requiredDocumentItemSchema = z.object({ name: requiredText(300), ...traced });

export const constraintItemSchema = z.object({ text: requiredText(1500), ...traced });

/** Aucun champ monétaire : les montants restent l'affaire du moteur de calcul. */
export const riskItemSchema = z.object({
  title: requiredText(200),
  description: optionalText(1000),
  probability: riskLevelSchema,
  impact: riskLevelSchema,
  level: riskLevelSchema,
  mitigation: optionalText(600),
  source: sourceRefSchema,
  sourceType: z.enum(["SOURCE_DOCUMENT", "AI_DATA"]).default("AI_DATA"),
  confidence: confidenceSchema.default("MEDIUM"),
});

export const missingItemSchema = z.object({
  description: requiredText(1000),
  kind: missingKindSchema.default("MISSING_INFORMATION"),
  importance: riskLevelSchema.default("MEDIUM"),
  action: optionalText(400),
  trigger: optionalText(80),
  ...traced,
});

export const assumptionItemSchema = z.object({ description: requiredText(1000), impact: optionalText(500), ...traced });

export const questionItemSchema = z.object({
  question: requiredText(600),
  reason: optionalText(400),
  ...traced,
  sourceType: sourceTypeSchema.default("AI_DATA"),
});

export const LIST_KEYS = [
  "workPackages",
  "quantities",
  "requirements",
  "schedule",
  "requiredDocuments",
  "constraints",
  "risks",
  "missingInformation",
  "assumptions",
  "questionsForClient",
] as const;

export type ListKey = (typeof LIST_KEYS)[number];

export const tenderAnalysisSchema = z.object({
  project: z.object({
    name: textFactSchema.nullable(),
    reference: textFactSchema.nullable(),
    client: textFactSchema.nullable(),
    vessel: textFactSchema.nullable(),
    location: textFactSchema.nullable().default(null),
  }),
  submission: z.object({
    deadline: deadlineFactSchema.nullable(),
    currency: currencyFactSchema.nullable(),
    validityDays: validityFactSchema.nullable(),
  }),
  workPackages: z.array(workPackageItemSchema),
  quantities: z.array(quantityItemSchema),
  requirements: z.array(requirementItemSchema),
  schedule: z.array(scheduleItemSchema),
  requiredDocuments: z.array(requiredDocumentItemSchema),
  constraints: z.array(constraintItemSchema),
  risks: z.array(riskItemSchema),
  missingInformation: z.array(missingItemSchema),
  assumptions: z.array(assumptionItemSchema),
  questionsForClient: z.array(questionItemSchema),
});

export type TenderAnalysis = z.infer<typeof tenderAnalysisSchema>;
export type SourceType = z.infer<typeof sourceTypeSchema>;
export type Confidence = z.infer<typeof confidenceSchema>;
export type QuantityQualifier = z.infer<typeof quantityQualifierSchema>;
export type SourceRef = z.infer<typeof sourceRefSchema>;
export type WorkPackageItem = z.infer<typeof workPackageItemSchema>;
export type QuantityItem = z.infer<typeof quantityItemSchema>;
export type ScheduleItem = z.infer<typeof scheduleItemSchema>;
export type RiskItem = z.infer<typeof riskItemSchema>;
export type MissingItem = z.infer<typeof missingItemSchema>;
export type QuestionItem = z.infer<typeof questionItemSchema>;
export type TextFact = z.infer<typeof textFactSchema>;

const itemSchemas = {
  workPackages: workPackageItemSchema,
  quantities: quantityItemSchema,
  requirements: requirementItemSchema,
  schedule: scheduleItemSchema,
  requiredDocuments: requiredDocumentItemSchema,
  constraints: constraintItemSchema,
  risks: riskItemSchema,
  missingInformation: missingItemSchema,
  assumptions: assumptionItemSchema,
  questionsForClient: questionItemSchema,
} satisfies Record<ListKey, z.ZodType>;

export interface TenderAnalysisReport {
  /** Erreurs Zod, élément par élément, pour le journal de débogage. */
  issues: string[];
  received: Record<ListKey, number>;
  accepted: Record<ListKey, number>;
}

function issueText(prefix: string, error: z.ZodError): string {
  return error.issues.map((issue) => `${prefix}${issue.path.length ? `.${issue.path.join(".")}` : ""}: ${issue.message}`).join(" ; ");
}

function parseFact<T>(schema: z.ZodType<T>, value: unknown, path: string, issues: string[]): T | null {
  if (value === null || value === undefined) return null;
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  issues.push(issueText(path, parsed.error));
  return null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/**
 * Valide toute la réponse du modèle. Un élément invalide est écarté et consigné,
 * jamais corrigé en silence. Le résultat est repassé dans le schéma complet.
 */
export function parseTenderAnalysis(input: unknown): { data: TenderAnalysis; report: TenderAnalysisReport } | { error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "La réponse n'est pas un objet JSON." };
  const raw = input as Record<string, unknown>;
  const issues: string[] = [];
  const project = record(raw.project);
  const submission = record(raw.submission);
  const received = {} as Record<ListKey, number>;
  const accepted = {} as Record<ListKey, number>;
  const lists = {} as Record<ListKey, unknown[]>;

  for (const key of LIST_KEYS) {
    const items = Array.isArray(raw[key]) ? raw[key] as unknown[] : [];
    received[key] = items.length;
    lists[key] = items.flatMap((item, index) => {
      const parsed = itemSchemas[key].safeParse(item);
      if (parsed.success) return [parsed.data];
      issues.push(issueText(`${key}[${index}]`, parsed.error));
      return [];
    });
    accepted[key] = lists[key].length;
  }

  const candidate = {
    project: {
      name: parseFact(textFactSchema, project.name, "project.name", issues),
      reference: parseFact(textFactSchema, project.reference, "project.reference", issues),
      client: parseFact(textFactSchema, project.client, "project.client", issues),
      vessel: parseFact(textFactSchema, project.vessel, "project.vessel", issues),
      location: parseFact(textFactSchema, project.location, "project.location", issues),
    },
    submission: {
      deadline: parseFact(deadlineFactSchema, submission.deadline, "submission.deadline", issues),
      currency: parseFact(currencyFactSchema, submission.currency, "submission.currency", issues),
      validityDays: parseFact(validityFactSchema, submission.validityDays, "submission.validityDays", issues),
    },
    ...lists,
  };
  const parsed = tenderAnalysisSchema.safeParse(candidate);
  if (!parsed.success) return { error: issueText("analyse", parsed.error) };
  return { data: parsed.data, report: { issues, received, accepted } };
}

export function emptyTenderAnalysis(): TenderAnalysis {
  return {
    project: { name: null, reference: null, client: null, vessel: null, location: null },
    submission: { deadline: null, currency: null, validityDays: null },
    workPackages: [],
    quantities: [],
    requirements: [],
    schedule: [],
    requiredDocuments: [],
    constraints: [],
    risks: [],
    missingInformation: [],
    assumptions: [],
    questionsForClient: [],
  };
}
