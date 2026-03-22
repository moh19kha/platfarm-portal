/**
 * Odoo Finance Module API Service
 *
 * Provides read operations for accounting models:
 * - account.journal (bank journals)
 * - account.move.line (journal entries — receivables, payables, expenses, SOA)
 * - account.move (invoices/bills)
 * - account.account (chart of accounts)
 * - res.partner (customers/suppliers)
 *
 * Uses the same stateless execute_kw pattern as odoo-inventory.ts
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

export interface OdooJournal {
  id: number;
  name: string;
  type: string;
  code: string;
  company_id: OdooM2O;
  currency_id: OdooM2O;
  default_account_id: OdooM2O;
}

export interface OdooMoveLine {
  id: number;
  move_id: OdooM2O;
  account_id: OdooM2O;
  partner_id: OdooM2O;
  name: string;
  ref: string | false;
  date: string;
  date_maturity: string | false;
  debit: number;
  credit: number;
  balance: number;
  amount_currency: number;
  currency_id: OdooM2O;
  journal_id: OdooM2O;
  company_id: OdooM2O;
  reconciled: boolean;
  full_reconcile_id: OdooM2O;
  move_type: string;
  parent_state: string;
}

export interface OdooMove {
  id: number;
  name: string;
  move_type: string;
  partner_id: OdooM2O;
  invoice_date: string | false;
  invoice_date_due: string | false;
  date: string;
  state: string;
  amount_total: number;
  amount_residual: number;
  amount_untaxed: number;
  currency_id: OdooM2O;
  company_id: OdooM2O;
  payment_state: string;
  ref: string | false;
  invoice_origin: string | false;
}

export interface OdooAccount {
  id: number;
  name: string;
  code: string;
  account_type: string;
  company_id: OdooM2O;
  group_id: OdooM2O;
}

export interface OdooPartner {
  id: number;
  name: string;
  customer_rank: number;
  supplier_rank: number;
  company_id: OdooM2O;
}

// ─── Auth ──────────────────────────────────────────────────────────────────

let _uidPromise: Promise<number> | null = null;

function getUid(): Promise<number> {
  if (!_uidPromise) {
    _uidPromise = odooClient
      .post("/jsonrpc", {
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "common",
          method: "authenticate",
          args: [ODOO_DB, ODOO_USER, ODOO_PASSWORD, {}],
        },
      })
      .then((r) => {
        if (!r.data.result) throw new Error("Odoo auth failed");
        return r.data.result as number;
      });
  }
  return _uidPromise;
}

// ─── Generic RPC ───────────────────────────────────────────────────────────

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
        throw new Error(`Odoo RPC error (${model}.${method}): ${res.data.error.data?.message || JSON.stringify(res.data.error)}`);
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
  throw new Error("executeKw: exhausted retries");
}

// ─── Field Lists ───────────────────────────────────────────────────────────

const JOURNAL_FIELDS = [
  "id", "name", "type", "code", "company_id", "currency_id", "default_account_id",
];

const MOVE_LINE_FIELDS = [
  "id", "move_id", "account_id", "partner_id", "name", "ref",
  "date", "date_maturity", "debit", "credit", "balance",
  "amount_currency", "currency_id", "journal_id", "company_id",
  "reconciled", "full_reconcile_id", "move_type", "parent_state",
];

const MOVE_FIELDS = [
  "id", "name", "move_type", "partner_id", "invoice_date",
  "invoice_date_due", "date", "state", "amount_total",
  "amount_residual", "amount_untaxed", "currency_id", "company_id",
  "payment_state", "ref", "invoice_origin",
];

const ACCOUNT_FIELDS = [
  "id", "name", "code", "account_type", "group_id",
];

const PARTNER_FIELDS = [
  "id", "name", "customer_rank", "supplier_rank", "company_id",
];

// ─── Fetch Functions ───────────────────────────────────────────────────────

/**
 * Fetch bank journals (type = bank or cash).
 */
export async function fetchBankJournals(companyId?: number): Promise<OdooJournal[]> {
  const domain: any[] = [["type", "in", ["bank", "cash"]]];
  if (companyId) domain.push(["company_id", "=", companyId]);
  return executeKw<OdooJournal[]>("account.journal", "search_read", [domain], {
    fields: JOURNAL_FIELDS,
  });
}

/**
 * Fetch journal entries (account.move.line) with flexible filtering.
 */
