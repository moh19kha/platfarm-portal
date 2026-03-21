/**
 * CreateProductionOrder — Full 8-step wizard to create a new Production Order
 * Steps: 1) Company & Product  2) Input Product & Source  3) Packing Materials
 *        4) Shift Details  5) Workforce  6) Input Quality  7) Machine & Diesel  8) Review
 * Follows the same pattern as CreateOdooShipment.tsx with comprehensive fields
 */
import { useState, useMemo, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { C, FONT, MONO } from "@/lib/data";
import { INPUT_QUALITY_GRADES, EQUIPMENT_FAILURE_REASONS } from "@/lib/productionData";
import { Btn } from "@/components/ui-primitives";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { OdooSearchSelect } from "@/components/OdooSearchSelect";
import { OdooMultiSelect } from "@/components/OdooMultiSelect";

export interface PressingData {
  odooId: number;
  id: string;           // display name, e.g. "DPR-0042"
  site: string;
  line: string;
  batch: string;
  shift: string;
  operator: string;
  commodity: string;
  inBales: number;
  inWeight: number;
  inGrade: string;
  outBales: number;
  outWeight: number;
  outAvgBale: number;
  density: string;
  fuel: number;
  oilTemp: string;      // e.g. "85°C"
  oilPressure: string;  // e.g. "200 bar"
  startTime: string;    // "HH:MM"
  endTime: string;      // "HH:MM"
  sources: string;
  date: string;         // "D Mon YYYY"
  notes?: string;
}

interface Props {
  activeCompanyId: number | "ALL";
  onClose: () => void;
  onCreated: (id: number, name: string) => void;
  pressingData?: PressingData;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "5px 8px", border: `1px solid ${C.border}`,
  borderRadius: 5, fontSize: 11, fontFamily: FONT, outline: "none",
};
const selectStyle: React.CSSProperties = { ...inputStyle, background: C.card };

const Lbl = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>
    {children}{required && <span style={{ color: C.red }}> *</span>}
  </div>
);

const SectionTitle = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
  <div style={{
    fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 10,
    display: "flex", alignItems: "center", gap: 6,
    paddingBottom: 6, borderBottom: `1px solid ${C.border}`,
  }}>
    <span style={{ fontSize: 13 }}>{icon}</span> {children}
  </div>
);

// ─── Helper: parse pressing display date ("D Mon YYYY") to ISO date ────────
function parsePressingDate(d: string): string {
  if (!d) return new Date().toISOString().split("T")[0];
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const m = d.match(/(\d+)\s+(\w+)\s+(\d+)/);
  if (!m) return new Date().toISOString().split("T")[0];
  const [, day, mon, year] = m;
  const mm = months[mon] || "01";
  return `${year}-${mm}-${String(day).padStart(2, "0")}`;
}

// ─── Helper: extract numeric value from pressing oilTemp / oilPressure ───────
function parseNumeric(s: string): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : n;
}

