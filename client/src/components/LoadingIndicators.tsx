// ══════════════════════════════════════════════════════════════════════════════
// LOADING INDICATORS — Platfarm Trade Operations Portal
// Reusable loading components: TopProgressBar, Spinner, Skeleton variants
// ══════════════════════════════════════════════════════════════════════════════

import { C, FONT } from "@/lib/data";

// ─── CSS Keyframes (injected once) ──────────────────────────────────────────
const KEYFRAMES = `
@keyframes pf-progress {
  0% { transform: translateX(-100%); }
  50% { transform: translateX(0%); }
  100% { transform: translateX(100%); }
}
@keyframes pf-spin {
  to { transform: rotate(360deg); }
}
@keyframes pf-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes pf-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`;

let injected = false;
function injectKeyframes() {
  if (injected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
  injected = true;
}

// ─── Top Progress Bar ───────────────────────────────────────────────────────
// Slim animated bar at the top of the content area during data loading
export function TopProgressBar({ show = true }: { show?: boolean }) {
  injectKeyframes();
  if (!show) return null;
  return (
    <div style={{
      position: "fixed", top: 3, left: 0, right: 0, height: 2, zIndex: 9999,
      overflow: "hidden", pointerEvents: "none",
    }}>
      <div style={{
        width: "40%", height: "100%",
        background: `linear-gradient(90deg, transparent, ${C.forest}, ${C.sage}, transparent)`,
        animation: "pf-progress 1.5s ease-in-out infinite",
      }} />
    </div>
  );
}

// ─── Spinner ────────────────────────────────────────────────────────────────
// Consistent circular spinner with optional label
export function Spinner({
  size = 28,
  color = C.forest,
  label,
  style: extraStyle,
}: {
  size?: number;
  color?: string;
  label?: string;
  style?: React.CSSProperties;
}) {
  injectKeyframes();
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
      ...extraStyle,
    }}>
      <div style={{
        width: size, height: size,
        borderWidth: Math.max(2, size / 10), borderStyle: "solid",
        borderColor: C.border, borderTopColor: color,
        borderRadius: "50%", animation: "pf-spin 0.8s linear infinite",
      }} />
      {label && (
        <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>{label}</span>
      )}
    </div>
  );
}

// ─── Full Page Spinner ──────────────────────────────────────────────────────
// Centered spinner for full-page loading states
export function PageSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 60, minHeight: 300,
    }}>
      <Spinner size={32} label={label} />
    </div>
  );
}

// ─── Shimmer Box ────────────────────────────────────────────────────────────
// Animated shimmer placeholder matching a specific shape
export function ShimmerBox({
  width = "100%",
  height = 16,
  borderRadius = 4,
  style: extraStyle,
}: {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: React.CSSProperties;
}) {
  injectKeyframes();
  return (
    <div style={{
      width, height, borderRadius,
      background: `linear-gradient(90deg, ${C.border}00 0%, ${C.border} 30%, ${C.border}88 50%, ${C.border} 70%, ${C.border}00 100%)`,
      backgroundSize: "200% 100%",
      animation: "pf-shimmer 1.8s ease-in-out infinite",
      ...extraStyle,
    }} />
  );
}

// ─── Pulse Box ──────────────────────────────────────────────────────────────
// Subtle pulsing placeholder
export function PulseBox({
  width = "100%",
  height = 16,
  borderRadius = 4,
  style: extraStyle,
}: {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: React.CSSProperties;
}) {
  injectKeyframes();
  return (
    <div style={{
      width, height, borderRadius,
      background: C.border,
      animation: "pf-pulse 1.5s ease-in-out infinite",
      ...extraStyle,
    }} />
  );
}

// ─── Stat Card Skeleton ─────────────────────────────────────────────────────
// Matches the Dashboard stat card layout
export function StatCardSkeleton() {
  return (
    <div style={{
      background: C.gBg, border: `1px solid ${C.gBdr}`, borderRadius: 8,
      padding: "14px 16px", flex: 1, minWidth: 120,
    }}>
      <ShimmerBox width={80} height={9} style={{ marginBottom: 10 }} />
      <ShimmerBox width={100} height={24} borderRadius={4} style={{ marginBottom: 6 }} />
      <ShimmerBox width={60} height={9} />
    </div>
  );
}

