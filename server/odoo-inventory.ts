/**
 * Odoo Inventory Module API Service
 *
 * Provides read operations for inventory models:
 * - stock.quant (stock on hand)
 * - stock.warehouse (warehouses)
 * - stock.location (stock locations)
 * - product.product (products)
 * - product.category (product categories)
 *
 * Uses the same stateless execute_kw pattern as odoo-hr.ts
 *
 * Includes server-side caching (2-minute TTL) to avoid repeated slow Odoo calls.
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
  timeout: 180000, // 3 minutes — Odoo can be very slow
});

// ─── Types ─────────────────────────────────────────────────────────────────

type OdooM2O = [number, string] | false;

export interface OdooStockQuant {
  id: number;
  product_id: OdooM2O;
  location_id: OdooM2O;
  lot_id: OdooM2O;
  quantity: number;
  reserved_quantity: number;
  company_id: OdooM2O;
  value: number;
}

export interface OdooWarehouse {
  id: number;
  name: string;
  code: string;
  company_id: OdooM2O;
  lot_stock_id: OdooM2O;
}

export interface OdooStockLocation {
  id: number;
  name: string;
  complete_name: string;
  company_id: OdooM2O;
  warehouse_id: OdooM2O;
  usage: string;
}

export interface OdooProduct {
  id: number;
  name: string;
  display_name: string;
  type: string;
  categ_id: OdooM2O;
  uom_id: OdooM2O;
  qty_available: number;
  virtual_available: number;
  list_price: number;
  standard_price: number;
  company_id: OdooM2O;
}

export interface OdooProductCategory {
  id: number;
  name: string;
  parent_id: OdooM2O;
  complete_name: string;
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
        err.message?.includes("timeout") ||
        err.code === "ECONNRESET" || err.code === "ECONNREFUSED" ||
        err.code === "ECONNABORTED";
      if (isTransient && attempt < retries) {
        _uidPromise = null;
        console.log(`[odoo-inventory] Retry ${attempt}/${retries} for ${model}.${method} after: ${err.message?.substring(0, 80)}`);
        await new Promise(r => setTimeout(r, 3000 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error("executeKw: exhausted retries");
}

// ─── Server-Side Cache ────────────────────────────────────────────────────
// Simple in-memory cache with TTL to avoid hammering Odoo on every page load

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  promise?: Promise<T>;
}

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const cache = new Map<string, CacheEntry<any>>();

/**
 * Wrap an async fetch function with caching.
 * If data is fresh (< TTL), returns cached data immediately.
 * If data is stale but exists, returns stale data while refreshing in background.
 * If no cache exists, fetches and caches.
 */
async function cachedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const entry = cache.get(key);
  const now = Date.now();

  // Fresh cache — return immediately
  if (entry && (now - entry.timestamp) < CACHE_TTL_MS) {
    return entry.data;
  }

  // Stale cache — return stale data, refresh in background
  if (entry && entry.data) {
    if (!entry.promise) {
      entry.promise = fetcher().then(data => {
        cache.set(key, { data, timestamp: Date.now() });
        return data;
      }).catch(err => {
        console.error(`[odoo-inventory] Background refresh failed for ${key}:`, err.message);
        // Keep stale data on failure
        if (entry.promise) entry.promise = undefined;
        return entry.data;
      });
    }
    return entry.data;
  }

  // No cache — must fetch
  const data = await fetcher();
  cache.set(key, { data, timestamp: now });
  return data;
}

/** Force-invalidate all cached inventory data */
export function invalidateInventoryCache(): void {
  cache.clear();
}

// ─── Stock Quant Fields ────────────────────────────────────────────────────

const QUANT_FIELDS = [
  "id", "product_id", "location_id", "lot_id",
  "quantity", "reserved_quantity", "company_id", "value",
];

// ─── Product Fields ────────────────────────────────────────────────────────

const PRODUCT_FIELDS = [
  "id", "name", "display_name", "type", "categ_id", "uom_id",
  "qty_available", "virtual_available", "list_price", "standard_price", "company_id",
];

// ─── Fetch Functions ───────────────────────────────────────────────────────

/**
 * Fetch stock quants (on-hand inventory).
 * Filters to INTERNAL locations only — excludes virtual, production, partner,
 * customer, and transit locations so totals match Odoo's Inventory > Products view.
 * Also removes the 500-record limit to avoid truncation.
 */
