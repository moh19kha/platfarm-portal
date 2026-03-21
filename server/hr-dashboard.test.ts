import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const HR_DASHBOARD_PATH = path.resolve(
  import.meta.dirname,
  "../client/public/hr-dashboard.html"
);

describe("HR Dashboard Module", () => {
  it("hr-dashboard.html file exists", () => {
    expect(fs.existsSync(HR_DASHBOARD_PATH)).toBe(true);
  });

  it("contains tRPC API integration for live Odoo data", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    // Should fetch from tRPC API endpoints
    expect(html).toContain("trpcQuery");
    expect(html).toContain("hr.employees");
    expect(html).toContain("hr.dashboardStats");
    expect(html).toContain("hr.leaves");
    expect(html).toContain("hr.contracts");
    expect(html).toContain("hr.payslips");
    expect(html).toContain("loadData");
  });

  it("contains mapEmployee function for Odoo → UI field mapping", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("mapEmployee");
    expect(html).toContain("avatarSrc");
    expect(html).toContain("hashColor");
    expect(html).toContain("getInitials");
  });

  it("contains all 4 sidebar navigation pages", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("dashboard");
    expect(html).toContain("employees");
    expect(html).toContain("leaves");
    expect(html).toContain("discipline");
    expect(html).toContain("Employee Directory");
    expect(html).toContain("Leave Management");
    expect(html).toContain("Bonus & Fines");
  });

  it("contains all 7 profile tabs", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("overview");
    expect(html).toContain("contract");
    expect(html).toContain("documents");
    expect(html).toContain("activity");
    expect(html).toContain("leaves");
    expect(html).toContain("discipline");
    expect(html).toContain("payslips");
  });

  it("contains all 5 modal types", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("modal:'leave'");
    expect(html).toContain("modal:'bonus'");
    expect(html).toContain("modal:'fine'");
    expect(html).toContain("modal:'payslip'");
    expect(html).toContain("modal:'doc'");
  });

  it("contains the 6-step Add Employee wizard", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("wizardOpen");
    expect(html).toContain("wizStep");
    expect(html).toContain("Identity");
    expect(html).toContain("Personal");
    expect(html).toContain("Work Setup");
    expect(html).toContain("Contract");
    expect(html).toContain("Review");
  });

  it("contains Platfarm brand colors", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("#2D5A3D");
    expect(html).toContain("#4A7C59");
    expect(html).toContain("#C0714A");
  });

  it("contains company filter functionality", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("All Companies");
    expect(html).toContain("companyObjects");
  });

  it("contains search functionality", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("searchQ");
    expect(html).toContain("Search by name, title, ID");
  });

  it("contains card and table view toggle", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("Cards");
    expect(html).toContain("Table");
    expect(html).toContain("dirView");
  });

  it("contains employee contract and compensation fields", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("wage");
    expect(html).toContain("housing");
    expect(html).toContain("transport");
    expect(html).toContain("socialIns");
  });

  it("contains leavesUsed field for correct leave calculation", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("leavesUsed");
    // Should NOT use the old totalLeaves-leaves calculation
    expect(html).not.toContain("e.totalLeaves-e.leaves");
  });

  it("contains loading state for API data fetching", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("Connecting to Odoo");
  });
});

describe("HR Odoo Backend", () => {
  it("odoo-hr.ts API service exists", () => {
    const apiPath = path.resolve(
      import.meta.dirname,
      "./odoo-hr.ts"
    );
    expect(fs.existsSync(apiPath)).toBe(true);
  });

  it("odoo-hr.ts contains all required API functions", () => {
    const apiPath = path.resolve(
      import.meta.dirname,
      "./odoo-hr.ts"
    );
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("fetchEmployees");
    expect(content).toContain("fetchContracts");
    expect(content).toContain("fetchLeaves");
    expect(content).toContain("fetchPayslips");
    expect(content).toContain("fetchExpenses");
    expect(content).toContain("createLeave");
    expect(content).toContain("createContract");
    expect(content).toContain("hr.employee");
    expect(content).toContain("hr.contract");
    expect(content).toContain("hr.leave");
    expect(content).toContain("hr.payslip");
  });

  it("HR tRPC router exists with all endpoints", () => {
    const routerPath = path.resolve(
      import.meta.dirname,
      "./routers/hr.ts"
    );
    expect(fs.existsSync(routerPath)).toBe(true);
    const content = fs.readFileSync(routerPath, "utf-8");
    expect(content).toContain("employees");
    expect(content).toContain("dashboardStats");
    expect(content).toContain("leaves");
    expect(content).toContain("contracts");
    expect(content).toContain("payslips");
    expect(content).toContain("expenses");
    expect(content).toContain("createLeave");
  });

  it("HR router is wired into main appRouter", () => {
    const routersPath = path.resolve(
      import.meta.dirname,
      "./routers.ts"
    );
    const content = fs.readFileSync(routersPath, "utf-8");
    expect(content).toContain("hr:");
    expect(content).toContain("hrRouter");
  });
});

