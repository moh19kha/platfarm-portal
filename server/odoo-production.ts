/**
 * Odoo Manufacturing (Double Press Production) API
 *
 * Handles CRUD operations for mrp.production (manufacturing orders),
 * stock.move (input/output materials), and hr.employee lookups.
 * Uses the same JSON-RPC pattern as odoo-shipments.ts.
 */

import axios from "axios";

// ─── Odoo Connection Config ──────────────────────────────────────────────────
const ODOO_URL = "https://odoo.platfarm.io";
const ODOO_DB = "odoo";
const ODOO_USER = "aiagent";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD ?? "Platfarm@2025";

const odooClient = axios.create({
  baseURL: ODOO_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 120000,
});

// ─── UID Cache ───────────────────────────────────────────────────────────────
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

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OdooManufacturingOrder {
  id: number;
  name: string;
  product_id: [number, string] | false;
  product_qty: number;
  qty_produced: number;
  product_uom_id: [number, string] | false;
  bom_id: [number, string] | false;
  state: string;
  date_start: string | false;
  date_finished: string | false;
  company_id: [number, string] | false;
  move_raw_ids: number[];
  move_finished_ids: number[];

  // Production Info
  x_studio_production_date_start_of_shift: string | false;
  shift_start_time: string | false;
  shift_end_time: string | false;
  actual_production_hours: number;
  down_time_minutes: number;
  general_observations_notes: string | false;

  // Employee assignments (many2many → IDs)
  supervisor_ids: number[];
  involved_production_labors: number[];
  involved_quality_labors: number[];
  involved_drivers: number[];
  quality_supervisor_ids: number[];
  loading_driver_ids: number[];
  labor_ids: number[];

  // Input Product Quality
  x_studio_input_material_source: string | false;
  input_product_quality_grade: string | false;
  average_input_big_bale_weight_kg: number;
  input_product_contain_grasses: boolean;
  percentage_grasses_input_product: number;
  input_product_contain_high_moisture: boolean;
  number_high_moisture_big_bales: number;
  number_high_moisture_small_bales_tons: number;
  input_product_quality_observations: string | false;

  // Output Product Quality (bale counts)
  no_produced_premium_bales: number;
  no_produced_grade_1_bales: number;
  no_produced_fair_grade_bales: number;
  no_produced_alfamix_bales: number;
  no_produced_mix_grass_bales: number;
  no_produced_wheat_straw_bales: number;
  x_studio_no_produced_supreme_bales: number;
  output_product_quality_observations: string | false;

  // Diesel & Materials
  diesel_consumption_liters: number;
  number_sleeve_bags_used: number;
  number_strapping_units_used: number;
  diesel_materials_consumption_notes: string | false;

  // Baling Machine Monitoring
  no_oil_measurements_during_shift: number;
  maximum_oil_temperature: number;
  maximum_oil_pressure: number;
  is_there_equipment_failure: boolean;
  equipment_failure_reason: string | false;
  baling_monitoring_notes: string | false;

  // Quality Form
  supervisor_quality_id: [number, string] | false;
  quality_observations_notes: string | false;

  // Incentive
  x_studio_incentive_cancelled: boolean;
  x_studio_incentive_cancelation_details: string | false;

  // Additional fields
  x_studio_no_produced_fairgrade_3_bales: number;
  x_studio_facility_manager_attended: boolean;
  priority: string;
  date_deadline: string | false;
  qty_producing: number;
  origin: string | false;
  user_id: [number, string] | false;
  location_src_id: [number, string] | false;
  location_dest_id: [number, string] | false;
  consumption: string;
  is_locked: boolean;
}

export interface OdooStockMove {
  id: number;
  product_id: [number, string] | false;
  product_uom_qty: number;
  quantity: number;
  product_uom: [number, string] | false;
  state: string;
  name: string;
  raw_material_production_id: [number, string] | false;
  production_id: [number, string] | false;
  location_id: [number, string] | false;
  location_dest_id: [number, string] | false;
}

export interface OdooEmployee {
  id: number;
  name: string;
  department_id: [number, string] | false;
  job_title: string | false;
}

export interface OdooProduct {
  id: number;
  name: string;
  uom_id: [number, string] | false;
  categ_id: [number, string] | false;
  type: string;
}

