"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Check, Database, FolderOpen, Pencil, Plus, ShieldAlert, Share2, TriangleAlert } from "lucide-react";
import { financialSummary, resolveLine } from "@/domain/calculations";
import { completenessScore } from "@/domain/completeness";
import { learningNotes, lineTeaching } from "@/domain/learning";
import type { EquipmentCost, EstimateLine, LaborCost, MaterialCost, MissingInformation, Project, Subcontractor, Supplier, SupplierQuote, WorkPackage } from "@/domain/types";
import {
  analyzeAction,
  chatAction,
  decideReviewAction,
  recalculateAction,
  reviewAction,
  saveAssumptionsAction,
  saveEquipmentAction,
  saveLaborAction,
  saveLinesAction,
  saveMaterialsAction,
  saveMissingAction,
  savePackagesAction,
  saveProjectAction,
  saveQuotesAction,
  saveRisksAction,
  saveSubcontractorsAction,
} from "@/server/actions";
import { CostSplit } from "@/components/dashboard/cost-split";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatBytes, formatCompactMoney, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { documentStatusLabels, lineStatusLabels, projectStatusLabels, projectTypeLabels, provenanceLabels, quoteStatusLabels, riskLevelLabels, unspecified } from "@/lib/labels";
import { id } from "@/lib/utils";

const steps = ["Lecture du document", "Extraction des informations", "Analyse de la portée", "Détection des travaux", "Identification des coûts", "Détection des risques", "Construction de l'estimation"];

const nav = [
  ["overview", "Aperçu"],
  ["document", "Appel d'offres"],
  ["analysis", "Analyse"],
  ["packages", "Lots"],
  ["estimate", "Estimation"],
  ["labor", "Main-d'œuvre"],
  ["materials", "Matériaux"],
  ["equipment", "Équipements"],
  ["suppliers", "Fournisseurs"],
  ["subcontractors", "Sous-traitants"],
  ["risks", "Risques"],
  ["assumptions", "Hypothèses"],
  ["missing", "Manquants"],
  ["review", "Revue IA"],
  ["assistant", "Assistant"],
  ["history", "Historique"],
] as const;

const field = "h-10 w-full min-w-36 rounded-md border border-line bg-white px-2 text-sm";
const area = "min-h-20 w-full rounded-md border border-line bg-white px-2 py-2 text-sm";