describe("Leave Balance Accrual System", () => {
  it("calculateLeaveBalance function exists in db.ts", () => {
    const dbPath = path.resolve(import.meta.dirname, "./db.ts");
    const content = fs.readFileSync(dbPath, "utf-8");
    expect(content).toContain("calculateLeaveBalance");
    expect(content).toContain("monthsWorked");
    expect(content).toContain("monthlyRate");
    expect(content).toContain("accruedDays");
    expect(content).toContain("remainingDays");
  });

  it("upsertLeaveSetting function exists in db.ts", () => {
    const dbPath = path.resolve(import.meta.dirname, "./db.ts");
    const content = fs.readFileSync(dbPath, "utf-8");
    expect(content).toContain("upsertLeaveSetting");
    expect(content).toContain("getLeaveSettingByEmployee");
    expect(content).toContain("getAllLeaveSettings");
  });

  it("leaveSettings table exists in schema.ts", () => {
    const schemaPath = path.resolve(import.meta.dirname, "../drizzle/schema.ts");
    const content = fs.readFileSync(schemaPath, "utf-8");
    expect(content).toContain("leave_settings");
    expect(content).toContain("odooEmployeeId");
    expect(content).toContain("joiningDate");
    expect(content).toContain("annualLeaveDays");
    expect(content).toContain("employeeName");
  });

  it("HR tRPC router has leave settings endpoints", () => {
    const routerPath = path.resolve(import.meta.dirname, "./routers/hr.ts");
    const content = fs.readFileSync(routerPath, "utf-8");
    expect(content).toContain("upsertLeaveSetting");
    expect(content).toContain("getAllLeaveSettings");
    expect(content).toContain("getLeaveSettings");
    expect(content).toContain("calculateLeaveBalance");
  });

  it("HR dashboard HTML has leave balance calculation logic", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("leaveSettingsMap");
    expect(html).toContain("hr.getAllLeaveSettings");
    expect(html).toContain("hr.upsertLeaveSetting");
    expect(html).toContain("saveLeaveSettings");
    expect(html).toContain("saveSingleLeaveSettings");
    expect(html).toContain("saveAllLeaveSettings");
    expect(html).toContain("_accrued");
    expect(html).toContain("_monthlyRate");
    expect(html).toContain("_monthsWorked");
  });

  it("HR dashboard HTML has Configure Leave Settings modal", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("modal:'leaveSettings'");
    expect(html).toContain("modal:'bulkLeaveSettings'");
    expect(html).toContain("Configure Leave Settings");
    expect(html).toContain("ls_annual");
    expect(html).toContain("ls_joining");
  });

  it("loadData uses two-phase progressive loading", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    // Phase 1: only employees, stats, contracts fetched before first render
    expect(html).toContain("PHASE 1: Critical data");
    expect(html).toContain("PHASE 2: Secondary data in background");
    // Secondary data loaded in background .then() block
    expect(html).toContain("hr.getAllLeaveSettings");
    expect(html).toContain("Re-render with secondary data populated");
    // No longer awaiting all 10 calls before first render
    expect(html).not.toContain("hr.leaves'),\n      trpcQuery('hr.contracts");
  });

  it("salary_history table exists in schema.ts", () => {
    const schema = fs.readFileSync(path.join(__dirname, "../drizzle/schema.ts"), "utf-8");
    expect(schema).toContain("salary_history");
    expect(schema).toContain("odooEmployeeId");
    expect(schema).toContain("previousWage");
    expect(schema).toContain("newWage");
    expect(schema).toContain("previousHousing");
    expect(schema).toContain("newHousing");
  });

  it("getSalaryHistory and logSalaryChange are exported from db.ts", () => {
    const db = fs.readFileSync(path.join(__dirname, "../server/db.ts"), "utf-8");
    expect(db).toContain("export async function logSalaryChange");
    expect(db).toContain("export async function getSalaryHistory");
  });

  it("hr.ts imports and exposes salary history procedures", () => {
    const hr = fs.readFileSync(path.join(__dirname, "../server/routers/hr.ts"), "utf-8");
    expect(hr).toContain("logSalaryChange");
    expect(hr).toContain("getSalaryHistory");
    expect(hr).toContain("getSalaryHistory: publicProcedure");
    expect(hr).toContain("logSalaryChange: publicProcedure");
  });

  it("Edit Contract modal has salary and allowance fields", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("ec_wage");
    expect(html).toContain("ec_housing");
    expect(html).toContain("ec_transport");
    expect(html).toContain("ec_other");
    expect(html).toContain("updateEcTotal");
    expect(html).toContain("ec_socialins");
    expect(html).toContain("ec_start");
    expect(html).toContain("ec_end");
  });

  it("HR dashboard has salary history timeline UI", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("_salaryHistory");
    expect(html).toContain("Salary History");
    expect(html).toContain("getSalaryHistory");
    expect(html).toContain("logSalaryChange");
    expect(html).toContain("_salaryHistoryLoaded");
    expect(html).toContain("prevGross");
    expect(html).toContain("newGross");
  });

  it("HR dashboard has contract renewal banner", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("renewContract");
    expect(html).toContain("terminateContract");
    expect(html).toContain("Contract Expiring in");
    expect(html).toContain("Contract Expired");
    expect(html).toContain("Renew Contract");
    expect(html).toContain("daysLeft");
  });

  it("HR dashboard Leave Balances table shows accrual columns", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("Leave Balances (Accrual-Based)");
    expect(html).toContain("Joining Date");
    expect(html).toContain("Annual Entitlement");
    expect(html).toContain("Monthly Rate");
    expect(html).toContain("Accrued");
    expect(html).toContain("Configured");
    expect(html).toContain("Odoo Default");
  });

  it("Edit Employee modal has correct fields matching profile cards", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    // Should have Work Information section
    expect(html).toContain("Work Information");
    expect(html).toContain("edit_name");
    expect(html).toContain("edit_job_title");
    expect(html).toContain("edit_work_email");
    expect(html).toContain("edit_work_phone");
    // Should have Personal Details section
    expect(html).toContain("Personal Details");
    expect(html).toContain("edit_gender");
    expect(html).toContain("edit_marital");
    expect(html).toContain("edit_nationality");
    expect(html).toContain("edit_birthday");
    expect(html).toContain("edit_identification_id");
    expect(html).toContain("edit_passport_id");
    expect(html).toContain("edit_emergency_contact");
    expect(html).toContain("edit_emergency_phone");
    // Department should now be an editable dropdown
    expect(html).toContain("edit_dept_id");
    expect(html).toContain("department_id");
    // Should NOT have removed fields
    expect(html).not.toContain("edit_mobile_phone");
    expect(html).not.toContain("edit_children");
    expect(html).not.toContain("edit_visa_no");
    expect(html).not.toContain("Department and Company are managed in Odoo and cannot be changed here");
  });

  it("HR dashboard uses contract dateStart as hireDate", () => {
    const html = fs.readFileSync(HR_DASHBOARD_PATH, "utf-8");
    expect(html).toContain("_contractDateStart");
    expect(html).toContain("c.dateStart");
  });
});