// ─── Field Lists ─────────────────────────────────────────────────────────────

const MO_FIELDS = [
  "id", "name", "product_id", "product_qty", "qty_produced",
  "product_uom_id", "bom_id", "state", "date_start", "date_finished",
  "company_id", "move_raw_ids", "move_finished_ids",
  // Production Info
  "x_studio_production_date_start_of_shift",
  "shift_start_time", "shift_end_time",
  "actual_production_hours", "down_time_minutes",
  "general_observations_notes",
  // Employee assignments
  "supervisor_ids", "involved_production_labors",
  "involved_quality_labors", "involved_drivers",
  "quality_supervisor_ids", "loading_driver_ids", "labor_ids",
  // Input Product Quality
  "x_studio_input_material_source", "input_product_quality_grade",
  "average_input_big_bale_weight_kg",
  "input_product_contain_grasses", "percentage_grasses_input_product",
  "input_product_contain_high_moisture",
  "number_high_moisture_big_bales", "number_high_moisture_small_bales_tons",
  "input_product_quality_observations",
  // Output Product Quality
  "no_produced_premium_bales", "no_produced_grade_1_bales",
  "no_produced_fair_grade_bales", "no_produced_alfamix_bales",
  "no_produced_mix_grass_bales", "no_produced_wheat_straw_bales",
  "x_studio_no_produced_supreme_bales",
  "output_product_quality_observations",
  // Diesel & Materials
  "diesel_consumption_liters", "number_sleeve_bags_used",
  "number_strapping_units_used", "diesel_materials_consumption_notes",
  // Baling Machine Monitoring
  "no_oil_measurements_during_shift", "maximum_oil_temperature",
  "maximum_oil_pressure", "is_there_equipment_failure",
  "equipment_failure_reason", "baling_monitoring_notes",
  // Quality Form
  "supervisor_quality_id", "quality_observations_notes",
  // Incentive
  "x_studio_incentive_cancelled",
  "x_studio_incentive_cancelation_details",
  // Additional fields
  "x_studio_no_produced_fairgrade_3_bales",
  "x_studio_facility_manager_attended",
  "priority", "date_deadline", "qty_producing",
  "origin", "user_id", "location_src_id", "location_dest_id",
  "consumption", "is_locked",
];

const STOCK_MOVE_FIELDS = [
  "id", "product_id", "product_uom_qty", "quantity",
  "product_uom", "state", "name",
  "raw_material_production_id", "production_id",
  "location_id", "location_dest_id",
];

// ─── READ Operations ─────────────────────────────────────────────────────────

/**
 * Fetch manufacturing orders with optional filters.
 */
