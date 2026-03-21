/**
 * tRPC Router for Double Press Production (mrp.production)
 *
 * Provides endpoints for listing, viewing, creating, updating manufacturing orders,
 * managing stock moves (input/output), employee assignments, and dashboard stats.
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  fetchManufacturingOrders,
  fetchManufacturingOrderById,
  countManufacturingOrders,
  fetchRawMoves,
  fetchFinishedMoves,
  resolveProductionEmployeeIds,
  fetchProductionEmployees,
  fetchProductionProducts,
  fetchBOMs,
  fetchBOMLines,
  createManufacturingOrder,
  updateManufacturingOrder,
  confirmManufacturingOrder,
  markManufacturingOrderDone,
  cancelManufacturingOrder,
  updateStockMoveQuantity,
  fetchProductionStats,
  fetchWarehouses,
  fetchStockLocations,
  uploadFileToMO,
  readMOFile,
  checkMOFileStatus,
} from "../odoo-production";
import { fetchAggregatedStock } from "../odoo";

// Helper to resolve many2many employee IDs to name objects
function resolveEmployees(
  ids: number[],
  empMap: Map<number, { name: string; department: string; jobTitle: string }>
) {
  return (ids || []).map(id => {
    const emp = empMap.get(id);
    return emp ? { id, name: emp.name, department: emp.department, jobTitle: emp.jobTitle } : { id, name: `Employee #${id}`, department: "", jobTitle: "" };
  });
}

export const productionRouter = router({
  // ─── Dashboard Stats ──────────────────────────────────────────────────
  stats: publicProcedure.query(async () => {
    return fetchProductionStats();
  }),

  // ─── List Manufacturing Orders ────────────────────────────────────────
  list: publicProcedure
    .input(
      z.object({
        state: z.string().optional(),
        limit: z.number().optional().default(200),
        offset: z.number().optional().default(0),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const mos = await fetchManufacturingOrders({
        state: input?.state,
        limit: input?.limit,
        offset: input?.offset,
        search: input?.search,
      });

      // Collect all employee IDs across all MOs for batch resolution
      const allEmpIds = new Set<number>();
      for (const mo of mos) {
        for (const id of (mo.supervisor_ids || [])) allEmpIds.add(id);
        for (const id of (mo.involved_production_labors || [])) allEmpIds.add(id);
        for (const id of (mo.involved_quality_labors || [])) allEmpIds.add(id);
        for (const id of (mo.involved_drivers || [])) allEmpIds.add(id);
        for (const id of (mo.quality_supervisor_ids || [])) allEmpIds.add(id);
        for (const id of (mo.loading_driver_ids || [])) allEmpIds.add(id);
        for (const id of (mo.labor_ids || [])) allEmpIds.add(id);
      }
      const empMap = await resolveProductionEmployeeIds([...allEmpIds]);

      return mos.map(mo => ({
        id: mo.id,
        name: mo.name,
        product: mo.product_id ? { id: mo.product_id[0], name: mo.product_id[1] } : null,
        productQty: mo.product_qty,
        qtyProduced: mo.qty_produced,
        uom: mo.product_uom_id ? { id: mo.product_uom_id[0], name: mo.product_uom_id[1] } : null,
        bom: mo.bom_id ? { id: mo.bom_id[0], name: mo.bom_id[1] } : null,
        state: mo.state,
        dateStart: mo.date_start || null,
        dateFinished: mo.date_finished || null,
        company: mo.company_id ? { id: mo.company_id[0], name: mo.company_id[1] } : null,
        productionDate: mo.x_studio_production_date_start_of_shift || null,
        shiftStart: mo.shift_start_time || null,
        shiftEnd: mo.shift_end_time || null,
        actualHours: mo.actual_production_hours,
        downTimeMinutes: mo.down_time_minutes,
        inputSource: mo.x_studio_input_material_source || null,
        inputQualityGrade: mo.input_product_quality_grade || null,
        dieselLiters: mo.diesel_consumption_liters,
        sleeveBagsUsed: mo.number_sleeve_bags_used || 0,
        maxOilTemperature: mo.maximum_oil_temperature || 0,
        totalBales:
          (mo.no_produced_premium_bales || 0) +
          (mo.no_produced_grade_1_bales || 0) +
          (mo.no_produced_fair_grade_bales || 0) +
          (mo.x_studio_no_produced_fairgrade_3_bales || 0) +
          (mo.no_produced_alfamix_bales || 0) +
          (mo.no_produced_mix_grass_bales || 0) +
          (mo.no_produced_wheat_straw_bales || 0) +
          (mo.x_studio_no_produced_supreme_bales || 0),
        equipmentFailure: mo.is_there_equipment_failure,
        incentiveCancelled: mo.x_studio_incentive_cancelled,
        // Employee names for search
        supervisors: resolveEmployees(mo.supervisor_ids || [], empMap),
        productionLabors: resolveEmployees(mo.involved_production_labors || [], empMap),
        qualityLabors: resolveEmployees(mo.involved_quality_labors || [], empMap),
        drivers: resolveEmployees(mo.involved_drivers || [], empMap),
        qualitySupervisors: resolveEmployees(mo.quality_supervisor_ids || [], empMap),
        loadingDrivers: resolveEmployees(mo.loading_driver_ids || [], empMap),
        labors: resolveEmployees(mo.labor_ids || [], empMap),
      }));
    }),

  // ─── Count Manufacturing Orders ───────────────────────────────────────
  count: publicProcedure
    .input(z.object({ state: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return countManufacturingOrders({ state: input?.state });
    }),

  // ─── Get Single Manufacturing Order ───────────────────────────────────
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const mo = await fetchManufacturingOrderById(input.id);
      if (!mo) throw new Error("Manufacturing order not found");

      // Fetch stock moves and resolve employees in parallel
      const allEmployeeIds: number[] = [
        ...(mo.supervisor_ids || []),
        ...(mo.involved_production_labors || []),
        ...(mo.involved_quality_labors || []),
        ...(mo.involved_drivers || []),
        ...(mo.quality_supervisor_ids || []),
        ...(mo.loading_driver_ids || []),
        ...(mo.labor_ids || []),
      ];
      if (mo.supervisor_quality_id && Array.isArray(mo.supervisor_quality_id)) {
        allEmployeeIds.push(mo.supervisor_quality_id[0]);
      }

      const [rawMoves, finishedMoves, empMap] = await Promise.all([
        fetchRawMoves(mo.move_raw_ids || []),
        fetchFinishedMoves(mo.move_finished_ids || []),
        resolveProductionEmployeeIds(allEmployeeIds),
      ]);

      return {
        id: mo.id,
        name: mo.name,
        product: mo.product_id ? { id: mo.product_id[0], name: mo.product_id[1] } : null,
        productQty: mo.product_qty,
        qtyProduced: mo.qty_produced,
        uom: mo.product_uom_id ? { id: mo.product_uom_id[0], name: mo.product_uom_id[1] } : null,
        bom: mo.bom_id ? { id: mo.bom_id[0], name: mo.bom_id[1] } : null,
        state: mo.state,
        dateStart: mo.date_start || null,
        dateFinished: mo.date_finished || null,
        company: mo.company_id ? { id: mo.company_id[0], name: mo.company_id[1] } : null,

        // Production Info
        productionDate: mo.x_studio_production_date_start_of_shift || null,
        shiftStart: mo.shift_start_time || null,
        shiftEnd: mo.shift_end_time || null,
        actualHours: mo.actual_production_hours,
        downTimeMinutes: mo.down_time_minutes,
        notes: mo.general_observations_notes || null,

        // Employees
        supervisors: resolveEmployees(mo.supervisor_ids || [], empMap),
        productionLabors: resolveEmployees(mo.involved_production_labors || [], empMap),
        qualityLabors: resolveEmployees(mo.involved_quality_labors || [], empMap),
        drivers: resolveEmployees(mo.involved_drivers || [], empMap),
        qualitySupervisors: resolveEmployees(mo.quality_supervisor_ids || [], empMap),
        loadingDrivers: resolveEmployees(mo.loading_driver_ids || [], empMap),
        labors: resolveEmployees(mo.labor_ids || [], empMap),
        qualitySupervisor: mo.supervisor_quality_id
          ? { id: mo.supervisor_quality_id[0], name: mo.supervisor_quality_id[1] }
          : null,

        // Input Product Quality
        inputSource: mo.x_studio_input_material_source || null,
        inputQualityGrade: mo.input_product_quality_grade || null,
        avgInputBaleWeight: mo.average_input_big_bale_weight_kg,
        containsGrasses: mo.input_product_contain_grasses,
        grassesPercentage: mo.percentage_grasses_input_product,
        containsHighMoisture: mo.input_product_contain_high_moisture,
        highMoistureBigBales: mo.number_high_moisture_big_bales,
        highMoistureSmallBalesTons: mo.number_high_moisture_small_bales_tons,
        inputQualityNotes: mo.input_product_quality_observations || null,

        // Output Product Quality
        bales: {
          supreme: mo.x_studio_no_produced_supreme_bales || 0,
          premium: mo.no_produced_premium_bales || 0,
          grade1: mo.no_produced_grade_1_bales || 0,
          fair: mo.no_produced_fair_grade_bales || 0,
          fairGrade3: mo.x_studio_no_produced_fairgrade_3_bales || 0,
          alfamix: mo.no_produced_alfamix_bales || 0,
          mixGrass: mo.no_produced_mix_grass_bales || 0,
          wheatStraw: mo.no_produced_wheat_straw_bales || 0,
        },
        outputQualityNotes: mo.output_product_quality_observations || null,

        // Diesel & Materials
        dieselLiters: mo.diesel_consumption_liters,
        sleeveBagsUsed: mo.number_sleeve_bags_used,
        strappingUnitsUsed: mo.number_strapping_units_used,
        dieselNotes: mo.diesel_materials_consumption_notes || null,

        // Baling Machine Monitoring
        oilMeasurements: mo.no_oil_measurements_during_shift,
        maxOilTemperature: mo.maximum_oil_temperature,
        maxOilPressure: mo.maximum_oil_pressure,
        equipmentFailure: mo.is_there_equipment_failure,
        failureReason: mo.equipment_failure_reason || null,
        machineNotes: mo.baling_monitoring_notes || null,

        // Quality Form
        qualityNotes: mo.quality_observations_notes || null,

        // Incentive
        incentiveCancelled: mo.x_studio_incentive_cancelled,
        incentiveCancelDetails: mo.x_studio_incentive_cancelation_details || null,

        // Additional fields
        facilityManagerAttended: mo.x_studio_facility_manager_attended,
        priority: mo.priority || "0",
        dateDeadline: mo.date_deadline || null,
        origin: mo.origin || null,
        responsibleUser: mo.user_id ? { id: mo.user_id[0], name: mo.user_id[1] } : null,
        locationSrc: mo.location_src_id ? { id: mo.location_src_id[0], name: mo.location_src_id[1] } : null,
        locationDest: mo.location_dest_id ? { id: mo.location_dest_id[0], name: mo.location_dest_id[1] } : null,

        // Stock Moves
        rawMaterials: rawMoves.map(m => ({
          id: m.id,
          product: m.product_id ? { id: m.product_id[0], name: m.product_id[1] } : null,
          demandQty: m.product_uom_qty,
          doneQty: m.quantity,
          uom: m.product_uom ? { id: m.product_uom[0], name: m.product_uom[1] } : null,
          state: m.state,
          locationSrc: m.location_id ? { id: m.location_id[0], name: m.location_id[1] } : null,
          locationDest: m.location_dest_id ? { id: m.location_dest_id[0], name: m.location_dest_id[1] } : null,
        })),
        finishedProducts: finishedMoves.map(m => ({
          id: m.id,
          product: m.product_id ? { id: m.product_id[0], name: m.product_id[1] } : null,
          demandQty: m.product_uom_qty,
          doneQty: m.quantity,
          uom: m.product_uom ? { id: m.product_uom[0], name: m.product_uom[1] } : null,
          state: m.state,
          locationSrc: m.location_id ? { id: m.location_id[0], name: m.location_id[1] } : null,
          locationDest: m.location_dest_id ? { id: m.location_dest_id[0], name: m.location_dest_id[1] } : null,
        })),
      };
    }),

  // ─── Create Manufacturing Order ───────────────────────────────────────
  create: publicProcedure
    .input(
      z.object({
        product_id: z.number(),
        product_qty: z.number(),
        product_uom_id: z.number().optional(),
        bom_id: z.number().optional(),
        company_id: z.number().optional(),
        date_start: z.string().optional(),
        x_studio_production_date_start_of_shift: z.string().optional(),
        x_studio_input_material_source: z.string().optional(),
        shift_start_time: z.string().optional(),
        shift_end_time: z.string().optional(),
        actual_production_hours: z.number().optional(),
        down_time_minutes: z.number().optional(),
        // Employee assignments
        supervisor_ids: z.array(z.number()).optional(),
        involved_production_labors: z.array(z.number()).optional(),
        involved_quality_labors: z.array(z.number()).optional(),
        involved_drivers: z.array(z.number()).optional(),
        quality_supervisor_ids: z.array(z.number()).optional(),
        loading_driver_ids: z.array(z.number()).optional(),
        labor_ids: z.array(z.number()).optional(),
        // Input quality
        input_product_quality_grade: z.string().optional(),
        average_input_big_bale_weight_kg: z.number().optional(),
        input_product_contain_grasses: z.boolean().optional(),
        percentage_grasses_input_product: z.number().optional(),
        input_product_contain_high_moisture: z.boolean().optional(),
        number_high_moisture_big_bales: z.number().optional(),
        number_high_moisture_small_bales_tons: z.number().optional(),
        input_product_quality_observations: z.string().optional(),
        // Diesel & Materials
        diesel_consumption_liters: z.number().optional(),
        number_sleeve_bags_used: z.number().optional(),
        number_strapping_units_used: z.number().optional(),
        diesel_materials_consumption_notes: z.string().optional(),
        // Machine monitoring
        no_oil_measurements_during_shift: z.number().optional(),
        maximum_oil_temperature: z.number().optional(),
        maximum_oil_pressure: z.number().optional(),
        is_there_equipment_failure: z.boolean().optional(),
        equipment_failure_reason: z.string().optional(),
        baling_monitoring_notes: z.string().optional(),
        // Notes
        general_observations_notes: z.string().optional(),
        // Source location
        location_src_id: z.number().optional(),
        // Destination location
        location_dest_id: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const moId = await createManufacturingOrder(input);
      // Fetch MO name for back-referencing (e.g., "WH/MO/00042")
      let moName = `MO-${moId}`;
      try {
        const mo = await fetchManufacturingOrderById(moId);
        if (mo?.name) moName = mo.name;
      } catch { /* non-fatal */ }
      return { id: moId, name: moName, success: true };
    }),

  // ─── Update Manufacturing Order ───────────────────────────────────────
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        // Shift info
        shift_start_time: z.string().optional(),
        shift_end_time: z.string().optional(),
        actual_production_hours: z.number().optional(),
        down_time_minutes: z.number().optional(),
        general_observations_notes: z.string().optional(),
        x_studio_input_material_source: z.string().optional(),
        x_studio_production_date_start_of_shift: z.string().optional(),
        // Employee assignments
        supervisor_ids: z.array(z.number()).optional(),
        involved_production_labors: z.array(z.number()).optional(),
        involved_quality_labors: z.array(z.number()).optional(),
        involved_drivers: z.array(z.number()).optional(),
        quality_supervisor_ids: z.array(z.number()).optional(),
        loading_driver_ids: z.array(z.number()).optional(),
        labor_ids: z.array(z.number()).optional(),
        // Input Product Quality
        input_product_quality_grade: z.string().optional(),
        average_input_big_bale_weight_kg: z.number().optional(),
        input_product_contain_grasses: z.boolean().optional(),
        percentage_grasses_input_product: z.number().optional(),
        input_product_contain_high_moisture: z.boolean().optional(),
        number_high_moisture_big_bales: z.number().optional(),
        number_high_moisture_small_bales_tons: z.number().optional(),
        input_product_quality_observations: z.string().optional(),
        // Output Product Quality
        no_produced_premium_bales: z.number().optional(),
        no_produced_grade_1_bales: z.number().optional(),
        no_produced_fair_grade_bales: z.number().optional(),
        no_produced_alfamix_bales: z.number().optional(),
        no_produced_mix_grass_bales: z.number().optional(),
        no_produced_wheat_straw_bales: z.number().optional(),
        x_studio_no_produced_supreme_bales: z.number().optional(),
        output_product_quality_observations: z.string().optional(),
        // Diesel & Materials
        diesel_consumption_liters: z.number().optional(),
        number_sleeve_bags_used: z.number().optional(),
        number_strapping_units_used: z.number().optional(),
        diesel_materials_consumption_notes: z.string().optional(),
        // Baling Machine Monitoring
        no_oil_measurements_during_shift: z.number().optional(),
        maximum_oil_temperature: z.number().optional(),
        maximum_oil_pressure: z.number().optional(),
        is_there_equipment_failure: z.boolean().optional(),
        equipment_failure_reason: z.string().optional(),
        baling_monitoring_notes: z.string().optional(),
        // Quality Form
        supervisor_quality_id: z.number().optional(),
        quality_observations_notes: z.string().optional(),
        // Incentive
        x_studio_incentive_cancelled: z.boolean().optional(),
        x_studio_incentive_cancelation_details: z.string().optional(),
        // Additional fields
        x_studio_no_produced_fairgrade_3_bales: z.number().optional(),
        x_studio_facility_manager_attended: z.boolean().optional(),
        priority: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const success = await updateManufacturingOrder(input);
      return { success };
    }),

  // ─── State Transitions ────────────────────────────────────────────────
  confirm: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const success = await confirmManufacturingOrder(input.id);
      return { success };
    }),

  markDone: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const success = await markManufacturingOrderDone(input.id);
      return { success };
    }),

  cancel: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const success = await cancelManufacturingOrder(input.id);
      return { success };
    }),

  // ─── Update Stock Move Quantity ───────────────────────────────────────
  updateMoveQty: publicProcedure
    .input(z.object({ moveId: z.number(), quantity: z.number() }))
    .mutation(async ({ input }) => {
      const success = await updateStockMoveQuantity(input.moveId, input.quantity);
      return { success };
    }),

  // ─── Lookups ──────────────────────────────────────────────────────────
  employees: publicProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const data = await fetchProductionEmployees(input?.search);
      return data.map(e => ({
        id: e.id,
        name: e.name,
        department: e.department_id ? e.department_id[1] : "",
        jobTitle: e.job_title || "",
      }));
    }),

  products: publicProcedure
    .input(z.object({
      search: z.string().optional(),
      type: z.enum(["finished", "raw"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const data = await fetchProductionProducts(input?.search, input?.type);
      return data.map(p => ({
        id: p.id,
        name: p.name,
        uom: p.uom_id ? { id: p.uom_id[0], name: p.uom_id[1] } : null,
        category: p.categ_id ? p.categ_id[1] : "",
      }));
    }),

  boms: publicProcedure
    .input(z.object({ productId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const data = await fetchBOMs(input?.productId);
      return data.map(b => ({
        id: b.id,
        name: b.name || (b.product_id ? b.product_id[1] : `BOM #${b.id}`),
        productId: b.product_id ? b.product_id[0] : null,
        productQty: b.product_qty,
      }));
    }),

  // ─── Warehouses & Locations ──────────────────────────────────────────
  warehouses: publicProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return fetchWarehouses(input?.search);
    }),

  stockLocations: publicProcedure
    .input(z.object({
      search: z.string().optional(),
      warehouseId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      return fetchStockLocations(input?.search, input?.warehouseId);
    }),

  // ─── Document Upload (S3 + DB) ──────────────────────────────────────
  uploadDocument: publicProcedure
    .input(z.object({
      moId: z.number(),
      tab: z.string(),
      docType: z.string(),
      fileName: z.string(),
      mimeType: z.string().optional(),
      fileSize: z.number().optional(),
      base64Content: z.string(),
      uploadedBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { storagePut } = await import("../storage");
      const { getDb } = await import("../db");
      const { productionDocuments } = await import("../../drizzle/schema");

      // Generate unique file key
      const suffix = Math.random().toString(36).substring(2, 8);
      const ext = input.fileName.split(".").pop() || "bin";
      const fileKey = `production/${input.moId}/${input.tab}/${Date.now()}-${suffix}.${ext}`;

      // Upload to S3
      const buf = Buffer.from(input.base64Content, "base64");
      const { url } = await storagePut(fileKey, buf, input.mimeType || "application/octet-stream");

      // Save metadata to DB
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.insert(productionDocuments).values({
        moId: input.moId,
        tab: input.tab,
        docType: input.docType,
        fileName: input.fileName,
        mimeType: input.mimeType || null,
        fileSize: input.fileSize || null,
        fileKey,
        fileUrl: url,
        uploadedBy: input.uploadedBy || null,
      });

      return { id: Number(result[0].insertId), fileUrl: url, fileKey, success: true };
    }),

  // ─── List Documents for a MO ──────────────────────────────────────────
  listDocuments: publicProcedure
    .input(z.object({ moId: z.number(), tab: z.string().optional() }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const { productionDocuments } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) return [];

      const conditions = [eq(productionDocuments.moId, input.moId)];
      if (input.tab) conditions.push(eq(productionDocuments.tab, input.tab));

      const docs = await db.select().from(productionDocuments).where(
        conditions.length === 1 ? conditions[0] : and(...conditions)
      );

      return docs.map(d => ({
        id: d.id,
        moId: d.moId,
        tab: d.tab,
        docType: d.docType,
        fileName: d.fileName,
        mimeType: d.mimeType,
        fileSize: d.fileSize,
        fileUrl: d.fileUrl,
        uploadedBy: d.uploadedBy,
        createdAt: d.createdAt,
      }));
    }),

  // ─── Delete Document ──────────────────────────────────────────────────
  deleteDocument: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const { productionDocuments } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(productionDocuments).where(eq(productionDocuments.id, input.id));
      return { success: true };
    }),

  // ─── Odoo Binary Field Upload (same pattern as shipments) ──────────
  uploadMOFile: publicProcedure
    .input(z.object({
      moId: z.number(),
      fieldName: z.string(),
      base64Content: z.string(),
    }))
    .mutation(async ({ input }) => {
      const success = await uploadFileToMO(input.moId, input.fieldName, input.base64Content);
      return { success };
    }),

  // ─── Read Odoo Binary Field ────────────────────────────────────────
  readMOFile: publicProcedure
    .input(z.object({ moId: z.number(), fieldName: z.string() }))
    .query(async ({ input }) => {
      const content = await readMOFile(input.moId, input.fieldName);
      return { content: content || null };
    }),

  // ─── Check File Status (which binary fields have data) ─────────────
  checkMOFileStatus: publicProcedure
    .input(z.object({ moId: z.number() }))
    .query(async ({ input }) => {
      const status = await checkMOFileStatus(input.moId);
      return status;
    }),

  // ─── BOM Availability Check ──────────────────────────────────────────
  bomAvailability: publicProcedure
    .input(z.object({
      bomId: z.number(),
      warehouseId: z.number().optional(),
      qtyToProduce: z.number().optional(),
    }))
    .query(async ({ input }) => {
      // 1. Fetch BOM lines (components)
      const lines = await fetchBOMLines(input.bomId);
      if (lines.length === 0) return { components: [], allAvailable: false };

      // 2. Get product IDs from BOM lines
      const productIds = lines
        .filter(l => l.product_id)
        .map(l => (l.product_id as [number, string])[0]);

      // 3. Fetch aggregated stock for those products
      const stock = await fetchAggregatedStock(productIds, input.warehouseId || undefined);

      // 4. Build availability per component
      const multiplier = input.qtyToProduce || 1;
      const components = lines
        .filter(l => l.product_id)
        .map(l => {
          const pid = (l.product_id as [number, string])[0];
          const pname = (l.product_id as [number, string])[1];
          const uom = l.product_uom_id ? (l.product_uom_id as [number, string])[1] : "";
          const requiredQty = l.product_qty * multiplier;

          // Sum available across all warehouses (or filtered warehouse)
          const stockEntries = stock.filter(s => s.productId === pid);
          const totalOnHand = stockEntries.reduce((sum, s) => sum + s.onHand, 0);
          const totalAvailable = stockEntries.reduce((sum, s) => sum + s.available, 0);

          return {
            productId: pid,
            productName: pname,
            uom,
            requiredQty,
            onHand: totalOnHand,
            available: totalAvailable,
            sufficient: totalAvailable >= requiredQty,
            warehouses: stockEntries.map(s => ({
              warehouseId: s.warehouseId,
              warehouseName: s.warehouseName,
              onHand: s.onHand,
              available: s.available,
            })),
          };
        });

      return {
        components,
        allAvailable: components.every(c => c.sufficient),
      };
    }),
});
