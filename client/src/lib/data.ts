// ══════════════════════════════════════════════════════════════════════════════
// PLATFARM TRADE OPERATIONS PORTAL v3 — DATA & CONSTANTS
// Load = first-class entity matching Odoo stock.picking
// Separate Purchase / Sales stage sets matching Odoo
// ══════════════════════════════════════════════════════════════════════════════

// ─── DESIGN TOKENS ─────────────────────────────────────────────────────────
export const C = {
  forest: "#2D5A3D", sage: "#4A7C59", terra: "#C0714A",
  forestHov: "#3A7350", terraHov: "#A8613F",
  dark: "#2C3E50", gray: "#64706C", light: "#95A09C", muted: "#B0BAB6",
  pageBg: "#F7F6F3", card: "#FFFFFF", border: "#E4E1DC", inputBdr: "#D2CEC7",
  gBg: "#F2F7F3", gBg2: "#E4EFE6", gBdr: "#CDDDD1", gBdr2: "#B8D0BD",
  tBg: "#FDF7F3", tBg2: "#FBF0E8", tBdr: "#F0D5C4", aBg: "#FDF6EC", aBdr: "#F5DDB8",
  rBg: "#FDF0F0", rBdr: "#F5C4C4",
  amber: "#D4960A", red: "#C94444", blue: "#3B7DD8", white: "#FFFFFF",
};

export const FONT = "'DM Sans', system-ui, sans-serif";
export const MONO = "'JetBrains Mono', monospace";

// ─── UNIFIED SHIPMENT STAGES ──────────────────────────────────────────────
// Single set of stages for both Purchase and Sales shipments.
// Values are stored as plain text in Odoo's x_studio_unified_shipment_status field.
export const UNIFIED_STAGES = [
  { id: "Planned", label: "Planned" },
  { id: "Booked", label: "Booked" },
  { id: "Loading", label: "Loading" },
  { id: "Loaded", label: "Loaded" },
  { id: "In Transit", label: "In Transit" },
  { id: "Arrived at Port", label: "Arrived at Port" },
  { id: "Customs Clearance", label: "Customs Clearance" },
  { id: "Delivering", label: "Delivering" },
  { id: "Delivered", label: "Delivered" },
  { id: "Returned", label: "Returned" },
];

// Backward-compatible aliases — both purchase and sales now use the same stages
export const P_STAGES = UNIFIED_STAGES;
export const S_STAGES = UNIFIED_STAGES;

// ─── LOAD STATES ───────────────────────────────────────────────────────────
export const LOAD_STATES = [
  { id: "draft", label: "Draft" },
  { id: "waiting", label: "Waiting" },
  { id: "confirmed", label: "Confirmed" },
  { id: "assigned", label: "Ready" },
  { id: "done", label: "Done" },
  { id: "cancel", label: "Cancelled" },
];

// ─── RBAC: ROLES ───────────────────────────────────────────────────────────
export interface RoleDef {
  label: string;
  color: string;
  icon: string;
  desc: string;
  pages: Record<string, string>;
  shipments: { create: boolean; edit: boolean; advanceStage: boolean };
  see: Record<string, boolean>;
  loads: { edit: boolean; tabs: string[] };
}

export const ROLES: Record<string, RoleDef> = {
  admin: {
    label: "Administrator", color: "#2D5A3D", icon: "⚙",
    desc: "Full access — all pages, all data, create & edit shipments, user management",
    pages: { dashboard: "full", purchase: "edit", sales: "edit", agreements: "edit", users: "edit" },
    shipments: { create: true, edit: true, advanceStage: true },
    see: { financials: true, margins: true, salesDetails: true, invoicing: true, orderLinePricing: true, costPrice: true },
    loads: { edit: true, tabs: ["overview", "quality", "trucking", "financial", "documents"] },
  },
  ops_manager: {
    label: "Ops Manager", color: "#4A7C59", icon: "◈",
    desc: "Create & manage shipments & loads, view financials, no invoicing or user management",
    pages: { dashboard: "view", purchase: "edit", sales: "edit", agreements: "view", users: "none" },
    shipments: { create: true, edit: true, advanceStage: true },
    see: { financials: true, margins: true, salesDetails: true, invoicing: false, orderLinePricing: true, costPrice: false },
    loads: { edit: true, tabs: ["overview", "quality", "trucking", "financial", "documents"] },
  },
  logistics: {
    label: "Logistics", color: "#C0714A", icon: "↔",
    desc: "Vessel tracking, loads, trucking & docs — can edit shipments but not create, no financial data",
    pages: { dashboard: "view", purchase: "view", sales: "view", agreements: "none", users: "none" },
    shipments: { create: false, edit: true, advanceStage: true },
    see: { financials: false, margins: false, salesDetails: false, invoicing: false, orderLinePricing: false, costPrice: false },
    loads: { edit: true, tabs: ["overview", "quality", "trucking", "documents"] },
  },
  finance: {
    label: "Finance", color: "#3B7DD8", icon: "$",
    desc: "Full financial visibility — costs, margins, invoicing — no create or edit",
    pages: { dashboard: "view", purchase: "view", sales: "view", agreements: "view", users: "none" },
    shipments: { create: false, edit: false, advanceStage: false },
    see: { financials: true, margins: true, salesDetails: true, invoicing: true, orderLinePricing: true, costPrice: true },
    loads: { edit: false, tabs: ["overview", "quality", "financial"] },
  },
  viewer: {
    label: "Viewer", color: "#B0BAB6", icon: "◎",
    desc: "Read-only access to purchase shipments — no financials, no sales, no editing",
    pages: { dashboard: "view", purchase: "view", sales: "none", agreements: "none", users: "none" },
    shipments: { create: false, edit: false, advanceStage: false },
    see: { financials: false, margins: false, salesDetails: false, invoicing: false, orderLinePricing: false, costPrice: false },
    loads: { edit: false, tabs: ["overview"] },
  },
};

