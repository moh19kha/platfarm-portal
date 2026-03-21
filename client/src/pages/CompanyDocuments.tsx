/**
 * CompanyDocuments — Mandatory Company Documents with Expiry Tracking
 * 
 * Shows a per-company checklist of 6 required document types.
 * Each document can be linked to an existing Odoo document and tracked with expiry dates.
 * Admin can edit expiry dates, link Odoo documents, and upload new ones; all users can view.
 */

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useCompanySelector } from "@/hooks/useCompanySelector";
import { CompanySelector } from "@/components/CompanySelector";
import { PlatfarmLogo } from "@/components/PlatfarmLogo";
import { C, FONT } from "@/lib/data";

// ─── Design Tokens (DMS Blue) ─────────────────────────────────────────────
const DMS = {
  primary: "#2B6CB0",
  secondary: "#4299E1",
  hover: "#2563EB",
  gBg: "#EBF4FF",
  gBg2: "#DBEAFE",
  gBdr: "#BFDBFE",
  accentBar: "linear-gradient(90deg, #2B6CB0, #4299E1)",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  company_registration: "Company Registration",
  vat_registration: "VAT Registration",
  tax_registration: "Tax Registration",
  constitution_contract: "Constitution Contract",
  owner_id: "Owner ID",
  owner_passport: "Owner Passport",
};

const DOC_TYPE_ICONS: Record<string, string> = {
  company_registration: "🏢",
  vat_registration: "📋",
  tax_registration: "🧾",
  constitution_contract: "📜",
  owner_id: "🪪",
  owner_passport: "🛂",
};

const DOC_TYPES = [
  "company_registration",
  "vat_registration",
  "tax_registration",
  "constitution_contract",
  "owner_id",
  "owner_passport",
] as const;

type DocStatus = "valid" | "expiring_soon" | "expired" | "missing" | "no_expiry";

function getDocStatus(doc: any): DocStatus {
  if (!doc) return "missing";
  if (!doc.expiryDate) return "no_expiry";
  const now = new Date();
  const expiry = new Date(doc.expiryDate);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (expiry < now) return "expired";
  if (expiry <= in30Days) return "expiring_soon";
  return "valid";
}

