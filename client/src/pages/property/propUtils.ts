import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency: string = "AED"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${currency} 0`;
  return `${currency} ${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatCurrencyShort(amount: number | string, currency: string = "AED"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${currency} 0`;
  if (num >= 1000000) return `${currency} ${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${currency} ${(num / 1000).toFixed(0)}K`;
  return `${currency} ${num.toLocaleString("en-US")}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function sqmToSqft(sqm: number): number {
  return Math.round(sqm * 10.7639);
}

export function getDeliveryStatusBadgeClass(status: string): string {
  switch (status) {
    case "Off-Plan": return "badge-off-plan";
    case "Under-Construction": return "badge-under-construction";
    case "Delivered": return "badge-delivered";
    case "Handed-Over": return "badge-handed-over";
    default: return "";
  }
}

export function getPaymentStatusBadgeClass(status: string): string {
  switch (status) {
    case "Paid": return "badge-paid";
    case "Pending": return "badge-pending";
    case "Overdue": return "badge-overdue";
    case "Partially-Paid": return "badge-partially-paid";
    default: return "";
  }
}

export function getPaymentProgress(totalPrice: number | string, totalPaid: number | string): number {
  const price = typeof totalPrice === "string" ? parseFloat(totalPrice) : totalPrice;
  const paid = typeof totalPaid === "string" ? parseFloat(totalPaid) : totalPaid;
  if (!price || price === 0) return 0;
  return Math.min(Math.round((paid / price) * 100), 100);
}

export function isOverdue(dueDate: string, status: string): boolean {
  if (status === "Paid") return false;
  const today = new Date().toISOString().split("T")[0];
  return dueDate < today;
}
