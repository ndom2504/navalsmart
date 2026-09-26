"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bell, Briefcase, Building2, Calculator, FileText, GraduationCap, Link2, Save, ShieldAlert, Users, Wallet } from "lucide-react";
import { saveSettingsAction, switchWorkspaceAction } from "@/server/actions";
import type { AppSettings, WorkspaceMode } from "@/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  projects: { id: string; name: string; client: string; statusLabel: string }[];
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
                <option>CAD</option><option>USD</option><option>EUR</option>
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
        <Card title="Dossiers" hint="Liste des estimations de l'espace actif. Le statut se change dans chaque dossier.">
          {projects.length ? <ul className="divide-y divide-[#eef2f6] text-sm">
            {projects.map((project) => (
              <li key={project.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="block font-medium text-navy">{project.name}</span>
                  <span className="text-xs text-steel">{project.client}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-steel">{project.statusLabel}</span>
                  <Link href={`/estimations/${project.id}`} className="font-semibold text-[#1d6fe0]">Ouvrir</Link>
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
          <Card title="Taux de main-d'œuvre" hint="Barème de simulation, en dollars de l'heure.">
            <div className="space-y-2">
              {draft.laborRates.map((rate, index) => (
                <div key={`${rate.trade}-${index}`} className="grid grid-cols-[1fr_120px] gap-2">
                  <input className="h-10 rounded-md border border-line px-3 text-sm" value={rate.trade} onChange={(event) => setDraft({ ...draft, laborRates: draft.laborRates.map((item, itemIndex) => itemIndex === index ? { ...item, trade: event.target.value } : item) })} />
                  <input className="h-10 rounded-md border border-line px-3 text-sm" type="number" min={0} value={rate.hourlyRateCents / 100} onChange={(event) => setDraft({ ...draft, laborRates: draft.laborRates.map((item, itemIndex) => itemIndex === index ? { ...item, hourlyRateCents: Math.round(Number(event.target.value) * 100) } : item) })} />
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-steel">Unités : {draft.units.join(", ")}</p>
          </Card>
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
