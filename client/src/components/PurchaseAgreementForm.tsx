// ══════════════════════════════════════════════════════════════════════════════
// CREATE / EDIT PURCHASE AGREEMENT — Modal form overlay
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { C, FONT, MONO } from "@/lib/data";
import { trpc } from "@/lib/trpc";
import { SearchableProductSelect } from "@/components/SearchableProductSelect";

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface LineInput {
  key: string; // client-side key for React
  existingId?: number; // Odoo line ID (for edit mode)
  product_id: number | null;
  productName: string;
  product_qty: number;
  price_unit: number;
  product_uom_id: number | null;
  uomName: string;
  tax_rate: number; // VAT percentage: 0, 5, 14, or 15
}

const VAT_OPTIONS = [
  { value: 0, label: "0%" },
  { value: 5, label: "5%" },
  { value: 14, label: "14%" },
  { value: 15, label: "15%" },
];

interface PurchaseAgreementFormProps {
  mode: "create" | "edit";
  onClose: () => void;
  onSuccess: () => void;
  activeCompanyId?: number | "ALL";
  // For edit mode — pre-fill with existing data
  editData?: {
    id: number;
    name: string;
    vendorId: number | null;
    vendor: string | null;
    reference: string | null;
    dateStart: string | null;
    dateEnd: string | null;
    companyId: number | null;
    currencyId: number | null;
    currency: string | null;
    state: string | null;
    totalQuantityTons: number;
    incoterm: string | null;
    purchaseCurrency: string | null;
    insuranceIncluded: boolean;
    paymentTerms: string | null;
    notes: string | null;
    supplyStartDate: string | null;
    supplyEndDate: string | null;
    lines: {
      id: number;
      productId: number | null;
      product: string | null;
      quantity: number;
      priceUnit: number;
      uomId: number | null;
      uom: string | null;
    }[];
  };
}

// ─── STYLES ─────────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0,0,0,.45)", zIndex: 1100,
  display: "flex", alignItems: "center", justifyContent: "center",
};

const modalStyle: React.CSSProperties = {
  background: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
  width: "min(720px, 94vw)", maxHeight: "90vh", overflowY: "auto",
  boxShadow: "0 20px 60px rgba(0,0,0,.15)",
  position: "relative", zIndex: 1101,
};

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: C.sage,
  textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 6,
  border: `1.5px solid ${C.inputBdr}`, fontSize: 12,
  fontFamily: FONT, color: C.dark, background: C.card,
  outline: "none", transition: "border-color .15s",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: "pointer", appearance: "auto" as any,
};

const INCOTERM_OPTIONS = [
  "EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP",
  "FAS", "FOB", "CFR", "CIF",
];

const CURRENCY_OPTIONS = ["USD", "EUR", "SAR", "AED", "EGP", "GBP"];

