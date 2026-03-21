/**
 * Operations Dashboard tRPC Router
 *
 * Provides lightweight, parallel endpoints for the Operations Dashboard:
 * - supply: incoming stock.picking data (source, weight, cost, quality)
 * - quality: quality metrics from stock.picking (protein, moisture, grade)
 * - production: mrp.production shift data (bale counts, grades, machine)
 * - export: outgoing stock.picking data (shipments, containers, customers)
 * - logistics: trucking costs, machine monitoring from production shifts
 *
 * Design principles:
 * - Each endpoint fetches ONLY the fields it needs (minimal payload)
 * - All sub-queries within an endpoint run in parallel (Promise.all)
 * - Lazy loading: queries only run when enabled by the frontend
 * - Caching: 5-minute TTL on all Odoo calls to prevent hammering
 * - Date field: x_studio_loading_datetime for supply/quality, x_studio_production_date_start_of_shift for production
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { executeKw } from "../odoo";

// ─── Date helpers ────────────────────────────────────────────────────────────
function getDateRange(period: string, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date();
  const to = customTo || now.toISOString().slice(0, 10);
  if (period === "custom" && customFrom) return { from: customFrom, to };
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : period === "ytd" ? Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000) : 90;
  const from = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

function stripCode(name: string | false | null): string {
  if (!name) return "Unknown";
  // Remove leading numeric/alphanumeric codes like "12345-" or "ABC123-"
  return name.replace(/^[\w\d]+-\s*/, "").trim() || String(name);
}

function cleanGrade(raw: string): string {
  if (!raw || raw === "Unknown") return "Unknown";
  // Replace underscores with spaces, title-case each word
  return raw.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()).trim();
}

/** Extract warehouse code from picking reference (e.g. "MWCP/RM/IN/00052" → "MWCP") */
function extractWarehouse(ref: string): string {
  if (!ref) return "Unknown";
  const prefix = ref.split("/")[0];
  // Known warehouse prefixes
  if (prefix === "MWCP" || prefix === "CWDAK" || prefix === "WH") return prefix;
  return prefix || "Unknown";
}

/** Keywords in product names that identify non-fodder items to exclude from supply/quality rankings */
const NON_FODDER_KEYWORDS = ["fuel", "diesel", "sleeve", "bag", "product--", "lubricant", "spare part", "chemical"];
function isFodderProduct(productName: string): boolean {
  const lower = productName.toLowerCase();
  return !NON_FODDER_KEYWORDS.some(kw => lower.includes(kw));
}

// ─── Simple in-memory cache ──────────────────────────────────────────────────
const _cache = new Map<string, { data: unknown; expires: number }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = _cache.get(key);
  if (hit && hit.expires > now) return hit.data as T;
  const data = await fn();
  _cache.set(key, { data, expires: now + ttlMs });
  return data;
}
const TTL = 5 * 60 * 1000; // 5 minutes
const FX_TTL = 60 * 60 * 1000; // 1 hour for FX rates

// ─── Live FX rate (EGP → USD) ────────────────────────────────────────────────
async function getEgpToUsd(): Promise<number> {
  return cached("fx_egp_usd", FX_TTL, async () => {
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/EGP", { signal: AbortSignal.timeout(8000) });
      const data = await res.json() as { rates?: { USD?: number } };
      const rate = data?.rates?.USD;
      if (rate && rate > 0) return rate;
    } catch { /* fall through to fallback */ }
    return 0.019; // fallback: ~52.6 EGP per USD (Mar 2026)
  });
}

/** Convert price to USD. If currency is already USD, return as-is. */
function toUsd(price: number, currencyCode: string, egpToUsd: number): number {
  if (!price || price <= 0) return 0;
  // Data quality: if labeled USD but price > 500/ton, it's clearly EGP (misclassified)
  // Normal alfalfa prices: Dakhla ~8,000-10,700 EGP/ton, Toshka ~$200-$250 USD/ton
  if (currencyCode === "USD" && price > 500) {
    // Treat as EGP — price is in EGP range but mislabeled as USD
    return price * egpToUsd;
  }
  // Data quality: exclude junk entries (price < $1/ton is clearly incomplete data)
  if (currencyCode === "USD" && price < 1) return 0;
  if (currencyCode === "USD") return price;
  // Treat anything else (EGP, etc.) as EGP
  return price * egpToUsd;
}

// ─── Input schema ─────────────────────────────────────────────────────────────
const OpsInput = z.object({
  companyId: z.number().optional(),
  period: z.string().default("90d"),
  customFrom: z.string().optional(),
  customTo: z.string().optional(),
  warehouseCode: z.string().optional(), // e.g. "MWCP", "CWDAK" — filter supply by warehouse
  locationId: z.number().optional(),   // filter supply by destination location ID
});

// ─── Supply section ───────────────────────────────────────────────────────────
// Uses stock.picking (incoming, done) with x_studio_loading_datetime as date
// Fields: source, net_weight, agreed_price, currency, grade, protein, moisture, trucking_fee, partner_id
const SUPPLY_FIELDS = [
  "id", "name", "partner_id", "company_id", "location_dest_id",
  "x_studio_loading_datetime", "scheduled_date",
  "x_studio_net_weight_in_tons",
  "agreed_product_price_per_unit", "x_studio_currency_id", "x_studio_purchase_currency",
  "x_studio_loaded_grade", "grade",
  "x_studio_crude_protein_dry_matter_", "cp_dry_matter_percentage", "x_studio_moisture_", "x_studio_ndf_", "nir_adf_percentage", "nir_ndf_percentage",
  "x_studio_trucking_fee", "x_studio_trucking_cost_currency",
  "x_studio_source", "x_studio_purchasing_unit",
  "product_id", "purchase_id",
];

async function fetchSupplyPickings(companyId: number | undefined, from: string, to: string) {
  const cacheKey = `ops_supply_${companyId || "all"}_${from}_${to}`;
  return cached(cacheKey, TTL, async () => {
    const domain: unknown[] = [
      ["picking_type_code", "=", "incoming"],
      ["state", "=", "done"],
    ];
    if (companyId) domain.push(["company_id", "=", companyId]);
    // Use OR logic: pick records where ANY date field falls in range
    // This catches CWDAK records that have no x_studio_loading_datetime but have scheduled_date/date_done
    domain.push(
      "|", "|",
      "&", ["x_studio_loading_datetime", ">=", from + " 00:00:00"], ["x_studio_loading_datetime", "<=", to + " 23:59:59"],
      "&", ["scheduled_date", ">=", from + " 00:00:00"], ["scheduled_date", "<=", to + " 23:59:59"],
      "&", ["date_done", ">=", from + " 00:00:00"], ["date_done", "<=", to + " 23:59:59"],
    );
    const pickings = await executeKw<any[]>("stock.picking", "search_read", [domain], {
      fields: [...SUPPLY_FIELDS, "date_done", "scheduled_date"],
      limit: 3000,
      order: "x_studio_loading_datetime desc, date_done desc",
    });

    // Always use stock.move.line quantity as authoritative weight source (with UOM-aware kg→ton conversion)
    // The picking header x_studio_net_weight_in_tons can have data entry errors (e.g. 7254 instead of 7.254)
    const allPickingIds = pickings.map(p => p.id);
    try {
      const moveLines = await executeKw<any[]>("stock.move.line", "search_read", [
        [["picking_id", "in", allPickingIds], ["state", "=", "done"]]
      ], {
        fields: ["picking_id", "quantity", "product_uom_id"],
        limit: 10000,
      });
      // Sum quantity per picking_id, convert kg to tons
      const qtyByPicking: Record<number, number> = {};
      for (const ml of moveLines) {
        const pickId = Array.isArray(ml.picking_id) ? ml.picking_id[0] : ml.picking_id;
        const uom = Array.isArray(ml.product_uom_id) ? ml.product_uom_id[1] : "";
        const qty = ml.quantity || 0;
        // Convert to tons: if UoM is kg, divide by 1000; if already tons, use as-is
        const tons = uom.toLowerCase().includes("ton") ? qty : qty / 1000;
        qtyByPicking[pickId] = (qtyByPicking[pickId] || 0) + tons;
      }
      // Override picking weight with move line quantity for all pickings
      for (const p of pickings) {
        if (qtyByPicking[p.id]) {
          p.x_studio_net_weight_in_tons = Math.round(qtyByPicking[p.id] * 1000) / 1000;
        }
        // If no move lines found, fall back to header value (keep as-is)
      }
    } catch (err) {
      // Non-critical: if move line fetch fails, we still have the header data
      console.warn("[Operations] Failed to fetch stock.move.line weights:", err);
    }

    // Enrich pickings: fetch ALL PO lines for all pickings with a purchase_id
    // This covers: (1) price enrichment for CWDAK receipts, (2) trucking cost from non-fodder PO lines
    const pickingsWithPo = pickings.filter(p => p.purchase_id);
    if (pickingsWithPo.length > 0) {
      try {
        const allPoIds = [...new Set(pickingsWithPo.map(p => Array.isArray(p.purchase_id) ? p.purchase_id[0] : p.purchase_id))];
        const poLines = await executeKw<any[]>("purchase.order.line", "search_read", [
          [["order_id", "in", allPoIds]]
        ], {
          fields: ["order_id", "price_unit", "price_subtotal", "product_uom", "currency_id", "product_id", "name"],
          limit: 10000,
        });

        // Build maps: poId → fodder price, poId → trucking cost (EGP)
        const priceByPo: Record<number, { pricePerKg: number; currency: string }> = {};
        const truckingByPo: Record<number, number> = {}; // poId → trucking cost in EGP

        for (const line of poLines) {
          const poId = Array.isArray(line.order_id) ? line.order_id[0] : line.order_id;
          const productName = (Array.isArray(line.product_id) ? line.product_id[1] : (line.name || "")).toLowerCase();
          const uom = Array.isArray(line.product_uom) ? line.product_uom[1] : (line.product_uom || "");
          const currency = Array.isArray(line.currency_id) ? line.currency_id[1] : (line.currency_id || "EGP");

          // Identify trucking cost lines by product name keywords
          const isTrucking = productName.includes("trucking") || productName.includes("freight") || productName.includes("transport");

          if (isTrucking) {
            // Trucking cost: use price_subtotal (total for this line), accumulate per PO
            const subtotal = line.price_subtotal || 0;
            truckingByPo[poId] = (truckingByPo[poId] || 0) + subtotal;
          } else {
            // Fodder price: use price_unit with UoM conversion
            if (!priceByPo[poId]) {
              const pricePerKg = uom.toLowerCase().includes("ton") ? line.price_unit / 1000 : line.price_unit;
              priceByPo[poId] = { pricePerKg, currency };
            }
          }
        }

        // Inject PO line price into pickings that have no agreed_product_price_per_unit
        for (const p of pickingsWithPo) {
          const poId = Array.isArray(p.purchase_id) ? p.purchase_id[0] : p.purchase_id;
          const poPrice = priceByPo[poId];
          if (poPrice && !p.agreed_product_price_per_unit && p.x_studio_net_weight_in_tons > 0) {
            p._po_price_per_ton = poPrice.pricePerKg * 1000;
            p._po_currency = poPrice.currency;
          }
          // Inject trucking cost from PO line (authoritative source)
          const truckingCost = truckingByPo[poId];
          if (truckingCost && truckingCost > 0) {
            p._po_trucking_cost_egp = truckingCost; // EGP, to be converted to USD in logistics procedure
          }
        }
      } catch (err) {
        console.warn("[Operations] Failed to fetch PO line prices:", err);
      }
    }

    return pickings;
  });
}

