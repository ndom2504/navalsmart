import Link from "next/link";
import type { WorkOrderStatus } from "@/domain/types";

export const statusColors: Record<WorkOrderStatus, string> = {
  TO_PLAN: "#9aa8b8",
  PLANNED: "#2f6fad",
  IN_PROGRESS: "#0e9fb5",
  DONE: "#16a34a",
  BLOCKED: "#dc2626",
};

export interface GanttRow {
  id: string;
  label: string;
  sublabel?: string;
  start: string | null;
  end: string | null;
  status?: WorkOrderStatus;
  /** Barre de regroupement (lot, projet). */
  group?: boolean;
  /** Dates proposées, encore à valider. */
  proposed?: boolean;
  progressPct?: number;
  href?: string;
}

export interface GanttMilestone {
  id: string;
  label: string;
  date: string;
  toConfirm?: boolean;
  deadline?: boolean;
}

const DAY = 86_400_000;

function day(iso: string): number {
  return Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY);
}

function iso(value: number): string {
  return new Date(value * DAY).toISOString().slice(0, 10);
}

const monthFormat = new Intl.DateTimeFormat("fr-CA", { month: "short", year: "2-digit", timeZone: "UTC" });
const dayFormat = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", timeZone: "UTC" });
const dayYearFormat = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function shortDate(value: string | null, withYear = false): string {
  if (!value) return "—";
  return (withYear ? dayYearFormat : dayFormat).format(new Date(`${value.slice(0, 10)}T00:00:00Z`)).replace(".", "");
}

/** Une colonne de mois reste lisible au-delà d'un an de travaux. */
const MONTH_WIDTH = 64;
const LABEL_WIDTH = 240;

