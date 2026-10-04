import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { defaultSettings } from "./demo";
import { structureDocument } from "./document-structure";
import { documentQuantity } from "./planning";
import { groundTenderAnalysis, toAnalysis } from "./tender-analysis";
import { extractTenderFacts } from "./tender-extraction";
import { detectMarketRegion, marketContext } from "./market";
import type { UnitCost } from "./types";
import { costLine, matchUnitCost, sameUnit, userSourcesFor } from "./unit-costs";
import type { QuantityItem } from "@/lib/validation/tender-analysis.schema";

const roadDocument = structureDocument(readFileSync(path.join(__dirname, "fixtures", "appel-offres-route-alberta.txt"), "utf8"));
const road = toAnalysis(groundTenderAnalysis(roadDocument, extractTenderFacts(roadDocument)).data, {
  id: "road",
  now: "2026-10-04T00:00:00.000Z",
  engine: "LOCAL",
  disclaimer: "",
});

const excavation: UnitCost = {
  id: "uc_1",
  name: "Excavation de masse",
  keywords: ["excavation", "terrassement"],
  unit: "m3",
  trade: "Opérateur d'engins",
  hoursPerUnit: 0.02,
  materialsCentsPerUnit: null,
  equipmentCentsPerUnit: 450,
  subcontractCentsPerUnit: null,
};

const settings = (unitCosts: UnitCost[], rate = 0) => {
  const base = defaultSettings();
  return {
    unitCosts,
    laborRates: base.laborRates.map((item) => (item.trade === "Opérateur d'engins" ? { ...item, hourlyRateCents: rate } : item)),
  };
};

describe("bibliothèque de coûts unitaires", () => {
  it("reconnaît les écritures d'une même unité", () => {
    assert.ok(sameUnit("m³", "m3"));
    assert.ok(sameUnit("LS", "forfait"));
    assert.ok(sameUnit("unités", "u"));
    assert.ok(!sameUnit("m³", "m²"));
    assert.ok(!sameUnit("t", "km"));
  });

  it("rattache un ouvrage par mot-clé, dans la même unité seulement", () => {
    assert.equal(matchUnitCost("Excavation et terrassement", "m³", [excavation])?.id, "uc_1");
    assert.equal(matchUnitCost("Excavation et terrassement", "t", [excavation]), null);
    assert.equal(matchUnitCost("Drainage et ponceaux", "m³", [excavation]), null);
    const byName = { ...excavation, id: "uc_2", keywords: [] };
    assert.equal(matchUnitCost("Lot 3 : excavation", "m³", [byName])?.id, "uc_2");
  });

  it("multiplie la quantité du document par les coûts unitaires saisis", () => {
    const quantity = documentQuantity(road, "LOT-03", "Excavation et terrassement");
    assert.equal(quantity?.value, 185000);
    const line = costLine({ texts: ["Excavation et terrassement"], quantity, quotedHours: null, settings: settings([excavation], 9000) });
    assert.equal(line.quantity, 185000);
    assert.equal(line.unit, "m³");
    assert.equal(line.hours, 3700);
    assert.equal(line.hourlyRateCents, 9000);
    assert.equal(line.equipmentCents, 83_250_000);
    assert.equal(line.materialsCents, 0);
    assert.equal(line.provenance, "SYSTEM");
    assert.deepEqual([line.origins.hours, line.origins.rate, line.origins.equipment, line.origins.materials], ["SYSTEM", "USER", "SYSTEM", "AI"]);
    assert.match(line.explanation, /185\s000 m³/);
    assert.match(line.explanation, /4,50\s\$\/m³/);
    assert.match(line.explanation, /Excavation de masse/);
  });

  it("signale un taux à saisir sans en inventer", () => {
    const quantity = documentQuantity(road, "LOT-03", "Excavation et terrassement");
    const line = costLine({ texts: ["Excavation et terrassement"], quantity, quotedHours: null, settings: settings([excavation]) });
    assert.equal(line.hours, 3700);
    assert.equal(line.hourlyRateCents, 0);
    assert.match(line.explanation, /Le métier Opérateur d'engins n'a pas de taux/);
  });

  it("reprend la quantité sans coût quand la bibliothèque ne couvre pas l'ouvrage", () => {
    const quantity = documentQuantity(road, "LOT-05", "Construction de la chaussée asphaltée");
    const line = costLine({ texts: ["Construction de la chaussée asphaltée"], quantity, quotedHours: null, settings: settings([excavation]) });
    assert.deepEqual([line.quantity, line.unit, line.hours, line.equipmentCents], [28500, "t", 0, 0]);
    assert.equal(line.provenance, "DOCUMENT");
    assert.equal(line.trade, "Paveur");
    assert.match(line.explanation, /Aucun ouvrage en t ne correspond/);
  });

  it("garde une ligne vide quand le document ne cite aucune quantité", () => {
    const line = costLine({ texts: ["Travaux divers"], quantity: null, quotedHours: null, settings: settings([excavation]) });
    assert.deepEqual([line.quantity, line.unit, line.hours, line.provenance], [0, "forfait", 0, "AI"]);
  });

  it("n'attribue une quantité du document qu'à une seule tâche", () => {
    const first = documentQuantity(road, "LOT-03", "Excavation et terrassement");
    assert.ok(first);
    assert.equal(documentQuantity(road, "LOT-03", "Excavation et terrassement", new Set([first])), null);
  });
});

