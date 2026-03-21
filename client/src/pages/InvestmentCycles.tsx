// ══════════════════════════════════════════════════════════════════════════════
// INVESTMENT CYCLES — Platfarm V3 — CRM Pipeline for Investment Deal Tracking
// Uses Odoo CRM (Abu Dhabi company) to manage investment lifecycle
// Supports drag-and-drop stage transitions in the Kanban pipeline view
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { C, FONT, MONO } from "@/lib/data";
import { trpc } from "@/lib/trpc";
import NewDealModal from "@/components/NewDealModal";
import { TopProgressBar, ShimmerBox, PulseBox, TableSkeleton } from "@/components/LoadingIndicators";

// ─── Types ─────────────────────────────────────────────────────────────────
type ViewMode = "pipeline" | "list" | "detail";

interface DealCardProps {
  lead: any;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, leadId: number) => void;
  isDragging: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function fmtDate(d: string | false): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtCurrency(v: number, currency?: string | false): string {
  if (!v) return "—";
  const cur = currency && currency !== "" ? currency : "AED";
  return `${cur} ${v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function priorityLabel(p: string): string {
  const map: Record<string, string> = { "0": "Normal", "1": "Low", "2": "Medium", "3": "High" };
  return map[p] || "Normal";
}

function priorityColor(p: string): string {
  const map: Record<string, string> = { "0": C.muted, "1": "#3B82F6", "2": "#F59E0B", "3": "#EF4444" };
  return map[p] || C.muted;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}

// ─── Info Row Component ───────────────────────────────────────────────────
function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  if (value === "—" || !value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
      <span style={{ fontSize: 8, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
      <span style={{ fontSize: 9, fontWeight: 600, color: C.dark, fontFamily: mono ? MONO : FONT }}>{value}</span>
    </div>
  );
}

// ─── Deal Card (Enriched + Draggable) ────────────────────────────────────
function DealCard({ lead, onClick, onDragStart, isDragging }: DealCardProps) {
  const [hovered, setHovered] = useState(false);
  const paidAmount = lead.x_studio_paid_amount || 0;
  const totalDeal = lead.expected_revenue || 0;
  const paidPct = totalDeal > 0 ? Math.round((paidAmount / totalDeal) * 100) : 0;
  const currency = lead.x_studio_currency || "AED";

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.card,
        border: `1px solid ${hovered ? C.forest : C.border}`,
        borderRadius: 8,
        padding: "10px 12px",
        cursor: isDragging ? "grabbing" : "grab",
        transition: "all .15s",
        boxShadow: hovered ? "0 4px 12px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
        opacity: isDragging ? 0.4 : 1,
        transform: isDragging ? "scale(0.95)" : "scale(1)",
      }}
    >
      {/* Header: Name + Priority */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.dark, lineHeight: 1.3, flex: 1, marginRight: 8 }}>
          {lead.name}
        </div>
        <div style={{
          fontSize: 7, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
          background: priorityColor(lead.priority) + "18",
          color: priorityColor(lead.priority),
        }}>
          {priorityLabel(lead.priority)}
        </div>
      </div>

      {/* Investor Name */}
      {lead.partner_id && (
        <div style={{ fontSize: 9, color: C.sage, marginBottom: 2 }}>
          {lead.partner_id[1]}
        </div>
      )}

      {/* Investor Type Badge */}
      {lead.x_studio_investor_type && lead.x_studio_investor_type !== false && (
        <div style={{
          display: "inline-block", fontSize: 7, fontWeight: 600, padding: "1px 6px", borderRadius: 3,
          background: "#E0E7FF", color: "#3730A3", marginBottom: 4,
        }}>
          {lead.x_studio_investor_type}
        </div>
      )}

      {/* Revenue */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.forest, fontFamily: MONO }}>
          {fmtCurrency(totalDeal, currency)}
        </div>
        {lead.probability > 0 && (
          <div style={{
            fontSize: 8, fontWeight: 600, padding: "2px 5px", borderRadius: 3,
            background: C.gBg2, color: C.forest,
          }}>
            {lead.probability}%
          </div>
        )}
      </div>

      {/* Paid Amount Progress Bar */}
      {paidAmount > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontSize: 7, color: C.muted, fontWeight: 600 }}>Paid</span>
            <span style={{ fontSize: 7, color: C.forest, fontWeight: 700, fontFamily: MONO }}>
              {fmtCurrency(paidAmount, currency)} ({paidPct}%)
            </span>
          </div>
          <div style={{ height: 4, background: C.gBg, borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${Math.min(paidPct, 100)}%`,
              background: `linear-gradient(90deg, ${C.forest}, ${C.sage})`,
              borderRadius: 2, transition: "width .3s",
            }} />
          </div>
        </div>
      )}

      {/* Key Dates Row */}
      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        {lead.x_studio_contract_date && lead.x_studio_contract_date !== false && (
          <div style={{ fontSize: 7, color: C.muted }}>
            <span style={{ fontWeight: 600 }}>Contract:</span> {fmtDate(lead.x_studio_contract_date)}
          </div>
        )}
        {lead.x_studio_maturity_date && lead.x_studio_maturity_date !== false && (
          <div style={{ fontSize: 7, color: C.muted }}>
            <span style={{ fontWeight: 600 }}>Maturity:</span> {fmtDate(lead.x_studio_maturity_date)}
          </div>
        )}
        {lead.date_deadline && (
          <div style={{ fontSize: 7, color: C.muted }}>
            <span style={{ fontWeight: 600 }}>Deadline:</span> {fmtDate(lead.date_deadline)}
          </div>
        )}
      </div>

      {/* Bank Info */}
      {lead.x_studio_bank_name && lead.x_studio_bank_name !== false && (
        <div style={{ fontSize: 7, color: C.muted, marginTop: 3 }}>
          <span style={{ fontWeight: 600 }}>Bank:</span> {lead.x_studio_bank_name}
        </div>
      )}

      {/* Profit Rate */}
      {lead.x_studio_profit_rate > 0 && (
        <div style={{ fontSize: 7, color: C.muted, marginTop: 2 }}>
          <span style={{ fontWeight: 600 }}>Profit Rate:</span> {lead.x_studio_profit_rate}%
        </div>
      )}

      {/* Tags & Activities */}
      <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
        {lead.x_studio_contract_reference && lead.x_studio_contract_reference !== false && (
          <span style={{
            fontSize: 7, padding: "1px 5px", borderRadius: 3,
            background: "#F0FDF4", color: "#166534", fontWeight: 600,
          }}>
            Ref: {lead.x_studio_contract_reference}
          </span>
        )}
        {lead.tag_ids?.length > 0 && (
          <span style={{
            fontSize: 7, padding: "1px 5px", borderRadius: 3,
            background: C.tBg, color: C.terra, fontWeight: 600,
          }}>
            {lead.tag_ids.length} tag{lead.tag_ids.length > 1 ? "s" : ""}
          </span>
        )}
        {lead.activity_ids?.length > 0 && (
          <span style={{
            fontSize: 7, padding: "1px 5px", borderRadius: 3,
            background: "#FEF3C7", color: "#92400E", fontWeight: 600,
          }}>
            {lead.activity_ids.length} activit{lead.activity_ids.length > 1 ? "ies" : "y"}
          </span>
        )}
      </div>

      {/* Drag handle indicator */}
      <div style={{
        display: "flex", justifyContent: "center", marginTop: 6, opacity: 0.3,
      }}>
        <svg width="20" height="6" viewBox="0 0 20 6" fill={C.muted}>
          <circle cx="4" cy="1.5" r="1.2" />
          <circle cx="10" cy="1.5" r="1.2" />
          <circle cx="16" cy="1.5" r="1.2" />
          <circle cx="4" cy="4.5" r="1.2" />
          <circle cx="10" cy="4.5" r="1.2" />
          <circle cx="16" cy="4.5" r="1.2" />
        </svg>
      </div>
    </div>
  );
}

