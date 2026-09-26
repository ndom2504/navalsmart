import { financialSummary } from "@/domain/calculations";
import type { Project } from "@/domain/types";
import { ActionLink } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney } from "@/lib/format";
import { projectStatusLabels } from "@/lib/labels";

const tones = {
  DRAFT: "steel",
  IN_ANALYSIS: "technical",
  IN_ESTIMATION: "cyan",
  TO_VALIDATE: "warning",
  VALIDATED: "success",
  SUBMITTED: "success",
} as const;

export function ProjectTable({ projects }: { projects: Project[] }) {
  if (!projects.length) {
    return <p className="text-sm text-steel">Aucune estimation pour le moment.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-steel">
          <tr>
            <th className="px-3 py-3 font-medium">Projet</th>
            <th className="px-3 py-3 font-medium">Client</th>
            <th className="px-3 py-3 font-medium">Navire</th>
            <th className="px-3 py-3 font-medium">Statut</th>
            <th className="px-3 py-3 font-medium">Coût estimé</th>
            <th className="px-3 py-3 font-medium">Dernière modification</th>
            <th className="px-3 py-3 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const summary = financialSummary(project);
            return (
              <tr key={project.id} className="border-b border-line last:border-0">
                <td className="px-3 py-3 font-medium text-navy">{project.name}</td>
                <td className="px-3 py-3">{project.client}</td>
                <td className="px-3 py-3">{project.vessel}</td>
                <td className="px-3 py-3">
                  <Badge tone={tones[project.status]}>{projectStatusLabels[project.status]}</Badge>
                </td>
                <td className="px-3 py-3 tabular-nums">{formatMoney(summary.estimatedCents, project.currency)}</td>
                <td className="px-3 py-3 text-steel">{formatDate(project.updatedAt)}</td>
                <td className="px-3 py-3">
                  <ActionLink href={`/estimations/${project.id}`}>Ouvrir</ActionLink>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
