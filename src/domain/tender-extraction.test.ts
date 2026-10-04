import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { chunkDocument } from "./chunking";
import { normalizeForMatch, structureDocument } from "./document-structure";
import { describeQuantity, groundTenderAnalysis, mergeTenderAnalyses, toAnalysis } from "./tender-analysis";
import { extractTenderFacts, parseFrenchDate } from "./tender-extraction";
import { parseTenderAnalysis, tenderAnalysisSchema } from "../lib/validation/tender-analysis.schema";

// Texte extrait du PDF de test Appel_offres_test_NavalSmart.pdf (document fictif).
const text = readFileSync(path.join(__dirname, "fixtures", "appel-offres-test-navalsmart.txt"), "utf8");
const document = structureDocument(text);

describe("structure du document", () => {
  it("conserve pages, sections, tableaux et paragraphes complets", () => {
    assert.equal(document.pageCount, 4);
    const sections = document.sections.map((section) => section.number);
    for (const expected of ["1", "4", "5", "6", "11", "Annexe A"]) assert.ok(sections.includes(expected), `section ${expected}`);
    assert.ok(document.blocks.filter((block) => block.kind === "table_row").length >= 8);
    const wp02 = document.blocks.find((block) => block.text.startsWith("WP-02"));
    assert.ok(wp02?.text.endsWith("Les quantités finales seront confirmées après inspection."));
    assert.equal(wp02?.page, 1);
    assert.equal(wp02?.section, "4");
  });
});

describe("découpage en morceaux", () => {
  it("envoie le document entier quand il est court", () => {
    const chunks = chunkDocument(document);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]!.text.includes("=== PAGE 4 ==="));
  });

  it("ne coupe jamais un bloc ni une phrase", () => {
    const chunks = chunkDocument(document, { maxChars: 1200, wholeDocumentChars: 0 });
    assert.ok(chunks.length > 3);
    for (const block of document.blocks) {
      const holders = chunks.filter((chunk) => normalizeForMatch(chunk.text).includes(normalizeForMatch(block.text)));
      assert.ok(holders.length >= 1, `bloc entier introuvable : ${block.text}`);
    }
    assert.ok(chunks.slice(1).every((chunk) => chunk.text.includes("Plan du document")));
  });
});

describe("extraction déterministe", () => {
  const data = extractTenderFacts(document);
  const merged = mergeTenderAnalyses(document, data, data);

  it("trouve projet, client, navire, référence et soumission", () => {
    assert.equal(merged.project.name?.value, "Rénovation et modernisation du navire HORIZON");
    assert.equal(merged.project.client?.value, "Atlantic Maritime Services Inc.");
    assert.equal(merged.project.vessel?.value, "MV HORIZON");
    assert.equal(merged.project.reference?.value, "AO-NAV-2026-014");
    assert.equal(merged.submission.deadline?.value, "2026-11-30");
    assert.equal(merged.submission.deadline?.time, "16:00");
    assert.equal(merged.submission.currency?.value, "CAD");
    assert.equal(merged.submission.validityDays?.value, 90);
  });

  it("détecte les 8 lots de travaux", () => {
    assert.deepEqual(merged.workPackages.map((item) => item.code), ["WP-01", "WP-02", "WP-03", "WP-04", "WP-05", "WP-06", "WP-07", "WP-08"]);
    assert.ok(merged.workPackages.every((item) => item.source.page && item.source.section === "4"));
  });

  it("détecte les quantités avec leur qualificatif", () => {
    assert.ok(merged.quantities.length >= 7);
    const values = merged.quantities.map((item) => item.value);
    for (const expected of [35, 120, 85, 1800, 18, 24, 16]) assert.ok(values.includes(expected), `quantité ${expected}`);
    const steel = merged.quantities.find((item) => item.value === 35)!;
    assert.ok(steel.qualifiers.includes("APPROXIMATE"));
    assert.ok(steel.qualifiers.includes("TOLERANCE"));
    assert.equal(steel.tolerancePct, 25);
    assert.equal(steel.workPackageCode, "WP-02");
    assert.equal(describeQuantity(steel), "WP-02 · Acier à remplacer : 35 m² (environ, ±25 %, indicatif, à confirmer)");
    assert.equal(merged.quantities.find((item) => item.value === 18)?.toConfirm, true);
  });

  it("transforme les mentions à confirmer en informations manquantes ou dépendances", () => {
    assert.ok(merged.missingInformation.length >= 6);
    assert.ok(merged.missingInformation.every((item) => item.source.page !== null && item.source.excerpt));
    assert.ok(merged.missingInformation.some((item) => item.kind === "DEPENDENCY"));
    const section11 = merged.missingInformation.filter((item) => item.source.section === "11");
    assert.equal(section11.length, 5);
  });

  it("lit le calendrier, les risques et les questions", () => {
    assert.ok(merged.schedule.length >= 9);
    assert.equal(merged.schedule.find((item) => item.label.startsWith("Mobilisation"))?.date, "2027-01-04");
    assert.equal(merged.schedule.find((item) => item.label.startsWith("Mobilisation"))?.toConfirm, true);
    assert.ok(merged.risks.length >= 3);
    assert.ok(merged.risks.every((risk) => risk.source.excerpt && risk.sourceType === "AI_DATA"));
    assert.ok(merged.questionsForClient.length >= 6);
    assert.equal(merged.requiredDocuments.length, 11);
  });

  it("ne produit jamais de marqueur « Non spécifié »", () => {
    assert.ok(!JSON.stringify(merged).includes("Non spécifié"));
    assert.ok(tenderAnalysisSchema.safeParse(merged).success);
  });

  it("projette l'analyse vers le modèle existant", () => {
    const analysis = toAnalysis(merged, { id: "a", now: "2026-10-02T00:00:00.000Z", engine: "LOCAL", disclaimer: "" });
    assert.equal(analysis.projectHints.client, "Atlantic Maritime Services Inc.");
    assert.equal(analysis.detectedWork.length, 8);
    assert.equal(analysis.detectedWork[1]?.code, "WP-02");
    assert.equal(analysis.quantities[0]?.page, "2");
    assert.equal(analysis.risks[0]?.provenance, "AI");
  });
});

