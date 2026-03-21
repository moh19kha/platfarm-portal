// ══════════════════════════════════════════════════════════════════════════════
// INVESTMENT HOME — Platfarm V3 — Investors Relationship Management Module Shell
// Mirrors QuotationsHome's sidebar + header + page-transition pattern exactly.
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import {
  C, FONT, USERS_SEED, ROLES,
  resolvePerms,
  type UserDef,
} from "@/lib/data";
import { RoleBadge } from "@/components/ui-primitives";
import { PageTransition } from "@/components/PageTransition";
import { useAuth } from "@/_core/hooks/useAuth";
const InvestmentProposal = lazy(() => import("./InvestmentProposal"));
const InvestmentCycles = lazy(() => import("./InvestmentCycles"));
import { PlatfarmLogo } from "@/components/PlatfarmLogo";


type Page = "proposal" | "cycles";

export default function InvestmentHome() {
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
    return "proposal";
  }, []);

  const [page, setPageInternal] = useState<Page>(() => getPageFromPath(location));

  const setPage = useCallback((p: Page) => {
    setPageInternal(p);
    setLocation("/investments");
  }, [setLocation]);

  useEffect(() => {
    document.title = "Investors Relationship Management - Platfarm";
  }, [page]);

  const [collapsed, setCollapsed] = useState(false);
  const [isMob, setIsMob] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const _h = () => setIsMob(window.innerWidth < 768);
    window.addEventListener("resize", _h);
    return () => window.removeEventListener("resize", _h);
  }, []);
  useEffect(() => { if (isMob) setCollapsed(true); }, [isMob]);

  const navItems = [
    { id: "proposal" as Page, label: "New Proposal", icon: "◆", sub: "Create" },
    { id: "cycles" as Page, label: "Investment Cycles", icon: "◎", sub: "Pipeline" },
  ];

  const pageTitle: Record<string, string> = {
    proposal: "Investment Proposal Generator",
    cycles: "Investment Cycles",
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
            const active = page === item.id;
            return (
              <div key={item.id} className={`app-sb-ni ${active ? "app-sb-act" : ""}`} onClick={() => setPage(item.id)}>
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
            <span style={{ fontSize: 13, fontWeight: 700 }}>{pageTitle[page] || "Investments"}</span>
            <RoleBadge role={displayRole} />
          </div>
          <span style={{ fontSize: 10, color: C.muted }}>
            {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
          </span>
        </div>
        {/* Page content */}
        <PageTransition pageKey={page} style={{ flex: 1, overflow: "hidden" }}>
          {page === "proposal" && <Suspense fallback={<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#95A09C",fontSize:12}}>Loading...</div>}><InvestmentProposal /></Suspense>}
          {page === "cycles" && <Suspense fallback={<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#95A09C",fontSize:12}}>Loading...</div>}><InvestmentCycles /></Suspense>}
        </PageTransition>
      </div>
    </div>
  );
}
