// ══════════════════════════════════════════════════════════════════════════════
// LINKED SHIPMENT TOOLTIP — Shows preview data on hover before clicking to navigate
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, type ReactNode } from "react";
import { C, FONT, MONO, companyFromShipmentName } from "@/lib/data";
import { PO_STATE_LABELS, SO_STATE_LABELS, STATE_BADGE_COLOR } from "@/lib/stateLabels";

export interface ShipmentPreview {
  name: string;
  vendor?: string;
  customer?: string;
  state: string;
  amountTotal: number;
  currency: string;
  vessel: string;
  loads?: number;
  deliveries?: number;
  bookingNumber: string;
}

interface LinkedShipmentTooltipProps {
  shipmentName: string;
  type: "purchase" | "sales";
  onNavigate?: () => void;
  onFetchPreview: (name: string) => Promise<ShipmentPreview | null>;
  children: ReactNode;
}

export function LinkedShipmentTooltip({
  shipmentName,
  type,
  onNavigate,
  onFetchPreview,
  children,
}: LinkedShipmentTooltipProps) {
  const [show, setShow] = useState(false);
  const [preview, setPreview] = useState<ShipmentPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const company = companyFromShipmentName(shipmentName);
  const stateLabels = type === "purchase" ? PO_STATE_LABELS : SO_STATE_LABELS;

  const fetchPreviewData = async () => {
    if (fetched) return;
    setLoading(true);
    try {
      const data = await onFetchPreview(shipmentName);
      setPreview(data);
    } catch {
      setPreview(null);
    }
    setLoading(false);
    setFetched(true);
  };

  const handleMouseEnter = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    hoverTimerRef.current = setTimeout(() => {
      setShow(true);
      fetchPreviewData();
    }, 300);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    hideTimerRef.current = setTimeout(() => {
      setShow(false);
    }, 200);
  };

  const handleTooltipEnter = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const handleTooltipLeave = () => {
    hideTimerRef.current = setTimeout(() => {
      setShow(false);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const fmtAmount = (n: number) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

  const stateBadge = preview ? STATE_BADGE_COLOR[preview.state] || STATE_BADGE_COLOR.draft : STATE_BADGE_COLOR.draft;

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        style={{ cursor: onNavigate ? "pointer" : "default" }}
        onClick={onNavigate}
      >
        {children}
      </div>

      {show && (
        <div
          ref={tooltipRef}
          onMouseEnter={handleTooltipEnter}
          onMouseLeave={handleTooltipLeave}
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            zIndex: 1000,
            minWidth: 280,
            maxWidth: 340,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            fontFamily: FONT,
            overflow: "hidden",
            animation: "tooltipFadeIn 0.15s ease-out",
          }}
        >
          {/* Tooltip Header */}
          <div style={{
            background: type === "purchase" ? `linear-gradient(135deg, ${C.forest}, ${C.sage})` : `linear-gradient(135deg, ${C.terra}, #D4884E)`,
            padding: "8px 12px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                {type === "purchase" ? "↓" : "↑"}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.white, fontFamily: MONO }}>
                {shipmentName}
              </span>
            </div>
            {company && (
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                {company}
              </span>
            )}
          </div>

          {/* Tooltip Body */}
          <div style={{ padding: "10px 12px" }}>
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                <div style={{
                  width: 14, height: 14, border: `2px solid ${C.border}`,
                  borderTopColor: C.forest, borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }} />
                <span style={{ fontSize: 10, color: C.muted }}>Loading preview...</span>
              </div>
            )}

            {!loading && !preview && fetched && (
              <div style={{ fontSize: 10, color: C.muted, padding: "6px 0" }}>
                Preview not available
              </div>
            )}

            {!loading && preview && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {/* Status Badge */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", padding: "2px 8px",
                    borderRadius: 99, fontSize: 9, fontWeight: 600,
                    color: stateBadge.color, background: stateBadge.bg,
                    border: `1px solid ${stateBadge.border}`,
                  }}>
                    {stateLabels[preview.state] || preview.state}
                  </span>
                  {preview.bookingNumber && preview.bookingNumber !== "—" && (
                    <span style={{ fontSize: 9, color: C.muted, fontFamily: MONO }}>
                      BK# {preview.bookingNumber}
                    </span>
                  )}
                </div>

                {/* Key Details Grid */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr",
                  gap: "4px 12px", fontSize: 10,
                }}>
                  {/* Vendor/Customer */}
                  <div>
                    <div style={{ fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
                      {type === "purchase" ? "Vendor" : "Customer"}
                    </div>
                    <div style={{ fontWeight: 600, color: C.dark, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {preview.vendor || preview.customer || "—"}
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <div style={{ fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
                      Total Amount
                    </div>
                    <div style={{ fontWeight: 700, color: C.forest, fontFamily: MONO, marginTop: 1 }}>
                      {preview.currency} {fmtAmount(preview.amountTotal)}
                    </div>
                  </div>

                  {/* Vessel */}
                  <div>
                    <div style={{ fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
                      Vessel
                    </div>
                    <div style={{ fontWeight: 500, color: C.dark, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {preview.vessel}
                    </div>
                  </div>

                  {/* Loads/Deliveries */}
                  <div>
                    <div style={{ fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
                      {type === "purchase" ? "Loads" : "Deliveries"}
                    </div>
                    <div style={{ fontWeight: 600, fontFamily: MONO, color: C.dark, marginTop: 1 }}>
                      {type === "purchase" ? preview.loads ?? 0 : preview.deliveries ?? 0}
                    </div>
                  </div>
                </div>

                {/* Click hint */}
                {onNavigate && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 4,
                    paddingTop: 4, borderTop: `1px solid ${C.border}`,
                    fontSize: 9, color: C.sage,
                  }}>
                    <span>↗</span>
                    <span>Click to view full details</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CSS Animations */}
          <style>{`
            @keyframes tooltipFadeIn {
              from { opacity: 0; transform: translateY(4px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
