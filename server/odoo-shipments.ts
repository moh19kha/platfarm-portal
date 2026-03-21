/**
 * Odoo Purchase Shipments API
 *
 * Handles CRUD operations for purchase.order (shipments),
 * purchase.order.line, and stock.picking (loads/receipts/containers).
 * Also handles binary file uploads to both PO and picking records.
 *
 * Uses the shared executeKw helper from odoo.ts.
 */

import axios from "axios";

// ─── Odoo Connection Config (same as odoo.ts) ──────────────────────────────
const ODOO_URL = "https://odoo.platfarm.io";
const ODOO_DB = "odoo";
const ODOO_USER = "aiagent";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD ?? "Platfarm@2025";

const odooClient = axios.create({
  baseURL: ODOO_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 120000, // Longer timeout for shipments (Odoo can be slow)
});

// ─── UID Cache (shared pattern) ─────────────────────────────────────────────
let _uidPromise: Promise<number> | null = null;

function getUid(): Promise<number> {
  if (_uidPromise) return _uidPromise;
  _uidPromise = (async () => {
    try {
      const res = await odooClient.post("/jsonrpc", {
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "common",
          method: "authenticate",
          args: [ODOO_DB, ODOO_USER, ODOO_PASSWORD, {}],
        },
      });
      if (res.data.error) throw new Error(`Odoo auth error: ${res.data.error.data.message}`);
      const uid = res.data.result;
      if (!uid || typeof uid !== "number") throw new Error("Odoo authentication failed");
      return uid;
    } catch (err) {
      _uidPromise = null;
      throw err;
    }
  })();
  return _uidPromise;
}

// All company IDs the AI Agent user (id=80) has access to
const ALLOWED_COMPANY_IDS = [1, 2, 3, 4, 5];

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
      // Inject allowed_company_ids into context to avoid multi-company access errors
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
        throw new Error(`Odoo RPC error (${model}.${method}): ${res.data.error.data.message}`);
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

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OdooPurchaseOrder {
  id: number;
  name: string;
  partner_id: [number, string] | false;
  company_id: [number, string] | false;
  state: string;
  date_order: string | false;
  date_planned: string | false;
  amount_total: number;
  amount_untaxed: number;
  amount_tax: number;
  currency_id: [number, string] | false;
  requisition_id: [number, string] | false;
  order_line: number[];
  picking_ids: number[];
  invoice_ids: number[];
  number_of_loads: number;
  x_studio_vessel_name: string | false;
  x_studio_tracking_number: string | false;
  x_studio_shipment_date: string | false;
  eta_arrival: string | false;
  pol_source: string | false;
  pod_source: string | false;
  x_studio_booking_number: string | false;
  x_studio_shipment_bl_number: string | false;
  shipment_bl_number: string | false;
  x_studio_etd_pol: string | false;
  x_studio_eta_pol: string | false;
  x_studio_product_category: string | false;
  freight_type: string | false;
  load_type: string | false;
  ocean_transporter_company: string | false;
  x_studio_shipment_status: string | false;
  x_studio_unified_shipment_status: string | false;
  incoterm_id: [number, string] | false;
  payment_term_id: [number, string] | false;
  local_clearance_agent: [number, string] | false;
  local_trucking_company: [number, string] | false;
  x_studio_procurement_officer: [number, string] | false;
  x_studio_ultimate_customer: string | false;
  x_studio_total_free_days_demurrage_detention: number;
  x_studio_transit_time_days: number;
  x_studio_vessel_cut_off: string | false;
  x_studio_rate_per_containerload: number;
  x_studio_total_shipment_weight_in_tons_1: number;
  x_studio_selling_price_per_ton: number;
  x_studio_payment_status: string | false;
  x_studio_paid_amount_in_aed: number;
  x_studio_shipment_documentation_status: string | false;
  x_studio_shipment_acceptance_status: string | false;
  notes: string | false;
  telex_release_bl_issued: boolean;
}

export interface OdooPOLine {
  id: number;
  product_id: [number, string] | false;
  product_qty: number;
  qty_received: number;
  qty_invoiced: number;
  price_unit: number;
  price_subtotal: number;
  product_uom: [number, string] | false;
  date_planned: string | false;
}

