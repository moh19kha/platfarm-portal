import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { notifyOwner } from "../_core/notification";
import { getDb } from "../db";
import { shipmentStatusLog, notificationPreferences } from "../../drizzle/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";

// ── Default stages (all enabled) ────────────────────────────────────────
const ALL_STAGES = [
  "Planned", "Booked", "Loading", "Loaded", "In Transit",
  "Arrived at Port", "Customs Clearance", "Delivering", "Delivered", "Returned",
];

// ── Helpers ──────────────────────────────────────────────────────────────

// In-memory set to track which shipments have been seeded this server session.
const seededShipments = new Set<string>();

function shipmentKey(orderId: number, orderType: string): string {
  return `${orderType}:${orderId}`;
}

interface PrefsResult {
  enabledStages: string[];
  notifyOwnerEnabled: boolean;
  notifyInApp: boolean;
}

/**
 * Load notification preferences for a specific user.
 * Falls back to global defaults if no user-specific row exists.
 * @param userId - The user's openId (null = load global/system default)
 */
async function loadPreferences(userId?: string | null): Promise<PrefsResult> {
  const defaults: PrefsResult = { enabledStages: ALL_STAGES, notifyOwnerEnabled: true, notifyInApp: true };
  try {
    const db = await getDb();
    if (!db) return defaults;

    // 1. Try user-specific preferences first
    if (userId) {
      const userRows = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);

      if (userRows.length > 0) {
        const pref = userRows[0];
        return {
          enabledStages: (pref.enabledStages as string[]) ?? ALL_STAGES,
          notifyOwnerEnabled: pref.notifyOwner === 1,
          notifyInApp: pref.notifyInApp === 1,
        };
      }
    }

    // 2. Fall back to global row (userId IS NULL)
    const globalRows = await db
      .select()
      .from(notificationPreferences)
      .where(isNull(notificationPreferences.userId))
      .limit(1);

    if (globalRows.length > 0) {
      const pref = globalRows[0];
      return {
        enabledStages: (pref.enabledStages as string[]) ?? ALL_STAGES,
        notifyOwnerEnabled: pref.notifyOwner === 1,
        notifyInApp: pref.notifyInApp === 1,
      };
    }

    // 3. No preferences at all — use hardcoded defaults
    return defaults;
  } catch {
    return defaults;
  }
}

/**
 * Check a batch of shipments for status changes, log them, and send notifications.
 * Respects notification preferences for which stages trigger alerts.
 * @param userId - The openId of the user who triggered the action (for per-user prefs)
 */
