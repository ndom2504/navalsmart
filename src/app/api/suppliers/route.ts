import { NextResponse } from "next/server";
import { supplierSchema } from "@/domain/schemas";
import { addSupplier } from "@/server/estimates";
import { readDatabase } from "@/server/store";
import { apiError, requireApiUser } from "@/server/http";

export async function GET() {
  if (!(await requireApiUser())) return apiError(401, "Authentification requise.");
  const database = await readDatabase();
  return NextResponse.json(database.suppliers);
}

export async function POST(request: Request) {
  if (!(await requireApiUser())) return apiError(401, "Authentification requise.");
  const parsed = supplierSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Données invalides.");
  const supplierId = await addSupplier(parsed.data);
  return NextResponse.json({ id: supplierId }, { status: 201 });
}
