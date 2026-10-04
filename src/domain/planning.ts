import { parseFrenchDate, plain } from "@/domain/tender-extraction";
import type {
  Analysis,
  MilestoneKind,
  MissingInformation,
  Project,
  ProjectMilestone,
  Provenance,
  Task,
  WorkOrder,
  WorkOrderStatus,
  WorkPackage,
} from "@/domain/types";
import type { QuantityItem } from "@/lib/validation/tender-analysis.schema";

export const WORK_ORDER_STATUSES: { value: WorkOrderStatus; label: string }[] = [
  { value: "TO_PLAN", label: "À planifier" },
  { value: "PLANNED", label: "Planifié" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "DONE", label: "Terminé" },
  { value: "BLOCKED", label: "Bloqué" },
];

export function workOrderStatusLabel(status: WorkOrderStatus): string {
  return WORK_ORDER_STATUSES.find((item) => item.value === status)?.label ?? status;
}

// ---------- Dates ----------

const DAY_MS = 86_400_000;

function toDay(iso: string): number {
  return Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS);
}

function fromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromDay(toDay(iso) + days);
}

export function daysBetween(start: string, end: string): number {
  return toDay(end) - toDay(start);
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Ajoute des mois calendaires ; le jour est ramené au dernier jour du mois si besoin. */
export function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number) as [number, number, number];
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = total - targetYear * 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${pad(targetMonth + 1)}-${pad(Math.min(day, lastDay))}`;
}

type TimeUnit = "jour" | "semaine" | "mois";

/** Date de fin d'une période de `count` unités commençant le jour `start`, bornes incluses. */
function endOfSpan(start: string, count: number, unit: TimeUnit): string {
  if (unit === "mois") return addDays(addMonths(start, count), -1);
  return addDays(start, (unit === "semaine" ? count * 7 : count) - 1);
}

function offsetStart(start: string, index: number, unit: TimeUnit): string {
  if (unit === "mois") return addMonths(start, index);
  return addDays(start, unit === "semaine" ? index * 7 : index);
}

function validDate(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}/.test(value) && Number.isFinite(Date.parse(value)));
}

/** Durée écrite (« 12 semaines », « 90 jours », « 3 mois ») en jours calendaires. */
export function durationDays(text: string): number | null {
  const match = plain(text).match(/(\d{1,4})\s*(jours?|semaines?|mois)\b/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!value) return null;
  if (match[2]!.startsWith("semaine")) return value * 7;
  if (match[2]!.startsWith("mois")) return value * 30;
  return value;
}

// ---------- Jalons du document ----------

/**
 * Jalons repris de l'analyse : calendrier structuré quand il existe, sinon les
 * échéances datées de l'analyse locale. Aucun jalon n'est créé sans texte source.
 */
export function milestonesFromAnalysis(analysis: Analysis | null, makeId: (prefix: string) => string): ProjectMilestone[] {
  if (!analysis) return [];
  const schedule = analysis.structured?.schedule;
  if (schedule?.length) {
    return schedule.map((item) => ({
      id: makeId("mil"),
      label: item.label,
      date: item.date,
      time: item.time,
      kind: item.kind,
      toConfirm: item.toConfirm,
      page: item.source.page === null ? null : String(item.source.page),
      section: item.source.section,
      excerpt: item.source.excerpt,
      provenance: item.sourceType === "SOURCE_DOCUMENT" ? "DOCUMENT" as const : "AI" as const,
    }));
  }
  return analysis.deadlines.flatMap((item) => {
    const parsed = parseFrenchDate(item.text);
    const duration = durationDays(item.text);
    if (!parsed && !duration) return [];
    const [label, ...rest] = item.text.split(/\s*:\s*/);
    const kind: MilestoneKind = !parsed ? "DURATION" : /limite|au plus tard|remise/i.test(item.text) ? "DEADLINE" : "MILESTONE";
    return [{
      id: makeId("mil"),
      label: rest.length ? label!.trim() : item.text,
      date: parsed?.date ?? null,
      time: parsed?.time ?? null,
      kind,
      toConfirm: /a confirmer|sujet(?:te)?s? a confirmation/.test(plain(item.text)),
      page: item.page,
      section: item.section,
      excerpt: item.excerpt,
      provenance: item.provenance,
    }];
  });
}

const START_LABELS = [/debut des travaux|demarrage des travaux|debut d'execution|commencement des travaux/, /mobilisation/];
const END_LABELS = [/achevement|fin des travaux|livraison|remise en service|reception des travaux|fin d'execution/];

function findMilestoneDate(milestones: ProjectMilestone[], patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const found = milestones.find((item) => validDate(item.date) && pattern.test(plain(item.label)));
    if (found?.date) return found.date;
  }
  return null;
}

export interface RelativePeriod {
  unit: TimeUnit;
  from: number;
  to: number;
}

/** Période écrite en rang relatif (« Mois 2 → Mois 8 ») dans le calendrier du document. */
export function relativePeriod(milestone: Pick<ProjectMilestone, "kind" | "excerpt">): RelativePeriod | null {
  if (milestone.kind !== "PERIOD" || !milestone.excerpt) return null;
  const matches = [...plain(milestone.excerpt).matchAll(/(mois|semaine|jour)\s*(\d{1,3})/g)];
  if (!matches.length) return null;
  const from = Number(matches[0]![2]);
  const to = Number(last(matches)![2]);
  if (!from || to < from) return null;
  return { unit: matches[0]![1] as TimeUnit, from, to };
}

function periodDates(start: string, period: RelativePeriod): { start: string; end: string } {
  const from = offsetStart(start, period.from - 1, period.unit);
  return { start: from, end: endOfSpan(start, period.to, period.unit) };
}

/** Fin déduite d'une durée écrite (« 18 mois », « 12 semaines »), puis du dernier rang relatif. */
function endFromDuration(start: string, milestones: ProjectMilestone[]): string | null {
  for (const item of milestones.filter((milestone) => milestone.kind === "DURATION")) {
    const match = plain(`${item.label} ${item.excerpt ?? ""}`).match(/(\d{1,4})\s*(jours?|semaines?|mois)\b/);
    if (!match || !Number(match[1])) continue;
    const unit: TimeUnit = match[2]!.startsWith("mois") ? "mois" : match[2]!.startsWith("semaine") ? "semaine" : "jour";
    return endOfSpan(start, Number(match[1]), unit);
  }
  const periods = milestones.map(relativePeriod).filter((item): item is RelativePeriod => item !== null);
  if (!periods.length) return null;
  const longest = periods.reduce((max, item) => (item.to > max.to ? item : max));
  return endOfSpan(start, longest.to, longest.unit);
}

/** Fenêtre de travaux écrite dans le document : début, fin ou début + durée. */
export function documentWorkWindow(milestones: ProjectMilestone[]): { start: string | null; end: string | null } {
  const start = findMilestoneDate(milestones, START_LABELS);
  let end = findMilestoneDate(milestones, END_LABELS);
  if (!end && start) end = endFromDuration(start, milestones);
  if (start && end && daysBetween(start, end) < 0) return { start, end: null };
  return { start, end };
}

/** Les dates saisies sur le projet priment ; le document complète (fin datée, durée ou calendrier relatif). */
export function planningWindow(project: Pick<Project, "plannedStart" | "plannedEnd">, milestones: ProjectMilestone[]): { start: string; end: string } | null {
  const fromDocument = documentWorkWindow(milestones);
  const start = validDate(project.plannedStart) ? project.plannedStart : fromDocument.start;
  if (!start) return null;
  const end = validDate(project.plannedEnd) ? project.plannedEnd : fromDocument.end ?? endFromDuration(start, milestones);
  if (!end || daysBetween(start, end) < 0) return null;
  return { start, end };
}

// ---------- Phases, métiers, quantités ----------

/** Ordre de chantier usuel : préparation, structure, systèmes, peinture, essais. */
const PHASES: { rank: number; weight: number; pattern: RegExp }[] = [
  { rank: 0, weight: 1, pattern: /inspection|releve|diagnostic|preparation|mobilisation|demontage/ },
  { rank: 4, weight: 1, pattern: /essai|remise en service|mise en service|reception|cloture|recette/ },
  { rank: 3, weight: 2, pattern: /peinture|revetement exterieur|carene/ },
  { rank: 1, weight: 2, pattern: /structure|coque|tole|soudure|soudage|acier|charpente/ },
  { rank: 2, weight: 3, pattern: /./ },
];

export function phaseOf(workPackage: Pick<WorkPackage, "name">): { rank: number; weight: number } {
  const text = plain(workPackage.name);
  const phase = PHASES.find((item) => item.pattern.test(text))!;
  return { rank: phase.rank, weight: phase.weight };
}

const TRADE_RULES: { pattern: RegExp; trades: string[] }[] = [
  { pattern: /peint|grenaill|sablage|preparation des? surfaces?/, trades: ["Peintre"] },
  { pattern: /tuyau/, trades: ["Tuyauteur"] },
  { pattern: /electri|luminaire|prises?\b|tableaux?\b|cabl/, trades: ["Électricien"] },
  { pattern: /ventil|registre|debit|moteur|mecani|pompe|propuls|ligne d'arbre/, trades: ["Mécanicien"] },
  { pattern: /inspection|releve|essai|controle|remise en service|mise en service|dossier de cloture/, trades: ["Inspecteur"] },
  { pattern: /soud|tole|raidisseur|structure|acier|coque/, trades: ["Soudeur", "Charpentier fer"] },
  { pattern: /amenagement|cloison|revetement de sol|menuis|local|locaux/, trades: ["Menuisier aménageur"] },
  { pattern: /chaussee|asphalt|enrobe|bitum|pavage/, trades: ["Paveur"] },
  { pattern: /drainage|ponceau|conduite|egout|aqueduc/, trades: ["Poseur de conduites"] },
  { pattern: /signalisation|marquage|glissiere/, trades: ["Monteur de signalisation"] },
  { pattern: /excavation|terrassement|remblai|deblai|deboisement|fondation granulaire|nivellement|compactage/, trades: ["Opérateur d'engins"] },
  { pattern: /coffrage/, trades: ["Coffreur"] },
  { pattern: /armature|ferraill/, trades: ["Ferrailleur"] },
  { pattern: /beton|dalle|bordure|trottoir/, trades: ["Cimentier-applicateur"] },
  { pattern: /maconn|brique/, trades: ["Maçon"] },
  { pattern: /plomberie|sanitaire/, trades: ["Plombier"] },
  { pattern: /toiture|couverture/, trades: ["Couvreur"] },
  { pattern: /pieux?\b|poutre|grue|levage/, trades: ["Grutier"] },
  { pattern: /instrument|transmetteur/, trades: ["Instrumentiste"] },
  { pattern: /reservoir|chaudronn/, trades: ["Chaudronnier"] },
  { pattern: /arpentage|implantation/, trades: ["Arpenteur"] },
];

/** Métier déduit des mots du travail, aligné sur le barème quand il existe. */
export function inferTrade(texts: string[], knownTrades: string[]): string {
  for (const text of texts) {
    const folded = plain(text);
    const rule = TRADE_RULES.find((item) => item.pattern.test(folded));
    if (!rule) continue;
    for (const candidate of rule.trades) {
      const known = knownTrades.find((trade) => plain(trade) === plain(candidate));
      if (known) return known;
    }
    return rule.trades[0]!;
  }
  return "";
}

function compactNumbers(text: string): string {
  return text.replace(/(\d)[\s\u00a0\u202f]+(?=\d{3}\b)/g, "$1");
}

function numberIn(text: string, value: number): boolean {
  const formatted = String(value).replace(".", "[.,]");
  return new RegExp(`(^|[^\\d.,])${formatted}([^\\d]|$)`).test(compactNumbers(text));
}

function stem(word: string): string {
  return plain(word).slice(0, 5);
}

/** Quantité citée par le document pour un lot : d'abord par son nombre dans le texte, puis par le mot clé de son libellé. */
export function documentQuantity(analysis: Analysis | null, code: string, text: string, exclude: ReadonlySet<QuantityItem> = new Set()): QuantityItem | null {
  const quantities = (analysis?.structured?.quantities ?? [])
    .filter((item) => !exclude.has(item) && item.workPackageCode && plain(item.workPackageCode).replace(/\s/g, "") === plain(code).replace(/\s/g, ""));
  const byNumber = quantities.find((item) => numberIn(text, item.value));
  if (byNumber) return byNumber;
  const words = plain(text).split(/[^a-z0-9]+/).filter((word) => word.length >= 4).map(stem);
  return quantities.find((item) => {
    const key = plain(item.label).split(/[^a-z0-9]+/).find((word) => word.length >= 4);
    return key ? words.includes(stem(key)) : false;
  }) ?? null;
}

function quantityFor(project: Project, workPackage: WorkPackage, task: Task | null): { quantity: number; unit: string } | null {
  const text = task ? `${task.name} ${task.description}` : workPackage.name;
  const quoted = documentQuantity(project.analysis, workPackage.code, text);
  if (quoted) return { quantity: quoted.value, unit: quoted.unit };
  if (task) {
    const line = project.lines.find((item) => item.taskId === task.id && item.quantity > 0 && !/forfait|heure/i.test(item.unit));
    if (line) return { quantity: line.quantity, unit: line.unit };
  }
  return null;
}

/** Heures reprises des lignes d'estimation de la tâche. Null si aucune n'est chiffrée. */
function plannedHoursFor(project: Project, workPackage: WorkPackage, task: Task | null): number | null {
  const lines = project.lines.filter((line) => task ? line.taskId === task.id : line.workPackageId === workPackage.id && !line.taskId);
  const hours = lines.reduce((sum, line) => sum + (line.hours > 0 ? line.hours : 0), 0);
  return hours > 0 ? hours : null;
}

/** Un contrôle dans un lot de métier (essais de pression, inspection d'un réseau) reste à ce métier. */
const CONTROL_WORK = /inspection|releve|essai|controle/;

function tradeFor(project: Project, workPackage: WorkPackage, task: Task | null, knownTrades: string[]): string {
  if (task) {
    const lineIds = new Set(project.lines.filter((line) => line.taskId === task.id).map((line) => line.id));
    const labor = project.labor.find((item) => item.taskId === task.id || (item.estimateLineId && lineIds.has(item.estimateLineId)));
    if (labor?.trade) return labor.trade;
  }
  const lotTrade = inferTrade([workPackage.name], knownTrades);
  if (!task) return lotTrade;
  const taskTrade = inferTrade([task.name], knownTrades);
  if (!taskTrade) return lotTrade;
  if (lotTrade && CONTROL_WORK.test(plain(task.name)) && !CONTROL_WORK.test(plain(workPackage.name))) return lotTrade;
  return taskTrade;
}

// ---------- Blocages ----------

const TOPICS: { key: string; pattern: RegExp }[] = [
  { key: "structure", pattern: /\btoles?\b|raidisseur|soudage|structure/ },
  { key: "piping", pattern: /tuyau/ },
  { key: "electrical", pattern: /electri|luminaire|\bprises?\b|tableaux? electrique/ },
  { key: "ventilation", pattern: /ventil|registre/ },
  { key: "paint", pattern: /peinture/ },
  { key: "interior", pattern: /revetement de sol|cloison|amenagement/ },
  { key: "earthworks", pattern: /geotechn|sondage|conditions de sol|terrassement|excavation|remblai|services existants/ },
  { key: "paving", pattern: /bitum|enrobe|asphalt|chaussee/ },
  { key: "aggregates", pattern: /granulat|carriere/ },
  { key: "clearing", pattern: /deboisement|environnementa|periodes? sensibles?/ },
];

const SITE_ACCESS = /acces au navire|coactivite/;

function topicsOf(text: string): Set<string> {
  const folded = plain(text);
  return new Set(TOPICS.filter((topic) => topic.pattern.test(folded)).map((topic) => topic.key));
}

/** Informations manquantes ouvertes qui empêchent d'exécuter le travail. */
export function blockersFor(
  missing: MissingInformation[],
  workPackage: WorkPackage,
  task: Task | null,
  isFirstPhase: boolean,
): string[] {
  const text = `${task?.name ?? ""} ${workPackage.name}`;
  const topics = topicsOf(text);
  const code = plain(workPackage.code).replace(/\s/g, "");
  return missing
    .filter((item) => item.status === "OPEN")
    .filter((item) => {
      const description = plain(item.description);
      const prefix = description.match(/^((?:wp|lot)\s*-?\s*\d+[a-z]?)\s*[-—–]/);
      if (prefix) return prefix[1]!.replace(/\s/g, "") === code;
      if (isFirstPhase && SITE_ACCESS.test(description)) return true;
      for (const topic of topicsOf(item.description)) if (topics.has(topic)) return true;
      return false;
    })
    .map((item) => item.id);
}

// ---------- Génération ----------

export interface PlanningContext {
  now: string;
  makeId: (prefix: string) => string;
  knownTrades: string[];
}

export interface PlanningResult {
  milestones: ProjectMilestone[];
  workOrders: WorkOrder[];
  window: { start: string; end: string } | null;
  created: number;
  /** Ordres existants dont les dates proposées ont été recalculées. */
  redated: number;
  /** Lots placés selon le calendrier relatif du document (« Mois 2 → Mois 8 »). */
  scheduledFromDocument: number;
}

const MATCH_STOP = new Set(["avec", "pour", "dans", "sans", "travaux", "general", "generale", "generaux"]);

function keyStems(text: string): Set<string> {
  return new Set(plain(text).split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !MATCH_STOP.has(word)).map(stem));
}

/** Période du calendrier dont le libellé partage le plus de mots avec le lot. */
function matchPeriod(workPackage: WorkPackage, periods: { label: string; period: RelativePeriod }[]): RelativePeriod | null {
  const words = keyStems(workPackage.name);
  let best: RelativePeriod | null = null;
  let bestScore = 0;
  for (const item of periods) {
    const score = [...keyStems(item.label)].filter((word) => words.has(word)).length;
    if (score > bestScore) {
      best = item.period;
      bestScore = score;
    }
  }
  return best;
}

function slot(start: string, lengthDays: number, index: number, count: number): { start: string; end: string } {
  const from = Math.floor((index * lengthDays) / count);
  const to = Math.max(from, Math.floor(((index + 1) * lengthDays) / count) - 1);
  return { start: addDays(start, from), end: addDays(start, to) };
}

function last<T>(items: T[]): T | undefined {
  return items[items.length - 1];
}

function nextNumber(existing: WorkOrder[]): () => string {
  let counter = existing.reduce((max, order) => {
    const value = Number(order.number.replace(/\D/g, ""));
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return () => `OT-${String(++counter).padStart(3, "0")}`;
}

function sourceOf(project: Project, workPackage: WorkPackage): { page: string | null; section: string | null; excerpt: string | null; provenance: Provenance } {
  const detected = project.analysis?.detectedWork.find((work) =>
    (work.code && plain(work.code) === plain(workPackage.code)) || plain(work.name) === plain(workPackage.name));
  if (!detected) return { page: null, section: null, excerpt: null, provenance: "USER" };
  return { page: detected.page, section: detected.section, excerpt: detected.excerpt, provenance: "DOCUMENT" };
}

/**
 * Planning déterministe : jalons du document, puis un ordre de travail par tâche.
 * Un lot qui correspond à une période du calendrier relatif du document suit cette période ;
 * les autres sont répartis par phase dans la fenêtre de travaux (provenance AI, à valider).
 * Les ordres existants gardent leurs saisies ; seules leurs dates encore proposées, avant
 * démarrage, suivent la fenêtre.
 */
export function generatePlanning(project: Project, context: PlanningContext): PlanningResult {
  const documentMilestones = milestonesFromAnalysis(project.analysis, context.makeId);
  const keptMilestones = project.milestones.filter((item) => item.provenance === "USER");
  const milestones = documentMilestones.length
    ? [...documentMilestones, ...keptMilestones]
    : project.milestones;
  const window = planningWindow(project, milestones);

  const packages = [...project.workPackages].sort((a, b) => a.sortOrder - b.sortOrder);
  const phases = packages.map((workPackage) => ({ workPackage, ...phaseOf(workPackage) }));
  const ranks = [...new Set(phases.map((item) => item.rank))].sort((a, b) => a - b);
  const totalWeight = ranks.reduce((sum, rank) => sum + phases.find((item) => item.rank === rank)!.weight, 0);
  const totalDays = window ? daysBetween(window.start, window.end) + 1 : 0;
  const rankWindow = new Map<number, { start: string; length: number }>();
  if (window) {
    let cursor = 0;
    for (const rank of ranks) {
      const weight = phases.find((item) => item.rank === rank)!.weight;
      const length = rank === ranks[ranks.length - 1]
        ? Math.max(1, totalDays - cursor)
        : Math.max(1, Math.round((weight / totalWeight) * totalDays));
      const start = Math.min(cursor, totalDays - 1);
      rankWindow.set(rank, { start: addDays(window.start, start), length: Math.max(1, Math.min(length, totalDays - start)) });
      cursor += length;
    }
  }

  const periods = milestones
    .map((milestone) => ({ label: milestone.label, period: relativePeriod(milestone) }))
    .filter((item): item is { label: string; period: RelativePeriod } => item.period !== null);
  const periodOf = new Map<string, RelativePeriod>();
  for (const workPackage of packages) {
    const period = matchPeriod(workPackage, periods);
    if (period) periodOf.set(workPackage.id, period);
  }

  const workOrders = [...project.workOrders];
  const byTask = new Map(workOrders.filter((order) => order.taskId).map((order) => [order.taskId!, order]));
  const byPackage = new Map<string, WorkOrder[]>();
  const number = nextNumber(workOrders);
  let created = 0;
  let redated = 0;

  const bySortOrder = (a: { workPackage: WorkPackage }, b: { workPackage: WorkPackage }) => a.workPackage.sortOrder - b.workPackage.sortOrder;
  const ordered = [
    ...phases.filter((item) => periodOf.has(item.workPackage.id)).sort((a, b) => {
      const left = periodOf.get(a.workPackage.id)!;
      const right = periodOf.get(b.workPackage.id)!;
      return left.from - right.from || left.to - right.to || bySortOrder(a, b);
    }),
    ...phases.filter((item) => !periodOf.has(item.workPackage.id)).sort((a, b) => a.rank - b.rank || bySortOrder(a, b)),
  ];
  const lastOrderOf = (workPackage: WorkPackage) => last(byPackage.get(workPackage.id) ?? [])?.id;

  for (const { workPackage, rank } of ordered) {
    const tasks: (Task | null)[] = workPackage.tasks.length
      ? [...workPackage.tasks].sort((a, b) => a.sortOrder - b.sortOrder)
      : [null];
    const ordersOfPackage: WorkOrder[] = [];
    const period = periodOf.get(workPackage.id) ?? null;
    let predecessors: string[];
    let packageWindow: { start: string; length: number } | null;
    if (period) {
      const earlier = phases.filter((item) => {
        const other = periodOf.get(item.workPackage.id);
        return other && other.unit === period.unit && other.to < period.from;
      });
      const latest = Math.max(...earlier.map((item) => periodOf.get(item.workPackage.id)!.to));
      predecessors = earlier
        .filter((item) => periodOf.get(item.workPackage.id)!.to === latest)
        .map((item) => lastOrderOf(item.workPackage))
        .filter((value): value is string => Boolean(value));
      const dates = window ? periodDates(window.start, period) : null;
      packageWindow = dates ? { start: dates.start, length: daysBetween(dates.start, dates.end) + 1 } : null;
    } else {
      const previousRank = ranks[ranks.indexOf(rank) - 1];
      predecessors = previousRank === undefined
        ? []
        : phases
          .filter((item) => item.rank === previousRank)
          .map((item) => lastOrderOf(item.workPackage))
          .filter((value): value is string => Boolean(value));
      packageWindow = rankWindow.get(rank) ?? null;
    }
    const source = sourceOf(project, workPackage);

    tasks.forEach((task, index) => {
      const dates = packageWindow ? slot(packageWindow.start, packageWindow.length, index, tasks.length) : null;
      const existing = task
        ? byTask.get(task.id)
        : workOrders.find((order) => order.workPackageId === workPackage.id && !order.taskId);
      if (existing) {
        const movable = dates
          && existing.datesProvenance === "AI"
          && !existing.actualStart
          && (existing.status === "TO_PLAN" || existing.status === "PLANNED" || existing.status === "BLOCKED")
          && (existing.plannedStart !== dates.start || existing.plannedEnd !== dates.end);
        const kept: WorkOrder = movable
          ? {
            ...existing,
            plannedStart: dates.start,
            plannedEnd: dates.end,
            status: existing.status === "TO_PLAN" ? "PLANNED" : existing.status,
            updatedAt: context.now,
          }
          : existing;
        if (movable) {
          workOrders[workOrders.indexOf(existing)] = kept;
          redated += 1;
        }
        ordersOfPackage.push(kept);
        return;
      }
      const blockers = blockersFor(project.missing, workPackage, task, rank === ranks[0]);
      const quantity = quantityFor(project, workPackage, task);
      const previous = last(ordersOfPackage);
      const status: WorkOrderStatus = blockers.length ? "BLOCKED" : dates ? "PLANNED" : "TO_PLAN";
      const order: WorkOrder = {
        id: context.makeId("wo"),
        number: "",
        workPackageId: workPackage.id,
        taskId: task?.id ?? null,
        code: workPackage.code,
        title: task?.name ?? workPackage.name,
        description: task?.description ?? "",
        trade: tradeFor(project, workPackage, task, context.knownTrades),
        assignee: "",
        status,
        plannedStart: dates?.start ?? null,
        plannedEnd: dates?.end ?? null,
        actualStart: null,
        actualEnd: null,
        datesProvenance: "AI",
        plannedHours: plannedHoursFor(project, workPackage, task),
        actualHours: null,
        quantity: quantity?.quantity ?? null,
        unit: quantity?.unit ?? null,
        progressPct: 0,
        dependsOn: previous ? [previous.id] : predecessors,
        blockers,
        ...source,
        createdAt: context.now,
        updatedAt: context.now,
      };
      workOrders.push(order);
      ordersOfPackage.push(order);
      created += 1;
    });
    byPackage.set(workPackage.id, ordersOfPackage);
  }

  const packageOrder = new Map(packages.map((item, index) => [item.id, index]));
  const taskOrder = new Map(packages.flatMap((item) => item.tasks.map((task) => [task.id, task.sortOrder] as const)));
  const position = (order: WorkOrder) => [packageOrder.get(order.workPackageId ?? "") ?? 999, taskOrder.get(order.taskId ?? "") ?? 0];
  workOrders
    .filter((order) => !order.number)
    .sort((a, b) => position(a)[0]! - position(b)[0]! || position(a)[1]! - position(b)[1]!)
    .forEach((order) => {
      order.number = number();
    });
  workOrders.sort((a, b) =>
    (packageOrder.get(a.workPackageId ?? "") ?? 999) - (packageOrder.get(b.workPackageId ?? "") ?? 999)
    || a.number.localeCompare(b.number, "fr", { numeric: true }));

  return {
    milestones,
    workOrders: refreshBlockedStatus(workOrders, project.missing),
    window,
    created,
    redated,
    scheduledFromDocument: periodOf.size,
  };
}

/** Un ordre bloqué repasse en planification quand ses informations manquantes sont levées, et inversement. */
export function refreshBlockedStatus(workOrders: WorkOrder[], missing: MissingInformation[]): WorkOrder[] {
  const open = new Set(missing.filter((item) => item.status === "OPEN").map((item) => item.id));
  return workOrders.map((order) => {
    const blocked = order.blockers.some((blocker) => open.has(blocker));
    if (order.status === "BLOCKED" && !blocked) {
      return { ...order, status: order.plannedStart ? "PLANNED" : "TO_PLAN" };
    }
    if ((order.status === "TO_PLAN" || order.status === "PLANNED") && blocked) {
      return { ...order, status: "BLOCKED" };
    }
    return order;
  });
}

/** Ordres dont un prédécesseur n'est pas terminé. */
export function waitingOn(order: WorkOrder, workOrders: WorkOrder[]): WorkOrder[] {
  return order.dependsOn
    .map((dependency) => workOrders.find((item) => item.id === dependency))
    .filter((item): item is WorkOrder => Boolean(item) && item!.status !== "DONE");
}

export interface PlanningSummary {
  total: number;
  byStatus: Record<WorkOrderStatus, number>;
  plannedHours: number | null;
  actualHours: number | null;
  progressPct: number;
  start: string | null;
  end: string | null;
}

export function planningSummary(project: Pick<Project, "workOrders">): PlanningSummary {
  const byStatus: Record<WorkOrderStatus, number> = { TO_PLAN: 0, PLANNED: 0, IN_PROGRESS: 0, DONE: 0, BLOCKED: 0 };
  let planned: number | null = null;
  let actual: number | null = null;
  let start: string | null = null;
  let end: string | null = null;
  for (const order of project.workOrders) {
    byStatus[order.status] += 1;
    if (order.plannedHours !== null) planned = (planned ?? 0) + order.plannedHours;
    if (order.actualHours !== null) actual = (actual ?? 0) + order.actualHours;
    const from = order.actualStart ?? order.plannedStart;
    const to = order.actualEnd ?? order.plannedEnd;
    if (from && (!start || from < start)) start = from;
    if (to && (!end || to > end)) end = to;
  }
  const total = project.workOrders.length;
  const progressPct = total
    ? Math.round(project.workOrders.reduce((sum, order) => sum + (order.status === "DONE" ? 100 : order.progressPct), 0) / total)
    : 0;
  return { total, byStatus, plannedHours: planned, actualHours: actual, progressPct, start, end };
}
