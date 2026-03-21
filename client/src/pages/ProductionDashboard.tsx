// ══════════════════════════════════════════════════════════════════════════════
// PRODUCTION DASHBOARD — Double Press Production Module
// KPIs, pipeline, alerts, recent MOs — live Odoo data via tRPC
// Search bar + date range + export matching Purchase/Sales Dashboard pattern
// ══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState, useCallback } from "react";
import { C, FONT, MONO, fmt } from "@/lib/data";
import { Badge, Card, CardHdr, CHT, CHB, Btn, Th, Td, Section } from "@/components/ui-primitives";
import { trpc } from "@/lib/trpc";
import { TopProgressBar, StatCardSkeleton, PipelineSkeleton, TableSkeleton, AlertSkeleton } from "@/components/LoadingIndicators";
import { Highlight } from "@/components/SearchHighlight";
import { exportToExcel } from "@/lib/exportExcel";
import {
  MO_STATE_LABELS, MO_STATE_BADGE, MO_STATE_COLORS, MO_STAGES,
  fmtTons, fmtHours, fmtLiters, shortProduct, totalBales,
} from "@/lib/moStateLabels";
import { ProductionAnalytics } from "@/components/ProductionAnalytics";

interface Props {
  onNavDetail: (id: number) => void;
  onNavList: (stateFilter?: string) => void;
  onCreateNew: () => void;
  activeCompanyId?: string;
}

