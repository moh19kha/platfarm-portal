/**
 * CreateOdooShipment — Modal form to create a new Purchase Shipment
 * Supports: vendor selection, agreement link, product lines, shipping details
 */
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { C, FONT, MONO } from "@/lib/data";
import { Btn } from "@/components/ui-primitives";
import { SearchableProductSelect } from "@/components/SearchableProductSelect";
import { ViewStockButton } from "@/components/StockViewerPopup";
import { PortSelector } from "@/components/PortSelector";
import { CreationProgressModal } from "@/components/CreationProgressModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface ProcurementData {
  // Procurement fields
  odooId: number;
  id: string;           // e.g. "RCV-0043"
  supplier: string;
  commodity: string;
  grade: string;
  net: number;          // net weight in kg
  price: number;        // price per ton
  incoterm: string;
  plate: string;        // truck plate
  bales: number;
  // Quality assessment fields (optional — may not have QC yet)
  qcData?: {
    odooId: number;
    id: string;         // e.g. "QC-0028"
    moisture: string;
    moistureWeight: string;
    protein: string;
    color: string;
    leafRatio: string;
    foreignMatter: string;
    odor: string;
    density: string;
    verdict: string;
    finalGrade: string;
    g1: number;
    g2: number;
    mix: number;
    notes: string;
    inspector: string;
    baleHeight: number;
    avgWeight: number;
  };
}

interface Props {
  activeCompanyId: number | "ALL";
  onClose: () => void;
  onCreated: (id: number, poName: string) => void;
  draftId?: number; // If provided, resume from this draft
  procurementData?: ProcurementData; // If provided, pre-fill from procurement
}

interface LineInput {
  product_id: number;
  product_qty: number;
  price_unit: number;
  product_uom: number;
  date_planned: string;
  tax_rate: number; // VAT percentage: 0, 5, 14, or 15
}

const VAT_OPTIONS = [
  { value: 0, label: "0%" },
  { value: 5, label: "5%" },
  { value: 14, label: "14%" },
  { value: 15, label: "15%" },
];

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "5px 8px", border: `1px solid ${C.border}`,
  borderRadius: 5, fontSize: 11, fontFamily: FONT, outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, background: C.card,
};

const Lbl = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</div>
);

// Build quality notes summary for PO notes field
function buildQualityNotes(proc: ProcurementData): string {
  const lines: string[] = [];
  lines.push(`=== Procurement Reference: ${proc.id} ===`);
  lines.push(`Supplier: ${proc.supplier}`);
  lines.push(`Commodity: ${proc.commodity} | Grade: ${proc.grade}`);
  lines.push(`Net Weight: ${proc.net.toLocaleString()} kg | Price/ton: ${proc.price}`);
  lines.push(`Incoterm: ${proc.incoterm} | Truck Plate: ${proc.plate}`);
  lines.push(`Bales: ${proc.bales}`);
  if (proc.qcData) {
    const q = proc.qcData;
    lines.push("");
    lines.push(`=== Quality Assessment: ${q.id} ===`);
    lines.push(`Inspector: ${q.inspector}`);
    lines.push(`Verdict: ${q.verdict} | Final Grade: ${q.finalGrade}`);
    lines.push(`Color: ${q.color} | Leaf Ratio: ${q.leafRatio} | Density: ${q.density}`);
    lines.push(`Moisture: ${q.moisture} (Weight: ${q.moistureWeight}) | Protein (NIR): ${q.protein}`);
    lines.push(`Foreign Matter: ${q.foreignMatter} | Odor: ${q.odor}`);
    lines.push(`Bale Height: ${q.baleHeight} cm | Avg Bale Weight: ${q.avgWeight} kg`);
    lines.push(`Grade Split — G1: ${q.g1} bales | G2: ${q.g2} bales | Mix: ${q.mix} bales`);
    if (q.notes) lines.push(`QC Notes: ${q.notes}`);
  }
  return lines.join("\n");
}

