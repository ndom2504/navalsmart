"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, FolderOpen, Search, ShieldAlert, X } from "lucide-react";
import { ActionLink } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";
import type { RecordStatus, RiskLevel } from "@/domain/types";

export type RiskRow = {
  id: string;
  projectId: string;
  projectName: string;
  vessel: string;
  title: string;
  justification: string;
  mitigation: string;
  owner: string;
  level: RiskLevel;
  levelLabel: string;
  probabilityLabel: string;
  impactLabel: string;
  status: RecordStatus;
  statusLabel: string;
  costLabel: string;
  source: string;
  provenanceLabel: string;
};

const levelTone = {
  LOW: "steel",
  MEDIUM: "warning",
  HIGH: "danger",
  CRITICAL: "danger",
} as const;

const statusTone = {
  OPEN: "warning",
  ACCEPTED: "technical",
  RESOLVED: "success",
  IGNORED: "steel",
  REJECTED: "danger",
} as const;

const tabs = ["Tous", "Élevés", "Moyens", "Faibles", "Ouverts"] as const;

export function RisksBoard({ rows }: { rows: RiskRow[] }) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Tous");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("Tous");
  const [status, setStatus] = useState("Tous");
  const [project, setProject] = useState("Tous");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? "");
  const [panel, setPanel] = useState<"overview" | "justification" | "mitigation">("overview");

  const levels = ["Tous", ...new Set(rows.map((row) => row.levelLabel))];
  const statuses = ["Tous", ...new Set(rows.map((row) => row.statusLabel))];
  const projects = ["Tous", ...new Set(rows.map((row) => row.projectName))];

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (tab === "Élevés" && row.level !== "HIGH" && row.level !== "CRITICAL") return false;
      if (tab === "Moyens" && row.level !== "MEDIUM") return false;
      if (tab === "Faibles" && row.level !== "LOW") return false;
      if (tab === "Ouverts" && row.status !== "OPEN") return false;
      if (level !== "Tous" && row.levelLabel !== level) return false;
      if (status !== "Tous" && row.statusLabel !== status) return false;
      if (project !== "Tous" && row.projectName !== project) return false;
      return `${row.title} ${row.projectName} ${row.vessel} ${row.owner}`.toLowerCase().includes(query.trim().toLowerCase());
    });
  }, [rows, tab, level, status, project, query]);

  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const counts = {
    total: rows.length,
    high: rows.filter((row) => row.level === "HIGH" || row.level === "CRITICAL").length,
    medium: rows.filter((row) => row.level === "MEDIUM").length,
    low: rows.filter((row) => row.level === "LOW").length,
    open: rows.filter((row) => row.status === "OPEN").length,
    projects: new Set(rows.map((row) => row.projectId)).size,
  };
  const tabCount = (item: (typeof tabs)[number]) => item === "Tous" ? counts.total : item === "Élevés" ? counts.high : item === "Moyens" ? counts.medium : item === "Faibles" ? counts.low : counts.open;

  return (
    <div className="space-y-4">
      <p className="text-sm text-steel">
        <Link href="/risques" className="hover:text-navy">Risques</Link>
        <span className="px-2">/</span>
        <span className="text-navy">Registre des risques</span>
      </p>

      <section className="relative overflow-hidden rounded-2xl text-white">
        <img src="/brand/banner-shipyard.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_30%]" />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(8,24,48,0.82)_0%,rgba(8,24,48,0.45)_70%,rgba(8,24,48,0.2)_100%)]" />
        <div className="relative p-6">
          <h1 className="text-3xl font-semibold">Risques</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/80">Registre des risques liés aux estimations. Chaque ligne garde sa justification et son dossier.</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat icon={AlertTriangle} label="Risques" value={String(counts.total)} hint="Lignes du registre" />
        <Stat icon={ShieldAlert} label="Élevés" value={String(counts.high)} hint="Niveau élevé ou critique" />
        <Stat icon={AlertTriangle} label="Ouverts" value={String(counts.open)} hint="Encore à traiter" />
        <Stat icon={FolderOpen} label="Dossiers" value={String(counts.projects)} hint="Estimations concernées" />
        <Stat icon={AlertTriangle} label="Moyens" value={String(counts.medium)} hint="Niveau moyen" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <article className="rounded-2xl border border-[#e6edf4] bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#eef2f6] px-4 py-3">
            {tabs.map((item) => (
              <button key={item} type="button" onClick={() => { setTab(item); setPage(1); }} className={`rounded-full px-3 py-1 text-sm ${tab === item ? "bg-[#e8f1fb] font-semibold text-[#1d4e89]" : "text-steel"}`}>
                {item} ({tabCount(item)})
              </button>
            ))}
            <label className="relative ml-auto min-w-40 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-steel" />
              <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Rechercher un risque..." className="h-9 w-full rounded-full border border-line pr-3 pl-9 text-sm outline-none" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 px-4 py-3">
            <Filter label="Niveau" value={level} options={levels} onChange={(value) => { setLevel(value); setPage(1); }} />
            <Filter label="Statut" value={status} options={statuses} onChange={(value) => { setStatus(value); setPage(1); }} />
            <Filter label="Projet" value={project} options={projects} onChange={(value) => { setProject(value); setPage(1); }} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs text-steel">
                <tr>
                  {["#", "Risque", "Projet", "Niveau", "Probabilité", "Impact", "Statut", "Actions"].map((label) => (
                    <th key={label} className="px-3 py-2 font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row, index) => (
                  <tr key={row.id} onClick={() => { setSelectedId(row.id); setPanel("overview"); }} className={`cursor-pointer border-t border-[#eef2f6] ${selected?.id === row.id ? "bg-[#f4f8fc]" : ""}`}>
                    <td className="px-3 py-3 text-steel">{(currentPage - 1) * pageSize + index + 1}</td>
                    <td className="px-3 py-3">
                      <span className="block font-medium text-navy">{row.title}</span>
                      <span className="block max-w-64 truncate text-xs text-steel">{row.justification}</span>
                    </td>
                    <td className="px-3 py-3">{row.projectName}</td>
                    <td className="px-3 py-3"><Badge tone={levelTone[row.level]}>{row.levelLabel}</Badge></td>
                    <td className="px-3 py-3">{row.probabilityLabel}</td>
                    <td className="px-3 py-3">{row.impactLabel}</td>
                    <td className="px-3 py-3"><Badge tone={statusTone[row.status]}>{row.statusLabel}</Badge></td>
                    <td className="px-3 py-3">
                      <ActionLink href={`/estimations/${row.projectId}?section=risks`}>Ouvrir</ActionLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length ? <p className="p-5 text-sm text-steel">Aucun risque ne correspond à ces filtres.</p> : null}
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-xs text-steel">
            <span>Affichage de {visible.length} sur {filtered.length} risques</span>
            <span className="flex items-center gap-2">
              <button type="button" className="rounded border border-line px-2 py-1" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>‹</button>
              <span>{currentPage}</span>
              <button type="button" className="rounded border border-line px-2 py-1" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>›</button>
            </span>
          </div>
        </article>

        {selected ? (
          <aside className="rounded-2xl border border-[#e6edf4] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-navy">{selected.title}</p>
                <p className="text-xs text-steel">{selected.projectName}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={levelTone[selected.level]}>{selected.levelLabel}</Badge>
                  <Badge tone={statusTone[selected.status]}>{selected.statusLabel}</Badge>
                </div>
              </div>
              <button type="button" aria-label="Fermer la fiche" onClick={() => setSelectedId("")}><X className="h-4 w-4 text-steel" /></button>
            </div>
            <Link href={`/estimations/${selected.projectId}?section=risks`} className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#1d6fe0] text-sm font-semibold text-white">
              Ouvrir dans l&apos;estimation
            </Link>
            <div className="mt-4 flex gap-3 border-b border-[#eef2f6] text-sm">
              {([
                ["overview", "Vue d'ensemble"],
                ["justification", "Justification"],
                ["mitigation", "Mitigation"],
              ] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setPanel(key)} className={`pb-2 ${panel === key ? "border-b-2 border-[#1d6fe0] font-semibold text-navy" : "text-steel"}`}>{label}</button>
              ))}
            </div>
            {panel === "overview" ? (
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  ["Projet", selected.projectName],
                  ["Navire", selected.vessel],
                  ["Probabilité", selected.probabilityLabel],
                  ["Impact", selected.impactLabel],
                  ["Responsable", selected.owner],
                  ["Coût potentiel", selected.costLabel],
                  ["Source", selected.source],
                  ["Provenance", selected.provenanceLabel],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-3">
                    <dt className="text-steel">{label}</dt>
                    <dd className="text-right font-medium text-navy">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {panel === "justification" ? <p className="mt-4 text-sm leading-6 text-navy">{selected.justification}</p> : null}
            {panel === "mitigation" ? <p className="mt-4 text-sm leading-6 text-navy">{selected.mitigation}</p> : null}
          </aside>
        ) : null}
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof AlertTriangle; label: string; value: string; hint: string }) {
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
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 max-w-48 rounded-lg border border-line bg-white px-2 text-sm text-navy">
        <option value="Tous">{label}</option>
        {options.filter((option) => option !== "Tous").map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
