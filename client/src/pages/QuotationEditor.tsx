// ══════════════════════════════════════════════════════════════════════════════
// QUOTATION / INVOICE EDITOR — Platfarm V3
// Renders inside QuotationsHome shell (no own nav/header).
// Uses the portal's C colour palette from @/lib/data.
// Document preview uses DM Sans + portal design language for full consistency.
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useMemo } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { trpc } from "@/lib/trpc";
import { C, FONT } from "@/lib/data";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310419663030422219/MW4gvkHfHJD9tbPbdFFnda/logo_db87658a.png";
const SIGNATURE_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310419663030422219/MW4gvkHfHJD9tbPbdFFnda/signature_c2779af4.png";
const STAMP_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310419663030422219/MW4gvkHfHJD9tbPbdFFnda/stamp_7ebde919.png";

/** Fetch an image URL and return a base64 data URL (bypasses CORS canvas taint) */
async function toBase64DataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
    if (!res.ok) return url;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

interface Product {
  id: number; description: string; subDescription: string; specs: string;
  quantity: number; unit: string; rate: number; vat: number;
}

interface BankDetails {
  beneficiary: string; bankName: string; iban: string;
  swiftCode: string; branch: string; currency: string;
}

interface Props {
  isInvoice?: boolean;
  onBack?: () => void;
  onViewSaved?: () => void;
}