export async function checkAndNotifyStatusChanges(
  shipments: Array<{
    id: number;
    name: string;
    shipmentStatus: string | null;
  }>,
  orderType: "purchase" | "sales",
  /** When true, always create a notification even if this is the first time we see this shipment.
   *  Use this when called from an explicit user-triggered update mutation. */
  forceNotify: boolean = false,
  /** The openId of the user who triggered the update (for per-user preferences lookup) */
  userId?: string | null
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const prefs = await loadPreferences(userId);

  for (const shipment of shipments) {
    const status = shipment.shipmentStatus;
    if (!status) continue;

    const key = shipmentKey(shipment.id, orderType);

    try {
      // Get the most recent log entry for this order
      const lastLog = await db
        .select()
        .from(shipmentStatusLog)
        .where(
          and(
            eq(shipmentStatusLog.odooOrderId, shipment.id),
            eq(shipmentStatusLog.orderType, orderType)
          )
        )
        .orderBy(desc(shipmentStatusLog.createdAt))
        .limit(1);

      const previousStatus = lastLog.length > 0 ? lastLog[0].newStatus : null;

      // Skip if status hasn't changed
      if (previousStatus === status) {
        seededShipments.add(key);
        continue;
      }

      // SEED-FIRST: If this is the first time we see this shipment (no DB record),
      // silently record the status without sending a notification.
      // UNLESS forceNotify is true (explicit user action like clicking a pipeline stage).
      const isFirstEncounter = !forceNotify && previousStatus === null && !seededShipments.has(key);

      // Check if this NEW status is in the enabled stages list
      const isStageEnabled = prefs.enabledStages.includes(status);

      // Determine if we should create an in-app notification
      const shouldLogAsNotification = !isFirstEncounter && prefs.notifyInApp && isStageEnabled;

      // For forceNotify (explicit user action), if there's no previous status,
      // use "Not Set" so the notification query (which filters previousStatus IS NOT NULL) picks it up.
      const effectivePreviousStatus = (forceNotify && previousStatus === null) ? "Not Set" : previousStatus;

      // Log the status change
      await db.insert(shipmentStatusLog).values({
        odooOrderId: shipment.id,
        orderType,
        orderName: shipment.name,
        previousStatus: effectivePreviousStatus,
        newStatus: status,
        notified: 0,
        // If stage is not enabled or it's first encounter, mark as already read
        readAt: shouldLogAsNotification ? undefined : new Date(),
      });

      seededShipments.add(key);

      // Only send notification for ACTUAL status transitions (not initial seed)
      if (isFirstEncounter) continue;

      // Skip if this stage is not in the enabled list
      if (!isStageEnabled) continue;

      // Send owner notification if enabled
      if (prefs.notifyOwnerEnabled) {
        const typeLabel = orderType === "purchase" ? "Purchase" : "Sales";
        const arrow = previousStatus ? `${previousStatus} → ${status}` : `Set to ${status}`;
        const title = `📦 ${typeLabel} Shipment Status Change`;
        const content = `**${shipment.name}** status changed: ${arrow}`;

        const sent = await notifyOwner({ title, content });

        if (sent) {
          const inserted = await db
            .select()
            .from(shipmentStatusLog)
            .where(
              and(
                eq(shipmentStatusLog.odooOrderId, shipment.id),
                eq(shipmentStatusLog.orderType, orderType),
                eq(shipmentStatusLog.newStatus, status)
              )
            )
            .orderBy(desc(shipmentStatusLog.createdAt))
            .limit(1);

          if (inserted.length > 0) {
            await db
              .update(shipmentStatusLog)
              .set({ notified: 1 })
              .where(eq(shipmentStatusLog.id, inserted[0].id));
          }
        }
      }
    } catch (err) {
      console.warn(`[Notifications] Error checking status for ${shipment.name}:`, err);
    }
  }
}

/**
 * Seed all current shipment statuses without sending notifications.
 */