export interface OdooStockPicking {
  id: number;
  name: string;
  state: string;
  partner_id: [number, string] | false;
  origin: string | false;
  scheduled_date: string | false;
  date_done: string | false;
  picking_type_id: [number, string] | false;
  company_id: [number, string] | false;
  move_ids: number[];
  x_studio_loadcontainer_number_1: string | false;
  x_studio_seal_number: string | false;
  x_studio_loading_date: string | false;
  x_studio_net_weight_in_tons: number;
  x_studio_quantity_in_tons: number;
  x_studio_tare_weight_in_tons: number;
  x_studio_number_of_balesbags: string | false;
  x_studio_loading_store: string | false;
  x_studio_truck_load_serial_tl: string | false;
  x_studio_loaded_grade: string | false;
  x_studio_source: string | false;
  x_studio_purchasing_unit: string | false;
  x_studio_quality_score: number;
  x_studio_moisture_: number;
  x_studio_ndf_: number;
  x_studio_adf_: number;
  x_studio_crude_protein_dry_matter_: number;
  x_studio_premium_grade: number;
  x_studio_standard_: number;
  x_studio_trucking_fee: number;
  x_studio_trucking_fees: string | false;
  x_studio_trucking_cost_currency: string | false;
  x_studio_local_trucking_driver: [number, string] | false;
  x_studio_local_trucking_driver_contact: string | false;
  x_studio_loadcontainer_cleanliness: boolean;
  x_studio_proper_loadcontainer_lashing: boolean;
  x_studio_proper_loadcontainer_stacking: boolean;
  x_studio_presence_of_truck_cover: boolean;
  x_studio_payment_confirmation: boolean;
  x_studio_sku_confirmation: string | false;
  // Procurement (Source) tab fields
  x_studio_purchasing_unit_1: string | false;
  x_studio_currency_id: [number, string] | false;
  x_studio_purchase_currency: [number, string] | false;
  x_studio_agreed_product_price_per_unit: number;
  x_studio_agreed_product_price_per_unit_1: number;
  x_studio_farmfield_name: string | false;
  x_studio_loaded_grade_1: string | false;
  x_studio_driver_name: string | false;
  x_studio_driver_contact: string | false;
  x_studio_agreed_trucking_cost: number;
  x_studio_advance_payment: number;
  x_studio_advance_payment_1: number;
  x_studio_long_stay_cost: number;
  x_studio_loading_datetime: string | false;
  x_studio_loading_datetime_1: string | false;
  // Quality (Received) tab fields
  x_studio_grade_1_: number;
  x_studio_grade_3_: number;
  x_studio_overall_received_grade_as_per_quality_assessment: string | false;
  x_studio_overall_received_grade_as_per_quality_assessment_1: string | false;
  x_studio_total_number_of_received_bales: string | false;
  x_studio_brokendamaged_bales: string | false;
  x_studio_bales_with_moisture_above_12: string | false;
  x_studio_gross_weight_in_tons: number;
  x_studio_gross_weight: string | false;
  x_studio_arrival_datetime: string | false;
  // Quality visual checks
  x_studio_good_quality_green_color: boolean;
  x_studio_good_quality_stem_size: boolean;
  x_studio_good_quality_good_leave_attachement: boolean;
  x_studio_good_quality_bale_ties: boolean;
  x_studio_good_quality_uniformity_of_bale_shape: boolean;
  x_studio_good_quality_absence_of_black_spots: boolean;
  x_studio_good_quality_absence_of_foreign_material: boolean;
  x_studio_good_quality_absence_of_insects: boolean;
  // Accepted load
  x_studio_accepted_rejected: boolean;
  // Commission/Deduction
  x_studio_is_there_commission: boolean;
  x_studio_commissioned_person_1: string | false;
  x_studio_commission_currency: string | false;
  x_studio_quality_supervisor_for_delivery: [number, string] | false;
  x_studio_if_no_what_is_the_reason_for_no_commission: string | false;
  x_studio_is_there_deductionsclaim: boolean;
  x_studio_claim_currency: string | false;
  x_studio_claim_amount: number;
  x_studio_claim_description: string | false;
  x_studio_claim_reason: string | false;
  x_studio_deduction_amount: number;
  x_studio_commission_amount: number;
  x_studio_supporting_documents: any;
  x_studio_supporting_documents_filename: string | false;
  // Loading Team fields (for incentive calculations)
  quality_supervisor_ids: number[];  // many2many -> hr.employee IDs
  loading_driver_ids: number[];      // many2many -> hr.employee IDs
  labor_ids: number[];               // many2many -> hr.employee IDs
  quality_supervisor_for_delivery: [number, string] | false; // many2one -> hr.employee
}

// ─── READ Operations ────────────────────────────────────────────────────────

/** PO fields to fetch */
const PO_FIELDS = [
  "id", "name", "partner_id", "company_id", "state",
  "date_order", "date_planned", "amount_total", "amount_untaxed", "amount_tax",
  "currency_id", "requisition_id", "order_line", "picking_ids",
  "number_of_loads", "x_studio_vessel_name", "x_studio_tracking_number",
  "x_studio_shipment_date", "eta_arrival", "x_studio_product_category",
  "pol_source", "pod_source", "x_studio_booking_number",
  "x_studio_etd_pol", "x_studio_eta_pol",
  "freight_type", "load_type", "ocean_transporter_company",
  "x_studio_shipment_status", "x_studio_unified_shipment_status", "incoterm_id", "payment_term_id",
  "local_clearance_agent", "local_trucking_company",
  "x_studio_procurement_officer", "x_studio_ultimate_customer",
  "x_studio_total_free_days_demurrage_detention", "x_studio_transit_time_days",
  "x_studio_vessel_cut_off", "x_studio_rate_per_containerload",
  "x_studio_total_shipment_weight_in_tons_1", "x_studio_selling_price_per_ton",
  "x_studio_payment_status", "x_studio_paid_amount_in_aed", "x_studio_shipment_documentation_status",
  "x_studio_shipment_acceptance_status",
  "notes", "x_studio_procurement_ref", "x_studio_procurement_data", "x_studio_procurement_id",
  "invoice_ids",
  "shipment_bl_number",
  "telex_release_bl_issued",
];

const PICKING_FIELDS = [
  "id", "name", "state", "partner_id", "origin",
  "scheduled_date", "date_done", "picking_type_id", "company_id", "move_ids",
  "x_studio_loadcontainer_number_1", "x_studio_seal_number",
  "x_studio_loading_date", "x_studio_net_weight_in_tons",
  "x_studio_quantity_in_tons", "x_studio_tare_weight_in_tons",
  "x_studio_number_of_balesbags", "x_studio_loading_store",
  "x_studio_truck_load_serial_tl", "x_studio_loaded_grade",
  "x_studio_source", "x_studio_purchasing_unit",
  "x_studio_quality_score", "x_studio_moisture_",
  "x_studio_ndf_", "x_studio_adf_", "x_studio_crude_protein_dry_matter_",
  "x_studio_premium_grade", "x_studio_standard_",
  "x_studio_trucking_fee", "x_studio_trucking_fees",
  "x_studio_trucking_cost_currency",
  "x_studio_local_trucking_driver", "x_studio_local_trucking_driver_contact",
  "x_studio_loadcontainer_cleanliness", "x_studio_proper_loadcontainer_lashing",
  "x_studio_proper_loadcontainer_stacking", "x_studio_presence_of_truck_cover",
  "x_studio_payment_confirmation", "x_studio_sku_confirmation",
  // Procurement (Source) tab fields
  "x_studio_purchasing_unit_1", "x_studio_currency_id", "x_studio_purchase_currency",
  "x_studio_agreed_product_price_per_unit", "x_studio_agreed_product_price_per_unit_1",
  "x_studio_farmfield_name",
  "x_studio_loaded_grade_1", "x_studio_driver_name", "x_studio_driver_contact",
  "x_studio_agreed_trucking_cost", "x_studio_advance_payment", "x_studio_advance_payment_1",
  "x_studio_long_stay_cost", "x_studio_loading_datetime", "x_studio_loading_datetime_1",
  // Quality (Received) tab fields
  "x_studio_grade_1_", "x_studio_grade_3_",
  "x_studio_overall_received_grade_as_per_quality_assessment",
  "x_studio_overall_received_grade_as_per_quality_assessment_1",
  "x_studio_total_number_of_received_bales", "x_studio_brokendamaged_bales",
  "x_studio_bales_with_moisture_above_12", "x_studio_gross_weight_in_tons",
  "x_studio_gross_weight", "x_studio_arrival_datetime",
  // Quality visual checks
  "x_studio_good_quality_green_color", "x_studio_good_quality_stem_size",
  "x_studio_good_quality_good_leave_attachement", "x_studio_good_quality_bale_ties",
  "x_studio_good_quality_uniformity_of_bale_shape",
  "x_studio_good_quality_absence_of_black_spots",
  "x_studio_good_quality_absence_of_foreign_material",
  "x_studio_good_quality_absence_of_insects",
  // Accepted load
  "x_studio_accepted_rejected",
  // Commission/Deduction
  "x_studio_is_there_commission", "x_studio_commissioned_person_1",
  "x_studio_commission_currency", "x_studio_commission_amount",
  "x_studio_quality_supervisor_for_delivery",
  "x_studio_if_no_what_is_the_reason_for_no_commission",
  "x_studio_is_there_deductionsclaim", "x_studio_claim_currency",
  "x_studio_claim_amount", "x_studio_claim_description", "x_studio_claim_reason",
  "x_studio_deduction_amount",
  // Loading Team fields (for incentive calculations)
  "quality_supervisor_ids", "loading_driver_ids", "labor_ids",
  "quality_supervisor_for_delivery",
];

