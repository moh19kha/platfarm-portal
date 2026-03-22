/**
 * Odoo JSON-RPC External API Service
 * 
 * Uses the stateless `execute_kw` pattern via Odoo's JSON-RPC `object` service.
 * This is the recommended external integration method — no session cookies,
 * no login overhead per request. Authentication is done once to get the uid,
 * then all subsequent calls pass (db, uid, password) directly.
 * 
 * Reference: https://www.odoo.com/documentation/15.0/developer/api/external_api.html
 */

import axios from "axios";

// ─── Odoo Connection Config (hardcoded) ────────────────────────────────────
const ODOO_URL = "https://odoo.platfarm.io";
const ODOO_DB = "odoo";
const ODOO_USER = "aiagent";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD ?? "Platfarm@2025";

// Reusable axios instance with connection pooling
const odooClient = axios.create({
  baseURL: ODOO_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 120000, // Longer timeout — Odoo can be slow
});

// ─── Types ─────────────────────────────────────────────────────────────────

export interface OdooCompany {
  id: number;
  name: string;
  display_name: string;
  currency_id: [number, string] | false;
  country_id: [number, string] | false;
  city: string | false;
  parent_id: [number, string] | false;
  child_ids: number[];
}

export interface OdooPurchaseAgreement {
  id: number;
  name: string;
  reference: string | false;
  vendor_id: [number, string] | false;
  requisition_type: string | false;
  date_start: string | false;
  date_end: string | false;
  state: string | false;
  company_id: [number, string] | false;
  currency_id: [number, string] | false;
  product_id: [number, string] | false;
  order_count: number;
  line_ids: number[];
  x_studio_total_po_quantity_in_tons: number;
  x_studio_purchase_incoterm_condition: string | false;
  x_studio_purchase_currency: string | false;
  x_studio_insurance_included: boolean;
  x_studio_payment_terms: string | false;
  x_studio_notes: string | false;
  x_studio_supply_start_date: string | false;
  x_studio_supply_end_date: string | false;
}

export interface OdooPurchaseAgreementLine {
  id: number;
  product_id: [number, string] | false;
  product_qty: number;
  price_unit: number;
  product_uom_id: [number, string] | false;
  requisition_id: [number, string] | false;
  qty_ordered: number;
}

export interface OdooSalesAgreement {
  id: number;
  name: string;
  display_name: string;
  partner_id: [number, string] | false;
  x_studio_customer: [number, string] | false;
  x_studio_ultimate_customer: string | false;
  x_studio_sales_incoterm_condition: string | false;
  x_studio_sales_currency: string | false;
  x_studio_insurance_included: boolean;
  x_studio_total_po_quantity_in_tons: number;
  x_studio_supply_start_date: string | false;
  x_studio_supply_end_date: string | false;
  x_studio_notes: string | false;
  x_studio_payment_terms: string | false;
  sale_order_count: number;
  sale_order_template_line_ids: number[];
  company_id: [number, string] | false;
  active: boolean;
  number_of_days: number;
  create_date: string;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: string;
  id: number | null;
  result?: T;
  error?: {
    code: number;
    message: string;
    data: { message: string; debug: string };
  };
}

// ─── UID Cache ─────────────────────────────────────────────────────────────
// The uid only needs to be fetched once — it never changes for a given user.

let _uidPromise: Promise<number> | null = null;

/**
 * Get the Odoo user ID (uid) for our service account.
 * Cached after first call. Uses the `common` service `authenticate` method.
 */
function getUid(): Promise<number> {
  if (_uidPromise) return _uidPromise;

  _uidPromise = (async () => {
    try {
      const res = await odooClient.post<JsonRpcResponse<number | false>>("/jsonrpc", {
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "common",
          method: "authenticate",
          args: [ODOO_DB, ODOO_USER, ODOO_PASSWORD, {}],
        },
      });

      if (res.data.error) {
        throw new Error(`Odoo auth error: ${res.data.error.data.message}`);
      }

      const uid = res.data.result;
      if (!uid || typeof uid !== "number") {
        throw new Error("Odoo authentication failed: invalid credentials");
      }

      return uid;
    } catch (err) {
      // Clear cache so next call retries
      _uidPromise = null;
      throw err;
    }
  })();

  return _uidPromise;
}

// ─── Core RPC Helper ───────────────────────────────────────────────────────

/**
 * Execute an Odoo model method via JSON-RPC `execute_kw`.
 * This is stateless — each call passes (db, uid, password) directly.
 * No session cookies or login tokens needed.
 */
// All company IDs the AI Agent user (id=80) has access to
const ALLOWED_COMPANY_IDS = [1, 2, 3, 4, 5];

