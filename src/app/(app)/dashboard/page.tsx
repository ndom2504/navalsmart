import Link from "next/link";
import { AlertTriangle, ClipboardList, Database, FileUp, FolderOpen, Plus, ShieldAlert, Sparkles, Upload } from "lucide-react";
import { financialSummary } from "@/domain/calculations";
import type { Project, ProjectStatus } from "@/domain/types";
import { CostSplit } from "@/components/dashboard/cost-split";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { Badge } from "@/components/ui/badge";
import { formatCompactMoney, formatMoney } from "@/lib/format";
import { documentStatusLabels, projectStatusLabels } from "@/lib/labels";
import { readDatabase } from "@/server/store";

export const metadata = { title: "Dashboard" };

const statusTone = {
  DRAFT: "steel",
  IN_ANALYSIS: "technical",
  IN_ESTIMATION: "cyan",
  TO_VALIDATE: "warning",
  VALIDATED: "success",
  SUBMITTED: "success",
} as const satisfies Record<ProjectStatus, "steel" | "technical" | "cyan" | "warning" | "success">;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const date = new Date(`${month}-01T12:00:00`);
  return new Intl.DateTimeFormat("fr-CA", { month: "short" }).format(date).replace(".", "");
}

function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function monthNote(count: number): string {
  if (count <= 0) return "Aucun dossier mis à jour ce mois";
  return count === 1 ? "1 dossier mis à jour ce mois" : `${count} dossiers mis à jour ce mois`;
}

