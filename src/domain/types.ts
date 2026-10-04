import type { TenderAnalysis } from "@/lib/validation/tender-analysis.schema";

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

/** Ouvrage de la bibliothèque : coûts par unité saisis par l'utilisateur, appliqués aux quantités du document. */
export interface UnitCost {
  id: string;
  name: string;
  /** Mots qui rattachent un lot ou une tâche à cet ouvrage ; le nom sert à défaut. */
  keywords: string[];
  unit: string;
  trade: string;
  hoursPerUnit: number | null;
  materialsCentsPerUnit: number | null;
  equipmentCentsPerUnit: number | null;
  subcontractCentsPerUnit: number | null;
}

export interface MarketSettings {
  /** Pré-remplit les estimations avec le référentiel de marché quand vos propres valeurs manquent. */
  enabled: boolean;
  defaultRegion: string;
}

/** Ouvrage proposé par le modèle pour un marché, mis en cache pour les estimations suivantes. */
export interface AiMarketActivity {
  id: string;
  region: string;
  currency: string;
  name: string;
  keywords: string[];
  unit: string;
  trade: string;
  hoursPerUnit: number | null;
  materialsPerUnit: number | null;
  equipmentPerUnit: number | null;
  rationale: string;
  model: string;
  createdAt: string;
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
  unitCosts: UnitCost[];
  market: MarketSettings;
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
  /** Code du lot tel qu'écrit dans le document (ex. WP-02). */
  code?: string | null;
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
  /** Extraction complète validée par Zod : source, type de source, confiance et qualificatifs. */
  structured?: TenderAnalysis;
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

export type MilestoneKind = "DEADLINE" | "MILESTONE" | "DURATION" | "PERIOD";

export interface ProjectMilestone {
  id: string;
  label: string;
  date: string | null;
  time: string | null;
  kind: MilestoneKind;
  toConfirm: boolean;
  page: string | null;
  section: string | null;
  excerpt: string | null;
  provenance: Provenance;
}

export type WorkOrderStatus = "TO_PLAN" | "PLANNED" | "IN_PROGRESS" | "DONE" | "BLOCKED";

export interface WorkOrder {
  id: string;
  /** Numéro lisible, ex. OT-001. */
  number: string;
  workPackageId: string | null;
  taskId: string | null;
  code: string;
  title: string;
  description: string;
  trade: string;
  assignee: string;
  status: WorkOrderStatus;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  /** AI = dates proposées par répartition, à valider ; USER = saisies. */
  datesProvenance: Provenance;
  /** Heures reprises des lignes d'estimation ; jamais inventées. */
  plannedHours: number | null;
  actualHours: number | null;
  quantity: number | null;
  unit: string | null;
  progressPct: number;
  /** Identifiants des ordres de travail préalables. */
  dependsOn: string[];
  /** Identifiants des informations manquantes qui bloquent l'ordre. */
  blockers: string[];
  page: string | null;
  section: string | null;
  excerpt: string | null;
  provenance: Provenance;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectAvatar {
  storedPath: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  updatedAt: string;
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
  /** Marché de référence choisi ; à défaut, déduit du lieu puis de la devise. */
  marketRegion?: string | null;
  /** Image du projet, servie par /api/estimates/[id]/avatar. */
  avatar?: ProjectAvatar | null;
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
  milestones: ProjectMilestone[];
  workOrders: WorkOrder[];
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
  aiMarketActivities?: AiMarketActivity[];
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
