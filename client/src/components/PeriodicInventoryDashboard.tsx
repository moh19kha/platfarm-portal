import { useState, useEffect, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";

/* ─── Platfarm Design Tokens ──────────────────────────────────────────────── */
const C = {
  forest: "#2D5A3D", sage: "#4A7C59", terra: "#C0714A",
  dark: "#2C3E50", gray: "#64706C", light: "#95A09C", muted: "#B0BAB6", white: "#FFFFFF",
  pageBg: "#F7F6F3", card: "#FFFFFF",
  gBg: "#F2F7F3", gBg2: "#E4EFE6", tBg: "#FDF7F3", aBg: "#FDF6EC", rBg: "#FDF0F0",
  border: "#E4E1DC", inputBdr: "#D2CEC7",
  gBdr: "#CDDDD1", gBdr2: "#B8D0BD", tBdr: "#F0D5C4", aBdr: "#F5DDB8", rBdr: "#F5C4C4",
  amber: "#D4960A", red: "#C94444", blue: "#3B7DD8",
};
const FONT = "'DM Sans', system-ui, sans-serif";
const MONO = "'JetBrains Mono', monospace";

/* ─── Stock Type Mapping (same as Dashboard) ─────────────────────────────── */
const STOCK_TYPES: Record<string, string> = {
  "Animal Fodder": "#2D5A3D",
  "Packing Materials": "#EC4899",
  "Oil & Fuel": "#475577",
  "Spare Parts": "#8B5CF6",
  "Others": "#9CA3AF",
};
const STOCK_TYPE_NAMES = ["All", ...Object.keys(STOCK_TYPES)];
const groupToStockType = (group: string): string => {
  const g = group.toLowerCase();
  if (["alfalfa", "rhodes grass", "alfamix", "mixgrass", "wheat straw", "grass", "hay", "ray grass"].some(k => g.includes(k) || g === k)) return "Animal Fodder";
  if (["sleeve bags", "packing", "packaging", "bags"].some(k => g.includes(k))) return "Packing Materials";
  if (["diesel", "fuel", "oil", "lubricant", "oil & lubricants"].some(k => g.includes(k))) return "Oil & Fuel";
  if (["equipment", "spare", "parts", "machinery"].some(k => g.includes(k))) return "Spare Parts";
  return "Others";
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function fmtDate(d: string) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtQty(qty: number, unit?: string) {
  if (!qty && qty !== 0) return "—";
  const tons = unit?.toLowerCase() === "kg" ? qty / 1000 : qty;
  return `${tons.toLocaleString("en-US", { maximumFractionDigits: 2 })} t`;
}

/** Parse avg bale weight from weight range string like "400-425 Kg" → 412.5 (in kg) */
function parseAvgBaleWeight(weightRange: string, productName?: string): number {
  // Try the weightRange field first, then fall back to product name
  const sources = [weightRange, productName || ""];
  for (const src of sources) {
    const m = src.match(/(\d+)\s*[-–]\s*(\d+)\s*[Kk]g/);
    if (m) return (parseFloat(m[1]) + parseFloat(m[2])) / 2;
  }
  return 0;
}

/* ─── Pill (matching Dashboard pattern exactly) ──────────────────────────── */
function Pill({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 14px", borderRadius: 99, fontSize: 11, fontWeight: active ? 600 : 500,
        cursor: "pointer", border: active ? "none" : "1px solid #E4E1DC",
        background: active ? (color || "#2D5A3D") : "#fff", color: active ? "#fff" : "#64706C",
        fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0, transition: "all .15s",
      }}
    >{label}</button>
  );
}

