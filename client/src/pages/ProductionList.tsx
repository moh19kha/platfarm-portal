// ══════════════════════════════════════════════════════════════════════════════
// PRODUCTION LIST — Double Press Production Orders
// Filterable, sortable table with state tabs — live Odoo data via tRPC
// Full search bar matching Purchase/Sales Dashboard pattern
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback } from "react";
import { C, FONT, MONO, fmt, fmtDateStr } from "@/lib/data";
import { Badge, Card, Btn, Th, Td } from "@/components/ui-primitives";
import { trpc } from "@/lib/trpc";
import { TopProgressBar, TableSkeleton } from "@/components/LoadingIndicators";
import { Highlight } from "@/components/SearchHighlight";
import { SortTh } from "@/components/SortTh";
import { useTableSort } from "@/hooks/useTableSort";
import { exportToExcel } from "@/lib/exportExcel";
import {
  MO_STATE_LABELS, MO_STATE_BADGE, MO_STAGES,
  fmtTons, fmtHours, shortProduct,
} from "@/lib/moStateLabels";

interface Props {
  onNavDetail: (id: number) => void;
  onCreateNew: () => void;
  onBack: () => void;
  activeCompanyId?: string;
}

const STATE_TABS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "confirmed", label: "Confirmed" },
  { id: "progress", label: "In Progress" },
  { id: "to_close", label: "To Close" },
  { id: "done", label: "Done" },
  { id: "cancel", label: "Cancelled" },
];

