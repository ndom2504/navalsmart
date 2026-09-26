import type {
  CostBucket,
  EquipmentCost,
  FinancialSummary,
  LaborCost,
  MaterialCost,
  Project,
  ResolvedLine,
  Subcontractor,
} from "@/domain/types";

export function laborCostCents(input: Pick<
  LaborCost,
  "hours" | "hourlyRateCents" | "workers" | "productivityFactor" | "overtimeHours" | "overtimeFactor"
>): number {
  const base =
    input.hours * input.hourlyRateCents * input.workers * input.productivityFactor;
  const overtime =
    input.overtimeHours * input.hourlyRateCents * input.workers * input.overtimeFactor;
  return Math.round(base + overtime);
}

export function materialCostCents(
  input: Pick<MaterialCost, "quantity" | "unitPriceCents" | "transportCents" | "wasteCents">,
): number {
  return Math.round(input.quantity * input.unitPriceCents + input.transportCents + input.wasteCents);
}

export function equipmentCostCents(
  input: Pick<EquipmentCost, "quantity" | "duration" | "rateCents" | "transportCents">,
): number {
  return Math.round(input.quantity * input.duration * input.rateCents + input.transportCents);
}

export function subcontractorCostCents(input: Pick<Subcontractor, "priceCents">): number {
  return input.priceCents ?? 0;
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function hoursLabel(hours: number): string {
  return new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 2 }).format(hours);
}

export function describeLabor(input: LaborCost, currency: string): string {
  const simple =
    input.workers === 1 &&
    input.productivityFactor === 1 &&
    input.overtimeHours === 0;
  const total = laborCostCents(input);
  if (simple) {
    return `${hoursLabel(input.hours)} h × ${money(input.hourlyRateCents, currency)} = ${money(total, currency)}`;
  }
  const base = `${hoursLabel(input.hours)} h × ${money(input.hourlyRateCents, currency)} × ${hoursLabel(input.workers)} × productivité ${hoursLabel(input.productivityFactor)}`;
  if (input.overtimeHours <= 0) {
    return `${base} = ${money(total, currency)}`;
  }
  return `${base} + ${hoursLabel(input.overtimeHours)} h sup. × facteur ${hoursLabel(input.overtimeFactor)} = ${money(total, currency)}`;
}

export function describeMaterial(input: MaterialCost, currency: string): string {
  const total = materialCostCents(input);
  return `${hoursLabel(input.quantity)} ${input.unit} × ${money(input.unitPriceCents, currency)} + transport ${money(input.transportCents, currency)} + pertes ${money(input.wasteCents, currency)} = ${money(total, currency)}`;
}

export function describeEquipment(input: EquipmentCost, currency: string): string {
  const total = equipmentCostCents(input);
  return `${hoursLabel(input.quantity)} × ${hoursLabel(input.duration)} ${input.durationUnit} × ${money(input.rateCents, currency)} + transport ${money(input.transportCents, currency)} = ${money(total, currency)}`;
}

function emptyBucket(): CostBucket {
  return {
    laborCents: 0,
    materialsCents: 0,
    equipmentCents: 0,
    subcontractCents: 0,
    logisticsCents: 0,
    otherCents: 0,
    directCents: 0,
    indirectCents: 0,
    riskAllowanceCents: 0,
    estimatedCents: 0,
    bidCents: 0,
  };
}

