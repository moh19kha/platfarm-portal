/**
 * Odoo HR Module API Service
 *
 * Provides CRUD operations for HR models:
 * - hr.employee (employees)
 * - hr.department (departments)
 * - hr.job (job positions)
 * - hr.contract (contracts)
 * - hr.leave (leave requests)
 * - hr.leave.type (leave types)
 * - hr.leave.allocation (leave allocations)
 * - hr.payslip (payslips)
 * - hr.attendance (attendance)
 * - hr.expense (expenses — used for fines/bonuses tracking)
 *
 * Uses the same stateless execute_kw pattern as odoo.ts
 */

import axios from "axios";

// ─── Odoo Connection Config ────────────────────────────────────────────────
const ODOO_URL = "https://odoo.platfarm.io";
const ODOO_DB = "odoo";
const ODOO_USER = "aiagent";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD ?? "Platfarm@2025";
const ALLOWED_COMPANY_IDS = [1, 2, 3, 4, 5];

const odooClient = axios.create({
  baseURL: ODOO_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 25000,
});

// ─── Types ─────────────────────────────────────────────────────────────────

type OdooM2O = [number, string] | false;

export interface OdooEmployee {
  id: number;
  name: string;
  job_title: string | false;
  job_id: OdooM2O;
  department_id: OdooM2O;
  company_id: OdooM2O;
  work_email: string | false;
  work_phone: string | false;
  mobile_phone: string | false;
  phone: string | false;
  birthday: string | false;
  gender: string | false;
  marital: string | false;
  children: number;
  identification_id: string | false;
  passport_id: string | false;
  visa_no: string | false;
  visa_expire: string | false;
  permit_no: string | false;
  work_permit_expiration_date: string | false;
  country_id: OdooM2O;
  country_of_birth: OdooM2O;
  place_of_birth: string | false;
  certificate: string | false;
  study_field: string | false;
  study_school: string | false;
  emergency_contact: string | false;
  emergency_phone: string | false;
  bank_account_id: OdooM2O;
  contract_id: OdooM2O;
  contract_ids: number[];
  attendance_state: string | false;
  hr_presence_state: string | false;
  allocation_count: number;
  allocation_remaining_display: string | false;
  payslip_count: number;
  employee_type: string | false;
  active: boolean;
  parent_id: OdooM2O;
  coach_id: OdooM2O;
  leave_manager_id: OdooM2O;
  create_date: string;
  barcode: string | false;
  image_128: string | false;
}

export interface OdooDepartment {
  id: number;
  name: string;
  company_id: OdooM2O;
  manager_id: OdooM2O;
  member_ids: number[];
  total_employee: number;
}

export interface OdooContract {
  id: number;
  name: string;
  employee_id: OdooM2O;
  state: string;
  date_start: string | false;
  date_end: string | false;
  wage: number;
  job_id: OdooM2O;
  department_id: OdooM2O;
  company_id: OdooM2O;
  structure_type_id: OdooM2O;
  hr_responsible_id: OdooM2O;
  resource_calendar_id: OdooM2O;
  notes: string | false;
  l10n_eg_housing_allowance: number;
  l10n_eg_transportation_allowance: number;
  l10n_eg_other_allowances: number;
  l10n_ae_housing_allowance: number;
  l10n_ae_transportation_allowance: number;
  l10n_ae_other_allowances: number;

}

export interface OdooLeave {
  id: number;
  name: string | false;
  employee_id: OdooM2O;
  holiday_status_id: OdooM2O;
  date_from: string | false;
  date_to: string | false;
  number_of_days: number;
  state: string;
  company_id: OdooM2O;
}

export interface OdooLeaveType {
  id: number;
  name: string;
  company_id: OdooM2O;
  leave_validation_type: string | false;
}

export interface OdooLeaveAllocation {
  id: number;
  name: string | false;
  employee_id: OdooM2O;
  holiday_status_id: OdooM2O;
  number_of_days: number;
  state: string;
  date_from: string | false;
  date_to: string | false;
}

export interface OdooPayslip {
  id: number;
  name: string | false;
  number: string | false;
  employee_id: OdooM2O;
  date_from: string | false;
  date_to: string | false;
  state: string;
  company_id: OdooM2O;
  struct_id: OdooM2O;
  basic_wage: number;
  net_wage: number;
  gross_wage: number;
}

export interface OdooAttendance {
  id: number;
  employee_id: OdooM2O;
  check_in: string;
  check_out: string | false;
  worked_hours: number;
}

export interface OdooExpense {
  id: number;
  name: string;
  employee_id: OdooM2O;
  total_amount: number;
  state: string;
  date: string;
  company_id: OdooM2O;
  product_id: OdooM2O;
  description: string | false;
}

export interface OdooJob {
  id: number;
  name: string;
  department_id: OdooM2O;
  company_id: OdooM2O;
  no_of_employee: number;
  no_of_recruitment: number;
}