export function ProductionList({ onNavDetail, onCreateNew, onBack, activeCompanyId }: Props) {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stateFilter, setStateFilter] = useState("all");

  const hasFilters = search.trim() !== "" || dateFrom !== "" || dateTo !== "" || stateFilter !== "all";

  const { data: orders, isLoading, error } = trpc.production.list.useQuery(
    { limit: 500, offset: 0 },
    { staleTime: 30_000 }
  );

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
      // Workforce fields
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

  const matchesCompany = useCallback((o: any) => {
    if (!activeCompanyId || activeCompanyId === "ALL") return true;
    return o.company?.id === Number(activeCompanyId);
  }, [activeCompanyId]);

  // ─── Filtered ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!orders) return [];
    let list = [...orders];
    list = list.filter(o => matchesCompany(o));
    if (stateFilter !== "all") {
      list = list.filter(o => o.state === stateFilter);
    }
    list = list.filter(o => matchesSearch(o) && matchesDate(o));
    return list;
  }, [orders, stateFilter, matchesCompany, matchesSearch, matchesDate]);

  // ─── Sorting ────────────────────────────────────────────────────────────
  const { sorted, sort, toggleSort } = useTableSort(filtered, (item, col) => {
    switch (col) {
      case "name": return item.name;
      case "product": return item.product?.name || "";
      case "state": return item.state;
      case "date": return item.productionDate || item.dateStart || "";
      case "source": return item.inputSource || "";
      case "qty": return item.productQty || 0;
      case "produced": return item.qtyProduced || 0;
      case "bales": return item.totalBales || 0;
      case "avgBaleWt": return (item.totalBales && item.qtyProduced) ? (item.qtyProduced / item.totalBales) : 0;
      case "hours": return item.actualHours || 0;
      case "diesel": return item.dieselLiters || 0;
      case "sleeves": return (item as any).sleeveBagsUsed || 0;
      case "labors": return (item.productionLabors?.length || 0) + (item.qualityLabors?.length || 0) + (item.labors?.length || 0);
      case "supervisors": return (item.supervisors?.length || 0);
      case "drivers": return (item.drivers?.length || 0) + (item.loadingDrivers?.length || 0);
      case "maxTemp": return (item as any).maxOilTemperature || 0;
      default: return "";
    }
  });

  // ─── State Counts ──────────────────────────────────────────────────────
  const stateCounts = useMemo(() => {
    if (!orders) return {} as Record<string, number>;
    const counts: Record<string, number> = { all: orders.length };
    orders.forEach(o => { counts[o.state] = (counts[o.state] || 0) + 1; });
    return counts;
  }, [orders]);

  // ─── Export ────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (!sorted.length) return;
    exportToExcel(sorted, [
      { header: "MO #", value: (o) => o.name },
      { header: "Product", value: (o) => o.product?.name || "" },
      { header: "State", value: (o) => MO_STATE_LABELS[o.state] || o.state },
      { header: "Date", value: (o) => o.productionDate || o.dateStart?.slice(0, 10) || "" },
      { header: "Company", value: (o) => o.company?.name || "" },
      { header: "Source", value: (o) => o.inputSource || "" },
      { header: "Planned Qty (kg)", value: (o) => o.productQty || 0 },
      { header: "Produced (kg)", value: (o) => o.qtyProduced || 0 },
      { header: "Total Bales", value: (o) => o.totalBales || 0 },
      { header: "Avg Bale Wt (kg)", value: (o) => (o.totalBales && o.qtyProduced) ? Math.round(o.qtyProduced / o.totalBales) : 0 },
      { header: "Hours", value: (o) => o.actualHours || 0 },
      { header: "Diesel (L)", value: (o) => o.dieselLiters || 0 },
      { header: "Sleeves", value: (o) => (o as any).sleeveBagsUsed || 0 },
      { header: "# Labors", value: (o) => (o.productionLabors?.length || 0) + (o.qualityLabors?.length || 0) + (o.labors?.length || 0) },
      { header: "# Supervisors", value: (o) => o.supervisors?.length || 0 },
      { header: "# Drivers", value: (o) => (o.drivers?.length || 0) + (o.loadingDrivers?.length || 0) },
      { header: "Max Temp (°C)", value: (o) => (o as any).maxOilTemperature || 0 },
      { header: "Quality Grade", value: (o) => o.inputQualityGrade || "" },
    ], "Double_Press_Production_Orders");
  }, [sorted]);

  const inputStyle: React.CSSProperties = {
    padding: "6px 10px", fontSize: 11, fontFamily: FONT,
    border: `1px solid ${C.border}`, borderRadius: 5,
    background: C.card, color: C.dark, outline: "none",
  };

  // ─── Loading ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <TopProgressBar />
        <Card p={0}>
          <div className="mob-table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["MO #", "Product", "Status", "Date", "Source", "Planned", "Produced", "Bales", "Avg Wt", "Hours", "Diesel", "Sleeves", "Labors", "# Supervisors", "Drivers", "Max Temp"].map((h, idx) =>
                  <Th key={h} sticky={idx === 0}>{h}</Th>
                )}
              </tr>
            </thead>
            <tbody><TableSkeleton rows={10} cols={16} /></tbody>
          </table></div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div style={{ padding: 24, textAlign: "center", color: C.red, fontSize: 12 }}>
          Failed to load production orders: {error.message}
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* ─── Back + Title ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div onClick={onBack} style={{
          cursor: "pointer", fontSize: 10, color: C.sage, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 3,
        }}>
          ← Dashboard
        </div>
        <div style={{ flex: 1 }} />
        <Btn onClick={onCreateNew} small>+ New Production Order</Btn>
      </div>

      {/* ─── Search & Date Range Filters (matching Dashboard pattern) ──── */}
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
            onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setStateFilter("all"); }}
            style={{
              padding: "5px 12px", fontSize: 10, fontWeight: 600, fontFamily: FONT,
              background: "transparent", border: `1px solid ${C.border}`, borderRadius: 5,
              color: C.muted, cursor: "pointer",
            }}
          >Clear</button>
        )}
        {hasFilters && (
          <span style={{ fontSize: 10, color: C.sage, fontWeight: 600 }}>
            {sorted.length} order{sorted.length !== 1 ? "s" : ""} matched
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

      {/* ─── State Tabs ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        {STATE_TABS.map(tab => {
          const count = stateCounts[tab.id] || 0;
          const active = stateFilter === tab.id;
          return (
            <div
              key={tab.id}
              onClick={() => setStateFilter(tab.id)}
              style={{
                padding: "5px 10px", borderRadius: 5, cursor: "pointer",
                fontSize: 10, fontWeight: active ? 700 : 500,
                background: active ? C.gBg2 : "transparent",
                color: active ? C.forest : C.gray,
                border: active ? `1px solid ${C.gBdr}` : "1px solid transparent",
                display: "flex", alignItems: "center", gap: 4,
                transition: "all .15s",
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.gBg; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? C.gBg2 : "transparent"; }}
            >
              {tab.label}
              {count > 0 && (
                <span style={{
                  fontSize: 8, fontWeight: 700, fontFamily: MONO,
                  background: active ? C.forest : C.border,
                  color: active ? C.white : C.gray,
                  padding: "1px 5px", borderRadius: 8, minWidth: 16, textAlign: "center",
                }}>
                  {count}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Results Count ──────────────────────────────────────────────── */}
      <div style={{ fontSize: 9, color: C.muted, fontFamily: MONO }}>
        {sorted.length} order{sorted.length !== 1 ? "s" : ""}
        {search && ` matching "${search}"`}
        {stateFilter !== "all" && ` · ${MO_STATE_LABELS[stateFilter]}`}
        {(dateFrom || dateTo) && ` · ${dateFrom || "..."} to ${dateTo || "..."}`}
      </div>

      {/* ─── Table ──────────────────────────────────────────────────────── */}
      <Card p={0}>
        <div style={{ overflowX: "auto" }}>
          <div className="mob-table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <SortTh column="name" sticky currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>MO #</SortTh>
                <SortTh column="product" currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Product</SortTh>
                <SortTh column="state" currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Status</SortTh>
                <SortTh column="date" currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Date</SortTh>
                <SortTh column="source" currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Source</SortTh>
                <SortTh column="qty" right currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Planned</SortTh>
                <SortTh column="produced" right currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Produced</SortTh>
                <SortTh column="bales" right currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Bales</SortTh>
                <SortTh column="avgBaleWt" right currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Avg Wt</SortTh>
                <SortTh column="hours" right currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Hours</SortTh>
                <SortTh column="diesel" right currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Diesel (L)</SortTh>
                <SortTh column="sleeves" right currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Sleeves</SortTh>
                <SortTh column="labors" right currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}># Labors</SortTh>
                <SortTh column="supervisors" right currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}># Supervisors</SortTh>
                <SortTh column="drivers" right currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}># Drivers</SortTh>
                <SortTh column="maxTemp" right currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Max Temp</SortTh>
              </tr>
            </thead>
            <tbody>
              {sorted.map((o, i) => (
                <tr
                  key={o.id}
                  style={{ cursor: "pointer", background: i % 2 ? C.gBg : C.card }}
                  onClick={() => onNavDetail(o.id)}
                  onMouseEnter={e => e.currentTarget.style.background = C.gBg2}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 ? C.gBg : C.card}
                >
                  <Td accent mono sticky bg={i % 2 ? C.gBg : C.card}>
                    <Highlight text={o.name} query={search} />
                  </Td>
                  <Td>
                    <Highlight text={shortProduct(o.product?.name || null)} query={search} />
                  </Td>
                  <Td>
                    <Badge v={MO_STATE_BADGE[o.state] || "default"}>
                      {MO_STATE_LABELS[o.state] || o.state}
                    </Badge>
                  </Td>
                  <Td mono>{o.productionDate || o.dateStart?.slice(0, 10) || "—"}</Td>
                  <Td>
                    <Highlight text={o.inputSource || "—"} query={search} />
                  </Td>
                  <Td right mono>{fmtTons(o.productQty || 0)}</Td>
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
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={16} style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 11 }}>
                    {search ? `No orders matching "${search}"` : "No production orders found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table></div>
        </div>
      </Card>
    </div>
  );
}
