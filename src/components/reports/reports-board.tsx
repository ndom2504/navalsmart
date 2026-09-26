"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CheckCircle2, Clock, FileText, FolderOpen, Plus, Search } from "lucide-react";
import { ActionAnchor, ActionLink } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";

export type ReportKind = "Estimation" | "Coûts" | "Risques";
export type ReportStatus = "Finalisé" | "En cours" | "Planifié";

export type ReportRow = {
  id: string;
  projectId: string;
  projectName: string;
  client: string;
  vessel: string;
  reference: string;
  kind: ReportKind;
  title: string;
  dateLabel: string;
  monthKey: string;
  monthLabel: string;
  status: ReportStatus;
  summary: string;
  href: string;
  excelHref: string | null;
};

const kindColor: Record<ReportKind, string> = {
  Estimation: "#1d4e89",
  Coûts: "#3d7eb8",
  Risques: "#d97706",
};

const statusColor: Record<ReportStatus, string> = {
  Finalisé: "#16a34a",
  "En cours": "#1d6fe0",
  Planifié: "#94a3b8",
};

const statusTone = {
  Finalisé: "success",
  "En cours": "technical",
  Planifié: "steel",
} as const;

const tabs = ["Vue d'ensemble", "Par type", "Par projet", "Récents"] as const;