export function CreateProductionOrder({ activeCompanyId, onClose, onCreated, pressingData }: Props) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [creationSuccess, setCreationSuccess] = useState(false);
  const submittingRef = useRef(false);

  // ─── Form State ──────────────────────────────────────────────────────
  const [form, setForm] = useState(() => {
    // Build context notes from pressing data when converting from a pressing shift
    const pressingNotes = pressingData
      ? [
          `[From Pressing Shift: ${pressingData.id}]`,
          `Site: ${pressingData.site} | Line: ${pressingData.line} | Batch: ${pressingData.batch}`,
          `Shift: ${pressingData.shift} | Operator: ${pressingData.operator}`,
          `Input: ${pressingData.inBales} bales · ${pressingData.inWeight} kg (${pressingData.inGrade})`,
          `Output: ${pressingData.outBales} bales · ${pressingData.outWeight} kg`,
          `Sources: ${pressingData.sources}`,
          pressingData.notes ? `Notes: ${pressingData.notes}` : "",
        ].filter(Boolean).join("\n")
      : "";

    return {
      // Step 1: Company & Product
      product_id: 0,
      product_name: "",
      product_uom_id: 0,
      product_uom_name: "",
      product_qty: pressingData ? pressingData.outBales : 0,
      company_id: activeCompanyId === "ALL" ? 0 : activeCompanyId,
      production_date: pressingData ? parsePressingDate(pressingData.date) : new Date().toISOString().split("T")[0],
      // Output Production Location (where finished product goes)
      destination_location_id: 0,
      destination_location_name: "",
      // Step 2: Input Product & Source
      source_location_id: 0,
      source_location_name: "",
      input_product_id: 0,
      input_product_name: "",
      input_product_uom_name: "",
      bom_id: 0,
      bom_name: "",
      // Step 3: Packing Materials
      sleeve_bags: 0,
      strapping_units: 0,
      packing_notes: "",
      // Step 4: Shift Details
      shift_start: pressingData?.startTime || "",
      shift_end: pressingData?.endTime || "",
      actual_hours: 0,
      down_time_minutes: 0,
      notes: pressingNotes,
      // Step 5: Workforce
      supervisor_ids: [] as { id: number; name: string }[],
      production_labor_ids: [] as { id: number; name: string }[],
      quality_labor_ids: [] as { id: number; name: string }[],
      driver_ids: [] as { id: number; name: string }[],
      quality_supervisor_ids: [] as { id: number; name: string }[],
      loading_driver_ids: [] as { id: number; name: string }[],
      labor_ids: [] as { id: number; name: string }[],
      // Step 6: Input Quality
      input_quality_grade: pressingData?.inGrade || "",
      avg_input_bale_weight: pressingData && pressingData.inBales > 0
        ? Math.round(pressingData.inWeight / pressingData.inBales)
        : 0,
      contains_grasses: false,
      grasses_percentage: 0,
      contains_high_moisture: false,
      high_moisture_big_bales: 0,
      high_moisture_small_bales_tons: 0,
      input_quality_notes: pressingData
        ? `Input: ${pressingData.inBales} bales · ${pressingData.inWeight} kg · Grade ${pressingData.inGrade}. Sources: ${pressingData.sources}`
        : "",
      // Step 7: Machine & Diesel
      oil_measurements: 0,
      max_oil_temperature: pressingData ? parseNumeric(pressingData.oilTemp) : 0,
      max_oil_pressure: pressingData ? parseNumeric(pressingData.oilPressure) : 0,
      equipment_failure: false,
      failure_reason: "",
      machine_notes: pressingData
        ? `Density: ${pressingData.density}. Avg output bale: ${pressingData.outAvgBale} kg.`
        : "",
      diesel_liters: pressingData?.fuel || 0,
      diesel_notes: "",
    };
  });

  const setF = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  // ─── Search States ──────────────────────────────────────────────────
  const [productSearch, setProductSearch] = useState("");
  const [inputProductSearch, setInputProductSearch] = useState("");

  const [empSearch, setEmpSearch] = useState("");

  // ─── Lookups ─────────────────────────────────────────────────────────
  const { data: products, isLoading: productsLoading } = trpc.production.products.useQuery(
    { search: productSearch || undefined, type: "finished" }
  );
  const { data: inputProducts, isLoading: inputProductsLoading } = trpc.production.products.useQuery(
    { search: inputProductSearch || undefined, type: "raw" }
  );
  const { data: boms } = trpc.production.boms.useQuery(
    form.product_id ? { productId: form.product_id } : undefined,
    { enabled: !!form.product_id }
  );
  const { data: companies } = trpc.odoo.companies.useQuery();

  // Stock locations for output production location (same as shipment module)
  const { data: stockLocations } = trpc.shipments.stockLocations.useQuery(
    { companyId: form.company_id || undefined },
    { enabled: !!form.company_id }
  );
  // Group locations by warehouse for display
  const locationsByWarehouse = useMemo(() => {
    if (!stockLocations) return [];
    const groups = new Map<string, { warehouseName: string; locations: typeof stockLocations }>();
    for (const loc of stockLocations) {
      const whName = loc.warehouseName || "Other";
      if (!groups.has(whName)) groups.set(whName, { warehouseName: whName, locations: [] });
      groups.get(whName)!.locations.push(loc);
    }
    return Array.from(groups.values());
  }, [stockLocations]);
  const { data: employees, isLoading: empLoading } = trpc.production.employees.useQuery(
    { search: empSearch || undefined }
  );
  const createMutation = trpc.production.create.useMutation();

  // Filter companies to Sokhna & Cairo
  const dpCompanies = useMemo(() =>
    (companies || []).filter(c =>
      /sokhna|cairo/i.test(c.name)
    ), [companies]);

  // Employee options for OdooMultiSelect
  const empOptions = useMemo(() =>
    (employees || []).map(e => ({ id: e.id, name: e.name })),
    [employees]);

  // Product options for OdooSearchSelect
  const prodOptions = useMemo(() =>
    (products || []).map(p => ({ id: p.id, name: `${p.name}${p.uom ? ` (${p.uom.name})` : ""}` })),
    [products]);

  // Input product options for OdooSearchSelect
  const inputProdOptions = useMemo(() =>
    (inputProducts || []).map(p => ({ id: p.id, name: `${p.name}${p.uom ? ` (${p.uom.name})` : ""}` })),
    [inputProducts]);

  // ─── Validation ─────────────────────────────────────────────────────
  const validateStep = (s: number): boolean => {
    setError("");
    if (s === 1) {
      if (!form.company_id) { setError("Please select a company"); return false; }
      if (!form.product_id) { setError("Please select a finished product"); return false; }
    }
    if (s === 4) {
      if (!form.product_qty || form.product_qty <= 0) { setError("Please enter a valid quantity"); return false; }
      if (!form.production_date) { setError("Please enter a production date"); return false; }
    }
    // Other steps are optional — all fields have defaults
    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    setStep(step + 1);
  };

  // ─── Submit ──────────────────────────────────────────────────────────
  const handleRequestSubmit = useCallback(() => {
    setError("");
    if (!form.product_id) { setError("Please select a product"); return; }
    if (!form.product_qty || form.product_qty <= 0) { setError("Please enter a valid quantity"); return; }
    if (!form.company_id) { setError("Please select a company"); return; }
    setShowConfirm(true);
  }, [form]);

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setCreating(true);
    setError("");
    try {
      const payload: any = {
        product_id: form.product_id,
        product_qty: form.product_qty,
        company_id: form.company_id,
      };
      // Step 1 fields
      if (form.destination_location_id) payload.location_dest_id = form.destination_location_id;
      if (form.product_uom_id) payload.product_uom_id = form.product_uom_id;
      if (form.production_date) payload.x_studio_production_date_start_of_shift = form.production_date;
      // Step 2 fields
      if (form.source_location_id) payload.location_src_id = form.source_location_id;
      if (form.input_product_name) payload.x_studio_input_material_source = form.input_product_name;
      else if (form.source_location_name) payload.x_studio_input_material_source = form.source_location_name;
      // Step 3: Packing Materials
      if (form.sleeve_bags) payload.number_sleeve_bags_used = form.sleeve_bags;
      if (form.strapping_units) payload.number_strapping_units_used = form.strapping_units;
      // Step 4: Shift Details
      if (form.shift_start) payload.shift_start_time = form.shift_start;
      if (form.shift_end) payload.shift_end_time = form.shift_end;
      if (form.actual_hours) payload.actual_production_hours = form.actual_hours;
      if (form.down_time_minutes) payload.down_time_minutes = form.down_time_minutes;
      if (form.notes) payload.general_observations_notes = form.notes;
      // Step 5: Workforce
      if (form.supervisor_ids.length) payload.supervisor_ids = form.supervisor_ids.map(e => e.id);
      if (form.production_labor_ids.length) payload.involved_production_labors = form.production_labor_ids.map(e => e.id);
      if (form.quality_labor_ids.length) payload.involved_quality_labors = form.quality_labor_ids.map(e => e.id);
      if (form.driver_ids.length) payload.involved_drivers = form.driver_ids.map(e => e.id);
      if (form.quality_supervisor_ids.length) payload.quality_supervisor_ids = form.quality_supervisor_ids.map(e => e.id);
      if (form.loading_driver_ids.length) payload.loading_driver_ids = form.loading_driver_ids.map(e => e.id);
      if (form.labor_ids.length) payload.labor_ids = form.labor_ids.map(e => e.id);
      // Step 6: Input Quality
      if (form.input_quality_grade) payload.input_product_quality_grade = form.input_quality_grade;
      if (form.avg_input_bale_weight) payload.average_input_big_bale_weight_kg = form.avg_input_bale_weight;
      if (form.contains_grasses) payload.input_product_contain_grasses = true;
      if (form.grasses_percentage) payload.percentage_grasses_input_product = form.grasses_percentage;
      if (form.contains_high_moisture) payload.input_product_contain_high_moisture = true;
      if (form.high_moisture_big_bales) payload.number_high_moisture_big_bales = form.high_moisture_big_bales;
      if (form.high_moisture_small_bales_tons) payload.number_high_moisture_small_bales_tons = form.high_moisture_small_bales_tons;
      if (form.input_quality_notes) payload.input_product_quality_observations = form.input_quality_notes;
      // Step 7: Machine & Diesel
      if (form.oil_measurements) payload.no_oil_measurements_during_shift = form.oil_measurements;
      if (form.max_oil_temperature) payload.maximum_oil_temperature = form.max_oil_temperature;
      if (form.max_oil_pressure) payload.maximum_oil_pressure = form.max_oil_pressure;
      if (form.equipment_failure) payload.is_there_equipment_failure = true;
      if (form.failure_reason) payload.equipment_failure_reason = form.failure_reason;
      if (form.machine_notes) payload.baling_monitoring_notes = form.machine_notes;
      if (form.diesel_liters) payload.diesel_consumption_liters = form.diesel_liters;
      if (form.diesel_notes) payload.diesel_materials_consumption_notes = form.diesel_notes;

      const result = await createMutation.mutateAsync(payload);
      setCreationSuccess(true);
      setTimeout(() => onCreated(result.id, result.name || `MO-${result.id}`), 1500);
    } catch (e: any) {
      setCreating(false);
      submittingRef.current = false;
      setError(e.message || "Failed to create production order");
    }
  };

  // ─── Review Summary ──────────────────────────────────────────────────
  const companyName = useMemo(() =>
    dpCompanies.find(c => c.id === form.company_id)?.name || companies?.find(c => c.id === form.company_id)?.name || "—",
    [form.company_id, dpCompanies, companies]);

  // ─── Step Indicator ──────────────────────────────────────────────────
  const steps = [
    "Company & Product",
    "Input Product & Source",
    "Packing Materials",
    "Shift Details",
    "Workforce",
    "Input Quality",
    "Machine & Diesel",
    "Review",
  ];
  const totalSteps = steps.length;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
    }}>
      <div style={{
        background: C.card, borderRadius: 12, width: 720, maxHeight: "92vh",
        overflow: "auto", boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
        border: `1px solid ${C.border}`,
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 20px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: C.gBg,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>New Production Order</div>
            <div style={{ fontSize: 9, color: C.muted }}>Double Press Production — Step {step} of {totalSteps}</div>
          </div>
          <div onClick={onClose} style={{
            cursor: "pointer", width: 24, height: 24, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: C.gBg2, border: `1px solid ${C.border}`, fontSize: 11, color: C.gray,
          }}>✕</div>
        </div>

        {/* Step Indicator */}
        <div style={{
          display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`,
          background: C.card, overflowX: "auto",
        }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              flex: 1, padding: "7px 6px", textAlign: "center",
              fontSize: 9, fontWeight: step === i + 1 ? 700 : 500,
              color: step === i + 1 ? C.forest : i + 1 < step ? C.sage : C.muted,
              borderBottom: step === i + 1 ? `2px solid ${C.forest}` : "2px solid transparent",
              background: step === i + 1 ? C.gBg2 : "transparent",
              cursor: i + 1 < step ? "pointer" : "default",
              whiteSpace: "nowrap",
            }} onClick={() => { if (i + 1 < step) setStep(i + 1); }}>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 15, height: 15, borderRadius: "50%", fontSize: 8, fontWeight: 700,
                background: step === i + 1 ? C.forest : i + 1 < step ? C.sage : C.border,
                color: C.white, marginRight: 3,
              }}>{i + 1 < step ? "✓" : i + 1}</span>
              {s}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: 20, minHeight: 300 }}>
          {/* Error */}
          {error && (
            <div style={{
              padding: "8px 12px", background: "#FEF2F2", border: `1px solid ${C.red}33`,
              borderRadius: 6, marginBottom: 12, fontSize: 11, color: C.red, fontWeight: 600,
            }}>⚠ {error}</div>
          )}

          {/* Pressing Data Banner */}
          {pressingData && (
            <div style={{
              padding: "10px 14px", background: "#F2F7F3", border: "1px solid #CDDDD1",
              borderRadius: 8, marginBottom: 14,
              display: "flex", alignItems: "flex-start", gap: 10,
            }}>
              <div style={{ fontSize: 18, lineHeight: 1 }}>⚙</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#2D5A3D", marginBottom: 3 }}>
                  Converting from Pressing Shift: {pressingData.id}
                </div>
                <div style={{ fontSize: 9, color: "#4A7C59", lineHeight: 1.6 }}>
                  {pressingData.site} · {pressingData.line} · Batch {pressingData.batch} · {pressingData.shift} shift
                  &nbsp;&nbsp;|&nbsp;&nbsp;
                  Input: {pressingData.inBales} bales · {pressingData.inWeight.toLocaleString()} kg ({pressingData.inGrade})
                  &nbsp;&nbsp;|&nbsp;&nbsp;
                  Output: {pressingData.outBales} bales · {pressingData.outWeight.toLocaleString()} kg
                </div>
                <div style={{ fontSize: 9, color: "#64706C", marginTop: 2 }}>
                  Shift details, input quality, and machine data have been pre-filled from this record.
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 1: Company & Product ═══ */}
          {step === 1 && (
            <div>
              <SectionTitle icon="🏢">Company & Product Selection</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Lbl required>Company</Lbl>
                  <select value={form.company_id} onChange={e => setF("company_id", parseInt(e.target.value))} style={selectStyle}>
                    <option value={0}>Select company...</option>
                    {dpCompanies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <Lbl>Output Production Location</Lbl>
                  <select
                    value={form.destination_location_id}
                    onChange={e => {
                      const locId = Number(e.target.value);
                      const loc = stockLocations?.find(l => l.id === locId);
                      setF("destination_location_id", locId);
                      setF("destination_location_name", loc?.completeName || "");
                    }}
                    style={selectStyle}
                  >
                    <option value={0}>Select output production location...</option>
                    {locationsByWarehouse.map(group => (
                      <optgroup key={group.warehouseName} label={group.warehouseName}>
                        {group.locations.map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.completeName}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>
                    Where the finished product will be stored (same locations used for shipping/selling)
                  </div>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <Lbl required>Finished Product</Lbl>
                  <OdooSearchSelect
                    value={form.product_id ? { id: form.product_id, name: form.product_name } : null}
                    onChange={(sel) => {
                      if (sel) {
                        const prod = products?.find(p => p.id === sel.id);
                        setF("product_id", sel.id);
                        setF("product_name", sel.name);
                        if (prod?.uom) {
                          setF("product_uom_id", prod.uom.id);
                          setF("product_uom_name", prod.uom.name);
                        }

                      } else {
                        setF("product_id", 0);
                        setF("product_name", "");
                        setF("product_uom_id", 0);
                        setF("product_uom_name", "");

                      }
                    }}
                    options={prodOptions}
                    onSearch={setProductSearch}
                    isLoading={productsLoading}
                    placeholder="Search for a finished product..."
                  />
                </div>

                <div>
                  <Lbl required>Quantity to Produce</Lbl>
                  <input type="number" min="0" step="0.01" value={form.product_qty || ""} onChange={e => setF("product_qty", parseFloat(e.target.value) || 0)} style={inputStyle} placeholder="e.g. 100" />
                  {form.product_uom_name && (
                    <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>UoM: {form.product_uom_name}</div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* ═══ STEP 2: Input Product & Source ═══ */}
          {step === 2 && (
            <div>
              <SectionTitle icon="📦">Input Product & Source</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Lbl>Source Location (Input Materials)</Lbl>
                  <select
                    value={form.source_location_id}
                    onChange={e => {
                      const locId = Number(e.target.value);
                      const loc = stockLocations?.find(l => l.id === locId);
                      setF("source_location_id", locId);
                      setF("source_location_name", loc?.completeName || "");
                    }}
                    style={selectStyle}
                  >
                    <option value={0}>Select source location...</option>
                    {locationsByWarehouse.map(group => (
                      <optgroup key={group.warehouseName} label={group.warehouseName}>
                        {group.locations.map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.completeName}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>
                    Where the raw materials are coming from (warehouse/stock location)
                  </div>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <Lbl>Input Product (Raw Material)</Lbl>
                  <OdooSearchSelect
                    value={form.input_product_id ? { id: form.input_product_id, name: form.input_product_name } : null}
                    onChange={(sel) => {
                      if (sel) {
                        const prod = inputProducts?.find(p => p.id === sel.id);
                        setF("input_product_id", sel.id);
                        setF("input_product_name", sel.name);
                        setF("input_product_uom_name", prod?.uom?.name || "");
                      } else {
                        setF("input_product_id", 0);
                        setF("input_product_name", "");
                        setF("input_product_uom_name", "");
                      }
                    }}
                    options={inputProdOptions}
                    onSearch={setInputProductSearch}
                    isLoading={inputProductsLoading}
                    placeholder="Search for an input product (raw material)..."
                  />
                  <div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>
                    The raw material product to be consumed in production
                  </div>
                </div>

                {/* ─── Stock Availability Check ─── */}
                {form.bom_id > 0 && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <AvailabilityTable bomId={form.bom_id} warehouseId={form.source_location_id || undefined} qtyToProduce={form.product_qty || 1} />
                  </div>
                )}
                {form.bom_id === 0 && form.product_id > 0 && (
                  <div style={{ gridColumn: "1 / -1", padding: 10, background: C.gBg, borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 10, color: C.muted }}>
                    Stock availability will be shown once Odoo assigns a BOM.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ STEP 3: Packing Materials ═══ */}
          {step === 3 && (
            <div>
              <SectionTitle icon="📋">Packing Materials</SectionTitle>
              <div style={{
                padding: 12, background: C.gBg, borderRadius: 8, border: `1px solid ${C.gBdr}`,
                marginBottom: 16,
              }}>
                <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.5 }}>
                  Enter the quantities of packing materials used during this production shift. These are tracked separately from diesel and machine monitoring.
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{
                  padding: 16, background: C.card, borderRadius: 8,
                  border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: `${C.forest}12`, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16,
                    }}>🛍️</div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.dark }}>Sleeve Bags</div>
                      <div style={{ fontSize: 9, color: C.muted }}>Protective sleeve bags used for bale wrapping</div>
                    </div>
                  </div>
                  <Lbl>Quantity Used</Lbl>
                  <input
                    type="number"
                    min="0"
                    value={form.sleeve_bags || ""}
                    onChange={e => setF("sleeve_bags", parseInt(e.target.value) || 0)}
                    style={inputStyle}
                    placeholder="e.g. 50"
                  />
                </div>

                <div style={{
                  padding: 16, background: C.card, borderRadius: 8,
                  border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: `${C.terra}12`, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16,
                    }}>🔗</div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.dark }}>Strapping Units</div>
                      <div style={{ fontSize: 9, color: C.muted }}>Strapping material units used for bale securing</div>
                    </div>
                  </div>
                  <Lbl>Quantity Used</Lbl>
                  <input
                    type="number"
                    min="0"
                    value={form.strapping_units || ""}
                    onChange={e => setF("strapping_units", parseInt(e.target.value) || 0)}
                    style={inputStyle}
                    placeholder="e.g. 30"
                  />
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <Lbl>Packing Notes</Lbl>
                <textarea
                  value={form.packing_notes}
                  onChange={e => setF("packing_notes", e.target.value)}
                  style={{ ...inputStyle, minHeight: 50, resize: "vertical" }}
                  placeholder="Any notes about packing materials usage..."
                />
              </div>
            </div>
          )}

          {/* ═══ STEP 4: Shift Details ═══ */}
          {step === 4 && (
            <div>
              <SectionTitle icon="⏰">Shift & Production Details</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <Lbl required>Production Date</Lbl>
                  <input type="date" value={form.production_date} onChange={e => setF("production_date", e.target.value)} style={inputStyle} />
                </div>

                <div />

                <div>
                  <Lbl>Shift Start Time</Lbl>
                  <input type="time" value={form.shift_start} onChange={e => setF("shift_start", e.target.value)} style={inputStyle} />
                </div>

                <div>
                  <Lbl>Shift End Time</Lbl>
                  <input type="time" value={form.shift_end} onChange={e => setF("shift_end", e.target.value)} style={inputStyle} />
                </div>

                <div>
                  <Lbl>Actual Production Hours</Lbl>
                  <input type="number" min="0" step="0.1" value={form.actual_hours || ""} onChange={e => setF("actual_hours", parseFloat(e.target.value) || 0)} style={inputStyle} placeholder="e.g. 8.5" />
                </div>

                <div>
                  <Lbl>Down Time (minutes)</Lbl>
                  <input type="number" min="0" value={form.down_time_minutes || ""} onChange={e => setF("down_time_minutes", parseInt(e.target.value) || 0)} style={inputStyle} placeholder="e.g. 30" />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <Lbl>General Notes</Lbl>
                  <textarea value={form.notes} onChange={e => setF("notes", e.target.value)} style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} placeholder="Any observations about this shift..." />
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 5: Workforce ═══ */}
          {step === 5 && (
            <div>
              <SectionTitle icon="👷">Production Team Assignment</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <Lbl>Supervisors</Lbl>
                  <OdooMultiSelect
                    value={form.supervisor_ids}
                    onChange={(sel) => setF("supervisor_ids", sel)}
                    options={empOptions}
                    onSearch={setEmpSearch}
                    isLoading={empLoading}
                    placeholder="Search supervisors..."
                    accentColor={C.forest}
                  />
                </div>

                <div>
                  <Lbl>Production Labors</Lbl>
                  <OdooMultiSelect
                    value={form.production_labor_ids}
                    onChange={(sel) => setF("production_labor_ids", sel)}
                    options={empOptions}
                    onSearch={setEmpSearch}
                    isLoading={empLoading}
                    placeholder="Search labors..."
                    accentColor={C.forest}
                  />
                </div>

                <div>
                  <Lbl>Quality Labors</Lbl>
                  <OdooMultiSelect
                    value={form.quality_labor_ids}
                    onChange={(sel) => setF("quality_labor_ids", sel)}
                    options={empOptions}
                    onSearch={setEmpSearch}
                    isLoading={empLoading}
                    placeholder="Search quality labors..."
                    accentColor="#E76F51"
                  />
                </div>

                <div>
                  <Lbl>Drivers</Lbl>
                  <OdooMultiSelect
                    value={form.driver_ids}
                    onChange={(sel) => setF("driver_ids", sel)}
                    options={empOptions}
                    onSearch={setEmpSearch}
                    isLoading={empLoading}
                    placeholder="Search drivers..."
                    accentColor="#264653"
                  />
                </div>

                <div>
                  <Lbl>Quality Supervisors</Lbl>
                  <OdooMultiSelect
                    value={form.quality_supervisor_ids}
                    onChange={(sel) => setF("quality_supervisor_ids", sel)}
                    options={empOptions}
                    onSearch={setEmpSearch}
                    isLoading={empLoading}
                    placeholder="Search quality supervisors..."
                    accentColor="#E76F51"
                  />
                </div>

                <div>
                  <Lbl>Loading Drivers</Lbl>
                  <OdooMultiSelect
                    value={form.loading_driver_ids}
                    onChange={(sel) => setF("loading_driver_ids", sel)}
                    options={empOptions}
                    onSearch={setEmpSearch}
                    isLoading={empLoading}
                    placeholder="Search loading drivers..."
                    accentColor="#264653"
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <Lbl>General Labor</Lbl>
                  <OdooMultiSelect
                    value={form.labor_ids}
                    onChange={(sel) => setF("labor_ids", sel)}
                    options={empOptions}
                    onSearch={setEmpSearch}
                    isLoading={empLoading}
                    placeholder="Search general labor..."
                    accentColor={C.sage}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 6: Input Quality ═══ */}
          {step === 6 && (
            <div>
              <SectionTitle icon="🔍">Input Product Quality</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <Lbl>Input Quality Grade</Lbl>
                  <select value={form.input_quality_grade} onChange={e => setF("input_quality_grade", e.target.value)} style={selectStyle}>
                    <option value="">Select grade...</option>
                    {INPUT_QUALITY_GRADES.map(g => (
                      <option key={g.id} value={g.id}>{g.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Lbl>Avg Input Big Bale Weight (kg)</Lbl>
                  <input type="number" min="0" step="0.1" value={form.avg_input_bale_weight || ""} onChange={e => setF("avg_input_bale_weight", parseFloat(e.target.value) || 0)} style={inputStyle} placeholder="e.g. 450" />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                  <input type="checkbox" checked={form.contains_grasses} onChange={e => setF("contains_grasses", e.target.checked)} style={{ accentColor: C.forest }} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: C.dark }}>Contains Grasses</div>
                    <div style={{ fontSize: 9, color: C.muted }}>Input product contains grass contamination</div>
                  </div>
                </div>

                {form.contains_grasses && (
                  <div>
                    <Lbl>Grasses Percentage (%)</Lbl>
                    <input type="number" min="0" max="100" step="0.1" value={form.grasses_percentage || ""} onChange={e => setF("grasses_percentage", parseFloat(e.target.value) || 0)} style={inputStyle} placeholder="e.g. 15" />
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                  <input type="checkbox" checked={form.contains_high_moisture} onChange={e => setF("contains_high_moisture", e.target.checked)} style={{ accentColor: C.forest }} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: C.dark }}>Contains High Moisture</div>
                    <div style={{ fontSize: 9, color: C.muted }}>Input product has high moisture content</div>
                  </div>
                </div>

                {form.contains_high_moisture && (
                  <>
                    <div>
                      <Lbl>High Moisture Big Bales</Lbl>
                      <input type="number" min="0" value={form.high_moisture_big_bales || ""} onChange={e => setF("high_moisture_big_bales", parseInt(e.target.value) || 0)} style={inputStyle} />
                    </div>
                    <div>
                      <Lbl>High Moisture Small Bales (tons)</Lbl>
                      <input type="number" min="0" step="0.01" value={form.high_moisture_small_bales_tons || ""} onChange={e => setF("high_moisture_small_bales_tons", parseFloat(e.target.value) || 0)} style={inputStyle} />
                    </div>
                  </>
                )}

                <div style={{ gridColumn: "1 / -1" }}>
                  <Lbl>Input Quality Notes</Lbl>
                  <textarea value={form.input_quality_notes} onChange={e => setF("input_quality_notes", e.target.value)} style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} placeholder="Observations about input product quality..." />
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 7: Machine & Diesel ═══ */}
          {step === 7 && (
            <div>
              <SectionTitle icon="⚙️">Baling Machine Monitoring</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <Lbl>Oil Measurements During Shift</Lbl>
                  <input type="number" min="0" value={form.oil_measurements || ""} onChange={e => setF("oil_measurements", parseInt(e.target.value) || 0)} style={inputStyle} placeholder="e.g. 4" />
                </div>

                <div>
                  <Lbl>Max Oil Temperature (°C)</Lbl>
                  <input type="number" min="0" step="0.1" value={form.max_oil_temperature || ""} onChange={e => setF("max_oil_temperature", parseFloat(e.target.value) || 0)} style={inputStyle} placeholder="e.g. 85" />
                </div>

                <div>
                  <Lbl>Max Oil Pressure (bar)</Lbl>
                  <input type="number" min="0" step="0.1" value={form.max_oil_pressure || ""} onChange={e => setF("max_oil_pressure", parseFloat(e.target.value) || 0)} style={inputStyle} placeholder="e.g. 200" />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                  <input type="checkbox" checked={form.equipment_failure} onChange={e => setF("equipment_failure", e.target.checked)} style={{ accentColor: C.red }} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: C.dark }}>Equipment Failure</div>
                    <div style={{ fontSize: 9, color: C.muted }}>Report any equipment failure during shift</div>
                  </div>
                </div>

                {form.equipment_failure && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Lbl>Failure Reason</Lbl>
                    <select value={form.failure_reason} onChange={e => setF("failure_reason", e.target.value)} style={selectStyle}>
                      <option value="">Select reason...</option>
                      {EQUIPMENT_FAILURE_REASONS.filter(r => r.id !== "no_problem").map(r => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ gridColumn: "1 / -1" }}>
                  <Lbl>Machine Notes</Lbl>
                  <textarea value={form.machine_notes} onChange={e => setF("machine_notes", e.target.value)} style={{ ...inputStyle, minHeight: 40, resize: "vertical" }} placeholder="Baling machine observations..." />
                </div>
              </div>

              <SectionTitle icon="⛽">Diesel Consumption</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <Lbl>Diesel Consumption (liters)</Lbl>
                  <input type="number" min="0" step="0.1" value={form.diesel_liters || ""} onChange={e => setF("diesel_liters", parseFloat(e.target.value) || 0)} style={inputStyle} placeholder="e.g. 120" />
                </div>

                <div />

                <div style={{ gridColumn: "1 / -1" }}>
                  <Lbl>Diesel Notes</Lbl>
                  <textarea value={form.diesel_notes} onChange={e => setF("diesel_notes", e.target.value)} style={{ ...inputStyle, minHeight: 40, resize: "vertical" }} placeholder="Notes about diesel consumption..." />
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 8: Review ═══ */}
          {step === 8 && (
            <div>
              <SectionTitle icon="✅">Order Summary — Review & Submit</SectionTitle>
              <div style={{
                padding: 16, background: C.gBg, borderRadius: 8, border: `1px solid ${C.gBdr}`,
              }}>
                {/* Company & Product */}
                <div style={{ fontSize: 10, fontWeight: 700, color: C.forest, marginBottom: 6, textTransform: "uppercase" }}>Company & Product</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
                  {[
                    { label: "Company", value: companyName },
                    { label: "Output Location", value: form.destination_location_name || "—" },
                    { label: "Product", value: form.product_name || "—" },
                    { label: "Quantity", value: `${form.product_qty} ${form.product_uom_name || ""}` },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: "3px 0", borderBottom: `1px solid ${C.border}22` }}>
                      <div style={{ fontSize: 8, color: C.sage, fontWeight: 600, textTransform: "uppercase" }}>{item.label}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: C.dark, fontFamily: MONO }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {/* Input Product & Source */}
                <div style={{ fontSize: 10, fontWeight: 700, color: C.forest, marginBottom: 6, textTransform: "uppercase" }}>Input Product & Source</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
                  {[
                    { label: "Source Location", value: form.source_location_name || "—" },
                    { label: "Input Product", value: form.input_product_name || "—" },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: "3px 0", borderBottom: `1px solid ${C.border}22` }}>
                      <div style={{ fontSize: 8, color: C.sage, fontWeight: 600, textTransform: "uppercase" }}>{item.label}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: C.dark, fontFamily: MONO }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {/* Packing Materials */}
                {(form.sleeve_bags > 0 || form.strapping_units > 0) && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.forest, marginBottom: 6, textTransform: "uppercase" }}>Packing Materials</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
                      {form.sleeve_bags > 0 && (
                        <div style={{ padding: "3px 0", borderBottom: `1px solid ${C.border}22` }}>
                          <div style={{ fontSize: 8, color: C.sage, fontWeight: 600, textTransform: "uppercase" }}>Sleeve Bags</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.dark, fontFamily: MONO }}>{form.sleeve_bags}</div>
                        </div>
                      )}
                      {form.strapping_units > 0 && (
                        <div style={{ padding: "3px 0", borderBottom: `1px solid ${C.border}22` }}>
                          <div style={{ fontSize: 8, color: C.sage, fontWeight: 600, textTransform: "uppercase" }}>Strapping Units</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.dark, fontFamily: MONO }}>{form.strapping_units}</div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Shift Details */}
                <div style={{ fontSize: 10, fontWeight: 700, color: C.forest, marginBottom: 6, textTransform: "uppercase" }}>Shift Details</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
                  {[
                    { label: "Production Date", value: form.production_date || "—" },
                    { label: "Shift", value: form.shift_start && form.shift_end ? `${form.shift_start} → ${form.shift_end}` : "—" },
                    { label: "Actual Hours", value: form.actual_hours ? `${form.actual_hours} hrs` : "—" },
                    { label: "Down Time", value: form.down_time_minutes ? `${form.down_time_minutes} min` : "—" },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: "3px 0", borderBottom: `1px solid ${C.border}22` }}>
                      <div style={{ fontSize: 8, color: C.sage, fontWeight: 600, textTransform: "uppercase" }}>{item.label}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: C.dark, fontFamily: MONO }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {/* Workforce */}
                {(form.supervisor_ids.length > 0 || form.production_labor_ids.length > 0 || form.driver_ids.length > 0 || form.quality_labor_ids.length > 0 || form.quality_supervisor_ids.length > 0 || form.loading_driver_ids.length > 0 || form.labor_ids.length > 0) && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.forest, marginBottom: 6, textTransform: "uppercase" }}>Workforce</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
                      {[
                        { label: "Supervisors", people: form.supervisor_ids },
                        { label: "Production Labors", people: form.production_labor_ids },
                        { label: "Quality Labors", people: form.quality_labor_ids },
                        { label: "Drivers", people: form.driver_ids },
                        { label: "Quality Supervisors", people: form.quality_supervisor_ids },
                        { label: "Loading Drivers", people: form.loading_driver_ids },
                        { label: "General Labor", people: form.labor_ids },
                      ].filter(g => g.people.length > 0).map((g, i) => (
                        <div key={i} style={{ padding: "3px 0", borderBottom: `1px solid ${C.border}22` }}>
                          <div style={{ fontSize: 8, color: C.sage, fontWeight: 600, textTransform: "uppercase" }}>{g.label}</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.dark }}>{g.people.map(p => p.name).join(", ")}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Quality */}
                {(form.input_quality_grade || form.avg_input_bale_weight > 0 || form.contains_grasses || form.contains_high_moisture) && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.forest, marginBottom: 6, textTransform: "uppercase" }}>Input Quality</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
                      {form.input_quality_grade && (
                        <div style={{ padding: "3px 0" }}>
                          <div style={{ fontSize: 8, color: C.sage, fontWeight: 600, textTransform: "uppercase" }}>Grade</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.dark }}>{form.input_quality_grade}</div>
                        </div>
                      )}
                      {form.avg_input_bale_weight > 0 && (
                        <div style={{ padding: "3px 0" }}>
                          <div style={{ fontSize: 8, color: C.sage, fontWeight: 600, textTransform: "uppercase" }}>Avg Bale Weight</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.dark }}>{form.avg_input_bale_weight} kg</div>
                        </div>
                      )}
                      {form.contains_grasses && (
                        <div style={{ padding: "3px 0" }}>
                          <div style={{ fontSize: 8, color: C.sage, fontWeight: 600, textTransform: "uppercase" }}>Grasses</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.dark }}>Yes ({form.grasses_percentage}%)</div>
                        </div>
                      )}
                      {form.contains_high_moisture && (
                        <div style={{ padding: "3px 0" }}>
                          <div style={{ fontSize: 8, color: C.sage, fontWeight: 600, textTransform: "uppercase" }}>High Moisture</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.dark }}>Big: {form.high_moisture_big_bales}, Small: {form.high_moisture_small_bales_tons}t</div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Machine & Diesel */}
                {(form.diesel_liters > 0 || form.oil_measurements > 0 || form.equipment_failure) && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.forest, marginBottom: 6, textTransform: "uppercase" }}>Machine & Diesel</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
                      {form.diesel_liters > 0 && (
                        <div style={{ padding: "3px 0" }}>
                          <div style={{ fontSize: 8, color: C.sage, fontWeight: 600, textTransform: "uppercase" }}>Diesel</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.dark }}>{form.diesel_liters} L</div>
                        </div>
                      )}
                      {form.oil_measurements > 0 && (
                        <div style={{ padding: "3px 0" }}>
                          <div style={{ fontSize: 8, color: C.sage, fontWeight: 600, textTransform: "uppercase" }}>Oil Measurements</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.dark }}>{form.oil_measurements}</div>
                        </div>
                      )}
                      {form.max_oil_temperature > 0 && (
                        <div style={{ padding: "3px 0" }}>
                          <div style={{ fontSize: 8, color: C.sage, fontWeight: 600, textTransform: "uppercase" }}>Max Oil Temp</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.dark }}>{form.max_oil_temperature}°C</div>
                        </div>
                      )}
                      {form.equipment_failure && (
                        <div style={{ padding: "3px 0", gridColumn: "1 / -1" }}>
                          <div style={{ fontSize: 8, color: C.red, fontWeight: 600, textTransform: "uppercase" }}>Equipment Failure</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.red }}>{form.failure_reason || "Yes"}</div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {form.notes && (
                  <div style={{ marginTop: 4, padding: "6px 10px", background: C.gBg2, borderRadius: 6, border: `1px solid ${C.gBdr}` }}>
                    <div style={{ fontSize: 9, color: C.sage, fontWeight: 600 }}>NOTES</div>
                    <div style={{ fontSize: 10, color: C.dark, marginTop: 2 }}>{form.notes}</div>
                  </div>
                )}
              </div>

              <div style={{
                marginTop: 12, padding: "8px 12px", background: "#FFFBEB",
                border: `1px solid ${C.amber}33`, borderRadius: 6, fontSize: 10, color: C.amber,
              }}>
                ⚠ This will create a new Production Order in Odoo with all the data above. You can continue editing after creation.
              </div>
            </div>
          )}

          {/* Creation Success */}
          {creationSuccess && (
            <div style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
              display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400,
            }}>
              <div style={{
                background: C.card, borderRadius: 12, padding: 32, textAlign: "center",
                boxShadow: "0 16px 48px rgba(0,0,0,0.3)",
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.forest }}>Production Order Created</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Redirecting to order details...</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px", borderTop: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: C.gBg,
        }}>
          <div style={{ display: "flex", gap: 6 }}>
            {step > 1 && (
              <Btn onClick={() => setStep(step - 1)} small outline>← Back</Btn>
            )}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Btn onClick={onClose} small color={C.gray} outline>Cancel</Btn>
            {step < totalSteps ? (
              <Btn onClick={handleNext} small>Next →</Btn>
            ) : (
              <Btn onClick={handleRequestSubmit} small disabled={creating}>
                {creating ? "Creating..." : "Create Order"}
              </Btn>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={showConfirm}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title="Create Production Order?"
        confirmLabel="Yes, Create"
        cancelLabel="Go Back"
        message={
          <div style={{ fontSize: 11, color: C.dark, lineHeight: 1.5 }}>
            <p>This will create a new Production Order in Odoo:</p>
            <div style={{ marginTop: 8, padding: 8, background: C.gBg, borderRadius: 6, border: `1px solid ${C.gBdr}` }}>
              <div><strong>Product:</strong> {form.product_name}</div>
              <div><strong>Quantity:</strong> {form.product_qty} {form.product_uom_name || ""}</div>
              <div><strong>Company:</strong> {companyName}</div>
              {form.destination_location_name && <div><strong>Output Location:</strong> {form.destination_location_name}</div>}
              {form.source_location_name && <div><strong>Source Location:</strong> {form.source_location_name}</div>}
              {form.input_product_name && <div><strong>Input Product:</strong> {form.input_product_name}</div>}
              {(form.sleeve_bags > 0 || form.strapping_units > 0) && (
                <div><strong>Packing:</strong> {form.sleeve_bags > 0 ? `${form.sleeve_bags} sleeve bags` : ""}{form.sleeve_bags > 0 && form.strapping_units > 0 ? ", " : ""}{form.strapping_units > 0 ? `${form.strapping_units} strapping units` : ""}</div>
              )}
            </div>
          </div>
        }
      />
    </div>
  );
}

// ─── Stock Availability Table ─────────────────────────────────────────────────
function AvailabilityTable({ bomId, warehouseId, qtyToProduce }: { bomId: number; warehouseId?: number; qtyToProduce: number }) {
  const { data, isLoading, error } = trpc.production.bomAvailability.useQuery(
    { bomId, warehouseId, qtyToProduce },
    { enabled: bomId > 0 }
  );

  if (isLoading) return (
    <div style={{ padding: 12, background: C.gBg, borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 10, color: C.muted, textAlign: "center" }}>
      Loading stock availability...
    </div>
  );
  if (error) return (
    <div style={{ padding: 12, background: "#fef2f2", borderRadius: 6, border: "1px solid #fecaca", fontSize: 10, color: C.red }}>
      Could not load availability: {error.message}
    </div>
  );
  if (!data || data.components.length === 0) return (
    <div style={{ padding: 12, background: C.gBg, borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 10, color: C.muted }}>
      No BOM components found.
    </div>
  );

  return (
    <div style={{ borderRadius: 6, border: `1px solid ${C.border}`, overflow: "hidden" }}>
      <div style={{
        padding: "8px 12px", background: data.allAvailable ? C.gBg2 : "#fef3c7",
        borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: data.allAvailable ? C.forest : "#92400e" }}>
          {data.allAvailable ? "✓ All Materials Available" : "⚠ Some Materials Insufficient"}
        </div>
        <div style={{ fontSize: 9, color: C.muted }}>
          {data.components.length} component{data.components.length !== 1 ? "s" : ""}
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
        <thead>
          <tr style={{ background: C.gBg, borderBottom: `1px solid ${C.border}` }}>
            <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: C.sage, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>Material</th>
            <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600, color: C.sage, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>Required</th>
            <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600, color: C.sage, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>On Hand</th>
            <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600, color: C.sage, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>Available</th>
            <th style={{ padding: "6px 10px", textAlign: "center", fontWeight: 600, color: C.sage, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.components.map((c) => (
            <tr key={c.productId} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: "6px 10px", color: C.dark }}>
                <div style={{ fontWeight: 500 }}>{c.productName}</div>
                {c.uom && <div style={{ fontSize: 8, color: C.muted }}>{c.uom}</div>}
              </td>
              <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: MONO, color: C.dark }}>
                {c.requiredQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>
              <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: MONO, color: C.dark }}>
                {c.onHand.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>
              <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: MONO, color: c.sufficient ? C.forest : C.red, fontWeight: 600 }}>
                {c.available.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>
              <td style={{ padding: "6px 10px", textAlign: "center" }}>
                <span style={{
                  display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 600,
                  background: c.sufficient ? C.gBg2 : "#fef2f2",
                  color: c.sufficient ? C.forest : C.red,
                  border: `1px solid ${c.sufficient ? C.gBdr : "#fecaca"}`,
                }}>
                  {c.sufficient ? "✓ OK" : "✗ Low"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