export async function fetchStockQuants(companyId?: number): Promise<OdooStockQuant[]> {
  const cacheKey = `quants_${companyId || "all"}`;
  return cachedFetch(cacheKey, async () => {
    const domain: any[] = [
      ["location_id.usage", "=", "internal"],
      ["quantity", "!=", 0],
    ];
    if (companyId) domain.push(["company_id", "=", companyId]);
    return executeKw<OdooStockQuant[]>("stock.quant", "search_read", [domain], {
      fields: QUANT_FIELDS,
    });
  });
}

/**
 * Fetch all warehouses.
 */
export async function fetchWarehouses(companyId?: number): Promise<OdooWarehouse[]> {
  const cacheKey = `warehouses_${companyId || "all"}`;
  return cachedFetch(cacheKey, async () => {
    const domain: any[] = [];
    if (companyId) domain.push(["company_id", "=", companyId]);
    return executeKw<OdooWarehouse[]>("stock.warehouse", "search_read", [domain], {
      fields: ["id", "name", "code", "company_id", "lot_stock_id"],
    });
  });
}

/**
 * Fetch internal stock locations.
 */
export async function fetchStockLocations(): Promise<OdooStockLocation[]> {
  return cachedFetch("locations", async () => {
    return executeKw<OdooStockLocation[]>("stock.location", "search_read", [
      [["usage", "=", "internal"]]
    ], {
      fields: ["id", "name", "complete_name", "company_id", "warehouse_id", "usage"],
    });
  });
}

/**
 * Fetch products (consumable type — all Platfarm products are type=consu).
 * Optimized: only fetch fields needed for dashboard, skip qty_available/virtual_available
 * which trigger expensive Odoo computed field calculations.
 */
export async function fetchProducts(companyId?: number): Promise<OdooProduct[]> {
  const cacheKey = `products_${companyId || "all"}`;
  return cachedFetch(cacheKey, async () => {
    const domain: any[] = [["type", "=", "consu"]];
    if (companyId) domain.push(["company_id", "=", companyId]);
    // Use minimal fields — qty_available and virtual_available are computed fields
    // that trigger expensive Odoo stock calculations and cause timeouts
    return executeKw<OdooProduct[]>("product.product", "search_read", [domain], {
      fields: [
        "id", "name", "display_name", "type", "categ_id", "uom_id",
        "list_price", "standard_price", "company_id",
      ],
      limit: 500,
    });
  });
}

/**
 * Fetch product categories.
 */
export async function fetchProductCategories(): Promise<OdooProductCategory[]> {
  return cachedFetch("categories", async () => {
    return executeKw<OdooProductCategory[]>("product.category", "search_read", [[]], {
      fields: ["id", "name", "parent_id", "complete_name"],
    });
  });
}

// ─── Aggregated Dashboard Data ─────────────────────────────────────────────

export interface InventoryDashboardData {
  quants: OdooStockQuant[];
  warehouses: OdooWarehouse[];
  locations: OdooStockLocation[];
  products: OdooProduct[];
  categories: OdooProductCategory[];
}

/**
 * Fetch all inventory data needed for the dashboard in parallel.
 * Uses server-side caching — subsequent calls within 2 minutes are instant.
 */
export async function fetchInventoryDashboard(companyId?: number): Promise<InventoryDashboardData> {
  const [quants, warehouses, locations, products, categories] = await Promise.all([
    fetchStockQuants(companyId),
    fetchWarehouses(companyId),
    fetchStockLocations(),
    fetchProducts(companyId),
    fetchProductCategories(),
  ]);
  return { quants, warehouses, locations, products, categories };
}

// ─── Supply Split (Purchase Order Lines) ──────────────────────────────────

export interface OdooPurchaseOrderLine {
  id: number;
  order_id: OdooM2O;
  product_id: OdooM2O;
  product_qty: number;
  qty_received: number;
  price_unit: number;
  price_subtotal: number;
  currency_id: OdooM2O;
  product_uom: OdooM2O;
  date_planned: string; // ISO date string
  partner_id: OdooM2O; // supplier
  company_id: OdooM2O;
  state: string;
  // Enriched from parent PO header
  warehouseName?: string;
  locationName?: string;
}

/**
 * Fetch purchase order lines for supply split analysis.
 * Filters by date range and company. Only includes confirmed/done orders.
 * Uses a short cache (1 min) since date ranges vary.
 */
