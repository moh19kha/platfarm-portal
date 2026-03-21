// @ts-nocheck
// ══════════════════════════════════════════════════════════════════════════════
// DAKHLA-SOKHNA TRANSFERS — Platfarm V3
// Tracks goods received at CWDAK (Dakhla) and transferred to MWCP (Sokhna)
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  forest:   "#2D5A3D",
  green:    "#4A7C59",
  amber:    "#D4960A",
  terra:    "#C0714A",
  blue:     "#3B6EA5",
  card:     "#FFFFFF",
  bg:       "#F7F6F3",
  gBg:      "#FAFAF8",
  border:   "#E4E1DC",
  dark:     "#2C3E50",
  muted:    "#9CA3AF",
  gray:     "#64706C",
  red:      "#C0392B",
};

const MONO = "'DM Mono', 'Courier New', monospace";
const FONT = "'DM Sans', system-ui, sans-serif";

const fmt = (n: number, dec = 2) => n.toLocaleString("en-GB", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtDate = (s: string) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

// ─── State badge ─────────────────────────────────────────────────────────────
const STATE_LABELS: Record<string, string> = {
  done: "Done", assigned: "Ready", waiting: "Waiting", confirmed: "Confirmed", draft: "Draft", cancel: "Cancelled",
};
const STATE_COLORS: Record<string, { bg: string; text: string }> = {
  done:      { bg: "#E4EFE6", text: "#2D5A3D" },
  assigned:  { bg: "#EBF4FF", text: "#3B6EA5" },
  waiting:   { bg: "#FDF6EC", text: "#D4960A" },
  confirmed: { bg: "#FDF6EC", text: "#D4960A" },
  draft:     { bg: "#F2F0EC", text: "#64706C" },
  cancel:    { bg: "#FDECEA", text: "#C0392B" },
};
function StateBadge({ state }: { state: string }) {
  const c = STATE_COLORS[state] || { bg: "#F2F0EC", text: "#64706C" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 7px", borderRadius: 4,
      fontSize: 10, fontWeight: 700, background: c.bg, color: c.text,
      fontFamily: FONT,
    }}>
      {STATE_LABELS[state] || state}
    </span>
  );
}

// ─── Type badge ───────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  cwdak_in:       { label: "Dakhla Receipt",   bg: "#EBF4FF", text: "#3B6EA5", dot: "#3B6EA5" },
  cwdak_internal: { label: "CWDAK→MWCP",       bg: "#E4EFE6", text: "#2D5A3D", dot: "#2D5A3D" },
  mwcp_in:        { label: "Sokhna Receipt",   bg: "#FDF6EC", text: "#D4960A", dot: "#D4960A" },
};
function TypeBadge({ type }: { type: string }) {
  const c = TYPE_CONFIG[type] || { label: type, bg: "#F2F0EC", text: "#64706C", dot: "#9CA3AF" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600,
      background: c.bg, color: c.text, fontFamily: FONT,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {c.label}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 9,
      padding: "14px 16px", borderLeft: `3px solid ${accent || C.forest}`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.dark, fontFamily: MONO, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
      padding: "10px 14px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontFamily: FONT,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.dark, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill || p.stroke, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: C.gray }}>{p.name}:</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.dark, fontFamily: MONO }}>{fmt(p.value)} t</span>
        </div>
      ))}
    </div>
  );
}