describe("HR Module Integration", () => {
  it("HRHome.tsx component file exists", () => {
    const hrHomePath = path.resolve(
      import.meta.dirname,
      "../client/src/pages/HRHome.tsx"
    );
    expect(fs.existsSync(hrHomePath)).toBe(true);
  });

  it("HRHome.tsx references the hr-dashboard API route", () => {
    const hrHomePath = path.resolve(
      import.meta.dirname,
      "../client/src/pages/HRHome.tsx"
    );
    const content = fs.readFileSync(hrHomePath, "utf-8");
    expect(content).toContain("/api/hr-dashboard");
  });

  it("App.tsx contains HR route", () => {
    const appPath = path.resolve(
      import.meta.dirname,
      "../client/src/App.tsx"
    );
    const content = fs.readFileSync(appPath, "utf-8");
    expect(content).toContain("/hr");
    expect(content).toContain("HRHome");
  });

  it("ModuleLauncher.tsx contains HR module card", () => {
    const launcherPath = path.resolve(
      import.meta.dirname,
      "../client/src/pages/ModuleLauncher.tsx"
    );
    const content = fs.readFileSync(launcherPath, "utf-8");
    expect(content).toContain("Human Resources");
    expect(content).toContain("/hr");
  });

  it("server index.ts serves hr-dashboard route with production support", () => {
    const indexPath = path.resolve(
      import.meta.dirname,
      "./_core/index.ts"
    );
    const content = fs.readFileSync(indexPath, "utf-8");
    expect(content).toContain("/api/hr-dashboard");
    expect(content).toContain("hr-dashboard.html");
    expect(content).toContain("resolveDashboardPath");
  });
});