// ─── UID Cache ─────────────────────────────────────────────────────────────

let _uidPromise: Promise<number> | null = null;

function getUid(): Promise<number> {
  if (_uidPromise) return _uidPromise;
  _uidPromise = (async () => {
    try {
      const res = await odooClient.post("/jsonrpc", {
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "common",
          method: "authenticate",
          args: [ODOO_DB, ODOO_USER, ODOO_PASSWORD, {}],
        },
      });
      if (res.data.error) throw new Error(`Odoo auth error: ${res.data.error.data.message}`);
      const uid = res.data.result;
      if (!uid || typeof uid !== "number") throw new Error("Odoo authentication failed");
      return uid;
    } catch (err) {
      _uidPromise = null;
      throw err;
    }
  })();
  return _uidPromise;
}

// ─── Server-Side Response Cache (stale-while-revalidate) ────────────────────
// Fresh window: 5 min  — served directly, no refresh triggered
// Stale window: 5–15 min — served immediately + background refresh triggered
// Expired: >15 min — blocking fetch (should not happen with periodic warmup)

interface CacheEntry<T> { data: T; setAt: number; }
const _hrCache = new Map<string, CacheEntry<unknown>>();
const CACHE_FRESH_MS  = 300_000;  // 5 minutes  — serve without triggering refresh
const CACHE_STALE_MS  = 900_000;  // 15 minutes — serve stale + background refresh
const _refreshing = new Set<string>();

function cacheGet<T>(key: string): T | null {
  const entry = _hrCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  const age = Date.now() - entry.setAt;
  if (age > CACHE_STALE_MS) { _hrCache.delete(key); return null; } // truly expired
  return entry.data;
}
function isCacheStale(key: string): boolean {
  const entry = _hrCache.get(key);
  if (!entry) return true;
  return (Date.now() - entry.setAt) > CACHE_FRESH_MS;
}
function cacheSet<T>(key: string, data: T): void {
  _hrCache.set(key, { data, setAt: Date.now() });
}
export function clearHRCache(): void { _hrCache.clear(); }

// Stale-while-revalidate: always return cached data instantly; refresh in bg when stale
async function cachedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== null) {
    if (isCacheStale(key) && !_refreshing.has(key)) {
      _refreshing.add(key);
      fetcher()
        .then(fresh => cacheSet(key, fresh))
        .catch(e => console.warn(`[HR Cache] Bg refresh failed (${key}):`, e.message))
        .finally(() => _refreshing.delete(key));
    }
    return cached;
  }
  // Nothing in cache — blocking fetch
  const result = await fetcher();
  cacheSet(key, result);
  return result;
}

// ─── Startup Warmup + Periodic Cache Refresh ────────────────────────────────
async function warmupCoreCache(): Promise<void> {
  await Promise.all([
    fetchEmployees().catch(e => console.warn("[HR Cache] employees refresh failed:", e.message)),
    fetchHRDashboardStats().catch(e => console.warn("[HR Cache] dashboardStats refresh failed:", e.message)),
    fetchContracts().catch(e => console.warn("[HR Cache] contracts refresh failed:", e.message)),
    fetchLeaves().catch(e => console.warn("[HR Cache] leaves refresh failed:", e.message)),
    fetchBonusFines().catch(e => console.warn("[HR Cache] bonusFines refresh failed:", e.message)),
    fetchBonusFineTypes().catch(e => console.warn("[HR Cache] bonusFineTypes refresh failed:", e.message)),
  ]);
}

export async function warmupOdooAuth(): Promise<void> {
  try {
    console.log("[HR Warmup] Pre-authenticating with Odoo...");
    const start = Date.now();
    await executeKw<unknown>("hr.employee", "search_count", [[]], {}, 1);
    console.log("[HR Warmup] Odoo auth primed in " + (Date.now() - start) + "ms");
    warmupCoreCache().catch(() => {});
    console.log("[HR Warmup] Cache pre-warm initiated.");
    // Refresh core cache every 4 minutes to keep it warm (TTL fresh window = 5 min)
    setInterval(() => {
      warmupCoreCache().catch(e => console.warn("[HR Warmup] Periodic refresh error:", e.message));
    }, 4 * 60 * 1000);
  } catch (err) {
    console.warn("[HR Warmup] Pre-warm failed (non-fatal):", err.message);
  }
}

