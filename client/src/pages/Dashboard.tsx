// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD — Platfarm V3 — Live Odoo Data Dashboard
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { C, MONO, FONT, fmt, UNIFIED_STAGES, type Perms } from "@/lib/data";
import { Badge, Bar, Card, CardHdr, CHT, CHB, Btn, Th, Td, Section, SBdg } from "@/components/ui-primitives";
import { hl } from "@/components/SearchHighlight";
import { useTableSort } from "@/hooks/useTableSort";
import { SortTh } from "@/components/SortTh";
import { trpc } from "@/lib/trpc";
import { exportToExcel, type ExcelColumn } from "@/lib/exportExcel";
import { TopProgressBar, ShimmerBox, PipelineSkeleton, AlertSkeleton, TableSkeleton } from "@/components/LoadingIndicators";
import { PO_STATE_LABELS, PO_STATE_BADGE, SO_STATE_LABELS, SO_STATE_BADGE } from "@/lib/stateLabels";

interface DashProps {
  perms: Perms;
  activeCompanyId: string;
  onNavPurchaseDetail: (id: number) => void;
  onNavSalesDetail: (id: number) => void;
  onNavPage: (page: string) => void;
}

const InlineError = ({ message }: { message?: string }) => (
  <div style={{ padding: "14px 16px", background: "#FDF0F0", border: "1px solid #F5C4C4", borderRadius: 8, display: "flex", alignItems: "flex-start", gap: 10 }}>
    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠</span>
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#C94444", marginBottom: 2 }}>Failed to load data</div>
      {message && <div style={{ fontSize: 11, color: "#B44" }}>{message}</div>}
    </div>
  </div>
);

