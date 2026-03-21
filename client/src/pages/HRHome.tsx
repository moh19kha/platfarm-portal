// ══════════════════════════════════════════════════════════════════════════════
// HR HOME — Platfarm V3 — HR Management Module Shell
// Embeds the full HR dashboard (Dashboard, Employees, Leaves, Bonus & Fines,
// Employee Profiles with 7 tabs, Add Employee Wizard) via iframe.
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  C, FONT, USERS_SEED, ROLES,
  type UserDef,
} from "@/lib/data";
import { useAuth } from "@/_core/hooks/useAuth";
import { PlatfarmLogo } from "@/components/PlatfarmLogo";


// Load the HR dashboard directly (not as blob URL) so onclick handlers work correctly
const DASHBOARD_URL = "/api/hr-dashboard";

export default function HRHome() {
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
  const _pendingPage = useRef<string | null>(null);

  // Sidebar nav items for HR module
  const navItems = [
    { id: "dashboard", label: "HR Dashboard", icon: "◈", sub: "Overview" },
    { id: "employee-listing", label: "Employee Listing", icon: "👥", sub: "All Staff" },
    { id: "leaves", label: "Leave Management", icon: "🏖️", sub: "Requests" },
    { id: "discipline", label: "Bonus & Fines", icon: "📝", sub: "Records" },
    { id: "incentives", label: "Incentives", icon: "📊", sub: "Production" },
  ];

  const [activePage, setActivePage] = useState("dashboard");

  // Listen for page changes from within the iframe (e.g. breadcrumb clicks)
  // Also listen for profile navigation requests from Employee Listing page
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data && event.data.type === 'hr-page-changed' && event.data.page) {
        setActivePage(event.data.page);
      }
      // Forward profile open request to iframe
      // Handle navigation request from Employee Listing (fires before iframe loads)
      if (event.data && event.data.type === 'hr-navigate-on-load' && event.data.page) {
        const pageId = event.data.page;
        setActivePage(pageId);
        const iframe = iframeRef.current;
        if (iframe && iframe.contentWindow) {
          // Iframe already loaded — navigate directly
          try { iframe.contentWindow.postMessage({ type: 'hr-navigate', page: pageId }, '*'); } catch(e) {}
          try { const w = iframe.contentWindow as any; if (w && w.setState) w.setState({ page: pageId, selEmp: null }); } catch(e) {}
        } else {
          // Iframe not yet loaded — queue for handleIframeLoad
          _pendingPage.current = pageId;
        }
        return;
      }
      if (event.data && event.data.type === 'hr-open-profile' && event.data.employeeId) {
        setActivePage('employees');
        const iframe = iframeRef.current;
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage(event.data, '*');
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleNavClick = useCallback((pageId: string) => {
    // Employee Listing is a standalone React page — navigate via router
    if (pageId === "employee-listing") {
      setLocation("/hr/employee-listing");
      return;
    }

    setActivePage(pageId);
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Method 1: postMessage (works cross-origin and same-origin reliably)
    try {
      iframe.contentWindow?.postMessage({ type: 'hr-navigate', page: pageId }, '*');
    } catch (e) {
      // ignore
    }

    // Method 2: Direct setState call (fallback for same-origin)
    try {
      const iframeWindow = iframe.contentWindow as any;
      if (iframeWindow && iframeWindow.setState) {
        iframeWindow.setState({ page: pageId, selEmp: null });
      }
    } catch (e) {
      // Cross-origin fallback: do nothing
    }
  }, [setLocation]);

  const handleIframeLoad = useCallback(() => {
    setIframeReady(true);
    // Handle pending page navigation (from Employee Listing hr-navigate-on-load)
    if (_pendingPage.current) {
      const pageId = _pendingPage.current;
      _pendingPage.current = null;
      setActivePage(pageId);
      setTimeout(() => {
        const iframe = iframeRef.current;
        if (iframe && iframe.contentWindow) {
          try { iframe.contentWindow.postMessage({ type: 'hr-navigate', page: pageId }, '*'); } catch(e) {}
          try { const w = iframe.contentWindow as any; if (w && w.setState) w.setState({ page: pageId, selEmp: null }); } catch(e) {}
        }
      }, 500);
    }
    // Check if there's a pending employee profile to open (from Employee Listing)
    const pendingProfile = sessionStorage.getItem('hr_open_profile');
    if (pendingProfile) {
      sessionStorage.removeItem('hr_open_profile');
      try {
        const data = JSON.parse(pendingProfile);
        if (data.employeeId) {
          setActivePage('employees');
          const iframe = iframeRef.current;
          if (iframe && iframe.contentWindow) {
            // Small delay to ensure iframe's JS is fully initialized
            setTimeout(() => {
              iframe.contentWindow?.postMessage({
                type: 'hr-open-profile',
                employeeId: data.employeeId,
                tab: data.tab || 'overview',
              }, '*');
            }, 500);
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    }
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
        <div style={{ flex: 1, padding: "4px 4px", overflowY: "auto" }}>
          {/* Back to Home */}
          <div
            onClick={() => setLocation("/")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: collapsed ? "6px" : "5px 10px",
              margin: "4px 0 0",
              borderRadius: 5, cursor: "pointer",
              color: "#D4845F",
              justifyContent: collapsed ? "center" : "flex-start",
              transition: "all .15s",
              fontSize: 10, fontWeight: 600,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FDF5F0"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            {!collapsed && <span>Home</span>}
          </div>

          {/* Module Label */}
          {!collapsed && (
            <div style={{
              padding: "6px 10px 2px",
              fontSize: 8, fontWeight: 700, color: "#8FA897",
              textTransform: "uppercase", letterSpacing: 0.8,
            }}>
              HR Management
            </div>
          )}

          {/* Nav Items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 2 }}>
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
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "#F2F7F3"; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <span style={{ fontSize: 12, flexShrink: 0 }}>{item.icon}</span>
                  {!collapsed && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: active ? 600 : 500 }}>{item.label}</div>
                      {item.sub && <div style={{ fontSize: 8, color: "#95A09C", marginTop: -1 }}>{item.sub}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
        <iframe
          ref={iframeRef}
          src={DASHBOARD_URL}
          title="HR Management Dashboard"
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
