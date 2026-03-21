/**
 * ProductionAnalytics — Professional charts for Double Press Production Dashboard
 * Uses Recharts for: Production Trends, Tons by Source, Diesel Efficiency,
 * Tons by Company
 */
import { useMemo } from "react";
import { C, FONT, MONO } from "@/lib/data";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LabelList,
} from "recharts";

// ─── Refined color palette ──────────────────────────────────────────────────
const CHART_COLORS = {
  forest: "#2D5A3D",
  forestLight: "#3A7550",
  terra: "#C4704B",
  terraLight: "#D4876A",
  sage: "#7A8B6F",
  amber: "#D4A843",
  blue: "#4A7C9B",
  green2: "#4A8B5C",
  red: "#C45B4B",
  purple: "#7A5B8B",
  teal: "#4A8B7C",
  brown: "#8B6F5A",
};

const SOURCE_COLORS: Record<string, string> = {
  "Dakhla": CHART_COLORS.forest,
  "Farafrah": CHART_COLORS.terra,
  "Owainat": CHART_COLORS.sage,
  "Toshka": CHART_COLORS.amber,
  "Other": CHART_COLORS.blue,
  "Others": CHART_COLORS.blue,
};

const BAR_COLORS = [
  CHART_COLORS.forest, CHART_COLORS.terra, CHART_COLORS.sage,
  CHART_COLORS.amber, CHART_COLORS.blue, CHART_COLORS.green2,
  CHART_COLORS.red, CHART_COLORS.purple,
];

interface AnalyticsProps {
  orders: any[];
}

// ─── Custom tooltip ─────────────────────────────────────────────────────────
const tooltipStyle = {
  contentStyle: {
    background: "rgba(255,255,255,0.97)",
    border: "none",
    borderRadius: 10,
    fontSize: 10,
    fontFamily: FONT,
    boxShadow: "0 8px 32px rgba(45,90,61,0.12), 0 2px 8px rgba(0,0,0,0.06)",
    padding: "10px 14px",
    backdropFilter: "blur(8px)",
  },
  labelStyle: { fontWeight: 700, color: C.dark, fontSize: 10, marginBottom: 4 },
  itemStyle: { fontSize: 10, padding: "1px 0" },
};

// ─── Custom legend renderer ─────────────────────────────────────────────────
const renderLegend = (props: any) => {
  const { payload } = props;
  return (
    <div style={{
      display: "flex", justifyContent: "center", gap: 14,
      paddingTop: 8, flexWrap: "wrap",
    }}>
      {payload?.map((entry: any, i: number) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 5,
          fontSize: 9, color: "#555", fontWeight: 500,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: 2,
            background: entry.color,
          }} />
          {entry.value}
        </div>
      ))}
    </div>
  );
};

// ─── Chart Card with refined styling ────────────────────────────────────────
const ChartCard = ({ title, badge, icon, stat, children }: {
  title: string; badge?: string; icon?: string; stat?: string; children: React.ReactNode;
}) => (
  <div style={{
    background: "#fff",
    borderRadius: 12,
    border: `1px solid rgba(45,90,61,0.08)`,
    boxShadow: "0 1px 3px rgba(45,90,61,0.04), 0 4px 16px rgba(45,90,61,0.03)",
    overflow: "hidden",
    transition: "box-shadow 0.2s, border-color 0.2s",
  }}
    onMouseEnter={e => {
      e.currentTarget.style.boxShadow = "0 2px 8px rgba(45,90,61,0.08), 0 8px 24px rgba(45,90,61,0.06)";
      e.currentTarget.style.borderColor = "rgba(45,90,61,0.14)";
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = "0 1px 3px rgba(45,90,61,0.04), 0 4px 16px rgba(45,90,61,0.03)";
      e.currentTarget.style.borderColor = "rgba(45,90,61,0.08)";
    }}
  >
    {/* Header */}
    <div style={{
      padding: "12px 16px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      borderBottom: "1px solid rgba(45,90,61,0.06)",
      background: "linear-gradient(135deg, rgba(45,90,61,0.03) 0%, rgba(196,112,75,0.02) 100%)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon && (
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, #2D5A3D, #3A7550)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, boxShadow: "0 2px 6px rgba(45,90,61,0.2)",
          }}>{icon}</div>
        )}
        <div>
          <div style={{
            fontSize: 12, fontWeight: 700, color: C.dark,
            letterSpacing: -0.2,
          }}>{title}</div>
          {stat && (
            <div style={{ fontSize: 9, color: C.sage, fontWeight: 500, marginTop: 1 }}>{stat}</div>
          )}
        </div>
      </div>
      {badge && (
        <div style={{
          fontSize: 9, fontWeight: 600, color: CHART_COLORS.forest,
          background: "rgba(45,90,61,0.08)",
          padding: "3px 10px", borderRadius: 20,
          fontFamily: MONO, letterSpacing: 0.3,
        }}>{badge}</div>
      )}
    </div>
    {/* Chart body */}
    <div style={{ padding: "16px 12px 12px" }}>
      {children}
    </div>
  </div>
);

