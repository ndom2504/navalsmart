"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Database, Download, Percent, Plus, Search, Shield, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCompactMoney, formatMoney, formatNumber } from "@/lib/format";

export type CostCategory = "Main-d'œuvre" | "Matériaux" | "Équipements" | "Sous-traitants" | "Indirects" | "Contingence" | "Marge";

export type CostLine = {
  id: string;
  category: CostCategory;
  description: string;
  quantity: number;
  unit: string;
  unitCents: number;
  totalCents: number;
  source: string;
  status: "Validé" | "En cours" | "À valider" | "Calculé";
};

export type CostProject = {
  id: string;
  name: string;
  client: string;
  vessel: string;
  dateLabel: string;
  statusLabel: string;
  currency: string;
  directCents: number;
  indirectCents: number;
  contingencyCents: number;
  marginCents: number;
  estimatedCents: number;
  overheadPct: number;
  contingencyPct: number;
  marginPct: number;
  lines: CostLine[];
};

const colors: Record<CostCategory, string> = {
  "Main-d'œuvre": "#1d4e89",
  Matériaux: "#3d7eb8",
  Équipements: "#7eb0de",
  "Sous-traitants": "#b7d3ea",
  Indirects: "#d97706",
  Contingence: "#ea580c",
  Marge: "#6d28d9",
};

const statusTone = {
  Validé: "success",
  "En cours": "technical",
  "À valider": "warning",
  Calculé: "cyan",
} as const;

const tabs = [
  ["overview", "Vue d'ensemble"],
  ["direct", "Coûts directs"],
  ["indirect", "Coûts indirects"],
  ["contingency", "Contingence & marge"],
  ["sensitivity", "Analyse de sensibilité"],
] as const;