// ─── Core RPC Helper ─────────────────────────────────────────────────────────────
async function executeKw<T = unknown>(
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown> = {},
  retries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const uid = await getUid();
      const kwargsWithContext = {
        ...kwargs,
        context: {
          ...(kwargs.context as Record<string, unknown> || {}),
          allowed_company_ids: ALLOWED_COMPANY_IDS,
        },
      };
      const res = await odooClient.post("/jsonrpc", {
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "object",
          method: "execute_kw",
          args: [ODOO_DB, uid, ODOO_PASSWORD, model, method, args, kwargsWithContext],
        },
      });
      if (res.data.error) {
        if (res.data.error.code === 100 || res.data.error.code === 2) _uidPromise = null;
        throw new Error(`Odoo RPC error (${model}.${method}): ${res.data.error.data.message}`);
      }
      return res.data.result as T;
    } catch (err) {
      const isTransient = err.message?.includes("socket hang up") ||
        err.message?.includes("ECONNRESET") ||
        err.code === "ECONNRESET" || err.code === "ECONNREFUSED";
      if (isTransient && attempt < retries) {
        _uidPromise = null;
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error("executeKw: exhausted retries");
}

// ─── Employee Fields ───────────────────────────────────────────────────────

const EMPLOYEE_FIELDS = [
  "id", "name", "job_title", "job_id", "department_id", "company_id",
  "work_email", "work_phone", "mobile_phone", "phone",
  "birthday", "gender", "marital", "children",
  "identification_id", "passport_id", "visa_no", "visa_expire",
  "permit_no", "work_permit_expiration_date",
  "country_id", "country_of_birth", "place_of_birth",
  "certificate", "study_field", "study_school",
  "emergency_contact", "emergency_phone",
  "bank_account_id", "contract_id", "contract_ids",
  "attendance_state", "hr_presence_state",
  "allocation_count", "allocation_remaining_display",
  "payslip_count", "employee_type", "active",
  "parent_id", "coach_id", "leave_manager_id",
  "create_date", "barcode", "image_128",
];

// ─── Employees ─────────────────────────────────────────────────────────────

export async function fetchEmployees(companyId?: number): Promise<OdooEmployee[]> {
  const cacheKey = `employees:${companyId ?? 'all'}`;
  const domain: unknown[] = companyId ? [["company_id", "=", companyId]] : [];
  return cachedFetch(cacheKey, () => executeKw<OdooEmployee[]>("hr.employee", "search_read", [domain], {
    fields: EMPLOYEE_FIELDS,
    order: "name asc",
  }));
}

export async function fetchEmployeeById(id: number): Promise<OdooEmployee | null> {
  const results = await executeKw<OdooEmployee[]>("hr.employee", "search_read",
    [[["id", "=", id]]], { fields: EMPLOYEE_FIELDS }
  );
  return results.length > 0 ? results[0] : null;
}

export async function fetchEmployeeCount(companyId?: number): Promise<number> {
  const domain: unknown[] = companyId ? [["company_id", "=", companyId]] : [];
  return executeKw<number>("hr.employee", "search_count", [domain]);
}

export async function createEmployee(vals: Record<string, unknown>): Promise<number> {
  return executeKw<number>("hr.employee", "create", [vals]);
}

export async function searchCountryByName(name: string): Promise<number | null> {
  const results = await executeKw<{id: number}[]>("res.country", "search_read", [[["name", "ilike", name]]], { fields: ["id", "name"], limit: 1 });
  return results.length > 0 ? results[0].id : null;
}

export async function updateEmployee(id: number, vals: Record<string, unknown>): Promise<boolean> {
  return executeKw<boolean>("hr.employee", "write", [[id], vals]);
}

// ─── Departments ───────────────────────────────────────────────────────────

export async function fetchDepartments(companyId?: number): Promise<OdooDepartment[]> {
  const cacheKey = `departments:${companyId ?? 'all'}`;
  const domain: unknown[] = companyId ? [["company_id", "=", companyId]] : [];
  return cachedFetch(cacheKey, () => executeKw<OdooDepartment[]>("hr.department", "search_read", [domain], {
    fields: ["id", "name", "company_id", "manager_id", "member_ids", "total_employee"],
    order: "name asc",
  }));
}

// ─── Job Positions ─────────────────────────────────────────────────────────

export async function fetchJobs(companyId?: number): Promise<OdooJob[]> {
  const domain: unknown[] = companyId ? [["company_id", "=", companyId]] : [];
  return executeKw<OdooJob[]>("hr.job", "search_read", [domain], {
    fields: ["id", "name", "department_id", "company_id", "no_of_employee", "no_of_recruitment"],
    order: "name asc",
  });
}

// ─── Contracts ─────────────────────────────────────────────────────────────

const CONTRACT_FIELDS = [
  "id", "name", "employee_id", "state", "date_start", "date_end",
  "wage", "job_id", "department_id", "company_id",
  "structure_type_id", "hr_responsible_id", "resource_calendar_id", "notes",
  "l10n_eg_housing_allowance", "l10n_eg_transportation_allowance", "l10n_eg_other_allowances",
  "l10n_ae_housing_allowance", "l10n_ae_transportation_allowance", "l10n_ae_other_allowances",

];

export async function fetchContracts(employeeId?: number): Promise<OdooContract[]> {
  const cacheKey = `contracts:${employeeId ?? 'all'}`;
  const domain: unknown[] = employeeId ? [["employee_id", "=", employeeId]] : [];
  return cachedFetch(cacheKey, () => executeKw<OdooContract[]>("hr.contract", "search_read", [domain], {
    fields: CONTRACT_FIELDS,
    order: "date_start desc",
  }));
}

export async function createContract(vals: Record<string, unknown>): Promise<number> {
  return executeKw<number>("hr.contract", "create", [vals]);
}

export async function updateContract(id: number, vals: Record<string, unknown>): Promise<boolean> {
  return executeKw<boolean>("hr.contract", "write", [[id], vals]);
}

// ─── Leaves ────────────────────────────────────────────────────────────────

const LEAVE_FIELDS = [
  "id", "name", "employee_id", "holiday_status_id",
  "date_from", "date_to", "number_of_days", "state", "company_id",
];

export async function fetchLeaves(employeeId?: number, companyId?: number, limit?: number): Promise<OdooLeave[]> {
  const cacheKey = `leaves:${employeeId ?? 'all'}:${companyId ?? 'all'}:${limit ?? 'all'}`;
  const domain: unknown[][] = [];
  if (employeeId) domain.push(["employee_id", "=", employeeId]);
  if (companyId) domain.push(["company_id", "=", companyId]);
  const kwargs: Record<string, unknown> = { fields: LEAVE_FIELDS, order: "date_from desc" };
  if (limit) kwargs.limit = limit;
  return cachedFetch(cacheKey, () => executeKw<OdooLeave[]>("hr.leave", "search_read", [domain], kwargs));
}

export async function createLeave(vals: Record<string, unknown>): Promise<number> {
  return executeKw<number>("hr.leave", "create", [vals]);
}

export async function approveLeave(id: number): Promise<boolean> {
  return executeKw<boolean>("hr.leave", "action_approve", [[id]]);
}

export async function refuseLeave(id: number): Promise<boolean> {
  return executeKw<boolean>("hr.leave", "action_refuse", [[id]]);
}

// ─── Leave Types ───────────────────────────────────────────────────────────

export async function fetchLeaveTypes(): Promise<OdooLeaveType[]> {
  return cachedFetch("leaveTypes", () => executeKw<OdooLeaveType[]>("hr.leave.type", "search_read", [[]], {
    fields: ["id", "name", "company_id", "leave_validation_type"],
    order: "name asc",
  }));
}

// ─── Leave Allocations ─────────────────────────────────────────────────────

const ALLOCATION_FIELDS = [
  "id", "name", "employee_id", "holiday_status_id",
  "number_of_days", "state", "date_from", "date_to",
];

export async function fetchLeaveAllocations(employeeId?: number): Promise<OdooLeaveAllocation[]> {
  const domain: unknown[] = employeeId ? [["employee_id", "=", employeeId]] : [];
  return executeKw<OdooLeaveAllocation[]>("hr.leave.allocation", "search_read", [domain], {
    fields: ALLOCATION_FIELDS,
    order: "id desc",
  });
}

export async function createLeaveAllocation(vals: Record<string, unknown>): Promise<number> {
  return executeKw<number>("hr.leave.allocation", "create", [vals]);
}

export async function forceValidateAllocation(id: number): Promise<boolean> {
  // Try action_validate; fall back to direct write if it fails
  try {
    return await executeKw<boolean>("hr.leave.allocation", "action_validate", [[id]]);
  } catch {
    try {
      return await executeKw<boolean>("hr.leave.allocation", "write", [[id], { state: "validate" }]);
    } catch {
      return false;
    }
  }
}

export async function validateAllocation(id: number): Promise<boolean> {
  return forceValidateAllocation(id);
}

// ─── Payslips ──────────────────────────────────────────────────────────────

const PAYSLIP_FIELDS = [
  "id", "name", "number", "employee_id", "date_from", "date_to",
  "state", "company_id", "struct_id", "basic_wage", "net_wage", "gross_wage",
];

export async function fetchPayslips(employeeId?: number): Promise<OdooPayslip[]> {
  const cacheKey = `payslips:${employeeId ?? 'all'}`;
  const domain: unknown[] = employeeId ? [["employee_id", "=", employeeId]] : [];
  return cachedFetch(cacheKey, () => executeKw<OdooPayslip[]>("hr.payslip", "search_read", [domain], {
    fields: PAYSLIP_FIELDS,
    order: "date_from desc",
  }));
}

export async function createPayslip(vals: Record<string, unknown>): Promise<number> {
  return executeKw<number>("hr.payslip", "create", [vals]);
}

// ─── Attendance ────────────────────────────────────────────────────────────

const ATTENDANCE_FIELDS = [
  "id", "employee_id", "check_in", "check_out", "worked_hours",
];

export async function fetchAttendance(employeeId?: number, limit = 50): Promise<OdooAttendance[]> {
  const cacheKey = `attendance:${employeeId ?? 'all'}:${limit}`;
  const domain: unknown[] = employeeId ? [["employee_id", "=", employeeId]] : [];
  return cachedFetch(cacheKey, () => executeKw<OdooAttendance[]>("hr.attendance", "search_read", [domain], {
    fields: ATTENDANCE_FIELDS,
    order: "check_in desc",
    limit,
  }));
}

// ─── Bonus & Fines (bonus.fine model) ────────────────────────────────────────

export interface OdooBonusFine {
  id: number;
  name: string;
  date: string;
  employee_id: OdooM2O;
  type_id: OdooM2O;
  type_class: string; // 'bonus' | 'fine'
  category: string;
  topic: string | false;
  days: number;
  daily_rate: number;
  final_amount: number;
  state: string;
  company_id: OdooM2O;
  details: string | false;
}

const BONUS_FINE_FIELDS = [
  "id", "name", "date", "employee_id", "type_id", "type_class",
  "category", "topic", "days", "daily_rate", "final_amount",
  "state", "company_id", "details",
];

export interface OdooBonusFineType {
  id: number;
  name: string;
  type_class: string; // 'bonus' | 'fine'
}

export async function fetchBonusFineTypes(): Promise<OdooBonusFineType[]> {
  return cachedFetch("bonusFineTypes", () => executeKw<OdooBonusFineType[]>("bonus.fine.type", "search_read", [[]], {
    fields: ["id", "name", "type_class"],
    order: "name asc",
  }));
}

export async function createBonusFine(vals: Record<string, unknown>): Promise<number> {
  return executeKw<number>("bonus.fine", "create", [vals]);
}

export async function fetchBonusFines(employeeId?: number, companyId?: number, limit = 200): Promise<OdooBonusFine[]> {
  const cacheKey = `bonusFines:${employeeId ?? 'all'}:${companyId ?? 'all'}:${limit}`;
  const domain: unknown[][] = [];
  if (employeeId) domain.push(["employee_id", "=", employeeId]);
  if (companyId) domain.push(["company_id", "=", companyId]);
  return cachedFetch(cacheKey, () => executeKw<OdooBonusFine[]>("bonus.fine", "search_read", [domain], {
    fields: BONUS_FINE_FIELDS,
    order: "date desc",
    limit,
  }));
}

// ─── Expenses (hr.expense) ────────────────────────────────────────────────────

const EXPENSE_FIELDS = [
  "id", "name", "employee_id", "total_amount", "state",
  "date", "company_id", "product_id", "description",
];

export async function fetchExpenses(employeeId?: number, companyId?: number, limit = 100): Promise<OdooExpense[]> {
  const cacheKey = `expenses:${employeeId ?? 'all'}:${companyId ?? 'all'}:${limit}`;
  const domain: unknown[][] = [];
  if (employeeId) domain.push(["employee_id", "=", employeeId]);
  if (companyId) domain.push(["company_id", "=", companyId]);
  return cachedFetch(cacheKey, () => executeKw<OdooExpense[]>("hr.expense", "search_read", [domain], {
    fields: EXPENSE_FIELDS,
    order: "date desc",
    limit,
  }));
}

// ─── Dashboard Stats ───────────────────────────────────────────────────────

export interface HRDashboardStats {
  totalEmployees: number;
  departments: OdooDepartment[];
  leaveTypes: OdooLeaveType[];
  pendingLeaves: number;
  totalExpenses: number;
  recentExpenses: OdooExpense[];
  presentCount: number;
  absentCount: number;
}

export async function fetchHRDashboardStats(companyId?: number): Promise<HRDashboardStats> {
  const cacheKey = `dashboardStats:${companyId ?? 'all'}`;
  return cachedFetch(cacheKey, async () => {
    // Fetch departments, leave types, and a small leave count in parallel.
    const [departments, leaveTypes, allLeaves, expenses] = await Promise.all([
      fetchDepartments(companyId),
      fetchLeaveTypes(),
      fetchLeaves(undefined, companyId),
      fetchExpenses(undefined, companyId, 20),
    ]);
    const employees = await fetchEmployees(companyId);
    const presentCount = employees.filter(e =>
      e.hr_presence_state === "present" || e.attendance_state === "checked_in"
    ).length;
    const pendingLeaves = allLeaves.filter(l => l.state === "confirm" || l.state === "validate1").length;
    return {
      totalEmployees: employees.length,
      departments,
      leaveTypes,
      pendingLeaves,
      totalExpenses: expenses.length,
      recentExpenses: expenses.slice(0, 10),
      presentCount,
      absentCount: employees.length - presentCount,
    };
  });
}

// ─── Periodic Meetings (periodic.meeting) ──────────────────────────────────

export interface OdooPeriodicMeeting {
  id: number;
  name: string;
  meeting_date: string;
  meeting_type: string; // 'weekly' | 'adhoc' | ...
  topic: string | false;
  details: string | false;
  attendee_ids: number[];
  attendee_count: number;
  state: string; // 'draft' | 'done'
  company_id: [number, string] | false;
  user_id: [number, string] | false;
  action_ids: number[];
  action_count: number;
}

/**
 * Fetch periodic meetings, optionally filtered by company, year, month, and type.
 * Attendee IDs are employee IDs from hr.employee.
 */
export async function fetchPeriodicMeetings(opts: {
  companyId?: number;
  year?: number;
  month?: number;
  meetingType?: string; // 'weekly' | 'adhoc'
  limit?: number;
} = {}): Promise<OdooPeriodicMeeting[]> {
  const domain: unknown[] = [];
  if (opts.companyId) domain.push(["company_id", "=", opts.companyId]);
  if (opts.meetingType) domain.push(["meeting_type", "=", opts.meetingType]);
  if (opts.year && opts.month) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const from = `${opts.year}-${pad(opts.month)}-01`;
    // last day of month
    const lastDay = new Date(opts.year, opts.month, 0).getDate();
    const to = `${opts.year}-${pad(opts.month)}-${lastDay}`;
    domain.push(["meeting_date", ">=", from]);
    domain.push(["meeting_date", "<=", to]);
  } else if (opts.year) {
    domain.push(["meeting_date", ">=", `${opts.year}-01-01`]);
    domain.push(["meeting_date", "<=", `${opts.year}-12-31`]);
  }

  const cacheKey = "meetings:" + (opts.companyId ?? 0) + ":" + (opts.year ?? 0) + ":" + (opts.month ?? 0) + ":" + (opts.meetingType ?? "none") + ":" + (opts.limit ?? 200);
  return cachedFetch(cacheKey, () => executeKw<OdooPeriodicMeeting[]>("periodic.meeting", "search_read", [domain], {
    fields: [
      "id", "name", "meeting_date", "meeting_type", "topic", "details",
      "attendee_ids", "attendee_count", "state", "company_id", "user_id",
      "action_ids", "action_count",
    ],
    order: "meeting_date asc",
    limit: opts.limit || 200,
  }));
}

