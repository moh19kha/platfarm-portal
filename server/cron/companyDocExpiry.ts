/**
 * Daily Company Document Expiry Alert Cron Job
 *
 * Runs once per day at 8:05 AM (server time) to check for company documents
 * that are expiring within 30 days or have already expired.
 * Sends a SINGLE consolidated email to all users who have DMS module access
 * with a table of company name, document name, expiry date, and days remaining.
 *
 * DEDUPLICATION: Uses the cron_email_log database table to ensure that at most
 * one email is sent per calendar day, even if the server restarts multiple times.
 *
 * Also sends an in-app notification to the project owner via notifyOwner().
 */

import { getDb } from "../db";
import { companyDocuments, cronEmailLog, userModulePermissions, users } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { sendCompanyDocExpiryEmail } from "../email";

// 24 hours in milliseconds
const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Track the interval handle so we can clear it if needed
let intervalHandle: ReturnType<typeof setInterval> | null = null;

// DMS module ID (matches MODULES in SystemUserMgmt.tsx)
const DMS_MODULE_ID = "dms";

// Cron type identifier for the dedup log
const CRON_TYPE = "company_doc_expiry";

// ── Document type labels ──────────────────────────────────────────────────
const DOC_TYPE_LABELS: Record<string, string> = {
  company_registration: "Company Registration",
  vat_registration: "VAT Registration",
  tax_registration: "Tax Registration",
  constitution_contract: "Constitution Contract",
  owner_id: "Owner ID",
  owner_passport: "Owner Passport",
  office_lease_contract: "Office Lease Contract",
  medical_insurance_policy: "Medical Insurance Policy",
  export_certificate: "Export Certificate",
  tax_portal_registration: "Tax Portal Registration",
  social_insurance: "Social Insurance",
  company_establishment_card: "Company Establishment Card",
  housing_lease_contract: "Housing Lease Contract",
  civil_defense: "Civil Defense",
};

export type ExpiringDocument = {
  id: number;
  companyName: string;
  docType: string;
  documentLabel: string;
  expiryDate: string; // YYYY-MM-DD
  daysToExpire: number; // negative = already expired
};

/**
 * Check if an email has already been sent today for this cron type.
 * Returns true if already sent (should skip), false if not yet sent.
 */
export async function hasAlreadySentToday(): Promise<boolean> {
  const db = await getDb();
  if (!db) return false; // If DB is unavailable, allow sending (fail-open)

  const today = new Date().toISOString().split("T")[0];

  const existing = await db
    .select({ id: cronEmailLog.id })
    .from(cronEmailLog)
    .where(
      and(
        eq(cronEmailLog.cronType, CRON_TYPE),
        eq(cronEmailLog.sentDate, today),
        eq(cronEmailLog.success, 1)
      )
    )
    .limit(1);

  return existing.length > 0;
}

/**
 * Record that an email was sent today for this cron type.
 */
export async function recordEmailSent(recipientCount: number, itemCount: number, success: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const today = new Date().toISOString().split("T")[0];

  try {
    await db.insert(cronEmailLog).values({
      cronType: CRON_TYPE,
      sentDate: today,
      recipientCount,
      itemCount,
      success: success ? 1 : 0,
    });
  } catch (err: any) {
    // If duplicate key (already recorded), that's fine — just log it
    if (err?.code === "ER_DUP_ENTRY" || err?.message?.includes("Duplicate")) {
      console.log(`[CompanyDocExpiry] Email already recorded for today (${today}).`);
    } else {
      console.warn("[CompanyDocExpiry] Failed to record email log:", err);
    }
  }
}

/**
 * Query all company documents expiring within 30 days (or already expired).
 */
export async function getExpiringDocuments(): Promise<ExpiringDocument[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[CompanyDocExpiry] Database not available — skipping check.");
    return [];
  }

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const futureStr = in30Days.toISOString().split("T")[0];

  // Get all documents with an expiry date that is <= 30 days from now
  const rows = await db
    .select()
    .from(companyDocuments)
    .where(
      sql`${companyDocuments.expiryDate} IS NOT NULL AND ${companyDocuments.expiryDate} <= ${futureStr}`
    );

  const today = now.toISOString().split("T")[0];
  const todayMs = new Date(today).getTime();

  return rows.map((row) => {
    const expiryStr = row.expiryDate
      ? new Date(row.expiryDate).toISOString().split("T")[0]
      : "";
    const expiryMs = new Date(expiryStr).getTime();
    const daysToExpire = Math.ceil((expiryMs - todayMs) / (24 * 60 * 60 * 1000));

    return {
      id: row.id,
      companyName: row.companyName,
      docType: row.docType,
      documentLabel: DOC_TYPE_LABELS[row.docType] || row.docType,
      expiryDate: expiryStr,
      daysToExpire,
    };
  });
}

/**
 * Get email addresses of all users who have DMS module access (canView=1).
 * Admins always have full access, so they are included too.
 * Only returns emails for active users who have a non-null email.
 */
export async function getDmsModuleRecipients(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  // 1. Get all admin users (they always have DMS access)
  const adminUsers = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.status, "active")));

  // 2. Get non-admin users who have explicit DMS canView=1 permission
  const dmsPermUsers = await db
    .select({ email: users.email })
    .from(userModulePermissions)
    .innerJoin(users, eq(userModulePermissions.userId, users.id))
    .where(
      and(
        eq(userModulePermissions.moduleId, DMS_MODULE_ID),
        eq(userModulePermissions.canView, 1),
        eq(users.status, "active")
      )
    );

  // Combine and deduplicate (excluding system/service accounts)
  const EXCLUDED_EMAILS = ["admin@platfarm.io"];
  const emailSet = new Set<string>();
  for (const u of [...adminUsers, ...dmsPermUsers]) {
    if (u.email && !EXCLUDED_EMAILS.includes(u.email)) emailSet.add(u.email);
  }

  return Array.from(emailSet);
}

