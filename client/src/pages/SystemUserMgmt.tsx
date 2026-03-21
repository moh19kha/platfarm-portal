
// Admin-only panel for managing users, per-module CRUD access privileges, and invitations.
// Accessible via the Settings gear icon in the portal top bar.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useEffect } from "react";
import { C, FONT, MONO } from "@/lib/data";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── Types ──────────────────────────────────────────────────────────────────
interface PermRow {
  moduleId: string;
  canView: number;
  canCreate: number;
  canEdit: number;
  canDelete: number;
}

interface UserWithPerms {
  id: number;
  name: string | null;
  email: string | null;
  role: "admin" | "user";
  status: "active" | "inactive" | "pending";
  createdAt: Date;
  lastSignedIn: Date;
  permissions: PermRow[];
}

// ─── Module list (matches portal modules) ───────────────────────────────────
const MODULES = [
  { id: "purchase",     title: "Purchase & Sales Shipments" },
  { id: "production",   title: "Production" },
  { id: "documents",    title: "Document Generator" },
  { id: "investments",  title: "Investments" },
  { id: "supplychain",  title: "Supply Chain" },
  { id: "hr",           title: "Human Resources" },
  { id: "dms",          title: "Document Management" },
  { id: "accounting",   title: "Finance" },
  { id: "inventory",    title: "Inventory & Warehouse" },
  { id: "operations",   title: "Operations Dashboard" },
  { id: "meetings",     title: "Periodic Meetings" },
  { id: "crm",          title: "CRM" },
  { id: "reports",      title: "Reports & Analytics" },
  { id: "pce",          title: "Petty Cash & Expenses" },
];

