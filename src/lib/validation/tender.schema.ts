import { z } from "zod";

export const tenderDocumentSchema = z.object({
  id: z.string().min(1).max(80),
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().nonnegative(),
  pageCount: z.number().int().nonnegative().nullable(),
  storedPath: z.string().min(1).max(400),
  extractedText: z.string(),
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]),
  importedAt: z.string().datetime(),
});

export const tenderSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  documents: z.array(tenderDocumentSchema),
});

export type TenderInput = z.infer<typeof tenderSchema>;
