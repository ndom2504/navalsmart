import { equipmentCostCents, financialSummary, laborCostCents, materialCostCents, subcontractorCostCents } from "@/domain/calculations";
import type { EstimateLine } from "@/domain/types";
import { CostsBoard, type CostLine, type CostProject } from "@/components/costs/costs-board";
import { formatDate } from "@/lib/format";
import { projectStatusLabels } from "@/lib/labels";
import { readDatabase } from "@/server/store";

export const metadata = { title: "Coûts" };

function lineStatus(line: EstimateLine | undefined): CostLine["status"] {
  if (!line) return "Calculé";
  if (line.status === "USER_VERIFIED") return "Validé";
  if (line.status === "USER_MODIFIED") return "En cours";
  return "À valider";
}

export default async function CostsPage() {
  const database = await readDatabase();
  const projects: CostProject[] = database.projects
    .map((project) => {
      const summary = financialSummary(project);
      const lines: CostLine[] = [
        ...project.labor.map((item) => {
          const estimateLine = project.lines.find((line) => line.id === item.estimateLineId);
          return {
            id: item.id,
            category: "Main-d'œuvre" as const,
            description: item.trade || item.category,
            quantity: item.hours,
            unit: "heures",
            unitCents: item.hourlyRateCents,
            totalCents: laborCostCents(item),
            source: estimateLine?.sourceLabel || "Calcul système",
            status: lineStatus(estimateLine),
          };
        }),
        ...project.materials.map((item) => {
          const estimateLine = project.lines.find((line) => line.id === item.estimateLineId);
          return {
            id: item.id,
            category: "Matériaux" as const,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitCents: item.unitPriceCents,
            totalCents: materialCostCents(item),
            source: estimateLine?.sourceLabel || "Calcul système",
            status: lineStatus(estimateLine),
          };
        }),
        ...project.equipment.map((item) => {
          const estimateLine = project.lines.find((line) => line.id === item.estimateLineId);
          return {
            id: item.id,
            category: "Équipements" as const,
            description: item.name,
            quantity: item.quantity,
            unit: item.durationUnit,
            unitCents: item.rateCents,
            totalCents: equipmentCostCents(item),
            source: estimateLine?.sourceLabel || "Calcul système",
            status: lineStatus(estimateLine),
          };
        }),
        ...project.subcontractors.map((item) => ({
          id: item.id,
          category: "Sous-traitants" as const,
          description: item.name,
          quantity: 1,
          unit: "forfait",
          unitCents: item.priceCents ?? 0,
          totalCents: subcontractorCostCents(item),
          source: item.documentName || "Calcul système",
          status: item.status === "VALIDATED" ? "Validé" as const : "En cours" as const,
        })),
        {
          id: `${project.id}-indirect`,
          category: "Indirects" as const,
          description: `Frais indirects ${project.overheadPct} %`,
          quantity: 1,
          unit: "forfait",
          unitCents: summary.indirectCents,
          totalCents: summary.indirectCents,
          source: "Paramètres",
          status: "Calculé" as const,
        },
        {
          id: `${project.id}-risk`,
          category: "Contingence" as const,
          description: `Provision ${project.contingencyPct} %`,
          quantity: 1,
          unit: "forfait",
          unitCents: summary.riskAllowanceCents,
          totalCents: summary.riskAllowanceCents,
          source: "Paramètres",
          status: "Calculé" as const,
        },
        {
          id: `${project.id}-margin`,
          category: "Marge" as const,
          description: `Marge ${project.marginPct} %`,
          quantity: 1,
          unit: "forfait",
          unitCents: summary.bidCents - summary.estimatedCents,
          totalCents: summary.bidCents - summary.estimatedCents,
          source: "Paramètres",
          status: "Calculé" as const,
        },
      ];
      return {
        id: project.id,
        name: project.name,
        client: project.client,
        vessel: project.vessel,
        dateLabel: formatDate(project.receivedAt ?? project.updatedAt),
        statusLabel: projectStatusLabels[project.status],
        currency: project.currency,
        directCents: summary.directCents,
        indirectCents: summary.indirectCents,
        contingencyCents: summary.riskAllowanceCents,
        marginCents: summary.bidCents - summary.estimatedCents,
        estimatedCents: summary.estimatedCents,
        overheadPct: project.overheadPct,
        contingencyPct: project.contingencyPct,
        marginPct: project.marginPct,
        lines,
      };
    })
    .sort((a, b) => b.estimatedCents - a.estimatedCents);

  return <CostsBoard projects={projects} />;
}