/**
 * Fetch purchase orders (shipments).
 * Supports filtering by company_id and/or requisition_id (agreement).
 */
export async function fetchPurchaseOrders(filters?: {
  companyId?: number;
  requisitionId?: number;
  limit?: number;
  offset?: number;
}): Promise<OdooPurchaseOrder[]> {
  const domain: unknown[][] = [];
  if (filters?.companyId) domain.push(["company_id", "=", filters.companyId]);
  if (filters?.requisitionId) domain.push(["requisition_id", "=", filters.requisitionId]);

  return executeKw<OdooPurchaseOrder[]>("purchase.order", "search_read", [domain], {
    fields: PO_FIELDS,
    limit: filters?.limit || 50,
    offset: filters?.offset || 0,
    order: "date_order desc, id desc",
  });
}

/**
 * Fetch a single purchase order by ID.
 */
export async function fetchPurchaseOrderById(id: number): Promise<OdooPurchaseOrder | null> {
  const results = await executeKw<OdooPurchaseOrder[]>(
    "purchase.order", "search_read",
    [[["id", "=", id]]],
    { fields: PO_FIELDS }
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * Fetch a single purchase order by its name (e.g., "PO/AD/26/00041").
 */
export async function fetchPurchaseOrderByName(name: string): Promise<{ id: number; name: string } | null> {
  const results = await executeKw<{ id: number; name: string }[]>(
    "purchase.order", "search_read",
    [[["name", "=", name]]],
    { fields: ["id", "name"], limit: 1 }
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * Count purchase orders matching filters.
 */
export async function countPurchaseOrders(filters?: {
  companyId?: number;
  requisitionId?: number;
}): Promise<number> {
  const domain: unknown[][] = [];
  if (filters?.companyId) domain.push(["company_id", "=", filters.companyId]);
  if (filters?.requisitionId) domain.push(["requisition_id", "=", filters.requisitionId]);
  return executeKw<number>("purchase.order", "search_count", [domain]);
}

/**
 * Fetch purchase order lines by IDs.
 */
export async function fetchPOLines(lineIds: number[]): Promise<OdooPOLine[]> {
  if (lineIds.length === 0) return [];
  return executeKw<OdooPOLine[]>("purchase.order.line", "search_read",
    [[["id", "in", lineIds]]],
    {
      fields: [
        "id", "product_id", "product_qty", "qty_received", "qty_invoiced",
        "price_unit", "price_subtotal", "product_uom", "date_planned",
      ],
    }
  );
}

/**
 * Fetch stock.picking (loads/receipts) by IDs.
 */
export async function fetchPickings(pickingIds: number[]): Promise<OdooStockPicking[]> {
  if (pickingIds.length === 0) return [];
  return executeKw<OdooStockPicking[]>("stock.picking", "search_read",
    [[["id", "in", pickingIds]]],
    { fields: PICKING_FIELDS }
  );
}

/**
 * Fetch pickings for a specific purchase order.
 */
export async function fetchPickingsForPO(poId: number): Promise<OdooStockPicking[]> {
  // First get the PO to get picking_ids
  const po = await fetchPurchaseOrderById(poId);
  if (!po || !po.picking_ids.length) return [];
  return fetchPickings(po.picking_ids);
}

// ─── CREATE Operations ──────────────────────────────────────────────────────

export interface CreatePurchaseOrderInput {
  partner_id: number;
  company_id: number;
  currency_id?: number;
  requisition_id?: number;
  date_order?: string;
  date_planned?: string;
  number_of_loads?: number;
  x_studio_vessel_name?: string;
  x_studio_tracking_number?: string;
  x_studio_shipment_date?: string;
  eta_arrival?: string;
  pol_source?: string;
  pod_source?: string;
  x_studio_booking_number?: string;
  x_studio_etd_pol?: string;
  x_studio_eta_pol?: string;
  x_studio_product_category?: string;
  freight_type?: string;
  load_type?: string;
  ocean_transporter_company?: string;
  x_studio_shipment_status?: string;
  x_studio_unified_shipment_status?: string;
  incoterm_id?: number;
  payment_term_id?: number;
  local_clearance_agent?: number;
  local_trucking_company?: number;
  x_studio_ultimate_customer?: string;
  x_studio_total_free_days_demurrage_detention?: number;
  x_studio_transit_time_days?: number;
  x_studio_vessel_cut_off?: string;
  x_studio_rate_per_containerload?: number;
  x_studio_total_shipment_weight_in_tons_1?: number;
  x_studio_selling_price_per_ton?: number;
  x_studio_payment_status?: string;
  x_studio_shipment_documentation_status?: string;
  x_studio_shipment_acceptance_status?: string;
  notes?: string;
  origin?: string;
  picking_type_id?: number;
  distribute_weight_equally?: boolean;
  lines: {
    product_id: number;
    product_qty: number;
    price_unit: number;
    product_uom?: number;
    date_planned?: string;
  }[];
}

/**
 * Create a purchase order (shipment) in Odoo.
 */
export async function createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<number> {
  const vals: Record<string, unknown> = {
    partner_id: input.partner_id,
    company_id: input.company_id,
  };

  // Optional fields
  if (input.currency_id) vals.currency_id = input.currency_id;
  if (input.requisition_id) vals.requisition_id = input.requisition_id;
  if (input.date_order) vals.date_order = input.date_order;
  if (input.date_planned) vals.date_planned = input.date_planned;
  if (input.number_of_loads !== undefined) vals.number_of_loads = input.number_of_loads;
  if (input.x_studio_vessel_name) vals.x_studio_vessel_name = input.x_studio_vessel_name;
  if (input.x_studio_tracking_number) vals.x_studio_tracking_number = input.x_studio_tracking_number;
  if (input.x_studio_shipment_date) vals.x_studio_shipment_date = input.x_studio_shipment_date;
  if (input.eta_arrival) vals.eta_arrival = input.eta_arrival;
  if (input.pol_source) vals.pol_source = input.pol_source;
  if (input.pod_source) vals.pod_source = input.pod_source;
  if (input.x_studio_booking_number) vals.x_studio_booking_number = input.x_studio_booking_number;
  if (input.x_studio_etd_pol) vals.x_studio_etd_pol = input.x_studio_etd_pol;
  if (input.x_studio_eta_pol) vals.x_studio_eta_pol = input.x_studio_eta_pol;
  if (input.x_studio_product_category) vals.x_studio_product_category = input.x_studio_product_category;
  if (input.freight_type) vals.freight_type = input.freight_type;
  if (input.load_type) vals.load_type = input.load_type;
  if (input.ocean_transporter_company) vals.ocean_transporter_company = input.ocean_transporter_company;
  if (input.x_studio_shipment_status) vals.x_studio_shipment_status = input.x_studio_shipment_status;
  if (input.x_studio_unified_shipment_status) vals.x_studio_unified_shipment_status = input.x_studio_unified_shipment_status;
  if (input.incoterm_id) vals.incoterm_id = input.incoterm_id;
  if (input.payment_term_id) vals.payment_term_id = input.payment_term_id;
  if (input.local_clearance_agent) vals.local_clearance_agent = input.local_clearance_agent;
  if (input.local_trucking_company) vals.local_trucking_company = input.local_trucking_company;
  if (input.x_studio_ultimate_customer) vals.x_studio_ultimate_customer = input.x_studio_ultimate_customer;
  if (input.x_studio_total_free_days_demurrage_detention !== undefined)
    vals.x_studio_total_free_days_demurrage_detention = input.x_studio_total_free_days_demurrage_detention;
  if (input.x_studio_transit_time_days !== undefined)
    vals.x_studio_transit_time_days = input.x_studio_transit_time_days;
  if (input.x_studio_vessel_cut_off) vals.x_studio_vessel_cut_off = input.x_studio_vessel_cut_off;
  if (input.x_studio_rate_per_containerload !== undefined)
    vals.x_studio_rate_per_containerload = input.x_studio_rate_per_containerload;
  if (input.x_studio_total_shipment_weight_in_tons_1 !== undefined)
    vals.x_studio_total_shipment_weight_in_tons_1 = input.x_studio_total_shipment_weight_in_tons_1;
  if (input.x_studio_selling_price_per_ton !== undefined)
    vals.x_studio_selling_price_per_ton = input.x_studio_selling_price_per_ton;
  if (input.x_studio_payment_status) vals.x_studio_payment_status = input.x_studio_payment_status;
  if (input.x_studio_shipment_documentation_status)
    vals.x_studio_shipment_documentation_status = input.x_studio_shipment_documentation_status;
  if (input.x_studio_shipment_acceptance_status)
    vals.x_studio_shipment_acceptance_status = input.x_studio_shipment_acceptance_status;
  if (input.notes !== undefined) vals.notes = input.notes;
  if (input.origin) vals.origin = input.origin;
  if (input.picking_type_id) vals.picking_type_id = input.picking_type_id;

  // Order lines using one2many command syntax
  if (input.lines.length > 0) {
    // ── Server-side product-company validation ──
    // Prevent cross-company product errors by checking each product's company_id
    const productIds = input.lines.map(l => l.product_id);
    const products = await executeKw<{ id: number; name: string; company_id: [number, string] | false; uom_id: [number, string] | false }[]>(
      "product.product", "search_read",
      [[["id", "in", productIds]]],
      { fields: ["id", "name", "company_id", "uom_id"] }
    );
    const productMap = new Map(products.map(p => [p.id, p]));
    // Company validation removed - products can be shared across companies


















    vals.order_line = input.lines.map((line) => {
      // Use product's own UoM if not provided, to avoid category mismatch
      const prod = productMap.get(line.product_id);
      const productUomId = prod?.uom_id ? prod.uom_id[0] : undefined;
      const uomToUse = line.product_uom || productUomId;
      return [
        0, 0, {
          product_id: line.product_id,
          product_qty: line.product_qty,
          price_unit: line.price_unit,
          ...(uomToUse ? { product_uom: uomToUse } : {}),
          ...(line.date_planned ? { date_planned: line.date_planned } : {}),
        },
      ];
    });
  }

  const poId = await executeKw<number>("purchase.order", "create", [vals]);

  // Auto-confirm the PO to transition from Draft → Purchase Order
  // This triggers Odoo to generate stock pickings (loads/receipts)
  try {
    await confirmPurchaseOrder(poId);
  } catch (err: any) {
    // Log but don't fail — the PO was created successfully, confirm can be retried
    console.error(`[createPurchaseOrder] Auto-confirm failed for PO ${poId}: ${err.message}`);
  }

  // ── Distribute weight equally across loads/pickings ──
  if (input.distribute_weight_equally !== false) {
    try {
      await distributeWeightAcrossPickings(poId, input.lines, "purchase");
    } catch (err: any) {
      console.error(`[createPurchaseOrder] Weight distribution failed for PO ${poId}: ${err.message}`);
    }
  }

  return poId;
}

/**
 * Confirm a purchase order (Draft → Purchase Order).
 * Calls Odoo's button_confirm workflow action which generates stock pickings.
 */
export async function confirmPurchaseOrder(poId: number): Promise<boolean> {
  return executeKw<boolean>("purchase.order", "button_confirm", [[poId]]);
}

// ─── UPDATE Operations ──────────────────────────────────────────────────────

export interface UpdatePurchaseOrderInput {
  id: number;
  partner_id?: number;
  date_order?: string;
  date_planned?: string;
  number_of_loads?: number;
  x_studio_vessel_name?: string;
  x_studio_tracking_number?: string;
  x_studio_shipment_date?: string;
  eta_arrival?: string;
  pol_source?: string;
  pod_source?: string;
  x_studio_booking_number?: string;
  x_studio_etd_pol?: string;
  x_studio_eta_pol?: string;
  x_studio_product_category?: string;
  freight_type?: string;
  load_type?: string;
  ocean_transporter_company?: string;
  x_studio_shipment_status?: string;
  x_studio_unified_shipment_status?: string;
  incoterm_id?: number;
  payment_term_id?: number;
  local_clearance_agent?: number;
  local_trucking_company?: number;
  x_studio_procurement_officer?: number;
  x_studio_ultimate_customer?: string;
  x_studio_total_free_days_demurrage_detention?: number;
  x_studio_transit_time_days?: number;
  x_studio_vessel_cut_off?: string;
  x_studio_rate_per_containerload?: number;
  x_studio_total_shipment_weight_in_tons_1?: number;
  x_studio_selling_price_per_ton?: number;
  x_studio_payment_status?: string;
  x_studio_shipment_documentation_status?: string;
  x_studio_shipment_acceptance_status?: string;
  notes?: string;
  telex_release_bl_issued?: boolean;
}

/**
 * Update a purchase order (shipment) in Odoo.
 */
export async function updatePurchaseOrder(input: UpdatePurchaseOrderInput): Promise<boolean> {
  const { id, ...fields } = input;
  const vals: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) vals[key] = value;
  }

  if (Object.keys(vals).length === 0) return true; // Nothing to update
  return executeKw<boolean>("purchase.order", "write", [[id], vals]);
}

// ─── Picking (Load/Receipt) CRUD ────────────────────────────────────────────

export interface UpdatePickingInput {
  id: number;
  x_studio_loadcontainer_number_1?: string;
  x_studio_seal_number?: string;
  x_studio_loading_date?: string;
  x_studio_net_weight_in_tons?: number;
  x_studio_quantity_in_tons?: number;
  x_studio_tare_weight_in_tons?: number;
  x_studio_number_of_balesbags?: string;
  x_studio_loading_store?: string;
  x_studio_truck_load_serial_tl?: string;
  x_studio_loaded_grade?: string;
  x_studio_source?: string;
  x_studio_purchasing_unit?: string;
  x_studio_quality_score?: number;
  x_studio_moisture_?: number;
  x_studio_ndf_?: number;
  x_studio_adf_?: number;
  x_studio_crude_protein_dry_matter_?: number;
  x_studio_trucking_fee?: number;
  x_studio_trucking_fees?: string;
  x_studio_trucking_cost_currency?: string;
  x_studio_local_trucking_driver?: number;
  x_studio_local_trucking_driver_contact?: string;
  x_studio_loadcontainer_cleanliness?: boolean;
  x_studio_proper_loadcontainer_lashing?: boolean;
  x_studio_proper_loadcontainer_stacking?: boolean;
  x_studio_presence_of_truck_cover?: boolean;
  x_studio_payment_confirmation?: boolean;
  x_studio_sku_confirmation?: string;
  // Procurement (Source) tab
  x_studio_purchasing_unit_1?: string;
  x_studio_agreed_product_price_per_unit_1?: number;
  x_studio_farmfield_name?: string;
  x_studio_loaded_grade_1?: string;
  x_studio_driver_name?: string;
  x_studio_driver_contact?: string;
  x_studio_agreed_trucking_cost?: number;
  x_studio_advance_payment_1?: number;
  x_studio_long_stay_cost?: number;
  x_studio_loading_datetime?: string;
  x_studio_loading_datetime_1?: string;
  // Quality (Received) tab
  x_studio_grade_1_?: number;
  x_studio_grade_3_?: number;
  x_studio_overall_received_grade_as_per_quality_assessment?: string;
  x_studio_overall_received_grade_as_per_quality_assessment_1?: string;
  x_studio_total_number_of_received_bales?: number;
  x_studio_brokendamaged_bales?: number;
  x_studio_bales_with_moisture_above_12?: number;
  x_studio_gross_weight_in_tons?: number;
  x_studio_arrival_datetime?: string;
  // Quality visual checks
  x_studio_good_quality_green_color?: boolean;
  x_studio_good_quality_stem_size?: boolean;
  x_studio_good_quality_good_leave_attachement?: boolean;
  x_studio_good_quality_bale_ties?: boolean;
  x_studio_good_quality_uniformity_of_bale_shape?: boolean;
  x_studio_good_quality_absence_of_black_spots?: boolean;
  x_studio_good_quality_absence_of_foreign_material?: boolean;
  x_studio_good_quality_absence_of_insects?: boolean;
  // Commission/Deduction
  x_studio_is_there_commission?: boolean;
  x_studio_commissioned_person_1?: string;
  x_studio_commission_currency?: string;
  x_studio_if_no_what_is_the_reason_for_no_commission?: string;
  x_studio_is_there_deductionsclaim?: boolean;
  x_studio_claim_currency?: string;
}
/**
 * Update a stock.picking (load/receipt) in Odoo.
 */
export async function updatePicking(input: UpdatePickingInput): Promise<boolean> {
  const { id, ...fields } = input;
  const vals: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) vals[key] = value;
  }

  if (Object.keys(vals).length === 0) return true;
  return executeKw<boolean>("stock.picking", "write", [[id], vals]);
}

