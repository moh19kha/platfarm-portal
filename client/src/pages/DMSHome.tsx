// ══════════════════════════════════════════════════════════════════════════════
// DMS HOME — Platfarm V3 — Document Management System Module Shell
// Single-column sidebar with folder tree, favorites, storage.
// Embeds the DMS dashboard (Dashboard, Browse) via iframe.
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  C, FONT, USERS_SEED, ROLES,
  type UserDef,
} from "@/lib/data";
import { RoleBadge } from "@/components/ui-primitives";
import { trpc } from "@/lib/trpc";
import { useCompanySelector } from "@/hooks/useCompanySelector";
import { useAuth } from "@/_core/hooks/useAuth";
import { PlatfarmLogo } from "@/components/PlatfarmLogo";


const DASHBOARD_URL = "/api/dms-dashboard";

interface FolderNode {
  id: number;
  name: string;
  parentId: number | null;
  companyName: string | null;
  companyId: number | null;
}

interface FlatNode {
  id: number;
  name: string;
  pid: number | null;
  d: number; // depth
  hc: boolean; // has children
  company: string | null;
}

// ─── DMS Module Color Identity (Blue) ─────────────────────────────────────
const DMS = {
  primary: "#2B6CB0",     // blue primary (replaces C.forest)
  secondary: "#4299E1",   // blue secondary (replaces C.sage)
  hover: "#2563EB",       // hover state
  gBg: "#EBF4FF",         // light blue background
  gBg2: "#DBEAFE",        // medium blue background
  gBdr: "#BFDBFE",        // blue border
  gBdr2: "#93C5FD",       // stronger blue border
  accentBar: "linear-gradient(90deg, #2B6CB0, #4299E1)",
};

