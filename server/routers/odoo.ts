/**
 * Odoo tRPC Router
 * Exposes Odoo data to the frontend via type-safe tRPC procedures.
 * Includes: companies, purchase agreements, sales agreements (full CRUD),
 * and lookup endpoints for vendors, customers, products, currencies, UoMs.
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  fetchCompanies,
  fetchPurchaseAgreements,
  fetchPurchaseAgreementLines,
  fetchSalesAgreements,
  fetchSalesAgreementLines,
  fetchVendors,
  fetchCustomers,
  fetchProducts,
  fetchCurrencies,
  fetchUoms,
  fetchPickingTypes,
  fetchPaymentTerms,
  createPurchaseAgreement,
  updatePurchaseAgreement,
  createSalesAgreement,
  updateSalesAgreement,
  fetchTaxes,
} from "../odoo";

export const odooRouter = router({
  // ─── Read Endpoints ─────────────────────────────────────────────────────

  /**
   * Fetch Odoo taxes (account.tax) optionally filtered by company and use type.
   * Returns id, name, amount (rate), type_tax_use, and company info.
   */
  taxes: publicProcedure
    .input(
      z.object({
        companyId: z.number().optional(),
        taxUse: z.enum(["sale", "purchase"]).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const raw = await fetchTaxes(input?.companyId, input?.taxUse);
      return raw.map((t) => ({
        id: t.id,
        name: t.name,
        amount: t.amount,
        amountType: t.amount_type,
        taxUse: t.type_tax_use,
        companyId: t.company_id ? (t.company_id as [number, string])[0] : null,
        companyName: t.company_id ? (t.company_id as [number, string])[1] : null,
      }));
    }),

  companies: publicProcedure.query(async () => {
    const raw = await fetchCompanies();
    return raw.map((c) => ({
      id: c.id,
      name: c.name,
      displayName: c.display_name,
      currency: c.currency_id ? c.currency_id[1] : null,
      country: c.country_id ? c.country_id[1] : null,
      city: c.city || null,
      parentId: c.parent_id ? c.parent_id[0] : null,
      childIds: c.child_ids,
    }));
  }),

  purchaseAgreements: publicProcedure.query(async () => {
    const raw = await fetchPurchaseAgreements();
    const allLineIds = raw.flatMap((a) => a.line_ids);
    const lines =
      allLineIds.length > 0
        ? await fetchPurchaseAgreementLines(allLineIds)
        : [];

    const linesByRequisition = new Map<number, typeof lines>();
    for (const line of lines) {
      const reqId = line.requisition_id ? line.requisition_id[0] : 0;
      if (!linesByRequisition.has(reqId)) {
        linesByRequisition.set(reqId, []);
      }
      linesByRequisition.get(reqId)!.push(line);
    }

    return raw.map((a) => ({
      id: a.id,
      name: a.name,
      reference: a.reference || null,
      vendor: a.vendor_id ? a.vendor_id[1] : null,
      vendorId: a.vendor_id ? a.vendor_id[0] : null,
      type: a.requisition_type || null,
      dateStart: a.date_start || null,
      dateEnd: a.date_end || null,
      state: a.state || null,
      companyId: a.company_id ? a.company_id[0] : null,
      companyName: a.company_id ? a.company_id[1] : null,
      currency: a.currency_id ? a.currency_id[1] : null,
      currencyId: a.currency_id ? a.currency_id[0] : null,
      product: a.product_id ? a.product_id[1] : null,
      orderCount: a.order_count,
      totalQuantityTons: a.x_studio_total_po_quantity_in_tons || 0,
      incoterm: null,
      purchaseCurrency: null,
      ultimateCustomer: a.x_studio_many2one_field_6iu_1j3mdo0jj
        ? a.x_studio_many2one_field_6iu_1j3mdo0jj[1]
        : null,
      insuranceIncluded: a.x_studio_insurance_included || false,
      paymentTerms: null,
      notes: null,
      supplyStartDate: null,
      supplyEndDate: null,
      lines: (linesByRequisition.get(a.id) || []).map((l) => ({
        id: l.id,
        productId: l.product_id ? l.product_id[0] : null,
        product: l.product_id ? l.product_id[1] : null,
        quantity: l.product_qty,
        priceUnit: l.price_unit,
        uom: l.product_uom_id ? l.product_uom_id[1] : null,
        uomId: l.product_uom_id ? l.product_uom_id[0] : null,
        qtyOrdered: l.qty_ordered,
      })),
    }));
  }),

  salesAgreements: publicProcedure.query(async () => {
    const raw = await fetchSalesAgreements();

    // Fetch all line details in one batch
    const allLineIds = raw.flatMap((a) => a.sale_order_template_line_ids);
    const allLines =
      allLineIds.length > 0
        ? await fetchSalesAgreementLines(allLineIds)
        : [];

    const linesByTemplate = new Map<number, typeof allLines>();
    for (const line of allLines) {
      const templateId = line.sale_order_template_id ? line.sale_order_template_id[0] : 0;
      if (!linesByTemplate.has(templateId)) {
        linesByTemplate.set(templateId, []);
      }
      linesByTemplate.get(templateId)!.push(line);
    }

    return raw.map((a) => ({
      id: a.id,
      name: a.name,
      displayName: a.display_name,
      customer: a.partner_id ? a.partner_id[1] : null,
      customerId: a.partner_id ? a.partner_id[0] : null,
      studioCustomerId: a.x_studio_customer ? (a.x_studio_customer as [number,string])[0] : null,
      studioCustomerName: a.x_studio_customer ? (a.x_studio_customer as [number,string])[1] : null,
      ultimateCustomer: a.x_studio_ultimate_customer || null,
      incoterm: a.x_studio_sales_incoterm_condition || null,
      currency: a.x_studio_sales_currency || null,
      insuranceIncluded: a.x_studio_insurance_included || false,
      totalQuantityTons: a.x_studio_total_po_quantity_in_tons || 0,
      supplyStartDate: a.x_studio_supply_start_date || null,
      supplyEndDate: null,
      notes: a.x_studio_notes || null,
      paymentTerms: a.x_studio_payment_terms || null,
      salesOrderCount: a.sale_order_count,
      companyId: a.company_id ? a.company_id[0] : null,
      companyName: a.company_id ? a.company_id[1] : null,
      active: a.active,
      durationDays: a.number_of_days,
      createdAt: a.create_date,
      lineIds: a.sale_order_template_line_ids,
      lines: (linesByTemplate.get(a.id) || []).map((l) => ({
        id: l.id,
        productId: l.product_id ? l.product_id[0] : null,
        product: l.product_id ? l.product_id[1] : null,
        quantity: l.product_uom_qty,
        priceUnit: l.price_unit,
        uom: l.product_uom_id ? l.product_uom_id[1] : null,
        uomId: l.product_uom_id ? l.product_uom_id[0] : null,
      })),
    }));
  }),

  // ─── Lookup Endpoints ───────────────────────────────────────────────────

  vendors: publicProcedure
    .input(z.object({ search: z.string().optional(), companyId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const raw = await fetchVendors(input?.search, 50, input?.companyId);
      return raw.map((v) => ({ id: v.id, name: v.name }));
    }),

  customers: publicProcedure
    .input(z.object({ search: z.string().optional(), companyId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const raw = await fetchCustomers(input?.search, 50, input?.companyId);
      return raw.map((c) => ({ id: c.id, name: c.name }));
    }),

  products: publicProcedure
    .input(z.object({ search: z.string().optional(), companyId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const raw = await fetchProducts(input?.search, 50, input?.companyId);
      return raw.map((p) => ({
        id: p.id,
        name: p.name,
        uom: p.uom_id ? { id: p.uom_id[0], name: p.uom_id[1] } : null,
        purchaseUom: p.uom_po_id
          ? { id: p.uom_po_id[0], name: p.uom_po_id[1] }
          : null,
      }));
    }),

  currencies: publicProcedure.query(async () => {
    const raw = await fetchCurrencies();
    return raw.map((c) => ({ id: c.id, name: c.name, symbol: c.symbol }));
  }),

  uoms: publicProcedure.query(async () => {
    const raw = await fetchUoms(100);
    return raw.map((u) => ({ id: u.id, name: u.name }));
  }),

  paymentTerms: publicProcedure.query(async () => {
    const raw = await fetchPaymentTerms();
    return raw.map((t) => ({ id: t.id, name: t.name }));
  }),

  pickingTypes: publicProcedure
    .input(z.object({
      companyId: z.number().optional(),
      code: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const raw = await fetchPickingTypes(input?.companyId, input?.code);
      return raw.map((pt) => ({
        id: pt.id,
        name: pt.name,
        code: pt.code,
        companyId: pt.company_id ? pt.company_id[0] : null,
        companyName: pt.company_id ? pt.company_id[1] : null,
        warehouseId: pt.warehouse_id ? pt.warehouse_id[0] : null,
        warehouseName: pt.warehouse_id ? pt.warehouse_id[1] : null,
      }));
    }),

  // ─── Purchase Agreement Mutations ───────────────────────────────────────

  createPurchaseAgreement: publicProcedure
    .input(
      z.object({
        vendor_id: z.number().optional(),
        company_id: z.number(),
        currency_id: z.number(),
        picking_type_id: z.number(),
        requisition_type: z.string().optional(),
        reference: z.string().optional(),
        date_start: z.string().optional(),
        date_end: z.string().optional(),
        x_studio_purchase_incoterm_condition: z.string().optional(),
        x_studio_purchase_currency: z.string().optional(),
        x_studio_insurance_included: z.boolean().optional(),
        x_studio_total_po_quantity_in_tons: z.number().optional(),
        x_studio_payment_terms: z.string().optional(),
        x_studio_notes: z.string().optional(),
        x_studio_supply_start_date: z.string().optional(),
        x_studio_supply_end_date: z.string().optional(),
        lines: z.array(
          z.object({
            product_id: z.number(),
            product_qty: z.number(),
            price_unit: z.number(),
            product_uom_id: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const newId = await createPurchaseAgreement(input);
      return { id: newId, success: true };
    }),

  updatePurchaseAgreement: publicProcedure
    .input(
      z.object({
        id: z.number(),
        vendor_id: z.number().optional(),
        reference: z.string().optional(),
        date_start: z.string().optional(),
        date_end: z.string().optional(),
        currency_id: z.number().optional(),
        x_studio_purchase_incoterm_condition: z.string().optional(),
        x_studio_purchase_currency: z.string().optional(),
        x_studio_insurance_included: z.boolean().optional(),
        x_studio_total_po_quantity_in_tons: z.number().optional(),
        x_studio_payment_terms: z.string().optional(),
        x_studio_notes: z.string().optional(),
        x_studio_supply_start_date: z.string().optional(),
        x_studio_supply_end_date: z.string().optional(),
        addLines: z
          .array(
            z.object({
              product_id: z.number(),
              product_qty: z.number(),
              price_unit: z.number(),
              product_uom_id: z.number().optional(),
            })
          )
          .optional(),
        updateLines: z
          .array(
            z.object({
              id: z.number(),
              product_qty: z.number().optional(),
              price_unit: z.number().optional(),
            })
          )
          .optional(),
        deleteLineIds: z.array(z.number()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await updatePurchaseAgreement(input);
      return { success: result };
    }),

  // ─── Sales Agreement Mutations ──────────────────────────────────────────

  createSalesAgreement: publicProcedure
    .input(
      z.object({
        name: z.string(),
        partner_id: z.number(),
        company_id: z.number().optional(),
        x_studio_customer: z.number().optional(),
        x_studio_ultimate_customer: z.string().optional(),
        x_studio_sales_incoterm_condition: z.string().optional(),
        x_studio_sales_currency: z.string().optional(),
        x_studio_insurance_included: z.boolean().optional(),
        x_studio_total_po_quantity_in_tons: z.number().optional(),
        x_studio_supply_start_date: z.string().optional(),
        x_studio_supply_end_date: z.string().optional(),
        x_studio_notes: z.string().optional(),
        x_studio_payment_terms: z.string().optional(),
        number_of_days: z.number().optional(),
        lines: z.array(z.object({
          product_id: z.number(),
          product_uom_qty: z.number(),
          price_unit: z.number(),
          product_uom_id: z.number().optional(),
        })).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const newId = await createSalesAgreement(input);
      return { id: newId, success: true };
    }),

  updateSalesAgreement: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        partner_id: z.number().optional(),
        x_studio_customer: z.number().optional(),
        x_studio_ultimate_customer: z.string().optional(),
        x_studio_sales_incoterm_condition: z.string().optional(),
        x_studio_sales_currency: z.string().optional(),
        x_studio_insurance_included: z.boolean().optional(),
        x_studio_total_po_quantity_in_tons: z.number().optional(),
        x_studio_supply_start_date: z.string().optional(),
        x_studio_supply_end_date: z.string().optional(),
        x_studio_notes: z.string().optional(),
        x_studio_payment_terms: z.string().optional(),
        number_of_days: z.number().optional(),
        addLines: z.array(z.object({
          product_id: z.number(),
          product_uom_qty: z.number(),
          price_unit: z.number(),
          product_uom_id: z.number().optional(),
        })).optional(),
        updateLines: z.array(z.object({
          id: z.number(),
          product_uom_qty: z.number().optional(),
          price_unit: z.number().optional(),
        })).optional(),
        deleteLineIds: z.array(z.number()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await updateSalesAgreement(input);
      return { success: result };
    }),
});