// ─── File Upload Operations ─────────────────────────────────────────────────

/**
 * Upload a file to a binary field on a purchase.order record.
 * The file content should be base64-encoded.
 */
export async function uploadFileToPO(
  poId: number,
  fieldName: string,
  base64Content: string
): Promise<boolean> {
  // Validate field name is a known binary field
  const validPOFileFields = [
    "analysis_report", "bl", "certificate_of_origin", "delivery_note",
    "fumigation_certificate", "other_documents",
    "x_studio_payments_part_1", "x_studio_payments_part_2", "x_studio_payments_part_3",
    "x_studio_pl_calculations", "x_studio_product_bill", "x_studio_trucking_bill",
    "x_studio_other_governmental_documents",
    "x_studio_other_payment_receiptsupporting_document",
    "x_studio_product_payment_receiptsupporting_document",
    "x_studio_trucking_payment_receiptsupporting_document",
  ];

  if (!validPOFileFields.includes(fieldName)) {
    throw new Error(`Invalid file field for purchase.order: ${fieldName}`);
  }

  return executeKw<boolean>("purchase.order", "write", [
    [poId],
    { [fieldName]: base64Content },
  ]);
}

/**
 * Upload a file to a binary field on a stock.picking record.
 * The file content should be base64-encoded.
 */