export async function executeKw<T = unknown>(
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown> = {},
  retries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const uid = await getUid();
      // Inject allowed_company_ids into context to avoid multi-company access errors
      const kwargsWithContext = {
        ...kwargs,
        context: {
          ...(kwargs.context as Record<string, unknown> || {}),
          allowed_company_ids: ALLOWED_COMPANY_IDS,
        },
      };

      const res = await odooClient.post<JsonRpcResponse<T>>("/jsonrpc", {
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "object",
          method: "execute_kw",
          args: [ODOO_DB, uid, ODOO_PASSWORD, model, method, args, kwargsWithContext],
        },
      });

      if (res.data.error) {
        // If access denied, clear uid cache so it re-authenticates next time
        if (res.data.error.code === 100 || res.data.error.code === 2) {
          _uidPromise = null;
        }
        throw new Error(
          `Odoo RPC error (${model}.${method}): ${res.data.error.data.message}`
        );
      }

      return res.data.result as T;
    } catch (err: any) {
      const isTransient = err.message?.includes('socket hang up') ||
        err.message?.includes('ECONNRESET') ||
        err.code === 'ECONNRESET' ||
        err.code === 'ECONNREFUSED';
      if (isTransient && attempt < retries) {
        _uidPromise = null;
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error('executeKw: exhausted retries');
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Fetch all companies from Odoo's res.company model.
 * Returns the raw Odoo records with selected fields.
 */
export async function fetchCompanies(): Promise<OdooCompany[]> {
  return executeKw<OdooCompany[]>(
    "res.company",
    "search_read",
    [[]],
    {
      fields: [
        "id",
        "name",
        "display_name",
        "currency_id",
        "country_id",
        "city",
        "parent_id",
        "child_ids",
      ],
    }
  );
}

/**
 * Fetch all purchase agreements from Odoo's purchase.requisition model.
 */
export async function fetchPurchaseAgreements(): Promise<OdooPurchaseAgreement[]> {
  return executeKw<OdooPurchaseAgreement[]>(
    "purchase.requisition",
    "search_read",
    [[]],
    {
      fields: [
        "id",
        "name",
        "reference",
        "vendor_id",
        "requisition_type",
        "date_start",
        "date_end",
        "state",
        "company_id",
        "currency_id",
        "product_id",
        "order_count",
        "line_ids",
      ],
    }
  );
}

/**
 * Fetch purchase agreement lines by their IDs.
 */
export async function fetchPurchaseAgreementLines(
  lineIds: number[]
): Promise<OdooPurchaseAgreementLine[]> {
  if (lineIds.length === 0) return [];
  return executeKw<OdooPurchaseAgreementLine[]>(
    "purchase.requisition.line",
    "search_read",
    [[["id", "in", lineIds]]],
    {
      fields: [
        "id",
        "product_id",
        "product_qty",
        "price_unit",
        "product_uom_id",
        "requisition_id",
        "qty_ordered",
      ],
    }
  );
}

/**
 * Fetch all sales agreements from Odoo's sale.order.template model.
 */
export async function fetchSalesAgreements(): Promise<OdooSalesAgreement[]> {
  return executeKw<OdooSalesAgreement[]>(
    "sale.order.template",
    "search_read",
    [[]],
    {
      fields: [
        "id",
        "name",
        "display_name",
        "partner_id",
        "sale_order_count",
        "sale_order_template_line_ids",
        "company_id",
        "active",
        "number_of_days",
        "create_date",
      ],
    }
  );
}

// ─── Sales Agreement Lines ────────────────────────────────────────────────

export interface OdooSalesAgreementLine {
  id: number;
  product_id: [number, string] | false;
  product_uom_qty: number;
  price_unit: number;
  product_uom_id: [number, string] | false;
  sale_order_template_id: [number, string] | false;
  name: string | false;
}

/**
 * Fetch sales agreement lines by their IDs.
 */
export async function fetchSalesAgreementLines(
  lineIds: number[]
): Promise<OdooSalesAgreementLine[]> {
  if (lineIds.length === 0) return [];
  return executeKw<OdooSalesAgreementLine[]>(
    "sale.order.template.line",
    "search_read",
    [[["id", "in", lineIds]]],
    {
      fields: [
        "id",
        "product_id",
        "product_uom_qty",
        "price_unit",
        "product_uom_id",
        "sale_order_template_id",
        "name",
      ],
    }
  );
}

// ─── Lookup Helpers ───────────────────────────────────────────────────────

export interface OdooVendor {
  id: number;
  name: string;
  display_name: string;
}

export interface OdooProduct {
  id: number;
  name: string;
  display_name: string;
  uom_id: [number, string] | false;
  uom_po_id: [number, string] | false;
}

export interface OdooCurrency {
  id: number;
  name: string;
  symbol: string;
}

export interface OdooUom {
  id: number;
  name: string;
}

export interface OdooPickingType {
  id: number;
  name: string;
  code: string;
  company_id: [number, string] | false;
  warehouse_id: [number, string] | false;
}

/**
 * Fetch vendors (partners with supplier_rank > 0).
 * Supports optional search term for autocomplete.
 */
export async function fetchVendors(search?: string, limit = 200, companyId?: number): Promise<OdooVendor[]> {
  if (companyId) {
    // Return vendors where company_id matches OR company_id is false (shared across companies)
    const domain: (unknown[] | string)[] = [
      ["supplier_rank", ">", 0],
      "|",
      ["company_id", "=", false],
      ["company_id", "=", companyId],
    ];
    if (search) domain.push(["name", "ilike", search]);
    return executeKw<OdooVendor[]>("res.partner", "search_read", [domain], {
      fields: ["id", "name", "display_name"],
      limit,
      order: "name asc",
    });
  }
  // No company filter — return all suppliers
  const domain: (unknown[] | string)[] = [["supplier_rank", ">", 0]];
  if (search) domain.push(["name", "ilike", search]);
  return executeKw<OdooVendor[]>("res.partner", "search_read", [domain], {
    fields: ["id", "name", "display_name"],
    limit,
    order: "name asc",
  });
}

/**
 * Fetch customers (partners with customer_rank > 0).
 * Supports optional search term for autocomplete.
 */
export async function fetchCustomers(search?: string, limit = 200, companyId?: number): Promise<OdooVendor[]> {
  if (companyId) {
    // Return customers where company_id matches OR company_id is false (shared across companies)
    const domain: (unknown[] | string)[] = [
      ["customer_rank", ">", 0],
      "|",
      ["company_id", "=", false],
      ["company_id", "=", companyId],
    ];
    if (search) domain.push(["name", "ilike", search]);
    return executeKw<OdooVendor[]>("res.partner", "search_read", [domain], {
      fields: ["id", "name", "display_name"],
      limit,
      order: "name asc",
    });
  }
  // No company filter — return all customers
  const domain: (unknown[] | string)[] = [["customer_rank", ">", 0]];
  if (search) domain.push(["name", "ilike", search]);
  return executeKw<OdooVendor[]>("res.partner", "search_read", [domain], {
    fields: ["id", "name", "display_name"],
    limit,
    order: "name asc",
  });
}

/**
 * Fetch products. Supports optional search term.
 */
export async function fetchProducts(search?: string, limit = 200, companyId?: number): Promise<OdooProduct[]> {
  if (companyId) {
    // Get products that appear in purchase order lines or sale order lines for this company
    // First try purchase.order.line
    const poGroups = await executeKw<{ product_id: [number, string]; product_id_count: number }[]>(
      "purchase.order.line", "read_group",
      [[["company_id", "=", companyId]]],
      { fields: ["product_id"], groupby: ["product_id"] }
    ).catch(() => [] as { product_id: [number, string]; product_id_count: number }[]);
    // Also try sale.order.line
    const soGroups = await executeKw<{ product_id: [number, string]; product_id_count: number }[]>(
      "sale.order.line", "read_group",
      [[["company_id", "=", companyId]]],
      { fields: ["product_id"], groupby: ["product_id"] }
    ).catch(() => [] as { product_id: [number, string]; product_id_count: number }[]);
    const allIds = [
      ...poGroups.map(g => g.product_id[0]),
      ...soGroups.map(g => g.product_id[0]),
    ];
    const productIds = allIds.filter((id, idx) => allIds.indexOf(id) === idx);
    if (productIds.length > 0) {
      const domain: (unknown[] | string)[] = [
        ["id", "in", productIds],
        "|", ["company_id", "=", companyId], ["company_id", "=", false],
      ];
      if (search) domain.push(["name", "ilike", search]);
      return executeKw<OdooProduct[]>("product.product", "search_read", [domain], {
        fields: ["id", "name", "display_name", "uom_id", "uom_po_id"],
        limit: 200,
        order: "name asc",
      });
    }
    // No PO/SO lines found for this company — fall back to products owned by this company
    // Use "|" (OR) to include products with company_id = companyId OR company_id = false (shared)
    const domain: (unknown[] | string)[] = [
      "|",
      ["company_id", "=", companyId],
      ["company_id", "=", false],
    ];
    if (search) domain.push(["name", "ilike", search]);
    return executeKw<OdooProduct[]>("product.product", "search_read", [domain], {
      fields: ["id", "name", "display_name", "uom_id", "uom_po_id"],
      limit: 200,
      order: "name asc",
    });
  }
  // No company filter — return all products
  const domain: (unknown[] | string)[] = [];
  if (search) domain.push(["name", "ilike", search]);
  return executeKw<OdooProduct[]>("product.product", "search_read", [domain], {
    fields: ["id", "name", "display_name", "uom_id", "uom_po_id"],
    limit: 200,
    order: "name asc",
  });
}

/**
 * Fetch active currencies.
 */
export async function fetchCurrencies(): Promise<OdooCurrency[]> {
  return executeKw<OdooCurrency[]>("res.currency", "search_read", [[["active", "=", true]]], {
    fields: ["id", "name", "symbol"],
    order: "name asc",
  });
}

/**
 * Fetch payment terms from Odoo.
 */
export interface OdooPaymentTerm {
  id: number;
  name: string;
}

export async function fetchPaymentTerms(): Promise<OdooPaymentTerm[]> {
  return executeKw<OdooPaymentTerm[]>("account.payment.term", "search_read", [[]], {
    fields: ["id", "name"],
    order: "name asc",
  });
}

/**
 * Fetch units of measure.
 */
export async function fetchUoms(limit = 50): Promise<OdooUom[]> {
  return executeKw<OdooUom[]>("uom.uom", "search_read", [[]], {
    fields: ["id", "name"],
    limit,
    order: "name asc",
  });
}

/**
 * Fetch picking types, optionally filtered by company and code.
 * code: 'incoming' for receipts, 'outgoing' for delivery orders
 */
export async function fetchPickingTypes(companyId?: number, code?: string): Promise<OdooPickingType[]> {
  const domain: unknown[][] = [];
  if (code) domain.push(["code", "=", code]);
  if (companyId) domain.push(["company_id", "=", companyId]);
  // Only get "Receipts" or "Delivery Orders" (standard names), not specialized ones
  if (code === "incoming") domain.push(["name", "ilike", "Receipts"]);
  if (code === "outgoing") domain.push(["name", "=", "Delivery Orders"]);
  return executeKw<OdooPickingType[]>("stock.picking.type", "search_read", [domain], {
    fields: ["id", "name", "code", "company_id", "warehouse_id"],
  });
}

// ─── Warehouse & Stock ─────────────────────────────────────────────────────

export interface OdooWarehouse {
  id: number;
  name: string;
  code: string;
  company_id: [number, string] | false;
  lot_stock_id: [number, string] | false;
}

/**
 * Fetch all warehouses, optionally filtered by company.
 */
export async function fetchWarehouses(companyId?: number): Promise<OdooWarehouse[]> {
  const domain: unknown[][] = [];
  if (companyId) domain.push(["company_id", "=", companyId]);
  return executeKw<OdooWarehouse[]>("stock.warehouse", "search_read", [domain], {
    fields: ["id", "name", "code", "company_id", "lot_stock_id"],
    order: "name asc",
  });
}

export interface StockQuantResult {
  productId: number;
  warehouseId: number;
  warehouseName: string;
  locationId: number;
  locationName: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

/**
 * Fetch on-hand stock for given product IDs, optionally filtered by warehouse.
 * Returns per-warehouse stock quantities.
 */
export async function fetchProductStock(
  productIds: number[],
  warehouseId?: number
): Promise<StockQuantResult[]> {
  if (productIds.length === 0) return [];

  // Build domain: internal locations only, specific products
  const domain: unknown[][] = [
    ["product_id", "in", productIds],
    ["location_id.usage", "=", "internal"],
  ];

  // If warehouseId specified, get the warehouse's stock location and filter
  if (warehouseId) {
    // Get all internal locations belonging to this warehouse
    const locations = await executeKw<{ id: number; name: string }[]>(
      "stock.location", "search_read",
      [[["warehouse_id", "=", warehouseId], ["usage", "=", "internal"]]],
      { fields: ["id", "name"] }
    );
    const locationIds = locations.map(l => l.id);
    if (locationIds.length === 0) return [];
    domain.push(["location_id", "in", locationIds]);
  }

  const quants = await executeKw<{
    id: number;
    product_id: [number, string];
    location_id: [number, string];
    quantity: number;
    reserved_quantity: number;
  }[]>("stock.quant", "search_read", [domain], {
    fields: ["product_id", "location_id", "quantity", "reserved_quantity"],
  });

  // Get location → warehouse mapping
  const locationIds = Array.from(new Set(quants.map(q => q.location_id[0])));
  let locationWarehouseMap: Map<number, { warehouseId: number; warehouseName: string }> = new Map();

  if (locationIds.length > 0) {
    const locations = await executeKw<{
      id: number;
      warehouse_id: [number, string] | false;
    }[]>("stock.location", "search_read",
      [[["id", "in", locationIds]]],
      { fields: ["id", "warehouse_id"] }
    );
    for (const loc of locations) {
      if (loc.warehouse_id) {
        locationWarehouseMap.set(loc.id, {
          warehouseId: loc.warehouse_id[0],
          warehouseName: loc.warehouse_id[1],
        });
      }
    }
  }

  return quants.map(q => {
    const wh = locationWarehouseMap.get(q.location_id[0]);
    return {
      productId: q.product_id[0],
      warehouseId: wh?.warehouseId || 0,
      warehouseName: wh?.warehouseName || "Unknown",
      locationId: q.location_id[0],
      locationName: q.location_id[1],
      quantity: q.quantity,
      reservedQuantity: q.reserved_quantity,
      availableQuantity: q.quantity - q.reserved_quantity,
    };
  });
}

/**
 * Get aggregated stock per warehouse for given products.
 * Sums all quants per (product, warehouse) pair.
 */
export async function fetchAggregatedStock(
  productIds: number[],
  warehouseId?: number
): Promise<{ productId: number; warehouseId: number; warehouseName: string; available: number; onHand: number }[]> {
  const quants = await fetchProductStock(productIds, warehouseId);
  
  // Aggregate by (productId, warehouseId)
  const map = new Map<string, { productId: number; warehouseId: number; warehouseName: string; available: number; onHand: number }>();
  for (const q of quants) {
    const key = `${q.productId}-${q.warehouseId}`;
    const existing = map.get(key);
    if (existing) {
      existing.available += q.availableQuantity;
      existing.onHand += q.quantity;
    } else {
      map.set(key, {
        productId: q.productId,
        warehouseId: q.warehouseId,
        warehouseName: q.warehouseName,
        available: q.availableQuantity,
        onHand: q.quantity,
      });
    }
  }
  return Array.from(map.values());
}

// ─── Stock Locations ─────────────────────────────────────────────────────

export interface OdooStockLocation {
  id: number;
  name: string;
  complete_name: string;
  warehouse_id: [number, string] | false;
  company_id: [number, string] | false;
  location_id: [number, string] | false;
}

/**
 * Fetch internal stock locations, optionally filtered by company.
 * Returns locations like "MWCP/Finished Goods-Sokhna", "CWDAK/Stock", etc.
 */
export async function fetchStockLocations(companyId?: number): Promise<OdooStockLocation[]> {
  const domain: unknown[][] = [["usage", "=", "internal"]];
  if (companyId) domain.push(["company_id", "=", companyId]);
  return executeKw<OdooStockLocation[]>("stock.location", "search_read", [domain], {
    fields: ["id", "name", "complete_name", "warehouse_id", "company_id", "location_id"],
    order: "complete_name asc",
  });
}

/**
 * Fetch on-hand stock for given product IDs at a specific location.
 * Returns per-product stock quantities at the location level.
 */
export async function fetchProductStockByLocation(
  productIds: number[],
  locationId?: number
): Promise<{ productId: number; locationId: number; locationName: string; quantity: number; reservedQuantity: number; availableQuantity: number }[]> {
  if (productIds.length === 0) return [];

  const domain: unknown[][] = [
    ["product_id", "in", productIds],
    ["location_id.usage", "=", "internal"],
  ];
  if (locationId) {
    domain.push(["location_id", "=", locationId]);
  }

  const quants = await executeKw<{
    id: number;
    product_id: [number, string];
    location_id: [number, string];
    quantity: number;
    reserved_quantity: number;
  }[]>("stock.quant", "search_read", [domain], {
    fields: ["product_id", "location_id", "quantity", "reserved_quantity"],
  });

  // Aggregate by (productId, locationId)
  const map = new Map<string, { productId: number; locationId: number; locationName: string; quantity: number; reservedQuantity: number; availableQuantity: number }>();
  for (const q of quants) {
    const key = `${q.product_id[0]}-${q.location_id[0]}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += q.quantity;
      existing.reservedQuantity += q.reserved_quantity;
      existing.availableQuantity += (q.quantity - q.reserved_quantity);
    } else {
      map.set(key, {
        productId: q.product_id[0],
        locationId: q.location_id[0],
        locationName: q.location_id[1],
        quantity: q.quantity,
        reservedQuantity: q.reserved_quantity,
        availableQuantity: q.quantity - q.reserved_quantity,
      });
    }
  }
  return Array.from(map.values());
}

/**
 * Fetch ALL products with positive stock at a specific location.
 * Unlike fetchProductStockByLocation, this does NOT require product IDs - it returns everything at the location.
 */
export async function fetchAllStockAtLocation(
  locationId: number
): Promise<{ productId: number; productName: string; locationId: number; locationName: string; quantity: number; reservedQuantity: number; availableQuantity: number; uomName: string }[]> {
  const domain: unknown[][] = [
    ["location_id", "=", locationId],
    ["quantity", ">", 0],
  ];

  const quants = await executeKw<{
    id: number;
    product_id: [number, string];
    location_id: [number, string];
    quantity: number;
    reserved_quantity: number;
    product_uom_id: [number, string];
  }[]>("stock.quant", "search_read", [domain], {
    fields: ["product_id", "location_id", "quantity", "reserved_quantity", "product_uom_id"],
  });

  // Aggregate by productId
  const map = new Map<number, { productId: number; productName: string; locationId: number; locationName: string; quantity: number; reservedQuantity: number; availableQuantity: number; uomName: string }>();
  for (const q of quants) {
    const pid = q.product_id[0];
    const existing = map.get(pid);
    if (existing) {
      existing.quantity += q.quantity;
      existing.reservedQuantity += q.reserved_quantity;
      existing.availableQuantity += (q.quantity - q.reserved_quantity);
    } else {
      map.set(pid, {
        productId: pid,
        productName: q.product_id[1],
        locationId: q.location_id[0],
        locationName: q.location_id[1],
        quantity: q.quantity,
        reservedQuantity: q.reserved_quantity,
        availableQuantity: q.quantity - q.reserved_quantity,
        uomName: q.product_uom_id?.[1] || "kg",
      });
    }
  }
  // Only return products with positive available quantity
  return Array.from(map.values()).filter(p => p.availableQuantity > 0).sort((a, b) => a.productName.localeCompare(b.productName));
}

// ─── Purchase Agreement CRUD ──────────────────────────────────────────────

export interface CreatePurchaseAgreementInput {
  vendor_id?: number;
  company_id: number;
  currency_id: number;
  picking_type_id: number;
  requisition_type?: string;
  reference?: string;
  date_start?: string;
  date_end?: string;
  x_studio_purchase_incoterm_condition?: string;
  x_studio_purchase_currency?: string;
  x_studio_insurance_included?: boolean;
  x_studio_total_po_quantity_in_tons?: number;
  x_studio_payment_terms?: string;
  x_studio_notes?: string;
  x_studio_supply_start_date?: string;
  x_studio_supply_end_date?: string;
  lines: {
    product_id: number;
    product_qty: number;
    price_unit: number;
    product_uom_id?: number;
  }[];
}

/**
 * Create a purchase agreement in Odoo.
 * Uses the standard Odoo `create` method. Lines are created using the
 * one2many command syntax: (0, 0, vals) to create inline records.
 */
export async function createPurchaseAgreement(
  input: CreatePurchaseAgreementInput
): Promise<number> {
  const vals: Record<string, unknown> = {
    company_id: input.company_id,
    currency_id: input.currency_id,
    picking_type_id: input.picking_type_id,
    requisition_type: input.requisition_type || "blanket_order",
    state: "draft",
  };

  if (input.vendor_id) vals.vendor_id = input.vendor_id;
  if (input.reference) vals.reference = input.reference;
  if (input.date_start) vals.date_start = input.date_start;
  if (input.date_end) vals.date_end = input.date_end;
  if (input.x_studio_purchase_currency) vals.x_studio_purchase_currency = input.x_studio_purchase_currency;
  if (input.x_studio_insurance_included !== undefined) vals.x_studio_insurance_included = input.x_studio_insurance_included;
  if (input.x_studio_total_po_quantity_in_tons !== undefined) vals.x_studio_total_po_quantity_in_tons = input.x_studio_total_po_quantity_in_tons;
  if (input.x_studio_payment_terms) vals.x_studio_payment_terms = input.x_studio_payment_terms;
  if (input.x_studio_notes) vals.x_studio_notes = input.x_studio_notes;
  if (input.x_studio_supply_start_date) vals.x_studio_supply_start_date = input.x_studio_supply_start_date;

  // Create lines using Odoo one2many command: (0, 0, {vals})
  if (input.lines.length > 0) {
    vals.line_ids = input.lines.map((line) => [
      0,
      0,
      {
        product_id: line.product_id,
        product_qty: line.product_qty,
        price_unit: line.price_unit,
        ...(line.product_uom_id ? { product_uom_id: line.product_uom_id } : {}),
      },
    ]);
  }

  return executeKw<number>("purchase.requisition", "create", [vals]);
}

export interface UpdatePurchaseAgreementInput {
  id: number;
  vendor_id?: number;
  reference?: string;
  date_start?: string;
  date_end?: string;
  currency_id?: number;
  x_studio_purchase_incoterm_condition?: string;
  x_studio_purchase_currency?: string;
  x_studio_insurance_included?: boolean;
  x_studio_total_po_quantity_in_tons?: number;
  x_studio_payment_terms?: string;
  x_studio_notes?: string;
  x_studio_supply_start_date?: string;
  x_studio_supply_end_date?: string;
  addLines?: {
    product_id: number;
    product_qty: number;
    price_unit: number;
    product_uom_id?: number;
  }[];
  updateLines?: {
    id: number;
    product_qty?: number;
    price_unit?: number;
  }[];
  deleteLineIds?: number[];
}

/**
 * Update a purchase agreement in Odoo.
 * Uses the standard Odoo `write` method with one2many command syntax for lines.
 */
export async function updatePurchaseAgreement(
  input: UpdatePurchaseAgreementInput
): Promise<boolean> {
  const vals: Record<string, unknown> = {};

  if (input.vendor_id !== undefined) vals.vendor_id = input.vendor_id;
  if (input.reference !== undefined) vals.reference = input.reference;
  if (input.date_start !== undefined) vals.date_start = input.date_start;
  if (input.date_end !== undefined) vals.date_end = input.date_end;
  if (input.currency_id !== undefined) vals.currency_id = input.currency_id;
  if (input.x_studio_purchase_currency !== undefined) vals.x_studio_purchase_currency = input.x_studio_purchase_currency;
  if (input.x_studio_insurance_included !== undefined) vals.x_studio_insurance_included = input.x_studio_insurance_included;
  if (input.x_studio_total_po_quantity_in_tons !== undefined) vals.x_studio_total_po_quantity_in_tons = input.x_studio_total_po_quantity_in_tons;
  if (input.x_studio_payment_terms !== undefined) vals.x_studio_payment_terms = input.x_studio_payment_terms;
  if (input.x_studio_notes !== undefined) vals.x_studio_notes = input.x_studio_notes;
  if (input.x_studio_supply_start_date !== undefined) vals.x_studio_supply_start_date = input.x_studio_supply_start_date;

  const lineCommands: unknown[] = [];
  if (input.addLines) {
    for (const line of input.addLines) {
      lineCommands.push([
        0,
        0,
        {
          product_id: line.product_id,
          product_qty: line.product_qty,
          price_unit: line.price_unit,
          ...(line.product_uom_id ? { product_uom_id: line.product_uom_id } : {}),
        },
      ]);
    }
  }
  if (input.updateLines) {
    for (const line of input.updateLines) {
      const lineVals: Record<string, unknown> = {};
      if (line.product_qty !== undefined) lineVals.product_qty = line.product_qty;
      if (line.price_unit !== undefined) lineVals.price_unit = line.price_unit;
      lineCommands.push([1, line.id, lineVals]);
    }
  }
  if (input.deleteLineIds) {
    for (const lineId of input.deleteLineIds) {
      lineCommands.push([2, lineId, 0]);
    }
  }
  if (lineCommands.length > 0) {
    vals.line_ids = lineCommands;
  }

  return executeKw<boolean>("purchase.requisition", "write", [[input.id], vals]);
}

// ─── Sales Agreement CRUD ─────────────────────────────────────────────────

export interface CreateSalesAgreementInput {
  name: string;
  partner_id: number;
  company_id?: number;
  x_studio_customer?: number;
  x_studio_ultimate_customer?: string;
  x_studio_sales_incoterm_condition?: string;
  x_studio_sales_currency?: string;
  x_studio_insurance_included?: boolean;
  x_studio_total_po_quantity_in_tons?: number;
  x_studio_supply_start_date?: string;
  x_studio_supply_end_date?: string;
  x_studio_notes?: string;
  x_studio_payment_terms?: string;
  number_of_days?: number;
  lines?: {
    product_id: number;
    product_uom_qty: number;
    price_unit: number;
    product_uom_id?: number;
  }[];
}

/**
 * Create a sales agreement in Odoo.
 */
export async function createSalesAgreement(
  input: CreateSalesAgreementInput
): Promise<number> {
  const vals: Record<string, unknown> = {
    name: input.name,
    partner_id: input.partner_id,
  };

  if (input.company_id) vals.company_id = input.company_id;
  if (input.x_studio_customer) vals.x_studio_customer = input.x_studio_customer;
  if (input.x_studio_ultimate_customer) vals.x_studio_ultimate_customer = input.x_studio_ultimate_customer;
  if (input.x_studio_sales_incoterm_condition) vals.x_studio_sales_incoterm_condition = input.x_studio_sales_incoterm_condition;
  if (input.x_studio_sales_currency) vals.x_studio_sales_currency = input.x_studio_sales_currency;
  if (input.x_studio_insurance_included !== undefined) vals.x_studio_insurance_included = input.x_studio_insurance_included;
  if (input.x_studio_total_po_quantity_in_tons !== undefined) vals.x_studio_total_po_quantity_in_tons = input.x_studio_total_po_quantity_in_tons;
  if (input.x_studio_supply_start_date) vals.x_studio_supply_start_date = input.x_studio_supply_start_date;
  if (input.x_studio_notes) vals.x_studio_notes = input.x_studio_notes;
  if (input.x_studio_payment_terms) vals.x_studio_payment_terms = input.x_studio_payment_terms;
  if (input.number_of_days !== undefined) vals.number_of_days = input.number_of_days;

  // Product lines: use Odoo one2many command [0, 0, vals] to create new lines
  if (input.lines && input.lines.length > 0) {
    vals.sale_order_template_line_ids = input.lines.map(l => [
      0, 0, {
        product_id: l.product_id,
        product_uom_qty: l.product_uom_qty,
        price_unit: l.price_unit,
        ...(l.product_uom_id ? { product_uom_id: l.product_uom_id } : {}),
      },
    ]);
  }

  return executeKw<number>("sale.order.template", "create", [vals]);
}

export interface UpdateSalesAgreementInput {
  id: number;
  name?: string;
  partner_id?: number;
  x_studio_customer?: number;
  x_studio_ultimate_customer?: string;
  x_studio_sales_incoterm_condition?: string;
  x_studio_sales_currency?: string;
  x_studio_insurance_included?: boolean;
  x_studio_total_po_quantity_in_tons?: number;
  x_studio_supply_start_date?: string;
  x_studio_supply_end_date?: string;
  x_studio_notes?: string;
  x_studio_payment_terms?: string;
  number_of_days?: number;
  addLines?: {
    product_id: number;
    product_uom_qty: number;
    price_unit: number;
    product_uom_id?: number;
  }[];
  updateLines?: {
    id: number;
    product_uom_qty?: number;
    price_unit?: number;
  }[];
  deleteLineIds?: number[];
}

/**
 * Update a sales agreement in Odoo.
 */
export async function updateSalesAgreement(
  input: UpdateSalesAgreementInput
): Promise<boolean> {
  const vals: Record<string, unknown> = {};

  if (input.name !== undefined) vals.name = input.name;
  if (input.partner_id !== undefined) vals.partner_id = input.partner_id;
  if (input.x_studio_customer !== undefined) vals.x_studio_customer = input.x_studio_customer;
  if (input.x_studio_ultimate_customer !== undefined) vals.x_studio_ultimate_customer = input.x_studio_ultimate_customer;
  if (input.x_studio_sales_incoterm_condition !== undefined) vals.x_studio_sales_incoterm_condition = input.x_studio_sales_incoterm_condition;
  if (input.x_studio_sales_currency !== undefined) vals.x_studio_sales_currency = input.x_studio_sales_currency;
  if (input.x_studio_insurance_included !== undefined) vals.x_studio_insurance_included = input.x_studio_insurance_included;
  if (input.x_studio_total_po_quantity_in_tons !== undefined) vals.x_studio_total_po_quantity_in_tons = input.x_studio_total_po_quantity_in_tons;
  if (input.x_studio_supply_start_date !== undefined) vals.x_studio_supply_start_date = input.x_studio_supply_start_date;
  if (input.x_studio_notes !== undefined) vals.x_studio_notes = input.x_studio_notes;
  if (input.x_studio_payment_terms !== undefined) vals.x_studio_payment_terms = input.x_studio_payment_terms;
  if (input.number_of_days !== undefined) vals.number_of_days = input.number_of_days;

  // Product lines: use Odoo one2many commands
  const lineCommands: unknown[] = [];
  if (input.addLines) {
    for (const line of input.addLines) {
      lineCommands.push([0, 0, {
        product_id: line.product_id,
        product_uom_qty: line.product_uom_qty,
        price_unit: line.price_unit,
        ...(line.product_uom_id ? { product_uom_id: line.product_uom_id } : {}),
      }]);
    }
  }
  if (input.updateLines) {
    for (const line of input.updateLines) {
      const lineVals: Record<string, unknown> = {};
      if (line.product_uom_qty !== undefined) lineVals.product_uom_qty = line.product_uom_qty;
      if (line.price_unit !== undefined) lineVals.price_unit = line.price_unit;
      lineCommands.push([1, line.id, lineVals]);
    }
  }
  if (input.deleteLineIds) {
    for (const lineId of input.deleteLineIds) {
      lineCommands.push([2, lineId, 0]);
    }
  }
  if (lineCommands.length > 0) {
    vals.sale_order_template_line_ids = lineCommands;
  }

  return executeKw<boolean>("sale.order.template", "write", [[input.id], vals]);
}

// ─── Taxes ────────────────────────────────────────────────────────────────

export interface OdooTax {
  id: number;
  name: string;
  amount: number;
  amount_type: string;
  type_tax_use: string;
  company_id: [number, string] | false;
  active: boolean;
}

/**
 * Fetch account.tax records from Odoo.
 * Optionally filter by company and/or use type (sale/purchase).
 * Returns taxes sorted by amount ascending.
 */
export async function fetchTaxes(
  companyId?: number,
  taxUse?: "sale" | "purchase"
): Promise<OdooTax[]> {
  const domain: unknown[][] = [["active", "=", true]];
  if (companyId) domain.push(["company_id", "=", companyId]);
  if (taxUse) domain.push(["type_tax_use", "=", taxUse]);

  const taxes = await executeKw<OdooTax[]>("account.tax", "search_read", [domain], {
    fields: ["id", "name", "amount", "amount_type", "type_tax_use", "company_id", "active"],
    limit: 200,
  });

  return taxes.sort((a, b) => a.amount - b.amount);
}

/**
 * Find the best matching tax ID for a given rate, company, and use type.
 * Returns the tax ID or null if no match found.
 * Prefers taxes whose name contains "S" (standard) over specialized emirate taxes.
 */
export function findTaxIdByRate(
  taxes: OdooTax[],
  rate: number,
  companyId: number,
  taxUse: "sale" | "purchase"
): number | null {
  // Filter taxes matching company, use type, and rate
  const matches = taxes.filter(
    (t) =>
      t.amount === rate &&
      t.type_tax_use === taxUse &&
      t.company_id &&
      (t.company_id as [number, string])[0] === companyId
  );

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0].id;

  // For 0% rate, prefer "Tax Exempt" or "Exempt"
  if (rate === 0) {
    const exempt = matches.find(
      (t) => t.name.toLowerCase().includes("exempt")
    );
    if (exempt) return exempt.id;
  }

  // For purchase, prefer the generic one (shorter name or just "%")
  if (taxUse === "purchase") {
    // Prefer generic purchase tax (e.g., "5%" over "5% S")
    const generic = matches.find((t) => t.name.trim().match(/^\d+%$/));
    if (generic) return generic.id;
    // Otherwise prefer one with "S" in name
    const withS = matches.find((t) => t.name.includes(" S"));
    if (withS) return withS.id;
  }

  // For sale, prefer the one with "S" in name (standard)
  if (taxUse === "sale") {
    const withS = matches.find((t) => t.name.includes(" S"));
    if (withS) return withS.id;
  }

  // Fallback: return first match
  return matches[0].id;
}

/**
 * Reset the cached uid (useful for testing or reconnection).
 */
export function resetOdooSession(): void {
  _uidPromise = null;
}

// ─── Internal Transfer (stock.picking) ──────────────────────────────────────

/**
 * Odoo standard internal transfer workflow:
 *   1. Create stock.picking (header) with picking_type_id, location_id, location_dest_id
 *   2. Create stock.move lines (one per product) linked to the picking
 *   3. action_confirm → confirms the picking (generates stock.move.line)
 *   4. Optionally button_validate → validates/processes the transfer
 *
 * This ensures Odoo handles all stock moves, accounting journal entries,
 * and inventory valuations through its standard process — no manual
 * stock.move or account.move creation.
 */

export interface CreateInternalTransferInput {
  /** Picking type ID for internal transfers (e.g. 66 for MWCP, 125 for CWDAK) */
  pickingTypeId: number;
  /** Source stock.location ID */
  locationId: number;
  /** Destination stock.location ID */
  locationDestId: number;
  /** Company ID (e.g. 3 for Cairo) */
  companyId: number;
  /** Scheduled date (ISO string) — defaults to now */
  scheduledDate?: string;
  /** Origin reference (free text, e.g. "Portal Transfer DAK→SOK") */
  origin?: string;
  /** Move lines: one per product */
  lines: {
    productId: number;
    /** Quantity in the product's UoM (kg) */
    quantity: number;
    /** UoM ID (e.g. 12 for kg) */
    uomId: number;
    /** Optional: number of bales (stored in description) */
    bales?: number;
  }[];
  /** Whether to auto-confirm the picking after creation */
  autoConfirm?: boolean;
}

export interface CreateInternalTransferResult {
  pickingId: number;
  pickingName: string;
  state: string;
}

/**
 * Create an internal transfer in Odoo following the standard stock.picking workflow.
 * This is the ONLY correct way to move inventory between warehouses/locations.
 */
export async function createInternalTransfer(
  input: CreateInternalTransferInput
): Promise<CreateInternalTransferResult> {
  const {
    pickingTypeId,
    locationId,
    locationDestId,
    companyId,
    scheduledDate,
    origin,
    lines,
    autoConfirm = true,
  } = input;

  if (lines.length === 0) {
    throw new Error("At least one product line is required for the transfer");
  }

  // Step 1: Create the stock.picking header
  const pickingVals: Record<string, unknown> = {
    picking_type_id: pickingTypeId,
    location_id: locationId,
    location_dest_id: locationDestId,
    company_id: companyId,
    origin: origin || "Platfarm Portal Transfer",
    scheduled_date: scheduledDate || new Date().toISOString().replace("T", " ").slice(0, 19),
    // move_type: 'direct' means each product can be processed individually
    move_type: "direct",
  };

  const pickingId = await executeKw<number>(
    "stock.picking",
    "create",
    [pickingVals],
    { context: { default_company_id: companyId } }
  );

  if (!pickingId || typeof pickingId !== "number") {
    throw new Error("Failed to create stock.picking — Odoo returned: " + JSON.stringify(pickingId));
  }

  // Step 2: Create stock.move lines for each product
  for (const line of lines) {
    const description = line.bales
      ? `${line.bales} bales — Portal Transfer`
      : "Portal Transfer";

    const moveVals: Record<string, unknown> = {
      name: description,
      picking_id: pickingId,
      product_id: line.productId,
      product_uom_qty: line.quantity,
      product_uom: line.uomId,
      location_id: locationId,
      location_dest_id: locationDestId,
      company_id: companyId,
    };

    const moveId = await executeKw<number>(
      "stock.move",
      "create",
      [moveVals],
      { context: { default_company_id: companyId } }
    );

    if (!moveId || typeof moveId !== "number") {
      throw new Error(`Failed to create stock.move for product ${line.productId}`);
    }
  }

  // Step 3: Confirm the picking (Odoo standard workflow)
  // action_confirm generates stock.move.line records and reserves stock
  if (autoConfirm) {
    await executeKw(
      "stock.picking",
      "action_confirm",
      [[pickingId]],
      { context: { default_company_id: companyId } }
    );
  }

  // Step 4: Validate the picking (complete the transfer in one step)
  // button_validate processes the picking through Odoo's standard workflow:
  // stock.move validation, quant updates, accounting entries, valuation
  if (autoConfirm) {
    try {
      await executeKw(
        "stock.picking",
        "button_validate",
        [[pickingId]],
        { context: { default_company_id: companyId, skip_backorder: true } }
      );
    } catch (err: any) {
      // Log but don't fail — the picking is at least confirmed
      console.warn(`[Odoo] button_validate warning for picking ${pickingId}:`, err?.message || err);
    }
  }

  // Read back the picking to get its name and state
  const [picking] = await executeKw<{
    id: number;
    name: string;
    state: string;
  }[]>(
    "stock.picking",
    "read",
    [[pickingId]],
    { fields: ["id", "name", "state"] }
  );

  return {
    pickingId: picking.id,
    pickingName: picking.name || `INT/${pickingId}`,
    state: picking.state,
  };
}

/**
 * Validate (process) an existing confirmed stock.picking.
 * This completes the transfer and updates inventory in Odoo.
 * Only call this when the physical transfer is actually done.
 */
export async function validateInternalTransfer(
  pickingId: number,
  companyId: number = 3
): Promise<{ state: string }> {
  // button_validate processes the picking through Odoo's standard workflow
  // It handles: stock.move validation, quant updates, accounting entries, valuation
  await executeKw(
    "stock.picking",
    "button_validate",
    [[pickingId]],
    { context: { default_company_id: companyId, skip_backorder: true } }
  );

  const [picking] = await executeKw<{ id: number; state: string }[]>(
    "stock.picking",
    "read",
    [[pickingId]],
    { fields: ["id", "state"] }
  );

  return { state: picking.state };
}

/**
 * Search products for transfer — returns products available in the given company.
 * Optimized for the transfer wizard: includes UoM info.
 */
export async function searchTransferProducts(
  search: string,
  companyId: number = 3,
  limit: number = 30
): Promise<{ id: number; name: string; displayName: string; uomId: number; uomName: string }[]> {
  const domain: (unknown[] | string)[] = [
    ["type", "in", ["product", "consu"]],
  ];
  if (search) {
    domain.push(["name", "ilike", search]);
  }
  // Include products owned by this company OR shared (company_id = false)
  domain.push("|");
  domain.push(["company_id", "=", companyId]);
  domain.push(["company_id", "=", false]);

  const products = await executeKw<{
    id: number;
    name: string;
    display_name: string;
    uom_id: [number, string];
  }[]>("product.product", "search_read", [domain], {
    fields: ["id", "name", "display_name", "uom_id"],
    limit,
    order: "name asc",
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    displayName: p.display_name,
    uomId: p.uom_id[0],
    uomName: p.uom_id[1],
  }));
}
