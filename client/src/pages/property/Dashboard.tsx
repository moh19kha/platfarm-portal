import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate, getDeliveryStatusBadgeClass, getPaymentProgress } from "./propUtils";
import {
  Building2, Wallet, TrendingDown, CalendarClock, AlertTriangle, DollarSign, TrendingUp, CreditCard, CheckCircle2,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, AreaChart, Area, Legend,
} from "recharts";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const COLORS = ["#2D5A3D", "#4A7C59", "#C0714A", "#3A7350", "#A8613F", "#6B9B7A"];

type CurrencyView = "split" | "aggregated";

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: metrics, isLoading } = trpc.property.dashboard.metrics.useQuery();
  const { data: settings } = trpc.property.settings.get.useQuery();
  const [, setLocation] = useLocation();
  const [distributionView, setDistributionView] = useState<"country" | "unitType" | "deliveryStatus">("country");
  const [currencyView, setCurrencyView] = useState<CurrencyView>("split");
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [selectedPaymentForRecord, setSelectedPaymentForRecord] = useState<any>(null);
  const [showOverdueList, setShowOverdueList] = useState(false);

  const recordPaymentMut = trpc.property.payments.recordPayment.useMutation({
    onSuccess: () => {
      utils.dashboard.metrics.invalidate();
      setShowRecordPayment(false);
      setSelectedPaymentForRecord(null);
      toast.success("Payment recorded successfully");
    },
    onError: () => toast.error("Failed to record payment"),
  });

  const egpToAed = Number(settings?.egpToAedRate) || 0.077;

  // Helper to convert EGP to AED
  const toAed = (amount: number, currency: string) => {
    if (currency === "AED") return amount;
    return amount * egpToAed;
  };

  const distributionData = useMemo(() => {
    if (!metrics?.properties) return [];
    const grouped: Record<string, number> = {};
    for (const p of metrics.properties) {
      const key = distributionView === "country" ? p.country
        : distributionView === "unitType" ? p.unitType
        : p.deliveryStatus;
      grouped[key] = (grouped[key] || 0) + 1;
    }
    return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [metrics?.properties, distributionView]);

  const paymentProgressData = useMemo(() => {
    if (!metrics?.properties || !metrics?.payments) return [];
    return metrics.properties.map((p) => {
      const propPayments = metrics.payments.filter((pm) => pm.payment.propertyId === p.id);
      const totalPaid = propPayments.reduce((s, pm) => s + (Number(pm.payment.amountPaid) || 0), 0);
      const totalPrice = Number(p.totalPrice) || 0;
      const remaining = Math.max(totalPrice - totalPaid, 0);
      const isEgp = p.currency === "EGP";
      return {
        name: p.propertyName.length > 20 ? p.propertyName.slice(0, 20) + "..." : p.propertyName,
        paid: isEgp ? toAed(totalPaid, "EGP") : totalPaid,
        remaining: isEgp ? toAed(remaining, "EGP") : remaining,
        currency: p.currency,
        paidOriginal: isEgp ? totalPaid : undefined,
        remainingOriginal: isEgp ? remaining : undefined,
        overdue: propPayments.filter((pm) => pm.payment.paymentStatus === "Overdue").reduce((s, pm) => {
          const bal = Number(pm.payment.amountDue) - Number(pm.payment.amountPaid);
          return s + (isEgp ? toAed(bal, "EGP") : bal);
        }, 0),
      };
    });
  }, [metrics, egpToAed]);

  const liabilityData = useMemo(() => {
    if (!metrics?.payments) return [];
    if (currencyView === "aggregated") {
      const monthMap: Record<string, number> = {};
      for (const row of metrics.payments) {
        if (row.payment.paymentStatus === "Paid") continue;
        const month = row.payment.dueDate.slice(0, 7);
        if (!monthMap[month]) monthMap[month] = 0;
        const balance = Number(row.payment.amountDue) - Number(row.payment.amountPaid);
        monthMap[month] += toAed(balance, row.currency);
      }
      return Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, val]) => ({
          month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
          "AED (Total)": Math.round(val),
        }));
    }
    const monthMap: Record<string, { aed: number; egp: number }> = {};
    for (const row of metrics.payments) {
      if (row.payment.paymentStatus === "Paid") continue;
      const month = row.payment.dueDate.slice(0, 7);
      if (!monthMap[month]) monthMap[month] = { aed: 0, egp: 0 };
      const balance = Number(row.payment.amountDue) - Number(row.payment.amountPaid);
      if (row.currency === "AED") monthMap[month].aed += balance;
      else monthMap[month].egp += balance;
    }
    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({
        month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        AED: Math.round(vals.aed),
        EGP: Math.round(vals.egp),
      }));
  }, [metrics, currencyView, egpToAed]);

  const statusSummaryData = useMemo(() => {
    if (!metrics?.payments) return [];
    let paid = 0, pending = 0, overdue = 0, partial = 0;
    for (const row of metrics.payments) {
      const s = row.payment.paymentStatus;
      if (s === "Paid") paid++;
      else if (s === "Overdue") overdue++;
      else if (s === "Partially-Paid") partial++;
      else pending++;
    }
    return [
      { name: "Paid", value: paid, fill: "#2D5A3D" },
      { name: "Pending", value: pending, fill: "#4A7C59" },
      { name: "Partially Paid", value: partial, fill: "#6B9B7A" },
      { name: "Overdue", value: overdue, fill: "#C0714A" },
    ];
  }, [metrics]);

  // Aggregated metrics
  const aggregatedMetrics = useMemo(() => {
    if (!metrics) return null;
    if (currencyView === "split") return null;
    return {
      portfolioValue: metrics.portfolioValueAED + metrics.portfolioValueEGP * egpToAed,
      marketValue: metrics.marketValueAED + metrics.marketValueEGP * egpToAed,
      totalPaid: metrics.totalPaidAED + metrics.totalPaidEGP * egpToAed,
      totalOutstanding: metrics.totalOutstandingAED + metrics.totalOutstandingEGP * egpToAed,
      overdueAmount: metrics.overdueAmountAED + metrics.overdueAmountEGP * egpToAed,
    };
  }, [metrics, currencyView, egpToAed]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: "#2C3E50" }}>Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="metric-card animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  // Compute unrealized gain
  const unrealizedGainAED = metrics.marketValueAED - metrics.portfolioValueAED;
  const unrealizedGainEGP = metrics.marketValueEGP - metrics.portfolioValueEGP;

  const metricCards = currencyView === "aggregated" && aggregatedMetrics
    ? [
        { label: "Total Properties", value: String(metrics.totalProperties), icon: Building2, color: "#2D5A3D" },
        { label: "Portfolio Cost (AED)", value: formatCurrency(aggregatedMetrics.portfolioValue, "AED"), subValue: `Includes EGP converted at ${egpToAed} rate`, icon: DollarSign, color: "#4A7C59" },
        { label: "Current Market Value", value: formatCurrency(aggregatedMetrics.marketValue, "AED"), subValue: (() => { const gain = aggregatedMetrics.marketValue - aggregatedMetrics.portfolioValue; return gain >= 0 ? `Unrealized Gain: AED +${Math.round(gain).toLocaleString()}` : `Unrealized Loss: AED ${Math.round(gain).toLocaleString()}`; })(), icon: TrendingUp, color: "#2D5A3D", highlight: true },
        { label: "Total Paid (AED)", value: formatCurrency(aggregatedMetrics.totalPaid, "AED"), subValue: "", icon: Wallet, color: "#2D5A3D" },
        { label: "Next Payment Due", value: metrics.nextPayment ? formatCurrency(toAed(metrics.nextPayment.amount, metrics.nextPayment.currency), "AED") : "None", subValue: metrics.nextPayment ? `${formatDate(metrics.nextPayment.dueDate)} - ${metrics.nextPayment.propertyName}` : "", icon: CalendarClock, color: "#4A7C59" },
        { label: "Overdue (AED)", value: `${metrics.overdueCount} installment${metrics.overdueCount !== 1 ? "s" : ""}`, subValue: formatCurrency(aggregatedMetrics.overdueAmount, "AED"), icon: AlertTriangle, color: metrics.overdueCount > 0 ? "#C0714A" : "#4A7C59" },
      ]
    : [
        { label: "Total Properties", value: String(metrics.totalProperties), icon: Building2, color: "#2D5A3D" },
        { label: "Portfolio Cost", value: metrics.portfolioValueAED > 0 ? formatCurrency(metrics.portfolioValueAED, "AED") : "", subValue: metrics.portfolioValueEGP > 0 ? formatCurrency(metrics.portfolioValueEGP, "EGP") : "", icon: DollarSign, color: "#4A7C59" },
        { label: "Current Market Value", value: metrics.marketValueAED > 0 ? formatCurrency(metrics.marketValueAED, "AED") : "", subValue: (() => { const parts: string[] = []; if (metrics.marketValueEGP > 0) parts.push(formatCurrency(metrics.marketValueEGP, "EGP")); const gainAed = unrealizedGainAED; const gainEgp = unrealizedGainEGP; if (gainAed !== 0) parts.push(`AED ${gainAed >= 0 ? "+" : ""}${Math.round(gainAed).toLocaleString()}`); if (gainEgp !== 0) parts.push(`EGP ${gainEgp >= 0 ? "+" : ""}${Math.round(gainEgp).toLocaleString()}`); return parts.join(" | "); })(), icon: TrendingUp, color: "#2D5A3D", highlight: true },
        { label: "Total Paid", value: metrics.totalPaidAED > 0 ? formatCurrency(metrics.totalPaidAED, "AED") : "", subValue: metrics.totalPaidEGP > 0 ? formatCurrency(metrics.totalPaidEGP, "EGP") : "", icon: Wallet, color: "#2D5A3D" },
        { label: "Next Payment Due", value: metrics.nextPayment ? formatCurrency(metrics.nextPayment.amount, metrics.nextPayment.currency) : "None", subValue: metrics.nextPayment ? `${formatDate(metrics.nextPayment.dueDate)} - ${metrics.nextPayment.propertyName}` : "", icon: CalendarClock, color: "#4A7C59" },
        { label: "Overdue Payments", value: `${metrics.overdueCount} installment${metrics.overdueCount !== 1 ? "s" : ""}`, subValue: (metrics.overdueAmountAED > 0 ? formatCurrency(metrics.overdueAmountAED, "AED") : "") + (metrics.overdueAmountEGP > 0 ? ` | ${formatCurrency(metrics.overdueAmountEGP, "EGP")}` : ""), icon: AlertTriangle, color: metrics.overdueCount > 0 ? "#C0714A" : "#4A7C59" },
      ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={{ color: "#2C3E50" }}>Dashboard</h1>
        {/* Currency View Toggle */}
        <div className="flex items-center gap-2 rounded-lg p-1" style={{ background: "#F0EDE8" }}>
          <button
            onClick={() => setCurrencyView("split")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${currencyView === "split" ? "text-white shadow-sm" : ""}`}
            style={currencyView === "split" ? { background: "#2D5A3D" } : { color: "#666666" }}
          >
            Split (AED / EGP)
          </button>
          <button
            onClick={() => setCurrencyView("aggregated")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${currencyView === "aggregated" ? "text-white shadow-sm" : ""}`}
            style={currencyView === "aggregated" ? { background: "#C0714A" } : { color: "#666666" }}
          >
            Aggregated (AED)
          </button>
        </div>
      </div>

      {currencyView === "aggregated" && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: "#FFF8F0", border: "1px solid #F0D4B8", color: "#C0714A" }}>
          <DollarSign className="h-3.5 w-3.5 shrink-0" />
          <span>EGP amounts converted to AED at rate: <strong className="font-currency">1 EGP = {egpToAed} AED</strong>. You can update this rate in Settings.</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metricCards.map((card, i) => {
          const isHighlight = (card as any).highlight;
          const isNextPayment = card.label === "Next Payment Due";
          const isOverdue = card.label === "Overdue Payments" || card.label === "Overdue (AED)";
          return (
            <div key={i} className="metric-card" style={isHighlight ? { border: "1.5px solid #2D5A3D", background: "linear-gradient(135deg, #FAFFF8 0%, #F5FAF3 100%)" } : undefined}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium" style={{ color: isHighlight ? "#2D5A3D" : "#666666" }}>{card.label}</span>
                <card.icon className="h-5 w-5" style={{ color: card.color }} />
              </div>
              <div className="font-currency text-xl font-semibold" style={{ color: "#2C3E50" }}>
                {card.value || "\u2014"}
              </div>
              {card.subValue && (
                <div className="font-currency text-sm mt-1" style={{ color: isHighlight ? "#4A7C59" : "#666666" }}>
                  {card.subValue}
                </div>
              )}
              {isAdmin && isNextPayment && metrics.nextPayment && (
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedPaymentForRecord(metrics.nextPayment); setShowRecordPayment(true); }}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:-translate-y-0.5 hover:shadow-md"
                  style={{ background: "#2D5A3D" }}
                >
                  <CreditCard className="h-3.5 w-3.5" /> Record Payment
                </button>
              )}
              {isAdmin && isOverdue && metrics.overdueCount > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowOverdueList(true); }}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:-translate-y-0.5 hover:shadow-md"
                  style={{ background: "#C0714A" }}
                >
                  <CreditCard className="h-3.5 w-3.5" /> Record Overdue Payment
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut Chart - Portfolio Distribution */}
        <div className="bg-white rounded-lg p-5" style={{ border: "1px solid #E8E5E0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: "#2C3E50" }}>Portfolio Distribution</h3>
            <select
              value={distributionView}
              onChange={(e) => setDistributionView(e.target.value as any)}
              className="text-sm rounded-md px-2 py-1"
              style={{ border: "1px solid #D5D0C8", color: "#2C3E50" }}
            >
              <option value="country">By Country</option>
              <option value="unitType">By Unit Type</option>
              <option value="deliveryStatus">By Status</option>
            </select>
          </div>
          {distributionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={distributionData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                  {distributionData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm" style={{ color: "#666666" }}>No properties to display</div>
          )}
        </div>

        {/* Payment Progress per Property */}
        <div className="bg-white rounded-lg p-5" style={{ border: "1px solid #E8E5E0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <h3 className="font-semibold mb-4" style={{ color: "#2C3E50" }}>
            Payment Progress per Property
            <span className="text-xs font-normal ml-2" style={{ color: "#C0714A" }}>(All in AED)</span>
          </h3>
          {paymentProgressData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={paymentProgressData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E5E0" />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} style={{ fontSize: 11, fontFamily: "'JetBrains Mono'" }} />
                <YAxis type="category" dataKey="name" width={120} style={{ fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0]?.payload;
                    if (!data) return null;
                    const isEgp = data.currency === "EGP";
                    return (
                      <div className="bg-white rounded-lg shadow-lg p-3" style={{ border: "1px solid #E8E5E0", minWidth: 200 }}>
                        <p className="font-medium text-sm mb-2" style={{ color: "#2C3E50" }}>{data.name}</p>
                        <div className="space-y-1 text-xs font-currency">
                          <div className="flex justify-between gap-4">
                            <span style={{ color: "#2D5A3D" }}>Paid:</span>
                            <span style={{ color: "#2D5A3D" }}>AED {Math.round(data.paid).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span style={{ color: "#999" }}>Remaining:</span>
                            <span style={{ color: "#999" }}>AED {Math.round(data.remaining).toLocaleString()}</span>
                          </div>
                          {isEgp && data.paidOriginal !== undefined && (
                            <>
                              <hr className="my-1" style={{ borderColor: "#E8E5E0" }} />
                              <p className="text-xs" style={{ color: "#C0714A" }}>Original (EGP):</p>
                              <div className="flex justify-between gap-4">
                                <span style={{ color: "#C0714A" }}>Paid:</span>
                                <span style={{ color: "#C0714A" }}>EGP {Math.round(data.paidOriginal).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span style={{ color: "#C0714A" }}>Remaining:</span>
                                <span style={{ color: "#C0714A" }}>EGP {Math.round(data.remainingOriginal).toLocaleString()}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="paid" stackId="a" fill="#2D5A3D" name="Paid" />
                <Bar dataKey="remaining" stackId="a" fill="#EEF5EE" name="Remaining" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm" style={{ color: "#666666" }}>No payment data</div>
          )}
        </div>

        {/* Monthly Liability Timeline */}
        <div className="bg-white rounded-lg p-5" style={{ border: "1px solid #E8E5E0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <h3 className="font-semibold mb-4" style={{ color: "#2C3E50" }}>
            Monthly Liability Timeline
            {currencyView === "aggregated" && <span className="text-xs font-normal ml-2" style={{ color: "#C0714A" }}>(in AED)</span>}
          </h3>
          {liabilityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={liabilityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E5E0" />
                <XAxis dataKey="month" style={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} style={{ fontSize: 11, fontFamily: "'JetBrains Mono'" }} />
                <Tooltip formatter={(v: number) => v.toLocaleString()} />
                <Legend />
                {currencyView === "aggregated" ? (
                  <Area type="monotone" dataKey="AED (Total)" stroke="#2D5A3D" fill="#2D5A3D" fillOpacity={0.3} />
                ) : (
                  <>
                    <Area type="monotone" dataKey="AED" stackId="1" stroke="#2D5A3D" fill="#2D5A3D" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="EGP" stackId="1" stroke="#C0714A" fill="#C0714A" fillOpacity={0.3} />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm" style={{ color: "#666666" }}>No liability data</div>
          )}
        </div>

        {/* Payment Status Summary */}
        <div className="bg-white rounded-lg p-5" style={{ border: "1px solid #E8E5E0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <h3 className="font-semibold mb-4" style={{ color: "#2C3E50" }}>Payment Status Summary</h3>
          {statusSummaryData.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={statusSummaryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E5E0" />
                <XAxis dataKey="name" style={{ fontSize: 11 }} />
                <YAxis style={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" name="Installments">
                  {statusSummaryData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm" style={{ color: "#666666" }}>No payment data</div>
          )}
        </div>
      </div>

      {/* Properties Quick List */}
      <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #E8E5E0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div className="px-5 py-4" style={{ background: "linear-gradient(to right, #2D5A3D, #4A7C59)" }}>
          <h3 className="font-semibold text-white">Properties Overview</h3>
        </div>
        {metrics.properties.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full table-striped">
              <thead>
                <tr style={{ borderBottom: "1px solid #E8E5E0" }}>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "#666666" }}>Property</th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "#666666" }}>Location</th>
                  <th className="text-right px-5 py-3 text-sm font-medium" style={{ color: "#666666" }}>Purchase Price</th>
                  <th className="text-right px-5 py-3 text-sm font-medium" style={{ color: "#666666" }}>Market Value</th>
                  <th className="text-center px-5 py-3 text-sm font-medium" style={{ color: "#666666" }}>Paid %</th>
                  <th className="text-left px-5 py-3 text-sm font-medium" style={{ color: "#666666" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {metrics.properties.map((p) => {
                  const propPayments = metrics.payments.filter((pm) => pm.payment.propertyId === p.id);
                  const totalPaid = propPayments.reduce((s, pm) => s + (Number(pm.payment.amountPaid) || 0), 0);
                  const progress = getPaymentProgress(p.totalPrice || "0", totalPaid);
                  const displayPrice = currencyView === "aggregated"
                    ? formatCurrency(toAed(Number(p.totalPrice), p.currency), "AED")
                    : formatCurrency(p.totalPrice || "0", p.currency);
                  const marketVal = Number(p.currentMarketValue) || Number(p.totalPrice) || 0;
                  const displayMarketVal = currencyView === "aggregated"
                    ? formatCurrency(toAed(marketVal, p.currency), "AED")
                    : formatCurrency(marketVal, p.currency);
                  const gain = marketVal - (Number(p.totalPrice) || 0);
                  return (
                    <tr
                      key={p.id}
                      className="cursor-pointer hover:bg-green-tint transition-colors"
                      style={{ borderBottom: "1px solid #E8E5E0" }}
                      onClick={() => setLocation(`/properties/${p.id}`)}
                    >
                      <td className="px-5 py-3">
                        <div className="font-medium text-sm" style={{ color: "#2C3E50" }}>{p.propertyName}</div>
                        <div className="text-xs" style={{ color: "#666666" }}>{p.projectName}</div>
                      </td>
                      <td className="px-5 py-3 text-sm" style={{ color: "#666666" }}>{p.city}, {p.country}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="font-currency text-sm font-medium" style={{ color: "#2C3E50" }}>
                          {displayPrice}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="font-currency text-sm font-medium" style={{ color: "#2C3E50" }}>
                          {displayMarketVal}
                        </div>
                        {gain !== 0 && (
                          <div className="font-currency text-xs" style={{ color: gain > 0 ? "#2D5A3D" : "#C0714A" }}>
                            {gain > 0 ? "+" : ""}{currencyView === "aggregated" ? formatCurrency(toAed(gain, p.currency), "AED") : formatCurrency(gain, p.currency)}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-16 h-2 rounded-full overflow-hidden" style={{ background: "#EEF5EE" }}>
                            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "#2D5A3D" }} />
                          </div>
                          <span className="font-currency text-xs" style={{ color: "#666666" }}>{progress}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getDeliveryStatusBadgeClass(p.deliveryStatus)}`}>
                          {p.deliveryStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center" style={{ color: "#666666" }}>
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium mb-1">No properties yet</p>
            <p className="text-sm mb-4">Add your first property to get started.</p>
            <button
              onClick={() => setLocation("/properties/new")}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-all hover:-translate-y-0.5"
              style={{ background: "#2D5A3D" }}
            >
              Add Property
            </button>
          </div>
        )}
      </div>
      {/* Record Payment Dialog */}
      <Dialog open={showRecordPayment} onOpenChange={(open) => { if (!open) { setShowRecordPayment(false); setSelectedPaymentForRecord(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: "#2C3E50" }}>Record Payment</DialogTitle>
          </DialogHeader>
          {selectedPaymentForRecord && (
            <QuickRecordPaymentForm
              payment={selectedPaymentForRecord}
              isLoading={recordPaymentMut.isPending}
              onSubmit={(data: any) => recordPaymentMut.mutate(data)}
              onCancel={() => { setShowRecordPayment(false); setSelectedPaymentForRecord(null); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Overdue Payments List Dialog */}
      <Dialog open={showOverdueList} onOpenChange={setShowOverdueList}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ color: "#2C3E50" }}>Overdue Payments</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {metrics.overduePayments?.map((op: any) => (
              <div key={op.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "#FFF8F0", border: "1px solid #F0D4B8" }}>
                <div>
                  <div className="text-sm font-medium" style={{ color: "#2C3E50" }}>{op.propertyName}</div>
                  <div className="text-xs" style={{ color: "#666" }}>{op.label} — Due {formatDate(op.dueDate)}</div>
                  <div className="font-currency text-sm font-semibold mt-1" style={{ color: "#C0714A" }}>{formatCurrency(op.amount, op.currency)}</div>
                </div>
                <button
                  onClick={() => { setShowOverdueList(false); setSelectedPaymentForRecord(op); setShowRecordPayment(true); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:-translate-y-0.5"
                  style={{ background: "#2D5A3D" }}
                >
                  <CreditCard className="h-3.5 w-3.5" /> Record
                </button>
              </div>
            ))}
            {(!metrics.overduePayments || metrics.overduePayments.length === 0) && (
              <div className="text-center py-6 text-sm" style={{ color: "#666" }}>
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No overdue payments
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Quick Record Payment Form ──────────────────────────────
function QuickRecordPaymentForm({ payment, isLoading, onSubmit, onCancel }: {
  payment: { id: number; dueDate: string; amount: number; amountDue: number; currency: string; propertyName: string; label: string };
  isLoading: boolean;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(String(payment.amount));
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      id: payment.id,
      amountPaid: amount,
      paymentDate: date,
      paymentMethod: method || undefined,
      paymentReference: reference || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 rounded-lg" style={{ background: "#F8FAF8", border: "1px solid #D5E5D5" }}>
        <div className="text-xs" style={{ color: "#666666" }}>{payment.propertyName}</div>
        <div className="text-xs mt-0.5" style={{ color: "#999" }}>{payment.label}</div>
        <div className="font-currency text-sm font-medium mt-1" style={{ color: "#2C3E50" }}>Balance Due: {formatCurrency(payment.amount, payment.currency)}</div>
        <div className="text-xs mt-0.5" style={{ color: "#666" }}>Due Date: {formatDate(payment.dueDate)}</div>
      </div>
      <div>
        <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Amount Paid *</label>
        <input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm font-currency" style={{ border: "1px solid #D5D0C8" }} placeholder="0.00" />
      </div>
      <div>
        <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Payment Date *</label>
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }} />
      </div>
      <div>
        <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Payment Method</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }}>
          <option value="">Select method</option>
          <option value="Bank Transfer">Bank Transfer</option>
          <option value="Cheque">Cheque</option>
          <option value="Credit Card">Credit Card</option>
          <option value="Cash">Cash</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Reference Number</label>
        <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }} />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <button type="submit" disabled={isLoading} className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-all hover:-translate-y-0.5" style={{ background: "#2D5A3D" }}>
          {isLoading ? "Saving..." : "Record Payment"}
        </button>
      </div>
    </form>
  );
}