export async function uploadFileToPicking(
  pickingId: number,
  fieldName: string,
  base64Content: string
): Promise<boolean> {
  const validPickingFileFields = [
    "x_studio_quality_assessment_form",
    "x_studio_quality_report_attachement",
    "x_studio_quality_report_attachment",
    "x_studio_load_quality_checker",
    "x_studio_supporting_documents",
    "x_studio_ladder_image_1_left_side",
    "x_studio_ladder_image_1_right_side",
    "x_studio_ladder_image_2_left_side",
    "x_studio_ladder_image_2_right_side",
    // Container side pictures (used in both Source and Received tabs)
    "x_studio_binary_field_5v_1j45ev8ib",   // Container Right Side
    "x_studio_binary_field_7hm_1j45evrk9",  // Container Left Side
    "x_studio_container_back_side",           // Container Back Side
    // Attachments
    "x_studio_attachments",
    "x_studio_binary_field_40q_1j01n2jbk",   // Bale Codes List attachment
  ];
  if (!validPickingFileFields.includes(fieldName)) {
    throw new Error(`Invalid file field for stock.picking: ${fieldName}`);
  }

  return executeKw<boolean>("stock.picking", "write", [
    [pickingId],
    { [fieldName]: base64Content },
  ]);
}

/**
 * Read a binary field from a purchase.order record.
 * Returns base64-encoded content or false if empty.
 */
