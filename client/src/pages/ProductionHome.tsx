// ══════════════════════════════════════════════════════════════════════════════
// PRODUCTION HOME — Platfarm V3 — Double Press Production Module Shell
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import {
  C, FONT, USERS_SEED, ROLES,
  resolvePerms,
  type UserDef,
} from "@/lib/data";
import { trpc } from "@/lib/trpc";
import { RoleBadge } from "@/components/ui-primitives";
import { ShimmerBox } from "@/components/LoadingIndicators";
import { PageTransition } from "@/components/PageTransition";
import { useAuth } from "@/_core/hooks/useAuth";
import { ProductionDashboard } from "./ProductionDashboard";
import { ProductionList } from "./ProductionList";
import { ProductionDetail } from "./ProductionDetail";
import { CreateProductionOrder } from "@/components/CreateProductionOrder";
import { PlatfarmLogo } from "@/components/PlatfarmLogo";


type Page = "dashboard" | "orders" | "order-detail";

export default function ProductionHome() {
  // ─── Create Production Order Wizard ─────────────────────────────────────
  const [showCreateOrder, setShowCreateOrder] = useState(false);

  // ─── RBAC State ─────────────────────────────────────────────────────────
  const [users] = useState<UserDef[]>(USERS_SEED);
  const [currentUserId] = useState("ahmed");
  const currentUser = useMemo(() => users.find(u => u.id === currentUserId) || users[0], [users, currentUserId]);
  const perms = useMemo(() => resolvePerms(currentUser), [currentUser]);
  const { user: authUser } = useAuth();
  const displayName = authUser?.name || currentUser.name;
  const displayInitials = useMemo(() => {
    if (authUser?.name) {
      const parts = authUser.name.trim().split(/\s+/);
      return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
    }
    return currentUser.initials;
  }, [authUser?.name, currentUser.initials]);
  const displayRole = authUser?.role === "admin" ? "admin" : currentUser.role;

  // ─── Navigation State ───────────────────────────────────────────────────
  const [location, setLocation] = useLocation();

  const getPageFromPath = useCallback((path: string): Page => {
    const cleanPath = path.split("?")[0].replace(/\/$/, "") || "/";
    if (cleanPath === "/production/orders" || cleanPath === "/production/orders/") return "orders";
    return "dashboard";
  }, []);

  const [page, setPageInternal] = useState<Page>(() => getPageFromPath(location));

  const setPage = useCallback((p: Page) => {
    setPageInternal(p);
    const pathMap: Record<Page, string> = {
      dashboard: "/production",
      orders: "/production/orders",
      "order-detail": "/production/orders",
    };
    setLocation(pathMap[p] || "/production");
  }, [setLocation]);

  useEffect(() => {
    const handlePopState = () => {
      const newPage = getPageFromPath(window.location.pathname);
      setPageInternal(newPage);
      if (newPage !== "order-detail") {
        setSelectedOrderId(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [getPageFromPath]);

  useEffect(() => {
    const titles: Record<string, string> = {
      dashboard: "Production Dashboard - Platfarm",
      orders: "Production Orders - Platfarm",
      "order-detail": "Production Order - Platfarm",
    };
    document.title = titles[page] || "Double Press Production - Platfarm";
  }, [page]);

  const [collapsed, setCollapsed] = useState(false);
  const [activeCompany, setActiveCompanyRaw] = useState<string>("ALL");
  const companiesResolvedRef = useRef(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const companyRef = useRef<HTMLDivElement>(null);

  // ─── Order Detail State ─────────────────────────────────────────────────
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) setCompanyDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Navigation Handlers ───────────────────────────────────────────────
  const navPage = useCallback((p: Page) => {
    setPage(p); setSelectedOrderId(null);
  }, [setPage]);

    // ─── Odoo Companies ──────────────────────────────────────────────
  const { data: odooCompanies, isLoading: companiesLoading } = trpc.odoo.companies.useQuery();
  const { data: companyAccessData } = trpc.userMgmt.myCompanyAccess.useQuery();

  // Double Press Production is only available for Sokhna and Cairo companies
  const DOUBLE_PRESS_COMPANIES = ["sokhna", "cairo"];

  const companies = useMemo(() => {
    if (!companyAccessData) return []; // wait for access data
    const { allowedCompanyIds } = companyAccessData;
    return (odooCompanies ?? [])
      .filter(c => DOUBLE_PRESS_COMPANIES.some(dp => c.name?.toLowerCase().includes(dp)))
      .filter(c => !allowedCompanyIds.length || allowedCompanyIds.includes(c.id))
      .map(c => ({
        id: String(c.id),
        odooId: c.id,
        name: c.name,
        displayName: c.displayName,
        currency: c.currency,
        country: c.country,
      }));
  }, [odooCompanies, companyAccessData]);

  // Resolve localStorage company once companies + access data are loaded
  useEffect(() => {
    if (companiesResolvedRef.current || !companies.length || !companyAccessData) return;
    companiesResolvedRef.current = true;
    const { defaultCompanyId } = companyAccessData;
    const userIsAdmin = companyAccessData.isAdmin || companyAccessData.allowedCompanyIds.length === 0;

    // RESTRICTED USERS: admin-configured default ALWAYS wins
    if (!userIsAdmin) {
      if (defaultCompanyId !== null) {
        const co = companies.find(c => c.odooId === defaultCompanyId);
        if (co) { setActiveCompanyRaw(co.id); localStorage.setItem('platfarm_company', JSON.stringify({ id: co.odooId, name: co.name })); return; }
      }
      if (companies.length > 0) { setActiveCompanyRaw(companies[0].id); localStorage.setItem('platfarm_company', JSON.stringify({ id: companies[0].odooId, name: companies[0].name })); }
      return;
    }

    // ADMIN USERS: respect localStorage, then fallback
    if (defaultCompanyId !== null) {
      const co = companies.find(c => c.odooId === defaultCompanyId);
      if (co && !localStorage.getItem('platfarm_company')) { setActiveCompanyRaw(co.id); localStorage.setItem('platfarm_company', JSON.stringify({ id: co.odooId, name: co.name })); return; }
    }
    const saved = localStorage.getItem('platfarm_company');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (typeof p.id === 'number') { const co = companies.find(c => c.odooId === p.id); if (co) { setActiveCompanyRaw(co.id); return; } }
        const name = typeof p === 'string' ? p : p.name;
        if (name && name !== 'All Companies') { const co = companies.find(c => c.name === name); if (co) { setActiveCompanyRaw(co.id); return; } }
      } catch { /* ignore */ }
    }
    const cairo = companies.find(c => c.name?.toLowerCase().includes('cairo'));
    if (cairo) { setActiveCompanyRaw(cairo.id); localStorage.setItem('platfarm_company', JSON.stringify({ id: cairo.odooId, name: cairo.name })); return; }
    if (companies.length > 0) { setActiveCompanyRaw(companies[0].id); localStorage.setItem('platfarm_company', JSON.stringify({ id: companies[0].odooId, name: companies[0].name })); }
  }, [companies, companyAccessData]);
  // If restricted user has "ALL" selected (stale localStorage), reset to first allowed company
  useEffect(() => {
    if (!companyAccessData || !companies.length) return;
    const isAdm = companyAccessData.isAdmin || companyAccessData.allowedCompanyIds.length === 0;
    if (!isAdm && activeCompany === "ALL") {
      const first = companies[0];
      if (first) {
        setActiveCompanyRaw(first.id);
        localStorage.setItem('platfarm_company', JSON.stringify({ id: first.odooId, name: first.name }));
      }
    }
  }, [companyAccessData, companies, activeCompany]);
  const setActiveCompany = (val: string) => {
    setActiveCompanyRaw(val);
    if (val === 'ALL') {
      localStorage.setItem('platfarm_company', JSON.stringify({ id: 'ALL', name: 'All Companies' }));
    } else {
      const comp = companies.find(c => c.id === val);
      if (comp) localStorage.setItem('platfarm_company', JSON.stringify({ id: comp.odooId, name: comp.name }));
    }
  };

  const activeCompanyObj = companies.find(c => c.id === activeCompany);
  const companyLabel = activeCompany === "ALL" ? "All Companies" : activeCompanyObj?.name || activeCompany;
  const isCompanyAdmin = !!companyAccessData && (companyAccessData.isAdmin || companyAccessData.allowedCompanyIds.length === 0);

  const navItems = [
    { id: "dashboard" as Page, label: "Dashboard", icon: "◈", sub: "Overview" },
    { id: "orders" as Page, label: "Production Orders", icon: "▣", sub: "Double Press" },
  ];

  const pageTitle: Record<string, string> = {
    dashboard: "Production Dashboard",
    orders: "Production Orders",
    "order-detail": "Production Order",
  };

  return (
    <div style={{
      display: "flex", height: "100vh", background: C.pageBg,
      fontFamily: FONT, color: C.dark, overflow: "hidden",
    }}>
      {/* Top accent bar */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg,${C.forest},${C.terra})`, zIndex: 100,
      }} />
      <style>{`
        .app-sb-ni{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;transition:background .15s;font-size:12px;font-weight:500;color:#64706C;white-space:nowrap;overflow:hidden;border-right:3px solid transparent}
        .app-sb-ni:hover{background:#F2F7F3}
        .app-sb-ni.app-sb-act{background:#E4EFE6;color:#2D5A3D;font-weight:700;border-right-color:#2D5A3D}
        .app-sb-ns{font-size:9px;color:#95A09C;margin-top:1px;font-weight:400}
      `}</style>


      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <div style={{
        width: collapsed ? 48 : 190, minWidth: collapsed ? 48 : 190,
        background: "#fff", borderRight: "1px solid #E4E1DC",
        display: "flex", flexDirection: "column",
        transition: "width .2s, min-width .2s", marginTop: 3, overflow: "hidden",
      }}>
        {/* Logo */}
        <div onClick={() => setCollapsed(!collapsed)}
          style={{ padding: "9px 10px", borderBottom: "1px solid #E4E1DC", cursor: "pointer", display: "flex", alignItems: "center" }}
        >
          <PlatfarmLogo height={collapsed ? 24 : 28} treeColor="#1B3A2D" textColor="#D4845F" />
        </div>
        {/* Nav */}
        <div style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          <div className="app-sb-ni" onClick={() => setLocation("/")} style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 15 }}>🏠</span>{!collapsed && <span>Home</span>}
          </div>
          {navItems.map(item => {
            const active = page === item.id || (item.id === "orders" && page === "order-detail");
            return (
              <div key={item.id} className={`app-sb-ni ${active ? "app-sb-act" : ""}`} onClick={() => navPage(item.id)}>
                <span style={{ fontSize: 13 }}>{item.icon}</span>
                {!collapsed && <div>{item.label}{item.sub && <div className="app-sb-ns">{item.sub}</div>}</div>}
              </div>
            );
          })}
        </div>
        {/* User */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid #E4E1DC", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: ROLES[displayRole]?.color || "#2D5A3D", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{displayInitials}</div>
          {!collapsed && <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#2C3E50", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
            <div style={{ fontSize: 8, color: "#B0BAB6" }}>{ROLES[displayRole]?.label || "User"}</div>
          </div>}
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", marginTop: 3 }}>
        {/* Header */}
        <div style={{
          height: 40, minHeight: 40, borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 18px", background: C.card, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{pageTitle[page] || "Production"}</span>
            <RoleBadge role={displayRole} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Company selector */}
            {isCompanyAdmin && (
              <div ref={companyRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setCompanyDropdownOpen(d => !d)}
                  style={{
                    fontSize: 10, padding: "3px 8px", borderRadius: 4,
                    border: `1px solid ${C.gBdr}`, background: C.gBg,
                    cursor: "pointer", color: C.forest, fontWeight: 600,
                  }}
                >
                  {companyLabel} ▾
                </button>
                {companyDropdownOpen && (
                  <div style={{
                    position: "absolute", right: 0, top: "110%", background: C.card,
                    border: `1px solid ${C.border}`, borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,.12)",
                    zIndex: 200, minWidth: 140,
                  }}>
                    <div
                      style={{ padding: "6px 12px", cursor: "pointer", fontSize: 11, background: activeCompany === "ALL" ? C.gBg2 : "transparent" }}
                      onClick={() => { setActiveCompany("ALL"); setCompanyDropdownOpen(false); }}
                    >All Companies</div>
                    {companies.map(c => (
                      <div
                        key={c.id}
                        style={{ padding: "6px 12px", cursor: "pointer", fontSize: 11, background: activeCompany === c.id ? C.gBg2 : "transparent" }}
                        onClick={() => { setActiveCompany(c.id); setCompanyDropdownOpen(false); }}
                      >{c.displayName || c.name}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <span style={{ fontSize: 10, color: C.muted }}>
              {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>
        {/* Page content */}
        <PageTransition pageKey={page} style={{ flex: 1, overflow: "hidden" }}>
          {page === "dashboard" && (
            <ProductionDashboard
              activeCompanyId={activeCompany === "ALL" ? undefined : activeCompanyObj?.odooId?.toString()}
              onNavDetail={(id) => { setSelectedOrderId(id); setPage("order-detail"); }}
              onNavList={(stateFilter) => { setPage("orders"); }}
              onCreateNew={() => setShowCreateOrder(true)}
            />
          )}
          {(page === "orders" || page === "order-detail") && !selectedOrderId && (
            <ProductionList
              activeCompanyId={activeCompany === "ALL" ? undefined : activeCompanyObj?.odooId?.toString()}
              onNavDetail={(id) => { setSelectedOrderId(id); setPage("order-detail"); }}
              onCreateNew={() => setShowCreateOrder(true)}
              onBack={() => setPage("dashboard")}
            />
          )}
          {page === "order-detail" && selectedOrderId && (
            <ProductionDetail
              moId={selectedOrderId}
              onBack={() => { setSelectedOrderId(null); setPage("orders"); }}
            />
          )}
        </PageTransition>
        {/* Mobile bottom bar */}
        <style>{`
          @media(max-width:767px){
            .prod-mob-bar{display:flex!important}
          }
          @media(min-width:768px){.prod-mob-bar{display:none!important}}
        `}</style>
        <div className="prod-mob-bar" style={{
          display: "none", position: "fixed", bottom: 0, left: 0, right: 0,
          background: "#fff", borderTop: "1px solid #E4E1DC", zIndex: 100,
          padding: "4px 0", justifyContent: "space-around", alignItems: "center",
        }}>
          {[
            { id: "dashboard", icon: "📊", label: "Dashboard" },
            { id: "orders", icon: "📦", label: "Orders" },
          ].map(({ id, icon, label }) => (
            <div key={id}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: "4px 6px", cursor: "pointer", fontSize: 8, color: page === id ? "#2D5A3D" : "#64706C", fontWeight: page === id ? 700 : 400 }}
              onClick={() => navPage(id as Page)}
            >
              <span style={{ fontSize: 14 }}>{icon}</span>{label}
            </div>
          ))}
          <div
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: "4px 6px", cursor: "pointer", fontSize: 8, color: "#64706C" }}
            onClick={() => setLocation("/")}
          ><span style={{ fontSize: 14 }}>🏠</span>Home</div>
        </div>
      </div>
      {/* Create Production Order modal */}
      {showCreateOrder && (
        <CreateProductionOrder
          onClose={() => setShowCreateOrder(false)}
          onSuccess={(moId) => { setShowCreateOrder(false); setSelectedOrderId(moId); setPage("order-detail"); }}
        />
      )}
    </div>
  );
}
