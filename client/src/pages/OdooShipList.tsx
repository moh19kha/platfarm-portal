// ══════════════════════════════════════════════════════════════════════════════
// ODOO SHIP LIST — Platfarm V3 — Purchase Shipments from Odoo (purchase.order)
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { C, fmt, fmtDateStr } from "@/lib/data";
import { Badge, Btn, Card, Th, Td, Mono } from "@/components/ui-primitives";
import { hl } from "@/components/SearchHighlight";
import { useTableSort } from "@/hooks/useTableSort";
import { SortTh } from "@/components/SortTh";
import { trpc } from "@/lib/trpc";
import { DraftsList } from "@/components/DraftsList";
import { FreeDaysBadge } from "@/components/FreeDaysBadge";
import { exportToExcel, type ExcelColumn } from "@/lib/exportExcel";
import { TopProgressBar, ShimmerBox, TableSkeleton } from "@/components/LoadingIndicators";
import { PO_STATE_LABELS as STATE_LABELS } from "@/lib/stateLabels";

type Shipment = {
  id: number;
  name: string;
  vendor: { id: number; name: string } | null;
  company: { id: number; name: string } | null;
  state: string;
  dateOrder: string | null;
  datePlanned: string | null;
  amountTotal: number;
  amountUntaxed: number;
  currency: { id: number; name: string } | null;
  agreement: { id: number; name: string } | null;
  pickingIds: number[];
  numberOfLoads: number;
  vesselName: string | null;
  trackingNumber: string | null;
  shipmentDate: string | null;
  etaArrival: string | null;
  productCategory: string | null;
  freightType: string | null;
  loadType: string | null;
  shippingLine: string | null;
  bookingNumber: string | null;
  blNumber: string | null;
  shipmentStatus: string | null;
  incoterm: { id: number; name: string } | null;
  totalShipmentWeight: number;
  paymentStatus: string | null;
  docStatus: string | null;
  acceptanceStatus: string | null;
  freeDaysDemurrage: number | null;
};

interface OdooShipListProps {
  activeCompanyId: string | number;
  onSelectShipment: (id: number) => void;
  onNew: () => void;
  onNewMultiLinked: () => void;
  onResumeDraft?: (draftId: number, wizardType: string) => void;
}

