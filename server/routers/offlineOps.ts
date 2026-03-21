/**
 * Offline Operations tRPC Router
 *
 * Provides procedures to fetch data from the Odoo platfarm_field_ops module:
 * - Procurement (receiving) records
 * - Quality assessment records
 * - Pressing shift records (with staff)
 * - Shipping (internal transfer) records
 * - Operational sites
 * - Attachment metadata
 * - Dashboard summary counts
 *
 * Field names verified via fields_get introspection on 2026-03-16.
 */

import { createManufacturingOrder, fetchManufacturingOrderById } from "../odoo-production";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  fetchSites,
  fetchProcurements,
  fetchQualityRecords,
  fetchPressingRecords,
  fetchPressingStaff,
  fetchShippingRecords,
  fetchAttachments,
  fetchRecordCounts,
} from "../odoo-offline-ops";
import { executeKw, createInternalTransfer, validateInternalTransfer, searchTransferProducts, fetchStockLocations, fetchWarehouses, fetchProductStockByLocation, fetchAllStockAtLocation } from "../odoo";

// ─── Helper: format Odoo date string to display format ──────────────────────
function formatDate(odooDate: string | false): string {
  if (!odooDate) return "";
  try {
    const d = new Date(odooDate);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return String(odooDate);
  }
}