export async function fetchSupplySplit(
  companyId?: number,
  dateFrom?: string,
  dateTo?: string
): Promise<OdooPurchaseOrderLine[]> {
  const cacheKey = `supply_split_${companyId || "all"}_${dateFrom || "none"}_${dateTo || "none"}`;
  return cachedFetch(cacheKey, async () => {
    const domain: any[] = [
      ["state", "in", ["purchase", "done"]],
    ];
    if (companyId) domain.push(["company_id", "=", companyId]);
    if (dateFrom) domain.push(["date_planned", ">=", dateFrom]);
    if (dateTo) domain.push(["date_planned", "<=", dateTo]);

    return executeKw<OdooPurchaseOrderLine[]>("purchase.order.line", "search_read", [domain], {
      fields: [
        "id", "order_id", "product_id", "product_qty", "qty_received",
        "price_unit", "price_subtotal", "currency_id", "product_uom",
        "date_planned", "partner_id", "company_id", "state",
      ],
      limit: 2000,
    });
  });
}

/**
 * Fetch purchase.order headers for a set of order IDs.
 * Returns id + picking_type_id only.
 */
export async function fetchSupplySplitHeaders(orderIds: number[]): Promise<{ id: number; picking_type_id: OdooM2O }[]> {
  return executeKw<{ id: number; picking_type_id: OdooM2O }[]>("purchase.order", "search_read",
    [[["id", "in", orderIds]]],
    { fields: ["id", "picking_type_id"], limit: 2000 }
  );
}

/**
 * Fetch stock.picking.type records for a set of IDs.
 * Returns id, warehouse_id, default_location_dest_id.
 */
export async function fetchPickingTypes(ptIds: number[]): Promise<{ id: number; warehouse_id: OdooM2O; default_location_dest_id: OdooM2O }[]> {
  return executeKw<{ id: number; warehouse_id: OdooM2O; default_location_dest_id: OdooM2O }[]>("stock.picking.type", "search_read",
    [[["id", "in", ptIds]]],
    { fields: ["id", "warehouse_id", "default_location_dest_id"], limit: 200 }
  );
}

// ─── Supplier Statement (stock.picking receipts) ────────────────────────────

export interface OdooReceipt {
  id: number;
  name: string; // shipment reference e.g. WH/IN/02971
  origin: string | false; // PO reference e.g. PO/CAI/26/00063
  partner_id: OdooM2O; // supplier
  scheduled_date: string;
  date_done: string | false;
  x_studio_net_weight_in_tons: number;
  x_studio_gross_weight_in_tons: number;
  agreed_product_price_per_unit: number;
  x_studio_currency_id: OdooM2O;
  x_studio_purchase_currency: OdooM2O;
  x_studio_product_type: OdooM2O;
  product_id: OdooM2O; // product on picking level
  location_dest_id: OdooM2O; // receiving warehouse/location
  picking_type_id: OdooM2O;
  user_id: OdooM2O; // procurement officer / responsible
  state: string;
  grade: string | false;
  truck_load_serial_tl: string | false;
  x_studio_loadcontainer_number_1: string | false;
  x_studio_loading_datetime: string | false;
  company_id: OdooM2O;
  move_ids: number[];
  purchase_id: OdooM2O; // linked purchase order
}

export interface OdooStockMove {
  id: number;
  product_id: OdooM2O;
  product_uom_qty: number;
  quantity: number; // in product UOM (usually kg)
  name: string;
  picking_id: OdooM2O;
  price_unit: number; // price per unit from PO line
  product_uom: OdooM2O; // unit of measure
}

const RECEIPT_FIELDS = [
  "name", "origin", "partner_id", "scheduled_date", "date_done",
  "x_studio_net_weight_in_tons", "x_studio_gross_weight_in_tons",
  "agreed_product_price_per_unit", "x_studio_currency_id",
  "x_studio_purchase_currency", "x_studio_product_type",
  "product_id", "location_dest_id", "picking_type_id", "user_id", "state", "grade",
  "truck_load_serial_tl", "x_studio_loadcontainer_number_1",
  "x_studio_loading_datetime", "company_id", "move_ids", "purchase_id",
];

/**
 * Fetch list of unique suppliers who have incoming receipts (for dropdown).
 */
