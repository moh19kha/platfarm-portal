/**
 * Odoo Offline Operations Data Layer
 *
 * Fetches data from the platfarm_field_ops custom module models:
 * - pf.procurement  (receiving / procurement records)
 * - pf.quality      (quality assessment records)
 * - pf.pressing     (double pressing shift records)
 * - pf.shipping     (internal transfer records)
 * - pf.site         (operational sites)
 * - pf.attachment   (photos/docs linked to records)
 *
 * Field names verified via fields_get introspection on 2026-03-16.
 * Uses the shared executeKw helper from odoo.ts (read-only operations).
 */

import { executeKw } from "./odoo";

// ─── Types ──────────────────────────────────────────────────────────────────

type M2O = [number, string] | false;

export interface OdooPfSite {
  id: number;
  name: string;
  code: string;
  active: boolean;
}

export interface OdooPfProcurement {
  id: number;
  name: string;                    // Reference e.g. "RCV-0001"
  client_ref: string | false;
  site_id: M2O;                    // → pf.site
  supplier: string | false;        // char (NOT many2one)
  commodity: string | false;       // selection
  grade: string | false;           // selection (NOT product_grade)
  plate_number: string | false;
  driver_name: string | false;
  gross_weight: number;
  tare_weight: number;
  net_weight: number;
  bale_count: number;
  avg_bale_weight: number;
  price_per_ton: number;
  currency: string | false;        // selection
  incoterm: string | false;        // selection
  truck_included: boolean;         // (NOT transport_included)
  truck_payer: string | false;     // selection (NOT transport_payer)
  truck_cost: number;              // (NOT transport_cost)
  bale_size: string | false;       // selection
  state: string | false;           // selection (NO stage field)
  notes: string | false;
  recorded_at: string | false;
  synced_at: string | false;
  create_date: string;
  write_date: string;
  user_id: M2O;                    // → res.users (Recorded By)
  attachment_count: number;
}

export interface OdooPfQuality {
  id: number;
  name: string;                    // Reference e.g. "QC-0001"
  client_ref: string | false;
  qc_type: string | false;         // selection (QC Type: received / pressed)
  procurement_id: M2O;             // → pf.procurement
  pressing_id: M2O;                // → pf.pressing
  site_id: M2O;                    // → pf.site
  user_id: M2O;                    // → res.users (Inspector)
  color: string | false;           // selection
  leaf_ratio: string | false;      // selection
  foreign_matter: string | false;  // selection
  odor: string | false;            // selection
  moisture: number;                // float
  moisture_weight_pct: number;     // float
  protein_nir: number;             // float
  density: string | false;         // selection
  avg_bale_weight: number;
  bale_height: number;
  bale_shape: string | false;      // selection
  bale_ties: string | false;       // selection
  bale_code: string | false;       // char
  truck_clean: string | false;     // selection
  has_cover: string | false;       // selection
  strap_good: string | false;      // selection
  stack_good: string | false;      // selection
  no_weeds: string | false;        // selection
  no_insects: string | false;      // selection
  no_black_wood: string | false;   // selection
  verdict: string | false;         // selection
  final_grade: string | false;     // selection
  g1_bale_count: number;
  g2_bale_count: number;
  mix_bale_count: number;
  qc_notes: string | false;        // text
  recorded_at: string | false;
  synced_at: string | false;
  state: string | false;
  create_date: string;
  write_date: string;
  attachment_count: number;
}

export interface OdooPfPressing {
  id: number;
  name: string;                    // Reference e.g. "DPR-001"
  client_ref: string | false;
  site_id: M2O;                    // → pf.site
  press_line: string | false;      // selection
  shift: string | false;           // selection
  operator: string | false;        // char
  commodity: string | false;
  in_bale_count: number;
  in_bale_size: string | false;    // selection
  in_grade: string | false;        // selection
  in_total_weight: number;
  out_bale_count: number;
  out_total_weight: number;
  out_density: string | false;     // selection
  compression_ratio: number;
  loss_pct: number;
  fuel_consumption: number;
  oil_temp: number;
  oil_pressure: number;
  start_datetime: string | false;
  end_datetime: string | false;
  recorded_at: string | false;
  synced_at: string | false;
  state: string | false;
  create_date: string;
  write_date: string;
  user_id: M2O;
  attachment_count: number;
}

