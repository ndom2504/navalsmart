import { z } from "zod";

export const supplierSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(2).max(160),
  contact: z.string().trim().max(160),
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

export const supplierQuoteSchema = z.object({
  id: z.string().min(1).max(80),
  supplierId: z.string().min(1),
  workPackageId: z.string().nullable(),
  priceCents: z.number().int().nonnegative().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  leadTime: z.string().max(120),
  included: z.string().max(500),
  excluded: z.string().max(500),
  documentName: z.string().max(200).nullable(),
  status: z.enum(["REQUESTED", "RECEIVED", "TO_VERIFY", "VALIDATED"]),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
