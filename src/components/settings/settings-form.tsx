"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Briefcase, Building2, Calculator, FileText, GraduationCap, Link2, Plus, Save, ShieldAlert, Trash2, Users, Wallet } from "lucide-react";
import { saveSettingsAction, switchWorkspaceAction } from "@/server/actions";
import type { AppSettings, UnitCost, WorkspaceMode } from "@/domain/types";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { ProjectAvatarEditor } from "@/components/projects/project-avatar-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CAD_PER_UNIT, MARKET_ACTIVITIES, MARKET_REGIONS, MARKET_YEAR, marketActivityValues, marketLaborRates, marketRegion, PROJECT_CURRENCIES, WORK_CATEGORY_LABELS, type WorkCategory } from "@/domain/market";
import { formatMoney, formatNumber } from "@/lib/format";
import { id } from "@/lib/utils";

const tabs = [
  ["general", "Général", Building2],
  ["users", "Utilisateurs", Users],
  ["projects", "Projets", FileText],
  ["estimates", "Estimations", Calculator],
  ["costs", "Coûts", Wallet],
  ["suppliers", "Fournisseurs", Link2],
  ["risks", "Risques", ShieldAlert],
  ["reports", "Rapports", FileText],
  ["integrations", "Intégrations", Link2],
] as const;

export type SettingsTab = (typeof tabs)[number][0];

const field = "mt-1 h-10 w-full rounded-md border border-line px-3 text-sm";

