// ══════════════════════════════════════════════════════════════════════════════
// EMAIL ALERT SETTINGS — Manage email recipients for daily document alerts
// ══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { C, FONT } from "@/lib/data";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function EmailAlertSettings() {
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");

  const utils = trpc.useUtils();

  // Queries
  const { data: recipients, isLoading } = trpc.documents.getEmailRecipients.useQuery();
  const { data: emailStatus } = trpc.documents.getEmailStatus.useQuery();

  // Mutations
  const addRecipient = trpc.documents.addEmailRecipient.useMutation({
    onSuccess: () => {
      utils.documents.getEmailRecipients.invalidate();
      setNewEmail("");
      setNewName("");
      toast.success("Email recipient added");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeRecipient = trpc.documents.removeEmailRecipient.useMutation({
    onSuccess: () => {
      utils.documents.getEmailRecipients.invalidate();
      toast.success("Recipient removed");
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleRecipient = trpc.documents.toggleEmailRecipient.useMutation({
    onSuccess: () => {
      utils.documents.getEmailRecipients.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleAdd = () => {
    const email = newEmail.trim();
    if (!email) return;
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    addRecipient.mutate({ email, name: newName.trim() || undefined });
  };

  const smtpConfigured = emailStatus?.configured ?? false;

  return (
    <div style={{
      background: C.card, borderRadius: 10, border: `1px solid ${C.border}`,
      overflow: "hidden", fontFamily: FONT,
    }}>
      {/* Header */}
      <div style={{
        background: C.forest, padding: "12px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>
            ✉ Email Alert Recipients
          </div>
          <div style={{ color: "#a8d4b8", fontSize: 10, marginTop: 1 }}>
            Daily document alerts will be sent to these email addresses
          </div>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "3px 10px", borderRadius: 99, fontSize: 10, fontWeight: 600,
          background: smtpConfigured ? "rgba(255,255,255,0.15)" : "rgba(192,113,74,0.3)",
          color: smtpConfigured ? "#a8d4b8" : "#ffd4b8",
          border: `1px solid ${smtpConfigured ? "rgba(255,255,255,0.2)" : "rgba(192,113,74,0.5)"}`,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: smtpConfigured ? "#4ade80" : "#C0714A",
          }} />
          {smtpConfigured ? "SMTP Connected" : "SMTP Not Configured"}
        </div>
      </div>

      <div style={{ padding: "16px 18px" }}>
        {/* SMTP Status Banner */}
        {!smtpConfigured && (
          <div style={{
            background: "#FEF9F5", border: `1px solid ${C.tBdr}`, borderRadius: 8,
            padding: "10px 14px", marginBottom: 14, fontSize: 12, color: C.terra,
          }}>
            <strong>SMTP not configured.</strong> To enable email alerts, please provide SMTP credentials
            (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) in the project settings. Email alerts will be
            sent automatically once SMTP is configured and recipients are added below.
          </div>
        )}

        {/* Add Recipient Form */}
        <div style={{
          display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap",
        }}>
          <input
            type="email"
            placeholder="Email address *"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            style={{
              flex: "2 1 200px", padding: "8px 12px", borderRadius: 6,
              border: `1px solid ${C.inputBdr}`, fontSize: 13, fontFamily: FONT,
              outline: "none", background: C.card, color: C.dark,
            }}
          />
          <input
            type="text"
            placeholder="Name (optional)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            style={{
              flex: "1 1 140px", padding: "8px 12px", borderRadius: 6,
              border: `1px solid ${C.inputBdr}`, fontSize: 13, fontFamily: FONT,
              outline: "none", background: C.card, color: C.dark,
            }}
          />
          <button
            onClick={handleAdd}
            disabled={addRecipient.isPending || !newEmail.trim()}
            style={{
              padding: "8px 18px", borderRadius: 6, border: "none",
              background: C.forest, color: "#fff", fontSize: 12, fontWeight: 600,
              cursor: addRecipient.isPending || !newEmail.trim() ? "not-allowed" : "pointer",
              opacity: addRecipient.isPending || !newEmail.trim() ? 0.6 : 1,
              fontFamily: FONT, whiteSpace: "nowrap",
            }}
          >
            {addRecipient.isPending ? "Adding..." : "+ Add Recipient"}
          </button>
        </div>

        {/* Recipients List */}
        {isLoading ? (
          <div style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 12 }}>
            Loading recipients...
          </div>
        ) : !recipients || recipients.length === 0 ? (
          <div style={{
            padding: "24px 16px", textAlign: "center", color: C.muted,
            fontSize: 12, background: C.gBg, borderRadius: 8, border: `1px dashed ${C.border}`,
          }}>
            No email recipients configured yet. Add an email address above to receive daily document alerts.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recipients.map(r => (
              <div key={r.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", borderRadius: 8,
                background: r.active ? C.gBg : "#fafafa",
                border: `1px solid ${r.active ? C.gBdr : "#eee"}`,
                opacity: r.active ? 1 : 0.6,
                transition: "all .2s",
              }}>
                {/* Toggle */}
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={r.active}
                    onChange={() => toggleRecipient.mutate({ id: r.id, active: !r.active })}
                    style={{ width: 14, height: 14, accentColor: C.forest, cursor: "pointer" }}
                  />
                </label>

                {/* Avatar */}
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: r.active ? C.forest : C.muted,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
                }}>
                  {(r.name || r.email).charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: C.dark,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {r.email}
                  </div>
                  {r.name && (
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                      {r.name}
                    </div>
                  )}
                </div>

                {/* Status */}
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                  background: r.active ? C.gBg2 : "#f5f5f5",
                  color: r.active ? C.forest : C.muted,
                  border: `1px solid ${r.active ? C.gBdr2 : "#ddd"}`,
                }}>
                  {r.active ? "Active" : "Paused"}
                </span>

                {/* Added by */}
                {r.addedBy && (
                  <span style={{ fontSize: 9, color: C.muted }}>
                    by {r.addedBy}
                  </span>
                )}

                {/* Remove */}
                <button
                  onClick={() => {
                    if (confirm(`Remove ${r.email} from alert recipients?`)) {
                      removeRecipient.mutate({ id: r.id });
                    }
                  }}
                  style={{
                    padding: "4px 8px", borderRadius: 4, border: "none",
                    background: "transparent", color: C.muted, fontSize: 14,
                    cursor: "pointer", lineHeight: 1,
                  }}
                  title="Remove recipient"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Info footer */}
        <div style={{
          marginTop: 14, padding: "10px 12px", borderRadius: 8,
          background: C.gBg, border: `1px solid ${C.gBdr}`,
          fontSize: 11, color: C.sage, lineHeight: 1.5,
        }}>
          <strong>How it works:</strong> Every day at 8:00 AM, the system checks all in-transit shipments
          for missing critical documents (BL, Certificate of Origin, Delivery Note, Fumigation Certificate
          for Purchase; Bill of Entry, Tax Invoice, Governmental Docs for Sales). If any are missing,
          an email alert is sent to all active recipients listed above, alongside the in-app notification.
        </div>
      </div>
    </div>
  );
}
