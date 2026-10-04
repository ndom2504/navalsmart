"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, SquareChartGantt } from "lucide-react";
import { workOrderStatusLabel } from "@/domain/planning";
import type { WorkOrderStatus } from "@/domain/types";
import { GanttChart, GanttLegend, shortDate, statusColors, type GanttMilestone, type GanttRow } from "@/components/planning/gantt";
import { Badge } from "@/components/ui/badge";

export interface PlannerOrder {
  id: string;
  number: string;
  title: string;
  code: string;
  lot: string;
  trade: string;
  status: WorkOrderStatus;
  start: string | null;
  end: string | null;
  proposed: boolean;
  progressPct: number;
}

export interface PlannerProject {
  id: string;
  name: string;
  vessel: string;
  milestones: { id: string; label: string; date: string; toConfirm: boolean; deadline: boolean }[];
  orders: PlannerOrder[];
}

const PROJECT_COLORS = ["#1d4e89", "#0e9fb5", "#7c3aed", "#c2410c", "#16a34a", "#be123c", "#2f6fad", "#a16207"];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const SEVERITY: WorkOrderStatus[] = ["BLOCKED", "IN_PROGRESS", "PLANNED", "TO_PLAN", "DONE"];

function worst(orders: PlannerOrder[]): WorkOrderStatus {
  if (orders.length && orders.every((order) => order.status === "DONE")) return "DONE";
  return SEVERITY.find((status) => orders.some((order) => order.status === status)) ?? "TO_PLAN";
}

function range(orders: PlannerOrder[]) {
  const starts = orders.map((order) => order.start).filter((value): value is string => Boolean(value)).sort();
  const ends = orders.map((order) => order.end).filter((value): value is string => Boolean(value)).sort();
  return { start: starts[0] ?? null, end: ends[ends.length - 1] ?? null };
}

function addMonths(month: string, delta: number): string {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year!, value! - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

function monthDays(month: string): string[] {
  const [year, value] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year!, value! - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first.getTime() - offset * 86_400_000);
  return Array.from({ length: 42 }, (_, index) => new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10));
}

const monthTitle = new Intl.DateTimeFormat("fr-CA", { month: "long", year: "numeric", timeZone: "UTC" });

