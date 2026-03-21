import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the odoo-shipments module
vi.mock("./odoo-shipments", () => ({
  fetchPurchaseOrders: vi.fn(),
  fetchPurchaseOrderById: vi.fn(),
  fetchPurchaseOrderByName: vi.fn(),
  countPurchaseOrders: vi.fn(),
  fetchPOLines: vi.fn(),
  fetchPickings: vi.fn(),
  fetchPickingsForPO: vi.fn(),
  createPurchaseOrder: vi.fn(),
  updatePurchaseOrder: vi.fn(),
  updatePicking: vi.fn(),
  uploadFileToPO: vi.fn(),
  uploadFileToPicking: vi.fn(),
  readPOFile: vi.fn(),
  readPickingFile: vi.fn(),
  fetchIncoterms: vi.fn(),
  fetchEmployees: vi.fn(),
  fetchPaymentTerms: vi.fn(),
  fetchPaymentTermLines: vi.fn(),
  fetchPartners: vi.fn(),
  fetchInvoicesByIds: vi.fn(),
  distributeWeightAcrossPickings: vi.fn(),
  resolveEmployeeIds: vi.fn().mockResolvedValue(new Map()),
  checkPickingFileStatus: vi.fn().mockResolvedValue({}),
  checkPOFileStatus: vi.fn().mockResolvedValue({}),
  searchPickingsByLoadField: vi.fn().mockResolvedValue([]),
  fetchPOVesselNameByPOName: vi.fn().mockResolvedValue(null),
}));

import {
  fetchPurchaseOrders,
  fetchPurchaseOrderById,
  countPurchaseOrders,
  fetchPOLines,
  fetchPickings,
  createPurchaseOrder,
  updatePurchaseOrder,
  updatePicking,
  uploadFileToPO,
  uploadFileToPicking,
  readPOFile,
  readPickingFile,
  fetchIncoterms,
  fetchEmployees,
  distributeWeightAcrossPickings,
} from "./odoo-shipments";

const mockedFetchPOs = vi.mocked(fetchPurchaseOrders);
const mockedFetchPOById = vi.mocked(fetchPurchaseOrderById);
const mockedCountPOs = vi.mocked(countPurchaseOrders);
const mockedFetchPOLines = vi.mocked(fetchPOLines);
const mockedFetchPickings = vi.mocked(fetchPickings);
const mockedCreatePO = vi.mocked(createPurchaseOrder);
const mockedUpdatePO = vi.mocked(updatePurchaseOrder);
const mockedUpdatePicking = vi.mocked(updatePicking);
const mockedUploadPOFile = vi.mocked(uploadFileToPO);
const mockedUploadPickingFile = vi.mocked(uploadFileToPicking);
const mockedReadPOFile = vi.mocked(readPOFile);
const mockedReadPickingFile = vi.mocked(readPickingFile);
const mockedFetchIncoterms = vi.mocked(fetchIncoterms);
const mockedFetchEmployees = vi.mocked(fetchEmployees);

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// Sample raw PO data as returned by Odoo
const sampleRawPO = {
  id: 100,
  name: "PO/TEST/001",
  partner_id: [895, "Test Vendor"],
  company_id: [3, "ABU DHABI Company"],
  state: "purchase",
  date_order: "2026-03-01 10:00:00",
  date_planned: "2026-03-15 10:00:00",
  amount_total: 50000,
  amount_untaxed: 45000,
  amount_tax: 5000,
  currency_id: [2, "USD"],
  requisition_id: [17, "BO00014"],
  order_line: [501, 502],
  picking_ids: [601, 602, 603],
  number_of_loads: 3,
  x_studio_vessel_name: "MSC LORENA",
  x_studio_tracking_number: "TRK-001",
  x_studio_shipment_date: "2026-03-10",
  eta_arrival: "2026-03-25",
  x_studio_product_category: "alfalfa",
  freight_type: "ocean",
  load_type: "container_shipment",
  ocean_transporter_company: "msc",
  x_studio_shipment_status: false,
  incoterm_id: [1, "FOB"],
  local_clearance_agent: [10, "Agent Co"],
  local_trucking_company: [20, "Trucking Co"],
  x_studio_procurement_officer: [30, "John Doe"],
  x_studio_ultimate_customer: "Al Dahra",
  x_studio_total_free_days_demurrage_detention: 14,
  x_studio_transit_time_days: 12,
  x_studio_vessel_cut_off: "2026-03-08",
  x_studio_rate_per_containerload: 1500,
  x_studio_total_shipment_weight_in_tons_1: 75.5,
  x_studio_selling_price_per_ton: 350,
  x_studio_payment_status: false,
  x_studio_shipment_documentation_status: false,
  x_studio_shipment_acceptance_status: false,
};