/** fit="rows" cadre l'axe sur les barres ; les jalons hors de cette période sont masqués. */
export function GanttChart({ rows, milestones: allMilestones = [], today, emptyLabel, fit = "all" }: { rows: GanttRow[]; milestones?: GanttMilestone[]; today: string; emptyLabel: string; fit?: "all" | "rows" }) {
  const rowDates = rows.flatMap((row) => [row.start, row.end]).filter((value): value is string => Boolean(value));
  const fitRows = fit === "rows" && rowDates.length > 0;
  const dates = fitRows ? rowDates : [...rowDates, ...allMilestones.map((item) => item.date)];
  if (!dates.length) return <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-steel">{emptyLabel}</p>;

  const first = Math.min(...dates.map(day)) - 3;
  const last = Math.max(...dates.map(day)) + 3;
  const milestones = fitRows ? allMilestones.filter((item) => day(item.date) >= first && day(item.date) <= last) : allMilestones;
  const span = Math.max(1, last - first + 1);
  const left = (value: string) => ((day(value) - first) / span) * 100;
  const width = (start: string, end: string) => (Math.max(1, day(end) - day(start) + 1) / span) * 100;

  const months: { label: string; left: number }[] = [];
  const cursor = new Date(first * DAY);
  cursor.setUTCDate(1);
  while (cursor.getTime() / DAY <= last) {
    const start = Math.max(first, Math.floor(cursor.getTime() / DAY));
    const label = monthFormat.format(cursor).replace(".", "");
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    const visibleDays = Math.min(last + 1, Math.floor(cursor.getTime() / DAY)) - start;
    if (visibleDays >= 7 || span < 14) months.push({ label, left: ((start - first) / span) * 100 });
  }
  const weeks: number[] = [];
  for (let value = first; value <= last && span <= 240; value += 1) {
    if (new Date(value * DAY).getUTCDay() === 1) weeks.push(((value - first) / span) * 100);
  }
  const todayDay = day(today);
  const showToday = todayDay >= first && todayDay <= last;

  return (
    <div className="overflow-x-auto rounded-xl border border-[#e6edf4]">
      <div style={{ minWidth: Math.max(860, LABEL_WIDTH + months.length * MONTH_WIDTH) }}>
        <div className="grid grid-cols-[240px_minmax(0,1fr)] border-b border-[#e6edf4] bg-[#f7f9fc] text-[11px] text-steel">
          <div className="px-3 py-2 font-medium">Tâche</div>
          <div className="relative h-8">
            {months.map((month) => (
              <span key={`${month.label}-${month.left}`} className="absolute top-0 h-full border-l border-[#dfe6ee] px-1.5 py-2 capitalize" style={{ left: `${month.left}%` }}>{month.label}</span>
            ))}
          </div>
        </div>

        {milestones.length ? (
          <div className="grid grid-cols-[240px_minmax(0,1fr)] border-b border-[#e6edf4]">
            <div className="px-3 py-2 text-xs font-medium text-navy">Jalons du document</div>
            <div className="relative h-9">
              {milestones.map((item) => (
                <span
                  key={item.id}
                  title={`${item.label} · ${shortDate(item.date)}${item.toConfirm ? " · à confirmer" : ""}`}
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2"
                  style={{
                    left: `${left(item.date) + (0.5 / span) * 100}%`,
                    background: item.toConfirm ? "#fff" : item.deadline ? "#c2410c" : "#1d4e89",
                    borderColor: item.deadline ? "#c2410c" : "#1d4e89",
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-[240px] right-0">
            {weeks.map((value) => <span key={value} className="absolute inset-y-0 border-l border-[#f0f3f7]" style={{ left: `${value}%` }} />)}
            {showToday ? <span className="absolute inset-y-0 border-l-2 border-[#1d6fe0]" style={{ left: `${((todayDay - first + 0.5) / span) * 100}%` }} title={`Aujourd'hui · ${iso(todayDay)}`} /> : null}
          </div>
          {rows.map((row) => {
            const color = row.status ? statusColors[row.status] : "#1d4e89";
            const label = (
              <span className="block truncate">
                <span className={row.group ? "font-semibold text-navy" : "text-navy"}>{row.label}</span>
                {row.sublabel ? <span className="ml-1.5 text-[11px] text-steel">{row.sublabel}</span> : null}
              </span>
            );
            return (
              <div key={row.id} className={`grid grid-cols-[240px_minmax(0,1fr)] border-b border-[#f0f3f7] last:border-b-0 ${row.group ? "bg-[#fafbfd]" : ""}`}>
                <div className={`min-w-0 px-3 py-2 text-xs ${row.group ? "" : "pl-6"}`}>
                  {row.href ? <Link href={row.href} className="hover:underline">{label}</Link> : label}
                </div>
                <div className="relative h-9">
                  {row.start && row.end ? (
                    <span
                      title={`${row.label} · ${shortDate(row.start)} → ${shortDate(row.end)}${row.proposed ? " · dates proposées, à valider" : ""}`}
                      className={`absolute top-1/2 -translate-y-1/2 overflow-hidden rounded ${row.group ? "h-2" : "h-5"} ${row.proposed ? "border border-dashed" : ""}`}
                      style={{
                        left: `${left(row.start)}%`,
                        width: `${width(row.start, row.end)}%`,
                        background: row.group ? "#1d4e89" : row.proposed ? `${color}33` : color,
                        borderColor: color,
                      }}
                    >
                      {!row.group && row.progressPct ? <span className="absolute inset-y-0 left-0" style={{ width: `${row.progressPct}%`, background: color, opacity: row.proposed ? 0.6 : 0.35 }} /> : null}
                    </span>
                  ) : !row.group ? (
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-steel">Dates à planifier</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function GanttLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-steel">
      {([
        ["PLANNED", "Planifié"],
        ["IN_PROGRESS", "En cours"],
        ["DONE", "Terminé"],
        ["BLOCKED", "Bloqué"],
        ["TO_PLAN", "À planifier"],
      ] as const).map(([status, label]) => (
        <span key={status} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm" style={{ background: statusColors[status] }} />{label}</span>
      ))}
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm border border-dashed border-[#2f6fad] bg-[#2f6fad33]" />Dates proposées, à valider</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rotate-45 bg-[#1d4e89]" />Jalon</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rotate-45 border-2 border-[#1d4e89] bg-white" />Jalon à confirmer</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-0.5 bg-[#1d6fe0]" />Aujourd&apos;hui</span>
    </div>
  );
}
