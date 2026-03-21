// ══════════════════════════════════════════════════════════════════════════════
// StatusChangeToast — Polls for new shipment status changes and shows toasts
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { C } from "@/lib/data";

const POLL_INTERVAL = 30_000; // 30 seconds

interface StatusChangeToastProps {
  /** Callback when user clicks "View" on a toast — navigates to the shipment */
  onNavigate?: (orderName: string, orderType: "purchase" | "sales", odooOrderId: number) => void;
  /** Whether polling is enabled (disable on unmount or when tab is hidden) */
  enabled?: boolean;
}

/** Set of notification IDs we've already shown toasts for (prevents duplicates) */
const shownToastIds = new Set<number>();

export function StatusChangeToast({ onNavigate, enabled = true }: StatusChangeToastProps) {
  const lastCheckRef = useRef<number>(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const utils = trpc.useUtils();

  const showToast = useCallback(
    (change: {
      id: number;
      odooOrderId: number;
      orderType: string;
      orderName: string;
      previousStatus: string | null;
      newStatus: string;
      createdAt: number;
    }) => {
      // Don't show duplicate toasts
      if (shownToastIds.has(change.id)) return;
      shownToastIds.add(change.id);

      // Keep the set from growing unbounded
      if (shownToastIds.size > 500) {
        const arr = Array.from(shownToastIds);
        for (let i = 0; i < 250; i++) shownToastIds.delete(arr[i]);
      }

      const typeLabel = change.orderType === "purchase" ? "PO" : "SO";
      const typeBg = change.orderType === "purchase" ? C.gBg2 : C.tBg;
      const typeBorder = change.orderType === "purchase" ? C.gBdr : C.tBdr;
      const typeColor = change.orderType === "purchase" ? C.forest : C.terra;
      const arrow = change.previousStatus
        ? `${change.previousStatus} → ${change.newStatus}`
        : `Set to ${change.newStatus}`;

      toast(
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 4,
                background: typeBg,
                border: `1px solid ${typeBorder}`,
                color: typeColor,
                letterSpacing: 0.5,
              }}
            >
              {typeLabel}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>
              {change.orderName}
            </span>
          </div>
          <div style={{ fontSize: 11, color: C.gray }}>
            Status changed: <strong style={{ color: C.dark }}>{arrow}</strong>
          </div>
          {onNavigate && (
            <button
              onClick={() => {
                onNavigate(
                  change.orderName,
                  change.orderType as "purchase" | "sales",
                  change.odooOrderId
                );
                toast.dismiss(change.id);
              }}
              style={{
                alignSelf: "flex-start",
                marginTop: 2,
                padding: "3px 10px",
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 4,
                border: `1px solid ${C.gBdr}`,
                background: C.gBg,
                color: C.forest,
                cursor: "pointer",
                transition: "all .15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = C.gBg2;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = C.gBg;
              }}
            >
              View Shipment →
            </button>
          )}
        </div>,
        {
          id: change.id,
          duration: 8000,
          position: "bottom-right",
          style: {
            fontFamily: "'DM Sans', system-ui, sans-serif",
            border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${typeColor}`,
            background: C.card,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          },
        }
      );
    },
    [onNavigate]
  );

  const pollForChanges = useCallback(async () => {
    try {
      const result = await utils.notifications.recentChanges.fetch({
        since: lastCheckRef.current,
      });

      if (result.changes.length > 0) {
        // Update the last check time to the most recent change
        const maxTime = Math.max(...result.changes.map((c) => c.createdAt));
        lastCheckRef.current = maxTime;

        // Show toasts for each new change (newest first, but show oldest first)
        const sorted = [...result.changes].sort((a, b) => a.createdAt - b.createdAt);
        for (const change of sorted) {
          showToast(change);
        }

        // Also invalidate the notification bell's unread count
        utils.notifications.unreadCount.invalidate();
        utils.notifications.list.invalidate();
      }
    } catch (err) {
      // Silently ignore polling errors — network hiccups shouldn't disrupt the UI
      console.debug("[StatusChangeToast] Poll error:", err);
    }
  }, [utils, showToast]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial poll after a short delay (let the page settle)
    const initialTimeout = setTimeout(() => {
      pollForChanges();
    }, 3000);

    // Set up recurring poll
    intervalRef.current = setInterval(pollForChanges, POLL_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, pollForChanges]);

  // Pause polling when the tab is hidden, resume when visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        // Resume polling and do an immediate check
        lastCheckRef.current = Date.now() - POLL_INTERVAL; // Check the last interval
        pollForChanges();
        intervalRef.current = setInterval(pollForChanges, POLL_INTERVAL);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [pollForChanges]);

  // This component renders nothing — it's a side-effect-only hook wrapper
  return null;
}