let _lineKey = 0;
const nextKey = () => `line-${++_lineKey}`;

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function PurchaseAgreementForm({
  mode,
  onClose,
  onSuccess,
  editData,
  activeCompanyId,
}: PurchaseAgreementFormProps) {
  // ─── Lookup data from Odoo (non-dependent) ─────────────────────────────
  const { data: companies } = trpc.odoo.companies.useQuery();
  const { data: currencies } = trpc.odoo.currencies.useQuery();
  const { data: pickingTypes } = trpc.odoo.pickingTypes.useQuery();
  const { data: uoms } = trpc.odoo.uoms.useQuery();
  const { data: paymentTermsData } = trpc.odoo.paymentTerms.useQuery();
  const paymentTermsOptions = paymentTermsData ?? [];

  // ─── Form State ─────────────────────────────────────────────────────────
  const [vendorId, setVendorId] = useState<number | null>(editData?.vendorId ?? null);
  const [companyId, setCompanyId] = useState<number | null>(editData?.companyId ?? null);
  const [currencyId, setCurrencyId] = useState<number | null>(editData?.currencyId ?? null);
  const [pickingTypeId, setPickingTypeId] = useState<number | null>(null);
  const [reference, setReference] = useState(editData?.reference ?? "");
  const [dateStart, setDateStart] = useState(editData?.dateStart ?? "");
  const [dateEnd, setDateEnd] = useState(editData?.dateEnd ?? "");
  const [incoterm, setIncoterm] = useState(editData?.incoterm ?? "");
  const [purchaseCurrency, setPurchaseCurrency] = useState(editData?.purchaseCurrency ?? "");
  const [insuranceIncluded, setInsuranceIncluded] = useState(editData?.insuranceIncluded ?? false);
  const [totalQuantityTons, setTotalQuantityTons] = useState(editData?.totalQuantityTons ?? 0);
  const [paymentTerms, setPaymentTerms] = useState(editData?.paymentTerms ?? "");
  const [notes, setNotes] = useState(editData?.notes ?? "");
  const [supplyStartDate, setSupplyStartDate] = useState(editData?.supplyStartDate ?? "");
  const [supplyEndDate, setSupplyEndDate] = useState(editData?.supplyEndDate ?? "");
  const [lines, setLines] = useState<LineInput[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

   // ─── Vendor query (filtered by selected company or activeCompanyId fallback) ───
  const effectiveVendorCompanyId = companyId ?? (activeCompanyId !== "ALL" ? activeCompanyId : undefined) ?? undefined;
  const { data: vendors } = trpc.odoo.vendors.useQuery(
    effectiveVendorCompanyId ? { companyId: effectiveVendorCompanyId } : undefined
  );

  // ─── Vendor search ──────────────────────────────────────────────────────
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
  const vendorContainerRef = useRef<HTMLDivElement>(null);
  const [vendorDropdownPos, setVendorDropdownPos] = useState({ top: 0, left: 0, width: 300 });
  const filteredVendors = useMemo(() => {
    if (!vendors) return [];
    if (!vendorSearch) return vendors.slice(0, 20);
    const q = vendorSearch.toLowerCase();
    return vendors.filter(v => v.name.toLowerCase().includes(q)).slice(0, 20);
  }, [vendors, vendorSearch]);

  // Update vendor dropdown position when open
  useEffect(() => {
    if (vendorDropdownOpen && vendorContainerRef.current) {
      const rect = vendorContainerRef.current.getBoundingClientRect();
      setVendorDropdownPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
    }
  }, [vendorDropdownOpen]);

  // Track position on scroll/resize while vendor dropdown is open
  useEffect(() => {
    if (!vendorDropdownOpen) return;
    const updatePos = () => {
      if (vendorContainerRef.current) {
        const rect = vendorContainerRef.current.getBoundingClientRect();
        setVendorDropdownPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
      }
    };
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [vendorDropdownOpen]);

  // Close vendor dropdown on outside click
  useEffect(() => {
    if (!vendorDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (vendorContainerRef.current && !vendorContainerRef.current.contains(e.target as Node)) {
        const portalEl = document.getElementById("vendor-dropdown-portal");
        if (portalEl && portalEl.contains(e.target as Node)) return;
        setVendorDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [vendorDropdownOpen]);

  // ─── Reset vendor when company changes ─────────────────────────────────
  const [prevCompanyId, setPrevCompanyId] = useState<number | null>(companyId);
  if (companyId !== prevCompanyId) {
    setPrevCompanyId(companyId);
    setVendorId(null);
    setVendorSearch("");
    setVendorDropdownOpen(false);
  }



  // ─── Initialize edit mode lines ─────────────────────────────────────────
  useEffect(() => {
    if (mode === "edit" && editData?.lines) {
      setLines(
        editData.lines.map((l) => ({
          key: nextKey(),
          existingId: l.id,
          product_id: l.productId,
          productName: l.product || "",
          product_qty: l.quantity,
          price_unit: l.priceUnit,
          product_uom_id: l.uomId,
          uomName: l.uom || "",
          tax_rate: 0,
        }))
      );
    } else {
      // Start with one empty line for create
      setLines([{
        key: nextKey(), product_id: null, productName: "",
        product_qty: 0, price_unit: 0, product_uom_id: null, uomName: "", tax_rate: 0,
      }]);
    }
  }, [mode, editData]);

  // ─── Auto-select picking type based on company ──────────────────────────
  useEffect(() => {
    if (companyId && pickingTypes) {
      const match = pickingTypes.find(pt => pt.companyId === companyId);
      if (match) setPickingTypeId(match.id);
    }
  }, [companyId, pickingTypes]);

  // ─── Mutations ──────────────────────────────────────────────────────────
  const utils = trpc.useUtils();
  const createMutation = trpc.odoo.createPurchaseAgreement.useMutation({
    onSuccess: () => {
      utils.odoo.purchaseAgreements.invalidate();
      onSuccess();
    },
  });
  const updateMutation = trpc.odoo.updatePurchaseAgreement.useMutation({
    onSuccess: () => {
      utils.odoo.purchaseAgreements.invalidate();
      onSuccess();
    },
  });

  // ─── Line Handlers ──────────────────────────────────────────────────────
  const addLine = useCallback(() => {
    setLines(prev => [...prev, {
      key: nextKey(), product_id: null, productName: "",
      product_qty: 0, price_unit: 0, product_uom_id: null, uomName: "", tax_rate: 0,
    }]);
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines(prev => prev.filter(l => l.key !== key));
  }, []);

  const updateLine = useCallback((key: string, field: keyof LineInput, value: any) => {
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l));
  }, []);

  const selectProduct = useCallback((lineKey: string, productId: number, product: { id: number; name: string; uom: { id: number; name: string } | null; purchaseUom: { id: number; name: string } | null } | null) => {
    setLines(prev => prev.map(l => l.key === lineKey ? {
      ...l,
      product_id: product ? product.id : null,
      productName: product ? product.name : "",
      product_uom_id: product?.uom?.id ?? null,
      uomName: product?.uom?.name ?? "",
    } : l));
  }, []);

  // ─── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null);

    if (!companyId) { setError("Please select a company"); return; }
    if (!currencyId) { setError("Please select a currency"); return; }
    if (!pickingTypeId) { setError("Please select a picking type (auto-selected by company)"); return; }
    if (lines.length === 0 || lines.every(l => !l.product_id)) {
      setError("Please add at least one product line"); return;
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        await createMutation.mutateAsync({
          company_id: companyId,
          currency_id: currencyId,
          picking_type_id: pickingTypeId,
          vendor_id: vendorId || undefined,
          reference: reference || undefined,
          date_start: dateStart || undefined,
          date_end: dateEnd || undefined,
          x_studio_purchase_incoterm_condition: incoterm || undefined,
          x_studio_purchase_currency: purchaseCurrency || undefined,
          x_studio_insurance_included: insuranceIncluded,
          x_studio_total_po_quantity_in_tons: totalQuantityTons || undefined,
          x_studio_payment_terms: paymentTerms || undefined,
          x_studio_notes: notes || undefined,
          x_studio_supply_start_date: supplyStartDate || undefined,
          x_studio_supply_end_date: supplyEndDate || undefined,
          lines: lines
            .filter(l => l.product_id)
            .map(l => ({
              product_id: l.product_id!,
              product_qty: l.product_qty,
              price_unit: l.price_unit,
              product_uom_id: l.product_uom_id || undefined,
            })),
        });
      } else if (editData) {
        // Determine which lines to add, update, delete
        const existingIds = new Set(editData.lines.map(l => l.id));
        const currentExistingIds = new Set(lines.filter(l => l.existingId).map(l => l.existingId!));

        const addLines = lines
          .filter(l => !l.existingId && l.product_id)
          .map(l => ({
            product_id: l.product_id!,
            product_qty: l.product_qty,
            price_unit: l.price_unit,
            product_uom_id: l.product_uom_id || undefined,
          }));

        const updateLines = lines
          .filter(l => l.existingId)
          .map(l => ({
            id: l.existingId!,
            product_qty: l.product_qty,
            price_unit: l.price_unit,
          }));

        const deleteLineIds = Array.from(existingIds).filter(id => !currentExistingIds.has(id));

        await updateMutation.mutateAsync({
          id: editData.id,
          vendor_id: vendorId || undefined,
          reference: reference || undefined,
          date_start: dateStart || undefined,
          date_end: dateEnd || undefined,
          currency_id: currencyId || undefined,
          x_studio_purchase_incoterm_condition: incoterm || undefined,
          x_studio_purchase_currency: purchaseCurrency || undefined,
          x_studio_insurance_included: insuranceIncluded,
          x_studio_total_po_quantity_in_tons: totalQuantityTons || undefined,
          x_studio_payment_terms: paymentTerms || undefined,
          x_studio_notes: notes || undefined,
          x_studio_supply_start_date: supplyStartDate || undefined,
          x_studio_supply_end_date: supplyEndDate || undefined,
          addLines: addLines.length > 0 ? addLines : undefined,
          updateLines: updateLines.length > 0 ? updateLines : undefined,
          deleteLineIds: deleteLineIds.length > 0 ? deleteLineIds : undefined,
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to save agreement");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: C.gBg2,
              border: `1.5px solid ${C.gBdr2}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800, color: C.forest,
            }}>↓</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>
                {mode === "create" ? "New Purchase Agreement" : `Edit ${editData?.name}`}
              </div>
              <div style={{ fontSize: 10, color: C.muted }}>
                {mode === "create" ? "Creates a new purchase agreement" : "Updates the agreement"}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`,
            background: "transparent", cursor: "pointer", fontSize: 14, color: C.gray,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* Form Body */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Error */}
          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: 8, background: C.rBg,
              border: `1px solid ${C.rBdr}`, color: C.red, fontSize: 11, fontWeight: 600,
            }}>{error}</div>
          )}

          {/* Row 1: Vendor Reference + Company */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={labelStyle}>Vendor Reference</div>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Vendor agreement / PO number"
                style={inputStyle}
              />
            </div>
            <div>
              <div style={labelStyle}>Company *</div>
              <select
                value={companyId ?? ""}
                onChange={e => {
                  const newId = e.target.value ? Number(e.target.value) : null;
                  setCompanyId(newId);
                  // Reset vendor when company changes
                  setVendorId(null);
                  setVendorSearch("");
                }}
                style={selectStyle}
                disabled={mode === "edit"}
              >
                <option value="">Select company...</option>
                {(companies || []).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Vendor (searchable) */}
          <div ref={vendorContainerRef} style={{ position: "relative" }}>
            <div style={labelStyle}>Vendor (Partner) {companyId ? "*" : "(select company first)"}</div>
            <input
              type="text"
              placeholder={vendorId ? (vendors?.find(v => v.id === vendorId)?.name || "Selected") : (companyId ? "Search vendors..." : "Select a company first")}
              value={vendorSearch}
              onChange={e => { setVendorSearch(e.target.value); setVendorDropdownOpen(true); }}
              onFocus={() => { if (companyId) setVendorDropdownOpen(true); }}
              disabled={!companyId}
              style={{
                ...inputStyle,
                color: vendorId && !vendorSearch ? C.forest : C.dark,
                fontWeight: vendorId && !vendorSearch ? 600 : 400,
                opacity: companyId ? 1 : 0.5,
              }}
            />
            {vendorId && (
              <div style={{ fontSize: 10, color: C.forest, marginTop: 2, fontWeight: 600 }}>
                Selected: {vendors?.find(v => v.id === vendorId)?.name}
                <span
                  onClick={() => { setVendorId(null); setVendorSearch(""); }}
                  style={{ marginLeft: 6, color: C.red, cursor: "pointer", fontWeight: 400 }}
                >clear</span>
              </div>
            )}
            {vendorDropdownOpen && filteredVendors.length > 0 && createPortal(
              <div
                id="vendor-dropdown-portal"
                style={{
                  position: "fixed",
                  top: vendorDropdownPos.top,
                  left: vendorDropdownPos.left,
                  width: vendorDropdownPos.width,
                  maxHeight: 200, overflowY: "auto",
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 12000,
                }}>
                {filteredVendors.map(v => (
                  <div key={v.id}
                    onClick={() => { setVendorId(v.id); setVendorSearch(""); setVendorDropdownOpen(false); }}
                    style={{
                      padding: "8px 12px", fontSize: 11, cursor: "pointer",
                      borderBottom: `1px solid ${C.border}`,
                      background: v.id === vendorId ? C.gBg2 : "transparent",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = C.gBg}
                    onMouseLeave={e => e.currentTarget.style.background = v.id === vendorId ? C.gBg2 : "transparent"}
                  >{v.name}</div>
                ))}
              </div>,
              document.body
            )}
          </div>

          {/* Row 3: Incoterm + Purchase Currency */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={labelStyle}>Incoterm</div>
              <select
                value={incoterm}
                onChange={e => setIncoterm(e.target.value)}
                style={selectStyle}
              >
                <option value="">Select incoterm...</option>
                {INCOTERM_OPTIONS.map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Purchase Currency</div>
              <select
                value={purchaseCurrency}
                onChange={e => setPurchaseCurrency(e.target.value)}
                style={selectStyle}
              >
                <option value="">Select currency...</option>
                {CURRENCY_OPTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Supply Start Date + Supply End Date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={labelStyle}>Supply Start Date</div>
              <input
                type="date"
                value={dateStart}
                onChange={e => setDateStart(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <div style={labelStyle}>Supply End Date</div>
              <input
                type="date"
                value={dateEnd}
                onChange={e => setDateEnd(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row 5: Payment Terms + Insurance */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={labelStyle}>Payment Terms</div>
              <select
                value={paymentTerms}
                onChange={e => setPaymentTerms(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select payment terms…</option>
                {paymentTermsOptions.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 4 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={insuranceIncluded}
                  onChange={e => setInsuranceIncluded(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: C.forest }}
                />
                <span style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>Insurance Included</span>
              </label>
            </div>
          </div>

          {/* Row 6: Notes */}
          <div>
            <div style={labelStyle}>Notes</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
              style={{
                ...inputStyle, resize: "vertical", minHeight: 60,
                fontFamily: FONT,
              }}
            />
          </div>

          {/* Picking Type (auto-selected, shown for info) */}
          {pickingTypeId && pickingTypes && (
            <div style={{ fontSize: 10, color: C.sage, fontStyle: "italic" }}>
              Picking Type: {pickingTypes.find(pt => pt.id === pickingTypeId)?.name || pickingTypeId} (auto-selected)
            </div>
          )}

          {/* ─── Lines Section ──────────────────────────────────────────── */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={labelStyle}>Product Lines</div>
              <button onClick={addLine} style={{
                padding: "4px 12px", borderRadius: 6, border: `1.5px solid ${C.gBdr2}`,
                background: C.gBg2, color: C.forest, fontSize: 10, fontWeight: 700,
                cursor: "pointer",
              }}>+ Add Line</button>
            </div>

            {/* Lines Table */}
            <div style={{
              border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.8fr 0.7fr 36px",
                background: C.gBg, borderBottom: `1.5px solid ${C.border}`,
              }}>
                {["Product", "Qty", "Price/Unit", "UoM", "VAT", ""].map((h, i) => (
                  <div key={i} style={{
                    padding: "8px 10px", fontSize: 9, fontWeight: 700,
                    color: C.sage, textTransform: "uppercase", letterSpacing: 0.6,
                  }}>{h}</div>
                ))}
              </div>

              {/* Line Rows */}
              {lines.map((line) => (
                <div key={line.key} style={{
                  display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.8fr 0.7fr 36px",
                  borderBottom: `1px solid ${C.border}`, alignItems: "center",
                }}>
                  {/* Product (searchable, filtered by company) */}
                  <div style={{ padding: "6px 8px" }}>
                    <SearchableProductSelect
                      value={line.product_id || 0}
                      companyId={companyId || undefined}
                      onChange={(productId, product) => selectProduct(line.key, productId, product)}
                    />
                  </div>

                  {/* Qty */}
                  <div style={{ padding: "6px 8px" }}>
                    <input
                      type="number"
                      value={line.product_qty || ""}
                      onChange={e => updateLine(line.key, "product_qty", parseFloat(e.target.value) || 0)}
                      style={{ ...inputStyle, padding: "4px 8px", fontSize: 11, fontFamily: MONO }}
                      min={0}
                    />
                  </div>

                  {/* Price */}
                  <div style={{ padding: "6px 8px" }}>
                    <input
                      type="number"
                      value={line.price_unit || ""}
                      onChange={e => updateLine(line.key, "price_unit", parseFloat(e.target.value) || 0)}
                      style={{ ...inputStyle, padding: "4px 8px", fontSize: 11, fontFamily: MONO }}
                      min={0}
                      step={0.01}
                    />
                  </div>

                  {/* UoM */}
                  <div style={{ padding: "6px 8px" }}>
                    <select
                      value={line.product_uom_id ?? ""}
                      onChange={e => {
                        const id = e.target.value ? Number(e.target.value) : null;
                        const name = uoms?.find(u => u.id === id)?.name || "";
                        updateLine(line.key, "product_uom_id", id);
                        updateLine(line.key, "uomName", name);
                      }}
                      style={{ ...selectStyle, padding: "4px 6px", fontSize: 10 }}
                    >
                      <option value="">{line.uomName || "UoM..."}</option>
                      {(uoms || []).map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* VAT */}
                  <div style={{ padding: "6px 8px" }}>
                    <select
                      value={line.tax_rate}
                      onChange={e => updateLine(line.key, "tax_rate", Number(e.target.value))}
                      style={{ ...selectStyle, padding: "4px 4px", fontSize: 10 }}
                    >
                      {VAT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Remove */}
                  <div style={{ padding: "6px 4px", textAlign: "center" }}>
                    {lines.length > 1 && (
                      <button
                        onClick={() => removeLine(line.key)}
                        style={{
                          width: 22, height: 22, borderRadius: 4, border: `1px solid ${C.rBdr}`,
                          background: C.rBg, color: C.red, fontSize: 12, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >×</button>
                    )}
                  </div>
                </div>
              ))}

              {lines.length === 0 && (
                <div style={{ padding: "16px", textAlign: "center", color: C.muted, fontSize: 11 }}>
                  No lines added. Click "+ Add Line" above.
                </div>
              )}
            </div>

            {/* Line Summary */}
            {lines.some(l => l.product_id) && (
              <div style={{
                marginTop: 8, padding: "8px 12px", borderRadius: 6,
                background: C.gBg, border: `1px solid ${C.gBdr}`,
                display: "flex", justifyContent: "space-between", fontSize: 11,
              }}>
                <span style={{ color: C.sage, fontWeight: 600 }}>
                  {lines.filter(l => l.product_id).length} line(s)
                </span>
                <span style={{ fontFamily: MONO, fontWeight: 700, color: C.forest }}>
                  Subtotal: {lines.reduce((s, l) => s + (l.product_qty * l.price_unit), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  {lines.some(l => l.tax_rate > 0) && (
                    <span style={{ color: C.sage, fontWeight: 500, marginLeft: 12 }}>
                      + Tax: {lines.reduce((s, l) => s + (l.product_qty * l.price_unit * l.tax_rate / 100), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px", borderTop: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <button onClick={onClose} style={{
            padding: "8px 20px", borderRadius: 6, border: `1px solid ${C.border}`,
            background: "transparent", fontSize: 11, fontWeight: 600, color: C.gray,
            cursor: "pointer",
          }}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: "8px 24px", borderRadius: 6, border: "none",
              background: submitting ? C.border : C.forest,
              color: C.white, fontSize: 12, fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting
              ? (mode === "create" ? "Creating..." : "Saving...")
              : (mode === "create" ? "Create Agreement" : "Save Changes")}
          </button>
        </div>
      </div>
    </div>
  );
}
