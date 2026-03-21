// ══════════════════════════════════════════════════════════════════════════════
// CREATE / EDIT SALES AGREEMENT — Modal form overlay
// Now includes: Supply Start Date, Supply End Date, and Product Lines
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from "react";
import { C, FONT, MONO } from "@/lib/data";
import { trpc } from "@/lib/trpc";
import { SearchableProductSelect } from "@/components/SearchableProductSelect";

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface LineInput {
  key: string;
  existingId?: number; // Odoo line ID (for edit mode)
  product_id: number | null;
  productName: string;
  product_uom_qty: number;
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

interface SalesAgreementFormProps {
  mode: "create" | "edit";
  onClose: () => void;
  onSuccess: () => void;
  activeCompanyId?: number | "ALL";
  editData?: {
    id: number;
    name: string;
    customerId: number | null;
    customer: string | null;
    studioCustomerId: number | null;
    studioCustomerName: string | null;
    ultimateCustomer: string | null;
    incoterm: string | null;
    currency: string | null;
    insuranceIncluded: boolean;
    supplyStartDate: string | null;
    supplyEndDate: string | null;
    notes: string | null;
    paymentTerms: string | null;
    companyId: number | null;
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
  background: "rgba(0,0,0,.35)", zIndex: 1100,
  display: "flex", alignItems: "center", justifyContent: "center",
};

const modalStyle: React.CSSProperties = {
  background: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
  width: "min(720px, 94vw)", maxHeight: "90vh", overflowY: "auto",
  boxShadow: "0 20px 60px rgba(0,0,0,.15)", zIndex: 1101,
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
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: "pointer", appearance: "auto" as any,
};

// ─── INCOTERM OPTIONS ───────────────────────────────────────────────────────
const INCOTERM_OPTIONS = [
  "EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP",
  "FAS", "FOB", "CFR", "CIF",
];

// ─── CURRENCY OPTIONS ───────────────────────────────────────────────────────
const CURRENCY_OPTIONS = ["USD", "EUR", "SAR", "AED", "EGP", "GBP"];

let _lineKey = 0;
const nextKey = () => `sa-line-${++_lineKey}`;

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function SalesAgreementForm({
  mode,
  onClose,
  onSuccess,
  editData,
  activeCompanyId,
}: SalesAgreementFormProps) {
  // ─── Lookup data from Odoo ──────────────────────────────────────────────
  const { data: companies } = trpc.odoo.companies.useQuery();
  const { data: uoms } = trpc.odoo.uoms.useQuery();
  const { data: paymentTermsData } = trpc.odoo.paymentTerms.useQuery();
  const paymentTermsOptions = paymentTermsData ?? [];

  // ─── Form State ─────────────────────────────────────────────────────────
  const [name, setName] = useState(editData?.name ?? "");
  const [customerId, setCustomerId] = useState<number | null>(editData?.customerId ?? null);
  // Studio Customer removed — redundant with Customer
  const [ultimateCustomer, setUltimateCustomer] = useState(editData?.ultimateCustomer ?? "");
  const [incoterm, setIncoterm] = useState(editData?.incoterm ?? "");
  const [currency, setCurrency] = useState(editData?.currency ?? "");
  const [insuranceIncluded, setInsuranceIncluded] = useState(editData?.insuranceIncluded ?? false);
  const [supplyStartDate, setSupplyStartDate] = useState(editData?.supplyStartDate ?? "");
  const [supplyEndDate, setSupplyEndDate] = useState(editData?.supplyEndDate ?? "");
  const [notes, setNotes] = useState(editData?.notes ?? "");
  const [paymentTerms, setPaymentTerms] = useState(editData?.paymentTerms ?? "");
  const [companyId, setCompanyId] = useState<number | null>(editData?.companyId ?? null);

  // ─── Customer query (filtered by selected company) ─────────────────────
  const effectiveCustomerCompanyId = companyId ?? (activeCompanyId !== "ALL" ? activeCompanyId : undefined) ?? undefined;
  const { data: customers } = trpc.odoo.customers.useQuery(
    effectiveCustomerCompanyId ? { companyId: effectiveCustomerCompanyId } : undefined
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Product Lines State ────────────────────────────────────────────────
  const [lines, setLines] = useState<LineInput[]>([]);

  // ─── Initialize edit mode lines ─────────────────────────────────────────
  useEffect(() => {
    if (mode === "edit" && editData?.lines) {
      setLines(
        editData.lines.map((l) => ({
          key: nextKey(),
          existingId: l.id,
          product_id: l.productId,
          productName: l.product || "",
          product_uom_qty: l.quantity,
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
        product_uom_qty: 0, price_unit: 0, product_uom_id: null, uomName: "", tax_rate: 0,
      }]);
    }
  }, [mode, editData]);

  // ─── Customer search ────────────────────────────────────────────────────
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (!customerSearch) return customers.slice(0, 20);
    const q = customerSearch.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q)).slice(0, 20);
  }, [customers, customerSearch]);



  // ─── Line Handlers ──────────────────────────────────────────────────────
  const addLine = useCallback(() => {
    setLines(prev => [...prev, {
      key: nextKey(), product_id: null, productName: "",
      product_uom_qty: 0, price_unit: 0, product_uom_id: null, uomName: "", tax_rate: 0,
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

  // ─── Mutations ──────────────────────────────────────────────────────────
  const utils = trpc.useUtils();
  const createMutation = trpc.odoo.createSalesAgreement.useMutation({
    onSuccess: () => {
      utils.odoo.salesAgreements.invalidate();
      onSuccess();
    },
  });
  const updateMutation = trpc.odoo.updateSalesAgreement.useMutation({
    onSuccess: () => {
      utils.odoo.salesAgreements.invalidate();
      onSuccess();
    },
  });

  // ─── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null);

    if (!customerId) { setError("Please select a customer (partner)"); return; }

    setSubmitting(true);
    try {
      // Build lines payload for create
      const validLines = lines.filter(l => l.product_id);

      if (mode === "create") {
        await createMutation.mutateAsync({
          name: name.trim(),
          partner_id: customerId,
          company_id: companyId || undefined,

          x_studio_ultimate_customer: ultimateCustomer || undefined,
          x_studio_sales_incoterm_condition: incoterm || undefined,
          x_studio_sales_currency: currency || undefined,
          x_studio_insurance_included: insuranceIncluded,
          x_studio_supply_start_date: supplyStartDate || undefined,
          x_studio_supply_end_date: supplyEndDate || undefined,
          x_studio_notes: notes || undefined,
          x_studio_payment_terms: paymentTerms || undefined,
          lines: validLines.length > 0 ? validLines.map(l => ({
            product_id: l.product_id!,
            product_uom_qty: l.product_uom_qty,
            price_unit: l.price_unit,
            product_uom_id: l.product_uom_id || undefined,
          })) : undefined,
        });
      } else if (editData) {
        // Determine which lines to add, update, delete
        const existingIds = new Set((editData.lines || []).map(l => l.id));
        const currentExistingIds = new Set(lines.filter(l => l.existingId).map(l => l.existingId!));

        const addLines = lines
          .filter(l => !l.existingId && l.product_id)
          .map(l => ({
            product_id: l.product_id!,
            product_uom_qty: l.product_uom_qty,
            price_unit: l.price_unit,
            product_uom_id: l.product_uom_id || undefined,
          }));

        const updateLines = lines
          .filter(l => l.existingId)
          .map(l => ({
            id: l.existingId!,
            product_uom_qty: l.product_uom_qty,
            price_unit: l.price_unit,
          }));

        const deleteLineIds = Array.from(existingIds).filter(id => !currentExistingIds.has(id));

        await updateMutation.mutateAsync({
          id: editData.id,
          name: name.trim(),
          partner_id: customerId || undefined,

          x_studio_ultimate_customer: ultimateCustomer || undefined,
          x_studio_sales_incoterm_condition: incoterm || undefined,
          x_studio_sales_currency: currency || undefined,
          x_studio_insurance_included: insuranceIncluded,
          x_studio_supply_start_date: supplyStartDate || undefined,
          x_studio_supply_end_date: supplyEndDate || undefined,
          x_studio_notes: notes || undefined,
          x_studio_payment_terms: paymentTerms || undefined,
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
              width: 36, height: 36, borderRadius: 8, background: C.tBg,
              border: `1.5px solid ${C.tBdr}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800, color: C.terra,
            }}>↑</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>
                {mode === "create" ? "New Sales Agreement" : `Edit ${editData?.name}`}
              </div>
              <div style={{ fontSize: 10, color: C.muted }}>
                {mode === "create" ? "Creates a new sales agreement" : "Updates the agreement"}
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

          {/* Row 1: Customer Reference + Company */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={labelStyle}>Customer Reference</div>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Customer PO / reference number"
                style={inputStyle}
              />
            </div>
            <div>
              <div style={labelStyle}>Company</div>
              <select
                value={companyId ?? ""}
                onChange={e => {
                  const newId = e.target.value ? Number(e.target.value) : null;
                  setCompanyId(newId);
                  // Reset customer when company changes
                  setCustomerId(null);
                  setCustomerSearch("");
                }}
                style={selectStyle}
              >
                <option value="">Select company...</option>
                {(companies || []).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Customer (searchable) */}
          <div style={{ position: "relative" }}>
            <div style={labelStyle}>Customer (Partner) *</div>
            <input
              type="text"
              placeholder={customerId ? (customers?.find(c => c.id === customerId)?.name || "Selected") : "Search customers..."}
              value={customerSearch}
              onChange={e => { setCustomerSearch(e.target.value); setCustomerDropdownOpen(true); }}
              onFocus={() => setCustomerDropdownOpen(true)}
              style={{
                ...inputStyle,
                color: customerId && !customerSearch ? C.terra : C.dark,
                fontWeight: customerId && !customerSearch ? 600 : 400,
              }}
            />
            {customerId && (
              <div style={{ fontSize: 10, color: C.terra, marginTop: 2, fontWeight: 600 }}>
                Selected: {customers?.find(c => c.id === customerId)?.name}
                <span
                  onClick={() => { setCustomerId(null); setCustomerSearch(""); }}
                  style={{ marginLeft: 6, color: C.red, cursor: "pointer", fontWeight: 400 }}
                >clear</span>
              </div>
            )}
            {customerDropdownOpen && filteredCustomers.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 200, overflowY: "auto",
              }}>
                {filteredCustomers.map(c => (
                  <div key={c.id}
                    onClick={() => { setCustomerId(c.id); setCustomerSearch(""); setCustomerDropdownOpen(false); }}
                    style={{
                      padding: "8px 12px", fontSize: 11, cursor: "pointer",
                      borderBottom: `1px solid ${C.border}`,
                      background: c.id === customerId ? C.gBg2 : "transparent",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = C.gBg}
                    onMouseLeave={e => e.currentTarget.style.background = c.id === customerId ? C.gBg2 : "transparent"}
                  >{c.name}</div>
                ))}
              </div>
            )}
          </div>

          {/* Row 3: Ultimate Customer + Incoterm + Currency */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <div style={labelStyle}>Ultimate Customer</div>
              <input
                type="text"
                value={ultimateCustomer}
                onChange={e => setUltimateCustomer(e.target.value)}
                placeholder="End buyer name"
                style={inputStyle}
              />
            </div>
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
              <div style={labelStyle}>Currency</div>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
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
                value={supplyStartDate}
                onChange={e => setSupplyStartDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <div style={labelStyle}>Supply End Date</div>
              <input
                type="date"
                value={supplyEndDate}
                onChange={e => setSupplyEndDate(e.target.value)}
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
                  style={{ width: 16, height: 16, accentColor: C.terra }}
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

          {/* ─── Product Lines Section ──────────────────────────────────── */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={labelStyle}>Product Lines</div>
              <button onClick={addLine} style={{
                padding: "4px 12px", borderRadius: 6, border: `1.5px solid ${C.tBdr}`,
                background: C.tBg, color: C.terra, fontSize: 10, fontWeight: 700,
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
                background: C.tBg, borderBottom: `1.5px solid ${C.border}`,
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
                      value={line.product_uom_qty || ""}
                      onChange={e => updateLine(line.key, "product_uom_qty", parseFloat(e.target.value) || 0)}
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
                        const uomName = uoms?.find(u => u.id === id)?.name || "";
                        updateLine(line.key, "product_uom_id", id);
                        updateLine(line.key, "uomName", uomName);
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
                background: C.tBg, border: `1px solid ${C.tBdr}`,
                display: "flex", justifyContent: "space-between", fontSize: 11,
              }}>
                <span style={{ color: C.sage, fontWeight: 600 }}>
                  {lines.filter(l => l.product_id).length} line(s)
                </span>
                <span style={{ fontFamily: MONO, fontWeight: 700, color: C.terra }}>
                  Subtotal: {lines.reduce((s, l) => s + (l.product_uom_qty * l.price_unit), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  {lines.some(l => l.tax_rate > 0) && (
                    <span style={{ color: C.sage, fontWeight: 500, marginLeft: 12 }}>
                      + Tax: {lines.reduce((s, l) => s + (l.product_uom_qty * l.price_unit * l.tax_rate / 100), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
              background: submitting ? C.border : C.terra,
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