const CRUD = ["canView", "canCreate", "canEdit", "canDelete"] as const;
const CRUD_LABELS: Record<string, string> = {
  canView: "View", canCreate: "Create", canEdit: "Edit", canDelete: "Delete",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function initPerms(existing: PermRow[]): Record<string, PermRow> {
  const map: Record<string, PermRow> = {};
  for (const m of MODULES) {
    const found = existing.find(p => p.moduleId === m.id);
    map[m.id] = found ?? { moduleId: m.id, canView: 0, canCreate: 0, canEdit: 0, canDelete: 0 };
  }
  return map;
}

function initAllPerms(): Record<string, PermRow> {
  const map: Record<string, PermRow> = {};
  for (const m of MODULES) {
    map[m.id] = { moduleId: m.id, canView: 0, canCreate: 0, canEdit: 0, canDelete: 0 };
  }
  return map;
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Toggle Switch ───────────────────────────────────────────────────────────
function Toggle({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const on = value === 1;
  return (
    <button
      onClick={() => !disabled && onChange(on ? 0 : 1)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: "none", cursor: disabled ? "default" : "pointer",
        background: on ? C.forest : C.border, position: "relative", transition: "background 0.2s",
        opacity: disabled ? 0.4 : 1, flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16,
        borderRadius: "50%", background: "#fff", transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

// ─── User Row ────────────────────────────────────────────────────────────────
function UserRow({ user, selected, onClick }: { user: UserWithPerms; selected: boolean; onClick: () => void }) {
  const moduleCount = user.role === "admin"
    ? MODULES.length
    : user.permissions.filter(p => p.canView === 1).length;

  const isInactive = user.status === "inactive";
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
        background: selected ? C.gBg : "transparent", cursor: "pointer",
        borderBottom: `1px solid ${C.border}`, transition: "background 0.15s",
        opacity: isInactive ? 0.55 : 1,
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = C.pageBg; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
        background: user.role === "admin" ? C.forest : C.sage,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontFamily: FONT, fontSize: 13, fontWeight: 700,
      }}>
        {initials(user.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.dark, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {user.name ?? "—"}
        </div>
        <div style={{ fontFamily: FONT, fontSize: 11, color: C.gray, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {user.email ?? "—"}
        </div>
      </div>
      <div style={{
        padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: FONT,
        background: user.role === "admin" ? C.gBg2 : C.tBg2,
        color: user.role === "admin" ? C.forest : C.terra,
        border: `1px solid ${user.role === "admin" ? C.gBdr : C.tBdr}`,
        textTransform: "uppercase" as const, letterSpacing: "0.04em", flexShrink: 0,
      }}>
        {user.role}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: C.gray, flexShrink: 0, minWidth: 32, textAlign: "right" as const }}>
        {moduleCount}/{MODULES.length}
      </div>
      {isInactive && (
        <div style={{
          padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, fontFamily: FONT,
          background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA",
          textTransform: "uppercase" as const, letterSpacing: "0.04em", flexShrink: 0,
        }}>
          Inactive
        </div>
      )}
    </div>
  );
}

// ─── Permission Matrix ───────────────────────────────────────────────────────
function PermMatrix({
  perms, onChange, isAdmin,
}: {
  perms: Record<string, PermRow>;
  onChange: (moduleId: string, key: typeof CRUD[number], val: number) => void;
  isAdmin: boolean;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT }}>
        <thead>
          <tr style={{ background: C.forest }}>
            <th style={{ padding: "10px 16px", textAlign: "left", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", width: "40%" }}>
              MODULE
            </th>
            {CRUD.map(k => (
              <th key={k} style={{ padding: "10px 12px", textAlign: "center", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>
                {CRUD_LABELS[k].toUpperCase()}
              </th>
            ))}
            <th style={{ padding: "10px 12px", textAlign: "center", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>
              ALL
            </th>
          </tr>
        </thead>
        <tbody>
          {MODULES.map((m, i) => {
            const row = perms[m.id] ?? { moduleId: m.id, canView: 0, canCreate: 0, canEdit: 0, canDelete: 0 };
            const allOn = CRUD.every(k => (isAdmin ? 1 : row[k]) === 1);
            return (
              <tr key={m.id} style={{ background: i % 2 === 0 ? "#fff" : C.pageBg, borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "10px 16px", fontSize: 13, color: C.dark, fontWeight: 500 }}>
                  {m.title}
                </td>
                {CRUD.map(k => (
                  <td key={k} style={{ padding: "10px 12px", textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <Toggle
                        value={isAdmin ? 1 : row[k]}
                        onChange={v => onChange(m.id, k, v)}
                        disabled={isAdmin}
                      />
                    </div>
                  </td>
                ))}
                <td style={{ padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <Toggle
                      value={isAdmin ? 1 : (allOn ? 1 : 0)}
                      onChange={v => { CRUD.forEach(k => onChange(m.id, k, v)); }}
                      disabled={isAdmin}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Invite User Modal ────────────────────────────────────────────────────────
function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [invitePerms, setInvitePerms] = useState<Record<string, PermRow>>(initAllPerms());
  const [step, setStep] = useState<"form" | "permissions" | "done">("form");
  const [result, setResult] = useState<{ inviteUrl: string; emailSent: boolean } | null>(null);
  const [error, setError] = useState("");

  const inviteMut = trpc.invitations.inviteUser.useMutation();

  const handlePermChange = (moduleId: string, key: typeof CRUD[number], val: number) => {
    setInvitePerms(prev => ({ ...prev, [moduleId]: { ...prev[moduleId], [key]: val } }));
  };

  const handleSend = async () => {
    setError("");
    try {
      const res = await inviteMut.mutateAsync({
        email,
        role,
        presetPermissions: role === "user" ? Object.values(invitePerms) : undefined,
      });
      setResult({ inviteUrl: res.inviteUrl, emailSent: res.emailSent });
      setStep("done");
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send invitation");
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, width: "100%", maxWidth: 560,
        boxShadow: "0 16px 48px rgba(0,0,0,0.18)", overflow: "hidden",
        display: "flex", flexDirection: "column", maxHeight: "90vh",
      }}>
        {/* Modal header */}
        <div style={{ background: C.forest, padding: "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15, fontFamily: FONT }}>Invite New User</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}>✕</button>
        </div>

        {/* Steps indicator */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, background: C.pageBg }}>
          {["Details", "Permissions", "Done"].map((label, idx) => {
            const stepMap = ["form", "permissions", "done"];
            const active = step === stepMap[idx];
            const past = stepMap.indexOf(step) > idx;
            return (
              <div key={label} style={{
                flex: 1, padding: "10px 0", textAlign: "center",
                fontFamily: FONT, fontSize: 12, fontWeight: active ? 700 : 500,
                color: active ? C.forest : past ? C.sage : C.muted,
                borderBottom: active ? `2px solid ${C.forest}` : "2px solid transparent",
              }}>
                {past ? "✓ " : ""}{label}
              </div>
            );
          })}
        </div>

        {/* Modal body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>

          {/* Step 1: Email + Role */}
          {step === "form" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.dark, display: "block", marginBottom: 6 }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="user@company.com"
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 8,
                    border: `1px solid ${C.inputBdr}`, fontFamily: FONT, fontSize: 13,
                    background: "#fff", color: C.dark, outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.dark, display: "block", marginBottom: 8 }}>
                  Role
                </label>
                <div style={{ display: "flex", gap: 12 }}>
                  {(["user", "admin"] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      style={{
                        flex: 1, padding: "12px 16px", borderRadius: 8, cursor: "pointer",
                        border: `2px solid ${role === r ? C.forest : C.border}`,
                        background: role === r ? C.gBg : "#fff",
                        fontFamily: FONT, fontSize: 13, fontWeight: role === r ? 700 : 500,
                        color: role === r ? C.forest : C.gray, transition: "all 0.15s",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ fontSize: 16, marginBottom: 4 }}>{r === "admin" ? "⚙" : "👤"}</div>
                      <div style={{ fontWeight: 700 }}>{r === "admin" ? "Administrator" : "Team Member"}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        {r === "admin"
                          ? "Full access to all modules and user management"
                          : "Access limited to permitted modules only"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div style={{ padding: "10px 14px", borderRadius: 6, background: "#FEF2F2", border: "1px solid #FECACA", fontFamily: FONT, fontSize: 12, color: "#DC2626" }}>
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Permissions (only for non-admin) */}
          {step === "permissions" && (
            <div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 4 }}>
                  Pre-configure Module Access
                </div>
                <div style={{ fontFamily: FONT, fontSize: 12, color: C.gray }}>
                  These permissions will be automatically applied when <strong>{email}</strong> accepts the invitation.
                  You can change them later.
                </div>
              </div>
              <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
                <PermMatrix perms={invitePerms} onChange={handlePermChange} isAdmin={false} />
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === "done" && result && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "8px 0" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", background: C.gBg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28,
              }}>
                {result.emailSent ? "✉️" : "🔗"}
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 6 }}>
                  Invitation {result.emailSent ? "Sent!" : "Created"}
                </div>
                <div style={{ fontFamily: FONT, fontSize: 13, color: C.gray, lineHeight: 1.5 }}>
                  {result.emailSent
                    ? `An invitation email has been sent to ${email}. They will receive a link to register and join Platfarm.`
                    : `Email delivery failed, but the invitation link is ready. Share it manually with ${email}.`}
                </div>
              </div>
              {!result.emailSent && (
                <div style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8,
                  background: C.pageBg, border: `1px solid ${C.border}`,
                  fontFamily: MONO, fontSize: 11, color: C.dark,
                  wordBreak: "break-all", userSelect: "all",
                }}>
                  {result.inviteUrl}
                </div>
              )}
              <div style={{
                padding: "10px 16px", borderRadius: 6, background: C.gBg, border: `1px solid ${C.gBdr}`,
                fontFamily: FONT, fontSize: 12, color: C.gray, textAlign: "center",
              }}>
                ⏰ This invitation expires in <strong>7 days</strong>.
              </div>
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div style={{
          padding: "14px 24px", borderTop: `1px solid ${C.border}`,
          display: "flex", justifyContent: "flex-end", gap: 10, background: C.pageBg,
        }}>
          {step === "done" ? (
            <button
              onClick={onClose}
              style={{
                padding: "9px 24px", borderRadius: 8, border: "none", cursor: "pointer",
                fontFamily: FONT, fontSize: 13, fontWeight: 700, background: C.forest, color: "#fff",
              }}
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                style={{
                  padding: "9px 20px", borderRadius: 8, cursor: "pointer",
                  fontFamily: FONT, fontSize: 13, background: "#fff", color: C.gray,
                  border: `1px solid ${C.border}`,
                }}
              >
                Cancel
              </button>
              {step === "form" && (
                <button
                  onClick={() => {
                    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                      setError("Please enter a valid email address");
                      return;
                    }
                    setError("");
                    if (role === "admin") {
                      handleSend();
                    } else {
                      setStep("permissions");
                    }
                  }}
                  style={{
                    padding: "9px 24px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontFamily: FONT, fontSize: 13, fontWeight: 700, background: C.forest, color: "#fff",
                  }}
                >
                  {role === "admin" ? "Send Invitation" : "Next: Set Permissions →"}
                </button>
              )}
              {step === "permissions" && (
                <>
                  <button
                    onClick={() => setStep("form")}
                    style={{
                      padding: "9px 20px", borderRadius: 8, cursor: "pointer",
                      fontFamily: FONT, fontSize: 13, background: "#fff", color: C.gray,
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={inviteMut.isPending}
                    style={{
                      padding: "9px 24px", borderRadius: 8, border: "none",
                      cursor: inviteMut.isPending ? "default" : "pointer",
                      fontFamily: FONT, fontSize: 13, fontWeight: 700,
                      background: C.forest, color: "#fff", opacity: inviteMut.isPending ? 0.7 : 1,
                    }}
                  >
                    {inviteMut.isPending ? "Sending…" : "Send Invitation ✉"}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Invitations Tab ─────────────────────────────────────────────────────────
const InlineError = ({ message }: { message?: string }) => (
  <div style={{ padding: "14px 16px", background: "#FDF0F0", border: "1px solid #F5C4C4", borderRadius: 8, display: "flex", alignItems: "flex-start", gap: 10 }}>
    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠</span>
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#C94444", marginBottom: 2 }}>Failed to load data</div>
      {message && <div style={{ fontSize: 11, color: "#B44" }}>{message}</div>}
    </div>
  </div>
);

function InvitationsTab() {
  const utils = trpc.useUtils();
  const { data: invitations, isLoading, isError } = trpc.invitations.listInvitations.useQuery();
  const revokeMut = trpc.invitations.revokeInvitation.useMutation({
    onSuccess: () => utils.invitations.listInvitations.invalidate(),
  });

  const statusColor = (status: string, isExpired: boolean) => {
    if (isExpired || status === "expired") return { bg: "#FEF9F5", border: "#F0D5C4", text: "#C0714A" };
    if (status === "accepted") return { bg: C.gBg, border: C.gBdr, text: C.forest };
    if (status === "revoked") return { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626" };
    return { bg: C.aBg, border: C.aBdr, text: C.amber }; // pending
  };

  return (
    <div style={{ padding: 20 }}>
      {isLoading ? (
        <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 40 }}>Loading invitations…</div>
      ) : isError ? (
        <InlineError message="Could not load invitations. Please refresh to try again." />
      ) : !invitations?.length ? (
        <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 40 }}>
          No invitations sent yet. Use the "Invite User" button to add team members.
        </div>
      ) : (
        <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT }}>
            <thead>
              <tr style={{ background: C.forest }}>
                <th style={{ padding: "10px 16px", textAlign: "left", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>EMAIL</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>ROLE</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>INVITED BY</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>SENT</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>EXPIRES</th>
                <th style={{ padding: "10px 12px", textAlign: "center", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>STATUS</th>
                <th style={{ padding: "10px 12px", textAlign: "center", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv, i) => {
                const colors = statusColor(inv.status, inv.isExpired);
                const statusLabel = inv.isExpired ? "Expired" : inv.status.charAt(0).toUpperCase() + inv.status.slice(1);
                return (
                  <tr key={inv.id} style={{ background: i % 2 === 0 ? "#fff" : C.pageBg, borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: C.dark }}>{inv.email}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: inv.role === "admin" ? C.gBg2 : C.tBg2,
                        color: inv.role === "admin" ? C.forest : C.terra,
                        border: `1px solid ${inv.role === "admin" ? C.gBdr : C.tBdr}`,
                        textTransform: "uppercase" as const,
                      }}>
                        {inv.role}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: C.gray }}>{inv.invitedBy ?? "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: C.gray }}>{fmtDate(inv.createdAt)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: C.gray }}>{fmtDate(inv.expiresAt)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                        background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text,
                      }}>
                        {statusLabel}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      {inv.status === "pending" && !inv.isExpired ? (
                        <button
                          onClick={() => revokeMut.mutate({ token: inv.token })}
                          disabled={revokeMut.isPending}
                          style={{
                            padding: "4px 12px", borderRadius: 5, border: "1px solid #FECACA",
                            background: "#FEF2F2", color: "#DC2626", cursor: "pointer",
                            fontFamily: FONT, fontSize: 11, fontWeight: 600,
                          }}
                        >
                          Revoke
                        </button>
                      ) : (
                        <span style={{ color: C.muted, fontSize: 11 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Company Access Panel ────────────────────────────────────────────────────
function CompanyAccessPanel({
  userId,
  isAdmin,
}: {
  userId: number;
  isAdmin: boolean;
}) {
  const utils = trpc.useUtils();
  const { data: odooCompanies, isLoading: companiesLoading } = trpc.odoo.companies.useQuery();
  const { data: accessRows, isLoading: accessLoading } = trpc.userMgmt.getUserCompanyAccess.useQuery({ userId });
  const setAccessMut = trpc.userMgmt.setUserCompanyAccess.useMutation({
    onSuccess: () => {
      utils.userMgmt.getUserCompanyAccess.invalidate({ userId });
      utils.userMgmt.getAllCompanyAccess.invalidate();
    },
  });

  const [allowed, setAllowed] = useState<Set<number>>(new Set());
  const [defaultId, setDefaultId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const initialised = React.useRef(false);

  // Initialise local state from server data
  useEffect(() => {
    if (!accessRows || initialised.current) return;
    initialised.current = true;
    setAllowed(new Set(accessRows.map(r => r.odooCompanyId)));
    const def = accessRows.find(r => r.isDefault === 1);
    setDefaultId(def?.odooCompanyId ?? null);
  }, [accessRows]);

  // Reset when userId changes
  useEffect(() => {
    initialised.current = false;
    setAllowed(new Set());
    setDefaultId(null);
    setSaved(false);
  }, [userId]);

  const toggleCompany = (id: number) => {
    setSaved(false);
    setAllowed(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (defaultId === id) setDefaultId(null);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setAccessMut.mutateAsync({
        userId,
        allowedCompanyIds: Array.from(allowed),
        defaultCompanyId: defaultId,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (companiesLoading || accessLoading) {
    return <div style={{ padding: 32, textAlign: "center", color: C.muted, fontFamily: FONT, fontSize: 13 }}>Loading…</div>;
  }

  const companies = odooCompanies ?? [];
  const noRestriction = allowed.size === 0;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 4 }}>
          Company Access
        </div>
        <div style={{ fontFamily: FONT, fontSize: 12, color: C.gray }}>
          {isAdmin
            ? "Admins always have access to all companies and cannot be restricted."
            : "Select which companies this user can see in the company selector across all modules. Leave all unchecked to allow access to all companies."}
        </div>
      </div>

      {isAdmin ? (
        <div style={{
          padding: "14px 16px", borderRadius: 8, background: C.gBg, border: `1px solid ${C.gBdr}`,
          fontFamily: FONT, fontSize: 13, color: C.forest, fontWeight: 600,
        }}>
          ✓ Full access to all companies (admin)
        </div>
      ) : (
        <>
          {/* No-restriction notice */}
          {noRestriction && (
            <div style={{
              marginBottom: 14, padding: "10px 14px", borderRadius: 8,
              background: C.aBg, border: `1px solid ${C.aBdr}`,
              fontFamily: FONT, fontSize: 12, color: C.amber,
            }}>
              ⚠ No companies selected — user will see <strong>all companies</strong>.
            </div>
          )}

          {/* Company checklist */}
          <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`, marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT }}>
              <thead>
                <tr style={{ background: C.forest }}>
                  <th style={{ padding: "9px 16px", textAlign: "left", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", width: 40 }}>ALLOW</th>
                  <th style={{ padding: "9px 16px", textAlign: "left", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>COMPANY</th>
                  <th style={{ padding: "9px 12px", textAlign: "center", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", width: 90 }}>DEFAULT</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((co, i) => {
                  const isAllowed = allowed.has(co.id);
                  const isDefault = defaultId === co.id;
                  return (
                    <tr key={co.id} style={{ background: i % 2 === 0 ? "#fff" : C.pageBg, borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "9px 16px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isAllowed}
                          onChange={() => toggleCompany(co.id)}
                          style={{ width: 16, height: 16, cursor: "pointer", accentColor: C.forest }}
                        />
                      </td>
                      <td style={{ padding: "9px 16px" }}>
                        <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.dark }}>{co.name}</div>
                        {(co.currency || co.country) && (
                          <div style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>
                            {[co.currency, co.country].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "9px 12px", textAlign: "center" }}>
                        <input
                          type="radio"
                          name={`default-company-${userId}`}
                          checked={isDefault}
                          disabled={!isAllowed}
                          onChange={() => { if (isAllowed) { setDefaultId(co.id); setSaved(false); } }}
                          style={{ width: 16, height: 16, cursor: isAllowed ? "pointer" : "default", accentColor: C.forest, opacity: isAllowed ? 1 : 0.3 }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary + Save */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, fontFamily: FONT, fontSize: 12, color: C.gray }}>
              {noRestriction
                ? "All companies visible"
                : `${allowed.size} of ${companies.length} companies allowed`}
              {defaultId !== null && (
                <span style={{ marginLeft: 8, color: C.forest, fontWeight: 600 }}>
                  · Default: {companies.find(c => c.id === defaultId)?.name ?? "—"}
                </span>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "8px 20px", borderRadius: 6, border: "none",
                cursor: saving ? "default" : "pointer",
                fontFamily: FONT, fontSize: 13, fontWeight: 700,
                background: saved ? C.sage : C.forest, color: "#fff",
                opacity: saving ? 0.7 : 1, transition: "all 0.15s",
              }}
            >
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function SystemUserMgmt({ onBack }: { onBack?: () => void }) {
  const { user: me } = useAuth();
  const utils = trpc.useUtils();

  const { data: usersData, isLoading, isError } = trpc.userMgmt.listUsers.useQuery();
  const updateRoleMut = trpc.userMgmt.updateRole.useMutation({
    onSuccess: () => utils.userMgmt.listUsers.invalidate(),
  });
  const updateStatusMut = trpc.userMgmt.updateStatus.useMutation({
    onSuccess: () => utils.userMgmt.listUsers.invalidate(),
  });
  const setAllPermsMut = trpc.userMgmt.setAllPermissions.useMutation({
    onSuccess: () => utils.userMgmt.listUsers.invalidate(),
  });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [localPerms, setLocalPerms] = useState<Record<string, PermRow>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "invitations">("users");
  const [detailTab, setDetailTab] = useState<"permissions" | "companies">("permissions");
  const [showInviteModal, setShowInviteModal] = useState(false);

  const users = useMemo(() => (usersData ?? []) as UserWithPerms[], [usersData]);
  const filteredUsers = useMemo(() =>
    users.filter(u =>
      !search ||
      (u.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? "").toLowerCase().includes(search.toLowerCase())
    ), [users, search]);

  const selectedUser = useMemo(() => users.find(u => u.id === selectedId) ?? null, [users, selectedId]);

  const handleSelect = (user: UserWithPerms) => {
    setSelectedId(user.id);
    setLocalPerms(initPerms(user.permissions));
    setSaved(false);
    setDetailTab("permissions");
  };

  const handlePermChange = (moduleId: string, key: typeof CRUD[number], val: number) => {
    setLocalPerms(prev => ({ ...prev, [moduleId]: { ...prev[moduleId], [key]: val } }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await setAllPermsMut.mutateAsync({ userId: selectedUser.id, permissions: Object.values(localPerms) });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const handleRoleToggle = async (user: UserWithPerms) => {
    if (user.id === me?.id) return;
    const newRole = user.role === "admin" ? "user" : "admin";
    await updateRoleMut.mutateAsync({ userId: user.id, role: newRole });
  };
  const handleStatusToggle = async (user: UserWithPerms) => {
    if (user.id === me?.id) return;
    const newStatus = user.status === "active" ? "inactive" : "active";
    await updateStatusMut.mutateAsync({ userId: user.id, status: newStatus });
  };

  // ─── Layout ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.pageBg, fontFamily: FONT }}>
      {/* Header */}
      <div style={{
        height: 48, background: C.forest, display: "flex", alignItems: "center",
        padding: "0 20px", gap: 12, flexShrink: 0,
      }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer",
              fontFamily: FONT, fontSize: 13, display: "flex", alignItems: "center", gap: 4, padding: 0,
            }}
          >
            ← Back
          </button>
        )}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: "0.01em" }}>
            User Management
          </span>
        </div>
        {/* Invite User button */}
        <button
          onClick={() => setShowInviteModal(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
            background: C.terra, color: "#fff", fontFamily: FONT, fontSize: 13, fontWeight: 700,
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          Invite User
        </button>
        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
          {users.length} user{users.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, background: "#fff", flexShrink: 0 }}>
        {(["users", "invitations"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 20px", background: "none", border: "none", cursor: "pointer",
              fontFamily: FONT, fontSize: 13, fontWeight: activeTab === tab ? 700 : 500,
              color: activeTab === tab ? C.forest : C.gray,
              borderBottom: activeTab === tab ? `2px solid ${C.forest}` : "2px solid transparent",
              transition: "all 0.15s",
            }}
          >
            {tab === "users" ? "👥 Users" : "✉ Invitations"}
          </button>
        ))}
      </div>

      {/* Body */}
      {activeTab === "invitations" ? (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <InvitationsTab />
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Left: User list */}
          <div style={{
            width: 280, flexShrink: 0, background: "#fff", borderRight: `1px solid ${C.border}`,
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            {/* Search */}
            <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ position: "relative" }}>
                <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search users…"
                  style={{
                    width: "100%", padding: "7px 10px 7px 32px", borderRadius: 6,
                    border: `1px solid ${C.inputBdr}`, fontFamily: FONT, fontSize: 12,
                    background: C.pageBg, color: C.dark, outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {isLoading ? (
                <div style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>Loading…</div>
              ) : isError ? (
                <div style={{ padding: 24 }}><InlineError message="Could not load users. Please refresh to try again." /></div>
              ) : filteredUsers.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>No users found</div>
              ) : (
                filteredUsers.map(u => (
                  <UserRow key={u.id} user={u} selected={u.id === selectedId} onClick={() => handleSelect(u)} />
                ))
              )}
            </div>
          </div>

          {/* Right: Permission editor */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {!selectedUser ? (
              <div style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                color: C.muted, gap: 12,
              }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={C.border} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span style={{ fontFamily: FONT, fontSize: 14 }}>Select a user to manage their access</span>
              </div>
            ) : (
              <>
                {/* User header */}
                <div style={{
                  padding: "14px 20px", background: "#fff", borderBottom: `1px solid ${C.border}`,
                  display: "flex", alignItems: "center", gap: 14, flexShrink: 0, flexWrap: "wrap",
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                    background: selectedUser.role === "admin" ? C.forest : C.sage,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontFamily: FONT, fontSize: 16, fontWeight: 700,
                  }}>
                    {initials(selectedUser.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: C.dark }}>
                      {selectedUser.name ?? "—"}
                    </div>
                    <div style={{ fontFamily: FONT, fontSize: 12, color: C.gray }}>
                      {selectedUser.email ?? "—"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: FONT, fontSize: 12, color: C.gray }}>Role:</span>
                    <button
                      onClick={() => handleRoleToggle(selectedUser)}
                      disabled={selectedUser.id === me?.id}
                      style={{
                        padding: "5px 14px", borderRadius: 6, border: "none",
                        cursor: selectedUser.id === me?.id ? "default" : "pointer",
                        fontFamily: FONT, fontSize: 12, fontWeight: 700,
                        background: selectedUser.role === "admin" ? C.gBg2 : C.tBg2,
                        color: selectedUser.role === "admin" ? C.forest : C.terra,
                        opacity: selectedUser.id === me?.id ? 0.5 : 1, transition: "all 0.15s",
                      }}
                    >
                      {selectedUser.role === "admin" ? "👑 Admin" : "👤 User"}
                      {selectedUser.id !== me?.id && (
                        <span style={{ marginLeft: 6, opacity: 0.6, fontSize: 10 }}>
                          → {selectedUser.role === "admin" ? "User" : "Admin"}
                        </span>
                      )}
                    </button>
                    {selectedUser.role === "admin" && (
                      <span style={{
                        padding: "4px 10px", borderRadius: 4, background: C.aBg, border: `1px solid ${C.aBdr}`,
                        fontFamily: FONT, fontSize: 11, color: C.amber,
                      }}>
                        Full access (all modules)
                      </span>
                    )}
                  </div>
                  {/* Active/Inactive toggle */}
                  {selectedUser.id !== me?.id && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: FONT, fontSize: 12, color: C.gray }}>Status:</span>
                      <button
                        onClick={() => handleStatusToggle(selectedUser)}
                        style={{
                          padding: "5px 14px", borderRadius: 6, cursor: "pointer",
                          fontFamily: FONT, fontSize: 12, fontWeight: 700,
                          background: selectedUser.status === "active" ? C.gBg2 : "#FEF2F2",
                          color: selectedUser.status === "active" ? C.forest : "#DC2626",
                          border: `1px solid ${selectedUser.status === "active" ? C.gBdr : "#FECACA"}`,
                          transition: "all 0.15s",
                        }}
                      >
                        {selectedUser.status === "active" ? "✓ Active" : "✗ Inactive"}
                        <span style={{ marginLeft: 6, opacity: 0.6, fontSize: 10 }}>
                          {selectedUser.status === "active" ? "→ Deactivate" : "→ Activate"}
                        </span>
                      </button>
                    </div>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      padding: "8px 20px", borderRadius: 6, border: "none", cursor: saving ? "default" : "pointer",
                      fontFamily: FONT, fontSize: 13, fontWeight: 700,
                      background: saved ? C.sage : C.forest, color: "#fff",
                      opacity: saving ? 0.7 : 1, transition: "all 0.15s",
                    }}
                  >
                    {saving ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}
                  </button>
                </div>

                {/* Detail sub-tabs: Permissions | Companies */}
                <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, background: C.pageBg, flexShrink: 0 }}>
                  {(["permissions", "companies"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setDetailTab(tab)}
                      style={{
                        padding: "9px 18px", background: "none", border: "none", cursor: "pointer",
                        fontFamily: FONT, fontSize: 12, fontWeight: detailTab === tab ? 700 : 500,
                        color: detailTab === tab ? C.forest : C.gray,
                        borderBottom: detailTab === tab ? `2px solid ${C.forest}` : "2px solid transparent",
                        transition: "all 0.15s",
                      }}
                    >
                      {tab === "permissions" ? "🔐 Module Permissions" : "🏢 Company Access"}
                    </button>
                  ))}
                </div>

                {/* Permission matrix */}
                {detailTab === "permissions" && (
                <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 4 }}>
                      Module Access Privileges
                    </div>
                    <div style={{ fontFamily: FONT, fontSize: 12, color: C.gray }}>
                      Toggle each privilege per module. Changes take effect after saving.
                    </div>
                  </div>
                  <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
                    <PermMatrix
                      perms={localPerms}
                      onChange={handlePermChange}
                      isAdmin={false}
                    />
                  </div>
                  <div style={{
                      marginTop: 16, padding: "12px 16px", borderRadius: 8,
                      background: C.gBg, border: `1px solid ${C.gBdr}`,
                      display: "flex", gap: 24, flexWrap: "wrap",
                    }}>
                      {(["canView", "canCreate", "canEdit", "canDelete"] as const).map(k => {
                        const count = Object.values(localPerms).filter(p => p[k] === 1).length;
                        return (
                          <div key={k} style={{ textAlign: "center" }}>
                            <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: C.forest }}>{count}</div>
                            <div style={{ fontFamily: FONT, fontSize: 11, color: C.gray }}>{CRUD_LABELS[k]}</div>
                          </div>
                        );
                      })}
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: C.terra }}>
                          {MODULES.length - Object.values(localPerms).filter(p => p.canView === 1).length}
                        </div>
                        <div style={{ fontFamily: FONT, fontSize: 11, color: C.gray }}>Blocked</div>
                      </div>
                    </div>
                </div>
                )}

                {/* Company Access panel */}
                {detailTab === "companies" && selectedUser && (
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    <CompanyAccessPanel userId={selectedUser.id} isAdmin={selectedUser.role === "admin"} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => utils.invitations.listInvitations.invalidate()}
        />
      )}
    </div>
  );
}
