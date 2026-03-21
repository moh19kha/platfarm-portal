// ══════════════════════════════════════════════════════════════════════════════
// ODOO SHIP DETAIL — Platfarm V3 — Purchase Order detail with loads from Odoo
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from "react";
import { C, MONO, FONT, fmt, fmtQty, fmtDateStr, companyFromShipmentName } from "@/lib/data";
import { Badge, Bar, Btn, Card, CardHdr, CHT, CHB, Lbl, Val, FieldRow, QCRow, TabButton, Th, Td } from "@/components/ui-primitives";
import { trpc } from "@/lib/trpc";
import { OdooVesselRoute } from "@/components/OdooVesselRoute";
import { OdooStageTimeline } from "@/components/OdooStageTimeline";
import { OdooSearchSelect } from "@/components/OdooSearchSelect";
import { OdooMultiSelect } from "@/components/OdooMultiSelect";
import { FreeDaysBadge } from "@/components/FreeDaysBadge";
import { TopProgressBar, DetailPageSkeleton, InlineSpinner, MutationProgressBar } from "@/components/LoadingIndicators";
import { PO_STATE_LABELS as STATE_LABELS, PICKING_STATE_LABELS, PICKING_STATE_BADGE } from "@/lib/stateLabels";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { toast } from "sonner";