export async function fetchManufacturingOrders(filters?: {
  state?: string;
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<OdooManufacturingOrder[]> {
  const domain: (string | unknown[])[] = [];
  if (filters?.state && filters.state !== "all") {
    domain.push(["state", "=", filters.state]);
  }
  if (filters?.search) {
    domain.push("|");
    domain.push("|");
    domain.push(["name", "ilike", filters.search]);
    domain.push(["product_id", "ilike", filters.search]);
    domain.push(["x_studio_input_material_source", "ilike", filters.search]);
  }

  return executeKw<OdooManufacturingOrder[]>("mrp.production", "search_read", [domain], {
    fields: MO_FIELDS,
    limit: filters?.limit || 200,
    offset: filters?.offset || 0,
    order: "date_start desc, id desc",
  });
}

/**
 * Fetch a single manufacturing order by ID.
 */
export async function fetchManufacturingOrderById(id: number): Promise<OdooManufacturingOrder | null> {
  const results = await executeKw<OdooManufacturingOrder[]>(
    "mrp.production", "search_read",
    [[["id", "=", id]]],
    { fields: MO_FIELDS }
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * Count manufacturing orders matching filters.
 */
export async function countManufacturingOrders(filters?: {
  state?: string;
}): Promise<number> {
  const domain: unknown[][] = [];
  if (filters?.state && filters.state !== "all") {
    domain.push(["state", "=", filters.state]);
  }
  return executeKw<number>("mrp.production", "search_count", [domain]);
}

/**
 * Fetch stock moves (input materials) for a manufacturing order.
 */
export async function fetchRawMoves(moveIds: number[]): Promise<OdooStockMove[]> {
  if (moveIds.length === 0) return [];
  return executeKw<OdooStockMove[]>("stock.move", "search_read",
    [[["id", "in", moveIds]]],
    { fields: STOCK_MOVE_FIELDS }
  );
}

/**
 * Fetch stock moves (output/finished products) for a manufacturing order.
 */
export async function fetchFinishedMoves(moveIds: number[]): Promise<OdooStockMove[]> {
  if (moveIds.length === 0) return [];
  return executeKw<OdooStockMove[]>("stock.move", "search_read",
    [[["id", "in", moveIds]]],
    { fields: STOCK_MOVE_FIELDS }
  );
}

/**
 * Resolve employee IDs to name/department/job info.
 */
export async function resolveProductionEmployeeIds(
  employeeIds: number[]
): Promise<Map<number, { name: string; department: string; jobTitle: string }>> {
  const unique = [...new Set(employeeIds)].filter(id => id > 0);
  if (unique.length === 0) return new Map();

  const employees = await executeKw<OdooEmployee[]>(
    "hr.employee", "search_read",
    [[["id", "in", unique]]],
    { fields: ["id", "name", "department_id", "job_title"] }
  );

  const map = new Map<number, { name: string; department: string; jobTitle: string }>();
  for (const emp of employees) {
    map.set(emp.id, {
      name: emp.name,
      department: emp.department_id ? emp.department_id[1] : "",
      jobTitle: emp.job_title || "",
    });
  }
  return map;
}

/**
 * Fetch employees for dropdown selection (production-relevant).
 */
export async function fetchProductionEmployees(search?: string): Promise<OdooEmployee[]> {
  const domain: unknown[][] = [["active", "=", true]];
  if (search) {
    domain.push(["name", "ilike", search]);
  }
  return executeKw<OdooEmployee[]>("hr.employee", "search_read", [domain], {
    fields: ["id", "name", "department_id", "job_title"],
    order: "name asc",
    limit: 200,
  });
}

/**
 * Fetch products for dropdown selection.
 */
export async function fetchProductionProducts(search?: string, type?: "finished" | "raw"): Promise<OdooProduct[]> {
  const domain: (string | unknown[])[] = [];
  if (type === "finished") {
    domain.push(["name", "ilike", "Double Press"]);
  } else if (type === "raw") {
    domain.push("|");
    domain.push(["name", "ilike", "Single Press"]);
    domain.push(["name", "ilike", "Alfalfa"]);
  }
  if (search) {
    domain.push(["name", "ilike", search]);
  }
  return executeKw<OdooProduct[]>("product.product", "search_read", [domain], {
    fields: ["id", "name", "uom_id", "categ_id", "type"],
    order: "name asc",
    limit: 100,
  });
}

/**
 * Fetch Bill of Materials for a product.
 */
export async function fetchBOMs(productId?: number): Promise<{ id: number; name: string; product_id: [number, string] | false; product_qty: number }[]> {
  const domain: unknown[][] = [];
  if (productId) {
    domain.push(["product_id", "=", productId]);
  }
  return executeKw("mrp.bom", "search_read", [domain], {
    fields: ["id", "display_name", "product_id", "product_qty"],
    limit: 50,
  });
}

// ─── CREATE Operations ───────────────────────────────────────────────────────

export interface CreateManufacturingOrderInput {
  product_id: number;
  product_qty: number;
  product_uom_id?: number;
  bom_id?: number;
  company_id?: number;
  date_start?: string;
  x_studio_production_date_start_of_shift?: string;
  x_studio_input_material_source?: string;
  // Shift info
  shift_start_time?: string;
  shift_end_time?: string;
  actual_production_hours?: number;
  down_time_minutes?: number;
  // Employee assignments (arrays of IDs)
  supervisor_ids?: number[];
  involved_production_labors?: number[];
  involved_quality_labors?: number[];
  involved_drivers?: number[];
  quality_supervisor_ids?: number[];
  loading_driver_ids?: number[];
  labor_ids?: number[];
  // Input quality
  input_product_quality_grade?: string;
  average_input_big_bale_weight_kg?: number;
  input_product_contain_grasses?: boolean;
  percentage_grasses_input_product?: number;
  input_product_contain_high_moisture?: boolean;
  number_high_moisture_big_bales?: number;
  number_high_moisture_small_bales_tons?: number;
  input_product_quality_observations?: string;
  // Diesel & Materials
  diesel_consumption_liters?: number;
  number_sleeve_bags_used?: number;
  number_strapping_units_used?: number;
  diesel_materials_consumption_notes?: string;
  // Machine monitoring
  no_oil_measurements_during_shift?: number;
  maximum_oil_temperature?: number;
  maximum_oil_pressure?: number;
  is_there_equipment_failure?: boolean;
  equipment_failure_reason?: string;
  baling_monitoring_notes?: string;
  // Notes
  general_observations_notes?: string;
  // Source location (where raw materials come from)
  location_src_id?: number;
  // Destination location (where finished product goes)
  location_dest_id?: number;
}

/**
 * Create a manufacturing order in Odoo.
 */
export async function createManufacturingOrder(input: CreateManufacturingOrderInput): Promise<number> {
  const vals: Record<string, unknown> = {
    product_id: input.product_id,
    product_qty: input.product_qty,
  };

  if (input.product_uom_id) vals.product_uom_id = input.product_uom_id;
  if (input.bom_id) vals.bom_id = input.bom_id;
  if (input.company_id) vals.company_id = input.company_id;
  if (input.location_src_id) vals.location_src_id = input.location_src_id;
  if (input.location_dest_id) vals.location_dest_id = input.location_dest_id;
  if (input.date_start) vals.date_start = input.date_start;
  if (input.x_studio_production_date_start_of_shift)
    vals.x_studio_production_date_start_of_shift = input.x_studio_production_date_start_of_shift;
  if (input.x_studio_input_material_source)
    vals.x_studio_input_material_source = input.x_studio_input_material_source;
  if (input.shift_start_time) vals.shift_start_time = input.shift_start_time;
  if (input.shift_end_time) vals.shift_end_time = input.shift_end_time;
  if (input.actual_production_hours !== undefined) vals.actual_production_hours = input.actual_production_hours;
  if (input.down_time_minutes !== undefined) vals.down_time_minutes = input.down_time_minutes;
  if (input.general_observations_notes) vals.general_observations_notes = input.general_observations_notes;

  // Input quality fields
  if (input.input_product_quality_grade) vals.input_product_quality_grade = input.input_product_quality_grade;
  if (input.average_input_big_bale_weight_kg !== undefined) vals.average_input_big_bale_weight_kg = input.average_input_big_bale_weight_kg;
  if (input.input_product_contain_grasses !== undefined) vals.input_product_contain_grasses = input.input_product_contain_grasses;
  if (input.percentage_grasses_input_product !== undefined) vals.percentage_grasses_input_product = input.percentage_grasses_input_product;
  if (input.input_product_contain_high_moisture !== undefined) vals.input_product_contain_high_moisture = input.input_product_contain_high_moisture;
  if (input.number_high_moisture_big_bales !== undefined) vals.number_high_moisture_big_bales = input.number_high_moisture_big_bales;
  if (input.number_high_moisture_small_bales_tons !== undefined) vals.number_high_moisture_small_bales_tons = input.number_high_moisture_small_bales_tons;
  if (input.input_product_quality_observations) vals.input_product_quality_observations = input.input_product_quality_observations;

  // Diesel & Materials
  if (input.diesel_consumption_liters !== undefined) vals.diesel_consumption_liters = input.diesel_consumption_liters;
  if (input.number_sleeve_bags_used !== undefined) vals.number_sleeve_bags_used = input.number_sleeve_bags_used;
  if (input.number_strapping_units_used !== undefined) vals.number_strapping_units_used = input.number_strapping_units_used;
  if (input.diesel_materials_consumption_notes) vals.diesel_materials_consumption_notes = input.diesel_materials_consumption_notes;

  // Machine monitoring
  if (input.no_oil_measurements_during_shift !== undefined) vals.no_oil_measurements_during_shift = input.no_oil_measurements_during_shift;
  if (input.maximum_oil_temperature !== undefined) vals.maximum_oil_temperature = input.maximum_oil_temperature;
  if (input.maximum_oil_pressure !== undefined) vals.maximum_oil_pressure = input.maximum_oil_pressure;
  if (input.is_there_equipment_failure !== undefined) vals.is_there_equipment_failure = input.is_there_equipment_failure;
  if (input.equipment_failure_reason) vals.equipment_failure_reason = input.equipment_failure_reason;
  if (input.baling_monitoring_notes) vals.baling_monitoring_notes = input.baling_monitoring_notes;

  // Many2many employee assignments
  if (input.supervisor_ids?.length) vals.supervisor_ids = [[6, 0, input.supervisor_ids]];
  if (input.involved_production_labors?.length) vals.involved_production_labors = [[6, 0, input.involved_production_labors]];
  if (input.involved_quality_labors?.length) vals.involved_quality_labors = [[6, 0, input.involved_quality_labors]];
  if (input.involved_drivers?.length) vals.involved_drivers = [[6, 0, input.involved_drivers]];
  if (input.quality_supervisor_ids?.length) vals.quality_supervisor_ids = [[6, 0, input.quality_supervisor_ids]];
  if (input.loading_driver_ids?.length) vals.loading_driver_ids = [[6, 0, input.loading_driver_ids]];
  if (input.labor_ids?.length) vals.labor_ids = [[6, 0, input.labor_ids]];

  const moId = await executeKw<number>("mrp.production", "create", [vals]);
  return moId;
}

// ─── UPDATE Operations ───────────────────────────────────────────────────────

export interface UpdateManufacturingOrderInput {
  id: number;
  // Shift info
  shift_start_time?: string;
  shift_end_time?: string;
  actual_production_hours?: number;
  down_time_minutes?: number;
  general_observations_notes?: string;
  x_studio_input_material_source?: string;
  x_studio_production_date_start_of_shift?: string;

  // Employee assignments (arrays of IDs → converted to [[6, 0, ids]])
  supervisor_ids?: number[];
  involved_production_labors?: number[];
  involved_quality_labors?: number[];
  involved_drivers?: number[];
  quality_supervisor_ids?: number[];
  loading_driver_ids?: number[];
  labor_ids?: number[];

  // Input Product Quality
  input_product_quality_grade?: string;
  average_input_big_bale_weight_kg?: number;
  input_product_contain_grasses?: boolean;
  percentage_grasses_input_product?: number;
  input_product_contain_high_moisture?: boolean;
  number_high_moisture_big_bales?: number;
  number_high_moisture_small_bales_tons?: number;
  input_product_quality_observations?: string;

  // Output Product Quality
  no_produced_premium_bales?: number;
  no_produced_grade_1_bales?: number;
  no_produced_fair_grade_bales?: number;
  no_produced_alfamix_bales?: number;
  no_produced_mix_grass_bales?: number;
  no_produced_wheat_straw_bales?: number;
  x_studio_no_produced_supreme_bales?: number;
  output_product_quality_observations?: string;

  // Diesel & Materials
  diesel_consumption_liters?: number;
  number_sleeve_bags_used?: number;
  number_strapping_units_used?: number;
  diesel_materials_consumption_notes?: string;

  // Baling Machine Monitoring
  no_oil_measurements_during_shift?: number;
  maximum_oil_temperature?: number;
  maximum_oil_pressure?: number;
  is_there_equipment_failure?: boolean;
  equipment_failure_reason?: string;
  baling_monitoring_notes?: string;

  // Quality Form
  supervisor_quality_id?: number;
  quality_observations_notes?: string;

  // Incentive
  x_studio_incentive_cancelled?: boolean;
  x_studio_incentive_cancelation_details?: string;

  // Additional fields
  x_studio_no_produced_fairgrade_3_bales?: number;
  x_studio_facility_manager_attended?: boolean;
  priority?: string;

}

/**
 * Update a manufacturing order in Odoo.
 */
export async function updateManufacturingOrder(input: UpdateManufacturingOrderInput): Promise<boolean> {
  const { id, ...fields } = input;
  const vals: Record<string, unknown> = {};

  // Many2many fields need [[6, 0, ids]] format
  const many2manyFields = [
    "supervisor_ids", "involved_production_labors", "involved_quality_labors",
    "involved_drivers", "quality_supervisor_ids", "loading_driver_ids", "labor_ids",
  ];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (many2manyFields.includes(key) && Array.isArray(value)) {
      vals[key] = [[6, 0, value]];
    } else {
      vals[key] = value;
    }
  }

  if (Object.keys(vals).length === 0) return true;
  return executeKw<boolean>("mrp.production", "write", [[id], vals]);
}

// ─── State Transitions ───────────────────────────────────────────────────────

/**
 * Confirm a manufacturing order (Draft → Confirmed).
 */
export async function confirmManufacturingOrder(moId: number): Promise<boolean> {
  return executeKw<boolean>("mrp.production", "action_confirm", [[moId]]);
}

/**
 * Mark a manufacturing order as done (Confirmed → Done).
 * This triggers stock moves (consumes raw materials, produces finished goods).
 */
export async function markManufacturingOrderDone(moId: number): Promise<boolean> {
  return executeKw<boolean>("mrp.production", "button_mark_done", [[moId]]);
}

/**
 * Cancel a manufacturing order.
 */
export async function cancelManufacturingOrder(moId: number): Promise<boolean> {
  return executeKw<boolean>("mrp.production", "action_cancel", [[moId]]);
}

/**
 * Update stock move quantities (actual consumption).
 */
export async function updateStockMoveQuantity(moveId: number, quantity: number): Promise<boolean> {
  return executeKw<boolean>("stock.move", "write", [[moveId], { quantity }]);
}

// ─── Warehouse / Location Lookups ────────────────────────────────────────────

/**
 * Fetch stock warehouses for source warehouse selection.
 */
export async function fetchWarehouses(search?: string): Promise<{ id: number; name: string; code: string; companyId: number; companyName: string }[]> {
  const domain: (string | unknown[])[] = [];
  if (search) {
    domain.push("|");
    domain.push(["name", "ilike", search]);
    domain.push(["code", "ilike", search]);
  }
  const results = await executeKw<{ id: number; name: string; code: string; company_id: [number, string] | false }[]>(
    "stock.warehouse", "search_read", [domain],
    { fields: ["id", "name", "code", "company_id"], order: "name asc", limit: 50 }
  );
  return results.map(w => ({
    id: w.id,
    name: w.name,
    code: w.code,
    companyId: w.company_id ? w.company_id[0] : 0,
    companyName: w.company_id ? w.company_id[1] : "",
  }));
}

/**
 * Fetch stock locations for source location selection.
 */
export async function fetchStockLocations(search?: string, warehouseId?: number): Promise<{ id: number; name: string; completeName: string }[]> {
  const domain: (string | unknown[])[] = [["usage", "=", "internal"]];
  if (search) {
    domain.push(["complete_name", "ilike", search]);
  }
  if (warehouseId) {
    domain.push(["warehouse_id", "=", warehouseId]);
  }
  const results = await executeKw<{ id: number; name: string; complete_name: string }[]>(
    "stock.location", "search_read", [domain],
    { fields: ["id", "name", "complete_name"], order: "complete_name asc", limit: 50 }
  );
  return results.map(l => ({
    id: l.id,
    name: l.name,
    completeName: l.complete_name,
  }));
}

// ─── Dashboard Statistics ────────────────────────────────────────────────────

/**
 * Fetch production statistics for the dashboard.
 */
export async function fetchProductionStats(): Promise<{
  totalOrders: number;
  draftOrders: number;
  confirmedOrders: number;
  inProgressOrders: number;
  doneOrders: number;
  cancelledOrders: number;
  totalProducedKg: number;
  totalDieselLiters: number;
  avgProductionHours: number;
}> {
  const [total, draft, confirmed, progress, done, cancelled] = await Promise.all([
    executeKw<number>("mrp.production", "search_count", [[]]),
    executeKw<number>("mrp.production", "search_count", [[["state", "=", "draft"]]]),
    executeKw<number>("mrp.production", "search_count", [[["state", "=", "confirmed"]]]),
    executeKw<number>("mrp.production", "search_count", [[["state", "=", "progress"]]]),
    executeKw<number>("mrp.production", "search_count", [[["state", "=", "done"]]]),
    executeKw<number>("mrp.production", "search_count", [[["state", "=", "cancel"]]]),
  ]);

  // Fetch aggregated data from done orders
  const doneOrders = await executeKw<OdooManufacturingOrder[]>(
    "mrp.production", "search_read",
    [[["state", "=", "done"]]],
    {
      fields: ["qty_produced", "diesel_consumption_liters", "actual_production_hours"],
      limit: 0, // all
    }
  );

  let totalProducedKg = 0;
  let totalDieselLiters = 0;
  let totalHours = 0;
  let hoursCount = 0;

  for (const mo of doneOrders) {
    totalProducedKg += mo.qty_produced || 0;
    totalDieselLiters += mo.diesel_consumption_liters || 0;
    if (mo.actual_production_hours > 0) {
      totalHours += mo.actual_production_hours;
      hoursCount++;
    }
  }

  return {
    totalOrders: total,
    draftOrders: draft,
    confirmedOrders: confirmed,
    inProgressOrders: progress,
    doneOrders: done,
    cancelledOrders: cancelled,
    totalProducedKg,
    totalDieselLiters,
    avgProductionHours: hoursCount > 0 ? totalHours / hoursCount : 0,
  };
}


// ─── Binary File Upload / Read / Status for mrp.production ──────────────────

/**
 * All binary file fields on mrp.production that can hold uploaded files.
 */
const ALL_MO_FILE_FIELDS = [
  "supporting_documents",
  "quality_form_documents",
  "output_quality_form_documents",
  "machine_monitoring_form_documents",
  "x_studio_supporting_documents",
  "x_studio_quality_form_documents",
];

/**
 * Upload a file to a binary field on a mrp.production record.
 * The file content should be base64-encoded.
 */
export async function uploadFileToMO(
  moId: number,
  fieldName: string,
  base64Content: string
): Promise<boolean> {
  if (!ALL_MO_FILE_FIELDS.includes(fieldName)) {
    throw new Error(`Invalid file field for mrp.production: ${fieldName}`);
  }

  return executeKw<boolean>("mrp.production", "write", [
    [moId],
    { [fieldName]: base64Content },
  ]);
}

/**
 * Read a binary field from a mrp.production record.
 * Returns base64-encoded content or false if empty.
 */
export async function readMOFile(
  moId: number,
  fieldName: string
): Promise<string | false> {
  if (!ALL_MO_FILE_FIELDS.includes(fieldName)) {
    throw new Error(`Invalid file field for mrp.production: ${fieldName}`);
  }
  const result = await executeKw<Array<Record<string, string | false>>>(
    "mrp.production", "read", [[moId], [fieldName]]
  );
  return result.length > 0 ? result[0][fieldName] : false;
}

/**
 * Check which binary file fields have data on a mrp.production record.
 * Returns a map of fieldName -> boolean (true if the field has content).
 */
export async function checkMOFileStatus(
  moId: number
): Promise<Record<string, boolean>> {
  try {
    const result = await executeKw<Array<Record<string, string | false>>>(
      "mrp.production", "read", [[moId], ALL_MO_FILE_FIELDS]
    );
    if (result.length === 0) return {};
    const record = result[0];
    const status: Record<string, boolean> = {};
    for (const field of ALL_MO_FILE_FIELDS) {
      const val = record[field];
      status[field] = val !== undefined && val !== false && val !== null && val !== "";
    }
    return status;
  } catch (err) {
    console.error(`[checkMOFileStatus] Error for MO ${moId}:`, err);
    return {};
  }
}


// ─── BOM Lines (Components) ─────────────────────────────────────────────────

/**
 * Fetch BOM lines (components/raw materials) for a given BOM ID.
 * Returns the product IDs, quantities, and UoM for each component.
 */
export async function fetchBOMLines(bomId: number): Promise<{
  id: number;
  product_id: [number, string] | false;
  product_qty: number;
  product_uom_id: [number, string] | false;
}[]> {
  return executeKw("mrp.bom.line", "search_read",
    [[["bom_id", "=", bomId]]],
    { fields: ["id", "product_id", "product_qty", "product_uom_id"] }
  );
}