const sampleRawLine = {
  id: 501,
  product_id: [10, "Alfalfa Bales"],
  product_qty: 25000,
  qty_received: 0,
  qty_invoiced: 0,
  price_unit: 2.0,
  price_subtotal: 50000,
  product_uom: [1, "kg"],
  date_planned: "2026-03-15 10:00:00",
};

const sampleRawPicking = {
  id: 601,
  name: "WH/IN/00001",
  state: "draft",
  partner_id: [895, "Test Vendor"],
  origin: "PO/TEST/001",
  scheduled_date: "2026-03-15 10:00:00",
  date_done: false,
  picking_type_id: [1, "Receipts"],
  company_id: [3, "ABU DHABI Company"],
  x_studio_loadcontainer_number_1: "CONT-001",
  x_studio_seal_number: "SEAL-001",
  x_studio_loading_date: "2026-03-10",
  x_studio_net_weight_in_tons: 25.5,
  x_studio_quantity_in_tons: 25.0,
  x_studio_tare_weight_in_tons: 0.5,
  x_studio_number_of_balesbags: "50",
  x_studio_loading_store: "Store A",
  x_studio_truck_load_serial_tl: "TL-001",
  x_studio_loaded_grade: "grade_1",
  x_studio_source: "toshka",
  x_studio_purchasing_unit: "cairo_unit",
  x_studio_quality_score: 85,
  x_studio_moisture_: 12.5,
  x_studio_ndf_: 45.0,
  x_studio_adf_: 30.0,
  x_studio_crude_protein_dry_matter_: 18.5,
  x_studio_premium_grade: false,
  x_studio_standard_: false,
  x_studio_trucking_fee: 500,
  x_studio_trucking_fees: "per_load",
  x_studio_trucking_cost_currency: "egp",
  x_studio_local_trucking_driver: [40, "Driver Ahmed"],
  x_studio_local_trucking_driver_contact: "+20123456789",
  x_studio_loadcontainer_cleanliness: true,
  x_studio_proper_loadcontainer_lashing: true,
  x_studio_proper_loadcontainer_stacking: true,
  x_studio_presence_of_truck_cover: false,
  x_studio_payment_confirmation: true,
  x_studio_sku_confirmation: false,
};

describe("shipments.list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns mapped PO list with correct field names", async () => {
    mockedFetchPOs.mockResolvedValue([sampleRawPO as any]);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.list();

    expect(result).toHaveLength(1);
    const po = result[0];
    expect(po.id).toBe(100);
    expect(po.name).toBe("PO/TEST/001");
    expect(po.vendor).toEqual({ id: 895, name: "Test Vendor" });
    expect(po.company).toEqual({ id: 3, name: "ABU DHABI Company" });
    expect(po.state).toBe("purchase");
    expect(po.amountTotal).toBe(50000);
    expect(po.currency).toEqual({ id: 2, name: "USD" });
    expect(po.agreement).toEqual({ id: 17, name: "BO00014" });
    expect(po.numberOfLoads).toBe(3);
    expect(po.vesselName).toBe("MSC LORENA");
    expect(po.trackingNumber).toBe("TRK-001");
    expect(po.productCategory).toBe("alfalfa");
    expect(po.freightType).toBe("ocean");
    expect(po.loadType).toBe("container_shipment");
    expect(po.shippingLine).toBe("msc");
    expect(po.freeDaysDemurrage).toBe(14);
    expect(po.transitTimeDays).toBe(12);
    expect(po.totalShipmentWeight).toBe(75.5);
    expect(po.sellingPricePerTon).toBe(350);
    expect(po.ultimateCustomer).toBe("Al Dahra");
  });

  it("passes companyId and requisitionId filters to fetchPurchaseOrders", async () => {
    mockedFetchPOs.mockResolvedValue([]);
    const caller = appRouter.createCaller(createContext());
    await caller.shipments.list({ companyId: 3, requisitionId: 17 });

    expect(mockedFetchPOs).toHaveBeenCalledWith({
      companyId: 3,
      requisitionId: 17,
      limit: 200,
      offset: 0,
    });
  });

  it("handles null Many2one fields gracefully", async () => {
    const poWithNulls = {
      ...sampleRawPO,
      partner_id: false,
      company_id: false,
      currency_id: false,
      requisition_id: false,
      incoterm_id: false,
      local_clearance_agent: false,
      local_trucking_company: false,
      x_studio_procurement_officer: false,
      x_studio_vessel_name: false,
      x_studio_tracking_number: false,
    };
    mockedFetchPOs.mockResolvedValue([poWithNulls as any]);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.list();

    expect(result[0].vendor).toBeNull();
    expect(result[0].company).toBeNull();
    expect(result[0].currency).toBeNull();
    expect(result[0].agreement).toBeNull();
    expect(result[0].vesselName).toBeNull();
    expect(result[0].trackingNumber).toBeNull();
  });
});

