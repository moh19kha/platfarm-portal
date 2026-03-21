import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { shipmentDrafts } from "../../drizzle/schema";

export const draftsRouter = router({
  /** List all drafts for the current user, optionally filtered by wizard type */
  list: protectedProcedure
    .input(
      z
        .object({
          wizardType: z.enum(["purchase", "sales", "multi_linked"]).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [eq(shipmentDrafts.userId, ctx.user.id)];
      if (input?.wizardType) {
        conditions.push(eq(shipmentDrafts.wizardType, input.wizardType));
      }

      const rows = await db
        .select()
        .from(shipmentDrafts)
        .where(and(...conditions))
        .orderBy(desc(shipmentDrafts.updatedAt));

      return rows;
    }),

  /** Get a single draft by ID (must belong to current user) */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const rows = await db
        .select()
        .from(shipmentDrafts)
        .where(
          and(
            eq(shipmentDrafts.id, input.id),
            eq(shipmentDrafts.userId, ctx.user.id)
          )
        )
        .limit(1);

      return rows[0] ?? null;
    }),

  /** Save a new draft or update an existing one */
  save: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(), // if provided, updates existing draft
        wizardType: z.enum(["purchase", "sales", "multi_linked"]),
        currentStep: z.number().min(1).max(4),
        label: z.string().optional(),
        formData: z.any(), // JSON blob of the full wizard state
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (input.id) {
        // Update existing draft — verify ownership
        const existing = await db
          .select()
          .from(shipmentDrafts)
          .where(
            and(
              eq(shipmentDrafts.id, input.id),
              eq(shipmentDrafts.userId, ctx.user.id)
            )
          )
          .limit(1);

        if (!existing[0]) throw new Error("Draft not found");

        await db
          .update(shipmentDrafts)
          .set({
            currentStep: input.currentStep,
            label: input.label ?? existing[0].label,
            formData: input.formData,
          })
          .where(eq(shipmentDrafts.id, input.id));

        return { id: input.id, action: "updated" as const };
      } else {
        // Create new draft
        const result = await db.insert(shipmentDrafts).values({
          wizardType: input.wizardType,
          currentStep: input.currentStep,
          label: input.label ?? "Untitled Draft",
          formData: input.formData,
          userId: ctx.user.id,
        });

        return { id: Number(result[0].insertId), action: "created" as const };
      }
    }),

  /** Delete a draft (must belong to current user) */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(shipmentDrafts)
        .where(
          and(
            eq(shipmentDrafts.id, input.id),
            eq(shipmentDrafts.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),
});
