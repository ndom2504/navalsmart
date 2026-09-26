import { SuppliersBoard, type SupplierRow } from "@/components/suppliers/supplier-board";
import { formatDate, formatMoney } from "@/lib/format";
import { quoteStatusLabels } from "@/lib/labels";
import { readDatabase } from "@/server/store";
import type { MaterialCost, QuoteStatus, SupplierQuote } from "@/domain/types";

export const metadata = { title: "Fournisseurs" };

function materialTotal(material: MaterialCost) {
  return Math.round(material.quantity * material.unitPriceCents) + material.transportCents + material.wasteCents;
}

function supplierStatus(quotes: SupplierQuote[], used: boolean): SupplierRow["status"] {
  if (quotes.some((quote) => quote.status === "REQUESTED" || quote.status === "TO_VERIFY")) return "En évaluation";
  if (used || quotes.some((quote) => quote.status === "RECEIVED" || quote.status === "VALIDATED")) return "Actif";
  return "Inactif";
}

export default async function SuppliersPage() {
  const database = await readDatabase();
  const rows: SupplierRow[] = database.suppliers.map((supplier) => {
    const quotes = database.projects.flatMap((project) =>
      project.quotes
        .filter((quote) => quote.supplierId === supplier.id)
        .map((quote) => ({ project, quote })),
    );
    const materials = database.projects.flatMap((project) =>
      project.materials
        .filter((material) => material.supplierId === supplier.id)
        .map((material) => ({ project, material })),
    );
    const pricedQuote = quotes.find((item) => item.quote.priceCents != null);
    const lead = quotes.find((item) => item.quote.leadTime && item.quote.leadTime !== "Non reçu");
    const projects = [...new Map(
      [...quotes.map((item) => item.project), ...materials.map((item) => item.project)].map((project) => [project.id, { id: project.id, name: project.name }]),
    ).values()];
    const priceLabel = pricedQuote?.quote.priceCents != null
      ? formatMoney(pricedQuote.quote.priceCents, pricedQuote.quote.currency)
      : materials[0]
        ? `${formatMoney(materials[0].material.unitPriceCents, supplier.currency)} / ${materials[0].material.unit}`
        : "Non chiffré";

    return {
      id: supplier.id,
      name: supplier.name,
      contact: supplier.contact || "Non renseigné",
      category: supplier.category,
      description: supplier.description || "Aucune description.",
      currency: supplier.currency,
      status: supplierStatus(quotes.map((item) => item.quote), materials.length > 0),
      leadTime: lead?.quote.leadTime || "Non précisé",
      priceLabel,
      priced: pricedQuote != null || materials.length > 0,
      projects,
      quotes: quotes.map(({ project, quote }) => ({
        id: quote.id,
        projectId: project.id,
        projectName: project.name,
        priceLabel: quote.priceCents == null ? "Non chiffré" : formatMoney(quote.priceCents, quote.currency),
        leadTime: quote.leadTime || "Non précisé",
        validUntil: formatDate(quote.validUntil),
        status: quote.status as QuoteStatus,
        statusLabel: quoteStatusLabels[quote.status],
        included: quote.included || "Non précisé",
        documentName: quote.documentName,
      })),
      materials: materials.map(({ project, material }) => ({
        id: material.id,
        projectId: project.id,
        projectName: project.name,
        description: material.description,
        quantityLabel: `${material.quantity} ${material.unit}`,
        priceLabel: formatMoney(materialTotal(material), supplier.currency),
      })),
    };
  });

  return <SuppliersBoard rows={rows} />;
}
