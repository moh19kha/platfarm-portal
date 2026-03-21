/**
 * Inventory & Warehouse tRPC Router
 *
 * Provides endpoints for:
 * - dashboard: aggregated inventory overview (quants, warehouses, products, categories)
 * - stockLevels: detailed stock quant list with filtering
 * - products: product list with category info
 * - warehouses: warehouse list with stock summary
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  fetchInventoryDashboard,
  fetchStockQuants,
  fetchWarehouses,
  fetchStockLocations,
  fetchProducts,
  fetchProductCategories,
  fetchSupplySplit,
  fetchSupplySplitHeaders,
  fetchPickingTypes,
  fetchReceiptSuppliers,
  fetchSupplierReceipts,
  invalidateInventoryCache,
  type OdooStockQuant,
  type OdooWarehouse,
  type OdooStockLocation,
  type OdooProduct,
  type OdooProductCategory,
} from "../odoo-inventory";

// ─── Company → Currency mapping ─────────────────────────────────────────────
// Company IDs 1 & 2 are UAE (AED), IDs 3, 4 & 5 are Egypt (EGP)
const COMPANY_CURRENCY: Record<number, string> = {
  1: "AED",
  2: "AED",
  3: "EGP",
  4: "EGP",
  5: "EGP",
};

// ─── Fetch live exchange rates from open.er-api.com ─────────────────────────
async function fetchExchangeRates(): Promise<{ EGP_USD: number; AED_USD: number; fetchedAt: string }> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    if (data?.result === "success" && data?.rates) {
      const egpPerUsd = data.rates["EGP"] || 51.87;
      const aedPerUsd = data.rates["AED"] || 3.6725;
      return {
        EGP_USD: 1 / egpPerUsd,
        AED_USD: 1 / aedPerUsd,
        fetchedAt: new Date().toISOString(),
      };
    }
  } catch {
    // fallback to known rates
  }
  return { EGP_USD: 1 / 51.87, AED_USD: 1 / 3.6725, fetchedAt: new Date().toISOString() };
}

// ─── Helper: resolve warehouse from location ────────────────────────────────

function resolveWarehouse(
  locationId: number,
  locations: OdooStockLocation[],
  warehouses: OdooWarehouse[]
): { warehouseId: number; warehouseName: string; warehouseCode: string } | null {
  const loc = locations.find(l => l.id === locationId);
  if (!loc) return null;

  // Primary: use warehouse_id if set
  if (loc.warehouse_id) {
    const wh = warehouses.find(w => w.id === (loc.warehouse_id as [number, string])[0]);
    if (wh) return { warehouseId: wh.id, warehouseName: wh.name, warehouseCode: wh.code };
  }

  // Fallback: match location's complete_name prefix against warehouse codes
  // e.g. "CWDAK/Raw Material-Dakhla" → warehouse with code "CWDAK"
  const completeName = loc.complete_name || loc.name || "";
  for (const wh of warehouses) {
    if (completeName.startsWith(wh.code + "/") || completeName === wh.code) {
      return { warehouseId: wh.id, warehouseName: wh.name, warehouseCode: wh.code };
    }
  }

  return null;
}

// ─── Helper: determine product group from category ──────────────────────────

function getProductGroup(categId: [number, string] | false, categories: OdooProductCategory[]): string {
  if (!categId) return "Other";
  const cat = categories.find(c => c.id === categId[0]);
  if (!cat) return "Other";
  const path = cat.complete_name.toLowerCase();
  if (path.includes("alfalfa") && !path.includes("mix")) return "Alfalfa";
  if (path.includes("rhodes")) return "Rhodes Grass";
  if (path.includes("wheat straw")) return "Wheat Straw";
  if (path.includes("mixproduct") || path.includes("alfamix")) return "AlfaMix";
  if (path.includes("ray grass")) return "Ray Grass";
  if (path.includes("diesel") || path.includes("fuel")) return "Diesel & Fuel";
  if (path.includes("oil") || path.includes("lubric")) return "Oil & Lubricants";
  if (path.includes("equipment")) return "Equipment";
  if (path.includes("sleeve")) return "Sleeve Bags";
  if (path.includes("grass")) return "Grass";
  if (path.includes("hay")) return "Hay";
  return cat.name;
}

// ─── Helper: determine location type ────────────────────────────────────────

function getLocationType(locationName: string): "internal" | "production" | "customer" | "other" {
  const lower = locationName.toLowerCase();
  if (lower.includes("virtual") || lower.includes("production")) return "production";
  if (lower.includes("partner") || lower.includes("customer")) return "customer";
  if (lower.includes("stock") || lower.includes("finished") || lower.includes("raw") || lower.includes("fuel") || lower.includes("oil") || lower.includes("spare") || lower.includes("sleave") || lower.includes("input") || lower.includes("output")) return "internal";
  return "other";
}

// ─── Router ─────────────────────────────────────────────────────────────────

export const inventoryRouter = router({
  /**
   * Full dashboard data — aggregated from all Odoo inventory models.
   * Returns processed data ready for the frontend dashboard.
   */
  dashboard: publicProcedure
    .input(z.object({ companyId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const companyId = input?.companyId;
      const { quants, warehouses, locations, products, categories } = await fetchInventoryDashboard(companyId);

      // Build product lookup
      const productMap = new Map<number, OdooProduct>();
      products.forEach(p => productMap.set(p.id, p));

      // Process quants into structured stock items
      const stockItems = quants.map(q => {
        const productId = q.product_id ? (q.product_id as [number, string])[0] : 0;
        const productName = q.product_id ? (q.product_id as [number, string])[1] : "Unknown";
        const locationId = q.location_id ? (q.location_id as [number, string])[0] : 0;
        const locationName = q.location_id ? (q.location_id as [number, string])[1] : "Unknown";
        const lotName = q.lot_id ? (q.lot_id as [number, string])[1] : null;
        const companyName = q.company_id ? (q.company_id as [number, string])[1] : "Unknown";
        const compId = q.company_id ? (q.company_id as [number, string])[0] : 0;

        const product = productMap.get(productId);
        const group = product ? getProductGroup(product.categ_id, categories) : "Other";
        const uom = product?.uom_id ? (product.uom_id as [number, string])[1] : "kg";
        const unitPrice = product?.standard_price || 0;
        const locationType = getLocationType(locationName);
        const wh = resolveWarehouse(locationId, locations, warehouses);

        const currency = COMPANY_CURRENCY[compId] || "EGP";
        return {
          id: q.id,
          productId,
          productName,
          productGroup: group,
          locationId,
          locationName,
          locationType,
          lotName,
          quantity: q.quantity,
          reservedQuantity: q.reserved_quantity,
          availableQuantity: q.quantity - q.reserved_quantity,
          value: q.value || (q.quantity * unitPrice),
          unitPrice,
          uom,
          currency,
          companyId: compId,
          companyName,
          warehouseId: wh?.warehouseId || null,
          warehouseName: wh?.warehouseName || null,
          warehouseCode: wh?.warehouseCode || null,
        };
      });

      // Warehouse summaries
      const warehouseSummaries = warehouses.map(wh => {
        const whQuants = stockItems.filter(s => s.warehouseId === wh.id);
        const totalQty = whQuants.reduce((sum, s) => sum + s.quantity, 0);
        const totalReserved = whQuants.reduce((sum, s) => sum + s.reservedQuantity, 0);
        const totalValue = whQuants.reduce((sum, s) => sum + s.value, 0);
        const productGroups: Record<string, number> = {};
        whQuants.forEach(s => {
          productGroups[s.productGroup] = (productGroups[s.productGroup] || 0) + s.quantity;
        });
        return {
          id: wh.id,
          name: wh.name,
          code: wh.code,
          companyId: wh.company_id ? (wh.company_id as [number, string])[0] : 0,
          companyName: wh.company_id ? (wh.company_id as [number, string])[1] : "Unknown",
          totalQuantity: totalQty,
          totalReserved,
          totalAvailable: totalQty - totalReserved,
          totalValue,
          productGroups,
          itemCount: whQuants.length,
        };
      });

      // Product group summaries
      const groupMap: Record<string, { totalQty: number; totalReserved: number; totalValue: number; itemCount: number; warehouseCount: Set<number> }> = {};
      stockItems.forEach(s => {
        if (!groupMap[s.productGroup]) {
          groupMap[s.productGroup] = { totalQty: 0, totalReserved: 0, totalValue: 0, itemCount: 0, warehouseCount: new Set() };
        }
        const g = groupMap[s.productGroup];
        g.totalQty += s.quantity;
        g.totalReserved += s.reservedQuantity;
        g.totalValue += s.value;
        g.itemCount++;
        if (s.warehouseId) g.warehouseCount.add(s.warehouseId);
      });
      const productGroupSummaries = Object.entries(groupMap).map(([name, data]) => ({
        name,
        totalQuantity: data.totalQty,
        totalReserved: data.totalReserved,
        totalValue: data.totalValue,
        itemCount: data.itemCount,
        warehouseCount: data.warehouseCount.size,
      })).sort((a, b) => b.totalQuantity - a.totalQuantity);

      // Overall KPIs
      const totalOnHand = stockItems.reduce((sum, s) => sum + s.quantity, 0);
      const totalReserved = stockItems.reduce((sum, s) => sum + s.reservedQuantity, 0);
      const totalAvailable = totalOnHand - totalReserved;
      const totalValue = stockItems.reduce((sum, s) => sum + s.value, 0);

      // Alerts
      const alerts: Array<{ type: "critical" | "warning" | "info"; message: string; productName: string }> = [];
      stockItems.forEach(s => {
        if (s.quantity < 0) {
          alerts.push({ type: "critical", message: `Negative stock: ${s.quantity.toLocaleString()} ${s.uom} — investigate immediately`, productName: s.productName });
        } else if (s.quantity > 0) {
          const availPct = ((s.quantity - s.reservedQuantity) / s.quantity) * 100;
          if (availPct === 0) {
            alerts.push({ type: "critical", message: `Fully reserved — 0% available`, productName: s.productName });
          } else if (availPct < 20) {
            alerts.push({ type: "warning", message: `Low availability — ${availPct.toFixed(0)}% available`, productName: s.productName });
          }
        }
      });

      // Fetch exchange rates
      const exchangeRates = await fetchExchangeRates();

      // Build warehouse → locations map from Odoo location hierarchy
      // Includes both properly linked locations AND orphan locations matched by code prefix
      const warehouseLocations: Record<number, string[]> = {};
      warehouses.forEach(wh => {
        const locNames = new Set<string>();
        locations.forEach(l => {
          if (l.usage !== "internal") return;
          const completeName = l.complete_name || l.name || "";
          // Match by warehouse_id
          if (l.warehouse_id && (l.warehouse_id as [number, string])[0] === wh.id) {
            locNames.add(completeName);
          }
          // Fallback: match by code prefix (e.g. "CWDAK/Raw Material" → CWDAK warehouse)
          if (completeName.startsWith(wh.code + "/") || completeName === wh.code) {
            locNames.add(completeName);
          }
        });
        warehouseLocations[wh.id] = [...locNames].sort();
      });

      return {
        kpi: { totalOnHand, totalReserved, totalAvailable, totalValue, itemCount: stockItems.length },
        stockItems,
        warehouseSummaries,
        productGroupSummaries,
        alerts: alerts.sort((a, b) => (a.type === "critical" ? -1 : 1) - (b.type === "critical" ? -1 : 1)),
        categories: categories.map(c => ({ id: c.id, name: c.name, completeName: c.complete_name, parentId: c.parent_id ? (c.parent_id as [number, string])[0] : null })),
        exchangeRates,
        warehouseLocations,
      };
    }),

  /**
   * Supply Split — which suppliers supplied which products over a period.
   * Returns purchase order line data grouped by supplier and product.
   */
  supplySplit: publicProcedure
    .input(z.object({
      companyId: z.number().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const companyId = input?.companyId;
      const dateFrom = input?.dateFrom;
      const dateTo = input?.dateTo;

      // Fetch PO lines + warehouses + locations using the SAME helpers as Dashboard
      const [lines, warehouses, locations] = await Promise.all([
        fetchSupplySplit(companyId, dateFrom, dateTo),
        fetchWarehouses(),
        fetchStockLocations(),
      ]);

      // Build picking_type_id → dest location map from PO headers
      // Step 1: collect unique order IDs
      const orderIds = [...new Set(lines.map(l => l.order_id ? (l.order_id as [number, string])[0] : 0).filter(Boolean))];
      // Step 2: fetch PO headers for picking_type_id
      let poPickingTypeMap = new Map<number, number>(); // orderId → pickingTypeId
      let pickingTypeDestMap = new Map<number, number>(); // pickingTypeId → destLocationId
      if (orderIds.length > 0) {
        try {
          const headers = await fetchSupplySplitHeaders(orderIds);
          for (const h of headers) {
            const ptId = h.picking_type_id ? (h.picking_type_id as [number, string])[0] : 0;
            if (ptId) poPickingTypeMap.set(h.id, ptId);
          }
          // Step 3: fetch stock.picking.type for default_location_dest_id
          const ptIds = [...new Set([...poPickingTypeMap.values()])];
          if (ptIds.length > 0) {
            const pickingTypes = await fetchPickingTypes(ptIds);
            for (const pt of pickingTypes) {
              const destLocId = pt.default_location_dest_id ? (pt.default_location_dest_id as [number, string])[0] : 0;
              if (destLocId) pickingTypeDestMap.set(pt.id, destLocId);
            }
          }
        } catch (err) {
          console.error("[supplySplit] warehouse resolution error:", err instanceof Error ? err.message : err);
        }
      }


      // Process lines into structured data
      const processedLines = lines.map(l => {
        const supplierId = l.partner_id ? (l.partner_id as [number, string])[0] : 0;
        const supplierName = l.partner_id ? (l.partner_id as [number, string])[1] : "Unknown";
        const productId = l.product_id ? (l.product_id as [number, string])[0] : 0;
        const productName = l.product_id ? (l.product_id as [number, string])[1] : "Unknown";
        const orderName = l.order_id ? (l.order_id as [number, string])[1] : "Unknown";
        const currency = l.currency_id ? (l.currency_id as [number, string])[1] : "EGP";
        const uom = l.product_uom ? (l.product_uom as [number, string])[1] : "kg";
        const compId = l.company_id ? (l.company_id as [number, string])[0] : 0;
        const companyName = l.company_id ? (l.company_id as [number, string])[1] : "Unknown";

        // Resolve warehouse + location using the SAME resolveWarehouse helper as Dashboard
        const orderId = l.order_id ? (l.order_id as [number, string])[0] : 0;
        const pickingTypeId = poPickingTypeMap.get(orderId) || 0;
        const destLocationId = pickingTypeDestMap.get(pickingTypeId) || 0;
        const wh = destLocationId ? resolveWarehouse(destLocationId, locations, warehouses) : null;
        // Location short name from stock.location
        const destLoc = locations.find(loc => loc.id === destLocationId);
        const locCompleteName = destLoc?.complete_name || destLoc?.name || "";
        const locShortName = locCompleteName.includes("/")
          ? locCompleteName.split("/").slice(-1)[0].trim()
          : locCompleteName;

        return {
          id: l.id,
          orderId,
          orderName,
          supplierId,
          supplierName,
          productId,
          productName,
          productQty: l.product_qty,
          qtyReceived: l.qty_received,
          priceUnit: l.price_unit,
          priceSubtotal: l.price_subtotal,
          currency,
          uom,
          datePlanned: l.date_planned,
          companyId: compId,
          companyName,
          state: l.state,
          warehouseName: wh?.warehouseName || "",
          locationName: locShortName,
        };
      });

      // Group by supplier
      const supplierMap = new Map<number, {
        id: number;
        name: string;
        totalQty: number;
        totalReceived: number;
        totalValue: number;
        products: Map<number, { id: number; name: string; qty: number; received: number; value: number; orders: number; currency: string }>;
        orderCount: Set<number>;
        currencies: Map<string, number>;
      }>();

      processedLines.forEach(l => {
        if (!supplierMap.has(l.supplierId)) {
          supplierMap.set(l.supplierId, {
            id: l.supplierId,
            name: l.supplierName,
            totalQty: 0,
            totalReceived: 0,
            totalValue: 0,
            products: new Map(),
            orderCount: new Set(),
            currencies: new Map(),
          });
        }
        const s = supplierMap.get(l.supplierId)!;
        s.totalQty += l.productQty;
        s.totalReceived += l.qtyReceived;
        s.totalValue += l.priceSubtotal;
        s.orderCount.add(l.orderId);
        s.currencies.set(l.currency, (s.currencies.get(l.currency) || 0) + l.priceSubtotal);

        if (!s.products.has(l.productId)) {
          s.products.set(l.productId, { id: l.productId, name: l.productName, qty: 0, received: 0, value: 0, orders: 0, currency: l.currency });
        }
        const p = s.products.get(l.productId)!;
        p.qty += l.productQty;
        p.received += l.qtyReceived;
        p.value += l.priceSubtotal;
        p.orders++;
      });

      const supplierSummaries = [...supplierMap.values()].map(s => {
        // Find dominant currency (highest value)
        let dominantCurrency = "EGP";
        let maxVal = 0;
        s.currencies.forEach((val, cur) => { if (val > maxVal) { maxVal = val; dominantCurrency = cur; } });
        return {
          id: s.id,
          name: s.name,
          totalQty: s.totalQty,
          totalReceived: s.totalReceived,
          totalValue: s.totalValue,
          orderCount: s.orderCount.size,
          currency: dominantCurrency,
          products: [...s.products.values()].sort((a, b) => b.received - a.received),
        };
      }).sort((a, b) => b.totalReceived - a.totalReceived);

      // Product-level summary (across all suppliers)
      const productMap = new Map<number, { id: number; name: string; totalQty: number; totalReceived: number; totalValue: number; supplierCount: Set<number>; currencies: Map<string, number> }>();
      processedLines.forEach(l => {
        if (!productMap.has(l.productId)) {
          productMap.set(l.productId, { id: l.productId, name: l.productName, totalQty: 0, totalReceived: 0, totalValue: 0, supplierCount: new Set(), currencies: new Map() });
        }
        const p = productMap.get(l.productId)!;
        p.totalQty += l.productQty;
        p.totalReceived += l.qtyReceived;
        p.totalValue += l.priceSubtotal;
        p.supplierCount.add(l.supplierId);
        p.currencies.set(l.currency, (p.currencies.get(l.currency) || 0) + l.priceSubtotal);
      });

      const productSummaries = [...productMap.values()].map(p => {
        let dominantCurrency = "EGP";
        let maxVal = 0;
        p.currencies.forEach((val, cur) => { if (val > maxVal) { maxVal = val; dominantCurrency = cur; } });
        return {
          id: p.id,
          name: p.name,
          totalQty: p.totalQty,
          totalReceived: p.totalReceived,
          totalValue: p.totalValue,
          supplierCount: p.supplierCount.size,
          currency: dominantCurrency,
        };
      }).sort((a, b) => b.totalReceived - a.totalReceived);

      return {
        lines: processedLines,
        supplierSummaries,
        productSummaries,
        totals: {
          totalQty: processedLines.reduce((s, l) => s + l.productQty, 0),
          totalReceived: processedLines.reduce((s, l) => s + l.qtyReceived, 0),
          totalValue: processedLines.reduce((s, l) => s + l.priceSubtotal, 0),
          lineCount: processedLines.length,
          supplierCount: supplierMap.size,
          productCount: productMap.size,
        },
      };
    }),

  // ─── Dakhla-Sokhna Moves ────────────────────────────────────────────────────

  /**
   * Fetch all stock.picking records relevant to Dakhla-Sokhna transfers.
   * Covers:
   *   1. CWDAK incoming receipts (goods arriving at Dakhla from vendors)
   *   2. CWDAK internal transfers to MWCP (once created in Odoo)
   *   3. MWCP incoming receipts that reference a CWDAK picking in origin
   *
   * Location IDs:
   *   CWDAK parent: 122, children: 123,130,131,132,133,134,135
   *   MWCP parent:   67, children: 68,112,113,114,115,117
   *   CWDAK picking type IDs: 125–142
   */
  dakhlaSokhnaTransfers: publicProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      state: z.string().optional(),   // 'all' | 'done' | 'assigned' | 'waiting'
      product: z.string().optional(), // product name filter
    }))
    .query(async ({ input }) => {
      const { executeKw } = await import("../odoo");

      const CWDAK_TYPE_IDS = [125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142];
      const CWDAK_LOC_IDS = [122, 123, 130, 131, 132, 133, 134, 135];
      const MWCP_LOC_IDS = [67, 68, 112, 113, 114, 115, 117];

      // Build date domain
      const dateDomain: any[] = [];
      if (input.dateFrom) dateDomain.push(["scheduled_date", ">=", input.dateFrom + " 00:00:00"]);
      if (input.dateTo) dateDomain.push(["scheduled_date", "<=", input.dateTo + " 23:59:59"]);

      // 1. CWDAK pickings (all types for CWDAK warehouse)
      const cwdakPickings = await executeKw<any[]>(
        "stock.picking",
        "search_read",
        [[["picking_type_id", "in", CWDAK_TYPE_IDS], ...dateDomain]],
        {
          fields: ["id", "name", "state", "picking_type_id", "picking_type_code",
            "location_id", "location_dest_id", "scheduled_date", "date_done",
            "origin", "move_ids", "partner_id",
            "x_studio_net_weight_in_tons", "x_studio_quantity_in_tons",
            "x_studio_source", "x_studio_product_type", "product_id",
            "x_studio_agreed_product_price_per_unit", "x_studio_purchase_currency",
          ],
          limit: 500,
          order: "id desc",
        }
      );

      // 2. Internal transfers: CWDAK → MWCP (may be empty initially)
      const internalTransfers = await executeKw<any[]>(
        "stock.picking",
        "search_read",
        [[["picking_type_code", "=", "internal"],
          ["location_id", "in", CWDAK_LOC_IDS],
          ["location_dest_id", "in", MWCP_LOC_IDS],
          ...dateDomain]],
        {
          fields: ["id", "name", "state", "picking_type_id",
            "location_id", "location_dest_id", "scheduled_date", "date_done",
            "origin", "move_ids",
            "x_studio_net_weight_in_tons", "x_studio_quantity_in_tons",
          ],
          limit: 500,
          order: "id desc",
        }
      );

      // 3. Fetch stock.move details for all relevant pickings
      const allPickingIds = [
        ...cwdakPickings.map((p: any) => p.id),
        ...internalTransfers.map((p: any) => p.id),
      ];

      let moves: any[] = [];
      if (allPickingIds.length > 0) {
        moves = await executeKw<any[]>(
          "stock.move",
          "search_read",
          [[["picking_id", "in", allPickingIds]]],
          {
            fields: ["id", "picking_id", "product_id", "product_uom_qty", "quantity",
              "product_uom", "location_id", "location_dest_id", "state", "date"],
            limit: 2000,
          }
        );
      }

      // Build move map: pickingId → moves[]
      const movesByPicking = new Map<number, any[]>();
      for (const m of moves) {
        const pid = Array.isArray(m.picking_id) ? m.picking_id[0] : m.picking_id;
        if (!movesByPicking.has(pid)) movesByPicking.set(pid, []);
        movesByPicking.get(pid)!.push(m);
      }

      const m2oName = (f: any): string => {
        if (Array.isArray(f) && f.length >= 2) return String(f[1]);
        if (f && typeof f === "string") return f;
        return "";
      };

      const formatPicking = (p: any, transferType: "cwdak_in" | "cwdak_internal" | "mwcp_in") => {
        const pickingMoves = movesByPicking.get(p.id) || [];
        const firstMove = pickingMoves[0];

        // Product name
        const productName = m2oName(p.product_id)
          || (firstMove ? m2oName(firstMove.product_id) : "")
          || m2oName(p.x_studio_product_type)
          || "—";

        // Quantity in tons
        let qtyTons = p.x_studio_net_weight_in_tons || p.x_studio_quantity_in_tons || 0;
        if (qtyTons === 0 && firstMove) {
          const rawQty = firstMove.quantity || firstMove.product_uom_qty || 0;
          const uom = m2oName(firstMove.product_uom).toLowerCase();
          qtyTons = (uom.includes("ton") || uom === "t") ? rawQty : rawQty / 1000;
        }

        // Aggregate across all moves if still 0
        if (qtyTons === 0 && pickingMoves.length > 1) {
          const totalKg = pickingMoves.reduce((s: number, m: any) => {
            const q = m.quantity || m.product_uom_qty || 0;
            const uom = m2oName(m.product_uom).toLowerCase();
            return s + ((uom.includes("ton") || uom === "t") ? q * 1000 : q);
          }, 0);
          qtyTons = totalKg / 1000;
        }

        // Products from all moves
        const products = [...new Set(pickingMoves
          .map((m: any) => m2oName(m.product_id))
          .filter(Boolean)
        )];
        if (products.length === 0 && productName !== "—") products.push(productName);

        return {
          id: p.id,
          name: p.name,
          state: p.state,
          transferType,
          pickingTypeCode: p.picking_type_code || "internal",
          pickingTypeName: m2oName(p.picking_type_id),
          locationFrom: m2oName(p.location_id),
          locationTo: m2oName(p.location_dest_id),
          scheduledDate: p.scheduled_date || "",
          dateDone: p.date_done || "",
          origin: p.origin || "",
          supplier: m2oName(p.partner_id),
          product: productName,
          products,
          qtyTons,
          moveCount: pickingMoves.length,
        };
      };

      const cwdakRows = cwdakPickings.map((p: any) => formatPicking(p, "cwdak_in"));
      const internalRows = internalTransfers.map((p: any) => formatPicking(p, "cwdak_internal"));

      // Apply product filter
      const filterProduct = (rows: any[]) => {
        if (!input.product) return rows;
        const s = input.product.toLowerCase();
        return rows.filter((r: any) => r.product.toLowerCase().includes(s) || r.products.some((p: string) => p.toLowerCase().includes(s)));
      };

      // Apply state filter
      const filterState = (rows: any[]) => {
        if (!input.state || input.state === "all") return rows;
        return rows.filter((r: any) => r.state === input.state);
      };

      const filteredCwdak = filterState(filterProduct(cwdakRows));
      const filteredInternal = filterState(filterProduct(internalRows));

      // Weekly trend: group CWDAK incoming by week
      const weeklyMap = new Map<string, { week: string; cwdakTons: number; internalTons: number; count: number }>();
      for (const r of cwdakRows) {
        const d = new Date(r.dateDone || r.scheduledDate);
        if (isNaN(d.getTime())) continue;
        // ISO week key: YYYY-WW
        const jan1 = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
        const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
        if (!weeklyMap.has(key)) weeklyMap.set(key, { week: key, cwdakTons: 0, internalTons: 0, count: 0 });
        const w = weeklyMap.get(key)!;
        w.cwdakTons += r.qtyTons;
        w.count++;
      }
      for (const r of internalRows) {
        const d = new Date(r.dateDone || r.scheduledDate);
        if (isNaN(d.getTime())) continue;
        const jan1 = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
        const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
        if (!weeklyMap.has(key)) weeklyMap.set(key, { week: key, cwdakTons: 0, internalTons: 0, count: 0 });
        weeklyMap.get(key)!.internalTons += r.qtyTons;
      }
      const weeklyTrend = [...weeklyMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => v);

      // Product summary
      const productTotals = new Map<string, { product: string; cwdakTons: number; internalTons: number; receipts: number }>();
      for (const r of cwdakRows) {
        if (!productTotals.has(r.product)) productTotals.set(r.product, { product: r.product, cwdakTons: 0, internalTons: 0, receipts: 0 });
        const pt = productTotals.get(r.product)!;
        pt.cwdakTons += r.qtyTons;
        pt.receipts++;
      }
      for (const r of internalRows) {
        if (!productTotals.has(r.product)) productTotals.set(r.product, { product: r.product, cwdakTons: 0, internalTons: 0, receipts: 0 });
        productTotals.get(r.product)!.internalTons += r.qtyTons;
      }
      const productSummary = [...productTotals.values()].sort((a, b) => b.cwdakTons - a.cwdakTons);

      return {
        cwdakPickings: filteredCwdak,
        internalTransfers: filteredInternal,
        weeklyTrend,
        productSummary,
        summary: {
          totalCwdakReceipts: cwdakRows.length,
          totalCwdakTons: cwdakRows.reduce((s: number, r: any) => s + r.qtyTons, 0),
          totalInternalTransfers: internalRows.length,
          totalInternalTons: internalRows.reduce((s: number, r: any) => s + r.qtyTons, 0),
          doneCount: cwdakRows.filter((r: any) => r.state === "done").length,
          pendingCount: cwdakRows.filter((r: any) => r.state !== "done").length,
        },
      };
    }),

  // ─── Supplier Statement ─────────────────────────────────────────────────

  /** List of suppliers who have incoming receipts (for dropdown) */
  receiptSuppliers: publicProcedure
    .input(z.object({ companyId: z.number().optional() }))
    .query(async ({ input }) => {
      return fetchReceiptSuppliers(input.companyId);
    }),

  /** Detailed receipts for a specific supplier + date range */
  supplierReceipts: publicProcedure
    .input(z.object({
      supplierId: z.number(),
      companyId: z.number().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ input }) => {
      // Clear cache to ensure fresh data is fetched from Odoo
      invalidateInventoryCache();
      
      const { receipts, moves, purchaseOrders, poLines } = await fetchSupplierReceipts(
        input.supplierId,
        input.companyId,
        input.dateFrom,
        input.dateTo
      );

      // Build maps for quick lookups
      const moveMap = new Map(moves.map(m => [m.id, m]));
      const poMap = new Map(purchaseOrders.map((po: any) => [po.id, po]));
      // Build PO line map: (order_id, product_id) => price_unit
      const poLineMap = new Map<string, number>();
      // Build trucking cost map: order_id => total trucking subtotal (all non-fodder service lines)
      const truckingCostByPo = new Map<number, number>();
      // Track which POs have already had their trucking cost assigned to a receipt row
      const truckingCostAssigned = new Set<number>();
      poLines.forEach((line: any) => {
        const key = `${line.order_id[0]}_${line.product_id[0]}`;
        poLineMap.set(key, line.price_unit || 0);
        // Identify trucking/service lines: product name contains "Freight", "Trucking", "Transport", or UOM is "Units" (not kg/ton)
        const productName = Array.isArray(line.product_id) ? String(line.product_id[1]) : '';
        const uomName = Array.isArray(line.product_uom) ? String(line.product_uom[1]).toLowerCase() : '';
        const isTrucking = /freight|trucking|transport|شحن|نقل/i.test(productName) || uomName === 'units' || uomName === 'unit';
        if (isTrucking && line.price_subtotal > 0) {
          const existing = truckingCostByPo.get(line.order_id[0]) || 0;
          truckingCostByPo.set(line.order_id[0], existing + line.price_subtotal);
        }
      });

      const m2oName = (field: any): string => {
        if (Array.isArray(field) && field.length >= 2) return String(field[1]);
        if (field && typeof field === "string") return field;
        return "";
      };

      // Filter out receipts whose linked PO is cancelled
      const activeReceipts = receipts.filter(r => {
        const poId = Array.isArray(r.purchase_id) ? r.purchase_id[0] : 0;
        const po = poId ? poMap.get(poId) : null;
        return !po || po.state !== "cancel";
      });

      // Process receipts into a flat table with HYBRID data sourcing
      const rows = activeReceipts.map((r, idx) => {
        // Get first stock.move for this picking
        const firstMove = r.move_ids.length > 0 ? moveMap.get(r.move_ids[0]) : null;
        // Get linked purchase order
        const poId = Array.isArray(r.purchase_id) ? r.purchase_id[0] : 0;
        const po = poId ? poMap.get(poId) : null;
        
        // DEBUG: Log first receipt to understand data structure
        if (idx === 0) {
          console.log('[DEBUG RECEIPT] First receipt data:', {
            id: r.id,
            name: r.name,
            x_studio_net_weight_in_tons: r.x_studio_net_weight_in_tons,
            move_ids_count: r.move_ids.length,
            firstMove_qty: firstMove?.quantity,
            firstMove_price_unit: firstMove?.price_unit,
            purchase_id: r.purchase_id,
            po_name: po?.name,
            agreed_product_price_per_unit: r.agreed_product_price_per_unit
          });
        }

        // PRODUCT: picking.product_id > move.product_id > picking.x_studio_product_type
        const productName = m2oName(r.product_id)
          || (firstMove ? m2oName(firstMove.product_id) : "")
          || m2oName(r.x_studio_product_type)
          || "\u2014";

        // PO# from linked purchase.order.name (e.g. PO/CAI/26/00110), fallback to origin
        const poName = po ? po.name : "";
        const origin = r.origin || "";
        const poNumber = poName || origin || "\u2014";
        const loadInfo = origin.includes(" - ") ? origin.split(" - ").slice(1).join(" - ").trim() : "";

        // NET WEIGHT (tons): picking.x_studio_net_weight_in_tons > move.quantity/1000
        let netWeightTons = r.x_studio_net_weight_in_tons || 0;
        if (netWeightTons === 0 && firstMove) {
          const moveQty = firstMove.quantity || firstMove.product_uom_qty || 0;
          // Check if UOM is kg (most common) — convert to tons
          const uomName = m2oName(firstMove.product_uom).toLowerCase();
          if (uomName.includes("kg") || uomName === "" || uomName.includes("kilo")) {
            netWeightTons = moveQty / 1000;
          } else if (uomName.includes("ton") || uomName.includes("t")) {
            netWeightTons = moveQty;
          } else {
            netWeightTons = moveQty / 1000; // default assume kg
          }
        }

        // PRICE: Use PO line price as primary source (separates trucking from fodder).
        // Fallback chain: PO line price_unit (per kg) → stock.move price_unit (per kg) → agreed_product_price_per_unit (per ton)
        let pricePerTon = 0;
        if (poId && firstMove) {
          const productId = Array.isArray(firstMove.product_id) ? firstMove.product_id[0] : 0;
          const poLineKey = `${poId}_${productId}`;
          const poLinePrice = poLineMap.get(poLineKey);
          if (poLinePrice && poLinePrice > 0) {
            pricePerTon = poLinePrice * 1000; // PO line price is per kg, convert to per ton
          }
        }
        if (pricePerTon === 0 && firstMove && (firstMove.price_unit ?? 0) > 0) {
          pricePerTon = (firstMove.price_unit ?? 0) * 1000; // move price is per kg, convert to per ton
        }
        if (pricePerTon === 0) {
          pricePerTon = r.agreed_product_price_per_unit || 0; // last resort: receipt-level agreed price
        }

        // CURRENCY: picking.x_studio_purchase_currency > picking.x_studio_currency_id > PO.currency_id
        let currency = m2oName(r.x_studio_purchase_currency)
          || m2oName(r.x_studio_currency_id);
        if (!currency && po) {
          currency = m2oName(po.currency_id);
        }

        // WAREHOUSE from picking_type_id or location_dest_id
        const warehouse = m2oName(r.picking_type_id) || m2oName(r.location_dest_id);

        // OFFICER: picking.user_id > PO.x_studio_procurement_officer > PO.user_id
        let officer = m2oName(r.user_id);
        if (!officer && po) {
          officer = m2oName(po.x_studio_procurement_officer) || m2oName(po.user_id);
        }
        if (!officer) officer = "\u2014";

        // Supplier name (strip code prefix)
        const supplierName = m2oName(r.partner_id).replace(/^\d[\d-]*-/, "").trim();

        // Date: use date_planned preference — x_studio_loading_datetime > scheduled_date
        const loadingDate = r.x_studio_loading_datetime || r.scheduled_date || "";

        // Total value = net weight in tons * price per ton
        const totalValue = netWeightTons * pricePerTon;

        // Trucking cost: assign to first receipt of each PO, then mark as assigned
        let truckingCost = 0;
        if (poId && !truckingCostAssigned.has(poId)) {
          truckingCost = truckingCostByPo.get(poId) || 0;
          if (truckingCost > 0) truckingCostAssigned.add(poId);
        }

        return {
          id: r.id,
          shipmentRef: r.name,
          poNumber,
          loadInfo,
          truckLoadSerial: r.truck_load_serial_tl || "\u2014",
          containerNumber: r.x_studio_loadcontainer_number_1 || "\u2014",
          supplierName,
          product: productName,
          netWeightTons,
          grossWeightTons: r.x_studio_gross_weight_in_tons || 0,
          pricePerTon,
          currency: currency || "\u2014",
          totalValue,
          truckingCost,
          grade: r.grade || "\u2014",
          warehouse: warehouse.replace(/:.*/, ""),
          officer,
          loadingDate,
          dateDone: r.date_done || "",
          state: r.state,
        };
      });

      // Summary totals
      const totalNetWeight = rows.reduce((s, r) => s + r.netWeightTons, 0);
      const totalValue = rows.reduce((s, r) => s + r.totalValue, 0);
      const totalTruckingCost = rows.reduce((s, r) => s + r.truckingCost, 0);
      const avgPricePerTon = totalNetWeight > 0 ? totalValue / totalNetWeight : 0;

      return {
        rows,
        summary: {
          receiptCount: rows.length,
          totalNetWeightTons: totalNetWeight,
          totalGrossWeightTons: rows.reduce((s, r) => s + r.grossWeightTons, 0),
          totalValue,
          totalTruckingCost,
          grandTotal: totalValue + totalTruckingCost,
          avgPricePerTon,
          products: [...new Set(rows.map(r => r.product))].filter(p => p !== "\u2014"),
          warehouses: [...new Set(rows.map(r => r.warehouse))].filter(w => w !== ""),
        },
      };
    }),
});
