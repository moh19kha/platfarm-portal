// ══════════════════════════════════════════════════════════════════════════════
// UI PRIMITIVES — Platfarm Design System v3
// ══════════════════════════════════════════════════════════════════════════════

import { C, FONT, MONO, UNIFIED_STAGES, ROLES, stgBdg } from "@/lib/data";
import type { ReactNode, CSSProperties } from "react";

// ─── BADGE ──────────────────────────────────────────────────────────────────
const badgeStyles: Record<string, { c: string; bg: string; b: string }> = {
  default: { c: C.gray, bg: C.gBg, b: C.gBdr },
  green: { c: C.forest, bg: C.gBg2, b: C.gBdr2 },
  terra: { c: C.terra, bg: C.tBg, b: C.tBdr },
  amber: { c: C.amber, bg: C.aBg, b: C.aBdr },
  red: { c: C.red, bg: C.rBg, b: C.rBdr },
  sage: { c: C.sage, bg: C.gBg, b: C.gBdr },
  blue: { c: C.blue, bg: "#EBF2FC", b: "#C4D9F2" },
};

export const Badge = ({ children, v = "default" }: { children: ReactNode; v?: string }) => {
  const s = badgeStyles[v] || badgeStyles.default;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 9px",
      borderRadius: 99, fontSize: 10, fontWeight: 600, letterSpacing: 0.3,
      color: s.c, background: s.bg, border: `1px solid ${s.b}`, whiteSpace: "nowrap",
    }}>{children}</span>
  );
};

// ─── BAR ────────────────────────────────────────────────────────────────────
export const Bar = ({ v, max, color }: { v: number; max: number; color?: string }) => (
  <div style={{ width: "100%", height: 4, borderRadius: 2, background: C.border }}>
    <div style={{
      width: `${max > 0 ? (v / max) * 100 : 0}%`, height: "100%",
      borderRadius: 2, background: color || C.forest, transition: "width .4s",
    }} />
  </div>
);

// ─── BUTTON ─────────────────────────────────────────────────────────────────
export const Btn = ({ children, onClick, color = C.forest, small, disabled, outline }: {
  children: ReactNode; onClick?: () => void; color?: string; small?: boolean; disabled?: boolean; outline?: boolean;
}) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: outline ? "transparent" : disabled ? C.border : color,
    color: outline ? color : disabled ? C.muted : C.white,
    border: outline ? `1.5px solid ${color}` : "none",
    padding: small ? "4px 11px" : "7px 16px", borderRadius: 6,
    fontSize: small ? 10 : 11.5, fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1, whiteSpace: "nowrap",
    transition: "all .15s", letterSpacing: 0.2, fontFamily: FONT,
  }}>{children}</button>
);

// ─── TABLE CELLS ────────────────────────────────────────────────────────────
export const Th = ({ children, right, sticky }: { children: ReactNode; right?: boolean; sticky?: boolean }) => (
  <th style={{
    padding: "8px 12px", textAlign: right ? "right" : "left", fontSize: 9, fontWeight: 700,
    color: C.sage, textTransform: "uppercase", letterSpacing: 1,
    borderBottom: `2px solid ${C.gBdr}`, whiteSpace: "nowrap",
    ...(sticky ? { position: "sticky" as const, left: 0, zIndex: 2, background: C.card, boxShadow: "2px 0 4px rgba(0,0,0,0.06)" } : {}),
  }}>{children}</th>
);

export const Td = ({ children, accent, mono, right, onClick, sticky, bg }: {
  children: ReactNode; accent?: boolean; mono?: boolean; right?: boolean; onClick?: () => void; sticky?: boolean; bg?: string;
}) => (
  <td onClick={onClick} style={{
    padding: "8px 12px", fontSize: 11.5,
    color: accent ? C.forest : C.dark, fontWeight: accent ? 600 : 400,
    borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap",
    fontFamily: mono ? MONO : "inherit",
    cursor: onClick ? "pointer" : "default",
    textAlign: right ? "right" : "left",
    ...(sticky ? { position: "sticky" as const, left: 0, zIndex: 1, background: bg || C.card, boxShadow: "2px 0 4px rgba(0,0,0,0.06)" } : {}),
  }}>{children}</td>
);

// ─── CARD ───────────────────────────────────────────────────────────────────
export const Card = ({ children, p: pad, hover, onClick, style: extraStyle }: {
  children: ReactNode; p?: number; hover?: boolean; onClick?: () => void; style?: CSSProperties;
}) => (
  <div onClick={onClick} style={{
    background: C.card, borderWidth: 1, borderStyle: "solid", borderColor: C.border, borderRadius: 9,
    padding: pad ?? 14, cursor: onClick ? "pointer" : "default",
    transition: "border-color .15s", ...extraStyle,
  }}
    onMouseEnter={e => hover && (e.currentTarget.style.borderColor = C.sage)}
    onMouseLeave={e => hover && (e.currentTarget.style.borderColor = C.border)}
  >{children}</div>
);

// ─── CARD HEADER ────────────────────────────────────────────────────────────
export const CardHdr = ({ children, gradient }: { children: ReactNode; gradient?: boolean }) => (
  <div style={{
    background: gradient ? `linear-gradient(135deg, ${C.forest}, ${C.sage})` : C.forest,
    padding: "8px 14px", borderRadius: "9px 9px 0 0",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  }}>{children}</div>
);

