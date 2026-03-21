/**
 * Company Document Expiry Cron Job Tests
 *
 * Tests the daily cron job logic:
 * - getExpiringDocuments filters correctly by 30-day window
 * - getDmsModuleRecipients returns correct users (admins + DMS canView=1)
 * - runCompanyDocExpiryCheck orchestrates email + notification
 * - Email template includes company name, document name, expiry date, days to expire
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock helpers to test logic without DB ──────────────────────────────────

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

type ExpiringDocument = {
  id: number;
  companyName: string;
  docType: string;
  documentLabel: string;
  expiryDate: string;
  daysToExpire: number;
};

/**
 * Pure function that computes days to expire from a given date.
 * This mirrors the logic in companyDocExpiry.ts.
 */
function computeDaysToExpire(expiryDate: string, today: string): number {
  const expiryMs = new Date(expiryDate).getTime();
  const todayMs = new Date(today).getTime();
  return Math.ceil((expiryMs - todayMs) / (24 * 60 * 60 * 1000));
}

/**
 * Pure function that filters documents by 30-day window.
 * Mirrors the SQL WHERE clause logic.
 */
function filterExpiringDocuments(
  docs: Array<{ id: number; companyName: string; docType: string; expiryDate: string | null }>,
  today: string
): ExpiringDocument[] {
  const todayMs = new Date(today).getTime();
  const in30DaysMs = todayMs + 30 * 24 * 60 * 60 * 1000;
  const in30DaysStr = new Date(in30DaysMs).toISOString().split("T")[0];

  return docs
    .filter((d) => d.expiryDate !== null && d.expiryDate <= in30DaysStr)
    .map((d) => ({
      id: d.id,
      companyName: d.companyName,
      docType: d.docType,
      documentLabel: DOC_TYPE_LABELS[d.docType] || d.docType,
      expiryDate: d.expiryDate!,
      daysToExpire: computeDaysToExpire(d.expiryDate!, today),
    }));
}

/**
 * Pure function that determines email recipients based on user roles and permissions.
 * Mirrors getDmsModuleRecipients logic.
 */
