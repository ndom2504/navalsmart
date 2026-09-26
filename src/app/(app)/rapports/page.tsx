import { ReportsBoard, type ReportRow } from "@/components/reports/reports-board";
import { financialSummary } from "@/domain/calculations";
import { formatCompactMoney, formatDateTime } from "@/lib/format";
import { readDatabase } from "@/server/store";
import type { Project } from "@/domain/types";

export const metadata = { title: "Rapports" };

function reportStatus(project: Project): ReportRow["status"] {
  if (project.status === "VALIDATED" || project.status === "SUBMITTED") return "Finalisé";
  if (project.status === "DRAFT" && project.lines.length === 0) return "Planifié";
  return "En cours";
}

export default async function ReportsPage() {
  const database = await readDatabase();
  const rows: ReportRow[] = database.projects.flatMap((project) => {
    const summary = financialSummary(project);
    const shared = {
      projectId: project.id,
      projectName: project.name,
      client: project.client,
      vessel: project.vessel,
      reference: `NS-${project.updatedAt.slice(0, 4)}-${project.id.slice(-4).toUpperCase()}`,
      dateLabel: formatDateTime(project.updatedAt),
      monthKey: project.updatedAt.slice(0, 7),
      monthLabel: new Intl.DateTimeFormat("fr-CA", { month: "short", year: "numeric" }).format(new Date(project.updatedAt)),
      status: reportStatus(project),
      summary: `${formatCompactMoney(summary.estimatedCents, project.currency)} estimés · ${project.risks.length} risque${project.risks.length > 1 ? "s" : ""} · ${project.missing.filter((item) => item.status === "OPEN").length} information${project.missing.filter((item) => item.status === "OPEN").length > 1 ? "s" : ""} ouverte${project.missing.filter((item) => item.status === "OPEN").length > 1 ? "s" : ""}`,
    };
    const documents: ReportRow[] = [
      {
        ...shared,
        id: `${project.id}-estimation`,
        kind: "Estimation",
        title: `Rapport d'estimation — ${project.name}`,
        href: `/estimations/${project.id}/rapport`,
        excelHref: project.lines.length ? `/api/estimates/${project.id}/export` : null,
      },
    ];
    if (project.lines.length) {
      documents.push({
        ...shared,
        id: `${project.id}-costs`,
        kind: "Coûts",
        title: `Analyse des coûts — ${project.name}`,
        href: `/estimations/${project.id}?section=estimate`,
        excelHref: `/api/estimates/${project.id}/export`,
      });
    }
    if (project.risks.length) {
      documents.push({
        ...shared,
        id: `${project.id}-risks`,
        kind: "Risques",
        title: `Analyse des risques — ${project.name}`,
        href: `/estimations/${project.id}?section=risks`,
        excelHref: null,
      });
    }
    return documents;
  });

  return <ReportsBoard rows={rows} />;
}