describe("shipments.count", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns count from countPurchaseOrders", async () => {
    mockedCountPOs.mockResolvedValue(42);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.count();
    expect(result).toBe(42);
  });

  it("passes filters to countPurchaseOrders", async () => {
    mockedCountPOs.mockResolvedValue(5);
    const caller = appRouter.createCaller(createContext());
    await caller.shipments.count({ companyId: 3, requisitionId: 17 });
    expect(mockedCountPOs).toHaveBeenCalledWith({ companyId: 3, requisitionId: 17 });
  });
});

describe("shipments.getById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns full PO with lines and pickings", async () => {
    mockedFetchPOById.mockResolvedValue(sampleRawPO as any);
    mockedFetchPOLines.mockResolvedValue([sampleRawLine as any]);
    mockedFetchPickings.mockResolvedValue([sampleRawPicking as any]);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.getById({ id: 100 });

    // PO header
    expect(result.id).toBe(100);
    expect(result.name).toBe("PO/TEST/001");
    expect(result.vesselName).toBe("MSC LORENA");

    // Lines
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].product).toEqual({ id: 10, name: "Alfalfa Bales" });
    expect(result.lines[0].qty).toBe(25000);
    expect(result.lines[0].priceUnit).toBe(2.0);
    expect(result.lines[0].uom).toEqual({ id: 1, name: "kg" });

    // Pickings
    expect(result.pickings).toHaveLength(1);
    expect(result.pickings[0].name).toBe("WH/IN/00001");
    expect(result.pickings[0].containerNumber).toBe("CONT-001");
    expect(result.pickings[0].sealNumber).toBe("SEAL-001");
    expect(result.pickings[0].netWeightTons).toBe(25.5);
    expect(result.pickings[0].quantityTons).toBe(25.0);
    expect(result.pickings[0].tareWeightTons).toBe(0.5);
    expect(result.pickings[0].balesBags).toBe("50");
    expect(result.pickings[0].loadedGrade).toBe("grade_1");
    expect(result.pickings[0].source).toBe("toshka");
    expect(result.pickings[0].qualityScore).toBe(85);
    expect(result.pickings[0].moisture).toBe(12.5);
    expect(result.pickings[0].ndf).toBe(45.0);
    expect(result.pickings[0].adf).toBe(30.0);
    expect(result.pickings[0].crudeProtein).toBe(18.5);
    expect(result.pickings[0].truckingFee).toBe(500);
    expect(result.pickings[0].truckingDriver).toEqual({ id: 40, name: "Driver Ahmed" });
    expect(result.pickings[0].containerCleanliness).toBe(true);
    expect(result.pickings[0].properLashing).toBe(true);
    expect(result.pickings[0].properStacking).toBe(true);
    expect(result.pickings[0].truckCover).toBe(false);
    expect(result.pickings[0].paymentConfirmation).toBe(true);
  });

  it("throws when PO not found", async () => {
    mockedFetchPOById.mockResolvedValue(null as any);
    const caller = appRouter.createCaller(createContext());
    await expect(caller.shipments.getById({ id: 999 })).rejects.toThrow("Purchase order not found");
  });

  it("fetches lines and pickings in parallel", async () => {
    mockedFetchPOById.mockResolvedValue(sampleRawPO as any);
    mockedFetchPOLines.mockResolvedValue([]);
    mockedFetchPickings.mockResolvedValue([]);

    const caller = appRouter.createCaller(createContext());
    await caller.shipments.getById({ id: 100 });

    expect(mockedFetchPOLines).toHaveBeenCalledWith([501, 502]);
    expect(mockedFetchPickings).toHaveBeenCalledWith([601, 602, 603]);
  });
});

