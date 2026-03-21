// ══════════════════════════════════════════════════════════════════════════════
// ODOO STAGE TIMELINE — Interactive visual pipeline using unified trade logistics stages
// Maps Odoo ERP state + x_studio_unified_shipment_status to logistics stages
// Supports clicking on stages to update shipment status
// ══════════════════════════════════════════════════════════════════════════════
import { C, UNIFIED_STAGES } from "@/lib/data";
import { Card } from "@/components/ui-primitives";
import { MutationProgressBar } from "@/components/LoadingIndicators";

const stgClr = (id: string): string => ({
  "Planned": C.muted, "Booked": C.sage, "Loading": C.terra,
  "Loaded": C.sage, "In Transit": C.forest, "Arrived at Port": C.sage,
  "Customs Clearance": C.terra, "Delivering": C.terra,
  "Delivered": C.forest, "Returned": C.red,
} as Record<string, string>)[id] || C.muted;

/**
 * Map Odoo ERP state + optional shipmentStatus to a unified logistics stage ID.
 * If shipmentStatus is set (from x_studio_unified_shipment_status), use it directly.
 * Otherwise, map from Odoo state to a reasonable default.
 */
export function mapToLogisticsStage(
  state: string,
  shipmentStatus: string | null | undefined,
  _type?: "purchase" | "sales",
): string {
  // If shipmentStatus is explicitly set in Odoo, use it
  if (shipmentStatus && shipmentStatus !== "false" && shipmentStatus !== "None") {
    return shipmentStatus;
  }
  // Otherwise, map Odoo ERP state to a default logistics stage
  switch (state) {
    case "draft": case "sent": case "to_approve": return "Planned";
    case "purchase": case "sale": return "Booked";
    case "done": return "Delivered";
    case "cancel": return "cancel";
    default: return "Planned";
  }
}

export function OdooStageTimeline({
  state,
  shipmentStatus,
  type = "purchase",
  onStageClick,
  updating = false,
}: {
  state: string;
  shipmentStatus?: string | null;
  type?: "purchase" | "sales";
  onStageClick?: (stageId: string) => void;
  updating?: boolean;
}) {
  const logisticsStage = mapToLogisticsStage(state, shipmentStatus, type);
  // Both purchase and sales now use the same unified stages
  const stages = UNIFIED_STAGES;
  const isCancelled = state === "cancel" || logisticsStage === "cancel";
  const isClickable = !!onStageClick && !updating;

  const curIdx = stages.findIndex(s => s.id === logisticsStage);

  return (
    <Card p={0}>
      <div style={{ padding: "10px 12px 6px 12px", position: "relative" }}>
        <MutationProgressBar show={updating} color={C.forest} />
        {/* Clickable hint */}
        {isClickable && (
          <div style={{
            fontSize: 8, color: C.sage, textAlign: "right", marginBottom: 4,
            fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
          }}>
            {updating ? "Updating..." : "Click a stage to update status"}
          </div>
        )}
        {isCancelled ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "8px 0",
          }}>
            <div style={{
              padding: "6px 16px", borderRadius: 6,
              background: `${C.red || "#EF4444"}15`,
              border: `1px solid ${C.red || "#EF4444"}30`,
              color: C.red || "#EF4444",
              fontSize: 12, fontWeight: 700,
            }}>
              ✕ Cancelled
            </div>
          </div>
        ) : (
          <div style={{
            display: "flex", alignItems: "flex-start", width: "100%",
            opacity: updating ? 0.6 : 1, transition: "opacity .2s",
          }}>
            {stages.map((stage, i) => {
              const isP = i < curIdx;
              const isA = i === curIdx;
              const clr = stgClr(stage.id);
              const clickable = isClickable && stage.id !== logisticsStage;
              const isLast = i === stages.length - 1;
              return (
                <div key={stage.id} style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex", flexDirection: "column", alignItems: "center",
                  position: "relative",
                }}>
                  {/* Connector line BEFORE this node (except first) */}
                  {i > 0 && (
                    <div style={{
                      position: "absolute",
                      top: 9,
                      left: 0,
                      right: "50%",
                      height: 2,
                      background: isP || isA ? C.forest : C.border,
                    }} />
                  )}
                  {/* Connector line AFTER this node (except last) */}
                  {!isLast && (
                    <div style={{
                      position: "absolute",
                      top: 9,
                      left: "50%",
                      right: 0,
                      height: 2,
                      background: isP ? C.forest : C.border,
                    }} />
                  )}
                  {/* Stage dot */}
                  <div
                    onClick={clickable ? () => onStageClick!(stage.id) : undefined}
                    style={{
                      position: "relative", zIndex: 2,
                      cursor: clickable ? "pointer" : "default",
                      transition: "transform .15s",
                      display: "flex", flexDirection: "column", alignItems: "center",
                    }}
                    onMouseEnter={e => {
                      if (clickable) e.currentTarget.style.transform = "scale(1.15)";
                    }}
                    onMouseLeave={e => {
                      if (clickable) e.currentTarget.style.transform = "scale(1)";
                    }}
                    title={clickable ? `Set status to: ${stage.label}` : stage.label}
                  >
                    <div style={{
                      width: isA ? 18 : 10,
                      height: isA ? 18 : 10,
                      borderRadius: "50%",
                      background: isA || isP ? clr : C.border,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: isP ? 5 : 7,
                      color: C.white,
                      fontWeight: 700,
                      transition: "all .3s",
                      boxShadow: isA ? `0 0 0 3px ${clr}22` : clickable ? `0 0 0 2px ${C.border}` : "none",
                      border: clickable && !isP && !isA ? `1.5px dashed ${C.muted}` : "none",
                      marginTop: isA ? 0 : 4,
                      flexShrink: 0,
                    }}>
                      {isP && "✓"}{isA && "●"}
                    </div>
                    <span style={{
                      fontSize: 7,
                      color: isA ? clr : isP ? C.sage : C.muted,
                      marginTop: 2,
                      fontWeight: isA ? 700 : 400,
                      textAlign: "center",
                      lineHeight: 1.15,
                      maxWidth: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      padding: "0 1px",
                    }}>{stage.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
