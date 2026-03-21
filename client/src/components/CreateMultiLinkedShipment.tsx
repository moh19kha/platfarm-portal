/**
 * CreateMultiLinkedShipment — Multi-step wizard to create linked Purchase/Sales
 * shipments across multiple companies in one go.
 *
 * Steps:
 *  1. Company & Shipment Type Selection (checkboxes + vendor/customer per company + warehouse)
 *  2. Product Lines (shared across all shipments, with stock display per warehouse for sales)
 *  3. Shipping Details (shared: POL, POD, vessel, booking, etc.)
 *  4. Review & Create
 */
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { C, FONT, MONO } from "@/lib/data";
import { Btn } from "@/components/ui-primitives";
import { SearchableProductSelect } from "@/components/SearchableProductSelect";
import { ViewStockButton } from "@/components/StockViewerPopup";
import { PortSelector } from "@/components/PortSelector";
import { CreationProgressModal } from "@/components/CreationProgressModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Props {
  activeCompanyId: number | "ALL";
  onClose: () => void;
  onCreated: (ids: { purchaseIds: number[]; salesIds: number[] }) => void;
  draftId?: number;
}

/** Per-company shipment configuration */
interface CompanyShipmentConfig {
  companyId: number;
  companyName: string;
  enabled: boolean;
  createPurchase: boolean;
  createSales: boolean;
  purchaseVendorId: number;
  salesCustomerId: number;
  purchaseAgreementId: number;
  salesAgreementId: number;
  purchaseCurrencyId: number;
  salesCurrencyId: number;
  incotermId: number;
  paymentTermId: number;
  purchasePickingTypeId: number;  // picking_type_id for PO (incoming)
  salesWarehouseId: number;       // warehouse_id for SO (derived from location)
  purchaseLocationId: number;     // stock.location id for PO (destination location)
  salesLocationId: number;        // stock.location id for SO (source location)
}

interface LineInput {
  product_id: number;
  product_qty: number;
  price_unit: number;
  product_uom: number;
  tax_rate: number; // VAT percentage: 0, 5, 14, or 15
}

const VAT_OPTIONS = [
  { value: 0, label: "0%" },
  { value: 5, label: "5%" },
  { value: 14, label: "14%" },
  { value: 15, label: "15%" },
];

interface ShippingForm {
  number_of_loads: number;
  vessel_name: string;
  booking_number: string;
  tracking_link: string;
  pol: string;
  etd_pol: string;
  eta_pol: string;
  pod: string;
  eta_pod: string;
  vessel_cut_off: string;
  pol_free_days_demurrage: number;
  pol_free_days_detention: number;
  pod_free_days_demurrage: number;
  pod_free_days_detention: number;
  freight_type: string;
  load_type: string;
  shipping_line: string;
  ultimate_customer: string;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "6px 10px", borderWidth: 1, borderStyle: "solid", borderColor: C.inputBdr,
  borderRadius: 6, fontSize: 11, fontFamily: FONT, outline: "none", background: C.gBg,
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

const Lbl = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 9, fontWeight: 600, color: C.sage, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</div>
);

const SectionTitle = ({ children, color }: { children: React.ReactNode; color?: string }) => (
  <div style={{
    gridColumn: "1 / -1", borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 6,
  }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: color || C.forest, marginBottom: 4 }}>{children}</div>
  </div>
);