// ─── RBAC: USERS ───────────────────────────────────────────────────────────
export interface UserDef {
  id: string;
  name: string;
  initials: string;
  role: string;
  title: string;
  company: string;
}

export const USERS_SEED: UserDef[] = [
  { id: "ahmed", name: "Ahmed K.", initials: "AK", role: "admin", title: "Operations Director", company: "ADGM" },
  { id: "sara", name: "Sara M.", initials: "SM", role: "ops_manager", title: "Operations Manager", company: "AD" },
  { id: "omar", name: "Omar F.", initials: "OF", role: "logistics", title: "Logistics Coordinator", company: "CAI" },
  { id: "nadia", name: "Nadia R.", initials: "NR", role: "finance", title: "Finance Analyst", company: "ADGM" },
  { id: "hassan", name: "Hassan I.", initials: "HI", role: "viewer", title: "External Auditor", company: "AD" },
];

// ─── RBAC: PERMISSION RESOLVER ─────────────────────────────────────────────
export interface Perms {
  role: RoleDef;
  isAdmin: boolean;
  pg: (p: string) => string;
  canAccess: (p: string) => boolean;
  canEdit: (p: string) => boolean;
  canCreate: boolean;
  canEditShipment: boolean;
  canAdvanceStage: boolean;
  see: (s: string) => boolean;
  loadEdit: boolean;
  loadTab: (t: string) => boolean;
}

export function resolvePerms(user: UserDef): Perms {
  const r = ROLES[user.role] || ROLES.viewer;
  return {
    role: r,
    isAdmin: user.role === "admin",
    pg: (p: string) => r.pages[p] || "none",
    canAccess: (p: string) => !!(r.pages[p] && r.pages[p] !== "none"),
    canEdit: (p: string) => r.pages[p] === "edit" || r.pages[p] === "full",
    canCreate: r.shipments.create,
    canEditShipment: r.shipments.edit,
    canAdvanceStage: r.shipments.advanceStage,
    see: (s: string) => !!r.see[s],
    loadEdit: r.loads.edit,
    loadTab: (t: string) => r.loads.tabs.includes(t),
  };
}

// ─── DOCUMENT TYPES (14 types matching Odoo) ───────────────────────────────
export const DOC_TYPES = [
  { type: "booking_note", label: "Booking Note" },
  { type: "commercial_invoice", label: "Commercial Invoice" },
  { type: "packing_list", label: "Packing List" },
  { type: "bill_of_lading", label: "Bill of Lading" },
  { type: "telex_release", label: "Telex Release" },
  { type: "certificate_of_origin", label: "Certificate of Origin" },
  { type: "phytosanitary_cert", label: "Phytosanitary Certificate" },
  { type: "fumigation_cert", label: "Fumigation Certificate" },
  { type: "weight_receipts", label: "Weight Receipts" },
  { type: "analysis_report", label: "Analysis Report" },
  { type: "customs_declaration", label: "Customs Declaration" },
  { type: "delivery_note", label: "Delivery Note / POD" },
  { type: "waybill", label: "Waybill Document" },
  { type: "boe", label: "Bill of Entry (BoE)" },
];

// ─── SHARED TYPES ──────────────────────────────────────────────────────────
export interface ProductLine {
  product: string;
  qty: number;
  uom: string;
  unitPrice: number;
  discount?: number;
  subtotal?: number;
  purchasePrice?: number;
  margin?: number;
  marginPercent?: number;
  qtyDelivered?: number;
  qtyInvoiced?: number;
}

export interface Document {
  type: string;
  label: string;
  status: "pending" | "uploaded";
}

export interface ActivityEntry {
  date: string;
  time: string;
  user: string;
  action: string;
}

export interface Load {
  id: string;
  name: string;
  loadNumber: number;
  state: string;
  containerNumber: string;
  containerType: string;
  seal: string;
  grossWeight: string;
  netWeight: string;
  quantityInTons: number;
  bales: string;
  grade: string;
  qualityScore: number;
  acceptedRejected: boolean;
  gradePremium: number;
  gradeOne: number;
  gradeStandard: number;
  gradeThree: number;
  // QC checks
  qcStemSize: boolean;
  qcGreenColor: boolean;
  qcLeafAttachment: boolean;
  qcNoForeignMaterial: boolean;
  qcBaleTies: boolean;
  qcBaleShape: boolean;
  qcNoInsects: boolean;
  qcNoBlackSpots: boolean;
  qcContainerClean: boolean;
  qcTruckCover: boolean;
  qcProperLashing: boolean;
  qcProperStacking: boolean;
  // Bale tracking
  totalReceivedBales: string;
  brokenBales: string;
  moistureBales: string;
  // NIR Lab
  nirSampleRef: string;
  nirAdf: number;
  nirNdf: number;
  nirCrudeProtein: number;
  nirMoisture: number;
  // Source
  source: string;
  farmFieldName: string;
  loadedGrade: string;
  overallReceivedGrade: string;
  purchaseUnit: string;
  // Trucking
  driverName: string;
  driverContact: string;
  truckingCost: number;
  advancePayment: number;
  truckSerial: string;
  truckingCurrency: string;
  // Dates
  scheduledDate: string;
  arrivalDate: string;
  dateDone: string;
  // Financial
  containerCharges: number;
  clearanceCost: number;
  truckingFees: number;
  containerChargeType: string;
  longStayCost: number;
  claimAmount: number;
  claimReason: string;
  claimCurrency: string;
  claimDescription: string;
  deductionAmount: number;
  commissionAmount: number;
  commissionCurrency: string;
  commissionedPersonType: string;
  commissionNoReason: string;
  // Documents & Photos
  hasQualityReport: boolean;
  hasPhotoLeft: boolean;
  hasPhotoRight: boolean;
  hasPhotoBack: boolean;
  hasTruckBodyCheck: boolean;
  hasDriverLicense: boolean;
  hasQAForm: boolean;
  hasBaleCodesDoc: boolean;
  [key: string]: any;
}

