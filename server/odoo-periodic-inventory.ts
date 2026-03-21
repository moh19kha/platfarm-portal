/**
 * Odoo Periodic Inventory API Helper
 *
 * Fetches data from `periodic.inventory` and `periodic.inventory.line` models.
 * These are manual inventory submissions from the team — reporting-only, no stock impact.
 *
 * Correct field names verified against live Odoo instance.
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

/** Raw periodic.inventory record from Odoo */
export interface OdooPeriodicInventory {
  id: number;
  name: string;                        // PINV/YYYY/MM/####
  date: string;                        // YYYY-MM-DD
  state: string;                       // draft | supervisor_review | accounting_review | done | cancelled
  warehouse_id: OdooM2O;
  location_id: OdooM2O;
  product_category_id: OdooM2O;
  grade: string | false;               // Standard | Grade 1 | Grade 2 | Grade 3
  reporting_unit: string;              // bales | tons | kg
  inventory_type: string;              // animal_fodder | ...
  total_products: number;
  total_quantity: number;
  requested_by: OdooM2O;
  supervisor_review_status: string;    // pending | approved | rejected
  supervisor_id: OdooM2O;
  supervisor_review_date: string | false;
  supervisor_notes: string | false;
  accounting_review_status: string;    // pending | approved | rejected
  accountant_id: OdooM2O;
  accounting_review_date: string | false;
  accounting_notes: string | false;
  company_id: OdooM2O;
  notes: string | false;
  line_ids: number[];
  create_date: string;
  write_date: string;
}

/** Raw periodic.inventory.line record from Odoo */
export interface OdooPeriodicInventoryLine {
  id: number;
  inventory_id: OdooM2O;
  product_tmpl_id: OdooM2O;           // product template name
  product_category_id: OdooM2O;
  product_grade: string | false;
  product_weight_range: string | false;
  counted_bales: number;
  counted_qty: number;                 // in kg
  product_uom_id: OdooM2O;
  theoretical_qty: number;
  difference_qty: number;
  state: string;
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
        params: { service: "common", method: "authenticate", args: [ODOO_DB, ODOO_USER, ODOO_PASSWORD, {}] },
      })
      .then((r) => {
        if (r.data.error) throw new Error(r.data.error.data.message);
        return r.data.result;
      })
      .catch((err) => { _uidPromise = null; throw err; });
  }
  return _uidPromise;
}

async function executeKw<T>(
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown> = {}
): Promise<T> {
  const uid = await getUid();
  const response = await odooClient.post("/jsonrpc", {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [ODOO_DB, uid, ODOO_PASSWORD, model, method, args, {
        ...kwargs,
        context: { ...(kwargs.context as object || {}), allowed_company_ids: ALLOWED_COMPANY_IDS },
      }],
    },
  });
  if (response.data.error) throw new Error(response.data.error.data?.message || response.data.error.message);
  return response.data.result;
}

// ─── Header fields used in all queries ────────────────────────────────────

const HEADER_FIELDS = [
  "id", "name", "date", "state",
  "warehouse_id", "location_id", "product_category_id",
  "grade", "reporting_unit", "inventory_type",
  "total_products", "total_quantity",
  "requested_by", "supervisor_review_status", "supervisor_id",
  "accounting_review_status", "accountant_id",
  "company_id", "notes", "line_ids",
];

const LINE_FIELDS = [
  "id", "inventory_id", "product_tmpl_id", "product_category_id",
  "product_grade", "product_weight_range",
  "counted_bales", "counted_qty", "product_uom_id",
  "theoretical_qty", "difference_qty", "state", "company_id",
];

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Get all unique submission dates (deduplicated, latest first).
 */
export async function fetchPeriodicInventoryDates(): Promise<string[]> {
  const records = await executeKw<{ date: string | false }[]>(
    "periodic.inventory",
    "search_read",
    [[]],
    { fields: ["date"], order: "date desc", limit: 1000 }
  );
  const seen = new Set<string>();
  const dates: string[] = [];
  for (const r of records) {
    if (r.date && !seen.has(r.date)) {
      seen.add(r.date);
      dates.push(r.date);
    }
  }
  return dates;
}

/**
 * Get all submissions for a specific date, with optional warehouse/location filter.
 */
export async function fetchPeriodicInventoryByDate(
  date: string,
  opts: { warehouseId?: number; locationId?: number } = {}
): Promise<OdooPeriodicInventory[]> {
  const domain: unknown[] = [["date", "=", date]];
  if (opts.warehouseId) domain.push(["warehouse_id", "=", opts.warehouseId]);
  if (opts.locationId) domain.push(["location_id", "=", opts.locationId]);

  return executeKw<OdooPeriodicInventory[]>(
    "periodic.inventory",
    "search_read",
    [domain],
    { fields: HEADER_FIELDS, order: "name asc" }
  );
}

/**
 * Get all line items for a list of submission IDs.
 */
export async function fetchPeriodicInventoryLines(
  inventoryIds: number[]
): Promise<OdooPeriodicInventoryLine[]> {
  if (!inventoryIds.length) return [];
  return executeKw<OdooPeriodicInventoryLine[]>(
    "periodic.inventory.line",
    "search_read",
    [[["inventory_id", "in", inventoryIds]]],
    { fields: LINE_FIELDS, order: "id asc" }
  );
}

/**
 * Get distinct warehouses that appear in periodic inventory submissions.
 */
export async function fetchPeriodicInventoryWarehouses(): Promise<{ id: number; name: string }[]> {
  const records = await executeKw<{ warehouse_id: OdooM2O }[]>(
    "periodic.inventory",
    "search_read",
    [[]],
    { fields: ["warehouse_id"], limit: 1000 }
  );
  const seen = new Map<number, string>();
  for (const r of records) {
    if (Array.isArray(r.warehouse_id) && r.warehouse_id[0]) {
      const id = r.warehouse_id[0];
      if (!seen.has(id)) seen.set(id, r.warehouse_id[1] || "");
    }
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get distinct locations for a given warehouse (or all if no warehouse).
 */
export async function fetchPeriodicInventoryLocations(warehouseId?: number): Promise<{ id: number; name: string }[]> {
  const domain: unknown[] = warehouseId ? [["warehouse_id", "=", warehouseId]] : [];
  const records = await executeKw<{ location_id: OdooM2O }[]>(
    "periodic.inventory",
    "search_read",
    [domain],
    { fields: ["location_id"], limit: 1000 }
  );
  const seen = new Map<number, string>();
  for (const r of records) {
    if (Array.isArray(r.location_id) && r.location_id[0]) {
      const id = r.location_id[0];
      if (!seen.has(id)) seen.set(id, r.location_id[1] || "");
    }
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