// ─── Pipeline Skeleton ──────────────────────────────────────────────────────
// Matches the Pipeline Stages layout with circles and dots
export function PipelineSkeleton() {
  injectKeyframes();
  const circles = Array.from({ length: 7 });
  return (
    <div style={{ padding: "16px 14px 8px" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 6, flexWrap: "wrap",
      }}>
        {circles.map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <PulseBox width={36} height={36} borderRadius={18} />
            {i < circles.length - 1 && (
              <PulseBox width={4} height={4} borderRadius={2} />
            )}
          </div>
        ))}
      </div>
      <div style={{
        display: "flex", gap: 6, marginTop: 12, justifyContent: "center",
        flexWrap: "wrap",
      }}>
        {[80, 65, 70, 75, 85, 60].map((w, i) => (
          <ShimmerBox key={i} width={w} height={22} borderRadius={11} />
        ))}
      </div>
      <div style={{
        display: "flex", justifyContent: "center", gap: 24, marginTop: 14,
      }}>
        <ShimmerBox width={80} height={32} />
        <ShimmerBox width={80} height={32} />
        <ShimmerBox width={80} height={32} />
      </div>
    </div>
  );
}

// ─── Table Row Skeleton ─────────────────────────────────────────────────────
// Matches a table row with shimmer cells
export function TableRowSkeleton({ cols = 8 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "10px 8px" }}>
          <ShimmerBox
            width={i === 0 ? 100 : i === 1 ? "80%" : i === 2 ? 70 : 50}
            height={12}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── Table Skeleton ─────────────────────────────────────────────────────────
// Full table skeleton with multiple rows
export function TableSkeleton({ rows = 5, cols = 8 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} cols={cols} />
      ))}
    </>
  );
}

// ─── Alert Skeleton ─────────────────────────────────────────────────────────
// Matches the alert card items
export function AlertSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 10px", background: C.tBg, border: `1px solid ${C.tBdr}`,
          borderRadius: 6,
        }}>
          <PulseBox width={20} height={20} borderRadius={4} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <ShimmerBox width="70%" height={11} />
          </div>
          <PulseBox width={8} height={8} borderRadius={4} />
        </div>
      ))}
    </div>
  );
}

// ─── Agreement Card Skeleton ────────────────────────────────────────────────
export function AgreementCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: 16,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <ShimmerBox width={140} height={14} />
            <ShimmerBox width={60} height={20} borderRadius={10} />
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <ShimmerBox width={100} height={11} />
            <ShimmerBox width={80} height={11} />
            <ShimmerBox width={120} height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Detail Page Skeleton ───────────────────────────────────────────────────
// Full skeleton for shipment detail pages
export function DetailPageSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "8px 0",
      }}>
        <PulseBox width={28} height={28} borderRadius={6} />
        <ShimmerBox width={180} height={18} />
        <ShimmerBox width={70} height={22} borderRadius={11} style={{ marginLeft: 8 }} />
      </div>

      {/* Pipeline */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PulseBox width={28} height={28} borderRadius={14} />
              {i < 9 && <PulseBox width={16} height={2} />}
            </div>
          ))}
        </div>
      </div>

      {/* Info cards */}
      <div style={{ display: "flex", gap: 12 }}>
        {[1, 2].map(n => (
          <div key={n} style={{
            flex: 1, background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: 16,
          }}>
            <ShimmerBox width={100} height={12} style={{ marginBottom: 14 }} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <ShimmerBox width={80} height={10} />
                <ShimmerBox width={120} height={10} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Tabs placeholder */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: 16,
      }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[60, 50, 70, 55].map((w, i) => (
            <ShimmerBox key={i} width={w} height={28} borderRadius={6} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: "flex", gap: 12 }}>
              <ShimmerBox width="30%" height={12} />
              <ShimmerBox width="50%" height={12} />
              <ShimmerBox width="20%" height={12} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Inline Spinner ────────────────────────────────────────────────────────
// Tiny spinner for inline use next to checkboxes, buttons, etc.
export function InlineSpinner({
  size = 12,
  color = C.forest,
  style: extraStyle,
}: {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  injectKeyframes();
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      borderWidth: Math.max(1.5, size / 8), borderStyle: "solid",
      borderColor: `${color}33`, borderTopColor: color,
      borderRadius: "50%", animation: "pf-spin 0.7s linear infinite",
      display: "inline-block",
      ...extraStyle,
    }} />
  );
}

// ─── Mutation Progress Bar ─────────────────────────────────────────────────
// Slim progress bar shown at the top of a section/card during mutations
export function MutationProgressBar({
  show = false,
  color = C.forest,
}: {
  show?: boolean;
  color?: string;
}) {
  injectKeyframes();
  if (!show) return null;
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 2,
      overflow: "hidden", borderRadius: "8px 8px 0 0", zIndex: 10,
    }}>
      <div style={{
        width: "40%", height: "100%",
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        animation: "pf-progress 1.2s ease-in-out infinite",
      }} />
    </div>
  );
}

// ─── User Management Skeleton ───────────────────────────────────────────────
export function UserMgmtSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 14px", background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 8,
        }}>
          <PulseBox width={32} height={32} borderRadius={16} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <ShimmerBox width={120} height={12} />
            <ShimmerBox width={80} height={9} />
          </div>
          <ShimmerBox width={60} height={22} borderRadius={11} />
        </div>
      ))}
    </div>
  );
}
