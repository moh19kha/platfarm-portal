// ══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE LISTING — Platfarm V3 — Clean standalone employee list
// Fetches employee data directly via tRPC (no iframe). Simple table with
// search, department filter, and employee detail drawer.
// Includes the same HR sidebar as HRHome for consistent navigation.
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  C, FONT, USERS_SEED, ROLES,
  type UserDef,
} from "@/lib/data";
import { PlatfarmLogo } from "@/components/PlatfarmLogo";
import { useAuth } from "@/_core/hooks/useAuth";
import { CompanySelector } from "@/components/CompanySelector";
import { useCompanySelector } from "@/hooks/useCompanySelector";

// ─── Types ───────────────────────────────────────────────────────────────────
type Employee = {
  id: number;
  name: string;
  jobTitle: string;
  department: { id: number; name: string } | null;
  company: { id: number; name: string } | null;
  workEmail: string;
  workPhone: string;
  mobilePhone: string;
  phone: string;
  presenceState: string;
  attendanceState: string;
  avatar: string;
  manager: { id: number; name: string } | null;
  identificationId: string;
  gender: string;
  marital: string;
  birthday: string;
  emergencyContact: string;
  emergencyPhone: string;
  createDate: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map(w => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "#2D5A3D", "#C0714A", "#3B7DD8", "#D4960A",
    "#7B5EA7", "#2A9D8F", "#E76F51", "#264653",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function presenceBadge(state: string): { label: string; bg: string; color: string } {
  if (state === "present") return { label: "Present", bg: C.gBg2, color: C.forest };
  return { label: "Out", bg: "#F3F3F0", color: C.gray };
}

/** Check if a base64 string looks valid (non-empty and reasonable length) */
function isValidBase64Avatar(avatar: string): boolean {
  if (!avatar || avatar.length < 20) return false;
  // Check it doesn't start with common "broken" patterns
  return /^[A-Za-z0-9+/=\s]+$/.test(avatar.slice(0, 100));
}

// ─── Avatar Component with error fallback ────────────────────────────────────
function EmployeeAvatar({ name, avatar, size = 32 }: { name: string; avatar: string; size?: number }) {
  const [imgError, setImgError] = useState(false);

  if (avatar && isValidBase64Avatar(avatar) && !imgError) {
    return (
      <img
        src={`data:image/png;base64,${avatar}`}
        alt={name}
        onError={() => setImgError(true)}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: getAvatarColor(name),
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 700, color: C.white, flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function EmployeeListing() {
  // ─── RBAC State (same as HRHome) ───────────────────────────────────────
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

  // ─── Navigation State ──────────────────────────────────────────────────
  const [, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [isMob, setIsMob] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const _h = () => setIsMob(window.innerWidth < 768);
    window.addEventListener("resize", _h);
    return () => window.removeEventListener("resize", _h);
  }, []);
  useEffect(() => { if (isMob) setCollapsed(true); }, [isMob]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);

  // ─── Global Company Selector ──────────────────────────────────────────
  const cs = useCompanySelector({ allowAll: true });

  // Navigate to the full Employee Directory profile page (iframe-based)
  const openEmployeeProfile = useCallback((emp: Employee) => {
    // Store the employee ID in sessionStorage for HRHome to pick up
    sessionStorage.setItem('hr_open_profile', JSON.stringify({
      employeeId: emp.id,
      tab: 'overview',
    }));
    // Navigate to /hr — HRHome will read sessionStorage and open the profile
    setLocation('/hr');
  }, [setLocation]);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Sidebar nav items (same as HRHome)
  const navItems = [
    { id: "dashboard", label: "HR Dashboard", icon: "◈", sub: "Overview" },
    { id: "employee-listing", label: "Employee Listing", icon: "👥", sub: "All Staff" },
    { id: "leaves", label: "Leave Management", icon: "🏖️", sub: "Requests" },
    { id: "discipline", label: "Bonus & Fines", icon: "📝", sub: "Records" },
    { id: "incentives", label: "Incentives", icon: "📊", sub: "Production" },
  ];

  const handleNavClick = useCallback((pageId: string) => {
    if (pageId === "employee-listing") return; // Already on this page
    // Navigate to HR module for iframe-based pages
    setLocation("/hr");
    // Use a small delay to let HRHome mount, then trigger navigation
    setTimeout(() => {
      window.postMessage({ type: 'hr-navigate-on-load', page: pageId }, '*');
    }, 100);
  }, [setLocation]);

  // ─── Data fetching ─────────────────────────────────────────────────────
  const { data: employees, isLoading, error } = trpc.hr.employees.useQuery();
  const { data: departments } = trpc.hr.departments.useQuery();

  // ─── Filtering ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!employees) return [];
    return employees.filter(emp => {
      const matchSearch =
        !search ||
        emp.name.toLowerCase().includes(search.toLowerCase()) ||
        emp.jobTitle.toLowerCase().includes(search.toLowerCase()) ||
        emp.workEmail.toLowerCase().includes(search.toLowerCase()) ||
        emp.identificationId.toLowerCase().includes(search.toLowerCase());
      const matchDept =
        deptFilter === "all" || emp.department?.name === deptFilter;
      const matchCompany =
        cs.activeCompanyId === "ALL" || emp.company?.id === cs.activeCompanyId;
      return matchSearch && matchDept && matchCompany;
    });
  }, [employees, search, deptFilter, cs.activeCompanyId]);

  // ─── Unique departments for filter ─────────────────────────────────
  const deptOptions = useMemo(() => {
    if (!employees) return [];
    const depts = new Set<string>();
    employees.forEach(e => { if (e.department?.name) depts.add(e.department.name); });
    return Array.from(depts).sort();
  }, [employees]);



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

      {/* ── Sidebar (identical to HRHome) ────────────────────────────────── */}
      <div style={{
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

        {/* Module Label */}
        {!collapsed && (
          <div style={{
            padding: "6px 10px 2px",
            fontSize: 8, fontWeight: 700, color: C.sage,
            textTransform: "uppercase", letterSpacing: 0.8,
          }}>
            HR Management
          </div>
        )}

        {/* Nav Items */}
        <div style={{ flex: 1, padding: 4, display: "flex", flexDirection: "column", gap: 1, overflow: "auto" }}>
          {navItems.map(item => {
            const active = item.id === "employee-listing";
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
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          padding: "16px 24px", background: C.card,
          borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        }}>
          {/* Title */}
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.dark }}>
              Employee Listing
            </h1>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              {filtered.length} employee{filtered.length !== 1 ? "s" : ""}
              {cs.activeCompanyId !== "ALL" && cs.activeCompany && ` at ${cs.activeCompany.name}`}
              {deptFilter !== "all" && ` in ${deptFilter}`}
            </div>
          </div>

          {/* Company Selector (same as rest of portal) */}
          <CompanySelector
            companies={cs.companies}
            companiesLoading={cs.companiesLoading}
            activeCompanyId={cs.activeCompanyId}
            activeCompany={cs.activeCompany}
            companyLabel={cs.companyLabel}
            setActiveCompany={cs.setActiveCompany}
            allowAll={true}
            open={companyDropdownOpen}
            onOpenChange={setCompanyDropdownOpen}
          />

          {/* View Toggle */}
          <div style={{
            display: "flex", borderRadius: 6, overflow: "hidden",
            border: `1px solid ${C.border}`,
          }}>
            {(["table", "cards"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: "6px 14px", border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 500, fontFamily: FONT,
                  background: viewMode === mode ? C.forest : C.card,
                  color: viewMode === mode ? C.white : C.gray,
                  transition: "all .15s",
                }}
              >
                {mode === "table" ? "Table" : "Cards"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Filters Bar ────────────────────────────────────────────────── */}
        <div style={{
          padding: "12px 24px", background: C.card,
          borderBottom: `1px solid ${C.border}`,
          display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
        }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 360 }}>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, title, email, ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "8px 10px 8px 32px",
                border: `1px solid ${C.inputBdr}`, borderRadius: 6,
                fontSize: 12, fontFamily: FONT, color: C.dark,
                background: C.pageBg, outline: "none",
                transition: "border-color .15s",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = C.forest; }}
              onBlur={e => { e.currentTarget.style.borderColor = C.inputBdr; }}
            />
          </div>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            style={{
              padding: "8px 28px 8px 10px",
              border: `1px solid ${C.inputBdr}`, borderRadius: 6,
              fontSize: 12, fontFamily: FONT, color: C.dark,
              background: C.pageBg, cursor: "pointer", outline: "none",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364706C' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 8px center",
            }}
          >
            <option value="all">All Departments</option>
            {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          {/* Clear filters */}
          {(search || deptFilter !== "all" || cs.activeCompanyId !== "ALL") && (
            <button
              onClick={() => { setSearch(""); setDeptFilter("all"); cs.setActiveCompany("ALL"); }}
              style={{
                padding: "6px 12px", border: `1px solid ${C.border}`,
                borderRadius: 6, background: C.card, cursor: "pointer",
                fontSize: 11, fontFamily: FONT, color: C.terra, fontWeight: 500,
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: "auto", padding: isMob ? 12 : 24 }}>
          {isLoading && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", height: "100%", gap: 12,
            }}>
              <div style={{
                width: 32, height: 32, border: `3px solid ${C.border}`,
                borderTopColor: C.forest, borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }} />
              <div style={{ fontSize: 13, color: C.muted }}>Loading employees...</div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {error && (
            <div style={{
              padding: 20, background: C.rBg, border: `1px solid ${C.rBdr}`,
              borderRadius: 8, color: C.red, fontSize: 13, textAlign: "center",
            }}>
              Failed to load employees. Please try again.
            </div>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <div style={{
              padding: 40, textAlign: "center", color: C.muted, fontSize: 13,
            }}>
              No employees found matching your criteria.
            </div>
          )}

          {/* ── Table View ──────────────────────────────────────────────── */}
          {!isLoading && !error && filtered.length > 0 && viewMode === "table" && (
            <div style={{
              background: C.card, borderRadius: 8,
              border: `1px solid ${C.border}`, overflow: "hidden",
            }}>
              <table style={{
                width: "100%", borderCollapse: "collapse", fontSize: 12,
              }}>
                <thead>
                  <tr style={{ background: C.gBg, borderBottom: `2px solid ${C.gBdr}` }}>
                    {["Employee", "Job Title", "Company", "Department", "Email", "Phone", "Status"].map(h => (
                      <th key={h} style={{
                        padding: "10px 14px", textAlign: "left",
                        fontSize: 10, fontWeight: 700, color: C.forest,
                        textTransform: "uppercase", letterSpacing: 0.5,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp, i) => {
                    const badge = presenceBadge(emp.presenceState);
                    return (
                      <tr
                        key={emp.id}
                        onClick={() => openEmployeeProfile(emp)}
                        style={{
                          borderBottom: `1px solid ${C.border}`,
                          cursor: "pointer",
                          background: i % 2 === 0 ? C.card : "#FAFAF8",
                          transition: "background .1s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = C.gBg; }}
                        onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? C.card : "#FAFAF8"; }}
                      >
                        {/* Employee */}
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <EmployeeAvatar name={emp.name} avatar={emp.avatar} size={32} />
                            <div>
                              <div style={{ fontWeight: 600, color: C.dark }}>{emp.name}</div>
                              {emp.identificationId && (
                                <div style={{ fontSize: 10, color: C.muted }}>ID: {emp.identificationId}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        {/* Job Title */}
                        <td style={{ padding: "10px 14px", color: C.gray }}>{emp.jobTitle || "—"}</td>
                        {/* Company */}
                        <td style={{ padding: "10px 14px" }}>
                          {emp.company ? (
                            <span style={{
                              padding: "3px 8px", borderRadius: 4,
                              background: "#F5F0EB", color: C.terra,
                              fontSize: 10, fontWeight: 600,
                            }}>
                              {emp.company.name.split('-')[0]}
                            </span>
                          ) : "—"}
                        </td>
                        {/* Department */}
                        <td style={{ padding: "10px 14px" }}>
                          {emp.department ? (
                            <span style={{
                              padding: "3px 8px", borderRadius: 4,
                              background: C.gBg, color: C.forest,
                              fontSize: 10, fontWeight: 600,
                            }}>
                              {emp.department.name}
                            </span>
                          ) : "—"}
                        </td>
                        {/* Email */}
                        <td style={{ padding: "10px 14px", color: C.gray, fontSize: 11 }}>
                          {emp.workEmail || "—"}
                        </td>
                        {/* Phone */}
                        <td style={{ padding: "10px 14px", color: C.gray, fontSize: 11 }}>
                          {emp.mobilePhone || emp.workPhone || emp.phone || "—"}
                        </td>
                        {/* Status */}
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{
                            padding: "3px 10px", borderRadius: 12,
                            background: badge.bg, color: badge.color,
                            fontSize: 10, fontWeight: 600,
                          }}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Cards View ──────────────────────────────────────────────── */}
          {!isLoading && !error && filtered.length > 0 && viewMode === "cards" && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}>
              {filtered.map(emp => {
                const badge = presenceBadge(emp.presenceState);
                return (
                  <div
                    key={emp.id}
                    onClick={() => openEmployeeProfile(emp)}
                    style={{
                      background: C.card, borderRadius: 8,
                      border: `1px solid ${C.border}`,
                      padding: 16, cursor: "pointer",
                      transition: "all .15s",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = C.gBdr;
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = C.border;
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <EmployeeAvatar name={emp.name} avatar={emp.avatar} size={40} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: C.dark }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: C.gray }}>{emp.jobTitle || "No title"}</div>
                      </div>
                      <span style={{
                        padding: "3px 8px", borderRadius: 12,
                        background: badge.bg, color: badge.color,
                        fontSize: 9, fontWeight: 600,
                      }}>
                        {badge.label}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {emp.department && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                          </svg>
                          <span style={{ color: C.forest, fontWeight: 500 }}>{emp.department.name}</span>
                        </div>
                      )}
                      {emp.workEmail && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                          </svg>
                          <span style={{ color: C.gray }}>{emp.workEmail}</span>
                        </div>
                      )}
                      {(emp.mobilePhone || emp.workPhone) && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                          </svg>
                          <span style={{ color: C.gray }}>{emp.mobilePhone || emp.workPhone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Employee Detail Drawer ─────────────────────────────────────── */}
      {selectedEmp && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setSelectedEmp(null)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
              zIndex: 200, transition: "opacity .2s",
            }}
          />
          {/* Drawer */}
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0,
            width: 420, maxWidth: "90vw",
            background: C.card, zIndex: 201,
            boxShadow: "-4px 0 20px rgba(0,0,0,0.1)",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}>
            {/* Drawer Header */}
            <div style={{
              padding: "20px 24px", background: C.forest,
              color: C.white, display: "flex", alignItems: "center", gap: 14,
            }}>
              {selectedEmp.avatar && isValidBase64Avatar(selectedEmp.avatar) ? (
                <img
                  src={`data:image/png;base64,${selectedEmp.avatar}`}
                  alt={selectedEmp.name}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  style={{
                    width: 52, height: 52, borderRadius: "50%",
                    objectFit: "cover", border: "2px solid rgba(255,255,255,0.3)",
                  }}
                />
              ) : (
                <div style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 700, border: "2px solid rgba(255,255,255,0.3)",
                }}>
                  {getInitials(selectedEmp.name)}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedEmp.name}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{selectedEmp.jobTitle || "No title"}</div>
                {selectedEmp.department && (
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                    {selectedEmp.department.name}
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelectedEmp(null)}
                style={{
                  background: "rgba(255,255,255,0.15)", border: "none",
                  borderRadius: 6, padding: 6, cursor: "pointer",
                  color: C.white, display: "flex",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, overflow: "auto", padding: isMob ? 12 : 24 }}>
              {/* Status */}
              <div style={{ marginBottom: 20 }}>
                {(() => {
                  const badge = presenceBadge(selectedEmp.presenceState);
                  return (
                    <span style={{
                      padding: "4px 12px", borderRadius: 12,
                      background: badge.bg, color: badge.color,
                      fontSize: 11, fontWeight: 600,
                    }}>
                      {badge.label}
                    </span>
                  );
                })()}
              </div>

              {/* Info Sections */}
              <DetailSection title="Contact Information">
                <DetailRow label="Work Email" value={selectedEmp.workEmail} />
                <DetailRow label="Work Phone" value={selectedEmp.workPhone} />
                <DetailRow label="Mobile" value={selectedEmp.mobilePhone} />
                <DetailRow label="Phone" value={selectedEmp.phone} />
              </DetailSection>

              <DetailSection title="Work Information">
                <DetailRow label="Company" value={selectedEmp.company?.name} />
                <DetailRow label="Department" value={selectedEmp.department?.name} />
                <DetailRow label="Job Title" value={selectedEmp.jobTitle} />
                <DetailRow label="Manager" value={selectedEmp.manager?.name} />
                <DetailRow label="Employee ID" value={selectedEmp.identificationId} />
              </DetailSection>

              <DetailSection title="Personal Information">
                <DetailRow label="Gender" value={selectedEmp.gender ? selectedEmp.gender.charAt(0).toUpperCase() + selectedEmp.gender.slice(1) : ""} />
                <DetailRow label="Marital Status" value={selectedEmp.marital ? selectedEmp.marital.charAt(0).toUpperCase() + selectedEmp.marital.slice(1) : ""} />
                <DetailRow label="Birthday" value={selectedEmp.birthday} />
              </DetailSection>

              <DetailSection title="Emergency Contact">
                <DetailRow label="Contact Name" value={selectedEmp.emergencyContact} />
                <DetailRow label="Contact Phone" value={selectedEmp.emergencyPhone} />
              </DetailSection>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: C.forest,
        textTransform: "uppercase", letterSpacing: 0.5,
        marginBottom: 8, paddingBottom: 6,
        borderBottom: `1px solid ${C.border}`,
      }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", fontSize: 12 }}>
      <div style={{ width: 130, color: C.muted, flexShrink: 0 }}>{label}</div>
      <div style={{ color: C.dark, fontWeight: 500 }}>{value}</div>
    </div>
  );
}