export function GlobalPlanner({ projects, today }: { projects: PlannerProject[]; today: string }) {
  const [view, setView] = useState<"gantt" | "calendar">("gantt");
  const [projectId, setProjectId] = useState<string>("ALL");
  const [month, setMonth] = useState(() => {
    const dates = projects.flatMap((project) => project.orders.map((order) => order.start)).filter((value): value is string => Boolean(value)).sort();
    const upcoming = dates.find((value) => value >= today);
    return (upcoming && !dates.some((value) => value.slice(0, 7) === today.slice(0, 7)) ? upcoming : today).slice(0, 7);
  });
  const visible = projectId === "ALL" ? projects : projects.filter((project) => project.id === projectId);
  const colorOf = useMemo(() => new Map(projects.map((project, index) => [project.id, PROJECT_COLORS[index % PROJECT_COLORS.length]!])), [projects]);

  const rows: GanttRow[] = visible.flatMap((project) => {
    const lots = [...new Set(project.orders.map((order) => order.lot))];
    const span = range(project.orders);
    return [
      { id: `p-${project.id}`, label: project.name, sublabel: project.vessel, start: span.start, end: span.end, group: true, href: `/estimations/${project.id}?section=planning` },
      ...lots.map((lot) => {
        const orders = project.orders.filter((order) => order.lot === lot);
        const lotSpan = range(orders);
        return {
          id: `${project.id}-${lot}`,
          label: lot,
          sublabel: `${orders.length} OT`,
          start: lotSpan.start,
          end: lotSpan.end,
          status: worst(orders),
          proposed: orders.every((order) => order.proposed),
          progressPct: Math.round(orders.reduce((sum, order) => sum + (order.status === "DONE" ? 100 : order.progressPct), 0) / orders.length),
          href: `/estimations/${project.id}?section=workorders`,
        };
      }),
    ];
  });
  const milestones: GanttMilestone[] = visible.flatMap((project) => project.milestones.map((item) => ({ ...item, id: `${project.id}-${item.id}`, label: `${project.name} · ${item.label}` })));

  const allOrders = visible.flatMap((project) => project.orders.map((order) => ({ ...order, project })));
  const blocked = allOrders.filter((order) => order.status === "BLOCKED");
  const weekEnd = new Date(Date.parse(`${today}T00:00:00Z`) + 13 * 86_400_000).toISOString().slice(0, 10);
  const coming = allOrders
    .filter((order) => order.status !== "DONE" && order.start && order.start <= weekEnd && (order.end ?? order.start) >= today)
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))
    .slice(0, 12);

  const days = monthDays(month);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-line bg-white p-1 text-sm">
          <button type="button" onClick={() => setView("gantt")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 ${view === "gantt" ? "bg-navy text-white" : "text-steel"}`}><SquareChartGantt className="h-4 w-4" /> Gantt</button>
          <button type="button" onClick={() => setView("calendar")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 ${view === "calendar" ? "bg-navy text-white" : "text-steel"}`}><CalendarDays className="h-4 w-4" /> Calendrier</button>
        </div>
        <select className="h-10 rounded-md border border-line bg-white px-3 text-sm" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="ALL">Tous les projets ({projects.length})</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </div>

      {view === "gantt" ? (
        <section className="space-y-3 rounded-2xl border border-[#e6edf4] bg-white p-4 shadow-sm">
          <GanttLegend />
          <GanttChart rows={rows} milestones={milestones} today={today} emptyLabel="Aucun ordre de travail daté. Importez un appel d'offres ou générez le planning d'une estimation." />
        </section>
      ) : (
        <section className="rounded-2xl border border-[#e6edf4] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" aria-label="Mois précédent" className="rounded-md border border-line p-2" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="h-4 w-4" /></button>
            <h2 className="text-base font-semibold capitalize text-navy">{monthTitle.format(new Date(`${month}-01T00:00:00Z`))}</h2>
            <button type="button" aria-label="Mois suivant" className="rounded-md border border-line p-2" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="overflow-x-auto">
            <div className="grid min-w-[760px] grid-cols-7 border-l border-t border-[#e6edf4] text-xs">
              {WEEKDAYS.map((label) => <div key={label} className="border-b border-r border-[#e6edf4] bg-[#f7f9fc] px-2 py-1.5 font-medium text-steel">{label}</div>)}
              {days.map((date) => {
                const inMonth = date.slice(0, 7) === month;
                const dayMilestones = visible.flatMap((project) => project.milestones.filter((item) => item.date === date).map((item) => ({ ...item, project })));
                const active = visible.map((project) => ({
                  project,
                  orders: project.orders.filter((order) => order.start && order.end && order.start <= date && order.end >= date),
                })).filter((item) => item.orders.length);
                return (
                  <div key={date} className={`min-h-24 border-b border-r border-[#e6edf4] p-1.5 ${inMonth ? "bg-white" : "bg-[#fafbfd] text-steel/60"}`}>
                    <p className={`mb-1 text-[11px] ${date === today ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1d6fe0] font-semibold text-white" : "text-steel"}`}>{Number(date.slice(8))}</p>
                    <div className="space-y-1">
                      {dayMilestones.map((item) => (
                        <p key={`${item.project.id}-${item.id}`} title={`${item.project.name} · ${item.label}`} className="truncate rounded px-1 py-0.5 text-[10px] font-medium" style={{ background: item.deadline ? "#fff1e8" : "#e8f1fb", color: item.deadline ? "#c2410c" : "#1d4e89" }}>
                          ◆ {item.label}{item.toConfirm ? " (à confirmer)" : ""}
                        </p>
                      ))}
                      {active.map(({ project, orders }) => {
                        const blockedCount = orders.filter((order) => order.status === "BLOCKED").length;
                        return (
                          <Link key={project.id} href={`/estimations/${project.id}?section=workorders`} title={orders.map((order) => `${order.number} ${order.title}`).join("\n")} className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] text-white" style={{ background: colorOf.get(project.id) }}>
                            <span className="truncate">{project.vessel || project.name}</span>
                            <span className="ml-auto shrink-0">{orders.length} OT{blockedCount ? ` · ${blockedCount}⛔` : ""}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#e6edf4] bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-navy">À démarrer ou en cours · 14 prochains jours</h2>
          {coming.length ? (
            <ul className="mt-3 divide-y divide-[#f0f3f7] text-sm">
              {coming.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/estimations/${order.project.id}/ordres/${order.id}`} className="min-w-0">
                    <span className="block truncate font-medium text-navy">{order.number} · {order.title}</span>
                    <span className="block truncate text-xs text-steel">{order.project.name} · {order.trade || "Métier à affecter"}</span>
                  </Link>
                  <span className="shrink-0 text-right text-xs text-steel">{shortDate(order.start)} → {shortDate(order.end)}<br /><span style={{ color: statusColors[order.status] }}>{workOrderStatusLabel(order.status)}</span></span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-steel">Aucun ordre de travail prévu sur cette période.</p>}
        </section>
        <section className="rounded-2xl border border-[#e6edf4] bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-navy">Ordres bloqués · {blocked.length}</h2>
          {blocked.length ? (
            <ul className="mt-3 divide-y divide-[#f0f3f7] text-sm">
              {blocked.slice(0, 12).map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/estimations/${order.project.id}?section=workorders`} className="min-w-0">
                    <span className="block truncate font-medium text-navy">{order.number} · {order.title}</span>
                    <span className="block truncate text-xs text-steel">{order.project.name} · {order.code}</span>
                  </Link>
                  <Badge tone="danger">Bloqué</Badge>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-steel">Aucun ordre bloqué.</p>}
        </section>
      </div>
    </div>
  );
}
