/**
 * tRPC Router for Sales Shipments (sale.order)
 *
 * Provides endpoints for listing, viewing, creating, updating sales orders,
 * managing deliveries (stock.picking), and file uploads.
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { seedCurrentStatuses } from "./notifications";
import {
  fetchSaleOrders,
  fetchSaleOrderById,
  countSaleOrders,
  fetchSOLines,
  fetchPickings,
  createSaleOrder,
  updateSaleOrder,
  updateSalesPicking,
  uploadFileToSO,
  uploadFileToSalesPicking,
  readSOFile,
  readSalesPickingFile,
  confirmSaleOrder,
  checkSOFileStatus,
  checkSalesPickingFileStatus,
  fetchSaleOrderByName,
} from "../odoo-sales-shipments";
import { fetchAllStockAtLocation } from "../odoo";
import { fetchPOVesselNameByPOName, distributeWeightAcrossPickings, fetchInvoicesByIds, fetchPaymentTermLines } from "../odoo-shipments";

export const salesShipmentsRouter = router({
  // ─── List Sales Orders ──────────────────────────────────────────────────
  list: publicProcedure
    .input(
      z.object({
        companyId: z.number().optional(),
        templateId: z.number().optional(),
        limit: z.number().optional().default(200),
        offset: z.number().optional().default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const sos = await fetchSaleOrders({
        companyId: input?.companyId,
        templateId: input?.templateId,
        limit: input?.limit,
        offset: input?.offset,
      });

      // Batch-fetch all SO line IDs to get product names for search
      const allLineIds = sos.flatMap((so: Record<string, any>) => so.order_line || []);
      let lineProductMap = new Map<number, string[]>(); // soId -> product names
      if (allLineIds.length > 0) {
        try {
          const lines = await fetchSOLines(allLineIds);
          if (Array.isArray(lines)) {
            for (const so of sos) {
              const soLineSet = new Set((so.order_line || []) as number[]);
              const productNames = lines
                .filter((l: any) => soLineSet.has(l.id))
                .map((l: any) => l.product_id ? l.product_id[1] : "")
                .filter(Boolean);
              lineProductMap.set(so.id, [...new Set(productNames)]);
            }
          }
        } catch (err) {
          console.warn("[salesShipments.list] Failed to fetch SO lines for product names:", err);
        }
      }

      const mapped = sos.map((so: Record<string, any>) => ({
        id: so.id,
        name: so.name,
        customer: so.partner_id ? { id: so.partner_id[0], name: so.partner_id[1] } : null,
        company: so.company_id ? { id: so.company_id[0], name: so.company_id[1] } : null,
        state: so.state,
        dateOrder: so.date_order || null,
        amountTotal: so.amount_total,
        amountUntaxed: so.amount_untaxed,
        amountTax: so.amount_tax,
        currency: so.currency_id ? { id: so.currency_id[0], name: so.currency_id[1] } : null,
        lineIds: so.order_line,
        pickingIds: so.picking_ids,
        deliveryCount: so.delivery_count,
        numberOfLoads: so.number_of_loads,
        blNumber: so.x_studio_shipment_bl_number || null,
        trackingNumber: so.tracking_number || null,
        productCategory: so.x_studio_product_category || null,
        freightType: so.freight_type || null,
        loadType: so.load_type || null,
        shippingLine: so.shipping_line || null,
        shipmentStatus: so.x_studio_unified_shipment_status || so.x_studio_selection_field_65k_1j3t1b3d3 || null,
        sellingType: so.x_studio_selling_type || null,
        ultimateCustomer: so.x_studio_ultimate_customer || null,
        totalShipmentWeight: so.x_studio_total_shipment_weight_in_tons_sales,
        acceptanceStatus: so.x_studio_shipment_acceptance_status || null,
        correspondingPO: so.x_studio_corresponding_purchasesale_shipment || null,
        vesselName: null as string | null, // Vessel name is fetched from linked PO in getById only
        incoterm: so.incoterm ? { id: so.incoterm[0], name: so.incoterm[1] } : null,
        pricelist: so.pricelist_id ? { id: so.pricelist_id[0], name: so.pricelist_id[1] } : null,
        salesperson: so.user_id ? { id: so.user_id[0], name: so.user_id[1] } : null,
        clientRef: so.client_order_ref || null,
        origin: so.origin || null,
        saleOrderTemplateId: so.sale_order_template_id ? { id: so.sale_order_template_id[0], name: so.sale_order_template_id[1] } : null,
        portOfLoading: so.pol || null,
        portOfDestination: so.pod || null,
        clearanceAgent: so.local_clearance_agent ? { id: so.local_clearance_agent[0], name: so.local_clearance_agent[1] } : null,
        truckingCompany: so.local_trucking_company ? { id: so.local_trucking_company[0], name: so.local_trucking_company[1] } : null,
        productNames: lineProductMap.get(so.id) || [],
      }));

      // ── Compute payment due dates from PaymentReferenceDate + payment term ──
      const uniqueTermIds = [...new Set(
        sos.map((so: any) => so.payment_term_id ? so.payment_term_id[0] : null).filter(Boolean)
      )] as number[];
      const termNbDaysMap = new Map<number, { nbDays: number; delayType: string }>();
      if (uniqueTermIds.length > 0) {
        await Promise.all(uniqueTermIds.map(async (termId) => {
          try {
            const lines = await fetchPaymentTermLines(termId);
            const balanceLine = lines.find((l: any) => l.value === "balance") || lines[lines.length - 1];
            if (balanceLine) termNbDaysMap.set(termId, { nbDays: balanceLine.nb_days || 0, delayType: balanceLine.delay_type || "days_after" });
          } catch { /* skip */ }
        }));
      }
      function computeDueDate(refDate: string, nbDays: number, delayType: string): string {
        const base = new Date(refDate);
        if (delayType === "days_after_end_of_month") {
          const eom = new Date(base.getFullYear(), base.getMonth() + 1, 0);
          eom.setDate(eom.getDate() + nbDays);
          return eom.toISOString().slice(0, 10);
        }
        if (delayType === "days_after_end_of_next_month") {
          const eonm = new Date(base.getFullYear(), base.getMonth() + 2, 0);
          eonm.setDate(eonm.getDate() + nbDays);
          return eonm.toISOString().slice(0, 10);
        }
        const d = new Date(refDate);
        d.setDate(d.getDate() + nbDays);
        return d.toISOString().slice(0, 10);
      }
      const todayStr = new Date().toISOString().slice(0, 10);
      for (const item of mapped) {
        const termId = sos.find((s: any) => s.id === item.id)?.payment_term_id?.[0] || null;
        const refDate = sos.find((s: any) => s.id === item.id)?.x_payment_reference_date || null;
        if (refDate && termId && termNbDaysMap.has(termId)) {
          const { nbDays, delayType } = termNbDaysMap.get(termId)!;
          const dueDate = computeDueDate(refDate, nbDays, delayType);
          (item as any).paymentDueDate = dueDate;
          (item as any).paymentOverdueDays = Math.floor((new Date(todayStr).getTime() - new Date(dueDate).getTime()) / 86400000);
          (item as any).paymentReferenceDate = refDate;
        } else {
          (item as any).paymentDueDate = null;
          (item as any).paymentOverdueDays = null;
          (item as any).paymentReferenceDate = refDate;
        }
        (item as any).paymentTerm = termId ? (sos.find((s: any) => s.id === item.id)?.payment_term_id ? { id: sos.find((s: any) => s.id === item.id).payment_term_id[0], name: sos.find((s: any) => s.id === item.id).payment_term_id[1] } : null) : null;
      }

      // Seed current statuses silently (no notifications on first encounter)
      seedCurrentStatuses(
        mapped.map((s) => ({ id: s.id, name: s.name, shipmentStatus: s.shipmentStatus })),
        "sales"
      ).catch((err) => console.warn("[Notifications] SO seed error:", err));

      return mapped;
    }),

  // ─── Count Sales Orders ─────────────────────────────────────────────────
  count: publicProcedure
    .input(
      z.object({
        companyId: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return countSaleOrders({
        companyId: input?.companyId,
      });
    }),

  // ─── Get Single Sales Order ─────────────────────────────────────────────
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const so = await fetchSaleOrderById(input.id);
      if (!so) throw new Error("Sales order not found");

      // Fetch lines, pickings, and optionally the linked PO's vessel name in parallel
      const correspondingPOName = so.x_studio_corresponding_purchasesale_shipment || null;
      const [lines, pickings, linkedPOInfo] = await Promise.all([
        fetchSOLines(so.order_line),
        fetchPickings(so.picking_ids),
        // If there's a linked PO, fetch its vessel name and ID
        correspondingPOName ? fetchPOVesselNameByPOName(correspondingPOName) : Promise.resolve(null),
      ]);

      return {
        id: so.id,
        name: so.name,
        customer: so.partner_id ? { id: so.partner_id[0], name: so.partner_id[1] } : null,
        company: so.company_id ? { id: so.company_id[0], name: so.company_id[1] } : null,
        state: so.state,
        dateOrder: so.date_order || null,
        amountTotal: so.amount_total,
        amountUntaxed: so.amount_untaxed,
        amountTax: so.amount_tax,
        currency: so.currency_id ? { id: so.currency_id[0], name: so.currency_id[1] } : null,
        deliveryCount: so.delivery_count,
        numberOfLoads: so.number_of_loads,
        blNumber: so.x_studio_shipment_bl_number || null,
        trackingNumber: so.tracking_number || null,
        productCategory: so.x_studio_product_category || null,
        freightType: so.freight_type || null,
        loadType: so.load_type || null,
        shippingLine: so.shipping_line || null,
        shipmentStatus: so.x_studio_unified_shipment_status || so.x_studio_selection_field_65k_1j3t1b3d3 || null,
        sellingType: so.x_studio_selling_type || null,
        ultimateCustomer: so.x_studio_ultimate_customer || null,
        totalShipmentWeight: (() => {
          // Use the Odoo field if it has a value, otherwise compute from order lines
          const odooWeight = so.x_studio_total_shipment_weight_in_tons_sales;
          if (odooWeight && odooWeight > 0) return odooWeight;
          // Sum ordered quantities from lines and convert kg to tons
          const totalKg = lines.reduce((sum: number, l: Record<string, any>) => {
            const uomName = l.product_uom ? (l.product_uom[1] || "").toLowerCase() : "";
            const qty = l.product_uom_qty || 0;
            if (uomName.includes("ton") || uomName === "t" || uomName === "mt") return sum + qty;
            if (uomName.includes("kg") || uomName === "kilogram") return sum + qty / 1000;
            // Default: assume kg if UOM is ambiguous
            return sum + qty / 1000;
          }, 0);
          return Math.round(totalKg * 100) / 100;
        })(),
        acceptanceStatus: so.x_studio_shipment_acceptance_status || null,
        correspondingPO: so.x_studio_corresponding_purchasesale_shipment || null,
        correspondingPOId: linkedPOInfo?.poId || null,
        vesselName: linkedPOInfo?.vesselName || null,
        freeDaysDemurrage: linkedPOInfo?.freeDaysDemurrage || null,
        incoterm: so.incoterm ? { id: so.incoterm[0], name: so.incoterm[1] } : null,
        pricelist: so.pricelist_id ? { id: so.pricelist_id[0], name: so.pricelist_id[1] } : null,
        paymentTerm: so.payment_term_id ? { id: so.payment_term_id[0], name: so.payment_term_id[1] } : null,
        salesperson: so.user_id ? { id: so.user_id[0], name: so.user_id[1] } : null,
        clientRef: so.client_order_ref || null,
        origin: so.origin || null,
        // Shipping
        vesselCutOff: so.vessel_cut_off || null,
        vesselTrackingLink: so.vessel_tracking_link || null,
        ratePerContainerLoad: so.rate_per_container_load || null,
        transitTimeInDays: so.transit_time_in_days || null,
        clearanceAgent: so.local_clearance_agent ? { id: so.local_clearance_agent[0], name: so.local_clearance_agent[1] } : null,
        truckingCompany: so.local_trucking_company ? { id: so.local_trucking_company[0], name: so.local_trucking_company[1] } : null,
        etaPod: so.eta_pod || null,
        etaPol: so.eta_pol || null,
        etdPol: so.etd_pol || null,
        portOfLoading: so.pol || null,
        portOfDestination: so.pod || null,
        bookingNumber: so.booking_number || null,
        telexBLIssued: linkedPOInfo?.telexBLIssued || false,
        // Payment
        paymentTermSales: so.x_studio_payment_term || null,
        paymentTermPurchase: so.x_studio_payment_term_1 || null,
        oceanFreightInvoicedEntity: so.x_studio_ocean_freight_invoiced_entity || null,
        oceanFreightInvoicingEntity: so.x_studio_ocean_freight_invoicing_entity || null,
        clearanceTruckingInvoicedEntity: so.x_studio_clearance_trucking_invoiced_entity || null,
        clearanceTruckingInvoicingEntity: so.x_studio_clearance_trucking_invoicing_entity || null,
        notesPayment: so.x_studio_notespayment || null,
        notesPayment1: so.x_studio_notespayment_1 || null,
        paymentReferenceDate: so.x_payment_reference_date || null,
        saleOrderTemplateId: so.sale_order_template_id ? { id: so.sale_order_template_id[0], name: so.sale_order_template_id[1] } : null,
        // Lines
        lines: lines.map((l: Record<string, any>) => ({
          id: l.id,
          product: l.product_id ? { id: l.product_id[0], name: l.product_id[1] } : null,
          description: l.name || null,
          qty: l.product_uom_qty,
          qtyDelivered: l.qty_delivered,
          qtyInvoiced: l.qty_invoiced,
          priceUnit: l.price_unit,
          priceSubtotal: l.price_subtotal,
          uom: l.product_uom ? { id: l.product_uom[0], name: l.product_uom[1] } : null,
          discount: l.discount,
        })),
        // Pickings (deliveries)
        pickings: pickings.map((p: Record<string, any>) => ({
          id: p.id,
          name: p.name,
          state: p.state,
          partner: p.partner_id ? { id: p.partner_id[0], name: p.partner_id[1] } : null,
          origin: p.origin || null,
          scheduledDate: p.scheduled_date || null,
          dateDone: p.date_done || null,
          pickingType: p.picking_type_id ? { id: p.picking_type_id[0], name: p.picking_type_id[1] } : null,
          company: p.company_id ? { id: p.company_id[0], name: p.company_id[1] } : null,
          containerNumber: p.x_studio_loadcontainer_number_1 || null,
          sealNumber: p.x_studio_seal_number || null,
          loadingDate: p.x_studio_loading_date || null,
          netWeightTons: p.x_studio_net_weight_in_tons,
          quantityTons: p.x_studio_quantity_in_tons,
          tareWeightTons: p.x_studio_tare_weight_in_tons,
          balesBags: p.x_studio_number_of_balesbags || null,
          loadingStore: p.x_studio_loading_store || null,
          truckLoadSerial: p.x_studio_truck_load_serial_tl || null,
          loadedGrade: p.x_studio_loaded_grade || null,
          source: p.x_studio_source || null,
          purchasingUnit: p.x_studio_purchasing_unit || null,
          qualityScore: p.x_studio_quality_score,
          moisture: p.x_studio_moisture_,
          ndf: p.x_studio_ndf_,
          adf: p.x_studio_adf_,
          crudeProtein: p.x_studio_crude_protein_dry_matter_,
          premiumGrade: p.x_studio_premium_grade,
          standard: p.x_studio_standard_,
          truckingFee: p.x_studio_trucking_fee,
          truckingFees: p.x_studio_trucking_fees || null,
          truckingCostCurrency: p.x_studio_trucking_cost_currency || null,
          truckingDriver: p.x_studio_local_trucking_driver ? { id: p.x_studio_local_trucking_driver[0], name: p.x_studio_local_trucking_driver[1] } : null,
          truckingDriverContact: p.x_studio_local_trucking_driver_contact || null,
          containerCleanliness: p.x_studio_loadcontainer_cleanliness,
          properLashing: p.x_studio_proper_loadcontainer_lashing,
          properStacking: p.x_studio_proper_loadcontainer_stacking,
          truckCover: p.x_studio_presence_of_truck_cover,
          paymentConfirmation: p.x_studio_payment_confirmation,
          skuConfirmation: p.x_studio_sku_confirmation || null,
          // Procurement/Source
          purchasingUnit1: p.x_studio_purchasing_unit_1 || null,
          purchaseCurrency: p.x_studio_purchase_currency || p.x_studio_currency_id?.[1] || null,
          agreedPrice: p.x_studio_agreed_product_price_per_unit || 0,
          agreedPrice1: p.x_studio_agreed_product_price_per_unit_1 || 0,
          farmFieldName: p.x_studio_farmfield_name || null,
          loadedGrade1: p.x_studio_loaded_grade_1 || null,
          driverName: p.x_studio_driver_name || null,
          driverContact: p.x_studio_driver_contact || null,
          agreedTruckingCost: p.x_studio_agreed_trucking_cost || 0,
          advancePayment: p.x_studio_advance_payment || 0,
          advancePayment1: p.x_studio_advance_payment_1 || 0,
          longStayCost: p.x_studio_long_stay_cost || 0,
          loadingDatetime: p.x_studio_loading_datetime || null,
          loadingDatetime1: p.x_studio_loading_datetime_1 || null,
          // Quality (Destination/Received)
          grade1Pct: p.x_studio_grade_1_ || 0,
          grade3Pct: p.x_studio_grade_3_ || 0,
          overallReceivedGrade: p.x_studio_overall_received_grade_as_per_quality_assessment || null,
          overallReceivedGrade1: p.x_studio_overall_received_grade_as_per_quality_assessment_1 || null,
          totalReceivedBales: p.x_studio_total_number_of_received_bales || null,
          brokenDamagedBales: p.x_studio_brokendamaged_bales || 0,
          balesAbove12Moisture: p.x_studio_bales_with_moisture_above_12 || 0,
          grossWeightTons: p.x_studio_gross_weight_in_tons || 0,
          grossWeight: p.x_studio_gross_weight || 0,
          arrivalDatetime: p.x_studio_arrival_datetime || null,
          // Quality visual checks
          goodQualityGreenColor: p.x_studio_good_quality_green_color,
          goodQualityStemSize: p.x_studio_good_quality_stem_size,
          goodQualityLeaveAttachment: p.x_studio_good_quality_good_leave_attachement,
          goodQualityBaleTies: p.x_studio_good_quality_bale_ties,
          goodQualityBaleShape: p.x_studio_good_quality_uniformity_of_bale_shape,
          goodQualityNoBlackSpots: p.x_studio_good_quality_absence_of_black_spots,
          goodQualityNoForeignMaterial: p.x_studio_good_quality_absence_of_foreign_material,
          goodQualityNoInsects: p.x_studio_good_quality_absence_of_insects,
          // Accepted
          acceptedRejected: p.x_studio_accepted_rejected,
          // Loading Team
          qualitySupervisor: p.x_studio_quality_supervisor_for_delivery
            ? { id: p.x_studio_quality_supervisor_for_delivery[0], name: p.x_studio_quality_supervisor_for_delivery[1] }
            : null,
        })),
      };
    }),

  // ─── Create Sales Order ─────────────────────────────────────────────────
  create: publicProcedure
    .input(
      z.object({
        partner_id: z.number(),
        company_id: z.number(),
        currency_id: z.number().optional(),
        pricelist_id: z.number().optional(),
        date_order: z.string().optional(),
        number_of_loads: z.number().optional(),
        load_type: z.string().optional(),
        freight_type: z.string().optional(),
        shipping_line: z.string().optional(),
        tracking_number: z.string().optional(),
        vessel_cut_off: z.string().optional(),
        vessel_tracking_link: z.string().optional(),
        rate_per_container_load: z.string().optional(),
        transit_time_in_days: z.string().optional(),
        incoterm: z.number().optional(),
        payment_term_id: z.number().optional(),
        local_clearance_agent: z.number().optional(),
        local_trucking_company: z.number().optional(),
        eta_pod: z.string().optional(),
        eta_pol: z.string().optional(),
        etd_pol: z.string().optional(),
        pol: z.string().optional(),
        pod: z.string().optional(),
        booking_number: z.string().optional(),
        x_studio_product_category: z.string().optional(),
        x_studio_ultimate_customer: z.string().optional(),
        x_studio_shipment_bl_number: z.string().optional(),
        x_studio_selling_type: z.string().optional(),
        x_studio_corresponding_purchasesale_shipment: z.string().optional(),
        x_studio_selection_field_65k_1j3t1b3d3: z.string().optional(),
        x_studio_unified_shipment_status: z.string().optional(),
        x_studio_shipment_acceptance_status: z.string().optional(),
        x_studio_payment_term: z.string().optional(),
        x_studio_payment_term_1: z.string().optional(),
        x_studio_ocean_freight_invoiced_entity: z.string().optional(),
        x_studio_ocean_freight_invoicing_entity: z.string().optional(),
        x_studio_clearance_trucking_invoiced_entity: z.string().optional(),
        x_studio_clearance_trucking_invoicing_entity: z.string().optional(),
        x_studio_notespayment: z.string().optional(),
        x_studio_notespayment_1: z.string().optional(),
        x_payment_reference_date: z.string().optional(),
        client_order_ref: z.string().optional(),
        sale_order_template_id: z.number().optional(),
        warehouse_id: z.number().optional(),
        distribute_weight_equally: z.boolean().optional(),
        lines: z.array(
          z.object({
            product_id: z.number(),
            product_uom_qty: z.number(),
            price_unit: z.number(),
            product_uom: z.number().optional(),
            discount: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const id = await createSaleOrder(input);
      return { id };
    }),

  // ─── Update Sales Order ─────────────────────────────────────────────────
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        partner_id: z.number().optional(),
        user_id: z.number().optional(),
        date_order: z.string().optional(),
        number_of_loads: z.number().optional(),
        load_type: z.string().optional(),
        freight_type: z.string().optional(),
        shipping_line: z.string().optional(),
        tracking_number: z.string().optional(),
        vessel_cut_off: z.string().optional(),
        vessel_tracking_link: z.string().optional(),
        rate_per_container_load: z.string().optional(),
        transit_time_in_days: z.string().optional(),
        incoterm: z.number().optional(),
        payment_term_id: z.number().optional(),
        local_clearance_agent: z.number().optional(),
        local_trucking_company: z.number().optional(),
        eta_pod: z.string().optional(),
        eta_pol: z.string().optional(),
        etd_pol: z.string().optional(),
        pol: z.string().optional(),
        pod: z.string().optional(),
        booking_number: z.string().optional(),
        x_studio_product_category: z.string().optional(),
        x_studio_ultimate_customer: z.string().optional(),
        x_studio_total_shipment_weight_in_tons_sales: z.number().optional(),
        x_studio_shipment_bl_number: z.string().optional(),
        x_studio_selling_type: z.string().optional(),
        x_studio_corresponding_purchasesale_shipment: z.string().optional(),
        x_studio_selection_field_65k_1j3t1b3d3: z.string().optional(),
        x_studio_unified_shipment_status: z.string().optional(),
        x_studio_shipment_acceptance_status: z.string().optional(),
        x_studio_payment_term: z.string().optional(),
        x_studio_payment_term_1: z.string().optional(),
        x_studio_ocean_freight_invoiced_entity: z.string().optional(),
        x_studio_ocean_freight_invoicing_entity: z.string().optional(),
        x_studio_clearance_trucking_invoiced_entity: z.string().optional(),
        x_studio_clearance_trucking_invoicing_entity: z.string().optional(),
        x_studio_notespayment: z.string().optional(),
        x_studio_notespayment_1: z.string().optional(),
        x_payment_reference_date: z.string().optional(),
        client_order_ref: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const success = await updateSaleOrder(input);

      // If status was updated, check for notification
      if (success && input.x_studio_unified_shipment_status) {
        try {
          const so = await fetchSaleOrderById(input.id);
          if (so) {
            const { checkAndNotifyStatusChanges } = await import("./notifications");
            await checkAndNotifyStatusChanges(
              [{ id: input.id, name: so.name || `SO #${input.id}`, shipmentStatus: input.x_studio_unified_shipment_status }],
              "sales",
              true // forceNotify: explicit user action
            );
          }
        } catch (err) {
          console.warn("[Notifications] SO status change notification error:", err);
        }
      }

      return { success };
    }),

  // ─── Update Delivery Picking ────────────────────────────────────────────
  updatePicking: publicProcedure
    .input(
      z.object({
        id: z.number(),
        x_studio_loadcontainer_number_1: z.string().optional(),
        x_studio_seal_number: z.string().optional(),
        x_studio_loading_date: z.string().optional(),
        x_studio_net_weight_in_tons: z.number().optional(),
        x_studio_quantity_in_tons: z.number().optional(),
        x_studio_tare_weight_in_tons: z.number().optional(),
        x_studio_number_of_balesbags: z.string().optional(),
        x_studio_loading_store: z.string().optional(),
        x_studio_truck_load_serial_tl: z.string().optional(),
        x_studio_loaded_grade: z.string().optional(),
        x_studio_source: z.string().optional(),
        x_studio_purchasing_unit: z.string().optional(),
        x_studio_quality_score: z.number().optional(),
        x_studio_moisture_: z.number().optional(),
        x_studio_ndf_: z.number().optional(),
        x_studio_adf_: z.number().optional(),
        x_studio_crude_protein_dry_matter_: z.number().optional(),
        x_studio_trucking_fee: z.number().optional(),
        x_studio_trucking_fees: z.string().optional(),
        x_studio_trucking_cost_currency: z.string().optional(),
        x_studio_local_trucking_driver: z.number().optional(),
        x_studio_local_trucking_driver_contact: z.string().optional(),
        x_studio_loadcontainer_cleanliness: z.boolean().optional(),
        x_studio_proper_loadcontainer_lashing: z.boolean().optional(),
        x_studio_proper_loadcontainer_stacking: z.boolean().optional(),
        x_studio_presence_of_truck_cover: z.boolean().optional(),
        x_studio_payment_confirmation: z.boolean().optional(),
        x_studio_sku_confirmation: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const success = await updateSalesPicking(input);
      return { success };
    }),

  // ─── File Upload to SO ──────────────────────────────────────────────────
  uploadSOFile: publicProcedure
    .input(
      z.object({
        soId: z.number(),
        fieldName: z.string(),
        base64Content: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const success = await uploadFileToSO(input.soId, input.fieldName, input.base64Content);
      return { success };
    }),

  // ─── File Upload to Delivery Picking ────────────────────────────────────
  uploadPickingFile: publicProcedure
    .input(
      z.object({
        pickingId: z.number(),
        fieldName: z.string(),
        base64Content: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const success = await uploadFileToSalesPicking(input.pickingId, input.fieldName, input.base64Content);
      return { success };
    }),

  // ─── Read SO File ───────────────────────────────────────────────────────
  readSOFile: publicProcedure
    .input(z.object({ soId: z.number(), fieldName: z.string() }))
    .query(async ({ input }) => {
      const content = await readSOFile(input.soId, input.fieldName);
      return { content: content || null };
    }),

  // ─── Read Picking File ──────────────────────────────────────────────────
  readPickingFile: publicProcedure
    .input(z.object({ pickingId: z.number(), fieldName: z.string() }))
    .query(async ({ input }) => {
      const content = await readSalesPickingFile(input.pickingId, input.fieldName);
      return { content: content || null };
    }),

  //  // ─── SO File Status Check ──────────────────────────────────────────
  soFileStatus: publicProcedure
    .input(z.object({ soId: z.number() }))
    .query(async ({ input }) => {
      return checkSOFileStatus(input.soId);
    }),

  // ─── Picking File Status Check ──────────────────────────────────────
  pickingFileStatus: publicProcedure
    .input(z.object({ pickingId: z.number() }))
    .query(async ({ input }) => {
      return checkSalesPickingFileStatus(input.pickingId);
    }),

  // ─── Confirm Sales Order ────────────────────────────────────────────
  confirm: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const success = await confirmSaleOrder(input.id);
      return { success };
    }),

  // ─── All Stock at Location (for "View Stock" popup) ────────────────────
  allStockAtLocation: publicProcedure
    .input(z.object({
      locationId: z.number(),
    }))
    .query(async ({ input }) => {
      return fetchAllStockAtLocation(input.locationId);
    }),

  // ─── Redistribute Weight Across Deliveries ────────────────────────────
  redistributeWeight: publicProcedure
    .input(z.object({
      orderId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const so = await fetchSaleOrderById(input.orderId);
      if (!so) throw new Error("Sale order not found");
      const lines = await fetchSOLines(so.order_line);
      const mappedLines = lines.map(l => ({
        product_id: l.product_id ? l.product_id[0] : 0,
        product_uom_qty: l.product_uom_qty,
        product_uom: l.product_uom ? l.product_uom[0] : undefined,
      }));
      await distributeWeightAcrossPickings(input.orderId, mappedLines, "sales");
      return { success: true };
    }),

  // ─── Invoices ──────────────────────────────────────────────────────────
  invoices: publicProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ input }) => {
      const so = await fetchSaleOrderById(input.orderId);
      if (!so) return [];
      const invoiceIds = Array.isArray(so.invoice_ids) ? so.invoice_ids : [];
      if (invoiceIds.length === 0) return [];
      const invoices = await fetchInvoicesByIds(invoiceIds);
      return invoices.map(inv => ({
        id: inv.id,
        name: inv.name || "\u2014",
        type: inv.move_type === "out_invoice" ? "Customer Invoice" :
              inv.move_type === "out_refund" ? "Customer Credit Note" :
              inv.move_type === "in_invoice" ? "Vendor Bill" :
              inv.move_type === "in_refund" ? "Vendor Credit Note" : inv.move_type,
        state: inv.state,
        paymentState: inv.payment_state,
        invoiceDate: inv.invoice_date || null,
        dueDate: inv.invoice_date_due || null,
        amountTotal: inv.amount_total,
        amountUntaxed: inv.amount_untaxed,
        amountTax: inv.amount_tax,
        amountResidual: inv.amount_residual,
        partner: Array.isArray(inv.partner_id) ? inv.partner_id[1] : null,
        currency: Array.isArray(inv.currency_id) ? inv.currency_id[1] : "AED",
        ref: inv.ref || null,
      }));
    }),

  // ─── Lookup SO ID by Name (with preview data) ───────────────────────
  lookupByName: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      const so = await fetchSaleOrderByName(input.name);
      if (!so) return { id: null, preview: null };
      // Fetch full SO for preview data
      const full = await fetchSaleOrderById(so.id);
      if (!full) return { id: so.id, preview: null };
      return {
        id: so.id,
        preview: {
          name: full.name || input.name,
          customer: Array.isArray(full.partner_id) ? full.partner_id[1] : String(full.partner_id || "\u2014"),
          state: full.state || "\u2014",
          amountTotal: full.amount_total || 0,
          currency: Array.isArray(full.currency_id) ? full.currency_id[1] : "AED",
          vessel: "\u2014", // vessel name comes from linked PO, not SO model
          deliveries: full.delivery_count || 0,
          bookingNumber: full.x_studio_booking_number || "\u2014",
        },
      };
    }),

  // \u2500\u2500\u2500 Search by Container/Truck Load Number \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Searches stock.picking records by container number or truck load serial,
  // then returns the parent sale.order IDs that contain matching deliveries.
  searchByLoadField: publicProcedure
    .input(z.object({ query: z.string().min(2) }))
    .query(async ({ input }) => {
      const { searchSalesPickingsByLoadField } = await import("../odoo-sales-shipments");
      return searchSalesPickingsByLoadField(input.query);
    }),
});
