"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarClock, CircleAlert, ClipboardList, Printer } from "lucide-react";
import { planningSummary, relativePeriod, WORK_ORDER_STATUSES, workOrderStatusLabel, waitingOn, type RelativePeriod } from "@/domain/planning";
import type { Project, ProjectMilestone, WorkOrder, WorkOrderStatus } from "@/domain/types";
import { planProjectAction, saveWorkOrdersAction, setPlanningWindowAction } from "@/server/actions";
import { GanttChart, GanttLegend, shortDate, statusColors, type GanttRow } from "@/components/planning/gantt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatNumber } from "@/lib/format";
import { provenanceLabels } from "@/lib/labels";

type Run = (work: () => Promise<{ error?: string; ok?: boolean }>) => void;

const field = "h-9 w-full rounded-md border border-line bg-white px-2 text-sm";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusTone(status: WorkOrderStatus): "steel" | "technical" | "cyan" | "success" | "danger" {
  return status === "DONE" ? "success" : status === "BLOCKED" ? "danger" : status === "IN_PROGRESS" ? "cyan" : status === "PLANNED" ? "technical" : "steel";
}

export function StatusBadge({ status }: { status: WorkOrderStatus }) {
  return <Badge tone={statusTone(status)}>{workOrderStatusLabel(status)}</Badge>;
}

function groups(project: Project, orders: WorkOrder[]) {
  const packages = [...project.workPackages].sort((a, b) => a.sortOrder - b.sortOrder);
  const result = packages.map((workPackage) => ({
    id: workPackage.id,
    title: `${workPackage.code} — ${workPackage.name}`,
    orders: orders.filter((order) => order.workPackageId === workPackage.id),
  }));
  const orphans = orders.filter((order) => !packages.some((item) => item.id === order.workPackageId));
  if (orphans.length) result.push({ id: "other", title: "Hors lot", orders: orphans });
  return result.filter((group) => group.orders.length);
}

function span(orders: WorkOrder[]): { start: string | null; end: string | null } {
  const starts = orders.map((order) => order.actualStart ?? order.plannedStart).filter((value): value is string => Boolean(value)).sort();
  const ends = orders.map((order) => order.actualEnd ?? order.plannedEnd).filter((value): value is string => Boolean(value)).sort();
  return { start: starts[0] ?? null, end: ends[ends.length - 1] ?? null };
}

function SummaryCards({ project }: { project: Project }) {
  const summary = planningSummary(project);
  const crossesYear = Boolean(summary.start && summary.end && summary.start.slice(0, 4) !== summary.end.slice(0, 4));
  const cards = [
    { label: "Ordres de travail", value: String(summary.total), hint: `${summary.byStatus.DONE} terminé(s) · ${summary.byStatus.IN_PROGRESS} en cours` },
    { label: "Bloqués", value: String(summary.byStatus.BLOCKED), hint: "En attente d'une information" },
    { label: "Avancement", value: `${summary.progressPct} %`, hint: "Moyenne des ordres" },
    {
      label: "Heures prévues",
      value: summary.plannedHours === null ? "Non chiffrées" : `${formatNumber(summary.plannedHours)} h`,
      hint: summary.plannedHours === null ? "Reprises des lignes d'estimation" : `Réelles : ${summary.actualHours === null ? "—" : `${formatNumber(summary.actualHours)} h`}`,
    },
    { label: "Fenêtre de travaux", value: summary.start ? `${shortDate(summary.start, crossesYear)} → ${shortDate(summary.end, crossesYear)}` : "À définir", hint: project.plannedStart ? `Projet : ${formatDate(project.plannedStart)}` : "Début prévu non renseigné" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-[#e6edf4] bg-white p-3">
          <p className="text-xs text-steel">{card.label}</p>
          <p className="mt-1 text-lg font-semibold text-navy">{card.value}</p>
          <p className="text-[11px] text-steel">{card.hint}</p>
        </div>
      ))}
    </div>
  );
}

function periodLabel(period: RelativePeriod): string {
  const unit = period.unit === "mois" ? "Mois" : period.unit === "semaine" ? "Semaine" : "Jour";
  return period.from === period.to ? `${unit} ${period.from}` : `${unit} ${period.from} → ${unit} ${period.to}`;
}

function milestoneWhen(item: ProjectMilestone): string {
  if (item.date) return `${formatDate(item.date)}${item.time ? ` à ${item.time.replace(":", " h ")}` : ""}`;
  const period = relativePeriod(item);
  if (period) return periodLabel(period);
  return item.excerpt?.split(":").pop()?.trim() ?? "—";
}

