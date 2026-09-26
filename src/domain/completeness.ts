import { financialSummary } from "@/domain/calculations";
import type { CompletenessCriterion, CompletenessKey, CompletenessScore, Project } from "@/domain/types";

const LABELS: Record<CompletenessKey, string> = {
  scope: "Portée analysée",
  packages: "Lots créés",
  quantities: "Quantités",
  labor: "Main-d'œuvre",
  materials: "Matériaux",
  suppliers: "Fournisseurs",
  subcontractors: "Sous-traitants",
  risks: "Risques",
  assumptions: "Hypothèses",
  missing: "Informations manquantes",
  documents: "Documents requis",
};

function ratioOf(met: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, met / total);
}

export function completenessScore(project: Project, weights: Record<string, number>): CompletenessScore {
  const summary = financialSummary(project);
  const lines = project.lines;
  const criteria: CompletenessCriterion[] = [
    {
      key: "scope",
      label: LABELS.scope,
      ratio: project.analysis && project.analysis.scope.length > 0 ? 1 : project.analysis ? 0.4 : 0,
      detail: project.analysis ? "Une analyse est enregistrée." : "Aucune analyse d'appel d'offres.",
    },
    {
      key: "packages",
      label: LABELS.packages,
      ratio: project.workPackages.length > 0 ? 1 : 0,
      detail: `${project.workPackages.length} lot(s).`,
    },
    {
      key: "quantities",
      label: LABELS.quantities,
      ratio: ratioOf(lines.filter((line) => line.quantity > 0).length, lines.length),
      detail: lines.length ? "Part des lignes avec une quantité." : "Aucune ligne d'estimation.",
    },
    {
      key: "labor",
      label: LABELS.labor,
      ratio: summary.laborCents > 0 ? 1 : 0,
      detail: summary.laborCents > 0 ? "Des heures sont chiffrées." : "Aucune main-d'œuvre chiffrée.",
    },
    {
      key: "materials",
      label: LABELS.materials,
      ratio: summary.materialsCents > 0 || project.materials.length > 0 ? 1 : 0,
      detail: project.materials.length ? `${project.materials.length} matériau(x).` : "Aucun matériau.",
    },
    {
      key: "suppliers",
      label: LABELS.suppliers,
      ratio: project.quotes.length > 0 ? 1 : 0,
      detail: `${project.quotes.length} soumission(s) fournisseur.`,
    },
    {
      key: "subcontractors",
      label: LABELS.subcontractors,
      ratio: project.subcontractors.length > 0 ? 1 : 0,
      detail: `${project.subcontractors.length} sous-traitant(s).`,
    },
    {
      key: "risks",
      label: LABELS.risks,
      ratio: project.risks.length > 0 ? 1 : 0,
      detail: `${project.risks.length} risque(s).`,
    },
    {
      key: "assumptions",
      label: LABELS.assumptions,
      ratio: project.assumptions.length > 0 ? 1 : 0,
      detail: `${project.assumptions.length} hypothèse(s).`,
    },
    {
      key: "missing",
      label: LABELS.missing,
      ratio: project.missing.length
        ? ratioOf(project.missing.filter((item) => item.status === "RESOLVED" || item.status === "IGNORED").length, project.missing.length)
        : 0,
      detail: project.missing.length
        ? `${project.missing.filter((item) => item.status === "OPEN").length} élément(s) encore ouvert(s).`
        : "Aucune information manquante n'a encore été identifiée.",
    },
    {
      key: "documents",
      label: LABELS.documents,
      ratio: project.analysis?.requiredDocuments.length
        ? ratioOf(project.analysis.requiredDocuments.filter((item) => item.received).length, project.analysis.requiredDocuments.length)
        : 0,
      detail: project.analysis?.requiredDocuments.length
        ? "Part des documents requis marqués reçus."
        : "Aucun document requis identifié.",
    },
  ];

  const weightOf = (key: string) => {
    const value = weights[key];
    return typeof value === "number" && value > 0 ? value : 1;
  };
  const totalWeight = criteria.reduce((sum, item) => sum + weightOf(item.key), 0);
  const score = criteria.reduce((sum, item) => sum + weightOf(item.key) * item.ratio, 0);
  const percent = totalWeight === 0 ? 0 : Math.round((score / totalWeight) * 100);

  return {
    percent,
    criteria,
    notice: "Indicateur interne de suivi. Ce score ne garantit pas la qualité de l'estimation.",
  };
}