// ─── Mini KPI row inside chart cards ────────────────────────────────────────
const MiniKPI = ({ items }: { items: { label: string; value: string; color?: string }[] }) => (
  <div style={{
    display: "flex", gap: 0, marginBottom: 12,
    borderRadius: 8, overflow: "hidden",
    border: `1px solid rgba(45,90,61,0.06)`,
  }}>
    {items.map((item, i) => (
      <div key={i} style={{
        flex: 1, padding: "8px 10px", textAlign: "center",
        background: i % 2 === 0 ? "rgba(45,90,61,0.02)" : "rgba(196,112,75,0.02)",
        borderRight: i < items.length - 1 ? "1px solid rgba(45,90,61,0.06)" : "none",
      }}>
        <div style={{
          fontSize: 15, fontWeight: 800, color: item.color || CHART_COLORS.forest,
          fontFamily: MONO, letterSpacing: -0.5, lineHeight: 1.2,
        }}>{item.value}</div>
        <div style={{
          fontSize: 8, color: "#888", fontWeight: 600,
          textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2,
        }}>{item.label}</div>
      </div>
    ))}
  </div>
);

// ─── Custom bar label ───────────────────────────────────────────────────────
const renderBarLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  if (width < 35) return null; // Don't render if bar is too narrow
  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fontSize: 9, fontWeight: 700, fontFamily: MONO, textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
    >
      {value}T
    </text>
  );
};