// ─── Toast Notification ──────────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 10000,
      background: type === "success" ? C.forest : "#DC2626",
      color: C.white, padding: "10px 16px", borderRadius: 8,
      fontSize: 11, fontWeight: 600, fontFamily: FONT,
      boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
      display: "flex", alignItems: "center", gap: 8,
      animation: "slideUp .3s ease-out",
    }}>
      <span>{type === "success" ? "✓" : "✕"}</span>
      <span>{message}</span>
      <span onClick={onClose} style={{ cursor: "pointer", marginLeft: 8, opacity: 0.7 }}>✕</span>
      <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function InvestmentCycles() {
  const [view, setView] = useState<ViewMode>("pipeline");
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showNewDeal, setShowNewDeal] = useState(false);

  // Company selector state
  const [activeCompany, setActiveCompanyRaw] = useState<string>("ALL");
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const companyRef = useRef<HTMLDivElement>(null);
  const companiesResolvedRef = useRef(false);

  // Drag-and-drop state
  const [draggingLeadId, setDraggingLeadId] = useState<number | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const dragCounterRef = useRef<Record<number, number>>({});

  // Fetch companies
  const { data: odooCompanies, isLoading: companiesLoading } = trpc.odoo.companies.useQuery();
  const { data: companyAccessData } = trpc.userMgmt.myCompanyAccess.useQuery();
  const companies = useMemo(() => {
    if (!companyAccessData) return [];
    const { allowedCompanyIds } = companyAccessData;
    return (odooCompanies ?? [])
      .filter(c => !allowedCompanyIds.length || allowedCompanyIds.includes(c.id))
      .map(c => ({
        id: String(c.id),
        odooId: c.id,
        name: c.name,
        displayName: c.displayName,
        currency: c.currency,
        country: c.country,
      }));
  }, [odooCompanies, companyAccessData]);

  // Resolve localStorage company
  useEffect(() => {
    if (companiesResolvedRef.current || !companies.length || !companyAccessData) return;
    companiesResolvedRef.current = true;
    const { defaultCompanyId } = companyAccessData;
    const userIsAdmin = companyAccessData.isAdmin || companyAccessData.allowedCompanyIds.length === 0;

    // RESTRICTED USERS: admin-configured default ALWAYS wins
    if (!userIsAdmin) {
      if (defaultCompanyId !== null) {
        const co = companies.find(c => c.odooId === defaultCompanyId);
        if (co) { setActiveCompanyRaw(co.id); localStorage.setItem('platfarm_inv_company', JSON.stringify({ id: co.odooId, name: co.name })); return; }
      }
      if (companies.length > 0) { setActiveCompanyRaw(companies[0].id); localStorage.setItem('platfarm_inv_company', JSON.stringify({ id: companies[0].odooId, name: companies[0].name })); }
      return;
    }

    // ADMIN USERS: respect localStorage, then fallback
    if (defaultCompanyId !== null) {
      const co = companies.find(c => c.odooId === defaultCompanyId);
      if (co && !localStorage.getItem('platfarm_inv_company')) { setActiveCompanyRaw(co.id); localStorage.setItem('platfarm_inv_company', JSON.stringify({ id: co.odooId, name: co.name })); return; }
    }
    const saved = localStorage.getItem('platfarm_inv_company');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (typeof p.id === 'number') { const co = companies.find(c => c.odooId === p.id); if (co) { setActiveCompanyRaw(co.id); return; } }
        const name = typeof p === 'string' ? p : p.name;
        if (name && name !== 'All Companies') { const co = companies.find(c => c.name === name); if (co) { setActiveCompanyRaw(co.id); return; } }
      } catch { /* ignore */ }
    }
    const cairo = companies.find(c => c.name?.toLowerCase().includes('cairo'));
    if (cairo) { setActiveCompanyRaw(cairo.id); localStorage.setItem('platfarm_inv_company', JSON.stringify({ id: cairo.odooId, name: cairo.name })); return; }
    if (companies.length > 0) { setActiveCompanyRaw(companies[0].id); localStorage.setItem('platfarm_inv_company', JSON.stringify({ id: companies[0].odooId, name: companies[0].name })); }
  }, [companies, companyAccessData]);
  // If restricted user has "ALL" selected (stale localStorage), reset to first allowed company
  useEffect(() => {
    if (!companyAccessData || !companies.length) return;
    const isAdm = companyAccessData.isAdmin || companyAccessData.allowedCompanyIds.length === 0;
    if (!isAdm && activeCompany === "ALL") {
      const first = companies[0];
      if (first) {
        setActiveCompanyRaw(first.id);
        localStorage.setItem('platfarm_inv_company', JSON.stringify({ id: first.odooId, name: first.name }));
      }
    }
  }, [companyAccessData, companies, activeCompany]);

  const setActiveCompany = useCallback((val: string) => {
    setActiveCompanyRaw(val);
    if (val === 'ALL') {
      localStorage.setItem('platfarm_inv_company', JSON.stringify({ id: 'ALL', name: 'All Companies' }));
    } else {
      const comp = companies.find(c => c.id === val);
      if (comp) localStorage.setItem('platfarm_inv_company', JSON.stringify({ id: comp.odooId, name: comp.name }));
    }
  }, [companies]);

  const activeCompanyObj = companies.find(c => c.id === activeCompany);
  const companyLabel = activeCompany === "ALL" ? "All Companies" : activeCompanyObj?.name || activeCompany;
  const isCompanyAdmin = !!companyAccessData && (companyAccessData.isAdmin || companyAccessData.allowedCompanyIds.length === 0);
  const companyIdFilter = activeCompany === "ALL" ? undefined : Number(activeCompany);

  // Close company dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) setCompanyDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch CRM data
  const utils = trpc.useUtils();
  const { data: pipelineData, isLoading: loadingPipeline, error: pipelineError } = trpc.crm.pipelineSummary.useQuery(
    { companyId: companyIdFilter }
  );
  const { data: tags } = trpc.crm.tags.useQuery();

  // Move to stage mutation with optimistic update
  const moveToStage = trpc.crm.moveToStage.useMutation({
    onMutate: async ({ leadId, stageId }) => {
      await utils.crm.pipelineSummary.cancel();
      const previousData = utils.crm.pipelineSummary.getData({ companyId: companyIdFilter });
      utils.crm.pipelineSummary.setData({ companyId: companyIdFilter }, (old) => {
        if (!old) return old;
        const stage = old.stages.find(s => s.id === stageId);
        return {
          ...old,
          leads: old.leads.map(l =>
            l.id === leadId
              ? { ...l, stage_id: stage ? [stageId, stage.name] : [stageId, ""] }
              : l
          ),
          summary: old.summary.map(s => {
            const lead = old.leads.find(l => l.id === leadId);
            if (!lead) return s;
            const oldStageId = lead.stage_id ? lead.stage_id[0] : null;
            if (s.stageId === oldStageId) {
              return { ...s, count: s.count - 1, revenue: s.revenue - (lead.expected_revenue || 0) };
            }
            if (s.stageId === stageId) {
              return { ...s, count: s.count + 1, revenue: s.revenue + (lead.expected_revenue || 0) };
            }
            return s;
          }),
        };
      });
      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        utils.crm.pipelineSummary.setData({ companyId: companyIdFilter }, context.previousData);
      }
      setToast({ message: "Failed to move deal. Please try again.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    },
    onSuccess: (_data, { leadId, stageId }) => {
      const stagesArr = pipelineData?.stages || [];
      const stage = stagesArr.find(s => s.id === stageId);
      const lead = pipelineData?.leads.find(l => l.id === leadId);
      setToast({
        message: `Moved "${lead?.name || "Deal"}" to ${stage?.name || "stage"}`,
        type: "success",
      });
      setTimeout(() => setToast(null), 3000);
    },
    onSettled: () => {
      utils.crm.pipelineSummary.invalidate();
    },
  });

  // Detail data
  const { data: selectedLead } = trpc.crm.leadById.useQuery(
    { id: selectedLeadId! },
    { enabled: !!selectedLeadId }
  );
  const { data: messages } = trpc.crm.messages.useQuery(
    { leadId: selectedLeadId!, limit: 30 },
    { enabled: !!selectedLeadId && view === "detail" }
  );
  const { data: activities } = trpc.crm.activities.useQuery(
    { leadId: selectedLeadId! },
    { enabled: !!selectedLeadId && view === "detail" }
  );
  const { data: attachments, refetch: refetchAttachments } = trpc.crm.leadAttachments.useQuery(
    { leadId: selectedLeadId! },
    { enabled: !!selectedLeadId && view === "detail" }
  );

  // Add note mutation
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const addNote = trpc.crm.addNote.useMutation({
    onSuccess: () => {
      setNoteText("");
      setAddingNote(false);
      utils.crm.messages.invalidate();
      setToast({ message: "Note added successfully", type: "success" });
      setTimeout(() => setToast(null), 3000);
    },
    onError: () => {
      setToast({ message: "Failed to add note", type: "error" });
      setTimeout(() => setToast(null), 4000);
    },
  });

  // Upload attachment mutation
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAttachment = trpc.crm.uploadAttachment.useMutation({
    onSuccess: () => {
      refetchAttachments();
      setUploading(false);
      setToast({ message: "Document uploaded successfully", type: "success" });
      setTimeout(() => setToast(null), 3000);
    },
    onError: () => {
      setUploading(false);
      setToast({ message: "Failed to upload document", type: "error" });
      setTimeout(() => setToast(null), 4000);
    },
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedLeadId) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadAttachment.mutate({
        leadId: selectedLeadId,
        filename: file.name,
        data: base64,
        mimetype: file.type,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [selectedLeadId, uploadAttachment]);

  const stages = pipelineData?.stages || [];
  const leads = pipelineData?.leads || [];

  // Filter leads by search
  const filteredLeads = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(l =>
      l.name.toLowerCase().includes(q) ||
      (l.partner_id && l.partner_id[1].toLowerCase().includes(q)) ||
      (l.contact_name && l.contact_name.toLowerCase().includes(q)) ||
      (l.x_studio_bank_name && l.x_studio_bank_name.toLowerCase().includes(q)) ||
      (l.x_studio_contract_reference && l.x_studio_contract_reference.toLowerCase().includes(q))
    );
  }, [leads, search]);

  const openDetail = useCallback((id: number) => {
    setSelectedLeadId(id);
    setView("detail");
  }, []);

  const backToPipeline = useCallback(() => {
    setView("pipeline");
    setSelectedLeadId(null);
  }, []);

  // ─── Drag-and-Drop Handlers ─────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, leadId: number) => {
    setDraggingLeadId(leadId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(leadId));
    const el = e.currentTarget as HTMLElement;
    if (el) {
      e.dataTransfer.setDragImage(el, el.offsetWidth / 2, 20);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingLeadId(null);
    setDragOverStageId(null);
    dragCounterRef.current = {};
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, stageId: number) => {
    e.preventDefault();
    dragCounterRef.current[stageId] = (dragCounterRef.current[stageId] || 0) + 1;
    setDragOverStageId(stageId);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent, stageId: number) => {
    e.preventDefault();
    dragCounterRef.current[stageId] = (dragCounterRef.current[stageId] || 0) - 1;
    if (dragCounterRef.current[stageId] <= 0) {
      dragCounterRef.current[stageId] = 0;
      if (dragOverStageId === stageId) {
        setDragOverStageId(null);
      }
    }
  }, [dragOverStageId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetStageId: number) => {
    e.preventDefault();
    setDragOverStageId(null);
    dragCounterRef.current = {};
    const leadIdStr = e.dataTransfer.getData("text/plain");
    const leadId = parseInt(leadIdStr, 10);
    if (isNaN(leadId)) return;
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const currentStageId = lead.stage_id ? lead.stage_id[0] : null;
    if (currentStageId === targetStageId) {
      setDraggingLeadId(null);
      return;
    }
    moveToStage.mutate({ leadId, stageId: targetStageId });
    setDraggingLeadId(null);
  }, [leads, moveToStage]);

  // ─── KPI Cards ───────────────────────────────────────────────────────────
  const totalDeals = leads.length;
  const totalRevenue = leads.reduce((s, l) => s + (l.expected_revenue || 0), 0);
  const totalPaid = leads.reduce((s, l) => s + (l.x_studio_paid_amount || 0), 0);
  const totalRemaining = leads.reduce((s, l) => s + (l.x_studio_remaining_amount || 0), 0);
  const activeDeals = leads.filter(l => !l.date_closed).length;
  const wonDeals = leads.filter(l => {
    const stg = stages.find(s => s.id === (l.stage_id && l.stage_id[0]));
    return stg?.is_won;
  }).length;

  // ─── Loading / Error States ──────────────────────────────────────────────
  if (loadingPipeline) {
    return (
      <div style={{ fontFamily: FONT }}>
        <TopProgressBar />

        {/* KPI Cards Skeleton */}
        <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: "10px 12px",
            }}>
              <ShimmerBox width={70} height={8} style={{ marginBottom: 8 }} />
              <ShimmerBox width={100} height={18} style={{ marginBottom: 6 }} />
              <ShimmerBox width={50} height={8} />
            </div>
          ))}
        </div>

        {/* Toolbar Skeleton */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ShimmerBox width={240} height={30} borderRadius={6} />
            <ShimmerBox width={160} height={20} borderRadius={4} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ShimmerBox width={90} height={30} borderRadius={6} />
            <ShimmerBox width={120} height={30} borderRadius={6} />
          </div>
        </div>

        {/* Pipeline Columns Skeleton */}
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
          {[1, 2, 3, 4, 5].map(col => (
            <div key={col} style={{
              minWidth: 260, width: 260, flexShrink: 0,
              background: C.pageBg, borderRadius: 10,
              border: `2px solid ${C.border}`,
              display: "flex", flexDirection: "column",
            }}>
              {/* Stage Header Skeleton */}
              <div style={{
                padding: "10px 12px", borderBottom: `1px solid ${C.border}`,
                background: C.card, borderRadius: "8px 8px 0 0",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <ShimmerBox width={90} height={12} />
                  <PulseBox width={24} height={18} borderRadius={10} />
                </div>
                <ShimmerBox width={70} height={9} style={{ marginTop: 6 }} />
              </div>
              {/* Card Skeletons */}
              <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {Array.from({ length: col <= 2 ? 3 : col <= 4 ? 2 : 1 }).map((_, j) => (
                  <div key={j} style={{
                    background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
                    padding: 10,
                  }}>
                    <ShimmerBox width="80%" height={11} style={{ marginBottom: 6 }} />
                    <ShimmerBox width="50%" height={9} style={{ marginBottom: 8 }} />
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <ShimmerBox width={60} height={14} />
                      <ShimmerBox width={40} height={14} borderRadius={4} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (pipelineError) {
    return (
      <div style={{ padding: 24, fontFamily: FONT }}>
        <div style={{
          background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: 16,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#991B1B", marginBottom: 4 }}>
            Failed to load CRM data
          </div>
          <div style={{ fontSize: 10, color: "#B91C1C" }}>
            {pipelineError.message}
          </div>
        </div>
      </div>
    );
  }

  // ─── Detail View ─────────────────────────────────────────────────────────
  if (view === "detail" && selectedLead) {
    const currentStage = stages.find(s => s.id === (selectedLead.stage_id && selectedLead.stage_id[0]));
    const currentStageIdx = stages.findIndex(s => s.id === (selectedLead.stage_id && selectedLead.stage_id[0]));
    const currency = selectedLead.x_studio_currency || "AED";
    const paidAmount = selectedLead.x_studio_paid_amount || 0;
    const remainingAmount = selectedLead.x_studio_remaining_amount || 0;
    const totalDeal = selectedLead.expected_revenue || 0;
    const paidPct = totalDeal > 0 ? Math.round((paidAmount / totalDeal) * 100) : 0;

    return (
      <div style={{ fontFamily: FONT }}>
        {/* Back button */}
        <div
          onClick={backToPipeline}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 10, color: C.terra, fontWeight: 600, cursor: "pointer", marginBottom: 12,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Pipeline
        </div>

        {/* Deal Header */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: 16, marginBottom: 12,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.dark }}>{selectedLead.name}</div>
              {selectedLead.partner_id && (
                <div style={{ fontSize: 11, color: C.sage, marginTop: 2 }}>{selectedLead.partner_id[1]}</div>
              )}
              {selectedLead.x_studio_investor_type && selectedLead.x_studio_investor_type !== "" && (
                <div style={{
                  display: "inline-block", fontSize: 8, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                  background: "#E0E7FF", color: "#3730A3", marginTop: 4,
                }}>
                  {selectedLead.x_studio_investor_type}
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.forest, fontFamily: MONO }}>
                {fmtCurrency(totalDeal, currency)}
              </div>
              {paidAmount > 0 && (
                <div style={{ fontSize: 9, color: C.sage, fontFamily: MONO, marginTop: 2 }}>
                  Paid: {fmtCurrency(paidAmount, currency)}
                </div>
              )}
            </div>
          </div>

          {/* Paid Progress Bar */}
          {totalDeal > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 8, color: C.muted, fontWeight: 600 }}>Payment Progress</span>
                <span style={{ fontSize: 8, color: C.forest, fontWeight: 700, fontFamily: MONO }}>
                  {paidPct}% ({fmtCurrency(paidAmount, currency)} / {fmtCurrency(totalDeal, currency)})
                </span>
              </div>
              <div style={{ height: 6, background: C.gBg, borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${Math.min(paidPct, 100)}%`,
                  background: `linear-gradient(90deg, ${C.forest}, ${C.sage})`,
                  borderRadius: 3, transition: "width .3s",
                }} />
              </div>
              {remainingAmount > 0 && (
                <div style={{ fontSize: 8, color: C.terra, marginTop: 2, textAlign: "right" }}>
                  Remaining: {fmtCurrency(remainingAmount, currency)}
                </div>
              )}
            </div>
          )}

          {/* Stage Progress Bar with Transition Buttons */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Pipeline Stage
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {currentStageIdx > 0 && (
                  <button
                    onClick={() => {
                      const prevStage = stages[currentStageIdx - 1];
                      if (prevStage) moveToStage.mutate({ leadId: selectedLead.id, stageId: prevStage.id });
                    }}
                    disabled={moveToStage.isPending}
                    style={{
                      padding: "3px 10px", borderRadius: 4, border: `1px solid ${C.border}`,
                      background: C.card, fontSize: 8, fontWeight: 600, color: C.muted,
                      cursor: moveToStage.isPending ? "not-allowed" : "pointer", fontFamily: FONT,
                      display: "flex", alignItems: "center", gap: 3, opacity: moveToStage.isPending ? 0.5 : 1,
                    }}
                  >
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    {stages[currentStageIdx - 1]?.name}
                  </button>
                )}
                {currentStageIdx < stages.length - 1 && (
                  <button
                    onClick={() => {
                      const nextStage = stages[currentStageIdx + 1];
                      if (nextStage) moveToStage.mutate({ leadId: selectedLead.id, stageId: nextStage.id });
                    }}
                    disabled={moveToStage.isPending}
                    style={{
                      padding: "3px 10px", borderRadius: 4, border: "none",
                      background: C.forest, fontSize: 8, fontWeight: 600, color: C.white,
                      cursor: moveToStage.isPending ? "not-allowed" : "pointer", fontFamily: FONT,
                      display: "flex", alignItems: "center", gap: 3, opacity: moveToStage.isPending ? 0.5 : 1,
                    }}
                  >
                    {stages[currentStageIdx + 1]?.name}
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 2 }}>
              {stages.map((stg, i) => {
                const isActive = i === currentStageIdx;
                const isPast = i < currentStageIdx;
                const isWon = stg.is_won && isActive;
                return (
                  <div
                    key={stg.id}
                    onClick={() => {
                      if (!isActive && !moveToStage.isPending) {
                        moveToStage.mutate({ leadId: selectedLead.id, stageId: stg.id });
                      }
                    }}
                    style={{
                      flex: 1, height: 28, borderRadius: 4,
                      background: isWon ? C.forest : isPast ? C.forest + "40" : isActive ? C.forest : C.gBg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 8, fontWeight: isActive ? 700 : 500,
                      color: isActive || isPast ? C.white : C.muted,
                      transition: "all .2s",
                      cursor: isActive ? "default" : "pointer",
                    }}
                  >
                    {stg.name}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: "Current Stage", value: currentStage?.name || "—" },
              { label: "Probability", value: `${selectedLead.probability}%` },
              { label: "Priority", value: priorityLabel(selectedLead.priority) },
              { label: "Created", value: fmtDate(selectedLead.create_date) },
              { label: "Deadline", value: fmtDate(selectedLead.date_deadline) },
              { label: "Contact", value: selectedLead.contact_name || "—" },
              { label: "Email", value: selectedLead.email_from || "—" },
              { label: "Phone", value: selectedLead.phone || "—" },
            ].map((item, i) => (
              <div key={i}>
                <div style={{ fontSize: 8, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.dark, marginTop: 2 }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Investment Details Card */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: 14, marginBottom: 12,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.dark, marginBottom: 10 }}>Investment Details</div>
          <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <InfoRow label="Contract Reference" value={selectedLead.x_studio_contract_reference || "—"} />
              <InfoRow label="Contract Date" value={fmtDate(selectedLead.x_studio_contract_date)} />
              <InfoRow label="Maturity Date" value={fmtDate(selectedLead.x_studio_maturity_date)} />
              <InfoRow label="Profit Rate" value={selectedLead.x_studio_profit_rate > 0 ? `${selectedLead.x_studio_profit_rate}%` : "—"} mono />
              <InfoRow label="Currency" value={currency !== "AED" ? currency : "AED"} />
              <InfoRow label="National ID" value={selectedLead.x_studio_national_id || "—"} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <InfoRow label="Bank Name" value={selectedLead.x_studio_bank_name || "—"} />
              <InfoRow label="Bank Account" value={selectedLead.x_studio_bank_account || "—"} mono />
              <InfoRow label="Total Investment" value={fmtCurrency(totalDeal, currency)} mono />
              <InfoRow label="Paid Amount" value={fmtCurrency(paidAmount, currency)} mono />
              <InfoRow label="Remaining Amount" value={fmtCurrency(remainingAmount, currency)} mono />
              <InfoRow label="Investor Type" value={selectedLead.x_studio_investor_type || "—"} />
            </div>
          </div>
          {selectedLead.x_studio_address && selectedLead.x_studio_address !== "" && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 8, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>Address</div>
              <div style={{ fontSize: 9, color: C.dark }}>{selectedLead.x_studio_address}</div>
            </div>
          )}
          {selectedLead.x_studio_notes && selectedLead.x_studio_notes !== "" && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 8, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>Notes</div>
              <div style={{ fontSize: 9, color: C.dark, whiteSpace: "pre-wrap" }}>{selectedLead.x_studio_notes}</div>
            </div>
          )}
        </div>

        {/* Description */}
        {selectedLead.description && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
            padding: 14, marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Description</div>
            <div style={{ fontSize: 10, color: C.gray, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {stripHtml(selectedLead.description)}
            </div>
          </div>
        )}

        {/* Scheduled Activities */}
        {activities && activities.length > 0 && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
            padding: 14, marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.dark, marginBottom: 10 }}>
              Scheduled Activities ({activities.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {activities.map(act => {
                const isOverdue = new Date(act.date_deadline) < new Date() && act.state !== "done";
                const stateColor = act.state === "done" ? "#059669" : isOverdue ? "#DC2626" : "#F59E0B";
                const stateBg = act.state === "done" ? "#F0FDF4" : isOverdue ? "#FEF2F2" : "#FFFBEB";
                return (
                  <div key={act.id} style={{
                    padding: "8px 10px", borderRadius: 6, background: stateBg,
                    borderLeft: `3px solid ${stateColor}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 600, color: C.dark }}>
                          {act.activity_type_id ? act.activity_type_id[1] : "Activity"}
                        </span>
                        <span style={{
                          fontSize: 7, fontWeight: 600, padding: "1px 5px", borderRadius: 3,
                          background: stateColor + "20", color: stateColor,
                        }}>
                          {act.state === "done" ? "Done" : isOverdue ? "Overdue" : "Planned"}
                        </span>
                      </div>
                      <div style={{ fontSize: 8, color: C.muted }}>
                        Due: {fmtDate(act.date_deadline)}
                      </div>
                    </div>
                    {act.summary && (
                      <div style={{ fontSize: 9, color: C.dark, fontWeight: 500 }}>{act.summary}</div>
                    )}
                    {act.note && act.note !== "" && (
                      <div style={{ fontSize: 8, color: C.gray, marginTop: 2 }}>{stripHtml(String(act.note))}</div>
                    )}
                    {act.user_id && (
                      <div style={{ fontSize: 8, color: C.muted, marginTop: 2 }}>Assigned: {act.user_id[1]}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Documents / Attachments */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: 14, marginBottom: 12,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.dark }}>
              Documents ({attachments?.length || 0})
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                padding: "4px 10px", borderRadius: 5, border: `1px solid ${C.border}`,
                background: C.card, fontSize: 8, fontWeight: 600, color: C.forest,
                cursor: uploading ? "not-allowed" : "pointer", fontFamily: FONT,
                display: "flex", alignItems: "center", gap: 4,
                opacity: uploading ? 0.5 : 1,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
              {uploading ? "Uploading..." : "Upload"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </div>
          {(!attachments || attachments.length === 0) ? (
            <div style={{ fontSize: 10, color: C.muted, textAlign: "center", padding: 16 }}>
              No documents attached yet
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {attachments.map(att => {
                const isImage = att.mimetype?.startsWith("image/");
                const isPdf = att.mimetype === "application/pdf";
                const icon = isImage ? "🖼" : isPdf ? "📄" : "📎";
                const sizeKb = att.file_size ? Math.round(att.file_size / 1024) : 0;
                return (
                  <div key={att.id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 8px", borderRadius: 5, background: C.pageBg,
                    border: `1px solid ${C.border}`,
                  }}>
                    <span style={{ fontSize: 14 }}>{icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: C.dark }}>{att.name}</div>
                      <div style={{ fontSize: 7, color: C.muted }}>
                        {sizeKb > 0 ? `${sizeKb} KB` : ""} {att.create_date ? `· ${fmtDate(att.create_date)}` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Note */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: 14, marginBottom: 12,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.dark, marginBottom: 8 }}>Add Note</div>
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Write a note about this deal..."
            style={{
              width: "100%", minHeight: 60, padding: 8, borderRadius: 6,
              border: `1px solid ${C.border}`, fontSize: 10, fontFamily: FONT,
              color: C.dark, background: C.pageBg, resize: "vertical",
              outline: "none",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = C.forest; }}
            onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            <button
              onClick={() => {
                if (!noteText.trim() || !selectedLeadId) return;
                setAddingNote(true);
                addNote.mutate({ leadId: selectedLeadId, body: noteText.trim() });
              }}
              disabled={!noteText.trim() || addingNote}
              style={{
                padding: "5px 14px", borderRadius: 5, border: "none",
                background: !noteText.trim() ? C.gBg : C.forest,
                color: !noteText.trim() ? C.muted : C.white,
                fontSize: 9, fontWeight: 600, cursor: !noteText.trim() ? "not-allowed" : "pointer",
                fontFamily: FONT, opacity: addingNote ? 0.5 : 1,
              }}
            >
              {addingNote ? "Saving..." : "Add Note"}
            </button>
          </div>
        </div>

        {/* Activity Log / Messages */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: 14,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.dark, marginBottom: 10 }}>
            Activity & Notes ({messages?.length || 0})
          </div>
          {(!messages || messages.length === 0) ? (
            <div style={{ fontSize: 10, color: C.muted, textAlign: "center", padding: 16 }}>
              No activity records yet
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {messages.map(msg => (
                <div key={msg.id} style={{
                  padding: "8px 10px", borderRadius: 6, background: C.pageBg,
                  borderLeft: `3px solid ${msg.message_type === "comment" ? C.forest : C.terra}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: C.dark }}>
                      {msg.author_id ? msg.author_id[1] : "System"}
                    </div>
                    <div style={{ fontSize: 8, color: C.muted }}>{fmtDate(msg.date)}</div>
                  </div>
                  <div style={{ fontSize: 9, color: C.gray, lineHeight: 1.4 }}>
                    {stripHtml(msg.body || "")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Pipeline / List View ────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: FONT }}>
      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* KPI Summary Row */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12,
      }}>
        {[
          { label: "Total Deals", value: String(totalDeals), sub: `${activeDeals} active`, color: C.forest },
          { label: "Total Revenue", value: fmtCurrency(totalRevenue), sub: `${wonDeals} won`, color: C.forest },
          { label: "Total Paid", value: fmtCurrency(totalPaid), sub: totalRevenue > 0 ? `${Math.round((totalPaid / totalRevenue) * 100)}% collected` : "—", color: "#059669" },
          { label: "Remaining", value: fmtCurrency(totalRemaining), sub: "Outstanding", color: C.terra },
        ].map((kpi, i) => (
          <div key={i} style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: "10px 12px",
          }}>
            <div style={{ fontSize: 8, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: kpi.color, fontFamily: MONO, marginTop: 2 }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 8, color: C.sage, marginTop: 1 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12,
      }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* Company Selector */}
          <div ref={companyRef} style={{ position: "relative" }}>
            <button
              onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 10px 4px 6px",
                background: companyDropdownOpen ? C.gBg2 : C.gBg,
                border: `1px solid ${companyDropdownOpen ? C.sage : C.gBdr}`,
                borderRadius: 6, cursor: "pointer", transition: "all .15s",
                fontFamily: FONT,
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 4,
                background: activeCompany === "ALL" ? C.forest : C.sage,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 700, color: C.white, flexShrink: 0,
              }}>{activeCompany === "ALL" ? "⊕" : (activeCompanyObj?.name?.charAt(0) || "?")}</div>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.dark, whiteSpace: "nowrap" }}>{companyLabel}</span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{
                transform: companyDropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s",
              }}>
                <path d="M1 1L5 5L9 1" stroke={C.gray} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {companyDropdownOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0,
                minWidth: 220, background: C.card,
                border: `1px solid ${C.border}`, borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 200, overflow: "hidden",
              }}>
                <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, background: C.gBg }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.sage, textTransform: "uppercase", letterSpacing: 0.8 }}>Filter by Company</div>
                </div>
                {isCompanyAdmin && (
                <div
                  onClick={() => { setActiveCompany("ALL"); setCompanyDropdownOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer",
                    background: activeCompany === "ALL" ? C.gBg2 : "transparent",
                    borderBottom: `1px solid ${C.border}`, transition: "background .1s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.gBg}
                  onMouseLeave={e => e.currentTarget.style.background = activeCompany === "ALL" ? C.gBg2 : "transparent"}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: 5, background: C.forest,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: C.white,
                  }}>⊕</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: C.dark }}>All Companies</div>
                    <div style={{ fontSize: 8, color: C.muted }}>Show all investment deals</div>
                  </div>
                  {activeCompany === "ALL" && <span style={{ fontSize: 11, color: C.forest, fontWeight: 700 }}>✓</span>}
                </div>
                )}
                {companiesLoading && (
                  <div style={{ padding: "6px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                        <ShimmerBox width={24} height={24} borderRadius={5} />
                        <div style={{ flex: 1 }}>
                          <ShimmerBox width={100} height={10} style={{ marginBottom: 3 }} />
                          <ShimmerBox width={60} height={8} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {companies.map(company => {
                  const isActive = activeCompany === company.id;
                  return (
                    <div key={company.id}
                      onClick={() => { setActiveCompany(company.id); setCompanyDropdownOpen(false); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer",
                        background: isActive ? C.gBg2 : "transparent",
                        borderBottom: `1px solid ${C.border}`, transition: "background .1s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = C.gBg}
                      onMouseLeave={e => e.currentTarget.style.background = isActive ? C.gBg2 : "transparent"}
                    >
                      <div style={{
                        width: 24, height: 24, borderRadius: 5, background: C.sage,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontWeight: 700, color: C.white,
                      }}>{company.name.substring(0, 2).toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: C.dark }}>{company.name}</div>
                        <div style={{ fontSize: 8, color: C.muted }}>
                          {company.currency && <span>{company.currency}</span>}
                          {company.country && <span> · {company.country}</span>}
                        </div>
                      </div>
                      {isActive && <span style={{ fontSize: 11, color: C.forest, fontWeight: 700 }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Search */}
          <div style={{
            display: "flex", alignItems: "center", gap: 5, background: C.card,
            border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 10px",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search deals, investors, banks, refs..."
              style={{
                border: "none", outline: "none", fontSize: 10, background: "transparent",
                color: C.dark, width: 200, fontFamily: FONT,
              }}
            />
          </div>

          {/* Drag hint */}
          {view === "pipeline" && (
            <div style={{ fontSize: 8, color: C.muted, display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2">
                <path d="M5 9l4-4 4 4M5 15l4 4 4-4" />
              </svg>
              Drag cards to move between stages
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* New Deal Button */}
          <button
            onClick={() => setShowNewDeal(true)}
            style={{
              padding: "6px 14px", borderRadius: 6, border: "none",
              background: C.forest, fontSize: 10, fontWeight: 700,
              color: C.white, cursor: "pointer", fontFamily: FONT,
              display: "flex", alignItems: "center", gap: 5,
              transition: "background .15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.forestHov; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.forest; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Deal
          </button>

          {/* View Toggle */}
          <div style={{ display: "flex", gap: 2, background: C.gBg, borderRadius: 6, padding: 2 }}>
          {(["pipeline", "list"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "4px 12px", borderRadius: 4, border: "none",
                fontSize: 9, fontWeight: 600, cursor: "pointer",
                background: view === v ? C.card : "transparent",
                color: view === v ? C.forest : C.muted,
                boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                fontFamily: FONT,
              }}
            >
              {v === "pipeline" ? "Pipeline" : "List"}
            </button>
          ))}
          </div>
        </div>
      </div>

      {/* New Deal Modal */}
      <NewDealModal
        open={showNewDeal}
        onClose={() => setShowNewDeal(false)}
        onCreated={(leadId) => {
          setShowNewDeal(false);
          openDetail(leadId);
        }}
        stages={stages}
        tags={tags || []}
      />

      {/* Pipeline View (Kanban) with Drag-and-Drop */}
      {view === "pipeline" && (
        <div
          style={{
            display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8,
          }}
          onDragEnd={handleDragEnd}
        >
          {stages.map(stage => {
            const stageLeads = filteredLeads.filter(l => l.stage_id && l.stage_id[0] === stage.id);
            const stageRevenue = stageLeads.reduce((s, l) => s + (l.expected_revenue || 0), 0);
            const stagePaid = stageLeads.reduce((s, l) => s + (l.x_studio_paid_amount || 0), 0);
            const isDropTarget = dragOverStageId === stage.id && draggingLeadId !== null;
            const isDraggingFromThis = draggingLeadId !== null && stageLeads.some(l => l.id === draggingLeadId);

            return (
              <div
                key={stage.id}
                onDragEnter={(e) => handleDragEnter(e, stage.id)}
                onDragLeave={(e) => handleDragLeave(e, stage.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
                style={{
                  minWidth: 260, width: 260, flexShrink: 0,
                  background: isDropTarget ? `${C.forest}08` : C.pageBg,
                  borderRadius: 10,
                  border: `2px ${isDropTarget ? "dashed" : "solid"} ${isDropTarget ? C.forest : C.border}`,
                  display: "flex", flexDirection: "column",
                  transition: "all .2s ease",
                  transform: isDropTarget ? "scale(1.01)" : "scale(1)",
                  boxShadow: isDropTarget ? `0 0 0 3px ${C.forest}15, 0 4px 12px rgba(0,0,0,0.06)` : "none",
                }}
              >
                {/* Stage Header */}
                <div style={{
                  padding: "10px 12px", borderBottom: `1px solid ${isDropTarget ? C.forest + "30" : C.border}`,
                  background: isDropTarget ? `${C.forest}10` : C.card,
                  borderRadius: "8px 8px 0 0",
                  transition: "all .2s",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700,
                      color: isDropTarget ? C.forest : C.dark,
                      transition: "color .2s",
                    }}>
                      {stage.name}
                    </div>
                    <div style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10,
                      background: isDropTarget ? C.forest + "20" : C.gBg2,
                      color: C.forest,
                      transition: "background .2s",
                    }}>
                      {stageLeads.length}
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                    <div style={{ fontSize: 9, color: C.sage, fontFamily: MONO }}>
                      {fmtCurrency(stageRevenue)}
                    </div>
                    {stagePaid > 0 && (
                      <div style={{ fontSize: 8, color: "#059669", fontFamily: MONO }}>
                        Paid: {fmtCurrency(stagePaid)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cards */}
                <div style={{
                  flex: 1, padding: 8, display: "flex", flexDirection: "column", gap: 6,
                  overflowY: "auto", maxHeight: 500,
                  minHeight: isDropTarget ? 100 : 60,
                  transition: "min-height .2s",
                }}>
                  {stageLeads.length === 0 && !isDropTarget ? (
                    <div style={{
                      textAlign: "center", padding: 16, fontSize: 9, color: C.muted,
                    }}>
                      No deals in this stage
                    </div>
                  ) : stageLeads.length === 0 && isDropTarget ? (
                    <div style={{
                      textAlign: "center", padding: 20, fontSize: 10, color: C.forest,
                      fontWeight: 600, border: `2px dashed ${C.forest}40`, borderRadius: 8,
                      background: `${C.forest}05`,
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="2" style={{ margin: "0 auto 4px", display: "block" }}>
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Drop here
                    </div>
                  ) : (
                    stageLeads.map(lead => (
                      <DealCard
                        key={lead.id}
                        lead={lead}
                        onClick={() => openDetail(lead.id)}
                        onDragStart={handleDragStart}
                        isDragging={draggingLeadId === lead.id}
                      />
                    ))
                  )}

                  {/* Drop indicator when there are cards */}
                  {isDropTarget && stageLeads.length > 0 && !isDraggingFromThis && (
                    <div style={{
                      padding: 10, textAlign: "center", fontSize: 9, color: C.forest,
                      fontWeight: 600, border: `2px dashed ${C.forest}40`, borderRadius: 8,
                      background: `${C.forest}05`, marginTop: 2,
                    }}>
                      Drop here to move
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
          overflow: "hidden",
        }}>
          <div style={{ overflowX: "auto" }}>
            <div className="mob-table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, minWidth: 900 }}>
              <thead>
                <tr style={{ background: C.gBg, borderBottom: `1px solid ${C.border}` }}>
                  {["Deal Name", "Investor", "Stage", "Revenue", "Paid", "Remaining", "Profit %", "Bank", "Contract Date", "Maturity", "Priority"].map(h => (
                    <th key={h} style={{
                      padding: "8px 10px", textAlign: "left", fontSize: 8, fontWeight: 700,
                      color: C.sage, textTransform: "uppercase", letterSpacing: 0.5,
                      whiteSpace: "nowrap",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(lead => {
                  const currency = lead.x_studio_currency || "AED";
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => openDetail(lead.id)}
                      style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.gBg; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: C.dark }}>{lead.name}</td>
                      <td style={{ padding: "8px 10px", color: C.sage }}>{lead.partner_id ? lead.partner_id[1] : "—"}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{
                          fontSize: 8, padding: "2px 6px", borderRadius: 4,
                          background: C.gBg2, color: C.forest, fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}>
                          {lead.stage_id ? lead.stage_id[1] : "—"}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: C.forest, fontFamily: MONO, whiteSpace: "nowrap" }}>
                        {fmtCurrency(lead.expected_revenue, currency)}
                      </td>
                      <td style={{ padding: "8px 10px", fontFamily: MONO, color: "#059669", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {fmtCurrency(lead.x_studio_paid_amount || 0, currency)}
                      </td>
                      <td style={{ padding: "8px 10px", fontFamily: MONO, color: C.terra, fontWeight: 600, whiteSpace: "nowrap" }}>
                        {fmtCurrency(lead.x_studio_remaining_amount || 0, currency)}
                      </td>
                      <td style={{ padding: "8px 10px", fontFamily: MONO }}>
                        {lead.x_studio_profit_rate > 0 ? `${lead.x_studio_profit_rate}%` : "—"}
                      </td>
                      <td style={{ padding: "8px 10px", color: C.gray, whiteSpace: "nowrap" }}>
                        {lead.x_studio_bank_name || "—"}
                      </td>
                      <td style={{ padding: "8px 10px", color: C.muted, whiteSpace: "nowrap" }}>
                        {fmtDate(lead.x_studio_contract_date)}
                      </td>
                      <td style={{ padding: "8px 10px", color: C.muted, whiteSpace: "nowrap" }}>
                        {fmtDate(lead.x_studio_maturity_date)}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ color: priorityColor(lead.priority), fontWeight: 600 }}>
                          {priorityLabel(lead.priority)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredLeads.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ padding: 24, textAlign: "center", color: C.muted }}>
                      No investment deals found
                    </td>
                  </tr>
                )}
              </tbody>
            </table></div>
          </div>
        </div>
      )}
    </div>
  );
}