describe("shipments.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a PO and returns the new ID", async () => {
    mockedCreatePO.mockResolvedValue(200);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.create({
      partner_id: 895,
      company_id: 3,
      currency_id: 2,
      number_of_loads: 3,
      x_studio_vessel_name: "MSC LORENA",
      x_studio_product_category: "alfalfa",
      freight_type: "ocean",
      load_type: "container_shipment",
      ocean_transporter_company: "msc",
      lines: [
        { product_id: 10, product_qty: 25000, price_unit: 2.0, product_uom: 1 },
      ],
    });

    expect(result.id).toBe(200);
    expect(mockedCreatePO).toHaveBeenCalledTimes(1);
  });

  it("passes distribute_weight_equally flag to createPurchaseOrder", async () => {
    mockedCreatePO.mockResolvedValue(201);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.create({
      partner_id: 895,
      company_id: 3,
      distribute_weight_equally: true,
      lines: [
        { product_id: 10, product_qty: 25000, price_unit: 2.0 },
      ],
    });

    expect(result.id).toBe(201);
    expect(mockedCreatePO).toHaveBeenCalledWith(
      expect.objectContaining({ distribute_weight_equally: true })
    );
  });

  it("passes distribute_weight_equally=false when unchecked", async () => {
    mockedCreatePO.mockResolvedValue(202);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.create({
      partner_id: 895,
      company_id: 3,
      distribute_weight_equally: false,
      lines: [
        { product_id: 10, product_qty: 25000, price_unit: 2.0 },
      ],
    });

    expect(result.id).toBe(202);
    expect(mockedCreatePO).toHaveBeenCalledWith(
      expect.objectContaining({ distribute_weight_equally: false })
    );
  });
});

describe("shipments.update", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates a PO and returns success", async () => {
    mockedUpdatePO.mockResolvedValue(true);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.update({
      id: 100,
      x_studio_vessel_name: "NEW VESSEL",
      x_studio_tracking_number: "NEW-TRK",
      x_studio_ultimate_customer: "New Customer",
      x_studio_total_free_days_demurrage_detention: 21,
    });

    expect(result.success).toBe(true);
    expect(mockedUpdatePO).toHaveBeenCalledWith({
      id: 100,
      x_studio_vessel_name: "NEW VESSEL",
      x_studio_tracking_number: "NEW-TRK",
      x_studio_ultimate_customer: "New Customer",
      x_studio_total_free_days_demurrage_detention: 21,
    });
  });
});

describe("shipments.updatePicking", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates a picking with all fields", async () => {
    mockedUpdatePicking.mockResolvedValue(true);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.updatePicking({
      id: 601,
      x_studio_loadcontainer_number_1: "CONT-NEW",
      x_studio_seal_number: "SEAL-NEW",
      x_studio_net_weight_in_tons: 26.0,
      x_studio_quantity_in_tons: 25.5,
      x_studio_tare_weight_in_tons: 0.5,
      x_studio_number_of_balesbags: "55",
      x_studio_loaded_grade: "grade_1",
      x_studio_source: "toshka",
      x_studio_quality_score: 90,
      x_studio_moisture_: 11.0,
      x_studio_ndf_: 44.0,
      x_studio_adf_: 29.0,
      x_studio_crude_protein_dry_matter_: 19.0,
      x_studio_loadcontainer_cleanliness: true,
      x_studio_proper_loadcontainer_stacking: true,
      x_studio_proper_loadcontainer_lashing: true,
      x_studio_presence_of_truck_cover: true,
      x_studio_payment_confirmation: true,
    });

    expect(result.success).toBe(true);
    expect(mockedUpdatePicking).toHaveBeenCalledTimes(1);
    const callArg = mockedUpdatePicking.mock.calls[0][0];
    expect(callArg.id).toBe(601);
    expect(callArg.x_studio_loadcontainer_number_1).toBe("CONT-NEW");
    expect(callArg.x_studio_crude_protein_dry_matter_).toBe(19.0);
    expect(callArg.x_studio_source).toBe("toshka");
  });
});

