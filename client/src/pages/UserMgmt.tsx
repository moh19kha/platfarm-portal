// ══════════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT — Platfarm V3 — User list, role assignment, permission matrix
// ══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import {
  C, MONO, FONT, ROLES, USERS_SEED,
  type UserDef, type Perms,
} from "@/lib/data";
import { Badge, Btn, Card, CardHdr, CHT, CHB, RoleBadge, Th, Td, Section } from "@/components/ui-primitives";
import { EmailAlertSettings } from "@/components/EmailAlertSettings";

interface UserMgmtProps {
  users: UserDef[];
  currentUser: UserDef;
  perms: Perms;
  onRoleChange: (userId: string, newRole: string) => void;
}

export function UserMgmt({ users, currentUser, perms, onRoleChange }: UserMgmtProps) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const roleKeys = Object.keys(ROLES);
  const pageKeys = ["dashboard", "purchase", "sales", "agreements", "users"];
  const seeKeys = ["financials", "margins", "salesDetails", "invoicing", "orderLinePricing", "costPrice"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Users Table */}
      <Section title="Team Members" count={users.length}>
        <Card p={0}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <Th sticky>User</Th><Th>Title</Th><Th>Company</Th><Th>Role</Th>
                {perms.isAdmin && <Th>Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ background: u.id === currentUser.id ? C.gBg2 : i % 2 ? C.gBg : C.card }}>
                  <Td sticky bg={u.id === currentUser.id ? C.gBg2 : i % 2 ? C.gBg : C.card}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: ROLES[u.role]?.color || C.muted,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 700, color: C.white,
                      }}>{u.initials}</div>
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: C.dark }}>{u.name}</div>
                        {u.id === currentUser.id && <span style={{ fontSize: 8, color: C.sage, fontWeight: 600 }}>YOU</span>}
                      </div>
                    </div>
                  </Td>
                  <Td>{u.title}</Td>
                  <Td>{u.company}</Td>
                  <Td>
                    {perms.isAdmin && u.id !== currentUser.id ? (
                      <select
                        value={u.role}
                        onChange={e => onRoleChange(u.id, e.target.value)}
                        style={{
                          padding: "3px 6px", border: `1px solid ${C.inputBdr}`, borderRadius: 5,
                          fontSize: 10, fontWeight: 600, cursor: "pointer", outline: "none",
                          color: ROLES[u.role]?.color || C.gray,
                          background: C.card,
                        }}
                      >
                        {roleKeys.map(rk => (
                          <option key={rk} value={rk}>{ROLES[rk].label}</option>
                        ))}
                      </select>
                    ) : (
                      <RoleBadge role={u.role} />
                    )}
                  </Td>
                  {perms.isAdmin && (
                    <Td>
                      <button
                        onClick={() => setSelectedUser(selectedUser === u.id ? null : u.id)}
                        style={{
                          background: "none", border: `1px solid ${C.border}`, borderRadius: 4,
                          padding: "2px 8px", fontSize: 9, cursor: "pointer", color: C.sage,
                        }}
                      >{selectedUser === u.id ? "Hide" : "Details"}</button>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      {/* Permission Matrix */}
      <Section title="Permission Matrix">
        <Card p={0}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th sticky>Permission</Th>
                  {roleKeys.map(rk => (
                    <Th key={rk}><span style={{ color: ROLES[rk].color }}>{ROLES[rk].label}</span></Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Page access */}
                <tr><td colSpan={roleKeys.length + 1} style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: C.sage, background: C.gBg, borderBottom: `1px solid ${C.border}` }}>Page Access</td></tr>
                {pageKeys.map((pk, i) => (
                  <tr key={pk} style={{ background: i % 2 ? C.gBg : C.card }}>
                    <Td sticky bg={i % 2 ? C.gBg : C.card}>{pk.charAt(0).toUpperCase() + pk.slice(1)}</Td>
                    {roleKeys.map(rk => {
                      const level = ROLES[rk].pages[pk] || "none";
                      const clr = level === "full" || level === "edit" ? C.forest : level === "view" ? C.sage : C.red;
                      const lbl = level === "full" ? "Full" : level === "edit" ? "Edit" : level === "view" ? "View" : "—";
                      return <Td key={rk}><span style={{ fontSize: 10, fontWeight: 600, color: clr }}>{lbl}</span></Td>;
                    })}
                  </tr>
                ))}

                {/* Shipment actions */}
                <tr><td colSpan={roleKeys.length + 1} style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: C.sage, background: C.gBg, borderBottom: `1px solid ${C.border}` }}>Shipment Actions</td></tr>
                {(["create", "edit", "advanceStage"] as const).map((ak, i) => (
                  <tr key={ak} style={{ background: i % 2 ? C.gBg : C.card }}>
                    <Td sticky bg={i % 2 ? C.gBg : C.card}>{ak === "advanceStage" ? "Advance Stage" : ak.charAt(0).toUpperCase() + ak.slice(1)}</Td>
                    {roleKeys.map(rk => {
                      const val = ROLES[rk].shipments[ak];
                      return <Td key={rk}><span style={{ fontSize: 12, color: val ? C.forest : C.red }}>{val ? "✓" : "✗"}</span></Td>;
                    })}
                  </tr>
                ))}

                {/* Data visibility */}
                <tr><td colSpan={roleKeys.length + 1} style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: C.sage, background: C.gBg, borderBottom: `1px solid ${C.border}` }}>Data Visibility</td></tr>
                {seeKeys.map((sk, i) => (
                  <tr key={sk} style={{ background: i % 2 ? C.gBg : C.card }}>
                    <Td sticky bg={i % 2 ? C.gBg : C.card}>{({financials:"Financials",margins:"Margins",salesDetails:"Sales Details",invoicing:"Invoicing",orderLinePricing:"Order Line Pricing",costPrice:"Cost Price"} as Record<string,string>)[sk]||sk}</Td>
                    {roleKeys.map(rk => {
                      const val = ROLES[rk].see[sk];
                      return <Td key={rk}><span style={{ fontSize: 12, color: val ? C.forest : C.red }}>{val ? "✓" : "✗"}</span></Td>;
                    })}
                  </tr>
                ))}

                {/* Load tabs */}
                <tr><td colSpan={roleKeys.length + 1} style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: C.sage, background: C.gBg, borderBottom: `1px solid ${C.border}` }}>Load Tabs</td></tr>
                {["overview", "quality", "trucking", "financial", "documents"].map((tk, i) => (
                  <tr key={tk} style={{ background: i % 2 ? C.gBg : C.card }}>
                    <Td sticky bg={i % 2 ? C.gBg : C.card}>{tk.charAt(0).toUpperCase() + tk.slice(1)}</Td>
                    {roleKeys.map(rk => {
                      const val = ROLES[rk].loads.tabs.includes(tk);
                      return <Td key={rk}><span style={{ fontSize: 12, color: val ? C.forest : C.red }}>{val ? "✓" : "✗"}</span></Td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

      {/* Email Alert Settings */}
      {perms.isAdmin && (
        <Section title="Email Alerts">
          <EmailAlertSettings />
        </Section>
      )}

      {/* Role Descriptions */}
      <Section title="Role Descriptions">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
          {roleKeys.map(rk => {
            const r = ROLES[rk];
            return (
              <Card key={rk}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 16 }}>{r.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{r.label}</span>
                </div>
                <div style={{ fontSize: 10, color: C.gray, lineHeight: 1.5 }}>{r.desc}</div>
              </Card>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
