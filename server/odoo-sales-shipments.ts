/**
 * Odoo Sales Shipments API
 *
 * Handles CRUD operations for sale.order (sales shipments),
 * sale.order.line, and stock.picking (deliveries/transfers).
 * Also handles binary file uploads to both SO and picking records.
 */

import axios from "axios";

// ─── Odoo Connection Config ───────────────────────────────────────────────
const ODOO_URL = "https://odoo.platfarm.io";
const ODOO_DB = "odoo";
const ODOO_USER = "aiagent";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD ?? "Platfarm@2025";

const odooClient = axios.create({
  baseURL: ODOO_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 120000,
});

// ─── UID Cache ────────────────────────────────────────────────────────────
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

// ─── Field Lists ──────────────────────────────────────────────────────────

const SO_FIELDS = [
  "id", "name", "partner_id", "company_id", "state",
  "date_order", "amount_total", "amount_untaxed", "amount_tax",
  "currency_id", "order_line", "picking_ids", "delivery_count",
  "incoterm", "pricelist_id", "payment_term_id",
  "client_order_ref", "origin", "user_id",
  "number_of_loads", "load_type", "freight_type", "shipping_line",
  "tracking_number", "vessel_cut_off", "vessel_tracking_link",
  "rate_per_container_load", "transit_time_in_days",
  "local_clearance_agent", "local_trucking_company",
  "eta_pod", "eta_pol", "etd_pol",
  "pol", "pod", "booking_number",
  "x_studio_product_category", "x_studio_ultimate_customer",
  "x_studio_total_shipment_weight_in_tons_sales",
  "x_studio_selection_field_65k_1j3t1b3d3",
  "x_studio_unified_shipment_status",
  "x_studio_shipment_acceptance_status",
  "x_studio_shipment_bl_number", "x_studio_selling_type",
  "x_studio_corresponding_purchasesale_shipment",
  "x_studio_payment_term", "x_studio_payment_term_1",
  "x_studio_ocean_freight_invoiced_entity",
  "x_studio_ocean_freight_invoicing_entity",
  "x_studio_clearance_trucking_invoiced_entity",
  "x_studio_clearance_trucking_invoicing_entity",
  "x_studio_notespayment", "x_studio_notespayment_1",
  "sale_order_template_id",
  "invoice_ids",
  "bl_telex_release_date",
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
  // Procurement/Source fields
  "x_studio_purchasing_unit_1", "x_studio_currency_id", "x_studio_purchase_currency",
  "x_studio_agreed_product_price_per_unit", "x_studio_agreed_product_price_per_unit_1",
  "x_studio_farmfield_name",
  "x_studio_loaded_grade_1", "x_studio_driver_name", "x_studio_driver_contact",
  "x_studio_agreed_trucking_cost", "x_studio_advance_payment", "x_studio_advance_payment_1",
  "x_studio_long_stay_cost", "x_studio_loading_datetime", "x_studio_loading_datetime_1",
  // Quality (Destination/Received) fields
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
  // Loading Team fields
  "quality_supervisor_ids", "loading_driver_ids", "labor_ids",
  "x_studio_quality_supervisor_for_delivery",
];

// ─── READ Operations ──────────────────────────────────────────────────────

export async function fetchSaleOrders(filters?: {
  companyId?: number;
  templateId?: number;
  limit?: number;
  offset?: number;
}): Promise<Record<string, any>[]> {
  const domain: unknown[][] = [];
  if (filters?.companyId) domain.push(["company_id", "=", filters.companyId]);
  if (filters?.templateId) domain.push(["sale_order_template_id", "=", filters.templateId]);

  return executeKw<Record<string, any>[]>("sale.order", "search_read", [domain], {
    fields: SO_FIELDS,
    limit: filters?.limit || 200,
    offset: filters?.offset || 0,
    order: "date_order desc, id desc",
  });
}

export async function fetchSaleOrderById(id: number): Promise<Record<string, any> | null> {
  const results = await executeKw<Record<string, any>[]>(
    "sale.order", "search_read",
    [[["id", "=", id]]],
    { fields: SO_FIELDS }
  );
  return results.length > 0 ? results[0] : null;
}

