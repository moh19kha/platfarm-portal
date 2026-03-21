/**
 * Odoo Petty Cash & Expense Module API Service
 *
 * Provides operations for custom Odoo models:
 * - pf.petty.cash (transactions: top-ups, expense deductions, adjustments)
 * - pf.petty.cash.request (top-up requests from employees)
 * - hr.employee (lightweight fetch for PCE module)
 *
 * hr.expense.sheet is NOT used — Odoo is disconnected from accounts/banks.
 * Expense management is handled through pf.petty.cash (type=expense_deduction).
 *
 * Uses the same stateless execute_kw pattern as odoo-hr.ts
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
  timeout: 120000,
});

// ─── Types ─────────────────────────────────────────────────────────────────
type OdooM2O = [number, string] | false;


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

// ─── Core RPC Helper ───────────────────────────────────────────────────────
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
    } catch (err: any) {
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
  throw new Error("Unreachable");
}

// ─── NOTE: hr.expense.sheet removed ───────────────────────────────────────
// Expense management is now handled through pf.petty.cash (type=expense_deduction)
// Old hr.expense.sheet functions have been removed as Odoo is disconnected
// from accounts/banks (no ledger posting needed).

// ─── Petty Cash (pf.petty.cash) ──────────────────────────────────────────

export interface OdooPettyCash {
  id: number;
  name: string; // Reference
  employee_id: OdooM2O;
  amount: number;
  date: string;
  transaction_type: "top_up" | "expense_deduction" | "adjustment";
  state: "draft" | "confirmed" | "submitted" | "approved" | "paid" | "refused";
  balance_after: number;
  currency_id: OdooM2O;
  expense_sheet_id: OdooM2O;
  notes: string | false;
  reference: string | false;
  created_by: OdooM2O;
  create_date: string;
  write_date: string;
  message_attachment_count?: number;
}

const PC_FIELDS = [
  "id", "name", "employee_id", "amount", "date", "transaction_type",
  "state", "balance_after", "currency_id", "expense_sheet_id",
  "notes", "reference", "created_by", "create_date", "write_date",
];

export async function fetchPettyCashTransactions(
  employeeId?: number,
  companyId?: number,
  limit = 500
): Promise<OdooPettyCash[]> {
  const domain: unknown[][] = [];
  if (employeeId) domain.push(["employee_id", "=", employeeId]);
  // Filter by company through employee's company
  if (companyId) domain.push(["employee_id.company_id", "=", companyId]);
  return executeKw<OdooPettyCash[]>("pf.petty.cash", "search_read", [domain], {
    fields: PC_FIELDS,
    order: "date desc, id desc",
    limit,
  });
}

export async function fetchPettyCashByType(
  transactionType: "top_up" | "expense_deduction" | "adjustment",
  employeeId?: number,
  companyId?: number,
  state?: string,
  limit = 500
): Promise<OdooPettyCash[]> {
  const domain: unknown[][] = [["transaction_type", "=", transactionType]];
  if (employeeId) domain.push(["employee_id", "=", employeeId]);
  if (companyId) domain.push(["employee_id.company_id", "=", companyId]);
  if (state && state !== "all") domain.push(["state", "=", state]);
  return executeKw<OdooPettyCash[]>("pf.petty.cash", "search_read", [domain], {
    fields: [...PC_FIELDS, "message_attachment_count"],
    order: "date desc, id desc",
    limit,
  });
}

export async function fetchPettyCashById(id: number): Promise<OdooPettyCash | null> {
  const result = await executeKw<OdooPettyCash[]>("pf.petty.cash", "read", [[id]], {
    fields: PC_FIELDS,
  });
  return result?.[0] || null;
}

export async function createPettyCashTransaction(data: {
  employee_id: number;
  amount: number;
  date: string;
  transaction_type: "top_up" | "expense_deduction" | "adjustment";
  name: string;
  notes?: string;
  reference?: string;
  expense_sheet_id?: number;
}): Promise<number> {
  const vals: Record<string, unknown> = {
    employee_id: data.employee_id,
    amount: data.amount,
    date: data.date,
    transaction_type: data.transaction_type,
    name: data.name,
  };
  if (data.notes) vals.notes = data.notes;
  if (data.reference) vals.reference = data.reference;
  if (data.expense_sheet_id) vals.expense_sheet_id = data.expense_sheet_id;
  return executeKw<number>("pf.petty.cash", "create", [vals]);
}

export async function confirmPettyCashTransaction(id: number): Promise<boolean> {
  try {
    await executeKw("pf.petty.cash", "write", [[id], { state: "confirmed" }]);
    return true;
  } catch {
    return false;
  }
}

// ─── Expense State Transitions ────────────────────────────────────────────
// Expense deductions use: submitted → approved → paid (or refused)
// No Draft state — expenses go directly to "submitted" (Pending Review) on creation

export async function submitExpenseDeduction(id: number): Promise<boolean> {
  try {
    await executeKw("pf.petty.cash", "write", [[id], { state: "submitted" }]);
    return true;
  } catch {
    return false;
  }
}

export async function approveExpenseDeduction(id: number): Promise<boolean> {
  try {
    await executeKw("pf.petty.cash", "write", [[id], { state: "approved" }]);
    return true;
  } catch {
    return false;
  }
}

export async function payExpenseDeduction(id: number): Promise<boolean> {
  try {
    await executeKw("pf.petty.cash", "write", [[id], { state: "paid" }]);
    return true;
  } catch {
    return false;
  }
}

export async function refuseExpenseDeduction(id: number): Promise<boolean> {
  try {
    await executeKw("pf.petty.cash", "write", [[id], { state: "refused" }]);
    return true;
  } catch {
    return false;
  }
}

export async function resetExpenseDeduction(id: number): Promise<boolean> {
  try {
    // Reset to "submitted" (Pending Review) — expenses skip Draft entirely
    await executeKw("pf.petty.cash", "write", [[id], { state: "submitted" }]);
    return true;
  } catch {
    return false;
  }
}

export async function deletePettyCashTransaction(id: number): Promise<boolean> {
  try {
    await executeKw("pf.petty.cash", "unlink", [[id]]);
    return true;
  } catch {
    return false;
  }
}

// ─── Petty Cash Requests (pf.petty.cash.request) ────────────────────────

export interface OdooPettyCashRequest {
  id: number;
  name: string; // Auto-generated reference
  employee_id: OdooM2O;
  user_id: OdooM2O;
  requested_amount: number;
  approved_amount: number;
  currency_id: OdooM2O;
  reason: string;
  rejection_reason: string | false;
  state: "draft" | "submitted" | "approved" | "refused";
  client_ref: string | false;
  petty_cash_id: OdooM2O; // Resulting pf.petty.cash transaction
  reviewed_by: OdooM2O;
  reviewed_date: string | false;
  notes: string | false;
  create_date: string;
  write_date: string;
  message_attachment_count?: number;
}

const REQUEST_FIELDS = [
  "id", "name", "employee_id", "user_id", "requested_amount", "approved_amount",
  "currency_id", "reason", "rejection_reason", "state", "client_ref",
  "petty_cash_id", "reviewed_by", "reviewed_date", "notes",
  "create_date", "write_date", "message_attachment_count",
];

export async function fetchPettyCashRequests(
  companyId?: number,
  state?: string,
  limit = 500
): Promise<OdooPettyCashRequest[]> {
  const domain: unknown[][] = [];
  if (companyId) domain.push(["employee_id.company_id", "=", companyId]);
  if (state && state !== "all") domain.push(["state", "=", state]);
  return executeKw<OdooPettyCashRequest[]>("pf.petty.cash.request", "search_read", [domain], {
    fields: REQUEST_FIELDS,
    order: "create_date desc",
    limit,
  });
}

export async function fetchPettyCashRequestById(id: number): Promise<OdooPettyCashRequest | null> {
  const result = await executeKw<OdooPettyCashRequest[]>("pf.petty.cash.request", "read", [[id]], {
    fields: REQUEST_FIELDS,
  });
  return result?.[0] || null;
}

export async function createPettyCashRequest(data: {
  employee_id: number;
  requested_amount: number;
  reason: string;
  notes?: string;
}): Promise<number> {
  const vals: Record<string, unknown> = {
    employee_id: data.employee_id,
    requested_amount: data.requested_amount,
    reason: data.reason,
    state: "submitted", // Default to submitted (pending review)
  };
  if (data.notes) vals.notes = data.notes;
  return executeKw<number>("pf.petty.cash.request", "create", [vals]);
}

export async function approvePettyCashRequest(id: number, approvedAmount: number): Promise<boolean> {
  try {
    // Set approved_amount first, then call the Odoo workflow action
    // action_approve auto-creates a pf.petty.cash top-up transaction
    await executeKw("pf.petty.cash.request", "write", [[id], {
      approved_amount: approvedAmount,
    }]);
    await executeKw("pf.petty.cash.request", "action_approve", [[id]]);
    return true;
  } catch {
    return false;
  }
}

export async function refusePettyCashRequest(id: number, rejectionReason: string): Promise<boolean> {
  try {
    // Set rejection_reason first, then call the Odoo workflow action
    await executeKw("pf.petty.cash.request", "write", [[id], {
      rejection_reason: rejectionReason,
    }]);
    await executeKw("pf.petty.cash.request", "action_refuse", [[id]]);
    return true;
  } catch {
    return false;
  }
}

// ─── Employees (lightweight fetch for PCE) ────────────────────────────────

export interface PCEEmployee {
  id: number;
  name: string;
  job_title: string | false;
  company_id: OdooM2O;
  department_id: OdooM2O;
}

export async function fetchPCEEmployees(companyId?: number): Promise<PCEEmployee[]> {
  const domain: unknown[][] = [["active", "=", true]];
  if (companyId) domain.push(["company_id", "=", companyId]);
  return executeKw<PCEEmployee[]>("hr.employee", "search_read", [domain], {
    fields: ["id", "name", "job_title", "company_id", "department_id"],
    order: "name asc",
    limit: 500,
  });
}
