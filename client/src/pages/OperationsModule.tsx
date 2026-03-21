/**
 * Operations Dashboard
 * Matches Finance module UI patterns exactly:
 * - Same sidebar layout, company selector, period bar
 * - Same color palette (#2D5A3D, #4A7C59, #E4EFE6, etc.)
 * - Same card/table/chart styling
 * - Lazy loading per section (enabled only when section is active)
 * - All charts have defined heights (no infinite expansion)
 */
import { useState, useEffect, memo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, ReferenceLine,
} from "recharts";
import { RefTooltip, RefChartTooltip } from "@/components/RefTooltip";
import { CompanySelector } from "@/components/CompanySelector";
import { useCompanySelector } from "@/hooks/useCompanySelector";
import { PlatfarmLogo } from "@/components/PlatfarmLogo";

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = ["#2D5A3D", "#4A7C59", "#C0714A", "#3B6CCF", "#D4960A", "#7B2D8B", "#C94444", "#6B8E6B", "#B8A87A", "#5B8DB8", "#A05C2A", "#3D7A6E"];

const SOURCE_COLORS: Record<string, string> = {
  "Dakhla": "#2D5A3D",
  "Farafra": "#4A7C59",
  "Farafrah": "#4A7C59",
  "Toshka": "#C0714A",
  "Unknown": "#B0BAB6",
};

function getSourceColor(name: string, idx: number): string {
  for (const [key, color] of Object.entries(SOURCE_COLORS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return COLORS[idx % COLORS.length];
}


// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Sk = memo(({ w = "100%", h = 20, r = 6 }: { w?: string | number; h?: number; r?: number }) => (
  <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#EDEBE8 25%,#F7F6F3 50%,#EDEBE8 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
));
const PageSkeleton = memo(() => (
  <div style={{ padding: 20 }}>
    <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ background: "#fff", border: "1px solid #E4E1DC", borderRadius: 9, padding: 16 }}>
          <Sk w="60%" h={10} /><div style={{ marginTop: 8 }}><Sk w="80%" h={24} /></div><div style={{ marginTop: 6 }}><Sk w="40%" h={10} /></div>
        </div>
      ))}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {[1, 2].map(i => (
        <div key={i} style={{ background: "#fff", border: "1px solid #E4E1DC", borderRadius: 9, padding: 16 }}>
          <Sk w="40%" h={14} /><div style={{ marginTop: 16 }}>{[1, 2, 3, 4].map(j => (<div key={j} style={{ marginTop: 8 }}><Sk h={12} /></div>))}</div>
        </div>
      ))}
    </div>
  </div>
));

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = memo(({ label, value, sub, accent = "#2D5A3D" }: { label: string; value: string; sub?: string; accent?: string }) => (
  <div style={{ background: "#fff", border: "1px solid #E4E1DC", borderRadius: 9, padding: "9px 10px", borderLeft: `4px solid ${accent}` }}>
    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#4A7C59", letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 700, color: accent }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: "#95A09C", marginTop: 2 }}>{sub}</div>}
  </div>
));

// ─── Section Card ─────────────────────────────────────────────────────────────
const SectionCard = memo(({ title, count, action, children }: { title: string; count?: string | number; action?: React.ReactNode; children: React.ReactNode }) => (
  <div style={{ background: "#fff", border: "1px solid #E4E1DC", borderRadius: 9, overflow: "hidden", marginBottom: 16 }}>
    <div style={{ background: "#2D5A3D", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>{title}</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {action}
        {count !== undefined && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,.7)" }}>{count}</span>}
      </div>
    </div>
    <div style={{ padding: 16 }}>{children}</div>
  </div>
));

// ─── Period Bar ───────────────────────────────────────────────────────────────
const PERIOD_OPTS = [
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "90d", label: "90 Days" },
  { key: "ytd", label: "YTD" },
  { key: "custom", label: "Custom" },
];
const PeriodBar = memo(({ value, onChange, cf, ct, oCf, oCt }: { value: string; onChange: (v: string) => void; cf: string; ct: string; oCf: (v: string) => void; oCt: (v: string) => void }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
    <span style={{ fontSize: 10, fontWeight: 700, color: "#95A09C", textTransform: "uppercase", letterSpacing: 0.5 }}>PERIOD:</span>
    {PERIOD_OPTS.map(o => (
      <button key={o.key} onClick={() => onChange(o.key)} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid", borderColor: value === o.key ? "#2D5A3D" : "#E4E1DC", background: value === o.key ? "#2D5A3D" : "#fff", color: value === o.key ? "#fff" : "#64706C", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all .15s" }}>
        {o.label}
      </button>
    ))}
    {value === "custom" && (
      <>
        <input type="date" value={cf} onChange={e => oCf(e.target.value)} style={{ height: 30, padding: "0 8px", border: "1px solid #E4E1DC", borderRadius: 6, fontSize: 11, color: "#2C3E50", outline: "none" }} />
        <span style={{ fontSize: 11, color: "#95A09C" }}>→</span>
        <input type="date" value={ct} onChange={e => oCt(e.target.value)} style={{ height: 30, padding: "0 8px", border: "1px solid #E4E1DC", borderRadius: 6, fontSize: 11, color: "#2C3E50", outline: "none" }} />
      </>
    )}
  </div>
));

// ─── Chart tooltip ────────────────────────────────────────────────────────────
const ChartTip = memo(({ active, payload, label, unit = "", prefix = "" }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #E4E1DC", borderRadius: 7, padding: "8px 12px", fontSize: 11, boxShadow: "0 4px 12px rgba(0,0,0,.08)" }}>
      <div style={{ fontWeight: 700, color: "#2C3E50", marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || "#2D5A3D" }}>{p.name}: <strong>{prefix}{typeof p.value === "number" ? p.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : p.value}{unit}</strong></div>
      ))}
    </div>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

