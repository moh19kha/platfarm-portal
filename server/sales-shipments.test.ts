import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the odoo-shipments module (for fetchPOVesselNameByPOName used in getById)
vi.mock("./odoo-shipments", () => ({
  fetchPOVesselNameByPOName: vi.fn().mockResolvedValue({
    vesselName: "GFS PERFECT",
    poId: 1594,
    freeDaysDemurrage: 14,
    telexBLIssued: true,
  }),
  distributeWeightAcrossPickings: vi.fn(),
}));
import { distributeWeightAcrossPickings } from "./odoo-shipments";

// Mock the odoo-sales-shipments module
vi.mock("./odoo-sales-shipments", () => ({
  fetchSaleOrders: vi.fn(),
  fetchSaleOrderById: vi.fn(),
  countSaleOrders: vi.fn(),
  fetchSOLines: vi.fn(),
  fetchPickings: vi.fn(),
  createSaleOrder: vi.fn(),
  updateSaleOrder: vi.fn(),
  updateSalesPicking: vi.fn(),
  uploadFileToSO: vi.fn(),
  uploadFileToSalesPicking: vi.fn(),
  readSOFile: vi.fn(),
  readSalesPickingFile: vi.fn(),
  confirmSaleOrder: vi.fn(),
}));

import {
  fetchSaleOrders,
  fetchSaleOrderById,
  countSaleOrders,
  fetchSOLines,
  fetchPickings,
  createSaleOrder,
  updateSaleOrder,
  updateSalesPicking,
  uploadFileToSO,
  uploadFileToSalesPicking,
  readSOFile,
  readSalesPickingFile,
  confirmSaleOrder,
} from "./odoo-sales-shipments";

const mockedFetchSOs = vi.mocked(fetchSaleOrders);
const mockedFetchSOById = vi.mocked(fetchSaleOrderById);
const mockedCountSOs = vi.mocked(countSaleOrders);
const mockedFetchSOLines = vi.mocked(fetchSOLines);
const mockedFetchPickings = vi.mocked(fetchPickings);
const mockedCreateSO = vi.mocked(createSaleOrder);
const mockedUpdateSO = vi.mocked(updateSaleOrder);
const mockedUpdatePicking = vi.mocked(updateSalesPicking);
const mockedUploadSOFile = vi.mocked(uploadFileToSO);
const mockedUploadPickingFile = vi.mocked(uploadFileToSalesPicking);
const mockedReadSOFile = vi.mocked(readSOFile);
const mockedReadPickingFile = vi.mocked(readSalesPickingFile);
const mockedConfirmSO = vi.mocked(confirmSaleOrder);

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// Sample raw SO data as returned by Odoo
const sampleRawSO = {
  id: 200,
  name: "SO/TEST/001",
  partner_id: [100, "Al Dahra Agriculture"],
  company_id: [3, "ABU DHABI Company"],
  state: "sale",
  date_order: "2026-03-01 10:00:00",
  amount_total: 75000,
  amount_untaxed: 70000,
  amount_tax: 5000,
  currency_id: [2, "USD"],
  order_line: [701, 702],
  picking_ids: [801, 802],
  delivery_count: 2,
  number_of_loads: 4,
  x_studio_shipment_bl_number: "BL-2026-001",
  tracking_number: "TRK-SO-001",
  x_studio_product_category: "alfalfa",
  freight_type: "ocean",
  load_type: "container_shipment",
  shipping_line: "MSC",
  x_studio_selection_field_65k_1j3t1b3d3: "in_transit",
  x_studio_selling_type: "direct",
  x_studio_ultimate_customer: "Emirates Feed",
  x_studio_total_shipment_weight_in_tons_sales: 120.5,
  x_studio_shipment_acceptance_status: "accepted",
  x_studio_corresponding_purchasesale_shipment: "PO/2026/001",
  incoterm: [1, "FOB"],
  pricelist_id: [5, "USD Pricelist"],
  user_id: [10, "Ahmed K."],
  client_order_ref: "CUST-REF-001",
  origin: "BO00014",
  payment_term_id: [3, "30 Days"],
  vessel_cut_off: "2026-03-08",
  vessel_tracking_link: "https://track.msc.com/123",
  rate_per_container_load: "1500",
  transit_time_in_days: "14",
  local_clearance_agent: [10, "Agent Co"],
  local_trucking_company: [20, "Trucking Co"],
  eta_pod: "2026-03-25",
  eta_pol: "2026-03-12",
  etd_pol: "2026-03-10",
  x_studio_payment_term: "30 days from BL",
  x_studio_payment_term_1: "60 days from BL",
  x_studio_ocean_freight_invoiced_entity: "Buyer",
  x_studio_ocean_freight_invoicing_entity: "Seller",
  x_studio_clearance_trucking_invoiced_entity: "Buyer",
  x_studio_clearance_trucking_invoicing_entity: "Seller",
  x_studio_notespayment: "Payment note 1",
  x_studio_notespayment_1: "Payment note 2",
};

