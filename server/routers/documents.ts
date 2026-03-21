import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { notifyOwner } from "../_core/notification";
import { sendDocumentAlertEmail, isSmtpConfigured } from "../email";
import { getDb } from "../db";
import { documentHardCopy, documentAlertLog, emailAlertRecipients } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

// ── Critical clearance documents required to clear shipment at destination ────
// These 5 documents are needed for customs clearance at the destination port

// Critical documents for Purchase Orders (purchase.order model)
export const CRITICAL_PO_DOCS = [
  { field: "bl", label: "Bill of Lading" },
  { field: "packing_list", label: "Packing List" },
  { field: "phytosanitary_certificate", label: "Phytosanitary Certificate" },
  { field: "fumigation_certificate", label: "Fumigation Certificate" },
  { field: "telex_release", label: "Telex Release" },
] as const;

// Critical documents for Sales Orders (sale.order model)
// Same 5 clearance documents apply to sales orders
export const CRITICAL_SO_DOCS = [
  { field: "bl", label: "Bill of Lading" },
  { field: "packing_list", label: "Packing List" },
  { field: "phytosanitary_certificate", label: "Phytosanitary Certificate" },
  { field: "fumigation_certificate", label: "Fumigation Certificate" },
  { field: "telex_release", label: "Telex Release" },
] as const;

// Combined list for backward compatibility
export const CRITICAL_DOCS = [
  { field: "bl", label: "Bill of Lading" },
  { field: "packing_list", label: "Packing List" },
  { field: "phytosanitary_certificate", label: "Phytosanitary Certificate" },
  { field: "fumigation_certificate", label: "Fumigation Certificate" },
  { field: "telex_release", label: "Telex Release" },
] as const;

export const CRITICAL_DOC_FIELDS = CRITICAL_DOCS.map(d => d.field);

// ── Helper: get hard copy statuses for a shipment ───────────────────────
async function getHardCopyStatuses(
  odooOrderId: number,
  orderType: "purchase" | "sales"
): Promise<Record<string, { received: boolean; receivedBy: string | null; receivedAt: Date | null }>> {
  const db = await getDb();
  if (!db) return {};

  const rows = await db
    .select()
    .from(documentHardCopy)
    .where(
      and(
        eq(documentHardCopy.odooOrderId, odooOrderId),
        eq(documentHardCopy.orderType, orderType)
      )
    );

  const result: Record<string, { received: boolean; receivedBy: string | null; receivedAt: Date | null }> = {};
  for (const row of rows) {
    result[row.documentField] = {
      received: row.received === 1,
      receivedBy: row.receivedBy,
      receivedAt: row.receivedAt,
    };
  }
  return result;
}

// ── Helper: get active email recipients ───────────────────────────────
async function getActiveEmailRecipients(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(emailAlertRecipients)
    .where(eq(emailAlertRecipients.active, 1));

  return rows.map(r => r.email).filter(Boolean);
}

