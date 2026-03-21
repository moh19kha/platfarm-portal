/**
 * StockViewerPopup — Shows all products with positive stock at a given location.
 * Reusable across Purchase, Sales, and Multi-Linked shipment wizards.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { C, FONT, MONO } from "@/lib/data";

interface StockViewerPopupProps {
  locationId: number;
  locationName?: string;
  onClose: () => void;
  accentColor?: string; // defaults to C.forest
}

export function StockViewerPopup({ locationId, locationName, onClose, accentColor = C.forest }: StockViewerPopupProps) {
  const [search, setSearch] = useState("");

  const { data: stockData, isLoading } = trpc.shipments.allStockAtLocation.useQuery(
    { locationId },
    { enabled: locationId > 0 }
  );

  type StockItem = { productId: number; productName: string; locationId: number; locationName: string; quantity: number; reservedQuantity: number; availableQuantity: number; uomName: string };

  const filtered = ((stockData || []) as StockItem[]).filter((item: StockItem) =>
    item.productName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400,
      }}
    >
      <div
        style={{
          background: C.card, borderRadius: 12, width: 560, maxHeight: "75vh",
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
          borderWidth: 1, borderStyle: "solid", borderColor: C.border,
        }}
      >
        {/* Header */}
        <div style={{
          padding: "12px 16px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: `${accentColor}08`,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, fontFamily: FONT }}>
              📦 Inventory Stock
            </div>
            {locationName && (
              <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                Location: {locationName}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", fontSize: 18, cursor: "pointer",
              color: C.gray, padding: "2px 6px", borderRadius: 4,
            }}
          >×</button>
        </div>

        {/* Search */}
        <div style={{ padding: "8px 16px", borderBottom: `1px solid ${C.border}` }}>
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "6px 10px",
              borderWidth: 1, borderStyle: "solid", borderColor: C.inputBdr,
              borderRadius: 6, fontSize: 11, fontFamily: FONT, outline: "none",
              background: C.gBg,
            }}
          />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "0" }}>
          {isLoading ? (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 40, color: C.muted, fontSize: 11,
            }}>
              Loading stock data...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: 40, color: C.muted, fontSize: 11,
            }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>📭</div>
              {search ? "No products match your search" : "No products with positive stock at this location"}
            </div>
          ) : (
            <table style={{
              width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: FONT,
            }}>
              <thead>
                <tr style={{
                  background: C.gBg, position: "sticky", top: 0, zIndex: 1,
                }}>
                  <th style={{
                    textAlign: "left", padding: "8px 12px", fontWeight: 700,
                    color: C.sage, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5,
                    borderBottom: `1px solid ${C.border}`,
                  }}>Product</th>
                  <th style={{
                    textAlign: "right", padding: "8px 12px", fontWeight: 700,
                    color: C.sage, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5,
                    borderBottom: `1px solid ${C.border}`,
                  }}>On Hand</th>
                  <th style={{
                    textAlign: "right", padding: "8px 12px", fontWeight: 700,
                    color: C.sage, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5,
                    borderBottom: `1px solid ${C.border}`,
                  }}>Reserved</th>
                  <th style={{
                    textAlign: "right", padding: "8px 12px", fontWeight: 700,
                    color: accentColor, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5,
                    borderBottom: `1px solid ${C.border}`,
                  }}>Available</th>
                  <th style={{
                    textAlign: "center", padding: "8px 12px", fontWeight: 700,
                    color: C.sage, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5,
                    borderBottom: `1px solid ${C.border}`,
                  }}>Unit</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item: StockItem, i: number) => (
                  <tr
                    key={item.productId}
                    style={{
                      background: i % 2 === 0 ? "transparent" : C.gBg,
                      transition: "background .1s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = `${accentColor}08`}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : C.gBg}
                  >
                    <td style={{
                      padding: "7px 12px", fontWeight: 500, color: C.dark,
                      borderBottom: `1px solid ${C.border}`,
                      maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{item.productName}</td>
                    <td style={{
                      padding: "7px 12px", textAlign: "right", fontFamily: MONO,
                      color: C.dark, fontWeight: 500,
                      borderBottom: `1px solid ${C.border}`,
                    }}>{item.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td style={{
                      padding: "7px 12px", textAlign: "right", fontFamily: MONO,
                      color: item.reservedQuantity > 0 ? C.amber : C.muted, fontWeight: 500,
                      borderBottom: `1px solid ${C.border}`,
                    }}>{item.reservedQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td style={{
                      padding: "7px 12px", textAlign: "right", fontFamily: MONO,
                      color: accentColor, fontWeight: 700,
                      borderBottom: `1px solid ${C.border}`,
                    }}>{item.availableQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td style={{
                      padding: "7px 12px", textAlign: "center",
                      color: C.muted, fontWeight: 500,
                      borderBottom: `1px solid ${C.border}`,
                    }}>{item.uomName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "8px 16px", borderTop: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: C.gBg, fontSize: 10, color: C.muted,
        }}>
          <span>{filtered.length} product{filtered.length !== 1 ? "s" : ""} with stock</span>
          <button
            onClick={onClose}
            style={{
              padding: "5px 14px", borderRadius: 5,
              borderWidth: 1, borderStyle: "solid", borderColor: C.border,
              background: C.card, fontSize: 10, fontWeight: 600, color: C.gray,
              cursor: "pointer", fontFamily: FONT,
            }}
          >Close</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Small button to trigger the stock viewer popup.
 */
export function ViewStockButton({
  locationId,
  locationName,
  accentColor = C.forest,
}: {
  locationId: number;
  locationName?: string;
  accentColor?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!locationId || locationId <= 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: "4px 10px", borderRadius: 5,
          borderWidth: 1, borderStyle: "solid", borderColor: `${accentColor}44`,
          background: `${accentColor}0A`, color: accentColor,
          fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
          display: "inline-flex", alignItems: "center", gap: 4,
          transition: "all .15s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = `${accentColor}18`;
          e.currentTarget.style.borderColor = `${accentColor}66`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = `${accentColor}0A`;
          e.currentTarget.style.borderColor = `${accentColor}44`;
        }}
      >
        📦 View Stock
      </button>
      {open && (
        <StockViewerPopup
          locationId={locationId}
          locationName={locationName}
          onClose={() => setOpen(false)}
          accentColor={accentColor}
        />
      )}
    </>
  );
}