const sampleRawSOLine = {
  id: 701,
  product_id: [15, "Alfalfa Bales Premium"],
  name: "Alfalfa Bales Premium - Grade A",
  product_uom_qty: 50000,
  qty_delivered: 25000,
  qty_invoiced: 10000,
  price_unit: 1.5,
  price_subtotal: 75000,
  product_uom: [1, "kg"],
  discount: 5.0,
};

const sampleRawPicking = {
  id: 801,
  name: "WH/OUT/00001",
  state: "done",
  partner_id: [100, "Al Dahra Agriculture"],
  origin: "SO/TEST/001",
  scheduled_date: "2026-03-15 10:00:00",
  date_done: "2026-03-14 16:00:00",
  picking_type_id: [2, "Delivery Orders"],
  company_id: [3, "ABU DHABI Company"],
  x_studio_loadcontainer_number_1: "CONT-SO-001",
  x_studio_seal_number: "SEAL-SO-001",
  x_studio_loading_date: "2026-03-10",
  x_studio_net_weight_in_tons: 30.5,
  x_studio_quantity_in_tons: 30.0,
  x_studio_tare_weight_in_tons: 0.5,
  x_studio_number_of_balesbags: "60",
  x_studio_loading_store: "Store B",
  x_studio_truck_load_serial_tl: "TL-SO-001",
  x_studio_loaded_grade: "grade_1",
  x_studio_source: "toshka",
  x_studio_purchasing_unit: "cairo_unit",
  x_studio_quality_score: 92,
  x_studio_moisture_: 11.0,
  x_studio_ndf_: 43.0,
  x_studio_adf_: 28.0,
  x_studio_crude_protein_dry_matter_: 20.0,
  x_studio_premium_grade: true,
  x_studio_standard_: false,
  x_studio_trucking_fee: 600,
  x_studio_trucking_fees: "per_load",
  x_studio_trucking_cost_currency: "usd",
  x_studio_local_trucking_driver: [50, "Driver Ali"],
  x_studio_local_trucking_driver_contact: "+971501234567",
  x_studio_loadcontainer_cleanliness: true,
  x_studio_proper_loadcontainer_lashing: true,
  x_studio_proper_loadcontainer_stacking: true,
  x_studio_presence_of_truck_cover: true,
  x_studio_payment_confirmation: true,
  x_studio_sku_confirmation: "confirmed",
};

