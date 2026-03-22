// ══════════════════════════════════════════════════════════════════════════════
// AGREEMENTS — Platfarm V3 — Purchase & Sales Agreements from Odoo (Full CRUD)
// ══════════════════════════════════════════════════════════════════════════════

import { useState, memo } from "react";
import { C, MONO, FONT, fmt, fmtDateStr } from "@/lib/data";
import type { Perms } from "@/lib/data";
import { Badge, Bar, Card, Lbl, Mono, Section, Val, FieldRow, Btn } from "@/components/ui-primitives";
import { trpc } from "@/lib/trpc";
import PurchaseAgreementForm from "@/components/PurchaseAgreementForm";
import { TopProgressBar, ShimmerBox } from "@/components/LoadingIndicators";
import SalesAgreementForm from "@/components/SalesAgreementForm";

// ─── TYPES (from tRPC inference) ─────────────────────────────────────────
type PurchaseAgreement = {
  id: number;
  name: string;
  reference: string | null;
  vendor: string | null;
  vendorId: number | null;
  type: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  state: string | null;
  companyId: number | null;
  companyName: string | null;
  currency: string | null;
  currencyId: number | null;
  product: string | null;
  orderCount: number;
  totalQuantityTons: number;
  incoterm: string | null;
  purchaseCurrency: string | null;
  insuranceIncluded: boolean;
  paymentTerms: string | null;
  notes: string | null;
  supplyStartDate: string | null;
  supplyEndDate: string | null;
  lines: {
    id: number;
    productId: number | null;
    product: string | null;
    quantity: number;
    priceUnit: number;
    uom: string | null;
    uomId: number | null;
    qtyOrdered: number;
  }[];
};

type SalesAgreement = {
  id: number;
  name: string;
  displayName: string;
  customer: string | null;
  customerId: number | null;
  studioCustomerId: number | null;
  studioCustomerName: string | null;
  ultimateCustomer: string | null;
  incoterm: string | null;
  currency: string | null;
  insuranceIncluded: boolean;
  totalQuantityTons: number;
  supplyStartDate: string | null;
  supplyEndDate: string | null;
  notes: string | null;
  paymentTerms: string | null;
  salesOrderCount: number;
  companyId: number | null;
  companyName: string | null;
  active: boolean;
  durationDays: number;
  createdAt: string;
  lineIds: number[];
  lines: {
    id: number;
    productId: number | null;
    product: string | null;
    quantity: number;
    priceUnit: number;
    uom: string | null;
    uomId: number | null;
  }[];
};

// ─── HELPERS ──────────────────────────────────────────────────────────────
const stateLabel = (state: string | null): string => {
  if (!state) return "Unknown";
  const map: Record<string, string> = {
    draft: "Draft",
    in_progress: "In Progress",
    confirmed: "Confirmed",
    open: "Open",
    done: "Done",
    cancel: "Cancelled",
  };
  return map[state] || state.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
};

const stateVariant = (state: string | null): "green" | "sage" | "terra" | "default" => {
  if (!state) return "default";
  if (["confirmed", "open", "in_progress"].includes(state)) return "green";
  if (["done"].includes(state)) return "sage";
  if (["cancel"].includes(state)) return "terra";
  return "default";
};

const formatQty = (qty: number, uom: string | null): string => {
  if (!uom) return `${qty.toLocaleString()}`;
  return `${qty.toLocaleString()} ${uom}`;
};