// ─── PURCHASE SHIPMENT ─────────────────────────────────────────────────────
export interface PurchaseShipment {
  id: string;
  type: "purchase";
  paId: string;
  subsidiary: string;
  subsidiaryName: string;
  lines: ProductLine[];
  totalCost: number;
  paymentStatus: "not_paid" | "partial" | "paid";
  stage: string;
  vessel: string;
  voyage: string;
  shippingLine: string;
  bookingNumber: string;
  bookingStatus: string;
  blNumber: string;
  blType: string;
  blStatus: string;
  loadType: string;
  freightType: string;
  incoterm: string;
  vesselCutOff: string;
  portLoad: string;
  portDischarge: string;
  etd: string;
  eta: string;
  loads: Load[];
  documents: Document[];
  activity: ActivityEntry[];
  linkedSalesShipmentId?: string;
}

// ─── SALES SHIPMENT ────────────────────────────────────────────────────────
export interface SalesShipment {
  id: string;
  type: "sales";
  saId: string;
  company: string;
  customer: string;
  lines: ProductLine[];
  totalValue: number;
  margin: number;
  marginPercent: number;
  currency: string;
  productCategory: string;
  acceptanceStatus: string;
  deliveryStatus: string;
  ultimateCustomer: string;
  oceanFreightInvoicingEntity: string;
  oceanFreightInvoicedEntity: string;
  clearanceTruckingInvoicingEntity: string;
  clearanceTruckingInvoicedEntity: string;
  totalWeightTons: number;
  paymentStatus: "not_paid" | "partial" | "paid";
  stage: string;
  vessel: string;
  voyage: string;
  shippingLine: string;
  bookingNumber: string;
  bookingStatus: string;
  blNumber: string;
  blType: string;
  blStatus: string;
  sellingType: string;
  paymentTerm: string;
  loadType: string;
  freightType: string;
  incoterm: string;
  vesselCutOff: string;
  portLoad: string;
  portDischarge: string;
  etd: string;
  eta: string;
  loads: Load[];
  documents: Document[];
  activity: ActivityEntry[];
  linkedPurchaseShipmentId?: string;
}

export type AnyShipment = PurchaseShipment | SalesShipment;

// ─── AGREEMENTS ────────────────────────────────────────────────────────────
export interface PurchaseAgreement {
  id: string;
  subsidiary: string;
  subsidiaryName: string;
  products: string[];
  qtyTotal: number;
  status: string;
  category: string;
  incoterm: string;
  paymentTerms: string;
  validFrom: string;
  validTo: string;
}

export interface SalesAgreement {
  id: string;
  customer: string;
  products: string[];
  qtyTotal: number;
  status: string;
  category: string;
  incoterm: string;
  paymentTerms: string;
  validFrom: string;
  validTo: string;
}

// ─── CONSTANTS ─────────────────────────────────────────────────────────────
export const PRODUCT_CATEGORIES = ["Alfalfa", "Straw", "AlfaMIX Grass", "AlfaMix Straw"];
export const SHIPPING_LINES = ["ESL", "RCL", "ASYAD", "MAERSK", "CMA", "MSC", "Unifeeder", "WANHAI", "Transmar", "Hapag-Lloyd", "ONE", "COSCO", "PIL", "VASCO", "CSL", "EVERGREEN"];
export const SOURCES = ["Dakhla", "Farafrah", "Owainat", "Toshka", "Minya", "Beni Suef", "Fayoum", "Ismailia", "Nobarya", "Sharqia", "Beheira"];

export const COMPANIES = [
  { id: "ADGM", name: "ADGM — Platfarm HQ" },
  { id: "AD", name: "Abu Dhabi — Platfarm Agritech" },
  { id: "CAI", name: "Cairo — Platfarm Agriculture" },
  { id: "SOK", name: "Sokhna — Platfarm Agribusiness" },
  { id: "ALF", name: "Cairo — AlfaGlobal Agribusiness" },
];

export const CONTAINER_TYPES = ["20STD", "40STD", "40HC", "40OT", "20RF", "40RF"];

// ─── STAGE HELPERS ─────────────────────────────────────────────────────────
export const stgClr = (id: string): string => ({
  planned: C.muted, booking_confirmed: C.sage, loading: C.terra,
  in_transit: C.forest, arrived_at_port: C.sage, customs_clearance: C.terra,
  delivered: C.forest, stuffing_loading: C.terra, stuffed: C.sage,
  sailed: C.forest, arrived: C.sage, delivering: C.terra, returned: C.red,
} as Record<string, string>)[id] || C.muted;

export const stgBdg = (id: string): string => ({
  // Unified stage IDs (title case, matching Odoo x_studio_unified_shipment_status values)
  "Planned": "default", "Booked": "sage", "Loading": "terra",
  "Loaded": "sage", "In Transit": "green", "Arrived at Port": "sage",
  "Customs Clearance": "terra", "Delivering": "terra",
  "Delivered": "green", "Returned": "red",
  // Legacy lowercase IDs (backward compatibility for old data)
  planned: "default", booking_confirmed: "sage", loading: "terra",
  in_transit: "green", arrived_at_port: "sage", customs_clearance: "terra",
  delivered: "green", stuffing_loading: "terra", stuffed: "sage",
  sailed: "green", arrived: "sage", delivering: "terra", returned: "red",
  booked: "sage", loaded: "sage", in_port: "sage",
} as Record<string, string>)[id] || "default";

