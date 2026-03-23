import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate, getPaymentStatusBadgeClass } from "./propUtils";
import { CalendarClock, List, Grid3X3, ChevronLeft, ChevronRight, DollarSign } from "lucide-react";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

type CurrencyMode = "" | "AED" | "EGP" | "Aggregated";

export default function PaymentCalendar() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [statusFilter, setStatusFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyMode>("");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  const { data: settings } = trpc.property.settings.get.useQuery();
  const egpToAed = Number(settings?.egpToAedRate) || 0.077;
  const isAggregated = currencyFilter === "Aggregated";

  const toAed = (amount: number, currency: string) => {
    if (currency === "AED") return amount;
    return amount * egpToAed;
  };

  const { data: allPayments, isLoading, refetch } = trpc.property.payments.all.useQuery({
    status: statusFilter || undefined,
    propertyId: propertyFilter ? Number(propertyFilter) : undefined,
    currency: currencyFilter === "Aggregated" ? undefined : (currencyFilter || undefined),
  });

  const { data: properties } = trpc.property.properties.list.useQuery();

  const recordPaymentMut = trpc.property.payments.recordPayment.useMutation({
    onSuccess: () => { refetch(); setShowPaymentModal(false); toast.success("Payment recorded"); },
    onError: () => toast.error("Failed to record payment"),
  });

  const filteredPayments = useMemo(() => {
    if (!allPayments) return [];
    return allPayments;
  }, [allPayments]);

  const calendarDays = useMemo(() => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days: { date: string; day: number; isCurrentMonth: boolean; payments: any[] }[] = [];

    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d.toISOString().split("T")[0], day: d.getDate(), isCurrentMonth: false, payments: [] });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayPayments = filteredPayments.filter((p) => p.payment.dueDate === dateStr);
      days.push({ date: dateStr, day: d, isCurrentMonth: true, payments: dayPayments });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d.toISOString().split("T")[0], day: d.getDate(), isCurrentMonth: false, payments: [] });
    }

    return days;
  }, [currentMonth, filteredPayments]);

  const selectStyle = { border: "1px solid #D5D0C8", color: "#2C3E50", background: "#FFFFFF", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", fontSize: "0.875rem" };
  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const formatAmount = (amount: number | string, currency: string) => {
    const num = Number(amount);
    if (isAggregated) return formatCurrency(toAed(num, currency), "AED");
    return formatCurrency(num, currency);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "#2C3E50" }}>Payment Calendar</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode("list")} className="p-2 rounded-lg transition-colors" style={{ background: viewMode === "list" ? "#EEF5EE" : "transparent", color: viewMode === "list" ? "#2D5A3D" : "#666666" }}>
            <List className="h-4 w-4" />
          </button>
          <button onClick={() => setViewMode("calendar")} className="p-2 rounded-lg transition-colors" style={{ background: viewMode === "calendar" ? "#EEF5EE" : "transparent", color: viewMode === "calendar" ? "#2D5A3D" : "#666666" }}>
            <Grid3X3 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          <option value="Paid">Paid</option>
          <option value="Pending">Pending</option>
          <option value="Overdue">Overdue</option>
          <option value="Partially-Paid">Partially Paid</option>
        </select>
        <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} style={selectStyle}>
          <option value="">All Properties</option>
          {properties?.map((p) => <option key={p.id} value={p.id}>{p.propertyName}</option>)}
        </select>
        <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value as CurrencyMode)} style={selectStyle}>
          <option value="">All Currencies</option>
          <option value="AED">AED</option>
          <option value="EGP">EGP</option>
          <option value="Aggregated">Aggregated (AED)</option>
        </select>
      </div>

      {isAggregated && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: "#FFF8F0", border: "1px solid #F0D4B8", color: "#C0714A" }}>
          <DollarSign className="h-3.5 w-3.5 shrink-0" />
          <span>EGP amounts converted to AED at rate: <strong className="font-currency">1 EGP = {egpToAed} AED</strong>. Update in Settings.</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-4 animate-pulse" style={{ border: "1px solid #E8E5E0" }}>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : viewMode === "list" ? (
        /* List View */
        <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #E8E5E0" }}>
          {filteredPayments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full table-striped">
                <thead>
                  <tr style={{ borderBottom: "1px solid #E8E5E0" }}>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#666666" }}>Due Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#666666" }}>Property</th>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#666666" }}>Installment</th>
                    <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: "#666666" }}>Amount Due{isAggregated ? " (AED)" : ""}</th>
                    <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: "#666666" }}>Paid{isAggregated ? " (AED)" : ""}</th>
                    <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: "#666666" }}>Balance{isAggregated ? " (AED)" : ""}</th>
                    <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: "#666666" }}>Status</th>
                    <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: "#666666" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((row) => {
                    const balance = Number(row.payment.amountDue) - Number(row.payment.amountPaid);
                    return (
                      <tr key={row.payment.id} style={{ borderBottom: "1px solid #E8E5E0" }}>
                        <td className="px-4 py-3 text-sm" style={{ color: "#2C3E50" }}>{formatDate(row.payment.dueDate)}</td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium" style={{ color: "#2C3E50" }}>{row.propertyName}</div>
                          <div className="text-xs" style={{ color: "#666666" }}>{row.projectName}</div>
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "#2C3E50" }}>{row.payment.installmentLabel}</td>
                        <td className="px-4 py-3 text-sm text-right font-currency" style={{ color: "#2C3E50" }}>{formatAmount(row.payment.amountDue, row.currency)}</td>
                        <td className="px-4 py-3 text-sm text-right font-currency" style={{ color: "#2D5A3D" }}>{formatAmount(row.payment.amountPaid, row.currency)}</td>
                        <td className="px-4 py-3 text-sm text-right font-currency" style={{ color: balance > 0 ? "#C0714A" : "#2D5A3D" }}>{formatAmount(balance, row.currency)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPaymentStatusBadgeClass(row.payment.paymentStatus)}`}>
                            {row.payment.paymentStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isAdmin && row.payment.paymentStatus !== "Paid" && (
                            <button
                              onClick={() => { setSelectedPayment({ ...row.payment, currency: row.currency }); setShowPaymentModal(true); }}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
                              style={{ background: "#C0714A" }}
                            >
                              Record
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <CalendarClock className="h-12 w-12 mx-auto mb-3 opacity-20" style={{ color: "#2D5A3D" }} />
              <p className="font-medium" style={{ color: "#2C3E50" }}>No payments found</p>
              <p className="text-sm mt-1" style={{ color: "#666666" }}>Payment schedules will appear here once properties are added.</p>
            </div>
          )}
        </div>
      ) : (
        /* Calendar View */
        <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #E8E5E0" }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #E8E5E0" }}>
            <button onClick={() => setCurrentMonth((prev) => {
              const d = new Date(prev.year, prev.month - 1);
              return { year: d.getFullYear(), month: d.getMonth() };
            })} className="p-1 rounded hover:bg-gray-100"><ChevronLeft className="h-5 w-5" style={{ color: "#666666" }} /></button>
            <h3 className="font-semibold" style={{ color: "#2C3E50" }}>{monthName}</h3>
            <button onClick={() => setCurrentMonth((prev) => {
              const d = new Date(prev.year, prev.month + 1);
              return { year: d.getFullYear(), month: d.getMonth() };
            })} className="p-1 rounded hover:bg-gray-100"><ChevronRight className="h-5 w-5" style={{ color: "#666666" }} /></button>
          </div>
          <div className="grid grid-cols-7">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="px-2 py-2 text-center text-xs font-medium" style={{ color: "#666666", borderBottom: "1px solid #E8E5E0" }}>{d}</div>
            ))}
            {calendarDays.map((day, i) => (
              <div
                key={i}
                className="min-h-[80px] p-1 text-xs"
                style={{
                  borderBottom: "1px solid #E8E5E0",
                  borderRight: (i + 1) % 7 !== 0 ? "1px solid #E8E5E0" : "none",
                  background: day.isCurrentMonth ? "#FFFFFF" : "#F8FAF8",
                  color: day.isCurrentMonth ? "#2C3E50" : "#AAAAAA",
                }}
              >
                <div className="font-medium mb-1">{day.day}</div>
                {day.payments.map((p: any) => (
                  <div
                    key={p.payment.id}
                    className="rounded px-1 py-0.5 mb-0.5 truncate cursor-pointer"
                    style={{
                      background: p.payment.paymentStatus === "Paid" ? "#EEF5EE" : p.payment.paymentStatus === "Overdue" ? "#FFF0E8" : "#F8FAF8",
                      color: p.payment.paymentStatus === "Paid" ? "#2D5A3D" : p.payment.paymentStatus === "Overdue" ? "#C0714A" : "#666666",
                      fontSize: "10px",
                    }}
                    title={`${p.propertyName}: ${formatAmount(p.payment.amountDue, p.currency)}`}
                  >
                    {p.propertyName?.slice(0, 12)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {selectedPayment && (
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle style={{ color: "#2C3E50" }}>Record Payment</DialogTitle>
            </DialogHeader>
            <QuickPaymentForm
              payment={selectedPayment}
              onSubmit={(data: any) => recordPaymentMut.mutate(data)}
              onCancel={() => setShowPaymentModal(false)}
              isLoading={recordPaymentMut.isPending}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function QuickPaymentForm({ payment, onSubmit, onCancel, isLoading }: any) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const balance = Number(payment.amountDue) - Number(payment.amountPaid);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ id: payment.id, amountPaid: amount, paymentDate: date, paymentMethod: method || undefined, paymentReference: reference || undefined }); }} className="space-y-4">
      <div className="p-3 rounded-lg" style={{ background: "#F8FAF8", border: "1px solid #D5E5D5" }}>
        <div className="text-xs" style={{ color: "#666666" }}>{payment.installmentLabel}</div>
        <div className="font-currency text-sm font-medium mt-1" style={{ color: "#2C3E50" }}>Balance: {formatCurrency(balance, payment.currency)}</div>
      </div>
      <div>
        <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Amount ({payment.currency}) *</label>
        <input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm font-currency" style={{ border: "1px solid #D5D0C8" }} />
      </div>
      <div>
        <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Date *</label>
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }} />
      </div>
      <div>
        <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Method</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }}>
          <option value="">Select</option>
          <option value="Bank Transfer">Bank Transfer</option>
          <option value="Cheque">Cheque</option>
          <option value="Credit Card">Credit Card</option>
          <option value="Cash">Cash</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Reference</label>
        <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid #D5D0C8" }} />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <button type="submit" disabled={isLoading} className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ background: "#2D5A3D" }}>
          {isLoading ? "Saving..." : "Record"}
        </button>
      </div>
    </form>
  );
}