export async function fetchSaleOrderByName(name: string): Promise<Record<string, any> | null> {
  const results = await executeKw<Record<string, any>[]>(
    "sale.order", "search_read",
    [[["name", "=", name]]],
    { fields: ["id", "name"], limit: 1 }
  );
  return results.length > 0 ? results[0] : null;
}

export async function countSaleOrders(filters?: {
  companyId?: number;
}): Promise<number> {
  const domain: unknown[][] = [];
  if (filters?.companyId) domain.push(["company_id", "=", filters.companyId]);
  return executeKw<number>("sale.order", "search_count", [domain]);
}

export async function fetchSOLines(lineIds: number[]): Promise<Record<string, any>[]> {
  if (lineIds.length === 0) return [];
  return executeKw<Record<string, any>[]>("sale.order.line", "search_read",
    [[["id", "in", lineIds]]],
    {
      fields: [
        "id", "product_id", "product_uom_qty", "qty_delivered", "qty_invoiced",
        "price_unit", "price_subtotal", "product_uom", "discount", "name",
      ],
    }
  );
}

export async function fetchPickings(pickingIds: number[]): Promise<Record<string, any>[]> {
  if (pickingIds.length === 0) return [];
  return executeKw<Record<string, any>[]>("stock.picking", "search_read",
    [[["id", "in", pickingIds]]],
    { fields: PICKING_FIELDS }
  );
}

/**
 * Fetch outgoing stock.pickings for a company, used for Sales Analytics.
 * Groups by sale_id to count shipments; uses x_studio_quantity_in_tons for tonnage.
 */
export async function fetchOutgoingPickingsForAnalytics(filters?: {
  companyId?: number;
  limit?: number;
}): Promise<Record<string, any>[]> {
  const domain: unknown[][] = [
    ["picking_type_code", "=", "outgoing"],
    ["state", "in", ["done", "assigned"]],
  ];
  if (filters?.companyId) domain.push(["company_id", "=", filters.companyId]);

  return executeKw<Record<string, any>[]>("stock.picking", "search_read", [domain], {
    fields: [
      "id", "name", "partner_id", "company_id", "state", "origin", "sale_id",
      "x_studio_quantity_in_tons", "x_studio_net_weight_in_tons",
      "x_studio_loadcontainer_number_1",
      "x_studio_loading_datetime", "x_studio_loading_datetime_1",
      "x_studio_loading_date",
    ],
    limit: filters?.limit || 2000,
    order: "id desc",
  });
}

// ─── CREATE Operations ────────────────────────────────────────────────────

export interface CreateSaleOrderInput {
  partner_id: number;
  company_id: number;
  currency_id?: number;
  pricelist_id?: number;
  date_order?: string;
  number_of_loads?: number;
  load_type?: string;
  freight_type?: string;
  shipping_line?: string;
  tracking_number?: string;
  vessel_cut_off?: string;
  vessel_tracking_link?: string;
  rate_per_container_load?: string;
  transit_time_in_days?: string;
  incoterm?: number;
  payment_term_id?: number;
  local_clearance_agent?: number;
  local_trucking_company?: number;
  eta_pod?: string;
  eta_pol?: string;
  etd_pol?: string;
  pol?: string;
  pod?: string;
  booking_number?: string;
  x_studio_product_category?: string;
  x_studio_ultimate_customer?: string;
  x_studio_shipment_bl_number?: string;
  x_studio_selling_type?: string;
  x_studio_corresponding_purchasesale_shipment?: string;
  x_studio_selection_field_65k_1j3t1b3d3?: string;
  x_studio_unified_shipment_status?: string;
  x_studio_shipment_acceptance_status?: string;
  x_studio_payment_term?: string;
  x_studio_payment_term_1?: string;
  x_studio_ocean_freight_invoiced_entity?: string;
  x_studio_ocean_freight_invoicing_entity?: string;
  x_studio_clearance_trucking_invoiced_entity?: string;
  x_studio_clearance_trucking_invoicing_entity?: string;
  x_studio_notespayment?: string;
  x_studio_notespayment_1?: string;
  client_order_ref?: string;
  sale_order_template_id?: number;
  warehouse_id?: number;
  distribute_weight_equally?: boolean;
  lines: {
    product_id: number;
    product_uom_qty: number;
    price_unit: number;
    product_uom?: number;
    discount?: number;
  }[];
}