// ─── COMPANY CODE HELPER ──────────────────────────────────────────────────
/** Extract a short company label from a PO/SO name like "PO/AD/26/00041" → "Abu Dhabi" */
const COMPANY_CODE_MAP: Record<string, string> = {
  AD: "Abu Dhabi", CAI: "Cairo", SOK: "Sokhna", ALF: "AlfaGlobal", ADGM: "ADGM HQ",
};
export function companyFromShipmentName(name: string): string {
  // Pattern: PO/AD/26/00041 or SO/CAI/26/00005 — company code is the 2nd segment
  const parts = name.split("/");
  if (parts.length >= 2) {
    const code = parts[1];
    if (COMPANY_CODE_MAP[code]) return COMPANY_CODE_MAP[code];
  }
  return "";
}

// ─── HELPERS ───────────────────────────────────────────────────────────────
export const fmt = (n: number) => Number(n).toLocaleString();
export const fmtQty = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const prodSum = (lines: ProductLine[]) => lines.map(l => {
  const short = l.product.length > 30 ? l.product.slice(0, 28) + "…" : l.product;
  return `${l.qty} MT ${short}`;
}).join(", ");
export const mkDocs = (up: string[] = []): Document[] =>
  DOC_TYPES.map(dt => ({
    type: dt.type, label: dt.label,
    status: up.includes(dt.type) ? "uploaded" as const : "pending" as const,
  }));
export const td = () => new Date().toISOString().slice(0, 10);

