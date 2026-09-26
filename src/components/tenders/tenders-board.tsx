"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Calendar, CheckCircle2, FileText, FolderOpen, MapPin, Plus, Search, Sparkles, X } from "lucide-react";
import { ActionLink } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";

export type TenderRow = {
  id: string;
  reference: string;
  name: string;
  client: string;
  vessel: string;
  type: string;
  typeLabel: string;
  location: string;
  currency: string;
  description: string;
  status: "Nouveau" | "En cours" | "Analysé" | "Estimé" | "Archivé";
  deadlineLabel: string;
  daysLeft: number | null;
  analyzed: boolean;
  hasEstimate: boolean;
  inAnalysis: boolean;
  urgent: boolean;
  createdThisMonth: boolean;
  documents: { id: string; fileName: string; sizeLabel: string; dateLabel: string }[];
  analysisSummary: string | null;
};

const tones = {
  Nouveau: "steel",
  "En cours": "technical",
  Analysé: "success",
  Estimé: "cyan",
  Archivé: "steel",
} as const;

const tabs = ["Tous", "En cours", "Analysés", "Estimés", "Archivés"] as const;

export function TendersBoard({ rows }: { rows: TenderRow[] }) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Tous");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("Tous");
  const [status, setStatus] = useState("Tous");
  const [client, setClient] = useState("Tous");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? "");
  const [panel, setPanel] = useState<"details" | "documents" | "analysis" | "notes">("details");

  const types = ["Tous", ...new Set(rows.map((row) => row.typeLabel))];
  const clients = ["Tous", ...new Set(rows.map((row) => row.client))];
  const statuses = ["Tous", ...new Set(rows.map((row) => row.status))];

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (tab === "En cours" && !["Nouveau", "En cours"].includes(row.status)) return false;
      if (tab === "Analysés" && !row.analyzed) return false;
      if (tab === "Estimés" && !row.hasEstimate) return false;
      if (tab === "Archivés" && row.status !== "Archivé") return false;
      if (type !== "Tous" && row.typeLabel !== type) return false;
      if (status !== "Tous" && row.status !== status) return false;
      if (client !== "Tous" && row.client !== client) return false;
      const haystack = `${row.reference} ${row.name} ${row.client} ${row.vessel}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    });
  }, [rows, tab, type, status, client, query]);

  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  const counts = {
    total: rows.length,
    analysis: rows.filter((row) => row.inAnalysis).length,
    analyzed: rows.filter((row) => row.analyzed).length,
    estimates: rows.filter((row) => row.hasEstimate).length,
    urgent: rows.filter((row) => row.urgent).length,
    month: rows.filter((row) => row.createdThisMonth).length,
  };

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-2xl text-white">
        <img src="/brand/banner-shipyard.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_30%]" />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(8,24,48,0.82)_0%,rgba(8,24,48,0.45)_70%,rgba(8,24,48,0.2)_100%)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4 p-6">
          <div>
            <h1 className="text-3xl font-semibold">Appels d&apos;offres</h1>
            <p className="mt-1 text-sm text-white/80">Centralisez et analysez vos appels d&apos;offres de construction, réparation et maintenance navale.</p>
          </div>
          <Link href="/estimations/nouvelle" className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#1d6fe0] px-4 text-sm font-semibold">
            <Plus className="h-4 w-4" /> Nouvel appel d&apos;offres
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat icon={FolderOpen} label="Appels d'offres" value={counts.total} hint={counts.month ? `+${counts.month} ce mois` : "Dossiers en base"} />
        <Stat icon={Sparkles} label="En cours d'analyse" value={counts.analysis} hint="Statut d'analyse" />
        <Stat icon={CheckCircle2} label="Analysés" value={counts.analyzed} hint="Lecture IA terminée" />
        <Stat icon={FileText} label="Estimations générées" value={counts.estimates} hint="Lots déjà chiffrés" />
        <Stat icon={Calendar} label="Date limite < 7 jours" value={counts.urgent} hint="Échéance de soumission" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <article className="rounded-2xl border border-[#e6edf4] bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#eef2f6] px-4 py-3">
            {tabs.map((item) => {
              const count = item === "Tous" ? rows.length : item === "En cours" ? rows.filter((row) => row.status === "Nouveau" || row.status === "En cours").length : item === "Analysés" ? counts.analyzed : item === "Estimés" ? counts.estimates : rows.filter((row) => row.status === "Archivé").length;
              return (
                <button key={item} type="button" onClick={() => { setTab(item); setPage(1); }} className={`rounded-full px-3 py-1 text-sm ${tab === item ? "bg-[#e8f1fb] font-semibold text-[#1d4e89]" : "text-steel"}`}>
                  {item} ({count})
                </button>
              );
            })}
            <label className="relative ml-auto min-w-40 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-steel" />
              <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Rechercher..." className="h-9 w-full rounded-full border border-line pr-3 pl-9 text-sm outline-none" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 px-4 py-3">
            <Filter label="Type de projet" value={type} options={types} onChange={(value) => { setType(value); setPage(1); }} />
            <Filter label="Statut" value={status} options={statuses} onChange={(value) => { setStatus(value); setPage(1); }} />
            <Filter label="Client" value={client} options={clients} onChange={(value) => { setClient(value); setPage(1); }} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-steel">
                <tr>
                  {["#", "Titre / Référence", "Client", "Type de projet", "Date limite", "Statut", "Actions"].map((label) => (
                    <th key={label} className="px-3 py-2 font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row, index) => (
                  <tr key={row.id} onClick={() => { setSelectedId(row.id); setPanel("details"); }} className={`cursor-pointer border-t border-[#eef2f6] ${selected?.id === row.id ? "bg-[#f4f8fc]" : ""}`}>
                    <td className="px-3 py-3 text-steel">{(currentPage - 1) * pageSize + index + 1}</td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-3">
                        <img src="/brand/banner-shipyard.jpg" alt="" className="h-10 w-14 rounded-md object-cover" />
                        <span>
                          <span className="block text-xs text-steel">{row.reference}</span>
                          <span className="block font-medium text-navy">{row.name}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3">{row.client}</td>
                    <td className="px-3 py-3">{row.typeLabel}</td>
                    <td className="px-3 py-3">
                      {row.deadlineLabel}
                      {row.daysLeft != null ? <span className="mt-1 block text-xs text-steel">{row.daysLeft >= 0 ? `${row.daysLeft} jours` : "Échue"}</span> : null}
                    </td>
                    <td className="px-3 py-3"><Badge tone={tones[row.status]}>{row.status}</Badge></td>
                    <td className="px-3 py-3"><ActionLink href={`/estimations/${row.id}`}>Ouvrir</ActionLink></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length ? <p className="p-5 text-sm text-steel">Aucun appel d&apos;offres ne correspond à ces filtres.</p> : null}
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-xs text-steel">
            <span>Affichage de {visible.length} sur {filtered.length} appels d&apos;offres</span>
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
              <div className="flex gap-3">
                <img src="/brand/banner-shipyard.jpg" alt="" className="h-14 w-16 rounded-lg object-cover" />
                <div>
                  <p className="text-xs text-steel">{selected.reference}</p>
                  <p className="font-semibold text-navy">{selected.name}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge tone={tones[selected.status]}>{selected.status}</Badge>
                    {selected.daysLeft != null && selected.daysLeft >= 0 ? <span className="text-xs text-[#c2410c]">{selected.daysLeft} jours restants</span> : null}
                  </div>
                </div>
              </div>
              <button type="button" aria-label="Fermer la fiche" onClick={() => setSelectedId("")}><X className="h-4 w-4 text-steel" /></button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href={`/estimations/${selected.id}?section=document`} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1d6fe0] text-sm font-semibold text-white">
                <Sparkles className="h-4 w-4" /> Analyser avec l&apos;IA
              </Link>
              <Link href={`/estimations/${selected.id}`} className="inline-flex h-10 items-center justify-center rounded-lg border border-line text-sm font-medium text-navy">
                Créer une estimation
              </Link>
            </div>
            <div className="mt-4 flex gap-3 border-b border-[#eef2f6] text-sm">
              {([
                ["details", "Détails"],
                ["documents", `Documents (${selected.documents.length})`],
                ["analysis", "Analyse IA"],
                ["notes", "Notes"],
              ] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setPanel(key)} className={`pb-2 ${panel === key ? "border-b-2 border-[#1d6fe0] font-semibold text-navy" : "text-steel"}`}>{label}</button>
              ))}
            </div>
            {panel === "details" ? (
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  ["Client", selected.client],
                  ["Navire", selected.vessel],
                  ["Type de projet", selected.typeLabel],
                  ["Lieu", selected.location || "Non précisé"],
                  ["Date limite", selected.deadlineLabel],
                  ["Devise", selected.currency],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-3">
                    <dt className="text-steel">{label}</dt>
                    <dd className="text-right font-medium text-navy">{value}</dd>
                  </div>
                ))}
                <div>
                  <p className="flex items-center gap-2 text-steel"><MapPin className="h-3.5 w-3.5" />Description</p>
                  <p className="mt-1 leading-6 text-navy">{selected.description || "Aucune description saisie."}</p>
                </div>
              </dl>
            ) : null}
            {panel === "documents" ? (
              <ul className="mt-4 space-y-3 text-sm">
                {selected.documents.length ? selected.documents.map((document) => (
                  <li key={document.id} className="flex items-start justify-between gap-2">
                    <span>
                      <span className="block font-medium text-navy">{document.fileName}</span>
                      <span className="text-xs text-steel">{document.sizeLabel} · {document.dateLabel}</span>
                    </span>
                    <Link href={`/estimations/${selected.id}?section=document`} className="text-[#1d6fe0]">Ouvrir</Link>
                  </li>
                )) : <li className="text-steel">Aucun document importé.</li>}
              </ul>
            ) : null}
            {panel === "analysis" ? (
              <p className="mt-4 text-sm leading-6 text-navy">{selected.analysisSummary || "Aucune analyse pour ce dossier. Lancez l'analyse depuis le document."}</p>
            ) : null}
            {panel === "notes" ? (
              <p className="mt-4 text-sm leading-6 text-navy">{selected.description || "Aucune note."}</p>
            ) : null}
          </aside>
        ) : null}
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof FolderOpen; label: string; value: number; hint: string }) {
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
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-lg border border-line bg-white px-2 text-sm text-navy">
        <option value="Tous">{label}</option>
        {options.filter((option) => option !== "Tous").map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
