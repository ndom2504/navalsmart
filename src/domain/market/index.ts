import { MARKET_ACTIVITIES, type MarketActivity } from "@/domain/market/activities";
import { CAD_PER_UNIT, detectMarketRegion, MARKET_YEAR, marketRegion, type MarketRegion } from "@/domain/market/regions";
import { MARKET_TRADES } from "@/domain/market/trades";
import type { AiMarketActivity, AppSettings, LaborRate, Project, UnitCost } from "@/domain/types";

export { MARKET_ACTIVITIES, type MarketActivity } from "@/domain/market/activities";
export { CAD_PER_UNIT, detectMarketRegion, MARKET_REGIONS, MARKET_YEAR, marketRegion, PROJECT_CURRENCIES, type MarketRegion } from "@/domain/market/regions";
export { MARKET_TRADES, WORK_CATEGORY_LABELS, type MarketTrade, type WorkCategory } from "@/domain/market/trades";

export type MarketSource = "REFERENCE" | "OPENAI";

/** Ouvrage du référentiel exprimé dans la devise du projet, prêt pour le chiffrage. */
export interface MarketUnitCost extends UnitCost {
  percentOfDirect: number | null;
  source: MarketSource;
}

export interface MarketContext {
  region: MarketRegion;
  currency: string;
  unitCosts: MarketUnitCost[];
  laborRates: LaborRate[];
  /** « Référence marché Alberta 2025 » : rappelé dans chaque explication. */
  label: string;
}

function convert(cad: number, currency: string): number | null {
  const rate = CAD_PER_UNIT[currency];
  return rate ? cad / rate : null;
}

/** Taux chargés du marché, dans la devise demandée (centimes). */
export function marketLaborRates(region: MarketRegion, currency: string = region.currency): LaborRate[] {
  return MARKET_TRADES.flatMap((trade) => {
    const value = convert(trade.baseCad * region.laborIndex[trade.skill], currency);
    return value === null ? [] : [{ trade: trade.trade, hourlyRateCents: Math.round(value * 100) }];
  });
}

/** Ouvrage du référentiel dans la devise demandée : heures, matériaux et équipement par unité. */
export function marketActivityValues(activity: MarketActivity, region: MarketRegion, currency: string = region.currency) {
  const materials = convert(activity.materials * region.costIndex, currency);
  const equipment = convert(activity.equipment * region.costIndex, currency);
  return {
    hoursPerUnit: Math.round(activity.hoursPerUnit * region.productivityFactor * 10_000) / 10_000,
    materialsCentsPerUnit: materials === null ? null : Math.round(materials * 100),
    equipmentCentsPerUnit: equipment === null ? null : Math.round(equipment * 100),
  };
}

function fromReference(activity: MarketActivity, region: MarketRegion, currency: string): MarketUnitCost {
  const values = marketActivityValues(activity, region, currency);
  const percent = activity.percentOfDirect ?? null;
  return {
    id: activity.id,
    name: activity.name,
    keywords: activity.keywords,
    unit: activity.unit,
    trade: activity.trade,
    hoursPerUnit: percent === null ? values.hoursPerUnit : null,
    materialsCentsPerUnit: percent === null && activity.materials > 0 ? values.materialsCentsPerUnit : null,
    equipmentCentsPerUnit: percent === null && activity.equipment > 0 ? values.equipmentCentsPerUnit : null,
    subcontractCentsPerUnit: null,
    percentOfDirect: percent,
    source: "REFERENCE",
  };
}

function fromModel(activity: AiMarketActivity, currency: string): MarketUnitCost | null {
  const toProject = (local: number | null) => {
    if (local === null) return null;
    const cad = CAD_PER_UNIT[activity.currency];
    const value = cad ? convert(local * cad, currency) : null;
    return value === null ? null : Math.round(value * 100);
  };
  return {
    id: activity.id,
    name: activity.name,
    keywords: activity.keywords,
    unit: activity.unit,
    trade: activity.trade,
    hoursPerUnit: activity.hoursPerUnit,
    materialsCentsPerUnit: toProject(activity.materialsPerUnit),
    equipmentCentsPerUnit: toProject(activity.equipmentPerUnit),
    subcontractCentsPerUnit: null,
    percentOfDirect: null,
    source: "OPENAI",
  };
}

/**
 * Valeurs de marché d'une région dans la devise du projet. Les propositions du modèle
 * passent avant le référentiel : elles visent précisément un ouvrage du projet.
 */
export function marketContext(regionCode: string | null | undefined, currency: string, aiActivities: AiMarketActivity[] = []): MarketContext | null {
  const region = marketRegion(regionCode);
  if (!region || !CAD_PER_UNIT[currency]) return null;
  const fromAi = aiActivities.filter((item) => item.region === region.code).flatMap((item) => fromModel(item, currency) ?? []);
  return {
    region,
    currency,
    unitCosts: [...fromAi, ...MARKET_ACTIVITIES.map((activity) => fromReference(activity, region, currency))],
    laborRates: marketLaborRates(region, currency),
    label: `Référence marché ${region.label} ${MARKET_YEAR}`,
  };
}

/** Marché du projet : choix explicite, sinon lieu des travaux, sinon devise, sinon marché par défaut. */
export function projectMarketRegion(project: Pick<Project, "marketRegion" | "location" | "currency">, settings: Pick<AppSettings, "market">): string | null {
  if (!settings.market.enabled) return null;
  if (project.marketRegion && marketRegion(project.marketRegion)) return project.marketRegion;
  return detectMarketRegion(project.location, project.currency) ?? settings.market.defaultRegion;
}
