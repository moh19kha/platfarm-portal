// @ts-nocheck
import { useState, useMemo, useEffect, useRef, useCallback, Fragment } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { TopProgressBar, ShimmerBox } from "@/components/LoadingIndicators";
import { PeriodicInventoryDashboard } from "@/components/PeriodicInventoryDashboard";
import { DakhlaSokhnaTransfers } from "./DakhlaSokhnaTransfers";
import { PlatfarmLogo } from "@/components/PlatfarmLogo";


// ─── Formatters ────────────────────────────────────────────────────────────
const fK = (kg: number) => {
  // Convert kg to tons for display
  const tons = kg / 1000;
  if (Math.abs(tons) >= 1e6) return (tons / 1e6).toFixed(2) + "M t";
  if (Math.abs(tons) >= 1000) return (tons / 1000).toFixed(1) + "K t";
  return tons.toFixed(2) + " t";
};
const fV = (v: number) =>
  Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + "M" : Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + "K" : v.toLocaleString();

// ─── Product group color map ───────────────────────────────────────────────
const GROUP_COLORS: Record<string, string> = {
  Alfalfa: "#2D5A3D",
  "Rhodes Grass": "#4A7C59",
  AlfaMix: "#C0714A",
  MixGrass: "#D4960A",
  "Wheat Straw": "#95A09C",
  "Diesel & Fuel": "#475577",
  "Oil & Lubricants": "#6B7280",
  Equipment: "#8B5CF6",
  "Sleeve Bags": "#EC4899",
  Grass: "#16A34A",
  Hay: "#CA8A04",
  "Ray Grass": "#059669",
  Other: "#9CA3AF",
};
const groupColor = (name: string) => GROUP_COLORS[name] || "#9CA3AF";

// ─── Stock Type mapping ──────────────────────────────────────────────────
const STOCK_TYPES: Record<string, string> = {
  "Animal Fodder": "#2D5A3D",
  "Packing Materials": "#EC4899",
  "Oil & Fuel": "#475577",
  "Spare Parts": "#8B5CF6",
  "Others": "#9CA3AF",
};
const STOCK_TYPE_NAMES = ["All", ...Object.keys(STOCK_TYPES)];
const groupToStockType = (group: string): string => {
  const g = group.toLowerCase();
  if (["alfalfa", "rhodes grass", "alfamix", "mixgrass", "wheat straw", "grass", "hay", "ray grass"].some(k => g.includes(k) || g === k)) return "Animal Fodder";
  if (["sleeve bags", "packing", "packaging", "bags"].some(k => g.includes(k))) return "Packing Materials";
  if (["diesel", "fuel", "oil", "lubricant", "oil & lubricants"].some(k => g.includes(k))) return "Oil & Fuel";
  if (["equipment", "spare", "parts", "machinery"].some(k => g.includes(k))) return "Spare Parts";
  return "Others";
};

// ─── Grade extraction from product name ─────────────────────────────────
const extractGrade = (productName: string): string => {
  const n = productName.toLowerCase();
  // Match "Grade X" patterns
  const gradeMatch = n.match(/grade\s*(\d+)/i);
  if (gradeMatch) return "Grade " + gradeMatch[1];
  // Match "Standard" keyword
  if (n.includes("standard")) return "Standard";
  // Match "Premium" keyword
  if (n.includes("premium")) return "Premium";
  // Match "Hay" keyword (for hay bales)
  if (n.includes("hay") && !n.includes("grade")) return "Hay";
  return "Ungraded";
};

// ─── Grade color coding ──────────────────────────────────────────────────
const gradeColor = (grade: string): { bg: string; text: string } => {
  switch (grade) {
    case "Grade 1": return { bg: "#D4EDDA", text: "#1B6B2E" }; // green
    case "Grade 2": return { bg: "#D1ECF1", text: "#0C5460" }; // teal
    case "Grade 3": return { bg: "#FFE8CC", text: "#A85D00" }; // orange
    case "Grade 4": return { bg: "#F8D7DA", text: "#842029" }; // red
    case "Premium": return { bg: "#E8DAEF", text: "#6C3483" }; // purple
    case "Standard": return { bg: "#E2E3E5", text: "#495057" }; // grey
    case "Hay": return { bg: "#FFF3CD", text: "#856404" }; // yellow
    default: return { bg: "#F2F0EC", text: "#64706C" }; // neutral
  }
};