describe("réponse du modèle : Zod puis ancrage", () => {
  const raw = {
    project: {
      name: { value: "Rénovation et modernisation du navire HORIZON", source: { page: 3, section: "9", excerpt: "APPEL D’OFFRES – RÉNOVATION ET MODERNISATION DU NAVIRE HORIZON" }, sourceType: "SOURCE_DOCUMENT", confidence: "HIGH" },
      client: { value: "Océan Industries", source: { page: 1, section: "1", excerpt: "Émetteur : Océan Industries" }, sourceType: "SOURCE_DOCUMENT", confidence: "HIGH" },
      vessel: null,
      reference: "Non spécifié dans le document",
    },
    submission: { deadline: null, currency: null, validityDays: null },
    quantities: [
      { label: "Acier", value: 50, unit: "m²", qualifiers: [], toConfirm: false, source: { page: 2, section: "5", excerpt: "Acier à remplacer : 35 m² (±25 %)" }, sourceType: "SOURCE_DOCUMENT", confidence: "HIGH" },
      { label: "Acier à remplacer", value: "35", unit: "m2", qualifiers: ["TOLERANCE"], tolerancePct: 25, toConfirm: false, source: { page: "7", section: "x", excerpt: "Acier à remplacer : 35 m² (±25 %)" }, sourceType: "SOURCE_DOCUMENT", confidence: "HIGH" },
    ],
    requirements: [{ text: "Non spécifié dans le document", source: { page: null, section: null, excerpt: null } }],
    risks: [
      { title: "Retenue de garantie", probability: "MEDIUM", impact: "LOW", level: "LOW", potentialCostCents: 500000, source: { page: 3, section: "8", excerpt: "Une retenue de 10 % pourra être appliquée jusqu’à l’acceptation finale des travaux." }, sourceType: "SOURCE_DOCUMENT", confidence: "MEDIUM" },
      { title: "Risque sans citation", probability: "HIGH", impact: "HIGH", level: "HIGH", source: { page: null, section: null, excerpt: null }, sourceType: "AI_DATA" },
    ],
    questionsForClient: [{ question: "Quelle est l'épaisseur des tôles ?", source: { page: null, section: null, excerpt: null } }],
  };

  it("valide, écarte les inventions et recalcule page et section", () => {
    const parsed = parseTenderAnalysis(raw);
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.data.project.reference, null);
    assert.equal(parsed.data.requirements.length, 0);
    assert.equal(parsed.data.quantities[1]?.value, 35);
    assert.ok(!("potentialCostCents" in parsed.data.risks[0]!));

    const { data, report } = groundTenderAnalysis(document, parsed.data);
    assert.equal(data.project.name?.source.page, 1);
    assert.equal(data.project.client, null);
    assert.deepEqual(data.quantities.map((item) => item.value), [35]);
    assert.equal(data.quantities[0]?.source.page, 2);
    assert.equal(data.quantities[0]?.source.section, "5");
    assert.equal(data.risks.length, 1);
    assert.equal(data.risks[0]?.sourceType, "AI_DATA");
    assert.equal(data.questionsForClient[0]?.sourceType, "AI_DATA");
    assert.ok(report.dropped.length >= 3);

    const merged = mergeTenderAnalyses(document, data, extractTenderFacts(document));
    assert.equal(merged.project.client?.value, "Atlantic Maritime Services Inc.");
    assert.equal(merged.project.vessel?.value, "MV HORIZON");
    assert.equal(merged.quantities.filter((item) => item.value === 35).length, 1);
  });
});

