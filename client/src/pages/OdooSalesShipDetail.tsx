// ══════════════════════════════════════════════════════════════════════════════
// ODOO SALES SHIP DETAIL — Platfarm V3 — Sale Order detail with deliveries
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from "react";
import { C, MONO, FONT, fmt, fmtQty, fmtDateStr, companyFromShipmentName } from "@/lib/data";
import { Badge, Bar, Btn, Card, CardHdr, CHT, CHB, Lbl, Val, FieldRow, TabButton, Th, Td, QCRow } from "@/components/ui-primitives";
import { trpc } from "@/lib/trpc";
import { OdooVesselRoute } from "@/components/OdooVesselRoute";
import { OdooStageTimeline } from "@/components/OdooStageTimeline";
import { OdooSearchSelect } from "@/components/OdooSearchSelect";
import { FreeDaysBadge } from "@/components/FreeDaysBadge";
import { TopProgressBar, DetailPageSkeleton, InlineSpinner, MutationProgressBar } from "@/components/LoadingIndicators";
import { SO_STATE_LABELS as STATE_LABELS, PICKING_STATE_LABELS, PICKING_STATE_BADGE } from "@/lib/stateLabels";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { toast } from "sonner";

// ─── Payment Schedule Card (Sales) ──────────────────────────────────────────
function SalesPaymentScheduleCard({ termId, totalAmount, currency }: { termId: number; totalAmount: number; currency: string }) {
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
      <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 10 }}>Payment Schedule</div>
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
          {lines.map((line: any, i: number) => {
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

interface OdooSalesShipDetailProps {
  shipmentId: number;
  onBack: () => void;
  onNavigateToShipment?: (type: "purchase" | "sales", nameOrId: string, currentShipmentName?: string) => void;
  sourceShipment?: { type: "purchase" | "sales"; id: number; name: string } | null;
  onNavigateBack?: () => void;
}

export function OdooSalesShipDetail({ shipmentId, onBack, onNavigateToShipment, sourceShipment, onNavigateBack }: OdooSalesShipDetailProps) {
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
  const [redistributingWeight, setRedistributingWeight] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ label: string; base64: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewReplaceRef = useRef<(() => void) | null>(null);

  // Grade options from Odoo (cached, fetched once)
  const { data: gradeOptions } = trpc.shipments.gradeOptions.useQuery(undefined, { staleTime: 300_000 });
  const loadedGradeOpts = gradeOptions?.loadedGrade || [];
  const receivedGradeOpts = gradeOptions?.overallReceivedGrade || [];

  // Incoterms + payment terms for Order Information edit dropdowns
  const { data: incoterms } = trpc.shipments.incoterms.useQuery(undefined, { staleTime: 300_000 });
  const { data: paymentTerms } = trpc.shipments.paymentTerms.useQuery(undefined, { staleTime: 300_000 });

  // Invoices query - must be at top level (not inside conditional render) to avoid React hooks error #310
  const invoicesQuery = trpc.salesShipments.invoices.useQuery(
    { orderId: shipmentId },
    { enabled: true }
  );


  const utils = trpc.useUtils();

  // ─── Hard Copy Tracking ─────────────────────────────────────────────
  const { data: hardCopyStatuses } = trpc.documents.getHardCopyStatuses.useQuery(
    { odooOrderId: Number(shipmentId), orderType: "sales" },
    { staleTime: 30_000 }
  );
  const [togglingHardCopyField, setTogglingHardCopyField] = useState<string | null>(null);
  const toggleHardCopyMutation = trpc.documents.toggleHardCopy.useMutation({
    onSuccess: async (_data, variables) => {
      await utils.documents.getHardCopyStatuses.invalidate({ odooOrderId: Number(shipmentId), orderType: "sales" });
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

  // ─── Telex Release / BL Issued Toggle ─────────────────────────────────────────
  const telexToggleMut = trpc.documents.toggleTelexBLIssued.useMutation({
    onSuccess: () => {
      utils.salesShipments.getById.invalidate({ id: shipmentId });
      toast(
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: C.forest }}>✓</span>
          <span style={{ fontSize: 12, color: C.dark }}>Telex Release / BL Issued updated</span>
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
      toast(
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>Failed to update Telex Release</span>
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

  const { data: shipment, isLoading, error } = trpc.salesShipments.getById.useQuery(
    { id: shipmentId },
    { staleTime: 15_000 }
  );

  // ─── File Status Queries ──────────────────────────────────────────────
  const { data: soFileStatus } = trpc.salesShipments.soFileStatus.useQuery(
    { soId: shipmentId },
    { staleTime: 30_000 }
  );

  const { data: pickingFileStatus } = trpc.salesShipments.pickingFileStatus.useQuery(
    { pickingId: selectedLoadId! },
    { enabled: !!selectedLoadId, staleTime: 30_000 }
  );

  // Initialize uploadedFiles from SO file status
  useEffect(() => {
    if (!soFileStatus) return;
    setUploadedFiles(prev => {
      const next = { ...prev };
      for (const [field, hasData] of Object.entries(soFileStatus)) {
        next[`so-${field}`] = !!hasData;
      }
      return next;
    });
  }, [soFileStatus]);

  // Initialize uploadedFiles from picking file status (reset when switching loads)
  useEffect(() => {
    setUploadedFiles(prev => {
      const next: Record<string, boolean> = {};
      // Keep SO-level keys
      for (const [k, v] of Object.entries(prev)) {
        if (k.startsWith("so-")) next[k] = v;
      }
      // Set picking-level keys from status
      if (pickingFileStatus && selectedLoadId) {
        for (const [field, hasData] of Object.entries(pickingFileStatus)) {
          if (hasData) next[`picking-${field}`] = true;
        }
      }
      return next;
    });
  }, [pickingFileStatus, selectedLoadId]);

  // Search queries for Many2one fields (reuse Purchase side endpoints)
  const { data: employeeOptions = [], isLoading: employeesLoading } = trpc.shipments.employees.useQuery(
    { search: employeeSearch },
    { enabled: editing }
  );
  const { data: partnerOptions = [], isLoading: partnersLoading } = trpc.shipments.partners.useQuery(
    { search: partnerSearch },
    { enabled: editing }
  );

  const updateMutation = trpc.salesShipments.update.useMutation({
    onSuccess: () => {
      utils.salesShipments.getById.invalidate({ id: shipmentId });
      utils.salesShipments.list.invalidate();
      setEditing(false);
      setEditFields({});
    },
  });

  const updatePickingMutation = trpc.salesShipments.updatePicking.useMutation({
    onSuccess: () => {
      utils.salesShipments.getById.invalidate({ id: shipmentId });
      setLoadEditing(false);
      setLoadEditFields({});
    },
  });

  const redistributeWeightMutation = trpc.salesShipments.redistributeWeight.useMutation({
    onSuccess: () => {
      utils.salesShipments.getById.invalidate({ id: shipmentId });
      setRedistributingWeight(false);
    },
    onError: () => {
      setRedistributingWeight(false);
    },
  });

  const uploadSOFileMutation = trpc.salesShipments.uploadSOFile.useMutation({
    onSuccess: () => {
      utils.salesShipments.getById.invalidate({ id: shipmentId });
      utils.salesShipments.soFileStatus.invalidate({ soId: shipmentId });
    },
  });

  const uploadPickingFileMutation = trpc.salesShipments.uploadPickingFile.useMutation({
    onSuccess: () => {
      utils.salesShipments.getById.invalidate({ id: shipmentId });
      if (selectedLoadId) utils.salesShipments.pickingFileStatus.invalidate({ pickingId: selectedLoadId });
    },
  });

  const startEdit = useCallback(() => {
    if (!shipment) return;
    setEditFields({
      tracking_number: shipment.trackingNumber || "",
      shipping_line: shipment.shippingLine || "",
      freight_type: shipment.freightType || "",
      load_type: shipment.loadType || "",
      x_studio_product_category: shipment.productCategory || "",
      x_studio_ultimate_customer: shipment.ultimateCustomer || "",
      x_studio_total_shipment_weight_in_tons_sales: shipment.totalShipmentWeight || 0,
      x_studio_shipment_bl_number: shipment.blNumber || "",
      booking_number: shipment.bookingNumber || "",
      x_studio_shipment_acceptance_status: shipment.acceptanceStatus || "",
      number_of_loads: shipment.numberOfLoads || 0,
      eta_pod: shipment.etaPod || "",
      eta_pol: shipment.etaPol || "",
      etd_pol: shipment.etdPol || "",
      vessel_cut_off: shipment.vesselCutOff || "",
      vessel_tracking_link: shipment.vesselTrackingLink || "",
      rate_per_container_load: shipment.ratePerContainerLoad || "",
      transit_time_in_days: shipment.transitTimeInDays || "",
      x_studio_payment_term: shipment.paymentTermSales || "",
      x_studio_payment_term_1: shipment.paymentTermPurchase || "",
      x_studio_ocean_freight_invoiced_entity: shipment.oceanFreightInvoicedEntity || "",
      x_studio_ocean_freight_invoicing_entity: shipment.oceanFreightInvoicingEntity || "",
      x_studio_clearance_trucking_invoiced_entity: shipment.clearanceTruckingInvoicedEntity || "",
      x_studio_clearance_trucking_invoicing_entity: shipment.clearanceTruckingInvoicingEntity || "",
      x_studio_notespayment: shipment.notesPayment || "",
      x_studio_notespayment_1: shipment.notesPayment1 || "",
      _salesperson: shipment.salesperson ? { id: shipment.salesperson.id, name: shipment.salesperson.name } : null,
      _clearance_agent: shipment.clearanceAgent ? { id: shipment.clearanceAgent.id, name: shipment.clearanceAgent.name } : null,
      _trucking_company: shipment.truckingCompany ? { id: shipment.truckingCompany.id, name: shipment.truckingCompany.name } : null,
      incoterm: shipment.incoterm?.id || null,
      payment_term_id: shipment.paymentTerm?.id || null,
      x_payment_reference_date: shipment.paymentReferenceDate || "",
    });
    setEditing(true);
  }, [shipment]);

  const saveEdit = useCallback(() => {
    const cleaned: Record<string, any> = { id: shipmentId };
    Object.entries(editFields).forEach(([k, v]) => {
      if (v !== "" && v !== null && v !== undefined) cleaned[k] = v;
    });
    // Map Many2one search fields to their Odoo field IDs
    if (editFields._salesperson?.id) cleaned.user_id = editFields._salesperson.id;
    if (editFields._clearance_agent?.id) cleaned.local_clearance_agent = editFields._clearance_agent.id;
    if (editFields._trucking_company?.id) cleaned.local_trucking_company = editFields._trucking_company.id;
    // Remove internal keys that shouldn't be sent to Odoo
    delete cleaned._salesperson;
    delete cleaned._clearance_agent;
    delete cleaned._trucking_company;
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
      // Quality Destination fields
      x_studio_overall_received_grade_as_per_quality_assessment: load.overallReceivedGrade || "",
      x_studio_premium_grade: load.premiumGrade || 0,
      x_studio_grade_1_: load.grade1Pct || 0,
      x_studio_standard_: load.standard || 0,
      x_studio_grade_3_: load.grade3Pct || 0,
      x_studio_brokendamaged_bales: load.brokenDamagedBales || 0,
      x_studio_bales_with_moisture_above_12: load.balesAbove12Moisture || 0,
      x_studio_total_number_of_received_bales: load.totalReceivedBales || "",
      x_studio_accepted_rejected: load.acceptedRejected || false,
      // QC visual checks
      x_studio_good_quality_stem_size: load.goodQualityStemSize || false,
      x_studio_good_quality_green_color: load.goodQualityGreenColor || false,
      x_studio_good_quality_good_leave_attachement: load.goodQualityLeaveAttachment || false,
      x_studio_good_quality_absence_of_foreign_material: load.goodQualityNoForeignMaterial || false,
      x_studio_good_quality_bale_ties: load.goodQualityBaleTies || false,
      x_studio_good_quality_uniformity_of_bale_shape: load.goodQualityBaleShape || false,
      x_studio_good_quality_absence_of_insects: load.goodQualityNoInsects || false,
      x_studio_good_quality_absence_of_black_spots: load.goodQualityNoBlackSpots || false,
      // Trucking extra fields
      x_studio_driver_name: load.driverName || "",
      x_studio_driver_contact: load.driverContact || "",
      x_studio_agreed_trucking_cost: load.agreedTruckingCost || 0,
    });
    setLoadEditing(true);
  }, []);

  const saveLoadEdit = useCallback(() => {
    if (!selectedLoadId) return;
    const cleaned: Record<string, any> = { id: selectedLoadId };
    Object.entries(loadEditFields).forEach(([k, v]) => {
      if (v !== "" && v !== null && v !== undefined) cleaned[k] = v;
    });
    updatePickingMutation.mutate(cleaned as any);
  }, [loadEditFields, selectedLoadId, updatePickingMutation]);

  const handleFileUpload = useCallback(async (target: "so" | "picking", id: number, fieldName: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        const trackKey = `${target}-${fieldName}`;
        if (target === "so") {
          uploadSOFileMutation.mutate({ soId: id, fieldName, base64Content: base64 }, {
            onSuccess: () => setUploadedFiles(prev => ({ ...prev, [trackKey]: true })),
          });
        } else {
          uploadPickingFileMutation.mutate({ pickingId: id, fieldName, base64Content: base64 }, {
            onSuccess: () => setUploadedFiles(prev => ({ ...prev, [trackKey]: true })),
          });
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [uploadSOFileMutation, uploadPickingFileMutation]);

  const handleFilePreview = useCallback(async (target: "so" | "picking", id: number, fieldName: string, label: string) => {
    setPreviewLoading(true);
    try {
      const input = target === "so"
        ? JSON.stringify({ "0": { json: { soId: id, fieldName } } })
        : JSON.stringify({ "0": { json: { pickingId: id, fieldName } } });
      const endpoint = target === "so" ? "salesShipments.readSOFile" : "salesShipments.readPickingFile";
      const res = await fetch(`/api/trpc/${endpoint}?batch=1&input=${encodeURIComponent(input)}`, { credentials: "include" });
      const json = await res.json();
      // tRPC batch response: [{result:{data:{json:{content:"..."}}}}]
      const content = json?.[0]?.result?.data?.json?.content;
      if (content) {
        previewReplaceRef.current = () => handleFileUpload(target, id, fieldName);
        setPreviewFile({ label, base64: content });
      } else {
        alert("File not found or empty");
      }
    } catch (err) {
      console.error("Preview fetch error:", err);
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
          Failed to load sales order: {error?.message || "Not found"}
        </div>
      </Card>
    );
  }

  const selectedLoad = selectedLoadId ? shipment.pickings.find((p: any) => p.id === selectedLoadId) : null;

  // ─── DELIVERY DETAIL VIEW ──────────────────────────────────────────────
  if (selectedLoad) {
    const LOAD_DOCS = [
      { field: "x_studio_quality_assessment_form", label: "Quality Assessment Form" },
      { field: "x_studio_quality_report_attachement", label: "Quality Report" },
      { field: "x_studio_load_quality_checker", label: "Load Quality Checker" },
      { field: "x_studio_supporting_documents", label: "Supporting Documents" },
    ];
    const LOAD_PHOTOS = [
      { field: "x_studio_ladder_image_1_left_side", label: "Ladder Image 1 (Left)" },
      { field: "x_studio_ladder_image_1_right_side", label: "Ladder Image 1 (Right)" },
      { field: "x_studio_ladder_image_2_left_side", label: "Ladder Image 2 (Left)" },
      { field: "x_studio_ladder_image_2_right_side", label: "Ladder Image 2 (Right)" },
    ];
    const docUpCount = LOAD_DOCS.filter(d => uploadedFiles[`picking-${d.field}`]).length;
    const photoUpCount = LOAD_PHOTOS.filter(d => uploadedFiles[`picking-${d.field}`]).length;

    // Container images for Quality (Shipped)
    const CONTAINER_PHOTOS = [
      { field: "x_studio_binary_field_5v_1j45ev8ib", label: "Container – Right Side" },
      { field: "x_studio_binary_field_7hm_1j45evrk9", label: "Container – Left Side" },
      { field: "x_studio_container_back_side", label: "Container – Back Side" },
    ];
    const containerPhotoCount = CONTAINER_PHOTOS.filter(d => uploadedFiles[`picking-${d.field}`]).length;

    const loadTabs = [
      { id: "overview", label: "Overview" },
      { id: "quality-shipped", label: "Quality (Shipped)" },
      { id: "trucking", label: "Trucking" },
      { id: "quality-destination", label: "Quality (Destination)" },
    ];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Delivery Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Btn small outline onClick={() => { setSelectedLoadId(null); setLoadEditing(false); setLoadEditFields({}); setLoadTab("overview"); }}>← Back to SO</Btn>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{selectedLoad.name}</span>
            <Badge v={PICKING_STATE_BADGE[selectedLoad.state] || "default"}>
              {PICKING_STATE_LABELS[selectedLoad.state] || selectedLoad.state}
            </Badge>
            {selectedLoad.containerNumber && (
              <span style={{ fontSize: 10, color: C.muted, fontFamily: MONO }}>{selectedLoad.containerNumber}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {!loadEditing ? (
              <Btn small color={C.terra} onClick={() => startLoadEdit(selectedLoad)}>Edit Delivery</Btn>
            ) : (
              <>
                <Btn small color={C.forest} onClick={saveLoadEdit} disabled={updatePickingMutation.isPending}>
                  {updatePickingMutation.isPending ? "Saving..." : "Save"}
                </Btn>
                <Btn small outline onClick={() => { setLoadEditing(false); setLoadEditFields({}); }}>Cancel</Btn>
              </>
            )}
          </div>
        </div>

        {/* Delivery Summary Bar */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden",
        }}>
          {/* Product row — full width */}
          <div style={{
            padding: "8px 12px",
            borderBottom: `1px solid ${C.border}`,
            background: C.tBg,
          }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: C.sage, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 }}>PRODUCT</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.terra }}>{shipment.lines?.[0]?.product?.name || shipment.productCategory || "—"}</div>
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

        {/* Delivery Tabs */}
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
              <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Container</div>
              {loadEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div><Lbl>Container #</Lbl><input value={loadEditFields.x_studio_loadcontainer_number_1} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_loadcontainer_number_1: e.target.value }))} style={inputStyle} /></div>
                  <div><Lbl>Seal #</Lbl><input value={loadEditFields.x_studio_seal_number} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_seal_number: e.target.value }))} style={inputStyle} /></div>
                  <div><Lbl>Loading Date</Lbl><input type="date" value={loadEditFields.x_studio_loading_date} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_loading_date: e.target.value }))} style={inputStyle} /></div>
                  <div><Lbl>Truck Serial</Lbl><input value={loadEditFields.x_studio_truck_load_serial_tl} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_truck_load_serial_tl: e.target.value }))} style={inputStyle} /></div>
                </div>
              ) : (
                <>
                  <FieldRow label="Container No." value={selectedLoad.containerNumber || "—"} mono />
                  <FieldRow label="Seal No." value={selectedLoad.sealNumber || "—"} mono />
                  <FieldRow label="Loading Date" value={fmtDateStr(selectedLoad.loadingDate) || "—"} mono />
                  <FieldRow label="Truck Serial" value={selectedLoad.truckLoadSerial || "—"} mono />
                  <FieldRow label="Loading Store" value={selectedLoad.loadingStore || "—"} />
                </>
              )}
            </Card>

            {/* Weight & Bales */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Weight & Bales</div>
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
              <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Source & Grade</div>
              {loadEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div><Lbl>Source</Lbl>
                    <select value={loadEditFields.x_studio_source || ""} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_source: e.target.value }))} style={inputStyle}>
                      <option value="">Select...</option>
                      {["Toshka", "East Oweinat", "Dakhla", "Farafra", "Minya", "Beni Suef", "Fayoum"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><Lbl>Grade</Lbl>
                    <select value={loadEditFields.x_studio_loaded_grade || ""} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_loaded_grade: e.target.value }))} style={inputStyle}>
                      <option value="">Select...</option>
                      {loadedGradeOpts.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                  </div>
                  <div><Lbl>Purchase Unit</Lbl>
                    <select value={loadEditFields.x_studio_purchasing_unit || ""} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_purchasing_unit: e.target.value }))} style={inputStyle}>
                      <option value="">Select...</option>
                      {["Ton","Bale","Bag"].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
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

        {/* ══ QUALITY (SHIPPED) TAB ═══════════════════════════════════ */}
        {loadTab === "quality-shipped" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Row 1: Quality Metrics + Loading QC Checks */}
            <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Card>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Quality Metrics (At Loading)</div>
                {loadEditing ? (
                  <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div><Lbl>Quality Score</Lbl><input type="number" step="0.1" value={loadEditFields.x_studio_quality_score} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_quality_score: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                    <div><Lbl>Moisture %</Lbl><input type="number" step="0.1" value={loadEditFields.x_studio_moisture_} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_moisture_: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                    <div><Lbl>NDF %</Lbl><input type="number" step="0.1" value={loadEditFields.x_studio_ndf_} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_ndf_: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                    <div><Lbl>ADF %</Lbl><input type="number" step="0.1" value={loadEditFields.x_studio_adf_} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_adf_: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                    <div><Lbl>Crude Protein %</Lbl><input type="number" step="0.1" value={loadEditFields.x_studio_crude_protein_dry_matter_} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_crude_protein_dry_matter_: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                  </div>
                ) : (
                  <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    <FieldRow label="Quality Score" value={selectedLoad.qualityScore || "\u2014"} mono />
                    <FieldRow label="Moisture %" value={selectedLoad.moisture || "\u2014"} mono />
                    <FieldRow label="NDF %" value={selectedLoad.ndf || "\u2014"} mono />
                    <FieldRow label="ADF %" value={selectedLoad.adf || "\u2014"} mono />
                    <FieldRow label="Crude Protein %" value={selectedLoad.crudeProtein || "\u2014"} mono />
                  </div>
                )}
              </Card>

              <Card>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Loading QC Checks</div>
                {loadEditing ? (
                  <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    {[
                      { key: "x_studio_loadcontainer_cleanliness", label: "Container Clean" },
                      { key: "x_studio_proper_loadcontainer_lashing", label: "Proper Lashing" },
                      { key: "x_studio_proper_loadcontainer_stacking", label: "Proper Stacking" },
                      { key: "x_studio_presence_of_truck_cover", label: "Truck Cover" },
                      { key: "x_studio_payment_confirmation", label: "Payment Confirmed" },
                    ].map(c => (
                      <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, cursor: "pointer", padding: "2px 0" }}>
                        <input type="checkbox" checked={!!loadEditFields[c.key]} onChange={e => setLoadEditFields(p => ({ ...p, [c.key]: e.target.checked }))} />
                        {c.label}
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                    {[
                      { val: selectedLoad.containerCleanliness, label: "Container Clean" },
                      { val: selectedLoad.properLashing, label: "Proper Lashing" },
                      { val: selectedLoad.properStacking, label: "Proper Stacking" },
                      { val: selectedLoad.truckCover, label: "Truck Cover" },
                      { val: selectedLoad.paymentConfirmation, label: "Payment Confirmed" },
                    ].map(c => (
                      <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, padding: "2px 0" }}>
                        <span style={{ color: c.val ? C.forest : C.red, fontWeight: 700 }}>{c.val ? "\u2713" : "\u2717"}</span>
                        <span style={{ color: c.val ? C.dark : C.muted }}>{c.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Row 2: Loading Team */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Loading Team</div>
              <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div><Lbl>Quality Supervisor</Lbl><Val>{(selectedLoad as any).qualitySupervisor?.name || "\u2014"}</Val></div>
                <div><Lbl>Driver</Lbl><Val>{(selectedLoad as any).driverName || selectedLoad.truckingDriver?.name || "\u2014"}</Val></div>
                <div><Lbl>Driver Contact</Lbl><Val>{(selectedLoad as any).driverContact || selectedLoad.truckingDriverContact || "\u2014"}</Val></div>
              </div>
            </Card>

            {/* Row 3: Container Images + Documents */}
            <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Card p={0}>
                <CardHdr gradient><CHT>Container Images</CHT><CHB>{containerPhotoCount}/{CONTAINER_PHOTOS.length}</CHB></CardHdr>
                <div style={{ padding: 12 }}>
                  <Bar v={containerPhotoCount} max={CONTAINER_PHOTOS.length} color={containerPhotoCount === CONTAINER_PHOTOS.length ? C.forest : C.terra} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 10 }}>
                    {CONTAINER_PHOTOS.map(doc => {
                      const isUp = uploadedFiles[`picking-${doc.field}`];
                      return (
                        <div key={doc.field} style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "5px 8px",
                          borderRadius: 5, background: isUp ? C.gBg : "transparent",
                        }}>
                          <span style={{ fontSize: 12 }}>{isUp ? "\u2705" : "\u2b1c"}</span>
                          <span style={{ fontSize: 10.5, color: isUp ? C.dark : C.muted, flex: 1, fontWeight: isUp ? 500 : 400 }}>{doc.label}</span>
                          <div style={{ display: "flex", gap: 4 }}>
                            {isUp && <button onClick={() => handleFilePreview("picking", selectedLoad.id, doc.field, doc.label)} style={{
                              background: C.gBg2, border: `1px solid ${C.gBdr2}`,
                              borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 600,
                              color: C.forest, cursor: "pointer", fontFamily: FONT,
                            }}>Preview</button>}
                            <button onClick={() => handleFileUpload("picking", selectedLoad.id, doc.field)} style={{
                              background: isUp ? C.rBg : C.gBg2, border: `1px solid ${isUp ? C.rBdr : C.gBdr2}`,
                              borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 600,
                              color: isUp ? C.red : C.forest, cursor: "pointer", fontFamily: FONT,
                            }}>{uploadPickingFileMutation.isPending ? "..." : isUp ? "Replace" : "Upload"}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>

              <Card p={0}>
                <CardHdr><CHT>Quality Documents</CHT><CHB>{docUpCount}/{LOAD_DOCS.length}</CHB></CardHdr>
                <div style={{ padding: 12 }}>
                  <Bar v={docUpCount} max={LOAD_DOCS.length} color={docUpCount === LOAD_DOCS.length ? C.forest : C.terra} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 10 }}>
                    {LOAD_DOCS.map(doc => {
                      const isUp = uploadedFiles[`picking-${doc.field}`];
                      return (
                        <div key={doc.field} style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "5px 8px",
                          borderRadius: 5, background: isUp ? C.gBg : "transparent",
                        }}>
                          <span style={{ fontSize: 12 }}>{isUp ? "\u2705" : "\u2b1c"}</span>
                          <span style={{ fontSize: 10.5, color: isUp ? C.dark : C.muted, flex: 1, fontWeight: isUp ? 500 : 400 }}>{doc.label}</span>
                          <div style={{ display: "flex", gap: 4 }}>
                            {isUp && <button onClick={() => handleFilePreview("picking", selectedLoad.id, doc.field, doc.label)} style={{
                              background: C.gBg2, border: `1px solid ${C.gBdr2}`,
                              borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 600,
                              color: C.forest, cursor: "pointer", fontFamily: FONT,
                            }}>Preview</button>}
                            <button onClick={() => handleFileUpload("picking", selectedLoad.id, doc.field)} style={{
                              background: isUp ? C.rBg : C.gBg2, border: `1px solid ${isUp ? C.rBdr : C.gBdr2}`,
                              borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 600,
                              color: isUp ? C.red : C.forest, cursor: "pointer", fontFamily: FONT,
                            }}>{uploadPickingFileMutation.isPending ? "..." : isUp ? "Replace" : "Upload"}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            </div>

            {/* Row 4: Ladder Photos */}
            <Card p={0}>
              <CardHdr gradient><CHT>Ladder Photos</CHT><CHB>{photoUpCount}/{LOAD_PHOTOS.length}</CHB></CardHdr>
              <div style={{ padding: 12 }}>
                <Bar v={photoUpCount} max={LOAD_PHOTOS.length} color={photoUpCount === LOAD_PHOTOS.length ? C.forest : C.terra} />
                <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, marginTop: 10 }}>
                  {LOAD_PHOTOS.map(doc => {
                    const isUp = uploadedFiles[`picking-${doc.field}`];
                    return (
                      <div key={doc.field} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "5px 8px",
                        borderRadius: 5, background: isUp ? C.gBg : "transparent",
                      }}>
                        <span style={{ fontSize: 12 }}>{isUp ? "\u2705" : "\u2b1c"}</span>
                        <span style={{ fontSize: 10.5, color: isUp ? C.dark : C.muted, flex: 1, fontWeight: isUp ? 500 : 400 }}>{doc.label}</span>
                        <div style={{ display: "flex", gap: 4 }}>
                          {isUp && <button onClick={() => handleFilePreview("picking", selectedLoad.id, doc.field, doc.label)} style={{
                            background: C.gBg2, border: `1px solid ${C.gBdr2}`,
                            borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 600,
                            color: C.forest, cursor: "pointer", fontFamily: FONT,
                          }}>Preview</button>}
                          <button onClick={() => handleFileUpload("picking", selectedLoad.id, doc.field)} style={{
                            background: isUp ? C.rBg : C.gBg2, border: `1px solid ${isUp ? C.rBdr : C.gBdr2}`,
                            borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 600,
                            color: isUp ? C.red : C.forest, cursor: "pointer", fontFamily: FONT,
                          }}>{uploadPickingFileMutation.isPending ? "..." : isUp ? "Replace" : "Upload"}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ══ TRUCKING TAB ═══════════════════════════════════════════════ */}
        {loadTab === "trucking" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Card>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Trucking Agent & Fees</div>
                {loadEditing ? (
                  <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div><Lbl>Trucking Fee</Lbl><input type="number" step="0.01" value={loadEditFields.x_studio_trucking_fee} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_trucking_fee: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                    <div><Lbl>Trucking Fees Detail</Lbl><input value={loadEditFields.x_studio_trucking_fees} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_trucking_fees: e.target.value }))} style={inputStyle} /></div>
                    <div><Lbl>Cost Currency</Lbl><select value={loadEditFields.x_studio_trucking_cost_currency || ""} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_trucking_cost_currency: e.target.value }))} style={inputStyle}><option value="">Select...</option><option value="EGP">EGP</option><option value="AED">AED</option><option value="USD">USD</option><option value="EUR">EUR</option></select></div>
                    <div><Lbl>Agreed Trucking Cost</Lbl><input type="number" step="0.01" value={loadEditFields.x_studio_agreed_trucking_cost} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_agreed_trucking_cost: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                  </div>
                ) : (
                  <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    <FieldRow label="Trucking Fee" value={selectedLoad.truckingFee || "\u2014"} mono />
                    <FieldRow label="Trucking Fees" value={selectedLoad.truckingFees || "\u2014"} />
                    <FieldRow label="Cost Currency" value={selectedLoad.truckingCostCurrency || "\u2014"} />
                    <FieldRow label="Agreed Cost" value={(selectedLoad as any).agreedTruckingCost || "\u2014"} mono />
                  </div>
                )}
              </Card>

              <Card>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Driver Details</div>
                {loadEditing ? (
                  <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div><Lbl>Driver Name</Lbl><input value={loadEditFields.x_studio_driver_name} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_driver_name: e.target.value }))} style={inputStyle} /></div>
                    <div><Lbl>Driver Contact</Lbl><input value={loadEditFields.x_studio_local_trucking_driver_contact} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_local_trucking_driver_contact: e.target.value }))} style={inputStyle} placeholder="Phone or contact info" /></div>
                  </div>
                ) : (
                  <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    <FieldRow label="Trucking Driver" value={selectedLoad.truckingDriver ? selectedLoad.truckingDriver.name : "\u2014"} />
                    <FieldRow label="Driver Name" value={(selectedLoad as any).driverName || "\u2014"} />
                    <FieldRow label="Driver Contact" value={(selectedLoad as any).driverContact || selectedLoad.truckingDriverContact || "\u2014"} />
                  </div>
                )}
              </Card>
            </div>

            {/* SKU & Payment Confirmation */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Confirmation</div>
              <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div><Lbl>SKU Confirmation</Lbl><Val>{selectedLoad.skuConfirmation || "\u2014"}</Val></div>
                <div><Lbl>Payment Confirmed</Lbl><Val>{selectedLoad.paymentConfirmation ? <span style={{ color: C.forest, fontWeight: 700 }}>\u2713 Yes</span> : <span style={{ color: C.red }}>\u2717 No</span>}</Val></div>
              </div>
            </Card>
          </div>
        )}

        {/* ══ QUALITY (DESTINATION) TAB ═══════════════════════════════════ */}
        {loadTab === "quality-destination" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Row 1: Received Grade + Bale Assessment */}
            <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Card>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Received Grade Assessment</div>
                {loadEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div><Lbl>Overall Received Grade</Lbl>
                      <select value={loadEditFields.x_studio_overall_received_grade_as_per_quality_assessment || ""} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_overall_received_grade_as_per_quality_assessment: e.target.value }))} style={inputStyle}>
                        <option value="">Select...</option>
                        {receivedGradeOpts.map((v: { value: string; label: string }) => <option key={v.value} value={v.value}>{v.label}</option>)}
                      </select>
                    </div>
                    <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <div><Lbl>Premium %</Lbl><input type="number" step="0.1" value={loadEditFields.x_studio_premium_grade} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_premium_grade: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                      <div><Lbl>Grade 1 %</Lbl><input type="number" step="0.1" value={loadEditFields.x_studio_grade_1_} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_grade_1_: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                      <div><Lbl>Standard %</Lbl><input type="number" step="0.1" value={loadEditFields.x_studio_standard_} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_standard_: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                      <div><Lbl>Grade 3 %</Lbl><input type="number" step="0.1" value={loadEditFields.x_studio_grade_3_} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_grade_3_: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <FieldRow label="Overall Received Grade" value={(selectedLoad as any).overallReceivedGrade || "\u2014"} />
                    <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 4 }}>
                      <FieldRow label="Premium %" value={(selectedLoad as any).premiumGrade || "\u2014"} mono />
                      <FieldRow label="Grade 1 %" value={(selectedLoad as any).grade1Pct || "\u2014"} mono />
                      <FieldRow label="Standard %" value={(selectedLoad as any).standard || "\u2014"} mono />
                      <FieldRow label="Grade 3 %" value={(selectedLoad as any).grade3Pct || "\u2014"} mono />
                    </div>
                  </div>
                )}
              </Card>

              <Card>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Bale Assessment</div>
                {loadEditing ? (
                  <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div><Lbl>Total Received Bales</Lbl><input value={loadEditFields.x_studio_total_number_of_received_bales} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_total_number_of_received_bales: e.target.value }))} style={inputStyle} /></div>
                    <div><Lbl>Broken/Damaged</Lbl><input type="number" step="1" value={loadEditFields.x_studio_brokendamaged_bales} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_brokendamaged_bales: parseInt(e.target.value) || 0 }))} style={inputStyle} /></div>
                    <div><Lbl>Moisture &gt;12%</Lbl><input type="number" step="1" value={loadEditFields.x_studio_bales_with_moisture_above_12} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_bales_with_moisture_above_12: parseInt(e.target.value) || 0 }))} style={inputStyle} /></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, paddingTop: 16 }}>
                      <input type="checkbox" checked={!!loadEditFields.x_studio_accepted_rejected} onChange={e => setLoadEditFields(p => ({ ...p, x_studio_accepted_rejected: e.target.checked }))} />
                      <Lbl>Accepted</Lbl>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <FieldRow label="Total Received Bales" value={(selectedLoad as any).totalReceivedBales || "\u2014"} mono />
                    <FieldRow label="Broken/Damaged" value={(selectedLoad as any).brokenDamagedBales || "\u2014"} mono />
                    <FieldRow label="Moisture >12%" value={(selectedLoad as any).balesAbove12Moisture || "\u2014"} mono />
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, padding: "2px 0", marginTop: 4 }}>
                      <span style={{ color: (selectedLoad as any).acceptedRejected ? C.forest : C.red, fontWeight: 700 }}>{(selectedLoad as any).acceptedRejected ? "\u2713" : "\u2717"}</span>
                      <span style={{ fontWeight: 600 }}>Accepted</span>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* Row 2: Visual Quality Checks */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Visual Quality Checks (Destination)</div>
              {loadEditing ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
                  {[
                    { key: "x_studio_good_quality_green_color", label: "Green Color" },
                    { key: "x_studio_good_quality_stem_size", label: "Stem Size" },
                    { key: "x_studio_good_quality_good_leave_attachement", label: "Leaf Attachment" },
                    { key: "x_studio_good_quality_bale_ties", label: "Bale Ties" },
                    { key: "x_studio_good_quality_uniformity_of_bale_shape", label: "Bale Shape Uniformity" },
                    { key: "x_studio_good_quality_absence_of_black_spots", label: "No Black Spots" },
                    { key: "x_studio_good_quality_absence_of_foreign_material", label: "No Foreign Material" },
                    { key: "x_studio_good_quality_absence_of_insects", label: "No Insects" },
                  ].map(c => (
                    <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, cursor: "pointer", padding: "3px 0" }}>
                      <input type="checkbox" checked={!!loadEditFields[c.key]} onChange={e => setLoadEditFields(p => ({ ...p, [c.key]: e.target.checked }))} />
                      {c.label}
                    </label>
                  ))}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 2 }}>
                  {[
                    { val: (selectedLoad as any).goodQualityGreenColor, label: "Green Color" },
                    { val: (selectedLoad as any).goodQualityStemSize, label: "Stem Size" },
                    { val: (selectedLoad as any).goodQualityLeaveAttachment, label: "Leaf Attachment" },
                    { val: (selectedLoad as any).goodQualityBaleTies, label: "Bale Ties" },
                    { val: (selectedLoad as any).goodQualityBaleShape, label: "Bale Shape Uniformity" },
                    { val: (selectedLoad as any).goodQualityNoBlackSpots, label: "No Black Spots" },
                    { val: (selectedLoad as any).goodQualityNoForeignMaterial, label: "No Foreign Material" },
                    { val: (selectedLoad as any).goodQualityNoInsects, label: "No Insects" },
                  ].map(c => (
                    <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, padding: "3px 0" }}>
                      <span style={{ color: c.val ? C.forest : C.red, fontWeight: 700 }}>{c.val ? "\u2713" : "\u2717"}</span>
                      <span style={{ color: c.val ? C.dark : C.muted }}>{c.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Row 3: Weight at Destination */}
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Weight at Destination</div>
              <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div><Lbl>Gross Weight (T)</Lbl><Val mono>{fmtQty((selectedLoad as any).grossWeightTons || 0)} T</Val></div>
                <div><Lbl>Gross Weight</Lbl><Val mono>{fmtQty((selectedLoad as any).grossWeight || 0)}</Val></div>
                <div><Lbl>Arrival Date</Lbl><Val mono>{fmtDateStr((selectedLoad as any).arrivalDatetime) || "\u2014"}</Val></div>
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  }


  // ─── MAIN SO DETAIL VIEW ───────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Breadcrumb — shown when navigated from a linked shipment */}
      {sourceShipment && onNavigateBack && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 8,
          background: `linear-gradient(135deg, ${sourceShipment.type === "purchase" ? C.gBg : C.tBg}, ${C.card})`,
          border: `1px solid ${sourceShipment.type === "purchase" ? C.gBdr : C.tBdr}`,
          fontSize: 10,
        }}>
          <span style={{ color: C.muted }}>←</span>
          <span style={{ color: C.gray }}>Navigated from</span>
          <span
            onClick={onNavigateBack}
            style={{
              fontWeight: 700, fontFamily: MONO, fontSize: 11,
              color: sourceShipment.type === "purchase" ? C.forest : C.terra,
              cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2,
            }}
          >
            {sourceShipment.name}
          </span>
          <span style={{
            padding: "1px 6px", borderRadius: 4, fontSize: 8, fontWeight: 600,
            background: sourceShipment.type === "purchase" ? C.gBg : C.tBg,
            color: sourceShipment.type === "purchase" ? C.forest : C.terra,
            border: `1px solid ${sourceShipment.type === "purchase" ? C.gBdr : C.tBdr}`,
            textTransform: "uppercase", letterSpacing: 0.5,
          }}>
            {sourceShipment.type === "purchase" ? "Purchase" : "Sales"}
          </span>
          <button
            onClick={onNavigateBack}
            style={{
              marginLeft: "auto", background: sourceShipment.type === "purchase" ? C.forest : C.terra,
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
          <Btn small outline onClick={onBack}>← Sales Shipments</Btn>
          <span style={{ fontSize: 16, fontWeight: 700, fontFamily: MONO }}>{shipment.name}</span>
          <Badge v={shipment.state === "sale" ? "green" : shipment.state === "done" ? "sage" : shipment.state === "cancel" ? "red" : "default"}>
            {STATE_LABELS[shipment.state] || shipment.state}
          </Badge>
          {shipment.productCategory && <Badge v="terra">{shipment.productCategory}</Badge>}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {!editing ? (
            <Btn small color={C.terra} onClick={startEdit}>Edit</Btn>
          ) : (
            <>
              <Btn small color={C.forest} onClick={saveEdit} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Btn>
              <Btn small outline onClick={() => { setEditing(false); setEditFields({}); }}>Cancel</Btn>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mob-scroll-x" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
        {[
          { label: "Customer", value: shipment.customer?.name || "—", color: C.terra },
          { label: "Total Amount", value: `${shipment.currency?.name || ""} ${fmt(shipment.amountTotal)}`, color: C.forest },
          { label: "Deliveries", value: String(shipment.pickings.length), color: C.sage },
          { label: "Shipping Line", value: shipment.shippingLine?.toUpperCase() || "—", color: C.terra },
          { label: "Weight (tons)", value: String(shipment.totalShipmentWeight || 0), color: C.amber },
        ].map((card, i) => (
          <Card key={i}>
            <div style={{ fontSize: 8, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{card.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: card.color, marginTop: 2, fontFamily: MONO }}>{card.value}</div>
          </Card>
        ))}
      </div>

      {/* Stage Timeline — clickable to update status */}
      <OdooStageTimeline
        state={shipment.state}
        shipmentStatus={shipment.shipmentStatus}
        type="sales"
        updating={updatingStage}
        onStageClick={(stageId) => {
          setUpdatingStage(true);
          updateMutation.mutate(
            { id: shipmentId, x_studio_unified_shipment_status: stageId },
            {
              onSuccess: async () => {
                await Promise.all([
                  utils.salesShipments.getById.invalidate({ id: shipmentId }),
                  utils.salesShipments.list.invalidate(),
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
          etd: shipment.etdPol,
          eta: shipment.etaPod,
          state: shipment.state,
          shipmentStatus: shipment.shipmentStatus,
          incoterm: shipment.incoterm,
          freightType: shipment.freightType,
          loadType: shipment.loadType,
          transitTimeDays: shipment.transitTimeInDays,
        }}
        type="sales"
      />

      {/* Linked Shipments Banner */}
      {shipment.correspondingPO && shipment.correspondingPO !== "—" && (() => {
        const linkedNames = shipment.correspondingPO.split(",").map((n: string) => n.trim()).filter(Boolean);
        const isMulti = linkedNames.length > 1;
        return linkedNames.map((trimmed: string, i: number) => {
          // Detect type: PO/ prefix → purchase, SO/ prefix → sales
          const isPurchase = trimmed.startsWith("PO/");
          const type: "purchase" | "sales" = isPurchase ? "purchase" : "sales";
          const label = isPurchase ? "Linked Purchase Shipment" : "Linked Sales Shipment";
          const icon = isPurchase ? "↓" : "↑";
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
              onClick={() => onNavigateToShipment?.(type, trimmed, shipment.name)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.forest; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.gBdr; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: C.forest, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, color: C.white, flexShrink: 0,
              }}>{icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: C.forest }}>
                    {trimmed}
                  </span>
                  {company && (
                    <span style={{ fontSize: 10, fontWeight: 500, fontFamily: FONT, color: C.sage }}>— {company}</span>
                  )}
                  <span style={{ fontSize: 9, opacity: 0.6 }}>↗</span>
                </div>
              </div>
              {isMulti && (
                <div style={{
                  padding: "3px 10px", borderRadius: 4,
                  background: C.forest, color: C.white,
                  fontSize: 9, fontWeight: 600, letterSpacing: 0.5,
                }}>MULTI-LINKED</div>
              )}
            </div>
          );
        });
      })()}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}` }}>
        {[
          { id: "overview", label: "Overview" },
          { id: "lines", label: "Product Lines" },
          { id: "deliveries", label: `Loads / Deliveries (${shipment.pickings.length})` },
          { id: "shipping", label: "Shipping & Logistics" },
          { id: "financial", label: "Financial" },
          { id: "documents", label: "Documents" },
        ].map(t => (
          <TabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </TabButton>
        ))}
      </div>

      {/* ─── OVERVIEW TAB ──────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Order Information</div>
            <FieldRow label="Customer" value={shipment.customer?.name || "—"} />
            <FieldRow label="Company" value={shipment.company?.name || "—"} />
            <FieldRow label="SO Creation Date" value={fmtDateStr(shipment.dateOrder)} mono />
            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div><Lbl>Incoterm</Lbl>
                  <select value={editFields.incoterm || ""} onChange={e => setEditFields(p => ({ ...p, incoterm: Number(e.target.value) || null }))} style={inputStyle}>
                    <option value="">— Not set —</option>
                    {(incoterms || []).map((i: any) => <option key={i.id} value={i.id}>{i.code} — {i.name}</option>)}
                  </select>
                </div>
                <div><Lbl>Payment Term</Lbl>
                  <select value={editFields.payment_term_id || ""} onChange={e => setEditFields(p => ({ ...p, payment_term_id: Number(e.target.value) || null }))} style={inputStyle}>
                    <option value="">— Not set —</option>
                    {(paymentTerms || []).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div><Lbl>Payment Reference Date</Lbl>
                  <input type="date" value={editFields.x_payment_reference_date || ""} onChange={e => setEditFields(p => ({ ...p, x_payment_reference_date: e.target.value }))} style={inputStyle} />
                </div>
              </div>
            ) : (
              <>
                <FieldRow label="Incoterm" value={shipment.incoterm?.name || "—"} />
                <FieldRow label="Payment Term" value={shipment.paymentTerm?.name || "—"} />
                <FieldRow label="Payment Reference Date" value={fmtDateStr(shipment.paymentReferenceDate)} mono />
              </>
            )}
            <FieldRow label="Pricelist" value={shipment.pricelist?.name || "—"} />

          </Card>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Shipment Details</div>
            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div><Lbl>Vessel Tracking Link</Lbl><input value={editFields.tracking_number} onChange={e => setEditFields(p => ({ ...p, tracking_number: e.target.value }))} style={inputStyle} placeholder="e.g. https://www.marinetraffic.com/..." /></div>
                <div><Lbl>BL Number</Lbl><input value={editFields.x_studio_shipment_bl_number} onChange={e => setEditFields(p => ({ ...p, x_studio_shipment_bl_number: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>Shipping Line</Lbl>
                  <select value={editFields.shipping_line} onChange={e => setEditFields(p => ({ ...p, shipping_line: e.target.value }))} style={inputStyle}>
                    <option value="">Select...</option>
                    {["ESL", "RCL", "ASYAD", "MAERSK", "CMA", "MSC", "Unifeeder", "WANHAI", "Transmar", "Hapag-Lloyd", "ONE", "COSCO", "PIL", "VASCO", "CSL"].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div><Lbl>Booking Number</Lbl><input value={editFields.booking_number || ""} onChange={e => setEditFields(p => ({ ...p, booking_number: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>Freight Type</Lbl>
                  <select value={editFields.freight_type} onChange={e => setEditFields(p => ({ ...p, freight_type: e.target.value }))} style={inputStyle}>
                    <option value="">Select...</option>
                    <option value="ocean">Ocean</option><option value="land">Land</option><option value="air">Air</option>
                  </select>
                </div>
                <div><Lbl>Load Type</Lbl>
                  <select value={editFields.load_type} onChange={e => setEditFields(p => ({ ...p, load_type: e.target.value }))} style={inputStyle}>
                    <option value="">Select...</option>
                    <option value="container_shipment">Container Shipment</option><option value="truck_load">Truck Load</option>
                  </select>
                </div>
                <div><Lbl>Ultimate Customer</Lbl><input value={editFields.x_studio_ultimate_customer} onChange={e => setEditFields(p => ({ ...p, x_studio_ultimate_customer: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl># Loads/Containers</Lbl><input type="number" value={editFields.number_of_loads} onChange={e => setEditFields(p => ({ ...p, number_of_loads: parseInt(e.target.value) || 0 }))} style={inputStyle} /></div>
                <div><Lbl>Total Weight (tons)</Lbl><input type="number" step="0.01" value={editFields.x_studio_total_shipment_weight_in_tons_sales} onChange={e => setEditFields(p => ({ ...p, x_studio_total_shipment_weight_in_tons_sales: Number(e.target.value) }))} style={inputStyle} /></div>
              </div>
            ) : (
              <>
                {shipment.trackingNumber ? (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 10, color: C.muted }}>Vessel Tracking</span>
                    <a href={shipment.trackingNumber.startsWith("http") ? shipment.trackingNumber : `https://${shipment.trackingNumber}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, fontFamily: MONO, color: C.terra, textDecoration: "underline", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shipment.trackingNumber}</a>
                  </div>
                ) : (
                  <FieldRow label="Vessel Tracking" value="—" mono />
                )}
                <FieldRow label="BL Number" value={shipment.blNumber || "—"} mono />
                <FieldRow label="Booking Number" value={shipment.bookingNumber || "—"} mono />
                <FieldRow label="Shipping Line" value={shipment.shippingLine?.toUpperCase() || "—"} />
                <FieldRow label="Freight Type" value={shipment.freightType || "—"} />
                <FieldRow label="Load Type" value={shipment.loadType || "—"} />
                <FieldRow label="Ultimate Customer" value={shipment.ultimateCustomer || "—"} />
                <FieldRow label="# Loads/Containers" value={shipment.numberOfLoads || "—"} mono />
                <FieldRow label="Total Weight" value={`${shipment.totalShipmentWeight || 0} T`} mono />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: 0.5 }}>Free Days (POD)</span>
                  <FreeDaysBadge freeDays={shipment.freeDaysDemurrage} arrivalDate={shipment.etaPod} label="POD Dem+Det" />
                </div>
                {/* Telex Release / BL Issued Toggle */}
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 8, marginTop: 8,
                    padding: "8px 10px", borderRadius: 6,
                    background: shipment.telexBLIssued ? C.gBg2 : C.rBg,
                    border: `1px solid ${shipment.telexBLIssued ? C.gBdr2 : C.rBdr}`,
                    cursor: "pointer", transition: "all .15s",
                  }}
                  onClick={() => {
                    if (!shipment.correspondingPOId) {
                      toast(
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, color: C.amber }}>⚠</span>
                          <span style={{ fontSize: 12, color: C.dark }}>No linked Purchase Order — cannot toggle Telex Release</span>
                        </div>,
                        { duration: 3000, style: { fontFamily: "'DM Sans', system-ui, sans-serif", border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.amber}`, background: C.card } }
                      );
                      return;
                    }
                    telexToggleMut.mutate(
                      { orderId: shipment.correspondingPOId, orderType: "purchase", issued: !shipment.telexBLIssued },
                    );
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: 4,
                    border: `2px solid ${shipment.telexBLIssued ? C.forest : C.terra}`,
                    background: shipment.telexBLIssued ? C.forest : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all .15s", flexShrink: 0,
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
                    <span style={{ fontSize: 8, color: C.muted, marginLeft: "auto" }}>Saving...</span>
                  )}
                </div>
              </>
            )}
           </Card>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Agents & Officers</div>
            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div><Lbl>Clearance Agent</Lbl><OdooSearchSelect value={editFields._clearance_agent} onChange={v => setEditFields(p => ({ ...p, _clearance_agent: v }))} options={partnerOptions} onSearch={setPartnerSearch} isLoading={partnersLoading} placeholder="Search partners..." /></div>
                <div><Lbl>Trucking Company</Lbl><OdooSearchSelect value={editFields._trucking_company} onChange={v => setEditFields(p => ({ ...p, _trucking_company: v }))} options={partnerOptions} onSearch={setPartnerSearch} isLoading={partnersLoading} placeholder="Search partners..." /></div>
                <div><Lbl>Ultimate Customer</Lbl><input type="text" value={editFields.x_studio_ultimate_customer} onChange={e => setEditFields(p => ({ ...p, x_studio_ultimate_customer: e.target.value }))} style={inputStyle} /></div>
              </div>
            ) : (
              <>
                <FieldRow label="Clearance Agent" value={shipment.clearanceAgent?.name || "—"} />
                <FieldRow label="Trucking Company" value={shipment.truckingCompany?.name || "—"} />

              </>
            )}
          </Card>
        </div>
      )}
      {/* ─── PRODUCT LINES TAB ─────────────────────────────────────────── */}
      {tab === "lines" && (
        <Card p={0}>
          <div className="mob-table-scroll" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>Description</Th>
                  <Th right>Qty Ordered</Th>
                  <Th right>Qty Delivered</Th>
                  <Th right>Qty Invoiced</Th>
                  <Th right>Unit Price</Th>
                  <Th right>Discount %</Th>
                  <Th right>Subtotal</Th>
                </tr>
              </thead>
              <tbody>
                {shipment.lines.map((line: any, i: number) => (
                  <tr key={line.id} style={{ background: i % 2 ? C.gBg : C.card }}>
                    <Td accent>{line.product?.name || "—"}</Td>
                    <Td>{line.description || "—"}</Td>
                    <Td right mono>{fmtQty(line.qty)} {line.uom?.name || ""}</Td>
                    <Td right mono>{fmtQty(line.qtyDelivered)}</Td>
                    <Td right mono>{fmtQty(line.qtyInvoiced)}</Td>
                    <Td right mono>{shipment.currency?.name ? `${shipment.currency.name} ` : ""}{fmt(line.priceUnit)}</Td>
                    <Td right mono>{line.discount}%</Td>
                    <Td right mono>{shipment.currency?.name ? `${shipment.currency.name} ` : ""}{fmt(line.priceSubtotal)}</Td>
                  </tr>
                ))}
                {shipment.lines.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 11 }}>No product lines</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ─── DELIVERIES TAB ────────────────────────────────────────────── */}
      {tab === "deliveries" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {shipment.pickings.length > 1 && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Btn
                small
                outline
                color={C.terra}
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
        <Card p={0}>
          <div className="mob-table-scroll" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>Delivery</Th>
                  <Th>State</Th>
                  <Th>Container #</Th>
                  <Th>Quality</Th>
                  <Th>Source</Th>
                  <Th right>Net Weight</Th>
                  <Th right>Qty (tons)</Th>
                  <Th>Scheduled</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {shipment.pickings.map((p: any, i: number) => (
                  <tr key={p.id} style={{ background: i % 2 ? C.gBg : C.card }}>
                    <Td accent mono>{p.name}</Td>
                    <Td>
                      <Badge v={PICKING_STATE_BADGE[p.state] || "default"}>
                        {PICKING_STATE_LABELS[p.state] || p.state}
                      </Badge>
                    </Td>
                    <Td mono>{p.containerNumber || "—"}</Td>
                    <Td>
                      {(() => {
                        const grade = p.loadedGrade;
                        const qs = p.qualityScore;
                        if (!grade && qs == null) return <span style={{ color: C.muted }}>—</span>;
                        const qColor = qs != null ? (qs >= 80 ? C.forest : qs >= 50 ? C.terra : qs > 0 ? C.red : C.muted) : C.sage;
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            {qs != null && (
                              <span style={{
                                display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                                background: qColor, flexShrink: 0,
                              }} />
                            )}
                            <span style={{ fontSize: 10, fontWeight: 600, color: qColor }}>
                              {grade || (qs != null ? `${qs}%` : "—")}
                            </span>
                          </div>
                        );
                      })()}
                    </Td>
                    <Td>{p.source || "—"}</Td>
                    <Td right mono>{p.netWeightTons ? fmtQty(p.netWeightTons) : "—"}</Td>
                    <Td right mono>{p.quantityTons ? fmtQty(p.quantityTons) : "—"}</Td>
                    <Td mono>{fmtDateStr(p.scheduledDate)}</Td>
                    <Td>
                      <Btn small color={C.terra} onClick={() => { setSelectedLoadId(p.id); setLoadEditing(false); setLoadEditFields({}); setLoadTab("overview"); }}>View</Btn>
                    </Td>
                  </tr>
                ))}
                {shipment.pickings.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 11 }}>
                    No deliveries yet.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        </div>
      )}

      {/* ─── SHIPPING TAB ──────────────────────────────────────────────── */}
      {tab === "shipping" && (
        <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Shipping Details</div>
            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div><Lbl>ETD (POL)</Lbl><input type="date" value={editFields.etd_pol} onChange={e => setEditFields(p => ({ ...p, etd_pol: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>ETA (POL)</Lbl><input type="date" value={editFields.eta_pol} onChange={e => setEditFields(p => ({ ...p, eta_pol: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>ETA (POD)</Lbl><input type="date" value={editFields.eta_pod} onChange={e => setEditFields(p => ({ ...p, eta_pod: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>Vessel Cut Off</Lbl><input type="date" value={editFields.vessel_cut_off} onChange={e => setEditFields(p => ({ ...p, vessel_cut_off: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>Vessel Tracking Link</Lbl><input value={editFields.vessel_tracking_link} onChange={e => setEditFields(p => ({ ...p, vessel_tracking_link: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>Rate/Container</Lbl><input value={editFields.rate_per_container_load} onChange={e => setEditFields(p => ({ ...p, rate_per_container_load: e.target.value }))} style={inputStyle} /></div>
                <div><Lbl>Transit Time (days)</Lbl><input value={editFields.transit_time_in_days} onChange={e => setEditFields(p => ({ ...p, transit_time_in_days: e.target.value }))} style={inputStyle} /></div>
              </div>
            ) : (
              <>
                <FieldRow label="Port of Loading" value={shipment.portOfLoading || "—"} />
                <FieldRow label="ETD (POL)" value={shipment.etdPol || "—"} mono />
                <FieldRow label="ETA (POL)" value={shipment.etaPol || "—"} mono />
                <FieldRow label="Port of Destination" value={shipment.portOfDestination || "—"} />
                <FieldRow label="ETA (POD)" value={shipment.etaPod || "—"} mono />
                <FieldRow label="Vessel Cut Off" value={shipment.vesselCutOff || "—"} mono />
                <FieldRow label="Vessel Tracking" value={shipment.vesselTrackingLink || "—"} />
                <FieldRow label="Rate/Container" value={shipment.ratePerContainerLoad || "—"} mono />
                <FieldRow label="Transit Time" value={shipment.transitTimeInDays || "—"} mono />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: C.sage, textTransform: "uppercase", letterSpacing: 0.5 }}>Free Days (POD)</span>
                  <FreeDaysBadge freeDays={shipment.freeDaysDemurrage} arrivalDate={shipment.etaPod} label="POD Dem+Det" />
                </div>
              </>
            )}
          </Card>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Agents</div>
            <FieldRow label="Clearance Agent" value={shipment.clearanceAgent?.name || "—"} />
            <FieldRow label="Trucking Company" value={shipment.truckingCompany?.name || "—"} />
          </Card>
        </div>
      )}

      {/* ─── FINANCIAL TAB ─────────────────────────────────────────────── */}
      {tab === "financial" && (() => {
        const termId = shipment.paymentTerm?.id;
        const invoices = invoicesQuery.data || [];
        return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Amounts Row */}
          <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Amounts</div>
              <FieldRow label="Amount (Excl. VAT)" value={`${shipment.currency?.name || ""} ${fmt(shipment.amountUntaxed)}`} mono />
              <FieldRow label="VAT Amount" value={`${shipment.currency?.name || ""} ${fmt(shipment.amountTax)}`} mono />
              <FieldRow label="Total (Incl. VAT)" value={`${shipment.currency?.name || ""} ${fmt(shipment.amountTotal)}`} mono color={C.forest} />
            </Card>
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Pricing</div>
              {editing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div><Lbl>Rate/Container</Lbl><input value={editFields.rate_per_container_load} onChange={e => setEditFields(p => ({ ...p, rate_per_container_load: e.target.value }))} style={inputStyle} /></div>
                </div>
              ) : (
                <>
                  <FieldRow label="Rate/Container" value={shipment.ratePerContainerLoad || "—"} mono />
                </>
              )}
            </Card>
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Payment</div>
              <FieldRow label="Payment Terms" value={shipment.paymentTerm?.name || "—"} />
              {editing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div><Lbl>Payment Term (Sales)</Lbl><input value={editFields.x_studio_payment_term} onChange={e => setEditFields(p => ({ ...p, x_studio_payment_term: e.target.value }))} style={inputStyle} /></div>
                  <div><Lbl>Payment Term (Purchase)</Lbl><input value={editFields.x_studio_payment_term_1} onChange={e => setEditFields(p => ({ ...p, x_studio_payment_term_1: e.target.value }))} style={inputStyle} /></div>
                  <div><Lbl>Notes (Payment)</Lbl><input value={editFields.x_studio_notespayment} onChange={e => setEditFields(p => ({ ...p, x_studio_notespayment: e.target.value }))} style={inputStyle} /></div>
                </div>
              ) : (
                <>
                  <FieldRow label="Payment Term (Sales)" value={shipment.paymentTermSales || "—"} />
                  <FieldRow label="Payment Term (Purchase)" value={shipment.paymentTermPurchase || "—"} />
                  <FieldRow label="Notes (Payment)" value={shipment.notesPayment || "—"} />
                </>
              )}
            </Card>
          </div>
          {/* Payment Schedule */}
          {termId && <SalesPaymentScheduleCard termId={termId} totalAmount={shipment.amountTotal} currency={shipment.currency?.name || ""} />}
          {/* Invoicing Entities Row */}
          <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Invoicing Entities</div>
              {editing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div><Lbl>Ocean Freight Invoiced Entity</Lbl><input value={editFields.x_studio_ocean_freight_invoiced_entity} onChange={e => setEditFields(p => ({ ...p, x_studio_ocean_freight_invoiced_entity: e.target.value }))} style={inputStyle} /></div>
                  <div><Lbl>Ocean Freight Invoicing Entity</Lbl><input value={editFields.x_studio_ocean_freight_invoicing_entity} onChange={e => setEditFields(p => ({ ...p, x_studio_ocean_freight_invoicing_entity: e.target.value }))} style={inputStyle} /></div>
                  <div><Lbl>Clearance/Trucking Invoiced Entity</Lbl><input value={editFields.x_studio_clearance_trucking_invoiced_entity} onChange={e => setEditFields(p => ({ ...p, x_studio_clearance_trucking_invoiced_entity: e.target.value }))} style={inputStyle} /></div>
                  <div><Lbl>Clearance/Trucking Invoicing Entity</Lbl><input value={editFields.x_studio_clearance_trucking_invoicing_entity} onChange={e => setEditFields(p => ({ ...p, x_studio_clearance_trucking_invoicing_entity: e.target.value }))} style={inputStyle} /></div>
                </div>
              ) : (
                <>
                  <FieldRow label="OF Invoiced Entity" value={shipment.oceanFreightInvoicedEntity || "—"} />
                  <FieldRow label="OF Invoicing Entity" value={shipment.oceanFreightInvoicingEntity || "—"} />
                  <FieldRow label="CT Invoiced Entity" value={shipment.clearanceTruckingInvoicedEntity || "—"} />
                  <FieldRow label="CT Invoicing Entity" value={shipment.clearanceTruckingInvoicingEntity || "—"} />
                </>
              )}
            </Card>
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, marginBottom: 8 }}>Additional Notes</div>
              <FieldRow label="Notes (Payment)" value={shipment.notesPayment || "—"} />
              <FieldRow label="Notes (Payment 2)" value={shipment.notesPayment1 || "—"} />
            </Card>
          </div>
          {/* Invoice Tracking */}
          <Card p={0}>
            <CardHdr gradient><CHT>Linked Invoices</CHT><CHB>{invoices.length}</CHB></CardHdr>
            <div style={{ padding: 12 }}>
              {invoicesQuery.isLoading ? (
                <div style={{ textAlign: "center", padding: 16, color: C.muted, fontSize: 11 }}>Loading invoices...</div>
              ) : invoices.length === 0 ? (
                <div style={{ textAlign: "center", padding: 16, color: C.muted, fontSize: 11 }}>No linked invoices found</div>
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
                            <td style={{ padding: "6px 8px", fontFamily: MONO }}>{inv.invoiceDate ? fmtDateStr(inv.invoiceDate) : "\u2014"}</td>
                            <td style={{ padding: "6px 8px", fontFamily: MONO }}>{inv.dueDate ? fmtDateStr(inv.dueDate) : "\u2014"}</td>
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

      {/* ─── DOCUMENTS TAB ─────────────────────────────────────────────── */}
      {tab === "documents" && (() => {
        const SO_DOCS = [
          { field: "x_studio_boe", label: "Bill of Entry", category: "customs" },
          { field: "x_studio_egypt_tax_portal_invoice", label: "Egypt Tax Portal Invoice", category: "customs" },
          { field: "x_studio_other_governmental_documents", label: "Other Governmental Docs", category: "customs" },
          { field: "x_studio_invoices_part_1", label: "Invoices Part 1", category: "invoices" },
          { field: "x_studio_invoices_part_2", label: "Invoices Part 2", category: "invoices" },
          { field: "x_studio_invoices_part_3", label: "Invoices Part 3", category: "invoices" },
          { field: "x_studio_payments_part_1", label: "Payments Part 1", category: "financial" },
          { field: "x_studio_payments_part_2", label: "Payments Part 2", category: "financial" },
          { field: "x_studio_payments_part_3", label: "Payments Part 3", category: "financial" },

        ];
        const customsDocs = SO_DOCS.filter(d => d.category === "customs" || d.category === "invoices");
        const financialDocs = SO_DOCS.filter(d => d.category === "financial");
        const customsUploaded = customsDocs.filter(d => uploadedFiles[`so-${d.field}`]).length;
        const financialUploaded = financialDocs.filter(d => uploadedFiles[`so-${d.field}`]).length;
        return (
          <div className="mob-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* Customs & Invoices Card */}
            <Card p={0}>
              <CardHdr><CHT>Customs & Invoices</CHT><CHB>{customsUploaded}/{customsDocs.length}</CHB></CardHdr>
              <div style={{ padding: 12 }}>
                <Bar v={customsUploaded} max={customsDocs.length} color={C.terra} />
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 10 }}>
                  {customsDocs.map(doc => {
                    const isUploaded = uploadedFiles[`so-${doc.field}`];
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
                            <input type="checkbox" checked={isHardCopyReceived} onChange={() => { setTogglingHardCopyField(doc.field); toggleHardCopyMutation.mutate({ odooOrderId: Number(shipmentId), orderType: "sales", documentField: doc.field, received: !isHardCopyReceived }); }} style={{ width: 12, height: 12, accentColor: C.forest, cursor: "pointer" }} />
                          )}
                          Hard Copy
                        </label>
                        <div style={{ display: "flex", gap: 4 }}>
                          {isUploaded && <button onClick={() => handleFilePreview("so", shipment.id, doc.field, doc.label)} style={{
                            background: C.gBg2, border: `1px solid ${C.gBdr2}`,
                            borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 600,
                            color: C.forest, cursor: "pointer", fontFamily: FONT,
                          }}>Preview</button>}
                          <button onClick={() => handleFileUpload("so", shipment.id, doc.field)} style={{
                            background: isUploaded ? C.rBg : C.gBg2, border: `1px solid ${isUploaded ? C.rBdr : C.gBdr2}`,
                            borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 600,
                            color: isUploaded ? C.red : C.forest, cursor: "pointer", fontFamily: FONT,
                          }}>{uploadSOFileMutation.isPending ? "..." : isUploaded ? "Replace" : "Upload"}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
            {/* Financial Documents Card */}
            <Card p={0}>
              <CardHdr gradient><CHT>Financial Documents</CHT><CHB>{financialUploaded}/{financialDocs.length}</CHB></CardHdr>
              <div style={{ padding: 12 }}>
                <Bar v={financialUploaded} max={financialDocs.length} color={C.forest} />
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 10 }}>
                  {financialDocs.map(doc => {
                    const isUploaded = uploadedFiles[`so-${doc.field}`];
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
                            <input type="checkbox" checked={isHardCopyReceived} onChange={() => { setTogglingHardCopyField(doc.field); toggleHardCopyMutation.mutate({ odooOrderId: Number(shipmentId), orderType: "sales", documentField: doc.field, received: !isHardCopyReceived }); }} style={{ width: 12, height: 12, accentColor: C.forest, cursor: "pointer" }} />
                          )}
                          Hard Copy
                        </label>
                        <div style={{ display: "flex", gap: 4 }}>
                          {isUploaded && <button onClick={() => handleFilePreview("so", shipment.id, doc.field, doc.label)} style={{
                            background: C.gBg2, border: `1px solid ${C.gBdr2}`,
                            borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 600,
                            color: C.forest, cursor: "pointer", fontFamily: FONT,
                          }}>Preview</button>}
                          <button onClick={() => handleFileUpload("so", shipment.id, doc.field)} style={{
                            background: isUploaded ? C.rBg : C.gBg2, border: `1px solid ${isUploaded ? C.rBdr : C.gBdr2}`,
                            borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 600,
                            color: isUploaded ? C.red : C.forest, cursor: "pointer", fontFamily: FONT,
                          }}>{uploadSOFileMutation.isPending ? "..." : isUploaded ? "Replace" : "Upload"}</button>
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
          onClose={() => setPreviewFile(null)}
          onReplace={() => {
            setPreviewFile(null);
            previewReplaceRef.current?.();
          }}
        />
      )}
      {previewLoading && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998,
        }}>
          <div style={{ background: C.card, padding: 24, borderRadius: 12, fontSize: 12, fontWeight: 600, color: C.forest }}>Loading preview...</div>
        </div>
      )}
    </div>
  );
}