// ─── Periodic Meeting Action type ────────────────────────────────────────────
export interface OdooMeetingAction {
  id: number;
  sequence: number;
  meeting_id: [number, string];
  name: string;
  assigned_to: [number, string] | false;
  due_date: string | false;
  status: "pending" | "in_progress" | "done" | "cancelled";
  notes: string | false;
  create_date: string;
  write_date: string;
}

export interface OdooPeriodicMeetingDetail extends OdooPeriodicMeeting {
  details: string | false;
  actions: OdooMeetingAction[];
}

/**
 * Fetch a single periodic meeting with full details including action points.
 */
export async function fetchPeriodicMeetingDetail(id: number): Promise<OdooPeriodicMeetingDetail> {
  const meetings = await executeKw<OdooPeriodicMeeting[]>(
    "periodic.meeting", "search_read", [[["id", "=", id]]], {
      fields: [
        "id", "name", "meeting_date", "meeting_type", "topic", "details",
        "attendee_ids", "attendee_count", "state", "company_id", "user_id",
        "action_ids", "action_count",
      ],
      limit: 1,
    });
  if (!meetings.length) throw new Error(`Meeting ${id} not found`);
  const meeting = meetings[0] as OdooPeriodicMeetingDetail;

  // Fetch action points separately
  if (meeting.action_ids && meeting.action_ids.length > 0) {
    const actions = await executeKw<OdooMeetingAction[]>(
      "periodic.meeting.action", "search_read",
      [[["meeting_id", "=", id]]], {
        fields: ["id", "sequence", "meeting_id", "name", "assigned_to", "due_date", "status", "notes", "create_date", "write_date"],
        order: "sequence asc",
      });
    meeting.actions = actions;
  } else {
    meeting.actions = [];
  }
  return meeting;
}