// ─── Loading Skeleton ──────────────────────────────────────────────────────
function InventorySkeleton() {
  return (
    <div style={{ padding: 18 }}>
      {/* Hero skeleton */}
      <div style={{ background: "linear-gradient(135deg,#1B3A2D 0%,#2D5A3D 60%,#4A7C59 100%)", borderRadius: 12, padding: "24px 28px", marginBottom: 16 }}>
        <ShimmerBox width={160} height={10} style={{ marginBottom: 10, opacity: 0.3 }} />
        <ShimmerBox width={260} height={42} style={{ marginBottom: 16, opacity: 0.3 }} />
        <ShimmerBox width="100%" height={24} borderRadius={6} style={{ marginBottom: 8, opacity: 0.2 }} />
        <div style={{ display: "flex", gap: 14 }}>
          {[120, 100, 80, 90].map((w, i) => (
            <ShimmerBox key={i} width={w} height={14} style={{ opacity: 0.2 }} />
          ))}
        </div>
      </div>
      {/* KPI cards skeleton */}
      <div className="skel-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ background: "#fff", border: "1px solid #CDDDD1", borderRadius: 9, padding: 14 }}>
            <ShimmerBox width={80} height={9} style={{ marginBottom: 10 }} />
            <ShimmerBox width={100} height={20} style={{ marginBottom: 6 }} />
            <ShimmerBox width={60} height={9} />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div style={{ background: "#fff", border: "1px solid #E4E1DC", borderRadius: 9, overflow: "hidden" }}>
        <div style={{ background: "#2D5A3D", padding: "10px 16px" }}>
          <ShimmerBox width={180} height={14} style={{ opacity: 0.3 }} />
        </div>
        <div style={{ padding: 16 }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{ display: "flex", gap: 16, padding: "10px 0", borderBottom: "1px solid #F2F0EC" }}>
              <ShimmerBox width={200} height={12} />
              <ShimmerBox width={80} height={12} />
              <ShimmerBox width={100} height={12} />
              <ShimmerBox width={60} height={12} />
              <ShimmerBox width={60} height={12} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const SectionError = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 24px" }}>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>⚠</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#C94444", marginBottom: 4 }}>Failed to load data</div>
      <div style={{ fontSize: 11, color: C.muted }}>Check your connection or refresh the page.</div>
    </div>
  </div>
);
export default function InventoryModule() {
  const [, setLocation] = useLocation();
  const [pg, setPg] = useState("dash");
  const [sc, setSc] = useState(false);
  const [sr, setSr] = useState("");
  const [whFs, setWhFs] = useState<Set<string>>(new Set(["Main Warehouse Cairo Platform - Sokhna", "Secondary Warehouse Cairo Platform -Dakhla"]));
  const [sv, setSv] = useState("all");
  const [sel, setSel] = useState<any>(null);
  const [selWh, setSelWh] = useState<any>(null);
  const [co, setCo] = useState<string>("ALL");
  const [coO, setCoO] = useState(false);
  const [mobMenu, setMobMenu] = useState(false);
  // Mobile detection
  const [isMob, setIsMob] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const h = () => setIsMob(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const [pCats, setPCats] = useState<Set<string>>(new Set(["Alfalfa"]));
  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, val: string) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val); else next.add(val);
      return next;
    });
  };
  const togglePCat = (c: string) => {
    if (c === "All") { setPCats(new Set()); setLocFs(new Set()); return; }
    toggleSet(setPCats, c);
    setLocFs(new Set());
  };
  const [dashLocs, setDashLocs] = useState<Set<string>>(new Set());
  const [dashWhs, setDashWhs] = useState<Set<string>>(new Set(["Main Warehouse Cairo Platform - Sokhna", "Secondary Warehouse Cairo Platform -Dakhla"]));
  const [dashProds, setDashProds] = useState<Set<string>>(new Set());

  const [locFs, setLocFs] = useState<Set<string>>(new Set());
  const [gradeFs, setGradeFs] = useState<Set<string>>(new Set());
  const [selWhLoc, setSelWhLoc] = useState("All"); // location filter inside warehouse detail
  const [barTip, setBarTip] = useState<{ x: number; y: number; wh: any } | null>(null);
  const [alO, setAlO] = useState(false);
  const [dashSearch, setDashSearch] = useState("");
  const [stockTypes, setStockTypes] = useState<Set<string>>(new Set(["Animal Fodder"]));
  const toggleStockType = (t: string) => {
    if (t === "All") { setStockTypes(new Set()); setDashProds(new Set()); setDashLocs(new Set()); setDashWhs(new Set()); return; }
    setStockTypes(prev => { const n = new Set(prev); if (n.has(t)) n.delete(t); else n.add(t); return n; });
    setDashProds(new Set()); setDashLocs(new Set()); setDashWhs(new Set());
  };
  const [sortCol, setSortCol] = useState<"p" | "qty" | "res" | "avail" | "value" | "px">("qty");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggleSort = (col: "p" | "qty" | "res" | "avail" | "value" | "px") => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir(col === "p" ? "asc" : "desc"); }
  };
  // Supply Split state
  const [ssView, setSsView] = useState<"suppliers" | "products" | "lines">("suppliers");
  const [ssPeriod, setSsPeriod] = useState<"7d" | "30d" | "90d" | "all" | "custom">("all");
  const [ssDateFrom, setSsDateFrom] = useState("");
  const [ssDateTo, setSsDateTo] = useState("");
  const ssComputedDates = useMemo(() => {
    if (ssPeriod === "custom") return { from: ssDateFrom, to: ssDateTo };
    if (ssPeriod === "all") return { from: "", to: "" };
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    const days = ssPeriod === "7d" ? 7 : ssPeriod === "30d" ? 30 : 90;
    const from = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
    return { from, to };
  }, [ssPeriod, ssDateFrom, ssDateTo]);
  const [ssSearch, setSsSearch] = useState("");
  const [ssExpanded, setSsExpanded] = useState<Set<number>>(new Set());
  const [ssSortCol, setSsSortCol] = useState<"name" | "qty" | "received" | "value" | "orders">("received");
  const [ssSortDir, setSsSortDir] = useState<"asc" | "desc">("desc");
  const toggleSsSort = (col: typeof ssSortCol) => {
    if (ssSortCol === col) setSsSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSsSortCol(col); setSsSortDir(col === "name" ? "asc" : "desc"); }
  };
  const [ssWarehouseF, setSsWarehouseF] = useState("All");
  const [ssLocationF, setSsLocationF] = useState("All");
  const W = sc ? 48 : 190;
  // ─── Fetch companies from Odoo ──────────────────────────────────────────────
  const { data: odooCompanies } = trpc.odoo.companies.useQuery();
  const { data: companyAccessData } = trpc.userMgmt.myCompanyAccess.useQuery();
  const allowedCompanies = useMemo(() => {
    if (!companyAccessData) return [];
    const { allowedCompanyIds } = companyAccessData;
    return (odooCompanies ?? []).filter(c => !allowedCompanyIds.length || allowedCompanyIds.includes(c.id));
  }, [odooCompanies, companyAccessData]);

  // Resolve localStorage company on mount — default to Cairo-PLATFARM
  const companiesResolvedRef = useRef(false);
  useEffect(() => {
    if (companiesResolvedRef.current || !allowedCompanies.length || !companyAccessData) return;
    companiesResolvedRef.current = true;
    const { defaultCompanyId } = companyAccessData;
    const userIsAdmin = companyAccessData.isAdmin || companyAccessData.allowedCompanyIds.length === 0;

    // RESTRICTED USERS: admin-configured default ALWAYS wins
    if (!userIsAdmin) {
      if (defaultCompanyId !== null) {
        const c = allowedCompanies.find(c => c.id === defaultCompanyId);
        if (c) { setCo(String(c.id)); localStorage.setItem("platfarm_company", JSON.stringify({ id: c.id, name: c.name })); return; }
      }
      if (allowedCompanies.length > 0) { setCo(String(allowedCompanies[0].id)); localStorage.setItem("platfarm_company", JSON.stringify({ id: allowedCompanies[0].id, name: allowedCompanies[0].name })); }
      return;
    }

    // ADMIN USERS: respect localStorage, then fallback
    if (defaultCompanyId !== null) {
      const c = allowedCompanies.find(c => c.id === defaultCompanyId);
      if (c && !localStorage.getItem("platfarm_company")) { setCo(String(c.id)); localStorage.setItem("platfarm_company", JSON.stringify({ id: c.id, name: c.name })); return; }
    }
    const saved = localStorage.getItem("platfarm_company");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (typeof p.id === 'number') { const c = allowedCompanies.find(c => c.id === p.id); if (c) { setCo(String(c.id)); return; } }
        const name = typeof p === 'string' ? p : p.name;
        if (name && name !== 'All Companies') { const c = allowedCompanies.find(c => c.name === name); if (c) { setCo(String(c.id)); return; } }
      } catch { /* ignore */ }
    }
    const cairo = allowedCompanies.find((c) => c.name?.toLowerCase().includes("cairo"));
    if (cairo) { setCo(String(cairo.id)); localStorage.setItem("platfarm_company", JSON.stringify({ id: cairo.id, name: cairo.name })); return; }
    if (allowedCompanies.length > 0) { setCo(String(allowedCompanies[0].id)); localStorage.setItem("platfarm_company", JSON.stringify({ id: allowedCompanies[0].id, name: allowedCompanies[0].name })); }
  }, [allowedCompanies, companyAccessData]);
  // If restricted user has "ALL" selected (stale localStorage), reset to first allowed company
  useEffect(() => {
    if (!companyAccessData || !allowedCompanies.length) return;
    const isAdm = companyAccessData.isAdmin || companyAccessData.allowedCompanyIds.length === 0;
    if (!isAdm && co === "ALL") {
      const first = allowedCompanies[0];
      if (first) {
        setCo(String(first.id));
        localStorage.setItem("platfarm_company", JSON.stringify({ id: first.id, name: first.name }));
      }
    }
  }, [companyAccessData, allowedCompanies, co]);

  const setCompany = (val: string) => {
    setCo(val);
    setWhFs(new Set());
    setLocFs(new Set());
    if (val === "ALL") {
      localStorage.setItem("platfarm_company", JSON.stringify({ id: 'ALL', name: 'All Companies' }));
    } else {
      const comp = allowedCompanies.find((c) => String(c.id) === val);
      if (comp) localStorage.setItem("platfarm_company", JSON.stringify({ id: comp.id, name: comp.name }));
    }
  };

  const companyLabel = useMemo(() => {
    if (co === "ALL") return "All Companies";
    const comp = allowedCompanies.find((c) => String(c.id) === co);
    return comp?.name || co;
  }, [co, allowedCompanies]);
  const isCompanyAdmin = !!companyAccessData && (companyAccessData.isAdmin || companyAccessData.allowedCompanyIds.length === 0);

  // ─── Fetch inventory dashboard data ─────────────────────────────────────
  const companyIdNum = co !== "ALL" ? Number(co) : undefined;
  const { data: dashData, isLoading, isError } = trpc.inventory.dashboard.useQuery(
    companyIdNum ? { companyId: companyIdNum } : {},
    { refetchOnWindowFocus: false }
  );

  // ─── Fetch supply split data ─────────────────────────────────────────
  const ssInput = useMemo(() => ({
    ...(companyIdNum ? { companyId: companyIdNum } : {}),
    ...(ssComputedDates.from ? { dateFrom: ssComputedDates.from } : {}),
    ...(ssComputedDates.to ? { dateTo: ssComputedDates.to } : {}),
  }), [companyIdNum, ssComputedDates]);
  const { data: ssData, isLoading: ssLoading } = trpc.inventory.supplySplit.useQuery(
    ssInput,
    { refetchOnWindowFocus: false, enabled: pg === "supply" }
  );

  // ─── Supplier Statement state ──────────────────────────────────────────
  const [stmtSupplierId, setStmtSupplierId] = useState<number | null>(null);
  const [stmtPeriod, setStmtPeriod] = useState<"7d" | "30d" | "90d" | "all" | "custom">("all");
  const [stmtDateFrom, setStmtDateFrom] = useState("");
  const [stmtDateTo, setStmtDateTo] = useState("");
  const stmtComputedDates = useMemo(() => {
    if (stmtPeriod === "custom") return { from: stmtDateFrom, to: stmtDateTo };
    if (stmtPeriod === "all") return { from: "", to: "" };
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    const days = stmtPeriod === "7d" ? 7 : stmtPeriod === "30d" ? 30 : 90;
    const from = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
    return { from, to };
  }, [stmtPeriod, stmtDateFrom, stmtDateTo]);
  const [stmtSearch, setStmtSearch] = useState("");
  const [stmtSupplierSearch, setStmtSupplierSearch] = useState("");
  const [stmtDropdownOpen, setStmtDropdownOpen] = useState(false);

  // Fetch supplier list for dropdown
  const { data: stmtSuppliers } = trpc.inventory.receiptSuppliers.useQuery(
    companyIdNum ? { companyId: companyIdNum } : {},
    { refetchOnWindowFocus: false, enabled: pg === "stmt" }
  );

  // Fetch receipts for selected supplier
  const stmtInput = useMemo(() => ({
    supplierId: stmtSupplierId || 0,
    ...(companyIdNum ? { companyId: companyIdNum } : {}),
    ...(stmtComputedDates.from ? { dateFrom: stmtComputedDates.from } : {}),
    ...(stmtComputedDates.to ? { dateTo: stmtComputedDates.to } : {}),
  }), [stmtSupplierId, companyIdNum, stmtComputedDates]);
  const { data: stmtData, isLoading: stmtLoading } = trpc.inventory.supplierReceipts.useQuery(
    stmtInput,
    { refetchOnWindowFocus: false, enabled: pg === "stmt" && !!stmtSupplierId }
  );

  // Filtered statement rows
  const stmtRows = useMemo(() => {
    if (!stmtData?.rows) return [];
    if (!stmtSearch) return stmtData.rows;
    const s = stmtSearch.toLowerCase();
    return stmtData.rows.filter(r =>
      r.shipmentRef.toLowerCase().includes(s) ||
      r.poNumber.toLowerCase().includes(s) ||
      r.product.toLowerCase().includes(s) ||
      r.warehouse.toLowerCase().includes(s) ||
      r.officer.toLowerCase().includes(s)
    );
  }, [stmtData, stmtSearch]);

  // Selected supplier name
  const stmtSupplierName = useMemo(() => {
    if (!stmtSupplierId || !stmtSuppliers) return "";
    const s = stmtSuppliers.find(s => s.id === stmtSupplierId);
    return s ? s.name.replace(/^\d[\d-]*-/, "").trim() : "";
  }, [stmtSupplierId, stmtSuppliers]);

  // ─── Map API data to UI-compatible shapes ───────────────────────────────

  // Stock quants (Q equivalent)
  const Q = useMemo(() => {
    if (!dashData) return [];
    return dashData.stockItems.map((s) => ({
      id: s.id,
      p: s.productName,
      wh: s.locationName,
      whN: s.warehouseName || s.locationName,
      qty: s.quantity,
      res: s.reservedQuantity,
      u: s.uom.toLowerCase().includes("kg") ? "kg" : s.uom.toLowerCase().includes("unit") ? "pcs" : s.uom.toLowerCase().includes("litre") || s.uom.toLowerCase().includes("liter") ? "L" : s.uom,
      st: s.quantity < 0 ? "neg" : s.reservedQuantity >= s.quantity && s.quantity > 0 ? "full" : s.quantity < 100 && s.quantity > 0 ? "warn" : "ok",
      gr: "—",
      pr: "—",
      or: "—",
      px: s.unitPrice,
      age: 0,
      cat: s.productGroup,
      companyId: s.companyId,
      companyName: s.companyName,
      warehouseId: s.warehouseId,
      value: s.value,
      currency: s.currency || "EGP",
    }));
  }, [dashData]);

  // Exchange rates from API response
  const exRates = useMemo(() => {
    if (!dashData?.exchangeRates) return { EGP_USD: 1 / 51.87, AED_USD: 1 / 3.6725, fetchedAt: "" };
    return dashData.exchangeRates;
  }, [dashData]);

  // Warehouses (WH equivalent)
  const WH = useMemo(() => {
    if (!dashData) return [];
    return dashData.warehouseSummaries.map((w) => ({
      id: w.id,
      name: w.name,
      co: w.companyName,
      wh: w.code,
      pr: w.itemCount,
      kg: w.totalQuantity,
      col: groupColor(Object.keys(w.productGroups).sort((a, b) => (w.productGroups[b] || 0) - (w.productGroups[a] || 0))[0] || "Other"),
      inp: w.code + "/Input",
      out: w.code + "/Output",
      ops: w.itemCount,
      // No fake capacity — real capacity data not available in Odoo
      mx: Object.entries(w.productGroups)
        .filter(([, kg]) => kg > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([p, kg]) => ({ p, kg, c: groupColor(p) })),
      companyId: w.companyId,
      totalReserved: w.totalReserved,
      totalValue: w.totalValue,
      locs: (dashData.warehouseLocations && dashData.warehouseLocations[w.id]) || [],
    }));
  }, [dashData]);

  // Product categories (CAT equivalent)
  const CAT = useMemo(() => {
    if (!dashData) return [];
    return dashData.productGroupSummaries.map((g) => ({
      n: g.name,
      ct: g.itemCount,
      c: groupColor(g.name),
      gr: {} as Record<string, number>,
      totalQty: g.totalQuantity,
      totalReserved: g.totalReserved,
      totalValue: g.totalValue,
      warehouseCount: g.warehouseCount,
    }));
  }, [dashData]);

  // Product color data (PC equivalent)
  const PC = useMemo(() => {
    if (!dashData) return [];
    // Use Q (stock items) to determine which groups have positive stock,
    // since totalQuantity can be negative when partner/vendor locations are included
    const positiveGroups = new Set(Q.filter((q) => q.qty > 0).map((q) => q.cat));
    return dashData.productGroupSummaries
      .filter((g) => positiveGroups.has(g.name))
      .map((g) => ({
        p: g.name,
        c: groupColor(g.name),
        ept: 0,
      }));
  }, [dashData, Q]);

  // Alerts (AL equivalent)
  const AL = useMemo(() => {
    if (!dashData) return [];
    return dashData.alerts.map((a) => ({
      t: a.type === "critical" ? "neg" : "warn",
      title: a.productName,
      d: a.message,
      pri: a.type === "critical" ? "Critical" : "Medium",
    }));
  }, [dashData]);

  // ─── Filtered data (stock type filter applied) ─────────────────────────
  const cQ = useMemo(() => stockTypes.size === 0 ? Q : Q.filter((q) => stockTypes.has(groupToStockType(q.cat))), [Q, stockTypes]);
  // Rebuild warehouse summaries based on filtered quants
  const cW = useMemo(() => {
    return WH.map((w) => {
      const whQ = cQ.filter((q) => q.whN === w.name && q.qty > 0);
      const kg = whQ.reduce((s, q) => s + q.qty, 0);
      const mx = Object.entries(
        whQ.reduce((acc, q) => { acc[q.cat] = (acc[q.cat] || 0) + q.qty; return acc; }, {} as Record<string, number>)
      ).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).map(([p, v]) => ({ p, kg: v, c: groupColor(p) }));
      return { ...w, kg, mx, pr: whQ.length };
    });
  }, [WH, cQ]);
  // Dashboard-filtered quants (respects dashProds + dashWhs + dashLocs)
  const dQ = useMemo(() => {
    let r = cQ;
    if (dashProds.size > 0) r = r.filter((q) => dashProds.has(q.cat));
    if (dashWhs.size > 0) r = r.filter((q) => dashWhs.has(q.whN));
    if (dashLocs.size > 0) r = r.filter((q) => dashLocs.has(q.wh));
    return r;
  }, [cQ, dashProds, dashWhs, dashLocs]);
  // Dashboard quants further filtered by search (for hero KPIs)
  const dsQ = useMemo(() => {
    if (!dashSearch) return dQ;
    const s = dashSearch.toLowerCase();
    return dQ.filter((q) => q.p.toLowerCase().includes(s) || q.cat.toLowerCase().includes(s) || q.whN.toLowerCase().includes(s) || (q.wh && q.wh.toLowerCase().includes(s)));
  }, [dQ, dashSearch]);
  const tK = dsQ.filter((q) => q.qty > 0 && (q.u === "kg" || q.u === "t")).reduce((s, q) => s + q.qty, 0);
  const tR = dsQ.filter((q) => q.res > 0 && (q.u === "kg" || q.u === "t")).reduce((s, q) => s + q.res, 0);
  const tV = dsQ.filter((q) => q.qty > 0 && q.value > 0).reduce((s, q) => s + q.value, 0);
  const neg = dsQ.filter((q) => q.qty < 0);
  const health = Math.max(0, Math.min(100, 100 - neg.length * 15 - dsQ.filter((q) => q.age > 30).length * 5 - dsQ.filter((q) => q.st === "full").length * 10));

  // ─── Locations for selected warehouses (Stock Levels page) ─────────────
  const locationsForWarehouse = useMemo(() => {
    const base = whFs.size === 0 ? cQ : cQ.filter((x) => whFs.has(x.whN));
    return [...new Set(base.map((x) => x.wh))].filter(Boolean).sort();
  }, [cQ, whFs]);

  // ─── Available grades for Grade filter ────────────────────────────────
  const gradesForFilter = useMemo(() => {
    let base = cQ.slice();
    if (whFs.size > 0) base = base.filter((x) => whFs.has(x.whN));
    if (locFs.size > 0) base = base.filter((x) => locFs.has(x.wh));
    if (pCats.size > 0) base = base.filter((x) => pCats.has(x.cat));
    const grades = [...new Set(base.map((x) => extractGrade(x.p)))].sort();
    return grades;
  }, [cQ, whFs, locFs, pCats]);

  // ─── All unique locations for Dashboard filter ────────────────────────
  const dashLocations = useMemo(() => {
    let base = cQ;
    if (dashWhs.size > 0) base = base.filter((q) => dashWhs.has(q.whN));
    return [...new Set(base.filter((q) => q.wh).map((q) => q.wh))].sort();
  }, [cQ, dashWhs]);
  // ─── All unique product groups for Dashboard filter ──────────────────
  const dashProductGroups = useMemo(() => {
    return [...new Set(cQ.filter((q) => q.cat).map((q) => q.cat))].sort();
  }, [cQ]);
  // ─── All unique warehouses for Dashboard filter ───────────────────────
  const dashWarehouses = useMemo(() => {
    let base = cQ;
    if (dashProds.size > 0) base = base.filter((q) => dashProds.has(q.cat));
    return [...new Set(base.filter((q) => q.whN).map((q) => q.whN))].sort();
  }, [cQ, dashProds]);

  let fq = cQ.slice();
  if (sv === "neg") fq = fq.filter((x) => x.qty < 0);
  else if (sv === "res") fq = fq.filter((x) => x.res > 0);
  else if (sv === "avail") fq = fq.filter((x) => x.qty > 0 && x.res < x.qty);
  else if (sv === "aging") fq = fq.filter((x) => x.age >= 20);
  if (whFs.size > 0) fq = fq.filter((x) => whFs.has(x.whN));
  if (locFs.size > 0) fq = fq.filter((x) => locFs.has(x.wh));
  if (pCats.size > 0) fq = fq.filter((x) => pCats.has(x.cat));
  if (gradeFs.size > 0) fq = fq.filter((x) => gradeFs.has(extractGrade(x.p)));
  if (sr && pg === "stock") fq = fq.filter((x) => x.p.toLowerCase().includes(sr.toLowerCase()));
  // Dynamic column sorting
  fq.sort((a, b) => {
    let va: number | string, vb: number | string;
    switch (sortCol) {
      case "p": va = a.p.toLowerCase(); vb = b.p.toLowerCase(); break;
      case "qty": va = a.qty; vb = b.qty; break;
      case "res": va = a.res; vb = b.res; break;
      case "avail": va = a.qty - a.res; vb = b.qty - b.res; break;
      case "value": va = a.value || 0; vb = b.value || 0; break;
      case "px": va = (a.qty - a.res) > 0 && a.value > 0 ? a.value / ((a.u === "kg" ? (a.qty - a.res) / 1000 : (a.qty - a.res))) : 0; vb = (b.qty - b.res) > 0 && b.value > 0 ? b.value / ((b.u === "kg" ? (b.qty - b.res) / 1000 : (b.qty - b.res))) : 0; break;
      default: va = a.qty; vb = b.qty;
    }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  // ─── Stock valuation by product group ───────────────────────────────────
  // pVal stores value split by currency: { EGP: number, AED: number }
  // Uses dsQ (filtered by dashWhs + dashLocs + search) for both kg and value
  const pVal: Record<string, { p: string; c: string; vEGP: number; vAED: number; kg: number; e: number }> = {};
  dsQ.forEach((q) => {
    if (q.qty > 0) {
      if (!pVal[q.cat]) pVal[q.cat] = { p: q.cat, c: groupColor(q.cat), vEGP: 0, vAED: 0, kg: 0, e: 0 };
      pVal[q.cat].kg += q.qty;
      if (q.value > 0) {
        if (q.currency === "AED") pVal[q.cat].vAED += q.value;
        else pVal[q.cat].vEGP += q.value;
      }
    }
  });
  const sV = Object.values(pVal).map((x) => ({
    ...x,
    v: x.vEGP + x.vAED, // combined for sorting/bar widths
    vUSD: x.vEGP * exRates.EGP_USD + x.vAED * exRates.AED_USD,
  })).sort((a, b) => b.vUSD - a.vUSD || b.kg - a.kg);
  const tvP = sV.reduce((s, x) => s + x.v, 0);

  // Per-currency totals across all stock (uses dsQ for dashboard search+location filtering)
  const totalEGP = dsQ.filter((q) => q.currency === "EGP" && q.value > 0).reduce((s, q) => s + q.value, 0);
  const totalAED = dsQ.filter((q) => q.currency === "AED" && q.value > 0).reduce((s, q) => s + q.value, 0);
  const totalUSD = totalEGP * exRates.EGP_USD + totalAED * exRates.AED_USD;

  // Helper: format value with currency symbol
  const fCurr = (v: number, currency: string) => {
    const sym = currency === "AED" ? "AED " : currency === "USD" ? "$ " : "EGP ";
    if (Math.abs(v) >= 1e6) return sym + (v / 1e6).toFixed(2) + "M";
    if (Math.abs(v) >= 1000) return sym + (v / 1000).toFixed(1) + "K";
    return sym + Math.round(v).toLocaleString();
  };
  // Helper: convert value to USD
  const toUSD = (v: number, currency: string) => v * (currency === "AED" ? exRates.AED_USD : exRates.EGP_USD);

  // ─── UI Helpers ─────────────────────────────────────────────────────────
  const bd = (t: string, l: string) => {
    const m: Record<string, { b: string; c: string }> = {
      ok: { b: "#E4EFE6", c: "#2D5A3D" },
      neg: { b: "#FDF0F0", c: "#C94444" },
      warn: { b: "#FDF6EC", c: "#D4960A" },
      full: { b: "#FDF7F3", c: "#C0714A" },
    };
    const s = m[t] || m.ok;
    return (
      <span style={{ display: "inline-flex", padding: "2px 10px", borderRadius: 99, fontSize: 10, fontWeight: 600, background: s.b, color: s.c, whiteSpace: "nowrap" }}>
        {l}
      </span>
    );
  };
  const br = (v: number, mx: number, c?: string, h?: number) => (
    <div style={{ width: "100%", height: h || 5, borderRadius: h || 5, background: "#E4E1DC", overflow: "hidden" }}>
      <div style={{ height: "100%", borderRadius: h || 5, background: c || "#2D5A3D", width: `${mx ? Math.min(Math.abs(v) / mx * 100, 100) : 0}%` }} />
    </div>
  );
  const pl = (l: string, a: boolean, fn: () => void, key?: string) => (
    <button key={key || l} onClick={fn} style={{ padding: "5px 14px", borderRadius: 99, fontSize: 11, fontWeight: a ? 600 : 500, cursor: "pointer", border: a ? "1px solid #2D5A3D" : "1px solid #E4E1DC", background: a ? "#2D5A3D" : "#fff", color: a ? "#fff" : "#64706C", fontFamily: "inherit" }}>
      {l}
    </button>
  );
  const ring = (v: number, tot: number, sz: number, sw: number, c: string) => {
    const r = (sz - sw) / 2;
    const ci = 2 * Math.PI * r;
    const pct = tot ? v / tot : 0;
    return (
      <div style={{ position: "relative", width: sz, height: sz }}>
        <svg width={sz} height={sz} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke="#E4E1DC" strokeWidth={sw} />
          <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke={c} strokeWidth={sw} strokeDasharray={`${pct * ci} ${ci}`} strokeLinecap="round" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "'JetBrains Mono'", fontSize: sz > 50 ? 13 : 10, fontWeight: 700, color: c }}>{Math.round(pct * 100)}%</span>
        </div>
      </div>
    );
  };
  const ageBd = (d: number) => (d >= 30 ? bd("neg", d + "d") : d >= 20 ? bd("warn", d + "d") : bd("ok", d + "d"));

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#F7F6F3", minHeight: "100vh" }}>
      <style>{`
        
        *{margin:0;padding:0;box-sizing:border-box}
        .ab{height:3px;background:linear-gradient(90deg,#2D5A3D,#C0714A)}
        .app-sb-ni{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;transition:background .15s;font-size:12px;font-weight:500;color:#64706C;white-space:nowrap;overflow:hidden;border-right:3px solid transparent}
        .app-sb-ni:hover{background:#F2F7F3}.app-sb-ni.app-sb-act{background:#E4EFE6;color:#2D5A3D;font-weight:700;border-right-color:#2D5A3D}
        .sc{background:#fff;border:1px solid #CDDDD1;border-radius:9px;padding:14px}
        .sl{font-size:9px;font-weight:700;text-transform:uppercase;color:#4A7C59;letter-spacing:.5px;margin-bottom:5px}
        .sv{font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:700;color:#2D5A3D}
        .ss{font-size:10px;color:#95A09C;margin-top:3px}
        .xc{background:#fff;border:1px solid #E4E1DC;border-radius:9px;overflow:hidden;margin-bottom:14px}
        .xh{background:#2D5A3D;padding:10px 16px;display:flex;align-items:center;justify-content:space-between}
        .xh h3{font-size:13px;font-weight:600;color:#fff}
        .ct{font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(255,255,255,.7)}
        .t{width:100%;border-collapse:collapse}
        .t th{font-size:9px;font-weight:700;text-transform:uppercase;color:#4A7C59;padding:7px 10px;text-align:left;border-bottom:1px solid #E4E1DC}
        .t td{font-size:11px;color:#2C3E50;padding:8px 10px;border-bottom:1px solid #F2F0EC}
        .t tr{cursor:pointer}.t tr:hover td{background:#FAFAF8}
        .m{font-family:'JetBrains Mono',monospace}
        .ws{background:#fff;border:1px solid #E4E1DC;border-radius:10px;padding:16px;cursor:pointer;transition:all .2s}
        .ws:hover{border-color:#4A7C59;transform:translateY(-2px);box-shadow:0 6px 20px rgba(27,58,45,.06)}
        .dp{position:fixed;right:0;top:3px;bottom:0;width:340px;background:#fff;border-left:1px solid #E4E1DC;overflow-y:auto;z-index:45;box-shadow:-4px 0 20px rgba(0,0,0,.06)}
        .cb{display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:99px;border:1.5px solid #B8D0BD;background:#F2F7F3;font-size:11px;font-weight:600;color:#2D5A3D;cursor:pointer;font-family:inherit;position:relative}.cb:hover{background:#E4EFE6}
        .cd{position:absolute;top:calc(100% + 6px);right:0;width:360px;background:#fff;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.12);border:1px solid #E4E1DC;overflow:hidden;z-index:200}
        .ci{padding:10px 16px;font-size:12px;color:#2C3E50;cursor:pointer;display:flex;justify-content:space-between}.ci:hover{background:#F2F7F3}.ci.ac{background:#E4EFE6;font-weight:600;color:#2D5A3D}
        .mob-bottom-bar{display:none}
        .mob-overlay{display:none}
        .filter-scroll{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
        @media(max-width:767px){
          .sidebar-desk{display:none!important}
          .mob-bottom-bar{display:flex;position:fixed;bottom:0;left:0;right:0;height:56px;background:#fff;border-top:1px solid #E4E1DC;z-index:60;align-items:center;justify-content:space-around;padding:0 4px}
          .mob-bottom-bar button{display:flex;flex-direction:column;align-items:center;gap:2px;border:none;background:none;font-size:9px;font-weight:500;color:#64706C;cursor:pointer;padding:4px 8px;font-family:inherit}
          .mob-bottom-bar button.a{color:#2D5A3D;font-weight:700}
          .mob-bottom-bar button span.ic{font-size:18px}
          .mob-overlay{display:block;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:55}
          .dp{width:100%!important;left:0!important;top:0!important;bottom:56px!important}
          .cd{width:calc(100vw - 32px)!important;right:-8px!important}
          .filter-scroll{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:4px}
          .filter-scroll::-webkit-scrollbar{display:none}
          .filter-scroll button,.filter-scroll span{white-space:nowrap;flex-shrink:0}
          .skel-kpi{grid-template-columns:repeat(2,1fr)!important}
        }
      `}</style>

      <TopProgressBar show={isLoading} />
      <div className="ab" />

      {/* DETAIL PANEL */}
      {sel && isMob && <div className="mob-overlay" onClick={() => setSel(null)} />}
      {sel && (
        <div className="dp">
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #E4E1DC", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#2C3E50", lineHeight: 1.4, marginBottom: 4 }}>{sel.p}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {bd(sel.st, sel.st === "neg" ? "Negative" : sel.st === "full" ? "Fully Reserved" : sel.st === "warn" ? "Low Stock" : "In Stock")}
                {sel.gr !== "—" && bd("ok", sel.gr)}
                {sel.age > 0 && ageBd(sel.age)}
              </div>
            </div>
            <button style={{ background: "none", border: "none", fontSize: 16, color: "#95A09C", cursor: "pointer" }} onClick={() => setSel(null)}>✕</button>
          </div>
          {sel.qty > 0 && sel.u === "kg" && (
            <div style={{ padding: "12px 18px", borderBottom: "1px solid #E4E1DC", background: "#FAFAF8" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 600 }}>Availability</span>
                <span className="m" style={{ fontSize: 11, color: "#2D5A3D" }}>{Math.round(((sel.qty - sel.res) / sel.qty) * 100)}%</span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: "#E4E1DC", overflow: "hidden", display: "flex" }}>
                <div style={{ height: "100%", background: "#2D5A3D", width: `${((sel.qty - sel.res) / sel.qty) * 100}%` }} />
                <div style={{ height: "100%", background: "#C0714A", width: `${(sel.res / sel.qty) * 100}%` }} />
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 5 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: "#2D5A3D" }}><div style={{ width: 6, height: 6, borderRadius: 2, background: "#2D5A3D" }} />Available</span>
                <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: "#C0714A" }}><div style={{ width: 6, height: 6, borderRadius: 2, background: "#C0714A" }} />Reserved</span>
              </div>
            </div>
          )}
          <div style={{ padding: "4px 0" }}>
            {[
              ["On Hand", sel.qty < 0 ? sel.qty.toLocaleString() + " " + sel.u : fK(sel.qty)],
              ["Reserved", sel.res > 0 ? fK(sel.res) : "None"],
              ["Available", sel.u === "kg" ? fK(sel.qty - sel.res) : (sel.qty - sel.res) + " " + sel.u],
              ["Category", sel.cat],
              ["Warehouse", sel.whN],
              ["Location", sel.wh],
              ["Company", sel.companyName || "—"],
              ["Unit Price", sel.px > 0 ? `${sel.currency || "EGP"} ${sel.px.toFixed(2)}` : "—"],
              ["Value", sel.value > 0 ? `${sel.currency || "EGP"} ${fV(Math.round(sel.value))} (≈ ${fCurr(toUSD(sel.value, sel.currency || "EGP"), "USD")})` : "—"],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 18px", fontSize: 11 }}>
                <span style={{ color: "#64706C" }}>{l}</span>
                <span style={{ color: String(v).includes("-") ? "#C94444" : "#2C3E50", fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "10px 18px", borderTop: "1px solid #E4E1DC" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", marginBottom: 6 }}>Actions</div>
            {[["📦", "Inventory Adjustment"], ["🔄", "Internal Transfer"], ["📊", "Forecast Demand"], ["⚠", "Report Issue"]].map(([ic, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11, color: "#2C3E50" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#F2F7F3")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                {ic} {l}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SIDEBAR (desktop) */}
      <div className="sidebar-desk" style={{ position: "fixed", top: 3, left: 0, bottom: 0, width: W, minWidth: W, background: "#fff", borderRight: "1px solid #E4E1DC", zIndex: 50, transition: "width .2s", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: sc ? "14px 8px" : "14px 16px", cursor: "pointer", borderBottom: "1px solid #E4E1DC", minHeight: 56, display: "flex", alignItems: "center", gap: 8 }} onClick={() => setSc(!sc)}>
          <PlatfarmLogo height={sc ? 24 : 28} treeColor="#1B3A2D" textColor="#D4845F" />
        </div>
        <div style={{ flex: 1, padding: "8px 0" }}>
          <div className="app-sb-ni" onClick={() => setLocation("/")} style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 15 }}>🏠</span>{!sc && <span>Home</span>}
          </div>
          {(["dash", "wh", "stock", "supply", "stmt", "periodic", "transfers"] as const).map((k) => {
            const ic = k === "dash" ? "📊" : k === "stock" ? "📦" : k === "wh" ? "🏭" : k === "supply" ? "🚚" : k === "stmt" ? "📋" : k === "transfers" ? "🔄" : "📝";
            const l = k === "dash" ? "Dashboard" : k === "stock" ? "Stock Levels" : k === "wh" ? "Warehouses" : k === "supply" ? "Supply Split" : k === "stmt" ? "Supply Statement" : k === "transfers" ? "Dakhla-Sokhna Moves" : "Periodic Inventory";
            return (            <div key={k} className={`app-sb-ni ${pg === k ? "app-sb-act" : ""}`} onClick={() => { setPg(k); setSr(""); setDashSearch(""); setSel(null); setSelWh(null); setPCats(k === "stock" ? new Set(["Alfalfa"]) : new Set()); setWhFs(k === "stock" ? new Set(["Main Warehouse Cairo Platform - Sokhna", "Secondary Warehouse Cairo Platform -Dakhla"]) : new Set()); setDashWhs(k === "dash" ? new Set(["Main Warehouse Cairo Platform - Sokhna", "Secondary Warehouse Cairo Platform -Dakhla"]) : new Set()); setDashLocs(new Set()); }}>
              <span style={{ fontSize: 15 }}>{ic}</span>{!sc && <span>{l}</span>}
            </div>
            );
          })}
        </div>
        {!sc && (
          <div style={{ padding: "10px 14px", borderTop: "1px solid #E4E1DC", background: "#FAFAF8" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase" }}>Health</span>
              <span className="m" style={{ fontSize: 9, color: health >= 70 ? "#2D5A3D" : "#D4960A" }}>{health}/100</span>
            </div>
            {br(health, 100, health >= 70 ? "#2D5A3D" : health >= 40 ? "#D4960A" : "#C94444", 4)}
            <div style={{ fontSize: 8, color: "#95A09C", marginTop: 4 }}>
              {isLoading ? "Loading..." : `${neg.length} alerts · ${fK(tR)} reserved`}
            </div>
          </div>
        )}
      </div>

      {/* MOBILE BOTTOM BAR */}
      <div className="mob-bottom-bar">
        <button onClick={() => setLocation("/")}><span className="ic">🏠</span>Home</button>
        {(["dash", "wh", "stock", "supply", "stmt", "periodic", "transfers"] as const).map((k) => {
          const ic = k === "dash" ? "📊" : k === "stock" ? "📦" : k === "wh" ? "🏭" : k === "supply" ? "🚚" : k === "stmt" ? "📋" : k === "transfers" ? "🔄" : "📝";
          const l = k === "dash" ? "Dashboard" : k === "stock" ? "Stock" : k === "wh" ? "Warehouses" : k === "supply" ? "Supply" : k === "stmt" ? "Statement" : k === "transfers" ? "Transfers" : "Periodic";
          return (
            <button key={k} className={pg === k ? "a" : ""} onClick={() => { setPg(k); setSr(""); setDashSearch(""); setSel(null); setSelWh(null); setPCats(k === "stock" ? new Set(["Alfalfa"]) : new Set()); setWhFs(k === "stock" ? new Set(["Main Warehouse Cairo Platform - Sokhna", "Secondary Warehouse Cairo Platform -Dakhla"]) : new Set()); setDashWhs(k === "dash" ? new Set(["Main Warehouse Cairo Platform - Sokhna", "Secondary Warehouse Cairo Platform -Dakhla"]) : new Set()); setDashLocs(new Set()); }}>
              <span className="ic">{ic}</span>{l}
            </button>
          );
        })}
      </div>

      {/* CONTENT */}
      <div style={{ marginLeft: isMob ? 0 : W, marginRight: !isMob && sel ? 340 : 0, transition: "all .2s", minHeight: "calc(100vh - 3px)", paddingBottom: isMob ? 60 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMob ? "10px 12px" : "12px 24px", borderBottom: "1px solid #E4E1DC", background: "#fff", position: "sticky", top: isMob ? 0 : 3, zIndex: 40, gap: 8 }}>
          <div style={{ fontSize: isMob ? 14 : 18, fontWeight: 700, color: "#2C3E50", display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pg === "dash" ? "Inventory" : pg === "stock" ? "Stock Levels" : pg === "supply" ? "Supply Split" : pg === "stmt" ? "Supply Statement" : pg === "periodic" ? "Periodic Inventory" : pg === "transfers" ? "Dakhla-Sokhna Moves" : "Warehouses"}</span>
            <span style={{ padding: "3px 8px", borderRadius: 99, fontSize: isMob ? 8 : 10, fontWeight: 600, background: health >= 70 ? "#E4EFE6" : "#FDF6EC", color: health >= 70 ? "#2D5A3D" : "#D4960A", flexShrink: 0 }}>Health {health}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: isMob ? 6 : 14, flexShrink: 0 }}>
            <div style={{ position: "relative" }}>
              <button className="cb" onClick={() => setCoO(!coO)} style={isMob ? { padding: "4px 8px", fontSize: 9, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : undefined}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4A7C59", flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isMob ? (companyLabel.length > 12 ? companyLabel.slice(0, 12) + "…" : companyLabel) : companyLabel}</span>
                <span style={{ fontSize: 8 }}>▼</span>
              </button>
              {coO && (
                <div className="cd">
                  {isCompanyAdmin && (
                  <div className={`ci ${co === "ALL" ? "ac" : ""}`} onClick={() => { setCompany("ALL"); setCoO(false); }}>
                    <span>All Companies</span>{co === "ALL" && <span>✓</span>}
                  </div>
                  )}
                  {(allowedCompanies ?? []).map((c) => (
                    <div key={c.id} className={`ci ${co === String(c.id) ? "ac" : ""}`} onClick={() => { setCompany(String(c.id)); setCoO(false); }}>
                      <span>{c.name}</span>{co === String(c.id) && <span>✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span className="m" style={{ fontSize: 11, color: "#95A09C" }}>{new Date().toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
        </div>

        {/* Stock Type + Warehouse + Location Selectors */}
        {(pg === "dash" || pg === "wh") && !isLoading && (
          <div style={{ background: "#FAFAF8", borderBottom: "1px solid #E4E1DC", padding: isMob ? "8px 12px" : "10px 24px" }}>
            <div className="filter-scroll" style={{ gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", marginRight: 4, flexShrink: 0 }}>Stock Type</span>
              {STOCK_TYPE_NAMES.map((t) => {
                const isAll = t === "All";
                const active = isAll ? stockTypes.size === 0 : stockTypes.has(t);
                return (
                <button
                  key={t}
                  onClick={() => toggleStockType(t)}
                  style={{
                    padding: "5px 14px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                    border: active ? "none" : "1px solid #E4E1DC",
                    background: active ? (STOCK_TYPES[t] || "#2D5A3D") : "#fff",
                    color: active ? "#fff" : "#64706C",
                    cursor: "pointer", transition: "all .15s", flexShrink: 0, whiteSpace: "nowrap",
                  }}
                >{t}</button>
              );})}
            </div>
            {pg === "dash" && dashProductGroups.length > 0 && (
              <div className="filter-scroll" style={{ gap: 4, marginBottom: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", marginRight: 4, flexShrink: 0 }}>Product</span>
                {pl("All", dashProds.size === 0, () => { setDashProds(new Set()); })}
                {dashProductGroups.map((pg2) => {
                  const count = cQ.filter((q) => q.cat === pg2 && q.qty > 0).length;
                  return pl(pg2 + (count > 0 ? " (" + count + ")" : ""), dashProds.has(pg2), () => toggleSet(setDashProds, pg2));
                })}
              </div>
            )}
            {pg === "dash" && dashWarehouses.length > 0 && (
              <div className="filter-scroll" style={{ gap: 4, marginBottom: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", marginRight: 4, flexShrink: 0 }}>Warehouse</span>
                {pl("All", dashWhs.size === 0, () => { setDashWhs(new Set()); setDashLocs(new Set()); })}
                {dashWarehouses.map((wh) => pl(wh, dashWhs.has(wh), () => { toggleSet(setDashWhs, wh); setDashLocs(new Set()); }))}
              </div>
            )}
            {pg === "dash" && dashLocations.length > 0 && (
              <div className="filter-scroll" style={{ gap: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", marginRight: 4, flexShrink: 0 }}>Location</span>
                {pl("All", dashLocs.size === 0, () => setDashLocs(new Set()))}
                {dashLocations.map((loc) => {
                  const shortLoc = loc.includes("/") ? loc.split("/").pop() || loc : loc;
                  return <span key={loc} title={loc}>{pl(shortLoc, dashLocs.has(loc), () => toggleSet(setDashLocs, loc))}</span>;
                })}
              </div>
            )}
          </div>
        )}

        {/* Loading state */}
        {isLoading && <InventorySkeleton />}
        {!isLoading && isError && <SectionError />}

        {/* ═══ DASHBOARD ═══ */}
        {!isLoading && !isError && pg === "dash" && (
          <div style={{ padding: isMob ? 10 : 18 }}>
            {/* Hero */}
            <div style={{ background: "linear-gradient(135deg,#1B3A2D 0%,#2D5A3D 60%,#4A7C59 100%)", borderRadius: 12, padding: isMob ? "16px 14px" : "24px 28px", marginBottom: 16, color: "#fff" }}>
              <div style={{ display: "flex", flexDirection: isMob ? "column" : "row", alignItems: isMob ? "stretch" : "center", justifyContent: "space-between", marginBottom: 10, gap: isMob ? 8 : 0 }}>
                <div style={{ fontSize: isMob ? 9 : 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, opacity: 0.6 }}>TOTAL INVENTORY ON HAND{dashWhs.size > 0 || dashLocs.size > 0 ? " @ " + (dashLocs.size > 0 ? [...dashLocs].map(l => l.includes("/") ? l.split("/").pop() : l).join(", ") : [...dashWhs].join(", ")) : ""}</div>
                <div style={{ position: "relative", width: isMob ? "100%" : 280 }}>
                  <input
                    value={dashSearch}
                    onChange={(e) => setDashSearch(e.target.value)}
                    placeholder="Search products, warehouses..."
                    style={{
                      width: "100%", height: 32, padding: "0 12px 0 32px",
                      border: "1px solid rgba(255,255,255,.25)", borderRadius: 8,
                      background: "rgba(255,255,255,.1)", backdropFilter: "blur(4px)",
                      fontFamily: "inherit", fontSize: 12, color: "#fff",
                      outline: "none", transition: "all .2s",
                    }}
                    onFocus={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.18)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.4)"; }}
                    onBlur={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.1)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.25)"; }}
                  />
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.5 }}>🔍</span>
                  {dashSearch && (
                    <button
                      onClick={() => setDashSearch("")}
                      style={{
                        position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                        background: "rgba(255,255,255,.2)", border: "none", borderRadius: "50%",
                        width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, color: "#fff", cursor: "pointer", lineHeight: 1,
                      }}
                    >✕</button>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: isMob ? "column" : "row", alignItems: isMob ? "flex-start" : "baseline", gap: isMob ? 8 : 16, marginBottom: 16 }}>
                <span style={{ fontFamily: "'JetBrains Mono'", fontSize: isMob ? 32 : 42, fontWeight: 700 }}>{fK(tK)}</span>
                <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr 1fr" : "auto auto auto", gap: isMob ? 8 : 16 }}>
                  <div><div style={{ fontSize: 9, opacity: 0.5 }}>RESERVED</div><div style={{ fontFamily: "'JetBrains Mono'", fontSize: isMob ? 14 : 18, fontWeight: 600, color: "#F5DDB8" }}>{fK(tR)}</div></div>
                  <div><div style={{ fontSize: 9, opacity: 0.5 }}>AVAILABLE</div><div style={{ fontFamily: "'JetBrains Mono'", fontSize: isMob ? 14 : 18, fontWeight: 600 }}>{fK(tK - tR)}</div></div>
                  <div style={isMob ? { gridColumn: "1 / -1" } : undefined}>
                    <div style={{ fontSize: 9, opacity: 0.5 }}>EST. VALUE (USD)</div>
                    <div style={{ fontFamily: "'JetBrains Mono'", fontSize: isMob ? 14 : 18, fontWeight: 600, color: "#F5DDB8" }}>$ {fV(Math.round(totalUSD))}</div>
                    <div style={{ fontSize: 9, opacity: 0.55, marginTop: 2 }}>
                      {totalEGP > 0 && <span>EGP {fV(Math.round(totalEGP))}</span>}
                      {totalEGP > 0 && totalAED > 0 && <span style={{ opacity: 0.5 }}> · </span>}
                      {totalAED > 0 && <span>AED {fV(Math.round(totalAED))}</span>}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ height: 24, borderRadius: 6, overflow: "hidden", display: "flex", background: "rgba(255,255,255,.15)", marginBottom: 8 }}>
                {sV.map((x, i) => (
                  <div key={i} title={x.p + ": " + fK(x.kg)} style={{ height: "100%", background: x.c === "#2D5A3D" ? "#7FBF96" : x.c, width: `${tK > 0 ? (x.kg / tK) * 100 : 0}%`, opacity: 0.9 }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {sV.filter((x) => !dashSearch || x.p.toLowerCase().includes(dashSearch.toLowerCase())).map((x, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }} onClick={() => { setPCats(new Set([x.p])); setPg("stock"); }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: x.c === "#2D5A3D" ? "#7FBF96" : x.c }} />
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{x.p}</span>
                    <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 11, opacity: 0.7 }}>{fK(x.kg)}</span>
                    <span style={{ fontSize: 9, opacity: 0.4 }}>{tK > 0 ? Math.round((x.kg / tK) * 100) : 0}%</span>
                  </div>
                ))}
              </div>
              {dashSearch && (
                <div style={{ marginTop: 8, fontSize: 11, opacity: 0.6, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>Filtering by: "{dashSearch}"</span>
                  <span style={{ fontSize: 10, opacity: 0.5 }}>·</span>
                  <span style={{ cursor: "pointer", textDecoration: "underline", opacity: 0.8 }} onClick={() => setDashSearch("")}>Clear</span>
                </div>
              )}
            </div>

            {/* What we have — by product */}
            <div className="xc" style={{ marginBottom: 16 }}>
              <div className="xh"><h3>📦 What We Have — By Product{dashWhs.size > 0 || dashLocs.size > 0 ? " @ " + (dashLocs.size > 0 ? [...dashLocs].map(l => l.includes("/") ? l.split("/").pop() : l).join(", ") : [...dashWhs].join(", ")) : ""}</h3><span className="ct">{dashSearch ? dQ.filter((q) => q.qty > 0 && (q.p.toLowerCase().includes(dashSearch.toLowerCase()) || q.cat.toLowerCase().includes(dashSearch.toLowerCase()) || q.whN.toLowerCase().includes(dashSearch.toLowerCase()) || (q.wh && q.wh.toLowerCase().includes(dashSearch.toLowerCase())))).length + " matching" : dQ.filter((q) => q.qty > 0).length + " items"}</span></div>
              <div style={{ padding: 16 }}>
                {PC.filter((pc) => {
                  if (dashSearch) {
                    const dsL = dashSearch.toLowerCase();
                    return dQ.some((q) => q.cat === pc.p && q.qty > 0 && (q.p.toLowerCase().includes(dsL) || q.cat.toLowerCase().includes(dsL) || q.whN.toLowerCase().includes(dsL) || (q.wh && q.wh.toLowerCase().includes(dsL))));
                  }
                  return dQ.some((q) => q.cat === pc.p && q.qty > 0);
                }).map((pc) => {
                  const items = dashSearch
                    ? dQ.filter((q) => q.cat === pc.p && q.qty > 0 && (q.p.toLowerCase().includes(dashSearch.toLowerCase()) || q.cat.toLowerCase().includes(dashSearch.toLowerCase()) || q.whN.toLowerCase().includes(dashSearch.toLowerCase()) || (q.wh && q.wh.toLowerCase().includes(dashSearch.toLowerCase()))))
                    : dQ.filter((q) => q.cat === pc.p && q.qty > 0);
                  const totP = items.reduce((s, q) => s + q.qty, 0);
                  const resP = items.reduce((s, q) => s + q.res, 0);
                  const valP = items.reduce((s, q) => s + (q.value || 0), 0);
                  if (items.length === 0) return null;
                  return (
                    <div key={pc.p} style={{ marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid #F2F0EC" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => { setPCats(new Set([pc.p])); setWhFs(new Set()); setLocFs(new Set()); setPg("stock"); setSel(null); }} onMouseEnter={(e) => { (e.currentTarget.querySelector(".prod-name") as HTMLElement)?.style && ((e.currentTarget.querySelector(".prod-name") as HTMLElement).style.textDecoration = "underline"); }} onMouseLeave={(e) => { (e.currentTarget.querySelector(".prod-name") as HTMLElement)?.style && ((e.currentTarget.querySelector(".prod-name") as HTMLElement).style.textDecoration = "none"); }}>
                          <div style={{ width: 10, height: 28, borderRadius: 3, background: pc.c }} />
                          <div>
                            <div className="prod-name" style={{ fontSize: 16, fontWeight: 700, color: "#2C3E50" }}>{pc.p} <span style={{ fontSize: 10, color: "#4A7C59", fontWeight: 400 }}>→ View in Stock Levels</span></div>
                            <div style={{ fontSize: 10, color: "#95A09C" }}>{items.length} items · {[...new Set(items.map((q) => q.whN))].length} warehouses</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 20, alignItems: "baseline" }}>
                          <div style={{ textAlign: "right" }}><div style={{ fontSize: 9, color: "#95A09C" }}>ON HAND</div><div className="m" style={{ fontSize: 20, color: "#2D5A3D" }}>{fK(totP)}</div></div>
                          <div style={{ textAlign: "right" }}><div style={{ fontSize: 9, color: "#95A09C" }}>RESERVED</div><div className="m" style={{ fontSize: 14, color: resP > 0 ? "#C0714A" : "#B0BAB6" }}>{resP > 0 ? fK(resP) : "—"}</div></div>
                          <div style={{ textAlign: "right" }}><div style={{ fontSize: 9, color: "#95A09C" }}>VALUE</div><div className="m" style={{ fontSize: 14, color: "#2C3E50" }}>{fV(Math.round(valP))}</div></div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 8 }}>
                        {items.sort((a, b) => b.qty - a.qty).map((q) => {
                          const av = q.qty - q.res;
                          const pct = q.qty > 0 ? Math.round((av / q.qty) * 100) : 0;
                          return (
                            <div key={q.id} style={{ padding: "10px 12px", background: "#FAFAF8", borderRadius: 7, border: "1px solid #E4E1DC", cursor: "pointer", transition: "all .15s" }} onClick={() => { setPCats(new Set([q.cat])); setSr(q.p); setWhFs(new Set()); setLocFs(new Set()); setSel(null); setPg("stock"); }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#4A7C59"; e.currentTarget.style.background = "#F2F7F3"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E4E1DC"; e.currentTarget.style.background = "#FAFAF8"; }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: "#2C3E50", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={q.p}>{q.p}</div>
                                <div className="m" style={{ fontSize: 14, color: "#2D5A3D", flexShrink: 0 }}>{fK(q.qty)}</div>
                              </div>
                              <div style={{ height: 6, borderRadius: 3, background: "#E4E1DC", overflow: "hidden", display: "flex", marginBottom: 4 }}>
                                <div style={{ height: "100%", background: "#2D5A3D", width: `${pct}%` }} />{q.res > 0 && <div style={{ height: "100%", background: "#C0714A", width: `${100 - pct}%` }} />}
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 9, color: "#64706C" }}>{q.whN}</span>
                                <div style={{ display: "flex", gap: 8 }}>
                                  {q.res > 0 && <span style={{ fontSize: 9, color: "#C0714A" }}>{fK(q.res)} rsv</span>}
                                  <span style={{ fontSize: 9, color: pct >= 50 ? "#2D5A3D" : pct >= 20 ? "#D4960A" : "#C94444" }}>{pct}% avail</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {dashSearch && PC.filter((pc) => {
                  const dsL = dashSearch.toLowerCase();
                  return dQ.some((q) => q.cat === pc.p && q.qty > 0 && (q.p.toLowerCase().includes(dsL) || q.cat.toLowerCase().includes(dsL) || q.whN.toLowerCase().includes(dsL) || (q.wh && q.wh.toLowerCase().includes(dsL))));
                }).length === 0 && (
                  <div style={{ textAlign: "center", padding: "32px 16px" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#2C3E50", marginBottom: 4 }}>No products match "{dashSearch}"</div>
                    <div style={{ fontSize: 12, color: "#95A09C", marginBottom: 12 }}>Try a different search term or clear the filter</div>
                    <button onClick={() => setDashSearch("")} style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid #E4E1DC", background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "#2D5A3D" }}>Clear Search</button>
                  </div>
                )}
              </div>
            </div>

            {/* Alerts */}
            {AL.length > 0 && (
              <div style={{ marginBottom: 14, borderRadius: 9, border: "1px solid " + (neg.length > 0 ? "#F5C4C4" : "#F5DDB8"), background: neg.length > 0 ? "#FDF0F0" : "#FDF6EC", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", cursor: "pointer" }} onClick={() => setAlO(!alO)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 14 }}>{neg.length > 0 ? "🔴" : "🟡"}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: neg.length > 0 ? "#C94444" : "#D4960A" }}>{AL.length} Alerts</span>
                    <span style={{ fontSize: 11, color: "#64706C" }}>— {AL.filter((a) => a.t === "neg").length} critical</span>
                  </div>
                  <span style={{ fontSize: 10, color: "#95A09C" }}>{alO ? "Hide ▲" : "Show ▼"}</span>
                </div>
                {alO && (
                  <div style={{ borderTop: "1px solid " + (neg.length > 0 ? "#F5C4C4" : "#F5DDB8"), background: "#fff" }}>
                    {AL.map((a, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, padding: "10px 16px", borderBottom: i < AL.length - 1 ? "1px solid #F2F0EC" : "none" }}>
                        <span style={{ fontSize: 11 }}>{a.t === "neg" ? "🔴" : "🟡"}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#2C3E50" }}>{a.title}</span>
                            {bd(a.t === "neg" ? "neg" : "warn", a.pri)}
                          </div>
                          <div style={{ fontSize: 9, color: "#64706C", marginTop: 2 }}>{a.d}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Where + Worth */}
            <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "1fr 1fr", gap: 14 }}>
              <div className="xc">
                <div className="xh"><h3>📍 Stock By Warehouse</h3></div>
                <div style={{ padding: 14 }}>
                  {(()=>{
                    const s = dashSearch?.toLowerCase() || "";
                    // Build warehouse items from dQ (respects dashWhs + dashLocs filters)
                    const whNames = [...new Set(dQ.filter((q) => q.whN).map((q) => q.whN))];
                    const whItems = whNames.map((whName) => {
                      let whQuants = dQ.filter((q) => q.whN === whName && q.qty > 0);
                      if (s) whQuants = whQuants.filter((q) => q.p.toLowerCase().includes(s) || q.cat.toLowerCase().includes(s) || (q.wh && q.wh.toLowerCase().includes(s)));
                      const kg = whQuants.reduce((sum, q) => sum + q.qty, 0);
                      const mx = Object.entries(
                        whQuants.reduce((acc, q) => { acc[q.cat] = (acc[q.cat] || 0) + q.qty; return acc; }, {} as Record<string, number>)
                      ).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).map(([p, v]) => ({ p, kg: v, c: groupColor(p) }));
                      const whData = WH.find((w) => w.name === whName);
                      return { id: whData?.id || whName, name: whName, wh: whData?.wh || "", co: whData?.co || "", locs: whData?.locs || [], kg, mx, pr: whQuants.length };
                    }).filter((x) => {
                      if (!s) return true;
                      return x.kg > 0 || x.name.toLowerCase().includes(s) || x.wh.toLowerCase().includes(s) || x.co.toLowerCase().includes(s) || (x.locs || []).some((l: string) => l.toLowerCase().includes(s));
                    }).sort((a, b) => b.kg - a.kg);
                    return whItems.map((x) => (
                    <div key={x.id} style={{ marginBottom: 14, cursor: "pointer" }} onClick={() => { setPg("stock"); setWhFs(new Set([x.name])); }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#2C3E50" }}>{x.name}</span>
                        <span className="m" style={{ fontSize: 12, color: x.kg > 0 ? "#2D5A3D" : "#B0BAB6" }}>{x.kg > 0 ? fK(x.kg) : "Empty"}</span>
                      </div>
                      <div style={{ height: 14, borderRadius: 3, background: "#E4E1DC", overflow: "hidden", display: "flex" }}>
                        {x.mx.map((m, i) => (
                          <div key={i} title={m.p + ": " + fK(m.kg)} style={{ height: "100%", background: m.c, width: `${x.kg > 0 ? (m.kg / x.kg) * 100 : 0}%` }} />
                        ))}
                      </div>
                      {x.mx.length > 0 ? (
                      <div style={{ display: "flex", gap: 5, marginTop: 3, flexWrap: "wrap" }}>
                        {x.mx.map((m, i) => (
                          <span key={i} style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 7, color: "#64706C" }}>
                            <div style={{ width: 5, height: 5, borderRadius: 1, background: m.c }} />{m.p} {fK(m.kg)}
                          </span>
                        ))}
                      </div>
                      ) : (
                      <div style={{ marginTop: 3, fontSize: 8, color: "#B0BAB6", fontStyle: "italic" }}>No stock items</div>
                      )}
                    </div>
                  ))})()}
                  <div style={{ paddingTop: 8, borderTop: "1px solid #E4E1DC" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {PC.filter((pc) => dsQ.some((q) => q.cat === pc.p && q.qty > 0)).map((pc) => (
                        <span key={pc.p} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: "#2C3E50" }}>
                          <div style={{ width: 7, height: 7, borderRadius: 2, background: pc.c }} />{pc.p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="xc">
                <div className="xh" style={{ background: "#1B3A2D" }}>
                  <h3>💰 Stock Valuation</h3>
                  <div style={{ textAlign: "right" }}>
                    <div className="ct" style={{ fontSize: 12, fontWeight: 700, color: "#F5DDB8" }}>$ {fV(Math.round(totalUSD))} USD</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,.45)", marginTop: 1 }}>
                      {totalEGP > 0 && <span>EGP {fV(Math.round(totalEGP))}</span>}
                      {totalEGP > 0 && totalAED > 0 && <span> · </span>}
                      {totalAED > 0 && <span>AED {fV(Math.round(totalAED))}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ padding: 14 }}>
                  {/* Exchange rate info */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, padding: "6px 10px", background: "#F2F7F3", borderRadius: 6, border: "1px solid #CDDDD1", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 9, color: "#4A7C59", fontWeight: 600 }}>LIVE RATES</span>
                    <span style={{ fontSize: 9, color: "#64706C" }}>1 USD = EGP {(1 / exRates.EGP_USD).toFixed(2)}</span>
                    <span style={{ fontSize: 9, color: "#64706C" }}>·</span>
                    <span style={{ fontSize: 9, color: "#64706C" }}>1 USD = AED {(1 / exRates.AED_USD).toFixed(4)}</span>
                    {exRates.fetchedAt && <span style={{ fontSize: 8, color: "#95A09C", marginLeft: "auto" }}>Updated {new Date(exRates.fetchedAt).toLocaleTimeString()}</span>}
                  </div>
                  <div style={{ height: 16, borderRadius: 4, background: "#E4E1DC", overflow: "hidden", display: "flex", marginBottom: 4 }}>
                    {sV.map((x, i) => (
                      <div key={i} title={x.p + ": " + fCurr(x.vUSD, "USD")} style={{ height: "100%", background: x.c, width: `${tvP ? (x.v / tvP) * 100 : 0}%` }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
                    {sV.map((x, i) => (
                      <span key={i} style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 8, color: "#64706C" }}>
                        <div style={{ width: 5, height: 5, borderRadius: 1, background: x.c }} />{x.p} {tvP ? Math.round((x.v / tvP) * 100) : 0}%
                      </span>
                    ))}
                  </div>
                  {sV.filter((x) => x.v > 0 && (!dashSearch || x.p.toLowerCase().includes(dashSearch.toLowerCase()))).map((x) => (
                    <div key={x.p} style={{ marginBottom: 10, cursor: "pointer" }} onClick={() => { setPCats(new Set([x.p])); setWhFs(new Set()); setLocFs(new Set()); setSel(null); setPg("stock"); }} onMouseEnter={(e) => (e.currentTarget.style.background = "#F2F7F3")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600 }}>
                          <div style={{ width: 7, height: 7, borderRadius: 2, background: x.c }} />{x.p}
                        </span>
                        <div style={{ textAlign: "right" }}>
                          <div className="m" style={{ fontSize: 11, color: "#2D5A3D" }}>$ {fV(Math.round(x.vUSD))}</div>
                          <div style={{ fontSize: 8, color: "#95A09C" }}>
                            {x.vEGP > 0 && <span>EGP {fV(Math.round(x.vEGP))}</span>}
                            {x.vEGP > 0 && x.vAED > 0 && <span> · </span>}
                            {x.vAED > 0 && <span>AED {fV(Math.round(x.vAED))}</span>}
                          </div>
                        </div>
                      </div>
                      {br(x.vUSD, sV[0] ? sV[0].vUSD : 1, x.c, 5)}
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                        <span style={{ fontSize: 8, color: "#95A09C" }}>{fK(x.kg)}</span>
                      </div>
                    </div>
                  ))}
                  {/* Grand total row */}
                  {(() => {
                    const visRows = sV.filter((x) => x.v > 0 && (!dashSearch || x.p.toLowerCase().includes(dashSearch.toLowerCase())));
                    if (visRows.length < 2) return null;
                    const gtUSD = visRows.reduce((s, x) => s + x.vUSD, 0);
                    const gtEGP = visRows.reduce((s, x) => s + x.vEGP, 0);
                    const gtAED = visRows.reduce((s, x) => s + x.vAED, 0);
                    const gtKg = visRows.reduce((s, x) => s + x.kg, 0);
                    return (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "2px solid #CDDDD1", background: "#F2F7F3", borderRadius: 6, padding: "8px 10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#2D5A3D" }}>GRAND TOTAL ({visRows.length} groups)</span>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#2D5A3D" }}>$ {fV(Math.round(gtUSD))} USD</div>
                            <div style={{ fontSize: 9, color: "#64706C", marginTop: 1 }}>
                              {gtEGP > 0 && <span style={{ color: "#8B5E3C" }}>EGP {fV(Math.round(gtEGP))}</span>}
                              {gtEGP > 0 && gtAED > 0 && <span style={{ color: "#64706C" }}> · </span>}
                              {gtAED > 0 && <span style={{ color: "#2563EB" }}>AED {fV(Math.round(gtAED))}</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: 9, color: "#95A09C", marginTop: 4 }}>{fK(gtKg)} total stock</div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ STOCK LEVELS ═══ */}
        {!isLoading && !isError && pg === "stock" && (
          <div style={{ padding: isMob ? 10 : 18 }}>
            <div style={{ display: "flex", flexDirection: isMob ? "column" : "row", justifyContent: "space-between", alignItems: isMob ? "stretch" : "center", marginBottom: 10, gap: isMob ? 8 : 0 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input value={sr} onChange={(e) => setSr(e.target.value)} placeholder="Search products..." style={{ width: isMob ? "100%" : 220, height: 34, padding: "0 12px", border: "1px solid #E4E1DC", borderRadius: 7, fontFamily: "inherit", fontSize: 12, outline: "none" }} />
              </div>
              <div className="filter-scroll" style={{ gap: 4 }}>
                {[["all", "All"], ["neg", "Negative"], ["res", "Reserved"], ["avail", "Available"]].map(([k, l]) => pl(l, sv === k, () => setSv(k)))}
              </div>
            </div>
            {/* Stock type filter */}
            <div className="filter-scroll" style={{ gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", marginRight: 4, flexShrink: 0 }}>Stock Type</span>
              {STOCK_TYPE_NAMES.map((t) => {
                const isAll = t === "All";
                const active = isAll ? stockTypes.size === 0 : stockTypes.has(t);
                return (
                <button
                  key={t}
                  onClick={() => { toggleStockType(t); setPCats(new Set()); setLocFs(new Set()); setGradeFs(new Set()); }}
                  style={{
                    padding: "5px 14px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                    border: active ? "none" : "1px solid #E4E1DC",
                    background: active ? (STOCK_TYPES[t] || "#2D5A3D") : "#fff",
                    color: active ? "#fff" : "#64706C",
                    cursor: "pointer", transition: "all .15s",
                  }}
                >{t}</button>
              );})}
            </div>
            {/* Product filter (multi-select) */}
            <div className="filter-scroll" style={{ gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", marginRight: 4, flexShrink: 0 }}>Product</span>
              {pl("All" + (pCats.size === 0 ? "" : ""), pCats.size === 0, () => togglePCat("All"))}
              {CAT.filter((c) => stockTypes.size === 0 || stockTypes.has(groupToStockType(c.n))).map((c) => {
                const count = cQ.filter((x) => x.cat === c.n).length;
                return pl(c.n + " (" + count + ")", pCats.has(c.n), () => togglePCat(c.n));
              })}
            </div>
            {/* Warehouse filter (multi-select) */}
            <div className="filter-scroll" style={{ gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", marginRight: 4, flexShrink: 0 }}>Warehouse</span>
              {pl("All", whFs.size === 0, () => { setWhFs(new Set()); setLocFs(new Set()); })}
              {cW.map((w) => pl(w.name + (w.kg > 0 ? "" : " (empty)"), whFs.has(w.name), () => { toggleSet(setWhFs, w.name); setLocFs(new Set()); }, `wh-${w.id}`))}
            </div>
            {/* Location filter (multi-select) */}
            <div className="filter-scroll" style={{ gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", marginRight: 4, flexShrink: 0 }}>Location</span>
              {pl("All", locFs.size === 0, () => setLocFs(new Set()))}
              {locationsForWarehouse.map((loc) => pl(loc, locFs.has(loc), () => toggleSet(setLocFs, loc)))}
            </div>
            {/* Grade filter (multi-select) */}
            {gradesForFilter.length > 1 && (
            <div className="filter-scroll" style={{ gap: 4, marginBottom: 14 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", marginRight: 4, flexShrink: 0 }}>Grade</span>
              {pl("All", gradeFs.size === 0, () => setGradeFs(new Set()))}
              {gradesForFilter.map((g) => {
                const count = cQ.filter((x) => extractGrade(x.p) === g && (pCats.size === 0 || pCats.has(x.cat)) && (whFs.size === 0 || whFs.has(x.whN)) && (locFs.size === 0 || locFs.has(x.wh))).length;
                return pl(g + " (" + count + ")", gradeFs.has(g), () => toggleSet(setGradeFs, g));
              })}
            </div>
            )}
            {neg.length > 0 && sv !== "avail" && (
              <div style={{ padding: 10, background: "#FDF0F0", borderRadius: 8, border: "1px solid #F5C4C4", marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
                <span>🔴</span><span style={{ fontSize: 12, fontWeight: 700, color: "#C94444" }}>{neg.length} negative stock — investigate immediately</span>
              </div>
            )}
            <div className="xc">
              <div className="xh"><h3>📦 Stock Quants</h3><span className="ct">{fq.length}</span></div>
              <div style={{ overflowX: isMob ? "auto" : "visible", WebkitOverflowScrolling: "touch" }}>
              <table className="t" style={isMob ? { minWidth: 700 } : undefined}>
                <thead>
                  <tr>
                    {([
                      { key: "p", label: "Product", sortable: true },
                      { key: "", label: "Grade", sortable: false },
                      { key: "", label: "Category", sortable: false },
                      { key: "", label: "Warehouse / Location", sortable: false },
                      { key: "qty", label: "On Hand", sortable: true },
                      { key: "res", label: "Reserved", sortable: true },
                      { key: "avail", label: "Available", sortable: true },
                      { key: "", label: "Avail %", sortable: false, style: { width: 80 } },
                      { key: "value", label: "Value", sortable: true },
                      { key: "px", label: "Cost/Ton", sortable: true },
                      { key: "", label: "Status", sortable: false },
                    ] as const).map((col, i) => (
                      <th
                        key={i}
                        style={{
                          ...(col.style || {}),
                          cursor: col.sortable ? "pointer" : "default",
                          userSelect: col.sortable ? "none" : undefined,
                          whiteSpace: "nowrap",
                        }}
                        onClick={col.sortable ? () => toggleSort(col.key as any) : undefined}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                          {col.label}
                          {col.sortable && sortCol === col.key && (
                            <span style={{ fontSize: 8, opacity: 0.7, lineHeight: 1 }}>{sortDir === "asc" ? "▲" : "▼"}</span>
                          )}
                          {col.sortable && sortCol !== col.key && (
                            <span style={{ fontSize: 8, opacity: 0.25, lineHeight: 1 }}>⇅</span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fq.map((q) => {
                    const av = q.qty - q.res;
                    const pct = q.qty > 0 ? Math.round((av / q.qty) * 100) : 0;
                    return (
                      <tr key={q.id} onClick={() => setSel(q)} style={{ background: sel && sel.id === q.id ? "#E4EFE6" : "" }}>
                        <td style={{ fontWeight: 500, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={q.p}>{q.p}</td>
                        <td>{(() => { const g = extractGrade(q.p); const gc = gradeColor(g); return <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: gc.bg, color: gc.text }}>{g}</span>; })()}</td>
                        <td><span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: groupColor(q.cat) + "15", color: groupColor(q.cat) }}>{q.cat}</span></td>
                        <td style={{ fontSize: 10, color: "#64706C", maxWidth: 220 }}>
                          <div style={{ fontWeight: 500, color: "#2C3E50", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={q.whN}>{q.whN}</div>
                          {q.wh && q.wh !== q.whN && (
                            <div style={{ fontSize: 9, color: "#95A09C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }} title={q.wh}>{q.wh}</div>
                          )}
                        </td>
                        <td className="m" style={{ color: q.qty < 0 ? "#C94444" : "#2D5A3D" }}>{q.qty < 0 ? q.qty.toLocaleString() : q.u === "kg" ? fK(q.qty) : q.qty + " " + q.u}</td>
                        <td className="m" style={{ color: q.res > 0 ? "#C0714A" : "#B0BAB6" }}>{q.res > 0 ? (q.u === "kg" ? fK(q.res) : q.res) : "—"}</td>
                        <td className="m" style={{ color: av <= 0 ? "#C94444" : "#2D5A3D" }}>{q.u === "kg" ? fK(av) : av + " " + q.u}</td>
                        <td>
                          {q.qty > 0 && q.u === "kg" ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              {br(av, q.qty, pct > 50 ? "#2D5A3D" : pct > 20 ? "#D4960A" : "#C94444", 4)}
                              <span style={{ fontSize: 9, color: "#64706C", minWidth: 20 }}>{pct}%</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 9, color: "#B0BAB6" }}>—</span>
                          )}
                        </td>
                        <td className="m" style={{ fontSize: 10, color: q.value > 0 ? "#2C3E50" : "#B0BAB6" }}>
                          {q.value > 0 ? (
                            <span title={`≈ $ ${(toUSD(q.value, q.currency) / 1000).toFixed(1)}K USD`}>
                              <span style={{ fontSize: 9, fontWeight: 700, color: q.currency === "AED" ? "#1E6B9B" : "#7B3F00", marginRight: 2 }}>{q.currency}</span>
                              {fV(Math.round(q.value))}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="m" style={{ fontSize: 10, color: q.value > 0 && q.qty > q.res ? "#2C3E50" : "#B0BAB6" }}>
                          {(() => { const av = q.qty - q.res; const avTons = q.u === "kg" ? av / 1000 : av; const costPerTon = avTons > 0 && q.value > 0 ? q.value / avTons : 0; return costPerTon > 0 ? (<span><span style={{ fontSize: 9, fontWeight: 700, color: q.currency === "AED" ? "#1E6B9B" : "#7B3F00", marginRight: 2 }}>{q.currency}</span>{fV(Math.round(costPerTon))}</span>) : "—"; })()}
                        </td>
                        <td>{bd(q.st, q.st === "neg" ? "Neg" : q.st === "full" ? "Rsv" : q.st === "warn" ? "Low" : "OK")}</td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  {fq.length > 0 && (() => {
                    const totQty = fq.reduce((s, q) => s + q.qty, 0);
                    const totRes = fq.reduce((s, q) => s + q.res, 0);
                    const totAv = totQty - totRes;
                    const totVal = fq.reduce((s, q) => s + (q.value || 0), 0);
                    const totValUsd = fq.reduce((s, q) => s + (q.valueUsd || 0), 0);
                    const hasCur = fq.some(q => q.currency);
                    const currencies = [...new Set(fq.map(q => q.currency).filter(Boolean))];
                    const multiCur = currencies.length > 1;
                    return (
                      <tr style={{ background: "#F2F7F3", borderTop: "2px solid #CDDDD1", fontWeight: 700 }}>
                        <td style={{ fontSize: 11, color: "#2D5A3D", fontWeight: 700 }}>TOTAL ({fq.length} items)</td>
                        <td />
                        <td />
                        <td />
                        <td className="m" style={{ color: totQty < 0 ? "#C94444" : "#2D5A3D", fontSize: 12 }}>{fK(totQty)}</td>
                        <td className="m" style={{ color: totRes > 0 ? "#C0714A" : "#B0BAB6", fontSize: 12 }}>{totRes > 0 ? fK(totRes) : "—"}</td>
                        <td className="m" style={{ color: totAv < 0 ? "#C94444" : "#2D5A3D", fontSize: 12 }}>{fK(totAv)}</td>
                        <td />
                        <td style={{ fontSize: 11 }}>
                          {totVal > 0 ? (
                            <div>
                              {multiCur ? (
                                currencies.map(cur => {
                                  const cv = fq.filter(q => q.currency === cur).reduce((s, q) => s + (q.value || 0), 0);
                                  return cv > 0 ? <div key={cur} style={{ color: cur === "EGP" ? "#8B5E3C" : "#2563EB", fontWeight: 700 }}>{cur} {fV(Math.round(cv))}</div> : null;
                                })
                              ) : (
                                <span style={{ color: currencies[0] === "EGP" ? "#8B5E3C" : "#2563EB", fontWeight: 700 }}>{currencies[0] || ""} {fV(Math.round(totVal))}</span>
                              )}
                              {totValUsd > 0 && <div style={{ fontSize: 9, color: "#64706C", marginTop: 1 }}>≈ $ {fV(Math.round(totValUsd))} USD</div>}
                            </div>
                          ) : "—"}
                        </td>
                        <td />
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══ WAREHOUSES ═══ */}
        {/* ═══ SUPPLY SPLIT ═══ */}
        {pg === "supply" && (
          <div style={{ padding: isMob ? 10 : 18 }}>
            {/* Period filter + search */}
            <div style={{ display: "flex", flexDirection: isMob ? "column" : "row", gap: 10, marginBottom: 14, alignItems: isMob ? "stretch" : "center" }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", marginRight: 4, flexShrink: 0 }}>Period</span>
                {(["7d", "30d", "90d", "all", "custom"] as const).map((p) => {
                  const labels: Record<string, string> = { "7d": "Last 7 Days", "30d": "Last 30 Days", "90d": "Last 90 Days", all: "All Time", custom: "Custom" };
                  return pl(labels[p], ssPeriod === p, () => { setSsPeriod(p); if (p !== "custom") { setSsDateFrom(""); setSsDateTo(""); } });
                })}
              </div>
              <div style={{ flex: 1 }} />
              <input value={ssSearch} onChange={(e) => setSsSearch(e.target.value)} placeholder="Search suppliers or products..." style={{ width: isMob ? "100%" : 260, height: 34, padding: "0 12px", border: "1px solid #E4E1DC", borderRadius: 7, fontFamily: "inherit", fontSize: 12, outline: "none" }} />
            </div>
            {ssPeriod === "custom" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase" }}>From</span>
                <input type="date" value={ssDateFrom} onChange={(e) => setSsDateFrom(e.target.value)} style={{ height: 34, padding: "0 10px", border: "1px solid #E4E1DC", borderRadius: 7, fontFamily: "inherit", fontSize: 12, outline: "none" }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase" }}>To</span>
                <input type="date" value={ssDateTo} onChange={(e) => setSsDateTo(e.target.value)} style={{ height: 34, padding: "0 10px", border: "1px solid #E4E1DC", borderRadius: 7, fontFamily: "inherit", fontSize: 12, outline: "none" }} />
                {(ssDateFrom || ssDateTo) && (
                  <button onClick={() => { setSsDateFrom(""); setSsDateTo(""); }} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #E4E1DC", background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "#C94444" }}>Clear</button>
                )}
              </div>
            )}

            {/* View toggle */}
            <div className="filter-scroll" style={{ gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", marginRight: 4, flexShrink: 0 }}>View</span>
              {pl("By Supplier", ssView === "suppliers", () => setSsView("suppliers"))}
              {pl("By Product", ssView === "products", () => setSsView("products"))}
              {pl("All Lines", ssView === "lines", () => setSsView("lines"))}
            </div>

            {/* Warehouse + Location filters — derived from live data */}
            {ssData && (() => {
              const allWhs = ["All", ...Array.from(new Set(ssData.lines.map(l => l.warehouseName).filter(Boolean))).sort()];
              const allLocs = ["All", ...Array.from(new Set(ssData.lines.map(l => l.locationName).filter(Boolean))).sort()];
              if (allWhs.length <= 1 && allLocs.length <= 1) return null;
              return (
                <>
                  {allWhs.length > 1 && (
                    <div className="filter-scroll" style={{ gap: 4, marginBottom: 8 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", marginRight: 4, flexShrink: 0 }}>Warehouse</span>
                      {allWhs.map(w => pl(w, ssWarehouseF === w, () => { setSsWarehouseF(w); setSsLocationF("All"); }))}
                    </div>
                  )}
                  {allLocs.length > 1 && (
                    <div className="filter-scroll" style={{ gap: 4, marginBottom: 14 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", marginRight: 4, flexShrink: 0 }}>Location</span>
                      {allLocs.map(l => pl(l, ssLocationF === l, () => setSsLocationF(l)))}
                    </div>
                  )}
                </>
              );
            })()}

            {ssLoading && <InventorySkeleton />}

            {!ssLoading && ssData && (() => {
              const search = ssSearch.toLowerCase();

              // Apply warehouse + location filters to lines before computing KPIs
              const filteredLines = ssData.lines.filter(l => {
                if (ssWarehouseF !== "All" && l.warehouseName !== ssWarehouseF) return false;
                if (ssLocationF !== "All" && l.locationName !== ssLocationF) return false;
                return true;
              });

              // Recompute supplier summaries from filtered lines
              const supplierMapF = new Map<number, { id: number; name: string; totalQty: number; totalReceived: number; totalValue: number; products: Map<number, { id: number; name: string; qty: number; received: number; value: number; orders: number; currency: string }>; orderCount: Set<number>; currencies: Map<string, number> }>();
              filteredLines.forEach(l => {
                if (!supplierMapF.has(l.supplierId)) supplierMapF.set(l.supplierId, { id: l.supplierId, name: l.supplierName, totalQty: 0, totalReceived: 0, totalValue: 0, products: new Map(), orderCount: new Set(), currencies: new Map() });
                const s = supplierMapF.get(l.supplierId)!;
                s.totalQty += l.productQty; s.totalReceived += l.qtyReceived; s.totalValue += l.priceSubtotal;
                s.orderCount.add(l.orderId); s.currencies.set(l.currency, (s.currencies.get(l.currency) || 0) + l.priceSubtotal);
                if (!s.products.has(l.productId)) s.products.set(l.productId, { id: l.productId, name: l.productName, qty: 0, received: 0, value: 0, orders: 0, currency: l.currency });
                const p = s.products.get(l.productId)!; p.qty += l.productQty; p.received += l.qtyReceived; p.value += l.priceSubtotal; p.orders++;
              });
              const filteredSupplierSummaries = [...supplierMapF.values()].map(s => {
                let dc = "EGP", mx = 0; s.currencies.forEach((v, c) => { if (v > mx) { mx = v; dc = c; } });
                return { id: s.id, name: s.name, totalQty: s.totalQty, totalReceived: s.totalReceived, totalValue: s.totalValue, orderCount: s.orderCount.size, currency: dc, products: [...s.products.values()].sort((a, b) => b.received - a.received) };
              }).sort((a, b) => b.totalReceived - a.totalReceived);

              // Recompute product summaries from filtered lines
              const productMapF = new Map<number, { id: number; name: string; totalQty: number; totalReceived: number; totalValue: number; supplierCount: Set<number>; currencies: Map<string, number> }>();
              filteredLines.forEach(l => {
                if (!productMapF.has(l.productId)) productMapF.set(l.productId, { id: l.productId, name: l.productName, totalQty: 0, totalReceived: 0, totalValue: 0, supplierCount: new Set(), currencies: new Map() });
                const p = productMapF.get(l.productId)!;
                p.totalQty += l.productQty; p.totalReceived += l.qtyReceived; p.totalValue += l.priceSubtotal;
                p.supplierCount.add(l.supplierId); p.currencies.set(l.currency, (p.currencies.get(l.currency) || 0) + l.priceSubtotal);
              });
              const filteredProductSummaries = [...productMapF.values()].map(p => {
                let dc = "EGP", mx = 0; p.currencies.forEach((v, c) => { if (v > mx) { mx = v; dc = c; } });
                return { id: p.id, name: p.name, totalQty: p.totalQty, totalReceived: p.totalReceived, totalValue: p.totalValue, supplierCount: p.supplierCount.size, currency: dc };
              }).sort((a, b) => b.totalReceived - a.totalReceived);

              // Filtered KPI totals
              const filteredTotals = {
                totalQty: filteredLines.reduce((s, l) => s + l.productQty, 0),
                totalReceived: filteredLines.reduce((s, l) => s + l.qtyReceived, 0),
                totalValue: filteredLines.reduce((s, l) => s + l.priceSubtotal, 0),
                lineCount: filteredLines.length,
                supplierCount: supplierMapF.size,
                productCount: productMapF.size,
              };

              // Use filtered data for rendering
              const totals = filteredTotals;
              const filteredSsSupplierSummaries = filteredSupplierSummaries;
              const filteredSsProductSummaries = filteredProductSummaries;
              const filteredSsLines = filteredLines;

              return (
                <>
                  {/* KPI cards */}
                  <div style={{ display: "grid", gridTemplateColumns: isMob ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 10, marginBottom: 8 }}>
                    <div className="sc"><div className="sl">Total PO Lines</div><div className="sv" style={{ fontSize: 16 }}>{totals.lineCount.toLocaleString()}</div></div>
                    <div className="sc"><div className="sl">Suppliers</div><div className="sv" style={{ fontSize: 16 }}>{totals.supplierCount}</div></div>
                    <div className="sc"><div className="sl">Products</div><div className="sv" style={{ fontSize: 16 }}>{totals.productCount}</div></div>
                    <div className="sc"><div className="sl">Ordered Qty</div><div className="sv" style={{ fontSize: 16 }}>{fK(totals.totalQty)}</div></div>
                    <div className="sc"><div className="sl">Received Qty</div><div className="sv" style={{ fontSize: 16, color: totals.totalReceived > 0 ? "#2D5A3D" : undefined }}>{fK(totals.totalReceived)}</div></div>
                  </div>

                  {/* ─── SUPPLIER VIEW ─── */}
                  {ssView === "suppliers" && (() => {
                    let suppliers = filteredSsSupplierSummaries;
                    if (search) suppliers = suppliers.filter(s => s.name.toLowerCase().includes(search) || s.products.some(p => p.name.toLowerCase().includes(search)));
                    // Sort
                    suppliers = [...suppliers].sort((a, b) => {
                      let va: number | string, vb: number | string;
                      switch (ssSortCol) {
                        case "name": va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
                        case "qty": va = a.totalQty; vb = b.totalQty; break;
                        case "received": va = a.totalReceived; vb = b.totalReceived; break;
                        case "value": va = a.totalValue; vb = b.totalValue; break;
                              case "orders": va = a.orderCount; vb = b.orderCount; break;
                        case "share": va = a.totalReceived; vb = b.totalReceived; break;
                        default: va = a.totalReceived; vb = b.totalReceived;
                      }
                      if (va < vb) return ssSortDir === "asc" ? -1 : 1;
                      if (va > vb) return ssSortDir === "asc" ? 1 : -1;
                      return 0;
                    });
                    const maxReceived = Math.max(...suppliers.map(s => s.totalReceived), 1);
                    const grandTotalReceived = suppliers.reduce((sum, s) => sum + s.totalReceived, 0) || 1;
                    return (
                      <div className="xc">
                        <div className="xh"><h3>🚚 Suppliers ({suppliers.length})</h3></div>
                        <div style={{ overflowX: isMob ? "auto" : "visible", WebkitOverflowScrolling: "touch" }}>
                        <table className="t" style={isMob ? { minWidth: 700 } : undefined}>
                          <thead>
                            <tr>
                              {([
                                { key: "name", label: "Supplier" },
                                { key: "orders", label: "Orders" },
                                { key: "qty", label: "Ordered" },
                                { key: "received", label: "Received" },
                                { key: "share", label: "% Supply" },
                                { key: "", label: "Fulfillment" },
                                { key: "value", label: "Total Value" },
                                { key: "", label: "Currency" },
                                { key: "", label: "" },
                              ] as const).map((col, i) => (
                                <th key={i} style={{ cursor: col.key ? "pointer" : "default", userSelect: col.key ? "none" : undefined, whiteSpace: "nowrap" }} onClick={col.key ? () => toggleSsSort(col.key as any) : undefined}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                    {col.label}
                                    {col.key && ssSortCol === col.key && <span style={{ fontSize: 8, opacity: 0.7 }}>{ssSortDir === "asc" ? "▲" : "▼"}</span>}
                                    {col.key && ssSortCol !== col.key && <span style={{ fontSize: 8, opacity: 0.25 }}>⇅</span>}
                                  </span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {suppliers.map((s) => {
                              const expanded = ssExpanded.has(s.id);
                              const fulfillPct = s.totalQty > 0 ? Math.round((s.totalReceived / s.totalQty) * 100) : 0;
                              // Shorten supplier name: remove leading account code if present
                              const shortName = s.name.replace(/^\d+-/, "");
                              return (
                                <Fragment key={s.id}>
                                  <tr onClick={() => { setSsExpanded(prev => { const n = new Set(prev); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; }); }} style={{ background: expanded ? "#F2F7F3" : undefined }}>
                                    <td style={{ fontWeight: 600, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.name}>
                                      <span style={{ marginRight: 6, fontSize: 10 }}>{expanded ? "▼" : "▶"}</span>
                                      {shortName}
                                    </td>
                                    <td className="m">{s.orderCount}</td>
                                    <td className="m">{fK(s.totalQty)}</td>
                                    <td className="m" style={{ color: "#2D5A3D", fontWeight: 600 }}>{fK(s.totalReceived)}</td>
                                    <td className="m" style={{ fontWeight: 600, color: "#2D5A3D" }}>
                                      {((s.totalReceived / grandTotalReceived) * 100).toFixed(1)}%
                                    </td>
                                    <td>
                                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        {br(s.totalReceived, s.totalQty, fulfillPct >= 80 ? "#2D5A3D" : fulfillPct >= 50 ? "#D4960A" : "#C94444", 5)}
                                        <span style={{ fontSize: 9, color: "#64706C", minWidth: 28, textAlign: "right" }}>{fulfillPct}%</span>
                                      </div>
                                    </td>
                                    <td className="m" style={{ fontWeight: 600 }}>{fV(Math.round(s.totalValue))}</td>
                                    <td className="m" style={{ fontSize: 10, color: "#64706C" }}>{(s as any).currency || "EGP"}</td>
                                    <td>
                                      <div style={{ width: "100%", height: 4, borderRadius: 4, background: "#E4E1DC", overflow: "hidden" }}>
                                        <div style={{ height: "100%", borderRadius: 4, background: "#2D5A3D", width: `${Math.min((s.totalReceived / maxReceived) * 100, 100)}%`, opacity: 0.6 }} />
                                      </div>
                                    </td>
                                  </tr>
                                  {expanded && s.products.map((p) => (
                                    <tr key={`${s.id}-${p.id}`} style={{ background: "#FAFAF8" }}>
                                      <td style={{ paddingLeft: 32, fontSize: 10, color: "#64706C" }}>{p.name}</td>
                                      <td className="m" style={{ fontSize: 10, color: "#95A09C" }}>{p.orders}</td>
                                      <td className="m" style={{ fontSize: 10 }}>{fK(p.qty)}</td>
                                      <td className="m" style={{ fontSize: 10, color: "#2D5A3D" }}>{fK(p.received)}</td>
                                      <td className="m" style={{ fontSize: 9, color: "#95A09C" }}>
                                        {((p.received / grandTotalReceived) * 100).toFixed(1)}%
                                      </td>
                                      <td>
                                        {p.qty > 0 && (() => {
                                          const pPct = Math.round((p.received / p.qty) * 100);
                                          return (
                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                              {br(p.received, p.qty, pPct >= 80 ? "#2D5A3D" : pPct >= 50 ? "#D4960A" : "#C94444", 3)}
                                              <span style={{ fontSize: 8, color: "#95A09C", minWidth: 24 }}>{pPct}%</span>
                                            </div>
                                          );
                                        })()}
                                      </td>
                                      <td className="m" style={{ fontSize: 10 }}>{fV(Math.round(p.value))}</td>
                                      <td className="m" style={{ fontSize: 9, color: "#95A09C" }}>{(p as any).currency || "EGP"}</td>
                                      <td />
                                    </tr>
                                  ))}
                                </Fragment>
                              );
                            })}
                            {suppliers.length === 0 && (
                              <tr><td colSpan={9} style={{ textAlign: "center", padding: 24, color: "#95A09C", fontStyle: "italic" }}>No supplier data found{search ? " matching \"" + ssSearch + "\"" : ""}</td></tr>
                            )}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ─── PRODUCT VIEW ─── */}
                  {ssView === "products" && (() => {
                    let products = filteredSsProductSummaries;
                    if (search) products = products.filter(p => p.name.toLowerCase().includes(search));
                    products = [...products].sort((a, b) => {
                      let va: number | string, vb: number | string;
                      switch (ssSortCol) {
                        case "name": va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
                        case "qty": va = a.totalQty; vb = b.totalQty; break;
                        case "received": va = a.totalReceived; vb = b.totalReceived; break;
                        case "value": va = a.totalValue; vb = b.totalValue; break;
                        case "orders": va = a.supplierCount; vb = b.supplierCount; break;
                        case "share": va = a.totalReceived; vb = b.totalReceived; break;
                        default: va = a.totalReceived; vb = b.totalReceived;
                      }
                      if (va < vb) return ssSortDir === "asc" ? -1 : 1;
                      if (va > vb) return ssSortDir === "asc" ? 1 : -1;
                      return 0;
                    });
                    const maxReceived = Math.max(...products.map(p => p.totalReceived), 1);
                    const grandTotalReceived = products.reduce((sum, p) => sum + p.totalReceived, 0) || 1;
                    return (
                      <div className="xc">
                        <div className="xh"><h3>🏷️ Products ({products.length})</h3></div>
                        <div style={{ overflowX: isMob ? "auto" : "visible", WebkitOverflowScrolling: "touch" }}>
                        <table className="t" style={isMob ? { minWidth: 700 } : undefined}>
                          <thead>
                            <tr>
                              {([
                                { key: "name", label: "Product" },
                                { key: "orders", label: "Suppliers" },
                                { key: "qty", label: "Ordered" },
                                { key: "received", label: "Received" },
                                { key: "share", label: "% Supply" },
                                { key: "", label: "Fulfillment" },
                                { key: "value", label: "Total Value" },
                                { key: "", label: "Currency" },
                                { key: "", label: "" },
                              ] as const).map((col, i) => (
                                <th key={i} style={{ cursor: col.key ? "pointer" : "default", userSelect: col.key ? "none" : undefined, whiteSpace: "nowrap" }} onClick={col.key ? () => toggleSsSort(col.key as any) : undefined}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                    {col.label}
                                    {col.key && ssSortCol === col.key && <span style={{ fontSize: 8, opacity: 0.7 }}>{ssSortDir === "asc" ? "▲" : "▼"}</span>}
                                    {col.key && ssSortCol !== col.key && <span style={{ fontSize: 8, opacity: 0.25 }}>⇅</span>}
                                  </span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {products.map((p) => {
                              const fulfillPct = p.totalQty > 0 ? Math.round((p.totalReceived / p.totalQty) * 100) : 0;
                              return (
                                <tr key={p.id}>
                                  <td style={{ fontWeight: 500, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.name}>{p.name}</td>
                                  <td className="m">{p.supplierCount}</td>
                                  <td className="m">{fK(p.totalQty)}</td>
                                  <td className="m" style={{ color: "#2D5A3D", fontWeight: 600 }}>{fK(p.totalReceived)}</td>
                                  <td className="m" style={{ fontWeight: 600, color: "#2D5A3D" }}>
                                    {((p.totalReceived / grandTotalReceived) * 100).toFixed(1)}%
                                  </td>
                                  <td>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      {br(p.totalReceived, p.totalQty, fulfillPct >= 80 ? "#2D5A3D" : fulfillPct >= 50 ? "#D4960A" : "#C94444", 5)}
                                      <span style={{ fontSize: 9, color: "#64706C", minWidth: 28, textAlign: "right" }}>{fulfillPct}%</span>
                                    </div>
                                  </td>
                                  <td className="m" style={{ fontWeight: 600 }}>{fV(Math.round(p.totalValue))}</td>
                                  <td className="m" style={{ fontSize: 10, color: "#64706C" }}>{(p as any).currency || "EGP"}</td>
                                  <td>
                                    <div style={{ width: "100%", height: 4, borderRadius: 4, background: "#E4E1DC", overflow: "hidden" }}>
                                      <div style={{ height: "100%", borderRadius: 4, background: "#4A7C59", width: `${Math.min((p.totalReceived / maxReceived) * 100, 100)}%`, opacity: 0.6 }} />
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {products.length === 0 && (
                              <tr><td colSpan={9} style={{ textAlign: "center", padding: 24, color: "#95A09C", fontStyle: "italic" }}>No product data found{search ? " matching \"" + ssSearch + "\"" : ""}</td></tr>
                            )}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ─── ALL LINES VIEW ─── */}
                  {ssView === "lines" && (() => {
                    let lines = filteredSsLines;
                    if (search) lines = lines.filter(l => l.supplierName.toLowerCase().includes(search) || l.productName.toLowerCase().includes(search) || l.orderName.toLowerCase().includes(search));
                    // Sort by date descending by default
                    lines = [...lines].sort((a, b) => {
                      const da = a.datePlanned || "";
                      const db = b.datePlanned || "";
                      return db.localeCompare(da);
                    });
                    return (
                      <div className="xc">
                        <div className="xh"><h3>📋 Purchase Order Lines ({lines.length})</h3></div>
                        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                        <table className="t" style={{ minWidth: 900 }}>
                          <thead>
                            <tr>
                              <th>Order</th>
                              <th>Date</th>
                              <th>Supplier</th>
                              <th>Product</th>
                              <th>Ordered</th>
                              <th>Received</th>
                              <th>Unit Price</th>
                              <th>Subtotal</th>
                              <th>Currency</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lines.slice(0, 200).map((l) => {
                              const shortSupplier = l.supplierName.replace(/^\d+-/, "");
                              const fulfillPct = l.productQty > 0 ? Math.round((l.qtyReceived / l.productQty) * 100) : 0;
                              return (
                                <tr key={l.id}>
                                  <td style={{ fontWeight: 600, fontSize: 10, color: "#2D5A3D" }}>{l.orderName}</td>
                                  <td style={{ fontSize: 10, color: "#64706C", whiteSpace: "nowrap" }}>{l.datePlanned ? l.datePlanned.split(" ")[0] : "—"}</td>
                                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.supplierName}>{shortSupplier}</td>
                                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.productName}>{l.productName}</td>
                                  <td className="m">{fK(l.productQty)}</td>
                                  <td className="m" style={{ color: l.qtyReceived > 0 ? "#2D5A3D" : "#B0BAB6" }}>{l.qtyReceived > 0 ? fK(l.qtyReceived) : "—"}</td>
                                  <td className="m" style={{ fontSize: 10 }}>{l.priceUnit > 0 ? l.priceUnit.toFixed(3) : "—"}</td>
                                  <td className="m" style={{ fontWeight: 600 }}>{l.priceSubtotal > 0 ? fV(Math.round(l.priceSubtotal)) : "—"}</td>
                                  <td><span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: l.currency === "EGP" ? "#FFF3CD" : l.currency === "USD" ? "#D1ECF1" : "#E2E3E5", color: l.currency === "EGP" ? "#856404" : l.currency === "USD" ? "#0C5460" : "#495057" }}>{l.currency}</span></td>
                                  <td>{bd(l.state === "done" ? "ok" : l.state === "purchase" ? "warn" : "full", l.state === "done" ? "Done" : l.state === "purchase" ? "PO" : l.state)}</td>
                                </tr>
                              );
                            })}
                            {lines.length > 200 && (
                              <tr><td colSpan={10} style={{ textAlign: "center", padding: 12, color: "#95A09C", fontSize: 11 }}>Showing first 200 of {lines.length} lines. Use date filters to narrow results.</td></tr>
                            )}
                            {lines.length === 0 && (
                              <tr><td colSpan={10} style={{ textAlign: "center", padding: 24, color: "#95A09C", fontStyle: "italic" }}>No purchase order lines found{search ? " matching \"" + ssSearch + "\"" : ""}</td></tr>
                            )}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </div>
        )}

        {!isLoading && !isError && pg === "wh" && (
          <div style={{ padding: isMob ? 10 : 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMob ? "repeat(2,1fr)" : "repeat(5,1fr)", gap: 10, marginBottom: 16 }}>
              <div className="sc"><div className="sl">Warehouses</div><div className="sv" style={{ fontSize: 16 }}>{cW.length}</div><div className="ss">{[...new Set(cW.map((x) => x.co))].length} companies</div></div>
              <div className="sc"><div className="sl">Total Stock</div><div className="sv" style={{ fontSize: 16 }}>{fK(cW.reduce((s, x) => s + x.kg, 0))}</div><div className="ss">across all</div></div>
              <div className="sc"><div className="sl">Products</div><div className="sv" style={{ fontSize: 16 }}>{cW.reduce((s, x) => s + x.ops, 0)}</div><div className="ss">stock items</div></div>
              <div className="sc"><div className="sl">Reserved</div><div className="sv" style={{ fontSize: 16, color: cW.reduce((s, x) => s + x.totalReserved, 0) > 0 ? "#C0714A" : undefined }}>{fK(cW.reduce((s, x) => s + x.totalReserved, 0))}</div></div>
              <div className="sc"><div className="sl">Est. Value</div><div className="sv" style={{ fontSize: 16 }}>{fV(Math.round(tV))}</div></div>
            </div>

            {/* Comparison bar */}
            <div className="xc" style={{ marginBottom: 16 }}>
              <div className="xh"><h3>📊 Warehouse Comparison</h3><span style={{ fontSize: 9, color: "rgba(255,255,255,.5)", fontWeight: 400 }}>Click a bar to filter stock</span></div>
              <div style={{ padding: 16, position: "relative" }} onMouseLeave={() => setBarTip(null)}>
                {/* Tooltip */}
                {barTip && (() => {
                  const whQ2 = cQ.filter((q) => q.whN === barTip.wh.name);
                  const whValEGP = whQ2.filter((q) => q.qty > 0 && q.currency === "EGP").reduce((s, q) => s + (q.value || 0), 0);
                  const whValAED = whQ2.filter((q) => q.qty > 0 && q.currency === "AED").reduce((s, q) => s + (q.value || 0), 0);
                  const whValUSD = whValEGP * exRates.EGP_USD + whValAED * exRates.AED_USD;
                  const whRes2 = whQ2.reduce((s, q) => s + q.res, 0);
                  return (
                    <div style={{
                      position: "absolute", zIndex: 50,
                      left: Math.min(barTip.x, window.innerWidth - 220) - 10,
                      top: barTip.y - 8,
                      background: "#1B3A2D", color: "#fff", borderRadius: 8,
                      padding: "10px 14px", minWidth: 200, pointerEvents: "none",
                      boxShadow: "0 4px 16px rgba(0,0,0,.22)",
                      fontSize: 11, lineHeight: 1.5,
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: "#A8D5B5" }}>{barTip.wh.name}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 10px" }}>
                        <span style={{ color: "rgba(255,255,255,.55)" }}>Stock</span>
                        <span className="m" style={{ color: "#fff" }}>{fK(barTip.wh.kg)}</span>
                        <span style={{ color: "rgba(255,255,255,.55)" }}>Reserved</span>
                        <span className="m" style={{ color: whRes2 > 0 ? "#F5DDB8" : "rgba(255,255,255,.4)" }}>{whRes2 > 0 ? fK(whRes2) : "—"}</span>
                        <span style={{ color: "rgba(255,255,255,.55)" }}>Products</span>
                        <span className="m">{barTip.wh.ops} items</span>
                        {whValUSD > 0 && <>
                          <span style={{ color: "rgba(255,255,255,.55)", marginTop: 4, borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 4 }}>Value (USD)</span>
                          <span className="m" style={{ color: "#A8D5B5", marginTop: 4, borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 4 }}>$ {fV(Math.round(whValUSD))}</span>
                          {whValEGP > 0 && <><span style={{ color: "rgba(255,255,255,.55)" }}>EGP</span><span className="m">EGP {fV(Math.round(whValEGP))}</span></>}
                          {whValAED > 0 && <><span style={{ color: "rgba(255,255,255,.55)" }}>AED</span><span className="m">AED {fV(Math.round(whValAED))}</span></>}
                        </>}
                        <span style={{ color: "rgba(255,255,255,.55)" }}>Company</span>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,.7)" }}>{barTip.wh.co}</span>
                      </div>
                    </div>
                  );
                })()}
                <div style={{ display: "flex", gap: 4, marginBottom: 10, alignItems: "flex-end", height: 120 }}>
                  {cW.map((x) => {
                    const maxKg = Math.max(...cW.map((w) => w.kg), 1);
                    const h = x.kg > 0 ? Math.max(8, Math.round((x.kg / maxKg) * 110)) : 4;
                    return (
                      <div key={x.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const parent = e.currentTarget.closest(".xc")?.getBoundingClientRect();
                          setBarTip({ x: rect.left - (parent?.left || 0) + rect.width / 2, y: 0, wh: x });
                        }}
                        onClick={() => { setWhFs(new Set([x.name])); setLocFs(new Set()); setPCats(new Set(["Alfalfa"])); setSv("all"); setPg("stock"); setBarTip(null); }}
                      >
                        <span className="m" style={{ fontSize: 9, color: "#2D5A3D" }}>{x.kg > 0 ? fK(x.kg) : ""}</span>
                        <div style={{ width: "100%", maxWidth: 60, height: h, borderRadius: "4px 4px 0 0", background: x.kg > 0 ? "linear-gradient(180deg," + x.col + "," + x.col + "90)" : "#E4E1DC", transition: "height .4s, opacity .15s", opacity: barTip && barTip.wh.id !== x.id ? 0.45 : 1 }} />
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {cW.map((x) => (
                    <div key={x.id} style={{ flex: 1, textAlign: "center", cursor: "pointer" }}
                      onClick={() => { setWhFs(new Set([x.name])); setLocFs(new Set()); setPCats(new Set(["Alfalfa"])); setSv("all"); setPg("stock"); setBarTip(null); }}
                    >
                      <div style={{ fontSize: 8, fontWeight: 600, color: barTip && barTip.wh.id === x.id ? "#2D5A3D" : "#2C3E50", lineHeight: 1.3, wordBreak: "break-word", hyphens: "auto", textDecoration: barTip && barTip.wh.id === x.id ? "underline" : "none" }}>{x.name}</div>
                      <div style={{ fontSize: 8, color: "#95A09C", marginTop: 2 }}>{x.ops} items</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Warehouse cards */}
            <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill,minmax(360px,1fr))", gap: 14 }}>
              {cW.map((x) => {
                const whQ = cQ.filter((q) => q.whN === x.name);
                const whPos = whQ.filter((q) => q.qty > 0);
                const whNeg = whQ.filter((q) => q.qty < 0);
                const whRes = whQ.reduce((s, q) => s + q.res, 0);
                const whVal = whQ.filter((q) => q.qty > 0).reduce((s, q) => s + (q.value || 0), 0);
                const whAlerts = AL.filter((a) => a.title && x.name && (a.d.toLowerCase().includes(x.name.split(" ")[0].toLowerCase())));
                const isOpen = selWh && selWh.id === x.id;
                // Locations available in this warehouse (merge quant locations + API locations)
                const quantLocs = whQ.map((q) => q.wh).filter(Boolean);
                const apiLocs = x.locs || [];
                const whLocations = [...new Set([...quantLocs, ...apiLocs])].sort();
                // Items filtered by selected location
                const whPosFiltered = selWhLoc !== "All" && isOpen
                  ? whPos.filter((q) => q.wh === selWhLoc)
                  : whPos;
                const whNegFiltered = selWhLoc !== "All" && isOpen
                  ? whNeg.filter((q) => q.wh === selWhLoc)
                  : whNeg;
                return (
                  <div className="ws" key={x.id} onClick={() => { setSelWh(isOpen ? null : x); if (isOpen) setSelWhLoc("All"); }} style={{ borderColor: isOpen ? "#2D5A3D" : "#E4E1DC", boxShadow: isOpen ? "0 0 0 2px rgba(45,90,61,.12)" : "" }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 52, height: 52, borderRadius: "50%", background: x.kg > 0 ? "linear-gradient(135deg," + x.col + "20," + x.col + "40)" : "#F2F0EC", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 18 }}>{x.kg > 0 ? "🏭" : "📦"}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#2C3E50" }}>{x.name}</div>
                        <div style={{ fontSize: 10, color: "#95A09C" }}>{x.co} · {x.wh}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {bd(x.kg > 0 ? "ok" : "warn", x.kg > 0 ? "Active" : "Empty")}
                        {whAlerts.length > 0 && <div style={{ marginTop: 4 }}>{bd("neg", whAlerts.length + " alert" + (whAlerts.length > 1 ? "s" : ""))}</div>}
                      </div>
                    </div>

                    {/* Stats row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 10, padding: "8px 10px", background: "#FAFAF8", borderRadius: 6 }}>
                      <div><div style={{ fontSize: 8, color: "#95A09C", textTransform: "uppercase" }}>Stock</div><div className="m" style={{ fontSize: 14, color: "#2D5A3D", marginTop: 2 }}>{x.kg > 0 ? fK(x.kg) : "—"}</div></div>
                      <div><div style={{ fontSize: 8, color: "#95A09C", textTransform: "uppercase" }}>Reserved</div><div className="m" style={{ fontSize: 14, color: whRes > 0 ? "#C0714A" : "#B0BAB6", marginTop: 2 }}>{whRes > 0 ? fK(whRes) : "—"}</div></div>
                      <div><div style={{ fontSize: 8, color: "#95A09C", textTransform: "uppercase" }}>Products</div><div className="m" style={{ fontSize: 14, marginTop: 2 }}>{whPos.length}</div></div>
                      <div><div style={{ fontSize: 8, color: "#95A09C", textTransform: "uppercase" }}>Value</div><div className="m" style={{ fontSize: 14, color: "#2C3E50", marginTop: 2 }}>{whVal > 0 ? fV(Math.round(whVal)) : "—"}</div></div>
                    </div>



                    {/* Product stacked bar */}
                    {x.kg > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ height: 12, borderRadius: 3, background: "#E4E1DC", overflow: "hidden", display: "flex" }}>
                          {x.mx.map((m, i) => (
                            <div key={i} title={m.p + ": " + fK(m.kg)} style={{ height: "100%", background: m.c, width: `${(m.kg / x.kg) * 100}%` }} />
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 5, marginTop: 3, flexWrap: "wrap" }}>
                          {x.mx.map((m, i) => (
                            <span key={i} style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 8, color: "#64706C" }}>
                              <div style={{ width: 5, height: 5, borderRadius: 1, background: m.c }} />{m.p} <span className="m" style={{ fontSize: 7 }}>{fK(m.kg)}</span> <span style={{ fontSize: 7, color: "#B0BAB6" }}>{Math.round((m.kg / x.kg) * 100)}%</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Expanded detail */}
                    {isOpen && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #E4E1DC" }}>
                        {/* Config */}
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", marginBottom: 6 }}>Configuration</div>
                        {[["Warehouse Code", x.wh], ["Company", x.co], ["Items", x.pr + " stock items"]].map(([l, v]) => (
                          <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 11, borderBottom: "1px solid #F2F0EC" }}>
                            <span style={{ color: "#64706C" }}>{l}</span><span className="m" style={{ fontSize: 10 }}>{v}</span>
                          </div>
                        ))}

                        {/* Alerts for this warehouse */}
                        {whAlerts.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: "#C94444", textTransform: "uppercase", marginBottom: 6 }}>Alerts</div>
                            {whAlerts.map((a, i) => (
                              <div key={i} style={{ display: "flex", gap: 6, padding: "6px 0", borderBottom: "1px solid #F2F0EC", fontSize: 10 }}>
                                <span>{a.t === "neg" ? "🔴" : "🟡"}</span>
                                <div><span style={{ fontWeight: 600, color: "#2C3E50" }}>{a.title}</span><div style={{ fontSize: 9, color: "#64706C", marginTop: 1 }}>{a.d}</div></div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Stock items in this warehouse */}
                          <div style={{ marginTop: 12 }}>
                            {/* Location filter dropdown */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase" }}>
                                Stock Items ({whPosFiltered.length}{selWhLoc !== "All" ? " of " + whPos.length : ""})
                              </div>
                              {whLocations.length > 0 && (
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                                  <span style={{ fontSize: 9, color: "#64706C" }}>Location:</span>
                                  <select
                                    value={selWhLoc}
                                    onChange={(e) => setSelWhLoc(e.target.value)}
                                    style={{
                                      fontSize: 10, fontWeight: 600, color: selWhLoc !== "All" ? "#2D5A3D" : "#64706C",
                                      border: "1px solid " + (selWhLoc !== "All" ? "#2D5A3D" : "#E4E1DC"),
                                      borderRadius: 6, padding: "3px 22px 3px 8px", backgroundColor: selWhLoc !== "All" ? "#E4EFE6" : "#fff",
                                      cursor: "pointer", outline: "none", fontFamily: "inherit",
                                      appearance: "none", WebkitAppearance: "none",
                                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2364706C' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                                      backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center",
                                    }}
                                  >
                                    <option value="All">All Locations</option>
                                    {whLocations.map((loc) => (
                                      <option key={loc} value={loc}>{loc}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                            {whPosFiltered.sort((a, b) => b.qty - a.qty).map((q) => {
                              const av = q.qty - q.res;
                              const pct = q.qty > 0 ? Math.round((av / q.qty) * 100) : 0;
                              return (
                                <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #F2F0EC", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setSel(q); setPg("stock"); setWhFs(new Set([x.name])); }}>
                                  <div style={{ width: 6, height: 6, borderRadius: 2, background: groupColor(q.cat), flexShrink: 0 }} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 10, fontWeight: 500, color: "#2C3E50", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={q.p}>{q.p}</div>
                                    {selWhLoc === "All" && <div style={{ fontSize: 8, color: "#95A09C", marginTop: 1 }}>{q.wh}</div>}
                                  </div>
                                  <div className="m" style={{ fontSize: 11, color: "#2D5A3D", flexShrink: 0 }}>{fK(q.qty)}</div>
                                  {q.res > 0 && <span style={{ fontSize: 8, color: "#C0714A", flexShrink: 0 }}>{fK(q.res)} rsv</span>}
                                  <div style={{ width: 40, flexShrink: 0 }}>{br(av, q.qty, pct > 50 ? "#2D5A3D" : pct > 20 ? "#D4960A" : "#C94444", 3)}</div>
                                </div>
                              );
                            })}
                            {whNegFiltered.length > 0 && whNegFiltered.map((q) => (
                              <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #F2F0EC" }}>
                                <span style={{ fontSize: 10 }}>🔴</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 10, color: "#C94444", fontWeight: 500 }} title={q.p}>{q.p}</div>
                                  {selWhLoc === "All" && <div style={{ fontSize: 8, color: "#95A09C", marginTop: 1 }}>{q.wh}</div>}
                                </div>
                                <div className="m" style={{ fontSize: 11, color: "#C94444" }}>{q.qty.toLocaleString()} {q.u}</div>
                              </div>
                            ))}
                            {/* Totals row — always show when there are items */}
                            {(whPosFiltered.length + whNegFiltered.length) >= 1 && (() => {
                              const totalQty = whPosFiltered.reduce((s, q) => s + q.qty, 0);
                              const totalRes = whPosFiltered.reduce((s, q) => s + q.res, 0);
                              const totalAv = totalQty - totalRes;
                              const totalVal = whPosFiltered.reduce((s, q) => s + (q.val || 0), 0);
                              return (
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0 4px 0", borderTop: "2px solid #CDDDD1", marginTop: 2, background: "#F2F7F3", borderRadius: "0 0 6px 6px", paddingLeft: 4, paddingRight: 4 }}>
                                  <div style={{ width: 6, height: 6, flexShrink: 0 }} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#2D5A3D" }}>TOTAL{selWhLoc !== "All" ? " @ " + selWhLoc : ""}</div>
                                    <div style={{ fontSize: 8, color: "#95A09C" }}>{whPosFiltered.length} product{whPosFiltered.length !== 1 ? "s" : ""}</div>
                                  </div>
                                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                                    <div className="m" style={{ fontSize: 11, fontWeight: 700, color: "#2D5A3D" }}>{fK(totalQty)}</div>
                                    {totalRes > 0 && <div style={{ fontSize: 8, color: "#C0714A" }}>{fK(totalRes)} rsv · {fK(totalAv)} avail</div>}
                                  </div>
                                </div>
                              );
                            })()}
                            {whPosFiltered.length === 0 && whNegFiltered.length === 0 && (
                              <div style={{ padding: "12px 0", textAlign: "center", fontSize: 10, color: "#95A09C", fontStyle: "italic" }}>{selWhLoc !== "All" ? "No stock at " + selWhLoc : "No stock items in this warehouse"}</div>
                            )}
                          </div>

                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "#2D5A3D", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "#fff" }} onClick={(e) => { e.stopPropagation(); setPg("stock"); setWhFs(new Set([x.name])); }}>View All Stock →</button>
                          <button style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #E4E1DC", background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "#64706C" }} onClick={(e) => { e.stopPropagation(); }}>Transfer Stock</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════ SUPPLIER STATEMENT PAGE ═══════════════ */}
        {pg === "stmt" && (
          <div style={{ padding: isMob ? 10 : 18 }}>
            {/* Supplier selector + period */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
              {/* Supplier dropdown */}
              <div style={{ position: "relative", minWidth: 280, flex: 1, maxWidth: 450 }}>
                <label style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Supplier</label>
                <div
                  style={{ border: "1px solid #E4E1DC", borderRadius: 8, padding: "8px 12px", cursor: "pointer", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}
                  onClick={() => setStmtDropdownOpen(!stmtDropdownOpen)}
                >
                  <span style={{ color: stmtSupplierId ? "#2C3E50" : "#95A09C" }}>
                    {stmtSupplierName || "Select a supplier..."}
                  </span>
                  <span style={{ fontSize: 10, color: "#95A09C" }}>{stmtDropdownOpen ? "\u25B2" : "\u25BC"}</span>
                </div>
                {stmtDropdownOpen && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #E4E1DC", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.1)", zIndex: 100, maxHeight: 300, overflow: "auto", marginTop: 2 }}>
                    <div style={{ padding: 6, borderBottom: "1px solid #E4E1DC" }}>
                      <input
                        type="text" placeholder="Search suppliers..." value={stmtSupplierSearch}
                        onChange={(e) => setStmtSupplierSearch(e.target.value)}
                        style={{ width: "100%", border: "1px solid #E4E1DC", borderRadius: 6, padding: "6px 10px", fontSize: 11, outline: "none" }}
                        autoFocus
                      />
                    </div>
                    {(stmtSuppliers || []).filter(s => !stmtSupplierSearch || s.name.toLowerCase().includes(stmtSupplierSearch.toLowerCase())).map(s => (
                      <div
                        key={s.id}
                        style={{ padding: "8px 12px", fontSize: 11, cursor: "pointer", background: s.id === stmtSupplierId ? "#E4EFE6" : "transparent", borderBottom: "1px solid #f5f5f3" }}
                        onClick={() => { setStmtSupplierId(s.id); setStmtDropdownOpen(false); setStmtSupplierSearch(""); }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F5F0")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = s.id === stmtSupplierId ? "#E4EFE6" : "transparent")}
                      >
                        {s.name.replace(/^\d[\d-]*-/, "").trim()}
                      </div>
                    ))}
                    {(stmtSuppliers || []).filter(s => !stmtSupplierSearch || s.name.toLowerCase().includes(stmtSupplierSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding: "12px", fontSize: 11, color: "#95A09C", textAlign: "center" }}>No suppliers found</div>
                    )}
                  </div>
                )}
              </div>

              {/* Period selector */}
              <div>
                <label style={{ fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Period</label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {(["7d", "30d", "90d", "all", "custom"] as const).map(p => (
                    <button key={p} onClick={() => setStmtPeriod(p)} style={{ padding: "6px 12px", borderRadius: 99, border: stmtPeriod === p ? "none" : "1px solid #E4E1DC", background: stmtPeriod === p ? "#2D5A3D" : "#fff", color: stmtPeriod === p ? "#fff" : "#64706C", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      {p === "7d" ? "Last 7 Days" : p === "30d" ? "Last 30 Days" : p === "90d" ? "Last 90 Days" : p === "all" ? "All Time" : "Custom"}
                    </button>
                  ))}
                </div>
                {stmtPeriod === "custom" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#64706C" }}>FROM</span>
                    <input type="date" value={stmtDateFrom} onChange={(e) => setStmtDateFrom(e.target.value)} style={{ border: "1px solid #E4E1DC", borderRadius: 6, padding: "5px 8px", fontSize: 11, fontFamily: "inherit" }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#64706C" }}>TO</span>
                    <input type="date" value={stmtDateTo} onChange={(e) => setStmtDateTo(e.target.value)} style={{ border: "1px solid #E4E1DC", borderRadius: 6, padding: "5px 8px", fontSize: 11, fontFamily: "inherit" }} />
                  </div>
                )}
              </div>

              {/* Export PDF button */}
              {stmtSupplierId && stmtData && stmtData.rows.length > 0 && (
                <div style={{ marginLeft: "auto", alignSelf: "flex-end" }}>
                  <button
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.set("supplierId", String(stmtSupplierId));
                      if (companyIdNum) params.set("companyId", String(companyIdNum));
                      if (stmtComputedDates.from) params.set("dateFrom", stmtComputedDates.from);
                      if (stmtComputedDates.to) params.set("dateTo", stmtComputedDates.to);
                      const selSupp = stmtSuppliers?.find((s: any) => s.id === stmtSupplierId);
                      if (selSupp) params.set("supplierName", selSupp.name.replace(/^\d[\d-]*-/, "").trim());
                      params.set("period", stmtPeriod === "7d" ? "Last 7 Days" : stmtPeriod === "30d" ? "Last 30 Days" : stmtPeriod === "90d" ? "Last 90 Days" : stmtPeriod === "custom" ? "Custom" : "All Time");
                      window.open(`/api/supplier-statement-pdf?${params.toString()}`, "_blank");
                    }}
                    style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#C0714A", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span>📄</span> Export PDF
                  </button>
                </div>
              )}
            </div>

            {/* No supplier selected state */}
            {!stmtSupplierId && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#2C3E50", marginBottom: 6 }}>Select a Supplier</div>
                <div style={{ fontSize: 12, color: "#95A09C" }}>Choose a supplier from the dropdown above to view their supply statement</div>
              </div>
            )}

            {/* Loading state */}
            {stmtSupplierId && stmtLoading && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 13, color: "#95A09C" }}>Loading receipts...</div>
              </div>
            )}

            {/* Summary cards */}
            {stmtSupplierId && stmtData && !stmtLoading && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: isMob ? "repeat(2,1fr)" : "repeat(5,1fr)", gap: 10, marginBottom: 16 }}>
                  <div className="sc"><div className="sl">Receipts</div><div className="sv" style={{ fontSize: 16 }}>{stmtData.summary.receiptCount}</div></div>
                  <div className="sc"><div className="sl">Net Weight</div><div className="sv" style={{ fontSize: 16 }}>{fK(stmtData.summary.totalNetWeightTons * 1000)}</div></div>
                  <div className="sc"><div className="sl">Products</div><div className="sv" style={{ fontSize: 16 }}>{stmtData.summary.products.length}</div></div>
                  <div className="sc"><div className="sl">Warehouses</div><div className="sv" style={{ fontSize: 16 }}>{stmtData.summary.warehouses.length}</div></div>
                  <div className="sc"><div className="sl">Fodder Value</div><div className="sv" style={{ fontSize: 16 }}>{fV(Math.round(stmtData.summary.totalValue))}</div></div>
                  <div className="sc"><div className="sl">Trucking Cost</div><div className="sv" style={{ fontSize: 16, color: stmtData.summary.totalTruckingCost > 0 ? "#D4960A" : undefined }}>{stmtData.summary.totalTruckingCost > 0 ? fV(Math.round(stmtData.summary.totalTruckingCost)) : "—"}</div></div>
                  <div className="sc"><div className="sl">Grand Total</div><div className="sv" style={{ fontSize: 16, color: "#2D5A3D", fontWeight: 700 }}>{fV(Math.round((stmtData.summary.grandTotal ?? stmtData.summary.totalValue)))}</div></div>
                </div>

                {/* Search */}
                <div style={{ marginBottom: 12 }}>
                  <input
                    type="text" placeholder="Search by PO#, shipment, product, warehouse, officer..."
                    value={stmtSearch} onChange={(e) => setStmtSearch(e.target.value)}
                    style={{ width: "100%", maxWidth: 400, border: "1px solid #E4E1DC", borderRadius: 8, padding: "8px 12px", fontSize: 11, outline: "none", fontFamily: "inherit" }}
                  />
                </div>

                {/* Table header */}
                <div className="xc">
                  <div className="xh" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3>📋 {stmtSupplierName} — Receipts ({stmtRows.length})</h3>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,.6)" }}>
                      {stmtComputedDates.from && stmtComputedDates.to ? `${stmtComputedDates.from} → ${stmtComputedDates.to}` : "All Time"}
                    </span>
                  </div>

                  {/* Table */}
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #E4E1DC" }}>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", whiteSpace: "nowrap" }}>#</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", whiteSpace: "nowrap" }}>Loading Date</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", whiteSpace: "nowrap" }}>PO #</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", whiteSpace: "nowrap" }}>Shipment #</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", whiteSpace: "nowrap" }}>TL Serial</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", whiteSpace: "nowrap" }}>Load/Container</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", whiteSpace: "nowrap" }}>Product</th>
                          <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", whiteSpace: "nowrap" }}>Net Weight (t)</th>
                          <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", whiteSpace: "nowrap" }}>Price/Ton</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", whiteSpace: "nowrap" }}>Currency</th>
                          <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", whiteSpace: "nowrap" }}>Fodder Value</th>
                          <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 9, fontWeight: 700, color: "#D4960A", textTransform: "uppercase", whiteSpace: "nowrap" }}>Trucking Cost</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", whiteSpace: "nowrap" }}>Grade</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", whiteSpace: "nowrap" }}>Warehouse</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#4A7C59", textTransform: "uppercase", whiteSpace: "nowrap" }}>Officer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stmtRows.map((r, i) => (
                          <tr key={r.id} style={{ borderBottom: "1px solid #F0EFEC", background: i % 2 === 0 ? "#fff" : "#FAFAF8" }}>
                            <td style={{ padding: "7px 10px", fontSize: 10, color: "#95A09C" }}>{i + 1}</td>
                            <td style={{ padding: "7px 10px", whiteSpace: "nowrap", fontSize: 10 }}>{r.loadingDate ? new Date(r.loadingDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "\u2014"}</td>
                            <td style={{ padding: "7px 10px", fontWeight: 600, fontSize: 10, color: "#2D5A3D" }}>{r.poNumber}</td>
                            <td style={{ padding: "7px 10px", fontSize: 10 }}>{r.shipmentRef}</td>
                            <td style={{ padding: "7px 10px", fontSize: 10 }}>{r.truckLoadSerial}</td>
                            <td style={{ padding: "7px 10px", fontSize: 10 }}>{r.containerNumber}</td>
                            <td style={{ padding: "7px 10px", fontSize: 10, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.product}>{r.product}</td>
                            <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 600, fontSize: 10 }}>{r.netWeightTons > 0 ? r.netWeightTons.toFixed(2) : "\u2014"}</td>
                            <td style={{ padding: "7px 10px", textAlign: "right", fontSize: 10 }}>{r.pricePerTon > 0 ? r.pricePerTon.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "\u2014"}</td>
                            <td style={{ padding: "7px 10px", fontSize: 10 }}>{r.currency || "\u2014"}</td>
                            <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 600, fontSize: 10 }}>{r.totalValue > 0 ? fV(Math.round(r.totalValue)) : "\u2014"}</td>
                            <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 600, fontSize: 10, color: r.truckingCost > 0 ? "#D4960A" : "#95A09C" }}>{r.truckingCost > 0 ? fV(Math.round(r.truckingCost)) : "\u2014"}</td>
                            <td style={{ padding: "7px 10px", fontSize: 10 }}>
                              {r.grade !== "\u2014" ? (
                                <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 9, fontWeight: 600, background: r.grade === "grade_1" ? "#E4EFE6" : r.grade === "grade_3" ? "#FDF6EC" : "#F0EFEC", color: r.grade === "grade_1" ? "#2D5A3D" : r.grade === "grade_3" ? "#D4960A" : "#64706C" }}>
                                  {r.grade.replace("grade_", "Grade ")}
                                </span>
                              ) : "\u2014"}
                            </td>
                            <td style={{ padding: "7px 10px", fontSize: 9, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.warehouse}>{r.warehouse.replace(/:.*/g, "")}</td>
                            <td style={{ padding: "7px 10px", fontSize: 10 }}>{r.officer}</td>
                          </tr>
                        ))}
                        {stmtRows.length === 0 && (
                          <tr><td colSpan={15} style={{ padding: "20px", textAlign: "center", fontSize: 11, color: "#95A09C" }}>No receipts found for this supplier in the selected period</td></tr>
                        )}
                      </tbody>
                      {stmtRows.length > 0 && (
                        <tfoot>
                          <tr style={{ borderTop: "2px solid #2D5A3D", background: "#E4EFE6" }}>
                            <td colSpan={7} style={{ padding: "8px 10px", fontSize: 10, fontWeight: 700, color: "#2D5A3D" }}>TOTALS ({stmtRows.length} receipts)</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, fontSize: 10, color: "#2D5A3D" }}>{stmtRows.reduce((s, r) => s + r.netWeightTons, 0).toFixed(2)}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, fontSize: 9, color: "#64706C" }}>avg {stmtData.summary.avgPricePerTon.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td style={{ padding: "8px 10px" }}></td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, fontSize: 10, color: "#2D5A3D" }}>{fV(Math.round(stmtRows.reduce((s, r) => s + r.totalValue, 0)))}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, fontSize: 10, color: "#D4960A" }}>{stmtData.summary.totalTruckingCost > 0 ? fV(Math.round(stmtData.summary.totalTruckingCost)) : "\u2014"}</td>
                            <td colSpan={3} style={{ padding: "8px 10px" }}></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {pg === "periodic" && (
          <div style={{ padding: isMob ? "12px" : "24px" }}>
            <PeriodicInventoryDashboard />
          </div>
        )}

        {pg === "transfers" && (
          <DakhlaSokhnaTransfers isMob={isMob} />
        )}
      </div>
    </div>
  );
}