const SectionError = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 24px" }}>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>⚠</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#C94444", marginBottom: 4 }}>Failed to load data</div>
      <div style={{ fontSize: 11, color: C.muted }}>Check your connection or refresh the page.</div>
    </div>
  </div>
);
export default function OperationsModule() {
  const [, setLocation] = useLocation();
  const [pg, setPg] = useState("supply");
  const [sideCol, setSideCol] = useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const {
    companies,
    companiesLoading,
    activeCompanyId,
    activeCompany,
    companyLabel,
    setActiveCompany,
    companyResolved,
    isAdmin,
  } = useCompanySelector();

  // ─── Derived company params ─────────────────────────────────────────────────
  const companyIdParam = activeCompanyId === "ALL" ? undefined : activeCompanyId as number;

  // Period state per section — default 30d for faster initial load
  const [supplyP, setSupplyP] = useState("30d"); const [supplyF, setSupplyF] = useState(""); const [supplyT, setSupplyT] = useState("");
  // Source filter: set when user clicks a slice in the Tons by Source pie chart
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  // Warehouse / Location filters for Supply Chain
  const [supplyWarehouse, setSupplyWarehouse] = useState<string>("all");
  const [supplyLocation, setSupplyLocation] = useState<string>("all");
  // Supplier toggle state for the Weekly Avg Price/Ton chart (null = use default top-8)
  const [activeSuppliers, setActiveSuppliers] = useState<Set<string> | null>(null);
  const [qualityP, setQualityP] = useState("30d"); const [qualityF, setQualityF] = useState(""); const [qualityT, setQualityT] = useState("");
  const [prodP, setProdP] = useState("30d"); const [prodF, setProdF] = useState(""); const [prodT, setProdT] = useState("");
  const [exportP, setExportP] = useState("30d"); const [exportF, setExportF] = useState(""); const [exportT, setExportT] = useState("");
  const [logisticsP, setLogisticsP] = useState("30d"); const [logisticsF, setLogisticsF] = useState(""); const [logisticsT, setLogisticsT] = useState("");



  const [isMob, setIsMob] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMob(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const sw = isMob ? 0 : (sideCol ? 48 : 190);

  // ─── tRPC queries (lazy per section) ───────────────────────────────────────
  // Only fire queries when company is resolved AND a specific company is selected (never ALL)
  const queryReady = companyResolved && typeof activeCompanyId === "number";
  const supplyQ = trpc.operations.supply.useQuery({ companyId: companyIdParam!, period: supplyP, customFrom: supplyP === "custom" ? supplyF : undefined, customTo: supplyP === "custom" ? supplyT : undefined, warehouseCode: supplyWarehouse !== "all" ? supplyWarehouse : undefined, locationId: supplyLocation !== "all" ? Number(supplyLocation) : undefined }, { enabled: queryReady && pg === "supply" });
  const qualityQ = trpc.operations.quality.useQuery({ companyId: companyIdParam!, period: qualityP, customFrom: qualityP === "custom" ? qualityF : undefined, customTo: qualityP === "custom" ? qualityT : undefined }, { enabled: queryReady && pg === "quality" });
  const prodQ = trpc.operations.production.useQuery({ companyId: companyIdParam!, period: prodP, customFrom: prodP === "custom" ? prodF : undefined, customTo: prodP === "custom" ? prodT : undefined }, { enabled: queryReady && pg === "production" });
  const exportQ = trpc.operations.export.useQuery({ companyId: companyIdParam!, period: exportP, customFrom: exportP === "custom" ? exportF : undefined, customTo: exportP === "custom" ? exportT : undefined }, { enabled: queryReady && pg === "export" });
  const logisticsQ = trpc.operations.logistics.useQuery({ companyId: companyIdParam!, period: logisticsP, customFrom: logisticsP === "custom" ? logisticsF : undefined, customTo: logisticsP === "custom" ? logisticsT : undefined }, { enabled: queryReady && pg === "logistics" });

  const todayLabel = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const navItems: [string, string, string][] = [
    ["supply", "Supply Chain", "Procurement"],
    ["logistics", "Logistics", "Costs & Machine"],
    ["quality", "Quality", "Analytics"],
    ["production", "Production", "Output"],
    ["export", "Export", "Shipments"],
  ];
  const navIcons: Record<string, string> = { supply: "🌾", quality: "🔬", production: "🏭", export: "🚢", logistics: "🚛" };
  const pageTitle: Record<string, string> = { supply: "Supply Chain", quality: "Quality Analytics", production: "Production", export: "Export Analytics", logistics: "Logistics" };

  const fmt = (n: number, d = 0) => n.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });

  return (
    <div style={{ display: "flex", height: "100vh", background: "#F8F6F2", fontFamily: "'DM Sans', system-ui, sans-serif", overflow: "hidden" }}>
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .ops-sb{display:flex;flex-direction:column;background:#fff;border-right:1px solid #E4E1DC;transition:width .2s;overflow:hidden;flex-shrink:0}
        .ops-sb-logo{padding:14px 16px;border-bottom:1px solid #E4E1DC;cursor:pointer;display:flex;align-items:center}
        .app-sb-ni{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;transition:background .15s;font-size:12px;font-weight:500;color:#64706C;white-space:nowrap;overflow:hidden;border-right:3px solid transparent}
        .app-sb-ni:hover{background:#F2F7F3}
        .app-sb-ni.app-sb-act{background:#E4EFE6;color:#2D5A3D;font-weight:700;border-right-color:#2D5A3D}
        .app-sb-ns{font-size:9px;color:#95A09C;margin-top:1px;font-weight:400}
        .ops-ph{padding:14px 20px;border-bottom:1px solid #E4E1DC;display:flex;align-items:center;justify-content:space-between;background:#fff;position:sticky;top:0;z-index:10}
        .ops-pt{font-size:18px;font-weight:700;color:#1A2B24;display:flex;align-items:center;gap:10px}
        .tbl{width:100%;border-collapse:collapse}
        .tbl th{font-size:9px;font-weight:700;text-transform:uppercase;color:#4A7C59;letter-spacing:.5px;padding:8px 10px;text-align:left;border-bottom:1px solid #E4E1DC}
        .tbl td{font-size:11.5px;color:#2C3E50;padding:10px;border-bottom:1px solid #F2F0EC}
        .tbl tr:hover td{background:#FAFAF8}
        .mn{font-family:'JetBrains Mono',monospace;font-weight:600}
        .sg2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .sg3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
        .sg4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
        @media(max-width:900px){.sg2{grid-template-columns:1fr!important}.sg3{grid-template-columns:1fr!important}.sg4{grid-template-columns:repeat(2,1fr)!important}}
        @media(max-width:767px){.ops-sb{display:none!important}}
      `}</style>

      {/* ═══ SIDEBAR ═══ */}
      <div className="ops-sb" style={{ width: sw, minWidth: sw }}>
        <div className="ops-sb-logo" onClick={() => setSideCol(!sideCol)}><PlatfarmLogo height={sideCol ? 24 : 28} treeColor="#1B3A2D" textColor="#D4845F" /></div>
        <div style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          <div className="app-sb-ni" onClick={() => setLocation("/")} style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 15 }}>🏠</span>{!sideCol && <span>Home</span>}
          </div>
          {navItems.map(([k, l, sub]) => (
            <div key={k} className={`app-sb-ni ${pg === k ? "app-sb-act" : ""}`} onClick={() => setPg(k)}>
              <span style={{ fontSize: 13 }}>{navIcons[k]}</span>
              {!sideCol && <div>{l}<div className="app-sb-ns">{sub}</div></div>}
            </div>
          ))}
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #E4E1DC", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#2D5A3D", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>MH</div>
          {!sideCol && <div><div style={{ fontSize: 11, fontWeight: 600, color: "#2C3E50" }}>Mohamed</div><div style={{ fontSize: 8, color: "#B0BAB6" }}>Admin</div></div>}
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div className="ops-ph">
          <div className="ops-pt">
            {pageTitle[pg] || "Operations"}
            <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 10, fontWeight: 600, background: "#E4EFE6", color: "#2D5A3D" }}>{companyLabel}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Company Selector */}
            <CompanySelector
              companies={companies}
              companiesLoading={companiesLoading}
              activeCompanyId={activeCompanyId}
              activeCompany={activeCompany}
              companyLabel={companyLabel}
              setActiveCompany={setActiveCompany}
              allowAll={isAdmin}
              open={companyDropdownOpen}
              onOpenChange={setCompanyDropdownOpen}
            />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#95A09C" }}>{todayLabel}</span>
          </div>
        </div>

        {/* Page Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

          {/* ═══ SUPPLY CHAIN ═══ */}
          {pg === "supply" && (supplyQ.isLoading ? <PageSkeleton /> : supplyQ.isError ? <SectionError /> : supplyQ.data ? (() => {
            const d = supplyQ.data;
            return (
              <div>
                <PeriodBar value={supplyP} onChange={setSupplyP} cf={supplyF} ct={supplyT} oCf={setSupplyF} oCt={setSupplyT} />
                {/* Warehouse / Location filters */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#95A09C", textTransform: "uppercase", letterSpacing: 0.5 }}>FILTER:</span>
                  <select value={supplyWarehouse} onChange={e => { setSupplyWarehouse(e.target.value); setSupplyLocation("all"); }} style={{ height: 30, padding: "0 10px", border: "1px solid", borderColor: supplyWarehouse !== "all" ? "#2D5A3D" : "#E4E1DC", borderRadius: 6, fontSize: 11, fontWeight: 600, color: supplyWarehouse !== "all" ? "#2D5A3D" : "#64706C", background: supplyWarehouse !== "all" ? "#E4EFE6" : "#fff", cursor: "pointer", outline: "none" }}>
                    <option value="all">All Warehouses</option>
                    {(d.availableWarehouses || []).map((wh: { code: string; label: string }) => (
                      <option key={wh.code} value={wh.code}>{wh.label}</option>
                    ))}
                  </select>
                  <select value={supplyLocation} onChange={e => setSupplyLocation(e.target.value)} style={{ height: 30, padding: "0 10px", border: "1px solid", borderColor: supplyLocation !== "all" ? "#2D5A3D" : "#E4E1DC", borderRadius: 6, fontSize: 11, fontWeight: 600, color: supplyLocation !== "all" ? "#2D5A3D" : "#64706C", background: supplyLocation !== "all" ? "#E4EFE6" : "#fff", cursor: "pointer", outline: "none" }}>
                    <option value="all">All Locations</option>
                    {(supplyWarehouse !== "all" && d.warehouseLocations?.[supplyWarehouse]
                      ? d.warehouseLocations[supplyWarehouse]
                      : (d.availableLocations || [])
                    ).map((loc: { id: number; name: string }) => (
                      <option key={loc.id} value={String(loc.id)}>{loc.name}</option>
                    ))}
                  </select>
                  {(supplyWarehouse !== "all" || supplyLocation !== "all") && (
                    <button onClick={() => { setSupplyWarehouse("all"); setSupplyLocation("all"); }} style={{ height: 30, padding: "0 10px", border: "1px solid #C0714A", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#C0714A", background: "#FDF4EF", cursor: "pointer" }}>✕ Clear</button>
                  )}
                </div>
                {/* KPIs */}
                <div className="sg4">
                  <KpiCard label="Total Tons Received" value={fmt(d.totalTons, 1) + " t"} sub={`${d.totalLoads} loads`} accent="#2D5A3D" />
                  <KpiCard label="Avg Protein" value={d.avgProtein > 0 ? d.avgProtein.toFixed(1) + "%" : "—"} sub={d.avgProtein > 0 ? "Dry matter basis" : "No NIR data yet"} accent="#4A7C59" />
                  <KpiCard label="Avg Cost/Ton" value={d.avgCostPerTon > 0 ? "$" + fmt(d.avgCostPerTon, 2) : "—"} sub={d.egpToUsdRate ? `Rate: ${(1/d.egpToUsdRate).toFixed(0)} EGP/USD` : "Per ton (USD)"} accent="#C0714A" />
                  <KpiCard label="Sources" value={String(d.sources.length)} sub="Active supply sources" accent="#3B6CCF" />
                </div>

                <div className="sg2">
                  {/* Tons by Source */}
                  <SectionCard title="🌍 Tons by Source" count={d.sources.length + " sources"}>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={d.sources}
                          dataKey="tons"
                          nameKey="name"
                          cx="50%"
                          cy="45%"
                          outerRadius={80}
                          innerRadius={36}
                          paddingAngle={2}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                          style={{ cursor: "pointer" }}
                          onClick={(entry: any) => {
                            const src = entry?.name;
                            setSelectedSource(prev => prev === src ? null : src);
                          }}
                        >
                          {d.sources.map((s: any, i: number) => (
                            <Cell
                              key={i}
                              fill={getSourceColor(s.name, i)}
                              opacity={selectedSource && selectedSource !== s.name ? 0.35 : 1}
                              stroke={selectedSource === s.name ? "#1a3d28" : "none"}
                              strokeWidth={selectedSource === s.name ? 2 : 0}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<RefChartTooltip dataKey="tons" refsKey="refs" valueLabel="Tons" valueFormatter={(v) => fmt(v, 1) + " t"} />} />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 10, paddingTop: 8 }} formatter={(value: string) => {
                          const s = d.sources.find((x: any) => x.name === value);
                          const pct = s && d.totalTons > 0 ? ((s.tons / d.totalTons) * 100).toFixed(0) : "0";
                          return `${value} (${pct}%)`;
                        }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </SectionCard>

                  {/* Grade Distribution */}
                  <SectionCard title="📊 Grade Distribution" count={d.grades.length + " grades"}>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={d.grades} dataKey="tons" nameKey="name" cx="50%" cy="45%" outerRadius={75} innerRadius={35} paddingAngle={2}>
                          {d.grades.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<RefChartTooltip dataKey="tons" refsKey="refs" valueLabel="Tons" valueFormatter={(v) => fmt(v, 1) + " t"} />} />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 10, paddingTop: 8 }} formatter={(value: string) => {
                          const g = d.grades.find(x => x.name === value);
                          const pct = g && d.totalTons > 0 ? ((g.tons / d.totalTons) * 100).toFixed(0) : "0";
                          return `${value} (${pct}%)`;
                        }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </SectionCard>
                </div>

                {/* Weekly Trend */}
                <SectionCard title="📈 Weekly Supply Trend" count={(d.weeklySources || []).length + " sources"}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={d.weekly} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F2F0EC" />
                      <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v, 0) + "t"} />
                      <Tooltip content={<RefChartTooltip dataKey="" refsKey="refs" valueLabel="Tons" valueFormatter={(v) => fmt(v, 1) + " t"} />} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                      {(d.weeklySources || []).map((src: string, i: number) => (
                        <Bar key={src} dataKey={src} name={src} stackId="a" fill={getSourceColor(src, i)} radius={i === (d.weeklySources || []).length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </SectionCard>

                {/* Avg Price per Ton Trend */}
{d.weeklyPriceTrend && d.weeklyPriceTrend.length > 0 && (
                  <SectionCard title="💰 Avg Price per Ton (USD)" count={d.priceTrendSources?.length + " sources"}>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={d.weeklyPriceTrend} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F2F0EC" />
                        <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => "$" + fmt(v, 0)} />
                        <Tooltip content={<RefChartTooltip dataKey="" refsKey="refs" valueLabel="Price/Ton" valueFormatter={(v) => "$" + fmt(v, 2)} />} />
                        {(d.priceTrendSources || []).map((src: string, i: number) => (
                          <Bar key={src} dataKey={src} name={src} fill={getSourceColor(src, i)} radius={[4, 4, 0, 0]} />
                        ))}
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </SectionCard>
                )}

                {/* Weekly Avg Price/Ton by Supplier */}
                {d.weeklySupplierPriceTrend && d.weeklySupplierPriceTrend.length > 0 && d.supplierPriceTrendNames && d.supplierPriceTrendNames.length > 0 && (() => {
                  // All suppliers ranked by volume
                  const supplierTonMap: Record<string, number> = {};
                  for (const s of d.suppliers) supplierTonMap[s.name] = s.tons;
                  const allRanked = [...d.supplierPriceTrendNames]
                    .sort((a: string, b: string) => (supplierTonMap[b] || 0) - (supplierTonMap[a] || 0));
                  // Default: top 8 if no explicit selection
                  const defaultActive = new Set(allRanked.slice(0, 8));
                  const effectiveActive = activeSuppliers ?? defaultActive;
                  const visibleSuppliers = allRanked.filter((s: string) => effectiveActive.has(s));

                  const toggleSupplier = (sup: string) => {
                    const current = activeSuppliers ?? defaultActive;
                    const next = new Set(current);
                    if (next.has(sup)) { next.delete(sup); } else { next.add(sup); }
                    setActiveSuppliers(next);
                  };
                  const selectAll = () => setActiveSuppliers(new Set(allRanked));
                  const selectNone = () => setActiveSuppliers(new Set());
                  const resetDefault = () => setActiveSuppliers(null);

                  return (
                  <SectionCard title="📈 Weekly Avg Price/Ton by Supplier (USD)" count={`${visibleSuppliers.length} of ${allRanked.length} suppliers`}>
                    {/* Supplier toggle pills */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12, alignItems: "center" }}>
                      <button onClick={selectAll} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, border: "1px solid #E4E1DC", background: "#F8F7F4", color: "#64706C", cursor: "pointer" }}>All</button>
                      <button onClick={selectNone} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, border: "1px solid #E4E1DC", background: "#F8F7F4", color: "#64706C", cursor: "pointer" }}>None</button>
                      {activeSuppliers !== null && (
                        <button onClick={resetDefault} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, border: "1px solid #C0714A", background: "rgba(192,113,74,0.08)", color: "#C0714A", cursor: "pointer" }}>Reset</button>
                      )}
                      <div style={{ width: 1, height: 16, background: "#E4E1DC", margin: "0 2px" }} />
                      {allRanked.map((sup: string, i: number) => {
                        const isActive = effectiveActive.has(sup);
                        const color = COLORS[i % COLORS.length];
                        return (
                          <button
                            key={sup}
                            onClick={() => toggleSupplier(sup)}
                            title={sup}
                            style={{
                              fontSize: 10, padding: "2px 10px", borderRadius: 10, cursor: "pointer",
                              border: `1px solid ${isActive ? color : "#E4E1DC"}`,
                              background: isActive ? color + "22" : "#F8F7F4",
                              color: isActive ? color : "#95A09C",
                              fontWeight: isActive ? 600 : 400,
                              maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              transition: "all 0.15s",
                            }}
                          >
                            {sup.length > 20 ? sup.slice(0, 18) + "…" : sup}
                          </button>
                        );
                      })}
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={d.weeklySupplierPriceTrend} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F2F0EC" />
                        <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => "$" + fmt(v, 0)} domain={["auto", "auto"]} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const sorted = [...payload].filter(p => p.value != null).sort((a, b) => (b.value as number) - (a.value as number));
                            return (
                              <div style={{ background: "#fff", border: "1px solid #E4E1DC", borderRadius: 8, padding: "10px 14px", fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,.08)", maxWidth: 280 }}>
                                <div style={{ fontWeight: 700, marginBottom: 6, color: "#1a1a1a" }}>{label}</div>
                                {sorted.map((p, i) => (
                                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}>
                                    <span style={{ color: p.color as string, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>{p.name}</span>
                                    <span style={{ fontWeight: 700, color: "#1a1a1a", whiteSpace: "nowrap" }}>${fmt(p.value as number, 2)}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          }}
                        />
                        {visibleSuppliers.map((sup: string) => {
                          const colorIdx = allRanked.indexOf(sup);
                          const color = COLORS[colorIdx % COLORS.length];
                          return (
                            <Line
                              key={sup}
                              type="monotone"
                              dataKey={sup}
                              name={sup}
                              stroke={color}
                              strokeWidth={2}
                              dot={{ r: 3, fill: color }}
                              connectNulls={false}
                              activeDot={{ r: 5 }}
                            />
                          );
                        })}
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </SectionCard>
                  );
                })()}

                {/* Supplier Ranking */}
                {(() => {
                  const filteredSuppliers = selectedSource
                    ? d.suppliers.filter((s: any) => (s.sources || []).includes(selectedSource))
                    : d.suppliers;

                  // Compute per-supplier price change badge from weeklySupplierPriceTrend
                  // Find the last two weeks each supplier has price data and compute % change
                  const priceChanges: Record<string, { pct: number; prev: number; curr: number }> = {};
                  if (d.weeklySupplierPriceTrend && d.weeklySupplierPriceTrend.length >= 2) {
                    const trend = d.weeklySupplierPriceTrend as Record<string, unknown>[];
                    for (const sup of (d.supplierPriceTrendNames || []) as string[]) {
                      // Walk backwards to find last two weeks with a non-null price
                      const weeks: number[] = [];
                      for (let i = trend.length - 1; i >= 0 && weeks.length < 2; i--) {
                        const v = trend[i][sup];
                        if (v != null && typeof v === "number" && v > 0) weeks.push(v);
                      }
                      if (weeks.length === 2) {
                        const curr = weeks[0]; const prev = weeks[1];
                        const pct = ((curr - prev) / prev) * 100;
                        priceChanges[sup] = { pct, prev, curr };
                      }
                    }
                  }

                  return (
                    <SectionCard
                      title="🏆 Supplier Ranking"
                      count={selectedSource ? `${filteredSuppliers.length} of ${d.suppliers.length} suppliers` : d.suppliers.length + " suppliers"}
                      action={selectedSource ? (
                        <button
                          onClick={() => setSelectedSource(null)}
                          style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid #C0714A", background: "rgba(192,113,74,0.2)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}
                        >
                          🌍 {selectedSource} ✕
                        </button>
                      ) : undefined}
                    >
                      <table className="tbl">
                        <thead><tr><th>Supplier</th><th>WH</th><th>Tons</th><th>Loads</th><th>Avg Protein</th><th>Avg Cost/Ton</th><th>Volume</th></tr></thead>
                        <tbody>
                          {filteredSuppliers.map((s: any, i: number) => {
                            const pct = d.totalTons > 0 ? (s.tons / d.totalTons) * 100 : 0;
                            const change = priceChanges[s.name];
                            return (
                              <tr key={i}>
                                <td style={{ fontWeight: 600 }}>{s.name}</td>
                                <td className="mn" style={{ fontSize: 11, color: "#6B7280", whiteSpace: "nowrap" }}>{s.warehouse || "—"}</td>
                                <td className="mn"><RefTooltip refs={s.refs || []} label="Loads">{fmt(s.tons, 1)} t</RefTooltip></td>
                                <td className="mn"><RefTooltip refs={s.refs || []} label="Loads">{s.loads}</RefTooltip></td>
                                <td className="mn" style={{ color: s.avgProtein >= 16 ? "#2D5A3D" : s.avgProtein >= 14 ? "#D4960A" : "#95A09C" }}><RefTooltip refs={s.refs || []} label="Loads">{s.avgProtein > 0 ? s.avgProtein.toFixed(1) + "%" : "—"}</RefTooltip></td>
                                <td className="mn">
                                  <RefTooltip refs={s.refs || []} label="Loads">
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span>{s.avgPrice > 0 ? "$" + fmt(s.avgPrice, 2) : "—"}</span>
                                      {change && (
                                        <span
                                          title={`Prev week: $${fmt(change.prev, 2)} → Latest: $${fmt(change.curr, 2)}`}
                                          style={{
                                            fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                                            background: change.pct > 0 ? "rgba(201,68,68,0.12)" : "rgba(45,90,61,0.12)",
                                            color: change.pct > 0 ? "#C94444" : "#2D5A3D",
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          {change.pct > 0 ? "↑" : "↓"} {Math.abs(change.pct).toFixed(1)}%
                                        </span>
                                      )}
                                    </div>
                                  </RefTooltip>
                                </td>
                                <td style={{ width: 120 }}><RefTooltip refs={s.refs || []} label="Loads"><div style={{ height: 8, background: "#F2F0EC", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: pct + "%", background: "#2D5A3D", borderRadius: 4 }} /></div></RefTooltip></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </SectionCard>
                  );
                })()}
              </div>
            );
          })() : <div style={{ padding: 40, textAlign: "center", color: "#95A09C" }}>No supply data for this period</div>)}

          {/* ═══ QUALITY ═══ */}
          {pg === "quality" && (qualityQ.isLoading ? <PageSkeleton /> : qualityQ.isError ? <SectionError /> : qualityQ.data ? (() => {
            const d = qualityQ.data;
            return (
              <div>
                <PeriodBar value={qualityP} onChange={setQualityP} cf={qualityF} ct={qualityT} oCf={setQualityF} oCt={setQualityT} />
                {/* KPIs */}
                <div className="sg4">
                  <KpiCard label="Quality Records" value={String(d.totalWithQuality)} sub={`of ${d.totalPickings} loads`} accent="#2D5A3D" />
                  <KpiCard label="Completion Rate" value={d.qualityCompletionRate + "%"} sub="Records with quality data" accent={d.qualityCompletionRate >= 80 ? "#2D5A3D" : d.qualityCompletionRate >= 50 ? "#D4960A" : "#C94444"} />
                  <KpiCard label="Missing Records" value={String(d.totalWithoutQuality)} sub="No quality data" accent="#C94444" />
                  <KpiCard label="Sources Analyzed" value={String(d.sourceQuality.length)} sub="Active sources" accent="#3B6CCF" />
                </div>

                <div className="sg2">
                  {/* Protein Distribution */}
                  <SectionCard title="🧪 Protein Distribution (% DM) in Tons">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={d.proteinBuckets} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F2F0EC" />
                        <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v, 1) + " t"} />
                        <Tooltip content={<RefChartTooltip dataKey="tons" refsKey="refs" valueLabel="Tons" valueFormatter={(v) => fmt(v, 1) + " t"} />} />
                        <Bar dataKey="tons" name="Tons" radius={[4, 4, 0, 0]}>
                          {d.proteinBuckets.map((b: any, i: number) => {
                            const color = b.range === "<16%" ? "#C94444" : b.range === "16-18%" ? "#D4960A" : b.range === ">22%" ? "#7B2D8B" : "#2D5A3D";
                            return <Cell key={i} fill={color} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </SectionCard>

                  {/* Moisture Distribution */}
                  <SectionCard title="💧 Moisture Distribution">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={d.moistureBuckets} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F2F0EC" />
                        <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip content={<RefChartTooltip dataKey="tons" refsKey="refs" valueLabel="Tons" valueFormatter={(v) => fmt(v, 1) + " t"} />} />
                        <Bar dataKey="tons" name="Tons" radius={[4, 4, 0, 0]}>
                          {d.moistureBuckets.map((b: any, i: number) => {
                            const color = b.range === ">16%" ? "#C94444" : b.range === "14-16%" ? "#D4960A" : "#3B6CCF";
                            return <Cell key={i} fill={color} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </SectionCard>
                </div>

                {/* Weekly Protein Trend */}
                {d.weeklyProteinTrend.length > 0 && (
                  <SectionCard title="📈 Weekly Avg Protein Trend">
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={d.weeklyProteinTrend} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F2F0EC" />
                        <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                        <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} />
                        <Tooltip content={<RefChartTooltip dataKey="avgProtein" refsKey="refs" valueLabel="Avg Protein" valueFormatter={(v: number) => v > 0 ? v.toFixed(2) + "%" : "No NIR data"} subLabel={(p: any) => p?.proteinCount > 0 ? `${p.proteinCount}/${p.loadCount} loads with NIR` : `${p?.loadCount || 0} loads — no NIR data`} />} />
                        <Line type="monotone" dataKey="avgProtein" name="Avg Protein" stroke="#2D5A3D" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </SectionCard>
                )}

                <div className="sg2">
                  {/* Quality by Source */}
                  <SectionCard title="🌍 Quality by Source">
                    <table className="tbl">
                      <thead><tr><th>Source</th><th>WH</th><th>Tons</th><th>Avg Protein</th><th>Avg Moisture</th><th>Avg ADF</th><th>Avg NDF</th></tr></thead>
                      <tbody>
                        {d.sourceQuality.map((s: any, i: number) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                            <td className="mn" style={{ color: "#2D5A3D", fontWeight: 600, fontSize: 11 }}>{s.warehouses || "—"}</td>
                            <td className="mn"><RefTooltip refs={s.refs || []} label="Loads">{fmt(s.tons, 1)} t</RefTooltip></td>
                            <td className="mn" style={{ color: s.avgProtein >= 16 ? "#2D5A3D" : s.avgProtein >= 14 ? "#D4960A" : "#95A09C" }}><RefTooltip refs={s.refs || []} label="Loads">{s.avgProtein > 0 ? s.avgProtein.toFixed(1) + "%" : "—"}</RefTooltip></td>
                            <td className="mn" style={{ color: s.avgMoisture > 14 ? "#C94444" : s.avgMoisture > 12 ? "#D4960A" : "#2D5A3D" }}><RefTooltip refs={s.refs || []} label="Loads">{s.avgMoisture > 0 ? s.avgMoisture.toFixed(1) + "%" : "—"}</RefTooltip></td>
                            <td className="mn"><RefTooltip refs={s.refs || []} label="Loads">{s.avgAdf > 0 ? s.avgAdf.toFixed(1) + "%" : "—"}</RefTooltip></td>
                            <td className="mn"><RefTooltip refs={s.refs || []} label="Loads">{s.avgNdf > 0 ? s.avgNdf.toFixed(1) + "%" : "—"}</RefTooltip></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </SectionCard>

                  {/* Quality by Grade */}
                  <SectionCard title="📊 Quality by Grade">
                    <table className="tbl">
                      <thead><tr><th>Grade</th><th>WH</th><th>Tons</th><th>Avg Protein</th></tr></thead>
                      <tbody>
                        {d.gradeQuality.map((g: any, i: number) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{g.name}</td>
                            <td className="mn" style={{ color: "#2D5A3D", fontWeight: 600, fontSize: 11 }}>{g.warehouses || "—"}</td>
                            <td className="mn"><RefTooltip refs={g.refs || []} label="Loads">{fmt(g.tons, 1)} t</RefTooltip></td>
                            <td className="mn" style={{ color: g.avgProtein >= 16 ? "#2D5A3D" : g.avgProtein >= 14 ? "#D4960A" : "#95A09C" }}><RefTooltip refs={g.refs || []} label="Loads">{g.avgProtein > 0 ? g.avgProtein.toFixed(1) + "%" : "—"}</RefTooltip></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </SectionCard>
                </div>

                {/* Supplier Quality Ranking */}
                <SectionCard title="🏆 Supplier Quality Ranking" count={d.supplierQuality.length + " suppliers"}>
                  <table className="tbl">
                    <thead><tr><th>Supplier</th><th>WH</th><th>Tons</th><th>Avg Protein</th><th>Avg Moisture</th><th>Avg ADF</th><th>Avg NDF</th><th>Protein Bar</th></tr></thead>
                    <tbody>
                      {d.supplierQuality.map((s: any, i: number) => {
                        const maxProt = Math.max(...d.supplierQuality.map((x: any) => x.avgProtein), 1);
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                            <td className="mn" style={{ color: "#2D5A3D", fontWeight: 600, fontSize: 11 }}>{s.warehouses || "—"}</td>
                            <td className="mn"><RefTooltip refs={s.refs || []} label="Loads">{fmt(s.tons, 1)} t</RefTooltip></td>
                            <td className="mn" style={{ color: s.avgProtein >= 16 ? "#2D5A3D" : s.avgProtein >= 14 ? "#D4960A" : "#95A09C" }}><RefTooltip refs={s.refs || []} label="Loads">{s.avgProtein > 0 ? s.avgProtein.toFixed(1) + "%" : "—"}</RefTooltip></td>
                            <td className="mn" style={{ color: s.avgMoisture > 14 ? "#C94444" : s.avgMoisture > 12 ? "#D4960A" : "#2D5A3D" }}><RefTooltip refs={s.refs || []} label="Loads">{s.avgMoisture > 0 ? s.avgMoisture.toFixed(1) + "%" : "—"}</RefTooltip></td>
                            <td className="mn"><RefTooltip refs={s.refs || []} label="Loads">{s.avgAdf > 0 ? s.avgAdf.toFixed(1) + "%" : "—"}</RefTooltip></td>
                            <td className="mn"><RefTooltip refs={s.refs || []} label="Loads">{s.avgNdf > 0 ? s.avgNdf.toFixed(1) + "%" : "—"}</RefTooltip></td>
                            <td style={{ width: 120 }}><RefTooltip refs={s.refs || []} label="Loads"><div style={{ height: 8, background: "#F2F0EC", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: maxProt > 0 ? (s.avgProtein / maxProt) * 100 + "%" : "0%", background: s.avgProtein >= 16 ? "#2D5A3D" : s.avgProtein >= 14 ? "#D4960A" : "#C94444", borderRadius: 4 }} /></div></RefTooltip></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </SectionCard>
              </div>
            );
          })() : <div style={{ padding: 40, textAlign: "center", color: "#95A09C" }}>No quality data for this period</div>)}

          {/* ═══ PRODUCTION ═══ */}
          {pg === "production" && (prodQ.isLoading ? <PageSkeleton /> : prodQ.isError ? <SectionError /> : prodQ.data ? (() => {
            const d = prodQ.data;
            return (
              <div>
                <PeriodBar value={prodP} onChange={setProdP} cf={prodF} ct={prodT} oCf={setProdF} oCt={setProdT} />
                {/* KPIs */}
                <div className="sg4">
                  <KpiCard label="Total Shifts" value={String(d.totalShifts)} sub="Production shifts" accent="#2D5A3D" />
                  <KpiCard label="Total Output" value={fmt(d.totalOutputBales)} sub="Bales produced" accent="#4A7C59" />
                  <KpiCard label="Premium + Grade 1" value={fmt(d.totalPremium + d.totalGrade1)} sub={d.totalOutputBales > 0 ? ((((d.totalPremium + d.totalGrade1) / d.totalOutputBales) * 100).toFixed(0) + "% of output") : "—"} accent="#C0714A" />
                  <KpiCard label="Diesel Consumed" value={d.totalDiesel > 0 ? fmt(d.totalDiesel) + " L" : "—"} sub="Total diesel" accent="#3B6CCF" />
                </div>

                <div className="sg2">
                  {/* Grade Distribution Pie */}
                  <SectionCard title="📊 Output Grade Distribution">
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={d.gradeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => percent > 0.03 ? `${name} ${(percent * 100).toFixed(0)}%` : ""} labelLine={false}>
                          {d.gradeDistribution.map((g, i) => <Cell key={i} fill={g.color} />)}
                        </Pie>
                        <Tooltip content={<RefChartTooltip dataKey="value" refsKey="refs" valueLabel="Bales" valueFormatter={(v) => fmt(v) + " bales"} />} />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </SectionCard>

                  {/* Bale Weight Distribution */}
                  <SectionCard title="⚖️ Bale Weight Distribution">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={d.baleWeightBuckets} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F2F0EC" />
                        <XAxis dataKey="range" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip content={<RefChartTooltip dataKey="count" refsKey="refs" valueLabel="Bales" valueFormatter={(v) => fmt(v) + " bales"} />} />
                        <Bar dataKey="count" name="Bales" fill="#4A7C59" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </SectionCard>
                </div>

                {/* Weekly Output Trend */}
                {d.weekly.length > 0 && (
                  <SectionCard title="📈 Weekly Output Trend (Bales)">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={d.weekly} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F2F0EC" />
                        <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v + " b"} />
                        <Tooltip content={<ChartTip />} />
                        <Bar dataKey="premium" name="Premium" stackId="a" fill="#7B2D8B" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="grade1" name="Grade 1" stackId="a" fill="#2D5A3D" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="fairGrade" name="Fair Grade" stackId="a" fill="#C0714A" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="alfamix" name="Alfamix" stackId="a" fill="#3B6CCF" radius={[4, 4, 0, 0]} />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </SectionCard>
                )}

                {/* Weekly Avg Protein Trend — Production Bales */}
                {d.weeklyBaleProteinTrend && d.weeklyBaleProteinTrend.length > 0 && (
                  <SectionCard title="🧪 Weekly Avg Protein Trend — Production Bales (% DM)" count={d.totalBaleQualityRecords + " bales assessed"}>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={d.weeklyBaleProteinTrend} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F2F0EC" />
                        <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v + "%"} domain={["auto", "auto"]} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const pt = payload[0]?.payload;
                            return (
                              <div style={{ background: "#fff", border: "1px solid #E4E1DC", borderRadius: 8, padding: "10px 14px", fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
                                <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
                                <div style={{ color: "#2D5A3D" }}>Avg Protein: <strong>{pt?.avgProtein > 0 ? pt.avgProtein.toFixed(1) + "% DM" : "No data"}</strong></div>
                                <div style={{ color: "#6B7280", marginTop: 2 }}>{pt?.count} bales assessed</div>
                                {pt?.refs?.length > 0 && (
                                  <div style={{ marginTop: 6, maxHeight: 80, overflowY: "auto" }}>
                                    {pt.refs.slice(0, 8).map((r: string, i: number) => (
                                      <div key={i} style={{ fontSize: 10, color: "#95A09C", fontFamily: "'JetBrains Mono',monospace" }}>{r}</div>
                                    ))}
                                    {pt.refs.length > 8 && <div style={{ fontSize: 10, color: "#95A09C" }}>+{pt.refs.length - 8} more</div>}
                                  </div>
                                )}
                              </div>
                            );
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="avgProtein"
                          name="Avg Protein % DM"
                          stroke="#2D5A3D"
                          strokeWidth={2}
                          dot={{ r: 4, fill: "#2D5A3D", strokeWidth: 0 }}
                          activeDot={{ r: 6, fill: "#2D5A3D" }}
                          connectNulls
                        />
                        {/* Reference line at 16% (target protein) */}
                        <ReferenceLine y={16} stroke="#D4960A" strokeDasharray="4 2" label={{ value: "Target 16%", position: "right", fontSize: 9, fill: "#D4960A" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </SectionCard>
                )}

                <div className="sg2">
                  {/* Input Sources */}
                  <SectionCard title="🌾 Input Sources" count={d.inputSources.length}>
                    <table className="tbl">
                      <thead><tr><th>Source</th><th>Shifts</th><th>Avg Bale Wt</th></tr></thead>
                      <tbody>
                        {d.inputSources.map((s: any, i: number) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                            <td className="mn"><RefTooltip refs={s.refs || []} label="Shifts">{s.shifts}</RefTooltip></td>
                            <td className="mn" style={{ color: s.avgBaleWeight >= 460 ? "#2D5A3D" : s.avgBaleWeight >= 420 ? "#D4960A" : "#C94444" }}><RefTooltip refs={s.refs || []} label="Shifts">{s.avgBaleWeight > 0 ? s.avgBaleWeight + " kg" : "—"}</RefTooltip></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </SectionCard>

                  {/* Machine Monitoring */}
                  <SectionCard title="⚙️ Machine Monitoring">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                      <div style={{ background: "#F8F6F2", borderRadius: 8, padding: "12px 16px", textAlign: "center" }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", marginBottom: 4 }}>Avg Oil Temp</div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 24, fontWeight: 700, color: d.avgOilTemp > 80 ? "#C94444" : d.avgOilTemp > 60 ? "#D4960A" : "#2D5A3D" }}>{d.avgOilTemp > 0 ? d.avgOilTemp + "°C" : "—"}</div>
                      </div>
                      <div style={{ background: "#F8F6F2", borderRadius: 8, padding: "12px 16px", textAlign: "center" }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", marginBottom: 4 }}>Max Oil Temp</div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 24, fontWeight: 700, color: d.maxOilTemp > 90 ? "#C94444" : d.maxOilTemp > 70 ? "#D4960A" : "#2D5A3D" }}>{d.maxOilTemp > 0 ? d.maxOilTemp + "°C" : "—"}</div>
                      </div>
                    </div>
                    {d.totalDiesel > 0 && (
                      <div style={{ background: "#E4EFE6", borderRadius: 8, padding: "12px 16px", textAlign: "center" }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", marginBottom: 4 }}>Total Diesel</div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 700, color: "#2D5A3D" }}>{fmt(d.totalDiesel)} L</div>
                      </div>
                    )}
                  </SectionCard>
                </div>
              </div>
            );
          })() : <div style={{ padding: 40, textAlign: "center", color: "#95A09C" }}>No production data for this period</div>)}

          {/* ═══ EXPORT ═══ */}
          {pg === "export" && (exportQ.isLoading ? <PageSkeleton /> : exportQ.isError ? <SectionError /> : exportQ.data ? (() => {
            const d = exportQ.data;
            return (
              <div>
                <PeriodBar value={exportP} onChange={setExportP} cf={exportF} ct={exportT} oCf={setExportF} oCt={setExportT} />
                {/* KPIs */}
                <div className="sg4">
                  <KpiCard label="Total Shipments" value={String(d.totalShipments)} sub="Export orders" accent="#2D5A3D" />
                  <KpiCard label="Total Containers" value={String(d.totalContainers)} sub="Containers/loads" accent="#4A7C59" />
                  <KpiCard label="Total Tons" value={fmt(d.totalTons, 1) + " t"} sub="Exported weight" accent="#C0714A" />
                  <KpiCard label="Customers" value={String(d.customers.length)} sub="Active customers" accent="#3B6CCF" />
                </div>

                <div className="sg2">
                  {/* Monthly Trend */}
                  <SectionCard title="📈 Monthly Export Trend">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={d.monthly} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F2F0EC" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                        <Tooltip content={<RefChartTooltip dataKey="tons" refsKey="refs" valueLabel="Tons" valueFormatter={(v) => fmt(v, 1) + " t"} />} />
                        <Bar yAxisId="left" dataKey="tons" name="Tons" fill="#2D5A3D" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="containers" name="Containers" fill="#4A7C59" radius={[4, 4, 0, 0]} />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </SectionCard>

                  {/* Customer Distribution */}
                  <SectionCard title="🏢 Customer Distribution">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={d.customers} dataKey="tons" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => percent > 0.05 ? `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%` : ""} labelLine={false}>
                          {d.customers.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<RefChartTooltip dataKey="tons" refsKey="refs" valueLabel="Tons" valueFormatter={(v) => fmt(v, 1) + " t"} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </SectionCard>
                </div>

                {/* Weekly Shipments Trend */}
                {d.weekly.length > 0 && (
                  <SectionCard title="📊 Weekly Shipments & Containers">
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={d.weekly} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F2F0EC" />
                        <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip content={<ChartTip />} />
                        <Line type="monotone" dataKey="shipments" name="Shipments" stroke="#2D5A3D" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="containers" name="Containers" stroke="#C0714A" strokeWidth={2} dot={{ r: 3 }} />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </SectionCard>
                )}

                {/* Customer Table */}
                <SectionCard title="📋 Export by Customer" count={d.customers.length}>
                  <table className="tbl">
                    <thead><tr><th>Customer</th><th>Shipments</th><th>Containers</th><th>Tons</th><th>%</th><th>Volume</th></tr></thead>
                    <tbody>
                      {d.customers.map((c: any, i: number) => {
                        const pct = d.totalTons > 0 ? (c.tons / d.totalTons) * 100 : 0;
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{c.name}</td>
                            <td className="mn"><RefTooltip refs={c.refs || []} label="Shipments">{c.shipments}</RefTooltip></td>
                            <td className="mn"><RefTooltip refs={c.refs || []} label="Shipments">{c.containers}</RefTooltip></td>
                            <td className="mn"><RefTooltip refs={c.refs || []} label="Shipments">{fmt(c.tons, 1)} t</RefTooltip></td>
                            <td className="mn" style={{ color: "#4A7C59" }}>{pct.toFixed(1)}%</td>
                            <td style={{ width: 120 }}><RefTooltip refs={c.refs || []} label="Shipments"><div style={{ height: 8, background: "#F2F0EC", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: pct + "%", background: COLORS[i % COLORS.length], borderRadius: 4 }} /></div></RefTooltip></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </SectionCard>

                {/* Ultimate Customer Distribution */}
                {d.ultimateCustomers.length > 0 && (
                  <SectionCard title="🎯 Ultimate Customer Distribution" count={d.ultimateCustomers.length}>
                    <div className="sg2">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={d.ultimateCustomers} dataKey="tons" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => percent > 0.05 ? `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%` : ""} labelLine={false}>
                            {d.ultimateCustomers.map((_, i) => <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<RefChartTooltip dataKey="tons" refsKey="refs" valueLabel="Tons" valueFormatter={(v) => fmt(v, 1) + " t"} />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <table className="tbl">
                        <thead><tr><th>Ultimate Customer</th><th>Shipments</th><th>Tons</th></tr></thead>
                        <tbody>
                          {d.ultimateCustomers.map((c: any, i: number) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 600 }}>{c.name}</td>
                              <td className="mn"><RefTooltip refs={c.refs || []} label="Shipments">{c.shipments}</RefTooltip></td>
                              <td className="mn"><RefTooltip refs={c.refs || []} label="Shipments">{fmt(c.tons, 1)} t</RefTooltip></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </SectionCard>
                )}
              </div>
            );
          })() : <div style={{ padding: 40, textAlign: "center", color: "#95A09C" }}>No export data for this period</div>)}

          {/* ═══ LOGISTICS ═══ */}
          {pg === "logistics" && (logisticsQ.isLoading ? <PageSkeleton /> : logisticsQ.isError ? <SectionError /> : logisticsQ.data ? (() => {
            const d = logisticsQ.data;
            return (
              <div>
                <PeriodBar value={logisticsP} onChange={setLogisticsP} cf={logisticsF} ct={logisticsT} oCf={setLogisticsF} oCt={setLogisticsT} />
                {/* KPIs */}
                <div className="sg2">
                  <KpiCard label="Total Trucking Cost" value={d.totalTruckingCost > 0 ? "$" + fmt(d.totalTruckingCost, 0) : "—"} sub={`${d.totalTruckingLoads} loads`} accent="#2D5A3D" />
                  {/* Avg Trucking Cost/Ton with per-source breakdown */}
                  <div style={{ background: "#fff", border: "1px solid #E4E1DC", borderRadius: 9, padding: "9px 10px", borderLeft: "4px solid #C0714A" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#4A7C59", letterSpacing: 0.5, marginBottom: 6 }}>AVG TRUCKING COST/TON</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 700, color: "#C0714A" }}>
                      {d.avgTruckingCostPerTon > 0 ? "$" + fmt(d.avgTruckingCostPerTon, 2) : "—"}
                    </div>
                    {d.egpToUsdRate && <div style={{ fontSize: 10, color: "#95A09C", marginTop: 2, marginBottom: 8 }}>Rate: {(1/d.egpToUsdRate).toFixed(0)} EGP/USD</div>}
                    {d.truckingCostPerTonBySource && d.truckingCostPerTonBySource.length > 0 && (
                      <div style={{ borderTop: "1px solid #F0EDE8", paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                        {d.truckingCostPerTonBySource.map((s: any) => (
                          <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: SOURCE_COLORS[s.name] || "#B0BAB6", flexShrink: 0 }} />
                              <span style={{ fontSize: 10, color: "#64706C", fontWeight: 500 }}>{s.name}</span>
                            </div>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: "#C0714A" }}>${fmt(s.costPerTon, 2)}/t</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Trucking Cost/Ton by Source Weekly Trend */}
                {d.weeklyTruckingTrend && d.weeklyTruckingTrend.length > 0 && d.truckingTrendSources && d.truckingTrendSources.length > 0 && (
                  <SectionCard title="🚛 Trucking Cost/Ton by Source ($)" count={d.truckingTrendSources.length + " sources"}>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={d.weeklyTruckingTrend} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F2F0EC" />
                        <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => "$" + fmt(v, 1)} />
                        <Tooltip
                          content={({ active, payload, label }: any) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-xl w-[240px] p-3">
                                <div className="font-semibold text-sm mb-2">{label}</div>
                                {payload.map((p: any, i: number) => p.value != null && (
                                  <div key={i} className="flex justify-between text-xs mb-1">
                                    <span style={{ color: p.fill }} className="font-medium">{p.name}</span>
                                    <span className="font-mono font-semibold">${fmt(p.value, 2)}/t</span>
                                  </div>
                                ))}
                              </div>
                            );
                          }}
                        />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                        {d.truckingTrendSources.map((src: string, i: number) => (
                          <Bar key={src} dataKey={src} name={src} fill={getSourceColor(src, i)} radius={[3, 3, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </SectionCard>
                )}

                {/* Trucking Weight by Source */}
                {d.truckingWeightBySource && d.truckingWeightBySource.length > 0 && (
                  <SectionCard title="🚛 Trucking Weight by Source (Tons)" count={d.truckingWeightBySource.length + " sources"}>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={d.truckingWeightBySource} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F2F0EC" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v, 1) + " t"} />
                        <Tooltip
                          content={({ active, payload, label }: any) => {
                            if (!active || !payload?.length) return null;
                            const item = payload[0]?.payload;
                            const refs: string[] = item?.refs || [];
                            return (
                              <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-xl w-[280px] max-h-[360px] overflow-hidden">
                                <div className="px-3 py-2 border-b border-border bg-muted/50">
                                  <div className="font-semibold text-sm">{label}</div>
                                  <div className="text-sm text-muted-foreground mt-0.5">Avg Weight/Load: <span className="font-mono font-semibold text-foreground">{fmt(item?.avgWeightPerLoad || 0, 2)} t</span></div>
                                  <div className="text-sm text-muted-foreground">Total Tons: <span className="font-mono font-semibold text-foreground">{fmt(item?.totalTons || 0, 1)} t</span></div>
                                  <div className="text-sm text-muted-foreground">Loads: <span className="font-mono font-semibold text-foreground">{item?.loads || 0}</span></div>
                                </div>
                                {refs.length > 0 && (
                                  <div className="overflow-y-auto max-h-[200px] p-1.5">
                                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{refs.length} loads</div>
                                    {refs.map((ref: string, ri: number) => (
                                      <div key={ri} className="px-2 py-0.5 text-xs font-mono hover:bg-accent/50 rounded transition-colors">{ref}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="avgWeightPerLoad" name="Avg Weight/Load (t)" radius={[4, 4, 0, 0]}>
                          {d.truckingWeightBySource.map((s: any, i: number) => <Cell key={i} fill={getSourceColor(s.name, i)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </SectionCard>
                )}


              </div>
            );
          })() : <div style={{ padding: 40, textAlign: "center", color: "#95A09C" }}>No logistics data for this period</div>)}

        </div>
      </div>
    </div>
  );
}