/**
 * Runs the daily company document expiry check.
 * Queries expiring documents, sends ONE email to ALL DMS users + in-app notification.
 *
 * DEDUPLICATION: Checks the cron_email_log table first. If an email has already
 * been successfully sent today, the check is skipped entirely. This prevents
 * duplicate emails on server restarts.
 */
export async function runCompanyDocExpiryCheck(): Promise<{
  expiringCount: number;
  emailSent: boolean;
  notified: boolean;
  recipientCount: number;
  skippedDuplicate: boolean;
}> {
  console.log(
    `[CompanyDocExpiry] Starting daily check at ${new Date().toISOString()}`
  );

  // ── DEDUP CHECK: Has an email already been sent today? ──
  const alreadySent = await hasAlreadySentToday();
  if (alreadySent) {
    console.log(
      `[CompanyDocExpiry] Email already sent today (${new Date().toISOString().split("T")[0]}). Skipping to prevent duplicate.`
    );
    return { expiringCount: 0, emailSent: false, notified: false, recipientCount: 0, skippedDuplicate: true };
  }

  const expiringDocs = await getExpiringDocuments();

  if (expiringDocs.length === 0) {
    console.log("[CompanyDocExpiry] No documents expiring within 30 days.");
    return { expiringCount: 0, emailSent: false, notified: false, recipientCount: 0, skippedDuplicate: false };
  }

  // Sort: expired first (negative days), then by days ascending
  expiringDocs.sort((a, b) => a.daysToExpire - b.daysToExpire);

  const expiredCount = expiringDocs.filter((d) => d.daysToExpire <= 0).length;
  const soonCount = expiringDocs.filter((d) => d.daysToExpire > 0).length;

  console.log(
    `[CompanyDocExpiry] Found ${expiringDocs.length} document(s): ${expiredCount} expired, ${soonCount} expiring soon.`
  );

  // 1. Send ONE consolidated email notification to ALL DMS module users
  let emailSent = false;
  let recipientCount = 0;
  try {
    const recipients = await getDmsModuleRecipients();
    recipientCount = recipients.length;
    if (recipients.length > 0) {
      const today = new Date().toISOString().split("T")[0];
      emailSent = await sendCompanyDocExpiryEmail(recipients, expiringDocs, today);
      console.log(
        `[CompanyDocExpiry] Single consolidated email sent to ${recipients.length} DMS user(s): ${emailSent} — Recipients: ${recipients.join(", ")}`
      );

      // Record the send in the dedup log
      await recordEmailSent(recipientCount, expiringDocs.length, emailSent);
    } else {
      console.log(
        "[CompanyDocExpiry] No users with DMS module access found — skipping email."
      );
    }
  } catch (err) {
    console.warn("[CompanyDocExpiry] Email notification error:", err);
  }

  // 2. Send in-app notification to project owner
  let notified = false;
  try {
    const lines = expiringDocs.map((d) => {
      const status =
        d.daysToExpire <= 0
          ? `EXPIRED (${Math.abs(d.daysToExpire)} days ago)`
          : `${d.daysToExpire} day(s) remaining`;
      return `• ${d.companyName} — ${d.documentLabel}: ${d.expiryDate} (${status})`;
    });

    const title = `📋 ${expiringDocs.length} Company Document(s) Expiring Soon`;
    const content = [
      `Daily Company Document Expiry Report — ${new Date().toISOString().split("T")[0]}`,
      "",
      `${expiredCount} expired, ${soonCount} expiring within 30 days:`,
      "",
      ...lines,
      "",
      "Please renew the expired/expiring documents as soon as possible.",
    ].join("\n");

    notified = await notifyOwner({ title, content });
    console.log(`[CompanyDocExpiry] In-app notification sent: ${notified}`);
  } catch (err) {
    console.warn("[CompanyDocExpiry] In-app notification error:", err);
  }

  return { expiringCount: expiringDocs.length, emailSent, notified, recipientCount, skippedDuplicate: false };
}

/**
 * Starts the daily company document expiry alert scheduler.
 * Calculates the delay until the next 8:05 AM (offset from the shipment alert at 8:00),
 * then runs every 24 hours.
 */
export function startCompanyDocExpiryCron() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(8, 5, 0, 0); // 8:05 AM to avoid overlap with shipment alert

  if (now >= next) {
    next.setDate(next.getDate() + 1);
  }

  const delayMs = next.getTime() - now.getTime();
  const hoursUntil = (delayMs / (1000 * 60 * 60)).toFixed(1);

  console.log(
    `[CompanyDocExpiry] Scheduled daily check. Next run in ${hoursUntil} hours (at ${next.toISOString()})`
  );

  setTimeout(() => {
    runCompanyDocExpiryCheck();
    intervalHandle = setInterval(runCompanyDocExpiryCheck, DAILY_INTERVAL_MS);
  }, delayMs);

  // Also run once on startup (after a short delay) — dedup guard prevents duplicate emails
  setTimeout(() => {
    console.log("[CompanyDocExpiry] Running initial check on startup (dedup-protected)...");
    runCompanyDocExpiryCheck();
  }, 15_000); // 15 seconds after server start
}

/**
 * Stops the daily company document expiry alert scheduler.
 */
export function stopCompanyDocExpiryCron() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[CompanyDocExpiry] Stopped daily scheduler.");
  }
}
