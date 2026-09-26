export type ProjectType =
  | "CONSTRUCTION"
  | "REPAIR"
  | "MAINTENANCE"
  | "CONVERSION"
  | "MECHANICAL"
  | "ELECTRICAL"
  | "OTHER";

export type ProjectStatus =
  | "DRAFT"
  | "IN_ANALYSIS"
  | "IN_ESTIMATION"
  | "TO_VALIDATE"
  | "VALIDATED"
  | "SUBMITTED";

export type LineStatus = "AI_GENERATED" | "USER_VERIFIED" | "USER_MODIFIED";

export type Provenance = "DOCUMENT" | "USER" | "AI" | "SYSTEM";

export type AnalysisEngine = "LOCAL" | "OPENAI";

export type DocumentStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export type QuoteStatus = "REQUESTED" | "RECEIVED" | "TO_VERIFY" | "VALIDATED";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RecordStatus = "OPEN" | "ACCEPTED" | "RESOLVED" | "IGNORED" | "REJECTED";

export type ReviewSeverity = "CRITICAL" | "WARNING" | "INFO";

export type ReviewStatus = "PENDING" | "ACCEPTED" | "IGNORED" | "MODIFIED";

export type MessageRole = "USER" | "ASSISTANT";

export interface CostOrigins {
  hours: Provenance;
  rate: Provenance;
  materials: Provenance;
  equipment: Provenance;
  subcontract: Provenance;
  logistics: Provenance;
  other: Provenance;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  jobTitle: string;
  companyName: string;
}

export interface LaborRate {
  trade: string;
  hourlyRateCents: number;
}

export interface AppSettings {
  currency: string;
  contingencyPct: number;
  overheadPct: number;
  marginPct: number;
  overtimeFactor: number;
  defaultLearningMode: boolean;
  notifications: {
    missingInfo: boolean;
    risks: boolean;
    supplierQuotes: boolean;
  };
  laborRates: LaborRate[];
  units: string[];
  aiModel: string;
  completenessWeights: Record<string, number>;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
}

export interface WorkPackage {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
  tasks: Task[];
}

export interface EstimateLine {
  id: string;
  workPackageId: string | null;
  taskId: string | null;
  lot: string;
  description: string;
  quantity: number;
  unit: string;
  hours: number;
  hourlyRateCents: number;
  materialsCents: number;
  equipmentCents: number;
  subcontractCents: number;
  logisticsCents: number;
  otherCents: number;
  sourceLabel: string;
  page: string | null;
  section: string | null;
  provenance: Provenance;
  status: LineStatus;
  explanation: string;
  origins: CostOrigins;
}

export interface LaborCost {
  id: string;
  taskId: string | null;
  estimateLineId: string | null;
  category: string;
  trade: string;
  workers: number;
  hours: number;
  hourlyRateCents: number;
  overtimeHours: number;
  productivityFactor: number;
  overtimeFactor: number;
}

export interface MaterialCost {
  id: string;
  estimateLineId: string | null;
  supplierId: string | null;
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  transportCents: number;
  wasteCents: number;
}

export interface EquipmentCost {
  id: string;
  estimateLineId: string | null;
  name: string;
  quantity: number;
  duration: number;
  durationUnit: string;
  rateCents: number;
  transportCents: number;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  category: string;
  description: string;
  currency: string;
}

export interface SupplierQuote {
  id: string;
  supplierId: string;
  workPackageId: string | null;
  priceCents: number | null;
  currency: string;
  validUntil: string | null;
  leadTime: string;
  included: string;
  excluded: string;
  documentName: string | null;
  status: QuoteStatus;
}

export interface Subcontractor {
  id: string;
  workPackageId: string | null;
  estimateLineId: string | null;
  name: string;
  contact: string;
  category: string;
  description: string;
  priceCents: number | null;
  currency: string;
  validUntil: string | null;
  leadTime: string;
  included: string;
  excluded: string;
  documentName: string | null;
  status: QuoteStatus;
}

export interface Risk {
  id: string;
  title: string;
  probability: RiskLevel;
  impact: RiskLevel;
  level: RiskLevel;
  potentialCostCents: number | null;
  mitigation: string;
  owner: string;
  status: RecordStatus;
  justification: string;
  page: string | null;
  section: string | null;
  provenance: Provenance;
}

