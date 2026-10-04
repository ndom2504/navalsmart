import { CAD_PER_UNIT, type MarketContext, type MarketUnitCost } from "@/domain/market";
import { inferTrade } from "@/domain/planning";
import { plain } from "@/domain/tender-extraction";
import type { AppSettings, CostOrigins, EstimateLine, LaborRate, Provenance, UnitCost } from "@/domain/types";
import type { QuantityItem } from "@/lib/validation/tender-analysis.schema";
import { formatMoney, formatNumber } from "@/lib/format";

const UNIT_ALIASES: [RegExp, string][] = [
  [/^(m3|metres? cubes?)$/, "m3"],
  [/^(m2|metres? carres?)$/, "m2"],
  [/^(m|ml|mlin|metres?|metres? lineaires?)$/, "m"],
  [/^(km|kilometres?)$/, "km"],
  [/^(ha|hectares?)$/, "ha"],
  [/^(t|tm|tonnes?)$/, "t"],
  [/^(kg|kilos?|kilogrammes?)$/, "kg"],
  [/^(l|litres?)$/, "l"],
  [/^(h|hr|heures?)$/, "h"],
  [/^(j|jours?)$/, "jour"],
  [/^(u|un|unites?|pieces?|pcs?)$/, "unite"],
  [/^(ls|forfaits?|global|globale|ens|ensemble)$/, "forfait"],
  [/^(po-?diam|pouces?-?diametres?|inch-?dia)$/, "po-diam"],
];

function unitKey(unit: string): string {
  const folded = plain(unit.replace(/²/g, "2").replace(/³/g, "3")).replace(/[.\s]+/g, " ").trim();
  return UNIT_ALIASES.find(([pattern]) => pattern.test(folded))?.[1] ?? folded;
}

/** Deux unités désignent la même mesure (m³ et m3, LS et forfait…). */
export function sameUnit(a: string, b: string): boolean {
  return unitKey(a) === unitKey(b);
}

const NAME_STOP = new Set(["avec", "pour", "dans", "sans", "travaux", "fourniture", "pose", "mise", "place"]);

function words(text: string): string[] {
  return plain(text).split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !NAME_STOP.has(word));
}

function stem(word: string): string {
  return word.slice(0, 5);
}

/** Nombre de mots-clés (ou, à défaut, de mots du nom) de l'ouvrage présents dans le texte. */
function matchScore(text: string, item: UnitCost): number {
  const folded = ` ${plain(text).replace(/[^a-z0-9]+/g, " ")} `;
  const keywords = item.keywords.map((keyword) => plain(keyword).replace(/[^a-z0-9]+/g, " ").trim()).filter(Boolean);
  if (keywords.length) return keywords.filter((keyword) => folded.includes(` ${keyword}`)).length;
  const stems = new Set(words(text).map(stem));
  return words(item.name).filter((word) => stems.has(stem(word))).length;
}

