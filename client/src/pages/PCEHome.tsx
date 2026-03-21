// ══════════════════════════════════════════════════════════════════════════════
// PCE HOME — Platfarm V3 — Petty Cash & Expenses Module Shell
// Embeds the PCE dashboard (Dashboard, Petty Cash, Expenses, Reminders) via iframe.
// Follows the same architecture as HRHome.tsx with sidebar + iframe pattern.
// ══════════════════════════════════════════════════════════════════════════════
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  C, FONT, USERS_SEED, ROLES,
  type UserDef,
} from "@/lib/data";
import { PlatfarmLogo } from "@/components/PlatfarmLogo";
import { useAuth } from "@/_core/hooks/useAuth";

const DASHBOARD_URL = "/api/pce-dashboard";

export default function PCEHome() {
  // ─── RBAC State ─────────────────────────────────────────────────────────
  const [users] = useState<UserDef[]>(USERS_SEED);
  const [currentUserId] = useState("ahmed");
  const currentUser = users.find(u => u.id === currentUserId) || users[0];
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
  const [, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [isMob, setIsMob] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const _h = () => setIsMob(window.innerWidth < 768);
    window.addEventListener("resize", _h);
    return () => window.removeEventListener("resize", _h);
  }, []);
  useEffect(() => { if (isMob) setCollapsed(true); }, [isMob]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);

  // Sidebar nav items for PCE module
  const navItems = [
    { id: "dash", label: "Dashboard", icon: "◈", sub: "" },
    { id: "pc", label: "Petty Cash", icon: "💰", sub: "Balances & Top-ups" },
    { id: "exp", label: "Expenses", icon: "📋", sub: "Deductions & Tracking" },
    { id: "rem", label: "Reminders", icon: "🔔", sub: "Notifications" },
  ];
  const [activePage, setActivePage] = useState("dash");

  // Listen for page changes from within the iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data && event.data.type === 'pce-page-changed' && event.data.page) {
        setActivePage(event.data.page);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleNavClick = useCallback((pageId: string) => {
    setActivePage(pageId);
    const iframe = iframeRef.current;
    if (!iframe) return;
    // Method 1: postMessage
    try {
      iframe.contentWindow?.postMessage({ type: 'pce-navigate', page: pageId }, '*');
    } catch (e) { /* ignore */ }
    // Method 2: Direct setState call (same-origin fallback)
    try {
      const iframeWindow = iframe.contentWindow as any;
      if (iframeWindow && iframeWindow.setState) {
        iframeWindow.setState({ page: pageId, sel: null, selType: null });
      }
    } catch (e) { /* Cross-origin fallback */ }
  }, []);

  const handleIframeLoad = useCallback(() => {
    setIframeReady(true);
  }, []);

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
      <div style={{
        width: collapsed ? 48 : 190, minWidth: collapsed ? 48 : 190,
        background: C.card, borderRight: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column",
        transition: "width .2s, min-width .2s", marginTop: 3, overflow: "hidden",
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed ? "7px 6px" : "9px 10px",
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
            const active = activePage === item.id;
            return (
              <div key={item.id} onClick={() => handleNavClick(item.id)} style={{
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
        {/* Current User (bottom of sidebar) */}
        {!collapsed && (
          <div style={{ padding: "7px 9px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
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
            </div>
          </div>
        )}
      </div>
      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", marginTop: 3 }}>
        <iframe
          ref={iframeRef}
          src={DASHBOARD_URL}
          title="Petty Cash & Expenses Dashboard"
          onLoad={handleIframeLoad}
          style={{
            flex: 1,
            width: "100%",
            height: "100%",
            border: "none",
            background: "#ffffff",
          }}
        />
      </div>
    </div>
  );
}