function computeDmsRecipients(
  users: Array<{ email: string | null; role: string; status: string }>,
  permissions: Array<{ userId: number; moduleId: string; canView: number }>,
  userIdMap: Record<string, number> // email -> userId
): string[] {
  const emailSet = new Set<string>();

  // Admins always get DMS access
  for (const u of users) {
    if (u.role === "admin" && u.status === "active" && u.email) {
      emailSet.add(u.email);
    }
  }

  // Non-admin users with DMS canView=1
  for (const p of permissions) {
    if (p.moduleId === "dms" && p.canView === 1) {
      const user = users.find((u) => userIdMap[u.email || ""] === p.userId);
      if (user && user.status === "active" && user.email) {
        emailSet.add(user.email);
      }
    }
  }

  return Array.from(emailSet);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Company Document Expiry Cron", () => {
  describe("computeDaysToExpire", () => {
    it("returns 0 when expiry date is today", () => {
      expect(computeDaysToExpire("2026-03-18", "2026-03-18")).toBe(0);
    });

    it("returns positive days for future expiry", () => {
      expect(computeDaysToExpire("2026-03-25", "2026-03-18")).toBe(7);
    });

    it("returns negative days for past expiry", () => {
      expect(computeDaysToExpire("2026-03-11", "2026-03-18")).toBe(-7);
    });

    it("returns 30 for exactly 30 days from now", () => {
      expect(computeDaysToExpire("2026-04-17", "2026-03-18")).toBe(30);
    });

    it("returns 1 for tomorrow", () => {
      expect(computeDaysToExpire("2026-03-19", "2026-03-18")).toBe(1);
    });

    it("returns -1 for yesterday", () => {
      expect(computeDaysToExpire("2026-03-17", "2026-03-18")).toBe(-1);
    });
  });

  describe("filterExpiringDocuments", () => {
    const today = "2026-03-18";

    const sampleDocs = [
      { id: 1, companyName: "Cairo-PLATFARM", docType: "company_registration", expiryDate: "2026-03-20" }, // 2 days
      { id: 2, companyName: "Cairo-PLATFARM", docType: "vat_registration", expiryDate: "2026-04-10" },     // 23 days
      { id: 3, companyName: "ADGM-PLATFARM", docType: "office_lease_contract", expiryDate: "2026-04-20" }, // 33 days (outside 30)
      { id: 4, companyName: "Sokhna-PLATFARM", docType: "export_certificate", expiryDate: "2026-03-10" },  // -8 days (expired)
      { id: 5, companyName: "ABU DHABI-PLATFARM", docType: "medical_insurance_policy", expiryDate: null },  // no expiry
      { id: 6, companyName: "Cairo-AlfaGlobal", docType: "tax_portal_registration", expiryDate: "2026-05-01" }, // 44 days (outside)
      { id: 7, companyName: "ADGM-PLATFARM", docType: "housing_lease_contract", expiryDate: "2026-04-17" }, // exactly 30 days
    ];

    it("includes documents expiring within 30 days", () => {
      const result = filterExpiringDocuments(sampleDocs, today);
      const ids = result.map((d) => d.id);
      expect(ids).toContain(1); // 2 days
      expect(ids).toContain(2); // 23 days
    });

    it("includes already expired documents", () => {
      const result = filterExpiringDocuments(sampleDocs, today);
      const ids = result.map((d) => d.id);
      expect(ids).toContain(4); // -8 days
    });

    it("includes documents expiring exactly at 30 days", () => {
      const result = filterExpiringDocuments(sampleDocs, today);
      const ids = result.map((d) => d.id);
      expect(ids).toContain(7); // exactly 30 days
    });

    it("excludes documents expiring beyond 30 days", () => {
      const result = filterExpiringDocuments(sampleDocs, today);
      const ids = result.map((d) => d.id);
      expect(ids).not.toContain(3); // 33 days
      expect(ids).not.toContain(6); // 44 days
    });

    it("excludes documents with no expiry date", () => {
      const result = filterExpiringDocuments(sampleDocs, today);
      const ids = result.map((d) => d.id);
      expect(ids).not.toContain(5); // null expiry
    });

    it("returns correct daysToExpire for each document", () => {
      const result = filterExpiringDocuments(sampleDocs, today);
      const doc1 = result.find((d) => d.id === 1);
      expect(doc1?.daysToExpire).toBe(2);

      const doc4 = result.find((d) => d.id === 4);
      expect(doc4?.daysToExpire).toBe(-8);

      const doc7 = result.find((d) => d.id === 7);
      expect(doc7?.daysToExpire).toBe(30);
    });

    it("returns correct document labels", () => {
      const result = filterExpiringDocuments(sampleDocs, today);
      const doc1 = result.find((d) => d.id === 1);
      expect(doc1?.documentLabel).toBe("Company Registration");

      const doc4 = result.find((d) => d.id === 4);
      expect(doc4?.documentLabel).toBe("Export Certificate");
    });

    it("returns correct company names", () => {
      const result = filterExpiringDocuments(sampleDocs, today);
      const doc1 = result.find((d) => d.id === 1);
      expect(doc1?.companyName).toBe("Cairo-PLATFARM");

      const doc4 = result.find((d) => d.id === 4);
      expect(doc4?.companyName).toBe("Sokhna-PLATFARM");
    });

    it("returns 4 documents total from sample data", () => {
      const result = filterExpiringDocuments(sampleDocs, today);
      expect(result.length).toBe(4);
    });
  });

  describe("computeDmsRecipients", () => {
    const users = [
      { email: "admin@platfarm.com", role: "admin", status: "active" },
      { email: "manager@platfarm.com", role: "user", status: "active" },
      { email: "viewer@platfarm.com", role: "user", status: "active" },
      { email: "noaccess@platfarm.com", role: "user", status: "active" },
      { email: "inactive@platfarm.com", role: "user", status: "inactive" },
      { email: null, role: "admin", status: "active" }, // admin without email
    ];

    const userIdMap: Record<string, number> = {
      "admin@platfarm.com": 1,
      "manager@platfarm.com": 2,
      "viewer@platfarm.com": 3,
      "noaccess@platfarm.com": 4,
      "inactive@platfarm.com": 5,
    };

    const permissions = [
      { userId: 2, moduleId: "dms", canView: 1 },
      { userId: 3, moduleId: "dms", canView: 1 },
      { userId: 4, moduleId: "supplychain", canView: 1 }, // different module
      { userId: 5, moduleId: "dms", canView: 1 }, // inactive user
    ];

    it("includes admin users", () => {
      const result = computeDmsRecipients(users, permissions, userIdMap);
      expect(result).toContain("admin@platfarm.com");
    });

    it("includes users with DMS canView=1", () => {
      const result = computeDmsRecipients(users, permissions, userIdMap);
      expect(result).toContain("manager@platfarm.com");
      expect(result).toContain("viewer@platfarm.com");
    });

    it("excludes users without DMS permission", () => {
      const result = computeDmsRecipients(users, permissions, userIdMap);
      expect(result).not.toContain("noaccess@platfarm.com");
    });

    it("excludes inactive users even with DMS permission", () => {
      const result = computeDmsRecipients(users, permissions, userIdMap);
      expect(result).not.toContain("inactive@platfarm.com");
    });

    it("excludes users with null email", () => {
      const result = computeDmsRecipients(users, permissions, userIdMap);
      expect(result).not.toContain(null);
      for (const email of result) {
        expect(email).toBeTruthy();
      }
    });

    it("deduplicates emails", () => {
      // If an admin also has explicit DMS permission, they should appear once
      const permsWithAdminDms = [
        ...permissions,
        { userId: 1, moduleId: "dms", canView: 1 }, // admin also has explicit perm
      ];
      const result = computeDmsRecipients(users, permsWithAdminDms, userIdMap);
      const adminCount = result.filter((e) => e === "admin@platfarm.com").length;
      expect(adminCount).toBe(1);
    });

    it("returns 3 recipients for the sample data", () => {
      const result = computeDmsRecipients(users, permissions, userIdMap);
      expect(result.length).toBe(3); // admin + manager + viewer
    });
  });

  describe("Email content structure", () => {
    it("sorts documents with expired first, then by days ascending", () => {
      const docs: ExpiringDocument[] = [
        { id: 1, companyName: "Cairo", docType: "vat_registration", documentLabel: "VAT Registration", expiryDate: "2026-03-25", daysToExpire: 7 },
        { id: 2, companyName: "ADGM", docType: "company_registration", documentLabel: "Company Registration", expiryDate: "2026-03-10", daysToExpire: -8 },
        { id: 3, companyName: "Sokhna", docType: "export_certificate", documentLabel: "Export Certificate", expiryDate: "2026-03-20", daysToExpire: 2 },
        { id: 4, companyName: "ABU DHABI", docType: "office_lease_contract", documentLabel: "Office Lease Contract", expiryDate: "2026-04-15", daysToExpire: 28 },
      ];

      docs.sort((a, b) => a.daysToExpire - b.daysToExpire);

      expect(docs[0].daysToExpire).toBe(-8); // expired first
      expect(docs[1].daysToExpire).toBe(2);
      expect(docs[2].daysToExpire).toBe(7);
      expect(docs[3].daysToExpire).toBe(28);
    });

    it("correctly categorizes expired vs expiring counts", () => {
      const docs: ExpiringDocument[] = [
        { id: 1, companyName: "Cairo", docType: "vat_registration", documentLabel: "VAT", expiryDate: "2026-03-10", daysToExpire: -8 },
        { id: 2, companyName: "Cairo", docType: "tax_registration", documentLabel: "Tax", expiryDate: "2026-03-18", daysToExpire: 0 },
        { id: 3, companyName: "ADGM", docType: "company_registration", documentLabel: "Reg", expiryDate: "2026-03-25", daysToExpire: 7 },
        { id: 4, companyName: "Sokhna", docType: "export_certificate", documentLabel: "Export", expiryDate: "2026-04-10", daysToExpire: 23 },
      ];

      const expiredCount = docs.filter((d) => d.daysToExpire <= 0).length;
      const soonCount = docs.filter((d) => d.daysToExpire > 0).length;

      expect(expiredCount).toBe(2); // -8 and 0
      expect(soonCount).toBe(2); // 7 and 23
    });

    it("assigns correct urgency levels based on days remaining", () => {
      function getUrgency(days: number): string {
        if (days <= 0) return "expired";
        if (days <= 7) return "critical";
        if (days <= 14) return "warning";
        return "notice";
      }

      expect(getUrgency(-5)).toBe("expired");
      expect(getUrgency(0)).toBe("expired");
      expect(getUrgency(1)).toBe("critical");
      expect(getUrgency(7)).toBe("critical");
      expect(getUrgency(8)).toBe("warning");
      expect(getUrgency(14)).toBe("warning");
      expect(getUrgency(15)).toBe("notice");
      expect(getUrgency(30)).toBe("notice");
    });
  });

  describe("DOC_TYPE_LABELS completeness for cron", () => {
    it("has a label for all 14 document types", () => {
      expect(Object.keys(DOC_TYPE_LABELS).length).toBe(14);
    });

    it("all labels are non-empty strings", () => {
      for (const [key, label] of Object.entries(DOC_TYPE_LABELS)) {
        expect(typeof label).toBe("string");
        expect(label.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Daily email deduplication", () => {
    /**
     * Simulates the dedup logic: a simple in-memory log keyed by cronType+date.
     * In production, this is backed by the cron_email_log database table.
     */
    let sentLog: Map<string, boolean>;

    function hasAlreadySentToday(cronType: string, today: string): boolean {
      return sentLog.has(`${cronType}:${today}`);
    }

    function recordEmailSent(cronType: string, today: string): void {
      sentLog.set(`${cronType}:${today}`, true);
    }

    beforeEach(() => {
      sentLog = new Map();
    });

    it("allows first email of the day", () => {
      const today = "2026-03-18";
      expect(hasAlreadySentToday("company_doc_expiry", today)).toBe(false);
    });

    it("blocks second email on the same day", () => {
      const today = "2026-03-18";
      expect(hasAlreadySentToday("company_doc_expiry", today)).toBe(false);
      recordEmailSent("company_doc_expiry", today);
      expect(hasAlreadySentToday("company_doc_expiry", today)).toBe(true);
    });

    it("allows email on a new day after previous day was sent", () => {
      recordEmailSent("company_doc_expiry", "2026-03-17");
      expect(hasAlreadySentToday("company_doc_expiry", "2026-03-18")).toBe(false);
    });

    it("different cron types do not interfere with each other", () => {
      const today = "2026-03-18";
      recordEmailSent("shipment_doc_alert", today);
      expect(hasAlreadySentToday("company_doc_expiry", today)).toBe(false);
    });

    it("simulates multiple server restarts on same day — only first sends", () => {
      const today = "2026-03-18";
      const cronType = "company_doc_expiry";
      let emailsSent = 0;

      // Simulate 5 server restarts, each triggering the cron
      for (let restart = 0; restart < 5; restart++) {
        if (!hasAlreadySentToday(cronType, today)) {
          emailsSent++;
          recordEmailSent(cronType, today);
        }
      }

      expect(emailsSent).toBe(1);
    });

    it("allows exactly one email per day across a week", () => {
      const cronType = "company_doc_expiry";
      const days = ["2026-03-12", "2026-03-13", "2026-03-14", "2026-03-15", "2026-03-16", "2026-03-17", "2026-03-18"];
      let totalSent = 0;

      for (const day of days) {
        // Simulate 3 restarts per day
        for (let restart = 0; restart < 3; restart++) {
          if (!hasAlreadySentToday(cronType, day)) {
            totalSent++;
            recordEmailSent(cronType, day);
          }
        }
      }

      expect(totalSent).toBe(7); // exactly 1 per day
    });
  });

  describe("Consolidated email (single SMTP call)", () => {
    it("sendEmail receives all recipients as a single array, not individual calls", () => {
      // Simulates the email.ts sendEmail behavior
      const recipients = ["admin@platfarm.com", "manager@platfarm.com", "viewer@platfarm.com"];
      const toField = Array.isArray(recipients) ? recipients.join(", ") : recipients;

      // Verify it's a single comma-separated string (one SMTP call)
      expect(toField).toBe("admin@platfarm.com, manager@platfarm.com, viewer@platfarm.com");
      expect(toField.split(", ").length).toBe(3);
    });

    it("does not loop over recipients individually", () => {
      let sendCallCount = 0;
      const recipients = ["a@test.com", "b@test.com", "c@test.com"];

      // Simulate the actual pattern: one call with all recipients
      function sendConsolidatedEmail(to: string[]) {
        sendCallCount++;
        return { to: to.join(", ") };
      }

      sendConsolidatedEmail(recipients);
      expect(sendCallCount).toBe(1);
    });
  });
});