/** Format a date string ("2026-03-08" or "2026-03-08 21:52:36") to "08 Mar 2026" */
export function fmtDateStr(d: string | null | undefined): string {
  if (!d || d === "—") return "—";
  const dateOnly = d.split(" ")[0]; // strip time if present
  const parsed = new Date(dateOnly + "T00:00:00");
  if (isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
export const tn = () => new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
export const payL = (s: string) => ({ not_paid: "Unpaid", partial: "Partial", paid: "Paid" } as Record<string, string>)[s] || "—";
export const payBdg = (s: string) => ({ not_paid: "red", partial: "amber", paid: "green" } as Record<string, string>)[s] || "default";

// ─── VESSEL ROUTE DATA ─────────────────────────────────────────────────────
export interface RouteNode {
  port: string;
  code: string;
  type: "origin" | "waypoint" | "transit" | "destination";
}

export const ROUTES: Record<string, RouteNode[]> = {
  "Alexandria-Jebel Ali": [
    { port: "Alexandria", code: "EGALX", type: "origin" },
    { port: "Suez Canal", code: "CANAL", type: "waypoint" },
    { port: "Red Sea", code: "REDSEA", type: "transit" },
    { port: "Gulf of Aden", code: "ADEN", type: "transit" },
    { port: "Arabian Sea", code: "ARAB", type: "transit" },
    { port: "Jebel Ali", code: "AEJEA", type: "destination" },
  ],
  "Sokhna-Dammam": [
    { port: "Ain Sokhna", code: "EGSOK", type: "origin" },
    { port: "Red Sea", code: "REDSEA", type: "transit" },
    { port: "Bab el-Mandeb", code: "BABEL", type: "waypoint" },
    { port: "Arabian Sea", code: "ARAB", type: "transit" },
    { port: "Dammam", code: "SADMM", type: "destination" },
  ],
  "Alexandria-Khalifa Port": [
    { port: "Alexandria", code: "EGALX", type: "origin" },
    { port: "Suez Canal", code: "CANAL", type: "waypoint" },
    { port: "Red Sea", code: "REDSEA", type: "transit" },
    { port: "Gulf of Aden", code: "ADEN", type: "transit" },
    { port: "Khalifa Port", code: "AEKLP", type: "destination" },
  ],
  "Sokhna-Jebel Ali": [
    { port: "Ain Sokhna", code: "EGSOK", type: "origin" },
    { port: "Red Sea", code: "REDSEA", type: "transit" },
    { port: "Bab el-Mandeb", code: "BABEL", type: "waypoint" },
    { port: "Gulf of Aden", code: "ADEN", type: "transit" },
    { port: "Arabian Sea", code: "ARAB", type: "transit" },
    { port: "Jebel Ali", code: "AEJEA", type: "destination" },
  ],
};

export function getRoute(pLoad: string, pDischarge: string): RouteNode[] {
  const key = `${pLoad}-${pDischarge}`;
  if (ROUTES[key]) return ROUTES[key];
  return [
    { port: pLoad, code: "", type: "origin" },
    { port: "Open Sea", code: "", type: "transit" },
    { port: pDischarge, code: "", type: "destination" },
  ];
}

export function getVesselProgress(stage: string): number {
  return ({
    planned: 0, booking_confirmed: 0, loading: 0.04,
    stuffing_loading: 0.04, stuffed: 0.06, sailed: 0.45,
    in_transit: 0.5, arrived_at_port: 0.96, arrived: 0.96,
    customs_clearance: 1, delivering: 1, delivered: 1, returned: 1,
  } as Record<string, number>)[stage] || 0;
}

// ─── LOAD GENERATOR ────────────────────────────────────────────────────────
interface LoadOverrides {
  cn?: string; ct?: string; seal?: string; state?: string;
  prefix?: string; seqStart?: number;
  schedDate?: string; arrDate?: string; doneDate?: string;
  source?: string; farm?: string; loadedGrade?: string;
  receivedGrade?: string; purchaseUnit?: string; truckCurr?: string;
}

export function mkLoad(i: number, shipId: string, ov: LoadOverrides = {}): Load {
  return {
    id: `${shipId}-L${i + 1}`,
    name: `${ov.prefix || "WH/IN"}/${String((ov.seqStart || 3180) + i).padStart(5, "0")}`,
    loadNumber: i + 1,
    state: ov.state || "done",
    containerNumber: ov.cn || `CONT${String(1000 + i)}`,
    containerType: ov.ct || "40HC",
    seal: ov.seal || `SL${100 + i}`,
    grossWeight: `${(24 + Math.random() * 4).toFixed(1)} MT`,
    netWeight: `${(22 + Math.random() * 3).toFixed(1)} MT`,
    quantityInTons: +(22 + Math.random() * 3).toFixed(1),
    bales: String(Math.floor(400 + Math.random() * 200)),
    grade: ["premium", "grade_1", "grade_1", "standard"][i % 4],
    qualityScore: +(72 + Math.random() * 23).toFixed(1),
    acceptedRejected: Math.random() > 0.15,
    gradePremium: +(Math.random() * 15).toFixed(1),
    gradeOne: +(50 + Math.random() * 25).toFixed(1),
    gradeStandard: +(10 + Math.random() * 15).toFixed(1),
    gradeThree: +(Math.random() * 10).toFixed(1),
    qcStemSize: true, qcGreenColor: true,
    qcLeafAttachment: Math.random() > 0.3,
    qcNoForeignMaterial: true, qcBaleTies: true,
    qcBaleShape: Math.random() > 0.2,
    qcNoInsects: true, qcNoBlackSpots: Math.random() > 0.3,
    qcContainerClean: true, qcTruckCover: true,
    qcProperLashing: true, qcProperStacking: Math.random() > 0.2,
    totalReceivedBales: String(Math.floor(400 + Math.random() * 200)),
    brokenBales: String(Math.floor(Math.random() * 8)),
    moistureBales: String(Math.floor(Math.random() * 5)),
    nirSampleRef: `NIR-${String(2600 + i)}`,
    nirAdf: +(28 + Math.random() * 8).toFixed(1),
    nirNdf: +(42 + Math.random() * 10).toFixed(1),
    nirCrudeProtein: +(14 + Math.random() * 6).toFixed(1),
    nirMoisture: +(8 + Math.random() * 5).toFixed(1),
    source: ov.source || ["Dakhla", "Farafrah", "Owainat", "Toshka", "Minya", "Beni Suef"][i % 6],
    farmFieldName: ov.farm || ["Field A-12", "Farm B-7", "Plot C-3", "Section D-1"][i % 4],
    loadedGrade: ov.loadedGrade || ["Premium", "Grade 1", "Grade 1", "Standard"][i % 4],
    overallReceivedGrade: ov.receivedGrade || ["Premium", "Grade 1", "Grade 1", "Standard"][i % 4],
    purchaseUnit: ov.purchaseUnit || "Ton",
    driverName: ["Mohamed Ali", "Hassan Ibrahim", "Omar Farouk", "Youssef Said"][i % 4],
    driverContact: `+20 10${String(Math.floor(10000000 + Math.random() * 89999999))}`,
    truckingCost: Math.floor(2000 + Math.random() * 3000),
    advancePayment: Math.floor(500 + Math.random() * 1000),
    truckSerial: `TL-${1000 + i}`,
    truckingCurrency: ov.truckCurr || "EGP",
    scheduledDate: ov.schedDate || "2026-02-20",
    arrivalDate: ov.arrDate || "2026-02-22",
    dateDone: ov.doneDate || "2026-02-23",
    containerCharges: Math.floor(300 + Math.random() * 500),
    clearanceCost: Math.floor(400 + Math.random() * 600),
    truckingFees: Math.floor(1500 + Math.random() * 2000),
    containerChargeType: ["OTHC", "VGM", "Detention", "X-Ray", "Maintenance"][i % 5],
    longStayCost: 0,
    claimAmount: 0, claimReason: "", claimCurrency: "USD", claimDescription: "",
    deductionAmount: 0, commissionAmount: 0, commissionCurrency: "AED",
    commissionedPersonType: "", commissionNoReason: "",
    hasQualityReport: Math.random() > 0.3,
    hasPhotoLeft: Math.random() > 0.4, hasPhotoRight: Math.random() > 0.4,
    hasPhotoBack: Math.random() > 0.5, hasTruckBodyCheck: Math.random() > 0.5,
    hasDriverLicense: Math.random() > 0.4, hasQAForm: Math.random() > 0.5,
    hasBaleCodesDoc: Math.random() > 0.6,
  };
}

// ─── CONTAINER DEFINITIONS ─────────────────────────────────────────────────
const CONTAINERS_PURCHASE: Record<string, [string, string, string][]> = {
  "PSH-001": [["MSCU1234567","40HC","SL100"],["MSCU1234678","40HC","SL101"],["MSCU1234789","40STD","SL102"],["MSCU1234890","40HC","SL103"]],
  "PSH-002": [["COSU5678901","40HC","SL200"],["COSU5679012","40STD","SL201"]],
  "PSH-003": [["MAEU2602345","40HC","SL300"],["MAEU2602456","40HC","SL301"],["MAEU2602567","40HC","SL302"],["MAEU2602678","40STD","SL303"],["MAEU2602789","40HC","SL304"],["MAEU2602890","40HC","SL305"]],
  "PSH-004": [["EGLV2601001","40HC","SL400"],["EGLV2601002","40STD","SL401"],["EGLV2601003","40HC","SL402"]],
};
const CONTAINERS_SALES: Record<string, [string, string, string][]> = {
  "SSH-001": [["MSCU4401001","40HC","SX100"],["MSCU4401002","40HC","SX101"],["MSCU4401003","40HC","SX102"],["MSCU4401004","40STD","SX103"]],
  "SSH-002": [["COSU6601001","40HC","SX200"],["COSU6601002","40HC","SX201"],["COSU6601003","40STD","SX202"]],
  "SSH-003": [["MAEU7701001","40HC","SX300"],["MAEU7701002","40HC","SX301"],["MAEU7701003","40HC","SX302"],["MAEU7701004","40HC","SX303"],["MAEU7701005","40STD","SX304"],["MAEU7701006","40HC","SX305"]],
  "SSH-004": [["EGLV8801001","40HC","SX400"],["EGLV8801002","40STD","SX401"],["EGLV8801003","40HC","SX402"]],
};

// ─── SEED DATA: AGREEMENTS ─────────────────────────────────────────────────
export const PA_DATA: PurchaseAgreement[] = [
  { id: "PA-001", subsidiary: "CAI", subsidiaryName: "Platfarm Cairo", products: ["SunCured Alfalfa Grade 1", "Egyptian Straw"], qtyTotal: 2400, status: "active", category: "Alfalfa", incoterm: "CIF", paymentTerms: "Cash Against Documents", validFrom: "2025-10-01", validTo: "2026-09-30" },
  { id: "PA-002", subsidiary: "ALF", subsidiaryName: "AlfaGlobal Agribusiness", products: ["Premium SunCured Alfalfa", "AlfaMIX Grass", "AlfaMix Straw"], qtyTotal: 1800, status: "active", category: "Alfalfa", incoterm: "FOB", paymentTerms: "Letter of Credit", validFrom: "2025-11-01", validTo: "2026-10-31" },
  { id: "PA-003", subsidiary: "SOK", subsidiaryName: "Platfarm Sokhna", products: ["Double Press Alfalfa Grade 1", "Standard Alfalfa"], qtyTotal: 1500, status: "active", category: "Alfalfa", incoterm: "CIF", paymentTerms: "30 Days Net", validFrom: "2025-12-01", validTo: "2026-11-30" },
];

export const SA_DATA: SalesAgreement[] = [
  { id: "SA-001", customer: "Al Dahra Agriculture", products: ["Premium SunCured Alfalfa"], qtyTotal: 1500, status: "active", category: "Alfalfa", incoterm: "CIF", paymentTerms: "Cash Against Documents", validFrom: "2025-10-15", validTo: "2026-10-14" },
  { id: "SA-002", customer: "Emirates Livestock Co.", products: ["AlfaMIX Grass", "Alfalfa Grade 1"], qtyTotal: 1200, status: "active", category: "AlfaMIX Grass", incoterm: "DAP", paymentTerms: "Letter of Credit", validFrom: "2025-11-01", validTo: "2026-10-31" },
  { id: "SA-003", customer: "Saudi Feed Industries", products: ["Double Press Alfalfa Grade 1"], qtyTotal: 800, status: "active", category: "Alfalfa", incoterm: "CIF", paymentTerms: "Cash Against Delivery", validFrom: "2025-12-01", validTo: "2026-11-30" },
  { id: "SA-004", customer: "Kuwait Agri Trading", products: ["Egyptian Straw", "AlfaMix Straw"], qtyTotal: 2000, status: "active", category: "Straw", incoterm: "FOB", paymentTerms: "60 Days Net", validFrom: "2026-01-01", validTo: "2026-12-31" },
];

// ─── SEED DATA BUILDER ─────────────────────────────────────────────────────
export function buildSeed(): { ps: PurchaseShipment[]; ss: SalesShipment[] } {
  const ps: PurchaseShipment[] = [
    { id: "PSH-001", type: "purchase", paId: "PA-003", subsidiary: "SOK", subsidiaryName: "Platfarm Sokhna", lines: [{ product: "Double Press, Grade 1 Egyptian SunCured Alfalfa, Bale 400-425 Kg", qty: 450, uom: "MT", unitPrice: 210, discount: 0, subtotal: 94500, purchasePrice: 210 }], totalCost: 94500, paymentStatus: "partial", stage: "in_transit", vessel: "MSC LORENA", voyage: "FA612A", shippingLine: "MSC", bookingNumber: "BK-MSC-2601", bookingStatus: "Confirmed", blNumber: "MSCUAB260100", blType: "Telex", blStatus: "Issued", loadType: "FCL", freightType: "Prepaid", incoterm: "CIF", vesselCutOff: "2026-02-13", portLoad: "Alexandria", portDischarge: "Jebel Ali", etd: "2026-02-15", eta: "2026-03-05", loads: [], documents: mkDocs(["booking_note", "commercial_invoice", "packing_list", "bill_of_lading", "certificate_of_origin", "phytosanitary_cert"]), activity: [{ date: "2026-02-10", time: "09:00", user: "Ahmed K.", action: "Shipment created" }], linkedSalesShipmentId: "SSH-001" },
    { id: "PSH-002", type: "purchase", paId: "PA-001", subsidiary: "CAI", subsidiaryName: "Platfarm Cairo", lines: [{ product: "SunCured Alfalfa Grade 1, Single Press, Bale 350-380 Kg", qty: 240, uom: "MT", unitPrice: 195, discount: 0, subtotal: 46800, purchasePrice: 195 }], totalCost: 46800, paymentStatus: "not_paid", stage: "loading", vessel: "COSCO FAITH", voyage: "021E", shippingLine: "COSCO", bookingNumber: "BK-COS-2602", bookingStatus: "Confirmed", blNumber: "", blType: "", blStatus: "", loadType: "FCL", freightType: "Prepaid", incoterm: "FOB", vesselCutOff: "2026-02-28", portLoad: "Sokhna", portDischarge: "Dammam", etd: "2026-03-01", eta: "2026-03-18", loads: [], documents: mkDocs(["booking_note", "commercial_invoice", "packing_list"]), activity: [{ date: "2026-02-18", time: "11:00", user: "Ahmed K.", action: "Shipment created" }], linkedSalesShipmentId: "SSH-002" },
    { id: "PSH-003", type: "purchase", paId: "PA-002", subsidiary: "ALF", subsidiaryName: "AlfaGlobal Agribusiness", lines: [{ product: "Premium SunCured Alfalfa, Double Press, Bale 400-425 Kg, Height 85 cm", qty: 600, uom: "MT", unitPrice: 225, discount: 2, subtotal: 132300, purchasePrice: 225 }], totalCost: 132300, paymentStatus: "paid", stage: "arrived_at_port", vessel: "MAERSK SANA", voyage: "310W", shippingLine: "MAERSK", bookingNumber: "BK-MAE-2603", bookingStatus: "Confirmed", blNumber: "MAEUAB260300", blType: "Original", blStatus: "Issued", loadType: "FCL", freightType: "Collect", incoterm: "CIF", vesselCutOff: "2026-01-30", portLoad: "Alexandria", portDischarge: "Khalifa Port", etd: "2026-02-01", eta: "2026-02-18", loads: [], documents: mkDocs(["booking_note", "commercial_invoice", "packing_list", "bill_of_lading", "certificate_of_origin", "phytosanitary_cert", "fumigation_cert"]), activity: [{ date: "2026-02-01", time: "08:00", user: "Ahmed K.", action: "Shipment created" }], linkedSalesShipmentId: "SSH-003" },
    { id: "PSH-004", type: "purchase", paId: "PA-001", subsidiary: "CAI", subsidiaryName: "Platfarm Cairo", lines: [{ product: "Egyptian Straw, Bale 200-220 Kg", qty: 360, uom: "MT", unitPrice: 115, discount: 0, subtotal: 41400, purchasePrice: 115 }], totalCost: 41400, paymentStatus: "paid", stage: "customs_clearance", vessel: "EVERGREEN EVER", voyage: "S182", shippingLine: "EVERGREEN", bookingNumber: "BK-EVG-2604", bookingStatus: "Confirmed", blNumber: "EGLVAB260400", blType: "Telex", blStatus: "Issued", loadType: "FCL", freightType: "Prepaid", incoterm: "DDP", vesselCutOff: "2026-02-03", portLoad: "Sokhna", portDischarge: "Jebel Ali", etd: "2026-02-05", eta: "2026-02-22", loads: [], documents: mkDocs(["booking_note", "commercial_invoice", "packing_list", "bill_of_lading", "certificate_of_origin", "phytosanitary_cert", "fumigation_cert"]), activity: [{ date: "2026-02-05", time: "10:00", user: "Ahmed K.", action: "Shipment created" }], linkedSalesShipmentId: "SSH-004" },
    { id: "PSH-005", type: "purchase", paId: "PA-002", subsidiary: "ALF", subsidiaryName: "AlfaGlobal Agribusiness", lines: [{ product: "AlfaMIX Grass, Grade 1, Bale 380-400 Kg", qty: 300, uom: "MT", unitPrice: 185, discount: 0, subtotal: 55500, purchasePrice: 185 }], totalCost: 55500, paymentStatus: "not_paid", stage: "planned", vessel: "", voyage: "", shippingLine: "", bookingNumber: "", bookingStatus: "", blNumber: "", blType: "", blStatus: "", loadType: "FCL", freightType: "", incoterm: "FOB", vesselCutOff: "", portLoad: "Alexandria", portDischarge: "Jebel Ali", etd: "", eta: "", loads: [], documents: mkDocs([]), activity: [{ date: "2026-02-22", time: "15:00", user: "Ahmed K.", action: "Draft created" }] },
  ];

  // Attach loads to purchase shipments
  ps.forEach(sh => {
    const cnts = CONTAINERS_PURCHASE[sh.id] || [];
    sh.loads = cnts.map((c, i) => {
      const ldState = sh.stage === "planned" ? "draft" : sh.stage === "loading" ? "confirmed" : sh.stage === "delivered" ? "done" : "assigned";
      return mkLoad(i, sh.id, { cn: c[0], ct: c[1], seal: c[2], state: ldState, schedDate: sh.etd || "2026-02-20", arrDate: sh.eta || "2026-03-01", doneDate: sh.stage === "delivered" ? sh.eta : "" });
    });
  });

  const ss: SalesShipment[] = [
    { id: "SSH-001", type: "sales", saId: "SA-001", company: "AD", customer: "Al Dahra Agriculture", lines: [{ product: "Double Press, Grade 1 Egyptian SunCured Alfalfa, Bale 400-425 Kg", qty: 450, uom: "MT", unitPrice: 285, discount: 0, subtotal: 128250, purchasePrice: 210, margin: 33750, marginPercent: 26.3, qtyDelivered: 0, qtyInvoiced: 0 }], totalValue: 128250, margin: 33750, marginPercent: 26.3, currency: "USD", productCategory: "Alfalfa", acceptanceStatus: "", deliveryStatus: "not_delivered", ultimateCustomer: "Al Dahra Farms", oceanFreightInvoicingEntity: "DP Logistics", oceanFreightInvoicedEntity: "Platfarm AUH", clearanceTruckingInvoicingEntity: "Ramadan", clearanceTruckingInvoicedEntity: "Platfarm AUH", totalWeightTons: 450, paymentStatus: "partial", stage: "sailed", vessel: "MSC LORENA", voyage: "FA612A", shippingLine: "MSC", bookingNumber: "BK-MSC-2601", bookingStatus: "Confirmed", blNumber: "MSCUAB260100", blType: "Telex", blStatus: "Issued", sellingType: "Direct Selling", paymentTerm: "Cash Against Documents", loadType: "FCL", freightType: "Prepaid", incoterm: "CIF", vesselCutOff: "2026-02-13", portLoad: "Alexandria", portDischarge: "Jebel Ali", etd: "2026-02-15", eta: "2026-03-05", loads: [], documents: mkDocs(["booking_note", "commercial_invoice", "packing_list", "bill_of_lading"]), activity: [{ date: "2026-02-10", time: "09:30", user: "Ahmed K.", action: "Sales shipment created" }], linkedPurchaseShipmentId: "PSH-001" },
    { id: "SSH-002", type: "sales", saId: "SA-003", company: "CAI", customer: "Saudi Feed Industries", lines: [{ product: "SunCured Alfalfa Grade 1, Single Press, Bale 350-380 Kg", qty: 240, uom: "MT", unitPrice: 270, discount: 0, subtotal: 64800, purchasePrice: 195, margin: 18000, marginPercent: 27.8, qtyDelivered: 0, qtyInvoiced: 0 }], totalValue: 64800, margin: 18000, marginPercent: 27.8, currency: "USD", productCategory: "Alfalfa", acceptanceStatus: "", deliveryStatus: "not_delivered", ultimateCustomer: "", oceanFreightInvoicingEntity: "Shipping Line", oceanFreightInvoicedEntity: "Platfarm Cairo", clearanceTruckingInvoicingEntity: "DP Logistics", clearanceTruckingInvoicedEntity: "Platfarm AUH", totalWeightTons: 240, paymentStatus: "not_paid", stage: "stuffing_loading", vessel: "COSCO FAITH", voyage: "021E", shippingLine: "COSCO", bookingNumber: "BK-COS-2602", bookingStatus: "Confirmed", blNumber: "", blType: "", blStatus: "", sellingType: "Direct Selling", paymentTerm: "Letter of Credit", loadType: "FCL", freightType: "Prepaid", incoterm: "FOB", vesselCutOff: "2026-02-28", portLoad: "Sokhna", portDischarge: "Dammam", etd: "2026-03-01", eta: "2026-03-18", loads: [], documents: mkDocs(["booking_note", "commercial_invoice"]), activity: [{ date: "2026-02-18", time: "11:30", user: "Ahmed K.", action: "Sales shipment created" }], linkedPurchaseShipmentId: "PSH-002" },
    { id: "SSH-003", type: "sales", saId: "SA-002", company: "AD", customer: "Emirates Livestock Co.", lines: [{ product: "Premium SunCured Alfalfa, Double Press, Bale 400-425 Kg, Height 85 cm", qty: 600, uom: "MT", unitPrice: 310, discount: 2, subtotal: 182280, purchasePrice: 225, margin: 49980, marginPercent: 27.4, qtyDelivered: 450, qtyInvoiced: 300 }], totalValue: 182280, margin: 49980, marginPercent: 27.4, currency: "USD", productCategory: "Alfalfa", acceptanceStatus: "Partially Accepted", deliveryStatus: "partially_delivered", ultimateCustomer: "Emirates Livestock Farms", oceanFreightInvoicingEntity: "Posidon", oceanFreightInvoicedEntity: "Platfarm AUH", clearanceTruckingInvoicingEntity: "Ramadan", clearanceTruckingInvoicedEntity: "Platfarm AUH", totalWeightTons: 600, paymentStatus: "paid", stage: "arrived", vessel: "MAERSK SANA", voyage: "310W", shippingLine: "MAERSK", bookingNumber: "BK-MAE-2603", bookingStatus: "Confirmed", blNumber: "MAEUAB260300", blType: "Original", blStatus: "Issued", sellingType: "Consignment", paymentTerm: "Cash Against Delivery", loadType: "FCL", freightType: "Collect", incoterm: "CIF", vesselCutOff: "2026-01-30", portLoad: "Alexandria", portDischarge: "Khalifa Port", etd: "2026-02-01", eta: "2026-02-18", loads: [], documents: mkDocs(["booking_note", "commercial_invoice", "packing_list", "bill_of_lading", "certificate_of_origin", "phytosanitary_cert"]), activity: [{ date: "2026-02-01", time: "08:30", user: "Ahmed K.", action: "Sales shipment created" }], linkedPurchaseShipmentId: "PSH-003" },
    { id: "SSH-004", type: "sales", saId: "SA-004", company: "AD", customer: "Kuwait Agri Trading", lines: [{ product: "Egyptian Straw, Bale 200-220 Kg", qty: 360, uom: "MT", unitPrice: 155, discount: 0, subtotal: 55800, purchasePrice: 115, margin: 14400, marginPercent: 25.8, qtyDelivered: 280, qtyInvoiced: 280 }], totalValue: 55800, margin: 14400, marginPercent: 25.8, currency: "USD", productCategory: "Straw", acceptanceStatus: "Fully Accepted", deliveryStatus: "partially_delivered", ultimateCustomer: "Kuwait National Farms", oceanFreightInvoicingEntity: "DP Logistics", oceanFreightInvoicedEntity: "Platfarm AUH", clearanceTruckingInvoicingEntity: "Posidon", clearanceTruckingInvoicedEntity: "Platfarm Cairo", totalWeightTons: 360, paymentStatus: "paid", stage: "delivering", vessel: "EVERGREEN EVER", voyage: "S182", shippingLine: "EVERGREEN", bookingNumber: "BK-EVG-2604", bookingStatus: "Confirmed", blNumber: "EGLVAB260400", blType: "Telex", blStatus: "Issued", sellingType: "Direct Selling", paymentTerm: "Post Dated Cheque", loadType: "FCL", freightType: "Prepaid", incoterm: "DDP", vesselCutOff: "2026-02-03", portLoad: "Sokhna", portDischarge: "Jebel Ali", etd: "2026-02-05", eta: "2026-02-22", loads: [], documents: mkDocs(["booking_note", "commercial_invoice", "packing_list", "bill_of_lading", "certificate_of_origin", "phytosanitary_cert"]), activity: [{ date: "2026-02-05", time: "10:30", user: "Ahmed K.", action: "Sales shipment created" }], linkedPurchaseShipmentId: "PSH-004" },
  ];

  // Attach loads to sales shipments
  ss.forEach(sh => {
    const cnts = CONTAINERS_SALES[sh.id] || [];
    const stState = ["planned", "stuffing_loading"].includes(sh.stage) ? "confirmed" : sh.stage === "delivered" ? "done" : "assigned";
    sh.loads = cnts.map((c, i) => mkLoad(i, sh.id, { cn: c[0], ct: c[1], seal: c[2], prefix: "WH/OUT", seqStart: 3200, state: stState, schedDate: sh.etd || "2026-02-20", arrDate: sh.eta || "2026-03-01", doneDate: sh.stage === "delivered" ? sh.eta : "" }));
  });

  return { ps, ss };
}