export interface Assumption {
  id: string;
  description: string;
  sourceLabel: string;
  page: string | null;
  section: string | null;
  potentialImpact: string;
  status: RecordStatus;
  provenance: Provenance;
}

export interface MissingInformation {
  id: string;
  description: string;
  importance: RiskLevel;
  sourceLabel: string;
  page: string | null;
  section: string | null;
  requiredAction: string;
  status: RecordStatus;
  note: string;
}

export interface SourcedItem {
  id: string;
  text: string;
  page: string | null;
  section: string | null;
  excerpt: string | null;
  provenance: Provenance;
}

export interface DetectedWork {
  id: string;
  name: string;
  tasks: string[];
  page: string | null;
  section: string | null;
  excerpt: string | null;
}

export interface RequiredDocument {
  id: string;
  name: string;
  page: string | null;
  section: string | null;
  excerpt: string | null;
  received: boolean;
}

export interface Analysis {
  id: string;
  summary: string;
  engine: AnalysisEngine;
  disclaimer: string;
  projectHints: {
    name: string | null;
    client: string | null;
    vessel: string | null;
    deadline: string | null;
  };
  scope: SourcedItem[];
  requirements: SourcedItem[];
  detectedWork: DetectedWork[];
  quantities: SourcedItem[];
  deadlines: SourcedItem[];
  requiredDocuments: RequiredDocument[];
  constraints: SourcedItem[];
  risks: Risk[];
  assumptions: Assumption[];
  missing: MissingInformation[];
  createdAt: string;
}

export interface TenderDocument {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number | null;
  storedPath: string;
  extractedText: string;
  status: DocumentStatus;
  importedAt: string;
}

export interface Tender {
  id: string;
  title: string;
  documents: TenderDocument[];
}

export interface AIReviewItem {
  id: string;
  code: string;
  severity: ReviewSeverity;
  title: string;
  detail: string;
  status: ReviewStatus;
  note: string;
  createdAt: string;
}

export interface AIMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface EstimateRevision {
  id: string;
  label: string;
  snapshot: FinancialSummary;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  entity: string;
  summary: string;
  source: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  vessel: string;
  type: ProjectType;
  location: string;
  receivedAt: string | null;
  submissionDeadline: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  currency: string;
  description: string;
  status: ProjectStatus;
  learningMode: boolean;
  contingencyPct: number;
  overheadPct: number;
  marginPct: number;
  overtimeFactor: number;
  validationNote: string;
  tender: Tender | null;
  analysis: Analysis | null;
  workPackages: WorkPackage[];
  lines: EstimateLine[];
  labor: LaborCost[];
  materials: MaterialCost[];
  equipment: EquipmentCost[];
  quotes: SupplierQuote[];
  subcontractors: Subcontractor[];
  risks: Risk[];
  assumptions: Assumption[];
  missing: MissingInformation[];
  reviews: AIReviewItem[];
  messages: AIMessage[];
  revisions: EstimateRevision[];
  audit: AuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export type WorkspaceMode = "demo" | "real";

export interface Database {
  user: UserProfile;
  settings: AppSettings;
  suppliers: Supplier[];
  projects: Project[];
  /** Mode actif, posé à la lecture. Il n'est pas enregistré dans chaque espace. */
  workspaceMode?: WorkspaceMode;
}

export interface CostBucket {
  laborCents: number;
  materialsCents: number;
  equipmentCents: number;
  subcontractCents: number;
  logisticsCents: number;
  otherCents: number;
  directCents: number;
  indirectCents: number;
  riskAllowanceCents: number;
  estimatedCents: number;
  bidCents: number;
}

export interface ResolvedLine extends CostBucket {
  id: string;
  laborFormula: string;
  materialsFormula: string;
  equipmentFormula: string;
}

export interface FinancialSummary extends CostBucket {
  currency: string;
  contingencyPct: number;
  overheadPct: number;
  marginPct: number;
  lines: ResolvedLine[];
}

export const COMPLETENESS_KEYS = [
  "scope",
  "packages",
  "quantities",
  "labor",
  "materials",
  "suppliers",
  "subcontractors",
  "risks",
  "assumptions",
  "missing",
  "documents",
] as const;

export type CompletenessKey = (typeof COMPLETENESS_KEYS)[number];

export interface CompletenessCriterion {
  key: CompletenessKey;
  label: string;
  ratio: number;
  detail: string;
}

export interface CompletenessScore {
  percent: number;
  criteria: CompletenessCriterion[];
  notice: string;
}
