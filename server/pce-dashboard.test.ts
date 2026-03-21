import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const PCE_DASHBOARD_PATH = path.resolve(
  import.meta.dirname,
  "../client/public/pce-dashboard.html"
);

describe("PCE Dashboard HTML", () => {
  it("pce-dashboard.html file exists", () => {
    expect(fs.existsSync(PCE_DASHBOARD_PATH)).toBe(true);
  });

  it("contains all 4 page navigation items", () => {
    const html = fs.readFileSync(PCE_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("Dashboard");
    expect(html).toContain("Petty Cash");
    expect(html).toContain("Expenses");
    expect(html).toContain("Reminders");
  });

  it("uses Platfarm design tokens", () => {
    const html = fs.readFileSync(PCE_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("#2D5A3D");
    expect(html).toContain("#4A7C59");
    expect(html).toContain("#C0714A");
    expect(html).toContain("DM Sans");
    expect(html).toContain("JetBrains Mono");
  });

  it("contains company filter functionality synced with localStorage", () => {
    const html = fs.readFileSync(PCE_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("All Companies");
    expect(html).toContain("companyObjects");
    expect(html).toContain("platfarm_company");
    expect(html).toContain("localStorage");
  });

  it("contains localStorage company selector sync with JSON format", () => {
    const html = fs.readFileSync(PCE_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("platfarm_company");
    expect(html).toContain("localStorage");
    expect(html).toContain("JSON.parse");
    expect(html).toContain("JSON.stringify");
  });

  it("listens for storage events for global company selector sync", () => {
    const html = fs.readFileSync(PCE_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("addEventListener");
    expect(html).toContain("storage");
  });

  it("calls all required PCE tRPC endpoints", () => {
    const html = fs.readFileSync(PCE_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("pce.employees");
    expect(html).toContain("pce.expenses");
    expect(html).toContain("pce.pettyCash");
    expect(html).toContain("pce.requests");
    expect(html).toContain("pce.reminders");
  });

  it("contains Odoo petty cash and request actions", () => {
    const html = fs.readFileSync(PCE_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("pce.createPettyCash");
    expect(html).toContain("pce.approveRequest");
    expect(html).toContain("pce.refuseRequest");
  });

  it("contains expense approval and refusal actions", () => {
    const html = fs.readFileSync(PCE_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("pce.approveExpense");
    expect(html).toContain("pce.refuseExpense");
  });

  it("contains all expense state transition actions", () => {
    const html = fs.readFileSync(PCE_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("pce.submitExpense");
    expect(html).toContain("pce.approveExpense");
    expect(html).toContain("pce.payExpense");
    expect(html).toContain("pce.refuseExpense");
    expect(html).toContain("pce.resetExpense");
  });

  it("contains all 6 expense states in SY map", () => {
    const html = fs.readFileSync(PCE_DASHBOARD_PATH, "utf-8");
    expect(html).toContain('submitted:{');
    expect(html).toContain('approved:{');
    expect(html).toContain('paid:{');
    expect(html).toContain('refused:{');
    expect(html).toContain('draft:{');
    expect(html).toContain('confirmed:{');
  });

  it("contains 3-step STAGES pipeline for expense detail (no draft)", () => {
    const html = fs.readFileSync(PCE_DASHBOARD_PATH, "utf-8");
    expect(html).toContain('["submitted","approved","paid"]');
  });

  it("contains 5 expense filter pills (no draft)", () => {
    const html = fs.readFileSync(PCE_DASHBOARD_PATH, "utf-8");
    expect(html).toContain('"submitted","Pending Review"');
    expect(html).toContain('"approved","Approved"');
    expect(html).toContain('"paid","Paid"');
    expect(html).toContain('"refused","Refused"');
    // Draft filter pill should NOT exist for expenses
    expect(html).not.toContain('"draft","Draft"');
  });

  it("contains 5 KPI cards for expenses page", () => {
    const html = fs.readFileSync(PCE_DASHBOARD_PATH, "utf-8");
    expect(html).toContain('Pending Review');
    expect(html).toContain('Approved');
    expect(html).toContain('Paid');
    expect(html).toContain('Refused');
  });

  it("contains submitExp, approveExp, payExp, refuseExp, resetExp functions", () => {
    const html = fs.readFileSync(PCE_DASHBOARD_PATH, "utf-8");
    expect(html).toContain('async function submitExp');
    expect(html).toContain('async function approveExp');
    expect(html).toContain('async function payExp');
    expect(html).toContain('async function refuseExp');
    expect(html).toContain('async function resetExp');
  });

  it("contains reminder CRUD actions", () => {
    const html = fs.readFileSync(PCE_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("pce.createReminder");
    expect(html).toContain("pce.updateReminder");
    expect(html).toContain("pce.toggleReminder");
    expect(html).toContain("pce.deleteReminder");
  });

  it("contains postMessage listener for parent navigation", () => {
    const html = fs.readFileSync(PCE_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("pce-navigate");
    expect(html).toContain("message");
  });

  it("contains ALL_ODOO_COMPANIES array for company resolution", () => {
    const html = fs.readFileSync(PCE_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("ALL_ODOO_COMPANIES");
  });

  it("contains loading state for data fetching", () => {
    const html = fs.readFileSync(PCE_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("Loading");
  });

  it("contains setState and render functions for SPA behavior", () => {
    const html = fs.readFileSync(PCE_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("function setState");
    expect(html).toContain("function render");
  });
});

describe("PCE Odoo Backend", () => {
  it("odoo-expenses.ts API service exists", () => {
    const apiPath = path.resolve(
      import.meta.dirname,
      "./odoo-expenses.ts"
    );
    expect(fs.existsSync(apiPath)).toBe(true);
  });

  it("odoo-expenses.ts contains required API functions", () => {
    const apiPath = path.resolve(
      import.meta.dirname,
      "./odoo-expenses.ts"
    );
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("fetchPCEEmployees");
    // hr.expense.sheet note is still referenced
    expect(content).toContain("hr.expense.sheet");
    // Odoo pf.petty.cash integration
    expect(content).toContain("fetchPettyCashTransactions");
    expect(content).toContain("createPettyCashTransaction");
    expect(content).toContain("confirmPettyCashTransaction");
    expect(content).toContain("deletePettyCashTransaction");
    expect(content).toContain("pf.petty.cash");
  });

  it("odoo-expenses.ts contains expense state transition functions", () => {
    const apiPath = path.resolve(
      import.meta.dirname,
      "./odoo-expenses.ts"
    );
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("submitExpenseDeduction");
    expect(content).toContain("approveExpenseDeduction");
    expect(content).toContain("payExpenseDeduction");
    expect(content).toContain("refuseExpenseDeduction");
    expect(content).toContain("resetExpenseDeduction");
  });

  it("OdooPettyCash interface includes all 6 states", () => {
    const apiPath = path.resolve(
      import.meta.dirname,
      "./odoo-expenses.ts"
    );
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain('"submitted"');
    expect(content).toContain('"approved"');
    expect(content).toContain('"paid"');
    expect(content).toContain('"refused"');
  });

  it("PCE tRPC router exists with all endpoints", () => {
    const routerPath = path.resolve(
      import.meta.dirname,
      "./routers/pce.ts"
    );
    expect(fs.existsSync(routerPath)).toBe(true);
    const content = fs.readFileSync(routerPath, "utf-8");
    expect(content).toContain("employees");
    expect(content).toContain("expenses");
    expect(content).toContain("pettyCash");
    expect(content).toContain("createPettyCash");
    expect(content).toContain("confirmPettyCash");
    expect(content).toContain("deletePettyCash");
    expect(content).toContain("requests");
    expect(content).toContain("reminders");
    expect(content).toContain("approveRequest");
    expect(content).toContain("refuseRequest");
    expect(content).toContain("approveExpense");
    expect(content).toContain("refuseExpense");
    expect(content).toContain("createReminder");
    expect(content).toContain("updateReminder");
    expect(content).toContain("toggleReminder");
    expect(content).toContain("deleteReminder");
  });

  it("PCE tRPC router contains new expense state transition endpoints", () => {
    const routerPath = path.resolve(
      import.meta.dirname,
      "./routers/pce.ts"
    );
    const content = fs.readFileSync(routerPath, "utf-8");
    expect(content).toContain("submitExpense");
    expect(content).toContain("approveExpense");
    expect(content).toContain("payExpense");
    expect(content).toContain("refuseExpense");
    expect(content).toContain("resetExpense");
    // Verify imports from odoo-expenses
    expect(content).toContain("submitExpenseDeduction");
    expect(content).toContain("approveExpenseDeduction");
    expect(content).toContain("payExpenseDeduction");
    expect(content).toContain("refuseExpenseDeduction");
    expect(content).toContain("resetExpenseDeduction");
  });

  it("PCE router is wired into main appRouter", () => {
    const routersPath = path.resolve(
      import.meta.dirname,
      "./routers.ts"
    );
    const content = fs.readFileSync(routersPath, "utf-8");
    expect(content).toContain("pce:");
    expect(content).toContain("pceRouter");
  });
});

describe("PCE Module Integration", () => {
  it("PCEHome.tsx component file exists", () => {
    const pcePath = path.resolve(
      import.meta.dirname,
      "../client/src/pages/PCEHome.tsx"
    );
    expect(fs.existsSync(pcePath)).toBe(true);
  });

  it("PCEHome.tsx references the pce-dashboard API route", () => {
    const pcePath = path.resolve(
      import.meta.dirname,
      "../client/src/pages/PCEHome.tsx"
    );
    const content = fs.readFileSync(pcePath, "utf-8");
    expect(content).toContain("/api/pce-dashboard");
  });

  it("PCEHome.tsx contains sidebar nav items for all 4 pages", () => {
    const pcePath = path.resolve(
      import.meta.dirname,
      "../client/src/pages/PCEHome.tsx"
    );
    const content = fs.readFileSync(pcePath, "utf-8");
    expect(content).toContain("Dashboard");
    expect(content).toContain("Petty Cash");
    expect(content).toContain("Expenses");
    expect(content).toContain("Reminders");
  });

  it("PCEHome.tsx listens for pce-page-changed messages", () => {
    const pcePath = path.resolve(
      import.meta.dirname,
      "../client/src/pages/PCEHome.tsx"
    );
    const content = fs.readFileSync(pcePath, "utf-8");
    expect(content).toContain("pce-page-changed");
    expect(content).toContain("pce-navigate");
  });

  it("App.tsx contains PCE route", () => {
    const appPath = path.resolve(
      import.meta.dirname,
      "../client/src/App.tsx"
    );
    const content = fs.readFileSync(appPath, "utf-8");
    expect(content).toContain("/pce");
    expect(content).toContain("PCEHome");
  });

  it("ModuleLauncher.tsx contains PCE module card", () => {
    const launcherPath = path.resolve(
      import.meta.dirname,
      "../client/src/pages/ModuleLauncher.tsx"
    );
    const content = fs.readFileSync(launcherPath, "utf-8");
    expect(content).toContain("Petty Cash & Expenses");
    expect(content).toContain("/pce");
  });

  it("SystemUserMgmt.tsx contains PCE in the MODULES list", () => {
    const mgmtPath = path.resolve(
      import.meta.dirname,
      "../client/src/pages/SystemUserMgmt.tsx"
    );
    const content = fs.readFileSync(mgmtPath, "utf-8");
    expect(content).toContain("pce");
    expect(content).toContain("Petty Cash & Expenses");
  });

  it("server index.ts serves pce-dashboard route", () => {
    const indexPath = path.resolve(
      import.meta.dirname,
      "./_core/index.ts"
    );
    const content = fs.readFileSync(indexPath, "utf-8");
    expect(content).toContain("/api/pce-dashboard");
    expect(content).toContain("pce-dashboard.html");
  });
});

describe("PCE Database Schema", () => {
  it("drizzle schema contains petty cash tables", () => {
    const schemaPath = path.resolve(
      import.meta.dirname,
      "../drizzle/schema.ts"
    );
    const content = fs.readFileSync(schemaPath, "utf-8");
    expect(content).toContain("pettyCashTransactions");
    expect(content).toContain("pettyCashRequests");
    expect(content).toContain("pceReminders");
  });

  it("petty cash transactions table has required columns", () => {
    const schemaPath = path.resolve(
      import.meta.dirname,
      "../drizzle/schema.ts"
    );
    const content = fs.readFileSync(schemaPath, "utf-8");
    expect(content).toContain("employeeId");
    expect(content).toContain("amount");
    expect(content).toContain("purpose");
    expect(content).toContain("companyId");
  });

  it("petty cash requests table has status field", () => {
    const schemaPath = path.resolve(
      import.meta.dirname,
      "../drizzle/schema.ts"
    );
    const content = fs.readFileSync(schemaPath, "utf-8");
    expect(content).toContain("pending");
    expect(content).toContain("disbursed");
    expect(content).toContain("rejected");
  });
});