// ─── Payment Schedule Card ─────────────────────────────────────────────────
function PaymentScheduleCard({ termId, totalAmount, currency }: { termId: number; totalAmount: number; currency: string }) {
  const { data: lines, isLoading } = trpc.shipments.paymentTermLines.useQuery({ termId });
  if (isLoading) return <Card><div style={{ fontSize: 10, color: C.muted, padding: 8 }}>Loading payment schedule...</div></Card>;
  if (!lines || lines.length === 0) return null;
  const delayLabel = (d: string) => {
    if (d === "days_after") return "days after invoice";
    if (d === "days_after_end_of_next_month") return "days after end of next month";
    if (d === "days_after_end_of_month") return "days after end of month";
    return d.replace(/_/g, " ");
  };
  return (
    <Card>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 10 }}>Payment Schedule</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: FONT }}>
        <thead>
          <tr>
            <Th>Installment</Th>
            <Th right>%</Th>
            <Th right>Amount</Th>
            <Th>Due</Th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const pct = line.valueAmount;
            const amt = totalAmount > 0 ? (totalAmount * pct / 100) : 0;
            const dueText = line.nbDays === 0 ? "Immediate" : `${line.nbDays} ${delayLabel(line.delayType)}`;
            return (
              <tr key={line.id}>
                <Td accent>Payment {i + 1}</Td>
                <Td right mono accent>{pct}%</Td>
                <Td right mono>{currency} {fmt(amt)}</Td>
                <Td>{dueText}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

interface OdooShipDetailProps {
  shipmentId: number;
  onBack: () => void;
  onNavigateToShipment?: (type: "purchase" | "sales", nameOrId: string, currentShipmentName?: string) => void;
  sourceShipment?: { type: "purchase" | "sales"; id: number; name: string } | null;
  onNavigateBack?: () => void;
}

export function OdooShipDetail({ shipmentId, onBack, onNavigateToShipment, sourceShipment, onNavigateBack }: OdooShipDetailProps) {
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, any>>({});
  const [selectedLoadId, setSelectedLoadId] = useState<number | null>(null);
  const [loadTab, setLoadTab] = useState("overview");
  const [loadEditing, setLoadEditing] = useState(false);
  const [loadEditFields, setLoadEditFields] = useState<Record<string, any>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, boolean>>({});
  const [updatingStage, setUpdatingStage] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [partnerSearch, setPartnerSearch] = useState("");
  const [loadEmployeeSearch, setLoadEmployeeSearch] = useState("");
  // Receiving Team edit state
  const [loadTeamEdit, setLoadTeamEdit] = useState<{
    qualitySupervisorIds: { id: number; name: string }[];
    loadingDriverIds: { id: number; name: string }[];
    laborIds: { id: number; name: string }[];
  }>({ qualitySupervisorIds: [], loadingDriverIds: [], laborIds: [] });
  const [redistributingWeight, setRedistributingWeight] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ label: string; base64: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewReplaceRef = useRef<(() => void) | null>(null);

  // Invoices query - must be at top level (not inside conditional render) to avoid React hooks error #310
  const invoicesQuery = trpc.shipments.invoices.useQuery(
    { orderId: shipmentId },
    { enabled: true }
  );

  // Grade options from Odoo (cached, fetched once)
  const { data: gradeOptions } = trpc.shipments.gradeOptions.useQuery(undefined, { staleTime: 300_000 });
  const loadedGradeOpts = gradeOptions?.loadedGrade || [];
  const receivedGradeOpts = gradeOptions?.overallReceivedGrade || [];

  const utils = trpc.useUtils();
  const { data: shipment, isLoading, error } = trpc.shipments.getById.useQuery(
    { id: shipmentId },
    { staleTime: 15_000 }
  );

  const updateMutation = trpc.shipments.update.useMutation({
    onSuccess: () => {
      utils.shipments.getById.invalidate({ id: shipmentId });
      utils.shipments.list.invalidate();
      setEditing(false);
      setEditFields({});
    },
  });

  const updatePickingMutation = trpc.shipments.updatePicking.useMutation({
    onSuccess: () => {
      utils.shipments.getById.invalidate({ id: shipmentId });
      setLoadEditing(false);
      setLoadEditFields({});
    },
  });

  const redistributeWeightMutation = trpc.shipments.redistributeWeight.useMutation({
    onSuccess: () => {
      utils.shipments.getById.invalidate({ id: shipmentId });
      setRedistributingWeight(false);
    },
    onError: () => {
      setRedistributingWeight(false);
    },
  });

  // Search queries for Many2one fields
  const { data: employeeOptions = [], isLoading: employeesLoading } = trpc.shipments.employees.useQuery(
    { search: employeeSearch },
    { enabled: editing }
  );
  const { data: partnerOptions = [], isLoading: partnersLoading } = trpc.shipments.partners.useQuery(
    { search: partnerSearch },
    { enabled: editing }
  );
  // Employee search for Receiving Team multi-select (enabled when load editing)
  const { data: loadEmployeeOptions = [], isLoading: loadEmployeesLoading } = trpc.shipments.employees.useQuery(
    { search: loadEmployeeSearch },
    { enabled: loadEditing }
  );

  const uploadPOFileMutation = trpc.shipments.uploadPOFile.useMutation({
    onSuccess: () => {
      utils.shipments.getById.invalidate({ id: shipmentId });
      utils.shipments.poFileStatus.invalidate({ poId: shipmentId });
    },
  });

  const uploadPickingFileMutation = trpc.shipments.uploadPickingFile.useMutation({
    onSuccess: () => {
      utils.shipments.getById.invalidate({ id: shipmentId });
      if (selectedLoadId) {
        utils.shipments.pickingFileStatus.invalidate({ pickingId: selectedLoadId });
      }
    },
  });

  // ─── Hard Copy Tracking ─────────────────────────────────────────────
  const { data: hardCopyStatuses } = trpc.documents.getHardCopyStatuses.useQuery(
    { odooOrderId: Number(shipmentId), orderType: "purchase" },
    { staleTime: 30_000 }
  );
  const [togglingHardCopyField, setTogglingHardCopyField] = useState<string | null>(null);
  const toggleHardCopyMutation = trpc.documents.toggleHardCopy.useMutation({
    onSuccess: async (_data, variables) => {
      await utils.documents.getHardCopyStatuses.invalidate({ odooOrderId: Number(shipmentId), orderType: "purchase" });
      setTogglingHardCopyField(null);
      toast(
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: variables.received ? C.forest : C.amber }}>{variables.received ? "✓" : "○"}</span>
          <span style={{ fontSize: 12, color: C.dark }}>{variables.received ? "Hard copy marked as received" : "Hard copy marked as not received"}</span>
        </div>,
        {
          duration: 2000,
          style: {
            fontFamily: "'DM Sans', system-ui, sans-serif",
            border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${variables.received ? C.forest : C.amber}`,
            background: C.card,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          },
        }
      );
    },
    onError: (err) => {
      setTogglingHardCopyField(null);
      toast(
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>Failed to update hard copy status</span>
          <span style={{ fontSize: 10, color: C.gray }}>{err.message}</span>
        </div>,
        {
          duration: 3000,
          style: {
            fontFamily: "'DM Sans', system-ui, sans-serif",
            border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${C.terra}`,
            background: C.card,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          },
        }
      );
    },
  });

  // ─── Telex Release / BL Issued Toggle ───────────────────────────────────────────
  const telexToggleMut = trpc.documents.toggleTelexBLIssued.useMutation({
    onSuccess: () => {
      utils.shipments.getById.invalidate({ id: Number(shipmentId) });
      utils.documents.getHardCopySummary.invalidate();
    },
  });

  // ─── Fetch existing file status from Odoo ─────────────────────────────
  const { data: poFileStatus } = trpc.shipments.poFileStatus.useQuery(
    { poId: shipmentId },
    { staleTime: 30_000 }
  );

  const { data: pickingFileStatus } = trpc.shipments.pickingFileStatus.useQuery(
    { pickingId: selectedLoadId! },
    { enabled: !!selectedLoadId, staleTime: 30_000 }
  );

  // Initialize uploadedFiles from fetched file status
  useEffect(() => {
    if (poFileStatus) {
      setUploadedFiles(prev => {
        const next = { ...prev };
        for (const [field, hasFile] of Object.entries(poFileStatus)) {
          if (hasFile) next[`po-${field}`] = true;
        }
        return next;
      });
    }
  }, [poFileStatus]);

  useEffect(() => {
    // When switching loads or getting new file status, reset all picking-* keys
    // and only set the ones that actually have data
    setUploadedFiles(prev => {
      const next: Record<string, boolean> = {};
      // Keep all po-* keys
      for (const [k, v] of Object.entries(prev)) {
        if (k.startsWith("po-")) next[k] = v;
      }
      // Set picking-* keys from fresh status data
      if (pickingFileStatus) {
        for (const [field, hasFile] of Object.entries(pickingFileStatus)) {
          if (hasFile) next[`picking-${field}`] = true;
        }
      }
      return next;
    });
  }, [pickingFileStatus, selectedLoadId]);

  const startEdit = useCallback(() => {
    if (!shipment) return;
    setEditFields({
      x_studio_vessel_name: shipment.vesselName || "",
      x_studio_booking_number: shipment.bookingNumber || "",
      shipment_bl_number: shipment.blNumber || "",
      x_studio_tracking_number: shipment.trackingNumber || "",
      pol_source: shipment.portOfLoading || "",
      pod_source: shipment.portOfDestination || "",
      x_studio_etd_pol: shipment.etdPol || "",
      x_studio_eta_pol: shipment.etaPol || "",
      x_studio_shipment_date: shipment.shipmentDate || "",
      eta_arrival: shipment.etaArrival || "",
      x_studio_product_category: shipment.productCategory || "",
      freight_type: shipment.freightType || "",
      load_type: shipment.loadType || "",
      ocean_transporter_company: shipment.shippingLine || "",
      x_studio_unified_shipment_status: shipment.shipmentStatus || "",
      x_studio_total_free_days_demurrage_detention: shipment.freeDaysDemurrage || 0,
      x_studio_transit_time_days: shipment.transitTimeDays || 0,
      x_studio_vessel_cut_off: shipment.vesselCutOff || "",
      x_studio_rate_per_containerload: shipment.ratePerContainer || 0,
      x_studio_total_shipment_weight_in_tons_1: shipment.totalShipmentWeight || 0,
      x_studio_selling_price_per_ton: shipment.sellingPricePerTon || 0,
      x_studio_payment_status: shipment.paymentStatus || "",
      x_studio_shipment_documentation_status: shipment.docStatus || "",
      x_studio_shipment_acceptance_status: shipment.acceptanceStatus || "",
      x_studio_ultimate_customer: shipment.ultimateCustomer || "",
      number_of_loads: shipment.numberOfLoads || 0,
      _procurement_officer: shipment.procurementOfficer ? { id: shipment.procurementOfficer.id, name: shipment.procurementOfficer.name } : null,
      _clearance_agent: shipment.clearanceAgent && typeof shipment.clearanceAgent === 'object' ? { id: (shipment.clearanceAgent as any).id, name: (shipment.clearanceAgent as any).name } : null,
      _trucking_company: shipment.truckingCompany && typeof shipment.truckingCompany === 'object' ? { id: (shipment.truckingCompany as any).id, name: (shipment.truckingCompany as any).name } : null,
    });
    setEditing(true);
  }, [shipment]);

  const saveEdit = useCallback(() => {
    const cleaned: Record<string, any> = { id: shipmentId };
    Object.entries(editFields).forEach(([k, v]) => {
      // Skip internal fields prefixed with _
      if (k.startsWith("_")) return;
      if (v !== "" && v !== null && v !== undefined) cleaned[k] = v;
    });
    // Map Many2one search fields to their Odoo field IDs
    if (editFields._procurement_officer?.id) cleaned.x_studio_procurement_officer = editFields._procurement_officer.id;
    if (editFields._clearance_agent?.id) cleaned.local_clearance_agent = editFields._clearance_agent.id;
    if (editFields._trucking_company?.id) cleaned.local_trucking_company = editFields._trucking_company.id;
    updateMutation.mutate(cleaned as any);
  }, [editFields, shipmentId, updateMutation]);

  const startLoadEdit = useCallback((load: any) => {
    setLoadEditFields({
      x_studio_loadcontainer_number_1: load.containerNumber || "",
      x_studio_seal_number: load.sealNumber || "",
      x_studio_loading_date: load.loadingDate || "",
      x_studio_net_weight_in_tons: load.netWeightTons || 0,
      x_studio_quantity_in_tons: load.quantityTons || 0,
      x_studio_tare_weight_in_tons: load.tareWeightTons || 0,
      x_studio_number_of_balesbags: load.balesBags || "",
      x_studio_loading_store: load.loadingStore || "",
      x_studio_truck_load_serial_tl: load.truckLoadSerial || "",
      x_studio_loaded_grade: load.loadedGrade || "",
      x_studio_source: load.source || "",
      x_studio_purchasing_unit: load.purchasingUnit || "",
      x_studio_quality_score: load.qualityScore || 0,
      x_studio_moisture_: load.moisture || 0,
      x_studio_ndf_: load.ndf || 0,
      x_studio_adf_: load.adf || 0,
      x_studio_crude_protein_dry_matter_: load.crudeProtein || 0,
      x_studio_trucking_fee: load.truckingFee || 0,
      x_studio_trucking_fees: load.truckingFees || "",
      x_studio_trucking_cost_currency: load.truckingCostCurrency || "",
      x_studio_local_trucking_driver_contact: load.truckingDriverContact || "",
      x_studio_loadcontainer_cleanliness: load.containerCleanliness || false,
      x_studio_proper_loadcontainer_lashing: load.properLashing || false,
      x_studio_proper_loadcontainer_stacking: load.properStacking || false,
      x_studio_presence_of_truck_cover: load.truckCover || false,
      x_studio_payment_confirmation: load.paymentConfirmation || false,
      // Procurement (Source) tab
      x_studio_purchasing_unit_1: load.purchasingUnit1 || "",
      x_studio_agreed_product_price_per_unit_1: load.agreedPricePerUnit || 0,
      x_studio_farmfield_name: load.farmFieldName || "",
      x_studio_loaded_grade_1: load.loadedGrade1 || "",
      x_studio_driver_name: load.driverName || "",
      x_studio_driver_contact: load.driverContact || "",
      x_studio_agreed_trucking_cost: load.agreedTruckingCost || 0,
      x_studio_advance_payment_1: load.advancePayment || 0,
      x_studio_long_stay_cost: load.longStayCharges || 0,
      x_studio_loading_datetime: load.loadingDatetime || "",
      x_studio_loading_datetime_1: load.loadingDatetime1 || "",
      x_studio_purchase_currency: load.purchaseCurrency?.name || "",
      // Quality (Received) tab
      x_studio_premium_grade: load.premiumGrade || 0,
      x_studio_grade_1_: load.grade1Pct || 0,
      x_studio_standard_: load.standard || 0,
      x_studio_grade_3_: load.grade3Pct || 0,
      x_studio_overall_received_grade_as_per_quality_assessment: load.overallReceivedGrade || "",
      x_studio_overall_received_grade_as_per_quality_assessment_1: load.overallReceivedGrade1 || "",
      x_studio_total_number_of_received_bales: load.totalReceivedBales || 0,
      x_studio_brokendamaged_bales: load.brokenDamagedBales || 0,
      x_studio_bales_with_moisture_above_12: load.balesAbove12Moisture || 0,
      x_studio_gross_weight_in_tons: load.grossWeightTons || 0,
      x_studio_arrival_datetime: load.arrivalDatetime || "",
      // Quality visual checks
      x_studio_good_quality_green_color: load.goodQualityGreenColor || false,
      x_studio_good_quality_stem_size: load.goodQualityStemSize || false,
      x_studio_good_quality_good_leave_attachement: load.goodQualityLeaveAttachment || false,
      x_studio_good_quality_bale_ties: load.goodQualityBaleTies || false,
      x_studio_good_quality_uniformity_of_bale_shape: load.goodQualityBaleShape || false,
      x_studio_good_quality_absence_of_black_spots: load.goodQualityNoBlackSpots || false,
      x_studio_good_quality_absence_of_foreign_material: load.goodQualityNoForeignMaterial || false,
      x_studio_good_quality_absence_of_insects: load.goodQualityNoInsects || false,
      // Accepted load
      x_studio_accepted_rejected: load.acceptedRejected || false,
      // Commission/Deduction
      x_studio_is_there_commission: load.isThereCommission || false,
      x_studio_commissioned_person_1: load.commissionedPerson || "",
      x_studio_commission_currency: load.commissionCurrency || "",
      x_studio_commission_amount: load.commissionAmount || 0,
      x_studio_if_no_what_is_the_reason_for_no_commission: load.noCommissionReason || "",
      x_studio_is_there_deductionsclaim: load.isThereDeductionClaim || false,
      x_studio_claim_currency: load.claimCurrency || "",
      x_studio_claim_amount: load.claimAmount || 0,
      x_studio_claim_description: load.claimDescription || "",
      x_studio_claim_reason: load.claimReason || "",
      x_studio_deduction_amount: load.deductionAmount || 0,
    });
    // Initialize Receiving Team multi-select state
    setLoadTeamEdit({
      qualitySupervisorIds: load.qualitySupervisorIds || [],
      loadingDriverIds: load.loadingDriverIds || [],
      laborIds: load.laborIds || [],
    });
    setLoadEditing(true);
  }, []);

  const saveLoadEdit = useCallback(() => {
    if (!selectedLoadId) return;
    const cleaned: Record<string, any> = { id: selectedLoadId };
    Object.entries(loadEditFields).forEach(([k, v]) => {
      if (v !== "" && v !== null && v !== undefined) cleaned[k] = v;
    });
    // Include Receiving Team many2many fields (send as arrays of IDs)
    cleaned.quality_supervisor_ids = loadTeamEdit.qualitySupervisorIds.map(e => e.id);
    cleaned.loading_driver_ids = loadTeamEdit.loadingDriverIds.map(e => e.id);
    cleaned.labor_ids = loadTeamEdit.laborIds.map(e => e.id);
    updatePickingMutation.mutate(cleaned as any);
  }, [loadEditFields, selectedLoadId, updatePickingMutation, loadTeamEdit]);

  const handleFileUpload = useCallback(async (target: "po" | "picking", id: number, fieldName: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        const trackKey = `${target}-${fieldName}`;
        if (target === "po") {
          uploadPOFileMutation.mutate({ poId: id, fieldName, base64Content: base64 }, {
            onSuccess: () => {
              setUploadedFiles(prev => ({ ...prev, [trackKey]: true }));
              setPreviewFile(null);
            },
          });
        } else {
          uploadPickingFileMutation.mutate({ pickingId: id, fieldName, base64Content: base64 }, {
            onSuccess: () => {
              setUploadedFiles(prev => ({ ...prev, [trackKey]: true }));
              setPreviewFile(null);
            },
          });
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [uploadPOFileMutation, uploadPickingFileMutation]);

  const handleFilePreview = useCallback(async (target: "po" | "picking", id: number, fieldName: string, label: string) => {
    setPreviewLoading(true);
    setPreviewFile({ label, base64: "" });
    previewReplaceRef.current = () => handleFileUpload(target, id, fieldName);
    try {
      const input = target === "po"
        ? JSON.stringify({ "0": { json: { poId: id, fieldName } } })
        : JSON.stringify({ "0": { json: { pickingId: id, fieldName } } });
      const endpoint = target === "po" ? "shipments.readPOFile" : "shipments.readPickingFile";
      const res = await fetch(`/api/trpc/${endpoint}?batch=1&input=${encodeURIComponent(input)}`, { credentials: "include" });
      const json = await res.json();
      // tRPC batch response: [{result:{data:{json:{content:"..."}}}}]
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
  }, [handleFileUpload]);

  const inputStyle: React.CSSProperties = {
    padding: "4px 8px", border: `1px solid ${C.inputBdr}`, borderRadius: 5,
    fontSize: 11, fontFamily: MONO, outline: "none", width: "100%", background: C.gBg,
  };

  if (isLoading) {
    return (
      <>
        <TopProgressBar />
        <DetailPageSkeleton />
      </>
    );
  }

  if (error || !shipment) {
    return (
      <Card>
        <div style={{ padding: 24, textAlign: "center", color: C.red, fontSize: 12 }}>
          Failed to load shipment: {error?.message || "Not found"}
        </div>
      </Card>
    );
  }

  const selectedLoad = selectedLoadId ? shipment.pickings.find((p: any) => p.id === selectedLoadId) : null;

  // ─── LOAD DETAIL VIEW ──────────────────────────────────────────────────
  if (selectedLoad) {


    // Company-based visibility for Procurement/Received QA tabs
    // Show for: Cairo (3), Sokhna (4), Alfaglobal (5)
    // Hide for: Abu Dhabi (2), ADGM (1)
    const QA_ENABLED_COMPANY_IDS = [3, 4, 5];
    const showQATabs = shipment.company?.id ? QA_ENABLED_COMPANY_IDS.includes(shipment.company.id) : false;

    const loadTabs = [
      { id: "overview", label: "Overview" },
      ...(showQATabs ? [
        { id: "procurement", label: "Procurement (Source)" },
      ] : []),
      { id: "trucking", label: "Trucking" },
      ...(showQATabs ? [
        { id: "received", label: "Quality (Received)" },
      ] : []),
      ...(showQATabs ? [
        { id: "commission", label: "Commission & Deduction" },
      ] : []),
    ];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Load Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => { setSelectedLoadId(null); setLoadEditing(false); setLoadTab("overview"); }} style={{
              background: "none", border: `1px solid ${C.border}`, borderRadius: 6,
              padding: "4px 10px", fontSize: 10, cursor: "pointer", color: C.gray,
            }}>← Back to {shipment.name}</button>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{selectedLoad.name}</h2>
            <Badge v={PICKING_STATE_BADGE[selectedLoad.state] || "default"}>
              {PICKING_STATE_LABELS[selectedLoad.state] || selectedLoad.state}
            </Badge>
            {selectedLoad.containerNumber && (
              <span style={{ fontSize: 10, color: C.muted, fontFamily: MONO }}>{selectedLoad.containerNumber}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {!loadEditing && <Btn onClick={() => startLoadEdit(selectedLoad)} outline small>Edit</Btn>}
            {loadEditing && (
              <>
                <Btn onClick={() => setLoadEditing(false)} color={C.gray} outline small>Cancel</Btn>
                <Btn onClick={saveLoadEdit} small disabled={updatePickingMutation.isPending}>
                  {updatePickingMutation.isPending ? "Saving..." : "Save"}
                </Btn>
              </>
            )}
          </div>
        </div>

        {/* Load Summary Bar */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden",
        }}>
          {/* Product row — full width */}
          <div style={{
            padding: "8px 12px",
            borderBottom: `1px solid ${C.border}`,
            background: C.gBg,
          }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: C.sage, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 }}>PRODUCT</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.forest }}>{shipment.lines?.[0]?.product?.name || shipment.productCategory || "—"}</div>
          </div>
          {/* Detail fields row */}
          <div className="mob-scroll-x" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 0 }}>
            {[
              { label: "CONTAINER", value: selectedLoad.containerNumber || "—" },
              { label: "QTY (T)", value: `${fmtQty(selectedLoad.quantityTons || 0)} T` },
              { label: "GRADE", value: selectedLoad.loadedGrade || "—" },
              { label: "SOURCE", value: selectedLoad.source || "—" },
              { label: "LOADING DATE", value: fmtDateStr(selectedLoad.loadingDate) || "—" },
            ].map((item, i) => (
              <div key={i} style={{
                padding: "8px 12px",
                borderRight: i < 4 ? `1px solid ${C.border}` : "none",
              }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: C.sage, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 11, fontWeight: 600, fontFamily: MONO, color: C.dark }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Load Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: `1.5px solid ${C.border}` }}>
          {loadTabs.map(t => (
            <TabButton key={t.id} active={loadTab === t.id} onClick={() => setLoadTab(t.id)}>{t.label}</TabButton>
          ))}
        </div>

        {/* ── Overview Tab ──────────────────────────────────────────────── */}
        {loadTab === "overview" && (
          <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {/* Container Info */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Container</div>
              {loadEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div><Lbl>Container No.</Lbl><input value={loadEditFields.x_studio_loadcontainer_number_1} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_loadcontainer_number_1: e.target.value }))} style={inputStyle} /></div>
                  <div><Lbl>Seal No.</Lbl><input value={loadEditFields.x_studio_seal_number} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_seal_number: e.target.value }))} style={inputStyle} /></div>
                  <div><Lbl>Loading Date</Lbl><input type="date" value={loadEditFields.x_studio_loading_date} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_loading_date: e.target.value }))} style={inputStyle} /></div>
                </div>
              ) : (
                <>
                  <FieldRow label="Container No." value={selectedLoad.containerNumber || "—"} mono />
                  <FieldRow label="Seal No." value={selectedLoad.sealNumber || "—"} mono />
                  <FieldRow label="Loading Date" value={fmtDateStr(selectedLoad.loadingDate) || "—"} mono />
                  <FieldRow label="Loading Store" value={selectedLoad.loadingStore || "—"} />
                </>
              )}
            </Card>

            {/* Weight & Bales */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Weight & Bales</div>
              {loadEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div><Lbl>Net Weight (T)</Lbl><input type="number" step="0.01" value={loadEditFields.x_studio_net_weight_in_tons} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_net_weight_in_tons: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                  <div><Lbl>Qty in Tons</Lbl><input type="number" step="0.01" value={loadEditFields.x_studio_quantity_in_tons} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_quantity_in_tons: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                  <div><Lbl>Tare Weight (T)</Lbl><input type="number" step="0.01" value={loadEditFields.x_studio_tare_weight_in_tons} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_tare_weight_in_tons: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                  <div><Lbl>No. of Bales</Lbl><input value={loadEditFields.x_studio_number_of_balesbags} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_number_of_balesbags: e.target.value }))} style={inputStyle} /></div>
                </div>
              ) : (
                <>
                  <FieldRow label="Net Weight" value={`${fmtQty(selectedLoad.netWeightTons || 0)} T`} mono />
                  <FieldRow label="Qty in Tons" value={`${fmtQty(selectedLoad.quantityTons || 0)} T`} mono />
                  <FieldRow label="Tare Weight" value={`${fmtQty(selectedLoad.tareWeightTons || 0)} T`} mono />
                  <FieldRow label="No. of Bales" value={selectedLoad.balesBags || "—"} mono />
                </>
              )}
            </Card>

            {/* Source & Grade */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Source & Grade</div>
              {loadEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div><Lbl>Source</Lbl><select value={loadEditFields.x_studio_source || ""} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_source: e.target.value }))} style={inputStyle}><option value="">Select...</option>{["Dakhla","Farafrah","Owainat","Toshka","Menia","Assuit","Kharga","Baharia","Wadi Natroon","Ismalia","Other Location"].map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                  <div><Lbl>Loaded Grade</Lbl><select value={loadEditFields.x_studio_loaded_grade || ""} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_loaded_grade: e.target.value }))} style={inputStyle}><option value="">Select...</option>{loadedGradeOpts.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div>
                  <div><Lbl>Purchase Unit</Lbl><select value={loadEditFields.x_studio_purchasing_unit || ""} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_purchasing_unit: e.target.value }))} style={inputStyle}><option value="">Select...</option>{["Ton","Bale","Bag"].map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                </div>
              ) : (
                <>
                  <FieldRow label="Source" value={selectedLoad.source || "—"} />
                  <FieldRow label="Loaded Grade" value={selectedLoad.loadedGrade || "—"} />
                  <FieldRow label="Purchase Unit" value={selectedLoad.purchasingUnit || "—"} />
                </>
              )}
            </Card>
          </div>
        )}





        {/* ── Trucking Tab ─────────────────────────────────────────────── */}
        {loadTab === "trucking" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* ── TRUCKING OVERVIEW ──────────────────────────────────────── */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Trucking</div>
              {loadEditing ? (
                <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  <div><Lbl>Trucking Fee</Lbl><input type="number" step="0.01" value={loadEditFields.x_studio_trucking_fee} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_trucking_fee: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                  <div><Lbl>Cost Currency</Lbl><select value={loadEditFields.x_studio_trucking_cost_currency || ""} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_trucking_cost_currency: e.target.value }))} style={inputStyle}><option value="">Select...</option><option value="EGP">EGP</option><option value="AED">AED</option></select></div>
                  <div><Lbl>Driver Contact</Lbl><input value={loadEditFields.x_studio_local_trucking_driver_contact} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_local_trucking_driver_contact: e.target.value }))} style={inputStyle} placeholder="Phone or contact info" /></div>
                </div>
              ) : (
                <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div><Lbl>Trucking Fee</Lbl><Val mono>{selectedLoad.truckingFee || "—"}</Val></div>
                  <div><Lbl>Cost Currency</Lbl><Val>{selectedLoad.truckingCostCurrency || "—"}</Val></div>
                  <div><Lbl>Driver</Lbl><Val>{selectedLoad.truckingDriver ? selectedLoad.truckingDriver.name : "—"}</Val></div>
                  <div><Lbl>Driver Contact</Lbl><Val>{selectedLoad.truckingDriverContact || "—"}</Val></div>
                </div>
              )}
            </Card>

            {/* ── TRUCKING INFORMATION (moved from Procurement tab) ─────── */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Trucking Information</div>
              {loadEditing ? (
                <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <div><Lbl>Local Trucking Driver Name</Lbl><input value={loadEditFields.x_studio_driver_name} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_driver_name: e.target.value }))} style={inputStyle} /></div>
                  <div><Lbl>Local Trucking Driver Contact</Lbl><input value={loadEditFields.x_studio_driver_contact} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_driver_contact: e.target.value }))} style={inputStyle} /></div>
                  <div><Lbl>Trucking Cost Currency</Lbl><select value={loadEditFields.x_studio_trucking_cost_currency || ""} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_trucking_cost_currency: e.target.value }))} style={inputStyle}><option value="">Select...</option><option value="EGP">EGP</option><option value="AED">AED</option><option value="USD">USD</option><option value="EUR">EUR</option></select></div>
                  <div><Lbl>Agreed Trucking Cost</Lbl><input type="number" step="0.01" value={loadEditFields.x_studio_agreed_trucking_cost} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_agreed_trucking_cost: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                  <div><Lbl>Advance Payment</Lbl><input type="number" step="0.01" value={loadEditFields.x_studio_advance_payment_1} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_advance_payment_1: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                  <div><Lbl>Long Stay Charges</Lbl><input type="number" step="0.01" value={loadEditFields.x_studio_long_stay_cost} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_long_stay_cost: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                </div>
              ) : (
                <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
                  <FieldRow label="Local Trucking Driver Name" value={selectedLoad.driverName || "—"} />
                  <FieldRow label="Local Trucking Driver Contact" value={selectedLoad.driverContact || "—"} mono />
                  <FieldRow label="Trucking Cost Currency" value={selectedLoad.truckingCostCurrency || "—"} />
                  <FieldRow label="Agreed Trucking Cost" value={(selectedLoad.agreedTruckingCost || selectedLoad.truckingFee) ? `${selectedLoad.truckingCostCurrency || ""} ${fmt(selectedLoad.agreedTruckingCost || selectedLoad.truckingFee)}`.trim() : "—"} mono />
                  <FieldRow label="Advance Payment" value={selectedLoad.advancePayment ? `${selectedLoad.truckingCostCurrency || ""} ${fmt(selectedLoad.advancePayment)}`.trim() : "—"} mono />
                  <FieldRow label="Long Stay Charges" value={selectedLoad.longStayCharges != null ? `${selectedLoad.truckingCostCurrency || ""} ${fmt(selectedLoad.longStayCharges)}`.trim() : "—"} mono />
                </div>
              )}
            </Card>

            {/* ── TRUCKING ATTACHMENTS (moved from Procurement tab) ─────── */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Trucking Attachments</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[
                  { field: "x_studio_quality_report_attachment", label: "Driver License" },
                  { field: "x_studio_attachments", label: "Trucking Contract" },
                  { field: "x_studio_binary_field_40q_1j01n2jbk", label: "Weight Receipt" },
                ].map(att => {
                  const isUp = uploadedFiles[`picking-${att.field}`];
                  return (
                    <div key={att.field} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 5, background: isUp ? C.gBg : "transparent", border: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 10, fontWeight: 500 }}>{att.label}</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {isUp && <button onClick={() => handleFilePreview("picking", selectedLoad.id, att.field, att.label)} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: `1px solid ${C.gBdr2}`, background: C.gBg2, cursor: "pointer", color: C.forest, fontWeight: 600 }}>Preview</button>}
                        <button onClick={() => handleFileUpload("picking", selectedLoad.id, att.field)} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer", color: C.forest, fontWeight: 600 }}>{isUp ? "Replace" : "Upload"}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* ── Procurement (Source) Tab ─────────────────────────────────── */}
        {loadTab === "procurement" && showQATabs && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* ── PURCHASE INFORMATION ─────────────────────────────────────── */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Purchase Information</div>
              {loadEditing ? (
                <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <div><Lbl>Purchasing Unit</Lbl><input value={loadEditFields.x_studio_purchasing_unit_1} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_purchasing_unit_1: e.target.value }))} style={inputStyle} /></div>
                  <div><Lbl>Load/Container Number</Lbl><input value={loadEditFields.x_studio_loadcontainer_number_1} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_loadcontainer_number_1: e.target.value }))} style={inputStyle} /></div>
                  <div><Lbl>Net Weight in Tons</Lbl><input type="number" step="0.01" value={loadEditFields.x_studio_net_weight_in_tons} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_net_weight_in_tons: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                  <div><Lbl>Agreed Product Price per Unit</Lbl><input type="number" step="0.01" value={loadEditFields.x_studio_agreed_product_price_per_unit_1} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_agreed_product_price_per_unit_1: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                  <div><Lbl>Number of Bales/Jumbo Bags</Lbl><input value={loadEditFields.x_studio_number_of_balesbags} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_number_of_balesbags: e.target.value }))} style={inputStyle} /></div>
                  <div><Lbl>Source</Lbl><input value={loadEditFields.x_studio_source} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_source: e.target.value }))} style={inputStyle} /></div>
                  <div><Lbl>Sector/Farm/Field Name</Lbl><input value={loadEditFields.x_studio_farmfield_name} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_farmfield_name: e.target.value }))} style={inputStyle} /></div>
                  <div><Lbl>Loaded Grade</Lbl><select value={loadEditFields.x_studio_loaded_grade_1 || ""} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_loaded_grade_1: e.target.value }))} style={inputStyle}><option value="">Select...</option>{loadedGradeOpts.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div>
                  <div><Lbl>Loading Date/Time</Lbl><input type="datetime-local" value={loadEditFields.x_studio_loading_datetime_1?.replace(" ", "T") || loadEditFields.x_studio_loading_datetime?.replace(" ", "T") || ""} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_loading_datetime_1: e.target.value.replace("T", " ") }))} style={inputStyle} /></div>
                  <div><Lbl>Purchase Currency</Lbl><select value={loadEditFields.x_studio_purchase_currency || ""} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_purchase_currency: e.target.value }))} style={inputStyle}><option value="">Select...</option><option value="EGP">EGP</option><option value="AED">AED</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="SDG">SDG</option></select></div>
                </div>
              ) : (
                <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
                  <FieldRow label="Purchasing Unit" value={selectedLoad.purchasingUnit1 || selectedLoad.purchasingUnit || "\u2014"} />
                  <FieldRow label="Load/Container Number" value={selectedLoad.containerNumber || "\u2014"} mono />
                  <FieldRow label="Net Weight in Tons" value={selectedLoad.netWeightTons ? fmtQty(selectedLoad.netWeightTons) : "\u2014"} mono />
                  <FieldRow label="Product Purchase Currency" value={selectedLoad.purchaseCurrency?.name || selectedLoad.truckingCostCurrency || "\u2014"} />
                  <FieldRow label="Agreed Product Price per Unit" value={selectedLoad.agreedPricePerUnit ? `${selectedLoad.purchaseCurrency?.name || selectedLoad.truckingCostCurrency || ""} ${fmt(selectedLoad.agreedPricePerUnit)}`.trim() : "\u2014"} mono />
                  <FieldRow label="Number of Bales/Jumbo Bags" value={selectedLoad.balesBags || "\u2014"} mono />
                  <FieldRow label="Source" value={selectedLoad.source || "\u2014"} />
                  <FieldRow label="Sector/Farm/Field Name" value={selectedLoad.farmFieldName || "\u2014"} />
                  <FieldRow label="Loaded Grade" value={selectedLoad.loadedGrade1 || selectedLoad.loadedGrade || "\u2014"} />
                  <FieldRow label="Loading Date/Time" value={fmtDateStr(selectedLoad.loadingDatetime1 || selectedLoad.loadingDatetime) || "\u2014"} />
                  <FieldRow label="Procurement Officer" value={selectedLoad.procurementOfficer?.name || "\u2014"} />
                </div>
              )}
            </Card>

            {/* ── QUALITY CHECKER ─────────────────────────────────────────── */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Load Picture @Source</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[
                  { field: "x_studio_binary_field_7hm_1j45evrk9", label: "Left Side Picture" },
                  { field: "x_studio_binary_field_5v_1j45ev8ib", label: "Right Side Picture" },
                  { field: "x_studio_container_back_side", label: "Back Side Picture" },
                ].map(ph => {
                  const isUp = uploadedFiles[`picking-${ph.field}`];
                  return (
                    <div key={ph.field} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 5, background: isUp ? C.gBg : "transparent", border: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 10, fontWeight: 500 }}>{ph.label}</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {isUp && <button onClick={() => handleFilePreview("picking", selectedLoad.id, ph.field, ph.label)} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: `1px solid ${C.gBdr2}`, background: C.gBg2, cursor: "pointer", color: C.forest, fontWeight: 600 }}>Preview</button>}
                        <button onClick={() => handleFileUpload("picking", selectedLoad.id, ph.field)} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer", color: C.forest, fontWeight: 600 }}>{isUp ? "Replace" : "Upload"}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* ── Quality (Received) Tab ──────────────────────────────────────── */}
        {loadTab === "received" && showQATabs && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* ── RECEIVING TEAM ──────────────────────────────────────────── */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Receiving Team</div>
              <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 16px" }}>
                <div>
                  <Lbl>Quality Supervisors</Lbl>
                  <OdooMultiSelect
                    value={loadEditing ? loadTeamEdit.qualitySupervisorIds : (selectedLoad.qualitySupervisorIds || [])}
                    onChange={(v) => setLoadTeamEdit(p => ({ ...p, qualitySupervisorIds: v }))}
                    options={loadEmployeeOptions}
                    onSearch={setLoadEmployeeSearch}
                    isLoading={loadEmployeesLoading}
                    placeholder="Search supervisors..."
                    readOnly={!loadEditing}
                  />
                </div>
                <div>
                  <Lbl>Off-Loading Drivers</Lbl>
                  <OdooMultiSelect
                    value={loadEditing ? loadTeamEdit.loadingDriverIds : (selectedLoad.loadingDriverIds || [])}
                    onChange={(v) => setLoadTeamEdit(p => ({ ...p, loadingDriverIds: v }))}
                    options={loadEmployeeOptions}
                    onSearch={setLoadEmployeeSearch}
                    isLoading={loadEmployeesLoading}
                    placeholder="Search drivers..."
                    readOnly={!loadEditing}
                  />
                </div>
                <div>
                  <Lbl>Labor</Lbl>
                  <OdooMultiSelect
                    value={loadEditing ? loadTeamEdit.laborIds : (selectedLoad.laborIds || [])}
                    onChange={(v) => setLoadTeamEdit(p => ({ ...p, laborIds: v }))}
                    options={loadEmployeeOptions}
                    onSearch={setLoadEmployeeSearch}
                    isLoading={loadEmployeesLoading}
                    placeholder="Search labor..."
                    readOnly={!loadEditing}
                  />
                </div>
              </div>
              {selectedLoad.qualitySupervisorForDelivery && (
                <div style={{ marginTop: 6 }}>
                  <FieldRow label="Quality Supervisor for Delivery" value={selectedLoad.qualitySupervisorForDelivery.name} />
                </div>
              )}
            </Card>
            <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Card>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Arrival Information</div>
                {loadEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div><Lbl>Truck Load Serial (TL)</Lbl><input value={loadEditFields.x_studio_truck_load_serial_tl} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_truck_load_serial_tl: e.target.value }))} style={inputStyle} /></div>
                    <div><Lbl>Arrival Date/Time</Lbl><input type="datetime-local" value={loadEditFields.x_studio_arrival_datetime?.replace(" ", "T") || ""} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_arrival_datetime: e.target.value.replace("T", " ") }))} style={inputStyle} /></div>
                    <div><Lbl>Total Number of Received Bales</Lbl><input type="number" value={loadEditFields.x_studio_total_number_of_received_bales} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_total_number_of_received_bales: parseInt(e.target.value) || 0 }))} style={inputStyle} /></div>
                  </div>
                ) : (
                  <div>
                    <FieldRow label="Truck Load Serial (TL)" value={selectedLoad.truckLoadSerial || "\u2014"} mono />
                    <FieldRow label="Arrival Date/Time" value={fmtDateStr(selectedLoad.arrivalDatetime) || "\u2014"} />
                    <FieldRow label="Total Number of Received Bales" value={selectedLoad.totalReceivedBales || "\u2014"} mono />
                  </div>
                )}
              </Card>
            </div>

            {/* ── ARRIVAL CONDITION TOGGLES ───────────────────────────────── */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Arrival Condition</div>
              {loadEditing ? (
                <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  {[
                    { key: "x_studio_loadcontainer_cleanliness", label: "Clean Truck Load/Container" },
                    { key: "x_studio_presence_of_truck_cover", label: "Presence of Truck Cover" },
                    { key: "x_studio_proper_loadcontainer_lashing", label: "Proper Load/Container Lashing" },
                    { key: "x_studio_proper_loadcontainer_stacking", label: "Proper Load/Container Stacking" },
                  ].map(c => (
                    <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, cursor: "pointer", padding: "4px 0" }}>
                      <input type="checkbox" checked={!!loadEditFields[c.key]} onChange={e => setLoadEditFields(p => ({ ...p, [c.key]: e.target.checked }))} />
                      {c.label}
                    </label>
                  ))}
                </div>
              ) : (
                <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                  <QCRow label="Clean Truck Load/Container" value={selectedLoad.containerCleanliness} />
                  <QCRow label="Presence of Truck Cover" value={selectedLoad.truckCover} />
                  <QCRow label="Proper Load/Container Lashing" value={selectedLoad.properLashing} />
                  <QCRow label="Proper Load/Container Stacking" value={selectedLoad.properStacking} />
                </div>
              )}
            </Card>

            {/* ── LOAD PICTURES ───────────────────────────────────────────── */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Load Pictures</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[
                  { field: "x_studio_binary_field_5v_1j45ev8ib", label: "Load Picture \u2013 Right Side Picture" },
                  { field: "x_studio_binary_field_7hm_1j45evrk9", label: "Load Picture \u2013 Left Side Picture" },
                  { field: "x_studio_container_back_side", label: "Load Picture \u2013 Back Side Picture" },
                ].map(att => {
                  const isUp = uploadedFiles[`picking-${att.field}`];
                  return (
                    <div key={att.field} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 5, background: isUp ? C.gBg : "transparent", border: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 10, fontWeight: 500 }}>{att.label}</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {isUp && <button onClick={() => handleFilePreview("picking", selectedLoad.id, att.field, att.label)} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: `1px solid ${C.gBdr2}`, background: C.gBg2, cursor: "pointer", color: C.forest, fontWeight: 600 }}>Preview</button>}
                        <button onClick={() => handleFileUpload("picking", selectedLoad.id, att.field)} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer", color: C.forest, fontWeight: 600 }}>{isUp ? "Replace" : "Upload"}</button>
                      </div>
                    </div>
                  );
                })}
                {/* Container/Truck Load Body Report */}
                {(() => {
                  const isUp = uploadedFiles["picking-x_studio_quality_report_attachement"];
                  return (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 5, background: isUp ? C.gBg : "transparent", border: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 10, fontWeight: 500 }}>Container/Truck Load Body Report (if exists)</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {isUp && <button onClick={() => handleFilePreview("picking", selectedLoad.id, "x_studio_quality_report_attachement", "Container/Truck Load Body Report")} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: `1px solid ${C.gBdr2}`, background: C.gBg2, cursor: "pointer", color: C.forest, fontWeight: 600 }}>Preview</button>}
                        <button onClick={() => handleFileUpload("picking", selectedLoad.id, "x_studio_quality_report_attachement")} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer", color: C.forest, fontWeight: 600 }}>{isUp ? "Replace" : "Upload"}</button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </Card>

            {/* ── QUALITY CHECKS ──────────────────────────────────────────── */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Quality Checks</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.sage, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>Product Quality</div>
              {loadEditing ? (
                <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  {[
                    { key: "x_studio_good_quality_stem_size", label: "Good Quality Stem Size" },
                    { key: "x_studio_good_quality_green_color", label: "Good Quality Green Color" },
                    { key: "x_studio_good_quality_good_leave_attachement", label: "Good Quality Good Leave Attachment" },
                    { key: "x_studio_good_quality_absence_of_foreign_material", label: "Good Quality Absence of Foreign Material" },
                    { key: "x_studio_good_quality_bale_ties", label: "Good Quality Bale Ties" },
                    { key: "x_studio_good_quality_uniformity_of_bale_shape", label: "Good Quality Uniformity of Bale Shape" },
                    { key: "x_studio_good_quality_absence_of_insects", label: "Good Quality Absence of Insects" },
                    { key: "x_studio_good_quality_absence_of_black_spots", label: "Good Quality Absence of Black Spots" },
                  ].map(c => (
                    <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, cursor: "pointer", padding: "4px 0" }}>
                      <input type="checkbox" checked={!!loadEditFields[c.key]} onChange={e => setLoadEditFields(p => ({ ...p, [c.key]: e.target.checked }))} />
                      {c.label}
                    </label>
                  ))}
                </div>
              ) : (
                <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                  <QCRow label="Good Quality Stem Size" value={selectedLoad.goodQualityStemSize} />
                  <QCRow label="Good Quality Green Color" value={selectedLoad.goodQualityGreenColor} />
                  <QCRow label="Good Quality Good Leave Attachment" value={selectedLoad.goodQualityLeaveAttachment} />
                  <QCRow label="Good Quality Absence of Foreign Material" value={selectedLoad.goodQualityNoForeignMaterial} />
                  <QCRow label="Good Quality Bale Ties" value={selectedLoad.goodQualityBaleTies} />
                  <QCRow label="Good Quality Uniformity of Bale Shape" value={selectedLoad.goodQualityBaleShape} />
                  <QCRow label="Good Quality Absence of Insects" value={selectedLoad.goodQualityNoInsects} />
                  <QCRow label="Good Quality Absence of Black Spots" value={selectedLoad.goodQualityNoBlackSpots} />
                </div>
              )}
              {/* Percentage fields */}
              <div className="mob-detail-grid" style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
                {loadEditing ? (
                  <>
                    <div><Lbl>% Broken/Damaged Bales</Lbl><input type="number" step="0.1" value={loadEditFields.x_studio_brokendamaged_bales} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_brokendamaged_bales: parseInt(e.target.value) || 0 }))} style={inputStyle} /></div>
                    <div><Lbl>% Bales with Moisture Above 12%</Lbl><input type="number" step="0.1" value={loadEditFields.x_studio_bales_with_moisture_above_12} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_bales_with_moisture_above_12: parseInt(e.target.value) || 0 }))} style={inputStyle} /></div>
                  </>
                ) : (
                  <>
                    <FieldRow label="Percentage of Broken/Damaged Bales" value={selectedLoad.brokenDamagedBales ?? 0} />
                    <FieldRow label="Percentage of Bales with Moisture Above 12%" value={selectedLoad.balesAbove12Moisture ?? 0} />
                  </>
                )}
              </div>
              {/* Quality Report/Form Attachment */}
              <div style={{ marginTop: 10 }}>
                {(() => {
                  const isUp = uploadedFiles["picking-x_studio_quality_assessment_form"];
                  return (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 5, background: isUp ? C.gBg : "transparent", border: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 10, fontWeight: 500 }}>Quality Report/Form Attachment</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {isUp && <button onClick={() => handleFilePreview("picking", selectedLoad.id, "x_studio_quality_assessment_form", "Quality Report/Form Attachment")} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: `1px solid ${C.gBdr2}`, background: C.gBg2, cursor: "pointer", color: C.forest, fontWeight: 600 }}>Preview</button>}
                        <button onClick={() => handleFileUpload("picking", selectedLoad.id, "x_studio_quality_assessment_form")} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer", color: C.forest, fontWeight: 600 }}>{isUp ? "Replace" : "Upload"}</button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </Card>

            {/* ── LADDER IMAGES ───────────────────────────────────────────── */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Ladder Images</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[
                  { field: "x_studio_ladder_image_1_right_side", label: "Ladder Image 1 \u2013 Right Side" },
                  { field: "x_studio_ladder_image_2_right_side", label: "Ladder Image 2 \u2013 Right Side" },
                  { field: "x_studio_ladder_image_1_left_side", label: "Ladder Image 1 \u2013 Left Side" },
                ].map(att => {
                  const isUp = uploadedFiles[`picking-${att.field}`];
                  return (
                    <div key={att.field} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 5, background: isUp ? C.gBg : "transparent", border: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 10, fontWeight: 500 }}>{att.label}</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {isUp && <button onClick={() => handleFilePreview("picking", selectedLoad.id, att.field, att.label)} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: `1px solid ${C.gBdr2}`, background: C.gBg2, cursor: "pointer", color: C.forest, fontWeight: 600 }}>Preview</button>}
                        <button onClick={() => handleFileUpload("picking", selectedLoad.id, att.field)} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer", color: C.forest, fontWeight: 600 }}>{isUp ? "Replace" : "Upload"}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* ── ACCEPTED LOAD ───────────────────────────────────────────── */}
            <Card>
              {loadEditing ? (
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                  <input type="checkbox" checked={!!loadEditFields.x_studio_accepted_rejected} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_accepted_rejected: e.target.checked }))} />
                  Accepted Load (Not Rejected)
                </label>
              ) : (
                <QCRow label="Accepted Load (Not Rejected)" value={selectedLoad.acceptedRejected} />
              )}
            </Card>

            {/* ── GRADE PERCENTAGES + NIR ANALYSIS ────────────────────────── */}
            <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Card>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Grade Percentages</div>
                {loadEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div><Lbl>Overall Received Grade</Lbl><select value={loadEditFields.x_studio_overall_received_grade_as_per_quality_assessment || ""} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_overall_received_grade_as_per_quality_assessment: e.target.value }))} style={inputStyle}><option value="">Select...</option>{receivedGradeOpts.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div>
                    <div className="mob-detail-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4, alignItems: "center" }}>
                      <div><Lbl>Premium Grade %</Lbl><input type="number" step="0.1" value={loadEditFields.x_studio_premium_grade || 0} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_premium_grade: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                      <span style={{ fontSize: 10, color: C.muted }}>%</span>
                    </div>
                    <div className="mob-detail-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4, alignItems: "center" }}>
                      <div><Lbl>Grade 1 %</Lbl><input type="number" step="0.1" value={loadEditFields.x_studio_grade_1_ || 0} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_grade_1_: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                      <span style={{ fontSize: 10, color: C.muted }}>%</span>
                    </div>
                    <div className="mob-detail-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4, alignItems: "center" }}>
                      <div><Lbl>Standard %</Lbl><input type="number" step="0.1" value={loadEditFields.x_studio_standard_ || 0} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_standard_: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                      <span style={{ fontSize: 10, color: C.muted }}>%</span>
                    </div>
                    <div className="mob-detail-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4, alignItems: "center" }}>
                      <div><Lbl>Grade 3 %</Lbl><input type="number" step="0.1" value={loadEditFields.x_studio_grade_3_ || 0} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_grade_3_: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                      <span style={{ fontSize: 10, color: C.muted }}>%</span>
                    </div>
                    <div className="mob-detail-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4, alignItems: "center" }}>
                      <div><Lbl>Quality Score</Lbl><input type="number" step="0.1" value={loadEditFields.x_studio_quality_score || 0} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_quality_score: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                      <span style={{ fontSize: 10, color: C.muted }}>%</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <FieldRow label="Overall Received Grade (As Per Quality Assessment)" value={selectedLoad.overallReceivedGrade || selectedLoad.overallReceivedGrade1 || "\u2014"} />
                    <FieldRow label="Premium Grade %" value={`${selectedLoad.premiumGrade ?? 0}  %`} mono />
                    <FieldRow label="Grade 1 %" value={`${selectedLoad.grade1Pct ?? 0}  %`} mono />
                    <FieldRow label="Standard %" value={`${selectedLoad.standard ?? 0}  %`} mono />
                    <FieldRow label="Grade 3 %" value={`${selectedLoad.grade3Pct ?? 0}  %`} mono />
                    <FieldRow label="Quality Score" value={`${selectedLoad.qualityScore ?? 0}  %`} mono />
                  </div>
                )}
              </Card>
              <Card>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>NIR Analysis</div>
                <FieldRow label="NIR Sample Reference" value={selectedLoad.truckLoadSerial || "\u2014"} mono />
                <FieldRow label="Crude Protein (Dry Matter) %" value={`${selectedLoad.crudeProtein ?? 0}  %`} mono />
                <FieldRow label="NIR ADF %" value={`${selectedLoad.adf ?? 0}  %`} mono />
                <FieldRow label="NIR NDF %" value={`${selectedLoad.ndf ?? 0}  %`} mono />
              </Card>
            </div>

          </div>
        )}

        {/* ── COMMISSION & DEDUCTION TAB ──────────────────────────────────── */}
        {loadTab === "commission" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Card>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Commission</div>
                {loadEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, cursor: "pointer" }}>
                      <input type="checkbox" checked={!!loadEditFields.x_studio_is_there_commission} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_is_there_commission: e.target.checked }))} />
                      Is There Commission?
                    </label>
                    {loadEditFields.x_studio_is_there_commission && (
                      <>
                        <div><Lbl>Commissioned Person</Lbl><input value={loadEditFields.x_studio_commissioned_person_1} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_commissioned_person_1: e.target.value }))} style={inputStyle} /></div>
                        <div><Lbl>Commission Currency</Lbl><input value={loadEditFields.x_studio_commission_currency} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_commission_currency: e.target.value }))} style={inputStyle} /></div>
                        <div><Lbl>Commission Amount</Lbl><input type="number" step="0.01" value={loadEditFields.x_studio_commission_amount} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_commission_amount: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                      </>
                    )}
                    {!loadEditFields.x_studio_is_there_commission && (
                      <div><Lbl>Reason for No Commission</Lbl><input value={loadEditFields.x_studio_if_no_what_is_the_reason_for_no_commission} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_if_no_what_is_the_reason_for_no_commission: e.target.value }))} style={inputStyle} /></div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <QCRow label={`Commission: ${selectedLoad.isThereCommission ? "Yes" : "No"}`} value={selectedLoad.isThereCommission} />
                    {selectedLoad.isThereCommission ? (
                      <>
                        <FieldRow label="Commissioned Person" value={selectedLoad.commissionedPerson || "\u2014"} />
                        <FieldRow label="Commission Currency" value={selectedLoad.commissionCurrency || "\u2014"} />
                        <FieldRow label="Commission Amount" value={selectedLoad.commissionAmount ? `${selectedLoad.commissionCurrency || ""} ${fmt(selectedLoad.commissionAmount)}`.trim() : "\u2014"} mono />
                        <FieldRow label="Quality Supervisor" value={selectedLoad.qualitySupervisor?.name || "\u2014"} />
                      </>
                    ) : (
                      <FieldRow label="Reason" value={selectedLoad.noCommissionReason || "\u2014"} />
                    )}
                  </div>
                )}
              </Card>
              <Card>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Deduction / Claim</div>
                {loadEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, cursor: "pointer" }}>
                      <input type="checkbox" checked={!!loadEditFields.x_studio_is_there_deductionsclaim} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_is_there_deductionsclaim: e.target.checked }))} />
                      Is There Deduction/Claim?
                    </label>
                    {loadEditFields.x_studio_is_there_deductionsclaim && (
                      <>
                        <div><Lbl>Claim Currency</Lbl><input value={loadEditFields.x_studio_claim_currency} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_claim_currency: e.target.value }))} style={inputStyle} /></div>
                        <div><Lbl>Claim Amount</Lbl><input type="number" step="0.01" value={loadEditFields.x_studio_claim_amount} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_claim_amount: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                        <div><Lbl>Claim Description</Lbl><input value={loadEditFields.x_studio_claim_description} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_claim_description: e.target.value }))} style={inputStyle} /></div>
                        <div><Lbl>Claim Reason</Lbl><input value={loadEditFields.x_studio_claim_reason} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_claim_reason: e.target.value }))} style={inputStyle} /></div>
                        <div><Lbl>Deduction Amount</Lbl><input type="number" step="0.01" value={loadEditFields.x_studio_deduction_amount} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_deduction_amount: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <QCRow label={`Deduction/Claim: ${selectedLoad.isThereDeductionClaim ? "Yes" : "No"}`} value={selectedLoad.isThereDeductionClaim} />
                    {selectedLoad.isThereDeductionClaim && (
                      <>
                        <FieldRow label="Claim Currency" value={selectedLoad.claimCurrency || "\u2014"} />
                        <FieldRow label="Claim Amount" value={selectedLoad.claimAmount ? `${selectedLoad.claimCurrency || ""} ${fmt(selectedLoad.claimAmount)}`.trim() : "\u2014"} mono />
                        <FieldRow label="Claim Description" value={selectedLoad.claimDescription || "\u2014"} />
                        <FieldRow label="Claim Reason" value={selectedLoad.claimReason || "\u2014"} />
                        <FieldRow label="Deduction Amount" value={selectedLoad.deductionAmount ? `${selectedLoad.claimCurrency || ""} ${fmt(selectedLoad.deductionAmount)}`.trim() : "\u2014"} mono />
                      </>
                    )}
                    {/* Supporting Evidence file upload */}
                    {(() => {
                      const isUp = uploadedFiles["picking-x_studio_supporting_documents"];
                      return (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 5, background: isUp ? C.gBg : "transparent", border: `1px solid ${C.border}`, marginTop: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 500 }}>Deduction/Claim Supporting Evidence</span>
                           <div style={{ display: "flex", gap: 4 }}>
                             {isUp && <button onClick={() => handleFilePreview("picking", selectedLoad.id, "x_studio_supporting_documents", "Deduction/Claim Supporting Evidence")} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: `1px solid ${C.gBdr2}`, background: C.gBg2, cursor: "pointer", color: C.forest, fontWeight: 600 }}>Preview</button>}
                             <button onClick={() => handleFileUpload("picking", selectedLoad.id, "x_studio_supporting_documents")} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer", color: C.forest, fontWeight: 600 }}>{isUp ? "Replace" : "Upload"}</button>
                           </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}


      </div>
    );
  }


  // ─── MAIN SHIPMENT DETAIL VIEW ─────────────────────────────────────────
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "lines", label: `Product Lines (${shipment.lines.length})` },
    { id: "loads", label: `Loads / Receipts (${shipment.pickings.length})` },
    { id: "shipping", label: "Shipping & Logistics" },
    { id: "financial", label: "Financial" },
    { id: "documents", label: "Documents" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Breadcrumb — shown when navigated from a linked shipment */}
      {sourceShipment && onNavigateBack && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 8,
          background: `linear-gradient(135deg, ${sourceShipment.type === "sales" ? C.tBg : C.gBg}, ${C.card})`,
          border: `1px solid ${sourceShipment.type === "sales" ? C.tBdr : C.gBdr}`,
          fontSize: 10,
        }}>
        <span style={{ color: C.muted }}>←</span>
          <span style={{ color: C.gray }}>Navigated from</span>
          <span
            onClick={onNavigateBack}
            style={{
              fontWeight: 700, fontFamily: MONO, fontSize: 11,
              color: sourceShipment.type === "sales" ? C.terra : C.forest,
              cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2,
            }}
          >
            {sourceShipment.name}
          </span>
          <span style={{
            padding: "1px 6px", borderRadius: 4, fontSize: 8, fontWeight: 600,
            background: sourceShipment.type === "sales" ? C.tBg : C.gBg,
            color: sourceShipment.type === "sales" ? C.terra : C.forest,
            border: `1px solid ${sourceShipment.type === "sales" ? C.tBdr : C.gBdr}`,
            textTransform: "uppercase", letterSpacing: 0.5,
          }}>
            {sourceShipment.type === "sales" ? "Sales" : "Purchase"}
          </span>
          <button
            onClick={onNavigateBack}
            style={{
              marginLeft: "auto", background: sourceShipment.type === "sales" ? C.terra : C.forest,
              color: C.white, border: "none", borderRadius: 5,
              padding: "3px 10px", fontSize: 9, fontWeight: 600,
              cursor: "pointer", letterSpacing: 0.3,
            }}
          >
            ← Back to {sourceShipment.name}
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onBack} style={{
            background: "none", border: `1px solid ${C.border}`, borderRadius: 6,
            padding: "4px 10px", fontSize: 10, cursor: "pointer", color: C.gray,
          }}>← Purchase Shipments</button>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{shipment.name}</h2>
          <Badge v={shipment.shipmentStatus ? "green" : shipment.state === "purchase" ? "green" : shipment.state === "done" ? "sage" : "default"}>
            {shipment.shipmentStatus || STATE_LABELS[shipment.state] || shipment.state}
          </Badge>
          {shipment.agreement && (
            <span style={{ fontSize: 10, color: C.sage, fontFamily: MONO }}>⟵ {shipment.agreement.name}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {!editing && <Btn onClick={startEdit} outline small>Edit</Btn>}
          {editing && (
            <>
              <Btn onClick={() => { setEditing(false); setEditFields({}); }} color={C.gray} outline small>Cancel</Btn>
              <Btn onClick={saveEdit} small disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Btn>
            </>
          )}
        </div>
      </div>

      {/* Quick Info Bar */}
      <div style={{
        display: "flex", gap: 16, padding: "8px 14px",
        background: C.gBg, borderRadius: 8, border: `1px solid ${C.gBdr}`,
        fontSize: 10, color: C.gray, flexWrap: "wrap",
      }}>
        <div><Lbl>Vendor</Lbl> <span style={{ fontWeight: 600, color: C.dark }}>{shipment.vendor?.name || "—"}</span></div>
        <div><Lbl>Company</Lbl> <span style={{ fontWeight: 600, color: C.dark }}>{shipment.company?.name || "—"}</span></div>
        <div><Lbl>Total</Lbl> <span style={{ fontWeight: 700, color: C.forest, fontFamily: MONO }}>{shipment.currency?.name || ""} {fmt(shipment.amountTotal)}</span></div>
        <div><Lbl>Loads</Lbl> <span style={{ fontWeight: 600, fontFamily: MONO }}>{shipment.pickings.length}</span></div>
        {shipment.shippingLine && <div><Lbl>Shipping Line</Lbl> <span style={{ fontWeight: 600 }}>{shipment.shippingLine.toUpperCase()}</span></div>}
        {shipment.vesselName && <div><Lbl>Vessel</Lbl> <span style={{ fontWeight: 600 }}>{shipment.vesselName}</span></div>}
      </div>

      {/* Stage Timeline — clickable to update status */}
      <OdooStageTimeline
        state={shipment.state}
        shipmentStatus={shipment.shipmentStatus}
        type="purchase"
        updating={updatingStage}
        onStageClick={(stageId) => {
          setUpdatingStage(true);
          updateMutation.mutate(
            { id: shipmentId, x_studio_unified_shipment_status: stageId },
            {
              onSuccess: async () => {
                await Promise.all([
                  utils.shipments.getById.invalidate({ id: shipmentId }),
                  utils.shipments.list.invalidate(),
                ]);
                setUpdatingStage(false);
                toast(
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, color: C.forest }}>✓</span>
                    <span style={{ fontSize: 12, color: C.dark }}>Status updated to <strong>{stageId}</strong></span>
                  </div>,
                  {
                    duration: 2000,
                    style: {
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                      border: `1px solid ${C.border}`,
                      borderLeft: `3px solid ${C.forest}`,
                      background: C.card,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    },
                  }
                );
              },
              onError: (err) => {
                setUpdatingStage(false);
                toast(
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>Failed to update shipment status</span>
                    <span style={{ fontSize: 10, color: C.gray }}>{err.message}</span>
                  </div>,
                  {
                    duration: 3000,
                    style: {
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                      border: `1px solid ${C.border}`,
                      borderLeft: `3px solid ${C.terra}`,
                      background: C.card,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    },
                  }
                );
              },
            }
          );
        }}
      />

      {/* Vessel Route Visualization */}
      <OdooVesselRoute
        shipment={{
          vesselName: shipment.vesselName,
          shippingLine: shipment.shippingLine,
          portLoad: shipment.portOfLoading,
          portDischarge: shipment.portOfDestination,
          etd: shipment.etdPol || shipment.shipmentDate,
          eta: shipment.etaArrival,
          state: shipment.state,
          shipmentStatus: shipment.shipmentStatus,
          incoterm: shipment.incoterm,
          freightType: shipment.freightType,
          loadType: shipment.loadType,
          transitTimeDays: shipment.transitTimeDays,
        }}
        type="purchase"
      />

      {/* Linked to Procurement Activity */}
        {shipment.procurementRef && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 16px", borderRadius: 8, marginBottom: 8,
            background: "linear-gradient(135deg, #fef3c7, #fefce8)",
            border: "1px solid #f59e0b",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "#C0714A", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, color: "#fff", flexShrink: 0,
            }}>📦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "#92400e", textTransform: "uppercase", letterSpacing: 0.8 }}>Linked to Procurement Activity</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#78350f", marginTop: 2 }}>
                {shipment.procurementRef}
              </div>
              {shipment.procurementData && (
                <div style={{ fontSize: 10, color: "#92400e", marginTop: 4, lineHeight: 1.5 }}>
                  {shipment.procurementData}
                </div>
              )}
            </div>
            <div style={{
              padding: "3px 10px", borderRadius: 4,
              background: "#C0714A", color: "#fff",
              fontSize: 9, fontWeight: 600, letterSpacing: 0.5,
            }}>FROM PROCUREMENT</div>
          </div>
        )}

        {/* Linked Shipments Banner */}
      {!shipment.procurementRef && shipment.linkedShipments && shipment.linkedShipments !== "—" && (() => {
        const linkedNames = shipment.linkedShipments.split(",").map((n: string) => n.trim()).filter(Boolean);
        return linkedNames.map((trimmed: string, i: number) => {
          const company = companyFromShipmentName(trimmed);
          return (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 16px", borderRadius: 8, marginBottom: 8,
                background: `linear-gradient(135deg, ${C.gBg2}, ${C.gBg})`,
                border: `1px solid ${C.gBdr}`,
                cursor: onNavigateToShipment ? "pointer" : "default",
                transition: "all .15s",
              }}
              onClick={() => onNavigateToShipment?.("sales", trimmed, shipment.name)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.forest; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.gBdr; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: C.forest, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, color: C.white, flexShrink: 0,
              }}>⇅</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: 0.8 }}>Linked Sales Shipments</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: C.forest }}>
                    {trimmed}
                  </span>
                  {company && <span style={{ fontSize: 10, fontWeight: 500, fontFamily: FONT, color: C.sage }}>— {company}</span>}
                  <span style={{ fontSize: 9, opacity: 0.6 }}>↗</span>
                </div>
              </div>
              <div style={{
                padding: "3px 10px", borderRadius: 4,
                background: C.forest, color: C.white,
                fontSize: 9, fontWeight: 600, letterSpacing: 0.5,
              }}>MULTI-LINKED</div>
            </div>
          );
        });
      })()}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1.5px solid ${C.border}` }}>
        {tabs.map(t => (
          <TabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</TabButton>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && (
        <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Order Info</div>
            <FieldRow label="PO Number" value={shipment.name} mono />
            <FieldRow label="Vendor" value={shipment.vendor?.name || "—"} />
            <FieldRow label="Company" value={shipment.company?.name || "—"} />
            <FieldRow label="Agreement" value={shipment.agreement?.name || "—"} mono />
            <FieldRow label="Shipment Status" value={shipment.shipmentStatus || "—"} />
            <FieldRow label="PO Creation Date" value={fmtDateStr(shipment.dateOrder)} mono />
            <FieldRow label="Incoterm" value={shipment.incoterm?.name || "—"} />
            <FieldRow label="Payment Term" value={shipment.paymentTerm?.name || "—"} />

          </Card>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Shipment Info</div>
            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div><Lbl>Vessel Name</Lbl><input value={editFields.x_studio_vessel_name} onChange={e => setEditFields(p => ({ ...p, x_studio_vessel_name: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>Booking #</Lbl><input value={editFields.x_studio_booking_number} onChange={e => setEditFields(p => ({ ...p, x_studio_booking_number: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>BL Number</Lbl><input value={editFields.shipment_bl_number || ""} onChange={e => setEditFields(p => ({ ...p, shipment_bl_number: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>Vessel Tracking Link</Lbl><input value={editFields.x_studio_tracking_number} onChange={e => setEditFields(p => ({ ...p, x_studio_tracking_number: e.target.value }))} style={inputStyle} placeholder="e.g. https://www.marinetraffic.com/..." /></div>
                <div><Lbl>Port of Loading</Lbl><input value={editFields.pol_source} onChange={e => setEditFields(p => ({ ...p, pol_source: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>ETD (POL)</Lbl><input type="date" value={editFields.x_studio_etd_pol} onChange={e => setEditFields(p => ({ ...p, x_studio_etd_pol: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>ETA (POL)</Lbl><input type="date" value={editFields.x_studio_eta_pol} onChange={e => setEditFields(p => ({ ...p, x_studio_eta_pol: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>Port of Destination</Lbl><input value={editFields.pod_source} onChange={e => setEditFields(p => ({ ...p, pod_source: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>ETA (POD)</Lbl><input type="date" value={editFields.eta_arrival} onChange={e => setEditFields(p => ({ ...p, eta_arrival: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>Vessel Cut Off</Lbl><input type="date" value={editFields.x_studio_vessel_cut_off} onChange={e => setEditFields(p => ({ ...p, x_studio_vessel_cut_off: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>Shipment Date</Lbl><input type="date" value={editFields.x_studio_shipment_date} onChange={e => setEditFields(p => ({ ...p, x_studio_shipment_date: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl># Loads/Containers</Lbl><input type="number" value={editFields.number_of_loads} onChange={e => setEditFields(p => ({ ...p, number_of_loads: parseInt(e.target.value) || 0 }))} style={inputStyle} /></div>
              </div>
            ) : (
              <>
                <FieldRow label="Vessel Name" value={shipment.vesselName || "—"} />
                <FieldRow label="Shipping Line" value={shipment.shippingLine?.toUpperCase() || "—"} />
                <FieldRow label="Booking #" value={shipment.bookingNumber || "—"} mono />
                <FieldRow label="BL Number" value={shipment.blNumber || "—"} mono />
                {shipment.trackingNumber ? (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 10, color: C.muted }}>Vessel Tracking</span>
                    <a href={shipment.trackingNumber.startsWith("http") ? shipment.trackingNumber : `https://${shipment.trackingNumber}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, fontFamily: MONO, color: C.forest, textDecoration: "underline", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shipment.trackingNumber}</a>
                  </div>
                ) : (
                  <FieldRow label="Vessel Tracking" value="—" mono />
                )}
                <FieldRow label="Port of Loading" value={shipment.portOfLoading || "—"} />
                <FieldRow label="ETD (POL)" value={fmtDateStr(shipment.etdPol)} mono />
                <FieldRow label="ETA (POL)" value={fmtDateStr(shipment.etaPol)} mono />
                <FieldRow label="Port of Destination" value={shipment.portOfDestination || "—"} />
                <FieldRow label="ETA (POD)" value={fmtDateStr(shipment.etaArrival)} mono />
                <FieldRow label="Vessel Cut Off" value={fmtDateStr(shipment.vesselCutOff)} mono />
                <FieldRow label="Shipment Date" value={fmtDateStr(shipment.shipmentDate)} mono />
                <FieldRow label="# Loads/Containers" value={shipment.numberOfLoads || "—"} mono />
              </>
            )}
          </Card>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Agents & Officers</div>
            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div><Lbl>Procurement Officer</Lbl><OdooSearchSelect value={editFields._procurement_officer} onChange={v => setEditFields(p => ({ ...p, _procurement_officer: v }))} options={employeeOptions} onSearch={setEmployeeSearch} isLoading={employeesLoading} placeholder="Search employees..." /></div>
                <div><Lbl>Ultimate Customer</Lbl><input type="text" value={editFields.x_studio_ultimate_customer} onChange={e => setEditFields(p => ({ ...p, x_studio_ultimate_customer: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>Free Days — Demurrage (POD)</Lbl><input type="number" value={editFields.x_studio_total_free_days_demurrage_detention} onChange={e => setEditFields(p => ({ ...p, x_studio_total_free_days_demurrage_detention: parseInt(e.target.value) || 0 }))} style={inputStyle} /></div>
                <div><Lbl>Clearance Agent</Lbl><OdooSearchSelect value={editFields._clearance_agent} onChange={v => setEditFields(p => ({ ...p, _clearance_agent: v }))} options={partnerOptions} onSearch={setPartnerSearch} isLoading={partnersLoading} placeholder="Search partners..." /></div>
                <div><Lbl>Trucking Company</Lbl><OdooSearchSelect value={editFields._trucking_company} onChange={v => setEditFields(p => ({ ...p, _trucking_company: v }))} options={partnerOptions} onSearch={setPartnerSearch} isLoading={partnersLoading} placeholder="Search partners..." /></div>
              </div>
            ) : (
              <>
                <FieldRow label="Procurement Officer" value={shipment.procurementOfficer?.name || "—"} />
                <FieldRow label="Clearance Agent" value={typeof shipment.clearanceAgent === 'object' && shipment.clearanceAgent ? (shipment.clearanceAgent as any).name : (shipment.clearanceAgent || "—")} />
                <FieldRow label="Trucking Company" value={typeof shipment.truckingCompany === 'object' && shipment.truckingCompany ? (shipment.truckingCompany as any).name : (shipment.truckingCompany || "—")} />
                <FieldRow label="Ultimate Customer" value={shipment.ultimateCustomer || "—"} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: 0.5 }}>Free Days (POD)</span>
                  <FreeDaysBadge freeDays={shipment.freeDaysDemurrage} arrivalDate={shipment.etaArrival} label="POD Dem+Det" />
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {tab === "lines" && (
        <Card p={0}>
          <div className="mob-table-scroll" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>Product</Th><Th>Description</Th><Th right>Qty</Th><Th>UoM</Th>
                  <Th right>Unit Price</Th><Th right>Subtotal</Th><Th>Scheduled Date</Th>
                </tr>
              </thead>
              <tbody>
                {shipment.lines.map((line: any, i: number) => (
                  <tr key={line.id} style={{ background: i % 2 ? C.gBg : C.card }}>
                    <Td accent>{line.product?.name || "—"}</Td>
                    <Td>{"—"}</Td>
                    <Td right mono>{fmtQty(line.qty)}</Td>
                    <Td>{line.uom?.name || "—"}</Td>
                    <Td right mono>{shipment.currency?.name ? `${shipment.currency.name} ` : ""}{fmt(line.priceUnit)}</Td>
                    <Td right mono>{shipment.currency?.name ? `${shipment.currency.name} ` : ""}{fmt(line.priceSubtotal)}</Td>
                    <Td mono>{fmtDateStr(line.datePlanned)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "loads" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {shipment.pickings.length > 1 && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Btn
                small
                outline
                color={C.forest}
                onClick={() => {
                  if (redistributingWeight) return;
                  setRedistributingWeight(true);
                  redistributeWeightMutation.mutate({ orderId: shipment.id });
                }}
                disabled={redistributingWeight}
              >
                {redistributingWeight ? "Distributing..." : "⚖ Redistribute Weight Equally"}
              </Btn>
            </div>
          )}
          {shipment.pickings.length === 0 ? (
            <Card>
              <div style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 11 }}>
                No loads/receipts found for this shipment
              </div>
            </Card>
          ) : (
            <Card p={0}>
              <div className="mob-table-scroll" style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <Th>Name</Th><Th>Container</Th><Th>Seal</Th><Th>State</Th>
                      <Th right>Net Wt (T)</Th><Th right>Qty (T)</Th><Th>Quality</Th>
                      <Th>Source</Th><Th>Proc. Officer</Th><Th>Date</Th><Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipment.pickings.map((p: any, i: number) => (
                      <tr
                        key={p.id}
                        style={{ cursor: "pointer", background: i % 2 ? C.gBg : C.card }}
                        onClick={() => { setSelectedLoadId(p.id); setLoadTab("overview"); }}
                        onMouseEnter={e => e.currentTarget.style.background = C.gBg2}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 ? C.gBg : C.card}
                      >
                        <Td accent mono>{p.name}</Td>
                        <Td mono>{p.containerNumber || "—"}</Td>
                        <Td mono>{p.sealNumber || "—"}</Td>
                        <Td>
                          <Badge v={PICKING_STATE_BADGE[p.state] || "default"}>
                            {PICKING_STATE_LABELS[p.state] || p.state}
                          </Badge>
                        </Td>
                        <Td right mono>{p.netWeightTons ? fmtQty(p.netWeightTons) : "—"}</Td>
                        <Td right mono>{p.quantityTons ? fmtQty(p.quantityTons) : "—"}</Td>
                        <Td>
                          {(() => {
                            const grade = p.overallReceivedGrade || p.loadedGrade;
                            const g1 = p.grade1Pct;
                            if (!grade && g1 == null) return <span style={{ color: C.muted }}>—</span>;
                            const qScore = g1 != null ? g1 : 0;
                            const qColor = qScore >= 80 ? C.forest : qScore >= 50 ? C.terra : qScore > 0 ? C.red : C.muted;
                            return (
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                {g1 != null && (
                                  <span style={{
                                    display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                                    background: qColor, flexShrink: 0,
                                  }} />
                                )}
                                <span style={{ fontSize: 10, fontWeight: 600, color: qColor }}>
                                  {grade || `${g1}%`}
                                </span>
                              </div>
                            );
                          })()}
                        </Td>
                        <Td>{p.source || "\u2014"}</Td>
                        <Td>
                          {p.procurementOfficer ? (
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              fontSize: 10,
                              fontWeight: 600,
                              color: C.forest,
                              background: `${C.forest}18`,
                              border: `1px solid ${C.forest}40`,
                              borderRadius: 4,
                              padding: "2px 5px",
                              whiteSpace: "nowrap",
                              maxWidth: 120,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }} title={p.procurementOfficer.name}>
                              <span style={{ fontSize: 9, opacity: 0.7 }}>PO</span>
                              {p.procurementOfficer.name.split(" ")[0]}
                            </span>
                          ) : <span style={{ color: C.muted }}>—</span>}
                        </Td>
                        <Td mono>{fmtDateStr(p.scheduledDate)}</Td>
                        <Td>
                          <span onClick={(e) => { e.stopPropagation(); setSelectedLoadId(p.id); setLoadTab("overview"); }}><Btn small outline>View</Btn></span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "shipping" && (
        <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Shipping Details</div>
            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div><Lbl>Freight Type</Lbl>
                  <select value={editFields.freight_type} onChange={e => setEditFields(p => ({ ...p, freight_type: e.target.value }))} style={inputStyle}>
                    <option value="">Select...</option>
                    <option value="ocean">Ocean</option>
                    <option value="land">Land</option>
                  </select>
                </div>
                <div><Lbl>Load Type</Lbl>
                  <select value={editFields.load_type} onChange={e => setEditFields(p => ({ ...p, load_type: e.target.value }))} style={inputStyle}>
                    <option value="">Select...</option>
                    <option value="truck_load">Truck Load</option>
                    <option value="container_shipment">Container Shipment</option>
                  </select>
                </div>
                <div><Lbl>Shipping Line</Lbl>
                  <select value={editFields.ocean_transporter_company} onChange={e => setEditFields(p => ({ ...p, ocean_transporter_company: e.target.value }))} style={inputStyle}>
                    <option value="">Select...</option>
                    {[
                      { value: "esl", label: "ESL" },
                      { value: "rcl", label: "RCL" },
                      { value: "asyad", label: "ASYAD" },
                      { value: "maersk", label: "MAERSK" },
                      { value: "cma", label: "CMA" },
                      { value: "msc", label: "MSC" },
                      { value: "unifeeder", label: "Unifeeder" },
                      { value: "wanhai", label: "WANHAI" },
                      { value: "transmar", label: "Transmar" },
                      { value: "hapag_lloyd", label: "Hapag-Lloyd" },
                      { value: "one", label: "ONE" },
                      { value: "cosco", label: "COSCO" },
                      { value: "pil", label: "PIL" },
                      { value: "vasco", label: "VASCO" },
                      { value: "csl", label: "CSL" },
                    ].map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div><Lbl>Vessel Cut Off</Lbl><input type="date" value={editFields.x_studio_vessel_cut_off} onChange={e => setEditFields(p => ({ ...p, x_studio_vessel_cut_off: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>Transit Time (days)</Lbl><input type="number" value={editFields.x_studio_transit_time_days} onChange={e => setEditFields(p => ({ ...p, x_studio_transit_time_days: parseInt(e.target.value) || 0 }))} style={inputStyle} /></div>
                <div><Lbl>Free Days — Demurrage (POD)</Lbl><input type="number" value={editFields.x_studio_total_free_days_demurrage_detention} onChange={e => setEditFields(p => ({ ...p, x_studio_total_free_days_demurrage_detention: parseInt(e.target.value) || 0 }))} style={inputStyle} /></div>
              </div>
            ) : (
              <>
                <FieldRow label="Vessel Name" value={shipment.vesselName || "—"} />
                <FieldRow label="Shipping Line" value={shipment.shippingLine?.toUpperCase() || "—"} />
                <FieldRow label="Freight Type" value={shipment.freightType || "—"} />
                <FieldRow label="Load Type" value={shipment.loadType || "—"} />
                <FieldRow label="ETD (POL)" value={fmtDateStr(shipment.etdPol)} mono />
                <FieldRow label="ETA (POD)" value={fmtDateStr(shipment.etaArrival)} mono />
                <FieldRow label="Vessel Cut Off" value={fmtDateStr(shipment.vesselCutOff)} mono />
                <FieldRow label="Transit Time" value={shipment.transitTimeDays ? `${shipment.transitTimeDays} days` : "—"} mono />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: 0.5 }}>Free Days (POD)</span>
                  <FreeDaysBadge freeDays={shipment.freeDaysDemurrage} arrivalDate={shipment.etaArrival} label="POD Dem+Det" />
                </div>
              </>
            )}
          </Card>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Status</div>
            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div><Lbl>Shipment Status</Lbl><select value={editFields.x_studio_unified_shipment_status || ""} onChange={e => setEditFields(p => ({ ...p, x_studio_unified_shipment_status: e.target.value }))} style={inputStyle}><option value="">— Not Set —</option>{["Planned","Booked","Loading","Loaded","In Transit","Arrived at Port","Customs Clearance","Delivering","Delivered","Returned"].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><Lbl>Payment Status</Lbl><input value={editFields.x_studio_payment_status} onChange={e => setEditFields(p => ({ ...p, x_studio_payment_status: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>Doc Status</Lbl><input value={editFields.x_studio_shipment_documentation_status} onChange={e => setEditFields(p => ({ ...p, x_studio_shipment_documentation_status: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>Acceptance Status</Lbl><input value={editFields.x_studio_shipment_acceptance_status} onChange={e => setEditFields(p => ({ ...p, x_studio_shipment_acceptance_status: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>Ultimate Customer</Lbl><input value={editFields.x_studio_ultimate_customer} onChange={e => setEditFields(p => ({ ...p, x_studio_ultimate_customer: e.target.value }))} style={inputStyle} /></div>
              </div>
            ) : (
              <>
                <FieldRow label="Shipment Status" value={shipment.shipmentStatus || "—"} />
                <FieldRow label="Payment Status" value={shipment.paymentStatus || "—"} />
                <FieldRow label="Doc Status" value={shipment.docStatus || "—"} />
                <FieldRow label="Acceptance Status" value={shipment.acceptanceStatus || "—"} />
                <FieldRow label="Ultimate Customer" value={shipment.ultimateCustomer || "—"} />
                {/* Telex Release / BL Issued Toggle */}
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 8, marginTop: 6,
                    padding: "6px 8px", borderRadius: 6, cursor: "pointer", transition: "all .15s",
                    background: shipment.telexBLIssued ? C.gBg2 : C.rBg,
                    border: `1px solid ${shipment.telexBLIssued ? C.gBdr2 : C.rBdr}`,
                  }}
                  onClick={() => {
                    telexToggleMut.mutate(
                      { orderId: shipment.id, orderType: "purchase", issued: !shipment.telexBLIssued },
                    );
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    border: `2px solid ${shipment.telexBLIssued ? C.forest : C.terra}`,
                    background: shipment.telexBLIssued ? C.forest : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all .15s",
                  }}>
                    {shipment.telexBLIssued && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: shipment.telexBLIssued ? C.forest : C.terra }}>
                      Telex Release / BL Issued
                    </div>
                    <div style={{ fontSize: 8, color: C.muted }}>
                      {shipment.telexBLIssued ? "Issued — click to unmark" : "Not issued — click to mark as issued"}
                    </div>
                  </div>
                  {telexToggleMut.isPending && (
                    <div style={{ marginLeft: "auto", fontSize: 9, color: C.muted }}>Saving...</div>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {tab === "financial" && (() => {
        const termId = shipment.paymentTerm?.id;
        const invoices = invoicesQuery.data || [];
        return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Amounts Row */}
          <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Amounts</div>
              <FieldRow label="Amount (Excl. VAT)" value={`${shipment.currency?.name || ""} ${fmt(shipment.amountUntaxed)}`} mono />
              <FieldRow label="VAT Amount" value={`${shipment.currency?.name || ""} ${fmt(shipment.amountTax)}`} mono />
              <FieldRow label="Total (Incl. VAT)" value={`${shipment.currency?.name || ""} ${fmt(shipment.amountTotal)}`} mono color={C.forest} />
              <FieldRow label="Total Weight" value={shipment.totalShipmentWeight ? `${fmtQty(shipment.totalShipmentWeight)} T` : "—"} mono />
            </Card>
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Pricing</div>
              {editing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div><Lbl>Rate/Container</Lbl><input type="number" step="0.01" value={editFields.x_studio_rate_per_containerload} onChange={e => setEditFields(p => ({ ...p, x_studio_rate_per_containerload: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                  <div><Lbl>Selling Price/Ton</Lbl><input type="number" step="0.01" value={editFields.x_studio_selling_price_per_ton} onChange={e => setEditFields(p => ({ ...p, x_studio_selling_price_per_ton: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                  <div><Lbl>Total Weight (T)</Lbl><input type="number" step="0.01" value={editFields.x_studio_total_shipment_weight_in_tons_1} onChange={e => setEditFields(p => ({ ...p, x_studio_total_shipment_weight_in_tons_1: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                </div>
              ) : (
                <>
                  <FieldRow label="Rate/Container" value={shipment.ratePerContainer ? `${shipment.currency?.name || ""} ${fmtQty(shipment.ratePerContainer)}` : "—"} mono />
                  <FieldRow label="Selling Price/Ton" value={shipment.sellingPricePerTon ? `${shipment.currency?.name || ""} ${fmtQty(shipment.sellingPricePerTon)}` : "—"} mono />
                </>
              )}
            </Card>
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.forest, marginBottom: 8 }}>Payment</div>
              <FieldRow label="Payment Terms" value={shipment.paymentTerm?.name || "—"} />
              <FieldRow label="Payment Status" value={shipment.paymentStatus || "—"} color={
                shipment.paymentStatus === "Fully Paid" ? C.forest :
                shipment.paymentStatus === "Partially Paid" ? C.terra :
                shipment.paymentStatus === "Not Yet Paid" ? C.red : undefined
              } />
              <FieldRow label="Paid Amount (AED)" value={shipment.paidAmountInAed ? `AED ${fmtQty(shipment.paidAmountInAed)}` : "—"} mono />
            </Card>
          </div>
          {/* Payment Schedule */}
          {termId && <PaymentScheduleCard termId={termId} totalAmount={shipment.amountTotal} currency={shipment.currency?.name || ""} />}
          {/* Invoice / Bill Tracking */}
          <Card p={0}>
            <CardHdr gradient><CHT>Linked Bills / Invoices</CHT><CHB>{invoices.length}</CHB></CardHdr>
            <div style={{ padding: 12 }}>
              {invoicesQuery.isLoading ? (
                <div style={{ textAlign: "center", padding: 16, color: C.muted, fontSize: 11 }}>Loading invoices...</div>
              ) : invoices.length === 0 ? (
                <div style={{ textAlign: "center", padding: 16, color: C.muted, fontSize: 11 }}>No linked bills or invoices found</div>
              ) : (
                <div className="mob-table-scroll" style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
                    <thead>
                      <tr style={{ background: C.gBg, borderBottom: `1px solid ${C.border}` }}>
                        <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, color: C.sage }}>Number</th>
                        <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, color: C.sage }}>Type</th>
                        <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, color: C.sage }}>Date</th>
                        <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, color: C.sage }}>Due Date</th>
                        <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: C.sage }}>Total</th>
                        <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: C.sage }}>Remaining</th>
                        <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, color: C.sage }}>Payment</th>
                        <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, color: C.sage }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv: any) => {
                        const pColor = inv.paymentState === "paid" ? C.forest : inv.paymentState === "partial" ? C.terra : inv.paymentState === "in_payment" ? "#2563eb" : C.red;
                        const pLabel = inv.paymentState === "paid" ? "Paid" : inv.paymentState === "partial" ? "Partial" : inv.paymentState === "in_payment" ? "In Payment" : inv.paymentState === "not_paid" ? "Not Paid" : inv.paymentState === "reversed" ? "Reversed" : inv.paymentState;
                        const sColor = inv.state === "posted" ? C.forest : inv.state === "draft" ? C.muted : inv.state === "cancel" ? C.red : C.gray;
                        const sLabel = inv.state === "posted" ? "Posted" : inv.state === "draft" ? "Draft" : inv.state === "cancel" ? "Cancelled" : inv.state;
                        return (
                          <tr key={inv.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ padding: "6px 8px", fontWeight: 600, fontFamily: MONO }}>{inv.name}</td>
                            <td style={{ padding: "6px 8px" }}>{inv.type}</td>
                            <td style={{ padding: "6px 8px", fontFamily: MONO }}>{inv.invoiceDate ? fmtDateStr(inv.invoiceDate) : "—"}</td>
                            <td style={{ padding: "6px 8px", fontFamily: MONO }}>{inv.dueDate ? fmtDateStr(inv.dueDate) : "—"}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: MONO, fontWeight: 600 }}>{inv.currency} {fmt(inv.amountTotal)}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: MONO, color: inv.amountResidual > 0 ? C.red : C.forest }}>{inv.currency} {fmt(inv.amountResidual)}</td>
                            <td style={{ padding: "6px 8px", textAlign: "center" }}>
                              <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: `${pColor}18`, color: pColor, border: `1px solid ${pColor}30` }}>{pLabel}</span>
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "center" }}>
                              <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: `${sColor}18`, color: sColor, border: `1px solid ${sColor}30` }}>{sLabel}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>
        );
      })()}

      {tab === "documents" && (() => {
        const PO_DOCS = [
          { field: "analysis_report", label: "Analysis Report", category: "shipping" },
          { field: "bl", label: "Bill of Lading", category: "shipping" },
          { field: "packing_list", label: "Packing List", category: "shipping" },
          { field: "phytosanitary_certificate", label: "Phytosanitary Certificate", category: "shipping" },
          { field: "fumigation_certificate", label: "Fumigation Certificate", category: "shipping" },
          { field: "telex_release", label: "Telex Release", category: "shipping" },
          { field: "certificate_of_origin", label: "Certificate of Origin", category: "shipping" },
          { field: "delivery_note", label: "Delivery Note", category: "shipping" },
          { field: "other_documents", label: "Other Documents", category: "shipping" },
          { field: "x_studio_other_governmental_documents", label: "Governmental Documents", category: "shipping" },
          { field: "x_studio_payments_part_1", label: "Payment Part 1", category: "financial" },
          { field: "x_studio_payments_part_2", label: "Payment Part 2", category: "financial" },
          { field: "x_studio_payments_part_3", label: "Payment Part 3", category: "financial" },
          { field: "x_studio_pl_calculations", label: "P&L Calculations", category: "financial" },
          { field: "x_studio_other_payment_receiptsupporting_document", label: "Other Payment Receipt", category: "financial" },
          { field: "x_studio_product_payment_receiptsupporting_document", label: "Product Payment Receipt", category: "financial" },
          { field: "x_studio_trucking_payment_receiptsupporting_document", label: "Trucking Payment Receipt", category: "financial" },
          { field: "x_studio_product_bill", label: "Product Bill", category: "financial" },
          { field: "x_studio_trucking_bill", label: "Trucking Bill", category: "financial" },
        ];
        const shippingDocs = PO_DOCS.filter(d => d.category === "shipping");
        const financialDocs = PO_DOCS.filter(d => d.category === "financial");
        const shippingUploadedCount = shippingDocs.filter(d => uploadedFiles[`po-${d.field}`]).length;
        const financialUploadedCount = financialDocs.filter(d => uploadedFiles[`po-${d.field}`]).length;
        return (
          <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* Shipping Documents Card */}
            <Card p={0}>
              <CardHdr><CHT>Shipping Documents</CHT><CHB>{shippingUploadedCount}/{shippingDocs.length}</CHB></CardHdr>
              <div style={{ padding: 12 }}>
                <Bar v={shippingUploadedCount} max={shippingDocs.length} color={C.forest} />
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 10 }}>
                   {shippingDocs.map(doc => {
                     const isUploaded = uploadedFiles[`po-${doc.field}`];
                     const hardCopyEntry = hardCopyStatuses?.[doc.field];
                     const isHardCopyReceived = hardCopyEntry?.received || false;
                     return (
                       <div key={doc.field} style={{
                         display: "flex", alignItems: "center", gap: 8, padding: "5px 8px",
                         borderRadius: 5, background: isUploaded ? C.gBg : "transparent",
                       }}>
                         <span style={{ fontSize: 12 }}>{isUploaded ? "✅" : "⬜"}</span>
                         <span style={{ fontSize: 10.5, color: isUploaded ? C.dark : C.muted, flex: 1, fontWeight: isUploaded ? 500 : 400 }}>{doc.label}</span>
                         <label style={{ display: "flex", alignItems: "center", gap: 3, cursor: togglingHardCopyField === doc.field ? "wait" : "pointer", fontSize: 9, color: isHardCopyReceived ? C.forest : C.muted, fontWeight: 500, whiteSpace: "nowrap" }} title={isHardCopyReceived && hardCopyEntry?.receivedBy ? `Received by ${hardCopyEntry.receivedBy}` : "Hard copy received"}>
                           {togglingHardCopyField === doc.field ? (
                             <InlineSpinner size={12} color={C.forest} />
                           ) : (
                             <input type="checkbox" checked={isHardCopyReceived} onChange={() => { setTogglingHardCopyField(doc.field); toggleHardCopyMutation.mutate({ odooOrderId: Number(shipmentId), orderType: "purchase", documentField: doc.field, received: !isHardCopyReceived }); }} style={{ width: 12, height: 12, accentColor: C.forest, cursor: "pointer" }} />
                           )}
                           Hard Copy
                         </label>
                        <div style={{ display: "flex", gap: 4 }}>
                          {isUploaded && <button onClick={() => handleFilePreview("po", shipmentId, doc.field, doc.label)} style={{
                            background: C.gBg2, border: `1px solid ${C.gBdr2}`,
                            borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 600,
                            color: C.forest, cursor: "pointer", fontFamily: FONT,
                          }}>Preview</button>}
                          <button onClick={() => handleFileUpload("po", shipmentId, doc.field)} style={{
                            background: isUploaded ? C.rBg : C.gBg2, border: `1px solid ${isUploaded ? C.rBdr : C.gBdr2}`,
                            borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 600,
                            color: isUploaded ? C.red : C.forest, cursor: "pointer", fontFamily: FONT,
                          }}>{uploadPOFileMutation.isPending ? "..." : isUploaded ? "Replace" : "Upload"}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
            {/* Financial Documents Card */}
            <Card p={0}>
              <CardHdr gradient><CHT>Financial Documents</CHT><CHB>{financialUploadedCount}/{financialDocs.length}</CHB></CardHdr>
              <div style={{ padding: 12 }}>
                <Bar v={financialUploadedCount} max={financialDocs.length} color={C.terra} />
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 10 }}>
                   {financialDocs.map(doc => {
                     const isUploaded = uploadedFiles[`po-${doc.field}`];
                     const hardCopyEntry = hardCopyStatuses?.[doc.field];
                     const isHardCopyReceived = hardCopyEntry?.received || false;
                     return (
                       <div key={doc.field} style={{
                         display: "flex", alignItems: "center", gap: 8, padding: "5px 8px",
                         borderRadius: 5, background: isUploaded ? C.gBg : "transparent",
                       }}>
                         <span style={{ fontSize: 12 }}>{isUploaded ? "✅" : "⬜"}</span>
                         <span style={{ fontSize: 10.5, color: isUploaded ? C.dark : C.muted, flex: 1, fontWeight: isUploaded ? 500 : 400 }}>{doc.label}</span>
                         <label style={{ display: "flex", alignItems: "center", gap: 3, cursor: togglingHardCopyField === doc.field ? "wait" : "pointer", fontSize: 9, color: isHardCopyReceived ? C.forest : C.muted, fontWeight: 500, whiteSpace: "nowrap" }} title={isHardCopyReceived && hardCopyEntry?.receivedBy ? `Received by ${hardCopyEntry.receivedBy}` : "Hard copy received"}>
                           {togglingHardCopyField === doc.field ? (
                             <InlineSpinner size={12} color={C.forest} />
                           ) : (
                             <input type="checkbox" checked={isHardCopyReceived} onChange={() => { setTogglingHardCopyField(doc.field); toggleHardCopyMutation.mutate({ odooOrderId: Number(shipmentId), orderType: "purchase", documentField: doc.field, received: !isHardCopyReceived }); }} style={{ width: 12, height: 12, accentColor: C.forest, cursor: "pointer" }} />
                           )}
                           Hard Copy
                         </label>
                        <div style={{ display: "flex", gap: 4 }}>
                          {isUploaded && <button onClick={() => handleFilePreview("po", shipmentId, doc.field, doc.label)} style={{
                            background: C.gBg2, border: `1px solid ${C.gBdr2}`,
                            borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 600,
                            color: C.forest, cursor: "pointer", fontFamily: FONT,
                          }}>Preview</button>}
                          <button onClick={() => handleFileUpload("po", shipmentId, doc.field)} style={{
                            background: isUploaded ? C.rBg : C.gBg2, border: `1px solid ${isUploaded ? C.rBdr : C.gBdr2}`,
                            borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 600,
                            color: isUploaded ? C.red : C.forest, cursor: "pointer", fontFamily: FONT,
                          }}>{uploadPOFileMutation.isPending ? "..." : isUploaded ? "Replace" : "Upload"}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          base64Content={previewFile.base64}
          label={previewFile.label}
          loading={previewLoading}
          onClose={() => { setPreviewFile(null); previewReplaceRef.current = null; }}
          onReplace={() => { setPreviewFile(null); previewReplaceRef.current?.(); previewReplaceRef.current = null; }}
        />
      )}
    </div>
  );
}