export async function fetchReceiptSuppliers(companyId?: number): Promise<{ id: number; name: string }[]> {
  const cacheKey = `receipt_suppliers_${companyId || "all"}`;
  return cachedFetch(cacheKey, async () => {
    const domain: any[] = [
      ["picking_type_code", "=", "incoming"],
      ["state", "=", "done"],
    ];
    if (companyId) domain.push(["company_id", "=", companyId]);

    // Read partner_id from all done incoming pickings
    const pickings = await executeKw<{ partner_id: OdooM2O }[]>(
      "stock.picking", "search_read", [domain],
      { fields: ["partner_id"], limit: 5000 }
    );

    // Deduplicate suppliers
    const map = new Map<number, string>();
    for (const p of pickings) {
      if (p.partner_id && Array.isArray(p.partner_id)) {
        map.set(p.partner_id[0], p.partner_id[1]);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

/**
 * Fetch detailed receipts (stock.picking) for a specific supplier and date range.
 * Uses scheduled_date as the authoritative date (date_planned equivalent).
 */
export async function fetchSupplierReceipts(
  supplierId: number,
  companyId?: number,
  dateFrom?: string,
  dateTo?: string
): Promise<{ receipts: OdooReceipt[]; moves: OdooStockMove[]; purchaseOrders: any[]; poLines: any[] }> {
  const cacheKey = `supplier_receipts_${supplierId}_${companyId || "all"}_${dateFrom || "none"}_${dateTo || "none"}`;
  return cachedFetch(cacheKey, async () => {
    const domain: any[] = [
      ["picking_type_code", "=", "incoming"],
      ["state", "=", "done"],
      ["partner_id", "=", supplierId],
    ];
    if (companyId) domain.push(["company_id", "=", companyId]);
    if (dateFrom) domain.push(["scheduled_date", ">=", dateFrom]);
    if (dateTo) domain.push(["scheduled_date", "<=", dateTo]);

    const receipts = await executeKw<OdooReceipt[]>(
      "stock.picking", "search_read", [domain],
      { fields: RECEIPT_FIELDS, limit: 3000, order: "scheduled_date desc" }
    );

    // Collect all move_ids and purchase_ids
    const allMoveIds = receipts.flatMap((r) => r.move_ids);
    const poIds = [...new Set(receipts.map((r) => Array.isArray(r.purchase_id) ? r.purchase_id[0] : 0).filter(Boolean))];

    // Fetch stock.move and purchase.order in PARALLEL
    // Fetch stock.move, purchase.order, and purchase.order.line in PARALLEL
    const [moves, purchaseOrders, poLines] = await Promise.all([
      // Fetch stock.moves in parallel batches
      (async () => {
        if (allMoveIds.length === 0) return [] as OdooStockMove[];
        const batches: number[][] = [];
        for (let i = 0; i < allMoveIds.length; i += 500) {
          batches.push(allMoveIds.slice(i, i + 500));
        }
        const results = await Promise.all(batches.map(batch =>
          executeKw<OdooStockMove[]>(
            "stock.move", "search_read",
            [[["id", "in", batch]]],
            { fields: ["id", "product_id", "product_uom_qty", "quantity", "name", "picking_id", "price_unit", "product_uom"] }
          )
        ));
        return results.flat();
      })(),
      // Fetch purchase.orders in parallel batches
      (async () => {
        if (poIds.length === 0) return [] as any[];
        const batches: number[][] = [];
        for (let i = 0; i < poIds.length; i += 200) {
          batches.push(poIds.slice(i, i + 200));
        }
        const results = await Promise.all(batches.map(batch =>
          executeKw<any[]>(
            "purchase.order", "search_read",
            [[["id", "in", batch]]],
            { fields: ["id", "name", "state", "currency_id", "user_id", "x_studio_procurement_officer", "amount_total"] }
          )
        ));
        return results.flat();
      })(),
      // Fetch purchase.order.line records (product line items with unit prices) for all POs
      (async () => {
        if (poIds.length === 0) return [] as any[];
        const batches: number[][] = [];
        for (let i = 0; i < poIds.length; i += 200) {
          batches.push(poIds.slice(i, i + 200));
        }
        const results = await Promise.all(batches.map(batch =>
          executeKw<any[]>(
            "purchase.order.line", "search_read",
            [[["order_id", "in", batch]]],
            { fields: ["id", "order_id", "product_id", "product_qty", "price_unit", "price_subtotal", "product_uom"] }
          )
        ));
        return results.flat();
      })()
    ]);

    return { receipts, moves, purchaseOrders, poLines };
  });
}
