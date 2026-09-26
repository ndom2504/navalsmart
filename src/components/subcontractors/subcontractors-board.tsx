"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Clock, MapPin, Plus, Search, Tags, Users, X } from "lucide-react";
import { addSubcontractorAction } from "@/server/actions";
import { ActionLink } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { QuoteStatus } from "@/domain/types";

export type SubcontractorRow = {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  contact: string;
  category: string;
  description: string;
  location: string;
  lot: string;
  line: string;
  leadTime: string;
  validUntil: string;
  priceLabel: string;
  priced: boolean;
  currency: string;
  included: string;
  excluded: string;
  documentName: string | null;
  quoteStatus: QuoteStatus;
  quoteLabel: string;
  status: "Actif" | "En évaluation";
};

const tones = {
  Actif: "success",
  "En évaluation": "warning",
} as const;

const quoteTones = {
  REQUESTED: "steel",
  RECEIVED: "technical",
  TO_VERIFY: "warning",
  VALIDATED: "success",
} as const;

const tabs = ["Tous", "Actifs", "En évaluation", "Non chiffrés"] as const;
const field = "h-10 w-full rounded-md border border-line px-3 text-sm";

export function SubcontractorsBoard({ rows, projects }: { rows: SubcontractorRow[]; projects: { id: string; name: string; currency: string }[] }) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Tous");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tous");
  const [location, setLocation] = useState("Tous");
  const [status, setStatus] = useState("Tous");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? "");
  const [panel, setPanel] = useState<"overview" | "offer" | "lot">("overview");
  const [open, setOpen] = useState(false);

  const categories = ["Tous", ...new Set(rows.map((row) => row.category))];
  const locations = ["Tous", ...new Set(rows.map((row) => row.location))];

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (tab === "Actifs" && row.status !== "Actif") return false;
      if (tab === "En évaluation" && row.status !== "En évaluation") return false;
      if (tab === "Non chiffrés" && row.priced) return false;
      if (category !== "Tous" && row.category !== category) return false;
      if (location !== "Tous" && row.location !== location) return false;
      if (status !== "Tous" && row.status !== status) return false;
      return `${row.name} ${row.category} ${row.projectName} ${row.contact}`.toLowerCase().includes(query.trim().toLowerCase());
    });
  }, [rows, tab, category, location, status, query]);

  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const counts = {
    total: rows.length,
    active: rows.filter((row) => row.status === "Actif").length,
    review: rows.filter((row) => row.status === "En évaluation").length,
    unpriced: rows.filter((row) => !row.priced).length,
    categories: new Set(rows.map((row) => row.category)).size,
    projects: new Set(rows.map((row) => row.projectId)).size,
  };
  const tabCount = (item: (typeof tabs)[number]) => item === "Tous" ? counts.total : item === "Actifs" ? counts.active : item === "En évaluation" ? counts.review : counts.unpriced;

  return (
    <div className="space-y-4">
      <p className="text-sm text-steel">
        <Link href="/sous-traitants" className="hover:text-navy">Sous-traitants</Link>
        <span className="px-2">/</span>
        <span className="text-navy">Liste des sous-traitants</span>
      </p>

      <section className="relative overflow-hidden rounded-2xl text-white">
        <img src="/brand/banner-shipyard.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_30%]" />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(8,24,48,0.82)_0%,rgba(8,24,48,0.45)_70%,rgba(8,24,48,0.2)_100%)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4 p-6">
          <div>
            <h1 className="text-3xl font-semibold">Sous-traitants</h1>
            <p className="mt-1 text-sm text-white/80">Entreprises associées aux lots des estimations. Le prix et le statut viennent de chaque dossier.</p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#1d6fe0] px-4 text-sm font-semibold">
            <Plus className="h-4 w-4" /> Ajouter un sous-traitant
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat icon={Users} label="Sous-traitants" value={String(counts.total)} hint="Lignes rattachées aux dossiers" />
        <Stat icon={CheckCircle2} label="Actifs" value={String(counts.active)} hint="Offre reçue ou validée" />
        <Stat icon={Clock} label="En évaluation" value={String(counts.review)} hint="Offre demandée ou à vérifier" />
        <Stat icon={Tags} label="Spécialités" value={String(counts.categories)} hint="Catégories renseignées" />
        <Stat icon={MapPin} label="Dossiers" value={String(counts.projects)} hint="Estimations concernées" />
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
              <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Rechercher un sous-traitant..." className="h-9 w-full rounded-full border border-line pr-3 pl-9 text-sm outline-none" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 px-4 py-3">
            <Filter label="Spécialité" value={category} options={categories} onChange={(value) => { setCategory(value); setPage(1); }} />
            <Filter label="Lieu" value={location} options={locations} onChange={(value) => { setLocation(value); setPage(1); }} />
            <Filter label="Statut" value={status} options={["Tous", "Actif", "En évaluation"]} onChange={(value) => { setStatus(value); setPage(1); }} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs text-steel">
                <tr>
                  {["#", "Entreprise", "Spécialité", "Projet", "Délai", "Prix", "Statut", "Actions"].map((label) => (
                    <th key={label} className="px-3 py-2 font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row, index) => (
                  <tr key={row.id} onClick={() => { setSelectedId(row.id); setPanel("overview"); }} className={`cursor-pointer border-t border-[#eef2f6] ${selected?.id === row.id ? "bg-[#f4f8fc]" : ""}`}>
                    <td className="px-3 py-3 text-steel">{(currentPage - 1) * pageSize + index + 1}</td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-3">
                        <Mark name={row.name} />
                        <span>
                          <span className="block font-medium text-navy">{row.name}</span>
                          <span className="block max-w-56 truncate text-xs text-steel">{row.description}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3">{row.category}</td>
                    <td className="px-3 py-3">{row.projectName}</td>
                    <td className="px-3 py-3">{row.leadTime}</td>
                    <td className="px-3 py-3 tabular-nums">{row.priceLabel}</td>
                    <td className="px-3 py-3"><Badge tone={tones[row.status]}>{row.status}</Badge></td>
                    <td className="px-3 py-3">
                      <ActionLink href={`/estimations/${row.projectId}?section=subcontractors`}>Ouvrir</ActionLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length ? <p className="p-5 text-sm text-steel">Aucun sous-traitant ne correspond à ces filtres.</p> : null}
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-xs text-steel">
            <span>Affichage de {visible.length} sur {filtered.length} sous-traitants</span>
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
                <Mark name={selected.name} large />
                <div>
                  <p className="font-semibold text-navy">{selected.name}</p>
                  <p className="text-xs text-steel">{selected.category}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge tone={tones[selected.status]}>{selected.status}</Badge>
                    <Badge tone={quoteTones[selected.quoteStatus]}>{selected.quoteLabel}</Badge>
                  </div>
                </div>
              </div>
              <button type="button" aria-label="Fermer la fiche" onClick={() => setSelectedId("")}><X className="h-4 w-4 text-steel" /></button>
            </div>
            <Link href={`/estimations/${selected.projectId}?section=subcontractors`} className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#1d6fe0] text-sm font-semibold text-white">
              Ouvrir dans l&apos;estimation
            </Link>
            <div className="mt-4 flex gap-3 border-b border-[#eef2f6] text-sm">
              {([
                ["overview", "Vue d'ensemble"],
                ["offer", "Offre"],
                ["lot", "Lot"],
              ] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setPanel(key)} className={`pb-2 ${panel === key ? "border-b-2 border-[#1d6fe0] font-semibold text-navy" : "text-steel"}`}>{label}</button>
              ))}
            </div>
            {panel === "overview" ? (
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  ["Contact", selected.contact],
                  ["Spécialité", selected.category],
                  ["Projet", selected.projectName],
                  ["Lieu du dossier", selected.location],
                  ["Délai", selected.leadTime],
                  ["Prix", selected.priceLabel],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-3">
                    <dt className="text-steel">{label}</dt>
                    <dd className="text-right font-medium text-navy">{value}</dd>
                  </div>
                ))}
                <div>
                  <p className="text-steel">Description</p>
                  <p className="mt-1 leading-6 text-navy">{selected.description}</p>
                </div>
              </dl>
            ) : null}
            {panel === "offer" ? (
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  ["Prix", selected.priceLabel],
                  ["Statut de l'offre", selected.quoteLabel],
                  ["Validité", selected.validUntil],
                  ["Inclus", selected.included],
                  ["Exclus", selected.excluded],
                  ["Document", selected.documentName || "Aucun document"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-steel">{label}</dt>
                    <dd className="mt-1 font-medium text-navy">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {panel === "lot" ? (
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  ["Lot", selected.lot],
                  ["Ligne", selected.line],
                  ["Projet", selected.projectName],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-steel">{label}</dt>
                    <dd className="mt-1 font-medium text-navy">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </aside>
        ) : null}
      </section>

      <AddForm open={open} onOpenChange={setOpen} projects={projects} />
    </div>
  );
}

function AddForm({ open, onOpenChange, projects }: { open: boolean; onOpenChange: (open: boolean) => void; projects: { id: string; name: string; currency: string }[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const price = String(data.get("price") ?? "").trim();
    start(async () => {
      const result = await addSubcontractorAction({
        projectId: String(data.get("projectId") ?? ""),
        name: String(data.get("name") ?? ""),
        contact: String(data.get("contact") ?? ""),
        category: String(data.get("category") ?? ""),
        description: String(data.get("description") ?? ""),
        priceCents: price === "" ? null : Math.round(Number(price) * 100),
        currency: String(data.get("currency") ?? "CAD"),
      });
      if ("error" in result && result.error) setError(result.error);
      else {
        setError(null);
        form.reset();
        onOpenChange(false);
      }
    });
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Ajouter un sous-traitant">
      <form onSubmit={onSubmit} className="space-y-3">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <select className={field} name="projectId" required defaultValue={projects[0]?.id ?? ""}>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <input className={field} name="name" placeholder="Entreprise" required />
        <input className={field} name="contact" placeholder="Contact" />
        <input className={field} name="category" placeholder="Spécialité" required />
        <textarea className="min-h-20 w-full rounded-md border border-line px-3 py-2 text-sm" name="description" placeholder="Description" />
        <input className={field} name="price" type="number" min="0" step="0.01" placeholder="Prix, laisser vide si non reçu" />
        <select className={field} name="currency" defaultValue="CAD">
          <option>CAD</option>
          <option>USD</option>
          <option>EUR</option>
        </select>
        <Button disabled={pending || !projects.length} type="submit">Enregistrer</Button>
      </form>
    </Modal>
  );
}

function Mark({ name, large = false }: { name: string; large?: boolean }) {
  const initials = name.split(/\s+/).filter((part) => part[0] && part[0] !== "—").slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-xl bg-[#e8f1fb] font-semibold text-[#1d4e89] ${large ? "h-12 w-12 text-sm" : "h-10 w-10 text-xs"}`}>
      {initials || "S"}
    </span>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: string; hint: string }) {
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