/**
 * Create a new periodic meeting in Odoo.
 * Returns the new meeting ID.
 */
export async function createPeriodicMeeting(vals: {
  meeting_date: string;       // YYYY-MM-DD
  meeting_type: "weekly" | "daily" | "adhoc";
  topic: string;
  details?: string;
  company_id?: number;
  attendee_ids?: number[];    // hr.employee IDs
  action_points?: Array<{
    name: string;
    assigned_to?: number;     // hr.employee ID
    due_date?: string;        // YYYY-MM-DD
    notes?: string;
  }>;
}): Promise<number> {
  const createVals: Record<string, unknown> = {
    meeting_date: vals.meeting_date,
    meeting_type: vals.meeting_type,
    topic: vals.topic,
  };
  if (vals.details) createVals.details = vals.details;
  if (vals.company_id) createVals.company_id = vals.company_id;
  if (vals.attendee_ids && vals.attendee_ids.length > 0) {
    createVals.attendee_ids = vals.attendee_ids.map(id => [4, id]);
  }
  if (vals.action_points && vals.action_points.length > 0) {
    createVals.action_ids = vals.action_points.map(ap => {
      const apVals: Record<string, unknown> = { name: ap.name, status: "pending" };
      if (ap.assigned_to) apVals.assigned_to = ap.assigned_to;
      if (ap.due_date) apVals.due_date = ap.due_date;
      if (ap.notes) apVals.notes = ap.notes;
      return [0, 0, apVals];
    });
  }
  return executeKw<number>("periodic.meeting", "create", [createVals]);
}