describe("shipments.uploadPOFile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploads a file to a PO field", async () => {
    mockedUploadPOFile.mockResolvedValue(true);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.uploadPOFile({
      poId: 100,
      fieldName: "bl",
      base64Content: "dGVzdA==",
    });

    expect(result.success).toBe(true);
    expect(mockedUploadPOFile).toHaveBeenCalledWith(100, "bl", "dGVzdA==");
  });
});

describe("shipments.uploadPickingFile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploads a file to a picking field", async () => {
    mockedUploadPickingFile.mockResolvedValue(true);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.uploadPickingFile({
      pickingId: 601,
      fieldName: "x_studio_quality_assessment_form",
      base64Content: "dGVzdA==",
    });

    expect(result.success).toBe(true);
    expect(mockedUploadPickingFile).toHaveBeenCalledWith(601, "x_studio_quality_assessment_form", "dGVzdA==");
  });
});

describe("shipments.readPOFile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads a file from a PO field", async () => {
    mockedReadPOFile.mockResolvedValue("base64data==");
    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.readPOFile({ poId: 100, fieldName: "bl" });
    expect(result.content).toBe("base64data==");
  });

  it("returns null when file not present", async () => {
    mockedReadPOFile.mockResolvedValue(null as any);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.readPOFile({ poId: 100, fieldName: "bl" });
    expect(result.content).toBeNull();
  });
});

describe("shipments.readPickingFile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads a file from a picking field", async () => {
    mockedReadPickingFile.mockResolvedValue("pickingfile==");
    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.readPickingFile({ pickingId: 601, fieldName: "x_studio_quality_assessment_form" });
    expect(result.content).toBe("pickingfile==");
  });
});

describe("shipments.incoterms", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns mapped incoterms", async () => {
    mockedFetchIncoterms.mockResolvedValue([
      { id: 1, name: "Free On Board", code: "FOB" },
      { id: 2, name: "Cost Insurance Freight", code: "CIF" },
    ] as any);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.incoterms();
    expect(result).toEqual([
      { id: 1, name: "Free On Board", code: "FOB" },
      { id: 2, name: "Cost Insurance Freight", code: "CIF" },
    ]);
  });
});

describe("shipments.employees", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns mapped employees", async () => {
    mockedFetchEmployees.mockResolvedValue([
      { id: 1, name: "John Doe" },
      { id: 2, name: "Jane Smith" },
    ] as any);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.employees();
    expect(result).toEqual([
      { id: 1, name: "John Doe" },
      { id: 2, name: "Jane Smith" },
    ]);
  });

  it("passes search filter", async () => {
    mockedFetchEmployees.mockResolvedValue([]);
    const caller = appRouter.createCaller(createContext());
    await caller.shipments.employees({ search: "John" });
    expect(mockedFetchEmployees).toHaveBeenCalledWith("John");
  });
});

describe("shipments.redistributeWeight", () => {
  const mockedDistributeWeight = vi.mocked(distributeWeightAcrossPickings);

  it("fetches PO lines and calls distributeWeightAcrossPickings", async () => {
    mockedFetchPOById.mockResolvedValue({
      id: 100,
      name: "PO00100",
      order_line: [1, 2],
      picking_ids: [10, 11],
    } as any);
    mockedFetchPOLines.mockResolvedValue([
      { id: 1, product_id: [5, "Product A"], product_qty: 1000, product_uom: [3, "kg"] },
      { id: 2, product_id: [6, "Product B"], product_qty: 500, product_uom: [3, "kg"] },
    ] as any);
    mockedDistributeWeight.mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.redistributeWeight({ orderId: 100 });

    expect(result).toEqual({ success: true });
    expect(mockedFetchPOById).toHaveBeenCalledWith(100);
    expect(mockedFetchPOLines).toHaveBeenCalledWith([1, 2]);
    expect(mockedDistributeWeight).toHaveBeenCalledWith(
      100,
      [
        { product_id: 5, product_qty: 1000, product_uom: 3 },
        { product_id: 6, product_qty: 500, product_uom: 3 },
      ],
      "purchase"
    );
  });

  it("throws if PO not found", async () => {
    mockedFetchPOById.mockResolvedValue(null as any);
    const caller = appRouter.createCaller(createContext());
    await expect(caller.shipments.redistributeWeight({ orderId: 999 })).rejects.toThrow("Purchase order not found");
  });
});