export function CreateMultiLinkedShipment({ activeCompanyId, onClose, onCreated, draftId }: Props) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const submittingRef = useRef(false);
  const [creationProgress, setCreationProgress] = useState("");
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [creationError, setCreationError] = useState("");
  const [creationSuccess, setCreationSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [createdShipmentDetails, setCreatedShipmentDetails] = useState<{ label: string; id: string }[]>([]);
  const [finalCreatedIds, setFinalCreatedIds] = useState<{ purchaseIds: number[]; salesIds: number[] }>({ purchaseIds: [], salesIds: [] });
  const [currentDraftId, setCurrentDraftId] = useState<number | undefined>(draftId);
  const [draftSaved, setDraftSaved] = useState(false);
  const [distributeWeightEqually, setDistributeWeightEqually] = useState(true);

  // ─── Lookups ────────────────────────────────────────────────────────
  const { data: companies } = trpc.odoo.companies.useQuery();
  const { data: currencies } = trpc.odoo.currencies.useQuery();
  const { data: uoms } = trpc.odoo.uoms.useQuery();
  const { data: allPurchaseAgreements } = trpc.odoo.purchaseAgreements.useQuery();
  const { data: salesAgreements } = trpc.odoo.salesAgreements.useQuery();
  const { data: incoterms } = trpc.shipments.incoterms.useQuery();
  const { data: paymentTerms } = trpc.shipments.paymentTerms.useQuery();
  const { data: allPickingTypes } = trpc.odoo.pickingTypes.useQuery({ code: "incoming" });
  const { data: allStockLocations } = trpc.shipments.stockLocations.useQuery({});

  // Per-company vendor/customer data will be fetched after configs are initialized

  const createPurchaseMutation = trpc.shipments.create.useMutation();
  const createSalesMutation = trpc.salesShipments.create.useMutation();
  const updatePurchaseMutation = trpc.shipments.update.useMutation();
  const updateSalesMutation = trpc.salesShipments.update.useMutation();
  const trpcUtils = trpc.useUtils();
  const saveDraftMutation = trpc.drafts.save.useMutation();
  const deleteDraftMutation = trpc.drafts.delete.useMutation();
  const { data: existingDraft } = trpc.drafts.getById.useQuery(
    { id: draftId! },
    { enabled: !!draftId }
  );

  // Restore draft data when loaded
  useEffect(() => {
    if (existingDraft?.formData) {
      const d = existingDraft.formData as any;
      if (d.configs) setConfigs(d.configs);
      if (d.linesByCompany) setLinesByCompany(d.linesByCompany);
      // Backward compat: restore old shared lines format into per-company
      // NOTE: Old drafts had shared product lines — products may not be valid for all companies.
      // We copy qty/price/uom but reset product_id to 0 so users must re-select products per company.
      else if (d.lines && d.configs) {
        const lbc: Record<number, LineInput[]> = {};
        for (const cfg of d.configs) {
          if (cfg.enabled) {
            lbc[cfg.companyId] = d.lines.map((l: LineInput) => ({
              ...l,
              product_id: 0, // Reset — user must re-select per-company product
            }));
          }
        }
        setLinesByCompany(lbc);
      }
      if (d.shipping) setShipping(d.shipping);
      if (d.step) setStep(d.step);
      if (d.distributeWeightEqually !== undefined) setDistributeWeightEqually(d.distributeWeightEqually);
    }
  }, [existingDraft]);

  const handleSaveDraft = async () => {
    try {
      const enabledNames = configs.filter(c => c.enabled).map(c => {
        const comp = companies?.find(co => co.id === c.companyId);
        return comp?.name || "";
      }).filter(Boolean);
      const label = enabledNames.join(" + ") || "Multi-Linked Draft";
      const result = await saveDraftMutation.mutateAsync({
        id: currentDraftId,
        wizardType: "multi_linked",
        currentStep: step,
        label,
        formData: { configs, linesByCompany, shipping, step, distributeWeightEqually },
      });
      setCurrentDraftId(result.id);
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch (e: any) {
      setError(e.message || "Failed to save draft");
    }
  };

  // ─── Default UoM to kg ──────────────────────────────────────────────
  const kgUomId = useMemo(() => {
    if (!uoms) return 0;
    const kg = uoms.find(u => u.name.toLowerCase() === "kg");
    return kg ? kg.id : (uoms[0]?.id || 0);
  }, [uoms]);

  // ─── Company Configs ────────────────────────────────────────────────
  const [configs, setConfigs] = useState<CompanyShipmentConfig[]>([]);

  // Initialize configs when companies load
  useMemo(() => {
    if (companies && configs.length === 0) {
      setConfigs(companies.map(c => ({
        companyId: c.id,
        companyName: c.name,
        enabled: false,
        createPurchase: false,
        createSales: false,
        purchaseVendorId: 0,
        salesCustomerId: 0,
        purchaseAgreementId: 0,
        salesAgreementId: 0,
        purchaseCurrencyId: 0,
        salesCurrencyId: 0,
        incotermId: 0,
        paymentTermId: 0,
        purchasePickingTypeId: 0,
        salesWarehouseId: 0,
        purchaseLocationId: 0,
        salesLocationId: 0,
      })));
    }
  }, [companies]);

  const enabledConfigs = configs.filter(c => c.enabled && (c.createPurchase || c.createSales));

  // ─── Per-company vendor/customer queries ────────────────────────────
  // React hooks must be called unconditionally, so we call for each slot (up to 5 companies)
  const vendorQ1 = trpc.odoo.vendors.useQuery({ companyId: configs[0]?.companyId }, { enabled: configs.length > 0 && !!configs[0]?.enabled && !!configs[0]?.createPurchase });
  const vendorQ2 = trpc.odoo.vendors.useQuery({ companyId: configs[1]?.companyId }, { enabled: configs.length > 1 && !!configs[1]?.enabled && !!configs[1]?.createPurchase });
  const vendorQ3 = trpc.odoo.vendors.useQuery({ companyId: configs[2]?.companyId }, { enabled: configs.length > 2 && !!configs[2]?.enabled && !!configs[2]?.createPurchase });
  const vendorQ4 = trpc.odoo.vendors.useQuery({ companyId: configs[3]?.companyId }, { enabled: configs.length > 3 && !!configs[3]?.enabled && !!configs[3]?.createPurchase });
  const vendorQ5 = trpc.odoo.vendors.useQuery({ companyId: configs[4]?.companyId }, { enabled: configs.length > 4 && !!configs[4]?.enabled && !!configs[4]?.createPurchase });

  const customerQ1 = trpc.odoo.customers.useQuery({ companyId: configs[0]?.companyId }, { enabled: configs.length > 0 && !!configs[0]?.enabled && !!configs[0]?.createSales });
  const customerQ2 = trpc.odoo.customers.useQuery({ companyId: configs[1]?.companyId }, { enabled: configs.length > 1 && !!configs[1]?.enabled && !!configs[1]?.createSales });
  const customerQ3 = trpc.odoo.customers.useQuery({ companyId: configs[2]?.companyId }, { enabled: configs.length > 2 && !!configs[2]?.enabled && !!configs[2]?.createSales });
  const customerQ4 = trpc.odoo.customers.useQuery({ companyId: configs[3]?.companyId }, { enabled: configs.length > 3 && !!configs[3]?.enabled && !!configs[3]?.createSales });
  const customerQ5 = trpc.odoo.customers.useQuery({ companyId: configs[4]?.companyId }, { enabled: configs.length > 4 && !!configs[4]?.enabled && !!configs[4]?.createSales });

  // Build lookup maps: companyId -> vendors/customers
  const vendorsByCompany = useMemo(() => {
    const map = new Map<number, { id: number; name: string }[]>();
    const queries = [vendorQ1, vendorQ2, vendorQ3, vendorQ4, vendorQ5];
    configs.forEach((cfg, i) => {
      if (i < queries.length && queries[i]?.data) map.set(cfg.companyId, queries[i].data!);
    });
    return map;
  }, [configs, vendorQ1.data, vendorQ2.data, vendorQ3.data, vendorQ4.data, vendorQ5.data]);

  const customersByCompany = useMemo(() => {
    const map = new Map<number, { id: number; name: string }[]>();
    const queries = [customerQ1, customerQ2, customerQ3, customerQ4, customerQ5];
    configs.forEach((cfg, i) => {
      if (i < queries.length && queries[i]?.data) map.set(cfg.companyId, queries[i].data!);
    });
    return map;
  }, [configs, customerQ1.data, customerQ2.data, customerQ3.data, customerQ4.data, customerQ5.data]);

  // ─── Per-Company Product Lines ──────────────────────────────────────
  // Each company gets its own product lines since Odoo products are company-specific
  const [linesByCompany, setLinesByCompany] = useState<Record<number, LineInput[]>>({});

  // Initialize lines for newly enabled companies
  useEffect(() => {
    setLinesByCompany(prev => {
      const next = { ...prev };
      let changed = false;
      for (const cfg of enabledConfigs) {
        if (!next[cfg.companyId]) {
          next[cfg.companyId] = [{ product_id: 0, product_qty: 0, price_unit: 0, product_uom: kgUomId || 0, tax_rate: 0 }];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [enabledConfigs, kgUomId]);

  // Set default UoM when uoms load
  useEffect(() => {
    if (kgUomId) {
      setLinesByCompany(prev => {
        const next: Record<number, LineInput[]> = {};
        let changed = false;
        for (const [cid, lines] of Object.entries(prev)) {
          const updated = lines.map(l => l.product_uom === 0 ? { ...l, product_uom: kgUomId } : l);
          if (updated.some((l, i) => l !== lines[i])) changed = true;
          next[Number(cid)] = updated;
        }
        return changed ? next : prev;
      });
    }
  }, [kgUomId]);

  const addLine = (companyId: number) => setLinesByCompany(prev => ({
    ...prev,
    [companyId]: [...(prev[companyId] || []), { product_id: 0, product_qty: 0, price_unit: 0, product_uom: kgUomId || 0, tax_rate: 0 }],
  }));
  const removeLine = (companyId: number, idx: number) => setLinesByCompany(prev => ({
    ...prev,
    [companyId]: (prev[companyId] || []).filter((_, i) => i !== idx),
  }));
  const updateLine = (companyId: number, idx: number, field: keyof LineInput, value: number) => {
    setLinesByCompany(prev => ({
      ...prev,
      [companyId]: (prev[companyId] || []).map((l, i) => i === idx ? { ...l, [field]: value } : l),
    }));
  };

  // Backward compat: flat list of all lines (for stock queries)
  const allLines = useMemo(() => {
    return Object.values(linesByCompany).flat();
  }, [linesByCompany]);

  // ─── Shipping Details (shared) ──────────────────────────────────────
  const [shipping, setShipping] = useState<ShippingForm>({
    number_of_loads: 0,
    vessel_name: "",
    booking_number: "",
    tracking_link: "",
    pol: "",
    etd_pol: "",
    eta_pol: "",
    pod: "",
    eta_pod: "",
    vessel_cut_off: "",
    pol_free_days_demurrage: 0,
    pol_free_days_detention: 0,
    pod_free_days_demurrage: 0,
    pod_free_days_detention: 0,
    freight_type: "",
    load_type: "",
    shipping_line: "",
    ultimate_customer: "",
  });

  // ─── Stock Locations grouped by company for dropdowns ───────────────
  const locationsByCompany = useMemo(() => {
    if (!allStockLocations) return new Map<number, typeof allStockLocations>();
    const map = new Map<number, typeof allStockLocations>();
    for (const loc of allStockLocations) {
      if (!map.has(loc.companyId)) map.set(loc.companyId, []);
      map.get(loc.companyId)!.push(loc);
    }
    return map;
  }, [allStockLocations]);

  // Group locations by warehouse within a company for optgroup display
  const getLocationsByWarehouse = useCallback((companyId: number) => {
    const locs = locationsByCompany.get(companyId) || [];
    const groups = new Map<string, typeof locs>();
    for (const loc of locs) {
      const whName = loc.warehouseName || "Other";
      if (!groups.has(whName)) groups.set(whName, []);
      groups.get(whName)!.push(loc);
    }
    return Array.from(groups.entries()).map(([warehouseName, locations]) => ({ warehouseName, locations }));
  }, [locationsByCompany]);

  // ─── Stock Queries for Sales Locations ──────────────────────────────
  const productIds = useMemo(() => {
    return allLines.filter(l => l.product_id > 0).map(l => l.product_id);
  }, [allLines]);

  // Get unique location IDs from sales configs
  const salesLocationIds = useMemo(() => {
    return Array.from(new Set(enabledConfigs.filter(c => c.createSales && c.salesLocationId > 0).map(c => c.salesLocationId)));
  }, [enabledConfigs]);

  // Query stock for all sales locations
  const { data: allStockData } = trpc.shipments.productStockByLocation.useQuery(
    { productIds },
    { enabled: productIds.length > 0 && salesLocationIds.length > 0 }
  );

  // Build stock lookup: locationId -> productId -> available qty
  const stockByLocation = useMemo(() => {
    const map = new Map<number, Map<number, number>>();
    if (!allStockData) return map;
    for (const s of allStockData) {
      if (!map.has(s.locationId)) map.set(s.locationId, new Map());
      const locMap = map.get(s.locationId)!;
      locMap.set(s.productId, (locMap.get(s.productId) || 0) + s.availableQuantity);
    }
    return map;
  }, [allStockData]);

   // ─── Stock Validation for all sales configs ─────────────────────
  const stockErrors = useMemo(() => {
    const errors: { companyName: string; locationId: number; locationName: string; productId: number; requested: number; available: number; hasLinkedPurchase: boolean }[] = [];

    for (const cfg of enabledConfigs) {
      if (!cfg.createSales || !cfg.salesLocationId) continue;
      const companyLines = (linesByCompany[cfg.companyId] || []).filter(l => l.product_id > 0 && l.product_qty > 0);
      const locStock = stockByLocation.get(cfg.salesLocationId);
      const locName = allStockLocations?.find(l => l.id === cfg.salesLocationId)?.completeName || "Unknown";
      // If this company also has a linked purchase, the purchase will bring inventory in
      const hasLinkedPurchase = cfg.createPurchase;
      for (const line of companyLines) {
        const available = locStock?.get(line.product_id) ?? 0;
        if (line.product_qty > available) {
          errors.push({
            companyName: cfg.companyName,
            locationId: cfg.salesLocationId,
            locationName: locName,
            productId: line.product_id,
            requested: line.product_qty,
            available,
            hasLinkedPurchase,
          });
        }
      }
    }
    return errors;
  }, [enabledConfigs, linesByCompany, stockByLocation, allStockLocations]);

  // Only block when there are stock errors for sales-only configs (no linked purchase)
  const blockingStockErrors = useMemo(() => {
    return stockErrors.filter(e => !e.hasLinkedPurchase);
  }, [stockErrors]);

  // ─── Config Updater ─────────────────────────────────────────────────
  const updateConfig = useCallback((companyId: number, updates: Partial<CompanyShipmentConfig>) => {
    setConfigs(prev => prev.map(c => c.companyId === companyId ? { ...c, ...updates } : c));
  }, []);

  // ─── Picking type helpers ───────────────────────────────────────────
  const getCompanyPickingTypes = useCallback((companyId: number) => {
    return (allPickingTypes || []).filter(pt => pt.companyId === companyId);
  }, [allPickingTypes]);

  // ─── Validation ─────────────────────────────────────────────────────
  const validateStep1 = () => {
    if (enabledConfigs.length === 0) return "Please select at least one company with Purchase or Sales enabled.";
    for (const cfg of enabledConfigs) {
      if (cfg.createPurchase && !cfg.purchaseVendorId) return `Please select a vendor for ${cfg.companyName} (Purchase).`;
      if (cfg.createPurchase && !cfg.purchaseLocationId) return `Please select a destination location for ${cfg.companyName} (Purchase).`;
      if (cfg.createSales && !cfg.salesCustomerId) return `Please select a customer for ${cfg.companyName} (Sales).`;
      if (cfg.createSales && !cfg.salesLocationId) return `Please select a source location for ${cfg.companyName} (Sales).`;
    }
    return null;
  };

  const validateStep2 = () => {
    for (const cfg of enabledConfigs) {
      const companyLines = (linesByCompany[cfg.companyId] || []).filter(l => l.product_id > 0);
      if (companyLines.length === 0) return `Please add at least one product line for ${cfg.companyName}.`;
      for (let i = 0; i < companyLines.length; i++) {
        if (!companyLines[i].product_qty || companyLines[i].product_qty <= 0) return `${cfg.companyName} Line ${i + 1}: Please enter a valid quantity.`;
        if (!companyLines[i].price_unit || companyLines[i].price_unit <= 0) return `${cfg.companyName} Line ${i + 1}: Please enter a valid unit price.`;
      }
    }
    // Stock validation — only block when sales-only (no linked purchase) has insufficient stock
    if (blockingStockErrors.length > 0) {
      return "Cannot proceed: one or more sales-only products have insufficient inventory at the selected locations. Please adjust quantities or select different products.";
    }
    return null;
  };

  const goNext = () => {
    setError("");
    if (step === 1) {
      const err = validateStep1();
      if (err) { setError(err); return; }
    }
    if (step === 2) {
      const err = validateStep2();
      if (err) { setError(err); return; }
    }
    setStep(s => s + 1);
  };

  // ─── Confirm Dialog ──────────────────────────────────────────────────
  const handleRequestCreate = useCallback(() => {
    setError("");
    // Re-validate before showing confirm
    const err1 = validateStep1();
    if (err1) { setError(err1); return; }
    const err2 = validateStep2();
    if (err2) { setError(err2); return; }
    setShowConfirm(true);
  }, [enabledConfigs, linesByCompany, blockingStockErrors]);

  const confirmSummary = useMemo(() => {
    const purchaseCount = enabledConfigs.filter(c => c.createPurchase).length;
    const salesCount = enabledConfigs.filter(c => c.createSales).length;
    const companyNames = enabledConfigs.map(c => c.companyName);
    let totalQty = 0;
    let totalValue = 0;
    for (const cfg of enabledConfigs) {
      const companyLines = (linesByCompany[cfg.companyId] || []).filter(l => l.product_id > 0);
      totalQty += companyLines.reduce((s, l) => s + (l.product_qty || 0), 0);
      totalValue += companyLines.reduce((s, l) => s + (l.product_qty || 0) * (l.price_unit || 0), 0);
    }
    return { purchaseCount, salesCount, companyNames, totalQty, totalValue };
  }, [enabledConfigs, linesByCompany]);

  // ─── Bulk Creation ──────────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    if (submittingRef.current) return;
    // Don't close ConfirmDialog here — CreationProgressModal (z-index 10000) renders on top.
    // Closing it causes a race condition where the wizard backdrop click fires.
    setError("");
    submittingRef.current = true;
    setCreating(true);
    setCompletedSteps([]);
    setCreationError("");
    const purchaseIds: number[] = [];
    const salesIds: number[] = [];
    // Track which IDs are PO vs SO for linking
    const createdShipments: { id: number; type: "purchase" | "sales"; companyName: string }[] = [];
    // Track fetched shipment names for display on success
    const shipmentNames: { id: number; type: "purchase" | "sales"; name: string }[] = [];

    try {
      for (const cfg of enabledConfigs) {
        // Create Purchase Order
        if (cfg.createPurchase) {
          setCreationProgress(`Creating Purchase for ${cfg.companyName}...`);
          const companyLines = (linesByCompany[cfg.companyId] || []).filter(l => l.product_id > 0);
          const payload: any = {
            partner_id: cfg.purchaseVendorId,
            company_id: cfg.companyId,
            picking_type_id: cfg.purchasePickingTypeId || undefined,
            lines: companyLines.map(l => ({
              product_id: l.product_id,
              product_qty: l.product_qty,
              price_unit: l.price_unit,
              product_uom: l.product_uom || undefined,
            })),
          };
          if (cfg.purchaseCurrencyId) payload.currency_id = cfg.purchaseCurrencyId;
          if (cfg.purchaseAgreementId) payload.requisition_id = cfg.purchaseAgreementId;
          if (cfg.incotermId) payload.incoterm_id = cfg.incotermId;
          if (cfg.paymentTermId) payload.payment_term_id = cfg.paymentTermId;
          if (shipping.number_of_loads) payload.number_of_loads = shipping.number_of_loads;
          payload.distribute_weight_equally = distributeWeightEqually;
          if (shipping.vessel_name) payload.x_studio_vessel_name = shipping.vessel_name;
          if (shipping.booking_number) payload.x_studio_booking_number = shipping.booking_number;
          if (shipping.tracking_link) payload.x_studio_tracking_number = shipping.tracking_link;
          if (shipping.pol) payload.pol_source = shipping.pol;
          if (shipping.pod) payload.pod_source = shipping.pod;
          if (shipping.etd_pol) payload.x_studio_etd_pol = shipping.etd_pol;
          if (shipping.eta_pol) payload.x_studio_eta_pol = shipping.eta_pol;
          if (shipping.eta_pod) payload.eta_arrival = shipping.eta_pod;
          if (shipping.vessel_cut_off) payload.x_studio_vessel_cut_off = shipping.vessel_cut_off;
          // Map POD free days (demurrage + detention) to the single Odoo field
          const podFreeDaysTotal = (shipping.pod_free_days_demurrage || 0) + (shipping.pod_free_days_detention || 0);
          if (podFreeDaysTotal > 0) payload.x_studio_total_free_days_demurrage_detention = podFreeDaysTotal;
          if (shipping.freight_type) payload.freight_type = shipping.freight_type;
          if (shipping.load_type) payload.load_type = shipping.load_type;
          if (shipping.shipping_line) {
            // Map SO-format shipping line values (uppercase) to PO-format (lowercase)
            const soToPo: Record<string, string> = {
              "ESL": "esl", "RCL": "rcl", "ASYAD": "asyad", "MAERSK": "maersk",
              "CMA": "cma", "MSC": "msc", "Unifeeder": "unifeeder", "WANHAI": "wanhai",
              "Transmar": "transmar", "Hapag-Lloyd": "hapag_lloyd", "ONE": "one",
              "COSCO": "cosco", "PIL": "pil", "VASCO": "vasco", "CSL": "csl",
            };
            payload.ocean_transporter_company = soToPo[shipping.shipping_line] || shipping.shipping_line.toLowerCase();
          }
          if (shipping.ultimate_customer) payload.x_studio_ultimate_customer = shipping.ultimate_customer;

          const result = await createPurchaseMutation.mutateAsync(payload);
          purchaseIds.push(result.id);
          createdShipments.push({ id: result.id, type: "purchase", companyName: cfg.companyName });
          setCompletedSteps(prev => [...prev, `Purchase Order created for ${cfg.companyName}`]);
        }

        // Create Sales Order
        if (cfg.createSales) {
          setCreationProgress(`Creating Sales for ${cfg.companyName}...`);
          const salesCompanyLines = (linesByCompany[cfg.companyId] || []).filter(l => l.product_id > 0);
          const payload: any = {
            partner_id: cfg.salesCustomerId,
            company_id: cfg.companyId,
            warehouse_id: cfg.salesWarehouseId || undefined,
            lines: salesCompanyLines.map(l => ({
              product_id: l.product_id,
              product_uom_qty: l.product_qty,
              price_unit: l.price_unit,
              product_uom: l.product_uom || undefined,
              discount: 0,
            })),
          };
          if (cfg.salesCurrencyId) payload.currency_id = cfg.salesCurrencyId;
          if (cfg.incotermId) payload.incoterm = cfg.incotermId;
          if (cfg.paymentTermId) payload.payment_term_id = cfg.paymentTermId;
          if (cfg.salesAgreementId) payload.sale_order_template_id = cfg.salesAgreementId;
          if (shipping.number_of_loads) payload.number_of_loads = shipping.number_of_loads;
          payload.distribute_weight_equally = distributeWeightEqually;
          if (shipping.booking_number) payload.booking_number = shipping.booking_number;
          if (shipping.tracking_link) payload.tracking_number = shipping.tracking_link;
          if (shipping.pol) payload.pol = shipping.pol;
          if (shipping.pod) payload.pod = shipping.pod;
          if (shipping.etd_pol) payload.etd_pol = shipping.etd_pol;
          if (shipping.eta_pol) payload.eta_pol = shipping.eta_pol;
          if (shipping.eta_pod) payload.eta_pod = shipping.eta_pod;
          if (shipping.freight_type) payload.freight_type = shipping.freight_type;
          if (shipping.load_type) payload.load_type = shipping.load_type;
          if (shipping.shipping_line) payload.shipping_line = shipping.shipping_line;
          if (shipping.ultimate_customer) payload.x_studio_ultimate_customer = shipping.ultimate_customer;
          if (shipping.vessel_cut_off) payload.vessel_cut_off = shipping.vessel_cut_off;
          // Note: x_studio_total_free_days_demurrage_detention doesn't exist on sale.order model

          const result = await createSalesMutation.mutateAsync(payload);
          salesIds.push(result.id);
          createdShipments.push({ id: result.id, type: "sales", companyName: cfg.companyName });
          setCompletedSteps(prev => [...prev, `Sales Order created for ${cfg.companyName}`]);
        }
      }

      // ─── Link all created shipments together ───────────────────────
      if (createdShipments.length > 1) {
        setCreationProgress("Linking shipments together...");

        // Fetch the actual names of all created shipments

        for (const sh of createdShipments) {
          try {
            if (sh.type === "purchase") {
              const po = await trpcUtils.shipments.getById.fetch({ id: sh.id });
              shipmentNames.push({ id: sh.id, type: "purchase", name: po.name });
            } else {
              const so = await trpcUtils.salesShipments.getById.fetch({ id: sh.id });
              shipmentNames.push({ id: sh.id, type: "sales", name: so.name });
            }
          } catch {
            // If we can't fetch the name, use the ID as fallback
            shipmentNames.push({ id: sh.id, type: sh.type, name: `${sh.type === "purchase" ? "PO" : "SO"}#${sh.id}` });
          }
        }

        // Build linked string for each shipment (all other shipment names)
        for (const current of shipmentNames) {
          const otherNames = shipmentNames
            .filter(s => s.id !== current.id || s.type !== current.type)
            .map(s => s.name)
            .join(", ");

          if (!otherNames) continue;

          try {
            if (current.type === "purchase") {
              await updatePurchaseMutation.mutateAsync({
                id: current.id,
                notes: otherNames,
              });
            } else {
              await updateSalesMutation.mutateAsync({
                id: current.id,
                x_studio_corresponding_purchasesale_shipment: otherNames,
              });
            }
          } catch (linkErr) {
            console.error(`Failed to link shipment ${current.name}:`, linkErr);
            // Don't fail the whole operation if linking fails
          }
        }
      }

      setCompletedSteps(prev => [...prev, "All shipments linked successfully"]);
      setCreationProgress("All shipments created and linked successfully!");
      // Delete draft if it was saved
      if (currentDraftId) {
        try { await deleteDraftMutation.mutateAsync({ id: currentDraftId }); } catch {}
      }

      // Build the created shipment details for display
      const details: { label: string; id: string }[] = [];
      if (shipmentNames.length > 0) {
        // Use fetched names (e.g. "PO/CAI/26/00038")
        for (const sn of shipmentNames) {
          const companyName = createdShipments.find(s => s.id === sn.id && s.type === sn.type)?.companyName || "";
          details.push({
            label: `${sn.type === "purchase" ? "↓ Purchase" : "↑ Sales"} — ${companyName}`,
            id: sn.name,
          });
        }
      } else {
        // Fallback to IDs if names weren't fetched
        for (const sh of createdShipments) {
          details.push({
            label: `${sh.type === "purchase" ? "↓ Purchase" : "↑ Sales"} — ${sh.companyName}`,
            id: `${sh.type === "purchase" ? "PO" : "SO"} #${sh.id}`,
          });
        }
      }
      setCreatedShipmentDetails(details);

      // Store the IDs for the OK callback
      setFinalCreatedIds({ purchaseIds, salesIds });
      // Show success state — user must click OK to proceed
      setCreationSuccess(true);
    } catch (e: any) {
      setCreationError(e.message || "Failed to create shipments");
      setCreating(false);
      submittingRef.current = false;
    }
  }, [enabledConfigs, linesByCompany, shipping, createPurchaseMutation, createSalesMutation, updatePurchaseMutation, updateSalesMutation, onCreated]);

  // ─── Summary for Review ─────────────────────────────────────────────
  const totalShipments = enabledConfigs.reduce((sum, c) => sum + (c.createPurchase ? 1 : 0) + (c.createSales ? 1 : 0), 0);

  const stepLabels = [
    "Companies & Types",
    "Product Lines",
    "Shipping Details",
    "Review & Create",
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
    }}>
      <div style={{
        background: C.card, borderRadius: 14, width: 800, maxHeight: "92vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)", borderWidth: 1, borderStyle: "solid", borderColor: C.border,
      }}>

        {/* Header */}
        <div style={{
          padding: "16px 24px", borderBottom: `1px solid ${C.border}`,
          background: `linear-gradient(135deg, ${C.forest}08, ${C.terra}08)`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.dark }}>
              Multi-Linked Shipment
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
              Create linked Purchase & Sales shipments across multiple companies
            </div>
          </div>
          <button onClick={() => { if (!creating && !creationSuccess) onClose(); }} style={{
            background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.gray,
            padding: "4px 8px", borderRadius: 6,
            opacity: (creating || creationSuccess) ? 0.3 : 1,
            pointerEvents: (creating || creationSuccess) ? "none" : "auto",
          }}>×</button>
        </div>

        {/* Step Indicator */}
        <div style={{
          display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`,
        }}>
          {stepLabels.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <div key={n} style={{
                flex: 1, padding: "10px 12px", textAlign: "center",
                cursor: done ? "pointer" : "default",
                fontSize: 10, fontWeight: active ? 700 : 500,
                color: active ? C.forest : done ? C.sage : C.muted,
                borderBottom: active ? `2px solid ${C.forest}` : "2px solid transparent",
                background: active ? `${C.forest}08` : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                opacity: (!active && !done) ? 0.5 : 1,
              }} onClick={() => done && setStep(n)}>
                <span style={{
                  width: 18, height: 18, borderRadius: "50%", display: "inline-flex",
                  alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700,
                  background: active ? C.forest : done ? C.sage : C.border,
                  color: active || done ? C.white : C.muted,
                }}>{done ? "✓" : n}</span>
                {label}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {error && (
            <div style={{
              padding: "10px 14px", background: "#fef2f2", borderWidth: 1, borderStyle: "solid", borderColor: "#fecaca",
              borderRadius: 8, color: "#dc2626", fontSize: 11, marginBottom: 14,
            }}>{error}</div>
          )}

          {/* === STEP 1: Company & Shipment Type Selection === */}
          <div style={{ display: step === 1 ? 'block' : 'none' }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
                Select which companies to create shipments for, and choose Purchase, Sales, or both for each.
                Then assign the vendor (for Purchase) and/or customer (for Sales) per company, along with the warehouse.
              </div>

              {configs.map(cfg => (
                <div key={cfg.companyId} style={{
                  borderWidth: 1, borderStyle: "solid", borderColor: cfg.enabled ? C.gBdr : C.border,
                  borderRadius: 10, marginBottom: 10, overflow: "hidden",
                  background: cfg.enabled ? `${C.forest}04` : C.card,
                  transition: "all .2s",
                }}>
                  {/* Company Row */}
                  <div style={{
                    padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
                    borderBottom: cfg.enabled ? `1px solid ${C.border}` : "none",
                  }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={cfg.enabled}
                        onChange={e => updateConfig(cfg.companyId, {
                          enabled: e.target.checked,
                          createPurchase: e.target.checked ? cfg.createPurchase : false,
                          createSales: e.target.checked ? cfg.createSales : false,
                        })}
                        style={{ accentColor: C.forest, width: 16, height: 16 }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>{cfg.companyName}</span>
                    </label>

                    {cfg.enabled && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <label style={{
                          display: "flex", alignItems: "center", gap: 4, cursor: "pointer",
                          padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                          background: cfg.createPurchase ? C.forest : C.gBg,
                          color: cfg.createPurchase ? C.white : C.muted,
                          borderWidth: 1, borderStyle: "solid", borderColor: cfg.createPurchase ? C.forest : C.border,
                          transition: "all .15s",
                        }}>
                          <input
                            type="checkbox"
                            checked={cfg.createPurchase}
                            onChange={e => updateConfig(cfg.companyId, { createPurchase: e.target.checked })}
                            style={{ display: "none" }}
                          />
                          ↓ Purchase
                        </label>
                        <label style={{
                          display: "flex", alignItems: "center", gap: 4, cursor: "pointer",
                          padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                          background: cfg.createSales ? C.terra : C.gBg,
                          color: cfg.createSales ? C.white : C.muted,
                          borderWidth: 1, borderStyle: "solid", borderColor: cfg.createSales ? C.terra : C.border,
                          transition: "all .15s",
                        }}>
                          <input
                            type="checkbox"
                            checked={cfg.createSales}
                            onChange={e => updateConfig(cfg.companyId, { createSales: e.target.checked })}
                            style={{ display: "none" }}
                          />
                          ↑ Sales
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Vendor/Customer/Warehouse Selection (expanded when enabled) */}
                  {cfg.enabled && (cfg.createPurchase || cfg.createSales) && (
                    <div style={{ padding: "10px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {cfg.createPurchase && (
                        <div>
                          <Lbl>Vendor (Purchase) *</Lbl>
                          <select
                            value={cfg.purchaseVendorId}
                            onChange={e => updateConfig(cfg.companyId, { purchaseVendorId: Number(e.target.value) })}
                            style={selectStyle}
                          >
                            <option value={0}>Select vendor...</option>
                            {(vendorsByCompany.get(cfg.companyId) || []).map(v => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {cfg.createSales && (
                        <div>
                          <Lbl><span style={{ color: C.terra }}>Customer (Sales) *</span></Lbl>
                          <select
                            value={cfg.salesCustomerId}
                            onChange={e => updateConfig(cfg.companyId, { salesCustomerId: Number(e.target.value) })}
                            style={{ ...selectStyle, borderColor: cfg.createSales ? C.tBdr : C.inputBdr }}
                          >
                            <option value={0}>Select customer...</option>
                            {(customersByCompany.get(cfg.companyId) || []).map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Location selections */}
                      {cfg.createPurchase && (
                        <div>
                          <Lbl>Destination Location (Purchase) *</Lbl>
                          <select
                            value={cfg.purchaseLocationId}
                            onChange={e => {
                              const locId = Number(e.target.value);
                              const loc = allStockLocations?.find(l => l.id === locId);
                              // Also set picking type from the location's warehouse
                              const pickingType = loc?.warehouseId
                                ? getCompanyPickingTypes(cfg.companyId).find(pt => pt.warehouseId === loc.warehouseId)
                                : undefined;
                              updateConfig(cfg.companyId, {
                                purchaseLocationId: locId,
                                purchasePickingTypeId: pickingType?.id || cfg.purchasePickingTypeId,
                              });
                            }}
                            style={selectStyle}
                          >
                            <option value={0}>Select location...</option>
                            {getLocationsByWarehouse(cfg.companyId).map(group => (
                              <optgroup key={group.warehouseName} label={group.warehouseName}>
                                {group.locations.map(loc => (
                                  <option key={loc.id} value={loc.id}>{loc.completeName}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <div style={{ fontSize: 8, color: C.muted, marginTop: 1 }}>Where purchased goods will be stored (e.g., Raw Material, Finished Goods)</div>
                        </div>
                      )}
                      {cfg.createSales && (
                        <div>
                          <Lbl><span style={{ color: C.terra }}>Source Location (Sales) *</span></Lbl>
                          <select
                            value={cfg.salesLocationId}
                            onChange={e => {
                              const locId = Number(e.target.value);
                              const loc = allStockLocations?.find(l => l.id === locId);
                              updateConfig(cfg.companyId, {
                                salesLocationId: locId,
                                salesWarehouseId: loc?.warehouseId || 0,
                              });
                            }}
                            style={{ ...selectStyle, borderColor: C.tBdr }}
                          >
                            <option value={0}>Select location...</option>
                            {getLocationsByWarehouse(cfg.companyId).map(group => (
                              <optgroup key={group.warehouseName} label={group.warehouseName}>
                                {group.locations.map(loc => (
                                  <option key={loc.id} value={loc.id}>{loc.completeName}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <div style={{ fontSize: 8, color: C.muted, marginTop: 1 }}>From which location to sell (e.g., Finished Goods, Raw Material)</div>
                        </div>
                      )}

                      {cfg.createPurchase && (
                        <div>
                          <Lbl>Purchase Agreement</Lbl>
                          <select
                            value={cfg.purchaseAgreementId}
                            onChange={e => updateConfig(cfg.companyId, { purchaseAgreementId: Number(e.target.value) })}
                            style={selectStyle}
                          >
                            <option value={0}>None</option>
                            {(allPurchaseAgreements || [])
                              .filter(pa => pa.companyId === cfg.companyId)
                              .map(pa => <option key={pa.id} value={pa.id}>{pa.name} — {pa.vendor}</option>)}
                          </select>
                        </div>
                      )}
                      {cfg.createSales && (
                        <div>
                          <Lbl><span style={{ color: C.terra }}>Sales Agreement</span></Lbl>
                          <select
                            value={cfg.salesAgreementId}
                            onChange={e => updateConfig(cfg.companyId, { salesAgreementId: Number(e.target.value) })}
                            style={{ ...selectStyle, borderColor: C.tBdr }}
                          >
                            <option value={0}>None</option>
                            {(salesAgreements || [])
                              .filter(sa => sa.companyId === cfg.companyId)
                              .map(sa => <option key={sa.id} value={sa.id}>{sa.name}{sa.customer ? ` — ${sa.customer}` : ""}</option>)}
                          </select>
                        </div>
                      )}
                      {/* Separate Purchase and Sales currencies */}
                      {cfg.createPurchase && (
                        <div>
                          <Lbl>Purchase Currency</Lbl>
                          <select
                            value={cfg.purchaseCurrencyId}
                            onChange={e => updateConfig(cfg.companyId, { purchaseCurrencyId: Number(e.target.value) })}
                            style={selectStyle}
                          >
                            <option value={0}>Default</option>
                            {(currencies || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      {cfg.createSales && (
                        <div>
                          <Lbl><span style={{ color: C.terra }}>Sales Currency</span></Lbl>
                          <select
                            value={cfg.salesCurrencyId}
                            onChange={e => updateConfig(cfg.companyId, { salesCurrencyId: Number(e.target.value) })}
                            style={{ ...selectStyle, borderColor: C.tBdr }}
                          >
                            <option value={0}>Default</option>
                            {(currencies || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div>
                        <Lbl>Incoterm</Lbl>
                        <select
                          value={cfg.incotermId}
                          onChange={e => updateConfig(cfg.companyId, { incotermId: Number(e.target.value) })}
                          style={selectStyle}
                        >
                          <option value={0}>None</option>
                          {(incoterms || []).map(i => <option key={i.id} value={i.id}>{i.code} — {i.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <Lbl>Payment Term</Lbl>
                        <select
                          value={cfg.paymentTermId}
                          onChange={e => updateConfig(cfg.companyId, { paymentTermId: Number(e.target.value) })}
                          style={selectStyle}
                        >
                          <option value={0}>None</option>
                          {(paymentTerms || []).map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {enabledConfigs.length > 0 && (
                <div style={{
                  marginTop: 12, padding: "8px 12px", background: C.gBg2, borderRadius: 8,
                  borderWidth: 1, borderStyle: "solid", borderColor: C.gBdr, fontSize: 10, color: C.sage, fontWeight: 600,
                }}>
                  {totalShipments} shipment{totalShipments !== 1 ? "s" : ""} will be created across {enabledConfigs.length} compan{enabledConfigs.length !== 1 ? "ies" : "y"}
                </div>
              )}
          </div>

          {/* === STEP 2: Per-Company Product Lines === */}
          <div style={{ display: step === 2 ? 'block' : 'none' }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
                Each company needs its own product lines (Odoo products are company-specific).
                Select the correct product for each company below.
              </div>

              {/* Stock validation — blocking errors (sales-only, no linked purchase) */}
              {blockingStockErrors.length > 0 && (
                <div style={{
                  padding: "8px 12px", background: "#fef2f2", borderWidth: 1, borderStyle: "solid", borderColor: "#fecaca",
                  borderRadius: 6, color: "#dc2626", fontSize: 11, marginBottom: 12,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>⛔ Insufficient Stock — Cannot Proceed</div>
                  <div style={{ marginBottom: 4 }}>These companies have Sales only (no linked Purchase) and insufficient inventory:</div>
                  {blockingStockErrors.map((err, i) => (
                    <div key={i}>• {err.companyName} ({err.locationName}): requested {err.requested.toLocaleString()} kg, available {err.available.toLocaleString()} kg</div>
                  ))}
                </div>
              )}

              {/* Stock info — non-blocking warnings (has linked purchase that will bring inventory) */}
              {stockErrors.filter(e => e.hasLinkedPurchase).length > 0 && (
                <div style={{
                  padding: "8px 12px", background: "#eff6ff", borderWidth: 1, borderStyle: "solid", borderColor: "#bfdbfe",
                  borderRadius: 6, color: "#1d4ed8", fontSize: 11, marginBottom: 12,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>ℹ️ Stock Note — Covered by Linked Purchase</div>
                  <div style={{ marginBottom: 4 }}>These products currently show low/zero stock, but the linked Purchase will bring inventory into the location:</div>
                  {stockErrors.filter(e => e.hasLinkedPurchase).map((err, i) => (
                    <div key={i}>• {err.companyName} ({err.locationName}): {err.requested.toLocaleString()} kg (current on-hand: {err.available.toLocaleString()} kg)</div>
                  ))}
                </div>
              )}

              {enabledConfigs.map(cfg => {
                const companyLines = linesByCompany[cfg.companyId] || [];
                const salesLocId = cfg.createSales ? cfg.salesLocationId : 0;
                const salesLocName = salesLocId ? allStockLocations?.find(l => l.id === salesLocId)?.completeName || "Unknown" : "";

                return (
                  <div key={cfg.companyId} style={{
                    marginBottom: 16, borderWidth: 1, borderStyle: "solid", borderColor: C.gBdr,
                    borderRadius: 10, overflow: "hidden",
                  }}>
                    {/* Company header */}
                    <div style={{
                      padding: "8px 14px", background: `${C.forest}0a`,
                      borderBottom: `1px solid ${C.border}`,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.dark }}>{cfg.companyName}</span>
                        <div style={{ display: "flex", gap: 4 }}>
                          {cfg.createPurchase && (
                            <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 8, fontWeight: 700, background: C.forest, color: C.white }}>↓ Purchase</span>
                          )}
                          {cfg.createSales && (
                            <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 8, fontWeight: 700, background: C.terra, color: C.white }}>↑ Sales</span>
                          )}
                        </div>
                      </div>
                      {salesLocId > 0 && (
                        <ViewStockButton
                          locationId={salesLocId}
                          locationName={`${cfg.companyName} — ${salesLocName}`}
                          accentColor={C.terra}
                        />
                      )}
                    </div>

                    {/* Product lines for this company */}
                    <div style={{ padding: 12 }}>
                      {companyLines.map((line, idx) => {
                        // Stock check for this company's sales location
                        const stockAvail = salesLocId > 0 && line.product_id > 0
                          ? (stockByLocation.get(salesLocId)?.get(line.product_id) ?? 0)
                          : -1;
                        const hasStockIssue = stockAvail >= 0 && line.product_qty > 0 && line.product_qty > stockAvail;

                        return (
                          <div key={idx} style={{
                            padding: 10, borderWidth: 1, borderStyle: "solid",
                            borderColor: hasStockIssue ? "#fecaca" : C.border, borderRadius: 8,
                            marginBottom: 8, background: hasStockIssue ? "#fef2f2" : C.gBg,
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: C.sage }}>Line {idx + 1}</span>
                              {companyLines.length > 1 && (
                                <button onClick={() => removeLine(cfg.companyId, idx)} style={{
                                  background: "none", border: "none", color: C.red, fontSize: 10, cursor: "pointer", fontWeight: 600,
                                }}>Remove</button>
                              )}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.8fr 0.7fr", gap: 8 }}>
                              <div>
                                <Lbl>Product *</Lbl>
                                <SearchableProductSelect
                                  value={line.product_id}
                                  onChange={(id, product) => {
                                    updateLine(cfg.companyId, idx, "product_id", id);
                                    // Auto-set UoM from product's own UoM to avoid category mismatch
                                    if (product?.uom?.id) {
                                      updateLine(cfg.companyId, idx, "product_uom", product.uom.id);
                                    }
                                  }}
                                  companyId={cfg.companyId}
                                />
                              </div>
                              <div>
                                <Lbl>Quantity *</Lbl>
                                <input
                                  type="number" step="0.01" min="0.01"
                                  value={line.product_qty || ""}
                                  onChange={e => {
                                    const val = parseFloat(e.target.value);
                                    updateLine(cfg.companyId, idx, "product_qty", isNaN(val) ? 0 : Math.max(0, val));
                                  }}
                                  style={{
                                    ...inputStyle,
                                    ...(hasStockIssue ? { borderColor: "#dc2626", background: "#fef2f2" } : {}),
                                  }}
                                />
                              </div>
                              <div>
                                <Lbl>Unit Price *</Lbl>
                                <input type="number" step="0.01" value={line.price_unit || ""} onChange={e => updateLine(cfg.companyId, idx, "price_unit", parseFloat(e.target.value) || 0)} style={inputStyle} />
                              </div>
                              <div>
                                <Lbl>UoM</Lbl>
                                <select value={line.product_uom} onChange={e => updateLine(cfg.companyId, idx, "product_uom", Number(e.target.value))} style={selectStyle}>
                                  {(uoms || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                              </div>
                              <div>
                                <Lbl>VAT</Lbl>
                                <select value={line.tax_rate} onChange={e => updateLine(cfg.companyId, idx, "tax_rate", Number(e.target.value))} style={selectStyle}>
                                  {VAT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                              </div>
                            </div>

                            {/* Stock indicator */}
                            {stockAvail >= 0 && line.product_id > 0 && (
                              <div style={{ marginTop: 6 }}>
                                <span style={{
                                  fontSize: 9, fontWeight: 600, fontFamily: MONO,
                                  padding: "2px 8px", borderRadius: 4,
                                  background: hasStockIssue ? "#fecaca" : "#dcfce7",
                                  color: hasStockIssue ? "#dc2626" : "#16a34a",
                                }}>
                                  {salesLocName}: {stockAvail.toLocaleString()} kg on-hand
                                  {hasStockIssue && " ✘"}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <Btn onClick={() => addLine(cfg.companyId)} outline small>+ Add Line</Btn>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* === STEP 3: Shipping Details (shared) === */}
          <div style={{ display: step === 3 ? 'grid' : 'none', gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1", fontSize: 11, color: C.muted, marginBottom: 4 }}>
                These shipping details are shared across all {totalShipments} shipments.
              </div>

              <div>
                <Lbl># Loads/Containers</Lbl>
                <input type="number" value={shipping.number_of_loads || ""} onChange={e => setShipping(p => ({ ...p, number_of_loads: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                <label style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, cursor: "pointer", fontSize: 10, color: C.dark }}>
                  <input
                    type="checkbox"
                    checked={distributeWeightEqually}
                    onChange={e => setDistributeWeightEqually(e.target.checked)}
                    style={{ width: 14, height: 14, accentColor: C.forest, cursor: "pointer" }}
                  />
                  <span style={{ fontWeight: 500 }}>Distribute weight equally across loads</span>
                </label>
                {distributeWeightEqually && shipping.number_of_loads > 0 && (() => {
                  const validLines = allLines.filter(l => l.product_id > 0 && l.product_qty > 0);
                  if (validLines.length === 0) return null;
                  const totalQty = validLines.reduce((sum, l) => {
                    const uomObj = uoms?.find(u => u.id === l.product_uom);
                    const uomName = (uomObj?.name || "").toLowerCase();
                    const qty = l.product_qty;
                    if (uomName.includes("ton") || uomName === "t" || uomName === "mt") return sum + qty;
                    return sum + qty / 1000;
                  }, 0);
                  if (totalQty <= 0) return null;
                  const perLoad = Math.round((totalQty / shipping.number_of_loads) * 100) / 100;
                  return (
                    <div style={{
                      marginTop: 6, padding: "6px 10px", borderRadius: 6,
                      background: C.gBg2, border: `1px solid ${C.gBdr}`,
                      fontSize: 10, color: C.forest, fontWeight: 600,
                      fontFamily: MONO,
                    }}>
                      {totalQty.toFixed(2)} tons ÷ {shipping.number_of_loads} loads = <span style={{ color: C.terra, fontWeight: 700 }}>{perLoad.toFixed(2)} tons/load</span>
                    </div>
                  );
                })()}
              </div>
              <div>
                <Lbl>Vessel Name</Lbl>
                <input value={shipping.vessel_name} onChange={e => setShipping(p => ({ ...p, vessel_name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <Lbl>Booking #</Lbl>
                <input value={shipping.booking_number} onChange={e => setShipping(p => ({ ...p, booking_number: e.target.value }))} style={inputStyle} placeholder="Booking reference" />
              </div>
              <div>
                <Lbl>Vessel Tracking Link</Lbl>
                <input value={shipping.tracking_link} onChange={e => setShipping(p => ({ ...p, tracking_link: e.target.value }))} style={inputStyle} placeholder="e.g. https://www.marinetraffic.com/..." />
              </div>
              <div>
                <Lbl>Ultimate Customer</Lbl>
                <input value={shipping.ultimate_customer} onChange={e => setShipping(p => ({ ...p, ultimate_customer: e.target.value }))} style={inputStyle} placeholder="Customer name" />
              </div>

              <SectionTitle color={C.forest}>Port of Loading (POL)</SectionTitle>
              <div>
                <Lbl>POL Name</Lbl>
                <PortSelector value={shipping.pol} onChange={v => setShipping(p => ({ ...p, pol: v }))} style={inputStyle} placeholder="Search port..." accentColor={C.forest} />
              </div>
              <div>
                <Lbl>ETD (POL)</Lbl>
                <input type="date" value={shipping.etd_pol} onChange={e => setShipping(p => ({ ...p, etd_pol: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <Lbl>ETA (POL)</Lbl>
                <input type="date" value={shipping.eta_pol} onChange={e => setShipping(p => ({ ...p, eta_pol: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <Lbl>Vessel Cut Off</Lbl>
                <input type="date" value={shipping.vessel_cut_off} onChange={e => setShipping(p => ({ ...p, vessel_cut_off: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <Lbl>Free Days — Demurrage (POL)</Lbl>
                <input type="number" min="0" value={shipping.pol_free_days_demurrage || ""} onChange={e => setShipping(p => ({ ...p, pol_free_days_demurrage: parseInt(e.target.value) || 0 }))} style={inputStyle} placeholder="e.g. 7" />
              </div>
              <div>
                <Lbl>Free Days — Detention (POL)</Lbl>
                <input type="number" min="0" value={shipping.pol_free_days_detention || ""} onChange={e => setShipping(p => ({ ...p, pol_free_days_detention: parseInt(e.target.value) || 0 }))} style={inputStyle} placeholder="e.g. 7" />
              </div>

              <SectionTitle color={C.terra}>Port of Destination (POD)</SectionTitle>
              <div>
                <Lbl>POD Name</Lbl>
                <PortSelector value={shipping.pod} onChange={v => setShipping(p => ({ ...p, pod: v }))} style={inputStyle} placeholder="Search port..." accentColor={C.terra} />
              </div>
              <div>
                <Lbl>ETA (POD)</Lbl>
                <input type="date" value={shipping.eta_pod} onChange={e => setShipping(p => ({ ...p, eta_pod: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <Lbl>Free Days — Demurrage (POD)</Lbl>
                <input type="number" min="0" value={shipping.pod_free_days_demurrage || ""} onChange={e => setShipping(p => ({ ...p, pod_free_days_demurrage: parseInt(e.target.value) || 0 }))} style={inputStyle} placeholder="e.g. 7" />
              </div>
              <div>
                <Lbl>Free Days — Detention (POD)</Lbl>
                <input type="number" min="0" value={shipping.pod_free_days_detention || ""} onChange={e => setShipping(p => ({ ...p, pod_free_days_detention: parseInt(e.target.value) || 0 }))} style={inputStyle} placeholder="e.g. 7" />
              </div>

              <SectionTitle>Logistics</SectionTitle>
              <div>
                <Lbl>Freight Type</Lbl>
                <select value={shipping.freight_type} onChange={e => setShipping(p => ({ ...p, freight_type: e.target.value }))} style={selectStyle}>
                  <option value="">Select...</option>
                  <option value="ocean">Ocean</option>
                  <option value="land">Land</option>
                </select>
              </div>
              <div>
                <Lbl>Load Type</Lbl>
                <select value={shipping.load_type} onChange={e => setShipping(p => ({ ...p, load_type: e.target.value }))} style={selectStyle}>
                  <option value="">Select...</option>
                  <option value="truck_load">Truck Load</option>
                  <option value="container_shipment">Container Shipment</option>
                </select>
              </div>
              <div>
                <Lbl>Shipping Line</Lbl>
                <select value={shipping.shipping_line} onChange={e => setShipping(p => ({ ...p, shipping_line: e.target.value }))} style={selectStyle}>
                  <option value="">Select...</option>
                  {["ESL", "RCL", "ASYAD", "MAERSK", "CMA", "MSC", "Unifeeder", "WANHAI", "Transmar", "Hapag-Lloyd", "ONE", "COSCO", "PIL", "VASCO", "CSL"].map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
          </div>

          {/* === STEP 4: Review & Create === */}
          <div style={{ display: step === 4 ? 'block' : 'none' }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
                Review the shipments below. Click "Create All Shipments" to proceed.
              </div>

              {/* Shipments Summary */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
                  Shipments to Create ({totalShipments})
                </div>
                {enabledConfigs.map(cfg => {
                  const purchaseLoc = allStockLocations?.find(l => l.id === cfg.purchaseLocationId);
                  const salesLoc = allStockLocations?.find(l => l.id === cfg.salesLocationId);
                  return (
                    <div key={cfg.companyId} style={{
                      display: "flex", flexDirection: "column", gap: 4,
                      padding: "8px 12px", borderWidth: 1, borderStyle: "solid", borderColor: C.border, borderRadius: 8,
                      marginBottom: 6, background: C.gBg,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.dark }}>{cfg.companyName}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {cfg.createPurchase && (
                          <span style={{
                            padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 600,
                            background: C.forest, color: C.white,
                          }}>
                            ↓ Purchase — {(vendorsByCompany.get(cfg.companyId) || []).find((v: any) => v.id === cfg.purchaseVendorId)?.name || "—"}
                            {purchaseLoc ? ` → ${purchaseLoc.completeName}` : ""}
                            {cfg.purchaseCurrencyId ? ` (${(currencies || []).find(c => c.id === cfg.purchaseCurrencyId)?.name || ""})` : ""}
                          </span>
                        )}
                        {cfg.createSales && (
                          <span style={{
                            padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 600,
                            background: C.terra, color: C.white,
                          }}>
                            ↑ Sales — {(customersByCompany.get(cfg.companyId) || []).find((c: any) => c.id === cfg.salesCustomerId)?.name || "—"}
                            {salesLoc ? ` from ${salesLoc.completeName}` : ""}
                            {cfg.salesCurrencyId ? ` (${(currencies || []).find(c => c.id === cfg.salesCurrencyId)?.name || ""})` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Per-Company Product Lines Summary */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
                  Product Lines (per company)
                </div>
                {enabledConfigs.map(cfg => {
                  const companyLines = (linesByCompany[cfg.companyId] || []).filter(l => l.product_id > 0);
                  if (companyLines.length === 0) return null;
                  return (
                    <div key={cfg.companyId} style={{
                      padding: "8px 12px", borderWidth: 1, borderStyle: "solid", borderColor: C.border, borderRadius: 8,
                      background: C.gBg, marginBottom: 6,
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.sage, marginBottom: 4 }}>{cfg.companyName}</div>
                      {companyLines.map((l, i) => (
                        <div key={i} style={{
                          display: "flex", gap: 12, fontSize: 10, padding: "4px 0",
                          borderBottom: i < companyLines.length - 1 ? `1px solid ${C.border}` : "none",
                        }}>
                          <span style={{ fontWeight: 600 }}>Product #{l.product_id}</span>
                          <span>Qty: {l.product_qty}</span>
                          <span>Price: {l.price_unit}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Shipping Summary */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
                  Shipping Details (shared)
                </div>
                <div style={{
                  padding: "8px 12px", borderWidth: 1, borderStyle: "solid", borderColor: C.border, borderRadius: 8,
                  background: C.gBg, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
                }}>
                  {[
                    ["Vessel", shipping.vessel_name],
                    ["Booking #", shipping.booking_number],
                    ["POL", shipping.pol],
                    ["POD", shipping.pod],
                    ["ETD (POL)", shipping.etd_pol],
                    ["ETA (POD)", shipping.eta_pod],
                    ["Vessel Cut Off", shipping.vessel_cut_off],
                    ["POL Free Days (Dem/Det)", (shipping.pol_free_days_demurrage || shipping.pol_free_days_detention) ? `${shipping.pol_free_days_demurrage || 0} / ${shipping.pol_free_days_detention || 0}` : ""],
                    ["POD Free Days (Dem/Det)", (shipping.pod_free_days_demurrage || shipping.pod_free_days_detention) ? `${shipping.pod_free_days_demurrage || 0} / ${shipping.pod_free_days_detention || 0}` : ""],
                    ["Loads", shipping.number_of_loads ? String(shipping.number_of_loads) : ""],
                    ["Freight", shipping.freight_type],
                    ["Load Type", shipping.load_type],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label} style={{ fontSize: 10 }}>
                      <span style={{ color: C.muted, fontWeight: 600 }}>{label}: </span>
                      <span style={{ color: C.dark }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>


          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 24px", borderTop: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", background: C.gBg,
        }}>
          <div style={{ display: "flex", gap: 6 }}>
            {step > 1 && !creating && <Btn onClick={() => { setError(""); setStep(s => s - 1); }} outline>← Back</Btn>}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {draftSaved && <span style={{ fontSize: 10, color: C.sage, fontWeight: 600 }}>✓ Draft saved</span>}
            {!creating && (
              <Btn onClick={handleSaveDraft} color={C.amber} outline disabled={saveDraftMutation.isPending}>
                {saveDraftMutation.isPending ? "Saving..." : currentDraftId ? "Update Draft" : "Save as Draft"}
              </Btn>
            )}
            <Btn onClick={() => { if (!creating && !creationSuccess) onClose(); }} color={C.gray} outline disabled={creating || creationSuccess}>Cancel</Btn>
            {step < 4 ? (
              <Btn onClick={goNext}>Next →</Btn>
            ) : (
              <Btn onClick={handleRequestCreate} disabled={creating || blockingStockErrors.length > 0}>
                {creating ? "Creating..." : `Create ${totalShipments} Shipment${totalShipments !== 1 ? "s" : ""}`}
              </Btn>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={showConfirm}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleCreate}
        title={`Create ${totalShipments} Linked Shipment${totalShipments !== 1 ? "s" : ""}?`}
        confirmLabel={`Yes, Create ${totalShipments} Shipment${totalShipments !== 1 ? "s" : ""}`}
        cancelLabel="Go Back"
        message={
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, color: C.dark, lineHeight: 1.5 }}>
              You are about to create linked shipments:
            </div>
            <div style={{
              background: C.gBg, border: `1px solid ${C.gBdr}`, borderRadius: 6,
              padding: "8px 10px", display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px",
              fontSize: 11,
            }}>
              <span style={{ fontWeight: 600, color: C.sage }}>Companies</span>
              <span style={{ color: C.dark }}>{confirmSummary.companyNames.join(", ")}</span>
              {confirmSummary.purchaseCount > 0 && (<>
                <span style={{ fontWeight: 600, color: C.forest }}>Purchase Orders</span>
                <span style={{ color: C.dark }}>{confirmSummary.purchaseCount}</span>
              </>)}
              {confirmSummary.salesCount > 0 && (<>
                <span style={{ fontWeight: 600, color: C.terra }}>Sales Orders</span>
                <span style={{ color: C.dark }}>{confirmSummary.salesCount}</span>
              </>)}
              <span style={{ fontWeight: 600, color: C.sage }}>Total Qty</span>
              <span style={{ color: C.dark }}>{confirmSummary.totalQty.toLocaleString()}</span>
              <span style={{ fontWeight: 600, color: C.sage }}>Total Value</span>
              <span style={{ color: C.dark, fontWeight: 600 }}>AED {confirmSummary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
              All orders will be created, confirmed, and linked together. This cannot be undone from this portal.
            </div>
          </div>
        }
      />

      {/* Creation Progress Modal */}
      <CreationProgressModal
        visible={creating || !!creationError || creationSuccess}
        message={creationProgress || "Preparing shipments..."}
        title={`Creating ${totalShipments} Shipment${totalShipments !== 1 ? "s" : ""}`}
        subtitle="Creating linked Purchase & Sales orders across companies"
        completedSteps={completedSteps}
        error={creationError || undefined}
        onErrorClose={() => setCreationError("")}
        success={creationSuccess}
        successMessage={`${totalShipments} linked shipment${totalShipments !== 1 ? "s" : ""} created and linked successfully!`}
        createdShipmentDetails={createdShipmentDetails}
        onSuccessClose={() => onCreated(finalCreatedIds)}
      />
    </div>
  );
}
