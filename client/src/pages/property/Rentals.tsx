import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Home,
  MapPin,
  Calendar,
  DollarSign,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  Edit2,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-500/15 text-green-700 border-green-200",
  Expired: "bg-gray-500/15 text-gray-600 border-gray-200",
  Terminated: "bg-red-500/15 text-red-700 border-red-200",
  Renewed: "bg-blue-500/15 text-blue-700 border-blue-200",
};

const PAYMENT_STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  Paid: { color: "text-green-600", icon: CheckCircle2, label: "Paid" },
  Pending: { color: "text-amber-600", icon: Clock, label: "Pending" },
  Overdue: { color: "text-red-600", icon: AlertTriangle, label: "Overdue" },
  Bounced: { color: "text-red-800", icon: XCircle, label: "Bounced" },
};

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatAmount(amount: string | number, currency: string) {
  return `${currency} ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getDaysUntil(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function RentalCard({ rental }: { rental: any }) {
  const [expanded, setExpanded] = useState(true);
  const [recordingId, setRecordingId] = useState<number | null>(null);
  const [recordForm, setRecordForm] = useState({ paymentStatus: "Paid", paymentDate: new Date().toISOString().split("T")[0], notes: "" });
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const { data: payments, isLoading: paymentsLoading } = trpc.property.rentals.payments.useQuery(
    { rentalId: rental.id },
    { enabled: expanded }
  );

  const recordPaymentMutation = trpc.property.rentals.recordPayment.useMutation({
    onSuccess: () => {
      utils.property.rentals.payments.invalidate({ rentalId: rental.id });
      setRecordingId(null);
      toast.success("Cheque status has been updated.");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update payment");
    },
  });

  const paidCount = payments?.filter(p => p.paymentStatus === "Paid").length ?? 0;
  const totalCount = payments?.length ?? 0;
  const totalPaid = payments?.filter(p => p.paymentStatus === "Paid").reduce((s, p) => s + Number(p.amount), 0) ?? 0;
  const totalAnnual = Number(rental.annualRent);
  const progressPct = totalAnnual > 0 ? Math.min(100, (totalPaid / totalAnnual) * 100) : 0;

  // Find next upcoming payment
  const nextPayment = payments
    ?.filter(p => p.paymentStatus === "Pending")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  const daysUntilNext = nextPayment ? getDaysUntil(nextPayment.dueDate) : null;

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <Home className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">{rental.propertyName}</CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {rental.unitRef && (
                  <span className="text-sm text-muted-foreground">Unit {rental.unitRef}</span>
                )}
                {rental.buildingName && (
                  <span className="text-sm text-muted-foreground">· {rental.buildingName}</span>
                )}
                {rental.location && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {rental.location}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={`text-xs border ${STATUS_COLORS[rental.status] || STATUS_COLORS.Active}`}>
              {rental.status}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Key metrics row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Annual Rent</p>
            <p className="font-semibold text-sm">{formatAmount(rental.annualRent, rental.currency)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Contract Period</p>
            <p className="font-semibold text-sm">{formatDate(rental.contractStartDate)}</p>
            <p className="text-xs text-muted-foreground">to {formatDate(rental.contractEndDate)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Cheques Paid</p>
            <p className="font-semibold text-sm">{paidCount} / {totalCount}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Next Cheque</p>
            {nextPayment ? (
              <>
                <p className="font-semibold text-sm">{formatDate(nextPayment.dueDate)}</p>
                <p className={`text-xs ${daysUntilNext !== null && daysUntilNext <= 7 ? "text-red-600 font-medium" : daysUntilNext !== null && daysUntilNext <= 30 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {daysUntilNext !== null && daysUntilNext >= 0 ? `in ${daysUntilNext} days` : daysUntilNext !== null ? `${Math.abs(daysUntilNext)} days overdue` : ""}
                </p>
              </>
            ) : (
              <p className="font-semibold text-sm text-green-600">All paid</p>
            )}
          </div>
        </div>

        {/* Payment progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Payment Progress</span>
            <span>{formatAmount(totalPaid, rental.currency)} / {formatAmount(rental.annualRent, rental.currency)}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Cheque schedule */}
        {expanded && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-muted-foreground">Cheque Schedule</h4>
              {rental.bankName && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  {rental.bankName}
                </span>
              )}
            </div>
            {paymentsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-12 bg-muted/40 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : payments && payments.length > 0 ? (
              <div className="space-y-2">
                {payments.map((payment) => {
                  const config = PAYMENT_STATUS_CONFIG[payment.paymentStatus] || PAYMENT_STATUS_CONFIG.Pending;
                  const StatusIcon = config.icon;
                  const daysUntil = getDaysUntil(payment.dueDate);
                  const isUrgent = payment.paymentStatus === "Pending" && daysUntil <= 7 && daysUntil >= 0;
                  const isOverdue = payment.paymentStatus === "Pending" && daysUntil < 0;

                  return (
                    <div
                      key={payment.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        isOverdue ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800" :
                        isUrgent ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800" :
                        "bg-muted/30 border-border/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <StatusIcon className={`h-4 w-4 shrink-0 ${config.color}`} />
                        <div>
                          <p className="text-sm font-medium">{payment.installmentLabel}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>Due: {formatDate(payment.dueDate)}</span>
                            {payment.chequeNumber && (
                              <span className="text-muted-foreground">· Cheque #{payment.chequeNumber}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatAmount(payment.amount, rental.currency)}</p>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              payment.paymentStatus === "Paid" ? "border-green-300 text-green-700" :
                              payment.paymentStatus === "Bounced" ? "border-red-300 text-red-700" :
                              isOverdue ? "border-red-300 text-red-700" :
                              isUrgent ? "border-amber-300 text-amber-700" :
                              "border-border text-muted-foreground"
                            }`}
                          >
                            {isOverdue && payment.paymentStatus === "Pending" ? "Overdue" : config.label}
                          </Badge>
                        </div>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setRecordingId(payment.id);
                              setRecordForm({
                                paymentStatus: payment.paymentStatus,
                                paymentDate: payment.paymentDate || new Date().toISOString().split("T")[0],
                                notes: payment.notes || "",
                              });
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No cheque schedule found.</p>
            )}
          </div>
        )}

        {/* Landlord / contract info */}
        {expanded && (rental.landlord || rental.contractNumber || null) && (
          <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-2 md:grid-cols-3 gap-3">
            {rental.landlord && (
              <div>
                <p className="text-xs text-muted-foreground">Landlord</p>
                <p className="text-sm font-medium">{rental.landlord}</p>
              </div>
            )}
            {null && (
              <div>
                <p className="text-xs text-muted-foreground">Managing Agent</p>
                <p className="text-sm font-medium">{null}</p>
              </div>
            )}
            {rental.contractNumber && (
              <div>
                <p className="text-xs text-muted-foreground">Contract No.</p>
                <p className="text-sm font-medium">{rental.contractNumber}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Record Payment Dialog */}
      <Dialog open={recordingId !== null} onOpenChange={(open) => !open && setRecordingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Cheque Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={recordForm.paymentStatus}
                onValueChange={(v) => setRecordForm(f => ({ ...f, paymentStatus: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                  <SelectItem value="Bounced">Bounced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={recordForm.paymentDate}
                onChange={(e) => setRecordForm(f => ({ ...f, paymentDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="e.g. Cheque cleared on..."
                value={recordForm.notes}
                onChange={(e) => setRecordForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordingId(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (recordingId !== null) {
                  recordPaymentMutation.mutate({
                    id: recordingId,
                    paymentStatus: recordForm.paymentStatus as any,
                    paymentDate: recordForm.paymentDate || undefined,
                    notes: recordForm.notes || undefined,
                  });
                }
              }}
              disabled={recordPaymentMutation.isPending}
            >
              {recordPaymentMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function Rentals() {
  const { data: rentalsList, isLoading } = trpc.property.rentals.list.useQuery();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const activeRentals = rentalsList?.filter(r => r.status === "Active") ?? [];
  const otherRentals = rentalsList?.filter(r => r.status !== "Active") ?? [];

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Rentals</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Track your rental contracts and cheque schedules
            </p>
          </div>
          {isAdmin && (
            <Button size="sm" className="gap-2" onClick={() => alert("Add rental form coming soon")}>
              <Plus className="h-4 w-4" />
              Add Rental
            </Button>
          )}
        </div>

        {/* Summary cards */}
        {rentalsList && rentalsList.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card className="border border-border/60">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Active Contracts</p>
                <p className="text-2xl font-bold">{activeRentals.length}</p>
              </CardContent>
            </Card>
            <Card className="border border-border/60">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Annual Rent</p>
                <p className="text-xl font-bold">
                  {activeRentals.reduce((s, r) => s + Number(r.annualRent), 0).toLocaleString()} AED
                </p>
              </CardContent>
            </Card>
            <Card className="border border-border/60">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Upcoming (30 days)</p>
                <p className="text-2xl font-bold text-amber-600">
                  {/* Shown in individual cards */}—
                </p>
              </CardContent>
            </Card>
            <Card className="border border-border/60">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Contracts</p>
                <p className="text-2xl font-bold">{rentalsList.length}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="h-48 bg-muted/40 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Rental cards */}
        {!isLoading && rentalsList && rentalsList.length === 0 && (
          <div className="text-center py-16">
            <Home className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No rentals yet</p>
            {isAdmin && (
              <p className="text-sm text-muted-foreground mt-1">Click "Add Rental" to get started</p>
            )}
          </div>
        )}

        {activeRentals.length > 0 && (
          <div className="space-y-4 mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active</h2>
            {activeRentals.map(rental => (
              <RentalCard key={rental.id} rental={rental} />
            ))}
          </div>
        )}

        {otherRentals.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Past / Other</h2>
            {otherRentals.map(rental => (
              <RentalCard key={rental.id} rental={rental} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