const STATUS_COLORS: Record<DocStatus, { bg: string; text: string; border: string; label: string }> = {
  valid: { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0", label: "Valid" },
  expiring_soon: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A", label: "Expiring Soon" },
  expired: { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA", label: "Expired" },
  missing: { bg: "#F9FAFB", text: "#6B7280", border: "#E5E7EB", label: "Not Uploaded" },
  no_expiry: { bg: "#EBF4FF", text: "#2B6CB0", border: "#BFDBFE", label: "No Expiry Set" },
};

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
}

function daysUntilExpiry(d: string | null | undefined): string {
  if (!d) return "";
  const now = new Date();
  const expiry = new Date(d);
  const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Expires today";
  return `${diff}d remaining`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CompanyDocuments() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const cs = useCompanySelector({ allowAll: true });
  const [companySelectorOpen, setCompanySelectorOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState("");
  const [linkBrowseFolderId, setLinkBrowseFolderId] = useState<number | undefined>(undefined);
  const [linkFolderPath, setLinkFolderPath] = useState<{id: number; name: string}[]>([]);
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<number | null>(null);

  // Download a linked Odoo document
  const handleDownloadDocument = async (odooDocumentId: number, fileName: string) => {
    setDownloadingDocId(odooDocumentId);
    try {
      const result = await trpc.companyDocs.downloadDocument.query({ odooDocumentId });
      if (result.data) {
        const byteString = atob(result.data);
        const bytes = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
        const blob = new Blob([bytes]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'document';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download document. Please try again.');
    } finally {
      setDownloadingDocId(null);
    }
  };

  // Fetch folder tree for dropdown
  const folderTreeQuery = trpc.companyDocs.getFolderTree.useQuery(undefined, {
    enabled: showLinkModal,
  });

  // Fetch company documents
  const companyId = cs.activeCompanyId === "ALL" ? undefined : cs.activeCompanyId;
  const docsQuery = trpc.companyDocs.list.useQuery(
    companyId ? { companyId } : undefined
  );
  const summaryQuery = trpc.companyDocs.expirySummary.useQuery();

  // Odoo document search for linking
  const odooSearchQuery = trpc.companyDocs.searchOdooDocuments.useQuery(
    {
      query: linkSearchQuery || undefined,
      companyId: editingDoc?.odooCompanyId || undefined,
      folderId: linkBrowseFolderId || undefined,
    },
    { enabled: showLinkModal }
  );

  // Mutations
  const utils = trpc.useUtils();
  const upsertMutation = trpc.companyDocs.upsert.useMutation({
    onSuccess: () => {
      utils.companyDocs.list.invalidate();
      utils.companyDocs.expirySummary.invalidate();
      setShowEditModal(false);
      setEditingDoc(null);
    },
  });
  const initCompanyMutation = trpc.companyDocs.initializeCompany.useMutation({
    onSuccess: () => {
      utils.companyDocs.list.invalidate();
      utils.companyDocs.expirySummary.invalidate();
    },
  });
  const linkMutation = trpc.companyDocs.linkOdooDocument.useMutation({
    onSuccess: () => {
      utils.companyDocs.list.invalidate();
      setShowLinkModal(false);
    },
  });

  // Group documents by company
  const docsByCompany = useMemo(() => {
    if (!docsQuery.data) return {};
    const map: Record<number, { companyName: string; docs: Record<string, any> }> = {};
    for (const doc of docsQuery.data.documents) {
      if (!map[doc.odooCompanyId]) {
        map[doc.odooCompanyId] = { companyName: doc.companyName, docs: {} };
      }
      map[doc.odooCompanyId].docs[doc.docType] = doc;
    }
    return map;
  }, [docsQuery.data]);

  // Summary stats
  const summary = summaryQuery.data;

  // Edit form state
  const [editForm, setEditForm] = useState({
    expiryDate: "",
    issueDate: "",
    referenceNumber: "",
    notes: "",
    documentName: "",
  });
  const [editError, setEditError] = useState("");

  const openEditModal = (doc: any, companyId: number, companyName: string, docType: string) => {
    setEditingDoc({ ...doc, odooCompanyId: companyId, companyName, docType });
    setEditForm({
      expiryDate: doc?.expiryDate ? doc.expiryDate.split("T")[0] : "",
      issueDate: doc?.issueDate ? doc.issueDate.split("T")[0] : "",
      referenceNumber: doc?.referenceNumber || "",
      notes: doc?.notes || "",
      documentName: doc?.documentName || "",
    });
    setShowEditModal(true);
    setEditError("");
  };

  const handleSave = () => {
    if (!editingDoc) return;
    if (!editForm.expiryDate) {
      setEditError("Expiry date is required");
      return;
    }
    setEditError("");
    upsertMutation.mutate({
      id: editingDoc.id || undefined,
      odooCompanyId: editingDoc.odooCompanyId,
      companyName: editingDoc.companyName,
      docType: editingDoc.docType,
      odooDocumentId: editingDoc.odooDocumentId || null,
      documentName: editForm.documentName || null,
      expiryDate: editForm.expiryDate || null,
      issueDate: editForm.issueDate || null,
      referenceNumber: editForm.referenceNumber || null,
      notes: editForm.notes || null,
    });
  };

  const handleInitCompany = (companyId: number, companyName: string) => {
    initCompanyMutation.mutate({ odooCompanyId: companyId, companyName });
  };

  const openLinkModal = () => {
    setLinkSearchQuery("");
    setLinkBrowseFolderId(undefined);
    setLinkFolderPath([]);
    setShowLinkModal(true);
  };

  const handleLinkDocument = (odooDoc: any) => {
    if (!editingDoc?.id) return;
    linkMutation.mutate({
      id: editingDoc.id,
      odooDocumentId: odooDoc.id,
      documentName: odooDoc.name,
    });
    // Also update the editing doc state
    setEditingDoc((prev: any) => ({
      ...prev,
      odooDocumentId: odooDoc.id,
      documentName: odooDoc.name,
    }));
    setEditForm(f => ({ ...f, documentName: odooDoc.name }));
  };

  const navigateToFolder = (folderId: number, folderName: string) => {
    setLinkBrowseFolderId(folderId);
    setLinkFolderPath(prev => [...prev, { id: folderId, name: folderName }]);
    setLinkSearchQuery("");
  };

  const navigateToFolderBreadcrumb = (index: number) => {
    if (index < 0) {
      setLinkBrowseFolderId(undefined);
      setLinkFolderPath([]);
    } else {
      const target = linkFolderPath[index];
      setLinkBrowseFolderId(target.id);
      setLinkFolderPath(prev => prev.slice(0, index + 1));
    }
  };

  return (
    <div style={{
      display: "flex", height: "100vh", background: C.pageBg,
      fontFamily: FONT, color: C.dark, overflow: "hidden",
    }}>
      {/* Top accent bar */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 3,
        background: DMS.accentBar, zIndex: 100,
      }} />

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <div style={{
        width: 240, minWidth: 240,
        background: C.card, borderRight: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column",
        marginTop: 3, overflow: "hidden",
      }}>
        {/* Logo */}
        <div style={{
          padding: "9px 10px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", gap: 7,
        }}>
          <PlatfarmLogo height={28} treeColor="#1B3A2D" textColor={DMS.primary} />
        </div>

        {/* Back to Home */}
        <div
          onClick={() => navigate("/")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 10px", margin: "4px 4px 0",
            borderRadius: 5, cursor: "pointer",
            color: DMS.primary, fontSize: 10, fontWeight: 600,
            transition: "all .15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = DMS.gBg; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Home</span>
        </div>

        {/* Module Label */}
        <div style={{
          padding: "6px 10px 2px",
          fontSize: 8, fontWeight: 700, color: DMS.secondary,
          textTransform: "uppercase", letterSpacing: 0.8,
        }}>
          Document Management
        </div>

        {/* Nav Items */}
        <div style={{ padding: "4px 8px" }}>
          <div
            onClick={() => navigate("/dms")}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "7px 10px", borderRadius: 6, cursor: "pointer",
              background: "transparent", color: C.gray,
              fontWeight: 400, fontSize: 11.5, transition: "all .15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = DMS.gBg; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            📊 Dashboard
          </div>
          <div
            onClick={() => navigate("/dms")}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "7px 10px", borderRadius: 6, cursor: "pointer",
              background: "transparent", color: C.gray,
              fontWeight: 400, fontSize: 11.5, transition: "all .15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = DMS.gBg; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            📂 All Documents
          </div>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "7px 10px", borderRadius: 6, cursor: "pointer",
              background: DMS.gBg2, color: DMS.primary,
              fontWeight: 600, fontSize: 11.5,
            }}
          >
            🏛️ Mandatory Company Documents
          </div>
        </div>

        {/* Expiry Overview */}
        {summary && (
          <div style={{
            margin: "auto 8px 8px", padding: "10px",
            background: DMS.gBg, borderRadius: 8,
            border: `1px solid ${DMS.gBdr}`,
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: DMS.primary, marginBottom: 6, textTransform: "uppercase" }}>
              Expiry Overview
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {[
                { label: "Valid", value: summary.valid, color: "#065F46" },
                { label: "Expiring", value: summary.expiringSoon, color: "#92400E" },
                { label: "Expired", value: summary.expired, color: "#991B1B" },
                { label: "No Date", value: summary.missing, color: "#6B7280" },
              ].map(s => (
                <div key={s.label} style={{
                  textAlign: "center", padding: "4px 0",
                  background: "white", borderRadius: 4,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 8, color: C.muted }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User */}
        {user && (
          <div style={{
            padding: "8px 10px", borderTop: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%",
              background: DMS.primary, color: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700,
            }}>
              {(user.name || "U")[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.dark }}>{user.name || "User"}</div>
              <div style={{ fontSize: 8, color: C.muted }}>{user.role === "admin" ? "Administrator" : "User"}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", marginTop: 3 }}>
        {/* Header */}
        <div style={{
          padding: "16px 24px", background: C.card,
          borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: C.dark, margin: 0 }}>
              Mandatory Company Documents
            </h1>
            <p style={{ fontSize: 12, color: C.muted, margin: "2px 0 0" }}>
              Track mandatory documents and their expiry dates across all companies
            </p>
          </div>
          <CompanySelector
            {...cs}
            open={companySelectorOpen}
            onOpenChange={setCompanySelectorOpen}
          />
        </div>

        {/* Summary Cards */}
        <div style={{ padding: "16px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Total Documents", value: summary?.total ?? 0, color: DMS.primary, bg: DMS.gBg },
              { label: "Valid", value: summary?.valid ?? 0, color: "#065F46", bg: "#ECFDF5" },
              { label: "Expiring Soon", value: summary?.expiringSoon ?? 0, color: "#92400E", bg: "#FFFBEB" },
              { label: "Expired", value: summary?.expired ?? 0, color: "#991B1B", bg: "#FEF2F2" },
            ].map(card => (
              <div key={card.label} style={{
                background: card.bg, borderRadius: 10, padding: "14px 16px",
                border: `1px solid ${card.color}20`,
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
                <div style={{ fontSize: 11, color: card.color, opacity: 0.8, fontWeight: 500 }}>{card.label}</div>
              </div>
            ))}
          </div>

          {/* Loading */}
          {docsQuery.isLoading && (
            <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
              <div style={{ fontSize: 14 }}>Loading company documents...</div>
            </div>
          )}

          {/* Company Sections */}
          {!docsQuery.isLoading && (
            <>
              {cs.companies
                .filter(c => cs.activeCompanyId === "ALL" || c.id === cs.activeCompanyId)
                .map(company => {
                  const companyData = docsByCompany[company.id];
                  const hasDocs = companyData && Object.keys(companyData.docs).length > 0;

                  return (
                    <div key={company.id} style={{
                      background: C.card, borderRadius: 12, padding: 20,
                      border: `1px solid ${C.border}`, marginBottom: 16,
                    }}>
                      {/* Company Header */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        marginBottom: 16, paddingBottom: 12,
                        borderBottom: `1px solid ${C.border}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 8,
                            background: DMS.gBg, color: DMS.primary,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 16, fontWeight: 700,
                          }}>
                            {company.name[0]}
                          </div>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: C.dark }}>{company.name}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>
                              {hasDocs
                                ? `${Object.values(companyData.docs).filter((d: any) => d.expiryDate).length} / ${DOC_TYPES.length} documents with expiry dates`
                                : "No documents initialized"}
                            </div>
                          </div>
                        </div>
                        {isAdmin && !hasDocs && (
                          <button
                            onClick={() => handleInitCompany(company.id, company.name)}
                            disabled={initCompanyMutation.isPending}
                            style={{
                              padding: "6px 14px", borderRadius: 6, border: "none",
                              background: DMS.primary, color: "white", fontSize: 11,
                              fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                              opacity: initCompanyMutation.isPending ? 0.7 : 1,
                            }}
                          >
                            {initCompanyMutation.isPending ? "Initializing..." : "Initialize Documents"}
                          </button>
                        )}
                      </div>

                      {/* Document Grid */}
                      {hasDocs ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                          {DOC_TYPES.map(docType => {
                            const doc = companyData.docs[docType];
                            const status = getDocStatus(doc);
                            const sc = STATUS_COLORS[status];
                            const hasLinkedDoc = doc?.odooDocumentId;

                            return (
                              <div
                                key={docType}
                                onClick={() => isAdmin && openEditModal(doc, company.id, company.name, docType)}
                                style={{
                                  background: sc.bg, borderRadius: 10, padding: 14,
                                  border: `1px solid ${sc.border}`,
                                  cursor: isAdmin ? "pointer" : "default",
                                  transition: "all .15s",
                                }}
                                onMouseEnter={e => {
                                  if (isAdmin) {
                                    e.currentTarget.style.transform = "translateY(-2px)";
                                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                                  }
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.transform = "translateY(0)";
                                  e.currentTarget.style.boxShadow = "none";
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ fontSize: 16 }}>{DOC_TYPE_ICONS[docType]}</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: C.dark }}>
                                      {DOC_TYPE_LABELS[docType]}
                                    </span>
                                  </div>
                                  <span style={{
                                    fontSize: 9, fontWeight: 600, color: sc.text,
                                    background: `${sc.text}15`, padding: "2px 6px",
                                    borderRadius: 4,
                                  }}>
                                    {sc.label}
                                  </span>
                                </div>

                                {doc?.expiryDate && (
                                  <div style={{ fontSize: 11, color: sc.text, marginBottom: 2 }}>
                                    <strong>Expires:</strong> {formatDate(doc.expiryDate)}
                                  </div>
                                )}
                                {doc?.expiryDate && (
                                  <div style={{ fontSize: 10, color: sc.text, opacity: 0.8 }}>
                                    {daysUntilExpiry(doc.expiryDate)}
                                  </div>
                                )}
                                {doc?.referenceNumber && (
                                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                                    Ref: {doc.referenceNumber}
                                  </div>
                                )}

                                {/* Linked Odoo Document Info */}
                                {hasLinkedDoc && (
                                  <div style={{
                                    marginTop: 6, padding: "4px 8px",
                                    background: "white", borderRadius: 6,
                                    border: `1px solid ${C.border}`,
                                    display: "flex", alignItems: "center", gap: 6,
                                  }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={DMS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                                      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                                    </svg>
                                    <span style={{
                                      fontSize: 10, color: DMS.primary, fontWeight: 500,
                                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                      flex: 1,
                                    }}>
                                      {doc.documentName || `Odoo Doc #${doc.odooDocumentId}`}
                                    </span>
                                  </div>
                                )}

                                {!hasLinkedDoc && doc?.documentName && (
                                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    📎 {doc.documentName}
                                  </div>
                                )}

                                {!doc && (
                                  <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>
                                    {isAdmin ? "Click to add details" : "Not configured yet"}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{
                          textAlign: "center", padding: "32px 0", color: C.muted, fontSize: 13,
                        }}>
                          {isAdmin
                            ? "Click \"Initialize Documents\" to set up the 6 required document types for this company."
                            : "No documents configured for this company yet. Contact an admin to set them up."}
                        </div>
                      )}
                    </div>
                  );
                })}

              {cs.companies.length === 0 && !cs.companiesLoading && (
                <div style={{
                  textAlign: "center", padding: "60px 0", color: C.muted, fontSize: 14,
                }}>
                  No companies available.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Edit Modal ───────────────────────────────────────────── */}
      {showEditModal && editingDoc && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 200,
          }}
          onClick={() => setShowEditModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "white", borderRadius: 16, padding: 28,
              width: 520, maxHeight: "85vh", overflow: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <span style={{ fontSize: 24 }}>{DOC_TYPE_ICONS[editingDoc.docType]}</span>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: C.dark, margin: 0 }}>
                  {DOC_TYPE_LABELS[editingDoc.docType]}
                </h2>
                <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{editingDoc.companyName}</p>
              </div>
            </div>

            {/* ── Linked Odoo Document Section ──────────────────── */}
            <div style={{
              background: DMS.gBg, borderRadius: 10, padding: 14,
              border: `1px solid ${DMS.gBdr}`, marginBottom: 16,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: DMS.primary,
                marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5,
              }}>
                Linked Document (from Odoo)
              </div>

              {editingDoc.odooDocumentId ? (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "white", borderRadius: 8, padding: "10px 12px",
                  border: `1px solid ${C.border}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DMS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>
                        {editingDoc.documentName || `Document #${editingDoc.odooDocumentId}`}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted }}>
                        Odoo ID: {editingDoc.odooDocumentId}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => handleDownloadDocument(editingDoc.odooDocumentId!, editingDoc.documentName || ("document-" + editingDoc.odooDocumentId))}
                      disabled={downloadingDocId === editingDoc.odooDocumentId}
                      style={{
                        padding: "4px 10px", borderRadius: 6,
                        border: "1px solid " + DMS.primary, background: DMS.primary,
                        fontSize: 10, fontWeight: 600,
                        cursor: downloadingDocId === editingDoc.odooDocumentId ? "not-allowed" : "pointer",
                        color: "white", fontFamily: FONT,
                        opacity: downloadingDocId === editingDoc.odooDocumentId ? 0.7 : 1,
                        display: "flex", alignItems: "center", gap: 4,
                      }}
                    >
                      {downloadingDocId === editingDoc.odooDocumentId ? "Downloading..." : (
                        <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</>
                      )}
                    </button>
                    <button
                      onClick={openLinkModal}
                      style={{
                        padding: "4px 10px", borderRadius: 6,
                        border: "1px solid " + DMS.gBdr, background: "white",
                        fontSize: 10, fontWeight: 500, cursor: "pointer",
                        color: DMS.primary, fontFamily: FONT,
                      }}
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={openLinkModal}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 8,
                    border: `2px dashed ${DMS.gBdr}`, background: "white",
                    fontSize: 12, fontWeight: 500, cursor: "pointer",
                    color: DMS.primary, fontFamily: FONT,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    transition: "all .15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = DMS.primary; e.currentTarget.style.background = DMS.gBg; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = DMS.gBdr; e.currentTarget.style.background = "white"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                  </svg>
                  Link from Odoo Documents
                </button>
              )}
            </div>

            {/* ── Expiry & Details Form ─────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.dark, display: "block", marginBottom: 4 }}>
                  Document Name
                </label>
                <input
                  type="text"
                  value={editForm.documentName}
                  onChange={e => setEditForm(f => ({ ...f, documentName: e.target.value }))}
                  placeholder="e.g., Company Registration Certificate"
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 8,
                    border: `1px solid ${C.border}`, fontSize: 13,
                    fontFamily: FONT, outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: C.dark, display: "block", marginBottom: 4 }}>
                    Expiry Date <span style={{ color: "#991B1B" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={editForm.expiryDate}
                    onChange={e => setEditForm(f => ({ ...f, expiryDate: e.target.value }))}
                    style={{
                      width: "100%", padding: "8px 12px", borderRadius: 8,
                      border: `1px solid ${editError && !editForm.expiryDate ? "#FECACA" : C.border}`, fontSize: 13,
                      fontFamily: FONT, outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: C.dark, display: "block", marginBottom: 4 }}>
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={editForm.issueDate}
                    onChange={e => setEditForm(f => ({ ...f, issueDate: e.target.value }))}
                    style={{
                      width: "100%", padding: "8px 12px", borderRadius: 8,
                      border: `1px solid ${C.border}`, fontSize: 13,
                      fontFamily: FONT, outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.dark, display: "block", marginBottom: 4 }}>
                  Reference / Registration Number
                </label>
                <input
                  type="text"
                  value={editForm.referenceNumber}
                  onChange={e => setEditForm(f => ({ ...f, referenceNumber: e.target.value }))}
                  placeholder="e.g., CR-2024-12345"
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 8,
                    border: `1px solid ${C.border}`, fontSize: 13,
                    fontFamily: FONT, outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.dark, display: "block", marginBottom: 4 }}>
                  Notes
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional notes..."
                  rows={3}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 8,
                    border: `1px solid ${C.border}`, fontSize: 13,
                    fontFamily: FONT, outline: "none", resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {editError && (
              <div style={{
                background: "#FEF2F2", border: "1px solid #FECACA",
                borderRadius: 8, padding: "8px 12px", marginTop: 12,
                fontSize: 12, color: "#991B1B", fontWeight: 500,
              }}>
                {editError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowEditModal(false)}
                style={{
                  padding: "8px 20px", borderRadius: 8, border: `1px solid ${C.border}`,
                  background: "white", fontSize: 13, fontWeight: 500,
                  cursor: "pointer", fontFamily: FONT, color: C.dark,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={upsertMutation.isPending}
                style={{
                  padding: "8px 20px", borderRadius: 8, border: "none",
                  background: DMS.primary, color: "white", fontSize: 13,
                  fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                  opacity: upsertMutation.isPending ? 0.7 : 1,
                }}
              >
                {upsertMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Link from Odoo Modal ─────────────────────────────────── */}
      {showLinkModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 300,
          }}
          onClick={() => setShowLinkModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "white", borderRadius: 16, padding: 0,
              width: 640, maxHeight: "85vh", overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              display: "flex", flexDirection: "column",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: C.dark, margin: 0 }}>
                  Link from Odoo Documents
                </h3>
                <p style={{ fontSize: 11, color: C.muted, margin: "2px 0 0" }}>
                  Browse folders or search documents in Odoo to link to this record
                </p>
              </div>
              <button
                onClick={() => setShowLinkModal(false)}
                style={{
                  width: 28, height: 28, borderRadius: 6, border: "none",
                  background: C.pageBg, cursor: "pointer", fontSize: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {/* ── Folder Tree Dropdown ──────────────────────────────── */}
            <div style={{ padding: "12px 20px 0", borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: DMS.primary, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Browse Folders
              </div>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setFolderDropdownOpen(!folderDropdownOpen)}
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 8,
                    border: `1px solid ${folderDropdownOpen ? DMS.primary : C.border}`,
                    background: folderDropdownOpen ? DMS.gBg : "white",
                    fontSize: 13, fontFamily: FONT, color: C.dark,
                    cursor: "pointer", display: "flex", alignItems: "center",
                    justifyContent: "space-between", textAlign: "left",
                    transition: "all .15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DMS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                    </svg>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {linkFolderPath.length > 0
                        ? linkFolderPath.map(f => f.name).join(" / ")
                        : "All Workspaces (select a folder)"}
                    </span>
                  </div>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0, transition: "transform .15s", transform: folderDropdownOpen ? "rotate(180deg)" : "rotate(0)" }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Dropdown Panel */}
                {folderDropdownOpen && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                    background: "white", borderRadius: 10, border: `1px solid ${C.border}`,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 10,
                    maxHeight: 280, overflow: "auto",
                  }}>
                    {folderTreeQuery.isLoading && (
                      <div style={{ padding: "20px", textAlign: "center", color: C.muted, fontSize: 12 }}>
                        Loading folder tree...
                      </div>
                    )}
                    {folderTreeQuery.isError && (
                      <div style={{ padding: "20px", textAlign: "center", color: "#991B1B", fontSize: 12 }}>
                        Failed to load folders
                      </div>
                    )}
                    {folderTreeQuery.data && (
                      <div style={{ padding: "6px 0" }}>
                        {/* "All" option */}
                        <div
                          onClick={() => {
                            setLinkBrowseFolderId(undefined);
                            setLinkFolderPath([]);
                            setFolderDropdownOpen(false);
                          }}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "8px 14px", cursor: "pointer",
                            background: !linkBrowseFolderId ? DMS.gBg : "transparent",
                            fontWeight: !linkBrowseFolderId ? 600 : 400,
                            color: !linkBrowseFolderId ? DMS.primary : C.dark,
                            fontSize: 12, transition: "all .1s",
                          }}
                          onMouseEnter={e => { if (linkBrowseFolderId) e.currentTarget.style.background = C.pageBg; }}
                          onMouseLeave={e => { if (linkBrowseFolderId) e.currentTarget.style.background = "transparent"; }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                          </svg>
                          All Workspaces
                        </div>

                        {/* Root folders */}
                        {folderTreeQuery.data.map((rootFolder: any) => (
                          <FolderTreeItem
                            key={rootFolder.id}
                            folder={rootFolder}
                            depth={0}
                            selectedFolderId={linkBrowseFolderId}
                            onSelect={(folderId, path) => {
                              setLinkBrowseFolderId(folderId);
                              setLinkFolderPath(path);
                              setLinkSearchQuery("");
                              setFolderDropdownOpen(false);
                            }}
                            parentPath={[]}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Search Bar */}
            <div style={{ padding: "10px 20px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: C.pageBg, borderRadius: 8, padding: "8px 12px",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={linkSearchQuery}
                  onChange={e => {
                    setLinkSearchQuery(e.target.value);
                    if (e.target.value) {
                      setLinkBrowseFolderId(undefined);
                      setLinkFolderPath([]);
                    }
                  }}
                  placeholder="Search documents by name..."
                  style={{
                    flex: 1, border: "none", background: "transparent",
                    fontSize: 13, outline: "none", fontFamily: FONT, color: C.dark,
                  }}
                />
                {linkSearchQuery && (
                  <button
                    onClick={() => setLinkSearchQuery("")}
                    style={{
                      border: "none", background: "transparent", cursor: "pointer",
                      fontSize: 12, color: C.muted, padding: 0,
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Breadcrumb */}
            {linkFolderPath.length > 0 && !linkSearchQuery && (
              <div style={{
                padding: "8px 20px", borderBottom: `1px solid ${C.border}`,
                display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap",
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={DMS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                </svg>
                <button
                  onClick={() => navigateToFolderBreadcrumb(-1)}
                  style={{
                    border: "none", background: "transparent", cursor: "pointer",
                    fontSize: 11, color: DMS.primary, fontWeight: 600, padding: "2px 4px",
                    fontFamily: FONT,
                  }}
                >
                  Root
                </button>
                {linkFolderPath.map((f, i) => (
                  <span key={f.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color: C.muted, fontSize: 10 }}>/</span>
                    <button
                      onClick={() => navigateToFolderBreadcrumb(i)}
                      style={{
                        border: "none", background: "transparent", cursor: "pointer",
                        fontSize: 11, fontFamily: FONT, padding: "2px 4px",
                        color: i === linkFolderPath.length - 1 ? C.dark : DMS.primary,
                        fontWeight: i === linkFolderPath.length - 1 ? 600 : 400,
                      }}
                    >
                      {f.name}
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Results */}
            <div style={{ flex: 1, overflow: "auto", padding: "8px 0" }}>
              {odooSearchQuery.isLoading && (
                <div style={{ textAlign: "center", padding: "40px 0", color: C.muted, fontSize: 13 }}>
                  Searching Odoo documents...
                </div>
              )}

              {odooSearchQuery.isError && (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#991B1B", fontSize: 13 }}>
                  Failed to load documents. Please try again.
                </div>
              )}

              {odooSearchQuery.data && !odooSearchQuery.isLoading && (
                <>
                  {/* Subfolders */}
                  {(odooSearchQuery.data.subfolders?.length ?? 0) > 0 && (
                    <div style={{ padding: "4px 20px 8px" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: "uppercase" }}>
                        Subfolders
                      </div>
                      {odooSearchQuery.data.subfolders.map((folder: any) => (
                        <div
                          key={folder.id}
                          onClick={() => navigateToFolder(folder.id, folder.name)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                            transition: "all .15s", marginBottom: 2,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = DMS.gBg; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                        >
                          <div style={{
                            width: 28, height: 28, borderRadius: 6,
                            background: DMS.gBg2, color: DMS.primary,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14, flexShrink: 0,
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                            </svg>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.dark }}>{folder.name}</div>
                            <div style={{ fontSize: 10, color: C.muted }}>
                              {folder.documentCount} document{folder.documentCount !== 1 ? "s" : ""}
                            </div>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Documents */}
                  {(odooSearchQuery.data.documents?.length ?? 0) > 0 && (
                    <div style={{ padding: "4px 20px" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: "uppercase" }}>
                        Documents {linkSearchQuery ? `(search: "${linkSearchQuery}")` : `(${odooSearchQuery.data.documents.length})`}
                      </div>
                      {odooSearchQuery.data.documents.map((doc: any) => (
                        <div
                          key={doc.id}
                          onClick={() => handleLinkDocument(doc)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                            transition: "all .15s", marginBottom: 2,
                            border: `1px solid transparent`,
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = DMS.gBg;
                            e.currentTarget.style.borderColor = DMS.gBdr;
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.borderColor = "transparent";
                          }}
                        >
                          <div style={{
                            width: 32, height: 32, borderRadius: 6,
                            background: DMS.gBg2, color: DMS.primary,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14, fontWeight: 700, flexShrink: 0,
                          }}>
                            {doc.fileExtension
                              ? doc.fileExtension.toUpperCase().slice(0, 3)
                              : "DOC"}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 13, fontWeight: 600, color: C.dark,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {doc.name}
                            </div>
                            <div style={{ fontSize: 10, color: C.muted, display: "flex", gap: 8 }}>
                              {doc.folderName && <span>📁 {doc.folderName}</span>}
                              {doc.fileSize > 0 && <span>{formatFileSize(doc.fileSize)}</span>}
                              {doc.createDate && <span>{formatDate(doc.createDate)}</span>}
                            </div>
                          </div>
                          <div style={{
                            fontSize: 10, color: DMS.primary, fontWeight: 600,
                            padding: "4px 10px", borderRadius: 6,
                            background: DMS.gBg, flexShrink: 0,
                            border: `1px solid ${DMS.gBdr}`,
                          }}>
                            Link
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Empty state */}
                  {(odooSearchQuery.data.documents?.length ?? 0) === 0 &&
                   (odooSearchQuery.data.subfolders?.length ?? 0) === 0 && (
                    <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 8px", opacity: 0.5 }}>
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <div style={{ fontSize: 13 }}>
                        {linkSearchQuery
                          ? `No documents found for "${linkSearchQuery}"`
                          : linkBrowseFolderId
                            ? "No documents in this folder"
                            : "Select a folder above to browse documents"}
                      </div>
                      {!linkSearchQuery && !linkBrowseFolderId && (
                        <div style={{ fontSize: 11, marginTop: 4, color: C.muted }}>
                          Or use the search bar to find documents by name
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Folder Tree Item (recursive) ──────────────────────────────────────────

interface FolderNode {
  id: number;
  name: string;
  documentCount: number;
  children: FolderNode[];
}

function FolderTreeItem({
  folder,
  depth,
  selectedFolderId,
  onSelect,
  parentPath,
}: {
  folder: FolderNode;
  depth: number;
  selectedFolderId: number | undefined;
  onSelect: (folderId: number, path: { id: number; name: string }[]) => void;
  parentPath: { id: number; name: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = folder.children && folder.children.length > 0;
  const isSelected = selectedFolderId === folder.id;
  const currentPath = [...parentPath, { id: folder.id, name: folder.name }];

  return (
    <div>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 14px", paddingLeft: 14 + depth * 20,
          cursor: "pointer",
          background: isSelected ? DMS.gBg : "transparent",
          color: isSelected ? DMS.primary : C.dark,
          fontWeight: isSelected ? 600 : 400,
          fontSize: 12, transition: "all .1s",
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.pageBg; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
        onClick={() => onSelect(folder.id, currentPath)}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
            style={{
              border: "none", background: "transparent", cursor: "pointer",
              padding: 0, display: "flex", alignItems: "center",
              color: C.muted, width: 14, height: 14, flexShrink: 0,
            }}
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transition: "transform .15s", transform: expanded ? "rotate(90deg)" : "rotate(0)" }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}

        {/* Folder icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isSelected ? DMS.primary : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>

        {/* Folder name */}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {folder.name}
        </span>

        {/* Document count badge */}
        {folder.documentCount > 0 && (
          <span style={{
            fontSize: 9, color: C.muted, background: C.pageBg,
            padding: "1px 5px", borderRadius: 8, flexShrink: 0,
          }}>
            {folder.documentCount}
          </span>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && folder.children.map(child => (
        <FolderTreeItem
          key={child.id}
          folder={child}
          depth={depth + 1}
          selectedFolderId={selectedFolderId}
          onSelect={onSelect}
          parentPath={currentPath}
        />
      ))}
    </div>
  );
}