export interface OdooPfPressingStaff {
  id: number;
  pressing_id: M2O;
  name: string;
  role: string | false;            // selection
}

export interface OdooPfShipping {
  id: number;
  name: string;                    // Reference e.g. "TRF-001"
  client_ref: string | false;
  commodity: string | false;       // selection
  bale_count: number;
  gross_weight: number;
  tare_weight: number;
  net_weight: number;
  plate_number: string | false;
  driver_name: string | false;
  driver_phone: string | false;
  departure_datetime: string | false;
  eta_datetime: string | false;
  freight_cost: number;
  state: string | false;           // selection
  source_batches: string | false;  // char (Source Press Batch IDs)
  recorded_at: string | false;
  synced_at: string | false;
  create_date: string;
  write_date: string;
  user_id: M2O;
  attachment_count: number;
  // NOTE: No origin_site_id or destination_site_id fields on this model
  // NOTE: No notes field on this model
}

export interface OdooPfAttachment {
  id: number;
  client_ref: string | false;
  res_model: string;
  res_id: number;
  photo_type: string | false;
  photo_label: string | false;
  file_name: string | false;
  file_size: number;
  mime_type: string | false;
  // We don't fetch file_data (binary) — too large
  uploaded_at: string | false;
  create_date: string;
}

// ─── Fetch Functions (read-only) ────────────────────────────────────────────

/**
 * Fetch all active operational sites.
 */
export async function fetchSites(): Promise<OdooPfSite[]> {
  return executeKw<OdooPfSite[]>(
    "pf.site",
    "search_read",
    [[["active", "=", true]]],
    { fields: ["id", "name", "code", "active"] }
  );
}

/**
 * Fetch procurement records with optional filters.
 */
export async function fetchProcurements(
  siteId?: number,
  limit = 100,
  companyId?: number,
  offset = 0,
): Promise<OdooPfProcurement[]> {
  const domain: any[] = [];
  if (siteId) domain.push(["site_id", "=", siteId]);
  // Note: pf.procurement does not have company_id field — company filtering not supported

  return executeKw<OdooPfProcurement[]>(
    "pf.procurement",
    "search_read",
    [domain],
    {
      fields: [
        "id", "name", "client_ref", "site_id", "supplier", "commodity",
        "grade", "plate_number", "driver_name",
        "gross_weight", "tare_weight", "net_weight",
        "bale_count", "avg_bale_weight", "price_per_ton", "currency", "incoterm",
        "truck_included", "truck_payer", "truck_cost", "bale_size",
        "state", "notes", "recorded_at", "synced_at",
        "create_date", "write_date", "user_id", "create_uid", "attachment_count",
        "x_studio_linked_po", "x_studio_linked_po_id", "x_linked_receipt", "x_linked_receipt_id",
      ],
      limit,
      offset,
      order: "create_date desc",
    }
  );
}

/**
 * Fetch quality assessment records with optional filters.
 */
export async function fetchQualityRecords(
  siteId?: number,
  sourceType?: string,
  limit = 100,
  companyId?: number,
  offset = 0,
): Promise<OdooPfQuality[]> {
  const domain: any[] = [];
  if (siteId) domain.push(["site_id", "=", siteId]);
  if (sourceType) domain.push(["qc_type", "=", sourceType]);
  // Note: pf.quality does not have company_id field — company filtering not supported

  return executeKw<OdooPfQuality[]>(
    "pf.quality",
    "search_read",
    [domain],
    {
      fields: [
        "id", "name", "client_ref", "qc_type", "procurement_id", "pressing_id",
        "site_id", "user_id",
        "color", "leaf_ratio", "foreign_matter", "odor",
        "moisture", "moisture_weight_pct", "protein_nir",
        "density", "avg_bale_weight", "bale_height",
        "bale_shape", "bale_ties", "bale_code",
        "truck_clean", "has_cover", "strap_good", "stack_good",
        "no_weeds", "no_insects", "no_black_wood",
        "verdict", "final_grade",
        "g1_bale_count", "g2_bale_count", "mix_bale_count",
        "qc_notes", "recorded_at", "synced_at", "state",
        "create_date", "write_date", "attachment_count",
      ],
      limit,
      offset,
      order: "create_date desc",
    }
  );
}

