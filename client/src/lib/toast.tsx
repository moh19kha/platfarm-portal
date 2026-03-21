/**
 * Unified Toast Notification System
 * Matches the exact style used in shipment stage updates across the whole system.
 * Usage:
 *   import { showToast } from "@/lib/toast";
 *   showToast.success("Order updated successfully");
 *   showToast.error("Failed to update", "Some detail message");
 *   showToast.info("Document uploaded");
 *   showToast.warn("Missing production date");
 */
import { toast } from "sonner";
import { C } from "@/lib/data";

const FONT_FAMILY = "'DM Sans', system-ui, sans-serif";

const baseStyle = {
  fontFamily: FONT_FAMILY,
  border: `1px solid ${C.border}`,
  background: C.card,
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
};

export const showToast = {
  success: (message: string, detail?: string) => {
    toast(
      <div style={{ display: "flex", alignItems: detail ? "flex-start" : "center", gap: 8 }}>
        <span style={{ fontSize: 14, color: C.forest, flexShrink: 0, marginTop: detail ? 1 : 0 }}>✓</span>
        <div>
          <span style={{ fontSize: 12, color: C.dark, fontWeight: 600 }}>{message}</span>
          {detail && <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>{detail}</div>}
        </div>
      </div>,
      {
        duration: 2000,
        style: { ...baseStyle, borderLeft: `3px solid ${C.forest}` },
      }
    );
  },

  error: (message: string, detail?: string) => {
    toast(
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>{message}</span>
        {detail && <span style={{ fontSize: 10, color: C.gray }}>{detail}</span>}
      </div>,
      {
        duration: 3000,
        style: { ...baseStyle, borderLeft: `3px solid ${C.terra}` },
      }
    );
  },

  info: (message: string, detail?: string) => {
    toast(
      <div style={{ display: "flex", alignItems: detail ? "flex-start" : "center", gap: 8 }}>
        <span style={{ fontSize: 14, color: C.blue || C.sage, flexShrink: 0, marginTop: detail ? 1 : 0 }}>ℹ</span>
        <div>
          <span style={{ fontSize: 12, color: C.dark }}>{message}</span>
          {detail && <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>{detail}</div>}
        </div>
      </div>,
      {
        duration: 2500,
        style: { ...baseStyle, borderLeft: `3px solid ${C.blue || C.sage}` },
      }
    );
  },

  warn: (message: string, detail?: string) => {
    toast(
      <div style={{ display: "flex", alignItems: detail ? "flex-start" : "center", gap: 8 }}>
        <span style={{ fontSize: 14, color: C.amber, flexShrink: 0, marginTop: detail ? 1 : 0 }}>⚠</span>
        <div>
          <span style={{ fontSize: 12, color: C.dark, fontWeight: 600 }}>{message}</span>
          {detail && <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>{detail}</div>}
        </div>
      </div>,
      {
        duration: 3000,
        style: { ...baseStyle, borderLeft: `3px solid ${C.amber}` },
      }
    );
  },
};
