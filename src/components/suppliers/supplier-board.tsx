"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Clock, FileText, Plus, Search, ShieldCheck, Tags, Users, X } from "lucide-react";
import { createSupplierAction } from "@/server/actions";
import { ActionLink } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { QuoteStatus } from "@/domain/types";

export type SupplierStatus = "Actif" | "En évaluation" | "Inactif";

export type SupplierRow = {
  id: string;
  name: string;
  contact: string;
  category: string;
  description: string;
  currency: string;
  status: SupplierStatus;
  leadTime: string;
  priceLabel: string;
  priced: boolean;
  projects: { id: string; name: string }[];
  quotes: {
    id: string;
    projectId: string;
    projectName: string;
    priceLabel: string;
    leadTime: string;
    validUntil: string;
    status: QuoteStatus;
    statusLabel: string;
    included: string;
    documentName: string | null;
  }[];
  materials: {
    id: string;
    projectId: string;
    projectName: string;
    description: string;
    quantityLabel: string;
    priceLabel: string;
  }[];
};

const tones = {
  Actif: "success",
  "En évaluation": "warning",
  Inactif: "steel",
} as const;

const quoteTones = {
  REQUESTED: "steel",
  RECEIVED: "technical",
  TO_VERIFY: "warning",
  VALIDATED: "success",
} as const;

const tabs = ["Tous", "Avec prix", "En évaluation", "Actifs", "Inactifs"] as const;
const field = "h-10 w-full rounded-md border border-line px-3 text-sm";

