/**
 * Daily Document Alert Cron Job
 *
 * Runs once per day at 8:00 AM (server time) to check for in-transit shipments
 * that are missing critical documents. Sends a notification to the project owner
 * with a summary of flagged shipments.
 *
 * Can also be triggered manually via the `documents.checkMissingDocuments` tRPC mutation.
 */

import { runMissingDocumentsCheck } from "../routers/documents";

// 24 hours in milliseconds
const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Track the interval handle so we can clear it if needed
let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Runs the daily document alert check.
 * Logs results and handles errors gracefully.
 */
async function runDailyCheck() {
  const timestamp = new Date().toISOString();
  console.log(`[DocAlert Cron] Starting daily document check at ${timestamp}`);

  try {
    const result = await runMissingDocumentsCheck();

    if (result.flaggedCount === 0) {
      console.log("[DocAlert Cron] No in-transit shipments with missing documents.");
    } else {
      console.log(
        `[DocAlert Cron] Found ${result.flaggedCount} shipment(s) with missing documents. Notification sent: ${result.notified}`
      );
      for (const s of result.shipments) {
        console.log(`  - ${s.name}: Missing ${s.missingDocs.join(", ")}`);
      }
    }
  } catch (err) {
    console.error("[DocAlert Cron] Error during daily check:", err);
  }
}

/**
 * Starts the daily document alert scheduler.
 * Calculates the delay until the next 8:00 AM, then runs every 24 hours.
 */
export function startDocumentAlertCron() {
  // Calculate milliseconds until next 8:00 AM
  const now = new Date();
  const next8AM = new Date(now);
  next8AM.setHours(8, 0, 0, 0);

  // If 8 AM has already passed today, schedule for tomorrow
  if (now >= next8AM) {
    next8AM.setDate(next8AM.getDate() + 1);
  }

  const delayUntilFirst = next8AM.getTime() - now.getTime();
  const hoursUntilFirst = (delayUntilFirst / (1000 * 60 * 60)).toFixed(1);

  console.log(
    `[DocAlert Cron] Scheduled daily document check. Next run in ${hoursUntilFirst} hours (at ${next8AM.toISOString()})`
  );

  // Run after the initial delay, then every 24 hours
  setTimeout(() => {
    runDailyCheck();
    intervalHandle = setInterval(runDailyCheck, DAILY_INTERVAL_MS);
  }, delayUntilFirst);

  // Also run once on startup (after a short delay to let the server settle)
  setTimeout(() => {
    console.log("[DocAlert Cron] Running initial document check on startup...");
    runDailyCheck();
  }, 10_000); // 10 seconds after server start
}

/**
 * Stops the daily document alert scheduler.
 */
export function stopDocumentAlertCron() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[DocAlert Cron] Stopped daily document alert scheduler.");
  }
}
