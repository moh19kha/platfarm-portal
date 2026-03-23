import { trpc } from "@/lib/trpc";
import { formatCurrency } from "./propUtils";
import { TrendingDown, DollarSign, BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";

type CurrencyMode = "" | "AED" | "EGP" | "Aggregated";
type CountryFilter = "All" | "UAE" | "Egypt";
type PeriodMode = "year" | "quarter" | "month";

export default function LiabilityForecast() {
  const { data: allPayments, isLoading } = trpc.property.payments.all.useQuery();
  const { data: settings } = trpc.property.settings.get.useQuery();
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyMode>("");
  const [countryFilter, setCountryFilter] = useState<CountryFilter>("All");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("year");
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const toggleSeries = (dataKey: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) next.delete(dataKey);
      else next.add(dataKey);
      return next;
    });
  };

  const renderClickableLegend = (props: any) => {
    const { payload } = props;
    return (
      <div className="flex items-center justify-center gap-4 mt-2">
        {payload?.map((entry: any, i: number) => {
          const isHidden = hiddenSeries.has(entry.dataKey || entry.value);
          return (
            <button
              key={i}
              onClick={() => toggleSeries(entry.dataKey || entry.value)}
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-all"
              style={{
                opacity: isHidden ? 0.35 : 1,
                textDecoration: isHidden ? "line-through" : "none",
                cursor: "pointer",
                background: isHidden ? "#F5F5F5" : "transparent",
              }}
            >
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: entry.color }} />
              <span style={{ color: "#2C3E50" }}>{entry.value}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const egpToAed = Number(settings?.egpToAedRate) || 0.077;
  const isAggregated = currencyFilter === "Aggregated";

  const toAed = (amount: number, currency: string) => {
    if (currency === "AED") return amount;
    return amount * egpToAed;
  };

  // Filter payments by country
  const countryFiltered = useMemo(() => {
    if (!allPayments) return [];
    if (countryFilter === "All") return allPayments;
    if (countryFilter === "UAE") return allPayments.filter((r) => r.country === "UAE");
    if (countryFilter === "Egypt") return allPayments.filter((r) => r.country === "Egypt");
    return allPayments;
  }, [allPayments, countryFilter]);

  const { monthlyBreakdown, burnDown, totalOutstandingAED, totalOutstandingEGP, totalAggregated, remainingCount } = useMemo(() => {
    if (!countryFiltered.length) return { monthlyBreakdown: [], burnDown: [], totalOutstandingAED: 0, totalOutstandingEGP: 0, totalAggregated: 0, remainingCount: 0 };

    const unpaid = countryFiltered.filter((r) => r.payment.paymentStatus !== "Paid");
    const filtered = currencyFilter && currencyFilter !== "Aggregated"
      ? unpaid.filter((r) => r.currency === currencyFilter)
      : unpaid;

    let totalOutstandingAED = 0;
    let totalOutstandingEGP = 0;
    for (const r of unpaid) {
      const bal = Number(r.payment.amountDue) - Number(r.payment.amountPaid);
      if (r.currency === "AED") totalOutstandingAED += bal;
      else totalOutstandingEGP += bal;
    }
    const totalAggregated = totalOutstandingAED + totalOutstandingEGP * egpToAed;

    // Group by month
    const monthMap: Record<string, { aed: number; egp: number; aggregated: number; items: any[] }> = {};
    for (const r of filtered) {
      const month = r.payment.dueDate.slice(0, 7);
      if (!monthMap[month]) monthMap[month] = { aed: 0, egp: 0, aggregated: 0, items: [] };
      const bal = Number(r.payment.amountDue) - Number(r.payment.amountPaid);
      if (r.currency === "AED") monthMap[month].aed += bal;
      else monthMap[month].egp += bal;
      monthMap[month].aggregated += toAed(bal, r.currency);
      monthMap[month].items.push(r);
    }

    const sortedMonths = Object.keys(monthMap).sort();
    const monthlyBreakdown = sortedMonths.map((month) => ({
      month,
      monthLabel: new Date(month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      aed: Math.round(monthMap[month].aed),
      egp: Math.round(monthMap[month].egp),
      aggregated: Math.round(monthMap[month].aggregated),
      total: Math.round(monthMap[month].aed + monthMap[month].egp),
      items: monthMap[month].items,
    }));

    // True burn-down: cumulative remaining balance over time
    let runningAED = totalOutstandingAED;
    let runningEGP = totalOutstandingEGP;
    let runningAgg = totalAggregated;
    const burnDown = sortedMonths.map((month) => {
      const label = new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      const entry = {
        month: label,
        AED: Math.round(runningAED),
        EGP: Math.round(runningEGP),
        Aggregated: Math.round(runningAgg),
      };
      runningAED -= monthMap[month].aed;
      runningEGP -= monthMap[month].egp;
      runningAgg -= monthMap[month].aggregated;
      return entry;
    });

    return { monthlyBreakdown, burnDown, totalOutstandingAED, totalOutstandingEGP, totalAggregated, remainingCount: unpaid.length };
  }, [countryFiltered, currencyFilter, egpToAed]);

  // Payment Obligations chart data grouped by year/quarter/month
  const obligationsData = useMemo(() => {
    if (!monthlyBreakdown.length) return [];

    if (periodMode === "month") {
      return monthlyBreakdown.map((m) => ({
        period: new Date(m.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        aed: m.aed,
        egp: m.egp,
        aggregated: m.aggregated,
        properties: Array.from(new Set(m.items.map((i: any) => i.propertyName))),
      }));
    }

    const groupMap: Record<string, { aed: number; egp: number; aggregated: number; properties: Set<string> }> = {};

    for (const m of monthlyBreakdown) {
      const date = new Date(m.month + "-01");
      const year = date.getFullYear();
      const monthNum = date.getMonth();
      let key: string;

      if (periodMode === "year") {
        key = String(year);
      } else {
        const q = Math.floor(monthNum / 3) + 1;
        key = `Q${q} ${year}`;
      }

      if (!groupMap[key]) groupMap[key] = { aed: 0, egp: 0, aggregated: 0, properties: new Set() };
      groupMap[key].aed += m.aed;
      groupMap[key].egp += m.egp;
      groupMap[key].aggregated += m.aggregated;
      m.items.forEach((i: any) => groupMap[key].properties.add(i.propertyName));
    }

    // Sort keys
    const sortedKeys = Object.keys(groupMap).sort((a, b) => {
      if (periodMode === "year") return Number(a) - Number(b);
      // Quarter: "Q1 2026" -> extract year and quarter for sorting
      const [qa, ya] = [a.charAt(1), a.slice(3)];
      const [qb, yb] = [b.charAt(1), b.slice(3)];
      return ya === yb ? Number(qa) - Number(qb) : Number(ya) - Number(yb);
    });

    return sortedKeys.map((key) => ({
      period: key,
      aed: Math.round(groupMap[key].aed),
      egp: Math.round(groupMap[key].egp),
      aggregated: Math.round(groupMap[key].aggregated),
      properties: Array.from(groupMap[key].properties),
    }));
  }, [monthlyBreakdown, periodMode]);

  const burnDownAreas = useMemo(() => {
    if (isAggregated) return [{ key: "Aggregated", stroke: "#2D5A3D", fill: "#2D5A3D", name: "Outstanding (AED)" }];
    if (currencyFilter === "AED") return [{ key: "AED", stroke: "#2D5A3D", fill: "#2D5A3D", name: "AED Outstanding" }];
    if (currencyFilter === "EGP") return [{ key: "EGP", stroke: "#C0714A", fill: "#C0714A", name: "EGP Outstanding" }];
    return [
      { key: "AED", stroke: "#2D5A3D", fill: "#2D5A3D", name: "AED Outstanding" },
      { key: "EGP", stroke: "#C0714A", fill: "#C0714A", name: "EGP Outstanding" },
    ];
  }, [isAggregated, currencyFilter]);

  const obligationBars = useMemo(() => {
    if (isAggregated) return [{ key: "aggregated", fill: "#2D5A3D", name: "Total (AED)" }];
    if (currencyFilter === "AED") return [{ key: "aed", fill: "#2D5A3D", name: "AED" }];
    if (currencyFilter === "EGP") return [{ key: "egp", fill: "#C0714A", name: "EGP" }];
    return [
      { key: "aed", fill: "#2D5A3D", name: "AED" },
      { key: "egp", fill: "#C0714A", name: "EGP" },
    ];
  }, [isAggregated, currencyFilter]);

  const selectStyle = { border: "1px solid #D5D0C8", color: "#2C3E50", background: "#FFFFFF", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", fontSize: "0.875rem" };

  const CustomObligationTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    return (
      <div className="bg-white rounded-lg p-3 shadow-lg text-sm" style={{ border: "1px solid #E8E5E0" }}>
        <div className="font-semibold mb-2" style={{ color: "#2C3E50" }}>{label}</div>
        {isAggregated ? (
          <div className="font-currency" style={{ color: "#2D5A3D" }}>
            {formatCurrency(data?.aggregated || 0, "AED")}
          </div>
        ) : (
          <>
            {data?.aed > 0 && <div className="font-currency" style={{ color: "#2D5A3D" }}>AED: {formatCurrency(data.aed, "AED")}</div>}
            {data?.egp > 0 && <div className="font-currency" style={{ color: "#C0714A" }}>EGP: {formatCurrency(data.egp, "EGP")}</div>}
          </>
        )}
        {data?.properties?.length > 0 && (
          <div className="mt-2 pt-2" style={{ borderTop: "1px solid #E8E5E0", color: "#666666" }}>
            {data.properties.map((p: string, i: number) => (
              <div key={i} className="text-xs">{p}</div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: "#2C3E50" }}>Liability Forecast</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="metric-card animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={{ color: "#2C3E50" }}>Liability Forecast</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value as CountryFilter)} style={selectStyle}>
            <option value="All">All Countries</option>
            <option value="UAE">UAE Only</option>
            <option value="Egypt">Egypt Only</option>
          </select>
          <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value as CurrencyMode)} style={selectStyle}>
            <option value="">All Currencies</option>
            <option value="AED">AED Only</option>
            <option value="EGP">EGP Only</option>
            <option value="Aggregated">Aggregated (AED)</option>
          </select>
        </div>
      </div>

      {isAggregated && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: "#FFF8F0", border: "1px solid #F0D4B8", color: "#C0714A" }}>
          <DollarSign className="h-3.5 w-3.5 shrink-0" />
          <span>EGP amounts converted to AED at rate: <strong className="font-currency">1 EGP = {egpToAed} AED</strong>. Update in Settings.</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isAggregated ? (
          <>
            <div className="metric-card">
              <div className="text-sm font-medium mb-1" style={{ color: "#666666" }}>Total Outstanding (Aggregated AED)</div>
              <div className="font-currency text-xl font-semibold" style={{ color: "#C0714A" }}>{formatCurrency(totalAggregated, "AED")}</div>
            </div>
            <div className="metric-card">
              <div className="text-sm font-medium mb-1" style={{ color: "#666666" }}>Remaining Installments</div>
              <div className="text-xl font-semibold" style={{ color: "#2C3E50" }}>{remainingCount}</div>
            </div>
            <div className="metric-card">
              <div className="text-sm font-medium mb-1" style={{ color: "#666666" }}>Exchange Rate</div>
              <div className="font-currency text-xl font-semibold" style={{ color: "#2C3E50" }}>1 EGP = {egpToAed} AED</div>
            </div>
          </>
        ) : (
          <>
            <div className="metric-card">
              <div className="text-sm font-medium mb-1" style={{ color: "#666666" }}>Total Outstanding (AED)</div>
              <div className="font-currency text-xl font-semibold" style={{ color: "#C0714A" }}>{formatCurrency(totalOutstandingAED, "AED")}</div>
            </div>
            <div className="metric-card">
              <div className="text-sm font-medium mb-1" style={{ color: "#666666" }}>Total Outstanding (EGP)</div>
              <div className="font-currency text-xl font-semibold" style={{ color: "#C0714A" }}>{formatCurrency(totalOutstandingEGP, "EGP")}</div>
            </div>
            <div className="metric-card">
              <div className="text-sm font-medium mb-1" style={{ color: "#666666" }}>Remaining Installments</div>
              <div className="text-xl font-semibold" style={{ color: "#2C3E50" }}>{remainingCount}</div>
            </div>
          </>
        )}
      </div>

      {/* Burn-down Chart */}
      <div className="bg-white rounded-lg p-5" style={{ border: "1px solid #E8E5E0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold" style={{ color: "#2C3E50" }}>
            Liability Burn-Down
            {countryFilter !== "All" && <span className="text-xs font-normal ml-2" style={{ color: "#C0714A" }}>({countryFilter})</span>}
            {isAggregated && <span className="text-xs font-normal ml-2" style={{ color: "#C0714A" }}>(in AED)</span>}
          </h3>
        </div>
        {burnDown.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={burnDown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E5E0" />
              <XAxis dataKey="month" style={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} style={{ fontSize: 11, fontFamily: "'JetBrains Mono'" }} />
              <Tooltip formatter={(v: number) => v.toLocaleString()} />
              <Legend content={renderClickableLegend} />
              {burnDownAreas.map((area) => (
                <Area key={area.key} type="stepAfter" dataKey={area.key} stroke={area.stroke} fill={area.fill} fillOpacity={hiddenSeries.has(area.key) ? 0 : 0.3} name={area.name} hide={hiddenSeries.has(area.key)} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-sm" style={{ color: "#666666" }}>No outstanding liabilities{countryFilter !== "All" ? ` for ${countryFilter}` : ""}</div>
        )}
      </div>

      {/* Payment Obligations Chart */}
      <div className="bg-white rounded-lg p-5" style={{ border: "1px solid #E8E5E0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" style={{ color: "#2D5A3D" }} />
            <h3 className="font-semibold" style={{ color: "#2C3E50" }}>
              Payment Obligations
              {countryFilter !== "All" && <span className="text-xs font-normal ml-2" style={{ color: "#C0714A" }}>({countryFilter})</span>}
            </h3>
          </div>
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid #D5D0C8" }}>
            {(["year", "quarter", "month"] as PeriodMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setPeriodMode(mode)}
                className="px-4 py-2 text-sm font-medium transition-colors capitalize"
                style={{
                  background: periodMode === mode ? "#2D5A3D" : "#FFFFFF",
                  color: periodMode === mode ? "#FFFFFF" : "#2C3E50",
                  borderRight: mode !== "month" ? "1px solid #D5D0C8" : "none",
                }}
              >
                {mode === "year" ? "Yearly" : mode === "quarter" ? "Quarterly" : "Monthly"}
              </button>
            ))}
          </div>
        </div>
        {obligationsData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={obligationsData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E5E0" />
                <XAxis dataKey="period" style={{ fontSize: 11 }} angle={periodMode === "month" ? -45 : 0} textAnchor={periodMode === "month" ? "end" : "middle"} height={periodMode === "month" ? 60 : 30} />
                <YAxis tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} style={{ fontSize: 11, fontFamily: "'JetBrains Mono'" }} />
                <Tooltip content={<CustomObligationTooltip />} />
                <Legend content={renderClickableLegend} />
                {obligationBars.map((bar) => (
                  <Bar key={bar.key} dataKey={bar.key} name={bar.name} fill={bar.fill} radius={[4, 4, 0, 0]} hide={hiddenSeries.has(bar.key)} />
                ))}
              </BarChart>
            </ResponsiveContainer>

            {/* Summary table below chart */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full table-striped text-sm">
                <thead>
                  <tr style={{ borderBottom: "2px solid #E8E5E0" }}>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: "#666666" }}>Period</th>
                    {isAggregated ? (
                      <th className="text-right px-4 py-2 font-medium" style={{ color: "#666666" }}>Total (AED)</th>
                    ) : (
                      <>
                        {(currencyFilter === "" || currencyFilter === "AED") && <th className="text-right px-4 py-2 font-medium" style={{ color: "#666666" }}>AED</th>}
                        {(currencyFilter === "" || currencyFilter === "EGP") && <th className="text-right px-4 py-2 font-medium" style={{ color: "#666666" }}>EGP</th>}
                      </>
                    )}
                    <th className="text-left px-4 py-2 font-medium" style={{ color: "#666666" }}>Properties</th>
                  </tr>
                </thead>
                <tbody>
                  {obligationsData.map((row) => (
                    <tr key={row.period} style={{ borderBottom: "1px solid #E8E5E0" }}>
                      <td className="px-4 py-2 font-medium" style={{ color: "#2C3E50" }}>{row.period}</td>
                      {isAggregated ? (
                        <td className="px-4 py-2 text-right font-currency" style={{ color: "#2D5A3D" }}>{formatCurrency(row.aggregated, "AED")}</td>
                      ) : (
                        <>
                          {(currencyFilter === "" || currencyFilter === "AED") && (
                            <td className="px-4 py-2 text-right font-currency" style={{ color: row.aed > 0 ? "#2D5A3D" : "#AAAAAA" }}>{row.aed > 0 ? formatCurrency(row.aed, "AED") : "\u2014"}</td>
                          )}
                          {(currencyFilter === "" || currencyFilter === "EGP") && (
                            <td className="px-4 py-2 text-right font-currency" style={{ color: row.egp > 0 ? "#C0714A" : "#AAAAAA" }}>{row.egp > 0 ? formatCurrency(row.egp, "EGP") : "\u2014"}</td>
                          )}
                        </>
                      )}
                      <td className="px-4 py-2 text-xs" style={{ color: "#666666" }}>{row.properties.join(", ")}</td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr style={{ borderTop: "2px solid #2D5A3D", background: "#F8F7F4" }}>
                    <td className="px-4 py-2 font-bold" style={{ color: "#2C3E50" }}>Total</td>
                    {isAggregated ? (
                      <td className="px-4 py-2 text-right font-currency font-bold" style={{ color: "#2D5A3D" }}>
                        {formatCurrency(obligationsData.reduce((s, r) => s + r.aggregated, 0), "AED")}
                      </td>
                    ) : (
                      <>
                        {(currencyFilter === "" || currencyFilter === "AED") && (
                          <td className="px-4 py-2 text-right font-currency font-bold" style={{ color: "#2D5A3D" }}>
                            {formatCurrency(obligationsData.reduce((s, r) => s + r.aed, 0), "AED")}
                          </td>
                        )}
                        {(currencyFilter === "" || currencyFilter === "EGP") && (
                          <td className="px-4 py-2 text-right font-currency font-bold" style={{ color: "#C0714A" }}>
                            {formatCurrency(obligationsData.reduce((s, r) => s + r.egp, 0), "EGP")}
                          </td>
                        )}
                      </>
                    )}
                    <td className="px-4 py-2" />
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-sm" style={{ color: "#666666" }}>No outstanding obligations{countryFilter !== "All" ? ` for ${countryFilter}` : ""}</div>
        )}
      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #E8E5E0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div className="px-5 py-4" style={{ background: "linear-gradient(to right, #2D5A3D, #4A7C59)" }}>
          <h3 className="font-semibold text-white">Monthly Obligation Breakdown</h3>
        </div>
        {monthlyBreakdown.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full table-striped">
              <thead>
                <tr style={{ borderBottom: "1px solid #E8E5E0" }}>
                  <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: "#666666" }}>Month</th>
                  {isAggregated ? (
                    <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: "#666666" }}>AED (Aggregated)</th>
                  ) : (
                    <>
                      <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: "#666666" }}>AED Due</th>
                      <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: "#666666" }}>EGP Due</th>
                    </>
                  )}
                  <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: "#666666" }}>Properties</th>
                </tr>
              </thead>
              <tbody>
                {monthlyBreakdown.map((row) => (
                  <tr key={row.month} style={{ borderBottom: "1px solid #E8E5E0" }}>
                    <td className="px-5 py-3 text-sm font-medium" style={{ color: "#2C3E50" }}>{row.monthLabel}</td>
                    {isAggregated ? (
                      <td className="px-5 py-3 text-sm text-right font-currency" style={{ color: "#2C3E50" }}>{formatCurrency(row.aggregated, "AED")}</td>
                    ) : (
                      <>
                        <td className="px-5 py-3 text-sm text-right font-currency" style={{ color: row.aed > 0 ? "#2C3E50" : "#AAAAAA" }}>{row.aed > 0 ? formatCurrency(row.aed, "AED") : "\u2014"}</td>
                        <td className="px-5 py-3 text-sm text-right font-currency" style={{ color: row.egp > 0 ? "#2C3E50" : "#AAAAAA" }}>{row.egp > 0 ? formatCurrency(row.egp, "EGP") : "\u2014"}</td>
                      </>
                    )}
                    <td className="px-5 py-3 text-sm" style={{ color: "#666666" }}>
                      {Array.from(new Set(row.items.map((i: any) => i.propertyName))).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <TrendingDown className="h-12 w-12 mx-auto mb-3 opacity-20" style={{ color: "#2D5A3D" }} />
            <p className="font-medium" style={{ color: "#2C3E50" }}>No outstanding liabilities</p>
            <p className="text-sm mt-1" style={{ color: "#666666" }}>All payments are up to date.</p>
          </div>
        )}
      </div>
    </div>
  );
}
