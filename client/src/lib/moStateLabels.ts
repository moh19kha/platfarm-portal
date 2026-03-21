// ══════════════════════════════════════════════════════════════════════════════
// MO STATE LABELS & COLORS — Manufacturing Order state maps
// ══════════════════════════════════════════════════════════════════════════════
import { C } from "@/lib/data";

/** Manufacturing Order state labels */
export const MO_STATE_LABELS: Record<string, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  progress: "In Progress",
  to_close: "To Close",
  done: "Done",
  cancel: "Cancelled",
};

/** Manufacturing Order badge variants */
export const MO_STATE_BADGE: Record<string, string> = {
  draft: "default",
  confirmed: "amber",
  progress: "terra",
  to_close: "sage",
  done: "green",
  cancel: "red",
};

/** Manufacturing Order state → color */
export const MO_STATE_COLORS: Record<string, string> = {
  draft: C.muted,
  confirmed: C.amber,
  progress: C.terra,
  to_close: C.sage,
  done: C.forest,
  cancel: C.red,
};

/** MO stages for pipeline display */
export const MO_STAGES = [
  { id: "draft", label: "Draft" },
  { id: "confirmed", label: "Confirmed" },
  { id: "progress", label: "In Progress" },
  { id: "to_close", label: "To Close" },
  { id: "done", label: "Done" },
  { id: "cancel", label: "Cancelled" },
];

/** Input quality grade labels */
export const QUALITY_GRADE_LABELS: Record<string, string> = {
  premium: "Premium",
  grade_1: "Grade 1",
  fair: "Fair Grade",
  low: "Low Grade",
};

/** Bale grade labels for output */
export const BALE_GRADE_LABELS: Record<string, { label: string; color: string }> = {
  supreme: { label: "Supreme", color: C.forest },
  premium: { label: "Premium", color: C.sage },
  grade1: { label: "Grade 1", color: C.blue },
  fair: { label: "Fair Grade", color: C.amber },
  fairGrade3: { label: "Fair Grade 3", color: "#B45309" },
  alfamix: { label: "AlfaMix", color: C.terra },
  mixGrass: { label: "Mix Grass", color: "#8B5CF6" },
  wheatStraw: { label: "Wheat Straw", color: "#D4960A" },
};

/** Format kg to tons string */
export function fmtTons(kg: number): string {
  if (!kg || kg === 0) return "—";
  const tons = kg / 1000;
  return tons >= 1
    ? `${tons.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} T`
    : `${kg.toLocaleString()} kg`;
}

/** Format hours */
export function fmtHours(h: number): string {
  if (!h || h === 0) return "—";
  return `${h.toFixed(1)} h`;
}

/** Format liters */
export function fmtLiters(l: number): string {
  if (!l || l === 0) return "—";
  return `${l.toLocaleString()} L`;
}

/** Short product name — take first 2 words */
export function shortProduct(name: string | null): string {
  if (!name) return "—";
  const words = name.split(/[\s/]+/);
  return words.length > 3 ? words.slice(0, 3).join(" ") + "…" : name;
}

/** Total bales from bales object */
export function totalBales(bales: Record<string, number> | null | undefined): number {
  if (!bales) return 0;
  return Object.values(bales).reduce((s, v) => s + (v || 0), 0);
}
