// ══════════════════════════════════════════════════════════════════════════════
// HOME — Platfarm V3 — Main App Shell with RBAC, user switching, company selector
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import {
  C, FONT, MONO, USERS_SEED, ROLES,
  resolvePerms,
  type UserDef,
} from "@/lib/data";
import { trpc } from "@/lib/trpc";
import { Badge, RoleBadge } from "@/components/ui-primitives";
import { Dashboard } from "./Dashboard";
import { AgrPage } from "./Agreements";
import { UserMgmt } from "./UserMgmt";
import { SystemUserMgmt } from "./SystemUserMgmt";
import { useAuth } from "@/_core/hooks/useAuth";
import { OdooShipList } from "./OdooShipList";
import { OdooShipDetail } from "./OdooShipDetail";
import { CreateOdooShipment } from "@/components/CreateOdooShipment";
import { OdooSalesShipList } from "./OdooSalesShipList";
import { OdooSalesShipDetail } from "./OdooSalesShipDetail";
import { CreateOdooSalesShipment } from "@/components/CreateOdooSalesShipment";
import { CreateMultiLinkedShipment } from "@/components/CreateMultiLinkedShipment";
import { NotificationBell } from "@/components/NotificationBell";
import { ShimmerBox } from "@/components/LoadingIndicators";
import { PageTransition } from "@/components/PageTransition";
import { StatusChangeToast } from "@/components/StatusChangeToast";
import { PlatfarmLogo } from "@/components/PlatfarmLogo";

type Page = "dashboard" | "purchase" | "sales" | "agreements" | "users"
  | "odoo-ship-detail" | "odoo-sales-detail";

