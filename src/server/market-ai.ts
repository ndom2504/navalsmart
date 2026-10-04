import "server-only";

import OpenAI from "openai";
import { z } from "zod";
import { MARKET_TRADES, MARKET_YEAR, marketContext, marketRegion, projectMarketRegion } from "@/domain/market";
import type { AiMarketActivity } from "@/domain/types";
import { lacksUnitCost, userSourcesFor } from "@/domain/unit-costs";
import { id } from "@/lib/utils";
import { recordMarketSuggestions } from "@/server/estimates";
import { findProject, readDatabase } from "@/server/store";

const MAX_ITEMS = 25;

const value = (max: number) => z.number().finite().nonnegative().max(max).nullable().catch(null);

const responseSchema = z.object({
  items: z.array(z.object({
    index: z.number().int().nonnegative(),
    trade: z.string().max(80).catch(""),
    hoursPerUnit: value(100_000),
    materialsPerUnit: value(100_000_000),
    equipmentPerUnit: value(100_000_000),
    rationale: z.string().max(400).catch(""),
  })),
});

const PROMPT = [
  "Tu es estimateur senior en construction (naval, génie civil, routes, ponts, bâtiment, industriel, réseaux linéaires).",
  "Pour chaque ouvrage reçu, propose des valeurs unitaires indicatives du marché demandé, pour l'année demandée, dans la devise locale demandée :",
  "- hoursPerUnit : heures de main-d'œuvre de l'équipe complète par unité de l'ouvrage ;",
  "- materialsPerUnit et equipmentPerUnit : coûts directs par unité, sans frais généraux, sans profit, sans taxes ;",
  "- trade : le métier principal, choisi dans la liste fournie ;",
  "- rationale : une phrase sur les hypothèses retenues (diamètre, épaisseur, méthode, rendement).",
  "Mets null quand une valeur ne s'applique pas ou ne peut pas être estimée raisonnablement. Ne calcule aucun total : le moteur de NavalSmart multiplie lui-même par les quantités.",
  'Réponds uniquement par un objet JSON : {"items":[{"index":0,"trade":"","hoursPerUnit":0,"materialsPerUnit":0,"equipmentPerUnit":0,"rationale":""}]}.',
].join("\n");

export interface SuggestionOutcome {
  added: number;
  error: string | null;
}

/**
 * Demande au modèle des valeurs de marché pour les ouvrages quantifiés qu'aucune source ne couvre.
 * Les propositions sont validées, bornées puis mises en cache ; le moteur fait les calculs.
 */
export async function suggestMarketActivities(projectId: string): Promise<SuggestionOutcome> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { added: 0, error: null };
  const database = await readDatabase();
  const project = findProject(database, projectId);
  if (!project) return { added: 0, error: null };
  const regionCode = projectMarketRegion(project, database.settings);
  const region = marketRegion(regionCode);
  if (!region) return { added: 0, error: null };
  const market = marketContext(regionCode, project.currency, database.aiMarketActivities ?? []);
  const pending = project.lines
    .filter((line) => line.status === "AI_GENERATED" && line.quantity > 0 && lacksUnitCost(`${line.description} ${line.lot}`, line.unit, userSourcesFor(database.settings, project.currency), market))
    .slice(0, MAX_ITEMS);
  if (!pending.length) return { added: 0, error: null };

  const model = process.env.OPENAI_MODEL || database.settings.aiModel || "gpt-4.1-mini";
  try {
    const completion = await new OpenAI({ apiKey: key }).chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            market: region.label,
            year: MARKET_YEAR,
            currency: region.currency,
            trades: MARKET_TRADES.map((trade) => trade.trade),
            items: pending.map((line, index) => ({ index, name: line.description, lot: line.lot, unit: line.unit, quantity: line.quantity })),
          }),
        },
      ],
    });
    const parsed = responseSchema.safeParse(JSON.parse(completion.choices[0]?.message?.content ?? "{}"));
    if (!parsed.success) return recordMarketSuggestions(projectId, [], "réponse du modèle non conforme");
    const now = new Date().toISOString();
    const activities: AiMarketActivity[] = parsed.data.items.flatMap((item) => {
      const line = pending[item.index];
      if (!line || (item.hoursPerUnit === null && item.materialsPerUnit === null && item.equipmentPerUnit === null)) return [];
      const trade = MARKET_TRADES.find((candidate) => candidate.trade === item.trade)?.trade ?? "";
      return [{
        id: id("aimkt"),
        region: region.code,
        currency: region.currency,
        name: line.description,
        keywords: [line.description],
        unit: line.unit,
        trade,
        hoursPerUnit: item.hoursPerUnit,
        materialsPerUnit: item.materialsPerUnit,
        equipmentPerUnit: item.equipmentPerUnit,
        rationale: item.rationale,
        model: completion.model,
        createdAt: now,
      }];
    });
    return recordMarketSuggestions(projectId, activities, null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return recordMarketSuggestions(projectId, [], /429|quota/i.test(message) ? "quota OpenAI dépassé" : message.slice(0, 160));
  }
}
