/**
 * FreeDaysBadge — Visual countdown indicator for free days (demurrage/detention).
 *
 * Colors:
 *  - Green:  > 5 days remaining
 *  - Yellow: 1–5 days remaining
 *  - Red:    0 or overdue (negative)
 *  - Gray:   No data available
 *
 * Logic:
 *  - If freeDays is set but no arrivalDate → shows total free days in gray (not yet arrived)
 *  - If freeDays and arrivalDate → calculates remaining = freeDays - elapsed, shows colored badge
 *  - If no freeDays → shows "—"
 */
import { C, MONO } from "@/lib/data";

interface FreeDaysBadgeProps {
  /** Total free days allocated (from Odoo) */
  freeDays: number | null | undefined;
  /** Arrival date string (ETA POD or actual arrival) — ISO date or "YYYY-MM-DD" */
  arrivalDate: string | null | undefined;
  /** Compact mode for list tables (smaller font, no label) */
  compact?: boolean;
  /** Optional label prefix shown before the value (e.g. "POD Dem+Det") */
  label?: string;
}

export function FreeDaysBadge({ freeDays, arrivalDate, compact = false, label }: FreeDaysBadgeProps) {
  if (!freeDays && freeDays !== 0) {
    return <span style={{ color: C.muted, fontSize: compact ? 9 : 10 }}>—</span>;
  }

  // If no arrival date, show total free days in neutral style (not yet arrived)
  if (!arrivalDate) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          padding: compact ? "1px 6px" : "2px 8px",
          borderRadius: 4,
          fontSize: compact ? 9 : 10,
          fontWeight: 600,
          fontFamily: MONO,
          background: "#f0f0f0",
          color: C.gray,
          whiteSpace: "nowrap",
        }}
        title={`${freeDays} free days allocated (not yet arrived)`}
      >
        {freeDays}d
      </span>
    );
  }

  // Calculate elapsed days since arrival
  const arrival = new Date(arrivalDate);
  const now = new Date();
  const elapsedMs = now.getTime() - arrival.getTime();
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

  // If arrival is in the future, show total free days in green
  if (elapsedDays < 0) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          padding: compact ? "1px 6px" : "2px 8px",
          borderRadius: 4,
          fontSize: compact ? 9 : 10,
          fontWeight: 600,
          fontFamily: MONO,
          background: "#e8f5e9",
          color: "#2e7d32",
          whiteSpace: "nowrap",
        }}
        title={`${freeDays} free days · Arriving ${arrivalDate}`}
      >
        {freeDays}d
      </span>
    );
  }

  const remaining = freeDays - elapsedDays;

  // Determine color based on remaining days
  let bg: string;
  let fg: string;
  let icon: string;
  if (remaining > 5) {
    bg = "#e8f5e9";
    fg = "#2e7d32";
    icon = "●";
  } else if (remaining > 0) {
    bg = "#fff8e1";
    fg = "#f57f17";
    icon = "▲";
  } else {
    bg = "#ffebee";
    fg = "#c62828";
    icon = "⚠";
  }

  const badgeLabel = remaining >= 0 ? `${remaining}d left` : `${Math.abs(remaining)}d over`;
  const tooltip = `${freeDays} free days · ${elapsedDays} elapsed · ${remaining >= 0 ? remaining + " remaining" : Math.abs(remaining) + " overdue"}`;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: compact ? "1px 6px" : "2px 8px",
        borderRadius: 4,
        fontSize: compact ? 9 : 10,
        fontWeight: 600,
        fontFamily: MONO,
        background: bg,
        color: fg,
        whiteSpace: "nowrap",
      }}
      title={tooltip}
    >
      <span style={{ fontSize: compact ? 7 : 8 }}>{icon}</span>
      {badgeLabel}
    </span>
  );
}
