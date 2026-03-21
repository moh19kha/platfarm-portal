import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { quotations } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const quotationsRouter = router({
  /** List all quotations/invoices/receipts, newest first */
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(quotations).orderBy(desc(quotations.createdAt));
    return rows;
  }),

  /** Get a single quotation by ID */
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(quotations).where(eq(quotations.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  /** Save (create or update) a quotation/invoice/receipt */
  save: publicProcedure
    .input(
      z.object({
        id: z.number().optional(),
        documentType: z.enum(["quotation", "invoice", "payment_receipt"]),
        quotationNo: z.string(),
        clientName: z.string(),
        clientAddress: z.string().optional().default(""),
        clientCountry: z.string().optional().default(""),
        clientTrn: z.string().optional().default(""),
        projectName: z.string().optional().default(""),
        quotationDate: z.string().optional().default(""),
        validUntil: z.string().optional().default(""),
        incoterms: z.string().optional().default(""),
        paymentTerms: z.string().optional().default(""),
        currency: z.string().optional().default("USD"),
        notes: z.string().optional().default(""),
        paymentSchedule: z.string().optional().default(""),
        bankDetails: z.string().optional().default(""),
        products: z.string().optional().default("[]"),
        subtotal: z.number().optional().default(0),
        vatTotal: z.number().optional().default(0),
        total: z.number().optional().default(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const data = {
        documentType: input.documentType,
        quotationNo: input.quotationNo,
        clientName: input.clientName,
        clientAddress: input.clientAddress,
        clientCountry: input.clientCountry,
        clientTrn: input.clientTrn,
        projectName: input.projectName,
        quotationDate: input.quotationDate,
        validUntil: input.validUntil,
        incoterms: input.incoterms,
        paymentTerms: input.paymentTerms,
        currency: input.currency,
        notes: input.notes,
        paymentSchedule: input.paymentSchedule,
        bankDetails: input.bankDetails,
        products: input.products,
        subtotal: input.subtotal,
        vatTotal: input.vatTotal,
        total: input.total,
        userId: ctx.user?.id ?? null,
      };

      if (input.id) {
        // Update existing
        await db.update(quotations).set(data).where(eq(quotations.id, input.id));
        return { id: input.id, ...data };
      } else {
        // Insert new
        const result = await db.insert(quotations).values(data as any);
        const insertId = result[0].insertId;
        return { id: insertId, ...data };
      }
    }),

  /** Delete a quotation by ID */
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(quotations).where(eq(quotations.id, input.id));
      return { success: true };
    }),
});