export default function DMSHome() {
  // ─── Dashboard HTML (blob URL to isolate from Vite) ───────────────────────
  const [blobUrl, setBlobUrl] = useState<string>("");
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  // ─── Fetch folder tree from Odoo ──────────────────────────────────────────
  const foldersQuery = trpc.dms.getFolders.useQuery();
  const docsQuery = trpc.dms.getAllDocuments.useQuery();

  const folders: FolderNode[] = (foldersQuery.data as FolderNode[] | undefined) || [];
  const documents: any[] = (docsQuery.data as any[] | undefined) || [];

  // Build folder tree
  const { flatTree, childrenOf, folderById } = useMemo(() => {
    const _folderById: Record<number, FolderNode> = {};
    const _childrenOf: Record<number, FolderNode[]> = {};
    folders.forEach(f => { _folderById[f.id] = f; });
    folders.forEach(f => {
      if (f.parentId) {
        if (!_childrenOf[f.parentId]) _childrenOf[f.parentId] = [];
        _childrenOf[f.parentId].push(f);
      }
    });

    const _flatTree: FlatNode[] = [];
    const roots = folders.filter(f => !f.parentId).sort((a, b) => a.name.localeCompare(b.name));
    function walk(folder: FolderNode, depth: number) {
      const hc = (_childrenOf[folder.id] || []).length > 0;
      _flatTree.push({ id: folder.id, name: folder.name, pid: folder.parentId, d: depth, hc, company: folder.companyName || null });
      (_childrenOf[folder.id] || []).sort((a, b) => a.name.localeCompare(b.name)).forEach(c => walk(c, depth + 1));
    }
    roots.forEach(r => walk(r, 0));

    return { flatTree: _flatTree, childrenOf: _childrenOf, folderById: _folderById };
  }, [folders]);

  // Compute favorites count and storage
  const favCount = useMemo(() => documents.filter((d: any) => d.isFavorited).length, [documents]);
  const totalSize = useMemo(() => documents.reduce((s: number, d: any) => s + (d.fileSize || 0), 0), [documents]);
  const fmtSize = (b: number) => {
    if (!b) return "0 B";
    const k = 1024;
    const s = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(1)) + " " + s[i];
  };

  // ─── RBAC State ─────────────────────────────────────────────────────────
  const [users] = useState<UserDef[]>(USERS_SEED);
  const [currentUserId] = useState("ahmed");
  const currentUser = useMemo(() => users.find(u => u.id === currentUserId) || users[0], [users, currentUserId]);

  // ─── Company Selector (matching main Dashboard header style) ──────────
  const cs = useCompanySelector({ allowAll: true });
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const companyRef = useRef<HTMLDivElement>(null);
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

  // Close company dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
        setCompanyDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sync company selection to iframe
  useEffect(() => {
    if (cs.activeCompanyId && cs.companyResolved) {
      // Send both company name AND numeric odooId so the iframe can match reliably
      const iframeCompanyId = cs.activeCompanyId === "ALL" ? "ALL" : (cs.activeCompany?.name || String(cs.activeCompanyId));
      const odooId = cs.activeCompanyId === "ALL" ? null : (typeof cs.activeCompanyId === "number" ? cs.activeCompanyId : null);
      sendToIframe({ activeCompany: iframeCompanyId, activeOdooId: odooId, companyDropdownOpen: false });
    }
  }, [cs.activeCompanyId, cs.companyResolved, cs.activeCompany]);

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
  const [activePage, setActivePage] = useState("dashboard");
  const [selFolder, setSelFolder] = useState<number | null>(null);
  const [showFavs, setShowFavs] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // Auto-expand root folders on first load
  useEffect(() => {
    if (flatTree.length > 0 && Object.keys(expanded).length === 0) {
      const exp: Record<number, boolean> = {};
      flatTree.filter(f => f.d === 0).forEach(f => { exp[f.id] = true; });
      setExpanded(exp);
      if (!selFolder) setSelFolder(flatTree[0].id);
    }
  }, [flatTree]);

  // Send navigation messages to the iframe
  const sendToIframe = useCallback((patch: Record<string, any>) => {
    const iframe = iframeRef.current;
    if (iframe && iframe.contentWindow) {
      try {
        const iframeWindow = iframe.contentWindow as any;
        if (iframeWindow.setState) {
          iframeWindow.setState(patch);
        }
      } catch (e) {
        // cross-origin fallback
      }
    }
  }, []);

  const handleNavClick = (pageId: string) => {
    setActivePage(pageId);
    setShowFavs(false);
    sendToIframe({ page: pageId, selFile: null, showFavs: false, search: "" });
  };

  const handleFolderClick = (folderId: number) => {
    setSelFolder(folderId);
    setActivePage("browse");
    setShowFavs(false);
    sendToIframe({ selFolder: folderId, selFile: null, search: "", showFavs: false, page: "browse" });
  };

  const handleFavsClick = () => {
    setShowFavs(true);
    setActivePage("browse");
    sendToIframe({ showFavs: true, page: "browse", search: "" });
  };

  const toggleExpand = (folderId: number) => {
    setExpanded(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // Visibility check for folder tree
  const isVisible = (f: FlatNode): boolean => {
    if (f.d === 0) return true;
    let cur = f.pid;
    while (cur !== null && cur !== undefined) {
      if (!expanded[cur]) return false;
      const p = folderById[cur];
      if (!p) break;
      cur = p.parentId;
    }
    return true;
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

      {/* ── Unified Sidebar ──────────────────────────────────────────────── */}
      <div style={{
        width: collapsed ? 48 : 240, minWidth: collapsed ? 48 : 240,
        background: "#fff", borderRight: "1px solid #E4E1DC",
        display: "flex", flexDirection: "column",
        transition: "width .2s, min-width .2s", marginTop: 3, overflow: "hidden",
      }}>
        {/* Logo */}
        <div style={{
          padding: "14px 16px",
          borderBottom: "1px solid #E4E1DC",
          display: "flex", alignItems: "center", cursor: "pointer",
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

        {/* Module Label */}
        {!collapsed && (
          <div style={{
            padding: "6px 10px 2px",
            fontSize: 8, fontWeight: 700, color: C.sage,
            textTransform: "uppercase", letterSpacing: 0.8,
          }}>
            Document Management
          </div>
        )}

        {/* Nav Items */}
        {!collapsed && (
          <div style={{ padding: "4px 8px", borderBottom: `1px solid ${C.border}` }}>
            <div
              onClick={() => handleNavClick("dashboard")}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "7px 10px", borderRadius: 6, cursor: "pointer",
                background: activePage === "dashboard" && !showFavs ? C.gBg2 : "transparent",
                color: activePage === "dashboard" && !showFavs ? C.forest : C.gray,
                fontWeight: activePage === "dashboard" && !showFavs ? 600 : 400,
                fontSize: 11.5, transition: "all .15s",
              }}
              onMouseEnter={e => { if (activePage !== "dashboard") e.currentTarget.style.background = C.gBg; }}
              onMouseLeave={e => { if (activePage !== "dashboard") e.currentTarget.style.background = "transparent"; }}
            >
              📊 Dashboard
            </div>
            <div
              onClick={() => handleNavClick("browse")}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "7px 10px", borderRadius: 6, cursor: "pointer",
                background: activePage === "browse" && !showFavs ? C.gBg2 : "transparent",
                color: activePage === "browse" && !showFavs ? C.forest : C.gray,
                fontWeight: activePage === "browse" && !showFavs ? 600 : 400,
                fontSize: 11.5, transition: "all .15s",
              }}
              onMouseEnter={e => { if (activePage !== "browse" || showFavs) e.currentTarget.style.background = C.gBg; }}
              onMouseLeave={e => { if (activePage !== "browse" || showFavs) e.currentTarget.style.background = "transparent"; }}
            >
              📂 All Documents
            </div>


          </div>
        )}

        {/* Folder Tree (Workspaces) */}
        {!collapsed && (
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
            <div style={{ padding: "6px 14px 4px", fontSize: 9, fontWeight: 700, color: C.sage, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Workspaces
            </div>
            {flatTree.filter(isVisible).map(f => {
              const isSel = selFolder === f.id && activePage === "browse" && !showFavs;
              return (
                <div
                  key={f.id}
                  onClick={() => handleFolderClick(f.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "5px 8px",
                    paddingLeft: 10 + f.d * 14,
                    borderRadius: 6, cursor: "pointer",
                    background: isSel ? C.gBg2 : "transparent",
                    color: isSel ? C.forest : C.dark,
                    fontWeight: isSel ? 600 : 400,
                    fontSize: 11.5,
                    margin: "1px 4px",
                    transition: "background .1s",
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = C.gBg; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isSel ? C.gBg2 : "transparent"; }}
                >
                  {f.hc ? (
                    <span
                      onClick={(e) => { e.stopPropagation(); toggleExpand(f.id); }}
                      style={{
                        display: "flex", flexShrink: 0,
                        transform: expanded[f.id] ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform .15s", cursor: "pointer",
                      }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </span>
                  ) : (
                    <div style={{ width: 9 }} />
                  )}
                  <span style={{ fontSize: f.d === 0 ? 13 : 11 }}>{f.d === 0 ? "🏢" : "📁"}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Storage section */}
        {!collapsed && (
          <div style={{ padding: "12px 14px", borderTop: `1px solid ${C.border}`, background: "#FAFAF8" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: C.sage, textTransform: "uppercase" }}>Storage</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: C.muted }}>{fmtSize(totalSize)}</span>
            </div>
            <div style={{ width: "100%", height: 4, borderRadius: 4, background: C.border, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 4, background: C.forest, width: `${Math.min(totalSize / 2e9 * 100, 100)}%`, transition: "width .6s cubic-bezier(.16,1,.3,1)" }} />
            </div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>{documents.length} files</div>
          </div>
        )}

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
        {/* Header — matching main Dashboard style with company selector */}
        <div style={{
          height: 48, minHeight: 48, borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 18px", background: C.card,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Document Management</span>
            <RoleBadge role={displayRole} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Company Selector */}
            <div ref={companyRef} style={{ position: "relative" }}>
              <button
                onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
                style={{
                  fontSize: 10, padding: "3px 8px", borderRadius: 4,
                  border: `1px solid ${C.gBdr}`, background: C.gBg,
                  cursor: "pointer", color: C.forest, fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {cs.companyLabel} ▾
              </button>
              {companyDropdownOpen && (
                <div style={{
                  position: "absolute", right: 0, top: "110%", background: C.card,
                  border: `1px solid ${C.border}`, borderRadius: 6,
                  boxShadow: "0 4px 16px rgba(0,0,0,.12)", zIndex: 300,
                  minWidth: 200, maxHeight: 280, overflowY: "auto",
                }}>
                  {cs.isAdmin && (
                    <div
                      style={{ padding: "6px 12px", cursor: "pointer", fontSize: 11, background: cs.activeCompanyId === "ALL" ? C.gBg2 : "transparent" }}
                      onClick={() => { cs.setActiveCompany("ALL"); setCompanyDropdownOpen(false); }}
                    >All Companies</div>
                  )}
                  {cs.companies.map(c => (
                    <div
                      key={c.id}
                      style={{ padding: "6px 12px", cursor: "pointer", fontSize: 11, background: cs.activeCompanyId === c.id ? C.gBg2 : "transparent" }}
                      onClick={() => { cs.setActiveCompany(c.id); setCompanyDropdownOpen(false); }}
                    >{c.name}</div>
                  ))}
                </div>
              )}
            </div>
            <span style={{ fontSize: 10, color: C.muted }}>
              {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>

        {/* Dashboard iframe — fills entire content area */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {dashboardLoading ? (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: "100%", color: C.muted, fontSize: 13,
            }}>
              Loading Document Management...
            </div>
          ) : blobUrl ? (
            <iframe
              ref={iframeRef}
              src={blobUrl}
              title="Document Management Dashboard"
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                background: "#ffffff",
              }}
            />
          ) : (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: "100%", color: C.forest, fontSize: 13,
            }}>
              Failed to load DMS dashboard. Please try refreshing.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
