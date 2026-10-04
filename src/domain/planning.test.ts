import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { defaultSettings, emptyProject } from "./demo";
import { structureDocument } from "./document-structure";
import {
  documentWorkWindow,
  durationDays,
  generatePlanning,
  inferTrade,
  milestonesFromAnalysis,
  planningSummary,
  refreshBlockedStatus,
} from "./planning";
import { groundTenderAnalysis, toAnalysis } from "./tender-analysis";
import { extractTenderFacts } from "./tender-extraction";
import type { Analysis, Project } from "./types";

// Appel d'offres fictif Appel_offres_test_NavalSmart.pdf.
const text = readFileSync(path.join(__dirname, "fixtures", "appel-offres-test-navalsmart.txt"), "utf8");
const document = structureDocument(text);
const data = groundTenderAnalysis(document, extractTenderFacts(document)).data;
const analysis = toAnalysis(data, { id: "a", now: "2026-10-02T00:00:00.000Z", engine: "LOCAL", disclaimer: "" });

function counter() {
  let value = 0;
  return (prefix: string) => `${prefix}_${++value}`;
}

function projectFromTender(overrides: Partial<Project> = {}, source: Analysis = analysis): Project {
  const makeId = counter();
  const project = emptyProject({
    id: "proj_test",
    name: "Test",
    client: "",
    vessel: "",
    type: "REPAIR",
    location: "",
    receivedAt: null,
    submissionDeadline: null,
    plannedStart: null,
    plannedEnd: null,
    currency: "CAD",
    description: "",
    learningMode: false,
    settings: defaultSettings(),
    now: "2026-10-02T00:00:00.000Z",
  });
  project.analysis = source;
  project.workPackages = source.detectedWork.map((work, index) => ({
    id: makeId("wp"),
    name: work.name,
    code: work.code ?? String(index + 1),
    sortOrder: index + 1,
    tasks: work.tasks.map((task, taskIndex) => ({ id: makeId("task"), name: task, description: "", sortOrder: taskIndex + 1 })),
  }));
  project.missing = source.missing.map((item) => ({ ...item, id: makeId("miss") }));
  return { ...project, ...overrides };
}

// Appel d'offres fictif Appel_offres_route_Alberta_NavalSmart.docx : calendrier en mois relatifs, sans date de début.
const roadDocument = structureDocument(readFileSync(path.join(__dirname, "fixtures", "appel-offres-route-alberta.txt"), "utf8"));
const roadAnalysis = toAnalysis(groundTenderAnalysis(roadDocument, extractTenderFacts(roadDocument)).data, {
  id: "road",
  now: "2026-10-04T00:00:00.000Z",
  engine: "LOCAL",
  disclaimer: "",
});

const context = () => ({ now: "2026-10-02T00:00:00.000Z", makeId: counter(), knownTrades: defaultSettings().laborRates.map((rate) => rate.trade) });

describe("jalons et fenêtre de travaux", () => {
  it("reprend le calendrier du document avec sa source", () => {
    const milestones = milestonesFromAnalysis(analysis, counter());
    const mobilisation = milestones.find((item) => item.label === "Mobilisation prévue");
    assert.equal(mobilisation?.date, "2027-01-04");
    assert.equal(mobilisation?.toConfirm, true);
    assert.equal(mobilisation?.provenance, "DOCUMENT");
    assert.equal(mobilisation?.section, "6");
    assert.ok(milestones.some((item) => item.kind === "DURATION" && item.date === null));
  });

  it("déduit la fenêtre du début des travaux et de l'achèvement cible", () => {
    const window = documentWorkWindow(milestonesFromAnalysis(analysis, counter()));
    assert.deepEqual(window, { start: "2027-01-11", end: "2027-04-02" });
  });

  it("calcule la fin à partir de la durée quand l'achèvement manque", () => {
    const milestones = milestonesFromAnalysis(analysis, counter()).filter((item) => !/achevement|Achèvement/.test(item.label));
    assert.deepEqual(documentWorkWindow(milestones), { start: "2027-01-11", end: "2027-04-04" });
    assert.equal(durationDays("Durée cible : 12 semaines"), 84);
  });
});

