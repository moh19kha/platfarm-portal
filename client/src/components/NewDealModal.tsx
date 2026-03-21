// ══════════════════════════════════════════════════════════════════════════════
// NEW DEAL MODAL — Create a new CRM lead (investment deal) in Odoo
// Investor details, contract info, document attachments
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from "react";
import { C, FONT, MONO } from "@/lib/data";
import { trpc } from "@/lib/trpc";

interface NewDealModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (leadId: number) => void;
  stages: { id: number; name: string }[];
  tags: { id: number; name: string; color: number }[];
}

interface FileAttachment {
  name: string;
  data: string; // base64
  mimetype: string;
  size: number;
}

export default function NewDealModal({ open, onClose, onCreated, stages, tags }: NewDealModalProps) {
  // ─── Form State ─────────────────────────────────────────────────────────
  const [dealName, setDealName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [expectedRevenue, setExpectedRevenue] = useState("");
  const [probability, setProbability] = useState("10");
  const [priority, setPriority] = useState("0");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [stageId, setStageId] = useState<number | undefined>(undefined);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);

  // ─── Partner Search ─────────────────────────────────────────────────────
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerId, setPartnerId] = useState<number | undefined>(undefined);
  const [partnerName, setPartnerName] = useState("");
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);
  const partnerRef = useRef<HTMLDivElement>(null);

  // ─── Create New Investor ────────────────────────────────────────────────
  const [showCreateInvestor, setShowCreateInvestor] = useState(false);
  const [newInvestorName, setNewInvestorName] = useState("");
  const [newInvestorEmail, setNewInvestorEmail] = useState("");
  const [newInvestorPhone, setNewInvestorPhone] = useState("");
  const [newInvestorCompany, setNewInvestorCompany] = useState("");
  const [creatingInvestor, setCreatingInvestor] = useState(false);
  const createPartnerMutation = trpc.crm.createPartner.useMutation();

  const { data: partners } = trpc.crm.searchPartners.useQuery(
    { query: partnerSearch, limit: 15 },
    { enabled: partnerSearch.length >= 2 }
  );

  const handleCreateInvestor = useCallback(async () => {
    if (!newInvestorName.trim()) return;
    setCreatingInvestor(true);
    try {
      const result = await createPartnerMutation.mutateAsync({
        name: newInvestorName.trim(),
        email: newInvestorEmail.trim() || undefined,
        phone: newInvestorPhone.trim() || undefined,
        companyName: newInvestorCompany.trim() || undefined,
      });
      // Auto-select the newly created partner
      setPartnerId(result.id);
      setPartnerName(result.name);
      if (newInvestorEmail.trim()) setEmail(newInvestorEmail.trim());
      if (newInvestorPhone.trim()) setPhone(newInvestorPhone.trim());
      setContactName(newInvestorName.trim());
      // Reset create form
      setShowCreateInvestor(false);
      setShowPartnerDropdown(false);
      setNewInvestorName("");
      setNewInvestorEmail("");
      setNewInvestorPhone("");
      setNewInvestorCompany("");
      setPartnerSearch("");
    } catch (err: any) {
      setError(err.message || "Failed to create investor");
    } finally {
      setCreatingInvestor(false);
    }
  }, [newInvestorName, newInvestorEmail, newInvestorPhone, newInvestorCompany, createPartnerMutation]);

  // ─── Submission ─────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"form" | "uploading" | "done">("form");
  const [uploadProgress, setUploadProgress] = useState(0);

  const createMutation = trpc.crm.createLead.useMutation();
  const uploadMutation = trpc.crm.uploadAttachment.useMutation();
  const utils = trpc.useUtils();

  // Close partner dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (partnerRef.current && !partnerRef.current.contains(e.target as Node)) {
        setShowPartnerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setDealName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setExpectedRevenue("");
      setProbability("10");
      setPriority("0");
      setDeadline("");
      setDescription("");
      setStageId(stages.length > 0 ? stages[0].id : undefined);
      setSelectedTagIds([]);
      setAttachments([]);
      setPartnerId(undefined);
      setPartnerName("");
      setPartnerSearch("");
      setShowCreateInvestor(false);
      setNewInvestorName("");
      setNewInvestorEmail("");
      setNewInvestorPhone("");
      setNewInvestorCompany("");
      setCreatingInvestor(false);
      setError("");
      setStep("form");
      setSubmitting(false);
    }
  }, [open, stages]);

  // ─── File Handling ──────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList) => {
    Array.from(files).forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds 10 MB limit`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setAttachments(prev => [...prev, {
          name: file.name,
          data: base64,
          mimetype: file.type || "application/octet-stream",
          size: file.size,
        }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeAttachment = useCallback((idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // ─── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!dealName.trim()) {
      setError("Deal name is required");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      // Step 1: Create the CRM lead
      const result = await createMutation.mutateAsync({
        name: dealName.trim(),
        partner_id: partnerId,
        contact_name: contactName.trim() || undefined,
        email_from: email.trim() || undefined,
        phone: phone.trim() || undefined,
        expected_revenue: expectedRevenue ? parseFloat(expectedRevenue) : undefined,
        probability: probability ? parseFloat(probability) : undefined,
        priority,
        date_deadline: deadline || undefined,
        description: description.trim() || undefined,
        stage_id: stageId,
        tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      });

      const leadId = result.id;

      // Step 2: Upload attachments if any
      if (attachments.length > 0) {
        setStep("uploading");
        for (let i = 0; i < attachments.length; i++) {
          setUploadProgress(Math.round(((i) / attachments.length) * 100));
          await uploadMutation.mutateAsync({
            leadId,
            filename: attachments[i].name,
            data: attachments[i].data,
            mimetype: attachments[i].mimetype,
          });
        }
        setUploadProgress(100);
      }

      setStep("done");
      // Invalidate pipeline data
      utils.crm.pipelineSummary.invalidate();
      utils.crm.leads.invalidate();

      // Brief delay to show success, then close
      setTimeout(() => {
        onCreated(leadId);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Failed to create deal");
      setSubmitting(false);
      setStep("form");
    }
  }, [
    dealName, partnerId, contactName, email, phone, expectedRevenue,
    probability, priority, deadline, description, stageId, selectedTagIds,
    attachments, createMutation, uploadMutation, utils, onCreated, onClose,
  ]);

  // ─── Tag Toggle ─────────────────────────────────────────────────────────
  const toggleTag = useCallback((tagId: number) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  }, []);

  if (!open) return null;

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const priorityOptions = [
    { value: "0", label: "Normal", color: C.muted },
    { value: "1", label: "Low", color: "#3B82F6" },
    { value: "2", label: "Medium", color: "#F59E0B" },
    { value: "3", label: "High", color: "#EF4444" },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      fontFamily: FONT,
    }}>
      <div style={{
        background: C.card, borderRadius: 14, width: 680, maxHeight: "90vh",
        overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        display: "flex", flexDirection: "column",
        animation: "fadeSlideUp .25s ease-out",
      }}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          padding: "14px 18px", borderBottom: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: C.forest,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>New Investment Deal</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>
              Create a new CRM lead in Odoo
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6,
              width: 28, height: 28, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: C.white,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          {/* Success State */}
          {step === "done" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%", background: C.gBg2,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 12px", border: `2px solid ${C.forest}`,
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>Deal Created Successfully</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                The investment deal has been added to your CRM pipeline
              </div>
            </div>
          )}

          {/* Uploading State */}
          {step === "uploading" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{
                width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.forest,
                borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px",
              }} />
              <div style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>Uploading Documents...</div>
              <div style={{
                width: 200, height: 4, background: C.gBg, borderRadius: 2,
                margin: "10px auto 0", overflow: "hidden",
              }}>
                <div style={{
                  width: `${uploadProgress}%`, height: "100%", background: C.forest,
                  borderRadius: 2, transition: "width .3s",
                }} />
              </div>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>{uploadProgress}%</div>
            </div>
          )}

          {/* Form */}
          {step === "form" && (
            <>
              {/* Error */}
              {error && (
                <div style={{
                  background: C.rBg, border: `1px solid ${C.rBdr}`, borderRadius: 8,
                  padding: "8px 12px", marginBottom: 12, fontSize: 10, color: "#991B1B",
                }}>
                  {error}
                </div>
              )}

              {/* Section: Deal Info */}
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: C.forest, marginBottom: 8,
                  textTransform: "uppercase", letterSpacing: 0.5,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                  </svg>
                  Deal Information
                </div>

                {/* Deal Name */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 9, fontWeight: 600, color: C.gray, display: "block", marginBottom: 3 }}>
                    Deal Name <span style={{ color: C.red }}>*</span>
                  </label>
                  <input
                    value={dealName}
                    onChange={e => setDealName(e.target.value)}
                    placeholder="e.g., Alfalfa Investment Round A — Q2 2026"
                    style={{
                      width: "100%", padding: "8px 10px", borderRadius: 6,
                      border: `1px solid ${C.inputBdr}`, fontSize: 11,
                      fontFamily: FONT, color: C.dark, outline: "none",
                      background: C.pageBg,
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = C.forest; }}
                    onBlur={e => { e.currentTarget.style.borderColor = C.inputBdr; }}
                  />
                </div>

                {/* Stage + Priority Row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 600, color: C.gray, display: "block", marginBottom: 3 }}>
                      Pipeline Stage
                    </label>
                    <select
                      value={stageId || ""}
                      onChange={e => setStageId(e.target.value ? Number(e.target.value) : undefined)}
                      style={{
                        width: "100%", padding: "8px 10px", borderRadius: 6,
                        border: `1px solid ${C.inputBdr}`, fontSize: 11,
                        fontFamily: FONT, color: C.dark, outline: "none",
                        background: C.pageBg, cursor: "pointer",
                      }}
                    >
                      {stages.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 600, color: C.gray, display: "block", marginBottom: 3 }}>
                      Priority
                    </label>
                    <div style={{ display: "flex", gap: 4 }}>
                      {priorityOptions.map(p => (
                        <button
                          key={p.value}
                          onClick={() => setPriority(p.value)}
                          style={{
                            flex: 1, padding: "7px 4px", borderRadius: 5, cursor: "pointer",
                            border: priority === p.value ? `2px solid ${p.color}` : `1px solid ${C.border}`,
                            background: priority === p.value ? p.color + "15" : C.pageBg,
                            fontSize: 9, fontWeight: priority === p.value ? 700 : 500,
                            color: priority === p.value ? p.color : C.gray,
                            fontFamily: FONT,
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Revenue + Probability + Deadline Row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 600, color: C.gray, display: "block", marginBottom: 3 }}>
                      Expected Revenue (AED)
                    </label>
                    <input
                      type="number"
                      value={expectedRevenue}
                      onChange={e => setExpectedRevenue(e.target.value)}
                      placeholder="0"
                      style={{
                        width: "100%", padding: "8px 10px", borderRadius: 6,
                        border: `1px solid ${C.inputBdr}`, fontSize: 11,
                        fontFamily: MONO, color: C.dark, outline: "none",
                        background: C.pageBg,
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = C.forest; }}
                      onBlur={e => { e.currentTarget.style.borderColor = C.inputBdr; }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 600, color: C.gray, display: "block", marginBottom: 3 }}>
                      Probability (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={probability}
                      onChange={e => setProbability(e.target.value)}
                      style={{
                        width: "100%", padding: "8px 10px", borderRadius: 6,
                        border: `1px solid ${C.inputBdr}`, fontSize: 11,
                        fontFamily: MONO, color: C.dark, outline: "none",
                        background: C.pageBg,
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = C.forest; }}
                      onBlur={e => { e.currentTarget.style.borderColor = C.inputBdr; }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 600, color: C.gray, display: "block", marginBottom: 3 }}>
                      Deadline
                    </label>
                    <input
                      type="date"
                      value={deadline}
                      onChange={e => setDeadline(e.target.value)}
                      style={{
                        width: "100%", padding: "8px 10px", borderRadius: 6,
                        border: `1px solid ${C.inputBdr}`, fontSize: 11,
                        fontFamily: FONT, color: C.dark, outline: "none",
                        background: C.pageBg,
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = C.forest; }}
                      onBlur={e => { e.currentTarget.style.borderColor = C.inputBdr; }}
                    />
                  </div>
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 9, fontWeight: 600, color: C.gray, display: "block", marginBottom: 4 }}>
                      Tags
                    </label>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {tags.map(tag => {
                        const selected = selectedTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => toggleTag(tag.id)}
                            style={{
                              padding: "3px 8px", borderRadius: 4, cursor: "pointer",
                              border: selected ? `1.5px solid ${C.forest}` : `1px solid ${C.border}`,
                              background: selected ? C.gBg2 : C.pageBg,
                              fontSize: 9, fontWeight: selected ? 600 : 500,
                              color: selected ? C.forest : C.gray,
                              fontFamily: FONT, transition: "all .15s",
                            }}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Section: Investor Details */}
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: C.forest, marginBottom: 8,
                  textTransform: "uppercase", letterSpacing: 0.5,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Investor Details
                </div>

                {/* Partner Search */}
                <div ref={partnerRef} style={{ marginBottom: 10, position: "relative" }}>
                  <label style={{ fontSize: 9, fontWeight: 600, color: C.gray, display: "block", marginBottom: 3 }}>
                    Investor / Partner (search Odoo contacts)
                  </label>
                  {partnerId ? (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                      background: C.gBg2, border: `1px solid ${C.gBdr}`, borderRadius: 6,
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%", background: C.forest,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontWeight: 700, color: C.white, flexShrink: 0,
                      }}>
                        {partnerName.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: C.dark }}>{partnerName}</div>
                      <button
                        onClick={() => { setPartnerId(undefined); setPartnerName(""); setPartnerSearch(""); }}
                        style={{
                          background: "none", border: "none", cursor: "pointer", color: C.muted,
                          fontSize: 14, padding: "0 4px",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        value={partnerSearch}
                        onChange={e => { setPartnerSearch(e.target.value); setShowPartnerDropdown(true); }}
                        onFocus={() => { if (partnerSearch.length >= 2) setShowPartnerDropdown(true); }}
                        placeholder="Type to search investors..."
                        style={{
                          width: "100%", padding: "8px 10px", borderRadius: 6,
                          border: `1px solid ${C.inputBdr}`, fontSize: 11,
                          fontFamily: FONT, color: C.dark, outline: "none",
                          background: C.pageBg,
                        }}
                        onFocusCapture={e => { e.currentTarget.style.borderColor = C.forest; }}
                        onBlurCapture={e => { e.currentTarget.style.borderColor = C.inputBdr; }}
                      />
                      {showPartnerDropdown && partnerSearch.length >= 2 && (
                        <div style={{
                          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                          background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
                          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 260, overflowY: "auto",
                          marginTop: 2,
                        }}>
                          {partners && partners.length > 0 && partners.map(p => (
                            <div
                              key={p.id}
                              onClick={() => {
                                setPartnerId(p.id);
                                setPartnerName(p.name);
                                setShowPartnerDropdown(false);
                                setShowCreateInvestor(false);
                                if (p.email) setEmail(p.email as string);
                                if (p.phone) setPhone(p.phone as string);
                              }}
                              style={{
                                padding: "7px 10px", cursor: "pointer", borderBottom: `1px solid ${C.border}`,
                                transition: "background .1s",
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = C.gBg; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                            >
                              <div style={{ fontSize: 10, fontWeight: 600, color: C.dark }}>{p.name}</div>
                              <div style={{ fontSize: 8, color: C.muted }}>
                                {[p.email, p.phone, p.company_name].filter(Boolean).join(" · ") || "No contact info"}
                              </div>
                            </div>
                          ))}

                          {/* No results message + Create New Investor option */}
                          {(!partners || partners.length === 0) && (
                            <div style={{ padding: "10px 12px", textAlign: "center" }}>
                              <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>
                                No investor found for "{partnerSearch}"
                              </div>
                            </div>
                          )}

                          {/* Always show Create New Investor option at the bottom */}
                          <div
                            onClick={() => {
                              setShowCreateInvestor(true);
                              setShowPartnerDropdown(false);
                              setNewInvestorName(partnerSearch);
                            }}
                            style={{
                              padding: "8px 12px", cursor: "pointer",
                              background: C.gBg, borderTop: `1px solid ${C.border}`,
                              display: "flex", alignItems: "center", gap: 6,
                              transition: "background .1s",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = C.gBg2; }}
                            onMouseLeave={e => { e.currentTarget.style.background = C.gBg; }}
                          >
                            <div style={{
                              width: 20, height: 20, borderRadius: "50%", background: C.forest,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              flexShrink: 0,
                            }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: C.forest }}>Create New Investor</div>
                              <div style={{ fontSize: 8, color: C.muted }}>Add a new contact to Odoo</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Inline Create Investor Form ───────────────────────── */}
                  {showCreateInvestor && !partnerId && (
                    <div style={{
                      marginTop: 8, padding: 12, background: C.gBg,
                      border: `1px solid ${C.gBdr}`, borderRadius: 8,
                    }}>
                      <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10,
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.forest, display: "flex", alignItems: "center", gap: 5 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="2">
                            <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                            <circle cx="8.5" cy="7" r="4" />
                            <line x1="20" y1="8" x2="20" y2="14" />
                            <line x1="23" y1="11" x2="17" y2="11" />
                          </svg>
                          Create New Investor
                        </div>
                        <button
                          onClick={() => setShowCreateInvestor(false)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14, padding: "0 4px" }}
                        >
                          ×
                        </button>
                      </div>

                      {/* Name (required) */}
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 8, fontWeight: 600, color: C.gray, display: "block", marginBottom: 2 }}>
                          Name <span style={{ color: C.red }}>*</span>
                        </label>
                        <input
                          value={newInvestorName}
                          onChange={e => setNewInvestorName(e.target.value)}
                          placeholder="Investor full name"
                          style={{
                            width: "100%", padding: "7px 10px", borderRadius: 5,
                            border: `1px solid ${C.inputBdr}`, fontSize: 10,
                            fontFamily: FONT, color: C.dark, outline: "none", background: C.card,
                          }}
                          onFocus={e => { e.currentTarget.style.borderColor = C.forest; }}
                          onBlur={e => { e.currentTarget.style.borderColor = C.inputBdr; }}
                        />
                      </div>

                      {/* Email + Phone */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                        <div>
                          <label style={{ fontSize: 8, fontWeight: 600, color: C.gray, display: "block", marginBottom: 2 }}>
                            Email
                          </label>
                          <input
                            type="email"
                            value={newInvestorEmail}
                            onChange={e => setNewInvestorEmail(e.target.value)}
                            placeholder="investor@example.com"
                            style={{
                              width: "100%", padding: "7px 10px", borderRadius: 5,
                              border: `1px solid ${C.inputBdr}`, fontSize: 10,
                              fontFamily: FONT, color: C.dark, outline: "none", background: C.card,
                            }}
                            onFocus={e => { e.currentTarget.style.borderColor = C.forest; }}
                            onBlur={e => { e.currentTarget.style.borderColor = C.inputBdr; }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 8, fontWeight: 600, color: C.gray, display: "block", marginBottom: 2 }}>
                            Phone
                          </label>
                          <input
                            type="tel"
                            value={newInvestorPhone}
                            onChange={e => setNewInvestorPhone(e.target.value)}
                            placeholder="+971 ..."
                            style={{
                              width: "100%", padding: "7px 10px", borderRadius: 5,
                              border: `1px solid ${C.inputBdr}`, fontSize: 10,
                              fontFamily: FONT, color: C.dark, outline: "none", background: C.card,
                            }}
                            onFocus={e => { e.currentTarget.style.borderColor = C.forest; }}
                            onBlur={e => { e.currentTarget.style.borderColor = C.inputBdr; }}
                          />
                        </div>
                      </div>

                      {/* Company Name */}
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 8, fontWeight: 600, color: C.gray, display: "block", marginBottom: 2 }}>
                          Company Name
                        </label>
                        <input
                          value={newInvestorCompany}
                          onChange={e => setNewInvestorCompany(e.target.value)}
                          placeholder="Company or organization"
                          style={{
                            width: "100%", padding: "7px 10px", borderRadius: 5,
                            border: `1px solid ${C.inputBdr}`, fontSize: 10,
                            fontFamily: FONT, color: C.dark, outline: "none", background: C.card,
                          }}
                          onFocus={e => { e.currentTarget.style.borderColor = C.forest; }}
                          onBlur={e => { e.currentTarget.style.borderColor = C.inputBdr; }}
                        />
                      </div>

                      {/* Create Button */}
                      <button
                        onClick={handleCreateInvestor}
                        disabled={!newInvestorName.trim() || creatingInvestor}
                        style={{
                          width: "100%", padding: "8px 0", borderRadius: 6, border: "none",
                          background: newInvestorName.trim() ? C.forest : C.border,
                          color: newInvestorName.trim() ? C.white : C.muted,
                          fontSize: 10, fontWeight: 700, cursor: newInvestorName.trim() ? "pointer" : "not-allowed",
                          fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          transition: "background .15s",
                        }}
                      >
                        {creatingInvestor ? (
                          <>
                            <div style={{
                              width: 12, height: 12, border: `2px solid rgba(255,255,255,0.3)`,
                              borderTopColor: C.white, borderRadius: "50%",
                              animation: "spin 0.8s linear infinite",
                            }} />
                            Creating in Odoo...
                          </>
                        ) : (
                          <>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Create Investor in Odoo
                          </>
                        )}
                      </button>
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                  )}
                </div>

                {/* Contact Name + Email + Phone */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 600, color: C.gray, display: "block", marginBottom: 3 }}>
                      Contact Name
                    </label>
                    <input
                      value={contactName}
                      onChange={e => setContactName(e.target.value)}
                      placeholder="Full name"
                      style={{
                        width: "100%", padding: "8px 10px", borderRadius: 6,
                        border: `1px solid ${C.inputBdr}`, fontSize: 11,
                        fontFamily: FONT, color: C.dark, outline: "none",
                        background: C.pageBg,
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = C.forest; }}
                      onBlur={e => { e.currentTarget.style.borderColor = C.inputBdr; }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 600, color: C.gray, display: "block", marginBottom: 3 }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="investor@example.com"
                      style={{
                        width: "100%", padding: "8px 10px", borderRadius: 6,
                        border: `1px solid ${C.inputBdr}`, fontSize: 11,
                        fontFamily: FONT, color: C.dark, outline: "none",
                        background: C.pageBg,
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = C.forest; }}
                      onBlur={e => { e.currentTarget.style.borderColor = C.inputBdr; }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 600, color: C.gray, display: "block", marginBottom: 3 }}>
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+971 ..."
                      style={{
                        width: "100%", padding: "8px 10px", borderRadius: 6,
                        border: `1px solid ${C.inputBdr}`, fontSize: 11,
                        fontFamily: FONT, color: C.dark, outline: "none",
                        background: C.pageBg,
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = C.forest; }}
                      onBlur={e => { e.currentTarget.style.borderColor = C.inputBdr; }}
                    />
                  </div>
                </div>
              </div>

              {/* Section: Description */}
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: C.forest, marginBottom: 8,
                  textTransform: "uppercase", letterSpacing: 0.5,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  Description & Notes
                </div>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Investment details, terms, conditions, notes..."
                  rows={4}
                  style={{
                    width: "100%", padding: "8px 10px", borderRadius: 6,
                    border: `1px solid ${C.inputBdr}`, fontSize: 11,
                    fontFamily: FONT, color: C.dark, outline: "none",
                    background: C.pageBg, resize: "vertical",
                    lineHeight: 1.5,
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = C.forest; }}
                  onBlur={e => { e.currentTarget.style.borderColor = C.inputBdr; }}
                />
              </div>

              {/* Section: Document Attachments */}
              <div style={{ marginBottom: 8 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: C.forest, marginBottom: 8,
                  textTransform: "uppercase", letterSpacing: 0.5,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="2">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                  </svg>
                  Document Attachments
                </div>

                {/* Drop Zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = C.forest; e.currentTarget.style.background = C.gBg; }}
                  onDragLeave={e => { e.currentTarget.style.borderColor = C.inputBdr; e.currentTarget.style.background = C.pageBg; }}
                  onDrop={e => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = C.inputBdr;
                    e.currentTarget.style.background = C.pageBg;
                    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
                  }}
                  style={{
                    border: `2px dashed ${C.inputBdr}`, borderRadius: 8,
                    padding: "16px 12px", textAlign: "center", cursor: "pointer",
                    background: C.pageBg, transition: "all .15s",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" style={{ margin: "0 auto 6px", display: "block" }}>
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <div style={{ fontSize: 10, color: C.gray, fontWeight: 500 }}>
                    Click or drag files here to attach
                  </div>
                  <div style={{ fontSize: 8, color: C.muted, marginTop: 2 }}>
                    PDF, DOCX, XLSX, images — max 10 MB each
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt,.csv"
                  style={{ display: "none" }}
                  onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
                />

                {/* Attachment List */}
                {attachments.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                    {attachments.map((att, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 10px", background: C.gBg, borderRadius: 6,
                        border: `1px solid ${C.gBdr}`,
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 4, background: C.forest + "15",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 7, fontWeight: 700, color: C.forest, flexShrink: 0,
                        }}>
                          {att.name.split(".").pop()?.toUpperCase() || "FILE"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.dark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {att.name}
                          </div>
                          <div style={{ fontSize: 8, color: C.muted }}>{fmtSize(att.size)}</div>
                        </div>
                        <button
                          onClick={() => removeAttachment(i)}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: C.red, fontSize: 14, padding: "0 4px",
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        {step === "form" && (
          <div style={{
            padding: "12px 18px", borderTop: `1px solid ${C.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ fontSize: 9, color: C.muted }}>
              {attachments.length > 0 && `${attachments.length} file${attachments.length > 1 ? "s" : ""} attached`}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={onClose}
                disabled={submitting}
                style={{
                  padding: "8px 16px", borderRadius: 6, border: `1px solid ${C.border}`,
                  background: C.card, fontSize: 10, fontWeight: 600, color: C.gray,
                  cursor: "pointer", fontFamily: FONT,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !dealName.trim()}
                style={{
                  padding: "8px 20px", borderRadius: 6, border: "none",
                  background: submitting || !dealName.trim() ? C.muted : C.forest,
                  fontSize: 10, fontWeight: 700, color: C.white,
                  cursor: submitting || !dealName.trim() ? "not-allowed" : "pointer",
                  fontFamily: FONT, display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {submitting ? (
                  <>
                    <div style={{
                      width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: C.white, borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }} />
                    Creating...
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Create Deal
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