/**
 * Fetch pressing shift records with optional filters.
 */
export async function fetchPressingRecords(
  siteId?: number,
  limit = 100,
  companyId?: number,
  offset = 0,
): Promise<OdooPfPressing[]> {
  const domain: any[] = [];
  if (siteId) domain.push(["site_id", "=", siteId]);
  // Note: pf.pressing does not have company_id field — company filtering not supported

  return executeKw<OdooPfPressing[]>(
    "pf.pressing",
    "search_read",
    [domain],
    {
      fields: [
        "id", "name", "client_ref", "site_id", "press_line", "shift", "operator",
        "commodity", "in_bale_count", "in_bale_size", "in_grade", "in_total_weight",
        "out_bale_count", "out_total_weight", "out_density",
        "compression_ratio", "loss_pct", "fuel_consumption", "oil_temp", "oil_pressure",
        "start_datetime", "end_datetime",
        "recorded_at", "synced_at", "state",
        "create_date", "write_date", "user_id", "attachment_count",
        "x_studio_linked_mo", "x_studio_linked_mo_id",
      ],
      limit,
      offset,
      order: "create_date desc",
    }
  );
}

/**
 * Fetch pressing staff for given pressing IDs.
 */
export async function fetchPressingStaff(
  pressingIds: number[],
): Promise<OdooPfPressingStaff[]> {
  if (pressingIds.length === 0) return [];
  return executeKw<OdooPfPressingStaff[]>(
    "pf.pressing.staff",
    "search_read",
    [[["pressing_id", "in", pressingIds]]],
    { fields: ["id", "pressing_id", "name", "role"] }
  );
}

/**
 * Fetch shipping (internal transfer) records with optional filters.
 */
export async function fetchShippingRecords(
  limit = 100,
  companyId?: number,
  offset = 0,
): Promise<OdooPfShipping[]> {
  const domain: any[] = [];
  // Note: pf.shipping does not have company_id field — company filtering not supported
  return executeKw<OdooPfShipping[]>(
    "pf.shipping",
    "search_read",
    [domain],
    {
      fields: [
        "id", "name", "client_ref", "commodity",
        "bale_count", "gross_weight", "tare_weight", "net_weight",
        "plate_number", "driver_name", "driver_phone",
        "departure_datetime", "eta_datetime", "freight_cost",
        "state", "source_batches",
        "recorded_at", "synced_at",
        "create_date", "write_date", "user_id", "attachment_count",
      ],
      limit,
      offset,
      order: "create_date desc",
    }
  );
}

/**
 * Fetch attachments for a given model and record IDs.
 * Does NOT fetch file_data to avoid large payloads.
 */
export async function fetchAttachments(
  resModel: string,
  resIds: number[],
): Promise<OdooPfAttachment[]> {
  if (resIds.length === 0) return [];

  // Try using the specific FK field first, fall back to res_model/res_id
  const fkField = resModel === "pf.procurement" ? "procurement_id"
    : resModel === "pf.quality" ? "quality_id"
    : resModel === "pf.pressing" ? "pressing_id"
    : resModel === "pf.shipping" ? "shipping_id"
    : null;

  const domain = fkField
    ? [[fkField, "in", resIds]]
    : [["res_model", "=", resModel], ["res_id", "in", resIds]];

  return executeKw<OdooPfAttachment[]>(
    "pf.attachment",
    "search_read",
    [domain],
    {
      fields: [
        "id", "client_ref", "res_model", "res_id",
        "photo_type", "photo_label", "file_name", "file_size", "mime_type",
        "uploaded_at", "create_date", "ir_attachment_id",
        ...(fkField ? [fkField] : []),
      ],
    }
  );
}

/**
 * Get total record counts for dashboard summary.
 */
export async function fetchRecordCounts(): Promise<{
  procurements: number;
  quality: number;
  pressing: number;
  shipping: number;
}> {
  const [procurements, quality, pressing, shipping] = await Promise.all([
    executeKw<number>("pf.procurement", "search_count", [[]]),
    executeKw<number>("pf.quality", "search_count", [[]]),
    executeKw<number>("pf.pressing", "search_count", [[]]),
    executeKw<number>("pf.shipping", "search_count", [[]]),
  ]);
  return { procurements, quality, pressing, shipping };
}
