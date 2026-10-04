import Link from "next/link";
import { Upload } from "lucide-react";
import { GlobalPlanner, type PlannerProject } from "@/components/planning/global-planner";
import { planningSummary } from "@/domain/planning";
import { readDatabase } from "@/server/store";

export const metadata = { title: "Planning" };

export default async function PlanningPage() {
  const database = await readDatabase();
  const today = new Date().toISOString().slice(0, 10);
  const projects: PlannerProject[] = database.projects
    .filter((project) => project.workOrders.length || project.milestones.length)
    .map((project) => {
      const lots = new Map(project.workPackages.map((item) => [item.id, `${item.code} — ${item.name}`]));
      const milestones = project.milestones
        .filter((item): item is typeof item & { date: string } => Boolean(item.date))
        .map((item) => ({ id: item.id, label: item.label, date: item.date, toConfirm: item.toConfirm, deadline: item.kind === "DEADLINE" }));
      if (project.submissionDeadline && !milestones.some((item) => item.deadline && item.date === project.submissionDeadline)) {
        milestones.push({ id: "submission", label: "Date limite de soumission", date: project.submissionDeadline, toConfirm: false, deadline: true });
      }
      return {
        id: project.id,
        name: project.name,
        vessel: project.vessel,
        milestones,
        orders: project.workOrders.map((order) => ({
          id: order.id,
          number: order.number,
          title: order.title,
          code: order.code,
          lot: lots.get(order.workPackageId ?? "") ?? "Hors lot",
          trade: order.trade,
          status: order.status,
          start: order.actualStart ?? order.plannedStart,
          end: order.actualEnd ?? order.plannedEnd,
          proposed: order.datesProvenance === "AI" && !order.actualStart,
          progressPct: order.progressPct,
        })),
      };
    });
  const totals = database.projects.reduce(
    (sum, project) => {
      const summary = planningSummary(project);
      return {
        orders: sum.orders + summary.total,
        blocked: sum.blocked + summary.byStatus.BLOCKED,
        running: sum.running + summary.byStatus.IN_PROGRESS,
        done: sum.done + summary.byStatus.DONE,
      };
    },
    { orders: 0, blocked: 0, running: 0, done: 0 },
  );

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl text-white">
        <img src="/brand/banner-shipyard.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_35%]" />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(8,24,48,0.84)_0%,rgba(8,24,48,0.5)_65%,rgba(8,24,48,0.25)_100%)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4 p-6">
          <div>
            <h1 className="text-3xl font-semibold">Planning</h1>
            <p className="mt-1 text-sm text-white/80">Jalons et ordres de travail de tous les projets, issus des appels d&apos;offres analysés.</p>
          </div>
          <Link href="/estimations/importer" className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#1d6fe0] px-4 text-sm font-semibold">
            <Upload className="h-4 w-4" /> Nouvelle estimation depuis un appel d&apos;offres
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Projets planifiés", String(projects.length)],
          ["Ordres de travail", String(totals.orders)],
          ["En cours", String(totals.running)],
          ["Bloqués", String(totals.blocked)],
        ].map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-[#e6edf4] bg-white px-5 py-4 shadow-sm">
            <p className="text-sm text-steel">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-navy">{value}</p>
          </article>
        ))}
      </section>

      {projects.length ? (
        <GlobalPlanner projects={projects} today={today} />
      ) : (
        <p className="rounded-2xl border border-dashed border-line bg-white px-4 py-10 text-center text-sm text-steel">
          Aucun projet planifié. Importez un appel d&apos;offres : le projet, ses jalons et ses ordres de travail sont créés automatiquement.
        </p>
      )}
    </div>
  );
}