export function CostsBoard({ projects }: { projects: CostProject[] }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("overview");
  const [category, setCategory] = useState<"Tous" | CostCategory>("Tous");
  const [query, setQuery] = useState("");
  const project = projects.find((item) => item.id === projectId) ?? projects[0];

  const slices = useMemo(() => {
    if (!project) return [];
    const groups: CostCategory[] = ["Main-d'œuvre", "Matériaux", "Équipements", "Sous-traitants", "Indirects", "Contingence"];
    return groups.map((name) => ({
      name,
      value: project.lines.filter((line) => line.category === name).reduce((sum, line) => sum + line.totalCents, 0),
      color: colors[name],
    })).filter((slice) => slice.value > 0);
  }, [project]);

  if (!project) {
    return <p className="rounded-2xl border border-[#e6edf4] bg-white p-6 text-sm text-steel">Aucune estimation à chiffrer.</p>;
  }

  const share = (cents: number) => (project.estimatedCents ? Math.round((cents / project.estimatedCents) * 100) : 0);
  const visible = project.lines.filter((line) => {
    if (tab === "direct" && !["Main-d'œuvre", "Matériaux", "Équipements", "Sous-traitants"].includes(line.category)) return false;
    if (tab === "indirect" && line.category !== "Indirects") return false;
    if (tab === "contingency" && line.category !== "Contingence" && line.category !== "Marge") return false;
    if (category !== "Tous" && line.category !== category) return false;
    return `${line.description} ${line.category} ${line.source}`.toLowerCase().includes(query.trim().toLowerCase());
  });
  const counts = {
    all: project.lines.length,
    labor: project.lines.filter((line) => line.category === "Main-d'œuvre").length,
    materials: project.lines.filter((line) => line.category === "Matériaux").length,
    equipment: project.lines.filter((line) => line.category === "Équipements").length,
    subs: project.lines.filter((line) => line.category === "Sous-traitants").length,
    indirect: project.lines.filter((line) => line.category === "Indirects").length,
    contingency: project.lines.filter((line) => line.category === "Contingence" || line.category === "Marge").length,
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-steel">
        <Link href="/estimations" className="hover:text-navy">Estimations</Link>
        <span className="px-2">/</span>
        <Link href={`/estimations/${project.id}`} className="hover:text-navy">{project.name}</Link>
        <span className="px-2">/</span>
        <span className="text-navy">Coûts</span>
      </p>

      <section className="relative overflow-hidden rounded-2xl text-white">
        <img src="/brand/banner-shipyard.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_40%]" />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(8,24,48,0.84)_0%,rgba(8,24,48,0.5)_72%)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4 p-6">
          <div>
            <h1 className="text-3xl font-semibold">Coûts</h1>
            <p className="mt-1 text-sm text-white/80">Gérez et analysez les coûts liés à l&apos;estimation sélectionnée.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <select value={project.id} onChange={(event) => setProjectId(event.target.value)} className="h-9 rounded-lg border border-white/30 bg-white/10 px-2 text-white">
                {projects.map((item) => <option key={item.id} value={item.id} className="text-navy">{item.name}</option>)}
              </select>
              <span>{project.vessel}</span>
              <span>{project.client}</span>
              <span>{project.dateLabel}</span>
              <Badge tone="technical">{project.statusLabel}</Badge>
            </div>
          </div>
          <a href={`/api/estimates/${project.id}/export`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/40 bg-white/10 px-3 text-sm">
            <Download className="h-4 w-4" /> Exporter
          </a>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Summary icon={Database} label="Coût total estimé" value={formatCompactMoney(project.estimatedCents, project.currency)} hint="Calcul système" />
        <Summary icon={Wrench} label="Coûts directs" value={formatCompactMoney(project.directCents, project.currency)} hint={`${share(project.directCents)} %`} />
        <Summary icon={Percent} label="Coûts indirects" value={formatMoney(project.indirectCents, project.currency)} hint={`${project.overheadPct} % du direct`} />
        <Summary icon={Shield} label="Contingence" value={formatMoney(project.contingencyCents, project.currency)} hint={`${project.contingencyPct} % du direct`} />
        <Summary icon={Percent} label="Marge" value={formatMoney(project.marginCents, project.currency)} hint={`${project.marginPct} % du coût estimé`} />
      </section>

      <div className="flex gap-4 overflow-x-auto text-sm">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`whitespace-nowrap pb-2 ${tab === key ? "border-b-2 border-[#1d6fe0] font-semibold text-navy" : "text-steel"}`}>{label}</button>
        ))}
      </div>

      {tab !== "sensitivity" ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <article className="rounded-2xl border border-[#e6edf4] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-navy">Répartition des coûts</h2>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={slices} dataKey="value" innerRadius={52} outerRadius={72} stroke="none">
                      {slices.map((slice) => <Cell key={slice.name} fill={slice.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-sm font-semibold text-navy">{formatCompactMoney(project.estimatedCents, project.currency)}</p>
                  <p className="text-[11px] text-steel">Total</p>
                </div>
              </div>
              <ul className="w-full space-y-1 text-xs">
                {slices.map((slice) => (
                  <li key={slice.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-navy"><span className="h-2 w-2 rounded-full" style={{ background: slice.color }} />{slice.name}</span>
                    <span className="tabular-nums text-steel">{share(slice.value)} % · {formatMoney(slice.value, project.currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
          <article className="rounded-2xl border border-[#e6edf4] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-navy">Montants par catégorie</h2>
            <p className="mt-1 text-xs text-steel">Une seule photographie du dossier. Pas d&apos;historique mensuel inventé.</p>
            <div className="mt-3 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={slices}>
                  <XAxis dataKey="name" hide />
                  <YAxis hide />
                  <Tooltip formatter={(value) => formatMoney(Number(value), project.currency)} />
                  <Bar dataKey="value" radius={4}>
                    {slices.map((slice) => <Cell key={slice.name} fill={slice.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
          <article className="rounded-2xl border border-[#e6edf4] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-navy">Direct et estimé</h2>
            <p className="mt-2 text-sm text-steel">
              {project.directCents ? `+${Math.round(((project.estimatedCents - project.directCents) / project.directCents) * 1000) / 10} %` : "—"} entre le coût direct et le coût estimé.
            </p>
            <div className="mt-6 flex items-end gap-6">
              <BarBlock label="Coût direct" value={formatCompactMoney(project.directCents, project.currency)} height={72} />
              <BarBlock label="Coût estimé" value={formatCompactMoney(project.estimatedCents, project.currency)} height={104} />
            </div>
          </article>
        </section>
      ) : (
        <Sensitivity project={project} />
      )}

      <article className="rounded-2xl border border-[#e6edf4] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-base font-semibold text-navy">Détail des coûts</h2>
          {([
            ["Tous", counts.all],
            ["Main-d'œuvre", counts.labor],
            ["Matériaux", counts.materials],
            ["Équipements", counts.equipment],
            ["Sous-traitants", counts.subs],
            ["Indirects", counts.indirect],
            ["Contingence", counts.contingency],
          ] as const).map(([label, count]) => (
            <button key={label} type="button" onClick={() => setCategory(label === "Tous" ? "Tous" : label)} className={`rounded-full px-3 py-1 text-xs ${category === label ? "bg-[#e8f1fb] font-semibold text-[#1d4e89]" : "text-steel"}`}>
              {label} ({count})
            </button>
          ))}
          <label className="relative ml-auto">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-steel" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un poste..." className="h-9 rounded-full border border-line pr-3 pl-9 text-sm outline-none" />
          </label>
          <Link href={`/estimations/${project.id}?section=estimate`} className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#1d6fe0] px-3 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" /> Ajouter un poste
          </Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs text-steel">
              <tr>{["#", "Catégorie", "Description", "Quantité", "Unité", "Coût unitaire", "Coût total", "% du total", "Source", "Statut"].map((label) => <th key={label} className="px-2 py-2 font-medium">{label}</th>)}</tr>
            </thead>
            <tbody>
              {visible.map((line, index) => (
                <tr key={line.id} className="border-t border-[#eef2f6]">
                  <td className="px-2 py-3 text-steel">{index + 1}</td>
                  <td className="px-2 py-3"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: colors[line.category] }} />{line.category}</span></td>
                  <td className="px-2 py-3 text-navy">{line.description}</td>
                  <td className="px-2 py-3 tabular-nums">{formatNumber(line.quantity, 2)}</td>
                  <td className="px-2 py-3">{line.unit}</td>
                  <td className="px-2 py-3 tabular-nums">{formatMoney(line.unitCents, project.currency)}</td>
                  <td className="px-2 py-3 tabular-nums">{formatMoney(line.totalCents, project.currency)}</td>
                  <td className="px-2 py-3 tabular-nums">{share(line.totalCents)} %</td>
                  <td className="px-2 py-3 text-steel">{line.source}</td>
                  <td className="px-2 py-3"><Badge tone={statusTone[line.status]}>{line.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length ? <p className="py-4 text-sm text-steel">Aucun poste dans ce filtre.</p> : null}
        </div>
      </article>
    </div>
  );
}

function Summary({ icon: Icon, label, value, hint }: { icon: typeof Database; label: string; value: string; hint: string }) {
  return (
    <article className="rounded-2xl border border-[#e6edf4] bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-steel uppercase"><Icon className="h-4 w-4 text-[#1d4e89]" />{label}</div>
      <p className="mt-2 text-2xl font-semibold text-navy">{value}</p>
      <p className="text-xs text-steel">{hint}</p>
    </article>
  );
}

function BarBlock({ label, value, height }: { label: string; value: string; height: number }) {
  return (
    <div>
      <div className="w-16 rounded-t-md bg-[#1d4e89]" style={{ height }} />
      <p className="mt-2 text-sm font-semibold text-navy">{value}</p>
      <p className="text-xs text-steel">{label}</p>
    </div>
  );
}

function Sensitivity({ project }: { project: CostProject }) {
  const scenarios = [
    ["Paramètres actuels", project.overheadPct, project.contingencyPct, project.marginPct],
    ["Indirects +2 points", project.overheadPct + 2, project.contingencyPct, project.marginPct],
    ["Contingence +2 points", project.overheadPct, project.contingencyPct + 2, project.marginPct],
    ["Marge +2 points", project.overheadPct, project.contingencyPct, project.marginPct + 2],
  ] as const;
  return (
    <article className="rounded-2xl border border-[#e6edf4] bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-navy">Analyse de sensibilité</h2>
      <p className="mt-1 text-sm text-steel">Le coût direct reste fixe. Seuls les pourcentages de l&apos;estimation changent. Calcul système.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-steel"><tr>{["Scénario", "Indirects", "Contingence", "Marge", "Coût estimé", "Prix proposé"].map((label) => <th key={label} className="px-2 py-2 font-medium">{label}</th>)}</tr></thead>
          <tbody>
            {scenarios.map(([label, overhead, contingency, margin]) => {
              const indirect = Math.round(project.directCents * overhead / 100);
              const risk = Math.round(project.directCents * contingency / 100);
              const estimated = project.directCents + indirect + risk;
              const bid = Math.round(estimated * (1 + margin / 100));
              return (
                <tr key={label} className="border-t border-[#eef2f6]">
                  <td className="px-2 py-3 font-medium text-navy">{label}</td>
                  <td className="px-2 py-3">{overhead} %</td>
                  <td className="px-2 py-3">{contingency} %</td>
                  <td className="px-2 py-3">{margin} %</td>
                  <td className="px-2 py-3 tabular-nums">{formatMoney(estimated, project.currency)}</td>
                  <td className="px-2 py-3 tabular-nums">{formatMoney(bid, project.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}