describe("ordres de travail", () => {
  it("crée un ordre par tâche, rattaché à son lot et à sa source", () => {
    const project = projectFromTender();
    const result = generatePlanning(project, context());
    const taskCount = project.workPackages.reduce((sum, item) => sum + item.tasks.length, 0);
    assert.equal(result.workOrders.length, taskCount);
    assert.equal(result.created, taskCount);
    assert.deepEqual(result.window, { start: "2027-01-11", end: "2027-04-02" });
    assert.equal(result.workOrders[0]?.number, "OT-001");
    for (const order of result.workOrders) {
      assert.ok(order.workPackageId);
      assert.equal(order.datesProvenance, "AI");
      assert.equal(order.provenance, "DOCUMENT");
      assert.ok(order.plannedStart! >= "2027-01-11" && order.plannedEnd! <= "2027-04-02");
      assert.ok(order.plannedStart! <= order.plannedEnd!);
    }
  });

  it("n'invente aucune heure : sans ligne chiffrée, plannedHours reste null", () => {
    const result = generatePlanning(projectFromTender(), context());
    assert.ok(result.workOrders.every((order) => order.plannedHours === null));
    assert.equal(planningSummary({ workOrders: result.workOrders }).plannedHours, null);
  });

  it("reprend les quantités du document par lot", () => {
    const result = generatePlanning(projectFromTender(), context());
    const luminaires = result.workOrders.find((order) => /luminaires/i.test(order.title));
    assert.equal(luminaires?.quantity, 18);
    assert.equal(luminaires?.unit, "unités");
    const steel = result.workOrders.find((order) => order.code === "WP-02");
    assert.equal(steel?.quantity, 35);
    assert.equal(steel?.unit, "m²");
  });

  it("déduit le métier et ordonne les phases : structure avant peinture, essais en dernier", () => {
    const result = generatePlanning(projectFromTender(), context());
    const byCode = (code: string) => result.workOrders.filter((order) => order.code === code);
    assert.equal(byCode("WP-03")[0]?.trade, "Tuyauteur");
    assert.equal(byCode("WP-04")[0]?.trade, "Électricien");
    assert.equal(byCode("WP-07")[0]?.trade, "Peintre");
    const structureEnd = byCode("WP-02").map((order) => order.plannedEnd!).sort().pop()!;
    const paintStart = byCode("WP-07").map((order) => order.plannedStart!).sort()[0]!;
    assert.ok(structureEnd < paintStart);
    const tests = byCode("WP-08")[0]!;
    assert.ok(tests.dependsOn.length > 0);
    assert.ok(tests.dependsOn.every((dependency) => result.workOrders.find((order) => order.id === dependency)?.code === "WP-07"));
  });

  it("bloque les ordres qui attendent une information du donneur d'ordre", () => {
    const project = projectFromTender();
    const result = generatePlanning(project, context());
    const plates = result.workOrders.find((order) => order.code === "WP-02")!;
    assert.equal(plates.status, "BLOCKED");
    const thickness = project.missing.find((item) => /épaisseur exacte des tôles/.test(item.description))!;
    assert.ok(plates.blockers.includes(thickness.id));
    const paint = result.workOrders.find((order) => order.code === "WP-07")!;
    assert.equal(paint.status, "BLOCKED");

    const resolved = project.missing.map((item) => ({ ...item, status: "RESOLVED" as const }));
    const refreshed = refreshBlockedStatus(result.workOrders, resolved);
    assert.ok(refreshed.every((order) => order.status === "PLANNED"));
  });

  it("ne touche pas aux ordres existants lors d'une nouvelle génération", () => {
    const project = projectFromTender();
    const first = generatePlanning(project, context());
    const edited = first.workOrders.map((order, index) => index === 0
      ? { ...order, assignee: "Équipe A", plannedStart: "2027-01-12", datesProvenance: "USER" as const }
      : order);
    const second = generatePlanning({ ...project, workOrders: edited, milestones: first.milestones }, context());
    assert.equal(second.created, 0);
    assert.equal(second.workOrders.length, first.workOrders.length);
    const kept = second.workOrders.find((order) => order.id === edited[0]!.id);
    assert.equal(kept?.assignee, "Équipe A");
    assert.equal(kept?.plannedStart, "2027-01-12");
  });

  it("laisse les dates vides sans fenêtre de travaux", () => {
    const project = projectFromTender({ analysis: { ...analysis, structured: { ...analysis.structured!, schedule: [] }, deadlines: [] } });
    const result = generatePlanning(project, context());
    assert.equal(result.window, null);
    assert.ok(result.workOrders.every((order) => order.plannedStart === null && (order.status === "TO_PLAN" || order.status === "BLOCKED")));
  });

  it("aligne le métier sur le barème", () => {
    assert.equal(inferTrade(["Remplacement de tôles"], ["Soudeur"]), "Soudeur");
    assert.equal(inferTrade(["Travaux divers"], ["Soudeur"]), "");
  });
});