function formatTime(odooDatetime: string | false): string {
  if (!odooDatetime) return "";
  try {
    const d = new Date(odooDatetime);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

function m2oName(val: [number, string] | false): string {
  return val ? val[1] : "";
}

// ─── Role label mapping for staff ───────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  driver: "🚛 Drivers",
  baling_supervisor: "👔 Baling Supervisors",
  quality_supervisor: "🔍 Quality Supervisors",
  baling_labor: "⚙ Baling Labors",
  quality_labor: "👷 Quality Labors",
  loading_crew: "👷 Loading Crew",
  receiving_crew: "📦 Receiving Crew",
};

// ─── Transform functions: Odoo → Frontend shape ─────────────────────────────

function transformProcurement(r: any, attachments: any[]): any {
  // Match attachments by procurement_id FK or res_model/res_id
  const recAttachments = attachments
    .filter((a: any) => {
      if (a.procurement_id) return a.procurement_id[0] === r.id;
      return a.res_model === "pf.procurement" && a.res_id === r.id;
    })
    .map((a: any) => ({
      n: a.photo_label || a.file_name || "Attachment",
      t: a.photo_type === "photo" || (a.file_name || "").match(/\.(jpg|jpeg|png|webp)$/i) ? "photo" : "doc",
      s: "✓",
      irAttId: a.ir_attachment_id ? a.ir_attachment_id[0] : null,
    }));

  // Determine sync status from state/synced_at
  const syncStatus = r.synced_at ? "synced" : (r.state === "draft" ? "pending" : "synced");

  return {
    id: (r.name && r.name !== "New") ? r.name : `RCV-${String(r.id).padStart(4, "0")}`,
    odooId: r.id,
    supplier: r.supplier || "",
    commodity: r.commodity || "",
    grade: r.grade || "",
    site: m2oName(r.site_id),
    plate: r.plate_number || "",
    stage: r.state || "draft",
    qcRef: "",  // Will be linked via quality source_ref
    driver: r.driver_name || "",
    linkedPoName: r.x_studio_linked_po || "",
    linkedPoId: r.x_studio_linked_po_id || 0,
    linkedReceipt: r.x_linked_receipt || "",
    linkedReceiptId: r.x_linked_receipt_id || 0,
    gross: r.gross_weight || 0,
    tare: r.tare_weight || 0,
    net: r.net_weight || 0,
    bales: r.bale_count || 0,
    avgBale: r.avg_bale_weight || 0,
    price: r.price_per_ton || 0,
    currency: r.currency || "EGP",
    incoterm: r.incoterm || "",
    truckInc: r.truck_included ? "Yes" : "No",
    truckPayer: r.truck_payer || "—",
    truckCost: r.truck_cost || 0,
    date: formatDate(r.recorded_at || r.create_date),
    time: formatTime(r.recorded_at || r.create_date),
    sync: syncStatus,
    baleSize: r.bale_size || "",
    notes: r.notes || "",
    createdBy: r.create_uid ? (Array.isArray(r.create_uid) ? r.create_uid[1] : String(r.create_uid)) : "",
    procurementOfficer: r.user_id ? (Array.isArray(r.user_id) ? r.user_id[1] : String(r.user_id)) : "",
    att: recAttachments,
  };
}

function transformQuality(r: any, attachments: any[]): any {
  const recAttachments = attachments
    .filter((a: any) => {
      if (a.quality_id) return a.quality_id[0] === r.id;
      return a.res_model === "pf.quality" && a.res_id === r.id;
    })
    .map((a: any) => ({
      n: a.photo_label || a.file_name || "Attachment",
      t: a.photo_type === "photo" || (a.file_name || "").match(/\.(jpg|jpeg|png|webp)$/i) ? "photo" : "doc",
      s: "✓",
      irAttId: a.ir_attachment_id ? a.ir_attachment_id[0] : null,
    }));

  const syncStatus = r.synced_at ? "synced" : (r.state === "draft" ? "pending" : "synced");
  const isPressed = r.qc_type === "pressed" || !!r.pressing_id;
  const ref = isPressed
    ? (r.pressing_id ? m2oName(r.pressing_id) : "")
    : (r.procurement_id ? m2oName(r.procurement_id) : "");

  return {
    id: r.name || `QC-${String(r.id).padStart(4, "0")}`,
    odooId: r.id,
    type: r.qc_type || "received",
    ref: ref,
    supplier: r.supplier || "",
    commodity: r.commodity || "",
    grade: r.grade || "",
    site: m2oName(r.site_id),
    inspector: m2oName(r.user_id),
    bales: r.bale_count || 0,
    netWeight: r.net_weight || 0,
    pressLine: r.press_line || "",
    batch: r.batch_name || "",
    outWeight: r.out_weight || 0,
    color: r.color || "",
    leafRatio: r.leaf_ratio || "",
    foreignMatter: r.foreign_matter || "",
    odor: r.odor || "",
    moisture: r.moisture ? `${r.moisture}%` : "",
    moistureWeight: r.moisture_weight_pct ? `${r.moisture_weight_pct}%` : "",
    protein: r.protein_nir ? `${r.protein_nir}%` : "",
    density: r.density || "",
    avgWeight: r.avg_bale_weight || 0,
    baleHeight: r.bale_height || 0,
    baleShape: r.bale_shape || "",
    baleTies: r.bale_ties || "",
    baleCode: r.bale_code || "",
    truckClean: r.truck_clean || "",
    hasCover: r.has_cover || "",
    strapGood: r.strap_good || "",
    stackGood: r.stack_good || "",
    noWeeds: r.no_weeds || "",
    noInsects: r.no_insects || "",
    noBlackWood: r.no_black_wood || "",
    verdict: r.verdict || "",
    finalGrade: r.final_grade || "",
    g1: r.g1_bale_count || 0,
    g2: r.g2_bale_count || 0,
    mix: r.mix_bale_count || 0,
    notes: r.qc_notes || "",
    date: formatDate(r.recorded_at || r.create_date),
    sync: syncStatus,
    att: recAttachments,
  };
}

function transformPressing(r: any, staffByPressing: Map<number, any[]>, attachments: any[]): any {
  const recAttachments = attachments
    .filter((a: any) => {
      if (a.pressing_id) return a.pressing_id[0] === r.id;
      return a.res_model === "pf.pressing" && a.res_id === r.id;
    })
    .map((a: any) => ({
      n: a.photo_label || a.file_name || "Attachment",
      t: a.photo_type === "photo" || (a.file_name || "").match(/\.(jpg|jpeg|png|webp)$/i) ? "photo" : "doc",
      s: "✓",
      irAttId: a.ir_attachment_id ? a.ir_attachment_id[0] : null,
    }));

  // Group staff by role
  const staffList = staffByPressing.get(r.id) || [];
  const crewByRole = new Map<string, string[]>();
  for (const s of staffList) {
    const roleKey = s.role || "other";
    const label = ROLE_LABELS[roleKey] || roleKey;
    if (!crewByRole.has(label)) crewByRole.set(label, []);
    crewByRole.get(label)!.push(s.name);
  }
  const crew = Array.from(crewByRole.entries()).map(([role, ppl]) => ({ role, ppl }));

  const syncStatus = r.synced_at ? "synced" : (r.state === "draft" ? "pending" : "synced");

  return {
    id: r.name || `DPR-${String(r.id).padStart(4, "0")}`,
    odooId: r.id,
    site: m2oName(r.site_id),
    line: r.press_line || "",
    batch: r.batch_name || "",
    shift: r.shift || "",
    operator: r.operator || "",
    commodity: r.commodity || "",
    linkedMoName: r.x_studio_linked_mo || "",
    linkedMoId: r.x_studio_linked_mo_id || 0,
    inBales: r.in_bale_count || 0,
    inWeight: r.in_total_weight || 0,
    inGrade: r.in_grade || "",
    outBales: r.out_bale_count || 0,
    outWeight: r.out_total_weight || 0,
    outAvgBale: r.out_bale_count ? Math.round((r.out_total_weight || 0) / r.out_bale_count) : 0,
    density: r.out_density || "",
    fuel: r.fuel_consumption || 0,
    oilTemp: r.oil_temp ? `${r.oil_temp}\u00b0C` : "",
    oilPressure: r.oil_pressure ? `${r.oil_pressure} bar` : "",
    startTime: formatTime(r.start_datetime),
    endTime: formatTime(r.end_datetime),
    sources: r.source_procurement || "",
    date: formatDate(r.recorded_at || r.create_date),
    sync: syncStatus,
    crew,
    att: recAttachments,
  };
}

function transformShipping(r: any, attachments: any[]): any {
  const recAttachments = attachments
    .filter((a: any) => {
      if (a.shipping_id) return a.shipping_id[0] === r.id;
      return a.res_model === "pf.shipping" && a.res_id === r.id;
    })
    .map((a: any) => ({
      n: a.photo_label || a.file_name || "Attachment",
      t: a.photo_type === "photo" || (a.file_name || "").match(/\.(jpg|jpeg|png|webp)$/i) ? "photo" : "doc",
      pt: a.photo_type || "",
      s: "✓",
      irAttId: a.ir_attachment_id ? a.ir_attachment_id[0] : null,
    }));

  const syncStatus = r.synced_at ? "synced" : (r.state === "draft" ? "pending" : "synced");

  // pf.shipping has no origin_site_id/destination_site_id — transfers are always Dakhla→Sokhna
  return {
    id: (r.name && r.name !== "New") ? r.name : `SHP-${String(r.id).padStart(4, "0")}`,
    odooId: r.id,
    from: "Dakhla Farm",      // Hardcoded — model has no site fields
    to: "Ain Sokhna",         // Hardcoded — model has no site fields
    commodity: r.commodity || "",
    grade: "",                 // No grade field on pf.shipping
    press: "SP",              // Default
    bales: r.bale_count || 0,
    weight: r.net_weight || r.gross_weight || 0,
    tare: r.tare_weight || 0,
    plate: r.plate_number || "",
    crew: r.driver_name ? [{ role: "🚛 Driver", ppl: [r.driver_name] }] : [],  // Populate from driver_name
    truck: "",                 // No truck type field
    phone: r.driver_phone || "",
    sources: r.source_batches || "",
    freight: r.freight_cost || 0,
    loadDate: formatDate(r.departure_datetime || r.recorded_at || r.create_date),
    loadTime: formatTime(r.departure_datetime || r.recorded_at || r.create_date),
    eta: r.eta_datetime ? `${formatDate(r.eta_datetime)} ${formatTime(r.eta_datetime)}` : "",
    arrDate: "",               // No arrival date field
    arrTime: "",               // No arrival time field
    condition: "",             // No condition field
    status: (() => {
      const st = r.state || "draft";
      if (st === "draft") {
        const hasArrival = recAttachments.some((a: any) => ["arrival","bale_condition","bale_cross_section","moisture_reading","nir_reading"].includes(a.pt));
        if (hasArrival) return "received";
      }
      return st === "draft" ? "in_transit" : st;
    })(),
    sync: syncStatus,
    distance: "780 km",        // Default Dakhla→Sokhna distance
    notes: "",                 // No notes field on pf.shipping
    seal: r.client_ref || "",  // Use client_ref as seal number
    rcvWeight: 0,              // No received weight field
    diff: 0,                   // No weight difference field
    date: formatDate(r.recorded_at || r.create_date),
    att: recAttachments,
  };
}

// ─── Router ─────────────────────────────────────────────────────────────────

export const offlineOpsRouter = router({
  /**
   * Fetch operational sites.
   */
  sites: publicProcedure.query(async () => {
    return fetchSites();
  }),

  attachmentImage: publicProcedure
    .input(z.object({ irAttachmentId: z.number() }))
    .query(async ({ input }) => {
      const { irAttachmentId } = input;
      const records = await executeKw<{ id: number; datas: string | false; mimetype: string; name: string }[]>(
        "ir.attachment", "read", [[irAttachmentId]],
        { fields: ["datas", "mimetype", "name"] }
      );
      if (!records?.length || !records[0].datas) return { data: null, mimetype: "image/jpeg", name: "" };
      return { data: records[0].datas, mimetype: records[0].mimetype, name: records[0].name };
    }),

  /**
   * Fetch dashboard summary counts.
   */
  summary: publicProcedure.query(async () => {
    return fetchRecordCounts();
  }),

  /**
   * Fetch all offline operations data in one call (for the dashboard).
   * Returns transformed data matching the frontend's expected shape.
   */
  allData: publicProcedure
    .input(
      z.object({
        siteId: z.number().optional(),
        companyId: z.number().optional(),
        limit: z.number().default(200),
      }).optional()
    )
    .query(async ({ input }) => {
      const siteId = input?.siteId;
      const companyId = input?.companyId;
      const limit = input?.limit ?? 200;

      // Fetch all four record types in parallel
      const [rawProcurements, rawQuality, rawPressing, rawShipping] = await Promise.all([
        fetchProcurements(siteId, limit, companyId),
        fetchQualityRecords(siteId, undefined, limit, companyId),
        fetchPressingRecords(siteId, limit, companyId),
        fetchShippingRecords(limit, companyId),
      ]);

      // Fetch staff for pressing records (shipping has no staff model)
      const pressingIds = rawPressing.map((r) => r.id);
      const pressingStaff = await fetchPressingStaff(pressingIds);

      // Group staff by parent record
      const staffByPressing = new Map<number, any[]>();
      for (const s of pressingStaff) {
        const pid = s.pressing_id ? s.pressing_id[0] : 0;
        if (!staffByPressing.has(pid)) staffByPressing.set(pid, []);
        staffByPressing.get(pid)!.push(s);
      }

      // Fetch attachments for all records in parallel
      const [procAttachments, qcAttachments, pressAttachments, shipAttachments] = await Promise.all([
        fetchAttachments("pf.procurement", rawProcurements.map((r) => r.id)),
        fetchAttachments("pf.quality", rawQuality.map((r) => r.id)),
        fetchAttachments("pf.pressing", rawPressing.map((r) => r.id)),
        fetchAttachments("pf.shipping", rawShipping.map((r) => r.id)),
      ]);

      // Link QC refs AND full QC data to procurement records via procurement_id
      const qcByProcId = new Map<number, string>();
      const qcDataByProcId = new Map<number, any>();
      for (const q of rawQuality) {
        if (q.procurement_id) {
          const procId = Array.isArray(q.procurement_id) ? q.procurement_id[0] : q.procurement_id;
          if (q.name) qcByProcId.set(procId, q.name);
          // Store full transformed QC data for pre-filling the shipment wizard
          qcDataByProcId.set(procId, transformQuality(q, qcAttachments));
        }
      }

      // Transform to frontend shape
      const RCV = rawProcurements.map((r) => {
        const transformed = transformProcurement(r, procAttachments);
        // Link QC reference if available
        const qcRef = qcByProcId.get(r.id);
        if (qcRef) transformed.qcRef = qcRef;
        // Attach full QC data for shipment wizard pre-fill
        const qcData = qcDataByProcId.get(r.id);
        if (qcData) transformed.qcData = qcData;
        return transformed;
      });
      const QC = rawQuality.map((r) => transformQuality(r, qcAttachments));
      const DPR = rawPressing.map((r) => transformPressing(r, staffByPressing, pressAttachments));
      // Match pf.quality (qc_type=received) to shipping records by exclusive 1:1 timestamp proximity
      const receivedQCs = rawQuality.filter(q => q.qc_type === "received");

      // Build all candidate pairs: (shipIdx, qcIdx, delta)
      // Allow ANY shipment (including draft) to match a QC — QC presence at destination IS proof of receiving
      // Exclusive 1:1 matching prevents false positives
      const trfTransformed = rawShipping.map((r) => transformShipping(r, shipAttachments));
      const candidates: { si: number; qi: number; delta: number }[] = [];
      for (let si = 0; si < rawShipping.length; si++) {
        const r = rawShipping[si];
        const shipTime = r.recorded_at ? new Date(r.recorded_at + "Z").getTime() : 0;
        if (!shipTime) continue;
        for (let qi = 0; qi < receivedQCs.length; qi++) {
          const qcTime = receivedQCs[qi].recorded_at ? new Date(receivedQCs[qi].recorded_at + "Z").getTime() : 0;
          const delta = Math.abs(qcTime - shipTime);
          if (delta < 2 * 3600 * 1000) candidates.push({ si, qi, delta });
        }
      }
      // Sort by delta (closest first), assign exclusively
      candidates.sort((a, b) => a.delta - b.delta);
      const usedQC = new Set<number>();
      const usedShip = new Set<number>();
      const qcMatch = new Map<number, any>(); // shipIdx -> QC record
      for (const c of candidates) {
        if (usedQC.has(c.qi) || usedShip.has(c.si)) continue;
        usedQC.add(c.qi);
        usedShip.add(c.si);
        qcMatch.set(c.si, receivedQCs[c.qi]);
      }

      // Apply matches and auto-fix states
      const TRF = rawShipping.map((r, si) => {
        const trfRec = trfTransformed[si];
        const isReceived = r.state === "received" || r.state === "assessed";
        const hasArrivalPhotos = trfRec.att?.some((a: any) => ["arrival","bale_condition","bale_cross_section","moisture_reading","nir_reading"].includes(a.pt));
        const bestQC = qcMatch.get(si) || null;

        if (!isReceived && (hasArrivalPhotos || bestQC)) {
          trfRec.status = "received";
          executeKw("pf.shipping", "write", [[r.id], { state: "received" }]).catch((e: any) =>
            console.error(`[autofix] Failed to update pf.shipping ${r.id} state: ${e.message}`)
          );
        }
        if (bestQC) {
          trfRec.qcData = {
            id: bestQC.id,
            name: bestQC.name || "",
            verdict: bestQC.verdict || "",
            grade: bestQC.final_grade || "",
            moisture: bestQC.moisture || 0,
            protein: bestQC.protein_nir || 0,
            color: bestQC.color || "",
            odor: bestQC.odor || "",
            leafRatio: bestQC.leaf_ratio || "",
            density: bestQC.density || "",
            baleShape: bestQC.bale_shape || "",
            baleTies: bestQC.bale_ties || "",
            foreignMatter: bestQC.foreign_matter || "",
            noWeeds: bestQC.no_weeds || "",
            noInsects: bestQC.no_insects || "",
            noBlackWood: bestQC.no_black_wood || "",
            truckClean: bestQC.truck_clean || "",
            hasCover: bestQC.has_cover || "",
            stackGood: bestQC.stack_good || "",
            strapGood: bestQC.strap_good || "",
            avgBaleWeight: bestQC.avg_bale_weight || 0,
            baleHeight: bestQC.bale_height || 0,
            g1: bestQC.g1_bale_count || 0,
            g2: bestQC.g2_bale_count || 0,
            mix: bestQC.mix_bale_count || 0,
            inspector: bestQC.user_id ? bestQC.user_id[1] : "",
            recordedAt: bestQC.recorded_at || "",
          };
          // Also attach QC photos
          const qcPhotos = qcAttachments
            .filter((a: any) => {
              if (a.quality_id) return a.quality_id[0] === bestQC.id;
              return a.res_model === "pf.quality" && a.res_id === bestQC.id;
            })
            .map((a: any) => ({
              n: a.photo_label || a.file_name || "QC Photo",
              t: "photo",
              pt: a.photo_type || "",
              s: "✓",
              irAttId: a.ir_attachment_id ? a.ir_attachment_id[0] : null,
            }));
          if (qcPhotos.length > 0) {
            trfRec.att = [...(trfRec.att || []), ...qcPhotos];
          }
        }
        return trfRec;
      });

      return { RCV, QC, DPR, TRF };
    }),

  /**
   * After creating a PO from a procurement record, write the PO name back
   * to pf.procurement.notes so the record is marked as converted.
   * Also stores the PO ID for the badge display.
   */
  linkProcurementToPO: publicProcedure
    .input(
      z.object({
        procurementOdooId: z.number(),
        poId: z.number(),
        poName: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { procurementOdooId, poId, poName } = input;

      // ── Fetch receipt (stock.picking) references from the PO ──
      let receiptNames: string[] = [];
      let receiptIds: number[] = [];
      try {
        const poRecords = await executeKw<{ id: number; picking_ids: number[] }[]>(
          "purchase.order", "read", [[poId]], { fields: ["picking_ids"] }
        );
        const pickingIds = poRecords?.[0]?.picking_ids || [];
        if (pickingIds.length > 0) {
          const pickings = await executeKw<{ id: number; name: string }[]>(
            "stock.picking", "read", [pickingIds], { fields: ["id", "name"] }
          );
          receiptNames = pickings.map(p => p.name);
          receiptIds = pickings.map(p => p.id);
        }
      } catch (err: any) {
        console.error(`[linkProcurementToPO] Failed to fetch receipts for PO ${poId}: ${err.message}`);
      }

      // Write dedicated linked PO fields on pf.procurement (no notes)
        const writeVals: Record<string, unknown> = {
          x_studio_linked_po: poName,
          x_studio_linked_po_id: poId,
        };
        if (receiptNames.length > 0) {
          writeVals.x_linked_receipt = receiptNames.join(", ");
          writeVals.x_linked_receipt_id = receiptIds[0];
        }
        await executeKw(
          "pf.procurement",
          "write",
          [[procurementOdooId], writeVals]
        );

        // Write procurement reference on purchase.order (dedicated fields)
        const procRecords = await executeKw<any[]>(
          "pf.procurement", "read", [[procurementOdooId]],
          { fields: ["name", "supplier", "commodity", "grade", "net_weight", "price_per_ton", "bale_count", "plate_number"] }
        );
        const procRec = procRecords?.[0];
        if (procRec) {
          const procSummary = [
            "Procurement Reference: " + (procRec.name || "N/A"),
            "Supplier: " + (procRec.supplier || "N/A"),
            "Commodity: " + (procRec.commodity || "N/A"),
            "Grade: " + (procRec.grade || "N/A"),
            "Net Weight: " + (procRec.net_weight || "N/A"),
            "Price/ton: " + (procRec.price_per_ton || "N/A"),
            "Bales: " + (procRec.bale_count || "N/A"),
            "Truck Plate: " + (procRec.plate_number || "N/A"),
          ].join(" | ");
          const poWriteVals: Record<string, unknown> = {
            x_studio_procurement_ref: procRec.name || "",
            x_studio_procurement_data: procSummary,
            x_studio_procurement_id: procurementOdooId,
          };
          if (procRec.user_id) {
            const userId = Array.isArray(procRec.user_id) ? procRec.user_id[0] : procRec.user_id;
            if (userId) {
              try {
                const hrRecs = await executeKw<any[]>("hr.employee", "search_read",
                  [[["user_id", "=", userId]]], { fields: ["id"], limit: 1 });
                if (hrRecs.length > 0) poWriteVals.x_studio_procurement_officer = hrRecs[0].id;
              } catch (_e) { /* ignore if employee not found */ }
            }
          }
          await executeKw("purchase.order", "write", [[poId], poWriteVals]);
        }

              // ── Push procurement data + attachments to the receipt ──
      if (receiptIds.length > 0) {
        const firstReceiptId = receiptIds[0];
        try {
          // Read procurement fields to push to receipt
          const procData = await executeKw<any[]>(
            "pf.procurement", "read", [[procurementOdooId]],
            { fields: [
              "supplier", "commodity", "grade", "driver_name", "plate_number",
              "gross_weight", "tare_weight", "net_weight", "bale_count", "avg_bale_weight",
              "price_per_ton", "currency", "incoterm", "bale_size", "notes",
              "recorded_at", "site_id", "user_id",
              "truck_cost", "truck_payer", "truck_included",
            ]}
          );
          if (procData?.[0]) {
            const p = procData[0];
            const receiptVals: Record<string, unknown> = {};
            if (p.driver_name) receiptVals.x_studio_driver_name = p.driver_name;
            if (p.plate_number) receiptVals.x_studio_truck_load_serial_tl = p.plate_number;
            if (p.gross_weight) receiptVals.x_studio_gross_weight_in_tons = p.gross_weight / 1000;
            if (p.tare_weight) receiptVals.x_studio_tare_weight_in_tons = p.tare_weight / 1000;
            const net = p.net_weight || ((p.gross_weight || 0) - (p.tare_weight || 0));
            if (net > 0) receiptVals.x_studio_net_weight_in_tons = net / 1000;
            if (p.bale_count) receiptVals.x_studio_total_number_of_received_bales = String(p.bale_count);
            if (p.bale_count) receiptVals.x_studio_bales = String(p.bale_count);
            if (p.bale_count) receiptVals.x_studio_number_of_balesbags = String(p.bale_count);
            if (p.price_per_ton) receiptVals.x_studio_agreed_product_price_per_unit = p.price_per_ton;
            const gradeMap: Record<string, string> = { premium: 'Premium', supreme: 'Supreme', grade_1: 'Grade 1', grade_2: 'Grade 2', grade_3: 'Grade 3', standard: 'Standard', brown: 'Brown' };
            if (p.grade) receiptVals.x_studio_loaded_grade = gradeMap[p.grade] || p.grade;
            const siteName = Array.isArray(p.site_id) ? p.site_id[1] : (p.site_id ? String(p.site_id) : '');
            if (siteName) { receiptVals.x_studio_source = siteName; receiptVals.x_studio_farmfield_name = siteName; }
            if (p.recorded_at) receiptVals.x_studio_loading_datetime_1 = p.recorded_at;
            const currencyMap: Record<string, string> = { egp: 'EGP', aed: 'AED', usd: 'USD', eur: 'EUR', sdg: 'SDG' };
            if (p.currency) receiptVals.x_studio_currency = currencyMap[p.currency] || p.currency;
            if (p.truck_cost) receiptVals.x_studio_agreed_trucking_cost = p.truck_cost;
            if (p.avg_bale_weight) receiptVals.x_studio_gross_weight = String(p.avg_bale_weight);
            if (p.supplier) receiptVals.x_studio_farmfield_name = receiptVals.x_studio_farmfield_name || p.supplier;
            if (Object.keys(receiptVals).length > 0) {
              await executeKw("stock.picking", "write", [[firstReceiptId], receiptVals]);
            }
          }

          // Copy procurement attachments to receipt
          let procAtts = await executeKw<{
            id: number;
            ir_attachment_id: [number, string] | false;
            file_name: string | false;
            photo_label: string | false;
            photo_type: string | false;
          }[]>(
            "pf.attachment", "search_read",
            [[["procurement_id", "=", procurementOdooId]]],
            { fields: ["id", "ir_attachment_id", "file_name", "photo_label", "photo_type"] }
          );
          // Also check ir.attachment directly (mobile app links via res_model/res_id)
          if (procAtts.length === 0) {
            const irAtts = await executeKw<{ id: number; name: string; mimetype: string }[]>(
              "ir.attachment", "search_read",
              [[["res_model", "=", "pf.procurement"], ["res_id", "=", procurementOdooId]]],
              { fields: ["id", "name", "mimetype"] }
            );
            procAtts = irAtts.map(a => ({
              id: a.id,
              ir_attachment_id: [a.id, a.name] as [number, string],
              file_name: a.name,
              photo_label: a.name,
            }));
          }

          // Check existing attachments on receipt to avoid duplicates
          const existingAtts = await executeKw<{ id: number; name: string }[]>(
            "ir.attachment", "search_read",
            [[["res_model", "=", "stock.picking"], ["res_id", "=", firstReceiptId]]],
            { fields: ["id", "name"], limit: 200 }
          );
          const existingNames = new Set(existingAtts.map(a => a.name));

          for (const pfa of procAtts) {
            if (!pfa.ir_attachment_id) continue;
            const label = pfa.photo_label || pfa.file_name || pfa.ir_attachment_id[1] || "photo";
            const photoType = (pfa as any).photo_type || "";
            const RECEIVING_PHOTO_TYPES = new Set(["arrival", "ar", "bale_condition", "bc"]);
            const category = RECEIVING_PHOTO_TYPES.has(photoType) ? "Receiving" : "Procurement";
            const finalName = photoType ? `[${category}] ${photoType}_${label}` : `[Procurement] ${label}`;
            if (existingNames.has(finalName)) continue;
            try {
              const irAtt = await executeKw<any[]>(
                "ir.attachment", "read", [[pfa.ir_attachment_id[0]]],
                { fields: ["datas", "name", "mimetype"] }
              );
              if (irAtt?.[0]?.datas) {
                await executeKw("ir.attachment", "create", [{
                  name: finalName,
                  datas: irAtt[0].datas,
                  mimetype: irAtt[0].mimetype || "image/jpeg",
                  res_model: "stock.picking",
                  res_id: firstReceiptId,
                }]);
                existingNames.add(finalName);
              }
            } catch (e: any) {
              console.error(`[linkProcurementToPO] Failed to copy proc attachment ${pfa.id} to receipt: ${e.message}`);
            }
          }

          // ── Push QC data + attachments to the receipt ──
          const qcRecords = await executeKw<any[]>(
            "pf.quality", "search_read",
            [[["procurement_id", "=", procurementOdooId], ["qc_type", "=", "received"]]],
            { fields: [
              "id", "name", "verdict", "final_grade", "moisture", "color",
              "foreign_matter", "leaf_ratio", "bale_shape", "bale_ties",
              "no_insects", "no_weeds", "no_black_wood", "odor", "density",
              "avg_bale_weight", "g1_bale_count", "g2_bale_count", "mix_bale_count",
              "qc_notes", "recorded_at", "user_id",
              "protein_nir", "moisture_weight_pct",
              "stack_good", "strap_good", "has_cover", "truck_clean",
              "no_weeds", "odor", "density", "bale_height",
            ], limit: 1, order: "create_date desc" }
          );

          if (qcRecords.length > 0) {
            const qc = qcRecords[0];
            const qcVals: Record<string, unknown> = {};
            if (qc.final_grade) qcVals.x_studio_overall_received_grade_as_per_quality_assessment = qc.final_grade;
            if (qc.moisture) qcVals.x_studio_moisture_ = qc.moisture;
            if (qc.verdict === "accepted") qcVals.x_studio_accepted_rejected = true;
            if (qc.protein_nir) qcVals.x_studio_crude_protein_dry_matter_ = qc.protein_nir;
            if (qc.no_insects === "yes") qcVals.x_studio_good_quality_absence_of_insects = true;
            if (qc.foreign_matter === "none" || qc.foreign_matter === "clean") qcVals.x_studio_good_quality_absence_of_foreign_material = true;
            if (qc.no_black_wood === "yes") qcVals.x_studio_good_quality_absence_of_black_spots = true;
            if (qc.bale_ties === "good" || qc.bale_ties === "yes") qcVals.x_studio_good_quality_bale_ties = true;
            if (qc.leaf_ratio === "good" || qc.leaf_ratio === "high") qcVals.x_studio_good_quality_good_leave_attachement = true;
            if (qc.color === "green") qcVals.x_studio_good_quality_green_color = true;
            if (qc.bale_shape === "good" || qc.bale_shape === "yes") qcVals.x_studio_good_quality_uniformity_of_bale_shape = true;
            if (qc.has_cover === "yes") qcVals.x_studio_presence_of_truck_cover = true;
            if (qc.truck_clean === "yes") qcVals.x_studio_loadcontainer_cleanliness = true;
            if (qc.stack_good === "yes") qcVals.x_studio_proper_loadcontainer_stacking = true;
            if (qc.strap_good === "yes") qcVals.x_studio_proper_loadcontainer_lashing = true;
            if (qc.g1_bale_count) qcVals.x_studio_grade_1_ = qc.g1_bale_count;
            if (qc.g2_bale_count) qcVals.x_studio_grade_3_ = qc.g2_bale_count;
            if (qc.mix_bale_count) qcVals.x_studio_standard_ = qc.mix_bale_count;
            if (qc.no_weeds === "yes") qcVals.x_studio_good_quality_stem_size = true;
            if (qc.avg_bale_weight) qcVals.x_studio_quality_score = qc.avg_bale_weight;
            if (qc.moisture_weight_pct) {
              const balesAbove = Math.round(qc.moisture_weight_pct);
              qcVals.x_studio_bales_with_moisture_above_12 = String(balesAbove);
            }
            if (qc.verdict === "rejected") qcVals.x_studio_accepted_rejected = false;
            if (Object.keys(qcVals).length > 0) {
              await executeKw("stock.picking", "write", [[firstReceiptId], qcVals]);
            }

            // Copy QC attachments to receipt
            let qcAtts = await executeKw<{
              id: number;
              ir_attachment_id: [number, string] | false;
              file_name: string | false;
              photo_label: string | false;
              photo_type: string | false;
            }[]>(
              "pf.attachment", "search_read",
              [[["quality_id", "=", qc.id]]],
              { fields: ["id", "ir_attachment_id", "file_name", "photo_label", "photo_type"] }
            );
            if (qcAtts.length === 0) {
              const irQcAtts = await executeKw<{ id: number; name: string; mimetype: string }[]>(
                "ir.attachment", "search_read",
                [[["res_model", "=", "pf.quality"], ["res_id", "=", qc.id]]],
                { fields: ["id", "name", "mimetype"] }
              );
              qcAtts = irQcAtts.map(a => ({
                id: a.id,
                ir_attachment_id: [a.id, a.name] as [number, string],
                file_name: a.name,
                photo_label: a.name,
              }));
            }
            for (const qca of qcAtts) {
              if (!qca.ir_attachment_id) continue;
              const label = qca.photo_label || qca.file_name || qca.ir_attachment_id[1] || "QC_photo";
              const qcPhotoType = (qca as any).photo_type || "";
              const attName = qcPhotoType ? `[Quality] ${qcPhotoType}_${label}` : `[Quality] ${label}`;
              if (existingNames.has(attName)) continue;
              try {
                const irAtt = await executeKw<any[]>(
                  "ir.attachment", "read", [[qca.ir_attachment_id[0]]],
                  { fields: ["datas", "name", "mimetype"] }
                );
                if (irAtt?.[0]?.datas) {
                  await executeKw("ir.attachment", "create", [{
                    name: attName,
                    datas: irAtt[0].datas,
                    mimetype: irAtt[0].mimetype || "image/jpeg",
                    res_model: "stock.picking",
                    res_id: firstReceiptId,
                  }]);
                }
              } catch (e: any) {
                console.error(`[linkProcurementToPO] Failed to copy QC attachment ${qca.id} to receipt: ${e.message}`);
              }
            }
          }
        } catch (e: any) {
          console.error(`[linkProcurementToPO] Failed to push data to receipt ${firstReceiptId}: ${e.message}`);
        }
      }

      return {
        success: true,
        poName,
        poId,
        receiptNames,
        receiptIds,
      };

    }),

  uploadReceiptAttachment: publicProcedure
    .input(z.object({
      pickingId: z.number(),
      fileName: z.string(),
      base64Data: z.string(),
      mimetype: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ input }) => {
      await executeKw("ir.attachment", "create", [{
        name: input.fileName,
        datas: input.base64Data,
        mimetype: input.mimetype,
        res_model: "stock.picking",
        res_id: input.pickingId,
      }]);
      return { success: true };
    }),

  /**
   * Copy attachments from a pf.quality record to a purchase.order.
   * Reads pf.attachment records linked to the quality assessment and creates
   * new ir.attachment records linked to the PO, reusing the same binary data.
   */
  copyQualityAttachments: publicProcedure
    .input(
      z.object({
        qualityOdooId: z.number(),
        poId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const { qualityOdooId, poId } = input;

      // 1. Get pf.attachment records for this quality record
      const pfAttachments = await executeKw<{
        id: number;
        ir_attachment_id: [number, string] | false;
        file_name: string | false;
        photo_label: string | false;
        photo_type: string | false;
      }[]>(
        "pf.attachment",
        "search_read",
        [[["quality_id", "=", qualityOdooId]]],
        { fields: ["id", "ir_attachment_id", "file_name", "photo_label", "photo_type"] }
      );

      if (!pfAttachments.length) return { copied: 0 };

      let copied = 0;
      for (const pfa of pfAttachments) {
        if (!pfa.ir_attachment_id) continue;
        const irId = pfa.ir_attachment_id[0];
        try {
          const originals = await executeKw<{
            id: number;
            name: string;
            datas: string | false;
            mimetype: string;
          }[]>(
            "ir.attachment",
            "search_read",
            [[["id", "=", irId]]],
            { fields: ["id", "name", "datas", "mimetype"] }
          );
          if (!originals.length || !originals[0].datas) continue;
          const orig = originals[0];
          await executeKw(
            "ir.attachment",
            "create",
            [{
              name: `[QC] ${pfa.photo_label || pfa.file_name || orig.name}`,
              datas: orig.datas,
              mimetype: orig.mimetype,
              res_model: "purchase.order",
              res_id: poId,
              description: `Copied from quality assessment ${qualityOdooId} (pf.attachment #${pfa.id})`,
            }]
          );
          copied++;
        } catch (err: any) {
          console.error(`[copyQualityAttachments] Failed to copy attachment ${pfa.id}: ${err.message}`);
        }
      }

      return { copied };
    }),

  /**
   * Copy attachments from a pf.procurement record to a purchase.order.
   * Reads pf.attachment records linked to the procurement and creates
   * new ir.attachment records linked to the PO, reusing the same binary data.
   */
  copyProcurementAttachments: publicProcedure
    .input(
      z.object({
        procurementOdooId: z.number(),
        poId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const { procurementOdooId, poId } = input;

      // 1. Get pf.attachment records for this procurement
      const pfAttachments = await executeKw<{
        id: number;
        ir_attachment_id: [number, string] | false;
        file_name: string | false;
        photo_label: string | false;
        photo_type: string | false;
      }[]>(
        "pf.attachment",
        "search_read",
        [[["procurement_id", "=", procurementOdooId]]],
        { fields: ["id", "ir_attachment_id", "file_name", "photo_label", "photo_type"] }
      );

      if (!pfAttachments.length) return { copied: 0 };

      // 2. For each pf.attachment that has an ir.attachment, read the binary data
      //    and create a new ir.attachment linked to the PO
      let copied = 0;
      for (const pfa of pfAttachments) {
        if (!pfa.ir_attachment_id) continue;
        const irId = pfa.ir_attachment_id[0];
        try {
          // Read the original ir.attachment
          const originals = await executeKw<{
            id: number;
            name: string;
            datas: string | false;
            mimetype: string;
          }[]>(
            "ir.attachment",
            "search_read",
            [[["id", "=", irId]]],
            { fields: ["id", "name", "datas", "mimetype"] }
          );
          if (!originals.length || !originals[0].datas) continue;
          const orig = originals[0];
          // Create a new ir.attachment linked to the PO
          await executeKw(
            "ir.attachment",
            "create",
            [{
              name: pfa.photo_label || pfa.file_name || orig.name,
              datas: orig.datas,
              mimetype: orig.mimetype,
              res_model: "purchase.order",
              res_id: poId,
              description: `Copied from procurement ${procurementOdooId} (pf.attachment #${pfa.id})`,
            }]
          );
          copied++;
        } catch (err: any) {
          console.error(`[copyProcurementAttachments] Failed to copy attachment ${pfa.id}: ${err.message}`);
        }
      }

      return { copied };
    }),

  /**
   * After creating a Manufacturing Order from a press operation record,
   * write the MO name back to pf.pressing.notes so the record is marked as converted.
   * Also stores the MO ID for the badge display.
   */

    /**
     * Create a Manufacturing Order from a pressing shift record.
     * 1. Search for product by commodity name
     * 2. Find a matching BOM
     * 3. Create mrp.production
     * 4. Link back to pf.pressing
     * 5. Copy attachments
     */
    createPressingMO: publicProcedure
      .input(
        z.object({
          pressingOdooId: z.number(),
          pressingName: z.string(),
          commodity: z.string(),
          outWeight: z.number(),
          outBales: z.number().optional(),
          inWeight: z.number().optional(),
          inBales: z.number().optional(),
          inGrade: z.string().optional(),
          site: z.string().optional(),
          line: z.string().optional(),
          batch: z.string().optional(),
          operator: z.string().optional(),
          fuel: z.number().optional(),
          oilTemp: z.string().optional(),
          oilPressure: z.string().optional(),
          sources: z.string().optional(),
          productId: z.number().optional(),
          bomId: z.number().optional(),
          companyId: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        let productId = input.productId;
        let bomId = input.bomId;
        let productUomId: number | undefined;

        // Step 1: If no productId, search by commodity name
        if (!productId) {
          const commoditySearch = input.commodity.trim().toLowerCase();
          const products = await executeKw<{ id: number; name: string; uom_id: [number, string] }[]>(
            "product.product",
            "search_read",
            [[["name", "ilike", commoditySearch]]],
            { fields: ["id", "name", "uom_id"], limit: 5 }
          );
          if (products.length === 0) {
            throw new Error(`No product found matching "${input.commodity}". Please select a product manually.`);
          }
          productId = products[0].id;
          if (products[0].uom_id) productUomId = products[0].uom_id[0];
        }

        // Step 2: If no bomId, find a BOM for this product
        if (!bomId) {
          const boms = await executeKw<{ id: number; product_id: [number, string]; product_qty: number }[]>(
            "mrp.bom",
            "search_read",
            [[["product_id", "=", productId]]],
            { fields: ["id", "product_id", "product_qty"], limit: 1 }
          );
          if (boms.length > 0) bomId = boms[0].id;
        }

        // Step 3: Determine company from site
        let companyId = input.companyId;
        if (!companyId && input.site) {
          if (input.site.includes("Sokhna")) companyId = 4;
          else if (input.site.includes("Cairo")) companyId = 3;
          else if (input.site.includes("Abu Dhabi")) companyId = 2;
          else if (input.site.includes("Dakhla")) companyId = 3;
          else companyId = 3;
        }

        // Step 4: Build notes from pressing data
        const noteLines = [
          `Source: ${input.pressingName}`,
          input.batch ? `Batch: ${input.batch}` : null,
          input.line ? `Press Line: ${input.line}` : null,
          input.operator ? `Operator: ${input.operator}` : null,
          input.inWeight ? `Input: ${input.inWeight}kg (${input.inBales || 0} bales)` : null,
          `Output: ${input.outWeight}kg (${input.outBales || 0} bales)`,
          input.fuel ? `Fuel: ${input.fuel}L` : null,
          input.sources ? `Material Source: ${input.sources}` : null,
        ].filter(Boolean).join("\n");

        // Step 5: Create the MO via existing function
        const moVals: Record<string, unknown> = {
          product_id: productId,
          product_qty: input.outWeight || 1,
        };
        if (productUomId) moVals.product_uom_id = productUomId;
        if (bomId) moVals.bom_id = bomId;
        if (companyId) moVals.company_id = companyId;
        if (input.fuel) moVals.diesel_consumption_liters = input.fuel;
        if (input.inGrade) moVals.input_product_quality_grade = input.inGrade;
        if (input.sources) moVals.x_studio_input_material_source = input.sources;
        moVals.general_observations_notes = noteLines;

        const moId = await executeKw<number>("mrp.production", "create", [moVals]);

        // Fetch MO name
        let moName = `MO-${moId}`;
        try {
          const mos = await executeKw<{ id: number; name: string }[]>(
            "mrp.production",
            "search_read",
            [[["id", "=", moId]]],
            { fields: ["id", "name"], limit: 1 }
          );
          if (mos.length > 0 && mos[0].name) moName = mos[0].name;
        } catch {}

        // Step 6: Link MO back to pressing record
        try {
          const records = await executeKw<{ id: number; notes: string | false }[]>(
            "pf.pressing",
            "search_read",
            [[["id", "=", input.pressingOdooId]]],
            { fields: ["id", "notes"] }
          );
          const existing = records[0]?.notes || "";
          const tag = `[Converted to ${moName} | MO ID: ${moId}]`;
          const newNotes = existing ? `${existing}\n${tag}` : tag;
          await executeKw("pf.pressing", "write", [[[input.pressingOdooId], {
            notes: newNotes,
            x_studio_linked_mo: moName,
            x_studio_linked_mo_id: moId,
          }]]);
        } catch (err) {
          console.error("[createPressingMO] Link-back failed:", err);
        }

        // Step 7: Copy attachments
        try {
          const pfAttachments = await executeKw<{
            id: number;
            ir_attachment_id: [number, string] | false;
            file_name: string | false;
            photo_label: string | false;
          }[]>(
            "pf.attachment",
            "search_read",
            [[["pressing_id", "=", input.pressingOdooId]]],
            { fields: ["id", "ir_attachment_id", "file_name", "photo_label"] }
          );
          for (const pfa of pfAttachments) {
            if (!pfa.ir_attachment_id) continue;
            try {
              const originals = await executeKw<{ id: number; name: string; datas: string | false; mimetype: string }[]>(
                "ir.attachment", "search_read",
                [[["id", "=", pfa.ir_attachment_id[0]]]],
                { fields: ["id", "name", "datas", "mimetype"] }
              );
              if (!originals.length || !originals[0].datas) continue;
              const orig = originals[0];
              await executeKw("ir.attachment", "create", [{
                name: pfa.photo_label || pfa.file_name || orig.name,
                datas: orig.datas, mimetype: orig.mimetype,
                res_model: "mrp.production", res_id: moId,
                description: `Copied from pressing ${input.pressingOdooId}`,
              }]);
            } catch {}
          }
        } catch (err) {
          console.error("[createPressingMO] Attachment copy failed:", err);
        }

        return { success: true, moId, moName };
      }),

    linkPressingToMO: publicProcedure
    .input(
      z.object({
        pressingOdooId: z.number(),
        moId: z.number(),
        moName: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { pressingOdooId, moId, moName } = input;
      // Read current notes so we can append rather than overwrite
      const records = await executeKw<{ id: number; notes: string | false }[]>(
        "pf.pressing",
        "search_read",
        [[["id", "=", pressingOdooId]]],
        { fields: ["id", "notes"] }
      );
      const existing = records[0]?.notes || "";
      const tag = `[Converted to ${moName} | MO ID: ${moId}]`;
      const newNotes = existing ? `${existing}\n${tag}` : tag;
      // Write notes + dedicated linked MO fields (authoritative source for badge display)
      await executeKw("pf.pressing", "write", [[[pressingOdooId], {
        notes: newNotes,
        x_studio_linked_mo: moName,
        x_studio_linked_mo_id: moId,
      }]]);
      return { success: true, moId, moName };
    }),

  /**
   * Copy attachments from a pf.pressing record to a mrp.production order.
   * Reads pf.attachment records linked to the pressing and creates
   * new ir.attachment records linked to the MO, reusing the same binary data.
   */
  copyPressingAttachments: publicProcedure
    .input(
      z.object({
        pressingOdooId: z.number(),
        moId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const { pressingOdooId, moId } = input;

      // 1. Get pf.attachment records for this pressing
      const pfAttachments = await executeKw<{
        id: number;
        ir_attachment_id: [number, string] | false;
        file_name: string | false;
        photo_label: string | false;
        photo_type: string | false;
      }[]>(
        "pf.attachment",
        "search_read",
        [[["pressing_id", "=", pressingOdooId]]],
        { fields: ["id", "ir_attachment_id", "file_name", "photo_label", "photo_type"] }
      );

      if (!pfAttachments.length) return { copied: 0 };

      let copied = 0;
      for (const pfa of pfAttachments) {
        if (!pfa.ir_attachment_id) continue;
        const irId = pfa.ir_attachment_id[0];
        try {
          const originals = await executeKw<{
            id: number;
            name: string;
            datas: string | false;
            mimetype: string;
          }[]>(
            "ir.attachment",
            "search_read",
            [[["id", "=", irId]]],
            { fields: ["id", "name", "datas", "mimetype"] }
          );
          if (!originals.length || !originals[0].datas) continue;
          const orig = originals[0];
          await executeKw(
            "ir.attachment",
            "create",
            [{
              name: pfa.photo_label || pfa.file_name || orig.name,
              datas: orig.datas,
              mimetype: orig.mimetype,
              res_model: "mrp.production",
              res_id: moId,
              description: `Copied from pressing ${pressingOdooId} (pf.attachment #${pfa.id})`,
            }]
          );
          copied++;
        } catch (err: any) {
          console.error(`[copyPressingAttachments] Failed to copy attachment ${pfa.id}: ${err.message}`);
        }
      }

      return { copied };
    }),

  // ─── Internal Transfer (Odoo stock.picking) ─────────────────────────────────

  /**
   * Search products for the transfer wizard.
   * Returns products available in the given company with UoM info.
   */
  searchProducts: publicProcedure
    .input(z.object({
      search: z.string().default(""),
      companyId: z.number().default(3),
      limit: z.number().default(30),
    }))
    .query(async ({ input }) => {
      return searchTransferProducts(input.search, input.companyId, input.limit);
    }),

  /**
   * Fetch warehouses and their locations for the transfer form.
   * Returns warehouses with nested locations for company 3 (Cairo).
   */
  transferLocations: publicProcedure
    .input(z.object({ companyId: z.number().default(3) }).optional())
    .query(async ({ input }) => {
      const companyId = input?.companyId ?? 3;
      const [warehouses, locations] = await Promise.all([
        fetchWarehouses(companyId),
        fetchStockLocations(companyId),
      ]);

      // Group locations by warehouse
      const warehouseData = warehouses.map((wh) => {
        const whLocations = locations.filter(
          (loc) => loc.warehouse_id && loc.warehouse_id[0] === wh.id
        );
        // Also include orphan locations matching warehouse code prefix
        const orphanLocations = locations.filter(
          (loc) => !loc.warehouse_id && loc.complete_name.startsWith(wh.code + "/")
        );
        return {
          id: wh.id,
          name: wh.name,
          code: wh.code,
          locations: [...whLocations, ...orphanLocations].map((loc) => ({
            id: loc.id,
            name: loc.name,
            completeName: loc.complete_name,
          })),
        };
      });

      return warehouseData;
    }),

  /**
   * Create an internal transfer in Odoo using the standard stock.picking workflow.
   * Odoo handles all stock moves, accounting entries, and valuations.
   *
   * Workflow: create picking → create move lines → action_confirm
   */
  createTransfer: publicProcedure
    .input(z.object({
      sourceLocationId: z.number(),
      destLocationId: z.number(),
      pickingTypeId: z.number().default(66),
      companyId: z.number().default(3),
      origin: z.string().optional(),
      scheduledDate: z.string().optional(),
      lines: z.array(z.object({
        productId: z.number(),
        quantity: z.number().positive(),
        uomId: z.number().default(12),
        bales: z.number().optional(),
      })).min(1),
      autoConfirm: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      // ── Server-side stock availability check ──
      const productIds = input.lines.map(l => l.productId);
      const stockData = await fetchProductStockByLocation(productIds, input.sourceLocationId);
      const insufficientStock: { productId: number; requested: number; available: number }[] = [];
      for (const line of input.lines) {
        const stock = stockData.find(s => s.productId === line.productId);
        const available = stock?.availableQuantity || 0;
        if (line.quantity > available) {
          insufficientStock.push({ productId: line.productId, requested: line.quantity, available });
        }
      }
      if (insufficientStock.length > 0) {
        const details = insufficientStock.map(s => `Product ${s.productId}: requested ${s.requested} kg, available ${s.available} kg`).join("; ");
        throw new Error(`Insufficient stock at source location. ${details}`);
      }

      const result = await createInternalTransfer({
        pickingTypeId: input.pickingTypeId,
        locationId: input.sourceLocationId,
        locationDestId: input.destLocationId,
        companyId: input.companyId,
        scheduledDate: input.scheduledDate,
        origin: input.origin || "Platfarm Portal — Dakhla → Sokhna Transfer",
        lines: input.lines,
        autoConfirm: input.autoConfirm,
      });

      return {
        success: true,
        pickingId: result.pickingId,
        pickingName: result.pickingName,
        state: result.state,
      };
    }),

  /**
   * Browse all products with positive stock at a specific location.
   * Returns product list with qty, reserved, available, and UoM.
   */

  pushQualityToReceipt: publicProcedure
    .input(
      z.object({
        qualityOdooId: z.number(),
        receiptId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const { qualityOdooId, receiptId } = input;

      const qcRecords = await executeKw<any[]>(
        "pf.quality", "read", [[qualityOdooId]],
        { fields: [
          "moisture", "moisture_weight_pct", "protein_nir",
          "final_grade", "verdict", "color", "leaf_ratio",
          "foreign_matter", "odor", "bale_shape", "bale_ties",
          "truck_clean", "has_cover", "strap_good", "stack_good",
          "no_weeds", "no_insects", "no_black_wood",
          "g1_bale_count", "g2_bale_count", "mix_bale_count",
          "avg_bale_weight", "bale_height",
          "qc_notes", "name",
        ]}
      );
      if (!qcRecords || qcRecords.length === 0) {
        throw new Error("Quality record not found");
      }
      const qc = qcRecords[0];

      const isYes = (v: any) => v === "yes" || v === "good" || v === true;
      const gradeMap: Record<string, string> = {
        "Premium": "Premium", "premium": "Premium",
        "grade_1": "Grade 1", "G1": "Grade 1", "Grade 1": "Grade 1",
        "grade_2": "Grade 2", "G2": "Grade 2", "Grade 2": "Grade 2",
        "grade_3": "Grade 3", "G3": "Grade 3", "Grade 3": "Grade 3",
        "Standard": "Standard", "standard": "Standard",
        "Supreme": "Supreme", "supreme": "Supreme",
      };

      const writeVals: Record<string, unknown> = {};
      if (qc.moisture) writeVals.x_studio_moisture_ = qc.moisture;
      if (qc.protein_nir) writeVals.x_studio_crude_protein_dry_matter_ = qc.protein_nir;
      if (qc.final_grade) {
        const mapped = gradeMap[qc.final_grade] || qc.final_grade;
        writeVals.x_studio_overall_received_grade_as_per_quality_assessment = mapped;
      }
      if (qc.verdict) writeVals.x_studio_accepted_rejected = qc.verdict === "accepted" || qc.verdict === "Approved";
      writeVals.x_studio_good_quality_green_color = isYes(qc.color);
      writeVals.x_studio_good_quality_absence_of_foreign_material = isYes(qc.foreign_matter) || qc.foreign_matter === "none";
      writeVals.x_studio_good_quality_absence_of_insects = isYes(qc.no_insects);
      writeVals.x_studio_good_quality_bale_ties = isYes(qc.bale_ties);
      writeVals.x_studio_good_quality_uniformity_of_bale_shape = isYes(qc.bale_shape);
      writeVals.x_studio_presence_of_truck_cover = isYes(qc.has_cover);
      writeVals.x_studio_loadcontainer_cleanliness = isYes(qc.truck_clean);
      writeVals.x_studio_proper_loadcontainer_stacking = isYes(qc.stack_good);
      writeVals.x_studio_proper_loadcontainer_lashing = isYes(qc.strap_good);
      const totalBales = (qc.g1_bale_count || 0) + (qc.g2_bale_count || 0) + (qc.mix_bale_count || 0);
      if (totalBales > 0) writeVals.x_studio_total_number_of_received_bales = String(totalBales);

      await executeKw("stock.picking", "write", [[receiptId], writeVals]);

      const pfAttachments = await executeKw<{
        id: number;
        ir_attachment_id: [number, string] | false;
        file_name: string | false;
        photo_label: string | false;
        photo_type: string | false;
      }[]>(
        "pf.attachment", "search_read",
        [[["quality_id", "=", qualityOdooId]]],
        { fields: ["id", "ir_attachment_id", "file_name", "photo_label", "photo_type"] }
      );
      let copiedAttachments = 0;
      for (const pfa of pfAttachments) {
        if (!pfa.ir_attachment_id) continue;
        const irId = pfa.ir_attachment_id[0];
        try {
          const irAtt = await executeKw<any[]>(
            "ir.attachment", "read", [[irId]],
            { fields: ["datas", "name", "mimetype"] }
          );
          if (irAtt?.[0]?.datas) {
            const label = pfa.photo_label || pfa.file_name || pfa.ir_attachment_id[1] || "QC_photo";
            await executeKw("ir.attachment", "create", [{
              name: `[QC] ${label}`,
              datas: irAtt[0].datas,
              mimetype: irAtt[0].mimetype || "image/jpeg",
              res_model: "stock.picking",
              res_id: receiptId,
            }]);
            copiedAttachments++;
          }
        } catch (e: any) {
          console.error(`[pushQualityToReceipt] Failed to copy attachment ${pfa.id}: ${e.message}`);
        }
      }

      return {
        success: true,
        receiptId,
        fieldsWritten: Object.keys(writeVals).length,
        attachmentsCopied: copiedAttachments,
        qcName: qc.name || "",
      };
    }),

    browseStockAtLocation: publicProcedure
    .input(z.object({
      locationId: z.number(),
    }))
    .query(async ({ input }) => {
      return fetchAllStockAtLocation(input.locationId);
    }),

  /**
   * Check available stock for a product at a specific location.
   * Returns total qty, reserved qty, and available (unreserved) qty.
   */
  checkStockAvailability: publicProcedure
    .input(z.object({
      productId: z.number(),
      locationId: z.number(),
    }))
    .query(async ({ input }) => {
      const results = await fetchProductStockByLocation(
        [input.productId],
        input.locationId
      );
      const match = results.find(r => r.productId === input.productId && r.locationId === input.locationId);
      return {
        productId: input.productId,
        locationId: input.locationId,
        locationName: match?.locationName || "—",
        quantity: match?.quantity || 0,
        reservedQuantity: match?.reservedQuantity || 0,
        availableQuantity: match?.availableQuantity || 0,
      };
    }),

  /**
   * Validate (process) a confirmed transfer.
   * Only call when the physical transfer is complete.
   */
  validateTransfer: publicProcedure
    .input(z.object({
      pickingId: z.number(),
      companyId: z.number().default(3),
    }))
    .mutation(async ({ input }) => {
      const result = await validateInternalTransfer(input.pickingId, input.companyId);
      return { success: true, state: result.state };
    }),
});