function WindowForm({ project, pending, run, relative }: { project: Project; pending: boolean; run: Run; relative: RelativePeriod[] }) {
  const [start, setStart] = useState(project.plannedStart ?? "");
  const [end, setEnd] = useState(project.plannedEnd ?? "");
  const last = relative.reduce<RelativePeriod | null>((max, item) => (!max || item.to > max.to ? item : max), null);
  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-xl border border-[#e6edf4] bg-white p-3"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => setPlanningWindowAction(project.id, { start, end }));
      }}
    >
      <label className="text-xs text-steel">
        Début des travaux
        <input type="date" required value={start} onChange={(event) => setStart(event.target.value)} className={`${field} mt-1 w-44`} />
      </label>
      <label className="text-xs text-steel">
        Fin prévue <span className="text-[11px]">(facultative)</span>
        <input type="date" value={end} min={start || undefined} onChange={(event) => setEnd(event.target.value)} className={`${field} mt-1 w-44`} />
      </label>
      <Button type="submit" variant="secondary" disabled={pending || !start}>Appliquer les dates</Button>
      <p className="basis-full text-[11px] text-steel">
        {last
          ? `Calendrier du document en rangs relatifs (${periodLabel({ ...last, from: 1 })}) : chaque lot est placé à partir de ce début. Sans fin saisie, elle découle de la durée écrite dans le document.`
          : "Sans fin saisie, elle découle de l'achèvement ou de la durée écrits dans le document."}
        {" "}Les dates que vous avez modifiées dans les ordres de travail sont conservées.
      </p>
    </form>
  );
}

