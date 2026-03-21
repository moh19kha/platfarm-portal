/**
 * tRPC Router for Purchase Shipments (purchase.order)
 *
 * Provides endpoints for listing, viewing, creating, updating shipments,
 * managing loads/receipts (stock.picking), and file uploads.
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { seedCurrentStatuses } from "./notifications";
import {
  fetchPurchaseOrders,
  fetchPurchaseOrderById,
  fetchPurchaseOrderByName,
  countPurchaseOrders,
  fetchPOLines,
  fetchPickings,
  fetchPickingsForPO,
  createPurchaseOrder,
  updatePurchaseOrder,
  updatePicking,
  uploadFileToPO,
  uploadFileToPicking,
  readPOFile,
  readPickingFile,
  fetchIncoterms,
  fetchPaymentTerms,
  fetchPaymentTermLines,
  fetchEmployees,
  checkPickingFileStatus,
  checkPOFileStatus,
  fetchPartners,
  distributeWeightAcrossPickings,
  fetchInvoicesByIds,
  resolveEmployeeIds,
} from "../odoo-shipments";
import { fetchWarehouses, fetchAggregatedStock, fetchStockLocations, fetchProductStockByLocation, fetchAllStockAtLocation, executeKw } from "../odoo";

export const shipmentsRouter = router({
  // ─── List Shipments ────────────────────────────────────────────────────
  list: publicProcedure
    .input(
      z.object({
        companyId: z.number().optional(),
        requisitionId: z.number().optional(),
        limit: z.number().optional().default(200),
        offset: z.number().optional().default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const pos = await fetchPurchaseOrders({
        companyId: input?.companyId,
        requisitionId: input?.requisitionId,
        limit: input?.limit,
        offset: input?.offset,
      });

      // Batch-fetch all PO line IDs to get product names for search
      const allLineIds = pos.flatMap(po => po.order_line || []);
      let lineProductMap = new Map<number, string[]>(); // poId -> product names
      if (allLineIds.length > 0) {
        try {
          const lines = await fetchPOLines(allLineIds);
          // Group product names by PO (via line ID membership)
          if (Array.isArray(lines)) {
            for (const po of pos) {
              const poLineSet = new Set(po.order_line || []);
              const productNames = lines
                .filter(l => poLineSet.has(l.id))
                .map(l => l.product_id ? l.product_id[1] : "")
                .filter(Boolean);
              lineProductMap.set(po.id, [...new Set(productNames)]);
            }
          }
        } catch (err) {
          console.warn("[shipments.list] Failed to fetch PO lines for product names:", err);
        }
      }

      // Check for status changes in background (don't block response)
      const mapped = pos.map((po) => ({
        id: po.id,
        name: po.name,
        vendor: po.partner_id ? { id: po.partner_id[0], name: po.partner_id[1] } : null,
        company: po.company_id ? { id: po.company_id[0], name: po.company_id[1] } : null,
        state: po.state,
        dateOrder: po.date_order || null,
        datePlanned: po.date_planned || null,
        amountTotal: po.amount_total,
        amountUntaxed: po.amount_untaxed,
        amountTax: po.amount_tax,
        currency: po.currency_id ? { id: po.currency_id[0], name: po.currency_id[1] } : null,
        agreement: po.requisition_id ? { id: po.requisition_id[0], name: po.requisition_id[1] } : null,
        lineIds: po.order_line,
        pickingIds: po.picking_ids,
        productNames: lineProductMap.get(po.id) || [],
        numberOfLoads: po.number_of_loads,
        vesselName: po.x_studio_vessel_name || null,
        trackingNumber: po.x_studio_tracking_number || null,
        shipmentDate: po.x_studio_shipment_date || null,
        etaArrival: po.eta_arrival || null,
        portOfLoading: po.pol_source || null,
        portOfDestination: po.pod_source || null,
        bookingNumber: po.x_studio_booking_number || null,
        blNumber: po.shipment_bl_number || po.x_studio_shipment_bl_number || null,
        etdPol: po.x_studio_etd_pol || null,
        etaPol: po.x_studio_eta_pol || null,
        productCategory: po.x_studio_product_category || null,
        freightType: po.freight_type || null,
        loadType: po.load_type || null,
        shippingLine: po.ocean_transporter_company || null,
        shipmentStatus: po.x_studio_unified_shipment_status || po.x_studio_shipment_status || null,
        incoterm: po.incoterm_id ? { id: po.incoterm_id[0], name: po.incoterm_id[1] } : null,
        paymentTerm: po.payment_term_id ? { id: po.payment_term_id[0], name: po.payment_term_id[1] } : null,
        clearanceAgent: po.local_clearance_agent ? { id: po.local_clearance_agent[0], name: po.local_clearance_agent[1] } : null,
        truckingCompany: po.local_trucking_company ? { id: po.local_trucking_company[0], name: po.local_trucking_company[1] } : null,
        procurementOfficer: po.x_studio_procurement_officer ? { id: po.x_studio_procurement_officer[0], name: po.x_studio_procurement_officer[1] } : null,
        ultimateCustomer: po.x_studio_ultimate_customer || null,
        freeDaysDemurrage: po.x_studio_total_free_days_demurrage_detention,
        transitTimeDays: po.x_studio_transit_time_days,
        vesselCutOff: po.x_studio_vessel_cut_off || null,
        ratePerContainer: po.x_studio_rate_per_containerload,
        totalShipmentWeight: po.x_studio_total_shipment_weight_in_tons_1,
        sellingPricePerTon: po.x_studio_selling_price_per_ton,
        paymentStatus: po.x_studio_payment_status || null,
        paidAmountInAed: po.x_studio_paid_amount_in_aed || 0,
        docStatus: po.x_studio_shipment_documentation_status || null,
        acceptanceStatus: po.x_studio_shipment_acceptance_status || null,
        linkedShipments: po.notes ? po.notes.replace(/<[^>]*>/g, '').trim() : null,
        procurementRef: po.x_studio_procurement_ref || null,
        procurementData: po.x_studio_procurement_data || null,
        procurementId: po.x_studio_procurement_id || null,
      }));

      // Seed current statuses silently (no notifications on first encounter)
      seedCurrentStatuses(
        mapped.map((s) => ({ id: s.id, name: s.name, shipmentStatus: s.shipmentStatus })),
        "purchase"
      ).catch((err) => console.warn("[Notifications] PO seed error:", err));

      return mapped;
    }),

  // ─── Count Shipments ───────────────────────────────────────────────────
  count: publicProcedure
    .input(
      z.object({
        companyId: z.number().optional(),
        requisitionId: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return countPurchaseOrders({
        companyId: input?.companyId,
        requisitionId: input?.requisitionId,
      });
    }),

  // ─── Get Single Shipment ───────────────────────────────────────────────
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const po = await fetchPurchaseOrderById(input.id);
      if (!po) throw new Error("Purchase order not found");

      // Fetch lines and pickings in parallel
      const [lines, pickings] = await Promise.all([
        fetchPOLines(po.order_line),
        fetchPickings(po.picking_ids),
      ]);

      // Collect all employee IDs from Loading Team fields across all pickings
      const allEmployeeIds: number[] = [];
      for (const p of pickings) {
        if (Array.isArray(p.quality_supervisor_ids)) allEmployeeIds.push(...p.quality_supervisor_ids);
        if (Array.isArray(p.loading_driver_ids)) allEmployeeIds.push(...p.loading_driver_ids);
        if (Array.isArray(p.labor_ids)) allEmployeeIds.push(...p.labor_ids);
      }
      // Resolve employee IDs to names in a single batch call
      const employeeNameMap = await resolveEmployeeIds(allEmployeeIds);

      return {
        id: po.id,
        name: po.name,
        vendor: po.partner_id ? { id: po.partner_id[0], name: po.partner_id[1] } : null,
        company: po.company_id ? { id: po.company_id[0], name: po.company_id[1] } : null,
        state: po.state,
        dateOrder: po.date_order || null,
        datePlanned: po.date_planned || null,
        amountTotal: po.amount_total,
        amountUntaxed: po.amount_untaxed,
        amountTax: po.amount_tax,
        currency: po.currency_id ? { id: po.currency_id[0], name: po.currency_id[1] } : null,
        agreement: po.requisition_id ? { id: po.requisition_id[0], name: po.requisition_id[1] } : null,
        numberOfLoads: po.number_of_loads,
        vesselName: po.x_studio_vessel_name || null,
        trackingNumber: po.x_studio_tracking_number || null,
        shipmentDate: po.x_studio_shipment_date || null,
        etaArrival: po.eta_arrival || null,
        portOfLoading: po.pol_source || null,
        portOfDestination: po.pod_source || null,
        bookingNumber: po.x_studio_booking_number || null,
        blNumber: po.shipment_bl_number || po.x_studio_shipment_bl_number || null,
        etdPol: po.x_studio_etd_pol || null,
        etaPol: po.x_studio_eta_pol || null,
        productCategory: po.x_studio_product_category || null,
        freightType: po.freight_type || null,
        loadType: po.load_type || null,
        shippingLine: po.ocean_transporter_company || null,
        shipmentStatus: po.x_studio_unified_shipment_status || po.x_studio_shipment_status || null,
        incoterm: po.incoterm_id ? { id: po.incoterm_id[0], name: po.incoterm_id[1] } : null,
        paymentTerm: po.payment_term_id ? { id: po.payment_term_id[0], name: po.payment_term_id[1] } : null,
        clearanceAgent: po.local_clearance_agent ? { id: po.local_clearance_agent[0], name: po.local_clearance_agent[1] } : null,
        truckingCompany: po.local_trucking_company ? { id: po.local_trucking_company[0], name: po.local_trucking_company[1] } : null,
        procurementOfficer: po.x_studio_procurement_officer ? { id: po.x_studio_procurement_officer[0], name: po.x_studio_procurement_officer[1] } : null,
        ultimateCustomer: po.x_studio_ultimate_customer || null,
        freeDaysDemurrage: po.x_studio_total_free_days_demurrage_detention,
        transitTimeDays: po.x_studio_transit_time_days,
        vesselCutOff: po.x_studio_vessel_cut_off || null,
        ratePerContainer: po.x_studio_rate_per_containerload,
        totalShipmentWeight: po.x_studio_total_shipment_weight_in_tons_1,
        sellingPricePerTon: po.x_studio_selling_price_per_ton,
        paymentStatus: po.x_studio_payment_status || null,
        paidAmountInAed: po.x_studio_paid_amount_in_aed || 0,
        docStatus: po.x_studio_shipment_documentation_status || null,
        acceptanceStatus: po.x_studio_shipment_acceptance_status || null,
        telexBLIssued: !!po.telex_release_bl_issued,
        linkedShipments: po.notes ? po.notes.replace(/<[^>]*>/g, '').trim() : null,
        procurementRef: po.x_studio_procurement_ref || null,
        procurementData: po.x_studio_procurement_data || null,
        procurementId: po.x_studio_procurement_id || null,
        lines: lines.map((l) => ({
          id: l.id,
          product: l.product_id ? { id: l.product_id[0], name: l.product_id[1] } : null,
          qty: l.product_qty,
          qtyReceived: l.qty_received,
          qtyInvoiced: l.qty_invoiced,
          priceUnit: l.price_unit,
          priceSubtotal: l.price_subtotal,
          uom: l.product_uom ? { id: l.product_uom[0], name: l.product_uom[1] } : null,
          datePlanned: l.date_planned || null,
        })),
        pickings: pickings.map((p) => ({
          id: p.id,
          name: p.name,
          state: p.state,
          vendor: p.partner_id ? { id: p.partner_id[0], name: p.partner_id[1] } : null,
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
          // Procurement (Source) tab
          purchasingUnit1: p.x_studio_purchasing_unit_1 || null,
          purchaseCurrency: p.x_studio_purchase_currency ? { id: (p as any).x_studio_purchase_currency[0], name: (p as any).x_studio_purchase_currency[1] } : (p as any).x_studio_currency_id ? { id: (p as any).x_studio_currency_id[0], name: (p as any).x_studio_currency_id[1] } : null,
          agreedPricePerUnit: (p as any).x_studio_agreed_product_price_per_unit_1 ?? null,
          farmFieldName: (p as any).x_studio_farmfield_name || null,
          loadedGrade1: (p as any).x_studio_loaded_grade_1 || null,
          driverName: (p as any).x_studio_driver_name || null,
          driverContact: (p as any).x_studio_driver_contact || null,
          agreedTruckingCost: (p as any).x_studio_agreed_trucking_cost ?? null,
          advancePayment: (p as any).x_studio_advance_payment_1 ?? null,
          longStayCharges: (p as any).x_studio_long_stay_cost ?? null,
          loadingDatetime: (p as any).x_studio_loading_datetime || null,
          loadingDatetime1: (p as any).x_studio_loading_datetime_1 || null,
          // Quality (Received) tab
          grade1Pct: (p as any).x_studio_grade_1_ ?? null,
          grade3Pct: (p as any).x_studio_grade_3_ ?? null,
          overallReceivedGrade: (p as any).x_studio_overall_received_grade_as_per_quality_assessment || null,
          overallReceivedGrade1: (p as any).x_studio_overall_received_grade_as_per_quality_assessment_1 || null,
          totalReceivedBales: (p as any).x_studio_total_number_of_received_bales || null,
          brokenDamagedBales: (p as any).x_studio_brokendamaged_bales || null,
          balesAbove12Moisture: (p as any).x_studio_bales_with_moisture_above_12 || null,
          grossWeightTons: (p as any).x_studio_gross_weight_in_tons ?? null,
          grossWeight: (p as any).x_studio_gross_weight || null,
          arrivalDatetime: (p as any).x_studio_arrival_datetime || null,
          // Quality visual checks
          goodQualityGreenColor: (p as any).x_studio_good_quality_green_color ?? false,
          goodQualityStemSize: (p as any).x_studio_good_quality_stem_size ?? false,
          goodQualityLeaveAttachment: (p as any).x_studio_good_quality_good_leave_attachement ?? false,
          goodQualityBaleTies: (p as any).x_studio_good_quality_bale_ties ?? false,
          goodQualityBaleShape: (p as any).x_studio_good_quality_uniformity_of_bale_shape ?? false,
          goodQualityNoBlackSpots: (p as any).x_studio_good_quality_absence_of_black_spots ?? false,
          goodQualityNoForeignMaterial: (p as any).x_studio_good_quality_absence_of_foreign_material ?? false,
          goodQualityNoInsects: (p as any).x_studio_good_quality_absence_of_insects ?? false,
          // Accepted load
          acceptedRejected: (p as any).x_studio_accepted_rejected ?? false,
          // Commission/Deduction
          isThereCommission: (p as any).x_studio_is_there_commission ?? false,
          commissionedPerson: (p as any).x_studio_commissioned_person_1 || null,
          commissionCurrency: (p as any).x_studio_commission_currency || null,
          commissionAmount: (p as any).x_studio_commission_amount || 0,
          qualitySupervisor: (p as any).x_studio_quality_supervisor_for_delivery ? { id: (p as any).x_studio_quality_supervisor_for_delivery[0], name: (p as any).x_studio_quality_supervisor_for_delivery[1] } : null,
          noCommissionReason: (p as any).x_studio_if_no_what_is_the_reason_for_no_commission || null,
          isThereDeductionClaim: (p as any).x_studio_is_there_deductionsclaim ?? false,
          claimCurrency: (p as any).x_studio_claim_currency || null,
          claimAmount: (p as any).x_studio_claim_amount || 0,
          claimDescription: (p as any).x_studio_claim_description || null,
          claimReason: (p as any).x_studio_claim_reason || null,
          deductionAmount: (p as any).x_studio_deduction_amount || 0,
          // Loading Team (for incentive calculations)
          qualitySupervisorIds: (Array.isArray(p.quality_supervisor_ids) ? p.quality_supervisor_ids : []).map((id: number) => ({ id, name: employeeNameMap.get(id) || `Employee #${id}` })),
          loadingDriverIds: (Array.isArray(p.loading_driver_ids) ? p.loading_driver_ids : []).map((id: number) => ({ id, name: employeeNameMap.get(id) || `Employee #${id}` })),
          laborIds: (Array.isArray(p.labor_ids) ? p.labor_ids : []).map((id: number) => ({ id, name: employeeNameMap.get(id) || `Employee #${id}` })),
          qualitySupervisorForDelivery: p.quality_supervisor_for_delivery ? { id: p.quality_supervisor_for_delivery[0], name: p.quality_supervisor_for_delivery[1] } : null,
          // Inherited from parent PO
          procurementOfficer: po.x_studio_procurement_officer ? { id: po.x_studio_procurement_officer[0], name: po.x_studio_procurement_officer[1] } : null,
        })),
      };
    }),

  // ─── Create Shipment ───────────────────────────────────────────────────
  create: publicProcedure
    .input(
      z.object({
        partner_id: z.number(),
        company_id: z.number(),
        currency_id: z.number().optional(),
        requisition_id: z.number().optional(),
        date_order: z.string().optional(),
        date_planned: z.string().optional(),
        number_of_loads: z.number().optional(),
        x_studio_vessel_name: z.string().optional(),
        x_studio_tracking_number: z.string().optional(),
        x_studio_shipment_date: z.string().optional(),
        eta_arrival: z.string().optional(),
        pol_source: z.string().optional(),
        pod_source: z.string().optional(),
        x_studio_booking_number: z.string().optional(),
        shipment_bl_number: z.string().optional(),
        x_studio_etd_pol: z.string().optional(),
        x_studio_eta_pol: z.string().optional(),
        x_studio_product_category: z.string().optional(),
        freight_type: z.string().optional(),
        load_type: z.string().optional(),
        ocean_transporter_company: z.string().optional(),
        x_studio_shipment_status: z.string().optional(),
        x_studio_unified_shipment_status: z.string().optional(),
        incoterm_id: z.number().optional(),
        payment_term_id: z.number().optional(),
        local_clearance_agent: z.number().optional(),
        local_trucking_company: z.number().optional(),
        x_studio_ultimate_customer: z.string().optional(),
        x_studio_total_free_days_demurrage_detention: z.number().optional(),
        x_studio_transit_time_days: z.number().optional(),
        x_studio_vessel_cut_off: z.string().optional(),
        x_studio_rate_per_containerload: z.number().optional(),
        x_studio_total_shipment_weight_in_tons_1: z.number().optional(),
        x_studio_selling_price_per_ton: z.number().optional(),
        x_studio_payment_status: z.string().optional(),
        x_studio_shipment_documentation_status: z.string().optional(),
        x_studio_shipment_acceptance_status: z.string().optional(),
        notes: z.string().optional(),
        origin: z.string().optional(),
        picking_type_id: z.number().optional(),
        distribute_weight_equally: z.boolean().optional(),
        lines: z.array(
          z.object({
            product_id: z.number(),
            product_qty: z.number(),
            price_unit: z.number(),
            product_uom: z.number().optional(),
            date_planned: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const id = await createPurchaseOrder(input);
      // Fetch the PO name (e.g. "PO/2026/0042") for back-referencing
      let name = "";
      try {
        const { fetchPurchaseOrderById } = await import("../odoo-shipments");
        const po = await fetchPurchaseOrderById(id);
        name = po?.name || "";
      } catch {}
      return { id, name };
    }),

  // ─── Update Shipment ───────────────────────────────────────────────────
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        partner_id: z.number().optional(),
        date_order: z.string().optional(),
        date_planned: z.string().optional(),
        number_of_loads: z.number().optional(),
        x_studio_vessel_name: z.string().optional(),
        x_studio_tracking_number: z.string().optional(),
        x_studio_shipment_date: z.string().optional(),
        eta_arrival: z.string().optional(),
        pol_source: z.string().optional(),
        pod_source: z.string().optional(),
        x_studio_booking_number: z.string().optional(),
        shipment_bl_number: z.string().optional(),
        x_studio_etd_pol: z.string().optional(),
        x_studio_eta_pol: z.string().optional(),
        x_studio_product_category: z.string().optional(),
        freight_type: z.string().optional(),
        load_type: z.string().optional(),
        ocean_transporter_company: z.string().optional(),
        x_studio_shipment_status: z.string().optional(),
        x_studio_unified_shipment_status: z.string().optional(),
        incoterm_id: z.number().optional(),
        payment_term_id: z.number().optional(),
        local_clearance_agent: z.number().optional(),
        local_trucking_company: z.number().optional(),
        x_studio_procurement_officer: z.number().optional(),
        x_studio_ultimate_customer: z.string().optional(),
        x_studio_total_free_days_demurrage_detention: z.number().optional(),
        x_studio_transit_time_days: z.number().optional(),
        x_studio_vessel_cut_off: z.string().optional(),
        x_studio_rate_per_containerload: z.number().optional(),
        x_studio_total_shipment_weight_in_tons_1: z.number().optional(),
        x_studio_selling_price_per_ton: z.number().optional(),
        x_studio_payment_status: z.string().optional(),
        x_studio_shipment_documentation_status: z.string().optional(),
        x_studio_shipment_acceptance_status: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const success = await updatePurchaseOrder(input);

      // If status was updated, check for notification
      if (success && input.x_studio_unified_shipment_status) {
        // Fetch the order name for the notification
        try {
          const po = await fetchPurchaseOrderById(input.id);
          if (po) {
            const { checkAndNotifyStatusChanges } = await import("./notifications");
            await checkAndNotifyStatusChanges(
              [{ id: input.id, name: po.name || `PO #${input.id}`, shipmentStatus: input.x_studio_unified_shipment_status }],
              "purchase",
              true // forceNotify: explicit user action
            );
          }
        } catch (err) {
          console.warn("[Notifications] PO status change notification error:", err);
        }
      }

      return { success };
    }),

  // ─── Update Picking (Load/Receipt) ─────────────────────────────────────
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
        // Procurement (Source) tab
        x_studio_purchasing_unit_1: z.string().optional(),
        x_studio_agreed_product_price_per_unit_1: z.number().optional(),
        x_studio_farmfield_name: z.string().optional(),
        x_studio_loaded_grade_1: z.string().optional(),
        x_studio_driver_name: z.string().optional(),
        x_studio_driver_contact: z.string().optional(),
        x_studio_agreed_trucking_cost: z.number().optional(),
        x_studio_advance_payment_1: z.number().optional(),
        x_studio_long_stay_cost: z.number().optional(),
        x_studio_loading_datetime: z.string().optional(),
        x_studio_loading_datetime_1: z.string().optional(),
        // Quality (Received) tab
        x_studio_grade_1_: z.number().optional(),
        x_studio_grade_3_: z.number().optional(),
        x_studio_overall_received_grade_as_per_quality_assessment: z.string().optional(),
        x_studio_overall_received_grade_as_per_quality_assessment_1: z.string().optional(),
        x_studio_total_number_of_received_bales: z.number().optional(),
        x_studio_brokendamaged_bales: z.number().optional(),
        x_studio_bales_with_moisture_above_12: z.number().optional(),
        x_studio_gross_weight_in_tons: z.number().optional(),
        x_studio_arrival_datetime: z.string().optional(),
        // Quality visual checks
        x_studio_good_quality_green_color: z.boolean().optional(),
        x_studio_good_quality_stem_size: z.boolean().optional(),
        x_studio_good_quality_good_leave_attachement: z.boolean().optional(),
        x_studio_good_quality_bale_ties: z.boolean().optional(),
        x_studio_good_quality_uniformity_of_bale_shape: z.boolean().optional(),
        x_studio_good_quality_absence_of_black_spots: z.boolean().optional(),
        x_studio_good_quality_absence_of_foreign_material: z.boolean().optional(),
        x_studio_good_quality_absence_of_insects: z.boolean().optional(),
        // Accepted load
        x_studio_accepted_rejected: z.boolean().optional(),
        // Commission/Deduction
        x_studio_is_there_commission: z.boolean().optional(),
        x_studio_commissioned_person_1: z.string().optional(),
        x_studio_commission_currency: z.string().optional(),
        x_studio_commission_amount: z.number().optional(),
        x_studio_if_no_what_is_the_reason_for_no_commission: z.string().optional(),
        x_studio_is_there_deductionsclaim: z.boolean().optional(),
        x_studio_claim_currency: z.string().optional(),
        x_studio_claim_amount: z.number().optional(),
        x_studio_claim_description: z.string().optional(),
        x_studio_claim_reason: z.string().optional(),
        x_studio_deduction_amount: z.number().optional(),
        // Loading Team (many2many - arrays of employee IDs)
        quality_supervisor_ids: z.array(z.number()).optional(),
        loading_driver_ids: z.array(z.number()).optional(),
        labor_ids: z.array(z.number()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Convert many2many arrays to Odoo's [[6, 0, ids]] format
      const odooInput: Record<string, any> = { ...input };
      if (input.quality_supervisor_ids) {
        odooInput.quality_supervisor_ids = [[6, 0, input.quality_supervisor_ids]];
      }
      if (input.loading_driver_ids) {
        odooInput.loading_driver_ids = [[6, 0, input.loading_driver_ids]];
      }
      if (input.labor_ids) {
        odooInput.labor_ids = [[6, 0, input.labor_ids]];
      }
      const success = await updatePicking(odooInput as any);
      return { success };
    }),

  // ─── File Upload to PO ─────────────────────────────────────────────────
  uploadPOFile: publicProcedure
    .input(
      z.object({
        poId: z.number(),
        fieldName: z.string(),
        base64Content: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const success = await uploadFileToPO(input.poId, input.fieldName, input.base64Content);
      return { success };
    }),

  // ─── File Upload to Picking ────────────────────────────────────────────
  uploadPickingFile: publicProcedure
    .input(
      z.object({
        pickingId: z.number(),
        fieldName: z.string(),
        base64Content: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const success = await uploadFileToPicking(input.pickingId, input.fieldName, input.base64Content);
      return { success };
    }),

  // ─── Read PO File ──────────────────────────────────────────────────────
  readPOFile: publicProcedure
    .input(z.object({ poId: z.number(), fieldName: z.string() }))
    .query(async ({ input }) => {
      const content = await readPOFile(input.poId, input.fieldName);
      return { content: content || null };
    }),

  // ─── Read Picking File ─────────────────────────────────────────────────
  readPickingFile: publicProcedure
    .input(z.object({ pickingId: z.number(), fieldName: z.string() }))
    .query(async ({ input }) => {
      const content = await readPickingFile(input.pickingId, input.fieldName);
      return { content: content || null };
    }),

  // ─── Lookups ───────────────────────────────────────────────────────────
  incoterms: publicProcedure.query(async () => {
    const data = await fetchIncoterms();
    return data.map((i) => ({ id: i.id, name: i.name, code: i.code }));
  }),
  paymentTerms: publicProcedure.query(async () => {
    const data = await fetchPaymentTerms();
    return data.map((t) => ({ id: t.id, name: t.name }));
  }),

  paymentTermLines: publicProcedure
    .input(z.object({ termId: z.number() }))
    .query(async ({ input }) => {
      const lines = await fetchPaymentTermLines(input.termId);
      return lines.map((l) => ({
        id: l.id,
        value: l.value,
        valueAmount: l.value_amount,
        nbDays: l.nb_days,
        delayType: l.delay_type,
      }));
    }),

  employees: publicProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const data = await fetchEmployees(input?.search);
      return data.map((e) => ({ id: e.id, name: e.name }));
    }),

  partners: publicProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const data = await fetchPartners(input?.search);
      return data.map((p) => ({ id: p.id, name: p.name }));
    }),

  // ─── File Status Check ──────────────────────────────────────────────────
  pickingFileStatus: publicProcedure
    .input(z.object({ pickingId: z.number() }))
    .query(async ({ input }) => {
      return checkPickingFileStatus(input.pickingId);
    }),

  poFileStatus: publicProcedure
    .input(z.object({ poId: z.number() }))
    .query(async ({ input }) => {
      return checkPOFileStatus(input.poId);
    }),

  // ─── Warehouse & Stock ────────────────────────────────────────────────

  warehouses: publicProcedure
    .input(z.object({ companyId: z.number().optional() }))
    .query(async ({ input }) => {
      const warehouses = await fetchWarehouses(input.companyId);
      return warehouses.map(w => ({
        id: w.id,
        name: w.name,
        code: w.code,
        companyId: w.company_id ? w.company_id[0] : 0,
        companyName: w.company_id ? w.company_id[1] : "",
      }));
    }),

  productStock: publicProcedure
    .input(z.object({
      productIds: z.array(z.number()),
      warehouseId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const stock = await fetchAggregatedStock(input.productIds, input.warehouseId);
      return stock;
    }),

  // ─── Stock Locations ────────────────────────────────────────────────────
  stockLocations: publicProcedure
    .input(z.object({ companyId: z.number().optional() }))
    .query(async ({ input }) => {
      const locations = await fetchStockLocations(input.companyId);
      return locations.map(l => ({
        id: l.id,
        name: l.name,
        completeName: l.complete_name,
        warehouseId: l.warehouse_id ? l.warehouse_id[0] : null,
        warehouseName: l.warehouse_id ? l.warehouse_id[1] : null,
        companyId: l.company_id ? l.company_id[0] : 0,
        companyName: l.company_id ? l.company_id[1] : "",
        parentId: l.location_id ? l.location_id[0] : null,
        parentName: l.location_id ? l.location_id[1] : null,
      }));
    }),

  // ─── Product Stock by Location ──────────────────────────────────────────
  productStockByLocation: publicProcedure
    .input(z.object({
      productIds: z.array(z.number()),
      locationId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      return fetchProductStockByLocation(input.productIds, input.locationId);
    }),

  // ─── All Stock at Location (for "View Stock" popup) ────────────────────
  allStockAtLocation: publicProcedure
    .input(z.object({
      locationId: z.number(),
    }))
    .query(async ({ input }) => {
      return fetchAllStockAtLocation(input.locationId);
    }),

  // ─── Redistribute Weight Across Loads ─────────────────────────────────
  redistributeWeight: publicProcedure
    .input(z.object({
      orderId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const po = await fetchPurchaseOrderById(input.orderId);
      if (!po) throw new Error("Purchase order not found");
      const lines = await fetchPOLines(po.order_line);
      const mappedLines = lines.map(l => ({
        product_id: l.product_id ? l.product_id[0] : 0,
        product_qty: l.product_qty,
        product_uom: l.product_uom ? l.product_uom[0] : undefined,
      }));
      await distributeWeightAcrossPickings(input.orderId, mappedLines, "purchase");
      return { success: true };
    }),

  // ─── Lookup PO ID by Name (with preview data) ───────────────────────
  // ─── Invoices / Bills ──────────────────────────────────────────────────
  invoices: publicProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ input }) => {
      const po = await fetchPurchaseOrderById(input.orderId);
      if (!po) return [];
      const invoiceIds = Array.isArray(po.invoice_ids) ? po.invoice_ids : [];
      if (invoiceIds.length === 0) return [];
      const invoices = await fetchInvoicesByIds(invoiceIds);
      return invoices.map(inv => ({
        id: inv.id,
        name: inv.name || "—",
        type: inv.move_type === "in_invoice" ? "Vendor Bill" :
              inv.move_type === "in_refund" ? "Vendor Credit Note" :
              inv.move_type === "out_invoice" ? "Customer Invoice" :
              inv.move_type === "out_refund" ? "Customer Credit Note" : inv.move_type,
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

  lookupByName: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      const po = await fetchPurchaseOrderByName(input.name);
      if (!po) return { id: null, preview: null };
      // Fetch full PO for preview data
      const full = await fetchPurchaseOrderById(po.id);
      if (!full) return { id: po.id, preview: null };
      return {
        id: po.id,
        preview: {
          name: full.name || input.name,
          vendor: Array.isArray(full.partner_id) ? full.partner_id[1] : String(full.partner_id || "\u2014"),
          state: full.state || "\u2014",
          amountTotal: full.amount_total || 0,
          currency: Array.isArray(full.currency_id) ? full.currency_id[1] : "AED",
          vessel: full.x_studio_vessel_name || "\u2014",
          loads: Array.isArray(full.picking_ids) ? full.picking_ids.length : 0,
          bookingNumber: full.x_studio_booking_number || "\u2014",
        },
      };
    }),

  // \u2500\u2500\u2500 Search by Container/Truck Load Number \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Searches stock.picking records by container number or truck load serial,
  // then returns the parent purchase.order IDs that contain matching loads.
  searchByLoadField: publicProcedure
    .input(z.object({ query: z.string().min(2) }))
    .query(async ({ input }) => {
      const { searchPickingsByLoadField } = await import("../odoo-shipments");
      return searchPickingsByLoadField(input.query);
    }),

  // ─── Grade Options ──────────────────────────────────────────────────────
  // Fetches the selection options for grade fields from Odoo's stock.picking model.
  receiptPhotos: publicProcedure
    .input(z.object({ receiptId: z.number() }))
    .query(async ({ input }) => {
      const { receiptId } = input;
      const atts = await executeKw<{ id: number; name: string; mimetype: string; res_model: string; res_id: number; create_date: string }[]>(
        "ir.attachment", "search_read",
        [[["res_model", "=", "stock.picking"], ["res_id", "=", receiptId], ["mimetype", "like", "image/"]]],
        { fields: ["id", "name", "mimetype", "create_date"], limit: 200, order: "create_date asc" }
      );

      const PHOTO_LABELS: Record<string, string> = {
        weight_ticket: "Weight Ticket", wt: "Weight Ticket",
        truck_plate: "Truck Plate", pl: "Truck Plate",
        driver_contract: "Supply Contract", ct: "Supply Contract",
        driver_license: "Driver License", dl: "Driver License",
        driver_id: "Driver ID", id: "Driver ID",
        truck_right: "Load Right Side", tr: "Load Right Side",
        truck_left: "Load Left Side", tl: "Load Left Side",
        truck_back: "Load Back Side", tb: "Load Back Side",
        truck_loaded: "Truck Loaded",
        arrival: "Truck Arrival", ar: "Truck Arrival",
        bale_condition: "Bale Condition", bc: "Bale Condition",
        bale_cross_section: "Bale Cross Section", cs: "Bale Cross Section",
        moisture_reading: "Moisture Reading", mr: "Moisture Reading",
        nir_reading: "NIR Reading", nir: "NIR Reading",
        bale_right: "Bale Right Side", bale_left: "Bale Left Side",
      };

      const QUALITY_ONLY = new Set(["bale_cross_section", "moisture_reading", "nir_reading", "cs", "mr", "nir"]);
      const RECEIVING_ONLY = new Set(["arrival", "ar"]);

      const categorize = (name: string): string => {
        const lower = name.toLowerCase();
        if (lower.startsWith("[procurement]")) return "procurement";
        if (lower.startsWith("[receiving]")) return "receiving";
        if (lower.startsWith("[quality]")) return "quality";
        return "other";
      };

      const extractPhotoType = (name: string): string => {
        const lower = name.toLowerCase();
        const cleaned = lower.replace(/^\[(procurement|receiving|quality)\]\s*/, "");
        const allKeys = Object.keys(PHOTO_LABELS);
        for (const k of allKeys) {
          if (cleaned.startsWith(k + "_") || cleaned.startsWith(k + " ") || cleaned === k) return k;
        }
        return "";
      };

      const getLabel = (name: string, photoType: string): string => {
        if (photoType && PHOTO_LABELS[photoType]) return PHOTO_LABELS[photoType];
        return name
          .replace(/^\[(Procurement|Receiving|Quality)\]\s*/i, "")
          .replace(/_PHT-.*$/i, "")
          .replace(/_/g, " ")
          .trim() || name;
      };

      const result = { procurement: [] as any[], receiving: [] as any[], quality: [] as any[], other: [] as any[] };
      for (const att of atts) {
        const category = categorize(att.name);
        const photoType = extractPhotoType(att.name);
        const label = getLabel(att.name, photoType);
        const item = { irAttId: att.id, name: att.name, label, photoType, mime: att.mimetype, date: att.create_date };
        if (category === "procurement") result.procurement.push(item);
        else if (category === "receiving") result.receiving.push(item);
        else if (category === "quality") result.quality.push(item);
        else result.other.push(item);
      }
      return result;
    }),

  gradeOptions: publicProcedure
    .query(async () => {
      const { fetchGradeOptions } = await import("../odoo-shipments");
      return fetchGradeOptions();
    }),
});
