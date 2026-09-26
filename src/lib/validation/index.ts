import type { AIAnalysis } from "@/lib/validation/ai-analysis.schema";
import { aiAnalysisSchema } from "@/lib/validation/ai-analysis.schema";
import type { EstimateInput } from "@/lib/validation/estimate.schema";
import { estimateSchema } from "@/lib/validation/estimate.schema";
import type { MissingInformationInput } from "@/lib/validation/missing-information.schema";
import { missingInformationSchema } from "@/lib/validation/missing-information.schema";
import { parseWith, type ParseResult } from "@/lib/validation/result";
import type { RiskInput } from "@/lib/validation/risk.schema";
import { riskSchema } from "@/lib/validation/risk.schema";
import type { TenderInput } from "@/lib/validation/tender.schema";
import { tenderSchema } from "@/lib/validation/tender.schema";

export { aiAnalysisSchema } from "@/lib/validation/ai-analysis.schema";
export { assumptionSchema } from "@/lib/validation/assumption.schema";
export { aiReviewSchema } from "@/lib/validation/ai-review.schema";
export { equipmentCostSchema } from "@/lib/validation/equipment-cost.schema";
export { estimateSchema } from "@/lib/validation/estimate.schema";
export { laborCostSchema } from "@/lib/validation/labor-cost.schema";
export { materialCostSchema } from "@/lib/validation/material-cost.schema";
export { missingInformationSchema } from "@/lib/validation/missing-information.schema";
export { riskSchema } from "@/lib/validation/risk.schema";
export { supplierQuoteSchema, supplierSchema } from "@/lib/validation/supplier.schema";
export { tenderDocumentSchema, tenderSchema } from "@/lib/validation/tender.schema";
export { workPackageSchema } from "@/lib/validation/work-package.schema";
export type { ParseResult } from "@/lib/validation/result";

export function parseAIAnalysis(input: unknown): ParseResult<AIAnalysis> {
  return parseWith(aiAnalysisSchema, input);
}

export function parseEstimate(input: unknown): ParseResult<EstimateInput> {
  return parseWith(estimateSchema, input);
}

export function parseTender(input: unknown): ParseResult<TenderInput> {
  return parseWith(tenderSchema, input);
}

export function parseRisk(input: unknown): ParseResult<RiskInput> {
  return parseWith(riskSchema, input);
}

export function parseMissingInformation(input: unknown): ParseResult<MissingInformationInput> {
  return parseWith(missingInformationSchema, input);
}