export function CreateOdooShipment({ activeCompanyId, onClose, onCreated, draftId, procurementData }: Props) {
  // ─── Form State ──────────────────────────────────────────────────────
  const [form, setForm] = useState({
    partner_id: 0,
    company_id: activeCompanyId === "ALL" ? 0 : activeCompanyId,
    currency_id: 0,
    requisition_id: 0,
    date_order: new Date().toISOString().split("T")[0],
    date_planned: "",
    number_of_loads: 0,
    x_studio_vessel_name: procurementData?.plate || "",
    x_studio_tracking_number: "",

    eta_arrival: "",
    pol_source: "",
    pod_source: "",
    x_studio_booking_number: "",
    x_studio_etd_pol: "",
    x_studio_eta_pol: "",
    vessel_cut_off: "",

    freight_type: "",
    load_type: "truck_load",
    ocean_transporter_company: "",
    incoterm_id: 0,
    payment_term_id: 0,
    x_studio_ultimate_customer: "",
    pol_free_days_demurrage: 0,
    pol_free_days_detention: 0,
    pod_free_days_demurrage: 0,
    pod_free_days_detention: 0,
    picking_type_id: 0,
    destination_location_id: 0,
    // Procurement-sourced fields
    origin: procurementData ? procurementData.id : "",
    notes: procurementData ? buildQualityNotes(procurementData) : "",
  });

  const [lines, setLines] = useState<LineInput[]>([{
    product_id: 0,
    product_qty: procurementData ? procurementData.net / 1000 : 0, // convert kg → tons
    price_unit: procurementData ? procurementData.price : 0,
    product_uom: 0,
    date_planned: "",
    tax_rate: 0,
  }]);

  const [distributeWeightEqually, setDistributeWeightEqually] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const submittingRef = useRef(false);
  const [creationError, setCreationError] = useState("");
  const [creationSuccess, setCreationSuccess] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [step, setStep] = useState(1); // 1=Basic, 2=Lines, 3=Shipping
  const [currentDraftId, setCurrentDraftId] = useState<number | undefined>(draftId);
  const [draftSaved, setDraftSaved] = useState(false);

  // ─── Lookups (filtered by selected company) ─────────────────────────────────
  const selectedCompanyId = form.company_id || (activeCompanyId === "ALL" ? undefined : activeCompanyId);
  const { data: vendors } = trpc.odoo.vendors.useQuery(
    selectedCompanyId ? { companyId: selectedCompanyId } : undefined
  );
  const { data: currencies } = trpc.odoo.currencies.useQuery();
  const { data: uoms } = trpc.odoo.uoms.useQuery();
  const { data: companies } = trpc.odoo.companies.useQuery();
  const { data: allPurchaseAgreements } = trpc.odoo.purchaseAgreements.useQuery();
  const { data: incoterms } = trpc.shipments.incoterms.useQuery();
  const { data: paymentTerms } = trpc.shipments.paymentTerms.useQuery();
  const createMutation = trpc.shipments.create.useMutation();
  const saveDraftMutation = trpc.drafts.save.useMutation();
  const deleteDraftMutation = trpc.drafts.delete.useMutation();
  const { data: existingDraft } = trpc.drafts.getById.useQuery(
    { id: draftId! },
    { enabled: !!draftId }
  );

  // Restore draft data when loaded
  useEffect(() => {
    if (existingDraft?.formData) {
      const d = existingDraft.formData as any;
      if (d.form) setForm(d.form);
      if (d.lines) setLines(d.lines);
      if (d.step) setStep(d.step);
      if (d.distributeWeightEqually !== undefined) setDistributeWeightEqually(d.distributeWeightEqually);
    }
  }, [existingDraft]);

  const handleSaveDraft = async () => {
    try {
      const companyName = companies?.find(c => c.id === form.company_id)?.name || "";
      const vendorName = vendors?.find(v => v.id === form.partner_id)?.name || "";
      const label = [companyName, vendorName].filter(Boolean).join(" → ") || "Purchase Draft";
      const result = await saveDraftMutation.mutateAsync({
        id: currentDraftId,
        wizardType: "purchase",
        currentStep: step,
        label,
        formData: { form, lines, step, distributeWeightEqually },
      });
      setCurrentDraftId(result.id);
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch (e: any) {
      setError(e.message || "Failed to save draft");
    }
  };

  // ─── Stock Locations (for destination selection) ─────────────────────
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

  // ─── Picking type mapping: location → incoming picking type ─────────
  // We need to map the selected location's warehouse to a picking_type_id for PO
  const { data: pickingTypes } = trpc.odoo.pickingTypes.useQuery(
    { companyId: form.company_id || undefined, code: "incoming" },
    { enabled: !!form.company_id }
  );

  // ─── Default UoM to kg ──────────────────────────────────────────────
  const kgUomId = useMemo(() => {
    if (!uoms) return 0;
    const kg = uoms.find(u => u.name.toLowerCase() === "kg");
    return kg ? kg.id : (uoms[0]?.id || 0);
  }, [uoms]);

  // Set default UoM when uoms load
  useEffect(() => {
    if (kgUomId && lines.some(l => l.product_uom === 0)) {
      setLines(prev => prev.map(l => l.product_uom === 0 ? { ...l, product_uom: kgUomId } : l));
    }
  }, [kgUomId]);

  // ─── Filtered companies ──────────────────────────────────────────────────
  const filteredCompanies = useMemo(() => {
    if (activeCompanyId !== "ALL" && companies) {
      return companies.filter(c => c.id === activeCompanyId);
    }
    return companies || [];
  }, [companies, activeCompanyId]);

  // ─── Validation ─────────────────────────────────────────────────────
  const validateStep1 = (): boolean => {
    if (!form.partner_id) { setError("Please select a vendor"); return false; }
    if (!form.company_id) { setError("Please select a company"); return false; }
    setError("");
    return true;
  };

  const validateStep2 = (): boolean => {
    const validLines = lines.filter(l => l.product_id > 0);
    if (validLines.length === 0) { setError("Please add at least one product line"); return false; }
    for (let i = 0; i < validLines.length; i++) {
      if (!validLines[i].product_qty || validLines[i].product_qty <= 0) {
        setError(`Line ${i + 1}: Please enter a valid quantity`); return false;
      }
      if (!validLines[i].price_unit || validLines[i].price_unit <= 0) {
        setError(`Line ${i + 1}: Please enter a valid unit price`); return false;
      }
    }
    setError("");
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(step + 1);
  };

  // ─── Handlers ────────────────────────────────────────────────────────
  const addLine = () => {
    setLines(prev => [...prev, { product_id: 0, product_qty: 0, price_unit: 0, product_uom: kgUomId || 0, date_planned: "", tax_rate: 0 }]);
  };

  const removeLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof LineInput, value: any) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  // ─── Confirm Dialog ──────────────────────────────────────────────────
  const handleRequestSubmit = useCallback(() => {
    setError("");
    if (!form.partner_id) { setError("Please select a vendor"); return; }
    if (!form.company_id) { setError("Please select a company"); return; }
    if (lines.length === 0 || !lines[0].product_id) { setError("Please add at least one product line"); return; }
    setShowConfirm(true);
  }, [form.partner_id, form.company_id, lines]);

  const confirmSummary = useMemo(() => {
    const vendorName = vendors?.find(v => v.id === form.partner_id)?.name || "—";
    const companyName = companies?.find(c => c.id === form.company_id)?.name || "—";
    const validLines = lines.filter(l => l.product_id > 0);
    const totalQty = validLines.reduce((s, l) => s + (l.product_qty || 0), 0);
    const totalValue = validLines.reduce((s, l) => s + (l.product_qty || 0) * (l.price_unit || 0), 0);
    const currencyName = currencies?.find(c => c.id === form.currency_id)?.name || "AED";
    return { vendorName, companyName, lineCount: validLines.length, totalQty, totalValue, currencyName };
  }, [form.partner_id, form.company_id, form.currency_id, lines, vendors, companies, currencies]);

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    // Don't close ConfirmDialog here — CreationProgressModal (z-index 10000) renders on top.
    // Closing it causes a race condition where the wizard backdrop click fires.

    submittingRef.current = true;
    setCreating(true);
    setCreationError("");
    try {
      const payload: any = {
        partner_id: form.partner_id,
        company_id: form.company_id,
        lines: lines.filter(l => l.product_id > 0).map(l => ({
          product_id: l.product_id,
          product_qty: l.product_qty,
          price_unit: l.price_unit,
          product_uom: l.product_uom || undefined,
          date_planned: l.date_planned || undefined,
        })),
      };

      // Add optional fields
      if (form.currency_id) payload.currency_id = form.currency_id;
      if (form.requisition_id) payload.requisition_id = form.requisition_id;
      if (form.date_order) payload.date_order = form.date_order;
      if (form.date_planned) payload.date_planned = form.date_planned;
      if (form.number_of_loads) payload.number_of_loads = form.number_of_loads;
      payload.distribute_weight_equally = distributeWeightEqually;
      if (form.x_studio_vessel_name) payload.x_studio_vessel_name = form.x_studio_vessel_name;
      if (form.x_studio_tracking_number) payload.x_studio_tracking_number = form.x_studio_tracking_number;
      if (form.eta_arrival) payload.eta_arrival = form.eta_arrival;
      if (form.pol_source) payload.pol_source = form.pol_source;
      if (form.pod_source) payload.pod_source = form.pod_source;
      if (form.x_studio_booking_number) payload.x_studio_booking_number = form.x_studio_booking_number;
      if (form.x_studio_etd_pol) payload.x_studio_etd_pol = form.x_studio_etd_pol;
      if (form.x_studio_eta_pol) payload.x_studio_eta_pol = form.x_studio_eta_pol;
      if (form.vessel_cut_off) payload.x_studio_vessel_cut_off = form.vessel_cut_off;
      if (form.freight_type) payload.freight_type = form.freight_type;
      if (form.load_type) payload.load_type = form.load_type;
      if (form.ocean_transporter_company) payload.ocean_transporter_company = form.ocean_transporter_company;
      if (form.incoterm_id) payload.incoterm_id = form.incoterm_id;
      if (form.payment_term_id) payload.payment_term_id = form.payment_term_id;
      if (form.x_studio_ultimate_customer) payload.x_studio_ultimate_customer = form.x_studio_ultimate_customer;
      // Map POD free days (demurrage + detention) to the single Odoo field
      const podFreeDaysTotal = (form.pod_free_days_demurrage || 0) + (form.pod_free_days_detention || 0);
      if (podFreeDaysTotal > 0) payload.x_studio_total_free_days_demurrage_detention = podFreeDaysTotal;
      // Map selected location's warehouse to picking_type_id
      if (form.destination_location_id && stockLocations && pickingTypes) {
        const selectedLoc = stockLocations.find(l => l.id === form.destination_location_id);
        if (selectedLoc?.warehouseId) {
          const pt = pickingTypes.find(p => p.warehouseId === selectedLoc.warehouseId);
          if (pt) payload.picking_type_id = pt.id;
        }
      } else if (form.picking_type_id) {
        payload.picking_type_id = form.picking_type_id;
      }

      // Add origin and notes from procurement if available
      if (form.origin) payload.origin = form.origin;
      if (form.notes) payload.notes = form.notes;

      const result = await createMutation.mutateAsync(payload);
      // Delete draft if it was saved
      if (currentDraftId) {
        try { await deleteDraftMutation.mutateAsync({ id: currentDraftId }); } catch {}
      }
      // Show success animation before navigating
      setCreationSuccess(true);
      setCreatedId(result.id);
      setTimeout(() => {
        onCreated(result.id, result.name || "");
      }, 1800);
    } catch (e: any) {
      setCreating(false);
      submittingRef.current = false;
      setCreationError(e.message || "Failed to create shipment");
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
    }}>
      <div style={{
        background: C.card, borderRadius: 12, width: 720, maxHeight: "90vh",
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
            <div style={{ fontSize: 14, fontWeight: 700 }}>New Purchase Shipment</div>
            <div style={{ fontSize: 10, color: C.muted }}>
            {procurementData ? `From Procurement ${procurementData.id} · ` : ""}Step {step} of 3
          </div>
          </div>
          <button onClick={() => { if (!creating && !creationSuccess) onClose(); }} style={{
            background: "none", border: "none", fontSize: 18, cursor: "pointer", color: C.gray,
            opacity: (creating || creationSuccess) ? 0.3 : 1,
            pointerEvents: (creating || creationSuccess) ? "none" : "auto",
          }}>×</button>
        </div>

        {/* Step Indicator */}
        <div style={{
          display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`,
        }}>
          {[
            { n: 1, label: "Basic Info" },
            { n: 2, label: "Product Lines" },
            { n: 3, label: "Shipping Details" },
          ].map(s => (
            <div key={s.n} onClick={() => {
              // Only allow going back, not forward without validation
              if (s.n < step) setStep(s.n);
              else if (s.n === step + 1) handleNext();
            }} style={{
              flex: 1, padding: "8px 12px", textAlign: "center",
              cursor: s.n <= step ? "pointer" : "default",
              fontSize: 10, fontWeight: step === s.n ? 700 : 500,
              color: step === s.n ? C.forest : (s.n < step ? C.sage : C.muted),
              borderBottom: step === s.n ? `2px solid ${C.forest}` : "2px solid transparent",
              background: step === s.n ? C.gBg2 : "transparent",
              opacity: s.n > step ? 0.5 : 1,
            }}>{s.label}</div>
          ))}
        </div>

        {/* Procurement Banner */}
        {procurementData && (
          <div style={{
            padding: "8px 20px",
            background: "#f0fdf4",
            borderBottom: `1px solid #bbf7d0`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 16 }}>🌾</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#166534" }}>
                Creating from Procurement {procurementData.id}
              </div>
              <div style={{ fontSize: 9, color: "#15803d", marginTop: 1 }}>
                {procurementData.supplier} · {procurementData.commodity} {procurementData.grade} · {(procurementData.net / 1000).toFixed(2)} t · {procurementData.price}/ton
                {procurementData.qcData && (
                  <> · QC: <strong>{procurementData.qcData.verdict}</strong> ({procurementData.qcData.finalGrade})</>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{ padding: 20 }}>
          {error && (
            <div style={{
              padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 6, color: "#dc2626", fontSize: 11, marginBottom: 12,
            }}>{error}</div>
          )}

          {/* Step 1: Basic Info */}
          <div style={{ display: step === 1 ? 'grid' : 'none', gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <Lbl>Vendor *</Lbl>
                <select value={form.partner_id} onChange={e => setForm(p => ({ ...p, partner_id: Number(e.target.value), requisition_id: 0 }))} style={selectStyle}>
                  <option value={0}>Select vendor...</option>
                  {(vendors || []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Company *</Lbl>
                <select value={form.company_id} onChange={e => setForm(p => ({ ...p, company_id: Number(e.target.value) }))} style={selectStyle}>
                  <option value={0}>Select company...</option>
                  {filteredCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Purchase Agreement</Lbl>
                <select value={form.requisition_id} onChange={e => setForm(p => ({ ...p, requisition_id: Number(e.target.value) }))} style={selectStyle}>
                  <option value={0}>None</option>
                  {(allPurchaseAgreements || []).filter(pa => {
                    if (selectedCompanyId && pa.companyId !== selectedCompanyId) return false;
                    if (form.partner_id && pa.vendorId && pa.vendorId !== form.partner_id) return false;
                    return true;
                  }).map(pa => <option key={pa.id} value={pa.id}>{pa.name} — {pa.vendor}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Currency</Lbl>
                <select value={form.currency_id} onChange={e => setForm(p => ({ ...p, currency_id: Number(e.target.value) }))} style={selectStyle}>
                  <option value={0}>Default</option>
                  {(currencies || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Order Date</Lbl>
                <input type="date" value={form.date_order} onChange={e => setForm(p => ({ ...p, date_order: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <Lbl>Ultimate Customer</Lbl>
                <input value={form.x_studio_ultimate_customer} onChange={e => setForm(p => ({ ...p, x_studio_ultimate_customer: e.target.value }))} style={inputStyle} placeholder="Customer name" />
              </div>
              <div>
                <Lbl>Incoterm</Lbl>
                <select value={form.incoterm_id} onChange={e => setForm(p => ({ ...p, incoterm_id: Number(e.target.value) }))} style={selectStyle}>
                  <option value={0}>None</option>
                  {(incoterms || []).map(i => <option key={i.id} value={i.id}>
                    {i.code} — {i.name}
                  </option>)}
                </select>
              </div>
              <div>
                <Lbl>Payment Term</Lbl>
                <select value={form.payment_term_id} onChange={e => setForm(p => ({ ...p, payment_term_id: Number(e.target.value) }))} style={selectStyle}>
                  <option value={0}>None</option>
                  {(paymentTerms || []).map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Destination Location *</Lbl>
                <select
                  value={form.destination_location_id}
                  onChange={e => setForm(p => ({ ...p, destination_location_id: Number(e.target.value) }))}
                  style={selectStyle}
                >
                  <option value={0}>Select location...</option>
                  {locationsByWarehouse.map(group => (
                    <optgroup key={group.warehouseName} label={group.warehouseName}>
                      {group.locations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.completeName}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div style={{ fontSize: 8, color: C.muted, marginTop: 2 }}>Where the purchased goods will be stored</div>
              </div>
          </div>

          {/* Step 2: Product Lines */}
          <div style={{ display: step === 2 ? 'block' : 'none' }}>
              {/* View Stock button for destination location */}
              {form.destination_location_id > 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                  <ViewStockButton
                    locationId={form.destination_location_id}
                    locationName={stockLocations?.find((l: any) => l.id === form.destination_location_id)?.completeName}
                    accentColor={C.forest}
                  />
                </div>
              )}

              {lines.map((line, idx) => (
                <div key={idx} style={{
                  padding: 12, border: `1px solid ${C.border}`, borderRadius: 8,
                  marginBottom: 8, background: C.gBg,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.sage }}>Line {idx + 1}</span>
                    {lines.length > 1 && (
                      <button onClick={() => removeLine(idx)} style={{
                        background: "none", border: "none", color: C.red, fontSize: 10, cursor: "pointer", fontWeight: 600,
                      }}>Remove</button>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.8fr 0.7fr", gap: 8 }}>
                    <div>
                      <Lbl>Product *</Lbl>
                      <SearchableProductSelect
                        value={line.product_id}
                        companyId={selectedCompanyId}
                        onChange={(id, product) => {
                          updateLine(idx, "product_id", id);
                          // Auto-set UoM from product's own UoM to avoid category mismatch
                          if (product?.uom?.id) {
                            updateLine(idx, "product_uom", product.uom.id);
                          }
                        }}
                      />
                    </div>
                    <div>
                      <Lbl>Quantity *</Lbl>
                      <input type="number" step="0.01" min="0.01" value={line.product_qty || ""} onChange={e => {
                        const val = parseFloat(e.target.value);
                        updateLine(idx, "product_qty", isNaN(val) ? 0 : Math.max(0, val));
                      }} style={inputStyle} />
                    </div>
                    <div>
                      <Lbl>Unit Price *</Lbl>
                      <input type="number" step="0.01" value={line.price_unit || ""} onChange={e => updateLine(idx, "price_unit", parseFloat(e.target.value) || 0)} style={inputStyle} />
                    </div>
                    <div>
                      <Lbl>UoM</Lbl>
                      <select value={line.product_uom} onChange={e => updateLine(idx, "product_uom", Number(e.target.value))} style={selectStyle}>
                        {(uoms || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <Lbl>VAT</Lbl>
                      <select value={line.tax_rate} onChange={e => updateLine(idx, "tax_rate", Number(e.target.value))} style={selectStyle}>
                        {VAT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              <Btn onClick={addLine} outline small>+ Add Line</Btn>
          </div>

          {/* Step 3: Shipping Details */}
          <div style={{ display: step === 3 ? 'grid' : 'none', gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <Lbl># Loads/Containers</Lbl>
                <input type="number" value={form.number_of_loads || ""} onChange={e => setForm(p => ({ ...p, number_of_loads: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                <label style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, cursor: "pointer", fontSize: 10, color: C.dark }}>
                  <input
                    type="checkbox"
                    checked={distributeWeightEqually}
                    onChange={e => setDistributeWeightEqually(e.target.checked)}
                    style={{ width: 14, height: 14, accentColor: C.forest, cursor: "pointer" }}
                  />
                  <span style={{ fontWeight: 500 }}>Distribute weight equally across loads</span>
                </label>
                {distributeWeightEqually && form.number_of_loads > 0 && (() => {
                  const validLines = lines.filter(l => l.product_id > 0 && l.product_qty > 0);
                  if (validLines.length === 0) return null;
                  const totalQty = validLines.reduce((sum, l) => {
                    const uomObj = uoms?.find(u => u.id === l.product_uom);
                    const uomName = (uomObj?.name || "").toLowerCase();
                    const qty = l.product_qty;
                    if (uomName.includes("ton") || uomName === "t" || uomName === "mt") return sum + qty;
                    return sum + qty / 1000; // default kg
                  }, 0);
                  if (totalQty <= 0) return null;
                  const perLoad = Math.round((totalQty / form.number_of_loads) * 100) / 100;
                  return (
                    <div style={{
                      marginTop: 6, padding: "6px 10px", borderRadius: 6,
                      background: C.gBg2, border: `1px solid ${C.gBdr}`,
                      fontSize: 10, color: C.forest, fontWeight: 600,
                      fontFamily: MONO,
                    }}>
                      {totalQty.toFixed(2)} tons ÷ {form.number_of_loads} loads = <span style={{ color: C.terra, fontWeight: 700 }}>{perLoad.toFixed(2)} tons/load</span>
                    </div>
                  );
                })()}
              </div>
              <div>
                <Lbl>Vessel Name</Lbl>
                <input value={form.x_studio_vessel_name} onChange={e => setForm(p => ({ ...p, x_studio_vessel_name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <Lbl>Booking #</Lbl>
                <input value={form.x_studio_booking_number} onChange={e => setForm(p => ({ ...p, x_studio_booking_number: e.target.value }))} style={inputStyle} placeholder="Booking reference" />
              </div>
              <div>
                <Lbl>Vessel Tracking Link</Lbl>
                <input value={form.x_studio_tracking_number} onChange={e => setForm(p => ({ ...p, x_studio_tracking_number: e.target.value }))} style={inputStyle} placeholder="e.g. https://www.marinetraffic.com/..." />
              </div>

              {/* Port of Loading Section */}
              <div style={{ gridColumn: "1 / -1", borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.forest, marginBottom: 6 }}>Port of Loading (POL)</div>
              </div>
              <div>
                <Lbl>POL Name</Lbl>
                <PortSelector value={form.pol_source} onChange={v => setForm(p => ({ ...p, pol_source: v }))} style={inputStyle} placeholder="Search port..." accentColor={C.forest} />
              </div>
              <div>
                <Lbl>ETD (POL)</Lbl>
                <input type="date" value={form.x_studio_etd_pol} onChange={e => setForm(p => ({ ...p, x_studio_etd_pol: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <Lbl>ETA (POL)</Lbl>
                <input type="date" value={form.x_studio_eta_pol} onChange={e => setForm(p => ({ ...p, x_studio_eta_pol: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <Lbl>Vessel Cut Off</Lbl>
                <input type="date" value={form.vessel_cut_off} onChange={e => setForm(p => ({ ...p, vessel_cut_off: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <Lbl>Free Days — Demurrage (POL)</Lbl>
                <input type="number" min="0" value={form.pol_free_days_demurrage || ""} onChange={e => setForm(p => ({ ...p, pol_free_days_demurrage: parseInt(e.target.value) || 0 }))} style={inputStyle} placeholder="e.g. 7" />
              </div>
              <div>
                <Lbl>Free Days — Detention (POL)</Lbl>
                <input type="number" min="0" value={form.pol_free_days_detention || ""} onChange={e => setForm(p => ({ ...p, pol_free_days_detention: parseInt(e.target.value) || 0 }))} style={inputStyle} placeholder="e.g. 7" />
              </div>

              {/* Port of Destination Section */}
              <div style={{ gridColumn: "1 / -1", borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.terra, marginBottom: 6 }}>Port of Destination (POD)</div>
              </div>
              <div>
                <Lbl>POD Name</Lbl>
                <PortSelector value={form.pod_source} onChange={v => setForm(p => ({ ...p, pod_source: v }))} style={inputStyle} placeholder="Search port..." accentColor={C.terra} />
              </div>
              <div>
                <Lbl>ETA (POD)</Lbl>
                <input type="date" value={form.eta_arrival} onChange={e => setForm(p => ({ ...p, eta_arrival: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <Lbl>Free Days — Demurrage (POD)</Lbl>
                <input type="number" min="0" value={form.pod_free_days_demurrage || ""} onChange={e => setForm(p => ({ ...p, pod_free_days_demurrage: parseInt(e.target.value) || 0 }))} style={inputStyle} placeholder="e.g. 7" />
              </div>
              <div>
                <Lbl>Free Days — Detention (POD)</Lbl>
                <input type="number" min="0" value={form.pod_free_days_detention || ""} onChange={e => setForm(p => ({ ...p, pod_free_days_detention: parseInt(e.target.value) || 0 }))} style={inputStyle} placeholder="e.g. 7" />
              </div>

              <div>
                <Lbl>Freight Type</Lbl>
                <select value={form.freight_type} onChange={e => setForm(p => ({ ...p, freight_type: e.target.value }))} style={selectStyle}>
                  <option value="">Select...</option>
                  <option value="ocean">Ocean</option>
                  <option value="land">Land</option>
                </select>
              </div>
              <div>
                <Lbl>Load Type</Lbl>
                <select value={form.load_type} onChange={e => setForm(p => ({ ...p, load_type: e.target.value }))} style={selectStyle}>
                  <option value="">Select...</option>
                  <option value="truck_load">Truck Load</option>
                  <option value="container_shipment">Container Shipment</option>
                </select>
              </div>
              <div>
                <Lbl>Shipping Line</Lbl>
                <select value={form.ocean_transporter_company} onChange={e => setForm(p => ({ ...p, ocean_transporter_company: e.target.value }))} style={selectStyle}>
                  <option value="">Select...</option>
                  {[
                    { value: "esl", label: "ESL" },
                    { value: "rcl", label: "RCL" },
                    { value: "asyad", label: "ASYAD" },
                    { value: "maersk", label: "MAERSK" },
                    { value: "cma", label: "CMA" },
                    { value: "msc", label: "MSC" },
                    { value: "unifeeder", label: "Unifeeder" },
                    { value: "wanhai", label: "WANHAI" },
                    { value: "transmar", label: "Transmar" },
                    { value: "hapag_lloyd", label: "Hapag-Lloyd" },
                    { value: "one", label: "ONE" },
                    { value: "cosco", label: "COSCO" },
                    { value: "pil", label: "PIL" },
                    { value: "vasco", label: "VASCO" },
                    { value: "csl", label: "CSL" },
                  ].map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px", borderTop: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", background: C.gBg,
        }}>
          <div style={{ display: "flex", gap: 6 }}>
            {step > 1 && <Btn onClick={() => { setError(""); setStep(step - 1); }} outline>← Back</Btn>}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {draftSaved && <span style={{ fontSize: 10, color: C.sage, fontWeight: 600 }}>✓ Draft saved</span>}
            <Btn onClick={handleSaveDraft} color={C.amber} outline disabled={saveDraftMutation.isPending}>
              {saveDraftMutation.isPending ? "Saving..." : currentDraftId ? "Update Draft" : "Save as Draft"}
            </Btn>
            <Btn onClick={() => { if (!creating && !creationSuccess) onClose(); }} color={C.gray} outline disabled={creating || creationSuccess}>Cancel</Btn>
            {step < 3 ? (
              <Btn onClick={handleNext}>Next →</Btn>
            ) : (
              <Btn onClick={handleRequestSubmit} disabled={creating}>
                {creating ? "Creating..." : "Create Shipment"}
              </Btn>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={showConfirm}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title="Create Purchase Shipment?"
        confirmLabel="Yes, Create Shipment"
        cancelLabel="Go Back"
        loading={creating}
        message={
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, color: C.dark, lineHeight: 1.5 }}>
              You are about to create a new Purchase Shipment with the following details:
            </div>
            <div style={{
              background: C.gBg, border: `1px solid ${C.gBdr}`, borderRadius: 6,
              padding: "8px 10px", display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px",
              fontSize: 11,
            }}>
              <span style={{ fontWeight: 600, color: C.sage }}>Company</span>
              <span style={{ color: C.dark }}>{confirmSummary.companyName}</span>
              <span style={{ fontWeight: 600, color: C.sage }}>Vendor</span>
              <span style={{ color: C.dark }}>{confirmSummary.vendorName}</span>
              <span style={{ fontWeight: 600, color: C.sage }}>Lines</span>
              <span style={{ color: C.dark }}>{confirmSummary.lineCount} product{confirmSummary.lineCount !== 1 ? "s" : ""}</span>
              <span style={{ fontWeight: 600, color: C.sage }}>Total Qty</span>
              <span style={{ color: C.dark }}>{confirmSummary.totalQty.toLocaleString()}</span>
              <span style={{ fontWeight: 600, color: C.sage }}>Total Value</span>
              <span style={{ color: C.dark, fontWeight: 600 }}>{confirmSummary.currencyName} {confirmSummary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
              This action will create and confirm the order. It cannot be undone from this portal.
            </div>
          </div>
        }
      />

      {/* Creation Progress Modal */}
      <CreationProgressModal
        visible={creating || !!creationError || creationSuccess}
        message="Creating Purchase Shipment..."
        title="Creating Purchase Shipment"
        subtitle="Sending data and confirming the order"
        error={creationError || undefined}
        onErrorClose={() => setCreationError("")}
        success={creationSuccess}
        successMessage={createdId ? `Purchase Order #${createdId} created and confirmed.` : "Purchase Order created successfully!"}
      />
    </div>
  );
}
