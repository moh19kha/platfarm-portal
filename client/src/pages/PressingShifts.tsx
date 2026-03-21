// @ts-nocheck
  import { useState, useMemo, useCallback } from "react";
  import { trpc } from "@/lib/trpc";
  import { C, FONT, MONO } from "@/lib/data";
  import { Badge, Lbl, Val, Mono, FieldRow, TabButton } from "@/components/ui-primitives";
  import { CreateProductionOrder } from "@/components/CreateProductionOrder";

  const ICON_PRESSING = "https://d2xsxph8kpxj0f.cloudfront.net/310519663129724353/X5tJK2uaPFqt5EwqucHsfz/pressing-machine_7624d931.png";
  const ImgIcon = ({src,size=15}:{src:string;size?:number}) => <img src={src} alt="" style={{width:size,height:size,objectFit:"contain"}} />;
  const fK = (kg: number) => { if (Math.abs(kg) >= 1000) return (kg / 1000).toFixed(1) + "t"; return Math.round(kg).toLocaleString() + " kg"; };

  export default function PressingShifts() {
    const utils = trpc.useUtils();
    const { data, isLoading, error } = trpc.offlineOps.allData.useQuery({});
    const linkPressMutation = trpc.offlineOps.linkPressingToMO.useMutation();
    const copyPressAttMutation = trpc.offlineOps.copyPressingAttachments.useMutation();

    const DPR = data?.DPR || [];

    const [search, setSearch] = useState("");
    const [syncFilter, setSyncFilter] = useState("all");
    const [siteFilter, setSiteFilter] = useState("All");
    const [selectedId, setSelectedId] = useState<string|null>(null);
    const [activeTab, setActiveTab] = useState(0);
    const [convLoading, setConvLoading] = useState(false);
    const [convError, setConvError] = useState<string|null>(null);
    const [dprConversionStatus, setDprConversionStatus] = useState<Record<string,{moId:number,moName:string}>>({});

    const filtered = useMemo(() => {
      let list = [...DPR];
      if (search) {
        const s = search.toLowerCase();
        list = list.filter(r => r.id?.toLowerCase().includes(s) || r.batch?.toLowerCase().includes(s) || r.operator?.toLowerCase().includes(s) || r.commodity?.toLowerCase().includes(s) || r.line?.toLowerCase().includes(s));
      }
      if (syncFilter !== "all") list = list.filter(r => r.sync === syncFilter);
      if (siteFilter !== "All") list = list.filter(r => siteFilter === "Sokhna" ? r.site?.includes("Sokhna") : r.site?.includes("Dakhla"));
      return list;
    }, [DPR, search, syncFilter, siteFilter]);

    const sel = selectedId ? filtered.find(r => r.id === selectedId) || DPR.find(r => r.id === selectedId) : null;

    const totalOut = DPR.reduce((s,r) => s + (r.outWeight||0), 0);
    const totalBales = DPR.reduce((s,r) => s + (r.outBales||0), 0);
    const avgFuel = DPR.length > 0 ? Math.round(DPR.reduce((s,r) => s + (r.fuel||0), 0) / DPR.length) : 0;
    const synced = DPR.filter(r => r.sync === "synced").length;

    const getLinkedMo = useCallback((rec: any) => {
      if (dprConversionStatus[rec.id]) return dprConversionStatus[rec.id];
      if (rec.linkedMoName) return { moName: rec.linkedMoName, moId: rec.linkedMoId || 0 };
      return null;
    }, [dprConversionStatus]);

    const handleLinkMo = async (rec: any) => {
      setConvLoading(true); setConvError(null);
      try {
        const res = await linkPressMutation.mutateAsync({ recordId: rec.id, site: rec.site, commodity: rec.commodity, inWeight: rec.inWeight, outWeight: rec.outWeight, inBales: rec.inBales, outBales: rec.outBales, batch: rec.batch, line: rec.line, sources: rec.sources });
        setDprConversionStatus(prev => ({...prev, [rec.id]: { moId: res.moId, moName: res.moName }}));
        utils.offlineOps.allData.invalidate();
      } catch (e: any) { setConvError(e?.message || "Failed to create MO"); }
      finally { setConvLoading(false); }
    };

    const filterPill = (label: string, active: boolean, onClick: () => void) => (
      <button onClick={onClick} style={{ padding: "5px 14px", borderRadius: 99, fontSize: 11, fontWeight: active ? 600 : 500, cursor: "pointer", border: active ? "1px solid #C0714A" : "1px solid " + C.inputBdr, background: active ? "#C0714A" : C.card, color: active ? "#fff" : C.gray, fontFamily: FONT, transition: "all .15s" }}>{label}</button>
    );

    const syncBadge = (sync: string) => {
      const cfg: Record<string, {bg:string,c:string,l:string}> = { synced:{bg:C.gBg,c:"#166534",l:"\u2713 Synced"}, processing:{bg:"#FEF3C7",c:"#92400E",l:"\u21BB Processing"}, pending:{bg:"#F2F0EC",c:"#95A09C",l:"Pending"} };
      const s = cfg[sync] || cfg.pending;
      return <span style={{display:"inline-flex",padding:"2px 10px",borderRadius:99,fontSize:10,fontWeight:600,background:s.bg,color:s.c,whiteSpace:"nowrap"}}>{s.l}</span>;
    };

    const siteBadge = (site: string) => {
      const dk = site?.includes("Dakhla");
      return <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 8px",borderRadius:99,fontSize:9,fontWeight:700,background:dk?"#FDF7F3":"#E4EFE6",color:dk?"#C0714A":"#2D5A3D",whiteSpace:"nowrap",border:"1px solid "+(dk?"#C0714A20":"#2D5A3D20")}}>{dk?"\ud83c\udf3f":"\ud83c\udfed"} {dk?"Dakhla":"Sokhna"}</span>;
    };

    const tabs = sel ? [
      { label: "Overview", icon: "\ud83d\udccb" },
      { label: "Crew", icon: "\ud83d\udc77" },
      { label: "Attachments", icon: "\ud83d\udcce" },
      { label: "Actions", icon: "\u26a1" },
    ] : [];

    if (isLoading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",fontFamily:FONT,color:C.gray}}>Loading pressing shifts...</div>;
    if (error) return <div style={{padding:24,fontFamily:FONT,color:"#C94444"}}>Failed to load data: {error.message}</div>;

    return (
      <div style={{ display: "flex", height: "calc(100vh - 3px)", background: C.pageBg, fontFamily: FONT, overflow: "hidden" }}>

        <div style={{ width: sel ? "50%" : "100%", minWidth: sel ? 400 : undefined, display: "flex", flexDirection: "column", background: C.card, transition: "width .2s", height: "100%", overflow: "hidden" }}>

          <div style={{ padding: "14px 18px", borderBottom: "1px solid " + C.border, background: "linear-gradient(135deg,#7A3B1E,#C0714A)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ImgIcon src={ICON_PRESSING} size={22} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Pressing Shifts</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,.55)" }}>Double press production tracking</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, marginTop: 12 }}>
              {[
                ["Batches", DPR.length, "#fff"],
                ["Output", fK(totalOut), "#FFD699"],
                ["Bales", totalBales, "#FFD699"],
                ["Avg Fuel", avgFuel + " L", "#F5C4C4"],
                ["Synced", synced + "/" + DPR.length, "#7FBF96"],
              ].map(([l, v, c]) => (
                <div key={l as string} style={{ textAlign: "center", padding: "7px 4px", borderRadius: 8, background: "rgba(255,255,255,.1)" }}>
                  <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: c as string }}>{v as any}</div>
                  <div style={{ fontSize: 8, color: "rgba(255,255,255,.5)", marginTop: 2 }}>{l as string}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "10px 18px", borderBottom: "1px solid " + C.border, flexWrap: "wrap" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search batch, operator, commodity..." style={{ width: 220, height: 34, padding: "0 12px", border: "1px solid " + C.inputBdr, borderRadius: 7, fontFamily: FONT, fontSize: 11, outline: "none", background: C.card }} />
            <div style={{ display: "flex", gap: 4 }}>
              {[["all","All"],["synced","\u2713 Synced"],["processing","\u21BB Processing"],["pending","Pending"]].map(([k,l]) =>
                <span key={k}>{filterPill(l, syncFilter===k, () => setSyncFilter(k))}</span>
              )}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              {["All","Sokhna","Dakhla"].map(s => <span key={s}>{filterPill(s, siteFilter===s, () => setSiteFilter(s))}</span>)}
            </div>
          </div>

          <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
            <div className="xc" style={{ borderRadius: 0, border: "none" }}>
              <div className="xh" style={{ background: "#C0714A", position: "sticky", top: 0, zIndex: 3 }}>
                <h3><ImgIcon src={ICON_PRESSING} size={18} /> Pressing Shifts</h3><span className="ct">{filtered.length}</span>
              </div>
              <table className="t">
                <thead><tr>
                  {["ID","Batch","Site","Line","Operator","Commodity","Input","Output","Bales","Avg Bale","Fuel","MO Status","Sync","Date"].map(h => (
                    <th key={h} style={{ position: "sticky", top: 36, background: C.pageBg, zIndex: 2 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map(r => {
                    const lmo = getLinkedMo(r);
                    return (
                      <tr key={r.id} onClick={() => setSelectedId(r.id)} style={{ cursor: "pointer", background: sel && sel.id === r.id ? "#FDF6EC" : undefined }}>
                        <td style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: "#C0714A" }}>{r.id}</td>
                        <td style={{ fontFamily: MONO, fontSize: 10 }}>{r.batch}</td>
                        <td>{siteBadge(r.site)}</td>
                        <td><span style={{display:"inline-flex",padding:"2px 8px",borderRadius:99,fontSize:9,fontWeight:600,background:r.line==="Press 1"?"#E4EFE6":"#FDF6EC",color:r.line==="Press 1"?"#2D5A3D":"#C0714A"}}>{r.line}</span></td>
                        <td style={{ fontSize: 10 }}>{r.operator}</td>
                        <td style={{ fontSize: 10 }}>{r.commodity}</td>
                        <td style={{ fontFamily: MONO, fontSize: 10 }}>{fK(r.inWeight)}</td>
                        <td style={{ fontFamily: MONO, fontSize: 10, color: "#2D5A3D", fontWeight: 600 }}>{fK(r.outWeight)}</td>
                        <td style={{ fontFamily: MONO, fontSize: 10 }}>{r.outBales}</td>
                        <td style={{ fontFamily: MONO, fontSize: 10 }}>{r.outAvgBale} kg</td>
                        <td style={{ fontFamily: MONO, fontSize: 10 }}>{r.fuel}L</td>
                        <td>{lmo ? <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 7px",borderRadius:99,background:"#dcfce7",color:"#166534",fontSize:9,fontWeight:700,whiteSpace:"nowrap"}}>\u2713 {lmo.moName}</span> : <span style={{display:"inline-flex",padding:"2px 7px",borderRadius:99,background:"#F2F0EC",color:"#95A09C",fontSize:9,fontWeight:600}}>Pending</span>}</td>
                        <td>{syncBadge(r.sync)}</td>
                        <td style={{ fontFamily: MONO, fontSize: 10, color: C.gray }}>{r.date}</td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && <tr><td colSpan={14} style={{textAlign:"center",padding:24,color:C.gray,fontSize:12}}>No pressing shifts match the current filters</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {sel && (
          <div style={{ width: "50%", minWidth: 360, borderLeft: "1.5px solid " + C.border, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: C.pageBg }}>

            <div style={{ padding: "14px 18px", borderBottom: "1px solid " + C.border, background: C.card }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: "#C0714A" }}>{sel.id}</div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{sel.line} \u00b7 {sel.commodity} \u00b7 {sel.site}</div>
                </div>
                <button onClick={() => setSelectedId(null)} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid " + C.border, background: C.card, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>\u00d7</button>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {[
                  [fK(sel.outWeight), "Output", "#C0714A"],
                  [sel.outBales, "Bales", "#C0714A"],
                  [sel.outAvgBale + " kg", "Avg Bale", "#2D5A3D"],
                  [sel.density, "Density", "#475577"],
                ].map(([v, l, c]) => (
                  <div key={l as string} style={{ padding: "6px 14px", borderRadius: 8, background: "#FDF6EC", border: "1px solid #F5DDB8" }}>
                    <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: c as string }}>{v as any}</div>
                    <div style={{ fontSize: 8, color: C.gray, marginTop: 1 }}>{l as string}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid " + C.border, background: C.card }}>
              {tabs.map((t, i) => (
                <button key={t.label} onClick={() => setActiveTab(i)} style={{ padding: "8px 14px", fontSize: 11, fontWeight: activeTab === i ? 700 : 500, color: activeTab === i ? "#C0714A" : C.gray, background: "none", border: "none", borderBottom: activeTab === i ? "2px solid #C0714A" : "2px solid transparent", cursor: "pointer", fontFamily: FONT }}>{t.icon} {t.label}</button>
              ))}
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "16px 18px" }}>
              {activeTab === 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#C0714A", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".5px" }}>Pressing Details</div>
                  {[
                    ["Press Line", sel.line],
                    ["Batch", sel.batch],
                    ["Operator", sel.operator],
                    ["Shift", sel.shift],
                    ["Commodity", sel.commodity],
                    ["Input Bales", sel.inBales],
                    ["Input Weight", fK(sel.inWeight)],
                    ["Input Grade", sel.inGrade],
                    ["Output Bales", sel.outBales],
                    ["Output Weight", fK(sel.outWeight)],
                    ["Avg Bale", sel.outAvgBale + " kg"],
                    ["Density", sel.density],
                    ["Start Time", sel.startTime],
                    ["End Time", sel.endTime],
                    ["Fuel", sel.fuel + " L"],
                    ["Oil Temp", sel.oilTemp],
                    ["Oil Pressure", sel.oilPressure],
                    ["Sources", sel.sources],
                    ["Site", sel.site],
                    ["Date", sel.date],
                    ["Sync", sel.sync],
                  ].map(([l, v]) => (
                    <div key={l as string} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #F2F0EC" }}>
                      <span style={{ fontSize: 11, color: C.gray }}>{l as string}</span>
                      <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: "#2C3E50" }}>{v as any}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 1 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#C0714A", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".5px" }}>Crew & Personnel</div>
                  {(sel.crew || []).map((g: any, i: number) => (
                    <div key={i} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, marginBottom: 6 }}>{g.role}</div>
                      {g.ppl.map((p: string, j: number) => (
                        <div key={j} style={{ fontSize: 12, padding: "5px 0", color: "#2C3E50", borderBottom: "1px solid #F2F0EC" }}>{p}</div>
                      ))}
                    </div>
                  ))}
                  {(!sel.crew || sel.crew.length === 0) && <div style={{ color: C.gray, fontSize: 11 }}>No crew data available</div>}
                </div>
              )}

              {activeTab === 2 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#C0714A", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".5px" }}>Attachments</div>
                  {(sel.att || []).map((a: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #F2F0EC" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: "#FDF6EC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{a.t === "photo" ? "\ud83d\udcf8" : "\ud83d\udcc4"}</div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#2C3E50" }}>{a.n}</div>
                        <div style={{ fontSize: 9, color: C.gray }}>{a.t} \u00b7 {a.s}</div>
                      </div>
                    </div>
                  ))}
                  {(!sel.att || sel.att.length === 0) && <div style={{ color: C.gray, fontSize: 11 }}>No attachments available</div>}
                </div>
              )}

              {activeTab === 3 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#C0714A", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".5px" }}>Available Actions</div>
                  <div style={{ marginTop: 12 }}>
                    {(() => {
                      const lmo = getLinkedMo(sel);
                      if (lmo) return (
                        <div style={{ padding: 14, borderRadius: 10, background: "#dcfce7", border: "1px solid #bbf7d0" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#166534" }}>\u2713 Manufacturing Order Created</div>
                          <div style={{ fontFamily: MONO, fontSize: 11, color: "#166534", marginTop: 4 }}>{lmo.moName}</div>
                        </div>
                      );
                      return (
                        <div>
                          <button onClick={() => handleLinkMo(sel)} disabled={convLoading} style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "none", background: convLoading ? C.gray : "#C0714A", color: "#fff", fontSize: 12, fontWeight: 700, cursor: convLoading ? "default" : "pointer", fontFamily: FONT }}>
                            {convLoading ? "Creating MO..." : "\ud83c\udfed Create Manufacturing Order in Odoo"}
                          </button>
                          {convError && <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "#FDF0F0", color: "#C94444", fontSize: 11 }}>{convError}</div>}
                          <div style={{ marginTop: 8, fontSize: 10, color: C.gray }}>This will create a manufacturing order in Odoo ERP linked to this pressing shift.</div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
  