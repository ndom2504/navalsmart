import { TendersBoard, type TenderRow } from "@/components/tenders/tenders-board";
import { formatBytes, formatDate } from "@/lib/format";
import { projectTypeLabels } from "@/lib/labels";
import { readDatabase } from "@/server/store";

export const metadata = { title: "Appels d'offres" };

function shortDate(value: string | null): string {
  if (!value) return "Non précisée";
  return new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function daysUntil(value: string | null, today: Date): number | null {
  if (!value) return null;
  const target = new Date(`${value.slice(0, 10)}T12:00:00`);
  const start = new Date(today);
  start.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

export default async function TendersPage() {
  const database = await readDatabase();
  const today = new Date();
  const month = today.toISOString().slice(0, 7);
  const rows: TenderRow[] = [...database.projects]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((project) => {
      const daysLeft = daysUntil(project.submissionDeadline, today);
      const status: TenderRow["status"] =
        project.status === "VALIDATED" || project.status === "SUBMITTED" ? "Archivé"
          : project.status === "TO_VALIDATE" ? "Estimé"
            : project.status === "DRAFT" && !project.tender?.documents.length ? "Nouveau"
              : project.analysis && project.status === "IN_ANALYSIS" ? "Analysé"
                : "En cours";
      return {
        id: project.id,
        reference: `NS-${project.createdAt.slice(0, 4)}-${project.id.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase()}`,
        name: project.name,
        client: project.client,
        vessel: project.vessel,
        type: project.type,
        typeLabel: projectTypeLabels[project.type],
        location: project.location,
        currency: project.currency,
        description: project.description,
        status,
        deadlineLabel: formatDate(project.submissionDeadline),
        daysLeft,
        analyzed: Boolean(project.analysis),
        hasEstimate: project.lines.length > 0,
        inAnalysis: project.status === "IN_ANALYSIS" || Boolean(project.tender?.documents.some((document) => document.status === "PROCESSING")),
        urgent: daysLeft != null && daysLeft >= 0 && daysLeft < 7,
        createdThisMonth: project.createdAt.startsWith(month),
        documents: (project.tender?.documents ?? []).map((document) => ({
          id: document.id,
          fileName: document.fileName,
          sizeLabel: formatBytes(document.sizeBytes),
          dateLabel: shortDate(document.importedAt),
        })),
        analysisSummary: project.analysis?.summary ?? null,
      };
    });

  return <TendersBoard rows={rows} />;
}
