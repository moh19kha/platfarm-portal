// ══════════════════════════════════════════════════════════════════════════════
// QUOTATIONS HOME — Platfarm V3 — Quotation & Invoicing Module Shell
// Mirrors ProductionHome's sidebar + header + page-transition pattern exactly.
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import {
  C, FONT, USERS_SEED, ROLES,
  resolvePerms,
  type UserDef,
} from "@/lib/data";
import { RoleBadge } from "@/components/ui-primitives";
import { PageTransition } from "@/components/PageTransition";
import { useAuth } from "@/_core/hooks/useAuth";
import DocumentSelector from "./DocumentSelector";
import QuotationEditor from "./QuotationEditor";
import PaymentReceiptEditor from "./PaymentReceiptEditor";
import SavedDocuments from "./SavedDocuments";
import { PlatfarmLogo } from "@/components/PlatfarmLogo";


type Page = "create" | "quotation" | "invoice" | "receipt" | "saved";

export default function QuotationsHome() {
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
    const clean = path.split("?")[0].replace(/\/$/, "") || "/";
    if (clean === "/documents/quotation") return "quotation";
    if (clean === "/documents/invoice") return "invoice";
    if (clean === "/documents/receipt") return "receipt";
    if (clean === "/documents/saved") return "saved";
    return "create";
  }, []);

  const [page, setPageInternal] = useState<Page>(() => getPageFromPath(location));

  const setPage = useCallback((p: Page) => {
    setPageInternal(p);
    const pathMap: Record<Page, string> = {
      create: "/documents",
      quotation: "/documents/quotation",
      invoice: "/documents/invoice",
      receipt: "/documents/receipt",
      saved: "/documents/saved",
    };
    setLocation(pathMap[p] || "/documents");
  }, [setLocation]);

  useEffect(() => {
    const handlePopState = () => {
      const newPage = getPageFromPath(window.location.pathname);
      setPageInternal(newPage);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [getPageFromPath]);

  useEffect(() => {
    const titles: Record<string, string> = {
      create: "Create Document - Platfarm",
      quotation: "Quotation Editor - Platfarm",
      invoice: "Invoice Editor - Platfarm",
      receipt: "Payment Receipt - Platfarm",
      saved: "Saved Documents - Platfarm",
    };
    document.title = titles[page] || "Quotation & Invoicing - Platfarm";
  }, [page]);

  const [collapsed, setCollapsed] = useState(false);
  const [isMob, setIsMob] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const _h = () => setIsMob(window.innerWidth < 768);
    window.addEventListener("resize", _h);
    return () => window.removeEventListener("resize", _h);
  }, []);
  useEffect(() => { if (isMob) setCollapsed(true); }, [isMob]);

  // ─── Navigation Handlers ───────────────────────────────────────────────
  const navPage = useCallback((p: Page) => {
    setPage(p);
  }, [setPage]);

  const navItems = [
    { id: "create" as Page, label: "New Document", icon: "✦", sub: "Create" },
    { id: "saved" as Page, label: "Saved Documents", icon: "▤", sub: "Browse" },
  ];

  const pageTitle: Record<string, string> = {
    create: "Create Document",
    quotation: "Quotation Editor",
    invoice: "Invoice Editor",
    receipt: "Payment Receipt",
    saved: "Saved Documents",
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
            const active = page === item.id || (item.id === "create" && (page === "quotation" || page === "invoice" || page === "receipt"));
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
            <span style={{ fontSize: 13, fontWeight: 700 }}>{pageTitle[page] || "Documents"}</span>
            <RoleBadge role={displayRole} />
          </div>
          <span style={{ fontSize: 10, color: C.muted }}>
            {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
          </span>
        </div>
        {/* Page content */}
        <PageTransition pageKey={page} style={{ flex: 1, overflow: "hidden" }}>
          {page === "create" && (
            <DocumentSelector
              onSelect={(type) => navPage(type as Page)}
              onViewSaved={() => navPage("saved")}
            />
          )}
          {page === "quotation" && (
            <QuotationEditor
              isInvoice={false}
              onBack={() => navPage("create")}
              onViewSaved={() => navPage("saved")}
            />
          )}
          {page === "invoice" && (
            <QuotationEditor
              isInvoice={true}
              onBack={() => navPage("create")}
              onViewSaved={() => navPage("saved")}
            />
          )}
          {page === "receipt" && (
            <PaymentReceiptEditor
              onBack={() => navPage("create")}
              onViewSaved={() => navPage("saved")}
            />
          )}
          {page === "saved" && (
            <SavedDocuments
              onBack={() => navPage("create")}
              onEdit={(type) => navPage(type as Page)}
              onDownloadDocument={() => {}}
            />
          )}
        </PageTransition>
      </div>
    </div>
  );
}