export function OdooShipList({ activeCompanyId, onSelectShipment, onNew, onNewMultiLinked, onResumeDraft }: OdooShipListProps) {
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const newDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (newDropdownRef.current && !newDropdownRef.current.contains(e.target as Node)) setNewDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [containerSearchResults, setContainerSearchResults] = useState<Set<number> | null>(null);
  const [containerSearching, setContainerSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const companyId = activeCompanyId === "ALL" ? undefined : Number(activeCompanyId);

  const { data: shipments, isLoading, error } = trpc.shipments.list.useQuery(
    { companyId, limit: 200, offset: 0 },
    { staleTime: 30_000 }
  );

  const utils = trpc.useUtils();

  // Debounced container/truck load search via backend
  const doContainerSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setContainerSearchResults(null);
      setContainerSearching(false);
      return;
    }
    setContainerSearching(true);
    try {
      const poIds = await utils.shipments.searchByLoadField.fetch({ query });
      setContainerSearchResults(new Set(poIds));
    } catch {
      setContainerSearchResults(null);
    } finally {
      setContainerSearching(false);
    }
  }, []);

  // Trigger container search with debounce when search changes
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!search || search.length < 2) {
      setContainerSearchResults(null);
      return;
    }
    searchTimerRef.current = setTimeout(() => doContainerSearch(search), 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search, doContainerSearch]);

  const filtered = useMemo(() => {
    if (!shipments) return [];
    return shipments.filter((sh) => {
      if (stateFilter !== "all" && (sh.shipmentStatus || "") !== stateFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        // Check standard fields first
        const matchesBasic = (
          sh.name.toLowerCase().includes(q) ||
          (sh.vendor?.name || "").toLowerCase().includes(q) ||
          (sh.company?.name || "").toLowerCase().includes(q) ||
          (sh.vesselName || "").toLowerCase().includes(q) ||
          (sh.agreement?.name || "").toLowerCase().includes(q) ||
          (sh.trackingNumber || "").toLowerCase().includes(q) ||
          (sh.bookingNumber || "").toLowerCase().includes(q) ||
          (sh.blNumber || "").toLowerCase().includes(q) ||
          (sh.shippingLine || "").toLowerCase().includes(q) ||
          (sh.portOfLoading || "").toLowerCase().includes(q) ||
          (sh.portOfDestination || "").toLowerCase().includes(q) ||
          (sh.productCategory || "").toLowerCase().includes(q) ||
          (sh.clearanceAgent?.name || "").toLowerCase().includes(q) ||
          (sh.truckingCompany?.name || "").toLowerCase().includes(q) ||
          (sh.productNames || []).some((pn: string) => pn.toLowerCase().includes(q))
        );
        if (matchesBasic) return true;
        // Check container/truck load search results from backend
        if (containerSearchResults && containerSearchResults.has(sh.id)) return true;
        return false;
      }
      return true;
    });
  }, [shipments, stateFilter, search, containerSearchResults]);

  // Sorting
  const sortAccessor = useCallback((row: Shipment, col: string): string | number | null => {
    switch (col) {
      case "name": return row.name;
      case "vendor": return row.vendor?.name || "";
      case "company": return row.company?.name || "";
      case "agreement": return row.agreement?.name || "";
      case "shipmentStatus": return row.shipmentStatus || "";
      case "shippingLine": return row.shippingLine || "";
      case "blNumber": return row.blNumber || "";
      case "vessel": return row.vesselName || "";
      case "freeDays": return row.freeDaysDemurrage ?? -1;
      case "loads": return row.pickingIds?.length || 0;
      case "amount": return row.amountTotal;
      case "dateOrder": return row.dateOrder || "";
      default: return "";
    }
  }, []);

  const { sorted: sortedFiltered, sort, toggleSort } = useTableSort(filtered, sortAccessor);

  const handleExport = () => {
    const columns: ExcelColumn<Shipment>[] = [
      { header: "PO #", value: (r) => r.name, width: 18 },
      { header: "Vendor", value: (r) => r.vendor?.name || "", width: 25 },
      { header: "Company", value: (r) => r.company?.name || "", width: 22 },
      { header: "State", value: (r) => STATE_LABELS[r.state] || r.state, width: 14 },
      { header: "Shipment Status", value: (r) => r.shipmentStatus || "", width: 16 },
      { header: "Vessel", value: (r) => r.vesselName || "", width: 20 },
      { header: "Shipping Line", value: (r) => r.shippingLine?.toUpperCase() || "", width: 18 },
      { header: "BL Number", value: (r) => r.blNumber || "", width: 18 },
      { header: "# Loads", value: (r) => r.numberOfLoads || 0, width: 10 },
      { header: "Receipts", value: (r) => r.pickingIds?.length || 0, width: 10 },
      { header: "Currency", value: (r) => r.currency?.name || "", width: 8 },
      { header: "Amount", value: (r) => r.amountTotal, width: 14 },
      { header: "Incoterm", value: (r) => r.incoterm?.name || "", width: 12 },
      { header: "Category", value: (r) => r.productCategory || "", width: 16 },
      { header: "Freight Type", value: (r) => r.freightType || "", width: 12 },
      { header: "Load Type", value: (r) => r.loadType || "", width: 12 },
      { header: "Weight (T)", value: (r) => r.totalShipmentWeight || 0, width: 12 },
      { header: "Free Days", value: (r) => r.freeDaysDemurrage || "", width: 10 },
      { header: "ETA Arrival", value: (r) => r.etaArrival || "", width: 14 },
      { header: "Agreement", value: (r) => r.agreement?.name || "", width: 18 },
      { header: "PO Creation Date", value: (r) => r.dateOrder ? fmtDateStr(r.dateOrder) : "", width: 14 },
      { header: "Acceptance", value: (r) => r.acceptanceStatus || "", width: 14 },
      { header: "Payment", value: (r) => r.paymentStatus || "", width: 14 },
      { header: "Doc Status", value: (r) => r.docStatus || "", width: 14 },
    ];
    exportToExcel(filtered, columns, "Purchase_Shipments");
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <TopProgressBar />
        {/* Skeleton toolbar */}
        <div className="mob-toolbar" style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", flexWrap: "wrap" }}>
          <ShimmerBox width={180} height={30} borderRadius={6} style={{ maxWidth: "100%" }} />
          <ShimmerBox width={120} height={30} borderRadius={6} />
          <ShimmerBox width={100} height={30} borderRadius={6} />
          <div style={{ flex: 1 }} />
          <ShimmerBox width={80} height={30} borderRadius={6} />
        </div>
        {/* Skeleton status tabs */}
        <div style={{ display: "flex", gap: 6 }}>
          {[90, 70, 80, 65, 85, 75].map((w, i) => (
            <ShimmerBox key={i} width={w} height={26} borderRadius={13} />
          ))}
        </div>
        {/* Skeleton table */}
        <Card p={0}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["PO Number", "Vendor", "Status", "Shipping Line", "BL #", "Vessel", "ETA", "Loads"].map((h, idx) => (
                  <Th key={h} sticky={idx === 0}>{h}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              <TableSkeleton rows={8} cols={8} />
            </tbody>
          </table>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div style={{ padding: 24, textAlign: "center", color: C.red, fontSize: 12 }}>
          Failed to load shipments: {error.message}
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Toolbar */}
      <div className="mob-toolbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <div className="mob-toolbar-search" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="PO#, vendor, vessel, BL, container..."
              className="mob-search-input"
              style={{
                padding: "4px 10px 4px 24px", border: `1px solid ${C.inputBdr}`,
                borderRadius: 6, fontSize: 10, outline: "none", width: 240,
                fontFamily: "var(--font-sans)",
              }}
            />
            <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: C.muted }}>{containerSearching ? "⏳" : "⌕"}</span>
          </div>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            style={{
              padding: "4px 6px", border: `1px solid ${C.inputBdr}`, borderRadius: 6, fontSize: 10, outline: "none",
            }}
          >
            <option value="all">All Statuses</option>
            <option value="Planned">Planned</option>
            <option value="Booked">Booked</option>
            <option value="Loading">Loading</option>
            <option value="Loaded">Loaded</option>
            <option value="In Transit">In Transit</option>
            <option value="Arrived at Port">Arrived at Port</option>
            <option value="Customs Clearance">Customs Clearance</option>
            <option value="Delivering">Delivering</option>
            <option value="Delivered">Delivered</option>
            <option value="Returned">Returned</option>
          </select>
        </div>
        <div className="mob-toolbar-actions" style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <Btn onClick={() => handleExport()} small outline color={C.gray}>⬇ Export</Btn>
          <Badge v="sage">{sortedFiltered.length} shipments</Badge>
          <div ref={newDropdownRef} style={{ position: "relative" }}>
            <Btn onClick={() => setNewDropdownOpen(!newDropdownOpen)} small>+ New Shipment ▾</Btn>
            {newDropdownOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", right: 0, minWidth: 200,
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 200, overflow: "hidden",
                animation: "fadeSlideDown .15s ease",
              }}>
                <div
                  onClick={() => { setNewDropdownOpen(false); onNew(); }}
                  style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${C.border}`, transition: "background .1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.gBg}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.dark }}>Single Shipment</div>
                  <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>Create one purchase shipment</div>
                </div>
                <div
                  onClick={() => { setNewDropdownOpen(false); onNewMultiLinked(); }}
                  style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${C.border}`, transition: "background .1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.gBg}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.dark }}>Multi-Linked Shipments</div>
                  <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>Create linked P/S across companies</div>
                </div>
                <DraftsList onResume={(id, type) => { setNewDropdownOpen(false); onResumeDraft?.(id, type); }} wizardTypes={["purchase", "multi_linked"]} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* List View */}
      <Card p={0}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <SortTh column="name" sticky currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>PO #</SortTh>
                  <SortTh column="vendor" currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Vendor</SortTh>
                  <SortTh column="company" currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Company</SortTh>
                  <SortTh column="agreement" currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Agreement</SortTh>
                  <SortTh column="shipmentStatus" currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Shipment Status</SortTh>
                  <SortTh column="shippingLine" currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Shipping Line</SortTh>
                  <SortTh column="blNumber" currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>BL #</SortTh>
                  <SortTh column="vessel" currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Vessel</SortTh>
                  <SortTh column="freeDays" currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Free Days</SortTh>
                  <SortTh column="loads" currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>Loads</SortTh>
                  <SortTh column="amount" currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort} right>Amount</SortTh>
                  <SortTh column="dateOrder" currentColumn={sort.column} currentDirection={sort.direction} onSort={toggleSort}>PO Date</SortTh>
                </tr>
              </thead>
              <tbody>
                {sortedFiltered.map((sh, i) => (
                  <tr
                    key={sh.id}
                    style={{ cursor: "pointer", background: i % 2 ? C.gBg : C.card }}
                    onClick={() => onSelectShipment(sh.id)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.gBg2)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 ? C.gBg : C.card)}
                  >
                    <Td accent mono sticky bg={i % 2 ? C.gBg : C.card}>{hl(sh.name, search)}</Td>
                    <Td>{hl(sh.vendor?.name || "—", search)}</Td>
                    <Td>
                      {sh.company ? (
                        <span style={{ fontSize: 10, color: C.dark }}>{hl(sh.company.name, search)}</span>
                      ) : (
                        <span style={{ color: C.muted }}>—</span>
                      )}
                    </Td>
                    <Td>
                      {sh.agreement ? (
                        <Mono color={C.sage}>{hl(sh.agreement.name, search)}</Mono>
                      ) : (
                        <span style={{ color: C.muted }}>—</span>
                      )}
                    </Td>
                    <Td>
                      {sh.shipmentStatus ? (
                        <Badge v={sh.shipmentStatus === "Delivered" ? "sage" : sh.shipmentStatus === "In Transit" ? "amber" : sh.shipmentStatus === "Loading" || sh.shipmentStatus === "Loaded" ? "amber" : sh.shipmentStatus === "Returned" ? "red" : "default"}>
                          {sh.shipmentStatus}
                        </Badge>
                      ) : (
                        <span style={{ color: C.muted, fontSize: 9 }}>Not Set</span>
                      )}
                    </Td>
                    <Td>{hl(sh.shippingLine?.toUpperCase() || "—", search)}</Td>
                    <Td mono>{hl(sh.blNumber || "—", search)}</Td>
                    <Td>{hl(sh.vesselName || "TBD", search)}</Td>
                    <Td><FreeDaysBadge freeDays={sh.freeDaysDemurrage} arrivalDate={sh.etaArrival} compact /></Td>
                    <Td mono>{sh.pickingIds?.length || 0}</Td>
                    <Td right mono>
                      {sh.currency?.name || ""} {fmt(sh.amountTotal)}
                    </Td>
                    <Td mono>{fmtDateStr(sh.dateOrder)}</Td>
                  </tr>
                ))}
                {sortedFiltered.length === 0 && (
                  <tr>
                    <td colSpan={13} style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 11 }}>
                      No shipments found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
    </div>
  );
}