export function Dashboard({ perms, activeCompanyId, onNavPurchaseDetail, onNavSalesDetail, onNavPage }: DashProps) {
  const companyId = activeCompanyId === "ALL" ? undefined : Number(activeCompanyId);

  // Fetch live data from Odoo — pass companyId when a specific company is selected
  const { data: purchaseShipments, isLoading: pLoading, isError: pError } = trpc.shipments.list.useQuery(
    companyId ? { companyId, limit: 200, offset: 0 } : { limit: 200, offset: 0 }
  );
  const { data: salesShipments, isLoading: sLoading, isError: sError } = trpc.salesShipments.list.useQuery(
    companyId ? { companyId, limit: 200, offset: 0 } : { limit: 200, offset: 0 }
  );
  const { data: pCount } = trpc.shipments.count.useQuery(
    companyId ? { companyId } : undefined
  );
  const { data: sCount } = trpc.salesShipments.count.useQuery(
    companyId ? { companyId } : undefined
  );

  const ps = purchaseShipments || [];
  const ss = salesShipments || [];
  const isLoading = pLoading || sLoading;
  const isError = pError || sError;

  // ─── Search & Date Range Filters ────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);

  const hasFilters = search.trim() !== "" || dateFrom !== "" || dateTo !== "" || stageFilter !== null;

  // ─── Container / Truck Load backend search ─────────────────────────────
  const [loadMatchPOIds, setLoadMatchPOIds] = useState<Set<number>>(new Set());
  const [loadMatchSOIds, setLoadMatchSOIds] = useState<Set<number>>(new Set());
  const [loadSearching, setLoadSearching] = useState(false);
  const loadSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSearchAbort = useRef<AbortController | null>(null);

  // Debounced backend search for container/truck numbers
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setLoadMatchPOIds(new Set());
      setLoadMatchSOIds(new Set());
      setLoadSearching(false);
      return;
    }
    // Debounce 400ms
    if (loadSearchTimer.current) clearTimeout(loadSearchTimer.current);
    setLoadSearching(true);
    loadSearchTimer.current = setTimeout(async () => {
      try {
        const [poIds, soIds] = await Promise.all([
          fetch(`/api/trpc/shipments.searchByLoadField?input=${encodeURIComponent(JSON.stringify({ query: q }))}`)
            .then(r => r.json()).then(r => (r?.result?.data || []) as number[]).catch(() => [] as number[]),
          fetch(`/api/trpc/salesShipments.searchByLoadField?input=${encodeURIComponent(JSON.stringify({ query: q }))}`)
            .then(r => r.json()).then(r => (r?.result?.data || []) as number[]).catch(() => [] as number[]),
        ]);
        setLoadMatchPOIds(new Set(poIds));
        setLoadMatchSOIds(new Set(soIds));
      } catch {
        setLoadMatchPOIds(new Set());
        setLoadMatchSOIds(new Set());
      } finally {
        setLoadSearching(false);
      }
    }, 400);
    return () => { if (loadSearchTimer.current) clearTimeout(loadSearchTimer.current); };
  }, [search]);

  const matchesSearch = (sh: any, type: "purchase" | "sales") => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const fields: (string | undefined | null)[] = [
      sh.name,
      type === "purchase" ? sh.vendor?.name : sh.customer?.name,
      sh.shippingLine,
      sh.blNumber,
      sh.vesselName,
      sh.bookingNumber,
      sh.productCategory,
      sh.shipmentStatus,
      // Expanded search fields
      sh.portOfLoading,
      sh.portOfDestination,
      sh.clearanceAgent?.name,
      sh.truckingCompany?.name,
      // Product names array
      ...(sh.productNames || []),
    ];
    const localMatch = fields.some(f => f && String(f).toLowerCase().includes(q));
    if (localMatch) return true;
    // Also match if backend container/truck search found this shipment
    if (type === "purchase" && loadMatchPOIds.has(sh.id)) return true;
    if (type === "sales" && loadMatchSOIds.has(sh.id)) return true;
    return false;
  };

  const matchesDate = (sh: any) => {
    if (!dateFrom && !dateTo) return true;
    const d = sh.dateOrder || sh.shipmentDate;
    if (!d) return !dateFrom && !dateTo ? true : false;
    const orderDate = d.slice(0, 10); // YYYY-MM-DD
    if (dateFrom && orderDate < dateFrom) return false;
    if (dateTo && orderDate > dateTo) return false;
    return true;
  };

  const matchesStage = (sh: any) => {
    if (!stageFilter) return true;
    if (stageFilter === "Not Set") return !sh.shipmentStatus;
    return (sh.shipmentStatus || "") === stageFilter;
  };

  const filteredPs = useMemo(() => ps.filter(sh => matchesSearch(sh, "purchase") && matchesDate(sh) && matchesStage(sh)), [ps, search, dateFrom, dateTo, stageFilter, loadMatchPOIds]);
  const filteredSs = useMemo(() => ss.filter(sh => matchesSearch(sh, "sales") && matchesDate(sh) && matchesStage(sh)), [ss, search, dateFrom, dateTo, stageFilter, loadMatchSOIds]);

  // Purchase table sorting
  const pSortAccessor = useCallback((row: any, col: string): string | number | null => {
    switch (col) {
      case "name": return row.name;
      case "vendor": return row.vendor?.name || "";
      case "shipmentStatus": return row.shipmentStatus || "";
      case "shippingLine": return row.shippingLine || "";
      case "blNumber": return row.blNumber || "";
      case "vessel": return row.vesselName || "";
      case "loads": return row.pickingIds?.length || 0;
      case "amount": return row.amountTotal;
      default: return "";
    }
  }, []);
  const { sorted: sortedPs, sort: pSort, toggleSort: pToggle } = useTableSort(filteredPs, pSortAccessor);

  // Sales table sorting
  const sSortAccessor = useCallback((row: any, col: string): string | number | null => {
    switch (col) {
      case "name": return row.name;
      case "customer": return row.customer?.name || "";
      case "shipmentStatus": return row.shipmentStatus || "";
      case "shippingLine": return row.shippingLine || "";
      case "blNumber": return row.blNumber || "";
      case "vessel": return row.vesselName || "";
      case "loads": return row.numberOfLoads || 0;
      case "amount": return row.amountTotal;
      default: return "";
    }
  }, []);
  const { sorted: sortedSs, sort: sSort, toggleSort: sToggle } = useTableSort(filteredSs, sSortAccessor);

  // KPI + pipeline — memoised so array work only reruns when ps/ss change
  const {
    activeP, activeS, totalLoads, totalDeliveries,
    PIPELINE, totalAll, preCount, activeCount, postCount,
  } = useMemo(() => {
    const activeP = ps.filter(s => s.state !== "cancel" && s.state !== "done");
    const activeS = ss.filter(s => s.state !== "cancel" && s.state !== "done");
    const totalLoads = ps.reduce((sum, s) => sum + (s.pickingIds?.length || 0), 0);
    const totalDeliveries = ss.reduce((sum, s) => sum + (s.pickingIds?.length || 0), 0);

    const STAGE_GROUPS: Record<string, "pre" | "active" | "transit" | "post"> = {
      "Planned": "pre", "Booked": "pre",
      "Loading": "active", "Loaded": "active",
      "In Transit": "transit", "Arrived at Port": "transit",
      "Customs Clearance": "active", "Delivering": "active",
      "Delivered": "post", "Returned": "post",
    };

    const PIPELINE = UNIFIED_STAGES.map(stage => {
      const pc = ps.filter(s => (s.shipmentStatus || "") === stage.id).length;
      const sc = ss.filter(s => (s.shipmentStatus || "") === stage.id).length;
      return { id: stage.id, label: stage.label, pc, sc, group: STAGE_GROUPS[stage.id] || "pre" };
    });

    const notSetPc = ps.filter(s => !s.shipmentStatus).length;
    const notSetSc = ss.filter(s => !s.shipmentStatus).length;
    if (notSetPc + notSetSc > 0) {
      PIPELINE.push({ id: "Not Set", label: "Not Set", pc: notSetPc, sc: notSetSc, group: "pre" });
    }

    const totalAll = ps.length + ss.length;
    const preCount = PIPELINE.filter(p => p.group === "pre").reduce((s, p) => s + p.pc + p.sc, 0);
    const activeCount = PIPELINE.filter(p => p.group === "active" || p.group === "transit").reduce((s, p) => s + p.pc + p.sc, 0);
    const postCount = PIPELINE.filter(p => p.group === "post").reduce((s, p) => s + p.pc + p.sc, 0);
    return { activeP, activeS, totalLoads, totalDeliveries, PIPELINE, totalAll, preCount, activeCount, postCount };
  }, [ps, ss]);

  const segColor = (g: string) => ({ pre: C.muted, active: C.terra, transit: C.blue, post: C.forest }[g] || C.border);

  // Alerts — shipments with missing shipment status or key fields
  const { data: docAlertHistory } = trpc.documents.getAlertHistory.useQuery({ limit: 1 });
  const latestDocAlert = docAlertHistory?.[0];

  const displayAlerts = useMemo(() => {
    const alerts: { id: number; name: string; type: "purchase" | "sales"; issue: string }[] = [];
    ps.forEach(sh => {
      if (sh.state === "purchase" && !sh.shipmentStatus) {
        alerts.push({ id: sh.id, name: sh.name, type: "purchase", issue: "Missing shipment status" });
      }
      if (sh.state === "purchase" && !sh.vesselName) {
        alerts.push({ id: sh.id, name: sh.name, type: "purchase", issue: "No vessel assigned" });
      }
    });
    ss.forEach(sh => {
      if (sh.state === "sale" && !sh.shipmentStatus) {
        alerts.push({ id: sh.id, name: sh.name, type: "sales", issue: "Missing shipment status" });
      }
      if (sh.state === "sale" && !sh.productCategory) {
        alerts.push({ id: sh.id, name: sh.name, type: "sales", issue: "No product category" });
      }
    });
    if (latestDocAlert && latestDocAlert.shipmentCount > 0) {
      alerts.push({
        id: -1,
        name: `${latestDocAlert.shipmentCount} shipment(s)`,
        type: "purchase",
        issue: `Missing critical documents (${latestDocAlert.alertDate})`,
      });
    }
    return alerts.slice(0, 10);
  }, [ps, ss, latestDocAlert]);


  const inputStyle: React.CSSProperties = {
    padding: "6px 10px", fontSize: 11, fontFamily: FONT,
    border: `1px solid ${C.border}`, borderRadius: 5,
    background: C.card, color: C.dark, outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {isError && !isLoading && <InlineError message="Failed to load shipment data. Please refresh the page." />}
      {/* Search & Date Filters */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        padding: "10px 14px", background: C.gBg, border: `1px solid ${C.gBdr}`,
        borderRadius: 8,
      }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 180 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: C.muted, pointerEvents: "none" }}>{loadSearching ? "⏳" : "🔍"}</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by PO/SO, vendor, customer, BL, vessel, shipping line, POL, POD, product, container #, truck load..."
            style={{ ...inputStyle, width: "100%", paddingLeft: 30 }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>From</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inputStyle, width: 130 }} />
          <span style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>To</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inputStyle, width: 130 }} />
        </div>
        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setStageFilter(null); }}
            style={{
              padding: "5px 12px", fontSize: 10, fontWeight: 600, fontFamily: FONT,
              background: "transparent", border: `1px solid ${C.border}`, borderRadius: 5,
              color: C.muted, cursor: "pointer",
            }}
          >Clear</button>
        )}
        {hasFilters && (
          <span style={{ fontSize: 10, color: C.sage, fontWeight: 600 }}>
            {filteredPs.length} PO · {filteredSs.length} SO matched
          </span>
        )}
        <button
          onClick={() => {
            const pCols: ExcelColumn<any>[] = [
              { header: "PO Number", value: (r: any) => r.name },
              { header: "Vendor", value: (r: any) => r.vendor?.name || "" },
              { header: "Shipment Status", value: (r: any) => r.shipmentStatus || "" },
              { header: "Shipping Line", value: (r: any) => (r.shippingLine || "").toUpperCase() },
              { header: "BL #", value: (r: any) => r.blNumber || "" },
              { header: "Vessel", value: (r: any) => r.vesselName || "" },
              { header: "Loads", value: (r: any) => r.pickingIds?.length || 0 },
              { header: "Currency", value: (r: any) => r.currency?.name || "" },
              { header: "Amount", value: (r: any) => r.amountTotal || 0 },
            ];
            const sCols: ExcelColumn<any>[] = [
              { header: "SO Number", value: (r: any) => r.name },
              { header: "Customer", value: (r: any) => r.customer?.name || "" },
              { header: "Shipment Status", value: (r: any) => r.shipmentStatus || "" },
              { header: "Shipping Line", value: (r: any) => (r.shippingLine || "").toUpperCase() },
              { header: "BL #", value: (r: any) => r.blNumber || "" },
              { header: "Vessel", value: (r: any) => r.vesselName || "" },
              { header: "Loads", value: (r: any) => r.numberOfLoads || 0 },
              { header: "Currency", value: (r: any) => r.currency?.name || "" },
              { header: "Amount", value: (r: any) => r.amountTotal || 0 },
            ];
            exportToExcel(filteredPs, pCols, "Dashboard_Purchase");
            if (filteredSs.length > 0) exportToExcel(filteredSs, sCols, "Dashboard_Sales");
          }}
          style={{
            padding: "5px 12px", fontSize: 10, fontWeight: 600, fontFamily: FONT,
            background: C.forest, border: `1px solid ${C.forest}`, borderRadius: 5,
            color: C.white, cursor: "pointer", flexShrink: 0,
          }}
        >Export ↓</button>
      </div>

      {/* KPI Row */}
      <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 9 }}>
        {[
          { l: "Purchase Orders", v: activeP.length, s: `${pCount || ps.length} total`, a: true },
          { l: "Sales Orders", v: activeS.length, s: `${sCount || ss.length} total` },
          { l: "Total Loads", v: totalLoads, s: `${totalDeliveries} deliveries`, a: true },
          ...(perms.see("financials") ? [
            { l: "Purchase Value", v: `${ps[0]?.currency?.name || ""} ${Math.round(activeP.reduce((s, sh) => s + sh.amountTotal, 0)).toLocaleString()}` },
            { l: "Sales Value", v: `${ss[0]?.currency?.name || ""} ${Math.round(activeS.reduce((s, sh) => s + sh.amountTotal, 0)).toLocaleString()}`, a: true },
          ] : []),
        ].map(m => (
          <div key={m.l} style={{ background: m.a ? C.gBg2 : C.gBg, border: `1px solid ${m.a ? C.gBdr2 : C.gBdr}`, borderRadius: 7, padding: "10px 12px" }}>
            <div style={{ fontSize: 8.5, color: C.light, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>{m.l}</div>
            {isLoading ? (
              <>
                <ShimmerBox width={80} height={20} style={{ marginTop: 4, marginBottom: 4 }} />
                <ShimmerBox width={50} height={9} style={{ marginTop: 4 }} />
              </>
            ) : (
              <>
                <div style={{ fontSize: 18, fontWeight: 700, color: m.a ? C.forest : C.dark, fontFamily: MONO }}>{m.v}</div>
                {m.s && <div style={{ fontSize: 9, color: C.light, marginTop: 2 }}>{m.s}</div>}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Alerts + Pipeline */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 10 }}>
        <Card p={0}>
          <CardHdr>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13 }}>⚠</span>
              <CHT>Alerts</CHT>
            </div>
            <Badge v={displayAlerts.length > 0 ? "terra" : "green"}>{displayAlerts.length}</Badge>
          </CardHdr>
          <div style={{ padding: displayAlerts.length > 0 ? 8 : 16, maxHeight: 200, overflowY: "auto" }}>
            {isLoading ? (
              <AlertSkeleton count={4} />
            ) : displayAlerts.length === 0 ? (
              <div style={{ textAlign: "center", color: C.muted, fontSize: 11 }}>No alerts — all clear</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {displayAlerts.map((a, i) => (
                  <div key={`${a.type}-${a.id}-${i}`}
                    onClick={() => a.type === "purchase" ? onNavPurchaseDetail(a.id) : onNavSalesDetail(a.id)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: C.tBg, border: `1px solid ${C.tBdr}`, borderRadius: 6, cursor: "pointer", transition: "transform .1s", flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateX(2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
                  >
                    <span style={{ fontSize: 12 }}>{a.type === "purchase" ? "📦" : "📤"}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 11, color: C.terra, fontWeight: 600 }}>{a.name}: </span>
                      <span style={{ fontSize: 11, color: C.dark }}>{a.issue}</span>
                    </div>
                    <span style={{ fontSize: 11, color: C.muted }}>›</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card p={0}>
          <CardHdr>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.sage, display: "inline-block" }} />
              <CHT>Pipeline Stages</CHT>
            </div>
            <CHB>{totalAll} total</CHB>
          </CardHdr>
          <div style={{ padding: "16px 14px 8px" }}>
            {isLoading ? (
              <PipelineSkeleton />
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "flex-start", position: "relative", overflowX: "auto" }}>
                  {PIPELINE.filter(p => p.pc + p.sc > 0).map((ps, i, arr) => {
                    const total = ps.pc + ps.sc;
                    const circleColor = segColor(ps.group);
                    const circleSize = 34;
                    return (
                      <div key={ps.id} style={{ display: "flex", alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                          <div style={{ width: circleSize, height: circleSize, borderRadius: "50%", background: circleColor, border: `2.5px solid ${circleColor}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 2, boxShadow: `0 2px 6px ${circleColor}33` }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.white, fontFamily: MONO }}>{total}</span>
                          </div>
                          <div style={{ fontSize: 7.5, color: C.sage, fontFamily: MONO, marginTop: 3, fontWeight: 600, whiteSpace: "nowrap" }}>P:{ps.pc} S:{ps.sc}</div>
                          <div style={{ fontSize: 8, color: C.dark, fontWeight: 600, marginTop: 2, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{ps.label}</div>
                        </div>
                        {i < arr.length - 1 && (
                          <div style={{ flex: 1, height: 3, minWidth: 4, marginTop: circleSize / 2 - 1, background: `linear-gradient(90deg, ${segColor(ps.group)}, ${segColor(arr[i + 1].group)})`, borderRadius: 2, position: "relative", zIndex: 1 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Clickable stage chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                  {PIPELINE.filter(p => p.pc + p.sc > 0).map(p => {
                    const isActive = stageFilter === p.id;
                    const chipColor = segColor(p.group);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setStageFilter(isActive ? null : p.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 4,
                          padding: "3px 8px", borderRadius: 12, cursor: "pointer",
                          fontSize: 9, fontWeight: 600, fontFamily: FONT,
                          background: isActive ? chipColor : `${chipColor}18`,
                          color: isActive ? C.white : chipColor,
                          border: `1px solid ${isActive ? chipColor : `${chipColor}40`}`,
                          transition: "all .15s",
                        }}
                      >
                        <span style={{ fontFamily: MONO, fontWeight: 700 }}>{p.pc + p.sc}</span>
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 20 }}>
                    {[{ l: "Pre-Shipment", v: preCount, c: C.muted }, { l: "In Progress", v: activeCount, c: C.terra }, { l: "Completed", v: postCount, c: C.forest }].map(g => (
                      <div key={g.l}>
                        <div style={{ fontSize: 8.5, color: g.c, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{g.l}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: MONO, color: g.c }}>{g.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {perms.canAccess("purchase") && <Btn onClick={() => onNavPage("purchase")} outline small>Purchase →</Btn>}
                    {perms.canAccess("sales") && <Btn onClick={() => onNavPage("sales")} color={C.terra} outline small>Sales →</Btn>}
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>



      {/* Hard Copy Summary Widget */}
      <Card p={0}>
        <CardHdr>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13 }}>📋</span>
            <CHT>Missing Documents</CHT>
          </div>
          <CHB>En-Route Shipments</CHB>
        </CardHdr>
        <HardCopySummaryWidget companyId={companyId} onNavPurchaseDetail={onNavPurchaseDetail} onNavSalesDetail={onNavSalesDetail} />
      </Card>

      {/* Recent Purchase Shipments */}
      <Section title={hasFilters ? `Purchase Shipments (${filteredPs.length})` : "Recent Purchase Shipments"} right={<Btn onClick={() => onNavPage("purchase")} color={C.gray} outline small>All →</Btn>}>
        <Card p={0}>
          <div className="mob-table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <SortTh column="name" sticky currentColumn={pSort.column} currentDirection={pSort.direction} onSort={pToggle}>PO Number</SortTh>
              <SortTh column="vendor" currentColumn={pSort.column} currentDirection={pSort.direction} onSort={pToggle}>Vendor</SortTh>
              <SortTh column="shipmentStatus" currentColumn={pSort.column} currentDirection={pSort.direction} onSort={pToggle}>Shipment Status</SortTh>
              <SortTh column="shippingLine" currentColumn={pSort.column} currentDirection={pSort.direction} onSort={pToggle}>Shipping Line</SortTh>
              <SortTh column="blNumber" currentColumn={pSort.column} currentDirection={pSort.direction} onSort={pToggle}>BL #</SortTh>
              <SortTh column="vessel" currentColumn={pSort.column} currentDirection={pSort.direction} onSort={pToggle}>Vessel</SortTh>
              <SortTh column="loads" currentColumn={pSort.column} currentDirection={pSort.direction} onSort={pToggle}>Loads</SortTh>
              <SortTh column="amount" currentColumn={pSort.column} currentDirection={pSort.direction} onSort={pToggle} right>Amount</SortTh>
            </tr></thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton rows={5} cols={8} />
              ) : sortedPs.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 11 }}>{hasFilters ? "No matching purchase orders" : "No purchase orders found"}</td></tr>
              ) : (
                sortedPs.slice(0, hasFilters ? 20 : 5).map((sh, i) => (
                  <tr key={sh.id} style={{ cursor: "pointer", background: i % 2 ? C.gBg : C.card }}
                    onClick={() => onNavPurchaseDetail(sh.id)}
                    onMouseEnter={e => e.currentTarget.style.background = C.gBg2}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 ? C.gBg : C.card}
                  >
                    <Td accent mono sticky bg={i % 2 ? C.gBg : C.card}>{hl(sh.name, search)}</Td>
                    <Td>{hl(sh.vendor?.name || "\u2014", search)}</Td>
                    <Td>{sh.shipmentStatus ? <SBdg id={sh.shipmentStatus} type="purchase" /> : <span style={{ color: C.muted, fontSize: 9 }}>Not Set</span>}</Td>
                    <Td>{hl(sh.shippingLine?.toUpperCase() || "\u2014", search)}</Td>
                    <Td mono>{hl(sh.blNumber || "\u2014", search)}</Td>
                    <Td>{hl(sh.vesselName || "\u2014", search)}</Td>
                    <Td mono>{sh.pickingIds?.length || 0}</Td>
                    <Td right mono>{sh.currency?.name || ""} {fmt(sh.amountTotal)}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </Card>
      </Section>

      {/* Recent Sales Shipments */}
      {perms.canAccess("sales") && (
        <Section title={hasFilters ? `Sales Shipments (${filteredSs.length})` : "Recent Sales Shipments"} right={<Btn onClick={() => onNavPage("sales")} color={C.gray} outline small>All →</Btn>}>
          <Card p={0}>
            <div className="mob-table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <SortTh column="name" sticky currentColumn={sSort.column} currentDirection={sSort.direction} onSort={sToggle}>SO Number</SortTh>
                <SortTh column="customer" currentColumn={sSort.column} currentDirection={sSort.direction} onSort={sToggle}>Customer</SortTh>
                <SortTh column="shipmentStatus" currentColumn={sSort.column} currentDirection={sSort.direction} onSort={sToggle}>Shipment Status</SortTh>
                <SortTh column="shippingLine" currentColumn={sSort.column} currentDirection={sSort.direction} onSort={sToggle}>Shipping Line</SortTh>
                <SortTh column="blNumber" currentColumn={sSort.column} currentDirection={sSort.direction} onSort={sToggle}>BL #</SortTh>
                <SortTh column="vessel" currentColumn={sSort.column} currentDirection={sSort.direction} onSort={sToggle}>Vessel</SortTh>
                <SortTh column="loads" currentColumn={sSort.column} currentDirection={sSort.direction} onSort={sToggle}>Loads</SortTh>
                <SortTh column="amount" currentColumn={sSort.column} currentDirection={sSort.direction} onSort={sToggle} right>Amount</SortTh>
              </tr></thead>
              <tbody>
                {isLoading ? (
                  <TableSkeleton rows={5} cols={8} />
                ) : sortedSs.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 11 }}>{hasFilters ? "No matching sales orders" : "No sales orders found"}</td></tr>
                ) : (
                  sortedSs.slice(0, hasFilters ? 20 : 5).map((sh, i) => (
                    <tr key={sh.id} style={{ cursor: "pointer", background: i % 2 ? C.gBg : C.card }}
                      onClick={() => onNavSalesDetail(sh.id)}
                      onMouseEnter={e => e.currentTarget.style.background = C.gBg2}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 ? C.gBg : C.card}
                    >
                      <Td accent mono sticky bg={i % 2 ? C.gBg : C.card}>{hl(sh.name, search)}</Td>
                      <Td>{hl(sh.customer?.name || "\u2014", search)}</Td>
                      <Td>{sh.shipmentStatus ? <SBdg id={sh.shipmentStatus} type="sales" /> : <span style={{ color: C.muted, fontSize: 9 }}>Not Set</span>}</Td>
                      <Td>{hl(sh.shippingLine?.toUpperCase() || "\u2014", search)}</Td>
                      <Td mono>{hl(sh.blNumber || "\u2014", search)}</Td>
                      <Td>{hl(sh.vesselName || "\u2014", search)}</Td>
                      <Td mono>{sh.numberOfLoads || 0}</Td>
                      <Td right mono>{sh.currency?.name || ""} {fmt(sh.amountTotal)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table></div>
          </Card>
        </Section>
      )}
    </div>
  );
}

// ── Missing Documents Widget (Hard Copy + Soft Copy) ───────────────────
function HardCopySummaryWidget({
  companyId,
  onNavPurchaseDetail,
}: {
  companyId: number | undefined;
  onNavPurchaseDetail: (id: number) => void;
  onNavSalesDetail: (id: number) => void;
}) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.documents.getHardCopySummary.useQuery(
    companyId ? { companyId } : undefined
  );
  const toggleHardCopyMut = trpc.documents.toggleHardCopy.useMutation({
    onMutate: async (input) => {
      await utils.documents.getHardCopySummary.cancel();
      const prev = utils.documents.getHardCopySummary.getData();
      if (prev) {
        const updated = {
          ...prev,
          purchase: {
            ...prev.purchase,
            shipments: prev.purchase.shipments.map((sh: any) => {
              if (sh.id !== input.odooOrderId) return sh;
              const newDocs = (sh.docs || []).map((d: any) =>
                d.field === input.documentField ? { ...d, hardCopy: input.received } : d
              );
              const hardRcv = newDocs.filter((d: any) => d.hardCopy).length;
              return {
                ...sh,
                docs: newDocs,
                hardReceived: hardRcv,
                hardMissing: sh.docsTotal - hardRcv,
                hardComplete: hardRcv === sh.docsTotal,
                totalMissing: newDocs.filter((d: any) => !d.hardCopy || !d.softCopy).length,
                totalComplete: newDocs.every((d: any) => d.hardCopy && d.softCopy),
              };
            }),
          },
        };
        // Recalculate summary counts
        updated.purchase.missing = updated.purchase.shipments.filter((s: any) => !s.hardComplete).length;
        updated.purchase.totalMissing = updated.purchase.shipments.filter((s: any) => !s.totalComplete).length;
        utils.documents.getHardCopySummary.setData(undefined, updated as any);
      }
      return { prev };
    },
    onError: (_err, _input, context) => {
      if (context?.prev) utils.documents.getHardCopySummary.setData(undefined, context.prev);
    },
    onSettled: () => { utils.documents.getHardCopySummary.invalidate(); },
  });
  const toggleTelexMut = trpc.documents.toggleTelexBLIssued.useMutation({
    onMutate: async (input) => {
      await utils.documents.getHardCopySummary.cancel();
      const prev = utils.documents.getHardCopySummary.getData();
      if (prev) {
        const updated = {
          ...prev,
          purchase: {
            ...prev.purchase,
            shipments: prev.purchase.shipments.map((sh: any) =>
              sh.id === input.orderId ? { ...sh, telexBLIssued: input.issued } : sh
            ),
          },
        };
        utils.documents.getHardCopySummary.setData(undefined, updated as any);
      }
      return { prev };
    },
    onError: (_err, _input, context) => {
      if (context?.prev) utils.documents.getHardCopySummary.setData(undefined, context.prev);
    },
    onSettled: () => { utils.documents.getHardCopySummary.invalidate(); },
  });
  const [showDetail, setShowDetail] = useState(false);
  const [expandedShipId, setExpandedShipId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div style={{ padding: 16 }}>
        <ShimmerBox width="100%" height={120} />
      </div>
    );
  }

  if (!data || !data.purchase) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 11 }}>
        No data available
      </div>
    );
  }

  const poEnRoute = data.purchase.enRoute ?? 0;
  const poHardMissing = data.purchase.missing ?? 0;
  const poSoftMissing = data.purchase.softMissing ?? 0;
  const poTotalMissing = data.purchase.totalMissing ?? 0;

  const urgencyColor = (missing: number, total: number) => {
    if (total === 0) return C.forest;
    const missingPct = (missing / total) * 100;
    return missingPct === 0 ? C.forest : missingPct <= 30 ? C.amber : C.terra;
  };

  // Sort: most missing first
  const poShipments = [...data.purchase.shipments].sort((a, b) => {
    if (a.totalComplete !== b.totalComplete) return a.totalComplete ? 1 : -1;
    return b.totalMissing - a.totalMissing;
  });
  const poIncomplete = poShipments.filter(sh => !sh.totalComplete);

  // Checkmark icon
  const Tick = () => (
    <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <div style={{ padding: 14 }}>
      {/* Summary Row: Total | Hard Copy | Soft Copy */}
      <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        {/* Total Missing (any doc where either hard or soft is missing) */}
        <div style={{
          background: poTotalMissing > 0 ? C.rBg : C.gBg2,
          border: `1px solid ${poTotalMissing > 0 ? C.rBdr : C.gBdr2}`,
          borderRadius: 8, padding: "12px 14px", textAlign: "center",
          cursor: "pointer",
        }} onClick={() => setShowDetail(!showDetail)}>
          <div style={{ fontSize: 8.5, color: C.light, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Total Missing
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: MONO, color: urgencyColor(poTotalMissing, poEnRoute) }}>
            {poTotalMissing}
          </div>
          <div style={{ fontSize: 9, color: C.gray, marginTop: 2 }}>
            of {poEnRoute} en-route POs
          </div>
          <div style={{ marginTop: 6 }}>
            <Bar v={poEnRoute - poTotalMissing} max={poEnRoute} color={urgencyColor(poTotalMissing, poEnRoute)} />
          </div>
          <span style={{ fontSize: 9, color: C.muted, transform: showDetail ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s", display: "inline-block", marginTop: 4 }}>▼</span>
        </div>

        {/* Hard Copies Missing */}
        <div style={{
          background: C.gBg, border: `1px solid ${C.gBdr}`, borderRadius: 8, padding: "12px 14px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 8.5, color: C.light, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Hard Copies
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: MONO, color: urgencyColor(poHardMissing, poEnRoute), marginTop: 4 }}>
            {poHardMissing}
          </div>
          <div style={{ fontSize: 9, color: C.gray, marginTop: 2 }}>
            {poHardMissing === 0 ? "All received" : `${poHardMissing} POs missing`}
          </div>
          <div style={{ marginTop: 6 }}>
            <Bar v={poEnRoute - poHardMissing} max={poEnRoute} color={C.forest} />
          </div>
        </div>

        {/* Soft Copies Missing */}
        <div style={{
          background: C.tBg, border: `1px solid ${C.tBdr}`, borderRadius: 8, padding: "12px 14px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 8.5, color: C.light, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Soft Copies
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: MONO, color: urgencyColor(poSoftMissing, poEnRoute), marginTop: 4 }}>
            {poSoftMissing}
          </div>
          <div style={{ fontSize: 9, color: C.gray, marginTop: 2 }}>
            {poSoftMissing === 0 ? "All uploaded" : `${poSoftMissing} POs missing`}
          </div>
          <div style={{ marginTop: 6 }}>
            <Bar v={poEnRoute - poSoftMissing} max={poEnRoute} color={C.terra} />
          </div>
        </div>
      </div>

      {/* Stages legend */}
      <div style={{ fontSize: 9, color: C.muted, marginBottom: 10, textAlign: "center" }}>
        En-Route = Loaded, In Transit, Arrived at Port &nbsp;|&nbsp; Purchase Orders Only
      </div>

      {/* PO Detail Breakdown */}
      {showDetail && poIncomplete.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.forest, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Missing Documents ({poIncomplete.length} POs)
          </div>
          <div style={{ maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {poIncomplete.map(sh => {
              const isExpanded = expandedShipId === sh.id;
              return (
                <div key={sh.id} style={{ display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "6px 10px", background: C.gBg, border: `1px solid ${C.gBdr}`,
                      borderRadius: isExpanded ? "6px 6px 0 0" : 6, cursor: "pointer", transition: "transform .1s",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedShipId(isExpanded ? null : sh.id);
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.gBg2; }}
                    onMouseLeave={e => { e.currentTarget.style.background = C.gBg; }}
                  >
                    <span style={{ fontSize: 9, color: C.muted, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}>▼</span>
                    <span style={{ fontSize: 11, fontWeight: 600, fontFamily: MONO, color: C.forest, minWidth: 120 }}>{sh.name}</span>
                    <Badge v={sh.status === "In Transit" ? "blue" : sh.status === "Arrived at Port" ? "amber" : "default"}>
                      {sh.status}
                    </Badge>
                    <div style={{ flex: 1, display: "flex", gap: 4, alignItems: "center" }}>
                      <span style={{ fontSize: 8, color: C.muted, whiteSpace: "nowrap" }}>H:</span>
                      <div style={{ flex: 1 }}><Bar v={sh.hardReceived} max={sh.docsTotal} color={C.forest} /></div>
                      <span style={{ fontSize: 8, color: C.muted, whiteSpace: "nowrap" }}>S:</span>
                      <div style={{ flex: 1 }}><Bar v={sh.softReceived} max={sh.docsTotal} color={C.terra} /></div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, color: C.terra, minWidth: 70, textAlign: "right" }}>
                      {sh.totalMissing} missing
                    </span>
                    <span
                      style={{ fontSize: 9, color: C.forest, cursor: "pointer", padding: "2px 4px" }}
                      title="View Shipment"
                      onClick={(e) => { e.stopPropagation(); onNavPurchaseDetail(sh.id); }}
                    >View →</span>
                  </div>
                  {isExpanded && (
                    <div style={{
                      background: C.card, border: `1px solid ${C.gBdr}`, borderTop: "none",
                      borderRadius: "0 0 6px 6px", padding: "8px 12px",
                    }}>
                      {/* Telex Release / BL Issued toggle */}
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                        padding: "6px 10px", background: sh.telexBLIssued ? C.gBg2 : C.rBg,
                        border: `1px solid ${sh.telexBLIssued ? C.gBdr2 : C.rBdr}`,
                        borderRadius: 6, cursor: "pointer", transition: "all .15s",
                      }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTelexMut.mutate({ orderId: sh.id, orderType: "purchase", issued: !sh.telexBLIssued });
                        }}
                      >
                        <div style={{
                          width: 16, height: 16, borderRadius: 4,
                          border: `2px solid ${sh.telexBLIssued ? C.forest : C.terra}`,
                          background: sh.telexBLIssued ? C.forest : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all .15s", flexShrink: 0,
                        }}>
                          {sh.telexBLIssued && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: sh.telexBLIssued ? C.forest : C.terra }}>
                            Telex Release / BL Issued
                          </div>
                          <div style={{ fontSize: 8, color: C.muted }}>
                            {sh.telexBLIssued ? "Issued — click to unmark" : "Not issued — click to mark as issued"}
                          </div>
                        </div>
                        {toggleTelexMut.isPending && (
                          <span style={{ fontSize: 8, color: C.muted, marginLeft: "auto" }}>Saving...</span>
                        )}
                      </div>
                      {/* Clearance Documents — Hard + Soft status per doc */}
                      <div style={{ fontSize: 9, fontWeight: 700, color: C.light, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                        Clearance Documents
                      </div>
                      {/* Column headers */}
                      <div style={{ display: "flex", gap: 8, padding: "0 10px 4px", borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
                        <span style={{ flex: 1, fontSize: 8, fontWeight: 700, color: C.muted, textTransform: "uppercase" }}>Document</span>
                        <span style={{ width: 70, fontSize: 8, fontWeight: 700, color: C.muted, textTransform: "uppercase", textAlign: "center" }}>Soft Copy</span>
                        <span style={{ width: 70, fontSize: 8, fontWeight: 700, color: C.muted, textTransform: "uppercase", textAlign: "center" }}>Hard Copy</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {(sh.docs || []).map((doc) => (
                          <div
                            key={doc.field}
                            style={{
                              display: "flex", alignItems: "center", gap: 8,
                              padding: "5px 10px", borderRadius: 5,
                              background: (doc.hardCopy && doc.softCopy) ? C.gBg2 : (!doc.hardCopy && !doc.softCopy) ? C.rBg : '#fef9ef',
                              border: `1px solid ${(doc.hardCopy && doc.softCopy) ? C.gBdr2 : (!doc.hardCopy && !doc.softCopy) ? C.rBdr : '#e8d5a0'}`,
                            }}
                          >
                            {/* Document name */}
                            <span style={{
                              flex: 1, fontSize: 10, fontWeight: 500,
                              color: (doc.hardCopy && doc.softCopy) ? C.forest : C.dark,
                              textDecoration: (doc.hardCopy && doc.softCopy) ? "line-through" : "none",
                            }}>{doc.label}</span>
                            {/* Soft copy indicator (read-only, from Odoo) */}
                            <div style={{ width: 70, display: "flex", justifyContent: "center" }}>
                              <div style={{
                                width: 18, height: 18, borderRadius: 4,
                                border: `2px solid ${doc.softCopy ? C.forest : C.terra}`,
                                background: doc.softCopy ? C.forest : "transparent",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                opacity: 0.9,
                              }}>
                                {doc.softCopy && <Tick />}
                              </div>
                            </div>
                            {/* Hard copy toggle (clickable) */}
                            <div style={{ width: 70, display: "flex", justifyContent: "center" }}>
                              <div
                                style={{
                                  width: 18, height: 18, borderRadius: 4,
                                  border: `2px solid ${doc.hardCopy ? C.forest : C.terra}`,
                                  background: doc.hardCopy ? C.forest : "transparent",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  cursor: "pointer", transition: "all .15s",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleHardCopyMut.mutate({
                                    odooOrderId: sh.id,
                                    orderType: "purchase",
                                    documentField: doc.field,
                                    received: !doc.hardCopy,
                                  });
                                }}
                              >
                                {doc.hardCopy && <Tick />}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {showDetail && poIncomplete.length === 0 && (
        <div style={{ marginBottom: 12, padding: "10px 14px", background: C.gBg, borderRadius: 6, fontSize: 11, color: C.forest, textAlign: "center" }}>
          All en-route purchase shipments have complete documents (hard + soft copies)
        </div>
      )}
    </div>
  );
}
