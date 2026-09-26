import { SubcontractorsBoard, type SubcontractorRow } from "@/components/subcontractors/subcontractors-board";
import { formatDate, formatMoney } from "@/lib/format";
import { quoteStatusLabels } from "@/lib/labels";
import { readDatabase } from "@/server/store";

export const metadata = { title: "Sous-traitants" };

export default async function SubcontractorsPage() {
  const database = await readDatabase();
  const rows: SubcontractorRow[] = database.projects.flatMap((project) =>
    project.subcontractors.map((item) => {
      const lot = project.workPackages.find((pkg) => pkg.id === item.workPackageId);
      const line = project.lines.find((entry) => entry.id === item.estimateLineId);
      const active = item.status === "RECEIVED" || item.status === "VALIDATED";
      return {
        id: item.id,
        projectId: project.id,
        projectName: project.name,
        name: item.name,
        contact: item.contact || "Non renseigné",
        category: item.category || "Non précisée",
        description: item.description || "Aucune description.",
        location: project.location || "Non précisé",
        lot: lot?.name ?? "Lot non associé",
        line: line?.description ?? "Ligne non associée",
        leadTime: item.leadTime || "Non précisé",
        validUntil: formatDate(item.validUntil),
        priceLabel: item.priceCents == null ? "Non chiffré" : formatMoney(item.priceCents, item.currency),
        priced: item.priceCents != null,
        currency: item.currency,
        included: item.included || "Non précisé",
        excluded: item.excluded || "Non précisé",
        documentName: item.documentName,
        quoteStatus: item.status,
        quoteLabel: quoteStatusLabels[item.status],
        status: active ? "Actif" : "En évaluation",
      };
    }),
  );
  const projects = database.projects.map((project) => ({ id: project.id, name: project.name, currency: project.currency }));

  return <SubcontractorsBoard rows={rows} projects={projects} />;
}