export default async function DashboardPage() {
  const database = await readDatabase();
  const projects = [...database.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const summaries = new Map(projects.map((project) => [project.id, financialSummary(project)]));
  const active = projects.filter((project) => project.status !== "VALIDATED" && project.status !== "SUBMITTED");
  const toValidate = projects.filter((project) => project.status === "TO_VALIDATE");
  const estimated = projects.reduce((sum, project) => sum + (summaries.get(project.id)?.estimatedCents ?? 0), 0);
  const risks = projects.reduce((sum, project) => sum + project.risks.length, 0);
  const currency = database.settings.currency;

  const today = new Date();
  const currentMonth = monthKey(today);
  const touched = (month: string, list: Project[]) => list.filter((project) => project.updatedAt.startsWith(month));
  const sumEstimated = (list: Project[]) => list.reduce((sum, project) => sum + (summaries.get(project.id)?.estimatedCents ?? 0), 0);
  const notes = {
    active: monthNote(touched(currentMonth, active).length),
    cost: monthNote(touched(currentMonth, projects).length),
    validate: monthNote(touched(currentMonth, toValidate).length),
    risks: monthNote(touched(currentMonth, projects.filter((project) => project.risks.length > 0)).length),
  };

  const months = projects.length
    ? Array.from({ length: 1 + monthIndex(projects) }, (_, index) => {
        const start = earliestMonth(projects);
        const date = new Date(`${start}-01T12:00:00`);
        date.setMonth(date.getMonth() + index);
        return monthKey(date);
      })
    : [];
  let runningCost = 0;
  let runningCount = 0;
  const trend = months.map((month) => {
    const batch = projects.filter((project) => project.updatedAt.startsWith(month));
    runningCost += sumEstimated(batch) / 100;
    runningCount += batch.length;
    return { label: monthLabel(month), total: Math.round(runningCost), count: runningCount };
  });

  const direct = projects.reduce(
    (bucket, project) => {
      const summary = summaries.get(project.id);
      if (!summary) return bucket;
      bucket.labor += summary.laborCents;
      bucket.materials += summary.materialsCents;
      bucket.equipment += summary.equipmentCents;
      bucket.subcontract += summary.subcontractCents;
      bucket.other += summary.logisticsCents + summary.otherCents;
      return bucket;
    },
    { labor: 0, materials: 0, equipment: 0, subcontract: 0, other: 0 },
  );
  const slices = [
    { name: "Main-d'œuvre", value: direct.labor, color: "#1d4e89" },
    { name: "Matériaux", value: direct.materials, color: "#5b93d6" },
    { name: "Équipements", value: direct.equipment, color: "#9ec0e8" },
    { name: "Sous-traitance", value: direct.subcontract, color: "#c5d4e4" },
    { name: "Autres", value: direct.other, color: "#e4ebf2" },
  ];

  const documents = projects
    .flatMap((project) => (project.tender?.documents ?? []).map((document) => ({ document, project })))
    .sort((a, b) => b.document.importedAt.localeCompare(a.document.importedAt))
    .slice(0, 4);

  const alerts = projects
    .flatMap((project) => project.missing.filter((item) => item.status === "OPEN").map((item) => ({ project, item })))
    .slice(0, 3);

  const cards = [
    { label: "Estimations actives", value: String(active.length), note: notes.active, icon: ClipboardList, tone: "text-[#1d4e89] bg-[#e8f1fb]" },
    { label: "Coût total estimé", value: formatCompactMoney(estimated, currency), note: notes.cost, icon: Database, tone: "text-[#1d4e89] bg-[#e8f1fb]" },
    { label: "À valider", value: String(toValidate.length), note: notes.validate, icon: FolderOpen, tone: "text-[#c2410c] bg-[#fff1e8]" },
    { label: "Risques identifiés", value: String(risks), note: notes.risks, icon: AlertTriangle, tone: "text-[#be123c] bg-[#ffe8ee]" },
  ];

  return (
    <div className="space-y-5">
      <section className="relative min-h-[230px] overflow-hidden rounded-2xl text-white">
        <img src="/brand/banner-shipyard.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_45%]" />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(8,24,48,0.78)_0%,rgba(8,24,48,0.42)_48%,rgba(8,24,48,0.18)_100%)]" />
        <div className="relative flex min-h-[230px] flex-col justify-between gap-6 p-6 sm:p-8 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Bonjour, {database.user.name}</h1>
            <p className="mt-2 text-white/85">Voici l&apos;état de vos estimations.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/estimations/nouvelle" className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#1d6fe0] px-4 text-sm font-semibold text-white">
                <Plus className="h-4 w-4" /> Nouvelle estimation
              </Link>
              <Link href="/estimations/nouvelle" className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/70 bg-white/10 px-4 text-sm font-semibold text-white">
                <Upload className="h-4 w-4" /> Importer un appel d&apos;offres
              </Link>
            </div>
          </div>
          <p className="max-w-xs text-lg font-medium leading-snug lg:text-right">&ldquo;De l&apos;appel d&apos;offres à l&apos;estimation, avec l&apos;IA.&rdquo;</p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-2xl border border-[#e6edf4] bg-white px-5 py-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-steel uppercase">{card.label}</p>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-3xl font-semibold tabular-nums text-navy">{card.value}</p>
              <p className="mt-2 text-xs text-steel">{card.note}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)_280px]">
        <article className="rounded-2xl border border-[#e6edf4] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-navy">Évolution des estimations</h2>
          <p className="mt-1 mb-2 text-xs text-steel">Cumul du coût estimé et du nombre de dossiers, selon la date de mise à jour.</p>
          <TrendChart data={trend} />
        </article>
        <article className="rounded-2xl border border-[#e6edf4] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-navy">Répartition des coûts</h2>
          <p className="mt-1 mb-3 text-xs text-steel">Parts du coût direct. Le total au centre est le coût estimé.</p>
          <CostSplit slices={slices} totalLabel={formatCompactMoney(estimated, currency)} />
        </article>
        <article className="rounded-2xl bg-[#12325f] p-5 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Assistant IA</p>
            <span className="inline-flex items-center gap-1 text-xs text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Disponible</span>
          </div>
          <p className="mt-3 text-sm text-white/80">Analysez un appel d&apos;offres à partir du dossier courant.</p>
          <ul className="mt-4 space-y-2 text-sm text-white/90">
            {["Extraction des informations présentes", "Décomposition en lots de travaux", "Repérage des exigences et contraintes", "Proposition d'une première structure"].map((item) => (
              <li key={item} className="flex gap-2"><span className="text-emerald-300">✓</span>{item}</li>
            ))}
          </ul>
          <Link href="/estimations/nouvelle" className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1d6fe0] text-sm font-semibold">
            <Sparkles className="h-4 w-4" /> Analyser un document
          </Link>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
        <article className="rounded-2xl border border-[#e6edf4] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-navy">Estimations récentes</h2>
            <Link href="/estimations" className="text-sm font-medium text-[#1d6fe0]">Voir toutes les estimations</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-steel">
                <tr>
                  {["Projet", "Client", "Navire", "Statut", "Coût estimé", "Dernière modification", "Action"].map((label) => (
                    <th key={label} className="px-2 py-2 font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.slice(0, 5).map((project) => (
                  <tr key={project.id} className="border-t border-[#eef2f6]">
                    <td className="px-2 py-3 font-medium text-navy">{project.name}</td>
                    <td className="px-2 py-3">{project.client}</td>
                    <td className="px-2 py-3">{project.vessel}</td>
                    <td className="px-2 py-3"><Badge tone={statusTone[project.status]}>{projectStatusLabels[project.status]}</Badge></td>
                    <td className="px-2 py-3 tabular-nums">{formatMoney(summaries.get(project.id)?.estimatedCents ?? 0, project.currency)}</td>
                    <td className="px-2 py-3 text-steel">{shortDate(project.updatedAt)}</td>
                    <td className="px-2 py-3">
                      <Link href={`/estimations/${project.id}`} className="font-medium text-[#1d6fe0]">Ouvrir</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article id="alertes" className="rounded-2xl border border-[#e6edf4] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-navy">Appels d&apos;offres récents</h2>
          <ul className="mt-4 space-y-3">
            {documents.length ? documents.map(({ document, project }) => (
              <li key={document.id}>
                <Link href={`/estimations/${project.id}?section=document`} className="flex items-start gap-3 rounded-lg px-1 py-1 hover:bg-[#f7fafc]">
                  <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8f1fb] text-[#1d4e89]">
                    <FolderOpen className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-navy">{document.fileName}</span>
                    <span className="block text-xs text-steel">{documentStatusLabels[document.status]} · {shortDate(document.importedAt)}</span>
                  </span>
                </Link>
              </li>
            )) : <li className="text-sm text-steel">Aucun document importé.</li>}
          </ul>
          {alerts.length ? (
            <div className="mt-5 border-t border-[#eef2f6] pt-4">
              <p className="text-xs font-semibold tracking-wide text-steel uppercase">Informations manquantes</p>
              <ul className="mt-2 space-y-2 text-sm">
                {alerts.map(({ project, item }) => (
                  <li key={item.id}>
                    <p className="text-navy">{item.description}</p>
                    <p className="text-xs text-steel">{project.vessel}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { href: "/estimations/nouvelle", title: "Importer un appel d'offres", text: "PDF, DOCX, XLSX, TXT", icon: FileUp },
          { href: "/estimations/nouvelle", title: "Générer une estimation", text: "Avec l'assistance de l'IA", icon: Sparkles },
          { href: "/risques", title: "Analyser les risques", text: "Identifier et suivre les risques", icon: ShieldAlert },
          { href: "/rapports", title: "Produire un rapport", text: "Professionnel et complet", icon: ClipboardList },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.title} href={action.href} className="flex items-center gap-3 rounded-2xl border border-[#e6edf4] bg-white px-4 py-4 shadow-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f1fb] text-[#1d4e89]">
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-navy">{action.title}</span>
                <span className="block text-xs text-steel">{action.text}</span>
              </span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

function earliestMonth(projects: Project[]): string {
  return projects.reduce((earliest, project) => (project.updatedAt.slice(0, 7) < earliest ? project.updatedAt.slice(0, 7) : earliest), projects[0].updatedAt.slice(0, 7));
}

function monthIndex(projects: Project[]): number {
  const start = earliestMonth(projects);
  const end = projects.reduce((latest, project) => (project.updatedAt.slice(0, 7) > latest ? project.updatedAt.slice(0, 7) : latest), start);
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  return (ey - sy) * 12 + (em - sm);
}