export function SettingsForm({
  settings,
  profile,
  openaiConfigured,
  projects,
  supplierCount,
  workspaceMode,
  initialTab = "general",
}: {
  settings: AppSettings;
  profile: { name: string; email: string; jobTitle: string; companyName: string; role: string };
  openaiConfigured: boolean;
  projects: { id: string; name: string; avatarUrl: string | null; client: string; statusLabel: string }[];
  supplierCount: number;
  workspaceMode: WorkspaceMode;
  initialTab?: SettingsTab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [draft, setDraft] = useState(settings);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const [workspacePending, startWorkspace] = useTransition();

  function save() {
    setSaved(false);
    start(async () => {
      const result = await saveSettingsAction(draft);
      if ("error" in result && result.error) setError(result.error);
      else {
        setError(null);
        setSaved(true);
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-steel">Paramètres</p>
      <section className="relative overflow-hidden rounded-2xl text-white">
        <img src="/brand/banner-shipyard.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_35%]" />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(8,24,48,0.82)_0%,rgba(8,24,48,0.4)_70%)]" />
        <div className="relative p-6">
          <h1 className="text-3xl font-semibold">Paramètres</h1>
          <p className="mt-1 text-sm text-white/80">Réglages utilisés par les nouvelles estimations et les notifications.</p>
        </div>
      </section>

      <div className="flex gap-1 overflow-x-auto border-b border-[#e6edf4] text-sm">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-2 px-3 py-2 ${tab === id ? "border-b-2 border-[#1d6fe0] font-semibold text-navy" : "text-steel"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {saved ? <p className="text-sm text-success">Paramètres enregistrés.</p> : null}

      {tab === "general" ? (
        <>
        <section className="rounded-2xl border border-[#e6edf4] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-navy">Espace de travail</h2>
          <p className="mt-1 text-sm text-steel">La démonstration charge les dossiers simulés. Le mode réel ouvre un espace séparé, vide au départ. Chaque espace conserve ses propres dossiers.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={workspacePending} onClick={() => startWorkspace(async () => { await switchWorkspaceAction("demo"); router.refresh(); })} className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold ${workspaceMode === "demo" ? "bg-[#1d6fe0] text-white" : "border border-[#d7e0ea] text-navy"}`}>
              <GraduationCap className="h-4 w-4" /> Démonstration
            </button>
            <button type="button" disabled={workspacePending} onClick={() => startWorkspace(async () => { await switchWorkspaceAction("real"); router.refresh(); })} className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold ${workspaceMode === "real" ? "bg-[#1d6fe0] text-white" : "border border-[#d7e0ea] text-navy"}`}>
              <Briefcase className="h-4 w-4" /> Réel
            </button>
          </div>
        </section>
        <section className="grid gap-4 xl:grid-cols-3">
          <Card title="Informations de l'entreprise" hint="Profil de formation, non modifiable ici.">
            <p className="text-sm font-medium text-navy">{profile.companyName}</p>
            <p className="mt-2 text-sm text-steel">{profile.name} · {profile.jobTitle}</p>
            <p className="text-sm text-steel">{profile.email}</p>
            <label className="mt-4 block text-sm text-steel">Devise par défaut
              <select className={field} value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value })}>
                {PROJECT_CURRENCIES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
            </label>
          </Card>
          <Card title="Préférences générales" hint="Valeurs appliquées aux nouveaux dossiers.">
            <p className="text-sm text-navy">Langue de l&apos;interface : français</p>
            <p className="mt-2 text-sm text-navy">Dates affichées au format français (Canada)</p>
            <label className="mt-4 flex items-center justify-between gap-3 text-sm text-navy">
              Mode apprentissage pour les nouveaux dossiers
              <Switch checked={draft.defaultLearningMode} onChange={(checked) => setDraft({ ...draft, defaultLearningMode: checked })} />
            </label>
          </Card>
          <Card title="Notifications" hint="Alertes du tableau de bord.">
            <Toggle label="Informations manquantes" checked={draft.notifications.missingInfo} onChange={(checked) => setDraft({ ...draft, notifications: { ...draft.notifications, missingInfo: checked } })} />
            <Toggle label="Alertes de risques" checked={draft.notifications.risks} onChange={(checked) => setDraft({ ...draft, notifications: { ...draft.notifications, risks: checked } })} />
            <Toggle label="Soumissions fournisseurs" checked={draft.notifications.supplierQuotes} onChange={(checked) => setDraft({ ...draft, notifications: { ...draft.notifications, supplierQuotes: checked } })} />
          </Card>
        </section>
        </>
      ) : null}

      {tab === "users" ? (
        <Card title="Utilisateur de la formation" hint="Un seul compte est actif dans cette simulation.">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-steel"><tr>{["Nom", "Courriel", "Rôle", "Statut"].map((label) => <th key={label} className="px-2 py-2 font-medium">{label}</th>)}</tr></thead>
            <tbody>
              <tr className="border-t border-[#eef2f6]">
                <td className="px-2 py-3 font-medium text-navy">{profile.name}</td>
                <td className="px-2 py-3">{profile.email}</td>
                <td className="px-2 py-3">{profile.role === "ESTIMATOR" ? "Estimateur" : profile.role}</td>
                <td className="px-2 py-3"><Badge tone="success">Actif</Badge></td>
              </tr>
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === "projects" ? (
        <Card title="Dossiers" hint="Liste des estimations de l'espace actif. Cliquez sur une vignette pour importer l'image du projet (10 Mo au plus) ; le statut se change dans chaque dossier.">
          {projects.length ? <ul className="divide-y divide-[#eef2f6] text-sm">
            {projects.map((project) => (
              <li key={project.id} className="flex items-center justify-between gap-3 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <ProjectAvatarEditor projectId={project.id} name={project.name} src={project.avatarUrl} compact size="md" />
                  <span className="min-w-0">
                    <span className="block font-medium text-navy">{project.name}</span>
                    <span className="text-xs text-steel">{project.client}</span>
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-steel">{project.statusLabel}</span>
                  <Link href={`/estimations/${project.id}`} className="font-semibold text-[#1d6fe0]">Ouvrir</Link>
                  <DeleteProjectButton projectId={project.id} name={project.name} label="Supprimer" className="inline-flex items-center gap-1 text-sm text-steel hover:text-danger" />
                </span>
              </li>
            ))}
          </ul> : <p className="text-sm text-steel">Aucun dossier. Le mode réel démarre à zéro.</p>}
        </Card>
      ) : null}

      {tab === "estimates" ? (
        <Card title="Estimations" hint="Le facteur d'heures supplémentaires sert au calcul de la main-d'œuvre.">
          <label className="block text-sm text-steel">Facteur d&apos;heures supplémentaires
            <input className={field} type="number" min={1} max={3} step="0.1" value={draft.overtimeFactor} onChange={(event) => setDraft({ ...draft, overtimeFactor: Number(event.target.value) })} />
          </label>
          <p className="mt-4 text-sm text-navy">Modèle d&apos;analyse : {draft.aiModel}</p>
          <label className="mt-3 block text-sm text-steel">Nom du modèle
            <input className={field} value={draft.aiModel} onChange={(event) => setDraft({ ...draft, aiModel: event.target.value })} />
          </label>
        </Card>
      ) : null}

      {tab === "costs" ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <Card title="Pourcentages par défaut" hint="Appliqués à la création d'un dossier. Chaque estimation peut les modifier.">
            <label className="block text-sm text-steel">Frais indirects (%)
              <input className={field} type="number" min={0} max={100} value={draft.overheadPct} onChange={(event) => setDraft({ ...draft, overheadPct: Number(event.target.value) })} />
            </label>
            <label className="mt-3 block text-sm text-steel">Contingence (%)
              <input className={field} type="number" min={0} max={100} value={draft.contingencyPct} onChange={(event) => setDraft({ ...draft, contingencyPct: Number(event.target.value) })} />
            </label>
            <label className="mt-3 block text-sm text-steel">Marge (%)
              <input className={field} type="number" min={0} max={100} value={draft.marginPct} onChange={(event) => setDraft({ ...draft, marginPct: Number(event.target.value) })} />
            </label>
          </Card>
          <Card title="Taux de main-d'œuvre" hint="Barème en dollars de l'heure. Un taux à 0 reste à saisir.">
            <div className="space-y-2">
              {draft.laborRates.map((rate, index) => (
                <div key={index} className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
                  <input aria-label="Métier" className="h-10 rounded-md border border-line px-3 text-sm" value={rate.trade} onChange={(event) => setDraft({ ...draft, laborRates: draft.laborRates.map((item, itemIndex) => itemIndex === index ? { ...item, trade: event.target.value } : item) })} />
                  <input aria-label={`Taux ${rate.trade}`} className={`h-10 rounded-md border px-3 text-sm ${rate.hourlyRateCents === 0 ? "border-warning bg-[#fff8eb]" : "border-line"}`} type="number" min={0} step="0.01" value={rate.hourlyRateCents / 100} onChange={(event) => setDraft({ ...draft, laborRates: draft.laborRates.map((item, itemIndex) => itemIndex === index ? { ...item, hourlyRateCents: Math.round(Number(event.target.value) * 100) } : item) })} />
                  <button type="button" aria-label={`Retirer ${rate.trade}`} className="text-steel hover:text-danger" onClick={() => setDraft({ ...draft, laborRates: draft.laborRates.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <button type="button" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#1d6fe0]" onClick={() => setDraft({ ...draft, laborRates: [...draft.laborRates, { trade: "", hourlyRateCents: 0 }] })}><Plus className="h-4 w-4" /> Ajouter un métier</button>
            {draft.laborRates.some((rate) => rate.hourlyRateCents === 0) ? <p className="mt-2 text-xs text-warning">Les métiers à 0 $/h donnent une main-d&apos;œuvre nulle tant que leur taux n&apos;est pas saisi.</p> : null}
            <p className="mt-3 text-xs text-steel">Unités : {draft.units.join(", ")}</p>
          </Card>
          <div className="min-w-0 xl:col-span-2">
            <MarketReference draft={draft} setDraft={setDraft} />
          </div>
          <div className="min-w-0 xl:col-span-2">
            <UnitCostLibrary items={draft.unitCosts} trades={draft.laborRates.map((rate) => rate.trade).filter(Boolean)} units={draft.units} onChange={(unitCosts) => setDraft({ ...draft, unitCosts })} />
          </div>
        </section>
      ) : null}

      {tab === "suppliers" ? (
        <Card title="Fournisseurs" hint={`${supplierCount} fiche${supplierCount > 1 ? "s" : ""} dans le répertoire.`}>
          <Toggle label="Notifier les soumissions fournisseurs" checked={draft.notifications.supplierQuotes} onChange={(checked) => setDraft({ ...draft, notifications: { ...draft.notifications, supplierQuotes: checked } })} />
          <Link href="/fournisseurs" className="mt-4 inline-flex text-sm font-semibold text-[#1d6fe0]">Ouvrir le répertoire</Link>
        </Card>
      ) : null}

      {tab === "risks" ? (
        <Card title="Risques" hint="L'alerte du tableau de bord suit ce réglage.">
          <Toggle label="Alertes de risques" checked={draft.notifications.risks} onChange={(checked) => setDraft({ ...draft, notifications: { ...draft.notifications, risks: checked } })} />
          <Link href="/risques" className="mt-4 inline-flex text-sm font-semibold text-[#1d6fe0]">Ouvrir le registre</Link>
        </Card>
      ) : null}

      {tab === "reports" ? (
        <Card title="Rapports" hint="Un rapport est produit depuis une estimation. Il n'existe pas de file de génération séparée.">
          <Link href="/rapports" className="inline-flex h-10 items-center rounded-lg bg-[#1d6fe0] px-4 text-sm font-semibold text-white">Ouvrir le centre de rapports</Link>
        </Card>
      ) : null}

      {tab === "integrations" ? (
        <Card title="Intégrations" hint="Seule l'analyse IA dépend d'une clé serveur. La clé n'est jamais affichée.">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>
              <span className="block font-medium text-navy">Analyse IA</span>
              <span className="text-xs text-steel">Modèle {draft.aiModel}</span>
            </span>
            <Badge tone={openaiConfigured ? "success" : "steel"}>{openaiConfigured ? "Connecté" : "Non connecté"}</Badge>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <span>
              <span className="block font-medium text-navy">Microsoft</span>
              <span className="text-xs text-steel">Connexion non activée pour la formation.</span>
            </span>
            <Badge tone="steel">Non activé</Badge>
          </div>
        </Card>
      ) : null}

      {tab !== "users" && tab !== "projects" && tab !== "reports" && tab !== "integrations" ? (
        <Button disabled={pending} onClick={save}><Save className="h-4 w-4" /> Enregistrer</Button>
      ) : null}
    </div>
  );
}

const cell = "h-9 w-full rounded-md border border-line px-2 text-sm";

function MarketReference({ draft, setDraft }: { draft: AppSettings; setDraft: (settings: AppSettings) => void }) {
  const [code, setCode] = useState(draft.market.defaultRegion);
  const [category, setCategory] = useState<WorkCategory | "ALL">("ALL");
  const [copied, setCopied] = useState<string | null>(null);
  const region = marketRegion(code) ?? MARKET_REGIONS[0]!;
  const localRates = marketLaborRates(region);
  const convertible = Boolean(CAD_PER_UNIT[draft.currency]);
  const ratesInSettings = convertible ? marketLaborRates(region, draft.currency) : [];
  const activities = MARKET_ACTIVITIES.filter((activity) => category === "ALL" || activity.category === category);
  const money = (cents: number | null) => (cents === null ? "—" : formatMoney(cents, region.currency, 2));

  function copyRates() {
    const rates = [...draft.laborRates];
    let count = 0;
    for (const rate of ratesInSettings) {
      const index = rates.findIndex((item) => item.trade.toLowerCase() === rate.trade.toLowerCase());
      if (index < 0) rates.push(rate);
      else if (rates[index]!.hourlyRateCents === 0) rates[index] = { ...rates[index]!, hourlyRateCents: rate.hourlyRateCents };
      else continue;
      count += 1;
    }
    setDraft({ ...draft, laborRates: rates });
    setCopied(`${count} taux copiés dans votre barème (métiers absents ou à 0 $/h). Enregistrez pour les conserver.`);
  }

  function copyActivities() {
    const existing = new Set(draft.unitCosts.map((item) => `${item.name}|${item.unit}`.toLowerCase()));
    const added: UnitCost[] = activities
      .filter((activity) => activity.percentOfDirect === undefined && !existing.has(`${activity.name}|${activity.unit}`.toLowerCase()))
      .map((activity) => {
        const values = marketActivityValues(activity, region, draft.currency);
        return {
          id: id("uc"),
          name: activity.name,
          keywords: activity.keywords,
          unit: activity.unit,
          trade: activity.trade,
          hoursPerUnit: values.hoursPerUnit,
          materialsCentsPerUnit: activity.materials > 0 ? values.materialsCentsPerUnit : null,
          equipmentCentsPerUnit: activity.equipment > 0 ? values.equipmentCentsPerUnit : null,
          subcontractCentsPerUnit: null,
        };
      });
    setDraft({ ...draft, unitCosts: [...draft.unitCosts, ...added] });
    setCopied(`${added.length} ouvrages copiés dans votre bibliothèque, modifiables. Enregistrez pour les conserver.`);
  }

  return (
    <Card title={`Référentiel de marché (IA) · ${MARKET_YEAR}`} hint="Base de travail générée par NavalSmart AI : taux horaires chargés par métier, heures et coûts par unité d'ouvrage, selon le pays ou la province. Valeurs indicatives, à valider. Vos taux et votre bibliothèque passent toujours en premier.">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
        <label className="flex items-center justify-between gap-3 text-sm text-navy">
          Pré-remplir les estimations avec le marché
          <Switch checked={draft.market.enabled} onChange={(enabled) => setDraft({ ...draft, market: { ...draft.market, enabled } })} />
        </label>
        <label className="block text-sm text-steel">Marché par défaut (lieu non reconnu)
          <select className={field} value={draft.market.defaultRegion} onChange={(event) => setDraft({ ...draft, market: { ...draft.market, defaultRegion: event.target.value } })}>
            {MARKET_REGIONS.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
          </select>
        </label>
        <label className="block text-sm text-steel">Consulter un marché
          <select className={field} value={code} onChange={(event) => setCode(event.target.value)}>
            {MARKET_REGIONS.map((item) => <option key={item.code} value={item.code}>{item.label} ({item.currency})</option>)}
          </select>
        </label>
      </div>
      <p className="mt-3 rounded-md bg-background p-3 text-xs leading-5 text-steel">
        {region.basis} Devise : {region.currency}. Productivité : × {formatNumber(region.productivityFactor, 2)} sur les heures. Le projet prend le marché de son lieu de travaux (ville, province ou pays), sinon de sa devise, sinon le marché par défaut ; vous pouvez le changer dans l&apos;estimation.
      </p>
      {copied ? <p className="mt-2 text-sm text-success">{copied}</p> : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-navy">Taux chargés par métier</h3>
            <button type="button" disabled={!convertible} className="text-sm font-semibold text-[#1d6fe0] disabled:text-steel" onClick={copyRates}>Copier dans mon barème</button>
          </div>
          <div className="mt-2 max-h-96 overflow-auto rounded-md border border-[#eef2f6]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs text-steel"><tr><th className="px-2 py-2 font-medium">Métier</th><th className="px-2 py-2 text-right font-medium">Taux / h</th></tr></thead>
              <tbody>
                {localRates.map((rate) => (
                  <tr key={rate.trade} className="border-t border-[#eef2f6]">
                    <td className="px-2 py-1.5">{rate.trade}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(rate.hourlyRateCents, region.currency, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-navy">Ouvrages ({activities.length})</h3>
            <div className="flex items-center gap-3">
              <select aria-label="Catégorie" className="h-8 rounded-md border border-line px-2 text-sm" value={category} onChange={(event) => setCategory(event.target.value as WorkCategory | "ALL")}>
                <option value="ALL">Toutes les catégories</option>
                {Object.entries(WORK_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button type="button" disabled={!convertible} className="text-sm font-semibold text-[#1d6fe0] disabled:text-steel" onClick={copyActivities}>Copier dans ma bibliothèque</button>
            </div>
          </div>
          <div className="mt-2 max-h-96 overflow-auto rounded-md border border-[#eef2f6]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs text-steel">
                <tr>{["Ouvrage", "Unité", "Métier", "h / unité", "Matériaux", "Équipement"].map((label) => <th key={label} className="px-2 py-2 font-medium">{label}</th>)}</tr>
              </thead>
              <tbody>
                {activities.map((activity) => {
                  const values = marketActivityValues(activity, region);
                  return (
                    <tr key={activity.id} className="border-t border-[#eef2f6] align-top">
                      <td className="px-2 py-1.5">{activity.name}<span className="block text-xs text-steel">{WORK_CATEGORY_LABELS[activity.category]}</span></td>
                      <td className="px-2 py-1.5">{activity.unit}</td>
                      <td className="px-2 py-1.5">{activity.trade}</td>
                      {activity.percentOfDirect !== undefined ? (
                        <td className="px-2 py-1.5" colSpan={3}>{formatNumber(activity.percentOfDirect, 1)} % des coûts directs</td>
                      ) : (
                        <>
                          <td className="px-2 py-1.5 tabular-nums">{formatNumber(values.hoursPerUnit, 3)}</td>
                          <td className="px-2 py-1.5 tabular-nums">{activity.materials > 0 ? money(values.materialsCentsPerUnit) : "—"}</td>
                          <td className="px-2 py-1.5 tabular-nums">{activity.equipment > 0 ? money(values.equipmentCentsPerUnit) : "—"}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Card>
  );
}

function UnitCostLibrary({ items, trades, units, onChange }: { items: UnitCost[]; trades: string[]; units: string[]; onChange: (items: UnitCost[]) => void }) {
  const update = (itemId: string, patch: Partial<UnitCost>) => onChange(items.map((item) => item.id === itemId ? { ...item, ...patch } : item));
  const add = () => onChange([...items, { id: id("uc"), name: "", keywords: [], unit: "", trade: "", hoursPerUnit: null, materialsCentsPerUnit: null, equipmentCentsPerUnit: null, subcontractCentsPerUnit: null }]);
  const dollars = (cents: number | null) => (cents === null ? "" : cents / 100);
  const toCents = (value: string) => (value.trim() === "" ? null : Math.round(Number(value) * 100));
  return (
    <Card title="Bibliothèque de coûts unitaires" hint="Vos coûts par unité d'ouvrage. À l'import d'un appel d'offres, chaque quantité citée est multipliée par l'ouvrage de même unité dont un mot-clé figure dans le lot. Une case vide n'est pas chiffrée.">
      {items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="text-xs text-steel">
              <tr>{["Ouvrage", "Mots-clés (séparés par des virgules)", "Unité", "Métier", "Heures / unité", "Matériaux $ / unité", "Équipement $ / unité", "Sous-traitance $ / unité", ""].map((label) => <th key={label} className="px-1 py-2 font-medium">{label}</th>)}</tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-[#eef2f6] align-top">
                  <td className="px-1 py-2"><input aria-label="Ouvrage" className={cell} value={item.name} placeholder="Excavation" onChange={(event) => update(item.id, { name: event.target.value })} /></td>
                  <td className="px-1 py-2"><KeywordsInput value={item.keywords} onChange={(keywords) => update(item.id, { keywords })} /></td>
                  <td className="w-24 px-1 py-2">
                    <input aria-label="Unité" className={cell} list="unit-options" value={item.unit} placeholder="m³" onChange={(event) => update(item.id, { unit: event.target.value })} />
                  </td>
                  <td className="w-48 px-1 py-2">
                    <select aria-label="Métier" className={cell} value={item.trade} onChange={(event) => update(item.id, { trade: event.target.value })}>
                      <option value="">Selon le lot</option>
                      {trades.map((trade) => <option key={trade} value={trade}>{trade}</option>)}
                    </select>
                  </td>
                  <td className="w-28 px-1 py-2"><input aria-label="Heures par unité" className={cell} type="number" min={0} step="any" value={item.hoursPerUnit ?? ""} onChange={(event) => update(item.id, { hoursPerUnit: event.target.value.trim() === "" ? null : Number(event.target.value) })} /></td>
                  <td className="w-28 px-1 py-2"><input aria-label="Matériaux par unité" className={cell} type="number" min={0} step="0.01" value={dollars(item.materialsCentsPerUnit)} onChange={(event) => update(item.id, { materialsCentsPerUnit: toCents(event.target.value) })} /></td>
                  <td className="w-28 px-1 py-2"><input aria-label="Équipement par unité" className={cell} type="number" min={0} step="0.01" value={dollars(item.equipmentCentsPerUnit)} onChange={(event) => update(item.id, { equipmentCentsPerUnit: toCents(event.target.value) })} /></td>
                  <td className="w-28 px-1 py-2"><input aria-label="Sous-traitance par unité" className={cell} type="number" min={0} step="0.01" value={dollars(item.subcontractCentsPerUnit)} onChange={(event) => update(item.id, { subcontractCentsPerUnit: toCents(event.target.value) })} /></td>
                  <td className="px-1 py-2"><button type="button" aria-label={`Retirer ${item.name || "l'ouvrage"}`} className="mt-2 text-steel hover:text-danger" onClick={() => onChange(items.filter((current) => current.id !== item.id))}><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="unit-options">{units.map((unit) => <option key={unit} value={unit} />)}</datalist>
        </div>
      ) : (
        <p className="text-sm text-steel">Aucun ouvrage. Ajoutez vos coûts unitaires (par exemple l&apos;excavation au m³) pour chiffrer automatiquement les quantités des appels d&apos;offres.</p>
      )}
      <button type="button" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#1d6fe0]" onClick={add}><Plus className="h-4 w-4" /> Ajouter un ouvrage</button>
    </Card>
  );
}

function KeywordsInput({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const [text, setText] = useState(value.join(", "));
  return (
    <input
      aria-label="Mots-clés"
      className={cell}
      value={text}
      placeholder="excavation, terrassement"
      onChange={(event) => {
        setText(event.target.value);
        onChange(event.target.value.split(",").map((word) => word.trim()).filter((word) => word.length >= 2));
      }}
    />
  );
}

function Card({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-[#e6edf4] bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-navy">{title}</h2>
      <p className="mt-1 text-xs text-steel">{hint}</p>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="mt-3 flex items-center justify-between gap-3 text-sm text-navy">
      {label}
      <Switch checked={checked} onChange={onChange} />
    </label>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full ${checked ? "bg-[#1d6fe0]" : "bg-slate-300"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${checked ? "left-5" : "left-0.5"}`} />
    </button>
  );
}