export function PlanningPanel({ project, pending, run, onOpenOrders }: { project: Project; pending: boolean; run: Run; onOpenOrders: () => void }) {
  const today = todayIso();
  const [fit, setFit] = useState<"rows" | "all">("rows");
  const relative = project.milestones.map(relativePeriod).filter((item): item is RelativePeriod => item !== null);
  const undated = project.workOrders.length > 0 && project.workOrders.every((order) => !order.plannedStart && !order.actualStart);
  const rows: GanttRow[] = groups(project, project.workOrders).flatMap((group) => {
    const range = span(group.orders);
    return [
      { id: `group-${group.id}`, label: group.title, start: range.start, end: range.end, group: true },
      ...group.orders.map((order) => ({
        id: order.id,
        label: order.title,
        sublabel: `${order.number}${order.trade ? ` · ${order.trade}` : ""}`,
        start: order.actualStart ?? order.plannedStart,
        end: order.actualEnd ?? order.plannedEnd,
        status: order.status,
        proposed: order.datesProvenance === "AI" && !order.actualStart,
        progressPct: order.progressPct,
        href: `/estimations/${project.id}/ordres/${order.id}`,
      })),
    ];
  });
  const datedMilestones = project.milestones
    .filter((item): item is typeof item & { date: string } => Boolean(item.date))
    .map((item) => ({ id: item.id, label: item.label, date: item.date, toConfirm: item.toConfirm, deadline: item.kind === "DEADLINE" }));
  const proposed = project.workOrders.some((order) => order.datesProvenance === "AI" && order.plannedStart);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-navy">Planning du projet</h2>
          <p className="mt-1 max-w-3xl text-sm text-steel">
            Les jalons viennent de l&apos;appel d&apos;offres. Chaque tâche des lots reçoit un ordre de travail ; les heures sont reprises des lignes d&apos;estimation, jamais inventées.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onOpenOrders}><ClipboardList className="h-4 w-4" /> Ordres de travail</Button>
          <Button disabled={pending || !project.workPackages.length} onClick={() => run(() => planProjectAction(project.id))}>
            <CalendarClock className="h-4 w-4" /> {project.workOrders.length ? "Compléter le planning" : "Générer le planning"}
          </Button>
        </div>
      </div>

      {!project.workPackages.length ? (
        <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-steel">Aucun lot de travaux. Analysez l&apos;appel d&apos;offres ou créez les lots pour générer le planning.</p>
      ) : null}

      {project.workOrders.length ? <SummaryCards project={project} /> : null}

      {undated ? (
        <p className="flex items-start gap-2 rounded-md border border-[#f3d9a4] bg-[#fff8e8] px-3 py-2 text-sm text-[#7a4b00]">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {relative.length
            ? "Le document ne donne pas de date de démarrage : son calendrier est exprimé en rangs relatifs. Indiquez le début des travaux pour dater les ordres de travail."
            : "Le document ne donne pas de fenêtre de travaux datée. Indiquez le début des travaux pour dater les ordres de travail."}
        </p>
      ) : null}

      {project.workPackages.length ? <WindowForm key={`${project.plannedStart}|${project.plannedEnd}`} project={project} pending={pending} run={run} relative={relative} /> : null}

      {proposed ? (
        <p className="flex items-start gap-2 rounded-md border border-[#cfe0f5] bg-[#f3f8fe] px-3 py-2 text-sm text-[#1d4e89]">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {relative.length
            ? `Dates proposées selon le calendrier relatif du document, à partir du début des travaux (${provenanceLabels.AI}).`
            : `Dates proposées par répartition des lots dans la fenêtre de travaux (${provenanceLabels.AI}).`}
          {" "}Modifiez-les dans les ordres de travail pour les valider.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <GanttLegend />
        <div className="inline-flex rounded-lg border border-line bg-white p-0.5 text-xs">
          <button type="button" onClick={() => setFit("rows")} className={`rounded-md px-2.5 py-1 ${fit === "rows" ? "bg-navy text-white" : "text-steel"}`}>Travaux</button>
          <button type="button" onClick={() => setFit("all")} className={`rounded-md px-2.5 py-1 ${fit === "all" ? "bg-navy text-white" : "text-steel"}`}>Avec la soumission</button>
        </div>
      </div>
      <GanttChart rows={rows} milestones={datedMilestones} today={today} fit={fit} emptyLabel="Le planning apparaîtra ici après la génération des ordres de travail." />

      <article className="rounded-xl border border-[#e6edf4]">
        <h3 className="border-b border-[#e6edf4] px-4 py-3 text-sm font-semibold text-navy">Jalons et échéances</h3>
        {project.milestones.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-steel">
                <tr>{["Jalon", "Date", "Statut", "Source"].map((label) => <th key={label} className="px-4 py-2 font-medium">{label}</th>)}</tr>
              </thead>
              <tbody>
                {project.milestones.map((item) => (
                  <tr key={item.id} className="border-t border-[#eef2f6]">
                    <td className="px-4 py-2 font-medium text-navy">{item.label}</td>
                    <td className="px-4 py-2 tabular-nums">{milestoneWhen(item)}</td>
                    <td className="px-4 py-2">{item.toConfirm ? <Badge tone="warning">À confirmer</Badge> : item.kind === "DEADLINE" ? <Badge tone="danger">Échéance</Badge> : item.kind === "DURATION" ? <Badge tone="steel">Durée</Badge> : item.kind === "PERIOD" ? <Badge tone="cyan">Période</Badge> : <Badge tone="technical">Jalon</Badge>}</td>
                    <td className="px-4 py-2 text-xs text-steel">{provenanceLabels[item.provenance]}{item.page ? ` · Page ${item.page}` : ""}{item.section ? ` · Section ${item.section}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="px-4 py-4 text-sm text-steel">Aucun jalon daté dans le document analysé.</p>}
      </article>
    </div>
  );
}

export function WorkOrdersPanel({ project, pending, run }: { project: Project; pending: boolean; run: Run }) {
  const [orders, setOrders] = useState(project.workOrders);
  const [filter, setFilter] = useState<WorkOrderStatus | "ALL">("ALL");
  const [openId, setOpenId] = useState<string | null>(null);
  const grouped = useMemo(() => groups(project, orders), [project, orders]);
  const missingById = new Map(project.missing.map((item) => [item.id, item]));

  function update(orderId: string, patch: Partial<WorkOrder>) {
    setOrders((current) => current.map((order) => {
      if (order.id !== orderId) return order;
      const next = { ...order, ...patch };
      if ("plannedStart" in patch || "plannedEnd" in patch) next.datesProvenance = "USER";
      if (patch.status === "DONE") next.progressPct = 100;
      if (patch.status === "IN_PROGRESS" && !order.actualStart) next.actualStart = todayIso();
      if (patch.status === "DONE" && !order.actualEnd) next.actualEnd = todayIso();
      return next;
    }));
  }

  if (!orders.length) {
    return (
      <div className="space-y-3">
        <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-steel">
          Aucun ordre de travail. Ils sont créés automatiquement après l&apos;analyse de l&apos;appel d&apos;offres, ou depuis l&apos;onglet Planning.
        </p>
        <Button disabled={pending || !project.workPackages.length} onClick={() => run(() => planProjectAction(project.id))}>
          <CalendarClock className="h-4 w-4" /> Générer les ordres de travail
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {([["ALL", "Tous"], ...WORK_ORDER_STATUSES.map((item) => [item.value, item.label])] as [WorkOrderStatus | "ALL", string][]).map(([value, label]) => {
            const count = value === "ALL" ? orders.length : orders.filter((order) => order.status === value).length;
            return (
              <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full border px-3 py-1 ${filter === value ? "border-navy bg-navy text-white" : "border-line text-steel"}`}>
                {label} · {count}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" asChild><Link href={`/estimations/${project.id}/ordres`}><Printer className="h-4 w-4" /> Imprimer tous</Link></Button>
          <Button disabled={pending} onClick={() => run(() => saveWorkOrdersAction(project.id, orders))}>Enregistrer les ordres</Button>
        </div>
      </div>

      {grouped.map((group) => {
        const visible = group.orders.filter((order) => filter === "ALL" || order.status === filter);
        if (!visible.length) return null;
        return (
          <section key={group.id} className="rounded-xl border border-[#e6edf4]">
            <h3 className="flex items-center justify-between border-b border-[#e6edf4] bg-[#fafbfd] px-4 py-2.5 text-sm font-semibold text-navy">
              {group.title}
              <span className="text-xs font-normal text-steel">{group.orders.filter((order) => order.status === "DONE").length}/{group.orders.length} terminé(s)</span>
            </h3>
            <ul>
              {visible.map((order) => {
                const open = openId === order.id;
                const waiting = waitingOn(order, orders);
                const blockers = order.blockers.map((blocker) => missingById.get(blocker)).filter((item) => item !== undefined);
                return (
                  <li key={order.id} className="border-b border-[#f0f3f7] last:border-b-0">
                    <button type="button" onClick={() => setOpenId(open ? null : order.id)} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left text-sm sm:grid-cols-[90px_minmax(0,1fr)_140px_170px_110px]">
                      <span className="font-mono text-xs text-steel">{order.number}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-navy">{order.title}</span>
                        <span className="block truncate text-xs text-steel">{order.trade || "Métier à affecter"}{order.assignee ? ` · ${order.assignee}` : ""}{order.quantity !== null ? ` · ${formatNumber(order.quantity, 2)} ${order.unit ?? ""}` : ""}</span>
                      </span>
                      <span className="hidden text-xs tabular-nums text-steel sm:block">{shortDate(order.plannedStart)} → {shortDate(order.plannedEnd)}</span>
                      <span className="hidden items-center gap-2 sm:flex">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef2f6]"><span className="block h-full" style={{ width: `${order.progressPct}%`, background: statusColors[order.status] }} /></span>
                        <span className="w-9 text-right text-xs tabular-nums text-steel">{order.progressPct}%</span>
                      </span>
                      <span className="justify-self-end"><StatusBadge status={order.status} /></span>
                    </button>

                    {open ? (
                      <div className="space-y-4 border-t border-[#f0f3f7] bg-[#fbfcfe] px-4 py-4 text-sm">
                        {blockers.length ? (
                          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-danger">
                            <p className="font-medium">Bloqué tant que ces informations ne sont pas levées :</p>
                            <ul className="mt-1 list-disc pl-5">
                              {blockers.map((item) => <li key={item.id}>{item.description} <span className="text-xs">({item.status === "OPEN" ? "ouverte" : "levée"})</span></li>)}
                            </ul>
                            <p className="mt-1 text-xs">Levez-les dans l&apos;onglet Manquants : l&apos;ordre repasse alors en « Planifié ».</p>
                          </div>
                        ) : null}
                        {waiting.length ? (
                          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-warning">
                            Attend la fin de : {waiting.map((item) => `${item.number} ${item.title}`).join(" ; ")}.
                          </p>
                        ) : null}

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <label className="space-y-1"><span className="text-xs text-steel">Statut</span>
                            <select className={field} value={order.status} onChange={(event) => update(order.id, { status: event.target.value as WorkOrderStatus })}>
                              {WORK_ORDER_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                            </select>
                          </label>
                          <label className="space-y-1"><span className="text-xs text-steel">Métier</span>
                            <input className={field} value={order.trade} onChange={(event) => update(order.id, { trade: event.target.value })} placeholder="Ex. Soudeur" />
                          </label>
                          <label className="space-y-1"><span className="text-xs text-steel">Responsable / équipe</span>
                            <input className={field} value={order.assignee} onChange={(event) => update(order.id, { assignee: event.target.value })} placeholder="À affecter" />
                          </label>
                          <label className="space-y-1"><span className="text-xs text-steel">Avancement : {order.progressPct} %</span>
                            <input className="h-9 w-full" type="range" min={0} max={100} step={5} value={order.progressPct} onChange={(event) => update(order.id, { progressPct: Number(event.target.value) })} />
                          </label>
                          <label className="space-y-1"><span className="text-xs text-steel">Début prévu {order.datesProvenance === "AI" ? "· proposé" : ""}</span>
                            <input className={field} type="date" value={order.plannedStart ?? ""} onChange={(event) => update(order.id, { plannedStart: event.target.value || null })} />
                          </label>
                          <label className="space-y-1"><span className="text-xs text-steel">Fin prévue {order.datesProvenance === "AI" ? "· proposée" : ""}</span>
                            <input className={field} type="date" value={order.plannedEnd ?? ""} onChange={(event) => update(order.id, { plannedEnd: event.target.value || null })} />
                          </label>
                          <label className="space-y-1"><span className="text-xs text-steel">Début réel</span>
                            <input className={field} type="date" value={order.actualStart ?? ""} onChange={(event) => update(order.id, { actualStart: event.target.value || null })} />
                          </label>
                          <label className="space-y-1"><span className="text-xs text-steel">Fin réelle</span>
                            <input className={field} type="date" value={order.actualEnd ?? ""} onChange={(event) => update(order.id, { actualEnd: event.target.value || null })} />
                          </label>
                          <label className="space-y-1"><span className="text-xs text-steel">Heures prévues</span>
                            <input className={field} type="number" min={0} value={order.plannedHours ?? ""} placeholder="Non chiffrées" onChange={(event) => update(order.id, { plannedHours: event.target.value === "" ? null : Math.max(0, Number(event.target.value)) })} />
                          </label>
                          <label className="space-y-1"><span className="text-xs text-steel">Heures réelles</span>
                            <input className={field} type="number" min={0} value={order.actualHours ?? ""} onChange={(event) => update(order.id, { actualHours: event.target.value === "" ? null : Math.max(0, Number(event.target.value)) })} />
                          </label>
                          <label className="space-y-1"><span className="text-xs text-steel">Quantité {order.provenance === "DOCUMENT" && order.quantity !== null ? "· document" : ""}</span>
                            <input className={field} type="number" min={0} value={order.quantity ?? ""} onChange={(event) => update(order.id, { quantity: event.target.value === "" ? null : Math.max(0, Number(event.target.value)) })} />
                          </label>
                          <label className="space-y-1"><span className="text-xs text-steel">Unité</span>
                            <input className={field} value={order.unit ?? ""} onChange={(event) => update(order.id, { unit: event.target.value || null })} />
                          </label>
                        </div>

                        <label className="block space-y-1"><span className="text-xs text-steel">Instructions</span>
                          <textarea className="min-h-16 w-full rounded-md border border-line bg-white px-2 py-2 text-sm" value={order.description} onChange={(event) => update(order.id, { description: event.target.value })} placeholder="Consignes, accès, sécurité…" />
                        </label>

                        <details>
                          <summary className="cursor-pointer text-xs font-medium text-navy">Dépendances ({order.dependsOn.length})</summary>
                          <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
                            {orders.filter((item) => item.id !== order.id).map((item) => (
                              <label key={item.id} className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={order.dependsOn.includes(item.id)}
                                  onChange={(event) => update(order.id, { dependsOn: event.target.checked ? [...order.dependsOn, item.id] : order.dependsOn.filter((value) => value !== item.id) })}
                                />
                                <span className="truncate">{item.number} · {item.title}</span>
                              </label>
                            ))}
                          </div>
                        </details>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-steel">
                          <span>Tâche : {provenanceLabels[order.provenance]}{order.page ? ` · Page ${order.page}` : ""}{order.section ? ` · Section ${order.section}` : ""} · Dates : {provenanceLabels[order.datesProvenance]}</span>
                          <Link href={`/estimations/${project.id}/ordres/${order.id}`} className="inline-flex items-center gap-1 font-medium text-[#1d6fe0]"><Printer className="h-3.5 w-3.5" /> Fiche imprimable</Link>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <p className="text-xs text-steel">Pensez à enregistrer : la fiche imprimable reprend la dernière version enregistrée.</p>
    </div>
  );
}