// ─── Production section ───────────────────────────────────────────────────────
// Uses mrp.production with x_studio_production_date_start_of_shift
const PROD_FIELDS = [
  "id", "name", "company_id",
  "x_studio_production_date_start_of_shift",
  "x_studio_input_material_source", "input_product_quality_grade",
  "average_input_big_bale_weight_kg",
  "no_produced_premium_bales", "no_produced_grade_1_bales",
  "no_produced_fair_grade_bales", "no_produced_alfamix_bales",
  "no_produced_mix_grass_bales", "no_produced_wheat_straw_bales",
  "x_studio_no_produced_supreme_bales", "x_studio_no_produced_fairgrade_3_bales",
  "qty_producing", "product_qty",
  "no_oil_measurements_during_shift", "maximum_oil_temperature",
  "diesel_consumption_liters",
  "state",
];

async function fetchProductionShifts(companyId: number | undefined, from: string, to: string) {
  const cacheKey = `ops_production_${companyId || "all"}_${from}_${to}`;
  return cached(cacheKey, TTL, async () => {
    const domain: unknown[] = [
      ["state", "in", ["done", "progress", "confirmed"]],
    ];
    if (companyId) domain.push(["company_id", "=", companyId]);
    domain.push(["x_studio_production_date_start_of_shift", ">=", from]);
    domain.push(["x_studio_production_date_start_of_shift", "<=", to]);
    return executeKw<any[]>("mrp.production", "search_read", [domain], {
      fields: PROD_FIELDS,
      limit: 2000,
      order: "x_studio_production_date_start_of_shift desc",
    });
  });
}

// ─── Export section ───────────────────────────────────────────────────────────
// Uses sale.order with etd_pol/date_order as date (export fields live on sale.order, not stock.picking)
const EXPORT_SO_FIELDS = [
  "id", "name", "partner_id", "company_id",
  "etd_pol", "date_order",
  "x_studio_total_shipment_weight_in_tons_sales",
  "number_of_loads", "delivery_count",
  "x_studio_product_category",
  "x_studio_unified_shipment_status",
  "x_studio_ultimate_customer",
];

async function fetchExportOrders(companyId: number | undefined, from: string, to: string) {
  const cacheKey = `ops_export_${companyId || "all"}_${from}_${to}`;
  return cached(cacheKey, TTL, async () => {
    const domain: unknown[] = [
      ["state", "in", ["sale", "done"]],
    ];
    if (companyId) domain.push(["company_id", "=", companyId]);
    // Use OR filter: match if etd_pol OR date_order is in range
    domain.push(
      "|",
      "&", ["etd_pol", ">=", from], ["etd_pol", "<=", to],
      "&", ["date_order", ">=", from], ["date_order", "<=", to],
    );
    return executeKw<any[]>("sale.order", "search_read", [domain], {
      fields: EXPORT_SO_FIELDS,
      limit: 2000,
      order: "etd_pol desc",
    });
  });
}

// ─── Aggregation helpers ──────────────────────────────────────────────────────
function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function weekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  const yr = String(d.getFullYear()).slice(-2);
  return `W${weekNum}Y${yr}`;
}