// ── Router ───────────────────────────────────────────────────────────────
export const documentsRouter = router({
  // Get hard copy statuses for a shipment
  getHardCopyStatuses: publicProcedure
    .input(z.object({
      odooOrderId: z.number(),
      orderType: z.enum(["purchase", "sales"]),
    }))
    .query(async ({ input }) => {
      return getHardCopyStatuses(input.odooOrderId, input.orderType);
    }),

  // Toggle hard copy received status for a document
  toggleHardCopy: protectedProcedure
    .input(z.object({
      odooOrderId: z.number(),
      orderType: z.enum(["purchase", "sales"]),
      documentField: z.string(),
      received: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db
        .select()
        .from(documentHardCopy)
        .where(
          and(
            eq(documentHardCopy.odooOrderId, input.odooOrderId),
            eq(documentHardCopy.orderType, input.orderType),
            eq(documentHardCopy.documentField, input.documentField)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(documentHardCopy).values({
          odooOrderId: input.odooOrderId,
          orderType: input.orderType,
          documentField: input.documentField,
          received: input.received ? 1 : 0,
          receivedBy: input.received ? (ctx.user.name || ctx.user.openId) : null,
          receivedAt: input.received ? new Date() : null,
        });
      } else {
        await db
          .update(documentHardCopy)
          .set({
            received: input.received ? 1 : 0,
            receivedBy: input.received ? (ctx.user.name || ctx.user.openId) : null,
            receivedAt: input.received ? new Date() : null,
          })
          .where(eq(documentHardCopy.id, existing[0].id));
      }

      return { success: true };
    }),

  // Manually trigger the missing documents check (for testing or on-demand)
  checkMissingDocuments: protectedProcedure
    .mutation(async () => {
      const result = await runMissingDocumentsCheck();
      return result;
    }),

  // ── Email Alert Recipients CRUD ─────────────────────────────────────
  getEmailRecipients: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];

      const rows = await db
        .select()
        .from(emailAlertRecipients)
        .orderBy(sql`${emailAlertRecipients.createdAt} DESC`);

      return rows.map(r => ({
        id: r.id,
        email: r.email,
        name: r.name,
        active: r.active === 1,
        addedBy: r.addedBy,
        createdAt: r.createdAt,
      }));
    }),

  addEmailRecipient: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.insert(emailAlertRecipients).values({
        email: input.email,
        name: input.name || null,
        active: 1,
        addedBy: ctx.user.name || ctx.user.openId,
      });

      return { success: true };
    }),

  removeEmailRecipient: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(emailAlertRecipients).where(eq(emailAlertRecipients.id, input.id));
      return { success: true };
    }),

  toggleEmailRecipient: protectedProcedure
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(emailAlertRecipients)
        .set({ active: input.active ? 1 : 0 })
        .where(eq(emailAlertRecipients.id, input.id));

      return { success: true };
    }),

  // Check if SMTP is configured
  getEmailStatus: publicProcedure
    .query(() => {
      return {
        configured: isSmtpConfigured(),
        host: process.env.SMTP_HOST || null,
      };
    }),

  // Toggle the "Telex Release / BL Issued" boolean in Odoo (purchase.order)
  toggleTelexBLIssued: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      orderType: z.enum(["purchase", "sales"]),
      issued: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      if (input.orderType === "purchase") {
        const { updatePurchaseOrder } = await import("../odoo-shipments");
        await updatePurchaseOrder({ id: input.orderId, telex_release_bl_issued: input.issued });
      } else {
        // For sales orders, set bl_telex_release_date to today or false
        const { updateSaleOrder } = await import("../odoo-sales-shipments");
        await updateSaleOrder({
          id: input.orderId,
          bl_telex_release_date: input.issued ? new Date().toISOString().slice(0, 10) : false,
        });
      }
      return { success: true };
    }),

  // Get hard copy + soft copy summary statistics across all active PO shipments
  getHardCopySummary: publicProcedure
    .input(z.object({ companyId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { purchase: { enRoute: 0, missing: 0, softMissing: 0, totalMissing: 0, shipments: [] } };

      // Dynamic imports
      const { fetchPurchaseOrders, batchCheckPOCriticalSoftCopy } = await import("../odoo-shipments");

      // All hard copy records from DB
      const allHardCopies = await db.select().from(documentHardCopy);
      const hcMap = new Map<string, boolean>();
      for (const hc of allHardCopies) {
        hcMap.set(`${hc.orderType}-${hc.odooOrderId}-${hc.documentField}`, hc.received === 1);
      }

      // PO document fields — 5 critical clearance documents only
      const PO_DOC_FIELDS = [
        "bl", "packing_list", "phytosanitary_certificate",
        "fumigation_certificate", "telex_release",
      ];

      const PO_DOC_LABELS: Record<string, string> = {
        bl: "Bill of Lading",
        packing_list: "Packing List",
        phytosanitary_certificate: "Phytosanitary Certificate",
        fumigation_certificate: "Fumigation Certificate",
        telex_release: "Telex Release",
      };

      // En-Route stages: Loaded, In Transit, Arrived at Port (pre-Customs Clearance)
      const EN_ROUTE_STAGES = ["Loaded", "In Transit", "Arrived at Port"];

      const resolveStage = (state: string, shipmentStatus: string | false | null | undefined): string => {
        if (shipmentStatus && shipmentStatus !== "false" && shipmentStatus !== "None") return shipmentStatus;
        switch (state) {
          case "draft": case "sent": case "to_approve": return "Planned";
          case "purchase": case "sale": return "Booked";
          case "done": return "Delivered";
          case "cancel": return "cancel";
          default: return "Planned";
        }
      };

      type ShipmentDoc = { field: string; label: string; hardCopy: boolean; softCopy: boolean };
      type ShipmentEntry = {
        id: number; name: string; docsTotal: number;
        hardReceived: number; hardMissing: number; hardComplete: boolean;
        softReceived: number; softMissing: number; softComplete: boolean;
        totalMissing: number; totalComplete: boolean;
        status: string; docs: ShipmentDoc[]; telexBLIssued: boolean;
      };

      const purchaseShipments: ShipmentEntry[] = [];
      let poEnRoute = 0, poHardMissing = 0, poSoftMissing = 0, poTotalMissing = 0;

      try {
        const pos = await fetchPurchaseOrders(input?.companyId ? { companyId: input.companyId } : undefined);
        // Filter to en-route POs first
        const enRoutePOs = pos.filter(po => EN_ROUTE_STAGES.includes(resolveStage(po.state, po.x_studio_unified_shipment_status)));
        poEnRoute = enRoutePOs.length;

        // Batch-fetch soft copy status for all en-route POs in one Odoo call
        const softCopyMap = await batchCheckPOCriticalSoftCopy(enRoutePOs.map(po => po.id));

        for (const po of enRoutePOs) {
          const stage = resolveStage(po.state, po.x_studio_unified_shipment_status);
          const softStatus = softCopyMap.get(po.id) || {};
          const docsTotal = PO_DOC_FIELDS.length;
          let hardReceived = 0, softReceived = 0;
          const docs: ShipmentDoc[] = [];

          for (const field of PO_DOC_FIELDS) {
            const hardCopy = !!hcMap.get(`purchase-${po.id}-${field}`);
            const softCopy = !!softStatus[field];
            if (hardCopy) hardReceived++;
            if (softCopy) softReceived++;
            docs.push({ field, label: PO_DOC_LABELS[field] || field, hardCopy, softCopy });
          }

          const hardMissing = docsTotal - hardReceived;
          const softMissing = docsTotal - softReceived;
          const hardComplete = hardMissing === 0;
          const softComplete = softMissing === 0;
          // Total missing = any doc where EITHER hard or soft is missing
          const totalMissingCount = docs.filter(d => !d.hardCopy || !d.softCopy).length;
          const totalComplete = totalMissingCount === 0;

          if (!hardComplete) poHardMissing++;
          if (!softComplete) poSoftMissing++;
          if (!totalComplete) poTotalMissing++;

          purchaseShipments.push({
            id: po.id,
            name: po.name || `PO #${po.id}`,
            docsTotal,
            hardReceived, hardMissing, hardComplete,
            softReceived, softMissing, softComplete,
            totalMissing: totalMissingCount, totalComplete,
            status: stage,
            docs,
            telexBLIssued: !!po.telex_release_bl_issued,
          });
        }
      } catch (err) {
        console.warn("[HardCopySummary] Error fetching POs:", err);
      }

      return {
        purchase: {
          enRoute: poEnRoute,
          missing: poHardMissing,
          softMissing: poSoftMissing,
          totalMissing: poTotalMissing,
          shipments: purchaseShipments,
        },
      };
    }),

  // Get the latest alert log entries
  getAlertHistory: publicProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const limit = input?.limit ?? 30;
      const rows = await db
        .select()
        .from(documentAlertLog)
        .orderBy(sql`${documentAlertLog.createdAt} DESC`)
        .limit(limit);

      return rows.map(r => ({
        id: r.id,
        alertDate: r.alertDate,
        shipmentNames: r.shipmentNames as string[],
        shipmentCount: r.shipmentCount,
        notified: r.notified === 1,
        createdAt: r.createdAt,
      }));
    }),
});