describe("calendrier relatif (tronçon routier, Mois 1 à Mois 18)", () => {
  it("crée un ordre par lot du tableau, sans date tant que le début n'est pas connu", () => {
    const result = generatePlanning(projectFromTender({}, roadAnalysis), context());
    assert.equal(result.workOrders.length, 9);
    assert.equal(result.window, null);
    assert.equal(result.scheduledFromDocument, 9);
    assert.ok(result.workOrders.every((order) => order.plannedStart === null));
    const paving = result.workOrders.find((order) => order.code === "LOT-05")!;
    assert.equal(paving.quantity, 28500);
    assert.equal(paving.unit, "t");
    assert.equal(paving.status, "BLOCKED");
    assert.equal(paving.trade, "Paveur");
    const trades = Object.fromEntries(result.workOrders.map((order) => [order.code, order.trade]));
    assert.equal(trades["LOT-03"], "Opérateur d'engins");
    assert.equal(trades["LOT-06"], "Poseur de conduites");
    assert.equal(trades["LOT-08"], "Monteur de signalisation");
    assert.equal(trades["LOT-01"], "");
  });

  it("place chaque lot sur sa période à partir du début saisi", () => {
    const result = generatePlanning(projectFromTender({ plannedStart: "2027-05-03" }, roadAnalysis), context());
    assert.deepEqual(result.window, { start: "2027-05-03", end: "2028-11-02" });
    const byCode = (code: string) => result.workOrders.find((order) => order.code === code)!;
    assert.deepEqual([byCode("LOT-03").plannedStart, byCode("LOT-03").plannedEnd], ["2027-06-03", "2028-01-02"]);
    assert.deepEqual([byCode("LOT-05").plannedStart, byCode("LOT-05").plannedEnd], ["2028-02-03", "2028-08-02"]);
    assert.equal(byCode("LOT-09").plannedEnd, "2028-11-02");
    assert.deepEqual(byCode("LOT-05").dependsOn, [byCode("LOT-06").id]);
  });

  it("recalcule les dates proposées quand le début change, sans toucher aux dates saisies", () => {
    const first = generatePlanning(projectFromTender({}, roadAnalysis), context());
    const edited = first.workOrders.map((order) => order.code === "LOT-01"
      ? { ...order, plannedStart: "2027-04-26", plannedEnd: "2027-05-07", datesProvenance: "USER" as const }
      : order);
    const second = generatePlanning(projectFromTender({ plannedStart: "2027-05-03", workOrders: edited, milestones: first.milestones }, roadAnalysis), context());
    assert.equal(second.created, 0);
    assert.equal(second.redated, 8);
    const mobilisation = second.workOrders.find((order) => order.code === "LOT-01")!;
    assert.equal(mobilisation.plannedStart, "2027-04-26");
    const clearing = second.workOrders.find((order) => order.code === "LOT-02")!;
    assert.equal(clearing.plannedStart, "2027-05-03");
    assert.equal(clearing.status, "BLOCKED");
  });
});