// ═══════════════════════════════════════════════════════════════════════════════
// salesShipments.list
// ═══════════════════════════════════════════════════════════════════════════════
describe("salesShipments.list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns mapped SO list with correct field names", async () => {
    mockedFetchSOs.mockResolvedValue([sampleRawSO as any]);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.salesShipments.list();

    expect(result).toHaveLength(1);
    const so = result[0];
    expect(so.id).toBe(200);
    expect(so.name).toBe("SO/TEST/001");
    expect(so.customer).toEqual({ id: 100, name: "Al Dahra Agriculture" });
    expect(so.company).toEqual({ id: 3, name: "ABU DHABI Company" });
    expect(so.state).toBe("sale");
    expect(so.amountTotal).toBe(75000);
    expect(so.amountUntaxed).toBe(70000);
    expect(so.amountTax).toBe(5000);
    expect(so.currency).toEqual({ id: 2, name: "USD" });
    expect(so.deliveryCount).toBe(2);
    expect(so.numberOfLoads).toBe(4);
    expect(so.blNumber).toBe("BL-2026-001");
    expect(so.trackingNumber).toBe("TRK-SO-001");
    expect(so.productCategory).toBe("alfalfa");
    expect(so.freightType).toBe("ocean");
    expect(so.loadType).toBe("container_shipment");
    expect(so.shippingLine).toBe("MSC");
    expect(so.shipmentStatus).toBe("in_transit");
    expect(so.sellingType).toBe("direct");
    expect(so.ultimateCustomer).toBe("Emirates Feed");
    expect(so.totalShipmentWeight).toBe(120.5);
    expect(so.acceptanceStatus).toBe("accepted");
    expect(so.correspondingPO).toBe("PO/2026/001");
    expect(so.incoterm).toEqual({ id: 1, name: "FOB" });
    expect(so.pricelist).toEqual({ id: 5, name: "USD Pricelist" });
    expect(so.salesperson).toEqual({ id: 10, name: "Ahmed K." });
    expect(so.clientRef).toBe("CUST-REF-001");
    expect(so.origin).toBe("BO00014");
  });

  it("passes companyId filter to fetchSaleOrders", async () => {
    mockedFetchSOs.mockResolvedValue([]);
    const caller = appRouter.createCaller(createContext());
    await caller.salesShipments.list({ companyId: 3 });

    expect(mockedFetchSOs).toHaveBeenCalledWith({
      companyId: 3,
      limit: 200,
      offset: 0,
    });
  });

  it("uses default limit and offset when not provided", async () => {
    mockedFetchSOs.mockResolvedValue([]);
    const caller = appRouter.createCaller(createContext());
    // When called with no input, the optional input is undefined
    // so defaults from z.default() don't apply; the router passes undefined values
    await caller.salesShipments.list();

    expect(mockedFetchSOs).toHaveBeenCalledWith({
      companyId: undefined,
      limit: undefined,
      offset: undefined,
    });
  });

  it("handles null Many2one fields gracefully", async () => {
    const soWithNulls = {
      ...sampleRawSO,
      partner_id: false,
      company_id: false,
      currency_id: false,
      incoterm: false,
      pricelist_id: false,
      user_id: false,
      x_studio_shipment_bl_number: false,
      tracking_number: false,
      x_studio_product_category: false,
      x_studio_ultimate_customer: false,
      x_studio_corresponding_purchasesale_shipment: false,
    };
    mockedFetchSOs.mockResolvedValue([soWithNulls as any]);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.salesShipments.list();

    expect(result[0].customer).toBeNull();
    expect(result[0].company).toBeNull();
    expect(result[0].currency).toBeNull();
    expect(result[0].incoterm).toBeNull();
    expect(result[0].pricelist).toBeNull();
    expect(result[0].salesperson).toBeNull();
    expect(result[0].blNumber).toBeNull();
    expect(result[0].trackingNumber).toBeNull();
    expect(result[0].productCategory).toBeNull();
    expect(result[0].ultimateCustomer).toBeNull();
    expect(result[0].correspondingPO).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// salesShipments.count
// ═══════════════════════════════════════════════════════════════════════════════
describe("salesShipments.count", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns count from countSaleOrders", async () => {
    mockedCountSOs.mockResolvedValue(18);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.salesShipments.count();
    expect(result).toBe(18);
  });

  it("passes companyId filter to countSaleOrders", async () => {
    mockedCountSOs.mockResolvedValue(5);
    const caller = appRouter.createCaller(createContext());
    await caller.salesShipments.count({ companyId: 3 });
    expect(mockedCountSOs).toHaveBeenCalledWith({ companyId: 3 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// salesShipments.getById
// ═══════════════════════════════════════════════════════════════════════════════
describe("salesShipments.getById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns full SO with lines and pickings", async () => {
    mockedFetchSOById.mockResolvedValue(sampleRawSO as any);
    mockedFetchSOLines.mockResolvedValue([sampleRawSOLine as any]);
    mockedFetchPickings.mockResolvedValue([sampleRawPicking as any]);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.salesShipments.getById({ id: 200 });

    // SO header
    expect(result.id).toBe(200);
    expect(result.name).toBe("SO/TEST/001");
    expect(result.customer).toEqual({ id: 100, name: "Al Dahra Agriculture" });
    expect(result.state).toBe("sale");
    expect(result.amountTotal).toBe(75000);
    expect(result.blNumber).toBe("BL-2026-001");
    expect(result.correspondingPO).toBe("PO/2026/001");
    expect(result.paymentTerm).toEqual({ id: 3, name: "30 Days" });
    expect(result.salesperson).toEqual({ id: 10, name: "Ahmed K." });
    expect(result.clientRef).toBe("CUST-REF-001");
    expect(result.origin).toBe("BO00014");

    // Linked PO info
    expect(result.correspondingPOId).toBe(1594);
    expect(result.vesselName).toBe("GFS PERFECT");
    expect(result.freeDaysDemurrage).toBe(14);
    expect(result.telexBLIssued).toBe(true);

    // Shipping details
    expect(result.vesselCutOff).toBe("2026-03-08");
    expect(result.vesselTrackingLink).toBe("https://track.msc.com/123");
    expect(result.ratePerContainerLoad).toBe("1500");
    expect(result.transitTimeInDays).toBe("14");
    expect(result.clearanceAgent).toEqual({ id: 10, name: "Agent Co" });
    expect(result.truckingCompany).toEqual({ id: 20, name: "Trucking Co" });
    expect(result.etaPod).toBe("2026-03-25");
    expect(result.etaPol).toBe("2026-03-12");
    expect(result.etdPol).toBe("2026-03-10");

    // Payment details
    expect(result.paymentTermSales).toBe("30 days from BL");
    expect(result.paymentTermPurchase).toBe("60 days from BL");
    expect(result.oceanFreightInvoicedEntity).toBe("Buyer");
    expect(result.oceanFreightInvoicingEntity).toBe("Seller");
    expect(result.clearanceTruckingInvoicedEntity).toBe("Buyer");
    expect(result.clearanceTruckingInvoicingEntity).toBe("Seller");
    expect(result.notesPayment).toBe("Payment note 1");
    expect(result.notesPayment1).toBe("Payment note 2");

    // Lines
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].product).toEqual({ id: 15, name: "Alfalfa Bales Premium" });
    expect(result.lines[0].description).toBe("Alfalfa Bales Premium - Grade A");
    expect(result.lines[0].qty).toBe(50000);
    expect(result.lines[0].qtyDelivered).toBe(25000);
    expect(result.lines[0].qtyInvoiced).toBe(10000);
    expect(result.lines[0].priceUnit).toBe(1.5);
    expect(result.lines[0].priceSubtotal).toBe(75000);
    expect(result.lines[0].uom).toEqual({ id: 1, name: "kg" });
    expect(result.lines[0].discount).toBe(5.0);

    // Pickings (deliveries)
    expect(result.pickings).toHaveLength(1);
    expect(result.pickings[0].name).toBe("WH/OUT/00001");
    expect(result.pickings[0].state).toBe("done");
    expect(result.pickings[0].containerNumber).toBe("CONT-SO-001");
    expect(result.pickings[0].sealNumber).toBe("SEAL-SO-001");
    expect(result.pickings[0].netWeightTons).toBe(30.5);
    expect(result.pickings[0].quantityTons).toBe(30.0);
    expect(result.pickings[0].tareWeightTons).toBe(0.5);
    expect(result.pickings[0].balesBags).toBe("60");
    expect(result.pickings[0].loadedGrade).toBe("grade_1");
    expect(result.pickings[0].source).toBe("toshka");
    expect(result.pickings[0].qualityScore).toBe(92);
    expect(result.pickings[0].moisture).toBe(11.0);
    expect(result.pickings[0].ndf).toBe(43.0);
    expect(result.pickings[0].adf).toBe(28.0);
    expect(result.pickings[0].crudeProtein).toBe(20.0);
    expect(result.pickings[0].premiumGrade).toBe(true);
    expect(result.pickings[0].truckingFee).toBe(600);
    expect(result.pickings[0].truckingDriver).toEqual({ id: 50, name: "Driver Ali" });
    expect(result.pickings[0].containerCleanliness).toBe(true);
    expect(result.pickings[0].properLashing).toBe(true);
    expect(result.pickings[0].properStacking).toBe(true);
    expect(result.pickings[0].truckCover).toBe(true);
    expect(result.pickings[0].paymentConfirmation).toBe(true);
    expect(result.pickings[0].skuConfirmation).toBe("confirmed");
  });

  it("throws when SO not found", async () => {
    mockedFetchSOById.mockResolvedValue(null as any);
    const caller = appRouter.createCaller(createContext());
    await expect(caller.salesShipments.getById({ id: 999 })).rejects.toThrow("Sales order not found");
  });

  it("fetches lines and pickings in parallel", async () => {
    mockedFetchSOById.mockResolvedValue(sampleRawSO as any);
    mockedFetchSOLines.mockResolvedValue([]);
    mockedFetchPickings.mockResolvedValue([]);

    const caller = appRouter.createCaller(createContext());
    await caller.salesShipments.getById({ id: 200 });

    expect(mockedFetchSOLines).toHaveBeenCalledWith([701, 702]);
    expect(mockedFetchPickings).toHaveBeenCalledWith([801, 802]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// salesShipments.create
// ═══════════════════════════════════════════════════════════════════════════════
describe("salesShipments.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a SO and returns the new ID", async () => {
    mockedCreateSO.mockResolvedValue(300);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.salesShipments.create({
      partner_id: 100,
      company_id: 3,
      currency_id: 2,
      number_of_loads: 4,
      load_type: "container_shipment",
      freight_type: "ocean",
      shipping_line: "MSC",
      x_studio_product_category: "alfalfa",
      lines: [
        { product_id: 15, product_uom_qty: 50000, price_unit: 1.5, product_uom: 1 },
      ],
    });

    expect(result.id).toBe(300);
    expect(mockedCreateSO).toHaveBeenCalledTimes(1);
  });

  it("passes distribute_weight_equally flag to createSaleOrder", async () => {
    mockedCreateSO.mockResolvedValue(301);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.salesShipments.create({
      partner_id: 100,
      company_id: 3,
      distribute_weight_equally: true,
      lines: [
        { product_id: 15, product_uom_qty: 50000, price_unit: 1.5 },
      ],
    });

    expect(result.id).toBe(301);
    expect(mockedCreateSO).toHaveBeenCalledWith(
      expect.objectContaining({ distribute_weight_equally: true })
    );
  });

  it("passes distribute_weight_equally=false when unchecked", async () => {
    mockedCreateSO.mockResolvedValue(302);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.salesShipments.create({
      partner_id: 100,
      company_id: 3,
      distribute_weight_equally: false,
      lines: [
        { product_id: 15, product_uom_qty: 50000, price_unit: 1.5 },
      ],
    });

    expect(result.id).toBe(302);
    expect(mockedCreateSO).toHaveBeenCalledWith(
      expect.objectContaining({ distribute_weight_equally: false })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// salesShipments.update
// ═══════════════════════════════════════════════════════════════════════════════
describe("salesShipments.update", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates a SO and returns success", async () => {
    mockedUpdateSO.mockResolvedValue(true);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.salesShipments.update({
      id: 200,
      tracking_number: "NEW-TRK",
      x_studio_ultimate_customer: "New Customer",
      x_studio_shipment_bl_number: "BL-NEW",
      vessel_cut_off: "2026-04-01",
    });

    expect(result.success).toBe(true);
    expect(mockedUpdateSO).toHaveBeenCalledWith({
      id: 200,
      tracking_number: "NEW-TRK",
      x_studio_ultimate_customer: "New Customer",
      x_studio_shipment_bl_number: "BL-NEW",
      vessel_cut_off: "2026-04-01",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// salesShipments.updatePicking
// ═══════════════════════════════════════════════════════════════════════════════
describe("salesShipments.updatePicking", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates a delivery picking with all fields", async () => {
    mockedUpdatePicking.mockResolvedValue(true);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.salesShipments.updatePicking({
      id: 801,
      x_studio_loadcontainer_number_1: "CONT-NEW",
      x_studio_seal_number: "SEAL-NEW",
      x_studio_net_weight_in_tons: 31.0,
      x_studio_quantity_in_tons: 30.5,
      x_studio_tare_weight_in_tons: 0.5,
      x_studio_number_of_balesbags: "65",
      x_studio_loaded_grade: "grade_1",
      x_studio_source: "toshka",
      x_studio_quality_score: 95,
      x_studio_moisture_: 10.5,
      x_studio_ndf_: 42.0,
      x_studio_adf_: 27.0,
      x_studio_crude_protein_dry_matter_: 21.0,
      x_studio_loadcontainer_cleanliness: true,
      x_studio_proper_loadcontainer_stacking: true,
      x_studio_proper_loadcontainer_lashing: true,
      x_studio_presence_of_truck_cover: true,
      x_studio_payment_confirmation: true,
    });

    expect(result.success).toBe(true);
    expect(mockedUpdatePicking).toHaveBeenCalledTimes(1);
    const callArg = mockedUpdatePicking.mock.calls[0][0];
    expect(callArg.id).toBe(801);
    expect(callArg.x_studio_loadcontainer_number_1).toBe("CONT-NEW");
    expect(callArg.x_studio_crude_protein_dry_matter_).toBe(21.0);
    expect(callArg.x_studio_source).toBe("toshka");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// salesShipments.uploadSOFile
// ═══════════════════════════════════════════════════════════════════════════════
describe("salesShipments.uploadSOFile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploads a file to a SO field", async () => {
    mockedUploadSOFile.mockResolvedValue(true);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.salesShipments.uploadSOFile({
      soId: 200,
      fieldName: "bl",
      base64Content: "dGVzdA==",
    });

    expect(result.success).toBe(true);
    expect(mockedUploadSOFile).toHaveBeenCalledWith(200, "bl", "dGVzdA==");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// salesShipments.uploadPickingFile
// ═══════════════════════════════════════════════════════════════════════════════
describe("salesShipments.uploadPickingFile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploads a file to a delivery picking field", async () => {
    mockedUploadPickingFile.mockResolvedValue(true);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.salesShipments.uploadPickingFile({
      pickingId: 801,
      fieldName: "x_studio_quality_assessment_form",
      base64Content: "dGVzdA==",
    });

    expect(result.success).toBe(true);
    expect(mockedUploadPickingFile).toHaveBeenCalledWith(801, "x_studio_quality_assessment_form", "dGVzdA==");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// salesShipments.readSOFile
// ═══════════════════════════════════════════════════════════════════════════════
describe("salesShipments.readSOFile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads a file from a SO field", async () => {
    mockedReadSOFile.mockResolvedValue("base64sodata==");
    const caller = appRouter.createCaller(createContext());
    const result = await caller.salesShipments.readSOFile({ soId: 200, fieldName: "bl" });
    expect(result.content).toBe("base64sodata==");
  });

  it("returns null when file not present", async () => {
    mockedReadSOFile.mockResolvedValue(null as any);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.salesShipments.readSOFile({ soId: 200, fieldName: "bl" });
    expect(result.content).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// salesShipments.readPickingFile
// ═══════════════════════════════════════════════════════════════════════════════
describe("salesShipments.readPickingFile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads a file from a delivery picking field", async () => {
    mockedReadPickingFile.mockResolvedValue("pickingsofile==");
    const caller = appRouter.createCaller(createContext());
    const result = await caller.salesShipments.readPickingFile({ pickingId: 801, fieldName: "x_studio_quality_assessment_form" });
    expect(result.content).toBe("pickingsofile==");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// salesShipments.confirm
// ═══════════════════════════════════════════════════════════════════════════════
describe("salesShipments.confirm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("confirms a sales order", async () => {
    mockedConfirmSO.mockResolvedValue(true);
    const caller = appRouter.createCaller(createContext());
    const result = await caller.salesShipments.confirm({ id: 200 });
    expect(result.success).toBe(true);
    expect(mockedConfirmSO).toHaveBeenCalledWith(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// salesShipments.redistributeWeight
// ═══════════════════════════════════════════════════════════════════════════════
describe("salesShipments.redistributeWeight", () => {
  const mockedDistributeWeight = vi.mocked(distributeWeightAcrossPickings);
  beforeEach(() => vi.clearAllMocks());

  it("fetches SO lines and calls distributeWeightAcrossPickings", async () => {
    mockedFetchSOById.mockResolvedValue({
      id: 200,
      name: "S00200",
      order_line: [10, 11],
      picking_ids: [20, 21],
    } as any);
    mockedFetchSOLines.mockResolvedValue([
      { id: 10, product_id: [5, "Product A"], product_uom_qty: 2000, product_uom: [3, "kg"] },
      { id: 11, product_id: [6, "Product B"], product_uom_qty: 1000, product_uom: [3, "kg"] },
    ] as any);
    mockedDistributeWeight.mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.salesShipments.redistributeWeight({ orderId: 200 });

    expect(result).toEqual({ success: true });
    expect(mockedFetchSOById).toHaveBeenCalledWith(200);
    expect(mockedFetchSOLines).toHaveBeenCalledWith([10, 11]);
    expect(mockedDistributeWeight).toHaveBeenCalledWith(
      200,
      [
        { product_id: 5, product_uom_qty: 2000, product_uom: 3 },
        { product_id: 6, product_uom_qty: 1000, product_uom: 3 },
      ],
      "sales"
    );
  });

  it("throws if SO not found", async () => {
    mockedFetchSOById.mockResolvedValue(null as any);
    const caller = appRouter.createCaller(createContext());
    await expect(caller.salesShipments.redistributeWeight({ orderId: 999 })).rejects.toThrow("Sale order not found");
  });
});