// ── Daily check: find in-transit shipments with missing critical docs ───
export async function runMissingDocumentsCheck(): Promise<{
  flaggedCount: number;
  shipments: Array<{ name: string; type: string; missingDocs: string[] }>;
  notified: boolean;
  emailSent: boolean;
}> {
  // Dynamic imports to avoid circular dependencies
  const { fetchPurchaseOrders, checkPOFileStatus } = await import("../odoo-shipments");
  const { fetchSaleOrders, checkSOFileStatus } = await import("../odoo-sales-shipments");

  const flaggedShipments: Array<{ name: string; type: string; missingDocs: string[] }> = [];

  // Check Purchase Orders that are "In Transit"
  try {
    const purchaseOrders = await fetchPurchaseOrders();
    const inTransitPOs = purchaseOrders.filter(
      (po: any) => po.x_studio_unified_shipment_status === "In Transit"
    );

    for (const po of inTransitPOs) {
      try {
        const fileStatus = await checkPOFileStatus(po.id);
        const missing: string[] = [];

        for (const doc of CRITICAL_PO_DOCS) {
          if (!fileStatus[doc.field]) {
            missing.push(doc.label);
          }
        }

        if (missing.length > 0) {
          flaggedShipments.push({
            name: po.name || `PO #${po.id}`,
            type: "Purchase",
            missingDocs: missing,
          });
        }
      } catch (err) {
        console.warn(`[DocAlert] Error checking PO ${po.id}:`, err);
      }
    }
  } catch (err) {
    console.warn("[DocAlert] Error fetching purchase orders:", err);
  }

  // Check Sales Orders that are "In Transit"
  try {
    const salesOrders = await fetchSaleOrders();
    const inTransitSOs = salesOrders.filter(
      (so: any) => so.x_studio_unified_shipment_status === "In Transit"
    );

    for (const so of inTransitSOs) {
      try {
        const fileStatus = await checkSOFileStatus(so.id);
        const missing: string[] = [];

        for (const doc of CRITICAL_SO_DOCS) {
          if (!fileStatus[doc.field]) {
            missing.push(doc.label);
          }
        }

        if (missing.length > 0) {
          flaggedShipments.push({
            name: so.name || `SO #${so.id}`,
            type: "Sales",
            missingDocs: missing,
          });
        }
      } catch (err) {
        console.warn(`[DocAlert] Error checking SO ${so.id}:`, err);
      }
    }
  } catch (err) {
    console.warn("[DocAlert] Error fetching sales orders:", err);
  }

  // Send notification if there are flagged shipments
  let notified = false;
  let emailSent = false;
  if (flaggedShipments.length > 0) {
    const today = new Date().toISOString().slice(0, 10);

    // Build notification content
    const lines = flaggedShipments.map(
      s => `• **${s.name}** (${s.type}): Missing ${s.missingDocs.join(", ")}`
    );
    const title = `⚠️ ${flaggedShipments.length} In-Transit Shipment(s) Missing Critical Documents`;
    const content = `The following shipments are **In Transit** but are missing critical shipping documents:\n\n${lines.join("\n")}\n\nPlease upload the missing documents as soon as possible.`;

    // 1. In-app notification
    try {
      notified = await notifyOwner({ title, content });
    } catch (err) {
      console.warn("[DocAlert] In-app notification error:", err);
    }

    // 2. Email notification
    try {
      const recipients = await getActiveEmailRecipients();
      if (recipients.length > 0) {
        emailSent = await sendDocumentAlertEmail(recipients, flaggedShipments, today);
        console.log(`[DocAlert] Email sent to ${recipients.length} recipient(s): ${emailSent}`);
      } else {
        console.log("[DocAlert] No active email recipients configured — skipping email.");
      }
    } catch (err) {
      console.warn("[DocAlert] Email notification error:", err);
    }

    // Log the alert
    try {
      const db = await getDb();
      if (db) {
        await db.insert(documentAlertLog).values({
          alertDate: today,
          shipmentNames: flaggedShipments.map(s => s.name),
          shipmentCount: flaggedShipments.length,
          notified: notified ? 1 : 0,
        });
      }
    } catch (err) {
      console.warn("[DocAlert] Error logging alert:", err);
    }
  }

  return {
    flaggedCount: flaggedShipments.length,
    shipments: flaggedShipments,
    notified,
    emailSent,
  };
}
