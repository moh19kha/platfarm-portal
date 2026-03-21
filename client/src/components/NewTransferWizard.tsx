/**
 * NewTransferWizard — Create an internal transfer in Odoo (stock.picking)
 *
 * Single-product mode: triggered from a shipment detail panel.
 * Defaults: CWDAK/Finished Goods-Dakhla → MWCP/Finished Goods-Sokhna
 * User can change warehouse/location, search products, enter weight (kg/tons) + bales.
 * Includes "Browse Available Stock" to see all products with stock at source location.
 *
 * Uses Odoo's standard stock.picking workflow:
 *   create picking → create move lines → action_confirm
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";

// Default location IDs (Dakhla → Sokhna)
const DEFAULT_SRC_WH = 13;   // CWDAK (Secondary Warehouse Cairo Platform - Dakhla)
const DEFAULT_SRC_LOC = 131;  // CWDAK/Finished Goods-Dakhla
const DEFAULT_DST_WH = 6;    // MWCP (Main Warehouse Cairo Platform - Sokhna)
const DEFAULT_DST_LOC = 115;  // MWCP/Finished Goods-Sokhna
const DEFAULT_PICKING_TYPE = 66; // Internal Transfers for MWCP
const DEFAULT_COMPANY = 3;    // Cairo-PLATFARM FOR AGRICULTURE CONSULTANCY

type Step = "form" | "confirm" | "success";

interface PrefillData {
  commodity?: string;
  weight?: number;
  bales?: number;
  shipmentId?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  prefill?: PrefillData | null;
}

export function NewTransferWizard({ open, onClose, prefill }: Props) {
  // Wizard state
  const [step, setStep] = useState<Step>("form");

  // Location state
  const [srcWhId, setSrcWhId] = useState(DEFAULT_SRC_WH);
  const [srcLocId, setSrcLocId] = useState(DEFAULT_SRC_LOC);
  const [dstWhId, setDstWhId] = useState(DEFAULT_DST_WH);
  const [dstLocId, setDstLocId] = useState(DEFAULT_DST_LOC);

  // Product state
  const [productSearch, setProductSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<{ id: number; name: string; uomId: number } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Quantity state
  const [quantity, setQuantity] = useState<string>("");
  const [unit, setUnit] = useState<"kg" | "tons">("kg");
  const [bales, setBales] = useState<string>("");

  // Browse stock state
  const [showBrowseStock, setShowBrowseStock] = useState(false);
  const [stockSearchFilter, setStockSearchFilter] = useState("");

  // Result state
  const [resultData, setResultData] = useState<{ pickingName: string; state: string } | null>(null);

  // Fetch locations
  const { data: warehouseData } = trpc.offlineOps.transferLocations.useQuery(
    { companyId: DEFAULT_COMPANY },
    { enabled: open }
  );

  // Search products with debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(productSearch), 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const { data: products, isLoading: productsLoading } = trpc.offlineOps.searchProducts.useQuery(
    { search: debouncedSearch, companyId: DEFAULT_COMPANY, limit: 20 },
    { enabled: open && debouncedSearch.length >= 1 }
  );

  // Create transfer mutation
  const createMutation = trpc.offlineOps.createTransfer.useMutation();

  // Stock availability check for selected product at source location
  const [showStockPopup, setShowStockPopup] = useState(false);
  const { data: stockData, isLoading: stockLoading, refetch: refetchStock } = trpc.offlineOps.checkStockAvailability.useQuery(
    { productId: selectedProduct?.id || 0, locationId: srcLocId },
    { enabled: open && !!selectedProduct && srcLocId > 0 }
  );

  // Browse all stock at source location
  const { data: allStockData, isLoading: allStockLoading } = trpc.offlineOps.browseStockAtLocation.useQuery(
    { locationId: srcLocId },
    { enabled: open && showBrowseStock && srcLocId > 0 }
  );

  // Filter browse stock list
  const filteredStock = useMemo(() => {
    if (!allStockData) return [];
    if (!stockSearchFilter.trim()) return allStockData;
    const q = stockSearchFilter.toLowerCase();
    return allStockData.filter(s => s.productName.toLowerCase().includes(q));
  }, [allStockData, stockSearchFilter]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Get warehouse locations
  const srcLocations = useMemo(() => {
    if (!warehouseData) return [];
    const wh = warehouseData.find((w) => w.id === srcWhId);
    return wh?.locations || [];
  }, [warehouseData, srcWhId]);

  const dstLocations = useMemo(() => {
    if (!warehouseData) return [];
    const wh = warehouseData.find((w) => w.id === dstWhId);
    return wh?.locations || [];
  }, [warehouseData, dstWhId]);

  // Convert quantity to kg for Odoo
  const toKg = (qty: number, u: "kg" | "tons") => (u === "tons" ? qty * 1000 : qty);

  // Computed: is form valid?
  const qtyNum = parseFloat(quantity) || 0;
  const qtyInKg = toKg(qtyNum, unit);
  const formValid = !!selectedProduct && qtyNum > 0;

  // Submit transfer
  const handleSubmit = async () => {
    if (!selectedProduct || qtyNum <= 0) return;

    try {
      const result = await createMutation.mutateAsync({
        sourceLocationId: srcLocId,
        destLocationId: dstLocId,
        pickingTypeId: DEFAULT_PICKING_TYPE,
        companyId: DEFAULT_COMPANY,
        origin: prefill?.shipmentId
          ? `Platfarm Portal — ${prefill.shipmentId} — Dakhla → Sokhna Transfer`
          : "Platfarm Portal — Dakhla → Sokhna Transfer",
        lines: [{
          productId: selectedProduct.id,
          quantity: qtyInKg,
          uomId: selectedProduct.uomId,
          bales: parseInt(bales) || undefined,
        }],
        autoConfirm: true,
      });

      setResultData({ pickingName: result.pickingName, state: result.state });
      setStep("success");
    } catch (err: any) {
      // Error is handled by mutation state
    }
  };

  // Auto-prefill from shipment data
  useEffect(() => {
    if (open && prefill) {
      if (prefill.commodity) {
        setProductSearch(prefill.commodity);
      }
      if (prefill.weight) {
        setQuantity(String(prefill.weight));
        setUnit("kg");
      }
      if (prefill.bales) {
        setBales(String(prefill.bales));
      }
    }
  }, [open, prefill]);

  // Close stock popup when product changes
  useEffect(() => {
    setShowStockPopup(false);
  }, [selectedProduct?.id, srcLocId]);

  // Reset wizard
  const resetWizard = () => {
    setStep("form");
    setSrcWhId(DEFAULT_SRC_WH);
    setSrcLocId(DEFAULT_SRC_LOC);
    setDstWhId(DEFAULT_DST_WH);
    setDstLocId(DEFAULT_DST_LOC);
    setSelectedProduct(null);
    setProductSearch("");
    setQuantity("");
    setBales("");
    setUnit("kg");
    setResultData(null);
    setShowStockPopup(false);
    setShowBrowseStock(false);
    setStockSearchFilter("");
    createMutation.reset();
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  if (!open) return null;

  // Get location names for display
  const srcLocName = srcLocations.find((l) => l.id === srcLocId)?.completeName || "—";
  const dstLocName = dstLocations.find((l) => l.id === dstLocId)?.completeName || "—";
  const srcWhName = warehouseData?.find((w) => w.id === srcWhId)?.name || "—";
  const dstWhName = warehouseData?.find((w) => w.id === dstWhId)?.name || "—";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={handleClose}>
      <div style={{
        background: "#fff", borderRadius: 14, width: 640, maxHeight: "90vh", overflow: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid #E4E1DC",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "#475577", color: "#fff", borderRadius: "14px 14px 0 0",
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {step === "form" ? "📦 New Internal Transfer" : step === "confirm" ? "✅ Confirm Transfer" : "🎉 Transfer Created"}
            </div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>
              {step === "form" ? "Dakhla → Sokhna (Odoo stock.picking)" : step === "confirm" ? "Review before submitting to Odoo" : "Successfully created in Odoo"}
            </div>
          </div>
          <button onClick={handleClose} style={{
            background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
            width: 30, height: 30, borderRadius: 8, cursor: "pointer", fontSize: 16,
          }}>×</button>
        </div>

        {/* Step indicator */}
        <div style={{
          display: "flex", gap: 0, padding: "14px 24px", background: "#FAFAF8",
          borderBottom: "1px solid #E4E1DC",
        }}>
          {[
            { n: 1, label: "Details" },
            { n: 2, label: "Confirm" },
            { n: 3, label: "Done" },
          ].map((s, i) => {
            const active = (step === "form" && s.n === 1) || (step === "confirm" && s.n === 2) || (step === "success" && s.n === 3);
            const done = (step === "confirm" && s.n === 1) || (step === "success" && s.n <= 2);
            return (
              <div key={s.n} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 12,
                  background: done ? "#2D5A3D" : active ? "#475577" : "#E4E1DC",
                  color: done || active ? "#fff" : "#95A09C",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                }}>{done ? "✓" : s.n}</div>
                <span style={{
                  marginLeft: 6, fontSize: 11, fontWeight: active ? 700 : 500,
                  color: active ? "#2C3E50" : "#95A09C",
                }}>{s.label}</span>
                {i < 2 && <div style={{
                  flex: 1, height: 2, margin: "0 10px",
                  background: done ? "#2D5A3D" : "#E4E1DC",
                }} />}
              </div>
            );
          })}
        </div>

        {/* ─── FORM STEP ─── */}
        {step === "form" && (
          <div style={{ padding: 24 }}>

            {/* Warehouse & Location selectors */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 0, marginBottom: 20 }}>
              {/* Source */}
              <div>
                <label style={labelStyle}>Source Warehouse</label>
                <select
                  value={srcWhId}
                  onChange={(e) => {
                    const whId = Number(e.target.value);
                    setSrcWhId(whId);
                    const wh = warehouseData?.find((w) => w.id === whId);
                    const finishedGoods = wh?.locations.find((l) => l.name.toLowerCase().includes("finished"));
                    setSrcLocId(finishedGoods?.id || wh?.locations[0]?.id || 0);
                  }}
                  style={selectStyle}
                >
                  {warehouseData?.map((wh) => (
                    <option key={wh.id} value={wh.id}>{wh.code} — {wh.name}</option>
                  ))}
                </select>
                <label style={{ ...labelStyle, marginTop: 8 }}>Source Location</label>
                <select value={srcLocId} onChange={(e) => setSrcLocId(Number(e.target.value))} style={selectStyle}>
                  {srcLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.completeName}</option>
                  ))}
                </select>
              </div>

              {/* Arrow */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#475577", paddingTop: 20 }}>→</div>

              {/* Destination */}
              <div>
                <label style={labelStyle}>Destination Warehouse</label>
                <select
                  value={dstWhId}
                  onChange={(e) => {
                    const whId = Number(e.target.value);
                    setDstWhId(whId);
                    const wh = warehouseData?.find((w) => w.id === whId);
                    const finishedGoods = wh?.locations.find((l) => l.name.toLowerCase().includes("finished"));
                    setDstLocId(finishedGoods?.id || wh?.locations[0]?.id || 0);
                  }}
                  style={selectStyle}
                >
                  {warehouseData?.map((wh) => (
                    <option key={wh.id} value={wh.id}>{wh.code} — {wh.name}</option>
                  ))}
                </select>
                <label style={{ ...labelStyle, marginTop: 8 }}>Destination Location</label>
                <select value={dstLocId} onChange={(e) => setDstLocId(Number(e.target.value))} style={selectStyle}>
                  {dstLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.completeName}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "#E4E1DC", margin: "0 0 20px" }} />

            {/* Product Search + Browse Stock icon */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Product</label>

              <div ref={dropdownRef} style={{ position: "relative" }}>
                <input
                  value={selectedProduct ? selectedProduct.name : productSearch}
                  onChange={(e) => {
                    if (selectedProduct) setSelectedProduct(null);
                    setProductSearch(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => { if (productSearch.length >= 1) setShowDropdown(true); }}
                  placeholder="Search product name (e.g. Alfalfa, Rhodes Grass...)"
                  style={{
                    ...inputStyle,
                    background: selectedProduct ? "#E4EFE6" : "#fff",
                    fontWeight: selectedProduct ? 600 : 400,
                  }}
                />
                {selectedProduct && (
                  <button
                    onClick={() => { setSelectedProduct(null); setProductSearch(""); }}
                    style={{
                      position: "absolute", right: 40, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", color: "#95A09C", fontSize: 14,
                    }}
                  >×</button>
                )}
                {/* Browse Stock icon button on right side of input */}
                <button
                  onClick={() => setShowBrowseStock(true)}
                  title="Browse available stock at source location"
                  style={{
                    position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                    width: 28, height: 28, borderRadius: 6,
                    background: "#F2F7F3", border: "1px solid #CDDDD1",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, transition: "all .15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#D4E8D9"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#F2F7F3"; }}
                >📦</button>
                {showDropdown && !selectedProduct && debouncedSearch.length >= 1 && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
                    background: "#fff", border: "1px solid #E4E1DC", borderRadius: 8,
                    maxHeight: 240, overflow: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  }}>
                    {productsLoading ? (
                      <div style={{ padding: 14, textAlign: "center", color: "#95A09C", fontSize: 12 }}>Searching...</div>
                    ) : products && products.length > 0 ? (
                      products.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedProduct({ id: p.id, name: p.displayName, uomId: p.uomId });
                            setProductSearch(p.displayName);
                            setShowDropdown(false);
                          }}
                          style={{
                            padding: "10px 14px", cursor: "pointer", fontSize: 12,
                            borderBottom: "1px solid #F5F3F0",
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F3F0")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                        >
                          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.displayName}
                          </span>
                          <span style={{ fontSize: 10, color: "#95A09C", marginLeft: 8, whiteSpace: "nowrap" }}>
                            {p.uomName}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: 14, textAlign: "center", color: "#95A09C", fontSize: 12 }}>
                        No products found for "{debouncedSearch}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ─── Browse Available Stock Popup Modal ─── */}
            {showBrowseStock && (
              <div style={{
                position: "fixed", inset: 0, zIndex: 1100,
                background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center",
              }} onClick={() => setShowBrowseStock(false)}>
                <div style={{
                  background: "#fff", borderRadius: 14, width: 560, maxHeight: "80vh",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden",
                }} onClick={(e) => e.stopPropagation()}>
                  {/* Popup header */}
                  <div style={{
                    padding: "14px 20px", background: "#2D5A3D", color: "#fff",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>
                        Available Stock
                      </div>
                      <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>
                        {srcLocations.find(l => l.id === srcLocId)?.completeName || "Source Location"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 10, opacity: 0.7 }}>
                        {allStockLoading ? "Loading..." : `${filteredStock.length} product${filteredStock.length !== 1 ? "s" : ""}`}
                      </span>
                      <button onClick={() => setShowBrowseStock(false)} style={{
                        background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
                        width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontSize: 14,
                      }}>×</button>
                    </div>
                  </div>

                  {/* Search filter */}
                  <div style={{ padding: "10px 20px", borderBottom: "1px solid #E4E1DC", background: "#FAFAF8" }}>
                    <input
                      value={stockSearchFilter}
                      onChange={(e) => setStockSearchFilter(e.target.value)}
                      placeholder="Search products..."
                      autoFocus
                      style={{ ...inputStyle, height: 36, fontSize: 12, background: "#fff" }}
                    />
                  </div>

                  {/* Stock list */}
                  {allStockLoading ? (
                    <div style={{ padding: 40, textAlign: "center", color: "#95A09C", fontSize: 13 }}>
                      Loading stock data from Odoo...
                    </div>
                  ) : filteredStock.length === 0 ? (
                    <div style={{ padding: 40, textAlign: "center", color: "#95A09C", fontSize: 13 }}>
                      {stockSearchFilter ? `No products matching "${stockSearchFilter}"` : "No products with available stock at this location"}
                    </div>
                  ) : (
                    <div style={{ maxHeight: "55vh", overflow: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#F2F7F3", position: "sticky", top: 0 }}>
                            <th style={{ ...thStyle, fontSize: 10 }}>Product</th>
                            <th style={{ ...thStyle, fontSize: 10, textAlign: "right" }}>Available</th>
                            <th style={{ ...thStyle, fontSize: 10, textAlign: "right" }}>Reserved</th>
                            <th style={{ ...thStyle, fontSize: 10, textAlign: "center", width: 60 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStock.map((item) => (
                            <tr
                              key={item.productId}
                              style={{
                                borderBottom: "1px solid #F5F3F0",
                                background: selectedProduct?.id === item.productId ? "#E4EFE6" : "transparent",
                                cursor: "pointer",
                              }}
                              onMouseEnter={(e) => { if (selectedProduct?.id !== item.productId) e.currentTarget.style.background = "#FAFAF8"; }}
                              onMouseLeave={(e) => { if (selectedProduct?.id !== item.productId) e.currentTarget.style.background = "transparent"; }}
                              onClick={() => {
                                setSelectedProduct({ id: item.productId, name: item.productName, uomId: 12 });
                                setProductSearch(item.productName);
                                setShowDropdown(false);
                                setShowBrowseStock(false);
                              }}
                            >
                              <td style={{ padding: "10px 16px", fontSize: 12 }}>
                                <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>
                                  {item.productName}
                                </div>
                                <div style={{ fontSize: 10, color: "#95A09C", marginTop: 2 }}>{item.uomName}</div>
                              </td>
                              <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#2D5A3D", fontSize: 13 }}>
                                {item.availableQuantity.toLocaleString()}
                              </td>
                              <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "monospace", fontSize: 11, color: item.reservedQuantity > 0 ? "#D4960A" : "#CCC" }}>
                                {item.reservedQuantity > 0 ? item.reservedQuantity.toLocaleString() : "—"}
                              </td>
                              <td style={{ padding: "10px 8px", textAlign: "center" }}>
                                {selectedProduct?.id === item.productId ? (
                                  <span style={{ color: "#2D5A3D", fontWeight: 700, fontSize: 14 }}>✓</span>
                                ) : (
                                  <span style={{ color: "#95A09C", fontSize: 11 }}>Select</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stock Availability Indicator (for selected product) */}
            {selectedProduct && (
              <div style={{ marginBottom: 12, position: "relative" }}>
                <div
                  onClick={() => { refetchStock(); setShowStockPopup(!showStockPopup); }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                    background: stockLoading ? "#F5F3F0" : (stockData && stockData.availableQuantity > 0) ? "#E4EFE6" : "#FDF0F0",
                    border: `1px solid ${stockLoading ? "#E4E1DC" : (stockData && stockData.availableQuantity > 0) ? "#CDDDD1" : "#F5B8B8"}`,
                    transition: "all .15s",
                  }}
                >
                  <span style={{ fontSize: 14 }}>{stockLoading ? "⏳" : (stockData && stockData.availableQuantity > 0) ? "✅" : "⚠️"}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: stockLoading ? "#95A09C" : (stockData && stockData.availableQuantity > 0) ? "#2D5A3D" : "#C94444" }}>
                    {stockLoading ? "Checking stock..." : stockData ? `${stockData.availableQuantity.toLocaleString()} kg available` : "Check stock"}
                  </span>
                  <span style={{ fontSize: 10, color: "#95A09C" }}>ⓘ</span>
                </div>
                {showStockPopup && stockData && !stockLoading && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
                    background: "#fff", border: "1px solid #E4E1DC", borderRadius: 10,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 16, minWidth: 280,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#95A09C", textTransform: "uppercase", marginBottom: 10 }}>
                      Stock at Source Location
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#2C3E50", marginBottom: 8 }}>
                      {selectedProduct.name}
                    </div>
                    <div style={{ fontSize: 10, color: "#64706C", marginBottom: 10 }}>
                      Location: {stockData.locationName}
                    </div>
                    {[
                      ["On Hand (Total)", `${stockData.quantity.toLocaleString()} kg`, "#2C3E50"],
                      ["Reserved", `${stockData.reservedQuantity.toLocaleString()} kg`, "#D4960A"],
                      ["Available (Unreserved)", `${stockData.availableQuantity.toLocaleString()} kg`, stockData.availableQuantity > 0 ? "#2D5A3D" : "#C94444"],
                    ].map(([label, val, color]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #F5F3F0" }}>
                        <span style={{ fontSize: 11, color: "#64706C" }}>{label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: color as string }}>{val}</span>
                      </div>
                    ))}
                    {stockData.availableQuantity <= 0 && (
                      <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: "#FDF0F0", border: "1px solid #F5B8B8", fontSize: 10, color: "#C94444" }}>
                        ⚠ No available stock at this location. Transfer will be rejected.
                      </div>
                    )}
                    <button onClick={() => setShowStockPopup(false)} style={{
                      marginTop: 10, width: "100%", padding: "6px 0", borderRadius: 6,
                      border: "1px solid #E4E1DC", background: "#FAFAF8", cursor: "pointer",
                      fontSize: 10, fontWeight: 600, color: "#64706C", fontFamily: "inherit",
                    }}>Close</button>
                  </div>
                )}
              </div>
            )}

            {/* Weight & Bales */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Weight</label>
                <div style={{ display: "flex", gap: 0 }}>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.1"
                    style={{ ...inputStyle, borderRadius: "8px 0 0 8px", flex: 1 }}
                  />
                  <div style={{ display: "flex", borderRadius: "0 8px 8px 0", overflow: "hidden", border: "1px solid #E4E1DC", borderLeft: "none" }}>
                    <button
                      onClick={() => setUnit("kg")}
                      style={{
                        padding: "0 12px", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
                        background: unit === "kg" ? "#2D5A3D" : "#FAFAF8",
                        color: unit === "kg" ? "#fff" : "#64706C",
                      }}
                    >kg</button>
                    <button
                      onClick={() => setUnit("tons")}
                      style={{
                        padding: "0 12px", border: "none", borderLeft: "1px solid #E4E1DC", cursor: "pointer",
                        fontSize: 11, fontWeight: 700,
                        background: unit === "tons" ? "#2D5A3D" : "#FAFAF8",
                        color: unit === "tons" ? "#fff" : "#64706C",
                      }}
                    >tons</button>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 4, color: "#95A09C" }}>·</div>

              <div>
                <label style={labelStyle}># Bales (reference)</label>
                <input
                  type="number"
                  value={bales}
                  onChange={(e) => setBales(e.target.value)}
                  placeholder="0"
                  min="0"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Stock warning if qty exceeds available */}
            {selectedProduct && stockData && !stockLoading && qtyInKg > stockData.availableQuantity && qtyNum > 0 && (
              <div style={{
                background: "#FDF0F0", border: "1px solid #F5B8B8", borderRadius: 8,
                padding: 12, marginBottom: 16, fontSize: 11, color: "#C94444",
              }}>
                <strong>⚠ Requested {qtyInKg.toLocaleString()} kg exceeds available stock ({stockData.availableQuantity.toLocaleString()} kg).</strong>
                <br />Transfer will be rejected by the server.
              </div>
            )}

            {/* Review Transfer Button */}
            <button
              onClick={() => setStep("confirm")}
              disabled={!formValid}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 8, border: "none",
                background: formValid ? "#475577" : "#E4E1DC",
                color: formValid ? "#fff" : "#95A09C",
                cursor: formValid ? "pointer" : "not-allowed",
                fontSize: 13, fontWeight: 700,
              }}
            >
              Review Transfer →
            </button>
          </div>
        )}

        {/* ─── CONFIRM STEP ─── */}
        {step === "confirm" && selectedProduct && (
          <div style={{ padding: 24 }}>
            {/* Summary card */}
            <div style={{
              background: "#F2F7F3", borderRadius: 10, padding: 18, marginBottom: 20,
              border: "1px solid #D4E8D9",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#2D5A3D", marginBottom: 12 }}>Transfer Summary</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 9, color: "#95A09C", textTransform: "uppercase", fontWeight: 700 }}>From</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#2C3E50" }}>{srcWhName}</div>
                  <div style={{ fontSize: 10, color: "#64706C" }}>{srcLocName}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", fontSize: 20, color: "#475577" }}>→</div>
                <div>
                  <div style={{ fontSize: 9, color: "#95A09C", textTransform: "uppercase", fontWeight: 700 }}>To</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#2C3E50" }}>{dstWhName}</div>
                  <div style={{ fontSize: 10, color: "#64706C" }}>{dstLocName}</div>
                </div>
              </div>

              <div style={{ height: 1, background: "#D4E8D9", margin: "0 0 12px" }} />

              {/* Product line */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#2C3E50" }}>{selectedProduct.name}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "#2D5A3D" }}>
                    {qtyInKg.toLocaleString()} kg
                  </div>
                  {parseInt(bales) > 0 && (
                    <div style={{ fontSize: 11, color: "#64706C" }}>{bales} bales</div>
                  )}
                </div>
              </div>
            </div>

            {/* Warning */}
            <div style={{
              background: "#FDF6EC", border: "1px solid #F5DDB8", borderRadius: 8,
              padding: 14, marginBottom: 20, fontSize: 11, color: "#8B6914",
            }}>
              <strong>⚠ This will create a confirmed internal transfer in Odoo.</strong><br />
              The stock.picking will be created with status "Confirmed" (waiting). Odoo will handle
              all stock moves, accounting entries, and inventory valuations through its standard process.
            </div>

            {/* Error display */}
            {createMutation.error && (
              <div style={{
                background: "#FDF0F0", border: "1px solid #F5B8B8", borderRadius: 8,
                padding: 14, marginBottom: 20, fontSize: 11, color: "#C94444",
              }}>
                <strong>Error:</strong> {createMutation.error.message}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setStep("form")}
                disabled={createMutation.isPending}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 8,
                  border: "1px solid #E4E1DC", background: "#fff", color: "#2C3E50",
                  cursor: "pointer", fontSize: 13, fontWeight: 600,
                }}
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                style={{
                  flex: 2, padding: "12px 0", borderRadius: 8, border: "none",
                  background: createMutation.isPending ? "#95A09C" : "#2D5A3D",
                  color: "#fff", cursor: createMutation.isPending ? "wait" : "pointer",
                  fontSize: 13, fontWeight: 700,
                }}
              >
                {createMutation.isPending ? "⟳ Creating in Odoo..." : "✅ Create Transfer in Odoo"}
              </button>
            </div>
          </div>
        )}

        {/* ─── SUCCESS STEP ─── */}
        {step === "success" && resultData && (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, borderRadius: 32, background: "#E4EFE6",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px", fontSize: 28,
            }}>✅</div>

            <div style={{ fontSize: 18, fontWeight: 700, color: "#2D5A3D", marginBottom: 6 }}>
              Transfer Created Successfully
            </div>
            <div style={{ fontSize: 13, color: "#64706C", marginBottom: 20 }}>
              Odoo Reference: <strong style={{ color: "#2C3E50" }}>{resultData.pickingName}</strong>
              <br />
              Status: <strong style={{ color: "#475577" }}>{resultData.state}</strong>
            </div>

            <div style={{
              background: "#F2F7F3", borderRadius: 8, padding: 14, marginBottom: 20,
              fontSize: 11, color: "#2D5A3D", textAlign: "left",
            }}>
              <strong>What happens next:</strong>
              <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                <li>The transfer is now confirmed in Odoo and waiting for processing</li>
                <li>Stock has been reserved at the source location</li>
                <li>When goods are physically moved, validate the transfer in Odoo to complete it</li>
                <li>Odoo will automatically update inventory, accounting, and valuations</li>
              </ul>
            </div>

            <button
              onClick={handleClose}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 8, border: "none",
                background: "#475577", color: "#fff", cursor: "pointer",
                fontSize: 13, fontWeight: 700,
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Shared styles
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: "#95A09C", textTransform: "uppercase",
  marginBottom: 6, display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%", height: 38, padding: "0 12px",
  border: "1px solid #E4E1DC", borderRadius: 8,
  fontFamily: "inherit", fontSize: 12, outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  width: "100%", height: 38, padding: "0 10px",
  border: "1px solid #E4E1DC", borderRadius: 8,
  fontFamily: "inherit", fontSize: 11, outline: "none",
  background: "#fff", boxSizing: "border-box",
};

const thStyle: React.CSSProperties = {
  padding: "8px 12px", textAlign: "left",
  fontSize: 10, fontWeight: 700, color: "#95A09C", textTransform: "uppercase",
};
