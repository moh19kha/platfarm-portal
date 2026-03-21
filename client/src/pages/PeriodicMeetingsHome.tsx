// ══════════════════════════════════════════════════════════════════════════════
// PERIODIC MEETINGS HOME — Platfarm V3
// Sidebar matches Operations module exactly:
//   • "P" square logo + "PLATFARM" text (same as Operations)
//   • Full-width nav items, border-right:3px active indicator
//   • Padding 10px 16px on nav items, 14px 16px on logo area
//   • Bottom: user avatar circle + name + role
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { C, FONT, USERS_SEED, ROLES, type UserDef } from "@/lib/data";
import { useAuth } from "@/_core/hooks/useAuth";
import { PlatfarmLogo } from "@/components/PlatfarmLogo";

const DASHBOARD_URL = "/api/hr-dashboard";

// ─── Logo — matches Operations module exactly ─────────────────────────────────

export default function PeriodicMeetingsHome() {
  const [blobUrl, setBlobUrl] = useState<string>("");
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [, setLocation] = useLocation();
  const [sideCol, setSideCol] = useState(false);
  const [activeNav, setActiveNav] = useState("meetings");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ─── Auth / User ─────────────────────────────────────────────────────────
  const [users] = useState<UserDef[]>(USERS_SEED);
  const currentUser = useMemo(() => users[0], [users]);
  const { user: authUser } = useAuth();
  const displayName = authUser?.name || currentUser.name;
  const displayInitials = useMemo(() => {
    if (authUser?.name) {
      const parts = authUser.name.trim().split(/\s+/);
      return parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : parts[0].substring(0, 2).toUpperCase();
    }
    return currentUser.initials;
  }, [authUser?.name, currentUser.initials]);
  const displayRole = authUser?.role === "admin" ? "admin" : currentUser.role;

  // ─── Load dashboard HTML ─────────────────────────────────────────────────
  useEffect(() => {
    let objectUrl: string;
    fetch(DASHBOARD_URL)
      .then(res => res.text())
      .then(html => {
        const blob = new Blob([html], { type: "text/html" });
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setDashboardLoading(false);
      })
      .catch(() => setDashboardLoading(false));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  const navItems: [string, string, string, string][] = [
    ["meetings",         "📅", "All Meetings",  "History & Attendance"],
    ["actionsDashboard", "✅", "Action Points", "Efficiency & Tracking"],
  ];

  const navigateTo = (pageId: string) => {
    setActiveNav(pageId);
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try { iframe.contentWindow.postMessage({ type: "hr-navigate", page: pageId }, "*"); } catch (_) {}
    try { (iframe.contentWindow as any).setState?.({ page: pageId }); } catch (_) {}
  };

  const handleIframeLoad = () => navigateTo(activeNav);

  const pageTitle = activeNav === "actionsDashboard" ? "Action Points" : "Periodic Meetings";
  const todayLabel = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const sw = sideCol ? 48 : 190;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#F8F6F2", fontFamily: "'DM Sans', system-ui, sans-serif", overflow: "hidden" }}>
      <style>{`
        .app-sb-ni{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;transition:background .15s;font-size:12px;font-weight:500;color:#64706C;white-space:nowrap;overflow:hidden;border-right:3px solid transparent}
        .app-sb-ni:hover{background:#F2F7F3}
        .app-sb-ni.app-sb-act{background:#E4EFE6;color:#2D5A3D;font-weight:700;border-right-color:#2D5A3D}
        .app-sb-ns{font-size:9px;color:#95A09C;margin-top:1px;font-weight:400}
        @keyframes pmSpin{to{transform:rotate(360deg)}}
        @media(max-width:767px){.pm-sb{display:none!important}}
      `}</style>

      {/* ── Top accent bar ── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 3,
        background: "linear-gradient(90deg,#2D5A3D,#C0714A)", zIndex: 100,
      }} />

      {/* ═══ SIDEBAR ═══ */}
      <div className="pm-sb" style={{
        width: sw, minWidth: sw,
        background: "#fff", borderRight: "1px solid #E4E1DC",
        display: "flex", flexDirection: "column",
        transition: "width .2s, min-width .2s", marginTop: 3, overflow: "hidden", flexShrink: 0,
      }}>
        {/* Logo */}
        <div
          onClick={() => setSideCol(c => !c)}
          style={{ padding: "9px 10px", borderBottom: "1px solid #E4E1DC", cursor: "pointer", display: "flex", alignItems: "center" }}
        >
          <PlatfarmLogo height={sideCol ? 24 : 28} treeColor="#1B3A2D" textColor="#D4845F" />
        </div>

        {/* Nav */}
        <div style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {/* Home */}
          <div className="app-sb-ni" onClick={() => setLocation("/")}>
            <span style={{ fontSize: 15 }}>🏠</span>
            {!sideCol && <span>Home</span>}
          </div>

          {/* Module items */}
          {navItems.map(([k, icon, label, sub]) => (
            <div key={k} className={`app-sb-ni ${activeNav === k ? "app-sb-act" : ""}`} onClick={() => navigateTo(k)}>
              <span style={{ fontSize: 13 }}>{icon}</span>
              {!sideCol && (
                <div>{label}<div className="app-sb-ns">{sub}</div></div>
              )}
            </div>
          ))}
        </div>

        {/* User avatar */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid #E4E1DC", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: ROLES[displayRole]?.color || "#2D5A3D",
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, flexShrink: 0,
          }}>{displayInitials}</div>
          {!sideCol && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#2C3E50" }}>{displayName}</div>
              <div style={{ fontSize: 8, color: "#B0BAB6" }}>{ROLES[displayRole]?.label || "User"}</div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          padding: "14px 20px", borderBottom: "1px solid #E4E1DC",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#fff", position: "sticky" as const, top: 0, zIndex: 10, marginTop: 3,
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1A2B24", display: "flex", alignItems: "center", gap: 10 }}>
            {pageTitle}
            <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 10, fontWeight: 600, background: "#E4EFE6", color: "#2D5A3D" }}>
              HR · Meetings
            </span>
          </div>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#95A09C" }}>{todayLabel}</span>
        </div>

        {/* Dashboard iframe */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {dashboardLoading && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "#F8F6F2", zIndex: 5,
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  border: "3px solid #CDDDD1", borderTopColor: "#2D5A3D",
                  animation: "pmSpin 0.8s linear infinite",
                  margin: "0 auto 12px",
                }} />
                <div style={{ fontSize: 12, color: "#95A09C" }}>Loading meetings data…</div>
                <div style={{ fontSize: 10, color: "#B0BAB6", marginTop: 4 }}>Connecting to Odoo…</div>
              </div>
            </div>
          )}
          {blobUrl && (
            <iframe
              ref={iframeRef}
              title="Periodic Meetings Dashboard"
              src={blobUrl}
              style={{ width: "100%", height: "100%", border: "none", display: "block" }}
              onLoad={handleIframeLoad}
            />
          )}
        </div>
      </div>
    </div>
  );
}
