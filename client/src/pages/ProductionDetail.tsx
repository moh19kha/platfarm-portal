/**
 * ProductionDetail — Full detail view for a Manufacturing Order
 * Tabs: Overview, Input/Output, Quality, Workforce, Machine, Diesel
 * Workforce tab uses OdooMultiSelect for selecting/removing people (like loads page)
 * Each tab has a Documents section for file uploads
 */
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { C, FONT, MONO, fmt, fmtQty, fmtDateStr } from "@/lib/data";
import { Badge, Bar, Btn, Card, CardHdr, CHT, CHB, FieldRow, TabButton, Th, Td, Lbl } from "@/components/ui-primitives";
import { MO_STATE_LABELS, MO_STATE_COLORS, MO_STATE_BADGE } from "@/lib/moStateLabels";
import { INPUT_QUALITY_GRADES, INPUT_SOURCES, EQUIPMENT_FAILURE_REASONS } from "@/lib/productionData";
import { OdooMultiSelect } from "@/components/OdooMultiSelect";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { TopProgressBar, DetailPageSkeleton } from "@/components/LoadingIndicators";
import { toast as sonnerToast } from "sonner";

interface Props {
  moId: number;
  onBack: () => void;
}

type Tab = "overview" | "io" | "quality" | "workforce" | "machine" | "diesel";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "io", label: "Input / Output" },
  { id: "quality", label: "Quality" },
  { id: "workforce", label: "Workforce" },
  { id: "machine", label: "Machine" },
  { id: "diesel", label: "Diesel" },
];

// ─── Reusable row components ──────────────────────────────────────────────
const BoolRow = ({ label, value }: { label: string; value: boolean | undefined }) => (
  <FieldRow label={label} value={
    value === undefined ? "—" :
    value ? "Yes" :
    "No"
  } color={value ? C.red : C.forest} />
);

const NotesBox = ({ label, text }: { label: string; text: string | null | undefined }) => {
  if (!text) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{
        padding: "8px 10px", background: C.gBg, border: `1px solid ${C.gBdr}`,
        borderRadius: 6, fontSize: 11, color: C.dark, lineHeight: 1.5,
        whiteSpace: "pre-wrap", fontFamily: FONT,
      }}>{text}</div>
    </div>
  );
};