export default function Home() {
  // ─── Create Shipment Wizard ─────────────────────────────────────────────
  const [showCreateOdooShipment, setShowCreateOdooShipment] = useState(false);
  const [showCreateOdooSalesShipment, setShowCreateOdooSalesShipment] = useState(false);
  const [showCreateMultiLinked, setShowCreateMultiLinked] = useState(false);
  const [resumeDraftId, setResumeDraftId] = useState<number | undefined>(undefined);

  const handleResumeDraft = useCallback((draftId: number, wizardType: string) => {
    setResumeDraftId(draftId);
    if (wizardType === "purchase") setShowCreateOdooShipment(true);
    else if (wizardType === "sales") setShowCreateOdooSalesShipment(true);
    else if (wizardType === "multi_linked") setShowCreateMultiLinked(true);
  }, []);

  // ─── RBAC State ─────────────────────────────────────────────────────────
  const [users, setUsers] = useState<UserDef[]>(USERS_SEED);
  const [currentUserId, setCurrentUserId] = useState("ahmed");
  const currentUser = useMemo(() => users.find(u => u.id === currentUserId) || users[0], [users, currentUserId]);
  const perms = useMemo(() => resolvePerms(currentUser), [currentUser]);
  const { user: authUser } = useAuth();
  const isSystemAdmin = authUser?.role === "admin";
  const displayName = authUser?.name || currentUser.name;
  const displayInitials = useMemo(() => {
    if (authUser?.name) {
      const parts = authUser.name.trim().split(/\s+/);
      return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
    }
    return currentUser.initials;
  }, [authUser?.name, currentUser.initials]);
  const displayRole = authUser?.role === "admin" ? "admin" : currentUser.role;

  // ─── Navigation State (synced with URL for deep-linking) ────────────────
  const [location, setLocation] = useLocation();

  // Map URL path to page state (strip query params)
  const getPageFromPath = useCallback((path: string): Page => {
    const cleanPath = path.split("?")[0].replace(/\/$/, "") || "/";
    if (cleanPath === "/purchase") return "purchase";
    if (cleanPath === "/sales") return "sales";
    if (cleanPath === "/agreements") return "agreements";
    if (cleanPath === "/users") return "users";
    return "dashboard";
  }, []);

  const [page, setPageInternal] = useState<Page>(() => getPageFromPath(location));

  // Wrap setPage to also update the URL
  const setPage = useCallback((p: Page) => {
    setPageInternal(p);
    const pathMap: Record<Page, string> = {
      dashboard: "/dashboard",
      purchase: "/purchase",
      sales: "/sales",
      agreements: "/agreements",
      users: "/users",
      "odoo-ship-detail": "/purchase",
      "odoo-sales-detail": "/sales",
    };
    setLocation(pathMap[p] || "/");
  }, [setLocation]);

  // Browser back/forward support: sync page state when URL changes via popstate
  useEffect(() => {
    const handlePopState = () => {
      const newPage = getPageFromPath(window.location.pathname);
      setPageInternal(newPage);
      // Clear detail selections when navigating back to list pages
      if (newPage !== "odoo-ship-detail" && newPage !== "odoo-sales-detail") {
        setSelectedOdooShipmentId(null);
        setSelectedOdooSalesShipmentId(null);
        setSourceShipment(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [getPageFromPath]);

  // Update document.title based on current page
  useEffect(() => {
    const titles: Record<string, string> = {
      dashboard: "Dashboard - Platfarm",
      purchase: "Purchase Shipments - Platfarm",
      sales: "Sales Shipments - Platfarm",
      "odoo-ship-detail": "Shipment Detail - Platfarm",
      "odoo-sales-detail": "Sales Detail - Platfarm",
      agreements: "Agreements - Platfarm",
      users: "User Management - Platfarm",
    };
    document.title = titles[page] || "Platfarm";
  }, [page]);
  const [collapsed, setCollapsed] = useState(false);
  // Mobile responsive hook
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:767px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mq);
    mq.addEventListener('change', handler as any);
    return () => mq.removeEventListener('change', handler as any);
  }, []);
  const [activeCompany, setActiveCompanyRaw] = useState<string>("ALL");
  const companiesResolvedRef = useRef(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const companyRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // ─── Odoo Shipment Detail State ─────────────────────────────────────────
  const [selectedOdooShipmentId, setSelectedOdooShipmentId] = useState<number | null>(null);
  const [selectedOdooSalesShipmentId, setSelectedOdooSalesShipmentId] = useState<number | null>(null);

  // ─── Source Shipment Breadcrumb (tracks where we came from when navigating via linked banner) ──
  const [sourceShipment, setSourceShipment] = useState<{
    type: "purchase" | "sales";
    id: number;
    name: string;
  } | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) setCompanyDropdownOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Navigation Handlers ───────────────────────────────────────────────
  const navPage = useCallback((p: Page) => {
    setPage(p); setSelectedOdooShipmentId(null); setSelectedOdooSalesShipmentId(null);
  }, [setPage]);

  const roleChange = useCallback((userId: string, newRole: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  }, []);

  // ─── Navigate to linked shipment by name (stays within portal) ──────────
  const handleNavigateToShipment = useCallback(async (
    type: "purchase" | "sales",
    nameOrId: string,
    currentShipmentName?: string,
  ) => {
    try {
      // Track the source shipment for breadcrumb navigation
      // Determine the source type based on which detail page we're currently on:
      // - If on odoo-ship-detail → source is "purchase" (selectedOdooShipmentId)
      // - If on odoo-sales-detail → source is "sales" (selectedOdooSalesShipmentId)
      if (currentShipmentName) {
        if (selectedOdooShipmentId && page === "odoo-ship-detail") {
          setSourceShipment({ type: "purchase", id: selectedOdooShipmentId, name: currentShipmentName });
        } else if (selectedOdooSalesShipmentId && page === "odoo-sales-detail") {
          setSourceShipment({ type: "sales", id: selectedOdooSalesShipmentId, name: currentShipmentName });
        }
      }

      const lookupEndpoint = type === "purchase"
        ? "shipments.lookupByName"
        : "salesShipments.lookupByName";
      // tRPC uses superjson transformer, so input must be wrapped in { json: ... }
      const input = JSON.stringify({ json: { name: nameOrId } });
      const res = await fetch(`/api/trpc/${lookupEndpoint}?input=${encodeURIComponent(input)}`);
      const json = await res.json();
      const id = json?.result?.data?.json?.id;
      if (id) {
        if (type === "purchase") {
          setSelectedOdooShipmentId(id);
          setPage("odoo-ship-detail");
        } else {
          setSelectedOdooSalesShipmentId(id);
          setPage("odoo-sales-detail");
        }
      }
    } catch (err) {
      console.error("Failed to navigate to linked shipment:", err);
    }
  }, [selectedOdooShipmentId, selectedOdooSalesShipmentId, page]);

  // ─── Computed ───────────────────────────────────────────────────────────
   // ─── Odoo Companies (live from API) ─────────────────────────────────
  const { data: odooCompanies, isLoading: companiesLoading } = trpc.odoo.companies.useQuery();
  // Fetch user's company access settings (filters which companies are visible)
  const { data: companyAccessData } = trpc.userMgmt.myCompanyAccess.useQuery();
  // DEBUG: trace company access
  const allCompaniesRaw = useMemo(() => (odooCompanies ?? []).map(c => ({
    id: String(c.id),
    odooId: c.id,
    name: c.name,
    displayName: c.displayName,
    currency: c.currency,
    country: c.country,
  })), [odooCompanies]);
  // Filter companies by user's allowed list (empty = no restriction = all)
  const companies = useMemo(() => {
    if (!companyAccessData) return []; // wait for access data to avoid flash
    const { allowedCompanyIds } = companyAccessData;
    if (!allowedCompanyIds.length) return allCompaniesRaw; // admin or unconfigured = all
    return allCompaniesRaw.filter(c => allowedCompanyIds.includes(c.odooId));
  }, [allCompaniesRaw, companyAccessData]);
  // Resolve localStorage company name to company ID once companies are loaded
  useEffect(() => {
    if (companiesResolvedRef.current || !companies.length || !companyAccessData) return;
    companiesResolvedRef.current = true;
    const { defaultCompanyId } = companyAccessData;
    const userIsAdmin = companyAccessData.isAdmin || companyAccessData.allowedCompanyIds.length === 0;

    // ── RESTRICTED USERS: admin-configured default ALWAYS wins ──
    if (!userIsAdmin) {
      if (defaultCompanyId !== null) {
        const co = companies.find(c => c.odooId === defaultCompanyId);
        if (co) {
          setActiveCompanyRaw(co.id);
          localStorage.setItem('platfarm_company', JSON.stringify({ id: co.odooId, name: co.name }));
          return;
        }
      }
      // Fallback: first allowed company
      if (companies.length > 0) {
        setActiveCompanyRaw(companies[0].id);
        localStorage.setItem('platfarm_company', JSON.stringify({ id: companies[0].odooId, name: companies[0].name }));
      }
      return;
    }

    // ── ADMIN USERS: respect localStorage, then fallback ──
    // Priority 1: admin-configured default (only if no valid localStorage)
    if (defaultCompanyId !== null) {
      const co = companies.find(c => c.odooId === defaultCompanyId);
      if (co) {
        const saved = localStorage.getItem('platfarm_company');
        if (!saved) {
          setActiveCompanyRaw(co.id);
          localStorage.setItem('platfarm_company', JSON.stringify({ id: co.odooId, name: co.name }));
          return;
        }
      }
    }
    // Priority 2: previously saved company (if still in allowed list)
    const saved = localStorage.getItem('platfarm_company');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.id === 'ALL') { return; }
        if (typeof p.id === 'number') {
          const co = companies.find(c => c.odooId === p.id);
          if (co) { setActiveCompanyRaw(co.id); return; }
        }
        // Legacy plain string
        const name = typeof p === 'string' ? p : p.name;
        if (name && name !== 'All Companies') {
          const co = companies.find(c => c.name === name || c.name?.toLowerCase().includes(name.toLowerCase()));
          if (co) { setActiveCompanyRaw(co.id); localStorage.setItem('platfarm_company', JSON.stringify({ id: co.odooId, name: co.name })); return; }
        }
      } catch { /* ignore */ }
    }
    // Priority 3: Cairo fallback
    const cairo = companies.find(c => c.name?.toLowerCase().includes('cairo'));
    if (cairo) {
      setActiveCompanyRaw(cairo.id);
      localStorage.setItem('platfarm_company', JSON.stringify({ id: cairo.odooId, name: cairo.name }));
      return;
    }
    // Priority 4: first company
    if (companies.length > 0) {
      setActiveCompanyRaw(companies[0].id);
      localStorage.setItem('platfarm_company', JSON.stringify({ id: companies[0].odooId, name: companies[0].name }));
    }
  }, [companies, companyAccessData]);
  // If restricted user has "ALL" selected (e.g. from stale localStorage), reset to first allowed company
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
    { id: "dashboard" as Page, label: "Dashboard", icon: "◈", sub: "", access: "dashboard" },
    { id: "purchase" as Page, label: "Purchase Shipments", icon: "↓", sub: "Incoming (Odoo)", access: "purchase" },
    { id: "sales" as Page, label: "Sales Shipments", icon: "↑", sub: "Outgoing (Odoo)", access: "sales" },
    { id: "agreements" as Page, label: "Agreements", icon: "◫", sub: "", access: "agreements" },
    { id: "users" as Page, label: "User Management", icon: "⚙", sub: "Permissions", access: "users" },
  ].filter(item => item.id === "users" ? isSystemAdmin : perms.canAccess(item.access));

  const pageTitle: Record<string, string> = {
    dashboard: "Dashboard",
    purchase: "Purchase Shipments",
    sales: "Sales Shipments",
    "odoo-ship-detail": "Shipment Detail",
    "odoo-sales-detail": "Sales Detail",
    agreements: "Agreements",
    users: "User Management",
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

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <div className="mob-hide" style={{
        width: collapsed ? 48 : 190, minWidth: collapsed ? 48 : 190,
        background: C.card, borderRight: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column",
        transition: "width .2s, min-width .2s", marginTop: 3, overflow: "hidden",
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed ? "9px 6px" : "9px 10px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
        }} onClick={() => setCollapsed(!collapsed)}>
          <PlatfarmLogo height={collapsed ? 24 : 28} treeColor="#1B3A2D" textColor="#D4845F" />
        </div>

        {/* Back to Home */}
        <div
          onClick={() => setLocation("/")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: collapsed ? "6px" : "5px 10px",
            margin: "4px 4px 0",
            borderRadius: 5, cursor: "pointer",
            color: C.terra,
            justifyContent: collapsed ? "center" : "flex-start",
            transition: "all .15s",
            fontSize: 10, fontWeight: 600,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = C.tBg; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          {!collapsed && <span>Home</span>}
        </div>

        {/* Nav Items */}
        <div style={{ flex: 1, padding: 4, display: "flex", flexDirection: "column", gap: 1, overflow: "auto" }}>
          {navItems.map(item => {
            const active = page === item.id ||
              (item.id === "purchase" && (page === "odoo-ship-detail")) ||
              (item.id === "sales" && page === "odoo-sales-detail");
            return (
              <div key={item.id} onClick={() => navPage(item.id)} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: collapsed ? "7px" : "10px 16px", cursor: "pointer",
                background: active ? "#E4EFE6" : "transparent",
                color: active ? "#2D5A3D" : "#64706C",
                borderRight: active ? "3px solid #2D5A3D" : "3px solid transparent",
                justifyContent: collapsed ? "center" : "flex-start",
                transition: "background .15s",
                fontSize: 12, fontWeight: active ? 700 : 500,
              }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#F2F7F3"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 12, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: active ? 600 : 500 }}>{item.label}</div>
                    {item.sub && <div style={{ fontSize: 8, color: C.muted, marginTop: -1 }}>{item.sub}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* User Switcher (bottom of sidebar) */}
        {!collapsed && (
          <div ref={userRef} style={{ padding: "7px 9px", borderTop: `1px solid ${C.border}`, position: "relative" }}>
            <div
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: ROLES[displayRole]?.color || C.forest,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 700, color: C.white,
              }}>{displayInitials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 600 }}>{displayName}</div>
                <div style={{ fontSize: 8, color: C.muted }}>{ROLES[displayRole]?.label}</div>
              </div>
              <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{
                transform: userDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform .2s",
              }}>
                <path d="M1 1L4 4L7 1" stroke={C.gray} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* User Dropdown */}
            {userDropdownOpen && (
              <div style={{
                position: "absolute", bottom: "calc(100% + 4px)", left: 4, right: 4,
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 200, overflow: "hidden",
              }}>
                <div style={{ padding: "6px 10px", borderBottom: `1px solid ${C.border}`, background: C.gBg }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.sage, textTransform: "uppercase", letterSpacing: 0.8 }}>Switch User (Demo)</div>
                </div>
                {users.map(u => (
                  <div key={u.id}
                    onClick={() => { setCurrentUserId(u.id); setUserDropdownOpen(false); navPage("dashboard"); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
                      cursor: "pointer", background: u.id === currentUserId ? C.gBg2 : "transparent",
                      borderBottom: `1px solid ${C.border}`, transition: "background .1s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = C.gBg}
                    onMouseLeave={e => e.currentTarget.style.background = u.id === currentUserId ? C.gBg2 : "transparent"}
                  >
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: ROLES[u.role]?.color || C.muted,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 8, fontWeight: 700, color: C.white,
                    }}>{u.initials}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: 8, color: C.muted }}>{ROLES[u.role]?.label}</div>
                    </div>
                    {u.id === currentUserId && <span style={{ fontSize: 10, color: C.forest, fontWeight: 700 }}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", marginTop: 3, marginLeft: isMobile ? 0 : undefined }}>
        {/* Header */}
        <div style={{
          height: isMobile ? 44 : 40, minHeight: isMobile ? 44 : 40, borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: isMobile ? "0 10px" : "0 18px", background: C.card,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, whiteSpace: "nowrap" }}>{pageTitle[page]}</span>
            {!isMobile && <RoleBadge role={displayRole} />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Company Selector */}
            <div ref={companyRef} style={{ position: "relative" }}>
              <button
                onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "4px 10px 4px 6px",
                  background: companyDropdownOpen ? C.gBg2 : C.gBg,
                  border: `1px solid ${companyDropdownOpen ? C.sage : C.gBdr}`,
                  borderRadius: 6, cursor: "pointer", transition: "all .15s",
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: 4,
                  background: activeCompany === "ALL" ? C.forest : C.sage,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 700, color: C.white, flexShrink: 0,
                }}>{activeCompany === "ALL" ? "⊕" : (activeCompanyObj?.name?.charAt(0) || "?")}</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.dark, whiteSpace: "nowrap", maxWidth: isMobile ? 100 : undefined, overflow: "hidden", textOverflow: "ellipsis" }}>{companyLabel}</span>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{
                  transform: companyDropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s",
                }}>
                  <path d="M1 1L5 5L9 1" stroke={C.gray} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {companyDropdownOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", right: 0,
                  minWidth: 220, background: C.card,
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 200, overflow: "hidden",
                }}>
                  <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, background: C.gBg }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.sage, textTransform: "uppercase", letterSpacing: 0.8 }}>Switch Company</div>
                  </div>
                  {isCompanyAdmin && (
                  <div
                    onClick={() => { setActiveCompany("ALL"); setCompanyDropdownOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer",
                      background: activeCompany === "ALL" ? C.gBg2 : "transparent",
                      borderBottom: `1px solid ${C.border}`, transition: "background .1s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = C.gBg}
                    onMouseLeave={e => e.currentTarget.style.background = activeCompany === "ALL" ? C.gBg2 : "transparent"}
                  >
                    <div style={{
                      width: 26, height: 26, borderRadius: 5, background: C.forest,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, color: C.white,
                    }}>⊕</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: C.dark }}>All Companies</div>
                      <div style={{ fontSize: 9, color: C.muted }}>HQ consolidated view</div>
                    </div>
                    {activeCompany === "ALL" && <span style={{ fontSize: 11, color: C.forest, fontWeight: 700 }}>✓</span>}
                  </div>
                  )}
                  {companiesLoading && (
                    <div style={{ padding: "6px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                      {[1, 2, 3].map(i => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                          <ShimmerBox width={26} height={26} borderRadius={5} />
                          <div style={{ flex: 1 }}>
                            <ShimmerBox width={100} height={11} style={{ marginBottom: 4 }} />
                            <ShimmerBox width={60} height={9} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {companies.map(company => {
                    const isActive = activeCompany === company.id;
                    return (
                      <div key={company.id}
                        onClick={() => { setActiveCompany(company.id); setCompanyDropdownOpen(false); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer",
                          background: isActive ? C.gBg2 : "transparent",
                          borderBottom: `1px solid ${C.border}`, transition: "background .1s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = C.gBg}
                        onMouseLeave={e => e.currentTarget.style.background = isActive ? C.gBg2 : "transparent"}
                      >
                        <div style={{
                          width: 26, height: 26, borderRadius: 5, background: C.sage,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 700, color: C.white,
                        }}>{company.name.substring(0, 2).toUpperCase()}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: C.dark }}>{company.name}</div>
                          <div style={{ fontSize: 9, color: C.muted }}>
                            {company.currency && <span>{company.currency}</span>}
                            {company.country && <span> · {company.country}</span>}
                          </div>
                        </div>
                        {isActive && <span style={{ fontSize: 11, color: C.forest, fontWeight: 700 }}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notification Bell */}
            <NotificationBell
              onNavPurchaseDetail={(id) => {
                setSelectedOdooShipmentId(id);
                setPage("odoo-ship-detail");
              }}
              onNavSalesDetail={(id) => {
                setSelectedOdooSalesShipmentId(id);
                setPage("odoo-sales-detail");
              }}
            />

            {/* Settings gear — admin only */}
            {isSystemAdmin && (
              <button
                onClick={() => navPage("users")}
                title="User Management"
                style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: page === "users" ? C.gBg2 : C.gBg,
                  border: `1px solid ${page === "users" ? C.sage : C.gBdr}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", transition: "all .15s",
                  color: page === "users" ? C.forest : C.gray,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.gBg2; e.currentTarget.style.borderColor = C.sage; }}
                onMouseLeave={e => { e.currentTarget.style.background = page === "users" ? C.gBg2 : C.gBg; e.currentTarget.style.borderColor = page === "users" ? C.sage : C.gBdr; }}
              >
                <svg width="14" height="14" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Page Content */}
        <div className={isMobile ? 'mob-pb-bar' : ''} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: isMobile ? 10 : 16 }}>
          <PageTransition pageKey={`${page}-${selectedOdooShipmentId}-${selectedOdooSalesShipmentId}`}>
          {page === "dashboard" && (
            <Dashboard
              perms={perms}
              activeCompanyId={activeCompany}
              onNavPurchaseDetail={(id) => {
                setSelectedOdooShipmentId(id);
                setPage("odoo-ship-detail");
              }}
              onNavSalesDetail={(id) => {
                setSelectedOdooSalesShipmentId(id);
                setPage("odoo-sales-detail");
              }}
              onNavPage={(p) => navPage(p as Page)}
            />
          )}

          {/* ── PURCHASE SHIPMENTS (Odoo-driven) ──────────────────────── */}
          {page === "purchase" && (
            <OdooShipList
              activeCompanyId={activeCompany === "ALL" ? "ALL" : activeCompany}
              onSelectShipment={(id) => {
                setSelectedOdooShipmentId(id);
                setPage("odoo-ship-detail");
              }}
              onNew={() => { setResumeDraftId(undefined); setShowCreateOdooShipment(true); }}
              onNewMultiLinked={() => { setResumeDraftId(undefined); setShowCreateMultiLinked(true); }}
              onResumeDraft={handleResumeDraft}
            />
          )}

          {/* ── ODOO SHIPMENT DETAIL ──────────────────────────────────── */}
          {page === "odoo-ship-detail" && selectedOdooShipmentId && (
            <OdooShipDetail
              shipmentId={selectedOdooShipmentId}
              onBack={() => {
                setSelectedOdooShipmentId(null);
                setSourceShipment(null);
                setPage("purchase");
              }}
              onNavigateToShipment={handleNavigateToShipment}
              sourceShipment={sourceShipment}
              onNavigateBack={() => {
                if (sourceShipment) {
                  if (sourceShipment.type === "sales") {
                    setSelectedOdooSalesShipmentId(sourceShipment.id);
                    setPage("odoo-sales-detail");
                  } else {
                    setSelectedOdooShipmentId(sourceShipment.id);
                    setPage("odoo-ship-detail");
                  }
                  setSourceShipment(null);
                }
              }}
            />
          )}

          {/* ── SALES SHIPMENTS (Odoo-driven) ────────────────────────── */}
          {page === "sales" && (
            <OdooSalesShipList
              activeCompanyId={activeCompany === "ALL" ? "ALL" : activeCompany}
              onSelectShipment={(id) => {
                setSelectedOdooSalesShipmentId(id);
                setPage("odoo-sales-detail");
              }}
              onNew={() => { setResumeDraftId(undefined); setShowCreateOdooSalesShipment(true); }}
              onNewMultiLinked={() => { setResumeDraftId(undefined); setShowCreateMultiLinked(true); }}
              onResumeDraft={handleResumeDraft}
            />
          )}

          {/* ── ODOO SALES SHIPMENT DETAIL ────────────────────────────── */}
          {page === "odoo-sales-detail" && selectedOdooSalesShipmentId && (
            <OdooSalesShipDetail
              shipmentId={selectedOdooSalesShipmentId}
              onBack={() => {
                setSelectedOdooSalesShipmentId(null);
                setSourceShipment(null);
                setPage("sales");
              }}
              onNavigateToShipment={handleNavigateToShipment}
              sourceShipment={sourceShipment}
              onNavigateBack={() => {
                if (sourceShipment) {
                  if (sourceShipment.type === "purchase") {
                    setSelectedOdooShipmentId(sourceShipment.id);
                    setPage("odoo-ship-detail");
                  } else {
                    setSelectedOdooSalesShipmentId(sourceShipment.id);
                    setPage("odoo-sales-detail");
                  }
                  setSourceShipment(null);
                }
              }}
            />
          )}

          {page === "agreements" && (
            <AgrPage
              perms={perms}
              activeCompanyId={activeCompany === "ALL" ? "ALL" : Number(activeCompany)}
            />
          )}
          {page === "users" && (
            isSystemAdmin
              ? <SystemUserMgmt onBack={() => navPage("dashboard")} />
              : <UserMgmt users={users} currentUser={currentUser} perms={perms} onRoleChange={roleChange} />
          )}
          </PageTransition>
        </div>
      </div>

      {/* Create Odoo Sales Shipment Modal */}
      {showCreateOdooSalesShipment && (
        <CreateOdooSalesShipment
          activeCompanyId={activeCompany === "ALL" ? "ALL" : Number(activeCompany)}
          draftId={resumeDraftId}
          onClose={() => { setShowCreateOdooSalesShipment(false); setResumeDraftId(undefined); }}
          onCreated={(id) => {
            setShowCreateOdooSalesShipment(false);
            setSelectedOdooSalesShipmentId(id);
            setPage("odoo-sales-detail");
          }}
        />
      )}

      {/* Create Odoo Shipment Modal */}
      {showCreateOdooShipment && (
        <CreateOdooShipment
          activeCompanyId={activeCompany === "ALL" ? "ALL" : Number(activeCompany)}
          draftId={resumeDraftId}
          onClose={() => { setShowCreateOdooShipment(false); setResumeDraftId(undefined); }}
          onCreated={(id) => {
            setShowCreateOdooShipment(false);
            setSelectedOdooShipmentId(id);
            setPage("odoo-ship-detail");
          }}
        />
      )}

      {/* Create Multi-Linked Shipment Modal */}
      {showCreateMultiLinked && (
        <CreateMultiLinkedShipment
          activeCompanyId={activeCompany === "ALL" ? "ALL" : Number(activeCompany)}
          draftId={resumeDraftId}
          onClose={() => { setShowCreateMultiLinked(false); setResumeDraftId(undefined); }}
          onCreated={({ purchaseIds, salesIds }) => {
            setShowCreateMultiLinked(false);
            // Navigate to the first created shipment
            if (purchaseIds.length > 0) {
              setSelectedOdooShipmentId(purchaseIds[0]);
              setPage("odoo-ship-detail");
            } else if (salesIds.length > 0) {
              setSelectedOdooSalesShipmentId(salesIds[0]);
              setPage("odoo-sales-detail");
            }
          }}
        />
      )}

      {/* Status Change Toast Polling */}
      <StatusChangeToast
        onNavigate={(orderName, orderType, odooOrderId) => {
          if (orderType === "purchase") {
            setSelectedOdooShipmentId(odooOrderId);
            setPage("odoo-ship-detail");
          } else {
            setSelectedOdooSalesShipmentId(odooOrderId);
            setPage("odoo-sales-detail");
          }
        }}
      />

      {/* ── Mobile Bottom Tab Bar ────────────────────────────────── */}
      <div className="mob-bottom-bar">
        {navItems.slice(0, 5).map(item => {
          const active = page === item.id ||
            (item.id === "purchase" && page === "odoo-ship-detail") ||
            (item.id === "sales" && page === "odoo-sales-detail");
          return (
            <div key={item.id} className={active ? 'active' : ''} onClick={() => navPage(item.id)}>
              <span className="icon">{item.icon}</span>
              <span>{item.label.split(' ')[0]}</span>
            </div>
          );
        })}
      </div>

      {/* Dropdown animation keyframes */}
      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
