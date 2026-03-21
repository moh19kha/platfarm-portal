/**
 * CreateOdooSalesShipment — Modal form to create a new Sales Shipment
 * Matches the Purchase wizard style (CreateOdooShipment) for consistency.
 * Supports: customer selection, agreement link, product lines, shipping details
 * Includes: warehouse selection, on-hand stock display, stock validation
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

interface Props {
  activeCompanyId?: number | "ALL";
  onClose: () => void;
  onCreated: (id: number) => void;
  draftId?: number;
}

interface SalesLine {
  product_id: number;
  product_uom_qty: number;
  price_unit: number;
  product_uom: number;
  discount: number;
  tax_rate: number; // VAT percentage: 0, 5, 14, or 15
}

const VAT_OPTIONS = [
  { value: 0, label: "0%" },
  { value: 5, label: "5%" },
  { value: 14, label: "14%" },
  { value: 15, label: "15%" },
];

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "5px 8px", borderWidth: 1, borderStyle: "solid", borderColor: C.border,
  borderRadius: 5, fontSize: 11, fontFamily: FONT, outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, background: C.card,
};

const Lbl = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</div>
);

export function CreateOdooSalesShipment({ activeCompanyId, onClose, onCreated, draftId }: Props) {
  // ─── Form State ──────────────────────────────────────────────────────
  const [form, setForm] = useState({
    partner_id: 0,
    company_id: activeCompanyId === "ALL" || !activeCompanyId ? 0 : activeCompanyId,
    currency_id: 0,
    date_order: new Date().toISOString().split("T")[0],
    incoterm: 0,
    payment_term_id: 0,
    x_studio_ultimate_customer: "",
    sale_order_template_id: 0,
    warehouse_id: 0,
    source_location_id: 0,
    // Shipping
    number_of_loads: 0,
    vessel_name: "",
    load_type: "",
    freight_type: "",
    shipping_line: "",
    tracking_number: "",
    x_studio_shipment_bl_number: "",
    eta_pod: "",
    eta_pol: "",
    etd_pol: "",
    pol: "",
    pod: "",
    booking_number: "",
    vessel_cut_off: "",
    vessel_tracking_link: "",
    free_days: 0,
    rate_per_container_load: "",
    transit_time_in_days: "",
  });

  const [lines, setLines] = useState<SalesLine[]>([{
    product_id: 0, product_uom_qty: 0, price_unit: 0, product_uom: 0, discount: 0, tax_rate: 0,
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

  // ─── Lookups ────────────────────────────────────────────────────────
  const selectedCompanyId = form.company_id || (activeCompanyId === "ALL" || !activeCompanyId ? undefined : activeCompanyId);
  const { data: customers } = trpc.odoo.customers.useQuery(
    selectedCompanyId ? { companyId: selectedCompanyId } : undefined
  );
  const { data: currencies } = trpc.odoo.currencies.useQuery();
  const { data: uoms } = trpc.odoo.uoms.useQuery();
  const { data: companies } = trpc.odoo.companies.useQuery();
  const { data: salesAgreements } = trpc.odoo.salesAgreements.useQuery();
  const { data: incoterms } = trpc.shipments.incoterms.useQuery();
  const { data: paymentTerms } = trpc.shipments.paymentTerms.useQuery();
  const createMutation = trpc.salesShipments.create.useMutation();
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
      const customerName = customers?.find(c => c.id === form.partner_id)?.name || "";
      const label = [companyName, customerName].filter(Boolean).join(" → ") || "Sales Draft";
      const result = await saveDraftMutation.mutateAsync({
        id: currentDraftId,
        wizardType: "sales",
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

  // ─── Stock Locations (for source selection) ─────────────────────────
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

  // ─── Stock Query (by location) ─────────────────────────────────────
  const productIds = useMemo(() => {
    return lines.filter(l => l.product_id > 0).map(l => l.product_id);
  }, [lines]);

  const { data: stockData } = trpc.shipments.productStockByLocation.useQuery(
    { productIds, locationId: form.source_location_id || undefined },
    { enabled: productIds.length > 0 && form.source_location_id > 0 }
  );

  // Build stock lookup: productId -> available qty at selected location
  const stockMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!stockData) return map;
    for (const s of stockData) {
      const existing = map.get(s.productId) || 0;
      map.set(s.productId, existing + s.availableQuantity);
    }
    return map;
  }, [stockData]);

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

  // ─── Filtered companies ──────────────────────────────────────────────
  const filteredCompanies = useMemo(() => {
    if (activeCompanyId !== "ALL" && activeCompanyId && companies) {
      return companies.filter(c => c.id === activeCompanyId);
    }
    return companies || [];
  }, [companies, activeCompanyId]);

  // ─── Filtered sales agreements by selected company ──────────────────
  const filteredSalesAgreements = useMemo(() => {
    if (!salesAgreements) return [];
    return salesAgreements.filter(sa => {
      if (selectedCompanyId && sa.companyId !== selectedCompanyId) return false;
      if (form.partner_id && sa.customerId && sa.customerId !== form.partner_id) return false;
      return true;
    });
  }, [salesAgreements, selectedCompanyId, form.partner_id]);

    // ─── Stock Validation ──────────────────────────────────────────
  const stockErrors = useMemo(() => {
    if (!form.source_location_id) return [];
    const errors: string[] = [];
    const validLines = lines.filter(l => l.product_id > 0 && l.product_uom_qty > 0);
    for (const line of validLines) {
      const available = stockMap.get(line.product_id) ?? 0;
      if (line.product_uom_qty > available) {
        errors.push(`Insufficient stock for product (requested: ${line.product_uom_qty.toLocaleString()} kg, available: ${available.toLocaleString()} kg)`);
      }
    }
    return errors;
  }, [lines, stockMap, form.source_location_id]);

  // ─── Validation ─────────────────────────────────────────────────────
  const validateStep1 = (): boolean => {
    if (!form.partner_id) { setError("Please select a customer"); return false; }
    if (!form.company_id) { setError("Please select a company"); return false; }
    if (!form.source_location_id) { setError("Please select a source location"); return false; }
    setError("");
    return true;
  };

  const validateStep2 = (): boolean => {
    const validLines = lines.filter(l => l.product_id > 0);
    if (validLines.length === 0) { setError("Please add at least one product line"); return false; }
    for (let i = 0; i < validLines.length; i++) {
      if (!validLines[i].product_uom_qty || validLines[i].product_uom_qty <= 0) {
        setError(`Line ${i + 1}: Please enter a valid quantity`); return false;
      }
      if (!validLines[i].price_unit || validLines[i].price_unit <= 0) {
        setError(`Line ${i + 1}: Please enter a valid unit price`); return false;
      }
    }
    // Stock validation is non-blocking — warnings are shown in the UI but don't prevent proceeding
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
    setLines(prev => [...prev, { product_id: 0, product_uom_qty: 0, price_unit: 0, product_uom: kgUomId || 0, discount: 0, tax_rate: 0 }]);
  };

  const removeLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, key: keyof SalesLine, value: number) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: value } : l));
  };

  // ─── Confirm Dialog ──────────────────────────────────────────────────
  const handleRequestSubmit = useCallback(() => {
    setError("");
    if (!form.partner_id) { setError("Please select a customer"); return; }
    if (!form.company_id) { setError("Please select a company"); return; }
    if (!form.source_location_id) { setError("Please select a source location"); return; }
    const validLines = lines.filter(l => l.product_id > 0 && l.product_uom_qty > 0 && l.price_unit > 0);
    if (validLines.length === 0) { setError("At least one product line with product, quantity, and price is required."); return; }
    setShowConfirm(true);
  }, [form.partner_id, form.company_id, form.source_location_id, lines]);

  const confirmSummary = useMemo(() => {
    const customerName = customers?.find(c => c.id === form.partner_id)?.name || "\u2014";
    const companyName = companies?.find(c => c.id === form.company_id)?.name || "\u2014";
    const validLines = lines.filter(l => l.product_id > 0 && l.product_uom_qty > 0);
    const totalQty = validLines.reduce((s, l) => s + (l.product_uom_qty || 0), 0);
    const totalValue = validLines.reduce((s, l) => s + (l.product_uom_qty || 0) * (l.price_unit || 0) * (1 - (l.discount || 0) / 100), 0);
    const currencyName = currencies?.find(c => c.id === form.currency_id)?.name || "AED";
    return { customerName, companyName, lineCount: validLines.length, totalQty, totalValue, currencyName };
  }, [form.partner_id, form.company_id, form.currency_id, lines, customers, companies, currencies]);

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    // Don't close ConfirmDialog here — CreationProgressModal (z-index 10000) renders on top.
    // Closing it causes a race condition where the wizard backdrop click fires.

    submittingRef.current = true;
    setCreating(true);
    setCreationError("");
    try {
      const validLines = lines.filter(l => l.product_id > 0 && l.product_uom_qty > 0 && l.price_unit > 0);
      const payload: any = {
        partner_id: form.partner_id,
        company_id: form.company_id,
        // Derive warehouse_id from the selected source location
        ...(form.source_location_id && stockLocations ? (() => {
          const loc = stockLocations.find(l => l.id === form.source_location_id);
          return loc?.warehouseId ? { warehouse_id: loc.warehouseId } : {};
        })() : {}),
        lines: validLines,
      };
      if (form.currency_id) payload.currency_id = form.currency_id;
      if (form.date_order) payload.date_order = form.date_order;
      if (form.incoterm) payload.incoterm = form.incoterm;
      if (form.payment_term_id) payload.payment_term_id = form.payment_term_id;
      if (form.x_studio_ultimate_customer) payload.x_studio_ultimate_customer = form.x_studio_ultimate_customer;
      if (form.sale_order_template_id) payload.sale_order_template_id = form.sale_order_template_id;
      if (form.number_of_loads) payload.number_of_loads = form.number_of_loads;
      payload.distribute_weight_equally = distributeWeightEqually;
      if (form.load_type) payload.load_type = form.load_type;
      if (form.freight_type) payload.freight_type = form.freight_type;
      if (form.shipping_line) payload.shipping_line = form.shipping_line;
      if (form.tracking_number) payload.tracking_number = form.tracking_number;
      if (form.x_studio_shipment_bl_number) payload.x_studio_shipment_bl_number = form.x_studio_shipment_bl_number;
      if (form.eta_pod) payload.eta_pod = form.eta_pod;
      if (form.eta_pol) payload.eta_pol = form.eta_pol;
      if (form.etd_pol) payload.etd_pol = form.etd_pol;
      if (form.pol) payload.pol = form.pol;
      if (form.pod) payload.pod = form.pod;
      if (form.booking_number) payload.booking_number = form.booking_number;
      if (form.vessel_cut_off) payload.vessel_cut_off = form.vessel_cut_off;
      // Note: x_studio_vessel_name and x_studio_total_free_days_demurrage_detention don't exist on sale.order model
      if (form.vessel_tracking_link) payload.vessel_tracking_link = form.vessel_tracking_link;
      if (form.rate_per_container_load) payload.rate_per_container_load = form.rate_per_container_load;
      if (form.transit_time_in_days) payload.transit_time_in_days = form.transit_time_in_days;

      const result = await createMutation.mutateAsync(payload);
      if (currentDraftId) {
        try { await deleteDraftMutation.mutateAsync({ id: currentDraftId }); } catch {}
      }
      // Show success animation before navigating
      setCreationSuccess(true);
      setCreatedId(result.id);
      setTimeout(() => {
        onCreated(result.id);
      }, 1800);
    } catch (e: any) {
      setCreating(false);
      submittingRef.current = false;
      setCreationError(e.message || "Failed to create sales order");
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
        borderWidth: 1, borderStyle: "solid", borderColor: C.border,
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 20px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: C.gBg,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>New Sales Shipment</div>
            <div style={{ fontSize: 10, color: C.muted }}>Step {step} of 3</div>
          </div>
          <button onClick={() => { if (!creating && !creationSuccess) onClose(); }} style={{
            background: "none", border: "none", fontSize: 18, cursor: "pointer", color: C.gray,
            opacity: (creating || creationSuccess) ? 0.3 : 1,
            pointerEvents: (creating || creationSuccess) ? "none" : "auto",
          }}>×</button>
        </div>

        {/* Step Indicator — matches Purchase wizard style */}
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

        {/* Content */}
        <div style={{ padding: 20 }}>
          {error && (
            <div style={{
              padding: "8px 12px", background: "#fef2f2", borderWidth: 1, borderStyle: "solid", borderColor: "#fecaca",
              borderRadius: 6, color: "#dc2626", fontSize: 11, marginBottom: 12,
            }}>{error}</div>
          )}

          {/* Step 1: Basic Info — matches Purchase wizard layout */}
          <div style={{ display: step === 1 ? 'grid' : 'none', gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <Lbl>Customer *</Lbl>
                <select value={form.partner_id} onChange={e => setForm(p => ({ ...p, partner_id: Number(e.target.value), sale_order_template_id: 0 }))} style={selectStyle}>
                  <option value={0}>Select customer...</option>
                  {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Company *</Lbl>
                <select value={form.company_id} onChange={e => {
                  const newCompanyId = Number(e.target.value);
                  setForm(p => ({ ...p, company_id: newCompanyId, warehouse_id: 0, source_location_id: 0 }));
                }} style={selectStyle}>
                  <option value={0}>Select company...</option>
                  {filteredCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Sales Agreement</Lbl>
                <select value={form.sale_order_template_id} onChange={e => setForm(p => ({ ...p, sale_order_template_id: Number(e.target.value) }))} style={selectStyle}>
                  <option value={0}>None</option>
                  {filteredSalesAgreements.map(sa => (
                    <option key={sa.id} value={sa.id}>{sa.name}{sa.customer ? ` — ${sa.customer}` : ""}</option>
                  ))}
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
                <select value={form.incoterm} onChange={e => setForm(p => ({ ...p, incoterm: Number(e.target.value) }))} style={selectStyle}>
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
                  {(paymentTerms || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Source Location *</Lbl>
                <select
                  value={form.source_location_id}
                  onChange={e => setForm(p => ({ ...p, source_location_id: Number(e.target.value) }))}
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
                <div style={{ fontSize: 8, color: C.muted, marginTop: 2 }}>From which location to sell (e.g., Finished Goods, Raw Material)</div>
              </div>
          </div>

          {/* Step 2: Product Lines — with stock display */}
          <div style={{ display: step === 2 ? 'block' : 'none' }}>
              {/* View Stock button */}
              {form.source_location_id > 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                  <ViewStockButton
                    locationId={form.source_location_id}
                    locationName={stockLocations?.find((l: any) => l.id === form.source_location_id)?.completeName}
                    accentColor={C.terra}
                  />
                </div>
              )}

              {/* Stock validation warning */}
              {form.source_location_id > 0 && stockErrors.length > 0 && (
                <div style={{
                  padding: "8px 12px", background: "#fff7ed", borderWidth: 1, borderStyle: "solid", borderColor: "#fed7aa",
                  borderRadius: 6, color: "#c2410c", fontSize: 11, marginBottom: 12,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠ Insufficient Stock</div>
                  {stockErrors.map((err, i) => <div key={i}>• {err}</div>)}
                </div>
              )}

              {lines.map((line, idx) => {
                const available = form.source_location_id && line.product_id > 0 ? (stockMap.get(line.product_id) ?? null) : null;
                const isOverStock = available !== null && line.product_uom_qty > 0 && line.product_uom_qty > available;

                return (
                  <div key={idx} style={{
                    padding: 12, borderWidth: 1, borderStyle: "solid", borderColor: isOverStock ? "#fecaca" : C.border, borderRadius: 8,
                    marginBottom: 8, background: isOverStock ? "#fef2f2" : C.gBg,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.sage }}>Line {idx + 1}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {/* Stock indicator */}
                        {form.source_location_id > 0 && line.product_id > 0 && (
                          <span style={{
                            fontSize: 9, fontWeight: 600, fontFamily: MONO,
                            padding: "2px 6px", borderRadius: 4,
                            background: available === null ? "#f3f4f6" : (isOverStock ? "#fecaca" : "#dcfce7"),
                            color: available === null ? C.muted : (isOverStock ? "#dc2626" : "#16a34a"),
                          }}>
                            {available === null ? "Loading..." : `On-hand: ${available.toLocaleString()} kg`}
                          </span>
                        )}
                        {lines.length > 1 && (
                          <button onClick={() => removeLine(idx)} style={{
                            background: "none", border: "none", color: C.red, fontSize: 10, cursor: "pointer", fontWeight: 600,
                          }}>Remove</button>
                        )}
                      </div>
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
                        <input
                          type="number" step="0.01" min="0.01"
                          value={line.product_uom_qty || ""}
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            updateLine(idx, "product_uom_qty", isNaN(val) ? 0 : Math.max(0, val));
                          }}
                          style={{
                            ...inputStyle,
                            ...(isOverStock ? { borderColor: "#dc2626", background: "#fef2f2" } : {}),
                          }}
                        />
                        {isOverStock && (
                          <div style={{ fontSize: 8, color: "#dc2626", marginTop: 2, fontWeight: 600 }}>
                            Exceeds available stock ({available?.toLocaleString()} kg)
                          </div>
                        )}
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
                );
              })}
              <Btn onClick={addLine} outline small>+ Add Line</Btn>
          </div>

          {/* Step 3: Shipping Details — matches Purchase wizard layout */}
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
                  const validLines = lines.filter(l => l.product_id > 0 && l.product_uom_qty > 0);
                  if (validLines.length === 0) return null;
                  const totalQty = validLines.reduce((sum, l) => {
                    const uomObj = uoms?.find(u => u.id === l.product_uom);
                    const uomName = (uomObj?.name || "").toLowerCase();
                    const qty = l.product_uom_qty;
                    if (uomName.includes("ton") || uomName === "t" || uomName === "mt") return sum + qty;
                    return sum + qty / 1000;
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
                <Lbl>Vessel Tracking Link</Lbl>
                <input value={form.vessel_tracking_link} onChange={e => setForm(p => ({ ...p, vessel_tracking_link: e.target.value }))} style={inputStyle} placeholder="e.g. https://www.marinetraffic.com/..." />
              </div>
              <div>
                <Lbl>Booking #</Lbl>
                <input value={form.booking_number} onChange={e => setForm(p => ({ ...p, booking_number: e.target.value }))} style={inputStyle} placeholder="Booking reference" />
              </div>
              <div>
                <Lbl>BL Number</Lbl>
                <input value={form.x_studio_shipment_bl_number} onChange={e => setForm(p => ({ ...p, x_studio_shipment_bl_number: e.target.value }))} style={inputStyle} />
              </div>

              {/* Port of Loading Section */}
              <div style={{ gridColumn: "1 / -1", borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.forest, marginBottom: 6 }}>Port of Loading (POL)</div>
              </div>
              <div>
                <Lbl>POL Name</Lbl>
                <PortSelector value={form.pol} onChange={v => setForm(p => ({ ...p, pol: v }))} style={inputStyle} placeholder="Search port..." accentColor={C.forest} />
              </div>
              <div>
                <Lbl>ETD (POL)</Lbl>
                <input type="date" value={form.etd_pol} onChange={e => setForm(p => ({ ...p, etd_pol: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <Lbl>ETA (POL)</Lbl>
                <input type="date" value={form.eta_pol} onChange={e => setForm(p => ({ ...p, eta_pol: e.target.value }))} style={inputStyle} />
              </div>

              {/* Port of Destination Section */}
              <div style={{ gridColumn: "1 / -1", borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.terra, marginBottom: 6 }}>Port of Destination (POD)</div>
              </div>
              <div>
                <Lbl>POD Name</Lbl>
                <PortSelector value={form.pod} onChange={v => setForm(p => ({ ...p, pod: v }))} style={inputStyle} placeholder="Search port..." accentColor={C.terra} />
              </div>
              <div>
                <Lbl>ETA (POD)</Lbl>
                <input type="date" value={form.eta_pod} onChange={e => setForm(p => ({ ...p, eta_pod: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <Lbl>Vessel Cut Off</Lbl>
                <input type="date" value={form.vessel_cut_off} onChange={e => setForm(p => ({ ...p, vessel_cut_off: e.target.value }))} style={inputStyle} />
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
                <select value={form.shipping_line} onChange={e => setForm(p => ({ ...p, shipping_line: e.target.value }))} style={selectStyle}>
                  <option value="">Select...</option>
                  {["ESL", "RCL", "ASYAD", "MAERSK", "CMA", "MSC", "Unifeeder", "WANHAI", "Transmar", "Hapag-Lloyd", "ONE", "COSCO", "PIL", "VASCO", "CSL"].map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <Lbl>Rate per Container/Load</Lbl>
                <input value={form.rate_per_container_load} onChange={e => setForm(p => ({ ...p, rate_per_container_load: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <Lbl>Transit Time (days)</Lbl>
                <input value={form.transit_time_in_days} onChange={e => setForm(p => ({ ...p, transit_time_in_days: e.target.value }))} style={inputStyle} />
              </div>
          </div>
        </div>

        {/* Footer — matches Purchase wizard style */}
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
                {creating ? "Creating..." : "Create Sales Order"}
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
        title="Create Sales Shipment?"
        confirmLabel="Yes, Create Shipment"
        cancelLabel="Go Back"
        confirmColor={C.terra}
        message={
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, color: C.dark, lineHeight: 1.5 }}>
              You are about to create a new Sales Shipment with the following details:
            </div>
            <div style={{
              background: C.tBg, border: `1px solid ${C.tBdr}`, borderRadius: 6,
              padding: "8px 10px", display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px",
              fontSize: 11,
            }}>
              <span style={{ fontWeight: 600, color: C.terra }}>Company</span>
              <span style={{ color: C.dark }}>{confirmSummary.companyName}</span>
              <span style={{ fontWeight: 600, color: C.terra }}>Customer</span>
              <span style={{ color: C.dark }}>{confirmSummary.customerName}</span>
              <span style={{ fontWeight: 600, color: C.terra }}>Lines</span>
              <span style={{ color: C.dark }}>{confirmSummary.lineCount} product{confirmSummary.lineCount !== 1 ? "s" : ""}</span>
              <span style={{ fontWeight: 600, color: C.terra }}>Total Qty</span>
              <span style={{ color: C.dark }}>{confirmSummary.totalQty.toLocaleString()}</span>
              <span style={{ fontWeight: 600, color: C.terra }}>Total Value</span>
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
        message="Creating Sales Shipment..."
        title="Creating Sales Shipment"
        subtitle="Sending data and confirming the order"
        error={creationError || undefined}
        onErrorClose={() => setCreationError("")}
        success={creationSuccess}
        successMessage={createdId ? `Sales Order #${createdId} created and confirmed.` : "Sales Order created successfully!"}
      />
    </div>
  );
}