/* ─── Badge ───────────────────────────────────────────────────────────────── */
type BadgeV = "green" | "terra" | "amber" | "red" | "sage" | "blue" | "default";
function Bdg({ v = "default", children }: { v?: BadgeV; children: React.ReactNode }) {
  const map: Record<BadgeV, { c: string; bg: string; bd: string }> = {
    default: { c: C.gray, bg: C.gBg, bd: C.gBdr },
    green: { c: C.forest, bg: C.gBg2, bd: C.gBdr2 },
    terra: { c: C.terra, bg: C.tBg, bd: C.tBdr },
    amber: { c: C.amber, bg: C.aBg, bd: C.aBdr },
    red: { c: C.red, bg: C.rBg, bd: C.rBdr },
    sage: { c: C.sage, bg: C.gBg, bd: C.gBdr },
    blue: { c: C.blue, bg: "#EBF2FC", bd: "#C4D9F2" },
  };
  const s = map[v];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 9px", borderRadius: 99, fontSize: 10, fontWeight: 600, letterSpacing: 0.3, whiteSpace: "nowrap", border: `1px solid ${s.bd}`, background: s.bg, color: s.c, fontFamily: FONT }}>
      {children}
    </span>
  );
}

/* ─── State Badge ─────────────────────────────────────────────────────────── */
function StateBdg({ state }: { state: string }) {
  const map: Record<string, { label: string; v: BadgeV }> = {
    done: { label: "Done", v: "green" },
    accounting_review: { label: "Acct. Review", v: "blue" },
    supervisor_review: { label: "Supv. Review", v: "amber" },
    draft: { label: "Draft", v: "default" },
    cancelled: { label: "Cancelled", v: "red" },
  };
  const s = map[state] || { label: state, v: "default" as BadgeV };
  return <Bdg v={s.v}>{s.label}</Bdg>;
}

/* ─── Review Mini Badge ──────────────────────────────────────────────────── */
function ReviewMini({ status }: { status: string }) {
  const v: BadgeV = status === "approved" ? "green" : status === "rejected" ? "red" : "amber";
  const icon = status === "approved" ? "✓" : status === "rejected" ? "✕" : "◷";
  return <Bdg v={v}>{icon}</Bdg>;
}

