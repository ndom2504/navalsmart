import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { financialSummary } from "@/domain/calculations";
import { getProject, ServiceError } from "@/server/estimates";
import { apiError, requireApiUser } from "@/server/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireApiUser())) return apiError(401, "Authentification requise.");
  try {
    const { id } = await context.params;
    const project = await getProject(id);
    const summary = financialSummary(project);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "NavalSmart";
    const sheet = workbook.addWorksheet("Estimation");
    sheet.addRow(["NavalSmart — données fictives si dossier de démonstration"]);
    sheet.addRow(["Projet", project.name]);
    sheet.addRow(["Client", project.client]);
    sheet.addRow(["Navire", project.vessel]);
    sheet.addRow([]);
    sheet.addRow(["Lot", "Description", "Quantité", "Unité", "Heures", "Taux", "Total", "Source", "Statut"]);
    for (const line of project.lines) {
      const resolved = summary.lines.find((item) => item.id === line.id);
      sheet.addRow([line.lot, line.description, line.quantity, line.unit, line.hours, line.hourlyRateCents / 100, (resolved?.directCents ?? 0) / 100, line.sourceLabel, line.status]);
    }
    sheet.addRow([]);
    sheet.addRow(["Coût direct", summary.directCents / 100]);
    sheet.addRow(["Frais indirects", summary.indirectCents / 100]);
    sheet.addRow(["Provision", summary.riskAllowanceCents / 100]);
    sheet.addRow(["Coût estimé", summary.estimatedCents / 100]);
    sheet.addRow(["Prix proposé", summary.bidCents / 100]);
    const missing = workbook.addWorksheet("Manquants");
    missing.addRow(["Description", "Importance", "Action", "Statut"]);
    for (const item of project.missing) missing.addRow([item.description, item.importance, item.requiredAction, item.status]);
    const buffer = await workbook.xlsx.writeBuffer();
    const bytes = new Uint8Array(buffer);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="estimation-${project.id}.xlsx"`,
      },
    });
  } catch (error) {
    if (error instanceof ServiceError) return apiError(error.status, error.message);
    return apiError(500, "Export impossible.");
  }
}
