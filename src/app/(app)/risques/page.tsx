import { RisksBoard, type RiskRow } from "@/components/risks/risks-board";
import { formatMoney } from "@/lib/format";
import { provenanceLabels, recordStatusLabels, riskLevelLabels } from "@/lib/labels";
import { readDatabase } from "@/server/store";

export const metadata = { title: "Risques" };

export default async function RisksPage() {
  const database = await readDatabase();
  const rows: RiskRow[] = database.projects.flatMap((project) =>
    project.risks.map((risk) => ({
      id: risk.id,
      projectId: project.id,
      projectName: project.name,
      vessel: project.vessel,
      title: risk.title,
      justification: risk.justification || "Aucune justification.",
      mitigation: risk.mitigation || "Mitigation non précisée.",
      owner: risk.owner || "Non assigné",
      level: risk.level,
      levelLabel: riskLevelLabels[risk.level],
      probabilityLabel: riskLevelLabels[risk.probability],
      impactLabel: riskLevelLabels[risk.impact],
      status: risk.status,
      statusLabel: recordStatusLabels[risk.status],
      costLabel: risk.potentialCostCents == null ? "Non chiffré" : formatMoney(risk.potentialCostCents, project.currency),
      source: [risk.page ? `Page ${risk.page}` : null, risk.section ? `Section ${risk.section}` : null].filter(Boolean).join(" · ") || "Source non citée",
      provenanceLabel: provenanceLabels[risk.provenance],
    })),
  );

  return <RisksBoard rows={rows} />;
}