export function ProductionDashboard({ onNavDetail, onNavList, onCreateNew, activeCompanyId }: Props) {
  const { data: orders, isLoading, error } = trpc.production.list.useQuery(
    { limit: 500, offset: 0 },
    { staleTime: 30_000 }
  );

  // ─── Search & Date Range Filters (matching Dashboard pattern) ──────────
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);

  const hasFilters = search.trim() !== "" || dateFrom !== "" || dateTo !== "" || stageFilter !== null;

  // ─── Filter Logic — search by product, labor, supervisor, driver, etc ──
  const matchesSearch = useCallback((o: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const fields: (string | undefined | null)[] = [
      o.name,
      o.product?.name,
      o.inputSource,
      o.inputQualityGrade,
      o.company?.name,
      o.bom?.name,
      // Workforce fields — search by supervisor, labor, driver names
      ...(o.supervisors || []).map((e: any) => e.name),
      ...(o.productionLabors || []).map((e: any) => e.name),
      ...(o.qualityLabors || []).map((e: any) => e.name),
      ...(o.drivers || []).map((e: any) => e.name),
      ...(o.qualitySupervisors || []).map((e: any) => e.name),
      ...(o.loadingDrivers || []).map((e: any) => e.name),
      ...(o.labors || []).map((e: any) => e.name),
      // Input/Output product names
      ...(o.rawMaterials || []).map((m: any) => m.product?.name),
      ...(o.finishedProducts || []).map((m: any) => m.product?.name),
    ];
    return fields.some(f => f && String(f).toLowerCase().includes(q));
  }, [search]);

  const matchesDate = useCallback((o: any) => {
    if (!dateFrom && !dateTo) return true;
    const d = o.productionDate || o.dateStart;
    if (!d) return false;
    const orderDate = d.slice(0, 10);
    if (dateFrom && orderDate < dateFrom) return false;
    if (dateTo && orderDate > dateTo) return false;
    return true;
  }, [dateFrom, dateTo]);

  const matchesStage = useCallback((o: any) => {
    if (!stageFilter) return true;
    return o.state === stageFilter;
  }, [stageFilter]);

  const matchesCompany = useCallback((o: any) => {
    if (!activeCompanyId || activeCompanyId === "ALL") return true;
    return o.company?.id === Number(activeCompanyId);
  }, [activeCompanyId]);

  const filtered = useMemo(() => {
    if (!orders) return [];
    return orders.filter(o => matchesCompany(o) && matchesSearch(o) && matchesDate(o) && matchesStage(o));
  }, [orders, matchesCompany, matchesSearch, matchesDate, matchesStage]);

  // ─── Computed KPIs (from filtered data) ────────────────────────────────
  const kpis = useMemo(() => {
    if (!orders) return null;
    const active = filtered.filter(o => o.state !== "cancel");
    const done = active.filter(o => o.state === "done");
    const inProgress = active.filter(o => o.state === "progress");
    const confirmed = active.filter(o => o.state === "confirmed");

    const totalProducedKg = done.reduce((s, o) => s + (o.qtyProduced || 0), 0);
    const totalPlannedKg = active.reduce((s, o) => s + (o.productQty || 0), 0);
    // Input quantity = planned qty (raw material demand)
    const totalInputKg = active.reduce((s, o) => s + (o.productQty || 0), 0);
    // Output quantity = produced qty
    const totalOutputKg = done.reduce((s, o) => s + (o.qtyProduced || 0), 0);
    const totalBalesCount = done.reduce((s, o) => s + (o.totalBales || 0), 0);
    const totalDiesel = done.reduce((s, o) => s + (o.dieselLiters || 0), 0);
    const totalHours = done.reduce((s, o) => s + (o.actualHours || 0), 0);

    // Labors per shift: count unique labors (production + quality + general labors) per done order, then average
    let totalLabors = 0;
    let totalDrivers = 0;
    done.forEach(o => {
      const laborCount = (o.productionLabors?.length || 0) + (o.qualityLabors?.length || 0) + (o.labors?.length || 0);
      const driverCount = (o.drivers?.length || 0) + (o.loadingDrivers?.length || 0);
      totalLabors += laborCount;
      totalDrivers += driverCount;
    });
    const avgLaborsPerShift = done.length > 0 ? totalLabors / done.length : 0;
    const avgDriversPerShift = done.length > 0 ? totalDrivers / done.length : 0;

    return {
      totalOrders: active.length,
      doneCount: done.length,
      inProgressCount: inProgress.length,
      confirmedCount: confirmed.length,
      totalProducedKg,
      totalPlannedKg,
      totalInputKg,
      totalOutputKg,
      totalBalesCount,
      totalDiesel,
      totalHours,
      avgHoursPerShift: done.length > 0 ? (totalHours / done.length) : 0,
      avgDieselPerShift: done.length > 0 ? (totalDiesel / done.length) : 0,
      avgLaborsPerShift,
      avgDriversPerShift,
      totalLabors,
      totalDrivers,
    };
  }, [orders, filtered]);

  // ─── Pipeline ───────────────────────────────────────────────────────────
  const pipeline = useMemo(() => {
    if (!filtered) return [];
    return MO_STAGES.filter(s => s.id !== "cancel").map(stage => ({
      ...stage,
      count: filtered.filter(o => o.state === stage.id).length,
    }));
  }, [filtered]);

  const cancelCount = useMemo(() => {
    if (!filtered) return 0;
    return filtered.filter(o => o.state === "cancel").length;
  }, [filtered]);

  // ─── Alerts ────────────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    if (!filtered) return [];
    const a: { id: number; name: string; issue: string; severity: "warn" | "info" | "critical" }[] = [];
    filtered.forEach(o => {
      if (o.state !== "cancel" && o.equipmentFailure) {
        a.push({ id: o.id, name: o.name, issue: "Equipment failure reported", severity: "critical" });
      }
      if (o.state === "done" && o.dieselLiters && o.dieselLiters > 300) {
        a.push({ id: o.id, name: o.name, issue: `Abnormal diesel: ${o.dieselLiters.toFixed(0)}L (>300L threshold)`, severity: "warn" });
      }
      if (o.state === "done" && (!o.actualHours || o.actualHours === 0)) {
        a.push({ id: o.id, name: o.name, issue: "Missing machine hours report", severity: "warn" });
      }
      if ((o.state === "confirmed" || o.state === "progress") && !o.productionDate) {
        a.push({ id: o.id, name: o.name, issue: "No production date set", severity: "info" });
      }
      if (o.state === "done" && (!o.dieselLiters || o.dieselLiters === 0)) {
        a.push({ id: o.id, name: o.name, issue: "Missing diesel consumption data", severity: "warn" });
      }
      if (o.state === "done" && (!o.totalBales || o.totalBales === 0) && (o.qtyProduced || 0) > 0) {
        a.push({ id: o.id, name: o.name, issue: "No bales recorded despite production output", severity: "warn" });
      }
      if (o.incentiveCancelled) {
        a.push({ id: o.id, name: o.name, issue: "Incentive cancelled", severity: "info" });
      }
    });
    return a.slice(0, 15);
  }, [filtered]);

  const displayAlerts = alerts.slice(0, 10);

  // ─── Recent Orders (filtered by pipeline stage if selected) ───────────
  const recent = useMemo(() => {
    let list = [...filtered];
    if (stageFilter) {
      list = list.filter(o => o.state === stageFilter);
    }
    return list
      .sort((a, b) => (b.productionDate || b.dateStart || "").localeCompare(a.productionDate || a.dateStart || ""))
      .slice(0, 10);
  }, [filtered, stageFilter]);

  // ─── Export ────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (!filtered.length) return;
    exportToExcel(filtered, [
      { header: "MO #", value: (o) => o.name },
      { header: "Product", value: (o) => o.product?.name || "" },
      { header: "State", value: (o) => MO_STATE_LABELS[o.state] || o.state },
      { header: "Date", value: (o) => o.productionDate || o.dateStart?.slice(0, 10) || "" },
      { header: "Company", value: (o) => o.company?.name || "" },
      { header: "Source", value: (o) => o.inputSource || "" },
      { header: "Planned Qty (kg)", value: (o) => o.productQty || 0 },
      { header: "Produced (kg)", value: (o) => o.qtyProduced || 0 },
      { header: "Total Bales", value: (o) => o.totalBales || 0 },
      { header: "Hours", value: (o) => o.actualHours || 0 },
      { header: "Diesel (L)", value: (o) => o.dieselLiters || 0 },
      { header: "Quality Grade", value: (o) => o.inputQualityGrade || "" },
    ], "Double_Press_Production_Dashboard");
  }, [filtered]);

  // ─── Pipeline color helper ─────────────────────────────────────────────
  const segColor = (stageId: string) => MO_STATE_COLORS[stageId] || C.sage;

  const inputStyle: React.CSSProperties = {
    padding: "6px 10px", fontSize: 11, fontFamily: FONT,
    border: `1px solid ${C.border}`, borderRadius: 5,
    background: C.card, color: C.dark, outline: "none",
  };

  // ─── Loading State ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <TopProgressBar />
        <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 10 }}>
          <AlertSkeleton count={4} />
          <PipelineSkeleton />
        </div>
        <Card p={0}>
          <div className="mob-table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["MO #", "Product", "Status", "Date", "Source", "Produced", "Bales", "Avg Wt", "Hours", "Diesel", "Sleeves", "Labors", "Supv.", "Drivers", "Max Temp"].map((h, idx) => <Th key={h} sticky={idx === 0}>{h}</Th>)}</tr></thead>
            <tbody><TableSkeleton rows={6} cols={15} /></tbody>
          </table></div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div style={{ padding: 24, textAlign: "center", color: C.red, fontSize: 12 }}>
          Failed to load production data: {error.message}
        </div>
      </Card>
    );
  }

  if (!kpis) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ─── Search & Date Range Filters (matching Purchase/Sales Dashboard) ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        padding: "10px 14px", background: C.gBg, border: `1px solid ${C.gBdr}`,
        borderRadius: 8,
      }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 180 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: C.muted, pointerEvents: "none" }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by MO #, product, supervisor, labor, driver, company, quality grade..."
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
            {filtered.length} order{filtered.length !== 1 ? "s" : ""} matched
          </span>
        )}
        <button
          onClick={handleExport}
          style={{
            padding: "5px 12px", fontSize: 10, fontWeight: 600, fontFamily: FONT,
            background: C.forest, border: `1px solid ${C.forest}`, borderRadius: 5,
            color: C.white, cursor: "pointer", flexShrink: 0,
          }}
        >Export ↓</button>
      </div>

      {/* ─── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        {[
          { label: "TOTAL ORDERS", value: fmt(kpis.totalOrders), sub: `${kpis.doneCount} completed`, color: C.forest },
          { label: "INPUT QUANTITY", value: fmtTons(kpis.totalInputKg), sub: `planned across ${fmt(kpis.totalOrders)} orders`, color: C.sage },
          { label: "OUTPUT QUANTITY", value: fmtTons(kpis.totalOutputKg), sub: `${kpis.totalOutputKg > 0 && kpis.totalInputKg > 0 ? ((kpis.totalOutputKg / kpis.totalInputKg) * 100).toFixed(1) : 0}% yield`, color: C.forest },
          { label: "PRODUCTION HOURS", value: fmtHours(kpis.totalHours), sub: `avg ${kpis.avgHoursPerShift.toFixed(1)} h/shift`, color: C.blue },
          { label: "LABORS / SHIFT", value: kpis.avgLaborsPerShift.toFixed(1), sub: `${fmt(kpis.totalLabors)} total across ${kpis.doneCount} shifts`, color: C.terra },
          { label: "DRIVERS / SHIFT", value: kpis.avgDriversPerShift.toFixed(1), sub: `${fmt(kpis.totalDrivers)} total across ${kpis.doneCount} shifts`, color: C.amber },
        ].map((kpi, i) => (
          <Card key={i}>
            <div style={{ fontSize: 8, fontWeight: 700, color: C.sage, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: MONO, color: kpi.color, lineHeight: 1.1 }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{kpi.sub}</div>
          </Card>
        ))}
      </div>

      {/* ─── Alerts + Pipeline (side by side) ─────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 10 }}>
        {/* Alerts Card */}
        <Card p={0}>
          <CardHdr>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13 }}>⚠</span>
              <CHT>Alerts</CHT>
            </div>
            <Badge v={displayAlerts.length > 0 ? "terra" : "green"}>{displayAlerts.length}</Badge>
          </CardHdr>
          <div style={{ padding: displayAlerts.length > 0 ? 8 : 16, maxHeight: 200, overflowY: "auto" }}>
            {displayAlerts.length === 0 ? (
              <div style={{ textAlign: "center", color: C.muted, fontSize: 11 }}>No alerts — all clear</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {displayAlerts.map((a, i) => (
                  <div key={`${a.id}-${i}`}
                    onClick={() => onNavDetail(a.id)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: C.tBg, border: `1px solid ${C.tBdr}`, borderRadius: 6, cursor: "pointer", transition: "transform .1s", flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateX(2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
                  >
                    <span style={{ fontSize: 12 }}>
                      {a.severity === "critical" ? "🔴" : a.severity === "warn" ? "🟠" : "🔵"}
                    </span>
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

        {/* Pipeline Card */}
        <Card p={0}>
          <CardHdr>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.sage, display: "inline-block" }} />
              <CHT>Production Pipeline</CHT>
            </div>
            <CHB>{filtered.length} total</CHB>
          </CardHdr>
          <div style={{ padding: "16px 14px 8px" }}>
            {/* Pipeline circles with connecting lines */}
            <div style={{ display: "flex", alignItems: "flex-start", position: "relative", overflowX: "auto" }}>
              {pipeline.filter(ps => ps.count > 0 || true).map((ps, i, arr) => {
                const circleColor = segColor(ps.id);
                const circleSize = 34;
                return (
                  <div key={ps.id} style={{ display: "flex", alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                      <div style={{
                        width: circleSize, height: circleSize, borderRadius: "50%",
                        background: ps.count > 0 ? circleColor : C.border,
                        border: `2.5px solid ${ps.count > 0 ? circleColor : C.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        position: "relative", zIndex: 2,
                        boxShadow: ps.count > 0 ? `0 2px 6px ${circleColor}33` : "none",
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.white, fontFamily: MONO }}>{ps.count}</span>
                      </div>
                      <div style={{ fontSize: 8, color: C.dark, fontWeight: 600, marginTop: 4, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                        {ps.label}
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{
                        flex: 1, height: 3, minWidth: 4,
                        marginTop: circleSize / 2 - 1,
                        background: `linear-gradient(90deg, ${segColor(ps.id)}, ${segColor(arr[i + 1].id)})`,
                        borderRadius: 2, position: "relative", zIndex: 1,
                      }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Clickable stage chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
              {pipeline.map(p => {
                const isActive = stageFilter === p.id;
                const chipColor = segColor(p.id);
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
                    <span style={{ fontFamily: MONO, fontWeight: 700 }}>{p.count}</span>
                    {p.label}
                  </button>
                );
              })}
              {cancelCount > 0 && (
                <button
                  onClick={() => setStageFilter(stageFilter === "cancel" ? null : "cancel")}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "3px 8px", borderRadius: 12, cursor: "pointer",
                    fontSize: 9, fontWeight: 600, fontFamily: FONT,
                    background: stageFilter === "cancel" ? C.red : `${C.red}18`,
                    color: stageFilter === "cancel" ? C.white : C.red,
                    border: `1px solid ${stageFilter === "cancel" ? C.red : `${C.red}40`}`,
                    transition: "all .15s",
                  }}
                >
                  <span style={{ fontFamily: MONO, fontWeight: 700 }}>{cancelCount}</span>
                  Cancelled
                </button>
              )}
            </div>

            {/* Summary row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <div style={{ display: "flex", gap: 20 }}>
                {[
                  { l: "Pre-Production", v: pipeline.filter(p => p.id === "draft" || p.id === "confirmed").reduce((s, p) => s + p.count, 0), c: C.muted },
                  { l: "Active", v: pipeline.filter(p => p.id === "progress" || p.id === "to_close").reduce((s, p) => s + p.count, 0), c: C.terra },
                  { l: "Completed", v: pipeline.filter(p => p.id === "done").reduce((s, p) => s + p.count, 0), c: C.forest },
                ].map(g => (
                  <div key={g.l}>
                    <div style={{ fontSize: 8.5, color: g.c, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{g.l}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: MONO, color: g.c }}>{g.v}</div>
                  </div>
                ))}
              </div>
              <Btn onClick={() => onNavList()} outline small color={C.gray}>All Orders →</Btn>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Production Analytics Charts ──────────────────────────────── */}
      <ProductionAnalytics orders={filtered} />

      {/* ─── Recent Orders Table ────────────────────────────────────────── */}
      <Section
        title={stageFilter
          ? `${MO_STATE_LABELS[stageFilter] || stageFilter} Orders (${recent.length})`
          : `Recent Production Orders${hasFilters ? ` (filtered)` : ""}`
        }
        count={stageFilter ? undefined : recent.length}
        right={
          <div style={{ display: "flex", gap: 5 }}>
            {stageFilter && (
              <Btn onClick={() => setStageFilter(null)} small outline color={C.muted}>Clear Filter</Btn>
            )}
            <Btn onClick={() => onNavList()} small outline color={C.gray}>View All →</Btn>
          </div>
        }
      >
        <Card p={0}>
          <div style={{ overflowX: "auto" }}>
            <div className="mob-table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th sticky>MO #</Th>
                  <Th>Product</Th>
                  <Th>Status</Th>
                  <Th>Date</Th>
                  <Th>Source</Th>
                  <Th right>Produced</Th>
                  <Th right>Bales</Th>
                  <Th right>Avg Wt</Th>
                  <Th right>Hours</Th>
                  <Th right>Diesel (L)</Th>
                  <Th right>Sleeves</Th>
                  <Th right># Labors</Th>
                  <Th right># Supv.</Th>
                  <Th right># Drivers</Th>
                  <Th right>Max Temp</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o, i) => (
                  <tr
                    key={o.id}
                    style={{ cursor: "pointer", background: i % 2 ? C.gBg : C.card }}
                    onClick={() => onNavDetail(o.id)}
                    onMouseEnter={e => e.currentTarget.style.background = C.gBg2}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 ? C.gBg : C.card}
                  >
                    <Td accent mono sticky bg={i % 2 ? C.gBg : C.card}><Highlight text={o.name} query={search} /></Td>
                    <Td><Highlight text={shortProduct(o.product?.name || null)} query={search} /></Td>
                    <Td>
                      <Badge v={MO_STATE_BADGE[o.state] || "default"}>
                        {MO_STATE_LABELS[o.state] || o.state}
                      </Badge>
                    </Td>
                    <Td mono>{o.productionDate || o.dateStart?.slice(0, 10) || "—"}</Td>
                    <Td><Highlight text={o.inputSource || "—"} query={search} /></Td>
                    <Td right mono>{fmtTons(o.qtyProduced || 0)}</Td>
                    <Td right mono>{o.totalBales || "—"}</Td>
                    <Td right mono>{(o.totalBales && o.qtyProduced) ? `${Math.round(o.qtyProduced / o.totalBales)} kg` : "—"}</Td>
                    <Td right mono>{fmtHours(o.actualHours || 0)}</Td>
                    <Td right mono>{o.dieselLiters ? `${fmt(o.dieselLiters)}` : "—"}</Td>
                    <Td right mono>{(o as any).sleeveBagsUsed || "—"}</Td>
                    <Td right mono>{(o.productionLabors?.length || 0) + (o.qualityLabors?.length || 0) + (o.labors?.length || 0) || "—"}</Td>
                    <Td right mono>{(o.supervisors?.length || 0) || "—"}</Td>
                    <Td right mono>{(o.drivers?.length || 0) + (o.loadingDrivers?.length || 0) || "—"}</Td>
                    <Td right mono>{(o as any).maxOilTemperature ? `${(o as any).maxOilTemperature}°` : "—"}</Td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={15} style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 11 }}>
                      {hasFilters ? "No orders matching your search" : stageFilter ? `No ${MO_STATE_LABELS[stageFilter] || stageFilter} orders found` : "No production orders found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table></div>
          </div>
        </Card>
      </Section>
    </div>
  );
}