export async function fetchMoveLines(
  domain: any[],
  limit = 1000,
  order = "date desc, id desc"
): Promise<OdooMoveLine[]> {
  return executeKw<OdooMoveLine[]>("account.move.line", "search_read", [
    [["parent_state", "=", "posted"], ...domain]
  ], {
    fields: MOVE_LINE_FIELDS,
    limit,
    order,
  });
}

/**
 * Fetch invoices/bills (account.move) with flexible filtering.
 */
export async function fetchMoves(
  domain: any[],
  limit = 500,
  order = "date desc, id desc"
): Promise<OdooMove[]> {
  return executeKw<OdooMove[]>("account.move", "search_read", [
    [["state", "=", "posted"], ...domain]
  ], {
    fields: MOVE_FIELDS,
    limit,
    order,
  });
}

/**
 * Fetch ALL invoices/bills (account.move) using pagination — no record limit.
 * Use this when the total count may exceed a single-page limit (e.g. payables with 3,000+ bills).
 */
export async function fetchMovesAll(
  domain: any[],
  order = "id asc"
): Promise<OdooMove[]> {
  const PAGE_SIZE = 1000;
  const fullDomain = [["state", "=", "posted"], ...domain];
  const results: OdooMove[] = [];
  let offset = 0;
  while (true) {
    const page = await executeKw<OdooMove[]>("account.move", "search_read", [fullDomain], {
      fields: MOVE_FIELDS,
      limit: PAGE_SIZE,
      offset,
      order,
    });
    results.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return results;
}

/**
 * Fetch chart of accounts.
 */
export async function fetchAccounts(companyId?: number): Promise<OdooAccount[]> {
  const domain: any[] = [];
  // Note: account.account doesn't have company_id field in this Odoo instance
  return executeKw<OdooAccount[]>("account.account", "search_read", [domain], {
    fields: ACCOUNT_FIELDS,
  });
}

/**
 * Fetch partners (customers and/or suppliers).
 */
export async function fetchPartners(
  type?: "customer" | "supplier" | "both",
  companyId?: number
): Promise<OdooPartner[]> {
  const domain: any[] = [];
  if (type === "customer") domain.push(["customer_rank", ">", 0]);
  else if (type === "supplier") domain.push(["supplier_rank", ">", 0]);
  else if (type === "both") domain.push("|", ["customer_rank", ">", 0], ["supplier_rank", ">", 0]);
  if (companyId) domain.push(["company_id", "=", companyId]);
  return executeKw<OdooPartner[]>("res.partner", "search_read", [domain], {
    fields: PARTNER_FIELDS,
    limit: 200,
  });
}

// ─── Receivables: Open invoices with aging ─────────────────────────────────

export async function fetchOpenReceivables(companyId?: number): Promise<OdooMove[]> {
  const domain: any[] = [
    ["move_type", "in", ["out_invoice", "out_refund"]],
    ["payment_state", "in", ["not_paid", "partial"]],
  ];
  if (companyId) domain.push(["company_id", "=", companyId]);
  return fetchMoves(domain, 500, "invoice_date_due asc");
}

// ─── Payables: Open bills with aging ───────────────────────────────────────
// Uses pagination to fetch ALL open bills — previously capped at 2,000 which
// caused Platfarm's 3,270+ open bills to be severely underreported.
export async function fetchOpenPayables(companyId?: number): Promise<OdooMove[]> {
  const domain: any[] = [
    ["move_type", "in", ["in_invoice", "in_refund"]],
    ["payment_state", "in", ["not_paid", "partial"]],
  ];
  if (companyId) domain.push(["company_id", "=", companyId]);
  return fetchMovesAll(domain, "invoice_date_due asc");
}

// ─── Cash Flow: Bank/cash journal entries in a date range ──────────────────

export async function fetchCashFlowLines(
  companyId?: number,
  dateFrom?: string,
  dateTo?: string
): Promise<OdooMoveLine[]> {
  // IMPORTANT: Filter by account_type = asset_cash (or liability_credit_card) to get
  // only the bank/cash account side of each journal entry.
  // Without this filter, double-entry counterpart lines are included, making
  // total debits always equal total credits (inflows = outflows = wrong).
  const domain: any[] = [
    ["journal_id.type", "in", ["bank", "cash"]],
    ["account_id.account_type", "in", ["asset_cash", "liability_credit_card"]],
  ];
  if (companyId) domain.push(["company_id", "=", companyId]);
  if (dateFrom) domain.push(["date", ">=", dateFrom]);
  if (dateTo) domain.push(["date", "<=", dateTo]);
  return fetchMoveLines(domain, 5000, "date asc, id asc");
}

// ─── Expense Lines: Expense account entries in a date range ────────────────

export async function fetchExpenseLines(
  companyId?: number,
  dateFrom?: string,
  dateTo?: string
): Promise<OdooMoveLine[]> {
  const domain: any[] = [
    ["account_id.account_type", "in", ["expense", "expense_depreciation", "expense_direct_cost"]],
    ["debit", ">", 0],
  ];
  if (companyId) domain.push(["company_id", "=", companyId]);
  if (dateFrom) domain.push(["date", ">=", dateFrom]);
  if (dateTo) domain.push(["date", "<=", dateTo]);
  return fetchMoveLines(domain, 2000, "date asc, id asc");
}

// ─── SOA: Partner ledger entries ───────────────────────────────────────────

export async function fetchPartnerLedger(
  partnerId: number,
  accountType: "receivable" | "payable",
  companyId?: number,
  dateFrom?: string,
  dateTo?: string
): Promise<OdooMoveLine[]> {
  const domain: any[] = [
    ["partner_id", "=", partnerId],
    ["account_id.account_type", "=", accountType === "receivable" ? "asset_receivable" : "liability_payable"],
  ];
  if (companyId) domain.push(["company_id", "=", companyId]);
  if (dateFrom) domain.push(["date", ">=", dateFrom]);
  if (dateTo) domain.push(["date", "<=", dateTo]);
  return fetchMoveLines(domain, 500, "date asc, id asc");
}

// ─── Export Fees: Specific account code entries ────────────────────────────

export async function fetchAccountCodeLines(
  accountCode: string,
  companyId?: number,
  dateFrom?: string,
  dateTo?: string
): Promise<OdooMoveLine[]> {
  // First try to find the account by code. In some Odoo setups the code field
  // may be false/null (e.g. "Cost Of Sale - Export Fees Charges" has code=false).
  // Fall back to a name-based lookup using the well-known account name.
  const EXPORT_FEES_ACCOUNT_ID = 4672; // "Cost Of Sale - Export Fees Charges"
  const EXPORT_FEES_CODE = "51010403";

  let accountFilter: any[];
  if (accountCode === EXPORT_FEES_CODE) {
    // Use the known account ID directly — code lookup fails for this account
    accountFilter = [["account_id", "=", EXPORT_FEES_ACCOUNT_ID]];
  } else {
    accountFilter = [["account_id.code", "=like", `${accountCode}%`]];
  }

  const domain: any[] = [
    ...accountFilter,
    ["debit", ">", 0],
    ["parent_state", "=", "posted"],
  ];
  if (companyId) domain.push(["company_id", "=", companyId]);
  if (dateFrom) domain.push(["date", ">=", dateFrom]);
  if (dateTo) domain.push(["date", "<=", dateTo]);
  return fetchMoveLines(domain, 2000, "date desc, id desc");
}

// ─── Revenue: Total revenue for DSO/DPO calculations ──────────────────────
// Uses read_group aggregation for accuracy — avoids any record-count limits.
export async function fetchRevenueTotal(
  companyId?: number,
  dateFrom?: string,
  dateTo?: string
): Promise<number> {
  const domain: any[] = [
    ["account_id.account_type", "in", ["income", "income_other"]],
    ["credit", ">", 0],
    ["parent_state", "=", "posted"],
  ];
  if (companyId) domain.push(["company_id", "=", companyId]);
  if (dateFrom) domain.push(["date", ">=", dateFrom]);
  if (dateTo) domain.push(["date", "<=", dateTo]);
  const groups = await executeKw<any[]>("account.move.line", "read_group", [domain, ["credit"], []]);
  return groups[0]?.credit ?? 0;
}
// ─── COGS: Cost of Goods Sold for DPO/CCC calculations ────────────────────
// Uses read_group aggregation for accuracy — avoids any record-count limits.
export async function fetchCOGSTotal(
  companyId?: number,
  dateFrom?: string,
  dateTo?: string
): Promise<number> {
  const domain: any[] = [
    ["account_id.account_type", "=", "expense_direct_cost"],
    ["debit", ">", 0],
    ["parent_state", "=", "posted"],
  ];
  if (companyId) domain.push(["company_id", "=", companyId]);
  if (dateFrom) domain.push(["date", ">=", dateFrom]);
  if (dateTo) domain.push(["date", "<=", dateTo]);
  const groups = await executeKw<any[]>("account.move.line", "read_group", [domain, ["debit"], []]);
  return groups[0]?.debit ?? 0;
}

// ─── Bank Balances: Get current balances from bank journals ────────────────
// Uses Odoo's kanban_dashboard JSON field which contains `account_balance` —
// this is the EXACT same value displayed on Odoo's Accounting Dashboard.
// The account_balance is a computed field that Odoo calculates internally,
// ensuring our portal always matches what users see in Odoo.

export async function fetchBankBalances(companyId?: number): Promise<Array<{
  journalId: number;
  journalName: string;
  journalCode: string;
  balance: number;
  currency: string;
  companyId: number;
  companyName: string;
}>> {
  const domain: any[] = [["type", "in", ["bank", "cash"]]];
  if (companyId) domain.push(["company_id", "=", companyId]);

  // Fetch journals with kanban_dashboard (contains account_balance) and basic info
  const journals = await executeKw<any[]>("account.journal", "search_read", [domain], {
    fields: [
      "id", "name", "code", "type", "company_id", "currency_id",
      "default_account_id", "kanban_dashboard",
    ],
  });

  if (journals.length === 0) return [];

  return journals.map((j: any) => {
    const currency = j.currency_id ? (j.currency_id as [number, string])[1] : "EGP";
    const cId = j.company_id ? (j.company_id as [number, string])[0] : 0;
    const cName = j.company_id ? (j.company_id as [number, string])[1] : "Unknown";

    // Parse the kanban_dashboard JSON to extract account_balance
    let balance = 0;
    try {
      const dashboard = typeof j.kanban_dashboard === "string"
        ? JSON.parse(j.kanban_dashboard)
        : j.kanban_dashboard;
      if (dashboard && dashboard.account_balance) {
        // account_balance is a formatted string like "23,025.89 LE" or "$ 7,442.82"
        // Negative values use "-\uFEFF" prefix, e.g. "-\uFEFF30,750.00\u00A0LE"
        const origStr = String(dashboard.account_balance);
        const isNegative = origStr.includes("-");
        // Strip everything except digits, dots, and minus signs
        const balStr = origStr
          .replace(/[^\d.]/g, "");  // Keep only digits and dots
        const parsed = parseFloat(balStr);
        if (!isNaN(parsed)) {
          balance = isNegative ? -parsed : parsed;
        }
      }
    } catch {
      // If kanban_dashboard parsing fails, balance stays 0
    }

    return {
      journalId: j.id,
      journalName: j.name,
      journalCode: j.code,
      balance,
      currency,
      companyId: cId,
      companyName: cName,
    };
  });
}


// ─── Sales Analytics: Customer invoices with line details ──────────────────

export interface SalesInvoice {
  id: number;
  name: string;
  partner_id: [number, string] | false;
  invoice_date: string | false;
  amount_total: number;
  amount_untaxed: number;
  currency_id: [number, string] | false;
  company_id: [number, string] | false;
  state: string;
  invoice_line_ids: number[];
}

export interface SalesInvoiceLine {
  id: number;
  product_id: [number, string] | false;
  product_uom_id: [number, string] | false;
  quantity: number;
  price_subtotal: number;
  name: string;
  move_id: [number, string] | false;
}

/**
 * Fetch posted customer invoices within a date range for sales analytics.
 * Returns invoices with partner (customer) info and amounts.
 */
export async function fetchCustomerInvoicesForSales(
  dateFrom: string,
  dateTo: string,
  companyId?: number
): Promise<SalesInvoice[]> {
  const domain: any[] = [
    ["move_type", "=", "out_invoice"],
    ["state", "=", "posted"],
    ["invoice_date", ">=", dateFrom],
    ["invoice_date", "<=", dateTo],
  ];
  if (companyId) domain.push(["company_id", "=", companyId]);

  return executeKw<SalesInvoice[]>("account.move", "search_read", [domain], {
    fields: [
      "id", "name", "partner_id", "invoice_date", "amount_total",
      "amount_untaxed", "currency_id", "company_id", "state", "invoice_line_ids",
    ],
    limit: 5000,
    order: "invoice_date desc",
  });
}

/**
 * Fetch invoice line details for quantity/product info.
 */
export async function fetchInvoiceLines(lineIds: number[]): Promise<SalesInvoiceLine[]> {
  if (lineIds.length === 0) return [];
  return executeKw<SalesInvoiceLine[]>("account.move.line", "search_read",
    [[["id", "in", lineIds], ["display_type", "=", "product"]]],
    {
      fields: [
        "id", "product_id", "product_uom_id", "quantity",
        "price_subtotal", "name", "move_id",
      ],
    }
  );
}