export async function createSaleOrder(input: CreateSaleOrderInput): Promise<number> {
  const vals: Record<string, unknown> = {
    partner_id: input.partner_id,
    company_id: input.company_id,
  };

  const optionalFields: Array<keyof Omit<CreateSaleOrderInput, 'partner_id' | 'company_id' | 'lines'>> = [
    'currency_id', 'pricelist_id', 'date_order', 'number_of_loads',
    'load_type', 'freight_type', 'shipping_line', 'tracking_number',
    'vessel_cut_off', 'vessel_tracking_link', 'rate_per_container_load',
    'transit_time_in_days', 'incoterm', 'payment_term_id', 'local_clearance_agent',
    'local_trucking_company',    'eta_pod', 'eta_pol', 'etd_pol',
    'pol', 'pod', 'booking_number',  'x_studio_product_category', 'x_studio_ultimate_customer',
    'x_studio_shipment_bl_number', 'x_studio_selling_type',
    'x_studio_corresponding_purchasesale_shipment',
    'x_studio_selection_field_65k_1j3t1b3d3',
    'x_studio_unified_shipment_status',
    'x_studio_shipment_acceptance_status',
    'x_studio_payment_term', 'x_studio_payment_term_1',
    'x_studio_ocean_freight_invoiced_entity',
    'x_studio_ocean_freight_invoicing_entity',
    'x_studio_clearance_trucking_invoiced_entity',
    'x_studio_clearance_trucking_invoicing_entity',
    'x_studio_notespayment', 'x_studio_notespayment_1',
    'client_order_ref', 'sale_order_template_id', 'warehouse_id',
  ];

  for (const key of optionalFields) {
    if (input[key] !== undefined && input[key] !== null) {
      vals[key] = input[key];
    }
  }

  let productMap: Map<number, { id: number; name: string; company_id: [number, string] | false; uom_id: [number, string] | false }> | undefined;

  if (input.lines.length > 0) {
    // ── Server-side product-company validation ──
    // Prevent cross-company product errors by checking each product's company_id
    const productIds = input.lines.map(l => l.product_id);
    type ProductInfo = { id: number; name: string; company_id: [number, string] | false; uom_id: [number, string] | false };
    const products = await executeKw(
      "product.product", "search_read",
      [[["id", "in", productIds]]],
      { fields: ["id", "name", "company_id", "uom_id"] }
    ) as ProductInfo[];
    productMap = new Map(products.map(p => [p.id, p]));
    // Company validation removed - products can be shared across companies


















    vals.order_line = input.lines.map((line) => {
      // Use product's own UoM if not provided, to avoid category mismatch
      const prod = productMap!.get(line.product_id);
      const productUomId = prod?.uom_id ? prod.uom_id[0] : undefined;
      const uomToUse = line.product_uom || productUomId;
      return [
        0, 0, {
          product_id: line.product_id,
          product_uom_qty: line.product_uom_qty,
          price_unit: line.price_unit,
          ...(uomToUse ? { product_uom: uomToUse } : {}),
          ...(line.discount !== undefined ? { discount: line.discount } : {}),
        },
      ];
    });

    // Calculate total weight from lines (in tons) and set on the SO
    const totalWeightTons = input.lines.reduce((sum, line) => {
      const qty = line.product_uom_qty || 0;
      const prod = productMap!.get(line.product_id);
      const uomName = prod?.uom_id ? (prod.uom_id[1] || "").toLowerCase() : "";
      if (uomName.includes("ton") || uomName === "t" || uomName === "mt") return sum + qty;
      if (uomName.includes("kg") || uomName === "kilogram") return sum + qty / 1000;
      // Default: assume kg if UOM is ambiguous
      return sum + qty / 1000;
    }, 0);
    if (totalWeightTons > 0) {
      vals.x_studio_total_shipment_weight_in_tons_sales = Math.round(totalWeightTons * 100) / 100;
    }
  }

  const soId = await executeKw<number>("sale.order", "create", [vals]);

  // Auto-confirm the SO to transition from Draft → Sales Order
  // This triggers Odoo to generate delivery orders (stock pickings)
  try {
    await confirmSaleOrder(soId);
  } catch (err: any) {
    // Log but don't fail — the SO was created successfully, confirm can be retried
    console.error(`[createSaleOrder] Auto-confirm failed for SO ${soId}: ${err.message}`);
  }

  // ── Distribute weight equally across delivery pickings ──
  if (input.distribute_weight_equally !== false) {
    try {
      const { distributeWeightAcrossPickings } = await import("./odoo-shipments");
      await distributeWeightAcrossPickings(soId, input.lines, "sales");
    } catch (err: any) {
      console.error(`[createSaleOrder] Weight distribution failed for SO ${soId}: ${err.message}`);
    }
  }

  return soId;
}