/**
 * Update the status (and optionally notes) of a meeting action point.
 */
export async function updateMeetingActionStatus(
  actionId: number,
  status: "pending" | "in_progress" | "done" | "cancelled",
  notes?: string,
): Promise<boolean> {
  const vals: Record<string, unknown> = { status };
  if (notes !== undefined) vals.notes = notes;
  return executeKw<boolean>("periodic.meeting.action", "write", [[actionId], vals]);
}

/**
 * Mark a periodic meeting as done, draft, or cancelled.
 */
export async function updateMeetingState(
  meetingId: number,
  state: "draft" | "done" | "cancelled",
): Promise<boolean> {
  return executeKw<boolean>("periodic.meeting", "write", [[meetingId], { state }]);
}

/**
 * Fetch all action points across all periodic meetings (for the efficiency dashboard).
 * Returns every periodic.meeting.action record with its parent meeting info.
 */
export async function getMeetingActions(opts?: {
  dateFrom?: string; // ISO date YYYY-MM-DD
  dateTo?: string;
}): Promise<
  Array<{
    id: number;
    name: string;
    sequence: number;
    status: string;
    dueDate: string | null;
    notes: string | null;
    assignedTo: { id: number; name: string } | null;
    meeting: {
      id: number;
      ref: string;
      date: string | null;
      topic: string | null;
      type: string;
    };
  }>