// Sortable key for weeks: "2026-10" for W10Y26 — ensures chronological order
function weekSortKey(dateStr: string): string {
  const d = new Date(dateStr);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${d.getFullYear()}-${String(weekNum).padStart(2, "0")}`;
}

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const operationsRouter = router({
  // ── Supply Analytics ────────────────────────────────────────────────────────
  supply: publicProcedure.input(OpsInput).query(async ({ input }) => {
    const { from, to } = getDateRange(input.period, input.customFrom, input.customTo);
    const [allPickings, egpToUsd] = await Promise.all([
      fetchSupplyPickings(input.companyId, from, to),
      getEgpToUsd(),
    ]);

    // Collect available warehouses and locations from all pickings (for dropdown options)
    const warehouseOptions = new Map<string, string>(); // code → label
    const locationOptions = new Map<number, string>(); // id → name
    const warehouseToLocations = new Map<string, Map<number, string>>(); // wh code → {id → name}
    for (const p of allPickings) {
      const wh = extractWarehouse(p.name || "");
      if (wh && wh !== "Unknown") warehouseOptions.set(wh, wh);
      if (Array.isArray(p.location_dest_id) && p.location_dest_id[0]) {
        const locId = p.location_dest_id[0] as number;
        const locName = p.location_dest_id[1] as string;
        locationOptions.set(locId, locName);
        if (wh && wh !== "Unknown") {
          if (!warehouseToLocations.has(wh)) warehouseToLocations.set(wh, new Map());
          warehouseToLocations.get(wh)!.set(locId, locName);
        }
      }
    }

    // Apply warehouse/location filters (in-memory, after cached fetch)
    const pickings = allPickings.filter(p => {
      if (input.warehouseCode) {
        const wh = extractWarehouse(p.name || "");
        if (wh !== input.warehouseCode) return false;
      }
      if (input.locationId) {
        const locId = Array.isArray(p.location_dest_id) ? p.location_dest_id[0] : null;
        if (locId !== input.locationId) return false;
      }
      return true;
    });

    // Aggregate by source
    const bySource: Record<string, { tons: number; loads: number; avgProtein: number; proteinSum: number; proteinCount: number; avgPrice: number; costSum: number; costTons: number; priceSum: number; priceCount: number; refs: string[] }> = {};
    const bySupplier: Record<string, { name: string; tons: number; loads: number; avgProtein: number; proteinSum: number; proteinCount: number; avgPrice: number; costSum: number; costTons: number; priceSum: number; priceCount: number; refs: string[]; warehouses: Set<string>; sources: Set<string> }> = {};
    const byGrade: Record<string, { tons: number; refs: string[] }> = {};
    const dailyMap: Record<string, { tons: number; loads: number }> = {};
    const weeklyMap: Record<string, { label: string; tons: number; loads: number; refs: string[]; sources: Record<string, { tons: number; refs: string[] }> }> = {};
    // Weekly price/ton trend by source
    const weeklyPriceMap: Record<string, { label: string; sources: Record<string, { priceSum: number; tonsSum: number; refs: string[] }> }> = {};
    // Weekly price/ton trend by supplier
    const weeklySupplierPriceMap: Record<string, { label: string; suppliers: Record<string, { priceSum: number; tonsSum: number; refs: string[] }> }> = {};

    let totalTons = 0;
    let totalLoads = 0;
    let totalProteinSum = 0;
    let totalProteinCount = 0;
    let totalCostWeightedSum = 0; // Σ(price_usd × tons)
    let totalCostTons = 0;         // Σ(tons with price)

    for (const p of pickings) {
      // ── Fodder-only filter: skip non-animal-fodder products (diesel, sleeve bags, etc.) ──
      const productName = Array.isArray(p.product_id) ? (p.product_id[1] as string) : (typeof p.product_id === "string" ? p.product_id : "");
      if (productName && !isFodderProduct(productName)) continue;

      const tons = p.x_studio_net_weight_in_tons || 0;
      const source = p.x_studio_source || p.x_studio_purchasing_unit || "Unknown";
      const supplierRaw = Array.isArray(p.partner_id) ? p.partner_id[1] : "Unknown";
      const supplier = stripCode(supplierRaw);
      const supplierId = Array.isArray(p.partner_id) ? String(p.partner_id[0]) : "0";
      const grade = cleanGrade(p.x_studio_loaded_grade || p.grade || "Unknown");
      const protein = (p.cp_dry_matter_percentage && p.cp_dry_matter_percentage > 0) ? p.cp_dry_matter_percentage * 100 : (p.x_studio_crude_protein_dry_matter_ || 0);
      // Price: use agreed_product_price_per_unit if available; otherwise use PO line price (per ton)
      let price = 0;
      if (p.agreed_product_price_per_unit && p.agreed_product_price_per_unit > 0) {
        const currencyCode = Array.isArray(p.x_studio_purchase_currency) ? p.x_studio_purchase_currency[1] : (p.x_studio_currency_id ? (Array.isArray(p.x_studio_currency_id) ? p.x_studio_currency_id[1] : "EGP") : "EGP");
        price = toUsd(p.agreed_product_price_per_unit, currencyCode, egpToUsd);
      } else if (p._po_price_per_ton && p._po_price_per_ton > 0) {
        // _po_price_per_ton is in local currency per ton (from PO line price_unit × 1000)
        price = toUsd(p._po_price_per_ton, p._po_currency || "EGP", egpToUsd);
      }
      const dateStr = (p.x_studio_loading_datetime || p.scheduled_date || p.date_done || "").slice(0, 10);

      totalTons += tons;
      totalLoads += 1;

      const ref = p.name || `ID-${p.id}`;
      // By source
      if (!bySource[source]) bySource[source] = { tons: 0, loads: 0, avgProtein: 0, proteinSum: 0, proteinCount: 0, avgPrice: 0, costSum: 0, costTons: 0, priceSum: 0, priceCount: 0, refs: [] };
      bySource[source].tons += tons;
      bySource[source].loads += 1;
      bySource[source].refs.push(ref);
      if (protein > 0) { bySource[source].proteinSum += protein; bySource[source].proteinCount += 1; }
      if (price > 0 && tons > 0) { bySource[source].costSum += price * tons; bySource[source].costTons += tons; }

      // By supplier
      const warehouse = extractWarehouse(ref);
      if (!bySupplier[supplierId]) bySupplier[supplierId] = { name: supplier, tons: 0, loads: 0, avgProtein: 0, proteinSum: 0, proteinCount: 0, avgPrice: 0, costSum: 0, costTons: 0, priceSum: 0, priceCount: 0, refs: [], warehouses: new Set(), sources: new Set() };
      bySupplier[supplierId].warehouses.add(warehouse);
      bySupplier[supplierId].sources.add(source);
      bySupplier[supplierId].tons += tons;
      bySupplier[supplierId].loads += 1;
      bySupplier[supplierId].refs.push(ref);
      if (protein > 0) { bySupplier[supplierId].proteinSum += protein; bySupplier[supplierId].proteinCount += 1; }
      if (price > 0 && tons > 0) { bySupplier[supplierId].costSum += price * tons; bySupplier[supplierId].costTons += tons; }

      // By grade
      if (!byGrade[grade]) byGrade[grade] = { tons: 0, refs: [] };
      byGrade[grade].tons += tons;
      byGrade[grade].refs.push(ref);

      // Daily
      if (dateStr) {
        if (!dailyMap[dateStr]) dailyMap[dateStr] = { tons: 0, loads: 0 };
        dailyMap[dateStr].tons += tons;
        dailyMap[dateStr].loads += 1;
      }

      // Weekly
      if (dateStr) {
        const wkKey = weekSortKey(dateStr);
        const wkLabel = weekLabel(dateStr);
        if (!weeklyMap[wkKey]) weeklyMap[wkKey] = { label: wkLabel, tons: 0, loads: 0, refs: [], sources: {} };
        weeklyMap[wkKey].tons += tons;
        weeklyMap[wkKey].loads += 1;
        weeklyMap[wkKey].refs.push(ref);
        if (!weeklyMap[wkKey].sources[source]) weeklyMap[wkKey].sources[source] = { tons: 0, refs: [] };
        weeklyMap[wkKey].sources[source].tons += tons;
        weeklyMap[wkKey].sources[source].refs.push(ref);
      }

      // Weekly price/ton trend by source
      if (dateStr && price > 0 && tons > 0) {
        const wkKey = weekSortKey(dateStr);
        const wkLabel = weekLabel(dateStr);
        if (!weeklyPriceMap[wkKey]) weeklyPriceMap[wkKey] = { label: wkLabel, sources: {} };
        if (!weeklyPriceMap[wkKey].sources[source]) weeklyPriceMap[wkKey].sources[source] = { priceSum: 0, tonsSum: 0, refs: [] };
        weeklyPriceMap[wkKey].sources[source].priceSum += price * tons; // weighted price
        weeklyPriceMap[wkKey].sources[source].tonsSum += tons;
        weeklyPriceMap[wkKey].sources[source].refs.push(ref);
      }

      // Weekly price/ton trend by supplier
      if (dateStr && price > 0 && tons > 0 && supplier !== "Unknown") {
        const wkKey = weekSortKey(dateStr);
        const wkLabel = weekLabel(dateStr);
        if (!weeklySupplierPriceMap[wkKey]) weeklySupplierPriceMap[wkKey] = { label: wkLabel, suppliers: {} };
        if (!weeklySupplierPriceMap[wkKey].suppliers[supplier]) weeklySupplierPriceMap[wkKey].suppliers[supplier] = { priceSum: 0, tonsSum: 0, refs: [] };
        weeklySupplierPriceMap[wkKey].suppliers[supplier].priceSum += price * tons;
        weeklySupplierPriceMap[wkKey].suppliers[supplier].tonsSum += tons;
        weeklySupplierPriceMap[wkKey].suppliers[supplier].refs.push(ref);
      }

      if (protein > 0) { totalProteinSum += protein; totalProteinCount += 1; }
      if (price > 0 && tons > 0) { totalCostWeightedSum += price * tons; totalCostTons += tons; }
    }

    // Finalize averages (weighted: total_cost / total_tons)
    for (const s of Object.values(bySource)) {
      s.avgProtein = s.proteinCount > 0 ? s.proteinSum / s.proteinCount : 0;
      s.avgPrice = s.costTons > 0 ? s.costSum / s.costTons : 0;
    }
    for (const s of Object.values(bySupplier)) {
      s.avgProtein = s.proteinCount > 0 ? s.proteinSum / s.proteinCount : 0;
      s.avgPrice = s.costTons > 0 ? s.costSum / s.costTons : 0;
    }

    const sources = Object.entries(bySource)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.tons - a.tons);

    const suppliers = Object.values(bySupplier)
      .map(s => ({ ...s, warehouse: Array.from(s.warehouses).join(", "), warehouses: undefined, sources: Array.from(s.sources) }))
      .sort((a, b) => b.tons - a.tons)
      .slice(0, 20);

    const grades = Object.entries(byGrade)
      .map(([name, d]) => ({ name, tons: d.tons, refs: d.refs }))
      .sort((a, b) => b.tons - a.tons);

    const daily = Object.entries(dailyMap)
      .map(([date, d]) => ({ date, ...d }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Collect all sources that appear in weekly data
    const allWeeklySources = new Set<string>();
    for (const wk of Object.values(weeklyMap)) {
      for (const src of Object.keys(wk.sources)) allWeeklySources.add(src);
    }
    const weekly = Object.entries(weeklyMap)
      .map(([sortKey, d]) => {
        const row: Record<string, unknown> = { week: d.label, tons: Math.round(d.tons * 100) / 100, loads: d.loads, refs: d.refs, _sort: sortKey };
        for (const src of allWeeklySources) {
          const s = d.sources[src];
          row[src] = s ? Math.round(s.tons * 100) / 100 : 0;
          row[`${src}_refs`] = s ? s.refs : [];
        }
        return row;
      })
      .sort((a, b) => (a._sort as string).localeCompare(b._sort as string))
      .map(({ _sort, label, ...rest }) => rest);

    // Build weekly price trend
    const allPriceSources = new Set<string>();
    for (const wk of Object.values(weeklyPriceMap)) {
      for (const src of Object.keys(wk.sources)) allPriceSources.add(src);
    }
    const weeklyPriceTrend = Object.entries(weeklyPriceMap)
      .map(([sortKey, wk]) => {
        const row: Record<string, unknown> = { week: wk.label, _sort: sortKey };
        const allRefs: string[] = [];
        for (const src of allPriceSources) {
          const s = wk.sources[src];
          row[src] = s ? Math.round((s.priceSum / s.tonsSum) * 100) / 100 : null;
          row[`${src}_refs`] = s ? s.refs : [];
          if (s) allRefs.push(...s.refs);
        }
        row.refs = allRefs;
        return row;
      })
      .sort((a, b) => (a._sort as string).localeCompare(b._sort as string))
      .map(({ _sort, ...rest }) => rest);

    // Build weekly supplier price trend
    const allSupplierPriceNames = new Set<string>();
    for (const wk of Object.values(weeklySupplierPriceMap)) {
      for (const sup of Object.keys(wk.suppliers)) allSupplierPriceNames.add(sup);
    }
    const weeklySupplierPriceTrend = Object.entries(weeklySupplierPriceMap)
      .map(([sortKey, wk]) => {
        const row: Record<string, unknown> = { week: wk.label, _sort: sortKey };
        for (const sup of allSupplierPriceNames) {
          const s = wk.suppliers[sup];
          row[sup] = s ? Math.round((s.priceSum / s.tonsSum) * 100) / 100 : null;
          row[`${sup}_refs`] = s ? s.refs : [];
        }
        return row;
      })
      .sort((a, b) => (a._sort as string).localeCompare(b._sort as string))
      .map(({ _sort, ...rest }) => rest);

    return {
      totalTons: Math.round(totalTons * 100) / 100,
      totalLoads,
      avgProtein: totalProteinCount > 0 ? Math.round((totalProteinSum / totalProteinCount) * 100) / 100 : 0,
      avgCostPerTon: totalCostTons > 0 ? Math.round((totalCostWeightedSum / totalCostTons) * 100) / 100 : 0,
      egpToUsdRate: Math.round(egpToUsd * 10000) / 10000, // e.g. 0.019
      sources,
      suppliers,
      grades,
      daily,
      weekly,
      weeklySources: Array.from(allWeeklySources),
      weeklyPriceTrend,
      priceTrendSources: Array.from(allPriceSources),
      weeklySupplierPriceTrend,
      supplierPriceTrendNames: Array.from(allSupplierPriceNames),
      availableWarehouses: Array.from(warehouseOptions.entries()).map(([code, label]) => ({ code, label })).sort((a, b) => a.code.localeCompare(b.code)),
      availableLocations: Array.from(locationOptions.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      warehouseLocations: Object.fromEntries(
        Array.from(warehouseToLocations.entries()).map(([wh, locMap]) => [
          wh,
          Array.from(locMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
        ])
      ),
    };
  }),

  // ── Quality Analytics ────────────────────────────────────────────────────────
  quality: publicProcedure.input(OpsInput).query(async ({ input }) => {
    const { from, to } = getDateRange(input.period, input.customFrom, input.customTo);
    const pickings = await fetchSupplyPickings(input.companyId, from, to);

    // Only pickings with quality data
    const getProtein = (p: any) => (p.cp_dry_matter_percentage && p.cp_dry_matter_percentage > 0) ? p.cp_dry_matter_percentage * 100 : (p.x_studio_crude_protein_dry_matter_ || 0);
    const getMoisture = (p: any) => p.x_studio_moisture_ || 0;
    const getAdf = (p: any) => (p.nir_adf_percentage && p.nir_adf_percentage > 0) ? p.nir_adf_percentage * 100 : 0;
    const getNdf = (p: any) => (p.nir_ndf_percentage && p.nir_ndf_percentage > 0) ? p.nir_ndf_percentage * 100 : (p.x_studio_ndf_ || 0);
    const withQuality = pickings.filter(p => getProtein(p) > 0 || getMoisture(p) > 0 || getAdf(p) > 0 || getNdf(p) > 0);
    const withoutQuality = pickings.filter(p => !getProtein(p) && !getMoisture(p) && !getAdf(p) && !getNdf(p));

    // Protein distribution buckets
    const proteinBuckets: Record<string, { tons: number; refs: string[] }> = {
      "<16%": { tons: 0, refs: [] }, "16-18%": { tons: 0, refs: [] }, "18-20%": { tons: 0, refs: [] }, "20-22%": { tons: 0, refs: [] }, ">22%": { tons: 0, refs: [] },
    };
    // Moisture distribution
    const moistureBuckets: Record<string, { tons: number; refs: string[] }> = {
      "<10%": { tons: 0, refs: [] }, "10-12%": { tons: 0, refs: [] }, "12-14%": { tons: 0, refs: [] }, "14-16%": { tons: 0, refs: [] }, ">16%": { tons: 0, refs: [] },
    };

    const bySource: Record<string, { tons: number; proteinSum: number; proteinCount: number; moistureSum: number; moistureCount: number; adfSum: number; adfCount: number; ndfSum: number; ndfCount: number; refs: string[]; warehouses: Set<string> }> = {};
    const bySupplier: Record<string, { name: string; tons: number; proteinSum: number; proteinCount: number; moistureSum: number; moistureCount: number; adfSum: number; adfCount: number; ndfSum: number; ndfCount: number; refs: string[]; warehouses: Set<string> }> = {};
    const byGrade: Record<string, { tons: number; proteinSum: number; count: number; refs: string[]; warehouses: Set<string> }> = {};
    const weeklyProtein: Record<string, { label: string; proteinSum: number; count: number; refs: string[]; allRefs: string[] }> = {};

    // Include ALL pickings in quality tables (show tonnage even if no quality data)
    for (const p of pickings) {
      // ── Fodder-only filter: skip non-animal-fodder products ──
      const productName = Array.isArray(p.product_id) ? (p.product_id[1] as string) : (typeof p.product_id === "string" ? p.product_id : "");
      if (productName && !isFodderProduct(productName)) continue;

      const protein = getProtein(p);
      const moisture = getMoisture(p);
      const adf = getAdf(p);
      const ndf = getNdf(p);
      const tons = p._fallback_tons ?? p.x_studio_net_weight_in_tons ?? 0;
      const source = p.x_studio_source || p.x_studio_purchasing_unit || "Unknown";
      const supplierRaw = Array.isArray(p.partner_id) ? p.partner_id[1] : "Unknown";
      const supplier = stripCode(supplierRaw);
      const supplierId = Array.isArray(p.partner_id) ? String(p.partner_id[0]) : "0";
      const grade = cleanGrade(p.x_studio_loaded_grade || p.grade || "Unknown");
      const dateStr = (p.x_studio_loading_datetime || p.scheduled_date || p.date_done || "").slice(0, 10);
      const ref = p.name || `ID-${p.id}`;

      // Protein bucket — only bucket records with actual protein data (> 0)
      if (protein > 0) {
        if (protein < 16) { proteinBuckets["<16%"].tons += tons; proteinBuckets["<16%"].refs.push(ref); }
        else if (protein < 18) { proteinBuckets["16-18%"].tons += tons; proteinBuckets["16-18%"].refs.push(ref); }
        else if (protein < 20) { proteinBuckets["18-20%"].tons += tons; proteinBuckets["18-20%"].refs.push(ref); }
        else if (protein < 22) { proteinBuckets["20-22%"].tons += tons; proteinBuckets["20-22%"].refs.push(ref); }
        else { proteinBuckets[">22%"].tons += tons; proteinBuckets[">22%"].refs.push(ref); }
      }

      // Moisture bucket — only bucket records with actual moisture data (> 0)
      if (moisture > 0) {
        if (moisture < 10) { moistureBuckets["<10%"].tons += tons; moistureBuckets["<10%"].refs.push(ref); }
        else if (moisture < 12) { moistureBuckets["10-12%"].tons += tons; moistureBuckets["10-12%"].refs.push(ref); }
        else if (moisture < 14) { moistureBuckets["12-14%"].tons += tons; moistureBuckets["12-14%"].refs.push(ref); }
        else if (moisture < 16) { moistureBuckets["14-16%"].tons += tons; moistureBuckets["14-16%"].refs.push(ref); }
        else { moistureBuckets[">16%"].tons += tons; moistureBuckets[">16%"].refs.push(ref); }
      }

      // By source
      const wh = extractWarehouse(ref);
      if (!bySource[source]) bySource[source] = { tons: 0, proteinSum: 0, proteinCount: 0, moistureSum: 0, moistureCount: 0, adfSum: 0, adfCount: 0, ndfSum: 0, ndfCount: 0, refs: [], warehouses: new Set() };
      bySource[source].tons += tons;
      bySource[source].refs.push(ref);
      bySource[source].warehouses.add(wh);
      if (protein > 0) { bySource[source].proteinSum += protein; bySource[source].proteinCount += 1; }
      if (moisture > 0) { bySource[source].moistureSum += moisture; bySource[source].moistureCount += 1; }
      if (adf > 0) { bySource[source].adfSum += adf; bySource[source].adfCount += 1; }
      if (ndf > 0) { bySource[source].ndfSum += ndf; bySource[source].ndfCount += 1; }

      // By supplier
      if (!bySupplier[supplierId]) bySupplier[supplierId] = { name: supplier, tons: 0, proteinSum: 0, proteinCount: 0, moistureSum: 0, moistureCount: 0, adfSum: 0, adfCount: 0, ndfSum: 0, ndfCount: 0, refs: [], warehouses: new Set() };
      bySupplier[supplierId].tons += tons;
      bySupplier[supplierId].refs.push(ref);
      bySupplier[supplierId].warehouses.add(wh);
      if (protein > 0) { bySupplier[supplierId].proteinSum += protein; bySupplier[supplierId].proteinCount += 1; }
      if (moisture > 0) { bySupplier[supplierId].moistureSum += moisture; bySupplier[supplierId].moistureCount += 1; }
      if (adf > 0) { bySupplier[supplierId].adfSum += adf; bySupplier[supplierId].adfCount += 1; }
      if (ndf > 0) { bySupplier[supplierId].ndfSum += ndf; bySupplier[supplierId].ndfCount += 1; }

      // By grade
      if (!byGrade[grade]) byGrade[grade] = { tons: 0, proteinSum: 0, count: 0, refs: [], warehouses: new Set() };
      byGrade[grade].tons += tons;
      byGrade[grade].refs.push(ref);
      byGrade[grade].warehouses.add(wh);
      if (protein > 0) { byGrade[grade].proteinSum += protein; byGrade[grade].count += 1; }

      // Weekly protein trend
      if (dateStr) {
        const wkKey = weekSortKey(dateStr);
        const wkLabel = weekLabel(dateStr);
        if (!weeklyProtein[wkKey]) weeklyProtein[wkKey] = { label: wkLabel, proteinSum: 0, count: 0, refs: [], allRefs: [] };
        weeklyProtein[wkKey].allRefs.push(ref);
        if (protein > 0) { weeklyProtein[wkKey].proteinSum += protein; weeklyProtein[wkKey].count += 1; weeklyProtein[wkKey].refs.push(ref); }
      }
    }

    const sourceQuality = Object.entries(bySource).map(([name, d]) => ({
      name,
      tons: Math.round(d.tons * 100) / 100,
      avgProtein: d.proteinCount > 0 ? Math.round((d.proteinSum / d.proteinCount) * 100) / 100 : 0,
      avgMoisture: d.moistureCount > 0 ? Math.round((d.moistureSum / d.moistureCount) * 100) / 100 : 0,
      avgAdf: d.adfCount > 0 ? Math.round((d.adfSum / d.adfCount) * 100) / 100 : 0,
      avgNdf: d.ndfCount > 0 ? Math.round((d.ndfSum / d.ndfCount) * 100) / 100 : 0,
      refs: d.refs,
      warehouses: Array.from(d.warehouses).sort().join(", "),
    })).sort((a, b) => b.tons - a.tons);

    const supplierQuality = Object.values(bySupplier).map(d => ({
      name: d.name,
      tons: Math.round(d.tons * 100) / 100,
      avgProtein: d.proteinCount > 0 ? Math.round((d.proteinSum / d.proteinCount) * 100) / 100 : 0,
      avgMoisture: d.moistureCount > 0 ? Math.round((d.moistureSum / d.moistureCount) * 100) / 100 : 0,
      avgAdf: d.adfCount > 0 ? Math.round((d.adfSum / d.adfCount) * 100) / 100 : 0,
      avgNdf: d.ndfCount > 0 ? Math.round((d.ndfSum / d.ndfCount) * 100) / 100 : 0,
      refs: d.refs,
      warehouses: Array.from(d.warehouses).sort().join(", "),
    })).sort((a, b) => b.avgProtein - a.avgProtein).slice(0, 15);

    const gradeQuality = Object.entries(byGrade).map(([name, d]) => ({
      name,
      tons: Math.round(d.tons * 100) / 100,
      avgProtein: d.count > 0 ? Math.round((d.proteinSum / d.count) * 100) / 100 : 0,
      refs: d.refs,
      warehouses: Array.from(d.warehouses).sort().join(", "),
    })).sort((a, b) => b.tons - a.tons);

    const weeklyProteinTrend = Object.entries(weeklyProtein)
      .map(([sortKey, d]) => ({
        week: d.label,
        avgProtein: d.count > 0 ? Math.round((d.proteinSum / d.count) * 100) / 100 : 0,
        refs: d.allRefs, // show ALL loads in tooltip, not just those with protein
        proteinRefs: d.refs, // refs that actually have protein data
        loadCount: d.allRefs.length,
        proteinCount: d.count,
        _sort: sortKey,
      }))
      .sort((a, b) => a._sort.localeCompare(b._sort))
      .map(({ _sort, ...rest }) => rest);

    const totalWithQuality = withQuality.length;
    const totalWithoutQuality = withoutQuality.length;
    const totalPickings = pickings.length;

    return {
      totalPickings,
      totalWithQuality,
      totalWithoutQuality,
      qualityCompletionRate: totalPickings > 0 ? Math.round((totalWithQuality / totalPickings) * 100) : 0,
      proteinBuckets: Object.entries(proteinBuckets).map(([range, d]) => ({ range, tons: Math.round(d.tons * 100) / 100, refs: d.refs })),
      moistureBuckets: Object.entries(moistureBuckets).map(([range, d]) => ({ range, tons: Math.round(d.tons * 100) / 100, refs: d.refs })),
      sourceQuality,
      supplierQuality,
      gradeQuality,
      weeklyProteinTrend,
    };
  }),

  // ── Production Analytics ─────────────────────────────────────────────────────
  production: publicProcedure.input(OpsInput).query(async ({ input }) => {
    const { from, to } = getDateRange(input.period, input.customFrom, input.customTo);
    const shifts = await fetchProductionShifts(input.companyId, from, to);

    // Fetch bale quality logs for protein trend
    const baleQualityLogs = await cached(`ops_bale_quality_${input.companyId || "all"}_${from}_${to}`, TTL, async () => {
      const domain: any[] = [
        ["x_studio_date", ">=", from],
        ["x_studio_date", "<=", to],
        ["x_studio_crude_protein_dry_matter_", ">", 0],
      ];
      if (input.companyId) domain.push(["x_studio_company_id", "=", input.companyId]);
      return executeKw<any[]>("x_bale_quality_log", "search_read", [domain], {
        fields: ["id", "x_name", "x_studio_date", "x_studio_crude_protein_dry_matter_", "x_studio_grade", "x_studio_moisture_", "x_studio_adf_", "x_studio_ndf_", "x_studio_rfv"],
        limit: 5000,
        order: "x_studio_date asc",
      });
    });

    // Fetch all bale weights (no protein filter) for distribution chart
    const baleWeightLogs = await cached(`ops_bale_weights_${input.companyId || "all"}_${from}_${to}`, TTL, async () => {
      const domain: any[] = [
        ["x_studio_date", ">=", from],
        ["x_studio_date", "<=", to],
        ["x_studio_bale_weight_in_kg", ">", 0],
      ];
      if (input.companyId) domain.push(["x_studio_company_id", "=", input.companyId]);
      return executeKw<any[]>("x_bale_quality_log", "search_read", [domain], {
        fields: ["id", "x_name", "x_studio_bale_weight_in_kg"],
        limit: 10000,
      });
    });

    // Build bale weight distribution from individual bale records
    const baleWeightBucketsFromQuality: Record<string, { count: number; refs: string[] }> = {
      "<350kg": { count: 0, refs: [] }, "350-375kg": { count: 0, refs: [] }, "375-400kg": { count: 0, refs: [] }, "400-425kg": { count: 0, refs: [] }, "425-450kg": { count: 0, refs: [] }, ">450kg": { count: 0, refs: [] },
    };
    for (const b of baleWeightLogs) {
      const w = b.x_studio_bale_weight_in_kg || 0;
      const ref = b.x_name || `BQ-${b.id}`;
      if (w <= 0) continue;
      if (w < 350) { baleWeightBucketsFromQuality["<350kg"].count += 1; baleWeightBucketsFromQuality["<350kg"].refs.push(ref); }
      else if (w < 375) { baleWeightBucketsFromQuality["350-375kg"].count += 1; baleWeightBucketsFromQuality["350-375kg"].refs.push(ref); }
      else if (w < 400) { baleWeightBucketsFromQuality["375-400kg"].count += 1; baleWeightBucketsFromQuality["375-400kg"].refs.push(ref); }
      else if (w < 425) { baleWeightBucketsFromQuality["400-425kg"].count += 1; baleWeightBucketsFromQuality["400-425kg"].refs.push(ref); }
      else if (w < 450) { baleWeightBucketsFromQuality["425-450kg"].count += 1; baleWeightBucketsFromQuality["425-450kg"].refs.push(ref); }
      else { baleWeightBucketsFromQuality[">450kg"].count += 1; baleWeightBucketsFromQuality[">450kg"].refs.push(ref); }
    }

    // Aggregate bale quality protein by week
    const baleQualityWeeklyMap: Record<string, { label: string; proteinSum: number; count: number; refs: string[] }> = {};
    for (const b of baleQualityLogs) {
      const dateStr = (b.x_studio_date || "").slice(0, 10);
      if (!dateStr) continue;
      const protein = b.x_studio_crude_protein_dry_matter_ || 0;
      const ref = b.x_name || `BQ-${b.id}`;
      const wkKey = weekSortKey(dateStr);
      const wkLabel = weekLabel(dateStr);
      if (!baleQualityWeeklyMap[wkKey]) baleQualityWeeklyMap[wkKey] = { label: wkLabel, proteinSum: 0, count: 0, refs: [] };
      baleQualityWeeklyMap[wkKey].proteinSum += protein;
      baleQualityWeeklyMap[wkKey].count += 1;
      baleQualityWeeklyMap[wkKey].refs.push(ref);
    }
    const weeklyBaleProteinTrend = Object.entries(baleQualityWeeklyMap)
      .map(([sortKey, d]) => ({ week: d.label, avgProtein: d.count > 0 ? Math.round((d.proteinSum / d.count) * 10) / 10 : 0, count: d.count, refs: d.refs, _sort: sortKey }))
      .sort((a, b) => a._sort.localeCompare(b._sort))
      .map(({ _sort, ...rest }) => rest);

    let totalShifts = 0;
    let totalPremium = 0, totalGrade1 = 0, totalFairGrade = 0, totalAlfamix = 0;
    let totalMixGrass = 0, totalWheatStraw = 0, totalSupreme = 0, totalFairGrade3 = 0;
    let totalDiesel = 0;
    let maxOilTemp = 0;
    let oilTempSum = 0, oilTempCount = 0;

    const dailyMap: Record<string, { premium: number; grade1: number; fairGrade: number; alfamix: number; supreme: number; total: number }> = {};
    const weeklyMap: Record<string, { label: string; total: number; premium: number; grade1: number }> = {};
    const inputSourceMap: Record<string, { shifts: number; avgBaleWeight: number; baleWeightSum: number; baleWeightCount: number; refs: string[] }> = {};
    const inputGradeMap: Record<string, { count: number; refs: string[] }> = {};

    // Bale weight distribution
    const baleWeightBuckets: Record<string, { count: number; refs: string[] }> = {
      "<350kg": { count: 0, refs: [] }, "350-375kg": { count: 0, refs: [] }, "375-400kg": { count: 0, refs: [] }, "400-425kg": { count: 0, refs: [] }, "425-450kg": { count: 0, refs: [] }, ">450kg": { count: 0, refs: [] },
    };
    // Grade-level refs for output distribution
    const gradeRefs: Record<string, string[]> = { Supreme: [], Premium: [], "Grade 1": [], "Fair Grade": [], "Fair Grade 3": [], Alfamix: [], "Mix Grass": [], "Wheat Straw": [] };

    for (const s of shifts) {
      totalShifts += 1;
      const shiftRef = s.name || `MO-${s.id}`;
      const premium = s.no_produced_premium_bales || 0;
      const grade1 = s.no_produced_grade_1_bales || 0;
      const fairGrade = s.no_produced_fair_grade_bales || 0;
      const alfamix = s.no_produced_alfamix_bales || 0;
      const mixGrass = s.no_produced_mix_grass_bales || 0;
      const wheatStraw = s.no_produced_wheat_straw_bales || 0;
      const supreme = s.x_studio_no_produced_supreme_bales || 0;
      const fairGrade3 = s.x_studio_no_produced_fairgrade_3_bales || 0;
      const totalBales = premium + grade1 + fairGrade + alfamix + mixGrass + wheatStraw + supreme + fairGrade3;
      const diesel = s.diesel_consumption_liters || 0;
      const oilTemp = s.maximum_oil_temperature || 0;
      const avgBaleWeight = s.average_input_big_bale_weight_kg || 0;
      const dateStr = (s.x_studio_production_date_start_of_shift || "").slice(0, 10);
      const source = s.x_studio_input_material_source || "Unknown";
      const inputGrade = s.input_product_quality_grade || "Unknown";

      totalPremium += premium;
      totalGrade1 += grade1;
      totalFairGrade += fairGrade;
      totalAlfamix += alfamix;
      totalMixGrass += mixGrass;
      totalWheatStraw += wheatStraw;
      totalSupreme += supreme;
      totalFairGrade3 += fairGrade3;
      totalDiesel += diesel;
      if (oilTemp > maxOilTemp) maxOilTemp = oilTemp;
      if (oilTemp > 0) { oilTempSum += oilTemp; oilTempCount += 1; }

      // Grade refs
      if (premium > 0) gradeRefs["Premium"].push(shiftRef);
      if (grade1 > 0) gradeRefs["Grade 1"].push(shiftRef);
      if (fairGrade > 0) gradeRefs["Fair Grade"].push(shiftRef);
      if (alfamix > 0) gradeRefs["Alfamix"].push(shiftRef);
      if (mixGrass > 0) gradeRefs["Mix Grass"].push(shiftRef);
      if (wheatStraw > 0) gradeRefs["Wheat Straw"].push(shiftRef);
      if (supreme > 0) gradeRefs["Supreme"].push(shiftRef);
      if (fairGrade3 > 0) gradeRefs["Fair Grade 3"].push(shiftRef);

      // Bale weight bucket
      if (avgBaleWeight > 0) {
        if (avgBaleWeight < 350) { baleWeightBuckets["<350kg"].count += 1; baleWeightBuckets["<350kg"].refs.push(shiftRef); }
        else if (avgBaleWeight < 375) { baleWeightBuckets["350-375kg"].count += 1; baleWeightBuckets["350-375kg"].refs.push(shiftRef); }
        else if (avgBaleWeight < 400) { baleWeightBuckets["375-400kg"].count += 1; baleWeightBuckets["375-400kg"].refs.push(shiftRef); }
        else if (avgBaleWeight < 425) { baleWeightBuckets["400-425kg"].count += 1; baleWeightBuckets["400-425kg"].refs.push(shiftRef); }
        else if (avgBaleWeight < 450) { baleWeightBuckets["425-450kg"].count += 1; baleWeightBuckets["425-450kg"].refs.push(shiftRef); }
        else { baleWeightBuckets[">450kg"].count += 1; baleWeightBuckets[">450kg"].refs.push(shiftRef); }
      }

      // Daily
      if (dateStr) {
        if (!dailyMap[dateStr]) dailyMap[dateStr] = { premium: 0, grade1: 0, fairGrade: 0, alfamix: 0, supreme: 0, total: 0 };
        dailyMap[dateStr].premium += premium;
        dailyMap[dateStr].grade1 += grade1;
        dailyMap[dateStr].fairGrade += fairGrade;
        dailyMap[dateStr].alfamix += alfamix;
        dailyMap[dateStr].supreme += supreme;
        dailyMap[dateStr].total += totalBales;
      }

      // Weekly
      if (dateStr) {
        const wkKey = weekSortKey(dateStr);
        const wkLabel = weekLabel(dateStr);
        if (!weeklyMap[wkKey]) weeklyMap[wkKey] = { label: wkLabel, total: 0, premium: 0, grade1: 0 };
        weeklyMap[wkKey].total += totalBales;
        weeklyMap[wkKey].premium += premium;
        weeklyMap[wkKey].grade1 += grade1;
      }

      // Input source
      if (!inputSourceMap[source]) inputSourceMap[source] = { shifts: 0, avgBaleWeight: 0, baleWeightSum: 0, baleWeightCount: 0, refs: [] };
      inputSourceMap[source].shifts += 1;
      inputSourceMap[source].refs.push(shiftRef);
      if (avgBaleWeight > 0) { inputSourceMap[source].baleWeightSum += avgBaleWeight; inputSourceMap[source].baleWeightCount += 1; }

      // Input grade
      if (!inputGradeMap[inputGrade]) inputGradeMap[inputGrade] = { count: 0, refs: [] };
      inputGradeMap[inputGrade].count += 1;
      inputGradeMap[inputGrade].refs.push(shiftRef);
    }

    // Finalize input source averages
    for (const s of Object.values(inputSourceMap)) {
      s.avgBaleWeight = s.baleWeightCount > 0 ? Math.round(s.baleWeightSum / s.baleWeightCount) : 0;
    }

    const totalOutputBales = totalPremium + totalGrade1 + totalFairGrade + totalAlfamix + totalMixGrass + totalWheatStraw + totalSupreme + totalFairGrade3;

    return {
      totalShifts,
      totalOutputBales,
      totalPremium,
      totalGrade1,
      totalFairGrade,
      totalAlfamix,
      totalMixGrass,
      totalWheatStraw,
      totalSupreme,
      totalFairGrade3,
      totalDiesel: Math.round(totalDiesel),
      avgOilTemp: oilTempCount > 0 ? Math.round(oilTempSum / oilTempCount) : 0,
      maxOilTemp,
      gradeDistribution: [
        { name: "Supreme", value: totalSupreme, color: "#7B2D8B", refs: gradeRefs["Supreme"] },
        { name: "Premium", value: totalPremium, color: "#2D5A3D", refs: gradeRefs["Premium"] },
        { name: "Grade 1", value: totalGrade1, color: "#4A7C59", refs: gradeRefs["Grade 1"] },
        { name: "Fair Grade", value: totalFairGrade, color: "#C0714A", refs: gradeRefs["Fair Grade"] },
        { name: "Fair Grade 3", value: totalFairGrade3, color: "#D4960A", refs: gradeRefs["Fair Grade 3"] },
        { name: "Alfamix", value: totalAlfamix, color: "#3B6CCF", refs: gradeRefs["Alfamix"] },
        { name: "Mix Grass", value: totalMixGrass, color: "#6B8E6B", refs: gradeRefs["Mix Grass"] },
        { name: "Wheat Straw", value: totalWheatStraw, color: "#B8A87A", refs: gradeRefs["Wheat Straw"] },
      ].filter(g => g.value > 0),
      baleWeightBuckets: Object.entries(baleWeightBucketsFromQuality).map(([range, d]) => ({ range, count: d.count, refs: d.refs })),
      daily: Object.entries(dailyMap)
        .map(([date, d]) => ({ date, ...d }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      weekly: Object.entries(weeklyMap)
        .map(([sortKey, d]) => ({ week: d.label, ...d, _sort: sortKey }))
        .sort((a, b) => a._sort.localeCompare(b._sort))
        .map(({ _sort, label, ...rest }) => rest),
      inputSources: Object.entries(inputSourceMap)
        .map(([name, d]) => ({ name, ...d }))
        .sort((a, b) => b.shifts - a.shifts),
      inputGrades: Object.entries(inputGradeMap)
        .map(([name, d]) => ({ name, count: d.count, refs: d.refs }))
        .sort((a, b) => b.count - a.count),
      weeklyBaleProteinTrend,
      totalBaleQualityRecords: baleQualityLogs.length,
    };
  }),

  // ── Export Analytics ─────────────────────────────────────────────────────────
  export: publicProcedure.input(OpsInput).query(async ({ input }) => {
    const { from, to } = getDateRange(input.period, input.customFrom, input.customTo);
    const orders = await fetchExportOrders(input.companyId, from, to);

    let totalShipments = 0;
    let totalContainers = 0;
    let totalTons = 0;

    const byCustomer: Record<string, { name: string; shipments: number; containers: number; tons: number; refs: string[] }> = {};
    const byUltimateCustomer: Record<string, { name: string; shipments: number; tons: number; refs: string[] }> = {};
    const byProduct: Record<string, { tons: number; shipments: number; refs: string[] }> = {};
    const weeklyMap: Record<string, { label: string; shipments: number; containers: number; tons: number }> = {};
    const monthlyMap: Record<string, { sortKey: string; label: string; shipments: number; containers: number; tons: number }> = {};

    for (const p of orders) {
      const tons = p.x_studio_total_shipment_weight_in_tons_sales || 0;
      const containers = p.number_of_loads || 0;
      const customerRaw = Array.isArray(p.partner_id) ? p.partner_id[1] : "Unknown";
      const customer = stripCode(customerRaw);
      const customerId = Array.isArray(p.partner_id) ? String(p.partner_id[0]) : "0";
      const ultimateCustomer = stripCode(p.x_studio_ultimate_customer || "");
      const product = p.x_studio_product_category || "Unknown";
      const dateStr = (p.etd_pol || (p.date_order || "").slice(0, 10) || "");

      const ref = p.name || `ID-${p.id}`;
      totalShipments += 1;
      totalContainers += containers;
      totalTons += tons;

      // By customer
      if (!byCustomer[customerId]) byCustomer[customerId] = { name: customer, shipments: 0, containers: 0, tons: 0, refs: [] };
      byCustomer[customerId].shipments += 1;
      byCustomer[customerId].containers += containers;
      byCustomer[customerId].tons += tons;
      byCustomer[customerId].refs.push(ref);

      // By ultimate customer
      if (ultimateCustomer && ultimateCustomer !== "Unknown") {
        if (!byUltimateCustomer[ultimateCustomer]) byUltimateCustomer[ultimateCustomer] = { name: ultimateCustomer, shipments: 0, tons: 0, refs: [] };
        byUltimateCustomer[ultimateCustomer].shipments += 1;
        byUltimateCustomer[ultimateCustomer].tons += tons;
        byUltimateCustomer[ultimateCustomer].refs.push(ref);
      }

      // By product
      if (!byProduct[product]) byProduct[product] = { tons: 0, shipments: 0, refs: [] };
      byProduct[product].tons += tons;
      byProduct[product].shipments += 1;
      byProduct[product].refs.push(ref);

      // Weekly
      if (dateStr) {
        const wkKey = weekSortKey(dateStr);
        const wkLabel = weekLabel(dateStr);
        if (!weeklyMap[wkKey]) weeklyMap[wkKey] = { label: wkLabel, shipments: 0, containers: 0, tons: 0 };
        weeklyMap[wkKey].shipments += 1;
        weeklyMap[wkKey].containers += containers;
        weeklyMap[wkKey].tons += tons;
      }

      // Monthly
      if (dateStr) {
        const moLabel = monthLabel(dateStr);
        const moSortKey = dateStr.slice(0, 7); // "2026-03" for chronological sort
        if (!monthlyMap[moSortKey]) monthlyMap[moSortKey] = { sortKey: moSortKey, label: moLabel, shipments: 0, containers: 0, tons: 0 };
        monthlyMap[moSortKey].shipments += 1;
        monthlyMap[moSortKey].containers += containers;
        monthlyMap[moSortKey].tons += tons;
      }
    }

    return {
      totalShipments,
      totalContainers,
      totalTons: Math.round(totalTons * 100) / 100,
      customers: Object.values(byCustomer)
        .map(c => ({ ...c, tons: Math.round(c.tons * 100) / 100 }))
        .sort((a, b) => b.tons - a.tons),
      ultimateCustomers: Object.values(byUltimateCustomer)
        .map(c => ({ ...c, tons: Math.round(c.tons * 100) / 100 }))
        .sort((a, b) => b.tons - a.tons),
      products: Object.entries(byProduct)
        .map(([name, d]) => ({ name, ...d, tons: Math.round(d.tons * 100) / 100 }))
        .sort((a, b) => b.tons - a.tons),
      weekly: Object.entries(weeklyMap)
        .map(([sortKey, d]) => ({ week: d.label, ...d, tons: Math.round(d.tons * 100) / 100, _sort: sortKey }))
        .sort((a, b) => a._sort.localeCompare(b._sort))
        .map(({ _sort, label, ...rest }) => rest),
      monthly: Object.entries(monthlyMap)
        .map(([, d]) => ({ month: d.label, shipments: d.shipments, containers: d.containers, tons: Math.round(d.tons * 100) / 100, _sort: d.sortKey }))
        .sort((a, b) => a._sort.localeCompare(b._sort))
        .map(({ _sort, ...rest }) => rest),
    };
  }),

  // ── Logistics Analytics ──────────────────────────────────────────────────────
  logistics: publicProcedure.input(OpsInput).query(async ({ input }) => {
    const { from, to } = getDateRange(input.period, input.customFrom, input.customTo);
    // Fetch supply pickings (trucking data) and production shifts (diesel/machine) in parallel
    const [pickings, shifts, egpToUsd] = await Promise.all([
      fetchSupplyPickings(input.companyId, from, to),
      fetchProductionShifts(input.companyId, from, to),
      getEgpToUsd(),
    ]);

    // Trucking cost by source
    const truckingBySource: Record<string, { tons: number; costTons: number; costSum: number; count: number; loads: number; refs: string[] }> = {};
    const truckingBySupplier: Record<string, { name: string; tons: number; costSum: number; count: number; refs: string[] }> = {};
    let totalTruckingCost = 0;
    let totalTruckingLoads = 0;
    let totalTruckingTons = 0;

    // Weekly trucking cost/ton trend by source
    const weeklyTruckingMap: Record<string, { label: string; sources: Record<string, { costSum: number; tonsSum: number }> }> = {};

    for (const p of pickings) {
      const tons = p.x_studio_net_weight_in_tons || 0;
      // Use PO trucking line subtotal as authoritative source (EGP), fall back to x_studio_trucking_fee
      const rawCost = (p._po_trucking_cost_egp || p.x_studio_trucking_fee || 0);
      // Trucking fees are in EGP — convert to USD
      const cost = rawCost > 0 ? rawCost * egpToUsd : 0;
      const source = p.x_studio_source || p.x_studio_purchasing_unit || "Unknown";
      const supplierRaw = Array.isArray(p.partner_id) ? p.partner_id[1] : "Unknown";
      const supplier = stripCode(supplierRaw);
      const supplierId = Array.isArray(p.partner_id) ? String(p.partner_id[0]) : "0";
      const dateStr = (p.x_studio_loading_datetime || p.scheduled_date || p.date_done || "").slice(0, 10);
      const ref = p.name || `ID-${p.id}`;

      if (!truckingBySource[source]) truckingBySource[source] = { tons: 0, costTons: 0, costSum: 0, count: 0, loads: 0, refs: [] };
      truckingBySource[source].tons += tons;
      truckingBySource[source].loads += 1;
      truckingBySource[source].refs.push(ref);
      if (cost > 0) { truckingBySource[source].costSum += cost; truckingBySource[source].count += 1; }
      if (cost > 0 && tons > 0) { truckingBySource[source].costTons += tons; }

      if (!truckingBySupplier[supplierId]) truckingBySupplier[supplierId] = { name: supplier, tons: 0, costSum: 0, count: 0, refs: [] };
      truckingBySupplier[supplierId].tons += tons;
      truckingBySupplier[supplierId].refs.push(ref);
      if (cost > 0) { truckingBySupplier[supplierId].costSum += cost; truckingBySupplier[supplierId].count += 1; }

      if (cost > 0) { totalTruckingCost += cost; totalTruckingLoads += 1; }
      if (cost > 0 && tons > 0) { totalTruckingTons += tons; }

      // Weekly trucking cost/ton trend
      if (dateStr && cost > 0 && tons > 0) {
        const wkKey = weekSortKey(dateStr);
        const wkLabel = weekLabel(dateStr);
        if (!weeklyTruckingMap[wkKey]) weeklyTruckingMap[wkKey] = { label: wkLabel, sources: {} };
        if (!weeklyTruckingMap[wkKey].sources[source]) weeklyTruckingMap[wkKey].sources[source] = { costSum: 0, tonsSum: 0 };
        weeklyTruckingMap[wkKey].sources[source].costSum += cost;
        weeklyTruckingMap[wkKey].sources[source].tonsSum += tons;
      }
    }

    // Machine monitoring from production shifts
    let totalDiesel = 0;
    let maxOilTemp = 0;
    let oilTempSum = 0, oilTempCount = 0;
    const weeklyMachine: Record<string, { label: string; diesel: number; maxOilTemp: number; shifts: number }> = {};

    for (const s of shifts) {
      const diesel = s.diesel_consumption_liters || 0;
      const oilTemp = s.maximum_oil_temperature || 0;
      const dateStr = (s.x_studio_production_date_start_of_shift || "").slice(0, 10);

      totalDiesel += diesel;
      if (oilTemp > maxOilTemp) maxOilTemp = oilTemp;
      if (oilTemp > 0) { oilTempSum += oilTemp; oilTempCount += 1; }

      if (dateStr) {
        const wkKey = weekSortKey(dateStr);
        const wkLabel = weekLabel(dateStr);
        if (!weeklyMachine[wkKey]) weeklyMachine[wkKey] = { label: wkLabel, diesel: 0, maxOilTemp: 0, shifts: 0 };
        weeklyMachine[wkKey].diesel += diesel;
        if (oilTemp > weeklyMachine[wkKey].maxOilTemp) weeklyMachine[wkKey].maxOilTemp = oilTemp;
        weeklyMachine[wkKey].shifts += 1;
      }
    }

    // Build trucking cost/ton per source (bar chart)
    const truckingCostPerTonBySource = Object.entries(truckingBySource)
      .filter(([, d]) => d.costTons > 0 && d.costSum > 0)
      .map(([name, d]) => ({
        name,
        costPerTon: Math.round((d.costSum / d.costTons) * 100) / 100,
        tons: Math.round(d.costTons * 100) / 100,
        totalCost: Math.round(d.costSum),
        refs: d.refs,
      }))
      .sort((a, b) => b.costPerTon - a.costPerTon);

    // Build weekly trucking cost/ton trend
    const allTruckingSources = new Set<string>();
    for (const wk of Object.values(weeklyTruckingMap)) {
      for (const src of Object.keys(wk.sources)) allTruckingSources.add(src);
    }
    const weeklyTruckingTrend = Object.entries(weeklyTruckingMap)
      .map(([sortKey, wk]) => {
        const row: Record<string, unknown> = { week: wk.label, _sort: sortKey };
        for (const src of allTruckingSources) {
          const s = wk.sources[src];
          row[src] = s ? Math.round((s.costSum / s.tonsSum) * 100) / 100 : null;
        }
        return row;
      })
      .sort((a, b) => (a._sort as string).localeCompare(b._sort as string))
      .map(({ _sort, ...rest }) => rest);

    // Build weekly trucking total cost by source trend (for bar chart)
    // Weekly cost/ton: total cost across all sources / total tons per week
    const weeklyTruckingCostTrend = Object.entries(weeklyTruckingMap)
      .map(([sortKey, wk]) => {
        let totalCost = 0, totalTons = 0;
        for (const s of Object.values(wk.sources)) {
          totalCost += s.costSum;
          totalTons += s.tonsSum;
        }
        const costPerTon = totalTons > 0 ? Math.round((totalCost / totalTons) * 100) / 100 : 0;
        return { week: wk.label, costPerTon, totalCost: Math.round(totalCost * 100) / 100, totalTons: Math.round(totalTons * 100) / 100, _sort: sortKey };
      })
      .sort((a, b) => a._sort.localeCompare(b._sort))
      .map(({ _sort, ...rest }) => rest);

    return {
      egpToUsdRate: Math.round(egpToUsd * 10000) / 10000,
      totalTruckingCost: Math.round(totalTruckingCost * 100) / 100,
      totalTruckingLoads,
      totalTruckingTons: Math.round(totalTruckingTons * 100) / 100,
      avgTruckingCostPerLoad: totalTruckingLoads > 0 ? Math.round(totalTruckingCost / totalTruckingLoads) : 0,
      avgTruckingCostPerTon: totalTruckingTons > 0 ? Math.round((totalTruckingCost / totalTruckingTons) * 100) / 100 : 0,
      totalDiesel: Math.round(totalDiesel),
      avgOilTemp: oilTempCount > 0 ? Math.round(oilTempSum / oilTempCount) : 0,
      maxOilTemp,
      truckingBySource: Object.entries(truckingBySource)
        .map(([name, d]) => ({ name, tons: Math.round(d.tons * 100) / 100, loads: d.loads, avgCost: d.count > 0 ? Math.round(d.costSum / d.count) : 0, refs: d.refs }))
        .sort((a, b) => b.tons - a.tons),
      truckingBySupplier: Object.values(truckingBySupplier)
        .map(d => ({ name: d.name, tons: Math.round(d.tons * 100) / 100, avgCost: d.count > 0 ? Math.round(d.costSum / d.count) : 0, refs: d.refs }))
        .sort((a, b) => b.tons - a.tons)
        .slice(0, 15),
      truckingCostPerTonBySource,
      // Avg weight per truck load by source
      truckingWeightBySource: Object.entries(truckingBySource)
        .filter(([, d]) => d.loads > 0)
        .map(([name, d]) => ({
          name,
          avgWeightPerLoad: Math.round((d.tons / d.loads) * 100) / 100,
          totalTons: Math.round(d.tons * 100) / 100,
          loads: d.loads,
          refs: d.refs,
        }))
        .sort((a, b) => b.avgWeightPerLoad - a.avgWeightPerLoad),
      weeklyTruckingTrend,
      weeklyTruckingCostTrend,
      truckingTrendSources: Array.from(allTruckingSources),
      weeklyMachine: Object.entries(weeklyMachine)
        .map(([sortKey, d]) => ({ week: d.label, ...d, _sort: sortKey }))
        .sort((a, b) => a._sort.localeCompare(b._sort))
        .map(({ _sort, label, ...rest }) => rest),
    };
  }),
});
