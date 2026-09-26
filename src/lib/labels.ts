import type {
  DocumentStatus,
  LineStatus,
  ProjectStatus,
  ProjectType,
  Provenance,
  QuoteStatus,
  RecordStatus,
  ReviewSeverity,
  ReviewStatus,
  RiskLevel,
} from "@/domain/types";

export const projectTypeLabels: Record<ProjectType, string> = {
  CONSTRUCTION: "Construction navale",
  REPAIR: "Réparation navale",
  MAINTENANCE: "Maintenance",
  CONVERSION: "Conversion",
  MECHANICAL: "Travaux mécaniques",
  ELECTRICAL: "Travaux électriques",
  OTHER: "Autre",
};

export const projectStatusLabels: Record<ProjectStatus, string> = {
  DRAFT: "Brouillon",
  IN_ANALYSIS: "En analyse",
  IN_ESTIMATION: "En estimation",
  TO_VALIDATE: "À valider",
  VALIDATED: "Validée",
  SUBMITTED: "Soumise",
};

export const lineStatusLabels: Record<LineStatus, string> = {
  AI_GENERATED: "AI GENERATED",
  USER_VERIFIED: "USER VERIFIED",
  USER_MODIFIED: "USER MODIFIED",
};

export const provenanceLabels: Record<Provenance, string> = {
  DOCUMENT: "SOURCE DOCUMENT",
  USER: "DONNÉE UTILISATEUR",
  AI: "DONNÉE IA",
  SYSTEM: "CALCUL SYSTÈME",
};

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  REQUESTED: "Demandé",
  RECEIVED: "Reçu",
  TO_VERIFY: "À vérifier",
  VALIDATED: "Validé",
};

export const riskLevelLabels: Record<RiskLevel, string> = {
  LOW: "Faible",
  MEDIUM: "Moyen",
  HIGH: "Élevé",
  CRITICAL: "Critique",
};

export const recordStatusLabels: Record<RecordStatus, string> = {
  OPEN: "Ouvert",
  ACCEPTED: "Accepté",
  RESOLVED: "Résolu",
  IGNORED: "Ignoré",
  REJECTED: "Rejeté",
};

export const reviewSeverityLabels: Record<ReviewSeverity, string> = {
  CRITICAL: "CRITICAL",
  WARNING: "WARNING",
  INFO: "INFO",
};

export const reviewStatusLabels: Record<ReviewStatus, string> = {
  PENDING: "En attente",
  ACCEPTED: "Acceptée",
  IGNORED: "Ignorée",
  MODIFIED: "Modifiée",
};

export const documentStatusLabels: Record<DocumentStatus, string> = {
  PENDING: "En attente",
  PROCESSING: "Analyse en cours",
  COMPLETED: "Analysé",
  FAILED: "Échec",
};

export const unspecified = "Non spécifié dans le document";