/** Ouvrage de la bibliothèque qui correspond au travail, dans l'unité de la quantité. */
export function matchUnitCost<T extends UnitCost>(text: string, unit: string, library: T[]): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const item of library) {
    if (!sameUnit(item.unit, unit)) continue;
    const score = matchScore(text, item);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Vos taux et votre bibliothèque sont saisis dans la devise des paramètres. Pour un projet
 * dans une autre devise, les taux d'un autre marché ne s'appliquent pas et les coûts unitaires
 * sont convertis au taux de change du référentiel.
 */
export function userSourcesFor(settings: Pick<AppSettings, "laborRates" | "unitCosts" | "currency">, projectCurrency: string): Pick<AppSettings, "laborRates" | "unitCosts"> {
  if (settings.currency === projectCurrency) return settings;
  const from = CAD_PER_UNIT[settings.currency];
  const to = CAD_PER_UNIT[projectCurrency];
  if (!from || !to) return { laborRates: [], unitCosts: [] };
  const factor = from / to;
  const scale = (value: number | null) => (value === null ? null : Math.round(value * factor));
  return {
    laborRates: [],
    unitCosts: settings.unitCosts.map((item) => ({
      ...item,
      materialsCentsPerUnit: scale(item.materialsCentsPerUnit),
      equipmentCentsPerUnit: scale(item.equipmentCentsPerUnit),
      subcontractCentsPerUnit: scale(item.subcontractCentsPerUnit),
    })),
  };
}

/** Ouvrage quantifié qu'aucune source ne chiffre : candidat à une proposition du modèle. */
export function lacksUnitCost(text: string, unit: string, settings: Pick<AppSettings, "unitCosts">, market: MarketContext | null): boolean {
  if (!unit || sameUnit(unit, "forfait") || sameUnit(unit, "h")) return false;
  if (matchUnitCost(text, unit, settings.unitCosts)) return false;
  return !(market && matchUnitCost(text, unit, market.unitCosts));
}

function findRate(trade: string, rates: LaborRate[]): LaborRate | null {
  if (!trade) return null;
  return rates.find((rate) => plain(rate.trade) === plain(trade)) ?? null;
}

export type CostKey = "hours" | "rate" | "materials" | "equipment" | "subcontract";

export type LineCosting = Pick<
  EstimateLine,
  "quantity" | "unit" | "hours" | "hourlyRateCents" | "materialsCents" | "equipmentCents" | "subcontractCents" | "sourceLabel" | "provenance" | "explanation" | "origins"
> & {
  trade: string;
  unitCost: UnitCost | null;
  /** Valeurs effectivement fournies par une source (document, vos données, marché). */
  filled: Record<CostKey, boolean>;
  /** La quantité vient du document. */
  quoted: boolean;
  /** Forfait à chiffrer en pourcentage des autres lignes, après elles. */
  percentOfDirect: number | null;
};

export interface LineCostingInput {
  /** Tâche puis lot : le premier texte qui désigne un métier l'emporte. */
  texts: string[];
  quantity: QuantityItem | null;
  quotedHours: number | null;
  settings: Pick<AppSettings, "laborRates" | "unitCosts">;
  market?: MarketContext | null;
  currency?: string;
}

function where(quantity: QuantityItem): string {
  const parts = [quantity.source.section ? `section ${quantity.source.section}` : null, quantity.source.page ? `p. ${quantity.source.page}` : null].filter(Boolean);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

/**
 * Chiffre une ligne, source par source : quantité et heures citées par le document,
 * puis vos coûts unitaires et vos taux, puis le référentiel de marché (indicatif, à valider).
 * Le moteur fait chaque multiplication ; rien n'est estimé hors de ces sources.
 */
export function costLine(input: LineCostingInput): LineCosting {
  const { quantity, quotedHours, settings } = input;
  const market = input.market ?? null;
  const currency = input.currency ?? market?.currency ?? "CAD";
  const text = input.texts.join(" ");
  const userItem = quantity ? matchUnitCost(text, quantity.unit, settings.unitCosts) : null;
  const marketItem: MarketUnitCost | null = !userItem && quantity && market ? matchUnitCost(text, quantity.unit, market.unitCosts) : null;
  const item: UnitCost | null = userItem ?? marketItem;
  const computed: Provenance = marketItem ? "AI" : "SYSTEM";
  const knownTrades = [...new Set([...settings.laborRates, ...(market?.laborRates ?? [])].map((rate) => rate.trade))];
  const trade = item?.trade || inferTrade(input.texts, knownTrades);
  const userRate = findRate(trade, settings.laborRates);
  const marketRate = market ? findRate(trade, market.laborRates) : null;
  const rate = userRate && userRate.hourlyRateCents > 0
    ? { cents: userRate.hourlyRateCents, origin: "USER" as const }
    : marketRate
      ? { cents: marketRate.hourlyRateCents, origin: "AI" as const }
      : null;
  const percentOfDirect = marketItem?.percentOfDirect ?? null;

  const qty = quantity?.value ?? 0;
  const unit = quantity?.unit ?? (quotedHours ? "heures" : "forfait");
  const perUnit = (value: number | null | undefined) => (item && value !== null && value !== undefined && qty > 0 ? Math.round(qty * value) : null);

  const itemHours = item && item.hoursPerUnit !== null && qty > 0 ? Math.round(qty * item.hoursPerUnit * 100) / 100 : null;
  const hours = quotedHours ?? itemHours ?? 0;
  const materials = perUnit(item?.materialsCentsPerUnit);
  const equipment = perUnit(item?.equipmentCentsPerUnit);
  const subcontract = perUnit(item?.subcontractCentsPerUnit);
  const rateFilled = hours > 0 && rate !== null;

  const filled: Record<CostKey, boolean> = {
    hours: Boolean(quotedHours) || itemHours !== null,
    rate: rateFilled,
    materials: materials !== null,
    equipment: equipment !== null,
    subcontract: subcontract !== null,
  };
  const origins: CostOrigins = {
    hours: quotedHours ? "DOCUMENT" : itemHours !== null ? computed : "AI",
    rate: rateFilled ? rate.origin : "AI",
    materials: materials !== null ? computed : "AI",
    equipment: equipment !== null ? computed : "AI",
    subcontract: subcontract !== null ? computed : "AI",
    logistics: "AI",
    other: "AI",
  };

  const explanation: string[] = [];
  if (quantity) explanation.push(`Quantité citée par le document : ${formatNumber(qty, 2)} ${quantity.unit}${where(quantity)}.`);
  else if (!quotedHours) explanation.push("Tâche détectée dans la portée. Aucune quantité n'est citée : saisissez-la pour obtenir un chiffrage.");
  if (quotedHours) explanation.push(`Heures citées dans le document : ${formatNumber(quotedHours, 2)} h.`);
  if (item) {
    const unitLabel = quantity?.unit ?? item.unit;
    const details: string[] = [];
    if (itemHours !== null && !quotedHours) details.push(`${formatNumber(item.hoursPerUnit ?? 0, 4)} h/${unitLabel} × ${formatNumber(qty, 2)} = ${formatNumber(itemHours, 2)} h`);
    if (materials !== null) details.push(`matériaux ${formatMoney(item.materialsCentsPerUnit ?? 0, currency, 2)}/${unitLabel} = ${formatMoney(materials, currency)}`);
    if (equipment !== null) details.push(`équipement ${formatMoney(item.equipmentCentsPerUnit ?? 0, currency, 2)}/${unitLabel} = ${formatMoney(equipment, currency)}`);
    if (subcontract !== null) details.push(`sous-traitance ${formatMoney(item.subcontractCentsPerUnit ?? 0, currency, 2)}/${unitLabel} = ${formatMoney(subcontract, currency)}`);
    if (marketItem) {
      const origin = marketItem.source === "OPENAI" ? `proposition NavalSmart AI pour ${market!.region.label}` : market!.label;
      if (percentOfDirect !== null) explanation.push(`${origin} : « ${item.name} » = ${formatNumber(percentOfDirect, 1)} % des coûts directs des autres lignes (valeur indicative, à valider).`);
      else explanation.push(`${origin} : « ${item.name} »${details.length ? ` : ${details.join(" ; ")}` : ""} (valeurs indicatives, à valider).`);
    } else {
      explanation.push(`Ouvrage « ${item.name} » de votre bibliothèque${details.length ? ` : ${details.join(" ; ")}` : " : aucun coût unitaire renseigné"}.`);
    }
  } else if (quantity) {
    explanation.push(`Aucun ouvrage en ${quantity.unit} ne correspond à ce travail, ni dans votre bibliothèque ni dans le référentiel de marché : coûts à saisir.`);
  }
  if (hours > 0) {
    if (!trade) explanation.push("Métier non déterminé : choisissez le taux de la ligne.");
    else if (rate?.origin === "USER") explanation.push(`Taux du métier ${trade} selon votre barème.`);
    else if (rate) explanation.push(`Taux du métier ${trade} : ${market!.label}, ${formatMoney(rate.cents, currency, 2)}/h chargé (à valider ; saisissez votre taux dans Paramètres › Coûts).`);
    else explanation.push(`Le métier ${trade} n'a pas de taux : saisissez-le dans Paramètres › Coûts.`);
  }

  const sourceLabel = marketItem
    ? `${marketItem.source === "OPENAI" ? "Proposition IA" : "Référence marché"} ${market!.region.code} : ${item!.name}`
    : userItem
      ? `Appel d'offres × bibliothèque : ${userItem.name}`
      : quantity ? "Appel d'offres — quantité citée" : quotedHours ? "Appel d'offres" : "Portée détectée — quantité non citée";

  return {
    quantity: qty || (quotedHours ?? 0),
    unit,
    hours,
    hourlyRateCents: rateFilled ? rate.cents : 0,
    materialsCents: materials ?? 0,
    equipmentCents: equipment ?? 0,
    subcontractCents: subcontract ?? 0,
    sourceLabel: sourceLabel.slice(0, 240),
    provenance: marketItem ? "AI" : userItem ? "SYSTEM" : quantity || quotedHours ? "DOCUMENT" : "AI",
    explanation: explanation.join(" ").slice(0, 2000),
    origins,
    trade,
    unitCost: item,
    filled,
    quoted: Boolean(quantity || quotedHours),
    percentOfDirect,
  };
}