// ─── UPDATE Operations ──────────────────────────────────────────────────────────

export interface UpdateSaleOrderInput {
  id: number;
  [key: string]: unknown;
}

export async function updateSaleOrder(input: UpdateSaleOrderInput): Promise<boolean> {
  const { id, ...fields } = input;
  const vals: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) vals[key] = value;
  }

  if (Object.keys(vals).length === 0) return true;
  return executeKw<boolean>("sale.order", "write", [[id], vals]);
}

export interface UpdatePickingInput {
  id: number;
  [key: string]: unknown;
}

export async function updateSalesPicking(input: UpdatePickingInput): Promise<boolean> {
  const { id, ...fields } = input;
  const vals: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) vals[key] = value;
  }

  if (Object.keys(vals).length === 0) return true;
  return executeKw<boolean>("stock.picking", "write", [[id], vals]);
}

// ─── File Upload Operations ───────────────────────────────────────────────

const validSOFileFields = [
  "x_studio_boe",
  "x_studio_egypt_tax_portal_invoice",
  "x_studio_invoices_part_1",
  "x_studio_invoices_part_2",
  "x_studio_invoices_part_3",
  "x_studio_other_governmental_documents",
  "x_studio_payments_part_1",
  "x_studio_payments_part_2",
  "x_studio_payments_part_3",
];

export async function uploadFileToSO(
  soId: number,
  fieldName: string,
  base64Content: string
): Promise<boolean> {
  if (!validSOFileFields.includes(fieldName)) {
    throw new Error(`Invalid file field for sale.order: ${fieldName}`);
  }
  return executeKw<boolean>("sale.order", "write", [
    [soId],
    { [fieldName]: base64Content },
  ]);
}

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
];

export async function uploadFileToSalesPicking(
  pickingId: number,
  fieldName: string,
  base64Content: string
): Promise<boolean> {
  if (!validPickingFileFields.includes(fieldName)) {
    throw new Error(`Invalid file field for stock.picking: ${fieldName}`);
  }
  return executeKw<boolean>("stock.picking", "write", [
    [pickingId],
    { [fieldName]: base64Content },
  ]);
}

export async function readSOFile(
  soId: number,
  fieldName: string
): Promise<string | false> {
  const result = await executeKw<Array<Record<string, string | false>>>(
    "sale.order", "read", [[soId], [fieldName]]
  );
  return result.length > 0 ? result[0][fieldName] : false;
}

export async function readSalesPickingFile(
  pickingId: number,
  fieldName: string
): Promise<string | false> {
  const result = await executeKw<Array<Record<string, string | false>>>(
    "stock.picking", "read", [[pickingId], [fieldName]]
  );
  return result.length > 0 ? result[0][fieldName] : false;
}

// ─── File Status Check Operations ────────────────────────────────────────

const ALL_SO_FILE_FIELDS = [
  "x_studio_boe",
  "x_studio_egypt_tax_portal_invoice",
  "x_studio_invoices_part_1",
  "x_studio_invoices_part_2",
  "x_studio_invoices_part_3",
  "x_studio_other_governmental_documents",
  "x_studio_payments_part_1",
  "x_studio_payments_part_2",
  "x_studio_payments_part_3",
];