export function EstimateWorkspace({
  project,
  suppliers,
  weights,
  section,
}: {
  project: Project;
  suppliers: Supplier[];
  weights: Record<string, number>;
  section: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(section);
  const [lines, setLines] = useState(project.lines);
  const [packages, setPackages] = useState(project.workPackages);
  const [labor, setLabor] = useState(project.labor);
  const [materials, setMaterials] = useState(project.materials);
  const [equipment, setEquipment] = useState(project.equipment);
  const [quotes, setQuotes] = useState(project.quotes);
  const [subs, setSubs] = useState(project.subcontractors);
  const [assumptions, setAssumptions] = useState(project.assumptions);
  const [missing, setMissing] = useState(project.missing);
  const [parameters, setParameters] = useState({
    contingencyPct: project.contingencyPct,
    overheadPct: project.overheadPct,
    marginPct: project.marginPct,
    learningMode: project.learningMode,
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [explainId, setExplainId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [pending, start] = useTransition();
  const [exportOpen, setExportOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(project.name);

  const draft = useMemo<Project>(
    () => ({
      ...project,
      ...parameters,
      lines,
      workPackages: packages,
      labor,
      materials,
      equipment,
      quotes,
      subcontractors: subs,
      risks: project.risks,
      assumptions,
      missing,
    }),
    [project, parameters, lines, packages, labor, materials, equipment, quotes, subs, assumptions, missing],
  );
  const summary = financialSummary(draft);
  const score = completenessScore(draft, weights);
  const notes = parameters.learningMode ? learningNotes(draft) : null;
  const explained = explainId ? draft.lines.find((line) => line.id === explainId) : undefined;
  const explainedCost = explainId ? resolveLine(draft, explainId) : undefined;

  function run(work: () => Promise<{ error?: string; ok?: boolean }>) {
    setError(null);
    setNotice(null);
    start(async () => {
      const result = await work();
      if ("error" in result && result.error) setError(result.error);
      else {
        setNotice("Enregistré.");
        router.refresh();
      }
    });
  }

  async function upload(file: File) {
    setError(null);
    const body = new FormData();
    body.set("file", file);
    body.set("projectId", project.id);
    const response = await fetch("/api/documents/upload", { method: "POST", body });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) setError(payload.error ?? "Import impossible.");
    else {
      setNotice("Document importé. Vous pouvez lancer l'analyse.");
      setCurrent("document");
      router.refresh();
    }
  }

  function analyze() {
    setAnalyzing(true);
    setStepIndex(0);
    const timer = window.setInterval(() => setStepIndex((value) => Math.min(value + 1, steps.length - 1)), 650);
    start(async () => {
      const result = await analyzeAction(project.id);
      window.clearInterval(timer);
      setAnalyzing(false);
      setStepIndex(steps.length);
      if ("error" in result && result.error) setError(result.error);
      else {
        setNotice("Analyse terminée. Vérifiez chaque extrait avant de l'utiliser.");
        setCurrent("analysis");
        router.refresh();
      }
    });
  }

  const document = project.tender?.documents[0];
  const openMissing = missing.filter((item) => item.status === "OPEN");
  const packageRows = packageCosts(draft, packages, lines);
  const packageTotal = packageRows.reduce((sum, row) => sum + row.cents, 0);
  const slices = packageRows.map((row, index) => ({
    name: row.name,
    value: row.cents,
    color: ["#1d4e89", "#2f6fad", "#5b93d6", "#8fb4e3", "#b9d0ec", "#d5e2f0", "#9aa8b8", "#6e7f92"][index % 8],
  }));
  const revisions = [...project.revisions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const trend = (revisions.length ? revisions : [{ createdAt: project.updatedAt, snapshot: summary }]).map((revision) => ({
    label: new Intl.DateTimeFormat("fr-CA", { month: "short" }).format(new Date(revision.createdAt)).replace(".", ""),
    total: Math.round(revision.snapshot.estimatedCents / 100),
    count: 0,
  }));
  const stage = current === "packages" ? 2 : current === "estimate" || current === "labor" || current === "materials" || current === "equipment" || current === "suppliers" || current === "subcontractors" ? 3 : current === "risks" || current === "assumptions" || current === "missing" || current === "review" ? 4 : current === "history" ? 5 : 1;
  const stages = [
    { label: "Analyse du document", go: () => setCurrent("document") },
    { label: "Lots de travaux", go: () => setCurrent("packages") },
    { label: "Quantités & coûts", go: () => setCurrent("estimate") },
    { label: "Risques & hypothèses", go: () => setCurrent("risks") },
    { label: "Résumé & rapport", go: () => router.push(`/estimations/${project.id}/rapport`) },
  ];
  const analysisChecks = project.analysis
    ? [
        { label: "Extraction des informations clés", done: Boolean(project.analysis.summary) },
        { label: "Identification des exigences", done: project.analysis.requirements.length > 0 },
        { label: "Décomposition en lots de travaux", done: project.analysis.detectedWork.length > 0 },
        { label: "Quantités et contraintes détectées", done: project.analysis.quantities.length > 0 || project.analysis.constraints.length > 0 },
      ]
    : [];

  return (
    <div className="space-y-5">
      <p className="text-sm text-steel">
        <Link href="/estimations" className="hover:text-navy">Estimations</Link>
        <span className="px-2">/</span>
        <span className="text-navy">{project.name}</span>
      </p>

      <section className="relative overflow-hidden rounded-2xl text-white">
        <img src="/brand/banner-shipyard.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_40%]" />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(8,24,48,0.82)_0%,rgba(8,24,48,0.55)_55%,rgba(8,24,48,0.28)_100%)]" />
        <div className="relative space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {editingName ? (
                <input
                  className="h-10 w-full max-w-xl rounded-md border border-white/40 bg-white/15 px-3 text-2xl font-semibold text-white outline-none"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onBlur={() => {
                    setEditingName(false);
                    if (nameDraft.trim().length >= 3 && nameDraft !== project.name) run(() => saveProjectAction(project.id, { name: nameDraft.trim() }));
                  }}
                />
              ) : (
                <h1 className="flex items-center gap-2 text-2xl font-semibold sm:text-3xl">
                  {project.name}
                  <button type="button" aria-label="Modifier le nom" onClick={() => setEditingName(true)}><Pencil className="h-4 w-4" /></button>
                </h1>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/85">
                <span>{project.client}</span>
                <span>{project.vessel}</span>
                <span>{projectTypeLabels[project.type]}</span>
                <span>{formatDate(project.receivedAt ?? project.updatedAt)}</span>
                <Badge tone={project.status === "VALIDATED" || project.status === "SUBMITTED" ? "success" : project.status === "TO_VALIDATE" ? "warning" : "technical"}>{projectStatusLabels[project.status]}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-3 text-sm" onClick={() => { void navigator.clipboard?.writeText(window.location.href); setNotice("Lien de l'estimation copié."); }}>
                <Share2 className="h-4 w-4" /> Partager
              </button>
              <div className="relative">
                <button type="button" className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-3 text-sm" onClick={() => setExportOpen((open) => !open)}>Exporter</button>
                {exportOpen ? (
                  <div className="absolute right-0 z-20 mt-2 w-44 rounded-lg bg-white p-1 text-sm text-navy shadow-lg">
                    <a className="block rounded-md px-3 py-2 hover:bg-background" href={`/api/estimates/${project.id}/export`}>Excel</a>
                    <Link className="block rounded-md px-3 py-2 hover:bg-background" href={`/estimations/${project.id}/rapport`}>Rapport</Link>
                  </div>
                ) : null}
              </div>
              <button type="button" className="inline-flex h-10 items-center rounded-lg bg-[#1d6fe0] px-4 text-sm font-semibold" disabled={pending} onClick={() => run(() => saveProjectAction(project.id, { status: "VALIDATED", validationNote: "Validée par l'estimateur après revue des sources." }))}>
                Valider l&apos;estimation
              </button>
            </div>
          </div>
          <ol className="flex flex-wrap items-center gap-3 text-sm">
            {stages.map((item, index) => (
              <li key={item.label} className="flex items-center gap-3">
                <button type="button" onClick={item.go} className="flex items-center gap-2">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${stage === index + 1 ? "bg-[#1d6fe0]" : "bg-white/20"}`}>{index + 1}</span>
                  <span className={stage === index + 1 ? "font-semibold" : "text-white/80"}>{item.label}</span>
                </button>
                {index < stages.length - 1 ? <span className="hidden h-px w-8 bg-white/30 sm:block" /> : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <p className="text-xs text-steel">Complétude de l&apos;estimation · {score.percent} %. {score.notice}</p>
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {notice ? <p className="rounded-md border border-line bg-white px-3 py-2 text-sm text-success">{notice}</p> : null}

      {current === "overview" ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-2xl border border-[#e6edf4] bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-navy">Document d&apos;appel d&apos;offres</h2>
              {document ? (
                <div className="mt-4 flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-[10px] font-semibold text-danger">{document.fileName.split(".").pop()?.toUpperCase()}</span>
                  <div>
                    <p className="text-sm font-medium text-navy">{document.fileName}</p>
                    <p className="text-xs text-steel">{formatBytes(document.sizeBytes)} · {formatDate(document.importedAt)}</p>
                    <p className="mt-2"><Badge tone={document.status === "COMPLETED" ? "success" : "technical"}>{project.analysis ? "Analysé par l'IA" : documentStatusLabels[document.status]}</Badge></p>
                  </div>
                </div>
              ) : <p className="mt-4 text-sm text-steel">Aucun document importé.</p>}
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" onClick={() => setCurrent("document")}>Voir le document</Button>
                <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-line px-3 text-sm">
                  Remplacer
                  <input className="hidden" type="file" accept=".pdf,.docx,.xlsx,.txt" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
                </label>
              </div>
            </article>
            <article className="rounded-2xl border border-[#e6edf4] bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-navy">Analyse IA</h2>
              {analysisChecks.length ? (
                <ul className="mt-4 space-y-2 text-sm">
                  {analysisChecks.map((item) => (
                    <li key={item.label} className="flex items-center gap-2 text-navy">
                      <Check className={`h-4 w-4 ${item.done ? "text-success" : "text-steel"}`} />
                      {item.label}
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-4 text-sm text-steel">L&apos;analyse n&apos;a pas encore été lancée.</p>}
              <button type="button" className="mt-4 text-sm font-medium text-[#1d6fe0]" onClick={() => setCurrent(project.analysis ? "analysis" : "document")}>Voir le résumé</button>
            </article>
            <article className="rounded-2xl border border-[#e6edf4] bg-white p-5 text-sm shadow-sm">
              <h2 className="font-semibold text-navy">Informations du projet</h2>
              <dl className="mt-4 space-y-2">
                {[
                  ["Client", project.client],
                  ["Navire", project.vessel],
                  ["Type de projet", projectTypeLabels[project.type]],
                  ["Lieu", project.location || "Non précisé"],
                  ["Délai de soumission", formatDate(project.submissionDeadline)],
                  ["Devise", project.currency],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-steel">{label}</dt>
                    <dd className="text-right font-medium text-navy">{value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={Database} tone="text-[#1d4e89] bg-[#e8f1fb]" label="Coût total estimé" value={formatCompactMoney(summary.estimatedCents, project.currency)} hint={`Direct ${formatCompactMoney(summary.directCents, project.currency)}`} />
            <Kpi icon={FolderOpen} tone="text-success bg-emerald-50" label="Lots de travaux" value={String(packages.length)} hint={`${packageRows.filter((row) => row.tone !== "success").length} encore ouverts`} />
            <button type="button" className="text-left" onClick={() => setCurrent("missing")}><Kpi icon={TriangleAlert} tone="text-[#c2410c] bg-[#fff1e8]" label="Informations à valider" value={String(openMissing.length)} hint="Voir la liste" /></button>
            <button type="button" className="text-left" onClick={() => setCurrent("risks")}><Kpi icon={ShieldAlert} tone="text-[#be123c] bg-[#ffe8ee]" label="Risques identifiés" value={String(project.risks.length)} hint="Voir les risques" /></button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.7fr)]">
            <article className="rounded-2xl border border-[#e6edf4] bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-navy">Lots de travaux <span className="ml-2 rounded-full bg-[#e8f1fb] px-2 py-0.5 text-xs text-[#1d4e89]">{packages.length}</span></h2>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setCurrent("packages")}>Gérer les lots</Button>
                  <Button onClick={() => setCurrent("packages")}><Plus className="h-4 w-4" /> Ajouter un lot</Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs text-steel">
                    <tr>{["#", "Lot", "Description", "Statut", "Coût estimé", "% du total", "Action"].map((label) => <th key={label} className="px-2 py-2 font-medium">{label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {packageRows.map((row, index) => (
                      <tr key={row.id} className="border-t border-[#eef2f6]">
                        <td className="px-2 py-3 text-steel">{index + 1}</td>
                        <td className="px-2 py-3 font-medium text-navy">{row.name}</td>
                        <td className="px-2 py-3 text-steel">{row.description}</td>
                        <td className="px-2 py-3"><Badge tone={row.tone}>{row.status}</Badge></td>
                        <td className="px-2 py-3 tabular-nums">{formatMoney(row.cents, project.currency)}</td>
                        <td className="px-2 py-3 tabular-nums">{packageTotal ? Math.round((row.cents / packageTotal) * 100) : 0}%</td>
                        <td className="px-2 py-3"><button type="button" className="font-medium text-[#1d6fe0]" onClick={() => setCurrent("estimate")}>Ouvrir</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
            <div className="space-y-4">
              <article className="rounded-2xl border border-[#e6edf4] bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-navy">Répartition des coûts</h2>
                <div className="mt-3">
                  <CostSplit slices={slices} totalLabel={formatCompactMoney(summary.estimatedCents, project.currency)} />
                </div>
              </article>
              <article className="rounded-2xl border border-[#e6edf4] bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-navy">Évolution du coût estimé</h2>
                <TrendChart data={trend} />
              </article>
            </div>
          </div>

          <details className="rounded-2xl border border-[#e6edf4] bg-white p-4 text-sm shadow-sm">
            <summary className="cursor-pointer font-medium text-navy">Paramètres de calcul</summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <NumberField label="Provision %" value={parameters.contingencyPct} onChange={(value) => setParameters({ ...parameters, contingencyPct: value })} />
              <NumberField label="Frais indirects %" value={parameters.overheadPct} onChange={(value) => setParameters({ ...parameters, overheadPct: value })} />
              <NumberField label="Marge %" value={parameters.marginPct} onChange={(value) => setParameters({ ...parameters, marginPct: value })} />
            </div>
            <label className="mt-3 flex items-center gap-2">
              <input type="checkbox" checked={parameters.learningMode} onChange={(event) => setParameters({ ...parameters, learningMode: event.target.checked })} />
              Mode apprentissage
            </label>
            {notes ? <p className="mt-3 rounded-md bg-background px-3 py-3 leading-6 text-steel">{notes.calculation}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button disabled={pending} onClick={() => run(() => saveProjectAction(project.id, parameters))}>Enregistrer les paramètres</Button>
              <Button variant="secondary" disabled={pending} onClick={() => run(() => recalculateAction(project.id))}>Recalculer</Button>
            </div>
          </details>
        </div>
      ) : (
        <section className="min-w-0 rounded-2xl border border-[#e6edf4] bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="text-sm font-medium text-[#1d6fe0]" onClick={() => setCurrent("overview")}>Retour à l&apos;estimation</button>
            <div className="flex gap-2 overflow-x-auto text-sm">
              {nav.filter(([key]) => key !== "overview").map(([key, label]) => (
                <button key={key} type="button" onClick={() => setCurrent(key)} className={`whitespace-nowrap rounded-md px-2 py-1 ${current === key ? "bg-navy text-white" : "text-steel"}`}>{label}</button>
              ))}
            </div>
          </div>

          {current === "document" ? (
            <DocumentPanel project={project} pending={pending} analyzing={analyzing} stepIndex={stepIndex} onUpload={upload} onAnalyze={analyze} />
          ) : null}

          {current === "analysis" ? <AnalysisPanel project={project} /> : null}
          {current === "packages" ? (
            <PackagesPanel packages={packages} setPackages={setPackages} pending={pending} onSave={() => run(() => savePackagesAction(project.id, packages))} />
          ) : null}
          {current === "estimate" ? (
            <EstimateTable lines={lines} setLines={setLines} summary={summary} currency={project.currency} pending={pending} onExplain={setExplainId} onSave={() => run(() => saveLinesAction(project.id, lines))} />
          ) : null}
          {current === "labor" ? <LaborPanel rows={labor} setRows={setLabor} currency={project.currency} pending={pending} note={notes?.labor} onSave={() => run(() => saveLaborAction(project.id, labor))} /> : null}
          {current === "materials" ? <MaterialsPanel rows={materials} setRows={setMaterials} suppliers={suppliers} currency={project.currency} pending={pending} onSave={() => run(() => saveMaterialsAction(project.id, materials))} /> : null}
          {current === "equipment" ? <EquipmentPanel rows={equipment} setRows={setEquipment} currency={project.currency} pending={pending} onSave={() => run(() => saveEquipmentAction(project.id, equipment))} /> : null}
          {current === "suppliers" ? <QuotesPanel quotes={quotes} setQuotes={setQuotes} suppliers={suppliers} packages={packages} currency={project.currency} pending={pending} note={notes?.supplier} onSave={() => run(() => saveQuotesAction(project.id, quotes))} /> : null}
          {current === "subcontractors" ? <SubsPanel rows={subs} setRows={setSubs} packages={packages} lines={lines} pending={pending} onSave={() => run(() => saveSubcontractorsAction(project.id, subs))} /> : null}
          {current === "risks" ? <RisksPanel rows={project.risks} currency={project.currency} pending={pending} note={notes?.risk} onSave={() => run(() => saveRisksAction(project.id, project.risks))} /> : null}
          {current === "assumptions" ? <AssumptionsPanel rows={assumptions} setRows={setAssumptions} pending={pending} onSave={() => run(() => saveAssumptionsAction(project.id, assumptions))} /> : null}
          {current === "missing" ? <MissingPanel rows={missing} setRows={setMissing} pending={pending} note={notes?.missing} onSave={() => run(() => saveMissingAction(project.id, missing))} /> : null}
          {current === "review" ? <ReviewPanel project={project} pending={pending} onRun={() => run(() => reviewAction(project.id))} onDecide={(reviewId, status) => run(() => decideReviewAction(project.id, { reviewId, status, note: "" }))} /> : null}
          {current === "assistant" ? (
            <AssistantPanel project={project} question={question} setQuestion={setQuestion} pending={pending} onAsk={() => run(async () => { const result = await chatAction(project.id, { message: question }); setQuestion(""); return result; })} />
          ) : null}
          {current === "history" ? <HistoryPanel project={project} /> : null}
        </section>
      )}

      <Modal open={Boolean(explained)} onOpenChange={(open) => !open && setExplainId(null)} title="Pourquoi cette valeur ?">
        {explained && explainedCost ? (
          <div className="space-y-3 text-sm leading-6">
            <p className="font-medium text-navy">{explained.description}</p>
            <p>Main-d&apos;œuvre : {explainedCost.laborFormula}</p>
            <p>Matériaux : {explainedCost.materialsFormula}</p>
            <p>Équipement : {explainedCost.equipmentFormula}</p>
            <p>Total : {formatMoney(explainedCost.directCents, project.currency)} — {provenanceLabels.SYSTEM}</p>
            <p>Source : {explained.sourceLabel}{explained.page ? ` · Page ${explained.page}` : ""}{explained.section ? ` · Section ${explained.section}` : ""}</p>
            <p>Heures : {provenanceLabels[explained.origins.hours]} · Taux : {provenanceLabels[explained.origins.rate]}</p>
            <p>Statut : {lineStatusLabels[explained.status]}</p>
            <p>{explained.explanation}</p>
            {parameters.learningMode ? <p className="rounded-md bg-background p-3 text-steel">{lineTeaching(draft, explained.id)}</p> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Kpi({ icon: Icon, tone, label, value, hint }: { icon: typeof Database; tone: string; label: string; value: string; hint: string }) {
  return (
    <article className="h-full rounded-2xl border border-[#e6edf4] bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-steel uppercase">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-navy">{value}</p>
      <p className="mt-2 text-xs text-steel">{hint}</p>
    </article>
  );
}

function packageCosts(project: Project, packages: WorkPackage[], lines: EstimateLine[]) {
  const rows = packages.map((workPackage) => {
    const related = lines.filter((line) => line.workPackageId === workPackage.id);
    return {
      id: workPackage.id,
      name: workPackage.name,
      description: workPackage.tasks.map((task) => task.name).join(", ") || "Sans tâche",
      cents: related.reduce((sum, line) => sum + resolveLine(project, line.id).directCents, 0),
      ...lotStatus(related),
    };
  });
  const loose = lines.filter((line) => !line.workPackageId);
  if (loose.length) {
    rows.push({
      id: "loose",
      name: "Hors lot",
      description: loose.map((line) => line.description).join(", "),
      cents: loose.reduce((sum, line) => sum + resolveLine(project, line.id).directCents, 0),
      ...lotStatus(loose),
    });
  }
  return rows;
}

function lotStatus(lines: EstimateLine[]): { status: string; tone: "success" | "warning" | "cyan" | "steel" } {
  if (!lines.length) return { status: "Non commencé", tone: "steel" };
  if (lines.every((line) => line.status === "USER_VERIFIED")) return { status: "Terminé", tone: "success" };
  if (lines.some((line) => line.status === "AI_GENERATED")) return { status: "À valider", tone: "warning" };
  return { status: "En cours", tone: "cyan" };
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-steel">{label}</span>
      <input className={field} type="number" min={0} step="0.1" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function DocumentPanel({ project, pending, analyzing, stepIndex, onUpload, onAnalyze }: { project: Project; pending: boolean; analyzing: boolean; stepIndex: number; onUpload: (file: File) => void; onAnalyze: () => void }) {
  const document = project.tender?.documents[0];
  return (
    <div className="space-y-4">
      <label
        className="block cursor-pointer rounded-lg border border-dashed border-line bg-background px-6 py-10 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) onUpload(file);
        }}
      >
        <p className="font-medium text-navy">Déposez votre appel d&apos;offres ici</p>
        <p className="mt-1 text-sm text-steel">PDF, DOCX, XLSX, TXT — 20 Mo maximum</p>
        <input className="mt-4 text-sm" type="file" accept=".pdf,.docx,.xlsx,.txt" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); }} />
      </label>
      {document ? (
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p>Nom du fichier : {document.fileName}</p>
          <p>Taille : {formatBytes(document.sizeBytes)}</p>
          <p>Pages : {document.pageCount ?? "Non déterminé"}</p>
          <p>Date d&apos;importation : {formatDateTime(document.importedAt)}</p>
          <p>Statut d&apos;analyse : {documentStatusLabels[document.status]}</p>
        </div>
      ) : <p className="text-sm text-steel">Aucun document importé.</p>}
      <Button disabled={!document || pending} onClick={onAnalyze}>Analyser avec NavalSmart AI</Button>
      {analyzing || stepIndex > 0 ? (
        <ol className="space-y-1 text-sm">
          {steps.map((label, index) => (
            <li key={label} className={index <= stepIndex ? "text-navy" : "text-steel"}>{index < stepIndex ? "●" : index === stepIndex && analyzing ? "○" : "·"} {label}</li>
          ))}
        </ol>
      ) : null}
      <p className="text-xs text-steel">La progression décrit le traitement. Le résultat n&apos;apparaît qu&apos;une fois l&apos;analyse terminée.</p>
    </div>
  );
}

function AnalysisPanel({ project }: { project: Project }) {
  const analysis = project.analysis;
  if (!analysis) return <p className="text-sm text-steel">Aucune analyse. Importez un document, puis lancez NavalSmart AI.</p>;
  return (
    <div className="space-y-5 text-sm">
      <p className="rounded-md border border-line bg-background px-3 py-3 leading-6">{analysis.disclaimer}</p>
      <p className="leading-6 text-navy">{analysis.summary}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Hint label="Projet" value={analysis.projectHints.name} />
        <Hint label="Client" value={analysis.projectHints.client} />
        <Hint label="Navire" value={analysis.projectHints.vessel} />
        <Hint label="Échéance" value={analysis.projectHints.deadline} />
      </div>
      <Block title="Portée" items={analysis.scope} />
      <Block title="Exigences" items={analysis.requirements} />
      <div>
        <h3 className="font-semibold text-navy">Travaux détectés</h3>
        {analysis.detectedWork.length ? analysis.detectedWork.map((work) => (
          <p key={work.id} className="mt-2">{work.name} — {work.tasks.join(", ") || unspecified}<Source page={work.page} section={work.section} /></p>
        )) : <Empty />}
      </div>
      <Block title="Quantités" items={analysis.quantities} />
      <Block title="Délais" items={analysis.deadlines} />
      <div>
        <h3 className="font-semibold text-navy">Documents requis</h3>
        {analysis.requiredDocuments.length ? analysis.requiredDocuments.map((item) => <p key={item.id} className="mt-2">{item.name}<Source page={item.page} section={item.section} /></p>) : <Empty />}
      </div>
      <Block title="Contraintes" items={analysis.constraints} />
      <div>
        <h3 className="font-semibold text-navy">Risques</h3>
        {analysis.risks.length ? analysis.risks.map((risk) => <p key={risk.id} className="mt-2">{risk.title} — {risk.justification}<Source page={risk.page} section={risk.section} /></p>) : <Empty />}
      </div>
      <div>
        <h3 className="font-semibold text-navy">Informations manquantes</h3>
        {analysis.missing.length ? analysis.missing.map((item) => <p key={item.id} className="mt-2">{item.description}<Source page={item.page} section={item.section} /></p>) : <Empty />}
      </div>
      <div>
        <h3 className="font-semibold text-navy">Hypothèses</h3>
        {analysis.assumptions.length ? analysis.assumptions.map((item) => <p key={item.id} className="mt-2">{item.description} — {provenanceLabels[item.provenance]}</p>) : <Empty />}
      </div>
    </div>
  );
}

function Hint({ label, value }: { label: string; value: string | null }) {
  return <p><span className="text-steel">{label} : </span>{value || unspecified}</p>;
}

function Empty() {
  return <p className="mt-1 text-steel">{unspecified}</p>;
}

function Source({ page, section }: { page: string | null; section: string | null }) {
  if (!page && !section) return null;
  return <span className="mt-1 block text-xs text-steel">Source : {page ? `Page ${page}` : "page non citée"}{section ? ` · Section ${section}` : ""}</span>;
}

function Block({ title, items }: { title: string; items: { id: string; text: string; page: string | null; section: string | null }[] }) {
  return (
    <div>
      <h3 className="font-semibold text-navy">{title}</h3>
      {items.length ? items.map((item) => <p key={item.id} className="mt-2">{item.text}<Source page={item.page} section={item.section} /></p>) : <Empty />}
    </div>
  );
}

function PackagesPanel({ packages, setPackages, pending, onSave }: { packages: WorkPackage[]; setPackages: (value: WorkPackage[]) => void; pending: boolean; onSave: () => void }) {
  function update(index: number, patch: Partial<WorkPackage>) {
    setPackages(packages.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }
  return (
    <div className="space-y-4">
      {packages.map((pkg, index) => (
        <article key={pkg.id} className="rounded-md border border-line p-3">
          <div className="grid gap-2 sm:grid-cols-[80px_1fr]">
            <input className={field} value={pkg.code} onChange={(event) => update(index, { code: event.target.value })} />
            <input className={field} value={pkg.name} onChange={(event) => update(index, { name: event.target.value })} />
          </div>
          <ul className="mt-3 space-y-2">
            {pkg.tasks.map((task, taskIndex) => (
              <li key={task.id} className="flex gap-2">
                <input className={field} value={task.name} onChange={(event) => {
                  const tasks = pkg.tasks.map((item, current) => current === taskIndex ? { ...item, name: event.target.value } : item);
                  update(index, { tasks });
                }} />
                <Button variant="danger" size="sm" onClick={() => update(index, { tasks: pkg.tasks.filter((item) => item.id !== task.id) })}>Supprimer</Button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => update(index, { tasks: [...pkg.tasks, { id: id("task"), name: "Nouvelle tâche", description: "", sortOrder: pkg.tasks.length + 1 }] })}>+ Tâche</Button>
            <Button size="sm" variant="secondary" onClick={() => {
              const copy = [...packages];
              const [item] = copy.splice(index, 1);
              if (!item || index === 0) return;
              copy.splice(index - 1, 0, item);
              setPackages(copy);
            }}>Monter</Button>
            <Button size="sm" variant="secondary" onClick={() => {
              const copy = [...packages];
              const [item] = copy.splice(index, 1);
              if (!item || index >= packages.length - 1) return;
              copy.splice(index + 1, 0, item);
              setPackages(copy);
            }}>Descendre</Button>
            <Button size="sm" variant="secondary" onClick={() => setPackages([...packages, { ...pkg, id: id("wp"), name: `${pkg.name} (copie)`, tasks: pkg.tasks.map((task) => ({ ...task, id: id("task") })) }])}>Dupliquer</Button>
            <Button size="sm" variant="danger" onClick={() => setPackages(packages.filter((item) => item.id !== pkg.id))}>Supprimer le lot</Button>
          </div>
        </article>
      ))}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setPackages([...packages, { id: id("wp"), name: "Nouveau lot", code: String(packages.length + 1).padStart(2, "0"), sortOrder: packages.length + 1, tasks: [] }])}>+ Ajouter un lot</Button>
        <Button disabled={pending} onClick={onSave}>Enregistrer les lots</Button>
      </div>
    </div>
  );
}

function EstimateTable({ lines, setLines, summary, currency, pending, onExplain, onSave }: { lines: EstimateLine[]; setLines: (value: EstimateLine[]) => void; summary: ReturnType<typeof financialSummary>; currency: string; pending: boolean; onExplain: (id: string) => void; onSave: () => void }) {
  function update(lineId: string, patch: Partial<EstimateLine>) {
    setLines(lines.map((line) => line.id === lineId ? { ...line, ...patch, status: patch.status ?? "USER_MODIFIED" } : line));
  }
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1280px] text-left text-xs">
          <thead className="border-b border-line text-steel">
            <tr>{["Lot", "Description", "Quantité", "Unité", "Heures", "Taux horaire", "Main-d'œuvre", "Matériaux", "Équipement", "Sous-traitance", "Autres", "Coût total", "Source", "Statut", ""].map((label) => <th key={label} className="px-2 py-2 font-medium">{label}</th>)}</tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const resolved = summary.lines.find((item) => item.id === line.id);
              return (
                <tr key={line.id} className="border-b border-line align-top">
                  <td className="px-2 py-2"><input className={field} value={line.lot} onChange={(event) => update(line.id, { lot: event.target.value })} /></td>
                  <td className="px-2 py-2"><input className={field} value={line.description} onChange={(event) => update(line.id, { description: event.target.value })} /></td>
                  <td className="px-2 py-2"><input className={field} type="number" value={line.quantity} onChange={(event) => update(line.id, { quantity: Number(event.target.value) })} /></td>
                  <td className="px-2 py-2"><input className={field} value={line.unit} onChange={(event) => update(line.id, { unit: event.target.value })} /></td>
                  <td className="px-2 py-2"><input className={field} type="number" value={line.hours} onChange={(event) => update(line.id, { hours: Number(event.target.value), origins: { ...line.origins, hours: "USER" } })} /></td>
                  <td className="px-2 py-2"><input className={field} type="number" value={line.hourlyRateCents / 100} onChange={(event) => update(line.id, { hourlyRateCents: Math.round(Number(event.target.value) * 100), origins: { ...line.origins, rate: "USER" } })} /></td>
                  <td className="px-2 py-2 tabular-nums">{formatMoney(resolved?.laborCents ?? 0, currency)}</td>
                  <td className="px-2 py-2 tabular-nums">{formatMoney(resolved?.materialsCents ?? 0, currency)}</td>
                  <td className="px-2 py-2 tabular-nums">{formatMoney(resolved?.equipmentCents ?? 0, currency)}</td>
                  <td className="px-2 py-2 tabular-nums">{formatMoney(resolved?.subcontractCents ?? 0, currency)}</td>
                  <td className="px-2 py-2 tabular-nums">{formatMoney((resolved?.otherCents ?? 0) + (resolved?.logisticsCents ?? 0), currency)}</td>
                  <td className="px-2 py-2 font-medium tabular-nums">{formatMoney(resolved?.directCents ?? 0, currency)}</td>
                  <td className="px-2 py-2">{line.sourceLabel}</td>
                  <td className="px-2 py-2"><Badge tone={line.status === "USER_VERIFIED" ? "success" : line.status === "USER_MODIFIED" ? "warning" : "cyan"}>{lineStatusLabels[line.status]}</Badge></td>
                  <td className="px-2 py-2">
                    <button className="text-technical" type="button" onClick={() => onExplain(line.id)}>Pourquoi ?</button>
                    <button className="ml-2 text-success" type="button" onClick={() => update(line.id, { status: "USER_VERIFIED" })}>Vérifier</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!lines.length ? <p className="text-sm text-steel">Aucune ligne. Ajoutez-en une ou lancez l&apos;analyse d&apos;un document.</p> : null}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setLines([...lines, blankLine()])}>+ Ligne</Button>
        <Button disabled={pending} onClick={onSave}>Enregistrer l&apos;estimation</Button>
      </div>
      <p className="text-xs text-steel">Les montants sont recalculés par le moteur. L&apos;IA ne les additionne pas.</p>
    </div>
  );
}

function blankLine(): EstimateLine {
  return {
    id: id("line"),
    workPackageId: null,
    taskId: null,
    lot: "Nouveau lot",
    description: "Nouveau poste",
    quantity: 0,
    unit: "heures",
    hours: 0,
    hourlyRateCents: 0,
    materialsCents: 0,
    equipmentCents: 0,
    subcontractCents: 0,
    logisticsCents: 0,
    otherCents: 0,
    sourceLabel: "Saisie utilisateur",
    page: null,
    section: null,
    provenance: "USER",
    status: "USER_MODIFIED",
    explanation: "Ligne ajoutée par l'estimateur.",
    origins: { hours: "USER", rate: "USER", materials: "USER", equipment: "USER", subcontract: "USER", logistics: "USER", other: "USER" },
  };
}

function LaborPanel({ rows, setRows, currency, pending, note, onSave }: { rows: LaborCost[]; setRows: (rows: LaborCost[]) => void; currency: string; pending: boolean; note?: string; onSave: () => void }) {
  return (
    <div className="space-y-3">
      {note ? <p className="rounded-md bg-background p-3 text-sm text-steel">{note}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="text-steel"><tr>{["Catégorie", "Profession", "Travailleurs", "Heures", "Taux", "Heures sup.", "Productivité", "Coût"].map((label) => <th key={label} className="px-2 py-2">{label}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, index) => {
              const cost = Math.round(row.hours * row.hourlyRateCents * row.workers * row.productivityFactor + row.overtimeHours * row.hourlyRateCents * row.workers * row.overtimeFactor);
              return (
                <tr key={row.id} className="border-t border-line">
                  {(["category", "trade"] as const).map((key) => <td key={key} className="px-2 py-2"><input className={field} value={row[key]} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: event.target.value } : item))} /></td>)}
                  {(["workers", "hours", "hourlyRateCents", "overtimeHours", "productivityFactor"] as const).map((key) => (
                    <td key={key} className="px-2 py-2">
                      <input className={field} type="number" value={key === "hourlyRateCents" ? row[key] / 100 : row[key]} onChange={(event) => {
                        const numeric = Number(event.target.value);
                        setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: key === "hourlyRateCents" ? Math.round(numeric * 100) : numeric } : item));
                      }} />
                    </td>
                  ))}
                  <td className="px-2 py-2 tabular-nums">{formatMoney(cost, currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length ? <p className="text-sm text-steel">Aucune main-d&apos;œuvre détaillée. Les heures des lignes restent utilisées.</p> : null}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setRows([...rows, { id: id("labor"), taskId: null, estimateLineId: null, category: "Général", trade: "Métier", workers: 1, hours: 0, hourlyRateCents: 0, overtimeHours: 0, productivityFactor: 1, overtimeFactor: 1.5 }])}>+ Main-d&apos;œuvre</Button>
        <Button disabled={pending} onClick={onSave}>Enregistrer</Button>
      </div>
    </div>
  );
}

function MaterialsPanel({ rows, setRows, suppliers, currency, pending, onSave }: { rows: MaterialCost[]; setRows: (rows: MaterialCost[]) => void; suppliers: Supplier[]; currency: string; pending: boolean; onSave: () => void }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-xs">
          <thead className="text-steel"><tr>{["Description", "Quantité", "Unité", "Prix unitaire", "Fournisseur", "Transport", "Pertes", "Total"].map((label) => <th key={label} className="px-2 py-2 text-left">{label}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, index) => {
              const total = Math.round(row.quantity * row.unitPriceCents + row.transportCents + row.wasteCents);
              return (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-2 py-2"><input className={field} value={row.description} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} /></td>
                  <td className="px-2 py-2"><input className={field} type="number" value={row.quantity} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item))} /></td>
                  <td className="px-2 py-2"><input className={field} value={row.unit} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, unit: event.target.value } : item))} /></td>
                  <td className="px-2 py-2"><input className={field} type="number" value={row.unitPriceCents / 100} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, unitPriceCents: Math.round(Number(event.target.value) * 100) } : item))} /></td>
                  <td className="px-2 py-2">
                    <select className={field} value={row.supplierId ?? ""} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, supplierId: event.target.value || null } : item))}>
                      <option value="">Non associé</option>
                      {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2"><input className={field} type="number" value={row.transportCents / 100} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, transportCents: Math.round(Number(event.target.value) * 100) } : item))} /></td>
                  <td className="px-2 py-2"><input className={field} type="number" value={row.wasteCents / 100} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, wasteCents: Math.round(Number(event.target.value) * 100) } : item))} /></td>
                  <td className="px-2 py-2 tabular-nums">{formatMoney(total, currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setRows([...rows, { id: id("mat"), estimateLineId: null, supplierId: null, description: "Nouveau matériau", quantity: 0, unit: "u", unitPriceCents: 0, transportCents: 0, wasteCents: 0 }])}>+ Matériau</Button>
        <Button disabled={pending} onClick={onSave}>Enregistrer</Button>
      </div>
    </div>
  );
}

function EquipmentPanel({ rows, setRows, currency, pending, onSave }: { rows: EquipmentCost[]; setRows: (rows: EquipmentCost[]) => void; currency: string; pending: boolean; onSave: () => void }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-xs">
          <thead className="text-steel"><tr>{["Équipement", "Quantité", "Durée", "Unité", "Taux", "Transport", "Coût total"].map((label) => <th key={label} className="px-2 py-2 text-left">{label}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-2 py-2"><input className={field} value={row.name} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /></td>
                <td className="px-2 py-2"><input className={field} type="number" value={row.quantity} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item))} /></td>
                <td className="px-2 py-2"><input className={field} type="number" value={row.duration} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, duration: Number(event.target.value) } : item))} /></td>
                <td className="px-2 py-2"><input className={field} value={row.durationUnit} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, durationUnit: event.target.value } : item))} /></td>
                <td className="px-2 py-2"><input className={field} type="number" value={row.rateCents / 100} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, rateCents: Math.round(Number(event.target.value) * 100) } : item))} /></td>
                <td className="px-2 py-2"><input className={field} type="number" value={row.transportCents / 100} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, transportCents: Math.round(Number(event.target.value) * 100) } : item))} /></td>
                <td className="px-2 py-2 tabular-nums">{formatMoney(Math.round(row.quantity * row.duration * row.rateCents + row.transportCents), currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setRows([...rows, { id: id("eq"), estimateLineId: null, name: "Nouvel équipement", quantity: 1, duration: 1, durationUnit: "jours", rateCents: 0, transportCents: 0 }])}>+ Équipement</Button>
        <Button disabled={pending} onClick={onSave}>Enregistrer</Button>
      </div>
    </div>
  );
}

function QuotesPanel({ quotes, setQuotes, suppliers, packages, currency, pending, note, onSave }: { quotes: SupplierQuote[]; setQuotes: (rows: SupplierQuote[]) => void; suppliers: Supplier[]; packages: WorkPackage[]; currency: string; pending: boolean; note?: string; onSave: () => void }) {
  return (
    <div className="space-y-3 text-sm">
      {note ? <p className="rounded-md bg-background p-3 text-steel">{note}</p> : null}
      {quotes.map((quote, index) => {
        const supplier = suppliers.find((item) => item.id === quote.supplierId);
        return (
          <article key={quote.id} className="grid gap-2 rounded-md border border-line p-3 md:grid-cols-2">
            <p className="font-medium text-navy md:col-span-2">{supplier?.name ?? "Fournisseur"}</p>
            <select className={field} value={quote.workPackageId ?? ""} onChange={(event) => setQuotes(quotes.map((item, itemIndex) => itemIndex === index ? { ...item, workPackageId: event.target.value || null } : item))}>
              <option value="">Lot non associé</option>
              {packages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
            </select>
            <select className={field} value={quote.status} onChange={(event) => setQuotes(quotes.map((item, itemIndex) => itemIndex === index ? { ...item, status: event.target.value as SupplierQuote["status"] } : item))}>
              {Object.entries(quoteStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input className={field} type="number" placeholder="Prix" value={quote.priceCents == null ? "" : quote.priceCents / 100} onChange={(event) => setQuotes(quotes.map((item, itemIndex) => itemIndex === index ? { ...item, priceCents: event.target.value === "" ? null : Math.round(Number(event.target.value) * 100) } : item))} />
            <input className={field} placeholder="Délai" value={quote.leadTime} onChange={(event) => setQuotes(quotes.map((item, itemIndex) => itemIndex === index ? { ...item, leadTime: event.target.value } : item))} />
            <input className={field} placeholder="Inclus" value={quote.included} onChange={(event) => setQuotes(quotes.map((item, itemIndex) => itemIndex === index ? { ...item, included: event.target.value } : item))} />
            <input className={field} placeholder="Exclus" value={quote.excluded} onChange={(event) => setQuotes(quotes.map((item, itemIndex) => itemIndex === index ? { ...item, excluded: event.target.value } : item))} />
            <p className="text-xs text-steel">Devise {quote.currency} · validité {quote.validUntil ?? "non précisée"} · document {quote.documentName ?? "aucun"} · prix {quote.priceCents == null ? "non reçu" : formatMoney(quote.priceCents, currency)}</p>
          </article>
        );
      })}
      {!quotes.length ? <p className="text-steel">Aucune soumission sur ce dossier.</p> : null}
      <Button disabled={pending} onClick={onSave}>Enregistrer les fournisseurs</Button>
    </div>
  );
}

function SubsPanel({ rows, setRows, packages, lines, pending, onSave }: { rows: Subcontractor[]; setRows: (rows: Subcontractor[]) => void; packages: WorkPackage[]; lines: EstimateLine[]; pending: boolean; onSave: () => void }) {
  return (
    <div className="space-y-3 text-sm">
      {rows.map((row, index) => (
        <article key={row.id} className="grid gap-2 rounded-md border border-line p-3 md:grid-cols-2">
          <input className={field} value={row.name} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
          <input className={field} value={row.contact} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, contact: event.target.value } : item))} />
          <select className={field} value={row.workPackageId ?? ""} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, workPackageId: event.target.value || null } : item))}>
            <option value="">Lot non associé</option>
            {packages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
          </select>
          <select className={field} value={row.estimateLineId ?? ""} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, estimateLineId: event.target.value || null } : item))}>
            <option value="">Ligne non associée</option>
            {lines.map((line) => <option key={line.id} value={line.id}>{line.description}</option>)}
          </select>
          <input className={field} type="number" value={row.priceCents == null ? "" : row.priceCents / 100} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, priceCents: event.target.value === "" ? null : Math.round(Number(event.target.value) * 100) } : item))} />
          <select className={field} value={row.status} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, status: event.target.value as Subcontractor["status"] } : item))}>
            {Object.entries(quoteStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <p className="text-xs text-steel md:col-span-2">{row.category} · inclus : {row.included} · exclus : {row.excluded}</p>
        </article>
      ))}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setRows([...rows, { id: id("sub"), workPackageId: null, estimateLineId: null, name: "Nouveau sous-traitant", contact: "", category: "Spécialité", description: "", priceCents: null, currency: "CAD", validUntil: null, leadTime: "", included: "", excluded: "", documentName: null, status: "REQUESTED" }])}>+ Sous-traitant</Button>
        <Button disabled={pending} onClick={onSave}>Enregistrer</Button>
      </div>
    </div>
  );
}

function RisksPanel({ rows, currency, pending, note, onSave }: { rows: Project["risks"]; currency: string; pending: boolean; note?: string; onSave: () => void }) {
  return (
    <div className="space-y-3 text-sm">
      {note ? <p className="rounded-md bg-background p-3 text-steel">{note}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-xs">
          <thead className="text-steel"><tr>{["Risque", "Probabilité", "Impact", "Niveau", "Coût potentiel", "Mitigation", "Responsable", "Statut"].map((label) => <th key={label} className="px-2 py-2 text-left">{label}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line align-top">
                <td className="px-2 py-2">{row.title}<span className="mt-1 block text-steel">{provenanceLabels[row.provenance]} · {row.justification}</span></td>
                <td className="px-2 py-2">{riskLevelLabels[row.probability]}</td>
                <td className="px-2 py-2">{riskLevelLabels[row.impact]}</td>
                <td className="px-2 py-2"><Badge tone={row.level === "CRITICAL" || row.level === "HIGH" ? "danger" : row.level === "MEDIUM" ? "warning" : "steel"}>{riskLevelLabels[row.level]}</Badge></td>
                <td className="px-2 py-2">{row.potentialCostCents == null ? "Non chiffré" : formatMoney(row.potentialCostCents, currency)}</td>
                <td className="px-2 py-2">{row.mitigation || "À définir"}</td>
                <td className="px-2 py-2">{row.owner}</td>
                <td className="px-2 py-2">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button disabled={pending} onClick={onSave}>Enregistrer les risques</Button>
    </div>
  );
}

function AssumptionsPanel({ rows, setRows, pending, onSave }: { rows: Project["assumptions"]; setRows: (rows: Project["assumptions"]) => void; pending: boolean; onSave: () => void }) {
  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <article key={row.id} className="space-y-2 rounded-md border border-line p-3 text-sm">
          <textarea className={area} value={row.description} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} />
          <p className="text-xs text-steel">Source : {row.sourceLabel} · {provenanceLabels[row.provenance]}</p>
          <p>Impact potentiel : {row.potentialImpact}</p>
        </article>
      ))}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setRows([...rows, { id: id("assum"), description: "Nouvelle hypothèse", sourceLabel: "DONNÉE UTILISATEUR", page: null, section: null, potentialImpact: "À préciser", status: "OPEN", provenance: "USER" }])}>+ Hypothèse</Button>
        <Button disabled={pending} onClick={onSave}>Enregistrer</Button>
      </div>
    </div>
  );
}

function MissingPanel({ rows, setRows, pending, note, onSave }: { rows: MissingInformation[]; setRows: (rows: MissingInformation[]) => void; pending: boolean; note?: string; onSave: () => void }) {
  return (
    <div className="space-y-3">
      {note ? <p className="rounded-md bg-background p-3 text-sm text-steel">{note}</p> : null}
      {rows.map((row, index) => (
        <article key={row.id} className="rounded-md border border-line p-3 text-sm">
          <p className="font-medium text-navy">⚠ {row.description}</p>
          <p className="mt-1 text-steel">Importance : {riskLevelLabels[row.importance]} · Source : {row.sourceLabel}</p>
          <p className="mt-1">Action requise : {row.requiredAction}</p>
          <textarea className={`${area} mt-2`} placeholder="Ajouter une note" value={row.note} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value } : item))} />
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setRows(rows.map((item) => item.id === row.id ? { ...item, status: "RESOLVED" } : item))}>Résolu</Button>
            <Button size="sm" variant="secondary" onClick={() => setRows(rows.map((item) => item.id === row.id ? { ...item, status: "IGNORED" } : item))}>Ignorer</Button>
            <Badge tone={row.status === "OPEN" ? "warning" : "success"}>{row.status}</Badge>
          </div>
        </article>
      ))}
      {!rows.length ? <p className="text-sm text-steel">Aucune information manquante enregistrée.</p> : null}
      <Button disabled={pending} onClick={onSave}>Enregistrer le suivi</Button>
    </div>
  );
}

function ReviewPanel({ project, pending, onRun, onDecide }: { project: Project; pending: boolean; onRun: () => void; onDecide: (id: string, status: "ACCEPTED" | "IGNORED" | "MODIFIED") => void }) {
  return (
    <div className="space-y-3">
      <Button disabled={pending} onClick={onRun}>Review with AI</Button>
      <p className="text-sm text-steel">La revue cherche des incohérences dans les données du projet. Elle ne valide pas l&apos;estimation.</p>
      {project.reviews.map((review) => (
        <article key={review.id} className="rounded-md border border-line p-3 text-sm">
          <Badge tone={review.severity === "CRITICAL" ? "danger" : review.severity === "WARNING" ? "warning" : "technical"}>{review.severity}</Badge>
          <p className="mt-2 font-medium text-navy">{review.title}</p>
          <p className="mt-1 text-steel">{review.detail}</p>
          <p className="mt-1 text-xs">Statut : {review.status}</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => onDecide(review.id, "ACCEPTED")}>Accepter</Button>
            <Button size="sm" variant="secondary" onClick={() => onDecide(review.id, "IGNORED")}>Ignorer</Button>
            <Button size="sm" variant="secondary" onClick={() => onDecide(review.id, "MODIFIED")}>Modifier</Button>
          </div>
        </article>
      ))}
      {!project.reviews.length ? <p className="text-sm text-steel">Aucune revue pour le moment.</p> : null}
    </div>
  );
}

function AssistantPanel({ project, question, setQuestion, pending, onAsk }: { project: Project; question: string; setQuestion: (value: string) => void; pending: boolean; onAsk: () => void }) {
  const prompts = ["Quels sont les éléments manquants ?", "Quels sont les risques identifiés ?", "Montre-moi les coûts de main-d'œuvre.", "Pourquoi le coût de la tuyauterie est-il élevé ?", "Quels lots n'ont pas encore été validés ?", "Résume cette estimation."];
  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-navy">NavalSmart AI</h2>
      <p className="text-sm text-steel">L&apos;assistant répond à partir de ce dossier. Il distingue la source, la saisie, la proposition et le calcul.</p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => <button key={prompt} className="rounded-md border border-line px-2 py-1 text-xs text-technical" type="button" onClick={() => setQuestion(prompt)}>{prompt}</button>)}
      </div>
      <textarea className={area} value={question} onChange={(event) => setQuestion(event.target.value)} />
      <Button disabled={pending || question.trim().length < 2} onClick={onAsk}>Envoyer</Button>
      <div className="space-y-3">
        {project.messages.map((message) => (
          <article key={message.id} className="rounded-md border border-line px-3 py-2 text-sm">
            <p className="text-xs text-steel">{message.role === "USER" ? "Vous" : "NavalSmart AI"} · {formatDateTime(message.createdAt)}</p>
            <p className="mt-1 whitespace-pre-wrap leading-6">{message.content}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function HistoryPanel({ project }: { project: Project }) {
  return (
    <ol className="space-y-3">
      {project.audit.map((entry) => (
        <li key={entry.id} className="rounded-md border border-line px-3 py-3 text-sm">
          <p className="font-medium text-navy">{entry.summary}</p>
          <p className="mt-1 text-xs text-steel">{formatDate(entry.createdAt)} · {entry.entity} · {entry.source}</p>
        </li>
      ))}
      {!project.audit.length ? <p className="text-sm text-steel">Aucune modification enregistrée.</p> : null}
    </ol>
  );
}