export function SuppliersBoard({ rows }: { rows: SupplierRow[] }) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Tous");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tous");
  const [currency, setCurrency] = useState("Tous");
  const [status, setStatus] = useState("Tous");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? "");
  const [panel, setPanel] = useState<"overview" | "quotes" | "materials">("overview");
  const [open, setOpen] = useState(false);

  const categories = ["Tous", ...new Set(rows.map((row) => row.category))];
  const currencies = ["Tous", ...new Set(rows.map((row) => row.currency))];

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (tab === "Avec prix" && !row.priced) return false;
      if (tab === "En évaluation" && row.status !== "En évaluation") return false;
      if (tab === "Actifs" && row.status !== "Actif") return false;
      if (tab === "Inactifs" && row.status !== "Inactif") return false;
      if (category !== "Tous" && row.category !== category) return false;
      if (currency !== "Tous" && row.currency !== currency) return false;
      if (status !== "Tous" && row.status !== status) return false;
      return `${row.name} ${row.category} ${row.contact} ${row.description}`.toLowerCase().includes(query.trim().toLowerCase());
    });
  }, [rows, tab, category, currency, status, query]);

  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const counts = {
    total: rows.length,
    priced: rows.filter((row) => row.priced).length,
    review: rows.filter((row) => row.status === "En évaluation").length,
    active: rows.filter((row) => row.status === "Actif").length,
    idle: rows.filter((row) => row.status === "Inactif").length,
    categories: new Set(rows.map((row) => row.category)).size,
    quotes: rows.reduce((sum, row) => sum + row.quotes.length, 0),
  };
  const tabCount = (item: (typeof tabs)[number]) => item === "Tous" ? counts.total : item === "Avec prix" ? counts.priced : item === "En évaluation" ? counts.review : item === "Actifs" ? counts.active : counts.idle;
  const estimateHref = selected?.projects[0] ? `/estimations/${selected.projects[0].id}?section=suppliers` : "/estimations";

  return (
    <div className="space-y-4">
      <p className="text-sm text-steel">
        <Link href="/fournisseurs" className="hover:text-navy">Fournisseurs</Link>
        <span className="px-2">/</span>
        <span className="text-navy">Liste des fournisseurs</span>
      </p>

      <section className="relative overflow-hidden rounded-2xl text-white">
        <img src="/brand/banner-shipyard.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_30%]" />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(8,24,48,0.82)_0%,rgba(8,24,48,0.45)_70%,rgba(8,24,48,0.2)_100%)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4 p-6">
          <div>
            <h1 className="text-3xl font-semibold">Fournisseurs</h1>
            <p className="mt-1 text-sm text-white/80">Répertoire des fournisseurs liés aux estimations. Les prix viennent des soumissions et des matériaux saisis.</p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#1d6fe0] px-4 text-sm font-semibold">
            <Plus className="h-4 w-4" /> Ajouter un fournisseur
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat icon={Users} label="Fournisseurs" value={String(counts.total)} hint="Fiches du répertoire" />
        <Stat icon={Tags} label="Catégories" value={String(counts.categories)} hint="Familles renseignées" />
        <Stat icon={Clock} label="En évaluation" value={String(counts.review)} hint="Soumission à recevoir ou vérifier" />
        <Stat icon={ShieldCheck} label="Actifs" value={String(counts.active)} hint="Déjà utilisés dans un dossier" />
        <Stat icon={FileText} label="Soumissions" value={String(counts.quotes)} hint="Devis rattachés aux dossiers" />
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
              <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Rechercher un fournisseur..." className="h-9 w-full rounded-full border border-line pr-3 pl-9 text-sm outline-none" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 px-4 py-3">
            <Filter label="Catégorie" value={category} options={categories} onChange={(value) => { setCategory(value); setPage(1); }} />
            <Filter label="Devise" value={currency} options={currencies} onChange={(value) => { setCurrency(value); setPage(1); }} />
            <Filter label="Statut" value={status} options={["Tous", "Actif", "En évaluation", "Inactif"]} onChange={(value) => { setStatus(value); setPage(1); }} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-xs text-steel">
                <tr>
                  {["#", "Fournisseur", "Catégorie", "Devise", "Délai", "Dernier prix", "Statut", "Actions"].map((label) => (
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
                    <td className="px-3 py-3">{row.currency}</td>
                    <td className="px-3 py-3">{row.leadTime}</td>
                    <td className="px-3 py-3 tabular-nums">{row.priceLabel}</td>
                    <td className="px-3 py-3"><Badge tone={tones[row.status]}>{row.status}</Badge></td>
                    <td className="px-3 py-3">
                      {row.projects[0] ? <ActionLink href={`/estimations/${row.projects[0].id}?section=suppliers`}>Ouvrir</ActionLink> : <span className="text-steel">Aucun dossier</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length ? <p className="p-5 text-sm text-steel">Aucun fournisseur ne correspond à ces filtres.</p> : null}
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-xs text-steel">
            <span>Affichage de {visible.length} sur {filtered.length} fournisseurs</span>
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
                  <div className="mt-1"><Badge tone={tones[selected.status]}>{selected.status}</Badge></div>
                </div>
              </div>
              <button type="button" aria-label="Fermer la fiche" onClick={() => setSelectedId("")}><X className="h-4 w-4 text-steel" /></button>
            </div>
            <Link href={estimateHref} className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#1d6fe0] text-sm font-semibold text-white">
              Ouvrir les soumissions
            </Link>
            <div className="mt-4 flex gap-3 border-b border-[#eef2f6] text-sm">
              {([
                ["overview", "Vue d'ensemble"],
                ["quotes", `Soumissions (${selected.quotes.length})`],
                ["materials", `Matériaux (${selected.materials.length})`],
              ] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setPanel(key)} className={`pb-2 ${panel === key ? "border-b-2 border-[#1d6fe0] font-semibold text-navy" : "text-steel"}`}>{label}</button>
              ))}
            </div>
            {panel === "overview" ? (
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  ["Contact", selected.contact],
                  ["Catégorie", selected.category],
                  ["Devise", selected.currency],
                  ["Délai", selected.leadTime],
                  ["Dernier prix", selected.priceLabel],
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
                <div>
                  <p className="text-steel">Dossiers</p>
                  {selected.projects.length ? (
                    <ul className="mt-1 space-y-1">
                      {selected.projects.map((project) => (
                        <li key={project.id}><Link href={`/estimations/${project.id}?section=suppliers`} className="font-medium text-[#1d6fe0]">{project.name}</Link></li>
                      ))}
                    </ul>
                  ) : <p className="mt-1 text-navy">Aucun dossier lié.</p>}
                </div>
              </dl>
            ) : null}
            {panel === "quotes" ? (
              <ul className="mt-4 space-y-3 text-sm">
                {selected.quotes.length ? selected.quotes.map((quote) => (
                  <li key={quote.id} className="rounded-lg border border-[#eef2f6] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-navy">{quote.priceLabel}</p>
                      <Badge tone={quoteTones[quote.status]}>{quote.statusLabel}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-steel">{quote.projectName}</p>
                    <p className="mt-2 text-navy">{quote.included}</p>
                    <p className="mt-1 text-xs text-steel">Délai {quote.leadTime} · valide jusqu&apos;au {quote.validUntil}</p>
                    {quote.documentName ? <p className="mt-1 text-xs text-steel">{quote.documentName}</p> : null}
                  </li>
                )) : <li className="text-steel">Aucune soumission enregistrée.</li>}
              </ul>
            ) : null}
            {panel === "materials" ? (
              <ul className="mt-4 space-y-3 text-sm">
                {selected.materials.length ? selected.materials.map((material) => (
                  <li key={material.id} className="rounded-lg border border-[#eef2f6] p-3">
                    <p className="font-medium text-navy">{material.description}</p>
                    <p className="mt-1 text-xs text-steel">{material.projectName}</p>
                    <p className="mt-2">{material.quantityLabel} · {material.priceLabel}</p>
                  </li>
                )) : <li className="text-steel">Aucun matériau rattaché.</li>}
              </ul>
            ) : null}
          </aside>
        ) : null}
      </section>

      <SupplierForm open={open} onOpenChange={setOpen} />
    </div>
  );
}

function SupplierForm({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    start(async () => {
      const result = await createSupplierAction({
        name: String(data.get("name") ?? ""),
        contact: String(data.get("contact") ?? ""),
        category: String(data.get("category") ?? ""),
        description: String(data.get("description") ?? ""),
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
    <Modal open={open} onOpenChange={onOpenChange} title="Ajouter un fournisseur">
      <form onSubmit={onSubmit} className="space-y-3">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <input className={field} name="name" placeholder="Nom" required />
        <input className={field} name="contact" placeholder="Contact" />
        <input className={field} name="category" placeholder="Catégorie" required />
        <textarea className="min-h-20 w-full rounded-md border border-line px-3 py-2 text-sm" name="description" placeholder="Description" />
        <select className={field} name="currency" defaultValue="CAD">
          <option>CAD</option>
          <option>USD</option>
          <option>EUR</option>
        </select>
        <Button disabled={pending} type="submit">Enregistrer</Button>
      </form>
    </Modal>
  );
}

function Mark({ name, large = false }: { name: string; large?: boolean }) {
  const initials = name.split(/\s+/).filter((part) => part[0] && part[0] !== "—").slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-xl bg-[#e8f1fb] font-semibold text-[#1d4e89] ${large ? "h-12 w-12 text-sm" : "h-10 w-10 text-xs"}`}>
      {initials || "F"}
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