const ALL_SALES_PICKING_FILE_FIELDS = [
  "x_studio_quality_assessment_form",
  "x_studio_quality_report_attachement",
  "x_studio_quality_report_attachment",
  "x_studio_load_quality_checker",
  "x_studio_supporting_documents",
  "x_studio_ladder_image_1_left_side",
  "x_studio_ladder_image_1_right_side",
  "x_studio_ladder_image_2_left_side",
  "x_studio_ladder_image_2_right_side",
];

export async function checkSOFileStatus(
  soId: number
): Promise<Record<string, boolean>> {
  try {
    const result = await executeKw<Array<Record<string, string | false>>>(
      "sale.order", "read", [[soId], ALL_SO_FILE_FIELDS]
    );
    if (!result || result.length === 0) return {};
    const record = result[0];
    const status: Record<string, boolean> = {};
    for (const field of ALL_SO_FILE_FIELDS) {
      const val = record[field];
      status[field] = typeof val === "string" && val.length > 0;
    }
    return status;
  } catch (err) {
    console.error("checkSOFileStatus error:", err);
    return {};
  }
}

export async function checkSalesPickingFileStatus(
  pickingId: number
): Promise<Record<string, boolean>> {
  try {
    const result = await executeKw<Array<Record<string, string | false>>>(
      "stock.picking", "read", [[pickingId], ALL_SALES_PICKING_FILE_FIELDS]
    );
    if (!result || result.length === 0) return {};
    const record = result[0];
    const status: Record<string, boolean> = {};
    for (const field of ALL_SALES_PICKING_FILE_FIELDS) {
      const val = record[field];
      status[field] = typeof val === "string" && val.length > 0;
    }
    return status;
  } catch (err) {
    console.error("checkSalesPickingFileStatus error:", err);
    return {};
  }
}

// ─── Confirm Sale Order ───────────────────────────────────────────────────

export async function confirmSaleOrder(soId: number): Promise<boolean> {
  // Clear sale_order_template_id before confirming to avoid
  // "You are not allowed to modify 'Quotation Template Line'" permission error.
  // The template reference is only needed during quotation creation (to populate lines),
  // and is not needed for confirmation. Clearing it prevents Odoo from trying to
  // access sale.order.template.line records which the API user may not have write access to.
  try {
    await executeKw<boolean>("sale.order", "write", [[soId], { sale_order_template_id: false }]);
  } catch (err: any) {
    // If clearing fails (e.g., field doesn't exist), log and continue with confirm attempt
    console.warn(`[confirmSaleOrder] Could not clear sale_order_template_id for SO ${soId}: ${err.message}`);
  }

  return executeKw<boolean>("sale.order", "action_confirm", [[soId]]);
}

// ─── Search Pickings by Container/Truck Load Number ─────────────────────────

/**
 * Search stock.picking records by container number or truck load serial,
 * then return the parent sale.order IDs that contain matching deliveries.
 * This enables searching sales shipments by their delivery-level identifiers.
 */
export async function searchSalesPickingsByLoadField(query: string): Promise<number[]> {
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

    // Extract unique SO names from the origin field.
    // Origin may contain " - Load N" suffix (e.g. "SO/AD/26/00001 - Load 3"),
    // strip it to get the actual SO name.
    const soNames = Array.from(new Set(
      pickings
        .map(p => p.origin)
        .filter((o): o is string => typeof o === "string" && o.length > 0)
        .map(o => o.replace(/\s*-\s*Load\s*\d+$/i, "").trim())
    ));

    if (soNames.length === 0) return [];

    // Look up the SO IDs by name
    const sos = await executeKw<{ id: number }[]>(
      "sale.order", "search_read",
      [[["name", "in", soNames]]],
      { fields: ["id"], limit: 100 }
    );

    return sos.map(so => so.id);
  } catch (err) {
    console.error("[searchSalesPickingsByLoadField] Error:", err);
    return [];
  }
}