export async function seedCurrentStatuses(
  shipments: Array<{
    id: number;
    name: string;
    shipmentStatus: string | null;
  }>,
  orderType: "purchase" | "sales"
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  for (const shipment of shipments) {
    const status = shipment.shipmentStatus;
    if (!status) continue;

    const key = shipmentKey(shipment.id, orderType);
    
    const existing = await db
      .select()
      .from(shipmentStatusLog)
      .where(
        and(
          eq(shipmentStatusLog.odooOrderId, shipment.id),
          eq(shipmentStatusLog.orderType, orderType)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(shipmentStatusLog).values({
        odooOrderId: shipment.id,
        orderType,
        orderName: shipment.name,
        previousStatus: null,
        newStatus: status,
        notified: 0,
        readAt: new Date(),
      });
    }

    seededShipments.add(key);
  }
}

// ── Router ───────────────────────────────────────────────────────────────

export const notificationsRouter = router({
  // Get recent notifications (only genuine transitions, not seeds)
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        unreadOnly: z.boolean().default(false),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { notifications: [], unreadCount: 0 };

      const limit = input?.limit ?? 50;
      const unreadOnly = input?.unreadOnly ?? false;

      const baseCondition = sql`${shipmentStatusLog.previousStatus} IS NOT NULL`;
      const conditions = unreadOnly
        ? and(baseCondition, isNull(shipmentStatusLog.readAt))
        : baseCondition;

      const notifications = await db
        .select()
        .from(shipmentStatusLog)
        .where(conditions)
        .orderBy(desc(shipmentStatusLog.createdAt))
        .limit(limit);

      const unreadResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(shipmentStatusLog)
        .where(
          and(
            sql`${shipmentStatusLog.previousStatus} IS NOT NULL`,
            isNull(shipmentStatusLog.readAt)
          )
        );

      const unreadCount = unreadResult[0]?.count ?? 0;

      return {
        notifications: notifications.map((n) => ({
          id: n.id,
          odooOrderId: n.odooOrderId,
          orderType: n.orderType,
          orderName: n.orderName,
          previousStatus: n.previousStatus,
          newStatus: n.newStatus,
          notified: n.notified === 1,
          read: n.readAt !== null,
          createdAt: n.createdAt.getTime(),
        })),
        unreadCount,
      };
    }),

  // Mark notification(s) as read
  markRead: publicProcedure
    .input(
      z.object({
        ids: z.array(z.number()).optional(),
        all: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      const now = new Date();

      if (input.all) {
        await db
          .update(shipmentStatusLog)
          .set({ readAt: now })
          .where(isNull(shipmentStatusLog.readAt));
      } else if (input.ids && input.ids.length > 0) {
        for (const id of input.ids) {
          await db
            .update(shipmentStatusLog)
            .set({ readAt: now })
            .where(eq(shipmentStatusLog.id, id));
        }
      }

      return { success: true };
    }),

  // Get unread count only (lightweight)
  unreadCount: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { count: 0 };

    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(shipmentStatusLog)
      .where(
        and(
          sql`${shipmentStatusLog.previousStatus} IS NOT NULL`,
          isNull(shipmentStatusLog.readAt)
        )
      );

    return { count: result[0]?.count ?? 0 };
  }),

  // Get recent status changes since a given timestamp (for toast polling)
  recentChanges: publicProcedure
    .input(
      z.object({
        since: z.number(), // Unix timestamp in ms
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { changes: [] };

      const sinceDate = new Date(input.since);

      const changes = await db
        .select()
        .from(shipmentStatusLog)
        .where(
          and(
            sql`${shipmentStatusLog.previousStatus} IS NOT NULL`,
            sql`${shipmentStatusLog.createdAt} > ${sinceDate}`
          )
        )
        .orderBy(desc(shipmentStatusLog.createdAt))
        .limit(20);

      return {
        changes: changes.map((c) => ({
          id: c.id,
          odooOrderId: c.odooOrderId,
          orderType: c.orderType,
          orderName: c.orderName,
          previousStatus: c.previousStatus,
          newStatus: c.newStatus,
          createdAt: c.createdAt.getTime(),
        })),
      };
    }),

  // ── Preferences ─────────────────────────────────────────────────────────

  // Get notification preferences for the current user (falls back to global defaults)
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.openId;
    const db = await getDb();
    if (!db) return {
      enabledStages: ALL_STAGES,
      notifyOwner: true,
      notifyInApp: true,
      isPersonal: false,
    };

    // 1. Try user-specific row
    const userRows = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (userRows.length > 0) {
      const pref = userRows[0];
      return {
        enabledStages: (pref.enabledStages as string[]) ?? ALL_STAGES,
        notifyOwner: pref.notifyOwner === 1,
        notifyInApp: pref.notifyInApp === 1,
        isPersonal: true,
      };
    }

    // 2. Fall back to global row
    const globalRows = await db
      .select()
      .from(notificationPreferences)
      .where(isNull(notificationPreferences.userId))
      .limit(1);

    if (globalRows.length > 0) {
      const pref = globalRows[0];
      return {
        enabledStages: (pref.enabledStages as string[]) ?? ALL_STAGES,
        notifyOwner: pref.notifyOwner === 1,
        notifyInApp: pref.notifyInApp === 1,
        isPersonal: false,
      };
    }

    // 3. Hardcoded defaults
    return {
      enabledStages: ALL_STAGES,
      notifyOwner: true,
      notifyInApp: true,
      isPersonal: false,
    };
  }),

  // Update notification preferences for the current user
  updatePreferences: protectedProcedure
    .input(
      z.object({
        enabledStages: z.array(z.string()),
        notifyOwner: z.boolean(),
        notifyInApp: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.openId;
      const db = await getDb();
      if (!db) return { success: false };

      // Check if user already has a personal preferences row
      const existing = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);

      if (existing.length === 0) {
        // Create a new personal preferences row for this user
        await db.insert(notificationPreferences).values({
          userId,
          enabledStages: input.enabledStages,
          notifyOwner: input.notifyOwner ? 1 : 0,
          notifyInApp: input.notifyInApp ? 1 : 0,
        });
      } else {
        // Update existing personal row
        await db
          .update(notificationPreferences)
          .set({
            enabledStages: input.enabledStages,
            notifyOwner: input.notifyOwner ? 1 : 0,
            notifyInApp: input.notifyInApp ? 1 : 0,
          })
          .where(eq(notificationPreferences.id, existing[0].id));
      }

      return { success: true };
    }),

  // Reset personal preferences (delete user row, fall back to global defaults)
  resetPreferences: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.user.openId;
      const db = await getDb();
      if (!db) return { success: false };

      await db
        .delete(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId));

      return { success: true };
    }),
});