describe("référentiel de marché", () => {
  const alberta = marketContext("CA-AB", "CAD")!;

  it("reconnaît le marché depuis le lieu des travaux ou la devise", () => {
    assert.equal(detectMarketRegion("Fort McMurray, Alberta"), "CA-AB");
    assert.equal(detectMarketRegion("Port de Jebel Ali, Dubaï"), "AE");
    assert.equal(detectMarketRegion("Doha"), "QA");
    assert.equal(detectMarketRegion("Halifax, Nouvelle-Écosse"), "CA-ATL");
    assert.equal(detectMarketRegion("", "EUR"), "FR");
    assert.equal(detectMarketRegion("", "CAD"), null);
  });

  it("reconnaît les marchés africains", () => {
    const cases: [string, string | null, string][] = [
      ["Port autonome de Dakar, Sénégal", null, "UEMOA"],
      ["Abidjan, Côte d’Ivoire", null, "UEMOA"],
      ["Niamey, Niger", null, "UEMOA"],
      ["Conakry, Guinée", null, "UEMOA"],
      ["Malabo, Guinée équatoriale", null, "CEMAC"],
      ["Port de Kribi, Cameroun", null, "CEMAC"],
      ["Onne, delta du Niger", null, "NG"],
      ["Jorf Lasfar, Maroc", null, "MA"],
      ["Arzew, Algérie", null, "DZ"],
      ["Port-Saïd, Égypte", null, "EG"],
      ["Mombasa, Kenya", null, "EAC"],
      ["Richards Bay, Afrique du Sud", null, "ZA"],
      ["Lobito, Angola", null, "AFC"],
      ["", "XOF", "UEMOA"],
      ["", "XAF", "CEMAC"],
    ];
    for (const [location, currency, code] of cases) assert.equal(detectMarketRegion(location, currency), code, location || currency!);
  });

  it("exprime les taux africains en devise locale ou dans la devise du projet", () => {
    const dakar = marketContext("UEMOA", "XOF")!;
    const welder = dakar.laborRates.find((item) => item.trade === "Soudeur")!;
    assert.equal(welder.hourlyRateCents, Math.round((82 * 0.06) / 0.00229 * 100));
    const inCad = marketContext("UEMOA", "CAD")!;
    assert.equal(inCad.laborRates.find((item) => item.trade === "Soudeur")!.hourlyRateCents, Math.round(82 * 0.06 * 100));
    assert.equal(inCad.unitCosts.find((item) => item.id === "civ-excavation")!.hoursPerUnit, 0.07);
  });

  it("chiffre l'excavation avec les heures et le taux du marché, marqués à valider", () => {
    const quantity = documentQuantity(road, "LOT-03", "Excavation et terrassement");
    const line = costLine({ texts: ["Excavation et terrassement"], quantity, quotedHours: null, settings: settings([]), market: alberta });
    assert.equal(line.hours, 9250);
    assert.equal(line.trade, "Opérateur d'engins");
    assert.equal(line.hourlyRateCents, 9240);
    assert.equal(line.equipmentCents, 185000 * 683);
    assert.match(line.explanation, /6,83\s\$\/m³ = 1\s263\s550\s\$/);
    assert.equal(line.provenance, "AI");
    assert.deepEqual([line.origins.hours, line.origins.rate, line.origins.equipment], ["AI", "AI", "AI"]);
    assert.match(line.sourceLabel, /^Référence marché CA-AB/);
    assert.match(line.explanation, /à valider/);
  });

  it("chiffre l'enrobé à la tonne citée par le document", () => {
    const quantity = documentQuantity(road, "LOT-05", "Construction de la chaussée asphaltée");
    const line = costLine({ texts: ["Construction de la chaussée asphaltée"], quantity, quotedHours: null, settings: settings([]), market: alberta });
    assert.equal(line.quantity, 28500);
    assert.equal(line.hours, Math.round(28500 * 0.13 * 100) / 100);
    assert.equal(line.materialsCents, Math.round(28500 * 12075));
    assert.equal(line.trade, "Paveur");
  });

  it("chiffre la mobilisation en pourcentage des autres coûts directs", () => {
    const quantity = { label: "Mobilisation", value: 1, unit: "forfait", source: { page: null, section: null, excerpt: "" } } as QuantityItem;
    const line = costLine({ texts: ["Mobilisation et installation de chantier"], quantity, quotedHours: null, settings: settings([]), market: alberta });
    assert.equal(line.percentOfDirect, 3.5);
    assert.equal(line.hours, 0);
    assert.match(line.explanation, /3,5 % des coûts directs/);
  });

  it("donne la priorité à votre bibliothèque et à votre taux", () => {
    const quantity = documentQuantity(road, "LOT-03", "Excavation et terrassement");
    const line = costLine({ texts: ["Excavation et terrassement"], quantity, quotedHours: null, settings: settings([excavation], 9000), market: alberta });
    assert.equal(line.hours, 3700);
    assert.equal(line.hourlyRateCents, 9000);
    assert.equal(line.provenance, "SYSTEM");
  });

  it("applique la productivité du Golfe et convertit en dirhams", () => {
    const dubai = marketContext("AE", "AED")!;
    const rate = dubai.laborRates.find((item) => item.trade === "Opérateur d'engins")!;
    assert.equal(rate.hourlyRateCents, Math.round((84 * 0.16) / 0.376 * 100));
    const excavationItem = dubai.unitCosts.find((item) => item.id === "civ-excavation")!;
    assert.equal(excavationItem.hoursPerUnit, 0.06);
    assert.equal(excavationItem.equipmentCentsPerUnit, Math.round((6.5 * 0.8) / 0.376 * 100));
  });

  it("n'applique pas vos taux en dollars canadiens à un projet en dirhams", () => {
    const sources = userSourcesFor({ ...settings([excavation], 9000), currency: "CAD" }, "AED");
    assert.deepEqual(sources.laborRates, []);
    assert.equal(sources.unitCosts[0].equipmentCentsPerUnit, Math.round(450 / 0.376));
    assert.equal(userSourcesFor({ ...settings([excavation], 9000), currency: "CAD" }, "CAD").laborRates.length > 0, true);
  });
});