// ─── PURCHASE AGREEMENT CARD ──────────────────────────────────────────────
const PurchaseAgreementCard = memo(({ agr, onClick }: {
  agr: PurchaseAgreement;
  onClick: () => void;
}) => {
  const totalQty = agr.lines.reduce((s, l) => s + l.quantity, 0);
  const totalValue = agr.lines.reduce((s, l) => s + (l.quantity * l.priceUnit), 0);
  const uom = agr.lines[0]?.uom || "MT";

  return (
    <Card hover onClick={onClick} style={{ cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, flexWrap: "wrap", gap: 5 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Mono>{agr.name}</Mono>
            <Badge v={stateVariant(agr.state)}>{stateLabel(agr.state)}</Badge>
            {agr.currency && <Badge v="sage">{agr.currency}</Badge>}
          </div>
          {agr.reference && (
            <div style={{ fontSize: 10, color: C.sage, fontFamily: MONO, marginTop: 1 }}>Ref: {agr.reference}</div>
          )}
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{agr.vendor || "—"}</div>
          <div style={{ fontSize: 10, color: C.gray, marginTop: 1 }}>{agr.product || "—"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <Val mono big color={C.forest}>{agr.currency} {fmt(totalValue)}</Val>
          <Badge v="sage">{agr.orderCount} PO{agr.orderCount !== 1 ? "s" : ""}</Badge>
        </div>
      </div>
      <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 7 }}>
        <div><Lbl>Quantity</Lbl><Val mono>{formatQty(totalQty, uom)}</Val></div>
        <div><Lbl>Price/Unit</Lbl><Val mono>{agr.lines[0] ? `${agr.currency || ""} ${agr.lines[0].priceUnit.toLocaleString()}` : "—"}</Val></div>
        <div><Lbl>Company</Lbl><Val>{agr.companyName ? agr.companyName.split("-")[0] : "—"}</Val></div>
      </div>
      {agr.dateStart && agr.dateEnd && (
        <div style={{ fontSize: 9, color: C.muted }}>
          {fmtDateStr(agr.dateStart)} → {fmtDateStr(agr.dateEnd)}
        </div>
      )}
    </Card>
  );
});

// ─── SALES AGREEMENT CARD ─────────────────────────────────────────────────
const SalesAgreementCard = memo(({ agr, onClick }: {
  agr: SalesAgreement;
  onClick: () => void;
}) => {
  return (
    <Card hover onClick={onClick} style={{ cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, flexWrap: "wrap", gap: 5 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Mono>{agr.name}</Mono>
            <Badge v={agr.active ? "green" : "default"}>{agr.active ? "Active" : "Inactive"}</Badge>
            {agr.currency && <Badge v="terra">{agr.currency}</Badge>}
            {agr.incoterm && <Badge v="sage">{agr.incoterm}</Badge>}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{agr.customer || "—"}</div>
          {agr.ultimateCustomer && agr.ultimateCustomer !== (agr.customer || "") && (
            <div style={{ fontSize: 10, color: C.gray, marginTop: 1 }}>Ultimate: {agr.ultimateCustomer}</div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <Val mono big color={C.terra}>{agr.totalQuantityTons.toLocaleString()} MT</Val>
          <Badge v="terra">{agr.salesOrderCount} SO{agr.salesOrderCount !== 1 ? "s" : ""}</Badge>
        </div>
      </div>
      <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 7 }}>
        <div><Lbl>Total Qty</Lbl><Val mono>{agr.totalQuantityTons.toLocaleString()} MT</Val></div>
        <div><Lbl>Duration</Lbl><Val mono>{agr.durationDays} days</Val></div>
        <div><Lbl>Company</Lbl><Val>{agr.companyName ? agr.companyName.split("-")[0] : "—"}</Val></div>
      </div>
      {agr.supplyStartDate && (
        <div style={{ fontSize: 9, color: C.muted }}>
          Supply from: {fmtDateStr(agr.supplyStartDate)}
          {agr.insuranceIncluded && <span style={{ marginLeft: 8, color: C.sage }}>● Insurance Included</span>}
        </div>
      )}
    </Card>
  );
});

// ─── SHARED STYLES ────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0,0,0,.35)", zIndex: 999,
  display: "flex", alignItems: "center", justifyContent: "center",
};

const modalStyle: React.CSSProperties = {
  background: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
  width: "min(640px, 92vw)", maxHeight: "85vh", overflowY: "auto",
  boxShadow: "0 20px 60px rgba(0,0,0,.15)",
};

// ─── VIEW PURCHASE AGREEMENT DETAIL ──────────────────────────────────────
function ViewPurchaseDetail({ agr, onClose, onEdit }: {
  agr: PurchaseAgreement;
  onClose: () => void;
  onEdit: () => void;
}) {
  const totalQty = agr.lines.reduce((s, l) => s + l.quantity, 0);
  const totalValue = agr.lines.reduce((s, l) => s + (l.quantity * l.priceUnit), 0);
  const uom = agr.lines[0]?.uom || "MT";

  // Fetch linked shipments from Odoo
  const { data: linkedShipments, isLoading: shipmentsLoading } = trpc.shipments.list.useQuery(
    { requisitionId: agr.id, limit: 500 }
  );

  // Calculate fulfillment using totalShipmentWeight from linked POs (already in tons)
  const agrQtyTons = totalQty; // agreement qty is in Tons
  const fulfilledTons = (linkedShipments || []).reduce((sum, sh) => {
    return sum + (sh.totalShipmentWeight || 0);
  }, 0);
  const fulfillmentPct = agrQtyTons > 0 ? Math.min((fulfilledTons / agrQtyTons) * 100, 100) : 0;

  const thStyle: React.CSSProperties = {
    padding: "8px 12px", fontSize: 9, fontWeight: 700, color: C.sage,
    textTransform: "uppercase", letterSpacing: 0.8, textAlign: "left",
    borderBottom: `1.5px solid ${C.border}`, background: C.gBg,
  };

  const tdStyle: React.CSSProperties = {
    padding: "10px 12px", fontSize: 11, borderBottom: `1px solid ${C.border}`,
    verticalAlign: "middle",
  };

  const poStateLabel = (state: string): string => {
    const map: Record<string, string> = {
      draft: "Draft", sent: "Sent", purchase: "Purchase Order",
      done: "Locked", cancel: "Cancelled",
    };
    return map[state] || state;
  };

  const poStateColor = (state: string): string => {
    if (state === "purchase" || state === "done") return C.forest;
    if (state === "cancel") return C.terra;
    return C.gray;
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, width: "min(780px, 94vw)" }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: C.gBg2,
              border: `1.5px solid ${C.gBdr2}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800, color: C.forest,
            }}>↓</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.dark, fontFamily: MONO }}>{agr.name}</span>
                <Badge v={stateVariant(agr.state)}>{stateLabel(agr.state)}</Badge>
              </div>
              <div style={{ fontSize: 10, color: C.muted }}>Purchase Agreement</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={onEdit} style={{
              padding: "5px 14px", borderRadius: 6, border: `1px solid ${C.forest}`,
              background: C.gBg, cursor: "pointer", fontSize: 10, fontWeight: 700, color: C.forest,
            }}>Edit</button>
            <button onClick={onClose} style={{
              width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`,
              background: "transparent", cursor: "pointer", fontSize: 14, color: C.gray,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>×</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* KPI Row */}
          <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "Total Qty", value: formatQty(totalQty, uom), color: C.dark },
              { label: "Total Value", value: `${agr.currency || ""} ${fmt(totalValue)}`, color: C.forest },
              { label: "PO Count", value: String(agr.orderCount), color: C.dark },
              { label: "Currency", value: agr.currency || "—", color: C.dark },
            ].map(kpi => (
              <div key={kpi.label} style={{
                padding: "10px 12px", borderRadius: 8,
                background: C.pageBg, border: `1px solid ${C.border}`,
              }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{kpi.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: kpi.color, fontFamily: MONO, marginTop: 2 }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Fulfillment Progress */}
          <div style={{
            padding: 14, borderRadius: 8, background: C.card,
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.dark }}>Agreement Fulfilment</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: fulfillmentPct >= 100 ? C.forest : C.sage, fontFamily: MONO }}>
                {fulfillmentPct.toFixed(1)}%
              </span>
            </div>
            <div style={{
              width: "100%", height: 10, borderRadius: 5,
              background: C.pageBg, border: `1px solid ${C.border}`, overflow: "hidden",
            }}>
              <div style={{
                width: `${Math.min(fulfillmentPct, 100)}%`,
                height: "100%", borderRadius: 5,
                background: fulfillmentPct >= 100
                  ? `linear-gradient(90deg, ${C.forest}, ${C.sage})`
                  : fulfillmentPct >= 50
                    ? `linear-gradient(90deg, ${C.sage}, ${C.forest})`
                    : `linear-gradient(90deg, ${C.terra}, ${C.sage})`,
                transition: "width 0.5s ease",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ fontSize: 9, color: C.muted }}>
                Ordered: <strong style={{ color: C.dark, fontFamily: MONO }}>{fulfilledTons.toLocaleString(undefined, { maximumFractionDigits: 1 })} {uom}</strong>
              </span>
              <span style={{ fontSize: 9, color: C.muted }}>
                Agreement: <strong style={{ color: C.dark, fontFamily: MONO }}>{agrQtyTons.toLocaleString()} {uom}</strong>
              </span>
            </div>
          </div>

          {/* Agreement Details */}
          <div style={{
            padding: 14, borderRadius: 8, background: C.card,
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.dark, marginBottom: 10 }}>Agreement Details</div>
            <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <FieldRow label="Reference" value={agr.reference || "—"} mono />
              <FieldRow label="Vendor" value={agr.vendor || "—"} />
              <FieldRow label="Ultimate Customer" value={agr.ultimateCustomer || "—"} />
              <FieldRow label="Company" value={agr.companyName || "—"} />
              <FieldRow label="Type" value={agr.type ? agr.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "—"} />
              <FieldRow label="Start Date" value={fmtDateStr(agr.dateStart)} mono />
              <FieldRow label="End Date" value={fmtDateStr(agr.dateEnd)} mono />
              <FieldRow label="State" value={stateLabel(agr.state)} />
              <FieldRow label="Currency" value={agr.currency || "—"} mono />
            </div>
          </div>

          {/* Product Lines */}
          <div style={{
            borderRadius: 8, background: C.card,
            border: `1px solid ${C.border}`, overflow: "hidden",
          }}>
            <div style={{
              padding: "10px 14px", borderBottom: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.dark }}>Product Lines</div>
              <Badge v="sage">{agr.lines.length}</Badge>
            </div>

            {agr.lines.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: C.muted }}>No product lines</div>
              </div>
            ) : (
              <div className="mob-table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Product</th>
                    <th style={thStyle}>Qty</th>
                    <th style={thStyle}>Price/Unit</th>
                    <th style={thStyle}>UoM</th>
                  </tr>
                </thead>
                <tbody>
                  {agr.lines.map(line => (
                    <tr key={line.id}>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 600 }}>{line.product || "—"}</span>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: MONO }}>{line.quantity.toLocaleString()}</td>
                      <td style={{ ...tdStyle, fontFamily: MONO }}>{agr.currency} {line.priceUnit.toLocaleString()}</td>
                      <td style={tdStyle}>{line.uom || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>

          {/* Linked Shipments */}
          <div style={{
            borderRadius: 8, background: C.card,
            border: `1px solid ${C.border}`, overflow: "hidden",
          }}>
            <div style={{
              padding: "10px 14px", borderBottom: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.dark }}>Linked Shipments (Purchase Orders)</div>
              <Badge v="sage">{shipmentsLoading ? "..." : (linkedShipments?.length || 0)}</Badge>
            </div>

            {shipmentsLoading ? (
              <div style={{ padding: "20px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: C.muted }}>Loading shipments...</div>
              </div>
            ) : !linkedShipments || linkedShipments.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>📦</div>
                <div style={{ fontSize: 11, color: C.muted }}>No shipments linked to this agreement</div>
              </div>
            ) : (
              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                <div className="mob-table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Shipment #</th>
                      <th style={thStyle}>Vessel</th>
                      <th style={thStyle}>Loads</th>
                      <th style={thStyle}>Amount</th>
                      <th style={thStyle}>State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedShipments.map(sh => (
                      <tr key={sh.id} style={{ cursor: "default" }}
                        onMouseEnter={e => (e.currentTarget.style.background = C.gBg)}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ ...tdStyle, fontFamily: MONO, fontWeight: 600 }}>{sh.name}</td>
                        <td style={tdStyle}>{sh.vesselName || "—"}</td>
                        <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "center" }}>{sh.numberOfLoads || 0}</td>
                        <td style={{ ...tdStyle, fontFamily: MONO }}>
                          {sh.currency?.name || ""} {sh.amountTotal?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || "0"}
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            display: "inline-block", padding: "2px 8px", borderRadius: 4,
                            fontSize: 9, fontWeight: 700,
                            color: poStateColor(sh.state),
                            background: sh.state === "cancel" ? C.tBg : C.gBg,
                            border: `1px solid ${sh.state === "cancel" ? C.tBdr : C.gBdr}`,
                          }}>{poStateLabel(sh.state)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px", borderTop: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between",
        }}>
          <button onClick={onEdit} style={{
            padding: "7px 20px", borderRadius: 6, border: `1px solid ${C.forest}`,
            background: C.gBg, fontSize: 11, fontWeight: 600, color: C.forest,
            cursor: "pointer",
          }}>Edit Agreement</button>
          <button onClick={onClose} style={{
            padding: "7px 20px", borderRadius: 6, border: `1px solid ${C.border}`,
            background: "transparent", fontSize: 11, fontWeight: 600, color: C.gray,
            cursor: "pointer",
          }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── VIEW SALES AGREEMENT DETAIL ─────────────────────────────────────────
function ViewSalesDetail({ agr, onClose, onEdit }: {
  agr: SalesAgreement;
  onClose: () => void;
  onEdit: () => void;
}) {
  // Fetch linked sales orders from Odoo using the agreement's template ID
  const { data: linkedSOs, isLoading: sosLoading } = trpc.salesShipments.list.useQuery(
    { templateId: agr.id, limit: 500 }
  );
  // Calculate fulfillment using totalShipmentWeight from linked SOs (already in tons)
  const agrQtyTons = agr.totalQuantityTons;
  const fulfilledTons = (linkedSOs || []).reduce((sum, so) => {
    return sum + (so.totalShipmentWeight || 0);
  }, 0);
  const fulfillmentPct = agrQtyTons > 0 ? Math.min((fulfilledTons / agrQtyTons) * 100, 100) : 0;
  const thStyle: React.CSSProperties = {
    padding: "6px 10px", fontSize: 9, fontWeight: 700, color: C.sage,
    textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left",
    borderBottom: `1px solid ${C.border}`, background: C.gBg,
  };
  const tdStyle2: React.CSSProperties = {
    padding: "7px 10px", fontSize: 11, color: C.dark,
    borderBottom: `1px solid ${C.border}`,
  };
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: C.tBg,
              border: `1.5px solid ${C.tBdr}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800, color: C.terra,
            }}>↑</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.dark, fontFamily: MONO }}>{agr.name}</span>
                <Badge v={agr.active ? "green" : "default"}>{agr.active ? "Active" : "Inactive"}</Badge>
              </div>
              <div style={{ fontSize: 10, color: C.muted }}>Sales Agreement</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={onEdit} style={{
              padding: "5px 14px", borderRadius: 6, border: `1px solid ${C.terra}`,
              background: C.tBg, cursor: "pointer", fontSize: 10, fontWeight: 700, color: C.terra,
            }}>Edit</button>
            <button onClick={onClose} style={{
              width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`,
              background: "transparent", cursor: "pointer", fontSize: 14, color: C.gray,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>×</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* KPI Row */}
          <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "Total Qty", value: `${agr.totalQuantityTons.toLocaleString()} MT`, color: C.dark },
              { label: "Duration", value: `${agr.durationDays} days`, color: C.dark },
              { label: "SO Count", value: String(agr.salesOrderCount), color: C.terra },
              { label: "Currency", value: agr.currency || "—", color: C.dark },
            ].map(kpi => (
              <div key={kpi.label} style={{
                padding: "10px 12px", borderRadius: 8,
                background: C.pageBg, border: `1px solid ${C.border}`,
              }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{kpi.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: kpi.color, fontFamily: MONO, marginTop: 2 }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Agreement Details */}
          <div style={{
            padding: 14, borderRadius: 8, background: C.card,
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.dark, marginBottom: 10 }}>Agreement Details</div>
            <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <FieldRow label="Customer" value={agr.customer || "—"} />
              <FieldRow label="Studio Customer" value={agr.studioCustomerName || "—"} />
              <FieldRow label="Ultimate Customer" value={agr.ultimateCustomer || "—"} />
              <FieldRow label="Company" value={agr.companyName || "—"} />
              <FieldRow label="Incoterm" value={agr.incoterm || "—"} mono />
              <FieldRow label="Currency" value={agr.currency || "—"} mono />
              <FieldRow label="Insurance" value={agr.insuranceIncluded ? "Yes" : "No"} />
              <FieldRow label="Supply Start" value={fmtDateStr(agr.supplyStartDate)} mono />
              <FieldRow label="Payment Terms" value={agr.paymentTerms || "—"} />
              <FieldRow label="Created" value={fmtDateStr(agr.createdAt)} mono />
            </div>
          </div>

          {/* Fulfillment Progress */}
          <div style={{
            padding: 14, borderRadius: 8, background: C.card,
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.dark }}>Fulfillment Progress</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: fulfillmentPct >= 100 ? C.forest : C.terra, fontFamily: MONO }}>
                {fulfillmentPct.toFixed(1)}%
              </div>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: C.gBg, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 4,
                width: `${Math.min(fulfillmentPct, 100)}%`,
                background: fulfillmentPct >= 100
                  ? `linear-gradient(90deg, ${C.forest}, ${C.sage})`
                  : `linear-gradient(90deg, ${C.terra}, #e8a87c)`,
                transition: "width 0.5s ease",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ fontSize: 9, color: C.muted }}>
                {fulfilledTons.toLocaleString(undefined, { maximumFractionDigits: 1 })} MT fulfilled
              </span>
              <span style={{ fontSize: 9, color: C.muted }}>
                of {agrQtyTons.toLocaleString(undefined, { maximumFractionDigits: 1 })} MT total
              </span>
            </div>
          </div>

          {/* Linked Sales Orders */}
          <div style={{
            borderRadius: 8, background: C.card,
            border: `1px solid ${C.border}`, overflow: "hidden",
          }}>
            <div style={{
              padding: "10px 14px", borderBottom: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.dark }}>Linked Sales Orders</div>
              <Badge v="terra">{sosLoading ? "..." : (linkedSOs?.length || 0)}</Badge>
            </div>
            {sosLoading ? (
              <div style={{ padding: "20px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: C.muted }}>Loading sales orders...</div>
              </div>
            ) : !linkedSOs || linkedSOs.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>📦</div>
                <div style={{ fontSize: 11, color: C.muted }}>No sales orders linked to this agreement</div>
              </div>
            ) : (
              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                <div className="mob-table-scroll"><table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Shipment #</th>
                      <th style={thStyle}>Customer</th>
                      <th style={thStyle}>Weight (MT)</th>
                      <th style={thStyle}>Amount</th>
                      <th style={thStyle}>State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedSOs.map(so => (
                      <tr key={so.id} style={{ cursor: "default" }}
                        onMouseEnter={e => (e.currentTarget.style.background = C.gBg)}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ ...tdStyle2, fontFamily: MONO, fontWeight: 600 }}>{so.name}</td>
                        <td style={tdStyle2}>{so.customer?.name || "—"}</td>
                        <td style={{ ...tdStyle2, fontFamily: MONO }}>
                          {(so.totalShipmentWeight || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </td>
                        <td style={{ ...tdStyle2, fontFamily: MONO }}>
                          {so.currency?.name || ""} {so.amountTotal.toLocaleString()}
                        </td>
                        <td style={tdStyle2}>
                          <Badge v={so.state === "sale" ? "green" : so.state === "draft" ? "default" : "terra"}>
                            {so.state === "sale" ? "Confirmed" : so.state === "draft" ? "Draft" : so.state}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            )}
          </div>

          {/* Notes */}
          {agr.notes && (
            <div style={{
              padding: 14, borderRadius: 8, background: C.pageBg,
              border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Notes</div>
              <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{agr.notes}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px", borderTop: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between",
        }}>
          <button onClick={onEdit} style={{
            padding: "7px 20px", borderRadius: 6, border: `1px solid ${C.terra}`,
            background: C.tBg, fontSize: 11, fontWeight: 600, color: C.terra,
            cursor: "pointer",
          }}>Edit Agreement</button>
          <button onClick={onClose} style={{
            padding: "7px 20px", borderRadius: 6, border: `1px solid ${C.border}`,
            background: "transparent", fontSize: 11, fontWeight: 600, color: C.gray,
            cursor: "pointer",
          }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── LOADING SKELETON ────────────────────────────────────────────────────
function AgreementsSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <TopProgressBar />
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          padding: 16, borderRadius: 10, background: C.card,
          border: `1px solid ${C.border}`,
        }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <ShimmerBox width={120} height={14} />
            <ShimmerBox width={70} height={20} borderRadius={10} />
          </div>
          <ShimmerBox width="60%" height={12} style={{ marginBottom: 8 }} />
          <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
            {[1, 2, 3].map(j => (
              <ShimmerBox key={j} height={30} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── MAIN AGREEMENTS PAGE ─────────────────────────────────────────────────
const InlineError = ({ message }: { message?: string }) => (
  <div style={{ padding: "14px 16px", background: "#FDF0F0", border: "1px solid #F5C4C4", borderRadius: 8, display: "flex", alignItems: "flex-start", gap: 10 }}>
    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠</span>
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#C94444", marginBottom: 2 }}>Failed to load data</div>
      {message && <div style={{ fontSize: 11, color: "#B44" }}>{message}</div>}
    </div>
  </div>
);

export function AgrPage({ perms, activeCompanyId }: {
  perms: Perms;
  activeCompanyId?: number | "ALL";
}) {
  const [tab, setTab] = useState<"purchase" | "sales">("purchase");
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");

  // Fetch agreements from Odoo via tRPC
  const { data: purchaseAgreements, isLoading: paLoading, isError: paError } = trpc.odoo.purchaseAgreements.useQuery();
  const { data: salesAgreements, isLoading: saLoading, isError: saError } = trpc.odoo.salesAgreements.useQuery();

  // View detail state
  const [viewPA, setViewPA] = useState<PurchaseAgreement | null>(null);
  const [viewSA, setViewSA] = useState<SalesAgreement | null>(null);

  // Create/Edit form state
  const [showCreatePA, setShowCreatePA] = useState(false);
  const [showCreateSA, setShowCreateSA] = useState(false);
  const [editPA, setEditPA] = useState<PurchaseAgreement | null>(null);
  const [editSA, setEditSA] = useState<SalesAgreement | null>(null);

  // Filter by active company if set
  const companyFilteredPA = (purchaseAgreements || []).filter(
    a => activeCompanyId === "ALL" || activeCompanyId === undefined || a.companyId === activeCompanyId
  );
  const companyFilteredSA = (salesAgreements || []).filter(
    a => activeCompanyId === "ALL" || activeCompanyId === undefined || a.companyId === activeCompanyId
  );

  // Apply search and state filter
  const q = searchQuery.toLowerCase().trim();
  const filteredPA = companyFilteredPA.filter(a => {
    const matchesSearch = !q || [
      a.name, a.reference, a.vendor, a.product, a.companyName,
    ].some(f => f?.toLowerCase().includes(q));
    const matchesState = stateFilter === "all" || a.state === stateFilter;
    return matchesSearch && matchesState;
  });
  const filteredSA = companyFilteredSA.filter(a => {
    const matchesSearch = !q || [
      a.name, a.customer, a.ultimateCustomer, a.companyName, a.incoterm,
    ].some(f => f?.toLowerCase().includes(q));
    const matchesState = stateFilter === "all" || (stateFilter === "active" ? a.active : !a.active);
    return matchesSearch && matchesState;
  });

  const isLoading = tab === "purchase" ? paLoading : saLoading;
  const isError = tab === "purchase" ? paError : saError;

  // State filter options
  const paStateOptions = ["all", "draft", "in_progress", "open", "done", "cancel"];
  const saStateOptions = ["all", "active", "inactive"];
  const currentStateOptions = tab === "purchase" ? paStateOptions : saStateOptions;
  const stateOptionLabels: Record<string, string> = {
    all: "All States", draft: "Draft", in_progress: "In Progress",
    open: "Open", done: "Done", cancel: "Cancelled",
    active: "Active", inactive: "Inactive",
  };

  return (
    <div>
      {/* Tab bar + New button */}
      <div className="mob-toolbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 3 }}>
          {([
            { id: "purchase" as const, l: "Purchase Agreements", count: filteredPA.length },
            { id: "sales" as const, l: "Sales Agreements", count: filteredSA.length },
          ]).map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setStateFilter("all"); setSearchQuery(""); }} style={{
              padding: "6px 14px", borderRadius: 6,
              border: `1.5px solid ${tab === t.id ? C.forest : C.border}`,
              background: tab === t.id ? C.gBg2 : C.card,
              color: tab === t.id ? C.forest : C.gray,
              fontWeight: tab === t.id ? 700 : 500, fontSize: 11, cursor: "pointer",
            }}>{t.l} ({t.count})</button>
          ))}
        </div>

        {/* + New Button */}
        <button
          onClick={() => tab === "purchase" ? setShowCreatePA(true) : setShowCreateSA(true)}
          style={{
            padding: "6px 16px", borderRadius: 6, border: "none",
            background: tab === "purchase" ? C.forest : C.terra,
            color: C.white, fontSize: 11, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
          New {tab === "purchase" ? "Purchase" : "Sales"} Agreement
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="mob-toolbar" style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.muted }}>⌕</span>
          <input
            type="text"
            placeholder="Search agreements..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: "100%", padding: "7px 10px 7px 28px", borderRadius: 6,
              border: `1px solid ${C.border}`, background: C.card,
              fontSize: 11, fontFamily: FONT, color: C.dark, outline: "none",
            }}
          />
        </div>
        <select
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
          style={{
            padding: "7px 10px", borderRadius: 6,
            border: `1px solid ${C.border}`, background: C.card,
            fontSize: 11, fontFamily: FONT, color: C.dark, cursor: "pointer",
          }}
        >
          {currentStateOptions.map(opt => (
            <option key={opt} value={opt}>{stateOptionLabels[opt] || opt}</option>
          ))}
        </select>
      </div>

      {tab === "purchase" && (
        <Section title="Purchase Agreements" count={filteredPA.length}>
          {isLoading ? (
            <AgreementsSkeleton />
          ) : isError ? (
            <InlineError message="Could not load purchase agreements. Please refresh to try again." />
          ) : filteredPA.length === 0 ? (
            <div style={{
              padding: "32px 20px", textAlign: "center",
              background: C.gBg, borderRadius: 10, border: `1px dashed ${C.gBdr}`,
            }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>↓</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.sage, marginBottom: 3 }}>No Purchase Agreements</div>
              <div style={{ fontSize: 10, color: C.muted }}>No purchase agreements found for this company</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 7 }}>
              {filteredPA.map(a => (
                <PurchaseAgreementCard key={a.id} agr={a}
                  onClick={() => setViewPA(a)} />
              ))}
            </div>
          )}
        </Section>
      )}

      {tab === "sales" && (
        <Section title="Sales Agreements" count={filteredSA.length}>
          {isLoading ? (
            <AgreementsSkeleton />
          ) : isError ? (
            <InlineError message="Could not load sales agreements. Please refresh to try again." />
          ) : filteredSA.length === 0 ? (
            <div style={{
              padding: "32px 20px", textAlign: "center",
              background: C.tBg, borderRadius: 10, border: `1px dashed ${C.tBdr}`,
            }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>↑</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.terra, marginBottom: 3 }}>No Sales Agreements</div>
              <div style={{ fontSize: 10, color: C.muted }}>No sales agreements found for this company</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 7 }}>
              {filteredSA.map(a => (
                <SalesAgreementCard key={a.id} agr={a}
                  onClick={() => setViewSA(a)} />
              ))}
            </div>
          )}
        </Section>
      )}

      {/* View Purchase Agreement Detail Modal */}
      {viewPA && (
        <ViewPurchaseDetail
          agr={viewPA}
          onClose={() => setViewPA(null)}
          onEdit={() => { setEditPA(viewPA); setViewPA(null); }}
        />
      )}

      {/* View Sales Agreement Detail Modal */}
      {viewSA && (
        <ViewSalesDetail
          agr={viewSA}
          onClose={() => setViewSA(null)}
          onEdit={() => { setEditSA(viewSA); setViewSA(null); }}
        />
      )}

      {/* Create Purchase Agreement Form */}
      {showCreatePA && (
        <PurchaseAgreementForm
          mode="create"
          onClose={() => setShowCreatePA(false)}
          onSuccess={() => setShowCreatePA(false)}
          activeCompanyId={activeCompanyId}
        />
      )}

      {/* Edit Purchase Agreement Form */}
      {editPA && (
        <PurchaseAgreementForm
          mode="edit"
          onClose={() => setEditPA(null)}
          onSuccess={() => setEditPA(null)}
          activeCompanyId={activeCompanyId}
          editData={{
            id: editPA.id,
            name: editPA.name,
            vendorId: editPA.vendorId,
            vendor: editPA.vendor,
            companyId: editPA.companyId,
            currencyId: editPA.currencyId,
            currency: editPA.currency,
            reference: editPA.reference,
            dateStart: editPA.dateStart,
            dateEnd: editPA.dateEnd,
            state: editPA.state,
            totalQuantityTons: editPA.totalQuantityTons,
            incoterm: editPA.incoterm,
            purchaseCurrency: editPA.purchaseCurrency,
            insuranceIncluded: editPA.insuranceIncluded,
            paymentTerms: editPA.paymentTerms,
            notes: editPA.notes,
            supplyStartDate: editPA.supplyStartDate,
            supplyEndDate: editPA.supplyEndDate,
            lines: editPA.lines.map(l => ({
              id: l.id,
              productId: l.productId,
              product: l.product,
              quantity: l.quantity,
              priceUnit: l.priceUnit,
              uomId: l.uomId,
              uom: l.uom,
            })),
          }}
        />
      )}

      {/* Create Sales Agreement Form */}
      {showCreateSA && (
        <SalesAgreementForm
          mode="create"
          onClose={() => setShowCreateSA(false)}
          onSuccess={() => setShowCreateSA(false)}
          activeCompanyId={activeCompanyId}
        />
      )}

      {/* Edit Sales Agreement Form */}
      {editSA && (
        <SalesAgreementForm
          mode="edit"
          onClose={() => setEditSA(null)}
          onSuccess={() => setEditSA(null)}
          activeCompanyId={activeCompanyId}
          editData={{
            id: editSA.id,
            name: editSA.name,
            customerId: editSA.customerId,
            customer: editSA.customer,
            studioCustomerId: editSA.studioCustomerId,
            studioCustomerName: editSA.studioCustomerName,
            ultimateCustomer: editSA.ultimateCustomer,
            incoterm: editSA.incoterm,
            currency: editSA.currency,
            insuranceIncluded: editSA.insuranceIncluded,

            supplyStartDate: editSA.supplyStartDate,
            supplyEndDate: editSA.supplyEndDate,
            notes: editSA.notes,
            paymentTerms: editSA.paymentTerms,

            companyId: editSA.companyId,
            lines: editSA.lines.map(l => ({
              id: l.id,
              productId: l.productId,
              product: l.product,
              quantity: l.quantity,
              priceUnit: l.priceUnit,
              uomId: l.uomId,
              uom: l.uom,
            })),
          }}
        />
      )}
    </div>
  );
}