export default function QuotationEditor({ isInvoice = false, onBack, onViewSaved }: Props) {
  const quotationRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveQuotationMutation = trpc.quotations.save.useMutation();

  // Load from URL param
  const [quotationId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  });
  const [hasLoaded, setHasLoaded] = useState(false);

  const getQuery = trpc.quotations.get.useQuery(
    { id: parseInt(quotationId || "0") },
    { enabled: !!quotationId && !hasLoaded, refetchOnWindowFocus: false, staleTime: Infinity }
  );

  // Client details
  const [clientName, setClientName] = useState("Elite Agro");
  const [clientAddress, setClientAddress] = useState("Abu Dhabi");
  const [clientCountry, setClientCountry] = useState("United Arab Emirates");
  const [clientTrn, setClientTrn] = useState("");
  const [projectName, setProjectName] = useState("");

  // Quotation details
  const [quotationNo, setQuotationNo] = useState("");
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split("T")[0].replace(/-/g, "/"));
  const [validUntil, setValidUntil] = useState("");
  const [incoterms, setIncoterms] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("100% TT in advance");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");
  const [paymentSchedule, setPaymentSchedule] = useState("");
  const [quotationTitle, setQuotationTitle] = useState(isInvoice ? "INVOICE" : "QUOTATION");
  const [quotationSubtitle, setQuotationSubtitle] = useState("");

  // Products
  const [products, setProducts] = useState<Product[]>([
    { id: 1, description: "Double Press, Grade 1 American SunCured Alfalfa", subDescription: "Bale weight 375-400 Kg, Height 85 cm", specs: "Premium Quality", quantity: 500, unit: "MT", rate: 340, vat: 0 },
  ]);

  // Bank details
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    beneficiary: "PLATFARM FOR AGRITECH AND AGRIBUSINESS LTD ABU DHABI",
    bankName: "National Bank of Ras Al Khaimah",
    iban: "AE61 0400 0003 0353 1785 001",
    swiftCode: "NRAKAEAK",
    branch: "KHALIDYA ABU DHABI",
    currency: "USD",
  });

  // Load existing document
  useEffect(() => {
    if (getQuery.data && !hasLoaded) {
      const d = getQuery.data;
      setClientName(d.clientName || "");
      setClientAddress(d.clientAddress || "");
      setClientCountry(d.clientCountry || "");
      setClientTrn(d.clientTrn || "");
      setProjectName(d.projectName || "");
      setQuotationNo(d.quotationNo || "");
      setQuotationDate(d.quotationDate || "");
      setValidUntil(d.validUntil || "");
      setIncoterms(d.incoterms || "");
      setPaymentTerms(d.paymentTerms || "");
      setCurrency(d.currency || "USD");
      setNotes(d.notes || "");
      setPaymentSchedule(d.paymentSchedule || "");
      try {
        if (d.bankDetails) setBankDetails(JSON.parse(d.bankDetails));
        if (d.products) setProducts(JSON.parse(d.products));
      } catch {}
      setHasLoaded(true);

      const params = new URLSearchParams(window.location.search);
      if (params.get("download") === "true") {
        setTimeout(() => downloadPDF(d.quotationNo || ""), 3000);
      }
    }
  }, [getQuery.data, hasLoaded]);

  useEffect(() => {
    if (!quotationId) {
      if (isInvoice) {
        setQuotationTitle("INVOICE");
        setQuotationNo(`INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`);
      } else {
        setQuotationTitle("QUOTATION");
        setQuotationNo(`Q-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`);
      }
    }
  }, [isInvoice, quotationId]);

  // Calculations
  const calculateAmount = (qty: number, rate: number) => qty * rate;
  const subtotal = useMemo(() => products.reduce((s, p) => s + calculateAmount(p.quantity, p.rate), 0), [products]);
  const vatTotal = useMemo(() => products.reduce((s, p) => s + calculateAmount(p.quantity, p.rate) * (p.vat / 100), 0), [products]);
  const total = subtotal + vatTotal;
  const formatNumber = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Product CRUD
  const addProduct = () => setProducts([...products, { id: Date.now(), description: "", subDescription: "", specs: "", quantity: 1, unit: "MT", rate: 0, vat: 0 }]);
  const removeProduct = (id: number) => { if (products.length > 1) setProducts(products.filter(p => p.id !== id)); };
  const updateProduct = (id: number, field: keyof Product, value: string | number) => {
    setProducts(products.map(p => p.id === id ? { ...p, [field]: value } : p));
  };
  const updateBankDetails = (field: keyof BankDetails, value: string) => setBankDetails(prev => ({ ...prev, [field]: value }));

  // Save
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveQuotationMutation.mutateAsync({
        id: quotationId ? parseInt(quotationId) : undefined,
        documentType: isInvoice ? "invoice" : "quotation",
        quotationNo, clientName, clientAddress, clientCountry, clientTrn, projectName,
        quotationDate, validUntil, incoterms, paymentTerms, currency, notes, paymentSchedule,
        bankDetails: JSON.stringify(bankDetails),
        products: JSON.stringify(products),
        subtotal: Math.round(subtotal * 100),
        vatTotal: Math.round(vatTotal * 100),
        total: Math.round(total * 100),
      });
      alert(`${isInvoice ? "Invoice" : "Quotation"} saved successfully!`);
    } catch (error) {
      console.error("Error saving:", error);
      alert("Error saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Generate PDF via server-side Puppeteer endpoint.
   * Sends all quotation data to /api/generate-quotation-pdf and downloads the result.
   * This avoids all browser CORS/canvas issues entirely.
   */
  const downloadPDF = async (customNo?: string) => {
    setIsGeneratingPDF(true);
    try {
      const payload = {
        isInvoice,
        quotationNo: customNo || quotationNo,
        quotationTitle,
        quotationSubtitle,
        quotationDate,
        validUntil,
        incoterms,
        paymentTerms,
        currency,
        notes,
        paymentSchedule,
        clientName,
        clientAddress,
        clientCountry,
        clientTrn,
        projectName,
        products,
        bankDetails,
      };

      const res = await fetch("/api/generate-quotation-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Server PDF generation failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${isInvoice ? "Invoice" : "Quotation"}-${customNo || quotationNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const currencyOptions = ["USD", "AED", "EUR", "GBP", "SAR", "INR"];
  const incotermsOptions = ["", "FOB", "CIF", "CFR", "EXW", "DDP", "DAP", "FCA", "CPT", "CIP"];

  /* ─── Shared style helpers (portal-consistent) ─── */
  const labelSt: React.CSSProperties = { display: "block", fontSize: 10, fontWeight: 600, color: C.gray, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 };
  const inputSt: React.CSSProperties = {
    width: "100%", border: `1.5px solid ${C.inputBdr}`, borderRadius: 6, padding: "7px 10px",
    fontSize: 12, fontFamily: FONT, color: C.dark, outline: "none",
    background: C.white, transition: "border-color 0.2s",
  };
  const cardSt: React.CSSProperties = { background: C.card, borderRadius: 10, padding: 14, border: `1px solid ${C.border}` };
  const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.forest, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 };

  /* ─── Document preview inline colors (hex only — no oklch for html2canvas) ─── */
  const D = {
    forest: "#2D5A3D",
    sage: "#4A7C59",
    terra: "#C0714A",
    dark: "#2C3E50",
    gray: "#64706C",
    muted: "#95A09C",
    light: "#B0BAB6",
    pageBg: "#F7F6F3",
    cardBg: "#FFFFFF",
    greenTint: "#F2F7F3",
    greenTint2: "#E4EFE6",
    greenBdr: "#CDDDD1",
    terraTint: "#FDF7F3",
    terraBdr: "#F0D5C4",
    rowAlt: "#FAFBFA",
    borderLight: "#E4E1DC",
    borderFaint: "#EDE9E4",
  };

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Action bar (inside the shell's content area) */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14, gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onBack && (
            <button onClick={onBack} style={{
              background: C.gBg, border: `1px solid ${C.gBdr}`, borderRadius: 6,
              padding: "5px 10px", fontSize: 10, fontWeight: 600, color: C.forest,
              cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 4,
            }}>
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>
            {isInvoice ? "Invoice" : "Quotation"}: {quotationNo || "New"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {onViewSaved && (
            <button onClick={onViewSaved} style={{
              background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6,
              padding: "5px 12px", fontSize: 10, fontWeight: 600, color: C.gray,
              cursor: "pointer", fontFamily: FONT,
            }}>Saved</button>
          )}
          <button onClick={handleSave} disabled={isSaving} style={{
            background: C.forest, border: "none", borderRadius: 6, padding: "6px 14px",
            color: C.white, fontSize: 11, fontWeight: 600, cursor: isSaving ? "not-allowed" : "pointer",
            fontFamily: FONT, opacity: isSaving ? 0.6 : 1,
          }}>
            {isSaving ? "Saving..." : "Save"}
          </button>
          <button onClick={() => downloadPDF()} disabled={isGeneratingPDF} style={{
            background: C.terra, border: "none", borderRadius: 6, padding: "6px 14px",
            color: C.white, fontSize: 11, fontWeight: 600,
            cursor: isGeneratingPDF ? "not-allowed" : "pointer", fontFamily: FONT,
            opacity: isGeneratingPDF ? 0.6 : 1, display: "flex", alignItems: "center", gap: 4,
          }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            {isGeneratingPDF ? "Generating..." : "PDF"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14 }}>
        {/* ═══ Editor Panel ═══ */}
        <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", maxHeight: "calc(100vh - 140px)" }}>
          {/* Client Details */}
          <div style={cardSt}>
            <h3 style={sectionTitle}>Client Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div><label style={labelSt}>Client Name</label><input style={inputSt} value={clientName} onChange={e => setClientName(e.target.value)} /></div>
              <div><label style={labelSt}>Address</label><input style={inputSt} value={clientAddress} onChange={e => setClientAddress(e.target.value)} /></div>
              <div><label style={labelSt}>Country</label><input style={inputSt} value={clientCountry} onChange={e => setClientCountry(e.target.value)} /></div>
              <div><label style={labelSt}>TRN (Optional)</label><input style={inputSt} value={clientTrn} onChange={e => setClientTrn(e.target.value)} /></div>
              <div><label style={labelSt}>Project Name (Optional)</label><input style={inputSt} value={projectName} onChange={e => setProjectName(e.target.value)} /></div>
            </div>
          </div>

          {/* Quotation Details */}
          <div style={cardSt}>
            <h3 style={sectionTitle}>{isInvoice ? "Invoice" : "Quotation"} Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div><label style={labelSt}>{isInvoice ? "Invoice" : "Quotation"} No</label><input style={inputSt} value={quotationNo} onChange={e => setQuotationNo(e.target.value)} /></div>
              <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><label style={labelSt}>Date</label><input style={inputSt} value={quotationDate} onChange={e => setQuotationDate(e.target.value)} /></div>
                <div><label style={labelSt}>Valid Until</label><input style={inputSt} value={validUntil} onChange={e => setValidUntil(e.target.value)} /></div>
              </div>
              <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelSt}>Incoterms</label>
                  <select style={inputSt} value={incoterms} onChange={e => setIncoterms(e.target.value)}>
                    {incotermsOptions.map(t => <option key={t} value={t}>{t || "—"}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Currency</label>
                  <select style={inputSt} value={currency} onChange={e => setCurrency(e.target.value)}>
                    {currencyOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={labelSt}>Payment Terms</label><input style={inputSt} value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} /></div>
              <div><label style={labelSt}>Title</label><input style={inputSt} value={quotationTitle} onChange={e => setQuotationTitle(e.target.value)} /></div>
              <div><label style={labelSt}>Subtitle (Optional)</label><input style={inputSt} value={quotationSubtitle} onChange={e => setQuotationSubtitle(e.target.value)} placeholder="e.g., Commercial Offer" /></div>
            </div>
          </div>

          {/* Products */}
          <div style={cardSt}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Products</h3>
              <button onClick={addProduct} style={{
                background: C.forest, border: "none", borderRadius: 5, padding: "3px 10px",
                color: C.white, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
              }}>+ Add</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
              {products.map((p, i) => (
                <div key={p.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, background: C.pageBg }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: C.muted }}>Product {i + 1}</span>
                    <button onClick={() => removeProduct(p.id)} disabled={products.length <= 1} style={{
                      background: "none", border: "none", cursor: products.length <= 1 ? "not-allowed" : "pointer",
                      color: products.length <= 1 ? C.border : C.red, fontSize: 13,
                    }}>✕</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <input style={{ ...inputSt, fontSize: 11 }} value={p.description} onChange={e => updateProduct(p.id, "description", e.target.value)} placeholder="Product name" />
                    <input style={{ ...inputSt, fontSize: 10 }} value={p.subDescription} onChange={e => updateProduct(p.id, "subDescription", e.target.value)} placeholder="Sub description" />
                    <input style={{ ...inputSt, fontSize: 10 }} value={p.specs} onChange={e => updateProduct(p.id, "specs", e.target.value)} placeholder="Specs" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 5 }}>
                      <div><label style={{ ...labelSt, fontSize: 8 }}>Qty</label><input type="number" style={{ ...inputSt, fontSize: 11 }} value={p.quantity} onChange={e => updateProduct(p.id, "quantity", parseFloat(e.target.value) || 0)} /></div>
                      <div>
                        <label style={{ ...labelSt, fontSize: 8 }}>Unit</label>
                        <select style={{ ...inputSt, fontSize: 11 }} value={p.unit} onChange={e => updateProduct(p.id, "unit", e.target.value)}>
                          <option value="MT">MT</option><option value="KG">KG</option><option value="LS">LS</option><option value="Units">Units</option>
                        </select>
                      </div>
                      <div><label style={{ ...labelSt, fontSize: 8 }}>Rate</label><input type="number" step="0.01" style={{ ...inputSt, fontSize: 11 }} value={p.rate} onChange={e => updateProduct(p.id, "rate", parseFloat(e.target.value) || 0)} /></div>
                      <div><label style={{ ...labelSt, fontSize: 8 }}>VAT%</label><input type="number" step="0.01" style={{ ...inputSt, fontSize: 11 }} value={p.vat} onChange={e => updateProduct(p.id, "vat", parseFloat(e.target.value) || 0)} /></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bank Details */}
          <div style={cardSt}>
            <h3 style={sectionTitle}>Bank Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div><label style={labelSt}>Beneficiary</label><input style={inputSt} value={bankDetails.beneficiary} onChange={e => updateBankDetails("beneficiary", e.target.value)} /></div>
              <div><label style={labelSt}>Bank Name</label><input style={inputSt} value={bankDetails.bankName} onChange={e => updateBankDetails("bankName", e.target.value)} /></div>
              <div><label style={labelSt}>IBAN</label><input style={inputSt} value={bankDetails.iban} onChange={e => updateBankDetails("iban", e.target.value)} /></div>
              <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><label style={labelSt}>SWIFT Code</label><input style={inputSt} value={bankDetails.swiftCode} onChange={e => updateBankDetails("swiftCode", e.target.value)} /></div>
                <div><label style={labelSt}>Currency</label><input style={inputSt} value={bankDetails.currency} onChange={e => updateBankDetails("currency", e.target.value)} /></div>
              </div>
              <div><label style={labelSt}>Branch</label><input style={inputSt} value={bankDetails.branch} onChange={e => updateBankDetails("branch", e.target.value)} /></div>
            </div>
          </div>

          {/* Payment Schedule */}
          <div style={cardSt}>
            <h3 style={sectionTitle}>Payment Schedule</h3>
            <textarea style={{ ...inputSt, minHeight: 60, resize: "vertical" }} value={paymentSchedule} onChange={e => setPaymentSchedule(e.target.value)} placeholder="Add payment schedule details..." />
          </div>

          {/* Notes */}
          <div style={cardSt}>
            <h3 style={sectionTitle}>Notes</h3>
            <textarea style={{ ...inputSt, minHeight: 60, resize: "vertical" }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add any additional notes or terms..." />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            DOCUMENT PREVIEW — Portal-consistent design
            All colors are inline hex (no oklch) for html2canvas compatibility.
            Font: DM Sans (matching portal UI).
        ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ flex: 1, overflow: "auto", maxHeight: "calc(100vh - 140px)" }}>
          <div ref={quotationRef} style={{
            background: "#FFFFFF", width: "210mm", minHeight: "297mm", margin: "0 auto",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            color: D.dark,
          }}>

            {/* ── Accent bar (green → terracotta gradient, portal signature) ── */}
            <div style={{ height: 4, background: `linear-gradient(90deg, ${D.forest}, ${D.terra})` }} />

            {/* ── Header ── */}
            <div style={{ padding: "28px 40px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: D.dark, letterSpacing: -0.3, margin: 0, lineHeight: 1.3 }}>
                  PLATFARM FOR AGRITECH AND
                </h1>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: D.dark, letterSpacing: -0.3, margin: 0, lineHeight: 1.3 }}>
                  AGRIBUSINESS LTD ABU DHABI
                </h1>
                <div style={{ marginTop: 10, fontSize: 9.5, color: D.muted, lineHeight: 1.7 }}>
                  <p style={{ margin: 0 }}>Office 16-120, Floor 16, Al Khatem Tower, Abu Dhabi Global Market Square</p>
                  <p style={{ margin: 0 }}>Al Maryah Island, ABU DHABI 20054 ARE</p>
                  <div style={{ display: "flex", gap: 16, marginTop: 3, fontSize: 9, color: D.gray }}>
                    <span>+971504309603</span>
                    <span>info@platfarm.io</span>
                    <span>www.platfarm.io</span>
                  </div>
                  <p style={{ margin: "3px 0 0", fontSize: 9, color: D.gray }}>TRN: 104090372400003</p>
                </div>
              </div>
              <img src={LOGO_URL} alt="Platfarm Logo" crossOrigin="anonymous" style={{ width: 130, height: "auto", marginTop: 4 }} />
            </div>

            {/* Green rule (portal style) */}
            <div style={{ margin: "0 40px", height: 2, background: D.forest, borderRadius: 1 }} />

            {/* ── Title Banner ── */}
            <div style={{ padding: "22px 40px 18px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontSize: 28, fontWeight: 700, color: D.forest, letterSpacing: -0.5, margin: 0 }}>
                  {quotationTitle || "QUOTATION"}
                </h2>
                {quotationSubtitle && (
                  <p style={{ fontSize: 10, color: D.muted, marginTop: 3, textTransform: "uppercase", letterSpacing: 1.5, margin: "3px 0 0" }}>
                    {quotationSubtitle}
                  </p>
                )}
              </div>
              <div style={{
                background: D.greenTint, border: `1.5px solid ${D.greenBdr}`,
                borderRadius: 8, padding: "8px 18px", textAlign: "center", minWidth: 110,
              }}>
                <span style={{ display: "block", fontSize: 8, color: D.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, fontWeight: 600 }}>
                  {isInvoice ? "INVOICE NO." : "QUOTATION NO."}
                </span>
                <span style={{ display: "block", fontSize: 16, fontWeight: 700, color: D.forest, fontFamily: "'JetBrains Mono', monospace" }}>
                  {quotationNo}
                </span>
              </div>
            </div>

            {/* ── Client & Quote Details (two-column cards) ── */}
            <div style={{ padding: "0 40px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Bill To */}
              <div style={{
                background: D.greenTint, borderRadius: 8, padding: "14px 16px",
                borderLeft: `3px solid ${D.forest}`,
              }}>
                <h3 style={{ fontSize: 8, fontWeight: 700, color: D.sage, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8, margin: "0 0 8px" }}>
                  Bill To
                </h3>
                <p style={{ fontSize: 14, fontWeight: 700, color: D.dark, margin: 0 }}>{clientName}</p>
                <p style={{ fontSize: 11, color: D.gray, marginTop: 4, margin: "4px 0 0" }}>{clientAddress}</p>
                <p style={{ fontSize: 11, color: D.gray, margin: "1px 0 0" }}>{clientCountry}</p>
                {clientTrn && <p style={{ fontSize: 10, color: D.muted, marginTop: 6, margin: "6px 0 0" }}>TRN: {clientTrn}</p>}
                {projectName && <p style={{ fontSize: 11, fontWeight: 600, color: D.dark, marginTop: 6, margin: "6px 0 0" }}>Project: {projectName}</p>}
              </div>

              {/* Details */}
              <div style={{
                background: D.greenTint, borderRadius: 8, padding: "14px 16px",
              }}>
                <h3 style={{ fontSize: 8, fontWeight: 700, color: D.sage, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10, margin: "0 0 10px" }}>
                  Details
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: D.muted, fontWeight: 500 }}>Date</span>
                    <span style={{ fontWeight: 600, color: D.dark }}>{quotationDate}</span>
                  </div>
                  {validUntil && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: D.muted, fontWeight: 500 }}>Valid Until</span>
                      <span style={{ fontWeight: 600, color: D.dark }}>{validUntil}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: D.muted, fontWeight: 500 }}>Incoterms</span>
                    <span style={{ fontWeight: 600, color: D.dark }}>{incoterms || "—"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: D.muted, fontWeight: 500 }}>Payment Terms</span>
                    <span style={{ fontWeight: 600, color: D.dark }}>{paymentTerms}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: D.muted, fontWeight: 500 }}>Currency</span>
                    <span style={{ fontWeight: 600, color: D.dark }}>{currency}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Items Table ── */}
            <div style={{ padding: "0 40px 20px" }}>
              <div className="mob-table-scroll"><table style={{ width: "100%", fontSize: 11, borderCollapse: "separate", borderSpacing: 0, borderRadius: 8, overflow: "hidden", border: `1px solid ${D.greenBdr}` }}>
                <thead>
                  <tr style={{ background: `linear-gradient(135deg, ${D.forest}, ${D.sage})` }}>
                    <th style={{ padding: "9px 14px", textAlign: "left", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#FFFFFF" }}>Description</th>
                    <th style={{ padding: "9px 14px", textAlign: "center", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#FFFFFF" }}>Details</th>
                    <th style={{ padding: "9px 14px", textAlign: "center", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#FFFFFF" }}>Qty</th>
                    <th style={{ padding: "9px 14px", textAlign: "center", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#FFFFFF" }}>Unit</th>
                    <th style={{ padding: "9px 14px", textAlign: "right", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#FFFFFF" }}>Rate ({currency})</th>
                    <th style={{ padding: "9px 14px", textAlign: "right", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#FFFFFF" }}>Amount ({currency})</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${D.borderFaint}`, background: i % 2 === 0 ? "#FFFFFF" : D.rowAlt }}>
                      <td style={{ padding: "10px 14px" }}>
                        <p style={{ fontWeight: 600, color: D.dark, margin: 0, fontSize: 11 }}>{p.description}</p>
                        {p.subDescription && <p style={{ fontSize: 9, color: D.muted, marginTop: 2, margin: "2px 0 0" }}>{p.subDescription}</p>}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center", color: D.gray, fontSize: 10 }}>{p.specs}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: D.dark, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{formatNumber(p.quantity).split(".")[0]}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center", color: D.gray, fontSize: 10 }}>{p.unit}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 500, color: D.dark, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{formatNumber(p.rate)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: D.forest, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{formatNumber(calculateAmount(p.quantity, p.rate))}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>

            {/* ── Totals + Signature ── */}
            <div style={{ padding: "0 40px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              {/* Signature block */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 8 }}>
                <img src={SIGNATURE_URL} alt="Signature" crossOrigin="anonymous" style={{ width: 56, height: 40, objectFit: "contain", marginBottom: 4 }} />
                <div style={{ width: 110, borderTop: `1px solid ${D.borderLight}`, marginBottom: 6 }} />
                <p style={{ fontSize: 9, color: D.muted, marginBottom: 10, margin: "0 0 10px", fontWeight: 500 }}>Authorized Signature</p>
                <img src={STAMP_URL} alt="Stamp" crossOrigin="anonymous" style={{ width: 90, height: 90, objectFit: "contain" }} />
              </div>

              {/* Totals card */}
              <div style={{ width: 240, borderRadius: 8, overflow: "hidden", border: `1px solid ${D.greenBdr}` }}>
                <div style={{ padding: "8px 16px", display: "flex", justifyContent: "space-between", background: D.greenTint, borderBottom: `1px solid ${D.greenBdr}` }}>
                  <span style={{ color: D.gray, fontSize: 11, fontWeight: 500 }}>Subtotal</span>
                  <span style={{ fontWeight: 600, color: D.dark, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{formatNumber(subtotal)}</span>
                </div>
                <div style={{ padding: "8px 16px", display: "flex", justifyContent: "space-between", background: D.greenTint, borderBottom: `1px solid ${D.greenBdr}` }}>
                  <span style={{ color: D.gray, fontSize: 11, fontWeight: 500 }}>VAT</span>
                  <span style={{ fontWeight: 600, color: D.dark, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{formatNumber(vatTotal)}</span>
                </div>
                <div style={{
                  padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: `linear-gradient(135deg, ${D.forest}, ${D.sage})`,
                }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#FFFFFF" }}>TOTAL</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "#FFFFFF", fontFamily: "'JetBrains Mono', monospace" }}>{currency} {formatNumber(total)}</span>
                </div>
              </div>
            </div>

            {/* ── Notes ── */}
            {notes && (
              <div style={{ padding: "0 40px 14px" }}>
                <div style={{
                  background: D.terraTint, borderLeft: `3px solid ${D.terra}`,
                  borderRadius: "0 8px 8px 0", padding: "12px 16px",
                }}>
                  <h3 style={{ fontSize: 8, fontWeight: 700, color: D.terra, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, margin: "0 0 5px" }}>Notes</h3>
                  <p style={{ fontSize: 11, color: D.dark, whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6 }}>{notes}</p>
                </div>
              </div>
            )}

            {/* ── Payment Schedule ── */}
            {paymentSchedule && (
              <div style={{ padding: "0 40px 14px" }}>
                <div style={{
                  background: D.greenTint, borderLeft: `3px solid ${D.sage}`,
                  borderRadius: "0 8px 8px 0", padding: "12px 16px",
                }}>
                  <h3 style={{ fontSize: 8, fontWeight: 700, color: D.sage, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, margin: "0 0 5px" }}>Payment Schedule</h3>
                  <p style={{ fontSize: 11, color: D.dark, whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6 }}>{paymentSchedule}</p>
                </div>
              </div>
            )}

            {/* ── Bank Details ── */}
            <div style={{ padding: "0 40px 20px" }}>
              <div style={{
                background: D.forest, borderRadius: 8, padding: "16px 20px",
                border: `1px solid ${D.sage}`,
              }}>
                <h3 style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12, color: "rgba(255,255,255,0.45)", margin: "0 0 12px" }}>
                  Bank Details for Payment
                </h3>
                <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, fontSize: 11 }}>
                  <div>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 3px" }}>Beneficiary</p>
                    <p style={{ fontWeight: 500, color: "#FFFFFF", margin: 0, lineHeight: 1.4 }}>{bankDetails.beneficiary}</p>
                  </div>
                  <div>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 3px" }}>Bank Name</p>
                    <p style={{ fontWeight: 500, color: "#FFFFFF", margin: 0 }}>{bankDetails.bankName}</p>
                  </div>
                  <div>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 3px" }}>Branch</p>
                    <p style={{ fontWeight: 500, color: "#FFFFFF", margin: 0 }}>{bankDetails.branch}</p>
                  </div>
                  <div>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 3px" }}>IBAN</p>
                    <p style={{ fontWeight: 500, color: "#FFFFFF", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, margin: 0 }}>{bankDetails.iban}</p>
                  </div>
                  <div>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 3px" }}>SWIFT Code</p>
                    <p style={{ fontWeight: 500, color: "#FFFFFF", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, margin: 0 }}>{bankDetails.swiftCode}</p>
                  </div>
                  <div>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 3px" }}>Currency</p>
                    <p style={{ fontWeight: 500, color: "#FFFFFF", margin: 0 }}>{bankDetails.currency}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div style={{ padding: "0 40px 16px" }}>
              <div style={{ height: 1, background: D.borderLight, marginBottom: 10 }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: D.muted }}>
                <p style={{ margin: 0 }}>Thank you for your business</p>
                <p style={{ margin: 0, fontStyle: "italic" }}>Platfarm Document System</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