/* ─── Custom Dropdown (for date only) ────────────────────────────────────── */
function Dropdown({ label, icon, value, options, onChange, placeholder }: {
  label: string;
  icon: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 180 }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: C.light, marginBottom: 5, display: "flex", alignItems: "center", gap: 4, fontFamily: FONT }}>
        <span style={{ fontSize: 11 }}>{icon}</span> {label}
      </div>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
          width: "100%", padding: "7px 12px", borderRadius: 6,
          border: `1px solid ${open ? C.gBdr2 : C.inputBdr}`,
          background: C.card, fontSize: 11.5, fontWeight: 500, color: selected ? C.dark : C.muted,
          cursor: "pointer", fontFamily: FONT, textAlign: "left", outline: "none",
          transition: "border-color .15s",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? selected.label : (placeholder || "Select...")}
        </span>
        <svg width="8" height="5" viewBox="0 0 8 5" style={{ flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }}>
          <path d="M0.5 0.5L4 4L7.5 0.5" stroke={C.gray} strokeWidth="1.2" fill="none" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden", maxHeight: 280, overflowY: "auto",
        }}>
          {options.map((o) => (
            <div
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{
                padding: "8px 12px", fontSize: 11.5, color: o.value === value ? C.forest : C.dark,
                cursor: "pointer", fontWeight: o.value === value ? 600 : 400, fontFamily: FONT,
                background: o.value === value ? C.gBg2 : "transparent",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
              onMouseEnter={(e) => { if (o.value !== value) e.currentTarget.style.background = C.gBg; }}
              onMouseLeave={(e) => { if (o.value !== value) e.currentTarget.style.background = "transparent"; }}
            >
              <span>{o.label}</span>
              {o.value === value && <span style={{ color: C.forest, fontSize: 10 }}>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Stat Card ───────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div style={{ background: accent ? C.forest : C.gBg, border: accent ? "none" : `1px solid ${C.gBdr}`, borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.6, color: accent ? "rgba(255,255,255,.6)" : C.light, fontWeight: 700, fontFamily: FONT }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, fontFamily: MONO, color: accent ? C.white : C.dark, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: accent ? "rgba(255,255,255,.5)" : C.muted, marginTop: 3, fontFamily: FONT }}>{sub}</div>}
    </div>
  );
}

/* ─── Card Header ─────────────────────────────────────────────────────────── */
function CardHdr({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div style={{ background: `linear-gradient(135deg, ${C.forest}, ${C.sage})`, padding: "10px 16px", borderRadius: "9px 9px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: C.white, fontFamily: FONT }}>{title}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

/* ─── Table Header Cell ──────────────────────────────────────────────────── */
function Th({ children, align }: { children: React.ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <th style={{ padding: "9px 12px", fontSize: 9, fontWeight: 700, color: C.sage, textTransform: "uppercase", letterSpacing: 1, borderBottom: `2px solid ${C.gBdr}`, whiteSpace: "nowrap", textAlign: align || "left", fontFamily: FONT }}>{children}</th>
  );
}

/* ─── Table Data Cell ────────────────────────────────────────────────────── */
function Td({ children, mono, accent, align, title: titleProp, style: extraStyle }: { children: React.ReactNode; mono?: boolean; accent?: boolean; align?: "left" | "right" | "center"; title?: string; style?: React.CSSProperties }) {
  return (
    <td title={titleProp} style={{ padding: "9px 12px", fontSize: 11.5, color: accent ? C.forest : C.dark, fontWeight: accent ? 600 : 400, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", fontFamily: mono ? MONO : FONT, textAlign: align || "left", ...extraStyle }}>{children}</td>
  );
}

/* ─── Loading Skeleton ────────────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ background: C.gBg, border: `1px solid ${C.gBdr}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ width: 80, height: 9, background: C.border, borderRadius: 4, marginBottom: 8 }} className="pi-shimmer" />
            <div style={{ width: 100, height: 24, background: C.border, borderRadius: 4, marginBottom: 6 }} className="pi-shimmer" />
            <div style={{ width: 60, height: 9, background: C.border, borderRadius: 4 }} className="pi-shimmer" />
          </div>
        ))}
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, overflow: "hidden" }}>
        <div style={{ background: C.forest, padding: "12px 16px", display: "flex", justifyContent: "space-between" }}>
          <div style={{ width: 200, height: 14, background: "rgba(255,255,255,.2)", borderRadius: 4 }} />
          <div style={{ width: 80, height: 14, background: "rgba(255,255,255,.15)", borderRadius: 4 }} />
        </div>
        <div style={{ padding: 16 }}>
          {[1, 2, 3, 4, 5].map((j) => (
            <div key={j} style={{ width: `${50 + j * 8}%`, height: 14, background: C.border, borderRadius: 4, marginBottom: 12 }} className="pi-shimmer" />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes pi-shimmer { 0% { opacity: .6 } 50% { opacity: 1 } 100% { opacity: .6 } }
        .pi-shimmer { animation: pi-shimmer 1.8s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function PeriodicInventoryDashboard() {
  const [selectedDate, setSelectedDate] = useState("");
  // Pill-based multi-select filters (Set of names, empty = All)
  const [whFilter, setWhFilter] = useState<Set<string>>(new Set());
  const [locFilter, setLocFilter] = useState<Set<string>>(new Set());
  const [prodFilter, setProdFilter] = useState<Set<string>>(new Set());

  // Fetch available dates (only dates with submissions)
  const { data: dates = [], isLoading: datesLoading } = trpc.periodicInventory.dates.useQuery();

  // Auto-select latest date
  useEffect(() => {
    if (dates.length > 0 && !selectedDate) setSelectedDate(dates[0]);
  }, [dates, selectedDate]);

  // Fetch ALL submissions for selected date (no server-side warehouse/location filter — we filter client-side)
  const queryInput = useMemo(() => ({ date: selectedDate }), [selectedDate]);
  const { data: result, isLoading: dataLoading } = trpc.periodicInventory.byDate.useQuery(
    queryInput,
    { enabled: !!selectedDate }
  );

  const submissions = result?.submissions || [];
  const lines = result?.lines || [];

  // ── Toggle helpers (matching Dashboard pattern) ──
  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, val: string) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val); else next.add(val);
      return next;
    });
  };

  // ── Derive unique warehouses, locations, products from the raw data ──
  const allWarehouses = useMemo(() => {
    const seen = new Map<string, number>();
    for (const s of submissions) {
      if (s.warehouse) {
        const count = seen.get(s.warehouse) || 0;
        seen.set(s.warehouse, count + 1);
      }
    }
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [submissions]);

  const allLocations = useMemo(() => {
    // If warehouse filter is active, only show locations from those warehouses
    const filteredSubs = whFilter.size > 0
      ? submissions.filter(s => whFilter.has(s.warehouse))
      : submissions;
    const seen = new Map<string, number>();
    for (const s of filteredSubs) {
      if (s.location) {
        const count = seen.get(s.location) || 0;
        seen.set(s.location, count + 1);
      }
    }
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [submissions, whFilter]);

  // ── Derive stock type categories from product categories (matching Dashboard) ──
  const allStockTypes = useMemo(() => {
    // Build stock type list from submissions + lines, respecting warehouse/location filters
    const visibleSubs = submissions.filter(s =>
      (whFilter.size === 0 || whFilter.has(s.warehouse)) &&
      (locFilter.size === 0 || locFilter.has(s.location))
    );
    const visibleSubIds = new Set(visibleSubs.map(s => s.id));
    const counts = new Map<string, number>();
    // Count from line-level product categories
    for (const l of lines) {
      if (visibleSubIds.has(l.inventoryId) && l.productCategory) {
        const st = groupToStockType(l.productCategory);
        counts.set(st, (counts.get(st) || 0) + 1);
      }
    }
    // Also count from submission-level product categories if lines don't have categories
    if (counts.size === 0) {
      for (const s of visibleSubs) {
        if (s.productCategory) {
          const st = groupToStockType(s.productCategory);
          counts.set(st, (counts.get(st) || 0) + 1);
        }
      }
    }
    // Return in the order defined by STOCK_TYPE_NAMES (excluding "All")
    return Object.keys(STOCK_TYPES)
      .filter(st => counts.has(st))
      .map(st => [st, counts.get(st) || 0] as [string, number]);
  }, [lines, submissions, whFilter, locFilter]);

  // ── Apply all filters ──
  const filteredSubmissions = useMemo(() =>
    submissions.filter(s =>
      (whFilter.size === 0 || whFilter.has(s.warehouse)) &&
      (locFilter.size === 0 || locFilter.has(s.location))
    ),
    [submissions, whFilter, locFilter]
  );

  const filteredSubIds = useMemo(() => new Set(filteredSubmissions.map(s => s.id)), [filteredSubmissions]);

  const filteredLines = useMemo(() =>
    lines.filter(l => {
      if (!filteredSubIds.has(l.inventoryId)) return false;
      if (prodFilter.size === 0) return true;
      // Filter by stock type category
      const lineStockType = groupToStockType(l.productCategory || "");
      return prodFilter.has(lineStockType);
    }),
    [lines, filteredSubIds, prodFilter]
  );

  // ── Build aggregated rows ──
  type AggregatedRow = {
    lineId: number;
    submissionId: number;
    submissionName: string;
    submissionState: string;
    warehouse: string;
    location: string;
    productCategory: string;
    grade: string;
    reportingUnit: string;
    supervisorReviewStatus: string;
    accountingReviewStatus: string;
    requestedBy: string;
    productName: string;
    weightRange: string;
    countedBales: number;
    countedQty: number;
    theoreticalQty: number;
    differenceQty: number;
    unit: string;
    lineState: string;
    isEstimated: boolean;
    estimatedQty: number;
  };

  const aggregatedRows: AggregatedRow[] = useMemo(() => {
    const subMap = new Map(filteredSubmissions.map((s) => [s.id, s]));
    return filteredLines.map((line) => {
      const sub = subMap.get(line.inventoryId);
      const bales = line.countedBales || 0;
      const rawQty = line.countedQty || 0;
      // Estimate qty when counted_qty is 0 but bales > 0
      const avgBaleWt = parseAvgBaleWeight(line.weightRange || "", line.productName || "");
      const needsEstimate = rawQty === 0 && bales > 0 && avgBaleWt > 0;
      const estimatedQtyKg = needsEstimate ? bales * avgBaleWt : 0;
      return {
        lineId: line.id,
        submissionId: line.inventoryId,
        submissionName: sub?.name || "",
        submissionState: sub?.state || "",
        warehouse: sub?.warehouse || "",
        location: sub?.location || "",
        productCategory: sub?.productCategory || "",
        grade: line.grade || sub?.grade || "",
        reportingUnit: sub?.reportingUnit || "",
        supervisorReviewStatus: sub?.supervisorReviewStatus || "",
        accountingReviewStatus: sub?.accountingReviewStatus || "",
        requestedBy: sub?.requestedBy || "",
        productName: line.productName || "",
        weightRange: line.weightRange || "",
        countedBales: line.countedBales || 0,
        countedQty: rawQty,
        theoreticalQty: line.theoreticalQty || 0,
        differenceQty: line.differenceQty || 0,
        unit: line.unit || "",
        lineState: line.state || "",
        isEstimated: needsEstimate,
        estimatedQty: estimatedQtyKg,
      };
    });
  }, [filteredLines, filteredSubmissions]);

  // Summary stats (use estimated qty when actual is 0)
  const totalBales = aggregatedRows.reduce((s, r) => s + r.countedBales, 0);
  const totalQtyKg = aggregatedRows.reduce((s, r) => s + (r.isEstimated ? r.estimatedQty : r.countedQty), 0);
  const totalTheoreticalKg = aggregatedRows.reduce((s, r) => s + r.theoreticalQty, 0);
  const totalDiffKg = aggregatedRows.reduce((s, r) => s + r.differenceQty, 0);
  const hasEstimates = aggregatedRows.some(r => r.isEstimated);

  // Date options
  const dateOptions = useMemo(() =>
    dates.map((d) => ({ value: d, label: fmtDate(d) })),
    [dates]
  );

  const isLoading = datesLoading || dataLoading;
  const uniqueSubmissionCount = new Set(aggregatedRows.map((r) => r.submissionId)).size;

  return (
    <div style={{ fontFamily: FONT }}>
      {/* ── Date Dropdown (single row) ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "flex-end", gap: 16 }}>
        <Dropdown
          label="Inventory Date"
          icon="📅"
          value={selectedDate}
          options={dateOptions}
          onChange={(v) => {
            setSelectedDate(v);
            // Reset filters when changing date
            setWhFilter(new Set());
            setLocFilter(new Set());
            setProdFilter(new Set());
          }}
          placeholder={datesLoading ? "Loading..." : "Select date"}
        />
        {selectedDate && !isLoading && (
          <div style={{ fontSize: 11, color: C.gray, paddingBottom: 4, fontFamily: FONT }}>
            {submissions.length} submission{submissions.length !== 1 ? "s" : ""} on this date
          </div>
        )}
      </div>

      {/* ── Pill Filter Bar (Dashboard-style) ── */}
      {selectedDate && !isLoading && submissions.length > 0 && (
        <div style={{ background: "#FAFAF8", border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 16px", marginBottom: 14 }}>
          <style>{`
            .pi-filter-scroll{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
            @media(max-width:767px){
              .pi-filter-scroll{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:4px}
              .pi-filter-scroll::-webkit-scrollbar{display:none}
            }
          `}</style>

          {/* Warehouse pills */}
          {allWarehouses.length > 0 && (
            <div className="pi-filter-scroll" style={{ gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: C.sage, textTransform: "uppercase", marginRight: 4, flexShrink: 0 }}>Warehouse</span>
              <Pill label="All" active={whFilter.size === 0} onClick={() => { setWhFilter(new Set()); setLocFilter(new Set()); setProdFilter(new Set()); }} />
              {allWarehouses.map(([wh, count]) => (
                <Pill
                  key={wh}
                  label={`${wh}${count > 0 ? ` (${count})` : ""}`}
                  active={whFilter.has(wh)}
                  onClick={() => { toggleSet(setWhFilter, wh); setLocFilter(new Set()); setProdFilter(new Set()); }}
                />
              ))}
            </div>
          )}

          {/* Location pills */}
          {allLocations.length > 0 && (
            <div className="pi-filter-scroll" style={{ gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: C.sage, textTransform: "uppercase", marginRight: 4, flexShrink: 0 }}>Location</span>
              <Pill label="All" active={locFilter.size === 0} onClick={() => { setLocFilter(new Set()); setProdFilter(new Set()); }} />
              {allLocations.map(([loc, count]) => {
                const shortLoc = loc.includes("/") ? loc.split("/").pop() || loc : loc;
                return (
                  <span key={loc} title={loc}>
                    <Pill
                      label={`${shortLoc}${count > 0 ? ` (${count})` : ""}`}
                      active={locFilter.has(loc)}
                      onClick={() => { toggleSet(setLocFilter, loc); setProdFilter(new Set()); }}
                    />
                  </span>
                );
              })}
            </div>
          )}

          {/* Stock Type pills (matching Dashboard categories) */}
          {allStockTypes.length > 0 && (
            <div className="pi-filter-scroll" style={{ gap: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: C.sage, textTransform: "uppercase", marginRight: 4, flexShrink: 0 }}>Stock Type</span>
              {STOCK_TYPE_NAMES.map((t) => {
                const isAll = t === "All";
                const active = isAll ? prodFilter.size === 0 : prodFilter.has(t);
                const stEntry = allStockTypes.find(([st]) => st === t);
                // Only show types that exist in the data (or "All")
                if (!isAll && !stEntry) return null;
                return (
                  <Pill
                    key={t}
                    label={isAll ? "All" : `${t}${stEntry ? ` (${stEntry[1]})` : ""}`}
                    active={active}
                    color={isAll ? "#2D5A3D" : (STOCK_TYPES[t] || "#2D5A3D")}
                    onClick={() => {
                      if (isAll) { setProdFilter(new Set()); return; }
                      toggleSet(setProdFilter, t);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && <Skeleton />}

      {/* ── No date selected ── */}
      {!selectedDate && !datesLoading && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
          <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>📅</div>
          <div style={{ fontSize: 12, fontWeight: 500 }}>Select an inventory date to view submissions</div>
        </div>
      )}

      {/* ── Summary Stats ── */}
      {selectedDate && !isLoading && submissions.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
          <StatCard label="Submissions" value={uniqueSubmissionCount} sub={`for ${fmtDate(selectedDate)}`} accent />
          <StatCard label="Total Bales" value={totalBales.toLocaleString()} sub="counted bales" />
          <StatCard label="Counted Quantity" value={totalQtyKg > 0 ? (hasEstimates ? "~" : "") + fmtQty(totalQtyKg, "kg") : "—"} sub={hasEstimates ? "includes estimated weights" : "total counted weight"} />
          <StatCard
            label="Variance"
            value={totalDiffKg !== 0 ? (totalDiffKg > 0 ? "+" : "") + fmtQty(Math.abs(totalDiffKg), "kg") : "—"}
            sub={totalTheoreticalKg > 0 ? `vs ${fmtQty(totalTheoreticalKg, "kg")} theoretical` : "no theoretical data"}
          />
        </div>
      )}

      {/* ── No results ── */}
      {selectedDate && !isLoading && submissions.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
          <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>📋</div>
          <div style={{ fontSize: 12, fontWeight: 500 }}>No submissions found for {fmtDate(selectedDate)}</div>
        </div>
      )}

      {/* ── No results after filtering ── */}
      {selectedDate && !isLoading && submissions.length > 0 && aggregatedRows.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}>
          <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.3 }}>🔍</div>
          <div style={{ fontSize: 12, fontWeight: 500 }}>No matching line items for current filters</div>
          <button
            onClick={() => { setWhFilter(new Set()); setLocFilter(new Set()); setProdFilter(new Set()); }}
            style={{ marginTop: 10, padding: "6px 16px", borderRadius: 6, border: `1px solid ${C.gBdr}`, background: C.gBg, color: C.forest, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* ── Aggregated Table ── */}
      {selectedDate && !isLoading && aggregatedRows.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, overflow: "hidden" }}>
          <CardHdr title={`📋 Periodic Inventory — ${fmtDate(selectedDate)}`}>
            <span style={{ fontSize: 10, fontFamily: MONO, fontWeight: 600, color: "rgba(255,255,255,.7)" }}>
              {aggregatedRows.length} line{aggregatedRows.length !== 1 ? "s" : ""} across {uniqueSubmissionCount} submission{uniqueSubmissionCount !== 1 ? "s" : ""}
            </span>
          </CardHdr>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.gBg }}>
                  <Th>Submission</Th>
                  <Th>Product</Th>
                  <Th>Warehouse / Location</Th>
                  <Th>Grade</Th>
                  <Th>Weight Range</Th>
                  <Th align="right">Counted Bales</Th>
                  <Th align="right">Counted Qty</Th>
                  <Th align="right">Theoretical</Th>
                  <Th align="right">Difference</Th>
                  <Th align="center">State</Th>
                  <Th align="center">Supv.</Th>
                  <Th align="center">Acct.</Th>
                </tr>
              </thead>
              <tbody>
                {aggregatedRows.map((row, idx) => {
                  const diff = row.differenceQty;
                  const diffColor = diff > 0 ? C.forest : diff < 0 ? C.red : C.muted;
                  const diffBg = diff > 0 ? C.gBg : diff < 0 ? C.rBg : "transparent";

                  const prevRow = idx > 0 ? aggregatedRows[idx - 1] : null;
                  const isNewSubmission = !prevRow || prevRow.submissionId !== row.submissionId;
                  const nextRow = idx < aggregatedRows.length - 1 ? aggregatedRows[idx + 1] : null;
                  const isLastInGroup = !nextRow || nextRow.submissionId !== row.submissionId;

                  return (
                    <tr
                      key={`${row.submissionId}-${row.lineId}`}
                      style={{
                        background: isNewSubmission && idx > 0 ? C.gBg : "transparent",
                        borderTop: isNewSubmission && idx > 0 ? `2px solid ${C.gBdr}` : undefined,
                      }}
                    >
                      <Td
                        accent
                        title={row.submissionName}
                        style={{
                          borderBottom: isLastInGroup ? `2px solid ${C.gBdr}` : `1px solid ${C.border}`,
                          background: isNewSubmission && idx > 0 ? C.gBg : "transparent",
                          verticalAlign: "top",
                        }}
                      >
                        {isNewSubmission ? (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 11, fontFamily: MONO, color: C.forest }}>{row.submissionName}</div>
                            <div style={{ fontSize: 9, color: C.light, marginTop: 2, fontFamily: FONT }}>{row.requestedBy}</div>
                          </div>
                        ) : null}
                      </Td>

                      <Td title={row.productName} style={{
                        borderBottom: isLastInGroup ? `2px solid ${C.gBdr}` : `1px solid ${C.border}`,
                        maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {row.productName || "—"}
                      </Td>

                      <Td style={{ borderBottom: isLastInGroup ? `2px solid ${C.gBdr}` : `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 11, fontWeight: 500 }}>{row.warehouse || "—"}</div>
                        <div style={{ fontSize: 9, color: C.light, marginTop: 1 }}>{row.location || "—"}</div>
                      </Td>

                      <Td style={{ borderBottom: isLastInGroup ? `2px solid ${C.gBdr}` : `1px solid ${C.border}` }}>
                        {row.grade || "—"}
                      </Td>

                      <Td style={{ borderBottom: isLastInGroup ? `2px solid ${C.gBdr}` : `1px solid ${C.border}` }}>
                        {row.weightRange || "—"}
                      </Td>

                      <Td mono align="right" style={{ borderBottom: isLastInGroup ? `2px solid ${C.gBdr}` : `1px solid ${C.border}` }}>
                        {row.countedBales ? row.countedBales.toLocaleString() : "—"}
                      </Td>

                      <Td mono align="right" style={{ borderBottom: isLastInGroup ? `2px solid ${C.gBdr}` : `1px solid ${C.border}` }}>
                        {row.isEstimated ? (
                          <span title={`Estimated: ${row.countedBales} bales × ${(parseAvgBaleWeight(row.weightRange, row.productName) / 1000).toFixed(3)} t/bale`} style={{ color: C.amber }}>
                            ~{fmtQty(row.estimatedQty, "kg")}
                          </span>
                        ) : (
                          fmtQty(row.countedQty, row.unit)
                        )}
                      </Td>

                      <Td mono align="right" style={{ borderBottom: isLastInGroup ? `2px solid ${C.gBdr}` : `1px solid ${C.border}`, color: C.gray }}>
                        {fmtQty(row.theoreticalQty, row.unit)}
                      </Td>

                      <td style={{
                        padding: "9px 12px", fontSize: 11.5, fontWeight: 600, fontFamily: MONO,
                        textAlign: "right", whiteSpace: "nowrap",
                        color: diffColor, background: diff !== 0 ? diffBg : "transparent",
                        borderBottom: isLastInGroup ? `2px solid ${C.gBdr}` : `1px solid ${C.border}`,
                      }}>
                        {diff !== 0 ? (diff > 0 ? "+" : "") + fmtQty(Math.abs(diff), row.unit) : "—"}
                      </td>

                      <Td align="center" style={{ borderBottom: isLastInGroup ? `2px solid ${C.gBdr}` : `1px solid ${C.border}` }}>
                        <StateBdg state={row.submissionState} />
                      </Td>

                      <Td align="center" style={{ borderBottom: isLastInGroup ? `2px solid ${C.gBdr}` : `1px solid ${C.border}` }}>
                        <ReviewMini status={row.supervisorReviewStatus} />
                      </Td>

                      <Td align="center" style={{ borderBottom: isLastInGroup ? `2px solid ${C.gBdr}` : `1px solid ${C.border}` }}>
                        <ReviewMini status={row.accountingReviewStatus} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: C.gBg }}>
                  <td colSpan={5} style={{ padding: "10px 12px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: C.sage, borderTop: `2px solid ${C.gBdr}`, fontFamily: FONT }}>
                    Grand Total — {uniqueSubmissionCount} submission{uniqueSubmissionCount !== 1 ? "s" : ""}, {aggregatedRows.length} line{aggregatedRows.length !== 1 ? "s" : ""}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: MONO, fontSize: 12, fontWeight: 700, color: C.dark, borderTop: `2px solid ${C.gBdr}` }}>
                    {totalBales.toLocaleString()}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: MONO, fontSize: 12, fontWeight: 700, color: hasEstimates ? C.amber : C.dark, borderTop: `2px solid ${C.gBdr}` }}>
                    {hasEstimates ? "~" : ""}{fmtQty(totalQtyKg, "kg")}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: MONO, fontSize: 12, fontWeight: 600, color: C.gray, borderTop: `2px solid ${C.gBdr}` }}>
                    {fmtQty(totalTheoreticalKg, "kg")}
                  </td>
                  <td style={{
                    padding: "10px 12px", textAlign: "right", fontFamily: MONO, fontSize: 12, fontWeight: 700,
                    borderTop: `2px solid ${C.gBdr}`,
                    color: totalDiffKg > 0 ? C.forest : totalDiffKg < 0 ? C.red : C.muted,
                  }}>
                    {totalDiffKg !== 0 ? (totalDiffKg > 0 ? "+" : "") + fmtQty(Math.abs(totalDiffKg), "kg") : "—"}
                  </td>
                  <td colSpan={3} style={{ borderTop: `2px solid ${C.gBdr}` }} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
