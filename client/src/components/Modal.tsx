import { C } from "@/lib/data";
import type { ReactNode } from "react";

export const Modal = ({ open, onClose, title, subtitle, width = 540, children }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  width?: number; children: ReactNode;
}) => {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      // Clicking outside does not close — use Cancel / X button
    >
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(44,62,80,.45)", backdropFilter: "blur(3px)",
      }} />
      <div style={{
        position: "relative", background: C.card, borderRadius: 12,
        width: "100%", maxWidth: width, maxHeight: "90vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 16px 48px rgba(0,0,0,.18)", overflow: "hidden",
      }}>
        <div style={{ height: 3, background: `linear-gradient(90deg,${C.forest},${C.sage})` }} />
        <div style={{
          background: C.forest, padding: "11px 18px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{title}</div>
            {subtitle && <div style={{ fontSize: 10, color: "rgba(255,255,255,.6)", marginTop: 1 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,.12)", border: "none", color: C.white,
            width: 22, height: 22, borderRadius: 5, fontSize: 13, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>{children}</div>
      </div>
    </div>
  );
};