export async function readPOFile(
  poId: number,
  fieldName: string
): Promise<string | false> {
  const result = await executeKw<Array<Record<string, string | false>>>(
    "purchase.order", "read", [[poId], [fieldName]]
  );
  return result.length > 0 ? result[0][fieldName] : false;
}

/**
 * Read a binary field from a stock.picking record.
 * Returns base64-encoded content or false if empty.
 */
export async function readPickingFile(
  pickingId: number,
  fieldName: string
): Promise<string | false> {
  const result = await executeKw<Array<Record<string, string | false>>>(
    "stock.picking", "read", [[pickingId], [fieldName]]
  );
  return result.length > 0 ? result[0][fieldName] : false;
}

// ─── File Status Check ──────────────────────────────────────────────────────

/**
 * All binary file fields on stock.picking that can hold uploaded files.
 */
const ALL_PICKING_FILE_FIELDS = [
  "x_studio_quality_assessment_form",
  "x_studio_quality_report_attachement",
  "x_studio_quality_report_attachment",
  "x_studio_load_quality_checker",
  "x_studio_supporting_documents",
  "x_studio_ladder_image_1_left_side",
  "x_studio_ladder_image_1_right_side",
  "x_studio_ladder_image_2_left_side",
  "x_studio_ladder_image_2_right_side",
  // Container side pictures
  "x_studio_binary_field_5v_1j45ev8ib",   // Container Right Side
  "x_studio_binary_field_7hm_1j45evrk9",  // Container Left Side
  "x_studio_container_back_side",           // Container Back Side
  // Attachments
  "x_studio_attachments",
  "x_studio_binary_field_40q_1j01n2jbk",   // Bale Codes List attachment
];

const ALL_PO_FILE_FIELDS = [
  "analysis_report",
  "bl",
  "certificate_of_origin",
  "delivery_note",
  "fumigation_certificate",
  "packing_list",
  "phytosanitary_certificate",
  "telex_release",
  "other_documents",
  "x_studio_payments_part_1",
  "x_studio_payments_part_2",
  "x_studio_payments_part_3",
  "x_studio_pl_calculations",
  "x_studio_product_bill",
  "x_studio_trucking_bill",
  "x_studio_other_governmental_documents",
  "x_studio_other_payment_receiptsupporting_document",
  "x_studio_product_payment_receiptsupporting_document",
  "x_studio_trucking_payment_receiptsupporting_document",
];

/**
 * Check which binary file fields have data on a stock.picking record.
 * Returns a map of fieldName -> boolean (true if the field has content).
 * This reads the fields but Odoo returns the full base64 content, so we
 * only check for truthiness (not false/empty).
 */
export async function checkPickingFileStatus(
  pickingId: number
): Promise<Record<string, boolean>> {
  try {
    const result = await executeKw<Array<Record<string, string | false>>>(
      "stock.picking", "read", [[pickingId], ALL_PICKING_FILE_FIELDS]
    );
    if (result.length === 0) return {};
    const record = result[0];
    const status: Record<string, boolean> = {};
    for (const field of ALL_PICKING_FILE_FIELDS) {
      const val = record[field];
      status[field] = val !== undefined && val !== false && val !== null && val !== "";
    }
    return status;
  } catch (err) {
    console.error(`[checkPickingFileStatus] Error for picking ${pickingId}:`, err);
    return {};
  }
}

/**
 * Check which binary file fields have data on a purchase.order record.
 * Returns a map of fieldName -> boolean.
 */
export async function checkPOFileStatus(
  poId: number
): Promise<Record<string, boolean>> {
  try {
    const result = await executeKw<Array<Record<string, string | false>>>(
      "purchase.order", "read", [[poId], ALL_PO_FILE_FIELDS]
    );
    if (result.length === 0) return {};
    const record = result[0];
    const status: Record<string, boolean> = {};
    for (const field of ALL_PO_FILE_FIELDS) {
      const val = record[field];
      status[field] = val !== undefined && val !== false && val !== null && val !== "";
    }
    return status;
  } catch (err) {
    console.error(`[checkPOFileStatus] Error for PO ${poId}:`, err);
    return {};
  }
}

// ─── Batch Critical Soft Copy Check ─────────────────────────────────────────

/**
 * Check soft-copy (file uploaded) status for the 5 critical clearance documents
 * across multiple PO IDs in a single Odoo call.
 * Returns Map<poId, Record<criticalField, boolean>>.
 */
const CRITICAL_PO_FILE_FIELDS = [
  "bl", "packing_list", "phytosanitary_certificate",
  "fumigation_certificate", "telex_release",
];

