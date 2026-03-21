/**
 * Periodic Inventory tRPC Router
 *
 * Provides endpoints for the Periodic Inventory page:
 * - dates: get available submission dates (deduplicated, latest first)
 * - warehouses: get distinct warehouses from submissions
 * - locations: get distinct locations (optionally filtered by warehouse)
 * - byDate: get all submissions for a specific date with line items
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  fetchPeriodicInventoryDates,
  fetchPeriodicInventoryByDate,
  fetchPeriodicInventoryLines,
  fetchPeriodicInventoryWarehouses,
  fetchPeriodicInventoryLocations,
  type OdooPeriodicInventory,
  type OdooPeriodicInventoryLine,
} from "../odoo-periodic-inventory";

type M2O = [number, string] | false;
const m2oName = (v: M2O): string => (Array.isArray(v) ? v[1] : "");
const m2oId = (v: M2O): number | null => (Array.isArray(v) ? v[0] : null);

function mapSubmission(sub: OdooPeriodicInventory) {
  return {
    id: sub.id,
    name: sub.name,
    date: sub.date,
    state: sub.state,
    inventoryType: sub.inventory_type,
    reportingUnit: sub.reporting_unit,
    productCategory: m2oName(sub.product_category_id),
    productCategoryId: m2oId(sub.product_category_id),
    grade: sub.grade || "",
    warehouseId: m2oId(sub.warehouse_id),
    warehouse: m2oName(sub.warehouse_id),
    locationId: m2oId(sub.location_id),
    location: m2oName(sub.location_id),
    supervisorReviewStatus: sub.supervisor_review_status,
    supervisorName: m2oName(sub.supervisor_id),
    accountingReviewStatus: sub.accounting_review_status,
    accountantName: m2oName(sub.accountant_id),
    requestedBy: m2oName(sub.requested_by),
    companyId: m2oId(sub.company_id),
    companyName: m2oName(sub.company_id),
    totalProducts: sub.total_products,
    totalQuantity: sub.total_quantity,
    notes: sub.notes || "",
    lineIds: sub.line_ids,
  };
}

function mapLine(line: OdooPeriodicInventoryLine) {
  return {
    id: line.id,
    inventoryId: m2oId(line.inventory_id) || 0,
    productName: m2oName(line.product_tmpl_id),
    productCategory: m2oName(line.product_category_id),
    grade: line.product_grade || "",
    weightRange: line.product_weight_range || "",
    countedBales: line.counted_bales,
    countedQty: line.counted_qty,
    unit: m2oName(line.product_uom_id),
    theoreticalQty: line.theoretical_qty,
    differenceQty: line.difference_qty,
    state: line.state,
    companyName: m2oName(line.company_id),
  };
}

export const periodicInventoryRouter = router({
  /**
   * Get all unique submission dates (deduplicated, latest first).
   */
  dates: publicProcedure.query(async () => {
    return fetchPeriodicInventoryDates();
  }),

  /**
   * Get distinct warehouses that appear in periodic inventory submissions.
   */
  warehouses: publicProcedure.query(async () => {
    return fetchPeriodicInventoryWarehouses();
  }),

  /**
   * Get distinct locations (optionally filtered by warehouse).
   */
  locations: publicProcedure
    .input(z.object({ warehouseId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      return fetchPeriodicInventoryLocations(input?.warehouseId);
    }),

  /**
   * Get all submissions for a specific date, with their line items.
   * Optionally filter by warehouse, location, or product category.
   */
  byDate: publicProcedure
    .input(
      z.object({
        date: z.string(),
        warehouseId: z.number().optional(),
        locationId: z.number().optional(),
        productCategory: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const submissions = await fetchPeriodicInventoryByDate(input.date, {
        warehouseId: input.warehouseId,
        locationId: input.locationId,
      });

      // Filter by product category if specified
      const filtered = input.productCategory
        ? submissions.filter((s) => {
            const cat = m2oName(s.product_category_id);
            return cat.toLowerCase().includes(input.productCategory!.toLowerCase());
          })
        : submissions;

      if (!filtered.length) return { submissions: [], lines: [] };

      const ids = filtered.map((s) => s.id);
      const lines = await fetchPeriodicInventoryLines(ids);

      return {
        submissions: filtered.map(mapSubmission),
        lines: lines.map(mapLine),
      };
    }),
});