// ─── Truncated product name ───────────────────────────────────────────────────
function ProductName({ name, maxLen = 60 }: { name: string; maxLen?: number }) {
  if (!name || name === "—") return <span style={{ color: C.muted }}>—</span>;
  const display = name.length > maxLen ? name.slice(0, maxLen) + "…" : name;
  return <span title={name}>{display}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface Props {
  isMob?: boolean;
}

export function DakhlaSokhnaTransfers({ isMob = false }: Props) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [productSearch, setProductSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"cwdak" | "internal" | "trend" | "products">("cwdak");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const queryInput = useMemo(() => ({
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    ...(stateFilter !== "all" ? { state: stateFilter } : {}),
  }), [dateFrom, dateTo, stateFilter]);

  const { data, isLoading, error } = trpc.inventory.dakhlaSokhnaTransfers.useQuery(
    queryInput,
    { refetchOnWindowFocus: false, staleTime: 60_000 }
  );

  // Client-side product search filter
  const filteredCwdak = useMemo(() => {
    if (!data?.cwdakPickings) return [];
    if (!productSearch) return data.cwdakPickings;
    const s = productSearch.toLowerCase();
    return data.cwdakPickings.filter((r: any) =>
      r.product.toLowerCase().includes(s) ||
      r.name.toLowerCase().includes(s) ||
      r.origin.toLowerCase().includes(s) ||
      r.supplier.toLowerCase().includes(s)
    );
  }, [data, productSearch]);

  const filteredInternal = useMemo(() => {
    if (!data?.internalTransfers) return [];
    if (!productSearch) return data.internalTransfers;
    const s = productSearch.toLowerCase();
    return data.internalTransfers.filter((r: any) =>
      r.product.toLowerCase().includes(s) || r.name.toLowerCase().includes(s)
    );
  }, [data, productSearch]);

  const inputStyle: React.CSSProperties = {
    padding: "5px 9px", borderRadius: 6, border: `1px solid ${C.border}`,
    fontSize: 11, fontFamily: FONT, background: C.card, color: C.dark, outline: "none",
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
    fontSize: 11, fontWeight: 600, fontFamily: FONT,
    background: active ? C.forest : "transparent",
    color: active ? "#fff" : C.gray,
    transition: "all 0.15s",
  });

  if (isLoading) {
    return (
      <div style={{ padding: isMob ? 12 : 24, fontFamily: FONT }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.forest, animation: "pulse 1.5s infinite" }} />
          <span style={{ fontSize: 12, color: C.muted }}>Loading Dakhla-Sokhna transfer data from Odoo…</span>
        </div>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: 60, background: C.gBg, borderRadius: 8, marginBottom: 8, animation: "shimmer 1.5s infinite" }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: isMob ? 12 : 24, fontFamily: FONT }}>
        <div style={{ background: "#FDECEA", border: "1px solid #FBBAB3", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 4 }}>Failed to load transfer data</div>
          <div style={{ fontSize: 11, color: C.red }}>{error.message}</div>
        </div>
      </div>
    );
  }

  const summary = data?.summary;
  const weeklyTrend = data?.weeklyTrend || [];
  const productSummary = data?.productSummary || [];

  return (
    <div style={{ padding: isMob ? 10 : 20, fontFamily: FONT }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, #1B3A2D 0%, #2D5A3D 60%, #3B6EA5 100%)",
        borderRadius: 12, padding: isMob ? "16px 16px" : "20px 24px", marginBottom: 16,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
          Inventory & Warehouse
        </div>
        <div style={{ fontSize: isMob ? 18 : 22, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
          Dakhla-Sokhna Moves
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
          Tracking goods received at <strong style={{ color: "#fff" }}>CWDAK (Dakhla)</strong> and transferred to <strong style={{ color: "#fff" }}>MWCP (Sokhna)</strong>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        <KpiCard
          label="Dakhla Receipts"
          value={String(summary?.totalCwdakReceipts ?? 0)}
          sub={`${fmt(summary?.totalCwdakTons ?? 0)} tons received`}
          accent={C.blue}
        />
        <KpiCard
          label="Tons at Dakhla"
          value={`${fmt(summary?.totalCwdakTons ?? 0)} t`}
          sub="Total received quantity"
          accent={C.blue}
        />
        <KpiCard
          label="CWDAK→MWCP Transfers"
          value={String(summary?.totalInternalTransfers ?? 0)}
          sub={summary?.totalInternalTransfers === 0 ? "No transfers yet" : `${fmt(summary?.totalInternalTons ?? 0)} tons transferred`}
          accent={C.forest}
        />
        <KpiCard
          label="Completed Receipts"
          value={String(summary?.doneCount ?? 0)}
          sub={`${summary?.pendingCount ?? 0} pending`}
          accent={C.amber}
        />
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 9,
        padding: "10px 14px", marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase" }}>Filters</span>
        <input
          type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={inputStyle} placeholder="From date"
        />
        <input
          type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={inputStyle} placeholder="To date"
        />
        <select value={stateFilter} onChange={e => setStateFilter(e.target.value)} style={inputStyle}>
          <option value="all">All States</option>
          <option value="done">Done</option>
          <option value="assigned">Ready</option>
          <option value="waiting">Waiting</option>
          <option value="confirmed">Confirmed</option>
          <option value="draft">Draft</option>
        </select>
        <input
          type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)}
          style={{ ...inputStyle, minWidth: 160 }} placeholder="Search product / ref…"
        />
        {(dateFrom || dateTo || stateFilter !== "all" || productSearch) && (
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); setStateFilter("all"); setProductSearch(""); }}
            style={{ ...inputStyle, cursor: "pointer", color: C.red, borderColor: "#FBBAB3" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
        <button style={tabStyle(activeTab === "cwdak")} onClick={() => setActiveTab("cwdak")}>
          Dakhla Receipts ({filteredCwdak.length})
        </button>
        <button style={tabStyle(activeTab === "internal")} onClick={() => setActiveTab("internal")}>
          CWDAK→MWCP Transfers ({filteredInternal.length})
        </button>
        <button style={tabStyle(activeTab === "trend")} onClick={() => setActiveTab("trend")}>
          Weekly Trend
        </button>
        <button style={tabStyle(activeTab === "products")} onClick={() => setActiveTab("products")}>
          By Product
        </button>
      </div>

      {/* ── Tab: Dakhla Receipts ─────────────────────────────────────────── */}
      {activeTab === "cwdak" && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, overflow: "hidden" }}>
          {filteredCwdak.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 12 }}>
              No Dakhla receipts found for the selected filters
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ background: C.forest }}>
                    {["Reference", "Type", "State", "Product", "Qty (t)", "Supplier", "Source Loc.", "Dest Loc.", "Sched. Date", "Done Date", "Origin"].map(h => (
                      <th key={h} style={{
                        padding: "9px 12px", textAlign: "left", fontWeight: 700,
                        color: "#fff", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em",
                        whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCwdak.map((r: any, i: number) => (
                    <React.Fragment key={r.id}>
                      <tr
                        style={{
                          background: expandedRow === r.id ? "#F2F7F3" : i % 2 ? C.gBg : C.card,
                          cursor: "pointer", transition: "background 0.1s",
                          borderBottom: `1px solid ${C.border}`,
                        }}
                        onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}
                        onMouseEnter={e => { if (expandedRow !== r.id) e.currentTarget.style.background = "#F2F7F3"; }}
                        onMouseLeave={e => { if (expandedRow !== r.id) e.currentTarget.style.background = i % 2 ? C.gBg : C.card; }}
                      >
                        <td style={{ padding: "8px 12px", fontFamily: MONO, color: C.forest, fontWeight: 600, whiteSpace: "nowrap" }}>
                          {r.name}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <TypeBadge type={r.transferType} />
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <StateBadge state={r.state} />
                        </td>
                        <td style={{ padding: "8px 12px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <ProductName name={r.product} maxLen={45} />
                        </td>
                        <td style={{ padding: "8px 12px", fontFamily: MONO, fontWeight: 600, color: C.dark, textAlign: "right", whiteSpace: "nowrap" }}>
                          {r.qtyTons > 0 ? fmt(r.qtyTons) : "—"}
                        </td>
                        <td style={{ padding: "8px 12px", color: C.gray, whiteSpace: "nowrap", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.supplier ? r.supplier.replace(/^\d[\d-]*-\s*/, "") : "—"}
                        </td>
                        <td style={{ padding: "8px 12px", color: C.muted, fontSize: 10, whiteSpace: "nowrap" }}>{r.locationFrom}</td>
                        <td style={{ padding: "8px 12px", color: C.muted, fontSize: 10, whiteSpace: "nowrap" }}>{r.locationTo}</td>
                        <td style={{ padding: "8px 12px", fontFamily: MONO, fontSize: 10, color: C.gray, whiteSpace: "nowrap" }}>{fmtDate(r.scheduledDate)}</td>
                        <td style={{ padding: "8px 12px", fontFamily: MONO, fontSize: 10, color: r.dateDone ? C.forest : C.muted, whiteSpace: "nowrap" }}>
                          {fmtDate(r.dateDone)}
                        </td>
                        <td style={{ padding: "8px 12px", color: C.muted, fontSize: 10, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.origin || "—"}
                        </td>
                      </tr>
                      {expandedRow === r.id && (
                        <tr key={`${r.id}-exp`} style={{ background: "#F2F7F3" }}>
                          <td colSpan={11} style={{ padding: "10px 20px", borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, fontSize: 11 }}>
                              <div>
                                <span style={{ fontWeight: 700, color: C.gray }}>Picking Type: </span>
                                <span style={{ color: C.dark }}>{r.pickingTypeName}</span>
                              </div>
                              <div>
                                <span style={{ fontWeight: 700, color: C.gray }}>Moves: </span>
                                <span style={{ color: C.dark, fontFamily: MONO }}>{r.moveCount}</span>
                              </div>
                              {r.products.length > 1 && (
                                <div>
                                  <span style={{ fontWeight: 700, color: C.gray }}>All Products: </span>
                                  <span style={{ color: C.dark }}>{r.products.join(", ")}</span>
                                </div>
                              )}
                              <div>
                                <span style={{ fontWeight: 700, color: C.gray }}>Full Product Name: </span>
                                <span style={{ color: C.dark }}>{r.product}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: "8px 14px", background: C.gBg, borderTop: `1px solid ${C.border}`, display: "flex", gap: 16, fontSize: 10, color: C.gray }}>
                <span><strong style={{ color: C.dark }}>{filteredCwdak.length}</strong> receipts</span>
                <span><strong style={{ color: C.dark, fontFamily: MONO }}>{fmt(filteredCwdak.reduce((s: number, r: any) => s + r.qtyTons, 0))}</strong> tons total</span>
                <span><strong style={{ color: C.dark }}>{filteredCwdak.filter((r: any) => r.state === "done").length}</strong> completed</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Internal Transfers ──────────────────────────────────────── */}
      {activeTab === "internal" && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, overflow: "hidden" }}>
          {filteredInternal.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔄</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 6 }}>No CWDAK→MWCP transfers yet</div>
              <div style={{ fontSize: 11, color: C.muted, maxWidth: 360, margin: "0 auto", lineHeight: 1.6 }}>
                Once internal transfer orders are created in Odoo to move goods from Dakhla (CWDAK) to Sokhna (MWCP), they will appear here automatically.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ background: C.forest }}>
                    {["Reference", "State", "Product", "Qty (t)", "From", "To", "Sched. Date", "Done Date", "Origin"].map(h => (
                      <th key={h} style={{
                        padding: "9px 12px", textAlign: "left", fontWeight: 700,
                        color: "#fff", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em",
                        whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredInternal.map((r: any, i: number) => (
                    <tr
                      key={r.id}
                      style={{ background: i % 2 ? C.gBg : C.card, borderBottom: `1px solid ${C.border}` }}
                    >
                      <td style={{ padding: "8px 12px", fontFamily: MONO, color: C.forest, fontWeight: 600 }}>{r.name}</td>
                      <td style={{ padding: "8px 12px" }}><StateBadge state={r.state} /></td>
                      <td style={{ padding: "8px 12px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <ProductName name={r.product} maxLen={45} />
                      </td>
                      <td style={{ padding: "8px 12px", fontFamily: MONO, fontWeight: 600, textAlign: "right" }}>
                        {r.qtyTons > 0 ? fmt(r.qtyTons) : "—"}
                      </td>
                      <td style={{ padding: "8px 12px", color: C.muted, fontSize: 10 }}>{r.locationFrom}</td>
                      <td style={{ padding: "8px 12px", color: C.muted, fontSize: 10 }}>{r.locationTo}</td>
                      <td style={{ padding: "8px 12px", fontFamily: MONO, fontSize: 10, color: C.gray }}>{fmtDate(r.scheduledDate)}</td>
                      <td style={{ padding: "8px 12px", fontFamily: MONO, fontSize: 10, color: r.dateDone ? C.forest : C.muted }}>
                        {fmtDate(r.dateDone)}
                      </td>
                      <td style={{ padding: "8px 12px", color: C.muted, fontSize: 10 }}>{r.origin || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Weekly Trend ────────────────────────────────────────────── */}
      {activeTab === "trend" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.forest, marginBottom: 14 }}>
              Weekly Quantity Received at Dakhla (tons)
            </div>
            {weeklyTrend.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 11 }}>No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={weeklyTrend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="week" tick={{ fontSize: 9, fontFamily: FONT }} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fontFamily: MONO }} tickLine={false} axisLine={false} tickFormatter={v => `${v}t`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: FONT }} />
                  <Bar dataKey="cwdakTons" name="Dakhla Receipts" fill={C.blue} radius={[3, 3, 0, 0]} />
                  {data?.summary?.totalInternalTransfers > 0 && (
                    <Bar dataKey="internalTons" name="CWDAK→MWCP Transfers" fill={C.forest} radius={[3, 3, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {weeklyTrend.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.forest, marginBottom: 14 }}>
                Cumulative Tons Over Time
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={weeklyTrend.reduce((acc: any[], w: any, i: number) => {
                    const prev = acc[i - 1] || { cumCwdak: 0, cumInternal: 0 };
                    acc.push({ ...w, cumCwdak: prev.cumCwdak + w.cwdakTons, cumInternal: prev.cumInternal + w.internalTons });
                    return acc;
                  }, [])}
                  margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="week" tick={{ fontSize: 9, fontFamily: FONT }} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fontFamily: MONO }} tickLine={false} axisLine={false} tickFormatter={v => `${v}t`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: FONT }} />
                  <Line type="monotone" dataKey="cumCwdak" name="Cumulative Dakhla" stroke={C.blue} strokeWidth={2} dot={false} />
                  {data?.summary?.totalInternalTransfers > 0 && (
                    <Line type="monotone" dataKey="cumInternal" name="Cumulative Transferred" stroke={C.forest} strokeWidth={2} dot={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: By Product ──────────────────────────────────────────────── */}
      {activeTab === "products" && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, overflow: "hidden" }}>
          {productSummary.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 11 }}>No product data available</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: C.forest }}>
                  {["Product", "Dakhla Receipts", "Tons at Dakhla", "Tons Transferred", "Transfer %"].map(h => (
                    <th key={h} style={{
                      padding: "9px 12px", textAlign: h === "Product" ? "left" : "right",
                      fontWeight: 700, color: "#fff", fontSize: 10, textTransform: "uppercase",
                      letterSpacing: "0.04em", whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productSummary.map((p: any, i: number) => {
                  const pct = p.cwdakTons > 0 ? (p.internalTons / p.cwdakTons) * 100 : 0;
                  return (
                    <tr key={p.product} style={{ background: i % 2 ? C.gBg : C.card, borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "9px 12px", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <ProductName name={p.product} maxLen={70} />
                      </td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: MONO, color: C.blue, fontWeight: 600 }}>
                        {p.receipts}
                      </td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: MONO, fontWeight: 600, color: C.dark }}>
                        {fmt(p.cwdakTons)} t
                      </td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: MONO, color: p.internalTons > 0 ? C.forest : C.muted }}>
                        {p.internalTons > 0 ? `${fmt(p.internalTons)} t` : "—"}
                      </td>
                      <td style={{ padding: "9px 12px", textAlign: "right" }}>
                        {p.internalTons > 0 ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                            <div style={{ width: 60, height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: C.forest, borderRadius: 3 }} />
                            </div>
                            <span style={{ fontFamily: MONO, fontSize: 10, color: C.forest, fontWeight: 600 }}>
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: C.muted }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "#F2F7F3", borderTop: `2px solid ${C.border}` }}>
                  <td style={{ padding: "9px 12px", fontWeight: 700, color: C.dark }}>Total</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: C.dark }}>
                    {productSummary.reduce((s: number, p: any) => s + p.receipts, 0)}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: C.dark }}>
                    {fmt(productSummary.reduce((s: number, p: any) => s + p.cwdakTons, 0))} t
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: C.forest }}>
                    {fmt(productSummary.reduce((s: number, p: any) => s + p.internalTons, 0))} t
                  </td>
                  <td style={{ padding: "9px 12px" }} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

    </div>
  );
}