export function ReportsBoard({ rows }: { rows: ReportRow[] }) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Vue d'ensemble");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("Tous");
  const [project, setProject] = useState("Tous");
  const [client, setClient] = useState("Tous");
  const [status, setStatus] = useState("Tous");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? "");

  const kinds = ["Tous", ...new Set(rows.map((row) => row.kind))];
  const projects = ["Tous", ...new Set(rows.map((row) => row.projectName))];
  const clients = ["Tous", ...new Set(rows.map((row) => row.client))];
  const statuses = ["Tous", ...new Set(rows.map((row) => row.status))];

  const filtered = useMemo(() => {
    const list = rows.filter((row) => {
      if (kind !== "Tous" && row.kind !== kind) return false;
      if (project !== "Tous" && row.projectName !== project) return false;
      if (client !== "Tous" && row.client !== client) return false;
      if (status !== "Tous" && row.status !== status) return false;
      return `${row.title} ${row.projectName} ${row.client} ${row.reference}`.toLowerCase().includes(query.trim().toLowerCase());
    });
    if (tab === "Par projet") return [...list].sort((a, b) => a.projectName.localeCompare(b.projectName, "fr"));
    return list;
  }, [rows, kind, project, client, status, query, tab]);

  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = rows.find((row) => row.id === selectedId) ?? filtered[0] ?? null;
  const counts = {
    total: rows.length,
    projects: new Set(rows.map((row) => row.projectId)).size,
    progress: rows.filter((row) => row.status === "En cours").length,
    done: rows.filter((row) => row.status === "Finalisé").length,
  };
  const byKind = (["Estimation", "Coûts", "Risques"] as const).map((name) => ({
    name,
    value: rows.filter((row) => row.kind === name).length,
    color: kindColor[name],
  })).filter((slice) => slice.value > 0);
  const byStatus = (["Finalisé", "En cours", "Planifié"] as const).map((name) => ({
    name,
    value: rows.filter((row) => row.status === name).length,
    color: statusColor[name],
  })).filter((slice) => slice.value > 0);
  const months = [...new Map(rows.map((row) => [row.monthKey, row.monthLabel])).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, label]) => ({
      label,
      value: rows.filter((row) => row.monthKey === key).length,
    }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-steel">
        <Link href="/rapports" className="hover:text-navy">Rapports</Link>
        <span className="px-2">/</span>
        <span className="text-navy">Centre de rapports</span>
      </p>

      <section className="relative overflow-hidden rounded-2xl text-white">
        <img src="/brand/banner-shipyard.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_30%]" />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(8,24,48,0.82)_0%,rgba(8,24,48,0.45)_70%,rgba(8,24,48,0.2)_100%)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4 p-6">
          <div>
            <h1 className="text-3xl font-semibold">Rapports</h1>
            <p className="mt-1 text-sm text-white/80">Rapports produits à partir des estimations : impression, coûts et risques.</p>
          </div>
          <Link href="/estimations/nouvelle" className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#1d6fe0] px-4 text-sm font-semibold">
            <Plus className="h-4 w-4" /> Nouveau rapport
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={FileText} label="Rapports" value={String(counts.total)} hint="Documents disponibles" />
        <Stat icon={FolderOpen} label="Projets couverts" value={String(counts.projects)} hint="Dossiers avec au moins un rapport" />
        <Stat icon={Clock} label="En cours" value={String(counts.progress)} hint="Estimation non encore validée" />
        <Stat icon={CheckCircle2} label="Finalisés" value={String(counts.done)} hint="Dossier validé ou soumis" />
      </section>

      <div className="flex flex-wrap gap-4 border-b border-[#e6edf4] text-sm">
        {tabs.map((item) => (
          <button key={item} type="button" onClick={() => { setTab(item); setPage(1); }} className={`pb-2 ${tab === item ? "border-b-2 border-[#1d6fe0] font-semibold text-navy" : "text-steel"}`}>{item}</button>
        ))}
      </div>

      {tab === "Vue d'ensemble" ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <ChartCard title="Répartition des rapports" center={String(counts.total)} caption="rapports" slices={byKind} />
          <article className="rounded-2xl border border-[#e6edf4] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-navy">Mois de mise à jour</h2>
            <p className="mt-1 text-xs text-steel">Mois où un dossier a réellement été mis à jour.</p>
            <ul className="mt-4 space-y-3">
              {months.map((month) => (
                <li key={month.label} className="flex items-center justify-between text-sm">
                  <span className="text-navy">{month.label}</span>
                  <span className="font-semibold text-navy">{month.value}</span>
                </li>
              ))}
            </ul>
          </article>
          <ChartCard title="Statut des rapports" center={String(counts.total)} caption="rapports" slices={byStatus} />
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <article className="rounded-2xl border border-[#e6edf4] bg-white shadow-sm">
          <div className="flex flex-wrap gap-2 px-4 py-3">
            <label className="relative min-w-40 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-steel" />
              <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Rechercher un rapport..." className="h-9 w-full rounded-full border border-line pr-3 pl-9 text-sm outline-none" />
            </label>
            <Filter label="Type" value={kind} options={kinds} onChange={(value) => { setKind(value); setPage(1); }} />
            <Filter label="Projet" value={project} options={projects} onChange={(value) => { setProject(value); setPage(1); }} />
            <Filter label="Client" value={client} options={clients} onChange={(value) => { setClient(value); setPage(1); }} />
            <Filter label="Statut" value={status} options={statuses} onChange={(value) => { setStatus(value); setPage(1); }} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs text-steel">
                <tr>
                  {["#", "Titre", "Projet", "Client", "Type", "Mise à jour", "Statut", "Actions"].map((label) => (
                    <th key={label} className="px-3 py-2 font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row, index) => (
                  <tr key={row.id} onClick={() => setSelectedId(row.id)} className={`cursor-pointer border-t border-[#eef2f6] ${selected?.id === row.id ? "bg-[#f4f8fc]" : ""}`}>
                    <td className="px-3 py-3 text-steel">{(currentPage - 1) * pageSize + index + 1}</td>
                    <td className="px-3 py-3 font-medium text-navy">{row.title}</td>
                    <td className="px-3 py-3">{row.reference}</td>
                    <td className="px-3 py-3">{row.client}</td>
                    <td className="px-3 py-3"><Badge tone="navy">{row.kind}</Badge></td>
                    <td className="px-3 py-3">{row.dateLabel}</td>
                    <td className="px-3 py-3"><Badge tone={statusTone[row.status]}>{row.status}</Badge></td>
                    <td className="px-3 py-3">
                      <span className="flex gap-1">
                        <ActionLink href={row.href}>Ouvrir</ActionLink>
                        {row.excelHref ? <ActionAnchor href={row.excelHref}>Excel</ActionAnchor> : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length ? <p className="p-5 text-sm text-steel">Aucun rapport ne correspond à ces filtres.</p> : null}
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-xs text-steel">
            <span>Affichage de {visible.length} sur {filtered.length} rapports</span>
            <span className="flex items-center gap-2">
              <button type="button" className="rounded border border-line px-2 py-1" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>‹</button>
              <span>{currentPage}</span>
              <button type="button" className="rounded border border-line px-2 py-1" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>›</button>
            </span>
          </div>
        </article>

        {selected ? (
          <aside className="space-y-4">
            <article className="rounded-2xl border border-[#e6edf4] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-navy">Aperçu du rapport</h2>
                <ActionLink href={selected.href}>Plein écran</ActionLink>
              </div>
              <p className="mt-3 text-xs font-semibold tracking-wide text-[#1d4e89]">NAVALSMART</p>
              <p className="mt-2 font-semibold text-navy">{selected.title}</p>
              <p className="mt-1 text-xs text-steel">{selected.reference}</p>
              <dl className="mt-3 space-y-2 text-sm">
                {[
                  ["Client", selected.client],
                  ["Navire", selected.vessel],
                  ["Mise à jour", selected.dateLabel],
                  ["Statut", selected.status],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-steel">{label}</dt>
                    <dd className="text-right font-medium text-navy">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-sm leading-6 text-navy">{selected.summary}</p>
            </article>
            <article className="rounded-2xl border border-[#e6edf4] bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-navy">Rapports récents</h2>
              <ul className="mt-3 space-y-3 text-sm">
                {rows.slice(0, 4).map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-2">
                    <button type="button" className="text-left" onClick={() => setSelectedId(row.id)}>
                      <span className="block font-medium text-navy">{row.title}</span>
                      <span className="text-xs text-steel">{row.dateLabel}</span>
                    </button>
                    <ActionLink href={row.href}>Ouvrir</ActionLink>
                  </li>
                ))}
              </ul>
            </article>
          </aside>
        ) : null}
      </section>
    </div>
  );
}

function ChartCard({ title, center, caption, slices }: { title: string; center: string; caption: string; slices: { name: string; value: number; color: string }[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  return (
    <article className="rounded-2xl border border-[#e6edf4] bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-navy">{title}</h2>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative h-36 w-36 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={slices} dataKey="value" innerRadius={42} outerRadius={62} stroke="none">
                {slices.map((slice) => <Cell key={slice.name} fill={slice.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-semibold text-navy">{center}</span>
            <span className="text-[11px] text-steel">{caption}</span>
          </div>
        </div>
        <ul className="space-y-2 text-xs">
          {slices.map((slice) => (
            <li key={slice.name} className="flex items-center gap-2 text-navy">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: slice.color }} />
              {slice.name}
              <span className="text-steel">{slice.value} · {total ? Math.round((slice.value / total) * 100) : 0} %</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof FileText; label: string; value: string; hint: string }) {
  return (
    <article className="rounded-2xl border border-[#e6edf4] bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8f1fb] text-[#1d4e89]"><Icon className="h-4 w-4" /></span>
        <div>
          <p className="text-2xl font-semibold text-navy">{value}</p>
          <p className="text-xs text-steel">{label}</p>
          <p className="text-[11px] text-steel">{hint}</p>
        </div>
      </div>
    </article>
  );
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="text-xs text-steel">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 max-w-44 rounded-lg border border-line bg-white px-2 text-sm text-navy">
        <option value="Tous">{label}</option>
        {options.filter((option) => option !== "Tous").map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