describe("appel d'offres hors naval : tableaux et titres Word (tronçon routier)", () => {
  const road = structureDocument(readFileSync(path.join(__dirname, "fixtures", "appel-offres-route-alberta.txt"), "utf8"));
  const facts = extractTenderFacts(road);

  it("ouvre une section pour chaque titre « # N. »", () => {
    assert.equal(facts.project.name?.value, "Construction du tronçon routier Highway 63 – Accès industriel Nord");
    assert.deepEqual(road.sections.map((section) => section.number), ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
  });

  it("lit le lieu, les lots du tableau et leurs quantités", () => {
    assert.equal(facts.project.location?.value, "Région de Fort McMurray, Alberta");
    assert.equal(facts.workPackages.length, 9);
    assert.deepEqual(facts.workPackages[2], { ...facts.workPackages[2], code: "LOT-03", title: "Excavation et terrassement" });
    const excavation = facts.quantities.find((item) => item.workPackageCode === "LOT-03")!;
    assert.equal(excavation.value, 185000);
    assert.equal(excavation.unit, "m³");
    assert.equal(excavation.label, "Excavation et terrassement");
    assert.equal(facts.quantities.find((item) => item.workPackageCode === "LOT-02")?.unit, "ha");
  });

  it("lit la durée, le calendrier relatif et les risques du tableau", () => {
    assert.equal(facts.schedule.find((item) => item.kind === "DURATION")?.text, "18 mois");
    const periods = facts.schedule.filter((item) => item.kind === "PERIOD");
    assert.equal(periods.length, 8);
    assert.equal(periods.find((item) => item.label === "Terrassement")?.text, "Mois 2 → Mois 8");
    assert.ok(periods.every((item) => item.date === null));
    assert.equal(facts.risks.length, 5);
    const weather = facts.risks.find((item) => item.title === "Météo")!;
    assert.equal(weather.level, "HIGH");
    assert.equal(weather.description, "Gel, neige et précipitations");
    assert.equal(weather.sourceType, "SOURCE_DOCUMENT");
  });

  it("reprend les informations manquantes, hypothèses et livrables de leurs sections", () => {
    assert.ok(facts.missingInformation.some((item) => item.description === "Formulation finale des mélanges bitumineux."));
    assert.equal(facts.missingInformation.filter((item) => item.source.section === "8").length, 6);
    assert.equal(facts.assumptions.length, 4);
    assert.equal(facts.requiredDocuments.length, 7);
    assert.ok(!JSON.stringify(facts).includes("Non spécifié"));
    assert.ok(tenderAnalysisSchema.safeParse(facts).success);
  });
});

describe("dates françaises", () => {
  it("lit la date et l'heure", () => {
    assert.deepEqual(parseFrenchDate("30 novembre 2026 à 16 h 00 (heure de Québec)"), { date: "2026-11-30", time: "16:00" });
    assert.deepEqual(parseFrenchDate("au plus tard le 1er décembre 2026"), { date: "2026-12-01", time: null });
    assert.equal(parseFrenchDate("12 semaines"), null);
  });
});