export function ProductionAnalytics({ orders }: AnalyticsProps) {
  const doneOrders = useMemo(() => orders.filter(o => o.state === "done"), [orders]);

  // ─── Aggregate KPIs ───────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalTons = doneOrders.reduce((s, o) => s + (o.qtyProduced || 0) / 1000, 0);
    const totalBales = doneOrders.reduce((s, o) => s + (o.totalBales || 0), 0);
    const totalDiesel = doneOrders.reduce((s, o) => s + (o.dieselLiters || 0), 0);
    const avgEfficiency = totalTons > 0 ? totalDiesel / totalTons : 0;
    return {
      totalTons: Math.round(totalTons).toLocaleString(),
      totalBales: totalBales.toLocaleString(),
      totalDiesel: Math.round(totalDiesel).toLocaleString(),
      avgEfficiency: avgEfficiency.toFixed(1),
      orderCount: doneOrders.length,
    };
  }, [doneOrders]);

  // ─── 1. Production Trends Over Time ───────────────────────────────────
  const trendData = useMemo(() => {
    if (!doneOrders.length) return [];
    const weekMap = new Map<string, { week: string; produced: number; bales: number; orders: number }>();
    doneOrders.forEach(o => {
      const d = o.productionDate || o.dateStart?.slice(0, 10);
      if (!d) return;
      const date = new Date(d);
      const dayOfWeek = date.getDay();
      const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const weekStart = new Date(date.setDate(diff));
      const weekKey = weekStart.toISOString().slice(0, 10);
      const existing = weekMap.get(weekKey) || { week: weekKey, produced: 0, bales: 0, orders: 0 };
      existing.produced += (o.qtyProduced || 0) / 1000;
      existing.bales += o.totalBales || 0;
      existing.orders += 1;
      weekMap.set(weekKey, existing);
    });
    return Array.from(weekMap.values())
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-16)
      .map(w => ({
        ...w,
        produced: Math.round(w.produced * 10) / 10,
        label: `${w.week.slice(5)}`,
      }));
  }, [doneOrders]);

  // ─── 2. Tons by Source ────────────────────────────────────────────────
  const tonsBySource = useMemo(() => {
    const sourceMap = new Map<string, { source: string; tons: number; orders: number }>();
    doneOrders.forEach(o => {
      const src = o.inputSource || "Other";
      const existing = sourceMap.get(src) || { source: src, tons: 0, orders: 0 };
      existing.tons += (o.qtyProduced || 0) / 1000;
      existing.orders += 1;
      sourceMap.set(src, existing);
    });
    return Array.from(sourceMap.values())
      .sort((a, b) => b.tons - a.tons)
      .map(s => ({ ...s, tons: Math.round(s.tons * 10) / 10 }));
  }, [doneOrders]);

  // ─── 3. Diesel Efficiency ─────────────────────────────────────────────
  const dieselEfficiency = useMemo(() => {
    const sourceMap = new Map<string, { source: string; totalDiesel: number; totalTons: number; count: number }>();
    doneOrders.forEach(o => {
      if (!o.dieselLiters || !o.qtyProduced) return;
      const src = o.inputSource || "Other";
      const existing = sourceMap.get(src) || { source: src, totalDiesel: 0, totalTons: 0, count: 0 };
      existing.totalDiesel += o.dieselLiters;
      existing.totalTons += o.qtyProduced / 1000;
      existing.count += 1;
      sourceMap.set(src, existing);
    });
    return Array.from(sourceMap.values())
      .filter(s => s.totalTons > 0)
      .map(s => ({
        source: s.source,
        lPerTon: Math.round((s.totalDiesel / s.totalTons) * 10) / 10,
        totalDiesel: Math.round(s.totalDiesel),
        totalTons: Math.round(s.totalTons * 10) / 10,
        count: s.count,
      }))
      .sort((a, b) => a.lPerTon - b.lPerTon);
  }, [doneOrders]);

  // ─── 4. Tons by Company ───────────────────────────────────────────────
  const truncateCompany = (name: string): string => {
    if (/cairo/i.test(name)) return "Cairo";
    if (/sokhna/i.test(name)) return "Sokhna";
    if (/alfaglobal/i.test(name)) return "Alfaglobal";
    if (/platfarm.*agriculture.*consultancy/i.test(name)) return "Platfarm Agri";
    if (/platfarm.*agritech/i.test(name)) return "Platfarm Agritech";
    const words = name.split(/\s+/);
    return words[0].length > 12 ? words[0].slice(0, 12) + "\u2026" : words[0];
  };

  const tonsByCompany = useMemo(() => {
    const compMap = new Map<string, { company: string; shortName: string; tons: number; orders: number }>();
    doneOrders.forEach(o => {
      const comp = o.company?.name || "Unknown";
      const existing = compMap.get(comp) || { company: comp, shortName: truncateCompany(comp), tons: 0, orders: 0 };
      existing.tons += (o.qtyProduced || 0) / 1000;
      existing.orders += 1;
      compMap.set(comp, existing);
    });
    return Array.from(compMap.values())
      .map(c => ({ ...c, tons: Math.round(c.tons * 10) / 10 }))
      .sort((a, b) => b.tons - a.tons);
  }, [doneOrders]);

  const stackedCompanyData = useMemo(() => {
    if (!tonsByCompany.length) return null;
    const row: Record<string, any> = { name: "Tons" };
    tonsByCompany.forEach(c => { row[c.shortName] = c.tons; });
    return row;
  }, [tonsByCompany]);

  const totalCompanyTons = useMemo(() =>
    tonsByCompany.reduce((s, c) => s + c.tons, 0),
    [tonsByCompany]);

  if (!doneOrders.length) {
    return (
      <div style={{
        padding: 40, textAlign: "center", color: C.muted, fontSize: 12,
        background: "#fff", borderRadius: 12,
        border: "1px solid rgba(45,90,61,0.08)",
      }}>
        <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>📊</div>
        No completed production orders to analyze. Charts will appear once orders are marked as done.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ─── Section Header ──────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 2px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 4, height: 22, borderRadius: 2,
            background: `linear-gradient(180deg, ${CHART_COLORS.forest}, ${CHART_COLORS.terra})`,
          }} />
          <div>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.dark, fontFamily: FONT, letterSpacing: -0.3 }}>
              Production Analytics
            </span>
            <span style={{
              fontSize: 9, color: C.sage, fontWeight: 500, marginLeft: 10,
              background: "rgba(45,90,61,0.06)", padding: "2px 8px", borderRadius: 10,
            }}>
              {doneOrders.length} completed orders
            </span>
          </div>
        </div>
      </div>

      {/* ─── Summary KPI Strip ───────────────────────────────────────── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10,
      }}>
        {[
          { label: "Total Produced", value: `${kpis.totalTons} T`, icon: "⚖", color: CHART_COLORS.forest },
          { label: "Total Bales", value: kpis.totalBales, icon: "📦", color: CHART_COLORS.terra },
          { label: "Diesel Used", value: `${kpis.totalDiesel} L`, icon: "⛽", color: CHART_COLORS.amber },
          { label: "Avg Efficiency", value: `${kpis.avgEfficiency} L/T`, icon: "📈", color: CHART_COLORS.blue },
        ].map((kpi, i) => (
          <div key={i} style={{
            background: "#fff",
            borderRadius: 10,
            border: "1px solid rgba(45,90,61,0.06)",
            padding: "12px 14px",
            display: "flex", alignItems: "center", gap: 10,
            boxShadow: "0 1px 3px rgba(45,90,61,0.03)",
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: `${kpi.color}10`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, flexShrink: 0,
            }}>{kpi.icon}</div>
            <div>
              <div style={{
                fontSize: 16, fontWeight: 800, color: kpi.color,
                fontFamily: MONO, letterSpacing: -0.5, lineHeight: 1.1,
              }}>{kpi.value}</div>
              <div style={{
                fontSize: 8, color: "#999", fontWeight: 600,
                textTransform: "uppercase", letterSpacing: 0.5, marginTop: 1,
              }}>{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Row 1: Production Trends + Tons by Source ───────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}>
        <ChartCard
          title="Production Trends"
          icon="📈"
          badge={`${trendData.length} weeks`}
          stat="Weekly tons produced & bale count"
        >
          <MiniKPI items={[
            { label: "Peak Week", value: trendData.length ? `${Math.max(...trendData.map(t => t.produced))} T` : "—", color: CHART_COLORS.forest },
            { label: "Avg / Week", value: trendData.length ? `${(trendData.reduce((s, t) => s + t.produced, 0) / trendData.length).toFixed(0)} T` : "—", color: CHART_COLORS.sage },
            { label: "Total Orders", value: trendData.length ? `${trendData.reduce((s, t) => s + t.orders, 0)}` : "—", color: CHART_COLORS.terra },
          ]} />
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -5, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradProduced" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.forest} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={CHART_COLORS.forest} stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="gradBales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.terra} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={CHART_COLORS.terra} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 8, fill: "#aaa" }}
                  axisLine={{ stroke: "rgba(0,0,0,0.06)" }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 8, fill: "#aaa" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 8, fill: "#aaa" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip {...tooltipStyle} />
                <Legend content={renderLegend} />
                <Area
                  yAxisId="left" type="monotone" dataKey="produced" name="Produced (T)"
                  stroke={CHART_COLORS.forest} fill="url(#gradProduced)"
                  strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                />
                <Area
                  yAxisId="right" type="monotone" dataKey="bales" name="Bales"
                  stroke={CHART_COLORS.terra} fill="url(#gradBales)"
                  strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                  strokeDasharray="4 2"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#bbb", fontSize: 10 }}>
              No trend data available
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Tons by Source"
          icon="🌾"
          badge={`${tonsBySource.length} sources`}
          stat="Production volume by material origin"
        >
          {tonsBySource.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={tonsBySource} margin={{ top: 5, right: 10, left: -5, bottom: 5 }}>
                <defs>
                  {tonsBySource.map((entry, i) => {
                    const baseColor = SOURCE_COLORS[entry.source] || BAR_COLORS[i % BAR_COLORS.length];
                    return (
                      <linearGradient key={i} id={`gradSource${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={baseColor} stopOpacity={1} />
                        <stop offset="100%" stopColor={baseColor} stopOpacity={0.7} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                <XAxis
                  dataKey="source"
                  tick={{ fontSize: 9, fill: "#777", fontWeight: 500 }}
                  axisLine={{ stroke: "rgba(0,0,0,0.06)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 8, fill: "#aaa" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value: any, name: string) => {
                    if (name === "Tons") return [`${value} T`, "Tons Produced"];
                    return [value, name];
                  }}
                />
                <Bar dataKey="tons" name="Tons" radius={[6, 6, 0, 0]} maxBarSize={50}>
                  {tonsBySource.map((_, i) => (
                    <Cell key={i} fill={`url(#gradSource${i})`} />
                  ))}
                  <LabelList
                    dataKey="tons"
                    position="top"
                    style={{ fontSize: 9, fontWeight: 700, fill: "#555", fontFamily: MONO }}
                    formatter={(v: number) => `${v}T`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 250, display: "flex", alignItems: "center", justifyContent: "center", color: "#bbb", fontSize: 10 }}>
              No source data available
            </div>
          )}
        </ChartCard>
      </div>

      {/* ─── Row 2: Diesel Efficiency + Tons by Company ──────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ChartCard
          title="Diesel Efficiency"
          icon="⛽"
          badge="L / Ton"
          stat="Lower is better — fuel consumption per ton"
        >
          {dieselEfficiency.length > 0 ? (
            <>
              <MiniKPI items={[
                {
                  label: "Best",
                  value: `${Math.min(...dieselEfficiency.map(d => d.lPerTon))} L/T`,
                  color: CHART_COLORS.forest,
                },
                {
                  label: "Worst",
                  value: `${Math.max(...dieselEfficiency.map(d => d.lPerTon))} L/T`,
                  color: CHART_COLORS.red,
                },
                {
                  label: "Sources",
                  value: `${dieselEfficiency.length}`,
                  color: CHART_COLORS.blue,
                },
              ]} />
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dieselEfficiency} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} layout="vertical">
                  <defs>
                    {dieselEfficiency.map((entry, i) => {
                      const color = entry.lPerTon < 4 ? CHART_COLORS.forest
                        : entry.lPerTon < 6 ? CHART_COLORS.amber
                        : CHART_COLORS.red;
                      return (
                        <linearGradient key={i} id={`gradDiesel${i}`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={color} stopOpacity={0.85} />
                          <stop offset="100%" stopColor={color} stopOpacity={1} />
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 8, fill: "#aaa" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category" dataKey="source"
                    tick={{ fontSize: 9, fill: "#555", fontWeight: 600 }}
                    width={65}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(value: any) => [`${value} L/T`, "Diesel Efficiency"]}
                  />
                  <Bar dataKey="lPerTon" name="L per Ton" radius={[0, 6, 6, 0]} maxBarSize={24}>
                    {dieselEfficiency.map((_, i) => (
                      <Cell key={i} fill={`url(#gradDiesel${i})`} />
                    ))}
                    <LabelList
                      dataKey="lPerTon"
                      position="right"
                      style={{ fontSize: 9, fontWeight: 700, fill: "#555", fontFamily: MONO }}
                      formatter={(v: number) => `${v}`}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#bbb", fontSize: 10 }}>
              No diesel data available
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Tons by Company"
          icon="🏢"
          badge={`${tonsByCompany.length} companies`}
          stat="Production distribution across entities"
        >
          {stackedCompanyData ? (
            <>
              {/* Company breakdown list */}
              <div style={{
                display: "flex", flexDirection: "column", gap: 6, marginBottom: 14,
              }}>
                {tonsByCompany.map((c, i) => {
                  const pct = totalCompanyTons > 0 ? (c.tons / totalCompanyTons * 100) : 0;
                  return (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: 3,
                        background: BAR_COLORS[i % BAR_COLORS.length],
                        flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, fontSize: 10, fontWeight: 600, color: "#444" }}>
                        {c.shortName}
                      </div>
                      <div style={{
                        fontSize: 10, fontWeight: 800, color: BAR_COLORS[i % BAR_COLORS.length],
                        fontFamily: MONO,
                      }}>
                        {c.tons.toLocaleString()} T
                      </div>
                      <div style={{
                        fontSize: 9, color: "#999", fontFamily: MONO,
                        width: 40, textAlign: "right",
                      }}>
                        {pct.toFixed(1)}%
                      </div>
                      {/* Mini progress bar */}
                      <div style={{
                        width: 60, height: 5, borderRadius: 3,
                        background: "rgba(0,0,0,0.04)", overflow: "hidden",
                        flexShrink: 0,
                      }}>
                        <div style={{
                          width: `${pct}%`, height: "100%", borderRadius: 3,
                          background: BAR_COLORS[i % BAR_COLORS.length],
                          transition: "width 0.6s ease",
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Stacked horizontal bar */}
              <ResponsiveContainer width="100%" height={50}>
                <BarChart
                  data={[stackedCompanyData]}
                  layout="vertical"
                  margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                  barSize={32}
                >
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" hide />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(value: any, name: string) => [`${value} T`, name]}
                  />
                  {tonsByCompany.map((c, i) => (
                    <Bar
                      key={c.shortName}
                      dataKey={c.shortName}
                      name={c.shortName}
                      stackId="company"
                      fill={BAR_COLORS[i % BAR_COLORS.length]}
                      radius={
                        tonsByCompany.length === 1 ? [6, 6, 6, 6] :
                        i === 0 ? [6, 0, 0, 6] :
                        i === tonsByCompany.length - 1 ? [0, 6, 6, 0] :
                        [0, 0, 0, 0]
                      }
                    >
                      <LabelList
                        dataKey={c.shortName}
                        position="center"
                        content={renderBarLabel}
                      />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>

              {/* Total */}
              <div style={{
                textAlign: "center", marginTop: 8,
                fontSize: 9, color: "#999", fontWeight: 500,
              }}>
                Total: <span style={{ fontWeight: 800, color: CHART_COLORS.forest, fontFamily: MONO }}>
                  {totalCompanyTons.toLocaleString()} T
                </span>
              </div>
            </>
          ) : (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#bbb", fontSize: 10 }}>
              No company data available
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
