// @ts-nocheck
  import { useState, useEffect, useRef, useMemo, useCallback } from "react";
  import { useLocation } from "wouter";
  import { trpc } from "@/lib/trpc";
  import { C, FONT, MONO } from "@/lib/data";
  import { Badge, Card, Lbl, Val, Mono, FieldRow, TabButton } from "@/components/ui-primitives";
  import { CreateOdooShipment } from "@/components/CreateOdooShipment";

  const fK = (kg: number) => { if (Math.abs(kg) >= 1000) return (kg / 1000).toFixed(1) + "t"; return Math.round(kg).toLocaleString() + " kg"; };

  const STAGE_CFG: Record<string, { bg: string; c: string; icon: string; label: string }> = {
    draft:    { bg: "#EFF6FF", c: "#1D4ED8", icon: "🚛", label: "In Transit" },
    shipped:  { bg: "#EFF6FF", c: "#1D4ED8", icon: "🚛", label: "Shipped" },
    received: { bg: C.gBg, c: "#166534", icon: "📦", label: "Received" },
    qc_done:  { bg: C.gBg, c: "#166534", icon: "✅", label: "QC Done" },
  };

  export default function IncomingShipments() {
    const [, navigate] = useLocation();
    const utils = trpc.useUtils();
    const { data, isLoading, error } = trpc.offlineOps.allData.useQuery({}, { staleTime: 60_000, refetchOnWindowFocus: false });
    const linkProcMutation = trpc.offlineOps.linkProcurementToPO.useMutation();
    const copyProcAttMutation = trpc.offlineOps.copyProcurementAttachments.useMutation();
    const copyQcAttMutation = trpc.offlineOps.copyQualityAttachments.useMutation();
    const pushQcToReceiptMutation = trpc.offlineOps.pushQualityToReceipt.useMutation();

    const RCV = useMemo(() => {
      const raw = data?.RCV || [];
      const seen = new Set<number>();
      return raw.filter((r: any) => {
        if (seen.has(r.odooId)) return false;
        seen.add(r.odooId);
        return true;
      });
    }, [data?.RCV]);
    const QC = useMemo(() => (data?.QC || []).filter((q: any) => q.type === "received"), [data?.QC]);

    const shipments = useMemo(() => {
      const qcByRef = new Map<string, any>();
      for (const q of QC) { if (q.ref) qcByRef.set(q.ref, q); }
      return RCV.map((r: any) => {
        const qc = r.qcRef ? QC.find((q: any) => q.id === r.qcRef) : qcByRef.get(r.id);
        const hasQc = !!qc;
        const hasPo = !!r.linkedPoName;
        const hasReceipt = !!r.linkedReceipt;
        let currentStage = "draft";
        if (r.stage === "received" || hasQc || hasPo) {
          if (hasPo) currentStage = "po_created";
          else if (hasQc) currentStage = "qc_done";
          else currentStage = "received";
        }
        return { ...r, qcData: qc || null, currentStage, hasPo, hasReceipt, hasQc };
      });
    }, [RCV, QC]);

    const [search, setSearch] = useState("");
    const [stageFilter, setStageFilter] = useState("all");
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const filtered = useMemo(() => {
      let list = shipments;
      if (stageFilter !== "all") {
        if (stageFilter === "pending_qc") list = list.filter(s => s.currentStage === "received");
        else if (stageFilter === "qc_done") list = list.filter(s => s.currentStage === "qc_done");
        else if (stageFilter === "po_created") list = list.filter(s => s.currentStage === "po_created");
        else if (stageFilter === "shipped") list = list.filter(s => s.currentStage === "draft"); else list = list.filter(s => s.stage === stageFilter);
      }
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(s => s.id.toLowerCase().includes(q) || s.supplier.toLowerCase().includes(q) || s.commodity.toLowerCase().includes(q) || s.driver.toLowerCase().includes(q) || s.plate.toLowerCase().includes(q));
      }
      return list;
    }, [shipments, stageFilter, search]);

    const sel = selectedId ? shipments.find(s => s.id === selectedId) : null;
    const [activeTab, setActiveTab] = useState(0);
    useEffect(() => { setActiveTab(0); }, [selectedId]);

    const [imgCache, setImgCache] = useState<Record<number, string>>({});
    const loadImgRef = useRef<Set<number>>(new Set());
    const loadImg = useCallback((irAttId: number) => {
      if (loadImgRef.current.has(irAttId)) return;
      loadImgRef.current.add(irAttId);
      setImgCache(p => ({ ...p, [irAttId]: "loading" }));
      utils.offlineOps.attachmentImage.fetch({ irAttachmentId: irAttId }).then(res => {
        if (res?.data) setImgCache(p => ({ ...p, [irAttId]: `data:${res.mimetype};base64,${res.data}` }));
        else setImgCache(p => ({ ...p, [irAttId]: "none" }));
      }).catch(() => setImgCache(p => ({ ...p, [irAttId]: "none" })));
    }, [utils]);

    const [prvAtt, setPrvAtt] = useState<any>(null);
    const [showShipWiz, setShowShipWiz] = useState(false);
    const [convLoading, setConvLoading] = useState(false);
    const [convError, setConvError] = useState("");

    const PUSH_KEY = "qcPushedIds";
    const loadPushed = (): Record<string, string> => { try { const v = localStorage.getItem(PUSH_KEY); return v ? JSON.parse(v) : {}; } catch { return {}; } };
    const savePushed = (id: string) => { const cur = loadPushed(); cur[id] = "done"; localStorage.setItem(PUSH_KEY, JSON.stringify(cur)); };
    const [pushStatus, setPushStatus] = useState<Record<string, string>>(loadPushed());

    const counts = useMemo(() => ({
      total: shipments.length,
      shipped: shipments.filter(s => s.currentStage === "draft").length,
      received: shipments.filter(s => s.currentStage === "received").length,
      qcDone: shipments.filter(s => s.currentStage === "qc_done").length,
      poCreated: shipments.filter(s => s.currentStage === "po_created").length,
    }), [shipments]);

    if (isLoading) return <div style={{ padding: 40, textAlign: "center", color: C.gray, fontFamily: FONT }}>Loading shipments...</div>;
    if (error) return <div style={{ padding: 40, textAlign: "center", color: C.red, fontFamily: FONT }}>Error: {error.message}</div>;

    const stageBadge = (stage: string) => {
      const cfg = STAGE_CFG[stage] || STAGE_CFG.draft;
      return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 99, background: cfg.bg, color: cfg.c, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>{cfg.icon} {cfg.label}</span>;
    };
    const gradeBadge = (g: string) => {
      const gc: Record<string, string> = { premium: "#166534", grade_1: C.forest, grade_2: C.amber, grade_3: C.red, standard: C.gray };
      return <span style={{ padding: "3px 10px", borderRadius: 99, background: C.gBg, color: gc[g] || C.gray, fontSize: 10, fontWeight: 700, border: `1px solid ${C.gBdr}` }}>{g}</span>;
    };
    const poBadge = (s: any) => s.hasPo
      ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 99, background: "#dcfce7", color: "#166534", fontSize: 9, fontWeight: 700, whiteSpace: "nowrap" }}>✓ {s.linkedPoName}</span>
      : <span style={{ padding: "3px 8px", borderRadius: 99, background: C.pageBg, color: C.light, fontSize: 9, fontWeight: 600 }}>Pending</span>;
    const qcBadge = (s: any) => s.hasQc
      ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 99, background: s.qcData?.verdict === "accepted" ? "#dcfce7" : C.rBg, color: s.qcData?.verdict === "accepted" ? "#166534" : C.red, fontSize: 9, fontWeight: 700 }}>✓ QC</span>
      : <span style={{ padding: "3px 8px", borderRadius: 99, background: C.pageBg, color: C.light, fontSize: 9, fontWeight: 600 }}>Pending</span>;
    const filterPill = (label: string, active: boolean, onClick: () => void) => (
      <button onClick={onClick} style={{ padding: "5px 14px", borderRadius: 99, fontSize: 10, fontWeight: active ? 700 : 500, cursor: "pointer", border: `1px solid ${active ? C.forest : C.border}`, background: active ? C.forest : C.card, color: active ? C.white : C.gray, fontFamily: FONT, transition: "all .15s" }}>{label}</button>
    );

    const renderTimeline = (s: any) => {
      const steps = [
        { key: "created", label: "Shipment Created", icon: "📝", done: true, date: s.date + " " + (s.time || ""), who: s.createdBy || s.driver || "Field agent", detail: `${s.supplier} · ${s.commodity} · ${fK(s.net)} · ${s.bales} bales` },
        { key: "shipped", label: "In Transit", icon: "🚛", done: true, date: s.date, who: s.createdBy || s.driver || "", detail: `Plate: ${s.plate} · ${s.baleSize} bales` },
        { key: "received", label: "Received at Site", icon: "📦", done: ["received", "qc_done"].includes(s.stage) || s.hasPo, date: s.stage !== "shipped" && s.stage !== "draft" ? s.date : "", who: s.createdBy || "", detail: s.stage !== "shipped" ? `Gross: ${fK(s.gross)} · Tare: ${fK(s.tare)} · Net: ${fK(s.net)}` : "Awaiting arrival" },
        { key: "qc", label: "Quality Assessed", icon: "🔍", done: s.hasQc, date: s.qcData?.date || "", who: s.qcData?.inspector || "", detail: s.qcData ? `Grade: ${s.qcData.finalGrade} · Moisture: ${s.qcData.moisture} · Verdict: ${s.qcData.verdict}` : "Pending quality assessment" },
        { key: "po", label: "PO Created", icon: "📋", done: s.hasPo, date: "", who: s.hasPo ? "ERP Portal" : "", detail: s.hasPo ? s.linkedPoName : "Pending PO creation" },
        { key: "receipt", label: "Receipt Confirmed", icon: "✅", done: s.hasReceipt, date: "", who: s.hasReceipt ? "ERP Portal" : "", detail: s.hasReceipt ? s.linkedReceipt : "Pending receipt" },
      ];
      return (
        <div style={{ padding: "16px 20px" }}>
          <Lbl>Shipment Progress</Lbl>
          <div style={{ marginTop: 12 }}>
          {steps.map((st, i) => (
            <div key={st.key} style={{ display: "flex", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 32 }}>
                <div style={{ width: 28, height: 28, borderRadius: 14, background: st.done ? C.forest : C.border, color: st.done ? C.white : C.muted, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{st.icon}</div>
                {i < steps.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 28, background: st.done ? C.forest : C.border }} />}
              </div>
              <div style={{ flex: 1, paddingBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: st.done ? C.dark : C.muted }}>{st.label}</div>
                <div style={{ fontSize: 10, color: C.light, marginTop: 2 }}>{st.detail}</div>
                {(st.date || st.who) && <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{st.date}{st.who ? ` · ${st.who}` : ""}</div>}
              </div>
            </div>
          ))}
          </div>
        </div>
      );
    };

    const renderQuality = (s: any) => {
      if (!s.qcData) return <div style={{ padding: 20, textAlign: "center", color: C.light, fontSize: 12 }}>No quality report linked yet</div>;
      const qc = s.qcData;
      const inspectionItems = [
        { label: "Color", val: qc.color, ok: qc.color === "pass" || qc.color === true },
        { label: "Odor", val: qc.odor, ok: qc.odor === "pass" || qc.odor === true },
        { label: "Texture", val: qc.texture, ok: qc.texture === "pass" || qc.texture === true },
        { label: "Pests", val: qc.pests, ok: qc.pests === "pass" || qc.pests === false || qc.pests === "no" },
        { label: "Mold", val: qc.mold, ok: qc.mold === "pass" || qc.mold === false || qc.mold === "no" },
        { label: "Foreign Matter", val: qc.foreignMatter, ok: qc.foreignMatter === "pass" || qc.foreignMatter === false || qc.foreignMatter === "no" },
      ];
      return (
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 18 }}>{qc.verdict === "accepted" ? "✅" : "❌"}</span>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: C.dark }}>{qc.id}</div>
              <div style={{ fontSize: 10, color: C.light }}>Verdict: <span style={{ fontWeight: 700, color: qc.verdict === "accepted" ? "#166534" : C.red }}>{qc.verdict}</span></div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[["Grade", qc.finalGrade], ["Moisture", qc.moisture], ["Type", qc.type === "received" ? "Raw / Received" : "Pressed"]].map(([l, v]) => (
              <div key={l} style={{ textAlign: "center", padding: 10, borderRadius: 8, background: C.gBg, border: `1px solid ${C.gBdr}` }}>
                <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: C.dark }}>{v}</div>
                <div style={{ fontSize: 9, color: C.light, marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[["G1", qc.g1], ["G2", qc.g2], ["Mix", qc.mix]].map(([l, v]) => (
              <div key={l} style={{ flex: 1, textAlign: "center", padding: 10, borderRadius: 8, background: C.pageBg, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: C.dark }}>{v}</div>
                <div style={{ fontSize: 9, color: C.light }}>{l}</div>
              </div>
            ))}
          </div>
          <Lbl>Measurements</Lbl>
          <div style={{ marginTop: 8, marginBottom: 14 }}>
            {[["Moisture", qc.moisture], ["Moisture Weight %", qc.moistureWeight || "—"], ["Protein (NIR)", qc.protein || "—"], ["Density", qc.density || "—"], ["Avg Bale Weight", qc.avgWeight ? qc.avgWeight + " kg" : "—"], ["Bale Height", qc.baleHeight ? qc.baleHeight + " cm" : "—"]].map(([l, v]) => (
              <FieldRow key={l} label={l} value={v} color={l === "Moisture" && parseFloat(v) > 13 ? C.amber : undefined} />
            ))}
          </div>
          <Lbl>Visual Inspection</Lbl>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
            {inspectionItems.filter(x => x.val).map(x => (
              <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 6, background: x.ok ? "#F0FDF4" : C.rBg, border: `1px solid ${x.ok ? "#BBF7D0" : C.rBdr}` }}>
                <span style={{ fontSize: 11 }}>{x.ok ? "✅" : "❌"}</span>
                <span style={{ fontSize: 10, color: x.ok ? "#166534" : C.red }}>{x.label}</span>
              </div>
            ))}
          </div>
          {qc.notes && <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: C.aBg, border: `1px solid ${C.aBdr}`, fontSize: 11, color: "#92400E" }}>📝 {qc.notes}</div>}
        </div>
      );
    };

    const renderPhotos = (attachments: any[], emptyMsg: string) => {
      if (!attachments?.length) return <div style={{ padding: 20, textAlign: "center", color: C.light, fontSize: 12 }}>{emptyMsg}</div>;
      return (
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 10 }}>
            {attachments.map((att: any, i: number) => {
              const irId = att.irAttId || att.ir_attachment_id;
              const imgSrc = irId && imgCache[irId] && imgCache[irId] !== "loading" && imgCache[irId] !== "none" ? imgCache[irId] : null;
              if (irId && !imgCache[irId]) loadImg(irId);
              return (
                <div key={i} onClick={() => setPrvAtt({ ...att, irAttId: irId })} style={{ cursor: "pointer", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`, background: C.pageBg, aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color .15s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = C.gBdr2)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                  {imgSrc ? <img src={imgSrc} alt={att.n || att.name || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : imgCache[irId] === "loading" ? <span style={{ fontSize: 9, color: C.muted }}>Loading...</span>
                    : <span style={{ fontSize: 24 }}>📷</span>}
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    const handleShipCreated = async (s: any, poId: number, poName: string) => {
      setShowShipWiz(false); setConvLoading(true); setConvError("");
      try {
        const linkResult = await linkProcMutation.mutateAsync({ procurementOdooId: s.odooId, poId, poName });
        try { await copyProcAttMutation.mutateAsync({ procurementOdooId: s.odooId, poId }); } catch {}
        if (s.qcData?.odooId) {
          try { await copyQcAttMutation.mutateAsync({ qualityOdooId: s.qcData.odooId, poId }); } catch {}
          const receiptId = linkResult?.receiptIds?.[0];
          if (receiptId) {
            try { await pushQcToReceiptMutation.mutateAsync({ qualityOdooId: s.qcData.odooId, receiptId }); setPushStatus(p => ({ ...p, [s.id]: "done" })); savePushed(s.id); } catch {}
          }
        }
        utils.offlineOps.allData.invalidate();
      } catch (e: any) { setConvError(e?.message || "Failed to link procurement to PO"); }
      finally { setConvLoading(false); }
    };

    const tabs = sel ? [
      { label: "Timeline", icon: "⏱" },
      { label: "Overview", icon: "📊" },
      { label: "Quality", icon: "🔍" },
      { label: "Shipment Photos", icon: "📸" },
      { label: "QC Photos", icon: "🖼" },
      { label: "Actions", icon: "⚡" },
    ] : [];

    return (
      <div style={{ display: "flex", height: "calc(100vh - 3px)", background: C.pageBg, fontFamily: FONT, overflow: "hidden" }}>

        <div style={{ width: sel ? "50%" : "100%", minWidth: sel ? 400 : undefined, display: "flex", flexDirection: "column", background: C.card, transition: "width .2s", height: "100%", overflow: "hidden" }}>

          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, background: `linear-gradient(135deg,#1B3A2D,${C.forest})` }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.white }}>Procurement</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,.55)", marginBottom: 10 }}>Procurement to PO tracking</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
              {[
                ["Total", counts.total, C.white],
                ["In Transit", counts.shipped, "#60A5FA"],
                ["Received/Pending QC", counts.received, "#FBBF24"],
                ["Received/QC Done", counts.qcDone, "#34D399"],
                ["Shipment Created", counts.poCreated, "#A78BFA"],
              ].map(([l, v, c]) => (
                <div key={l as string} style={{ textAlign: "center", padding: "7px 4px", borderRadius: 8, background: "rgba(255,255,255,.08)" }}>
                  <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: c as string }}>{v as number}</div>
                  <div style={{ fontSize: 8, color: "rgba(255,255,255,.5)", marginTop: 2 }}>{l as string}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "10px 18px", borderBottom: `1px solid ${C.border}` }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search supplier, ID, plate..." style={{ width: 200, height: 34, padding: "0 12px", border: `1px solid ${C.inputBdr}`, borderRadius: 7, fontFamily: FONT, fontSize: 11, outline: "none", background: C.card }} />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {[["all","All"],["shipped","🚛 In Transit"],["pending_qc","📦 Received/Pending QC"],["qc_done","✅ Received/QC Done"],["po_created","🚢 Shipment Created"]].map(([k,l]) =>
                <span key={k}>{filterPill(l, stageFilter===k, () => setStageFilter(k))}</span>
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
            <div className="xc" style={{ borderRadius: 0, border: "none" }}>
              <div className="xh" style={{ background: C.forest, position: "sticky", top: 0, zIndex: 3 }}>
                <h3>🚢 Procurement</h3><span className="ct">{filtered.length}</span>
              </div>
              <table className="t">
                <thead><tr>
                  {["ID","Supplier","Commodity","Grade","Stage","Vehicle / Plate","Net Weight","Bales","Price","QC Status","PO Status","Created By","Date"].map(h => (
                    <th key={h} style={{ position: "sticky", top: 36, background: C.pageBg, zIndex: 2 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id} onClick={() => setSelectedId(s.id)} style={{ cursor: "pointer", background: sel && sel.id === s.id ? C.gBg2 : undefined }}>
                      <td style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: C.forest }}>{s.id}</td>
                      <td style={{ fontWeight: 500 }}>{s.supplier}</td>
                      <td style={{ fontSize: 10 }}>{s.commodity}</td>
                      <td>{gradeBadge(s.grade)}</td>
                      <td>{stageBadge(s.currentStage)}</td>
                      <td style={{ fontFamily: MONO, fontSize: 9, color: C.gray }}>{s.plate}</td>
                      <td style={{ fontFamily: MONO, color: C.forest, fontWeight: 600 }}>{fK(s.net)}</td>
                      <td style={{ fontFamily: MONO, fontSize: 10 }}>{s.bales}</td>
                      <td style={{ fontFamily: MONO, fontSize: 10 }}>{s.price}</td>
                      <td>{qcBadge(s)}</td>
                      <td>{poBadge(s)}</td>
                      <td style={{ fontSize: 10, color: C.gray, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.createdBy || "—"}</td>
                      <td style={{ fontFamily: MONO, fontSize: 10, color: C.light }}>{s.date}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={13} style={{ textAlign: "center", padding: 24, color: C.light, fontSize: 12 }}>No procurement records match the current filters</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {sel && (
          <div style={{ width: "50%", display: "flex", flexDirection: "column", borderLeft: `1px solid ${C.border}`, height: "100%", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", background: `linear-gradient(135deg,#1B3A2D,${C.forest})`, color: C.white }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700 }}>{sel.id}</div>
                  <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>{sel.supplier} · {sel.commodity} · {sel.site}</div>
                </div>
                <button onClick={() => setSelectedId(null)} style={{ background: "rgba(255,255,255,.12)", border: "none", borderRadius: 8, padding: "6px 12px", color: C.white, cursor: "pointer", fontSize: 16 }}>×</button>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {[
                  [fK(sel.net), "Net Weight"],
                  [String(sel.bales), "Bales"],
                  [sel.grade, "Grade"],
                  ...(sel.hasQc ? [[sel.qcData?.verdict || "—", "QC Verdict"]] : []),
                ].map(([v, l]) => (
                  <div key={l} style={{ padding: "8px 14px", borderRadius: 8, background: l === "QC Verdict" ? (sel.qcData?.verdict === "accepted" ? "rgba(52,211,153,.2)" : "rgba(239,68,68,.2)") : "rgba(255,255,255,.1)", textAlign: "center" }}>
                    <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700 }}>{v}</div>
                    <div style={{ fontSize: 8, opacity: 0.55 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, background: C.pageBg, overflowX: "auto" }}>
              {tabs.map((t, i) => (
                <button key={t.label} onClick={() => setActiveTab(i)} style={{ padding: "10px 14px", border: "none", borderBottom: activeTab === i ? `2px solid ${C.forest}` : "2px solid transparent", background: "none", color: activeTab === i ? C.forest : C.light, fontSize: 11, fontWeight: activeTab === i ? 700 : 500, cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap" }}>{t.icon} {t.label}</button>
              ))}
            </div>

            <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>

              {activeTab === 1 && (
                <div style={{ padding: "16px 20px" }}>
                  <Lbl>Shipment Details</Lbl>
                  <div style={{ marginTop: 8 }}>
                    {[["Supplier", sel.supplier], ["Commodity", sel.commodity], ["Grade", sel.grade], ["Site", sel.site], ["Driver", sel.driver], ["Plate", sel.plate], ["Bale Size", sel.baleSize], ["Date", sel.date + " " + (sel.time || "")]].map(([l, v]) => (
                      <FieldRow key={l} label={l} value={v || "—"} />
                    ))}
                  </div>
                  <div style={{ marginTop: 20 }}><Lbl>Weighbridge</Lbl></div>
                  <div style={{ marginTop: 8 }}>
                    {[["Gross Weight", fK(sel.gross)], ["Tare Weight", fK(sel.tare)], ["Net Weight", fK(sel.net)], ["Bales", sel.bales], ["Avg Bale Weight", sel.avgBale ? sel.avgBale + " kg" : "—"]].map(([l, v]) => (
                      <FieldRow key={l} label={l} value={v} mono />
                    ))}
                  </div>
                  {sel.incoterm && <div style={{ marginTop: 20 }}><Lbl>Commercial</Lbl><div style={{ marginTop: 8 }}><FieldRow label="Incoterm" value={sel.incoterm} /><FieldRow label="Price" value={sel.price} mono /></div></div>}
                  {sel.linkedPoName && (
                    <div style={{ marginTop: 20, padding: 14, borderRadius: 9, background: C.gBg, border: `1px solid ${C.gBdr}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>✅</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.forest }}>{sel.linkedPoName}</div>
                          {sel.linkedReceipt && <div style={{ fontSize: 10, color: C.sage }}>Receipt: {sel.linkedReceipt}</div>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 0 && renderTimeline(sel)}
              {activeTab === 2 && renderQuality(sel)}
              {activeTab === 3 && renderPhotos(sel.attachments, "No shipment photos uploaded")}
              {activeTab === 4 && renderPhotos(sel.qcData?.attachments, "No QC photos available")}

              {activeTab === 5 && (
                <div style={{ padding: "16px 20px" }}>
                  <Lbl>Available Actions</Lbl>
                  <div style={{ marginTop: 12 }}>

                  {sel.hasPo ? (
                    <div style={{ padding: 14, borderRadius: 9, background: C.gBg, border: `1px solid ${C.gBdr}`, marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 16 }}>✅</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.forest }}>PO Created: {sel.linkedPoName}</div>
                          {sel.linkedReceipt && <div style={{ fontSize: 10, color: C.sage }}>Receipt: {sel.linkedReceipt}</div>}
                        </div>
                      </div>
                      <button onClick={() => navigate(`/purchase/${sel.linkedPoId}`)} style={{ width: "100%", padding: 10, borderRadius: 8, background: C.forest, color: C.white, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>View PO in Shipments Module →</button>
                    </div>
                  ) : (
                    <div style={{ padding: 14, borderRadius: 9, background: C.tBg, border: `1px solid ${C.tBdr}`, marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.terra, marginBottom: 6 }}>📋 Create Purchase Order</div>
                      <div style={{ fontSize: 11, color: C.gray, marginBottom: 10, lineHeight: 1.4 }}>Convert this procurement into a formal Purchase Order in Odoo. All data and attachments will be copied.</div>
                      <button onClick={() => setShowShipWiz(true)} disabled={convLoading} style={{ width: "100%", padding: 10, borderRadius: 8, background: convLoading ? C.muted : C.forest, color: C.white, border: "none", fontSize: 12, fontWeight: 700, cursor: convLoading ? "not-allowed" : "pointer", fontFamily: FONT }}>{convLoading ? "⌛ Creating..." : "Create PO from Procurement"}</button>
                      {convError && <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: C.rBg, border: `1px solid ${C.rBdr}`, color: C.red, fontSize: 10 }}>{convError}</div>}
                    </div>
                  )}

                  {sel.hasQc && sel.hasReceipt && (
                    <div style={{ padding: 14, borderRadius: 9, background: pushStatus[sel.id] === "done" ? C.gBg : "#EFF6FF", border: `1.5px solid ${pushStatus[sel.id] === "done" ? C.gBdr : "#93C5FD"}`, marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: pushStatus[sel.id] === "done" ? C.forest : "#1D4ED8", marginBottom: 6 }}>📋 Push QC Data to Receipt</div>
                      {pushStatus[sel.id] === "done" ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 18 }}>✅</span><div style={{ fontSize: 11, color: "#166534" }}>QC data + photos pushed to {sel.linkedReceipt}</div></div>
                      ) : pushStatus[sel.id] === "error" ? (
                        <div>
                          <div style={{ padding: "6px 10px", borderRadius: 6, background: C.rBg, border: `1px solid ${C.rBdr}`, color: C.red, fontSize: 10, marginBottom: 8 }}>Failed to push. Please retry.</div>
                          <button onClick={async () => { setPushStatus(p => ({ ...p, [sel.id]: "pushing" })); try { await pushQcToReceiptMutation.mutateAsync({ qualityOdooId: sel.qcData.odooId, receiptId: sel.linkedReceiptId }); setPushStatus(p => ({ ...p, [sel.id]: "done" })); savePushed(sel.id); } catch { setPushStatus(p => ({ ...p, [sel.id]: "error" })); } }} style={{ width: "100%", padding: 10, borderRadius: 8, background: "#1D4ED8", color: C.white, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>↻ Retry</button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 11, color: "#3B82F6", marginBottom: 10, lineHeight: 1.4 }}>Push quality data (grade, moisture, protein, visual inspection, photos) to receipt <strong>{sel.linkedReceipt}</strong>.</div>
                          <button onClick={async () => { setPushStatus(p => ({ ...p, [sel.id]: "pushing" })); try { await pushQcToReceiptMutation.mutateAsync({ qualityOdooId: sel.qcData.odooId, receiptId: sel.linkedReceiptId }); setPushStatus(p => ({ ...p, [sel.id]: "done" })); savePushed(sel.id); } catch { setPushStatus(p => ({ ...p, [sel.id]: "error" })); } }} disabled={pushStatus[sel.id] === "pushing"} style={{ width: "100%", padding: 10, borderRadius: 8, background: pushStatus[sel.id] === "pushing" ? C.muted : "#1D4ED8", color: C.white, border: "none", fontSize: 12, fontWeight: 700, cursor: pushStatus[sel.id] === "pushing" ? "not-allowed" : "pointer", fontFamily: FONT }}>{pushStatus[sel.id] === "pushing" ? "⟳ Pushing..." : "📋 Push QC Data to Receipt"}</button>
                        </div>
                      )}
                    </div>
                  )}

                  {sel.hasQc && (
                    <div style={{ padding: 14, borderRadius: 9, background: C.pageBg, border: `1px solid ${C.border}`, marginBottom: 14, cursor: "pointer" }} onClick={() => navigate("/offline-ops")}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = C.gBdr2)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>🔍</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>View QC Report: {sel.qcData.id}</div>
                          <div style={{ fontSize: 10, color: C.gray }}>Open in Quality Reports section</div>
                        </div>
                        <span style={{ color: C.light }}>→</span>
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {showShipWiz && sel && (() => {
          const qcData = sel.qcData ? { odooId: sel.qcData.odooId, finalGrade: sel.qcData.finalGrade, moisture: sel.qcData.moisture, verdict: sel.qcData.verdict } : undefined;
          return <CreateOdooShipment activeCompanyId="ALL" onClose={() => setShowShipWiz(false)} onCreated={(poId, poName) => handleShipCreated(sel, poId, poName)} procurementData={{ odooId: sel.odooId, id: sel.id, supplier: sel.supplier, commodity: sel.commodity, grade: sel.grade, net: sel.net, price: sel.price, incoterm: sel.incoterm, plate: sel.plate, bales: sel.bales, qcData }} />;
        })()}

        {prvAtt && (() => {
          const imgSrc = prvAtt.irAttId && imgCache[prvAtt.irAttId] && imgCache[prvAtt.irAttId] !== "loading" && imgCache[prvAtt.irAttId] !== "none" ? imgCache[prvAtt.irAttId] : null;
          if (prvAtt.irAttId && !imgCache[prvAtt.irAttId]) loadImg(prvAtt.irAttId);
          return (
            <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", animation: "modalBgIn .2s" }} onClick={() => setPrvAtt(null)}>
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)" }} />
              <div style={{ position: "relative", background: C.card, borderRadius: 14, width: 500, maxWidth: "92vw", overflow: "hidden", animation: "modalIn .25s" }} onClick={e => e.stopPropagation()}>
                <div style={{ minHeight: 300, maxHeight: 500, background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {imgSrc ? <img src={imgSrc} alt={prvAtt.n} style={{ maxWidth: "100%", maxHeight: 500, objectFit: "contain" }} /> : imgCache[prvAtt.irAttId] === "loading" ? <div style={{ color: C.muted }}>Loading...</div> : <span style={{ fontSize: 56 }}>📷</span>}
                </div>
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 4 }}>{prvAtt.n}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    {imgSrc && <a href={imgSrc} download={prvAtt.n + ".jpg"} style={{ flex: 1, padding: 10, borderRadius: 8, background: C.forest, color: C.white, textAlign: "center", textDecoration: "none", fontSize: 12, fontWeight: 600, fontFamily: FONT }}>⬇ Download</a>}
                    <button onClick={() => setPrvAtt(null)} style={{ padding: "10px 16px", borderRadius: 8, background: C.pageBg, color: C.gray, border: `1px solid ${C.border}`, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Close</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }
  