import assert from "node:assert/strict";
import test from "node:test";
import { parseAIAnalysis, parseEstimate, parseMissingInformation, parseRisk, parseTender } from "@/lib/validation";

const fact = {
  value: "Remplacement de tôles",
  source: "Remplacement de tôles de coque",
  page: "2",
  section: "1.2",
  status: "AI_GENERATED",
};

test("parseAIAnalysis accepte une analyse citée et écarte un montant", () => {
  const parsed = parseAIAnalysis({
    summary: "Portée citée.",
    project: { name: "Navire Demo", client: null, vessel: null, deadline: null },
    scope: [fact],
    risks: [{
      value: "Pénalités de retard",
      source: "pénalités de retard",
      page: null,
      section: null,
      probability: "MEDIUM",
      impact: "HIGH",
      level: "MEDIUM",
      potentialCostCents: 500_000,
    }],
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.scope[0]?.value, "Remplacement de tôles");
  assert.equal(parsed.data.risks.length, 0);
  assert.equal("potentialCostCents" in parsed.data, false);
});

test("parseAIAnalysis refuse un objet sans projet", () => {
  const parsed = parseAIAnalysis({ summary: "incomplet" });
  assert.equal(parsed.success, false);
});

test("parseEstimate refuse une ligne sans origine", () => {
  const parsed = parseEstimate({ id: "line_1", description: "Soudage", hours: 10 });
  assert.equal(parsed.success, false);
});

test("parseRisk et parseMissingInformation acceptent les statuts du modèle", () => {
  const risk = parseRisk({
    id: "risk_1",
    title: "Amiante possible",
    probability: "MEDIUM",
    impact: "HIGH",
    level: "HIGH",
    potentialCostCents: null,
    mitigation: "",
    owner: "Estimateur",
    status: "OPEN",
    justification: "présence d'amiante",
    page: null,
    section: null,
    provenance: "DOCUMENT",
  });
  const missing = parseMissingInformation({
    id: "miss_1",
    description: "Quantité d'acier non spécifiée",
    importance: "HIGH",
    sourceLabel: "Quantité d'acier non spécifiée",
    page: null,
    section: null,
    requiredAction: "Confirmer avant de figer le prix.",
    status: "OPEN",
    note: "",
  });
  assert.equal(risk.success, true);
  assert.equal(missing.success, true);
});

test("parseTender refuse un document sans texte", () => {
  const parsed = parseTender({ id: "tender_1", title: "Appel", documents: [{ id: "doc_1" }] });
  assert.equal(parsed.success, false);
});
