// ══════════════════════════════════════════════════════════════════════════════
// PAYMENT RECEIPT EDITOR — Platfarm V3
// Renders inside QuotationsHome shell (no own nav/header).
// Uses the portal's C colour palette from @/lib/data.
// Document preview uses DM Sans + portal design language for full consistency.
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { trpc } from "@/lib/trpc";
import { C, FONT } from "@/lib/data";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310419663030422219/MW4gvkHfHJD9tbPbdFFnda/logo_db87658a.png";
const SIGNATURE_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310419663030422219/MW4gvkHfHJD9tbPbdFFnda/signature_c2779af4.png";
const STAMP_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310419663030422219/MW4gvkHfHJD9tbPbdFFnda/stamp_7ebde919.png";

interface PaymentEntry {
  id: number; date: string; amount: number; method: string; reference: string;
}

interface Props {
  onBack?: () => void;
  onViewSaved?: () => void;
}

export default function PaymentReceiptEditor({ onBack, onViewSaved }: Props) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveQuotationMutation = trpc.quotations.save.useMutation();

  const [receiptId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  });
  const [hasLoaded, setHasLoaded] = useState(false);

  const getQuery = trpc.quotations.get.useQuery(
    { id: parseInt(receiptId || "0") },
    { enabled: !!receiptId && !hasLoaded, refetchOnWindowFocus: false, staleTime: Infinity }
  );

  // Form state
  const [receiptNo, setReceiptNo] = useState(`PR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`);
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0].replace(/-/g, "/"));
  const [clientName, setClientName] = useState("Elite Agro");
  const [clientAddress, setClientAddress] = useState("Abu Dhabi");
  const [clientCountry, setClientCountry] = useState("United Arab Emirates");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");

  const [payments, setPayments] = useState<PaymentEntry[]>([
    { id: 1, date: new Date().toISOString().split("T")[0].replace(/-/g, "/"), amount: 0, method: "Bank Transfer", reference: "" },
  ]);

  // Load existing receipt
  useEffect(() => {
    if (getQuery.data && !hasLoaded) {
      const d = getQuery.data;
      setClientName(d.clientName || "");
      setClientAddress(d.clientAddress || "");
      setClientCountry(d.clientCountry || "");
      setReceiptNo(d.quotationNo || "");
      setReceiptDate(d.quotationDate || "");
      setInvoiceRef(d.projectName || "");
      setCurrency(d.currency || "USD");
      setNotes(d.notes || "");
      try {
        if (d.products) setPayments(JSON.parse(d.products));
      } catch {}
      setHasLoaded(true);
    }
  }, [getQuery.data, hasLoaded]);

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const formatNumber = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const addPayment = () => setPayments([...payments, { id: Date.now(), date: "", amount: 0, method: "Bank Transfer", reference: "" }]);
  const removePayment = (id: number) => { if (payments.length > 1) setPayments(payments.filter(p => p.id !== id)); };
  const updatePayment = (id: number, field: keyof PaymentEntry, value: string | number) => {
    setPayments(payments.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveQuotationMutation.mutateAsync({
        id: receiptId ? parseInt(receiptId) : undefined,
        documentType: "payment_receipt",
        quotationNo: receiptNo,
        clientName, clientAddress, clientCountry, clientTrn: "",
        projectName: invoiceRef,
        quotationDate: receiptDate, validUntil: "", incoterms: "",
        paymentTerms: "", currency, notes, paymentSchedule: "",
        bankDetails: "",
        products: JSON.stringify(payments),
        subtotal: Math.round(totalPaid * 100),
        vatTotal: 0,
        total: Math.round(totalPaid * 100),
      });
      alert("Payment receipt saved successfully!");
    } catch (error) {
      console.error("Error saving:", error);
      alert("Error saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Generate PDF from the preview element.
   * html2canvas is patched (scripts/patch-html2canvas.mjs) to handle oklch colors.
   */
  const downloadPDF = async () => {
    if (!receiptRef.current) return;
    setIsGeneratingPDF(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#ffffff",
        logging: false, imageTimeout: 15000,
        windowWidth: receiptRef.current.scrollWidth,
        windowHeight: receiptRef.current.scrollHeight,
        foreignObjectRendering: false,
      });
      const imgData = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pW = pdf.internal.pageSize.getWidth();
      const pH = pdf.internal.pageSize.getHeight();
      const margin = 5;
      const aW = pW - margin * 2;
      const aH = pH - margin * 2;
      const ratio = Math.min(aW / canvas.width, aH / canvas.height);
      const sW = canvas.width * ratio;
      const sH = canvas.height * ratio;
      const x = (pW - sW) / 2;
      pdf.addImage(imgData, "PNG", x, margin, sW, sH);
      pdf.save(`Payment-Receipt-${receiptNo}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

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
      {/* Action bar */}
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
            Payment Receipt: {receiptNo || "New"}
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
          <button onClick={downloadPDF} disabled={isGeneratingPDF} style={{
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
          {/* Receipt Details */}
          <div style={cardSt}>
            <h3 style={sectionTitle}>Receipt Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div><label style={labelSt}>Receipt No</label><input style={inputSt} value={receiptNo} onChange={e => setReceiptNo(e.target.value)} /></div>
              <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><label style={labelSt}>Date</label><input style={inputSt} value={receiptDate} onChange={e => setReceiptDate(e.target.value)} /></div>
                <div>
                  <label style={labelSt}>Currency</label>
                  <select style={inputSt} value={currency} onChange={e => setCurrency(e.target.value)}>
                    <option value="USD">USD</option><option value="AED">AED</option><option value="EUR">EUR</option><option value="GBP">GBP</option>
                  </select>
                </div>
              </div>
              <div><label style={labelSt}>Invoice Reference</label><input style={inputSt} value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} placeholder="e.g., INV-20260310" /></div>
            </div>
          </div>

          {/* Client Details */}
          <div style={cardSt}>
            <h3 style={sectionTitle}>Received From</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div><label style={labelSt}>Client Name</label><input style={inputSt} value={clientName} onChange={e => setClientName(e.target.value)} /></div>
              <div><label style={labelSt}>Address</label><input style={inputSt} value={clientAddress} onChange={e => setClientAddress(e.target.value)} /></div>
              <div><label style={labelSt}>Country</label><input style={inputSt} value={clientCountry} onChange={e => setClientCountry(e.target.value)} /></div>
            </div>
          </div>

          {/* Payments */}
          <div style={cardSt}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Payments</h3>
              <button onClick={addPayment} style={{
                background: C.forest, border: "none", borderRadius: 5, padding: "3px 10px",
                color: C.white, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
              }}>+ Add</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
              {payments.map((p, i) => (
                <div key={p.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, background: C.pageBg }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: C.muted }}>Payment {i + 1}</span>
                    <button onClick={() => removePayment(p.id)} disabled={payments.length <= 1} style={{
                      background: "none", border: "none", cursor: payments.length <= 1 ? "not-allowed" : "pointer",
                      color: payments.length <= 1 ? C.border : C.red, fontSize: 13,
                    }}>✕</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                      <div><label style={{ ...labelSt, fontSize: 8 }}>Date</label><input style={{ ...inputSt, fontSize: 11 }} value={p.date} onChange={e => updatePayment(p.id, "date", e.target.value)} /></div>
                      <div><label style={{ ...labelSt, fontSize: 8 }}>Amount ({currency})</label><input type="number" step="0.01" style={{ ...inputSt, fontSize: 11 }} value={p.amount} onChange={e => updatePayment(p.id, "amount", parseFloat(e.target.value) || 0)} /></div>
                    </div>
                    <div>
                      <label style={{ ...labelSt, fontSize: 8 }}>Method</label>
                      <select style={{ ...inputSt, fontSize: 11 }} value={p.method} onChange={e => updatePayment(p.id, "method", e.target.value)}>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cash">Cash</option>
                        <option value="Check">Check</option>
                        <option value="Credit Card">Credit Card</option>
                      </select>
                    </div>
                    <div><label style={{ ...labelSt, fontSize: 8 }}>Reference</label><input style={{ ...inputSt, fontSize: 11 }} value={p.reference} onChange={e => updatePayment(p.id, "reference", e.target.value)} placeholder="Transaction ref #" /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div style={cardSt}>
            <h3 style={sectionTitle}>Notes</h3>
            <textarea style={{ ...inputSt, minHeight: 60, resize: "vertical" }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            DOCUMENT PREVIEW — Portal-consistent design
            All colors are inline hex (no oklch) for html2canvas compatibility.
            Font: DM Sans (matching portal UI).
        ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ flex: 1, overflow: "auto", maxHeight: "calc(100vh - 140px)" }}>
          <div ref={receiptRef} style={{
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
              <h2 style={{ fontSize: 28, fontWeight: 700, color: D.forest, letterSpacing: -0.5, margin: 0 }}>
                PAYMENT RECEIPT
              </h2>
              <div style={{
                background: D.greenTint, border: `1.5px solid ${D.greenBdr}`,
                borderRadius: 8, padding: "8px 18px", textAlign: "center", minWidth: 110,
              }}>
                <span style={{ display: "block", fontSize: 8, color: D.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, fontWeight: 600 }}>
                  RECEIPT NO.
                </span>
                <span style={{ display: "block", fontSize: 16, fontWeight: 700, color: D.forest, fontFamily: "'JetBrains Mono', monospace" }}>
                  {receiptNo}
                </span>
              </div>
            </div>

            {/* ── Client & Receipt Details (two-column cards) ── */}
            <div style={{ padding: "0 40px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Received From */}
              <div style={{
                background: D.greenTint, borderRadius: 8, padding: "14px 16px",
                borderLeft: `3px solid ${D.forest}`,
              }}>
                <h3 style={{ fontSize: 8, fontWeight: 700, color: D.sage, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8, margin: "0 0 8px" }}>
                  Received From
                </h3>
                <p style={{ fontSize: 14, fontWeight: 700, color: D.dark, margin: 0 }}>{clientName}</p>
                <p style={{ fontSize: 11, color: D.gray, marginTop: 4, margin: "4px 0 0" }}>{clientAddress}</p>
                <p style={{ fontSize: 11, color: D.gray, margin: "1px 0 0" }}>{clientCountry}</p>
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
                    <span style={{ fontWeight: 600, color: D.dark }}>{receiptDate}</span>
                  </div>
                  {invoiceRef && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: D.muted, fontWeight: 500 }}>Invoice Ref</span>
                      <span style={{ fontWeight: 600, color: D.dark }}>{invoiceRef}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: D.muted, fontWeight: 500 }}>Currency</span>
                    <span style={{ fontWeight: 600, color: D.dark }}>{currency}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Payments Table ── */}
            <div style={{ padding: "0 40px 20px" }}>
              <div className="mob-table-scroll"><table style={{ width: "100%", fontSize: 11, borderCollapse: "separate", borderSpacing: 0, borderRadius: 8, overflow: "hidden", border: `1px solid ${D.greenBdr}` }}>
                <thead>
                  <tr style={{ background: `linear-gradient(135deg, ${D.forest}, ${D.sage})` }}>
                    <th style={{ padding: "9px 14px", textAlign: "left", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#FFFFFF", width: 40 }}>#</th>
                    <th style={{ padding: "9px 14px", textAlign: "left", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#FFFFFF" }}>Date</th>
                    <th style={{ padding: "9px 14px", textAlign: "left", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#FFFFFF" }}>Method</th>
                    <th style={{ padding: "9px 14px", textAlign: "left", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#FFFFFF" }}>Reference</th>
                    <th style={{ padding: "9px 14px", textAlign: "right", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#FFFFFF" }}>Amount ({currency})</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${D.borderFaint}`, background: i % 2 === 0 ? "#FFFFFF" : D.rowAlt }}>
                      <td style={{ padding: "10px 14px", color: D.muted, fontWeight: 500, fontSize: 10 }}>{i + 1}</td>
                      <td style={{ padding: "10px 14px", color: D.dark, fontWeight: 500 }}>{p.date}</td>
                      <td style={{ padding: "10px 14px", color: D.dark, fontWeight: 500 }}>{p.method}</td>
                      <td style={{ padding: "10px 14px", color: D.gray, fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>{p.reference}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: D.forest, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{formatNumber(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>

            {/* ── Total + Signature ── */}
            <div style={{ padding: "0 40px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              {/* Signature block */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 8 }}>
                <img src={SIGNATURE_URL} alt="Signature" crossOrigin="anonymous" style={{ width: 56, height: 40, objectFit: "contain", marginBottom: 4 }} />
                <div style={{ width: 110, borderTop: `1px solid ${D.borderLight}`, marginBottom: 6 }} />
                <p style={{ fontSize: 9, color: D.muted, marginBottom: 10, margin: "0 0 10px", fontWeight: 500 }}>Authorized Signature</p>
                <img src={STAMP_URL} alt="Stamp" crossOrigin="anonymous" style={{ width: 90, height: 90, objectFit: "contain" }} />
              </div>

              {/* Total card */}
              <div style={{ width: 240, borderRadius: 8, overflow: "hidden", border: `1px solid ${D.greenBdr}` }}>
                <div style={{
                  padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: `linear-gradient(135deg, ${D.forest}, ${D.sage})`,
                }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#FFFFFF" }}>TOTAL PAID</span>
                  <span style={{ fontWeight: 700, fontSize: 17, color: "#FFFFFF", fontFamily: "'JetBrains Mono', monospace" }}>{currency} {formatNumber(totalPaid)}</span>
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

            {/* ── Footer ── */}
            <div style={{ padding: "0 40px 16px" }}>
              <div style={{ height: 1, background: D.borderLight, marginBottom: 10 }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: D.muted }}>
                <p style={{ margin: 0 }}>Thank you for your payment</p>
                <p style={{ margin: 0, fontStyle: "italic" }}>Platfarm Document System</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