export const CHT = ({ children }: { children: ReactNode }) => (
  <span style={{ fontSize: 11, fontWeight: 600, color: C.white }}>{children}</span>
);

export const CHB = ({ children }: { children: ReactNode }) => (
  <span style={{ fontSize: 10, color: "rgba(255,255,255,.7)", fontFamily: MONO, fontWeight: 600 }}>{children}</span>
);

// ─── LABELS & VALUES ────────────────────────────────────────────────────────
export const Lbl = ({ children }: { children: ReactNode }) => (
  <div style={{
    fontSize: 9, color: C.light, textTransform: "uppercase",
    letterSpacing: 0.6, fontWeight: 600, marginBottom: 2,
  }}>{children}</div>
);

export const Val = ({ children, color, mono, big }: {
  children: ReactNode; color?: string; mono?: boolean; big?: boolean;
}) => (
  <div style={{
    fontSize: big ? 17 : 12, fontWeight: big ? 700 : 500,
    color: color || C.dark, fontFamily: mono ? MONO : FONT,
  }}>{children}</div>
);

export const Mono = ({ children, color }: { children: ReactNode; color?: string }) => (
  <span style={{
    fontFamily: MONO, fontSize: 11, fontWeight: 600,
    color: color || C.forest,
  }}>{children}</span>
);

// ─── FIELD ROW ─────────────────────────────────────────────────────────────
export const FieldRow = ({ label, value, mono, color }: {
  label: string; value: string | number | undefined; mono?: boolean; color?: string;
}) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0", borderBottom: `1px solid ${C.border}`, gap: 8, overflow: "hidden", minWidth: 0 }}>
    <span style={{ fontSize: 10, color: C.gray, flexShrink: 0, whiteSpace: "nowrap", minWidth: 0 }}>{label}</span>
    <span style={{ fontSize: 11.5, fontWeight: 600, color: color || C.dark, fontFamily: mono ? MONO : FONT, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{value !== undefined && value !== null && value !== "" ? value : "\u2014"}</span>
  </div>
);

// ─── QC ROW ────────────────────────────────────────────────────────────────
export const QCRow = ({ label, value }: { label: string; value: boolean }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}>
    <span style={{ fontSize: 12 }}>{value ? "✅" : "⬜"}</span>
    <span style={{ fontSize: 10.5, color: value ? C.dark : C.muted }}>{label}</span>
  </div>
);

// ─── PHOTO SLOT ────────────────────────────────────────────────────────────
export const PhotoSlot = ({ label, hasFile }: { label: string; hasFile: boolean }) => (
  <div style={{
    width: "100%", aspectRatio: "4/3", borderRadius: 6,
    border: `1.5px dashed ${hasFile ? C.gBdr2 : C.border}`,
    background: hasFile ? C.gBg2 : C.gBg,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 2, cursor: "pointer",
  }}>
    <span style={{ fontSize: hasFile ? 16 : 20 }}>{hasFile ? "📷" : "+"}</span>
    <span style={{ fontSize: 8, color: hasFile ? C.forest : C.muted, textAlign: "center" }}>{label}</span>
  </div>
);

// ─── TAB BUTTON ────────────────────────────────────────────────────────────
export const TabButton = ({ active, children, onClick }: {
  active: boolean; children: ReactNode; onClick: () => void;
}) => (
  <button onClick={onClick} style={{
    padding: "7px 16px", borderRadius: "6px 6px 0 0",
    borderWidth: 1.5, borderStyle: "solid", borderColor: active ? C.forest : C.border,
    borderBottomWidth: active ? 2 : 1.5, borderBottomColor: active ? C.card : C.border,
    background: active ? C.card : C.gBg, color: active ? C.forest : C.gray,
    fontWeight: active ? 700 : 500, fontSize: 11, cursor: "pointer",
    marginBottom: -1, position: "relative", zIndex: active ? 1 : 0, fontFamily: FONT,
  }}>{children}</button>
);

// ─── STAGE BADGE ────────────────────────────────────────────────────────────
export const SBdg = ({ id, type }: { id: string; type?: "purchase" | "sales" }) => {
  const s = UNIFIED_STAGES.find(st => st.id === id);
  return s ? <Badge v={stgBdg(id)}>{s.label}</Badge> : <Badge>{id || "—"}</Badge>;
};

// ─── ROLE BADGE ─────────────────────────────────────────────────────────────
export const RoleBadge = ({ role }: { role: string }) => {
  const r = ROLES[role];
  if (!r) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 8px", borderRadius: 99, fontSize: 9, fontWeight: 700,
      color: r.color, background: r.color + "18", border: `1px solid ${r.color}44`,
      letterSpacing: 0.3, whiteSpace: "nowrap",
    }}>{r.icon} {r.label}</span>
  );
};

// ─── SECTION ────────────────────────────────────────────────────────────────
export const Section = ({ title, count, right, children }: {
  title: string; count?: number | null; right?: ReactNode; children: ReactNode;
}) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.dark }}>{title}</h2>
        {count != null && <Badge v="sage">{count}</Badge>}
      </div>
      {right}
    </div>
    {children}
  </div>
);