> {
  const domain: unknown[] = [];
  if (opts?.dateFrom || opts?.dateTo) {
    // Filter by the parent meeting's date
    if (opts?.dateFrom) domain.push(["meeting_id.meeting_date", ">=", opts.dateFrom]);
    if (opts?.dateTo) domain.push(["meeting_id.meeting_date", "<=", opts.dateTo]);
  }

  const records = await executeKw<
    Array<{
      id: number;
      name: string;
      sequence: number;
      status: string;
      due_date: string | false;
      notes: string | false;
      assigned_to: [number, string] | false;
      meeting_id: [number, string] | false;
    }>
  >("periodic.meeting.action", "search_read", [domain], {
    fields: ["id", "name", "sequence", "status", "due_date", "notes", "assigned_to", "meeting_id"],
    limit: 2000,
    order: "meeting_id desc, sequence asc",
  });

  // Fetch parent meeting dates and topics in one batch
  const meetingIds = [...new Set(records.map((r) => (r.meeting_id ? r.meeting_id[0] : null)).filter(Boolean))] as number[];
  let meetingMap: Record<number, { date: string | null; topic: string | null; type: string }> = {};
  if (meetingIds.length > 0) {
    const meetings = await executeKw<
      Array<{ id: number; meeting_date: string | false; topic: string | false; meeting_type: string }>
    >("periodic.meeting", "search_read", [[["id", "in", meetingIds]]], {
      fields: ["id", "meeting_date", "topic", "meeting_type"],
      limit: 500,
    });
    meetings.forEach((m) => {
      meetingMap[m.id] = {
        date: m.meeting_date || null,
        topic: m.topic || null,
        type: m.meeting_type || "weekly",
      };
    });
  }

  return records.map((r) => {
    const meetingId = r.meeting_id ? r.meeting_id[0] : null;
    const meetingRef = r.meeting_id ? r.meeting_id[1] : null;
    const meetingInfo = meetingId ? meetingMap[meetingId] : null;
    return {
      id: r.id,
      name: r.name || "",
      sequence: r.sequence || 0,
      status: r.status || "pending",
      dueDate: r.due_date || null,
      notes: r.notes || null,
      assignedTo: r.assigned_to ? { id: r.assigned_to[0], name: r.assigned_to[1] } : null,
      meeting: {
        id: meetingId ?? 0,
        ref: meetingRef ?? "",
        date: meetingInfo?.date ?? null,
        topic: meetingInfo?.topic ?? null,
        type: meetingInfo?.type ?? "weekly",
      },
    };
  });
}

// ─── Employee Attachments & Photo ─────────────────────────────────────────

export async function uploadEmployeeAttachment(params: {
  employeeId: number;
  name: string;
  data: string; // base64
  description?: string;
  mimeType?: string;
}): Promise<number> {
  const vals: Record<string, unknown> = {
    name: params.name,
    datas: params.data,
    res_model: 'hr.employee',
    res_id: params.employeeId,
    type: 'binary',
    mimetype: params.mimeType || 'application/octet-stream',
  };
  if (params.description) vals.description = params.description;
  return executeKw<number>('ir.attachment', 'create', [vals]);
}

