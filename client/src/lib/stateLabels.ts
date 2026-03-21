// ══════════════════════════════════════════════════════════════════════════════
// STATE LABELS & COLORS — Consolidated label/badge/color maps for PO, SO,
// Picking, and Shipment Status states.
// ══════════════════════════════════════════════════════════════════════════════

import { C } from "@/lib/data";

// ─── Labels ─────────────────────────────────────────────────────────────────

/** Purchase Order state labels */
export const PO_STATE_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  purchase: "Purchase Order",
  done: "Locked",
  cancel: "Cancelled",
};

/** Sales Order state labels */
export const SO_STATE_LABELS: Record<string, string> = {
  draft: "Quotation",
  sent: "Quotation Sent",
  sale: "Sales Order",
  done: "Locked",
  cancel: "Cancelled",
};

/** Picking / Load state labels */
export const PICKING_STATE_LABELS: Record<string, string> = {
  draft: "Draft",
  waiting: "Waiting",
  confirmed: "Confirmed",
  assigned: "Ready",
  done: "Done",
  cancel: "Cancelled",
};

// ─── Badge Variants ─────────────────────────────────────────────────────────

/** Purchase Order badge variants (for Dashboard) */
export const PO_STATE_BADGE: Record<string, string> = {
  draft: "default", sent: "amber", purchase: "green", done: "sage", cancel: "red",
};

/** Sales Order badge variants (for Dashboard) */
export const SO_STATE_BADGE: Record<string, string> = {
  draft: "default", sent: "amber", sale: "green", done: "sage", cancel: "red",
};

/** Picking / Load badge variants */
export const PICKING_STATE_BADGE: Record<string, string> = {
  draft: "default",
  waiting: "amber",
  confirmed: "terra",
  assigned: "sage",
  done: "green",
  cancel: "red",
};

// ─── Colors ─────────────────────────────────────────────────────────────────

/** Purchase Order state → color (text/dot) */
export const PO_STATE_COLORS: Record<string, string> = {
  draft: C.muted,
  sent: C.amber,
  purchase: C.forest,
  done: C.sage,
  cancel: C.red,
};

/** Sales Order state → color (text/dot) */
export const SO_STATE_COLORS: Record<string, string> = {
  draft: C.muted,
  sent: C.amber,
  sale: C.forest,
  done: C.sage,
  cancel: C.red,
};

/** Unified shipment status → color (pipeline dots, kanban cards, notifications) */
export const SHIPMENT_STATUS_COLORS: Record<string, string> = {
  "Planned": C.muted,
  "Booked": C.blue,
  "Loading": C.amber,
  "Loaded": C.amber,
  "In Transit": C.terra,
  "Arrived at Port": C.forest,
  "Customs Clearance": C.blue,
  "Delivering": C.terra,
  "Delivered": C.sage,
  "Returned": C.red,
};

/** State badge color (bg/color/border) for PO/SO state badges in tooltips */
export const STATE_BADGE_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  draft: { bg: C.gBg, color: C.gray, border: C.gBdr },
  sent: { bg: C.aBg, color: C.amber, border: C.aBdr },
  purchase: { bg: "#E4EFE6", color: C.forest, border: C.gBdr2 },
  sale: { bg: "#E4EFE6", color: C.forest, border: C.gBdr2 },
  done: { bg: C.gBg, color: C.sage, border: C.gBdr },
  cancel: { bg: C.rBg, color: C.red, border: C.rBdr },
};

/**
 * Get color for a unified shipment status string (case-insensitive).
 * Used by notification bell, toast notifications, and anywhere status
 * strings need to be colored.
 */
export function getStageColor(status: string | null): string {
  if (!status) return C.gray;
  // First try exact match from the map
  if (SHIPMENT_STATUS_COLORS[status]) return SHIPMENT_STATUS_COLORS[status];
  // Fallback: case-insensitive includes matching
  const s = status.toLowerCase();
  if (s.includes("delivered") && !s.includes("delivering")) return "#2D5A3D";
  if (s.includes("transit")) return "#3B7DD8";
  if (s.includes("loading") || s.includes("loaded")) return "#D4960A";
  if (s.includes("customs") || s.includes("clearance")) return "#8B5CF6";
  if (s.includes("arrived")) return "#0891B2";
  if (s.includes("delivering")) return "#059669";
  if (s.includes("returned")) return "#C94444";
  if (s.includes("planned")) return "#6B7280";
  if (s.includes("booked")) return "#2563EB";
  return C.sage;
}