export async function batchCheckPOCriticalSoftCopy(
  poIds: number[]
): Promise<Map<number, Record<string, boolean>>> {
  const result = new Map<number, Record<string, boolean>>();
  if (poIds.length === 0) return result;

  try {
    const records = await executeKw<Array<Record<string, unknown>>>(
      "purchase.order", "read",
      [poIds, ["id", ...CRITICAL_PO_FILE_FIELDS]]
    );
    for (const rec of records) {
      const id = rec.id as number;
      const status: Record<string, boolean> = {};
      for (const field of CRITICAL_PO_FILE_FIELDS) {
        const val = rec[field];
        status[field] = val !== undefined && val !== false && val !== null && val !== "";
      }
      result.set(id, status);
    }
  } catch (err) {
    console.error("[batchCheckPOCriticalSoftCopy] Error:", err);
  }
  return result;
}

// ─── Incoterms Lookup ───────────────────────────────────────────────────────

export interface OdooIncoterm {
  id: number;
  name: string;
  code: string;
}

export async function fetchIncoterms(): Promise<OdooIncoterm[]> {
  return executeKw<OdooIncoterm[]>("account.incoterms", "search_read", [[]], {
    fields: ["id", "name", "code"],
    order: "code asc",
  });
}

// ─── HR Employees Lookup (for procurement officer) ──────────────────────────

export interface OdooEmployee {
  id: number;
  name: string;
}

export async function fetchEmployees(search?: string, limit = 50): Promise<OdooEmployee[]> {
  const domain: unknown[][] = [];
  if (search) domain.push(["name", "ilike", search]);
  return executeKw<OdooEmployee[]>("hr.employee", "search_read", [domain], {
    fields: ["id", "name"],
    limit,
    order: "name asc",
  });
}

/**
 * Resolve a list of employee IDs to their names.
 * Returns a map of id -> name for efficient lookup.
 */
export async function resolveEmployeeIds(ids: number[]): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (!ids || ids.length === 0) return result;
  const uniqueIds = Array.from(new Set(ids));
  try {
    const employees = await executeKw<OdooEmployee[]>("hr.employee", "search_read",
      [[["id", "in", uniqueIds]]],
      { fields: ["id", "name"] }
    );
    for (const emp of employees) {
      result.set(emp.id, emp.name);
    }
  } catch (err) {
    console.error("[resolveEmployeeIds] Failed to resolve employee IDs:", err);
  }
  return result;
}

// ─── Partners Lookup (for clearance agent, trucking company) ─────────────────

export interface OdooPartner {
  id: number;
  name: string;
}

export async function fetchPartners(search?: string, limit = 50): Promise<OdooPartner[]> {
  const domain: unknown[][] = [];
  if (search) domain.push(["name", "ilike", search]);
  return executeKw<OdooPartner[]>("res.partner", "search_read", [domain], {
    fields: ["id", "name"],
    limit,
    order: "name asc",
  });
}


/**
 * Fetch the vessel name from a Purchase Order by its name (e.g. "PO/AD/26/00038").
 * Returns the vessel name string or null if not found.
 */
export async function fetchPOVesselNameByPOName(poName: string): Promise<{ vesselName: string | null; poId: number | null; freeDaysDemurrage: number | null; telexBLIssued: boolean }> {
  try {
    const results = await executeKw<{ id: number; x_studio_vessel_name: string | false; x_studio_total_free_days_demurrage_detention: number | false; telex_release_bl_issued: boolean | false }[]>(
      "purchase.order", "search_read",
      [[["name", "=", poName]]],
      { fields: ["id", "x_studio_vessel_name", "x_studio_total_free_days_demurrage_detention", "telex_release_bl_issued"], limit: 1 }
    );
    const po = results?.[0];
    return {
      vesselName: po?.x_studio_vessel_name || null,
      poId: po?.id || null,
      freeDaysDemurrage: po?.x_studio_total_free_days_demurrage_detention || null,
      telexBLIssued: !!po?.telex_release_bl_issued,
    };
  } catch {
    return { vesselName: null, poId: null, freeDaysDemurrage: null, telexBLIssued: false };
  }
}


// ─── Weight Distribution Helper ──────────────────────────────────────────────

/**
 * Distribute total shipment weight equally across all generated pickings (loads/containers).
 * Called after PO/SO creation + confirmation when distribute_weight_equally is enabled.
 *
 * Calculates total weight from order lines (converting kg to tons), then divides
 * equally among all generated pickings, writing x_studio_quantity_in_tons to each.
 */
export async function distributeWeightAcrossPickings(
  orderId: number,
  lines: { product_qty?: number; product_uom_qty?: number; product_id: number; product_uom?: number }[],
  orderType: "purchase" | "sales"
): Promise<void> {
  // 1. Fetch the order to get picking_ids
  const model = orderType === "purchase" ? "purchase.order" : "sale.order";
  const records = await executeKw<{ id: number; picking_ids: number[] }[]>(
    model, "read", [[orderId], ["picking_ids"]]
  );
  const pickingIds = records?.[0]?.picking_ids || [];
  if (pickingIds.length === 0) {
    console.log(`[distributeWeight] No pickings found for ${model} ${orderId}, skipping`);
    return;
  }

  // 2. Calculate total weight in tons from order lines
  // Fetch product UoM info to determine conversion
  const productIds = lines.map(l => l.product_id).filter(id => id > 0);
  type ProdUom = { id: number; uom_id: [number, string] | false };
  const products = productIds.length > 0
    ? await executeKw<ProdUom[]>(
        "product.product", "search_read",
        [[["id", "in", productIds]]],
        { fields: ["id", "uom_id"] }
      )
    : [];
  const productUomMap = new Map(products.map(p => [p.id, p.uom_id]));

  let totalWeightTons = 0;
  for (const line of lines) {
    const qty = (line as any).product_qty || (line as any).product_uom_qty || 0;
    if (qty <= 0) continue;
    const uomInfo = productUomMap.get(line.product_id);
    const uomName = uomInfo ? (uomInfo[1] || "").toLowerCase() : "";
    if (uomName.includes("ton") || uomName === "t" || uomName === "mt") {
      totalWeightTons += qty;
    } else {
      // Default: assume kg
      totalWeightTons += qty / 1000;
    }
  }

  if (totalWeightTons <= 0) {
    console.log(`[distributeWeight] Total weight is 0 for ${model} ${orderId}, skipping`);
    return;
  }

  // 3. Distribute equally
  const weightPerLoad = Math.round((totalWeightTons / pickingIds.length) * 100) / 100;

  console.log(`[distributeWeight] ${model} ${orderId}: ${totalWeightTons.toFixed(2)} tons / ${pickingIds.length} loads = ${weightPerLoad.toFixed(2)} tons each`);

  // 4. Write weight to each picking
  for (const pickingId of pickingIds) {
    await executeKw<boolean>("stock.picking", "write", [
      [pickingId],
      { x_studio_quantity_in_tons: weightPerLoad },
    ]);
  }
}

