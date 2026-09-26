import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyParameters, equipmentCostCents, laborCostCents, materialCostCents } from "./calculations";

describe("moteur de calcul", () => {
  it("calcule la main-d'œuvre : heures × taux × quantité", () => {
    const cents = laborCostCents({
      hours: 300,
      hourlyRateCents: 6500,
      workers: 1,
      productivityFactor: 1,
      overtimeHours: 0,
      overtimeFactor: 1.5,
    });
    assert.equal(cents, 1_950_000);
  });

  it("applique productivité et heures supplémentaires", () => {
    const cents = laborCostCents({
      hours: 100,
      hourlyRateCents: 5000,
      workers: 2,
      productivityFactor: 1.1,
      overtimeHours: 10,
      overtimeFactor: 1.5,
    });
    assert.equal(cents, Math.round(100 * 5000 * 2 * 1.1 + 10 * 5000 * 2 * 1.5));
  });

  it("calcule les matériaux : quantité × prix + transport + pertes", () => {
    assert.equal(
      materialCostCents({
        quantity: 10,
        unitPriceCents: 2500,
        transportCents: 4000,
        wasteCents: 1500,
      }),
      10 * 2500 + 4000 + 1500,
    );
  });

  it("calcule l'équipement : quantité × durée × taux + transport", () => {
    assert.equal(
      equipmentCostCents({
        quantity: 2,
        duration: 5,
        rateCents: 12000,
        transportCents: 3000,
      }),
      2 * 5 * 12000 + 3000,
    );
  });

  it("n'utilise que les pourcentages fournis", () => {
    const result = applyParameters(1_000_000, 12, 8, 10);
    assert.equal(result.indirectCents, 120_000);
    assert.equal(result.riskAllowanceCents, 80_000);
    assert.equal(result.estimatedCents, 1_200_000);
    assert.equal(result.bidCents, 1_320_000);
  });

  it("traite un pourcentage nul comme zéro, sans marge implicite", () => {
    const result = applyParameters(500_000, 0, 0, 0);
    assert.equal(result.estimatedCents, 500_000);
    assert.equal(result.bidCents, 500_000);
  });
});
