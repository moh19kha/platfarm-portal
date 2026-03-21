// ══════════════════════════════════════════════════════════════════════════════
// SUPPLY CHAIN HOME — Platfarm V3 — Supply Chain Financials Module Shell
// Embeds the full financial dashboard (5 tabs: Facility, Sokhna, Dakhla,
// Egypt Shipment P&L, International Shipments P&L) via iframe.
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  C, FONT, USERS_SEED, ROLES,
  resolvePerms,
  type UserDef,
} from "@/lib/data";
import { RoleBadge } from "@/components/ui-primitives";
import { useAuth } from "@/_core/hooks/useAuth";
import { PlatfarmLogo } from "@/components/PlatfarmLogo";


const DASHBOARD_URL = "/api/supply-chain-dashboard";

// ─── Supply Chain uses standard Platfarm C.* palette ───────────────────────

export default function SupplyChainHome() {
  // ─── Dashboard HTML (blob URL to isolate from Vite) ───────────────────────
  const [blobUrl, setBlobUrl] = useState<string>("");
  const [dashboardLoading, setDashboardLoading] = useState(true);

  useEffect(() => {
    fetch(DASHBOARD_URL)
      .then(res => res.text())
      .then(html => {
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setDashboardLoading(false);
      })
      .catch(() => setDashboardLoading(false));
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, []);

  // ─── RBAC State ─────────────────────────────────────────────────────────
  const [users] = useState<UserDef[]>(USERS_SEED);
  const [currentUserId] = useState("ahmed");
  const currentUser = useMemo(() => users.find(u => u.id === currentUserId) || users[0], [users, currentUserId]);
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
          <div className={`app-sb-ni app-sb-act`}>
            <span style={{ fontSize: 13 }}>🌾</span>
            {!collapsed && <div>Financial Dashboard<div className="app-sb-ns">All Tabs</div></div>}
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
        {dashboardLoading ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", color: C.muted, fontSize: 13,
          }}>
            Loading financial dashboard…
          </div>
        ) : blobUrl ? (
          <iframe
            src={blobUrl}
            title="Supply Chain Financials Dashboard"
            style={{ flex: 1, width: "100%", height: "100%", border: "none", background: "#ffffff" }}
          />
        ) : (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", color: C.terra, fontSize: 13,
          }}>
            Failed to load dashboard. Please try refreshing.
          </div>
        )}
      </div>
    </div>
  );
}