// ─── Payment Terms Lookup ────────────────────────────────────────────────────
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

export interface OdooPaymentTermLine {
  id: number;
  value: string; // "percent" | "balance" | "fixed"
  value_amount: number; // percentage or fixed amount
  nb_days: number; // days after invoice
  delay_type: string; // "days_after" | "days_after_end_of_next_month" etc.
  payment_id: [number, string] | false;
}

export async function fetchPaymentTermLines(termId: number): Promise<OdooPaymentTermLine[]> {
  return executeKw<OdooPaymentTermLine[]>("account.payment.term.line", "search_read",
    [[["payment_id", "=", termId]]],
    {
      fields: ["value", "value_amount", "nb_days", "delay_type", "payment_id"],
      order: "id asc",
    }
  );
}

// ─── Invoice / Bill Tracking ─────────────────────────────────────────────────

export interface OdooInvoice {
  id: number;
  name: string;             // e.g. "BILL/2026/0001"
  state: string;            // draft, posted, cancel
  move_type: string;        // in_invoice (vendor bill), out_invoice (customer invoice), in_refund, out_refund
  amount_total: number;
  amount_untaxed: number;
  amount_tax: number;
  amount_residual: number;  // remaining to pay
  payment_state: string;    // not_paid, partial, paid, reversed, in_payment
  date: string | false;
  invoice_date: string | false;
  invoice_date_due: string | false;
  partner_id: [number, string] | false;
  currency_id: [number, string] | false;
  ref: string | false;
}

const INVOICE_FIELDS = [
  "id", "name", "state", "move_type",
  "amount_total", "amount_untaxed", "amount_tax", "amount_residual",
  "payment_state", "date", "invoice_date", "invoice_date_due",
  "partner_id", "currency_id", "ref",
];

/**
 * Fetch account.move (invoices/bills) by their IDs.
 */
export async function fetchInvoicesByIds(ids: number[]): Promise<OdooInvoice[]> {
  if (!ids || ids.length === 0) return [];
  return executeKw<OdooInvoice[]>("account.move", "search_read",
    [[["id", "in", ids]]],
    { fields: INVOICE_FIELDS, order: "invoice_date desc, id desc" }
  );
}

// ─── Search Pickings by Container/Truck Load Number ─────────────────────────

/**
 * Search stock.picking records by container number or truck load serial,
 * then return the parent purchase.order IDs that contain matching loads.
 * This enables searching shipments by their load-level identifiers.
 */
export async function searchPickingsByLoadField(query: string): Promise<number[]> {
  try {
    // Escape backslashes for Odoo ilike (LIKE pattern treats \ as escape char)
    const escapedQuery = query.replace(/\\/g, "\\\\");
    // Search stock.picking where container number, container, or truck load serial matches
    const domain = [
      "|",
      "|",
      ["x_studio_loadcontainer_number_1", "ilike", escapedQuery],
      ["x_studio_container", "ilike", escapedQuery],
      ["x_studio_truck_load_serial_tl", "ilike", escapedQuery],
    ];
    const pickings = await executeKw<{ id: number; origin: string | false }[]>(
      "stock.picking", "search_read",
      [domain],
      { fields: ["id", "origin"], limit: 100 }
    );

    if (pickings.length === 0) return [];

    // Extract unique PO names from the origin field.
    // Origin may contain " - Load N" suffix (e.g. "PO/AD/26/00051 - Load 5"),
    // strip it to get the actual PO name.
    const poNames = Array.from(new Set(
      pickings
        .map(p => p.origin)
        .filter((o): o is string => typeof o === "string" && o.length > 0)
        .map(o => o.replace(/\s*-\s*Load\s*\d+$/i, "").trim())
    ));

    if (poNames.length === 0) return [];

    // Look up the PO IDs by name
    const pos = await executeKw<{ id: number }[]>(
      "purchase.order", "search_read",
      [[["name", "in", poNames]]],
      { fields: ["id"], limit: 100 }
    );

    return pos.map(po => po.id);
  } catch (err) {
    console.error("[searchPickingsByLoadField] Error:", err);
    return [];
  }
}


/**
 * Fetch selection field options from Odoo for stock.picking grade fields.
 * Returns the selection options for loaded_grade, loaded_grade_1, and
 * overall_received_grade fields.
 */
export async function fetchGradeOptions(): Promise<{
  loadedGrade: Array<{ value: string; label: string }>;
  overallReceivedGrade: Array<{ value: string; label: string }>;
}> {
  try {
    const fields = await executeKw<Record<string, { selection?: [string, string][] }>>(
      "stock.picking", "fields_get",
      [["x_studio_loaded_grade", "x_studio_overall_received_grade_as_per_quality_assessment"]],
      { attributes: ["selection"] }
    );

    const loadedGradeField = fields["x_studio_loaded_grade"];
    const receivedGradeField = fields["x_studio_overall_received_grade_as_per_quality_assessment"];

    return {
      loadedGrade: (loadedGradeField?.selection || []).map(([value, label]) => ({ value, label })),
      overallReceivedGrade: (receivedGradeField?.selection || []).map(([value, label]) => ({ value, label })),
    };
  } catch (err) {
    console.error("[fetchGradeOptions] Error:", err);
    // Return fallback hardcoded values if Odoo call fails
    return {
      loadedGrade: [
        { value: "Brown", label: "Brown" },
        { value: "MixGrass", label: "MixGrass" },
        { value: "Grade 3", label: "Grade 3" },
        { value: "Grade 2", label: "Grade 2" },
        { value: "Grade 1", label: "Grade 1" },
        { value: "Premium", label: "Premium" },
        { value: "Supreme", label: "Supreme" },
        { value: "AlfaStraw Mix", label: "AlfaStraw Mix" },
      ],
      overallReceivedGrade: [
        { value: "MixGrass", label: "MixGrass" },
        { value: "Grade 3", label: "Grade 3" },
        { value: "Grade 2", label: "Grade 2" },
        { value: "Grade 1", label: "Grade 1" },
        { value: "Premium", label: "Premium" },
        { value: "Supreme", label: "Supreme" },
        { value: "AlfaWheat Straw Mix", label: "AlfaWheat Straw Mix" },
      ],
    };
  }
}
