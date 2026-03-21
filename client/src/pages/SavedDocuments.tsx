// ══════════════════════════════════════════════════════════════════════════════
// SAVED DOCUMENTS — Platfarm V3
// Renders inside QuotationsHome shell (no own nav/header).
// Uses the portal's C colour palette from @/lib/data.
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { C, FONT } from "@/lib/data";

const TYPE_LABELS: Record<string, string> = {
  quotation: "Quotation",
  invoice: "Invoice",
  payment_receipt: "Receipt",
};

const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  quotation: { bg: C.gBg2, fg: C.forest },
  invoice: { bg: C.tBg2, fg: C.terra },
  payment_receipt: { bg: C.gBg, fg: C.sage },
};

interface Props {
  onBack?: () => void;
  onEdit?: (type: string, id: number) => void;
  onDownloadDocument?: (type: string, id: number) => void;
}

export default function SavedDocuments({ onBack, onEdit, onDownloadDocument }: Props) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  const { data: documents, isLoading, refetch } = trpc.quotations.list.useQuery();
  const deleteMutation = trpc.quotations.delete.useMutation();

  const filtered = useMemo(() => {
    if (!documents) return [];
    let list = documents;
    if (filterType !== "all") list = list.filter(d => d.documentType === filterType);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(d =>
        d.quotationNo.toLowerCase().includes(s) ||
        d.clientName.toLowerCase().includes(s) ||
        (d.projectName && d.projectName.toLowerCase().includes(s))
      );
    }
    return list;
  }, [documents, filterType, search]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      refetch();
    } catch (error) {
      console.error("Error deleting:", error);
      alert("Error deleting document.");
    }
  };

  const formatDate = (d: any) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return String(d); }
  };

  const formatAmount = (n: number | null) => {
    if (!n) return "—";
    return (n / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Action bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14, gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onBack && (
            <button onClick={onBack} style={{
              background: C.gBg, border: `1px solid ${C.gBdr}`, borderRadius: 6,
              padding: "5px 10px", fontSize: 10, fontWeight: 600, color: C.forest,
              cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 4,
            }}>
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>Saved Documents</span>
        </div>
        {onBack && (
          <button onClick={onBack} style={{
            background: C.forest, border: "none", borderRadius: 6, padding: "6px 14px",
            color: C.white, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
          }}>+ New Document</button>
        )}
      </div>

      {/* Search & Filter */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <svg width="14" height="14" fill="none" stroke={C.muted} strokeWidth="2" viewBox="0 0 24 24" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by document number, client, or project..."
            style={{
              width: "100%", border: `1.5px solid ${C.inputBdr}`, borderRadius: 6,
              padding: "7px 10px 7px 30px", fontSize: 12, fontFamily: FONT,
              color: C.dark, outline: "none", background: C.white,
            }}
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          style={{
            border: `1.5px solid ${C.inputBdr}`, borderRadius: 6, padding: "7px 12px",
            fontSize: 12, fontFamily: FONT, color: C.dark,
            outline: "none", background: C.white, cursor: "pointer",
          }}
        >
          <option value="all">All Types</option>
          <option value="quotation">Quotations</option>
          <option value="invoice">Invoices</option>
          <option value="payment_receipt">Receipts</option>
        </select>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Total", count: documents?.length || 0, color: C.forest },
          { label: "Quotations", count: documents?.filter(d => d.documentType === "quotation").length || 0, color: C.forest },
          { label: "Invoices", count: documents?.filter(d => d.documentType === "invoice").length || 0, color: C.terra },
          { label: "Receipts", count: documents?.filter(d => d.documentType === "payment_receipt").length || 0, color: C.sage },
        ].map(s => (
          <div key={s.label} style={{
            background: C.card, borderRadius: 8, padding: "10px 14px",
            border: `1px solid ${C.border}`,
          }}>
            <p style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{s.label}</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Documents Table */}
      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 30, textAlign: "center", color: C.muted, fontSize: 12 }}>Loading documents...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 4 }}>No documents found</p>
            <p style={{ fontSize: 11, color: C.muted }}>
              {search || filterType !== "all" ? "Try adjusting your search or filters" : "Create your first document to get started"}
            </p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 9, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Document</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 9, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Type</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 9, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Client</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 9, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Date</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 9, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Total</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 9, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => {
                const tc = TYPE_COLORS[doc.documentType] || TYPE_COLORS.quotation;
                return (
                  <tr key={doc.id} style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.pageBg}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontWeight: 600, color: C.dark }}>{doc.quotationNo}</span>
                      {doc.projectName && <p style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{doc.projectName}</p>}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 5,
                        fontSize: 10, fontWeight: 600, background: tc.bg, color: tc.fg,
                      }}>{TYPE_LABELS[doc.documentType] || doc.documentType}</span>
                    </td>
                    <td style={{ padding: "10px 14px", color: C.dark }}>{doc.clientName}</td>
                    <td style={{ padding: "10px 14px", color: C.gray }}>{formatDate(doc.createdAt)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600, color: C.dark }}>
                      {doc.currency || "USD"} {formatAmount(doc.total)}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button onClick={() => onEdit?.(doc.documentType, doc.id)} title="Edit" style={{
                          background: C.gBg, border: "none", borderRadius: 5,
                          width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", color: C.forest,
                        }}>
                          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => onDownloadDocument?.(doc.documentType, doc.id)} title="Download PDF" style={{
                          background: C.tBg, border: "none", borderRadius: 5,
                          width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", color: C.terra,
                        }}>
                          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(doc.id)} title="Delete" style={{
                          background: C.rBg, border: "none", borderRadius: 5,
                          width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", color: C.red,
                        }}>
                          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
