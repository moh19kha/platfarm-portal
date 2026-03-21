// ══════════════════════════════════════════════════════════════════════════════
// INVESTMENT PROPOSAL — Platfarm V3
// Deal form + live summary + PDF generation (Finance Offer & Murabaha Contract)
// Renders inside InvestmentHome shell (no own nav/header).
// Uses the portal's C colour palette from @/lib/data for full consistency.
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback } from "react";
import { C, FONT, MONO } from "@/lib/data";
import { type OfferData, calculateDeal, generateOfferPdf } from "@/lib/generatePdf";
import { type ContractData, generateContractPdf } from "@/lib/generateContract";

function fmt(n: number): string {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InvestmentProposal() {
  const today = new Date().toISOString().split("T")[0];

  // ─── Offer Fields ───────────────────────────────────────────────────────
  const [investorName, setInvestorName] = useState("Ayoud Douibi");
  const [product, setProduct] = useState("Alfalfa Animal Fodder");
  const [quantity, setQuantity] = useState(400);
  const [incoterm, setIncoterm] = useState("DDP");
  const [costPerTon, setCostPerTon] = useState(372.35);
  const [sellingPerTon, setSellingPerTon] = useState(408.72);
  const [investmentPeriodDays, setInvestmentPeriodDays] = useState(60);
  const [investorSharePct, setInvestorSharePct] = useState(45);
  const [platfarmSharePct, setPlatfarmSharePct] = useState(45);
  const [gaSharePct, setGaSharePct] = useState(10);
  const [date, setDate] = useState(today);
  const [refNumber, setRefNumber] = useState("PF-INV-2026-001");

  // ─── Contract-specific Fields ───────────────────────────────────────────
  const [contractStartDate, setContractStartDate] = useState(today);
  const [chequeNumber, setChequeNumber] = useState("CHQ-001234");
  const [chequeIssuedBy, setChequeIssuedBy] = useState("Platfarm for Agritech and Agribusiness Ltd - Abu Dhabi");
  const [chequeBank, setChequeBank] = useState("Wio Bank");
  const [chequeDueDate, setChequeDueDate] = useState(today);
  const [contractNumber, setContractNumber] = useState("PF-MRB-2026-001");
  const [investorIdNumber, setInvestorIdNumber] = useState("784-XXXX-XXXXXXX-X");
  const [companyRepIdNumber, setCompanyRepIdNumber] = useState("784-XXXX-XXXXXXX-X");

  // ─── Loading States ─────────────────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [generatingContract, setGeneratingContract] = useState(false);

  // ─── Active Tab ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"offer" | "contract">("offer");

  const totalSharePct = investorSharePct + platfarmSharePct + gaSharePct;

  const offerData: OfferData = useMemo(
    () => ({
      investorName, product, quantity, incoterm, costPerTon, sellingPerTon,
      investmentPeriodDays, investorSharePct, platfarmSharePct, gaSharePct, date, refNumber,
    }),
    [investorName, product, quantity, incoterm, costPerTon, sellingPerTon,
      investmentPeriodDays, investorSharePct, platfarmSharePct, gaSharePct, date, refNumber]
  );

  const contractData: ContractData = useMemo(
    () => ({
      ...offerData,
      contractStartDate, chequeNumber, chequeIssuedBy, chequeBank,
      chequeDueDate, contractNumber, investorIdNumber, companyRepIdNumber,
    }),
    [offerData, contractStartDate, chequeNumber, chequeIssuedBy, chequeBank,
      chequeDueDate, contractNumber, investorIdNumber, companyRepIdNumber]
  );

  const calc = useMemo(() => calculateDeal(offerData), [offerData]);
  const months = Math.round(investmentPeriodDays / 30);

  // ─── Generate Handlers ──────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (totalSharePct !== 100) { alert("Profit shares must total 100%"); return; }
    if (!investorName.trim()) { alert("Please enter the investor name"); return; }
    if (!product.trim()) { alert("Please enter the product name"); return; }
    if (quantity <= 0 || costPerTon <= 0 || sellingPerTon <= 0) { alert("Quantity and prices must be greater than zero"); return; }
    setGenerating(true);
    try { await generateOfferPdf(offerData); }
    catch (err) { console.error(err); alert("Failed to generate PDF."); }
    finally { setGenerating(false); }
  }, [offerData, totalSharePct, investorName, product, quantity, costPerTon, sellingPerTon]);

  const handleGenerateContract = useCallback(async () => {
    if (totalSharePct !== 100) { alert("Profit shares must total 100%"); return; }
    if (!chequeNumber.trim() || !chequeDueDate || !contractStartDate) { alert("Please fill in all contract details"); return; }
    setGeneratingContract(true);
    try { await generateContractPdf(contractData); }
    catch (err) { console.error(err); alert("Failed to generate contract PDF."); }
    finally { setGeneratingContract(false); }
  }, [contractData, totalSharePct, chequeNumber, chequeDueDate, contractStartDate]);

  /* ─── Shared style helpers (portal-consistent) ─── */
  const labelSt: React.CSSProperties = {
    display: "block", fontSize: 10, fontWeight: 600, color: C.gray,
    textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4,
  };
  const inputSt: React.CSSProperties = {
    width: "100%", border: `1.5px solid ${C.inputBdr}`, borderRadius: 6, padding: "7px 10px",
    fontSize: 12, fontFamily: FONT, color: C.dark, outline: "none",
    background: C.white, transition: "border-color 0.2s",
  };
  const monoInputSt: React.CSSProperties = { ...inputSt, fontFamily: MONO };
  const cardSt: React.CSSProperties = {
    background: C.card, borderRadius: 10, padding: 14, border: `1px solid ${C.border}`,
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: C.forest, textTransform: "uppercase",
    letterSpacing: 0.6, marginBottom: 10, display: "flex", alignItems: "center", gap: 6,
  };
  const contractSectionTitle: React.CSSProperties = { ...sectionTitle, color: C.terra };
  const incotermOptions = ["DDP", "CIF", "FOB", "CFR", "EXW"];

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        {/* ═══ Form Panel (left) ═══ */}
        <div style={{ width: 340, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", maxHeight: "calc(100vh - 140px)", paddingRight: 4 }}>

          {/* Document Info */}
          <div style={cardSt}>
            <h3 style={sectionTitle}>
              <svg width="13" height="13" fill="none" stroke={C.forest} strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              Document Info
            </h3>
            <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div><label style={labelSt}>Offer Date</label><input type="date" style={inputSt} value={date} onChange={e => setDate(e.target.value)} /></div>
              <div><label style={labelSt}>Reference Number</label><input style={inputSt} value={refNumber} onChange={e => setRefNumber(e.target.value)} /></div>
            </div>
          </div>

          {/* Investor */}
          <div style={cardSt}>
            <h3 style={sectionTitle}>
              <svg width="13" height="13" fill="none" stroke={C.forest} strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              Investor
            </h3>
            <div><label style={labelSt}>Investor Name</label><input style={inputSt} value={investorName} onChange={e => setInvestorName(e.target.value)} placeholder="e.g., Ayoud Douibi" /></div>
          </div>

          {/* Product & Shipment */}
          <div style={cardSt}>
            <h3 style={sectionTitle}>
              <svg width="13" height="13" fill="none" stroke={C.forest} strokeWidth="2" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
              Product & Shipment
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div><label style={labelSt}>Product / Commodity</label><input style={inputSt} value={product} onChange={e => setProduct(e.target.value)} placeholder="e.g., Alfalfa Animal Fodder" /></div>
              <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><label style={labelSt}>Quantity (Tons)</label><input type="number" style={inputSt} value={quantity || ""} onChange={e => setQuantity(Number(e.target.value))} /></div>
                <div>
                  <label style={labelSt}>Incoterm</label>
                  <select style={inputSt} value={incoterm} onChange={e => setIncoterm(e.target.value)}>
                    {incotermOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div style={cardSt}>
            <h3 style={sectionTitle}>
              <svg width="13" height="13" fill="none" stroke={C.forest} strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
              Pricing
            </h3>
            <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div><label style={labelSt}>Cost Price / Ton (AED)</label><input type="number" step="0.01" style={monoInputSt} value={costPerTon || ""} onChange={e => setCostPerTon(Number(e.target.value))} /></div>
              <div><label style={labelSt}>Selling Price / Ton (AED)</label><input type="number" step="0.01" style={monoInputSt} value={sellingPerTon || ""} onChange={e => setSellingPerTon(Number(e.target.value))} /></div>
            </div>
          </div>

          {/* Investment Period */}
          <div style={cardSt}>
            <h3 style={sectionTitle}>
              <svg width="13" height="13" fill="none" stroke={C.forest} strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              Investment Period
            </h3>
            <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "end" }}>
              <div><label style={labelSt}>Period (Days)</label><input type="number" style={inputSt} value={investmentPeriodDays || ""} onChange={e => setInvestmentPeriodDays(Number(e.target.value))} /></div>
              <div style={{ fontSize: 11, color: C.light, paddingBottom: 8 }}>≈ {months} month{months !== 1 ? "s" : ""}</div>
            </div>
          </div>

          {/* Profit Distribution */}
          <div style={cardSt}>
            <h3 style={sectionTitle}>
              <svg width="13" height="13" fill="none" stroke={C.forest} strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
              Profit Distribution
            </h3>
            <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div><label style={labelSt}>Investor %</label><input type="number" style={inputSt} value={investorSharePct || ""} onChange={e => setInvestorSharePct(Number(e.target.value))} /></div>
              <div><label style={labelSt}>Platfarm %</label><input type="number" style={inputSt} value={platfarmSharePct || ""} onChange={e => setPlatfarmSharePct(Number(e.target.value))} /></div>
              <div><label style={labelSt}>G&A %</label><input type="number" style={inputSt} value={gaSharePct || ""} onChange={e => setGaSharePct(Number(e.target.value))} /></div>
            </div>
            {totalSharePct !== 100 && (
              <div style={{ marginTop: 6, fontSize: 10, fontWeight: 600, color: C.red }}>
                Total shares = {totalSharePct}% (must equal 100%)
              </div>
            )}
            {totalSharePct === 100 && (
              <div style={{ marginTop: 6, fontSize: 10, fontWeight: 600, color: C.sage }}>
                ✓ Total shares = 100%
              </div>
            )}
          </div>

          {/* Contract Details */}
          <div style={{ ...cardSt, border: `1px solid ${C.tBdr}`, background: C.tBg }}>
            <h3 style={contractSectionTitle}>
              <svg width="13" height="13" fill="none" stroke={C.terra} strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              Contract Details (Murabaha)
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><label style={labelSt}>Contract Number</label><input style={inputSt} value={contractNumber} onChange={e => setContractNumber(e.target.value)} placeholder="PF-MRB-2026-001" /></div>
                <div><label style={labelSt}>Contract Start Date</label><input type="date" style={inputSt} value={contractStartDate} onChange={e => setContractStartDate(e.target.value)} /></div>
              </div>
              <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><label style={labelSt}>Cheque Number</label><input style={inputSt} value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} placeholder="CHQ-001234" /></div>
                <div><label style={labelSt}>Cheque Issued By</label><input style={inputSt} value={chequeIssuedBy} onChange={e => setChequeIssuedBy(e.target.value)} /></div>
              </div>
              <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><label style={labelSt}>Cheque Bank</label><input style={inputSt} value={chequeBank} onChange={e => setChequeBank(e.target.value)} placeholder="Wio Bank" /></div>
                <div><label style={labelSt}>Cheque Due Date</label><input type="date" style={inputSt} value={chequeDueDate} onChange={e => setChequeDueDate(e.target.value)} /></div>
              </div>
            </div>
          </div>

          {/* Identity Details */}
          <div style={{ ...cardSt, border: `1px solid ${C.tBdr}`, background: C.tBg }}>
            <h3 style={contractSectionTitle}>
              <svg width="13" height="13" fill="none" stroke={C.terra} strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
              Identity Details
            </h3>
            <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div><label style={labelSt}>Investor ID / Passport</label><input style={inputSt} value={investorIdNumber} onChange={e => setInvestorIdNumber(e.target.value)} placeholder="784-XXXX-XXXXXXX-X" /></div>
              <div><label style={labelSt}>Company Rep ID</label><input style={inputSt} value={companyRepIdNumber} onChange={e => setCompanyRepIdNumber(e.target.value)} placeholder="784-XXXX-XXXXXXX-X" /></div>
            </div>
          </div>
        </div>

        {/* ═══ Summary Panel (right) ═══ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, position: "sticky", top: 0, maxHeight: "calc(100vh - 140px)" }}>

          {/* Live Summary Card */}
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "100%" }}>
            {/* Header */}
            <div style={{ background: `linear-gradient(135deg, ${C.forest}, ${C.sage})`, padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.white }}>Live Summary</span>
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>Real-time calculations</div>
            </div>

            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", flex: 1 }}>
              {/* Key Metrics */}
              <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ background: C.gBg, borderRadius: 8, padding: 10, border: `1px solid ${C.gBdr}` }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.light, textTransform: "uppercase", letterSpacing: 0.5 }}>Total Investment</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, fontFamily: MONO, marginTop: 2 }}>{fmt(calc.totalInvestment)}</div>
                  <div style={{ fontSize: 9, color: C.muted }}>AED</div>
                </div>
                <div style={{ background: C.gBg, borderRadius: 8, padding: 10, border: `1px solid ${C.gBdr}` }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.light, textTransform: "uppercase", letterSpacing: 0.5 }}>Total Revenue</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, fontFamily: MONO, marginTop: 2 }}>{fmt(calc.totalRevenue)}</div>
                  <div style={{ fontSize: 9, color: C.muted }}>AED</div>
                </div>
              </div>

              {/* Gross Profit */}
              <div style={{ background: C.gBg2, borderRadius: 8, padding: 12, border: `1px solid ${C.gBdr2}` }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.sage, textTransform: "uppercase", letterSpacing: 0.5 }}>Gross Profit</div>
                <div style={{
                  fontSize: 22, fontWeight: 700, fontFamily: MONO, marginTop: 2,
                  color: calc.grossProfit >= 0 ? C.forest : C.red,
                }}>{fmt(calc.grossProfit)} AED</div>
                <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>
                  Margin: {calc.grossMarginPct.toFixed(2)}% &nbsp;|&nbsp; Markup: {calc.markupPct.toFixed(2)}%
                </div>
              </div>

              <div style={{ height: 1, background: C.border }} />

              {/* Investor Returns */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.sage, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Investor Returns</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                    <span style={{ fontSize: 11, color: C.gray }}>Investor Profit ({investorSharePct}%)</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.dark, fontFamily: MONO }}>{fmt(calc.investorProfit)} AED</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                    <span style={{ fontSize: 11, color: C.gray }}>Total Return</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.dark, fontFamily: MONO }}>{fmt(calc.totalReturnToInvestor)} AED</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", background: C.gBg, borderRadius: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.sage }}>Total ROI</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.forest, fontFamily: MONO }}>{calc.totalRoiPct.toFixed(2)}%</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", background: C.gBg, borderRadius: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.sage }}>Monthly ROI</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.forest, fontFamily: MONO }}>{calc.monthlyRoiPct.toFixed(2)}%</span>
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: C.border }} />

              {/* Profit Distribution */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.sage, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Profit Distribution</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span style={{ fontSize: 11, color: C.gray }}>Investor ({investorSharePct}%)</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.dark, fontFamily: MONO }}>{fmt(calc.investorProfit)} AED</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span style={{ fontSize: 11, color: C.gray }}>Platfarm ({platfarmSharePct}%)</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.dark, fontFamily: MONO }}>{fmt(calc.platfarmProfit)} AED</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span style={{ fontSize: 11, color: C.gray }}>G&A ({gaSharePct}%)</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.dark, fontFamily: MONO }}>{fmt(calc.gaProfit)} AED</span>
                  </div>
                </div>
                {/* Visual bar */}
                <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", marginTop: 8 }}>
                  <div style={{ width: `${investorSharePct}%`, background: C.forest, transition: "width 0.3s" }} />
                  <div style={{ width: `${platfarmSharePct}%`, background: C.sage, transition: "width 0.3s" }} />
                  <div style={{ width: `${gaSharePct}%`, background: C.terra, transition: "width 0.3s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: C.muted, marginTop: 3 }}>
                  <span>Investor</span>
                  <span>Platfarm</span>
                  <span>G&A</span>
                </div>
              </div>

            </div>

            {/* Fixed Bottom: Tabs + Download Button */}
            <div style={{ padding: "12px 16px 16px", borderTop: `1px solid ${C.border}`, background: C.card, display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>

              {/* Tab Toggle */}
              <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}` }}>
                <button
                  onClick={() => setActiveTab("offer")}
                  style={{
                    flex: 1, padding: "8px 0", fontSize: 11, fontWeight: 600, fontFamily: FONT,
                    border: "none", cursor: "pointer", transition: "all 0.2s",
                    background: activeTab === "offer" ? C.forest : C.white,
                    color: activeTab === "offer" ? C.white : C.gray,
                  }}
                >Investment Offer</button>
                <button
                  onClick={() => setActiveTab("contract")}
                  style={{
                    flex: 1, padding: "8px 0", fontSize: 11, fontWeight: 600, fontFamily: FONT,
                    border: "none", cursor: "pointer", transition: "all 0.2s",
                    background: activeTab === "contract" ? C.terra : C.white,
                    color: activeTab === "contract" ? C.white : C.gray,
                  }}
                >Murabaha Contract</button>
              </div>

              {/* Generate Button */}
              {activeTab === "offer" ? (
                <button
                  onClick={handleGenerate}
                  disabled={generating || totalSharePct !== 100}
                  style={{
                    width: "100%", padding: "12px 0", borderRadius: 8, border: "none",
                    background: C.forest, color: C.white, fontSize: 13, fontWeight: 600,
                    fontFamily: FONT, cursor: generating || totalSharePct !== 100 ? "not-allowed" : "pointer",
                    opacity: generating || totalSharePct !== 100 ? 0.6 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    transition: "all 0.2s",
                  }}
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  {generating ? "Generating Offer..." : "Download Investment Offer PDF"}
                </button>
              ) : (
                <button
                  onClick={handleGenerateContract}
                  disabled={generatingContract || totalSharePct !== 100 || !chequeNumber.trim() || !chequeDueDate || !contractStartDate}
                  style={{
                    width: "100%", padding: "12px 0", borderRadius: 8, border: "none",
                    background: C.terra, color: C.white, fontSize: 13, fontWeight: 600,
                    fontFamily: FONT,
                    cursor: generatingContract || totalSharePct !== 100 || !chequeNumber.trim() || !chequeDueDate || !contractStartDate ? "not-allowed" : "pointer",
                    opacity: generatingContract || totalSharePct !== 100 || !chequeNumber.trim() || !chequeDueDate || !contractStartDate ? 0.6 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    transition: "all 0.2s",
                  }}
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                  {generatingContract ? "Generating Contract..." : "Download Murabaha Contract PDF"}
                </button>
              )}

              {activeTab === "contract" && (!chequeNumber.trim() || !chequeDueDate || !contractStartDate) && (
                <div style={{ fontSize: 10, color: C.terra, textAlign: "center" }}>
                  Please fill in the contract details (cheque number, dates) in the form
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