export function resolveLine(project: Project, lineId: string): ResolvedLine {
  const line = project.lines.find((item) => item.id === lineId);
  if (!line) {
    return { id: lineId, laborFormula: "Ligne introuvable", materialsFormula: "", equipmentFormula: "", ...emptyBucket() };
  }

  const linkedLabor = project.labor.filter((item) => item.estimateLineId === line.id);
  const laborCents = linkedLabor.length
    ? linkedLabor.reduce((sum, item) => sum + laborCostCents(item), 0)
    : Math.round(line.hours * line.hourlyRateCents);
  const laborFormula = linkedLabor.length
    ? linkedLabor.map((item) => describeLabor(item, project.currency)).join(" ; ")
    : `${hoursLabel(line.hours)} h × ${money(line.hourlyRateCents, project.currency)} = ${money(laborCents, project.currency)}`;

  const linkedMaterials = project.materials.filter((item) => item.estimateLineId === line.id);
  const materialsCents = linkedMaterials.length
    ? linkedMaterials.reduce((sum, item) => sum + materialCostCents(item), 0)
    : line.materialsCents;
  const materialsFormula = linkedMaterials.length
    ? linkedMaterials.map((item) => describeMaterial(item, project.currency)).join(" ; ")
    : money(materialsCents, project.currency);

  const linkedEquipment = project.equipment.filter((item) => item.estimateLineId === line.id);
  const equipmentCents = linkedEquipment.length
    ? linkedEquipment.reduce((sum, item) => sum + equipmentCostCents(item), 0)
    : line.equipmentCents;
  const equipmentFormula = linkedEquipment.length
    ? linkedEquipment.map((item) => describeEquipment(item, project.currency)).join(" ; ")
    : money(equipmentCents, project.currency);

  const linkedSubs = project.subcontractors.filter((item) => item.estimateLineId === line.id);
  const subcontractCents = linkedSubs.length
    ? linkedSubs.reduce((sum, item) => sum + subcontractorCostCents(item), 0)
    : line.subcontractCents;

  const logisticsCents = line.logisticsCents;
  const otherCents = line.otherCents;
  const directCents =
    laborCents + materialsCents + equipmentCents + subcontractCents + logisticsCents + otherCents;

  return {
    id: line.id,
    laborCents,
    materialsCents,
    equipmentCents,
    subcontractCents,
    logisticsCents,
    otherCents,
    directCents,
    indirectCents: 0,
    riskAllowanceCents: 0,
    estimatedCents: directCents,
    bidCents: directCents,
    laborFormula,
    materialsFormula,
    equipmentFormula,
  };
}

export function financialSummary(project: Project): FinancialSummary {
  const resolved = project.lines.map((line) => resolveLine(project, line.id));
  const bucket = emptyBucket();
  for (const line of resolved) {
    bucket.laborCents += line.laborCents;
    bucket.materialsCents += line.materialsCents;
    bucket.equipmentCents += line.equipmentCents;
    bucket.subcontractCents += line.subcontractCents;
    bucket.logisticsCents += line.logisticsCents;
    bucket.otherCents += line.otherCents;
  }

  bucket.laborCents += project.labor
    .filter((item) => !item.estimateLineId)
    .reduce((sum, item) => sum + laborCostCents(item), 0);
  bucket.materialsCents += project.materials
    .filter((item) => !item.estimateLineId)
    .reduce((sum, item) => sum + materialCostCents(item), 0);
  bucket.equipmentCents += project.equipment
    .filter((item) => !item.estimateLineId)
    .reduce((sum, item) => sum + equipmentCostCents(item), 0);
  bucket.subcontractCents += project.subcontractors
    .filter((item) => !item.estimateLineId)
    .reduce((sum, item) => sum + subcontractorCostCents(item), 0);

  bucket.directCents =
    bucket.laborCents +
    bucket.materialsCents +
    bucket.equipmentCents +
    bucket.subcontractCents +
    bucket.logisticsCents +
    bucket.otherCents;
  bucket.indirectCents = Math.round((bucket.directCents * project.overheadPct) / 100);
  bucket.riskAllowanceCents = Math.round((bucket.directCents * project.contingencyPct) / 100);
  bucket.estimatedCents = bucket.directCents + bucket.indirectCents + bucket.riskAllowanceCents;
  bucket.bidCents = Math.round(bucket.estimatedCents * (1 + project.marginPct / 100));

  return {
    ...bucket,
    currency: project.currency,
    contingencyPct: project.contingencyPct,
    overheadPct: project.overheadPct,
    marginPct: project.marginPct,
    lines: resolved,
  };
}

export function applyParameters(
  directCents: number,
  overheadPct: number,
  contingencyPct: number,
  marginPct: number,
): Pick<CostBucket, "indirectCents" | "riskAllowanceCents" | "estimatedCents" | "bidCents"> {
  const indirectCents = Math.round((directCents * overheadPct) / 100);
  const riskAllowanceCents = Math.round((directCents * contingencyPct) / 100);
  const estimatedCents = directCents + indirectCents + riskAllowanceCents;
  const bidCents = Math.round(estimatedCents * (1 + marginPct / 100));
  return { indirectCents, riskAllowanceCents, estimatedCents, bidCents };
}