const EmpList = ({ label, employees }: {
  label: string;
  employees: { id: number; name: string; department: string; jobTitle: string }[];
}) => {
  if (!employees || employees.length === 0) return <FieldRow label={label} value="None assigned" />;
  return (
    <div style={{ padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 10, color: C.gray, fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {employees.map(e => (
          <div key={e.id} style={{
            padding: "3px 8px", background: C.gBg2, border: `1px solid ${C.gBdr}`,
            borderRadius: 12, fontSize: 10, color: C.forest, fontWeight: 600,
          }} title={`${e.jobTitle} — ${e.department}`}>
            {e.name}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * MO_DOCS — maps each Odoo binary field to a human-readable label.
 * Same pattern as PO_DOCS / PICKING_DOCS in shipments.
 */
const MO_DOCS = [
  { field: "supporting_documents", label: "Supporting Documents" },
  { field: "quality_form_documents", label: "Quality Form Documents" },
  { field: "output_quality_form_documents", label: "Output Quality Form Documents" },
  { field: "machine_monitoring_form_documents", label: "Machine Monitoring Form" },
  { field: "x_studio_supporting_documents", label: "Supporting Documents (Studio)" },
  { field: "x_studio_quality_form_documents", label: "Quality Form Documents (Studio)" },
];

const showToastGlobal = (msg: string, success = true) => {
  sonnerToast(
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 14, color: success ? C.forest : C.terra }}>{success ? "✓" : "✕"}</span>
      <span style={{ fontSize: 12, color: C.dark }}>{msg}</span>
    </div>,
    {
      duration: success ? 2000 : 3000,
      style: {
        fontFamily: "'DM Sans', system-ui, sans-serif",
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${success ? C.forest : C.terra}`,
        background: C.card,
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
      },
    }
  );
};

const inputStyle: React.CSSProperties = {
  padding: "4px 8px", border: `1px solid ${C.inputBdr}`, borderRadius: 5,
  fontSize: 11, fontFamily: MONO, outline: "none", width: "100%", background: C.gBg,
};

export function ProductionDetail({ moId, onBack }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "confirm" | "done" | "cancel">(null);

  // ─── Data ──────────────────────────────────────────────────────────────
  const { data: mo, isLoading, error, refetch } = trpc.production.getById.useQuery({ id: moId });
  const updateMutation = trpc.production.update.useMutation();
  const confirmMutation = trpc.production.confirm.useMutation();
  const markDoneMutation = trpc.production.markDone.useMutation();
  const cancelMutation = trpc.production.cancel.useMutation();
  const uploadMOFileMutation = trpc.production.uploadMOFile.useMutation();

  // ─── Odoo Binary File Upload (same pattern as shipments) ───────────
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, boolean>>({});
  const [previewFile, setPreviewFile] = useState<{ label: string; base64: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewReplaceRef = useRef<(() => void) | null>(null);

  // Fetch existing file status from Odoo
  const { data: moFileStatus } = trpc.production.checkMOFileStatus.useQuery(
    { moId },
    { staleTime: 30_000 }
  );

  // Initialize uploadedFiles from fetched file status
  useEffect(() => {
    if (moFileStatus) {
      setUploadedFiles(prev => {
        const next = { ...prev };
        for (const [field, hasFile] of Object.entries(moFileStatus)) {
          if (hasFile) next[`mo-${field}`] = true;
        }
        return next;
      });
    }
  }, [moFileStatus]);

  const handleFileUpload = useCallback(async (fieldName: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        const trackKey = `mo-${fieldName}`;
        uploadMOFileMutation.mutate({ moId, fieldName, base64Content: base64 }, {
          onSuccess: () => {
            setUploadedFiles(prev => ({ ...prev, [trackKey]: true }));
            setPreviewFile(null);
            showToastGlobal("Document uploaded successfully");
          },
          onError: (err) => showToastGlobal(`Upload failed: ${err.message}`, false),
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [moId, uploadMOFileMutation]);

  const handleFilePreview = useCallback(async (fieldName: string, label: string) => {
    setPreviewLoading(true);
    setPreviewFile({ label, base64: "" });
    previewReplaceRef.current = () => handleFileUpload(fieldName);
    try {
      const input = JSON.stringify({ "0": { json: { moId, fieldName } } });
      const res = await fetch(`/api/trpc/production.readMOFile?batch=1&input=${encodeURIComponent(input)}`, { credentials: "include" });
      const json = await res.json();
      const content = json?.[0]?.result?.data?.json?.content;
      if (content) {
        setPreviewFile({ label, base64: content });
      } else {
        setPreviewFile(null);
        alert("File not found or empty");
      }
    } catch (err) {
      console.error("Preview fetch error:", err);
      setPreviewFile(null);
      alert("Failed to load file preview");
    } finally {
      setPreviewLoading(false);
    }
  }, [moId, handleFileUpload]);

  // ─── Employee Search for Workforce Tab ─────────────────────────────────
  const [employeeSearch, setEmployeeSearch] = useState("");
  const { data: employeeOptions = [], isLoading: employeesLoading } = trpc.production.employees.useQuery(
    { search: employeeSearch },
    { enabled: editing }
  );

  // ─── Edit State ────────────────────────────────────────────────────────
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  // Workforce edit state (separate for OdooMultiSelect)
  const [teamEdit, setTeamEdit] = useState<{
    supervisors: { id: number; name: string }[];
    productionLabors: { id: number; name: string }[];
    qualityLabors: { id: number; name: string }[];
    drivers: { id: number; name: string }[];
    qualitySupervisors: { id: number; name: string }[];
    loadingDrivers: { id: number; name: string }[];
    labors: { id: number; name: string }[];
  }>({
    supervisors: [],
    productionLabors: [],
    qualityLabors: [],
    drivers: [],
    qualitySupervisors: [],
    loadingDrivers: [],
    labors: [],
  });

  const startEditing = useCallback(() => {
    if (!mo) return;
    setEditForm({
      shift_start_time: mo.shiftStart || "",
      shift_end_time: mo.shiftEnd || "",
      actual_production_hours: mo.actualHours || 0,
      down_time_minutes: mo.downTimeMinutes || 0,
      general_observations_notes: mo.notes || "",
      x_studio_input_material_source: mo.inputSource || "",
      x_studio_production_date_start_of_shift: mo.productionDate || "",
      input_product_quality_grade: mo.inputQualityGrade || "",
      average_input_big_bale_weight_kg: mo.avgInputBaleWeight || 0,
      input_product_contain_grasses: mo.containsGrasses || false,
      percentage_grasses_input_product: mo.grassesPercentage || 0,
      input_product_contain_high_moisture: mo.containsHighMoisture || false,
      number_high_moisture_big_bales: mo.highMoistureBigBales || 0,
      number_high_moisture_small_bales_tons: mo.highMoistureSmallBalesTons || 0,
      input_product_quality_observations: mo.inputQualityNotes || "",
      x_studio_no_produced_supreme_bales: mo.bales?.supreme || 0,
      no_produced_premium_bales: mo.bales?.premium || 0,
      no_produced_grade_1_bales: mo.bales?.grade1 || 0,
      no_produced_fair_grade_bales: mo.bales?.fair || 0,
      no_produced_alfamix_bales: mo.bales?.alfamix || 0,
      no_produced_mix_grass_bales: mo.bales?.mixGrass || 0,
      no_produced_wheat_straw_bales: mo.bales?.wheatStraw || 0,
      x_studio_no_produced_fairgrade_3_bales: mo.bales?.fairGrade3 || 0,
      output_product_quality_observations: mo.outputQualityNotes || "",
      diesel_consumption_liters: mo.dieselLiters || 0,
      number_sleeve_bags_used: mo.sleeveBagsUsed || 0,
      number_strapping_units_used: mo.strappingUnitsUsed || 0,
      diesel_materials_consumption_notes: mo.dieselNotes || "",
      no_oil_measurements_during_shift: mo.oilMeasurements || 0,
      maximum_oil_temperature: mo.maxOilTemperature || 0,
      maximum_oil_pressure: mo.maxOilPressure || 0,
      is_there_equipment_failure: mo.equipmentFailure || false,
      equipment_failure_reason: mo.failureReason || "",
      baling_monitoring_notes: mo.machineNotes || "",
      quality_observations_notes: mo.qualityNotes || "",
      x_studio_incentive_cancelled: mo.incentiveCancelled || false,
      x_studio_incentive_cancelation_details: mo.incentiveCancelDetails || "",
      x_studio_facility_manager_attended: mo.facilityManagerAttended || false,
      priority: mo.priority || "0",
    });
    // Initialize team edit state from current data
    setTeamEdit({
      supervisors: mo.supervisors.map(e => ({ id: e.id, name: e.name })),
      productionLabors: mo.productionLabors.map(e => ({ id: e.id, name: e.name })),
      qualityLabors: mo.qualityLabors.map(e => ({ id: e.id, name: e.name })),
      drivers: mo.drivers.map(e => ({ id: e.id, name: e.name })),
      qualitySupervisors: mo.qualitySupervisors.map(e => ({ id: e.id, name: e.name })),
      loadingDrivers: mo.loadingDrivers.map(e => ({ id: e.id, name: e.name })),
      labors: mo.labors.map(e => ({ id: e.id, name: e.name })),
    });
    setEditing(true);
  }, [mo]);

  const showToast = (msg: string, success = true) => {
    sonnerToast(
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14, color: success ? C.forest : C.terra }}>{success ? "✓" : "✕"}</span>
        <span style={{ fontSize: 12, color: C.dark }}>{msg}</span>
      </div>,
      {
        duration: success ? 2000 : 3000,
        style: {
          fontFamily: "'DM Sans', system-ui, sans-serif",
          border: `1px solid ${C.border}`,
          borderLeft: `3px solid ${success ? C.forest : C.terra}`,
          background: C.card,
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        },
      }
    );
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: moId,
        ...editForm,
        // Include employee IDs from team edit
        supervisor_ids: teamEdit.supervisors.map(e => e.id),
        involved_production_labors: teamEdit.productionLabors.map(e => e.id),
        involved_quality_labors: teamEdit.qualityLabors.map(e => e.id),
        involved_drivers: teamEdit.drivers.map(e => e.id),
        quality_supervisor_ids: teamEdit.qualitySupervisors.map(e => e.id),
        loading_driver_ids: teamEdit.loadingDrivers.map(e => e.id),
        labor_ids: teamEdit.labors.map(e => e.id),
      });
      setEditing(false);
      refetch();
      showToast("Production order updated successfully");
    } catch (e: any) {
      showToast(`Failed to update: ${e.message}`, false);
    }
  };

  const handleStateAction = async () => {
    try {
      if (confirmAction === "confirm") {
        await confirmMutation.mutateAsync({ id: moId });
        showToast("Order confirmed — now In Progress");
      } else if (confirmAction === "done") {
        await markDoneMutation.mutateAsync({ id: moId });
        showToast("Order marked as Done");
      } else if (confirmAction === "cancel") {
        await cancelMutation.mutateAsync({ id: moId });
        showToast("Order cancelled");
      }
      setConfirmAction(null);
      refetch();
    } catch (e: any) {
      showToast(`Action failed: ${e.message}`, false);
      setConfirmAction(null);
    }
  };

  // ─── Computed ──────────────────────────────────────────────────────────
  const totalBales = useMemo(() => {
    if (!mo?.bales) return 0;
    const b = mo.bales;
    return b.supreme + b.premium + b.grade1 + b.fair + (b.fairGrade3 || 0) + b.alfamix + b.mixGrass + b.wheatStraw;
  }, [mo]);

  const stateBadge = mo ? (MO_STATE_BADGE[mo.state] || "default") : "default";
  const stateLabel = mo ? (MO_STATE_LABELS[mo.state] || mo.state) : "";
  const stateColor = mo ? (MO_STATE_COLORS[mo.state] || C.gray) : C.gray;
  const canEdit = mo?.state === "draft" || mo?.state === "confirmed" || mo?.state === "progress" || mo?.state === "done" || mo?.state === "to_close";

  // ─── Loading ───────────────────────────────────────────────────────────
  if (isLoading || !mo) {
    return (
      <>
        <TopProgressBar />
        <DetailPageSkeleton />
      </>
    );
  }

  if (error) {
    return (
      <Card>
        <div style={{ padding: 24, textAlign: "center", color: C.red, fontSize: 12 }}>
          Failed to load manufacturing order: {error?.message || "Not found"}
        </div>
      </Card>
    );
  }

  // ─── Edit Field Helper ─────────────────────────────────────────────────
  const ef = (field: string) => editForm[field];
  const setEf = (field: string, value: any) => setEditForm(prev => ({ ...prev, [field]: value }));

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Header — matches Shipment Detail header exactly */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onBack} style={{
            background: "none", border: `1px solid ${C.border}`, borderRadius: 6,
            padding: "4px 10px", fontSize: 10, cursor: "pointer", color: C.gray,
          }}>← Production Orders</button>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{mo.name}</h2>
          <Badge v={stateBadge}>{stateLabel}</Badge>
          {mo.incentiveCancelled && <Badge v="red">Incentive Cancelled</Badge>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {/* State action buttons */}
          {mo.state === "draft" && (
            <Btn onClick={() => setConfirmAction("confirm")} small>Confirm Order</Btn>
          )}
          {mo.state === "progress" && (
            <Btn onClick={() => setConfirmAction("done")} small color={C.forest}>Mark as Done</Btn>
          )}
          {(mo.state === "draft" || mo.state === "confirmed" || mo.state === "progress") && (
            <Btn onClick={() => setConfirmAction("cancel")} small color={C.red} outline>Cancel</Btn>
          )}
          {/* Edit/Save — matches Shipment Edit button */}
          {canEdit && !editing && <Btn onClick={startEditing} outline small>Edit</Btn>}
          {editing && (
            <>
              <Btn onClick={() => { setEditing(false); setEditForm({}); }} color={C.gray} outline small>Cancel</Btn>
              <Btn onClick={handleSave} small disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Btn>
            </>
          )}
        </div>
      </div>

      {/* Quick Info Bar — matches Shipment summary ribbon */}
      <div style={{
        display: "flex", gap: 16, padding: "8px 14px",
        background: C.gBg, borderRadius: 8, border: `1px solid ${C.gBdr}`,
        fontSize: 10, color: C.gray, flexWrap: "wrap",
      }}>
        <div><Lbl>Product</Lbl> <span style={{ fontWeight: 600, color: C.dark }}>{mo.product?.name || "—"}</span></div>
        <div><Lbl>Company</Lbl> <span style={{ fontWeight: 600, color: C.dark }}>{mo.company?.name || "—"}</span></div>
        <div><Lbl>Qty Produced</Lbl> <span style={{ fontWeight: 700, color: C.forest, fontFamily: MONO }}>{fmtQty(mo.qtyProduced)} / {fmtQty(mo.productQty)}</span></div>
        <div><Lbl>Total Bales</Lbl> <span style={{ fontWeight: 600, fontFamily: MONO }}>{fmt(totalBales)}</span></div>
        {mo.productionDate && <div><Lbl>Production Date</Lbl> <span style={{ fontWeight: 600 }}>{fmtDateStr(mo.productionDate)}</span></div>}
        {mo.dieselLiters ? <div><Lbl>Diesel</Lbl> <span style={{ fontWeight: 600, fontFamily: MONO }}>{fmt(mo.dieselLiters)} L</span></div> : null}
      </div>

      {/* Tabs — uses same TabButton component as Shipment detail */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1.5px solid ${C.border}` }}>
        {TABS.map(t => (
          <TabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</TabButton>
        ))}
      </div>

      {/* Tab Content */}

      {/* ═══ OVERVIEW TAB ═══ */}
      {tab === "overview" && (
        <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Production Info</div>
            {editing ? (
              <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Production Date</div>
                  <input type="date" value={ef("x_studio_production_date_start_of_shift")} onChange={e => setEf("x_studio_production_date_start_of_shift", e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Input Source</div>
                   <select value={ef("x_studio_input_material_source")} onChange={e => setEf("x_studio_input_material_source", e.target.value)} style={inputStyle}>
                     <option value="">Select source...</option>
                     {INPUT_SOURCES.map(s => (
                       <option key={s} value={s}>{s}</option>
                     ))}
                   </select>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Shift Start</div>
                  <input value={ef("shift_start_time")} onChange={e => setEf("shift_start_time", e.target.value)} style={inputStyle} placeholder="HH:MM" />
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Shift End</div>
                  <input value={ef("shift_end_time")} onChange={e => setEf("shift_end_time", e.target.value)} style={inputStyle} placeholder="HH:MM" />
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Actual Hours</div>
                  <input type="number" step="0.1" value={ef("actual_production_hours") || ""} onChange={e => setEf("actual_production_hours", parseFloat(e.target.value) || 0)} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Down Time (min)</div>
                  <input type="number" value={ef("down_time_minutes") || ""} onChange={e => setEf("down_time_minutes", parseInt(e.target.value) || 0)} style={inputStyle} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>General Notes</div>
                  <textarea value={ef("general_observations_notes")} onChange={e => setEf("general_observations_notes", e.target.value)} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} />
                </div>
              </div>
            ) : (
              <>
                <FieldRow label="Manufacturing Order" value={mo.name} mono />
                <FieldRow label="Product" value={mo.product?.name} />
                <FieldRow label="Bill of Materials" value={mo.bom?.name} />
                <FieldRow label="Company" value={mo.company?.name} />
                <FieldRow label="Production Date" value={mo.productionDate ? fmtDateStr(mo.productionDate) : undefined} />
                <FieldRow label="Input Source" value={mo.inputSource || undefined} />
                <FieldRow label="Shift Start" value={mo.shiftStart || undefined} />
                <FieldRow label="Shift End" value={mo.shiftEnd || undefined} />
                <FieldRow label="Actual Production Hours" value={mo.actualHours ? `${mo.actualHours} hrs` : undefined} mono />
                <FieldRow label="Down Time" value={mo.downTimeMinutes ? `${mo.downTimeMinutes} min` : undefined} mono color={mo.downTimeMinutes ? C.amber : undefined} />
                <FieldRow label="Planned Qty" value={`${fmtQty(mo.productQty)} ${mo.uom?.name || ""}`} mono />
                <FieldRow label="Qty Produced" value={`${fmtQty(mo.qtyProduced)} ${mo.uom?.name || ""}`} mono color={C.forest} />
                <NotesBox label="General Notes" text={mo.notes} />
              </>
            )}
          </Card>

          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Output Summary — Bales by Grade</div>
            {editing ? (
              <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { field: "x_studio_no_produced_supreme_bales", label: "Supreme" },
                  { field: "no_produced_premium_bales", label: "Premium" },
                  { field: "no_produced_grade_1_bales", label: "Grade 1" },
                  { field: "no_produced_fair_grade_bales", label: "Fair Grade" },
                  { field: "x_studio_no_produced_fairgrade_3_bales", label: "Fair Grade 3" },
                  { field: "no_produced_alfamix_bales", label: "Alfamix" },
                  { field: "no_produced_mix_grass_bales", label: "Mix Grass" },
                  { field: "no_produced_wheat_straw_bales", label: "Wheat Straw" },
                ].map(b => (
                  <div key={b.field}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>{b.label}</div>
                    <input type="number" min="0" value={ef(b.field) || ""} onChange={e => setEf(b.field, parseInt(e.target.value) || 0)} style={inputStyle} />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {[
                  { label: "Supreme", count: mo.bales?.supreme, color: "#6B21A8" },
                  { label: "Premium", count: mo.bales?.premium, color: C.forest },
                  { label: "Grade 1", count: mo.bales?.grade1, color: C.sage },
                  { label: "Fair Grade", count: mo.bales?.fair, color: C.amber },
                  { label: "Fair Grade 3", count: mo.bales?.fairGrade3, color: "#B45309" },
                  { label: "Alfamix", count: mo.bales?.alfamix, color: C.terra },
                  { label: "Mix Grass", count: mo.bales?.mixGrass, color: "#059669" },
                  { label: "Wheat Straw", count: mo.bales?.wheatStraw, color: "#D97706" },
                ].map(b => (
                  <div key={b.label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "5px 0", borderBottom: `1px solid ${C.border}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: b.color }} />
                      <span style={{ fontSize: 10, color: C.dark, fontWeight: 500 }}>{b.label}</span>
                    </div>
                    <span style={{
                      fontSize: 11.5, fontWeight: 600, fontFamily: MONO,
                      color: (b.count || 0) > 0 ? C.dark : C.muted,
                    }}>{fmt(b.count || 0)}</span>
                  </div>
                ))}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", marginTop: 4, borderTop: `2px solid ${C.forest}`,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.forest }}>Total Bales</span>
                  <span style={{ fontSize: 14, fontWeight: 800, fontFamily: MONO, color: C.forest }}>{fmt(totalBales)}</span>
                </div>
              </>
            )}
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Incentive Card */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Incentive & Flags</div>
              {editing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11 }}>
                    <input type="checkbox" checked={ef("x_studio_incentive_cancelled")} onChange={e => setEf("x_studio_incentive_cancelled", e.target.checked)} style={{ width: 14, height: 14, accentColor: C.red }} />
                    <span style={{ fontWeight: 600, color: ef("x_studio_incentive_cancelled") ? C.red : C.dark }}>Incentive Cancelled</span>
                  </label>
                  {ef("x_studio_incentive_cancelled") && (
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Cancellation Details</div>
                      <textarea value={ef("x_studio_incentive_cancelation_details")} onChange={e => setEf("x_studio_incentive_cancelation_details", e.target.value)} style={{ ...inputStyle, minHeight: 40, resize: "vertical" }} />
                    </div>
                  )}
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11 }}>
                    <input type="checkbox" checked={ef("x_studio_facility_manager_attended")} onChange={e => setEf("x_studio_facility_manager_attended", e.target.checked)} style={{ width: 14, height: 14, accentColor: C.forest }} />
                    <span style={{ fontWeight: 600, color: C.dark }}>Facility Manager Attended</span>
                  </label>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Priority</div>
                    <select value={ef("priority")} onChange={e => setEf("priority", e.target.value)} style={inputStyle}>
                      <option value="0">Normal</option>
                      <option value="1">Urgent</option>
                    </select>
                  </div>
                </div>
              ) : (
                <>
                  <BoolRow label="Incentive Cancelled" value={mo.incentiveCancelled} />
                  {mo.incentiveCancelled && mo.incentiveCancelDetails && (
                    <NotesBox label="Cancellation Details" text={mo.incentiveCancelDetails} />
                  )}
                  <BoolRow label="Equipment Failure" value={mo.equipmentFailure} />
                  <BoolRow label="Facility Manager Attended" value={mo.facilityManagerAttended} />
                  <FieldRow label="Priority" value={mo.priority === "1" ? "Urgent" : "Normal"} color={mo.priority === "1" ? C.red : undefined} />
                </>
              )}
            </Card>

            {/* Dates & System Info Card */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>System Info</div>
              <FieldRow label="Date Start" value={mo.dateStart ? fmtDateStr(mo.dateStart) : undefined} />
              <FieldRow label="Date Finished" value={mo.dateFinished ? fmtDateStr(mo.dateFinished) : undefined} />
              <FieldRow label="Deadline" value={mo.dateDeadline ? fmtDateStr(mo.dateDeadline) : undefined} />
              <FieldRow label="State" value={stateLabel} color={stateColor} />
              <FieldRow label="Responsible" value={mo.responsibleUser?.name} />
              <FieldRow label="Source" value={mo.origin || undefined} mono />
              <FieldRow label="Source Location" value={mo.locationSrc?.name} />
              <FieldRow label="Output Production Location" value={mo.locationDest?.name} />
            </Card>
          </div>

          {/* Production Documents — Odoo Binary Fields (same style as shipments) */}
          <div style={{ gridColumn: "1 / -1" }}>
            <Card p={0}>
              <CardHdr><CHT>Production Documents</CHT><CHB>{MO_DOCS.filter(d => uploadedFiles[`mo-${d.field}`]).length}/{MO_DOCS.length}</CHB></CardHdr>
              <div style={{ padding: 12 }}>
                <Bar v={MO_DOCS.filter(d => uploadedFiles[`mo-${d.field}`]).length} max={MO_DOCS.length} color={C.forest} />
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 10 }}>
                  {MO_DOCS.map(doc => {
                    const hasFile = uploadedFiles[`mo-${doc.field}`];
                    return (
                      <div key={doc.field} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "5px 8px",
                        borderRadius: 5, background: hasFile ? C.gBg : "transparent",
                      }}>
                        <span style={{ fontSize: 12 }}>{hasFile ? "✅" : "⬜"}</span>
                        <span style={{ fontSize: 10.5, color: hasFile ? C.dark : C.muted, flex: 1, fontWeight: hasFile ? 500 : 400 }}>
                          {doc.label}
                        </span>
                        <div style={{ display: "flex", gap: 4 }}>
                          {hasFile && (
                            <button
                              onClick={() => handleFilePreview(doc.field, doc.label)}
                              style={{
                                background: C.gBg2, border: `1px solid ${C.gBdr2}`,
                                borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 600,
                                color: C.forest, cursor: "pointer", fontFamily: FONT,
                              }}
                            >Preview</button>
                          )}
                          <button
                            disabled={uploadMOFileMutation.isPending}
                            onClick={() => handleFileUpload(doc.field)}
                            style={{
                              background: C.gBg2, border: `1px solid ${C.gBdr2}`,
                              borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 600,
                              color: C.forest, cursor: uploadMOFileMutation.isPending ? "wait" : "pointer",
                              fontFamily: FONT, opacity: uploadMOFileMutation.isPending ? 0.6 : 1,
                            }}
                          >{uploadMOFileMutation.isPending ? "..." : hasFile ? "Replace" : "Upload"}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ═══ INPUT / OUTPUT TAB ═══ */}
      {tab === "io" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          {/* Raw Materials (Inputs) */}
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Raw Materials (Inputs)</div>
            {mo.rawMaterials.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", color: C.muted, fontSize: 11 }}>No raw material moves found</div>
            ) : (
              <div className="mob-table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: FONT }}>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th>Source Location</Th>
                    <Th>Destination</Th>
                    <Th right>Demand</Th>
                    <Th right>Done</Th>
                    <Th>UoM</Th>
                    <Th>State</Th>
                  </tr>
                </thead>
                <tbody>
                  {mo.rawMaterials.map(m => (
                    <tr key={m.id}>
                      <Td accent>{m.product?.name || "\u2014"}</Td>
                      <Td>{m.locationSrc?.name || "\u2014"}</Td>
                      <Td>{m.locationDest?.name || "\u2014"}</Td>
                      <Td right mono>{fmtQty(m.demandQty)}</Td>
                      <Td right mono>{fmtQty(m.doneQty)}</Td>
                      <Td>{m.uom?.name || "\u2014"}</Td>
                      <Td>
                        <Badge v={m.state === "done" ? "green" : m.state === "assigned" ? "amber" : "default"}>
                          {m.state === "done" ? "Done" : m.state === "assigned" ? "Ready" : m.state}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </Card>

          {/* Finished Products (Outputs) */}
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Finished Products (Outputs)</div>
            {mo.finishedProducts.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", color: C.muted, fontSize: 11 }}>No finished product moves found</div>
            ) : (
              <div className="mob-table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: FONT }}>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th>Source Location</Th>
                    <Th>Destination</Th>
                    <Th right>Demand</Th>
                    <Th right>Done</Th>
                    <Th>UoM</Th>
                    <Th>State</Th>
                  </tr>
                </thead>
                <tbody>
                  {mo.finishedProducts.map(m => (
                    <tr key={m.id}>
                      <Td accent>{m.product?.name || "\u2014"}</Td>
                      <Td>{m.locationSrc?.name || "\u2014"}</Td>
                      <Td>{m.locationDest?.name || "\u2014"}</Td>
                      <Td right mono>{fmtQty(m.demandQty)}</Td>
                      <Td right mono>{fmtQty(m.doneQty)}</Td>
                      <Td>{m.uom?.name || "\u2014"}</Td>
                      <Td>
                        <Badge v={m.state === "done" ? "green" : m.state === "assigned" ? "amber" : "default"}>
                          {m.state === "done" ? "Done" : m.state === "assigned" ? "Ready" : m.state}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </Card>

          {/* I/O Documents — same Odoo binary field section */}
        </div>
      )}

      {/* ═══ QUALITY TAB ═══ */}
      {tab === "quality" && (
        <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Input Product Quality</div>
            {editing ? (
              <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Quality Grade</div>
                  <select value={ef("input_product_quality_grade")} onChange={e => setEf("input_product_quality_grade", e.target.value)} style={inputStyle}>
                    <option value="">Select...</option>
                    {INPUT_QUALITY_GRADES.map(g => (
                      <option key={g.id} value={g.id}>{g.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Avg Input Bale Weight (kg)</div>
                  <input type="number" step="0.1" value={ef("average_input_big_bale_weight_kg") || ""} onChange={e => setEf("average_input_big_bale_weight_kg", parseFloat(e.target.value) || 0)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, padding: "4px 0" }}>
                    <input type="checkbox" checked={ef("input_product_contain_grasses")} onChange={e => setEf("input_product_contain_grasses", e.target.checked)} style={{ width: 14, height: 14, accentColor: C.forest }} />
                    Contains Grasses
                  </label>
                </div>
                {ef("input_product_contain_grasses") && (
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Grasses %</div>
                    <input type="number" step="0.1" value={ef("percentage_grasses_input_product") || ""} onChange={e => setEf("percentage_grasses_input_product", parseFloat(e.target.value) || 0)} style={inputStyle} />
                  </div>
                )}
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, padding: "4px 0" }}>
                    <input type="checkbox" checked={ef("input_product_contain_high_moisture")} onChange={e => setEf("input_product_contain_high_moisture", e.target.checked)} style={{ width: 14, height: 14, accentColor: C.forest }} />
                    Contains High Moisture
                  </label>
                </div>
                {ef("input_product_contain_high_moisture") && (
                  <>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>High Moisture Big Bales</div>
                      <input type="number" value={ef("number_high_moisture_big_bales") || ""} onChange={e => setEf("number_high_moisture_big_bales", parseInt(e.target.value) || 0)} style={inputStyle} />
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>High Moisture Small Bales (tons)</div>
                      <input type="number" step="0.01" value={ef("number_high_moisture_small_bales_tons") || ""} onChange={e => setEf("number_high_moisture_small_bales_tons", parseFloat(e.target.value) || 0)} style={inputStyle} />
                    </div>
                  </>
                )}
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Input Quality Notes</div>
                  <textarea value={ef("input_product_quality_observations")} onChange={e => setEf("input_product_quality_observations", e.target.value)} style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} />
                </div>
              </div>
            ) : (
              <>
                <FieldRow label="Input Source" value={mo.inputSource || undefined} />
                <FieldRow label="Quality Grade" value={mo.inputQualityGrade?.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())} color={
                  mo.inputQualityGrade === "premium" ? C.forest :
                  mo.inputQualityGrade === "grade_1" ? C.sage :
                  mo.inputQualityGrade === "poor" ? C.red : C.dark
                } />
                <FieldRow label="Avg Input Bale Weight" value={mo.avgInputBaleWeight ? `${mo.avgInputBaleWeight} kg` : undefined} mono />
                <BoolRow label="Contains Grasses" value={mo.containsGrasses} />
                {mo.containsGrasses && <FieldRow label="Grasses %" value={mo.grassesPercentage ? `${mo.grassesPercentage}%` : undefined} mono />}
                <BoolRow label="Contains High Moisture" value={mo.containsHighMoisture} />
                {mo.containsHighMoisture && (
                  <>
                    <FieldRow label="High Moisture Big Bales" value={mo.highMoistureBigBales} mono />
                    <FieldRow label="High Moisture Small Bales (tons)" value={mo.highMoistureSmallBalesTons} mono />
                  </>
                )}
                <NotesBox label="Input Quality Notes" text={mo.inputQualityNotes} />
              </>
            )}
          </Card>

          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Output Product Quality</div>
            {editing ? (
              <div>
                <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Output Quality Notes</div>
                <textarea value={ef("output_product_quality_observations")} onChange={e => setEf("output_product_quality_observations", e.target.value)} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} />
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Quality Observations Notes</div>
                  <textarea value={ef("quality_observations_notes")} onChange={e => setEf("quality_observations_notes", e.target.value)} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} />
                </div>
              </div>
            ) : (
              <>
                <NotesBox label="Output Quality Notes" text={mo.outputQualityNotes} />
                <NotesBox label="Quality Observations" text={mo.qualityNotes} />
                {!mo.outputQualityNotes && !mo.qualityNotes && (
                  <div style={{ padding: 16, textAlign: "center", color: C.muted, fontSize: 11 }}>No quality notes recorded</div>
                )}
              </>
            )}
          </Card>

          {/* Quality Documents — same Odoo binary field section */}
        </div>
      )}

      {/* ═══ WORKFORCE TAB ═══ */}
      {tab === "workforce" && (
        <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13 }}>👷</span> Production Team
            </div>
            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <Lbl>Supervisors</Lbl>
                  <OdooMultiSelect
                    value={teamEdit.supervisors}
                    onChange={(v) => setTeamEdit(p => ({ ...p, supervisors: v }))}
                    options={employeeOptions.map(e => ({ id: e.id, name: e.name }))}
                    onSearch={setEmployeeSearch}
                    isLoading={employeesLoading}
                    placeholder="Search supervisors..."
                  />
                </div>
                <div>
                  <Lbl>Production Labors</Lbl>
                  <OdooMultiSelect
                    value={teamEdit.productionLabors}
                    onChange={(v) => setTeamEdit(p => ({ ...p, productionLabors: v }))}
                    options={employeeOptions.map(e => ({ id: e.id, name: e.name }))}
                    onSearch={setEmployeeSearch}
                    isLoading={employeesLoading}
                    placeholder="Search production labors..."
                  />
                </div>
                <div>
                  <Lbl>Drivers</Lbl>
                  <OdooMultiSelect
                    value={teamEdit.drivers}
                    onChange={(v) => setTeamEdit(p => ({ ...p, drivers: v }))}
                    options={employeeOptions.map(e => ({ id: e.id, name: e.name }))}
                    onSearch={setEmployeeSearch}
                    isLoading={employeesLoading}
                    placeholder="Search drivers..."
                  />
                </div>
                <div>
                  <Lbl>General Labors</Lbl>
                  <OdooMultiSelect
                    value={teamEdit.labors}
                    onChange={(v) => setTeamEdit(p => ({ ...p, labors: v }))}
                    options={employeeOptions.map(e => ({ id: e.id, name: e.name }))}
                    onSearch={setEmployeeSearch}
                    isLoading={employeesLoading}
                    placeholder="Search labors..."
                  />
                </div>
              </div>
            ) : (
              <>
                <EmpList label="Supervisors" employees={mo.supervisors} />
                <EmpList label="Production Labors" employees={mo.productionLabors} />
                <EmpList label="Drivers" employees={mo.drivers} />
                <EmpList label="General Labors" employees={mo.labors} />
              </>
            )}
          </Card>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13 }}>🔍</span> Quality Team
            </div>
            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <Lbl>Quality Supervisors</Lbl>
                  <OdooMultiSelect
                    value={teamEdit.qualitySupervisors}
                    onChange={(v) => setTeamEdit(p => ({ ...p, qualitySupervisors: v }))}
                    options={employeeOptions.map(e => ({ id: e.id, name: e.name }))}
                    onSearch={setEmployeeSearch}
                    isLoading={employeesLoading}
                    placeholder="Search quality supervisors..."
                  />
                </div>
                <div>
                  <Lbl>Quality Labors</Lbl>
                  <OdooMultiSelect
                    value={teamEdit.qualityLabors}
                    onChange={(v) => setTeamEdit(p => ({ ...p, qualityLabors: v }))}
                    options={employeeOptions.map(e => ({ id: e.id, name: e.name }))}
                    onSearch={setEmployeeSearch}
                    isLoading={employeesLoading}
                    placeholder="Search quality labors..."
                  />
                </div>
                <div>
                  <Lbl>Loading Drivers</Lbl>
                  <OdooMultiSelect
                    value={teamEdit.loadingDrivers}
                    onChange={(v) => setTeamEdit(p => ({ ...p, loadingDrivers: v }))}
                    options={employeeOptions.map(e => ({ id: e.id, name: e.name }))}
                    onSearch={setEmployeeSearch}
                    isLoading={employeesLoading}
                    placeholder="Search loading drivers..."
                  />
                </div>
              </div>
            ) : (
              <>
                <FieldRow label="Quality Supervisor" value={mo.qualitySupervisor?.name} />
                <EmpList label="Quality Supervisors" employees={mo.qualitySupervisors} />
                <EmpList label="Quality Labors" employees={mo.qualityLabors} />
                <EmpList label="Loading Drivers" employees={mo.loadingDrivers} />
              </>
            )}
          </Card>

          {/* Workforce Documents — same Odoo binary field section */}
        </div>
      )}

      {/* ═══ MACHINE TAB ═══ */}
      {tab === "machine" && (
        <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Baling Machine Monitoring</div>
            {editing ? (
              <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Oil Measurements</div>
                  <input type="number" value={ef("no_oil_measurements_during_shift") || ""} onChange={e => setEf("no_oil_measurements_during_shift", parseInt(e.target.value) || 0)} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Max Oil Temperature (°C)</div>
                  <input type="number" step="0.1" value={ef("maximum_oil_temperature") || ""} onChange={e => setEf("maximum_oil_temperature", parseFloat(e.target.value) || 0)} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Max Oil Pressure (bar)</div>
                  <input type="number" step="0.1" value={ef("maximum_oil_pressure") || ""} onChange={e => setEf("maximum_oil_pressure", parseFloat(e.target.value) || 0)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, padding: "4px 0" }}>
                    <input type="checkbox" checked={ef("is_there_equipment_failure")} onChange={e => setEf("is_there_equipment_failure", e.target.checked)} style={{ width: 14, height: 14, accentColor: C.red }} />
                    Equipment Failure
                  </label>
                </div>
                {ef("is_there_equipment_failure") && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Failure Reason</div>
                    <select value={ef("equipment_failure_reason")} onChange={e => setEf("equipment_failure_reason", e.target.value)} style={inputStyle}>
                      <option value="">Select reason...</option>
                      {EQUIPMENT_FAILURE_REASONS.filter(r => r.id !== "no_problem").map(r => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Machine Notes</div>
                  <textarea value={ef("baling_monitoring_notes")} onChange={e => setEf("baling_monitoring_notes", e.target.value)} style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} />
                </div>
              </div>
            ) : (
              <>
                <FieldRow label="Oil Measurements During Shift" value={mo.oilMeasurements} mono />
                <FieldRow label="Max Oil Temperature" value={mo.maxOilTemperature ? `${mo.maxOilTemperature} °C` : undefined} mono color={
                  (mo.maxOilTemperature || 0) > 80 ? C.red : (mo.maxOilTemperature || 0) > 60 ? C.amber : C.dark
                } />
                <FieldRow label="Max Oil Pressure" value={mo.maxOilPressure ? `${mo.maxOilPressure} bar` : undefined} mono color={
                  (mo.maxOilPressure || 0) > 250 ? C.red : (mo.maxOilPressure || 0) > 200 ? C.amber : C.dark
                } />
                <BoolRow label="Equipment Failure" value={mo.equipmentFailure} />
                {mo.equipmentFailure && <NotesBox label="Failure Reason" text={mo.failureReason} />}
                <NotesBox label="Machine Notes" text={mo.machineNotes} />
              </>
            )}
          </Card>

          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Machine Performance Summary</div>
            <div style={{
              padding: 12, background: C.gBg, borderRadius: 8, border: `1px solid ${C.gBdr}`,
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 8, color: C.sage, fontWeight: 600, textTransform: "uppercase" }}>Oil Temp</div>
                <div style={{
                  fontSize: 20, fontWeight: 800, fontFamily: MONO,
                  color: (mo.maxOilTemperature || 0) > 80 ? C.red : (mo.maxOilTemperature || 0) > 60 ? C.amber : C.forest,
                }}>{mo.maxOilTemperature || "—"}<span style={{ fontSize: 10, fontWeight: 500 }}>°C</span></div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 8, color: C.sage, fontWeight: 600, textTransform: "uppercase" }}>Oil Pressure</div>
                <div style={{
                  fontSize: 20, fontWeight: 800, fontFamily: MONO,
                  color: (mo.maxOilPressure || 0) > 250 ? C.red : (mo.maxOilPressure || 0) > 200 ? C.amber : C.forest,
                }}>{mo.maxOilPressure || "—"}<span style={{ fontSize: 10, fontWeight: 500 }}>bar</span></div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 8, color: C.sage, fontWeight: 600, textTransform: "uppercase" }}>Production Hours</div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: MONO, color: C.forest }}>{mo.actualHours || "—"}<span style={{ fontSize: 10, fontWeight: 500 }}>hrs</span></div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 8, color: C.sage, fontWeight: 600, textTransform: "uppercase" }}>Down Time</div>
                <div style={{
                  fontSize: 20, fontWeight: 800, fontFamily: MONO,
                  color: (mo.downTimeMinutes || 0) > 30 ? C.red : (mo.downTimeMinutes || 0) > 15 ? C.amber : C.forest,
                }}>{mo.downTimeMinutes || "—"}<span style={{ fontSize: 10, fontWeight: 500 }}>min</span></div>
              </div>
            </div>
          </Card>

          {/* Machine Documents — same Odoo binary field section */}
        </div>
      )}

      {/* ═══ DIESEL & MATERIALS TAB ═══ */}
      {tab === "diesel" && (
        <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Diesel & Consumables</div>
            {editing ? (
              <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Diesel Consumption (L)</div>
                  <input type="number" step="0.1" value={ef("diesel_consumption_liters") || ""} onChange={e => setEf("diesel_consumption_liters", parseFloat(e.target.value) || 0)} style={inputStyle} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2 }}>Notes</div>
                  <textarea value={ef("diesel_materials_consumption_notes")} onChange={e => setEf("diesel_materials_consumption_notes", e.target.value)} style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} />
                </div>
              </div>
            ) : (
              <>
                <FieldRow label="Diesel Consumption" value={mo.dieselLiters ? `${fmt(mo.dieselLiters)} liters` : undefined} mono color={C.terra} />
                <NotesBox label="Diesel Notes" text={mo.dieselNotes} />
              </>
            )}
          </Card>

          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Diesel Summary</div>
            <div style={{
              padding: 16, background: C.gBg, borderRadius: 8, border: `1px solid ${C.gBdr}`,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 8, color: C.sage, fontWeight: 600, textTransform: "uppercase" }}>Diesel Consumed</div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: MONO, color: C.terra, marginTop: 4 }}>{mo.dieselLiters ? fmt(mo.dieselLiters) : "—"}<span style={{ fontSize: 12, fontWeight: 500 }}> L</span></div>
            </div>
            {mo.actualHours && mo.dieselLiters ? (
              <div style={{ marginTop: 8, padding: "6px 10px", background: C.gBg2, borderRadius: 6, border: `1px solid ${C.gBdr}`, textAlign: "center" }}>
                <span style={{ fontSize: 10, color: C.sage, fontWeight: 600 }}>Diesel per Hour: </span>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO, color: C.terra }}>
                  {(mo.dieselLiters / mo.actualHours).toFixed(1)} L/hr
                </span>
              </div>
            ) : null}
            {mo.qtyProduced && mo.dieselLiters ? (
              <div style={{ marginTop: 4, padding: "6px 10px", background: C.gBg2, borderRadius: 6, border: `1px solid ${C.gBdr}`, textAlign: "center" }}>
                <span style={{ fontSize: 10, color: C.sage, fontWeight: 600 }}>Diesel per Ton: </span>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO, color: C.terra }}>
                  {(mo.dieselLiters / (mo.qtyProduced / 1000)).toFixed(1)} L/T
                </span>
              </div>
            ) : null}
          </Card>

          {/* Diesel Documents — same Odoo binary field section */}
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleStateAction}
        title={
          confirmAction === "confirm" ? "Confirm Production Order?" :
          confirmAction === "done" ? "Mark as Done?" :
          "Cancel Production Order?"
        }
        confirmLabel={
          confirmAction === "confirm" ? "Yes, Confirm" :
          confirmAction === "done" ? "Yes, Mark Done" :
          "Yes, Cancel Order"
        }
        cancelLabel="Go Back"
        message={
          <div style={{ fontSize: 11, color: C.dark, lineHeight: 1.5 }}>
            {confirmAction === "confirm" && "This will confirm the production order and move it to 'In Progress'. Raw materials will be reserved."}
            {confirmAction === "done" && "This will mark the order as Done. Stock moves will be validated and inventory will be updated."}
            {confirmAction === "cancel" && "This will cancel the production order. This action may not be reversible."}
          </div>
        }
      />

      {/* File Preview Modal — same as shipments */}
      {previewFile && (
        <FilePreviewModal
          base64Content={previewFile.base64}
          label={previewFile.label}
          loading={previewLoading}
          onClose={() => setPreviewFile(null)}
          onReplace={() => {
            if (previewReplaceRef.current) previewReplaceRef.current();
          }}
        />
      )}
    </div>
  );
}