export async function fetchEmployeeAttachments(employeeId: number): Promise<{
  id: number; name: string; mimeType: string; size: number;
  uploadedAt: string; description: string; uploadedBy: string;
}[]> {
  const docs = await executeKw<any[]>(
    'ir.attachment', 'search_read',
    [[['res_model', '=', 'hr.employee'], ['res_id', '=', employeeId]]],
    { fields: ['id', 'name', 'mimetype', 'file_size', 'create_date', 'description', 'create_uid'], order: 'create_date desc' }
  );
  return docs.map(d => ({
    id: d.id,
    name: d.name || '',
    mimeType: d.mimetype || 'application/octet-stream',
    size: d.file_size || 0,
    uploadedAt: d.create_date || '',
    description: Array.isArray(d.description) ? '' : (d.description || ''),
    uploadedBy: Array.isArray(d.create_uid) ? d.create_uid[1] : String(d.create_uid || ''),
  }));
}

export async function deleteEmployeeAttachment(attachmentId: number): Promise<boolean> {
  return executeKw<boolean>('ir.attachment', 'unlink', [[attachmentId]]);
}

export async function updateEmployeeImage(employeeId: number, imageBase64: string): Promise<boolean> {
  const ok = await executeKw<boolean>('hr.employee', 'write', [[employeeId], { image_1920: imageBase64 }]);
  clearHRCache();
  return ok;
}

export async function getAttachmentData(attachmentId: number): Promise<string> {
  const result = await executeKw<any[]>(
    'ir.attachment', 'read', [[attachmentId]], { fields: ['datas', 'name', 'mimetype'] }
  );
  if (!result || result.length === 0) throw new Error('Attachment not found');
  return result[0].datas || '';
}


/**
 * Update editable fields of an existing periodic meeting.
 */
export async function updatePeriodicMeeting(
  id: number,
  vals: {
    meeting_date?: string;
    meeting_type?: "weekly" | "daily" | "adhoc";
    topic?: string;
    details?: string;
    company_id?: number;
    attendee_ids?: number[];
  },
): Promise<boolean> {
  const writeVals: Record<string, unknown> = {};
  if (vals.meeting_date !== undefined) writeVals.meeting_date = vals.meeting_date;
  if (vals.meeting_type !== undefined) writeVals.meeting_type = vals.meeting_type;
  if (vals.topic !== undefined) writeVals.topic = vals.topic;
  if (vals.details !== undefined) writeVals.details = vals.details || false;
  if (vals.company_id !== undefined) writeVals.company_id = vals.company_id;
  if (vals.attendee_ids !== undefined) writeVals.attendee_ids = [[6, 0, vals.attendee_ids]];
  return executeKw<boolean>("periodic.meeting", "write", [[id], writeVals]);
}

/**
 * Add a single action point to an existing periodic meeting.
 * Returns the new action point ID.
 */
export async function addMeetingActionPoint(
  meetingId: number,
  vals: {
    name: string;
    assigned_to?: number;
    due_date?: string;
    notes?: string;
  },
): Promise<number> {
  const createVals: Record<string, unknown> = {
    meeting_id: meetingId,
    name: vals.name,
  };
  if (vals.assigned_to) createVals.assigned_to = vals.assigned_to;
  if (vals.due_date) createVals.due_date = vals.due_date;
  if (vals.notes) createVals.notes = vals.notes;
  return executeKw<number>("periodic.meeting.action", "create", [createVals]);
}

/**
 * Update editable details of an existing meeting action point.
 */
export async function updateMeetingActionDetails(
  actionId: number,
  vals: {
    name?: string;
    assigned_to?: number | null;
    due_date?: string | null;
    notes?: string | null;
    status?: "pending" | "in_progress" | "done" | "cancelled";
  },
): Promise<boolean> {
  const writeVals: Record<string, unknown> = {};
  if (vals.name !== undefined) writeVals.name = vals.name;
  if (vals.assigned_to !== undefined) writeVals.assigned_to = vals.assigned_to || false;
  if (vals.due_date !== undefined) writeVals.due_date = vals.due_date || false;
  if (vals.notes !== undefined) writeVals.notes = vals.notes || false;
  if (vals.status !== undefined) writeVals.status = vals.status;
  return executeKw<boolean>("periodic.meeting.action", "write", [[actionId], writeVals]);
}

export async function approveBonusFine(id: number): Promise<boolean> {
  const ok = await executeKw<boolean>("bonus.fine", "write", [[id], { state: "approved" }]);
  clearHRCache();
  return ok;
}

export async function refuseBonusFine(id: number): Promise<boolean> {
  const ok = await executeKw<boolean>("bonus.fine", "write", [[id], { state: "refused" }]);
  clearHRCache();
  return ok;
}
