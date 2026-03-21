import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the odoo module for fetchWarehouses, fetchAggregatedStock, fetchStockLocations, fetchProductStockByLocation
vi.mock("./odoo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./odoo")>();
  return {
    ...actual,
    fetchWarehouses: vi.fn(),
    fetchAggregatedStock: vi.fn(),
    fetchPickingTypes: vi.fn(),
    fetchStockLocations: vi.fn(),
    fetchProductStockByLocation: vi.fn(),
    fetchAllStockAtLocation: vi.fn(),
  };
});

// Mock odoo-shipments to prevent real calls
vi.mock("./odoo-shipments", () => ({
  fetchPurchaseOrders: vi.fn(),
  fetchPurchaseOrderById: vi.fn(),
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
}));

import {
  fetchWarehouses,
  fetchAggregatedStock,
  fetchPickingTypes,
  fetchStockLocations,
  fetchProductStockByLocation,
  fetchAllStockAtLocation,
} from "./odoo";

const mockedFetchWarehouses = vi.mocked(fetchWarehouses);
const mockedFetchAggregatedStock = vi.mocked(fetchAggregatedStock);
const mockedFetchPickingTypes = vi.mocked(fetchPickingTypes);
const mockedFetchStockLocations = vi.mocked(fetchStockLocations);
const mockedFetchProductStockByLocation = vi.mocked(fetchProductStockByLocation);
const mockedFetchAllStockAtLocation = vi.mocked(fetchAllStockAtLocation);

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("shipments.warehouses", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns mapped warehouses without filter", async () => {
    mockedFetchWarehouses.mockResolvedValue([
      { id: 1, name: "Main Warehouse", code: "WH", company_id: [3, "Abu Dhabi Co"] },
      { id: 2, name: "Cairo Warehouse", code: "CWH", company_id: [5, "Cairo Co"] },
    ] as any);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.warehouses({});

    expect(result).toEqual([
      { id: 1, name: "Main Warehouse", code: "WH", companyId: 3, companyName: "Abu Dhabi Co" },
      { id: 2, name: "Cairo Warehouse", code: "CWH", companyId: 5, companyName: "Cairo Co" },
    ]);
    expect(mockedFetchWarehouses).toHaveBeenCalledWith(undefined);
  });

  it("passes companyId filter to fetchWarehouses", async () => {
    mockedFetchWarehouses.mockResolvedValue([
      { id: 1, name: "Main Warehouse", code: "WH", company_id: [3, "Abu Dhabi Co"] },
    ] as any);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.warehouses({ companyId: 3 });

    expect(result).toHaveLength(1);
    expect(mockedFetchWarehouses).toHaveBeenCalledWith(3);
  });

  it("handles warehouses with missing company_id", async () => {
    mockedFetchWarehouses.mockResolvedValue([
      { id: 1, name: "Default WH", code: "DWH", company_id: false },
    ] as any);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.warehouses({});

    expect(result[0].companyId).toBe(0);
    expect(result[0].companyName).toBe("");
  });
});

describe("shipments.productStock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns stock data for given product IDs", async () => {
    mockedFetchAggregatedStock.mockResolvedValue([
      { productId: 10, productName: "Alfalfa", warehouseId: 1, warehouseName: "Main WH", onHand: 50000, available: 48000, uomName: "kg" },
      { productId: 20, productName: "Hay", warehouseId: 1, warehouseName: "Main WH", onHand: 30000, available: 28000, uomName: "kg" },
    ]);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.productStock({ productIds: [10, 20] });

    expect(result).toHaveLength(2);
    expect(result[0].productId).toBe(10);
    expect(result[0].available).toBe(48000);
    expect(mockedFetchAggregatedStock).toHaveBeenCalledWith([10, 20], undefined);
  });

  it("passes warehouseId filter", async () => {
    mockedFetchAggregatedStock.mockResolvedValue([
      { productId: 10, productName: "Alfalfa", warehouseId: 2, warehouseName: "Cairo WH", onHand: 10000, available: 9000, uomName: "kg" },
    ]);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.productStock({ productIds: [10], warehouseId: 2 });

    expect(result).toHaveLength(1);
    expect(result[0].warehouseId).toBe(2);
    expect(mockedFetchAggregatedStock).toHaveBeenCalledWith([10], 2);
  });

  it("returns empty array when no stock found", async () => {
    mockedFetchAggregatedStock.mockResolvedValue([]);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.productStock({ productIds: [999] });

    expect(result).toEqual([]);
  });
});

describe("odoo.pickingTypes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns picking types with warehouse info", async () => {
    mockedFetchPickingTypes.mockResolvedValue([
      { id: 1, name: "Receipts", code: "incoming", warehouse_id: [1, "Main WH"], company_id: [3, "Abu Dhabi Co"] },
      { id: 2, name: "Delivery Orders", code: "outgoing", warehouse_id: [2, "Cairo WH"], company_id: [5, "Cairo Co"] },
    ] as any);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.odoo.pickingTypes({});

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 1,
      name: "Receipts",
      code: "incoming",
      warehouseId: 1,
      warehouseName: "Main WH",
      companyId: 3,
      companyName: "Abu Dhabi Co",
    });
  });

  it("filters by code", async () => {
    mockedFetchPickingTypes.mockResolvedValue([
      { id: 1, name: "Receipts", code: "incoming", warehouse_id: [1, "Main WH"], company_id: [3, "Abu Dhabi Co"] },
    ] as any);

    const caller = appRouter.createCaller(createContext());
    await caller.odoo.pickingTypes({ code: "incoming" });

    expect(mockedFetchPickingTypes).toHaveBeenCalledWith(undefined, "incoming");
  });

  it("filters by companyId", async () => {
    mockedFetchPickingTypes.mockResolvedValue([]);

    const caller = appRouter.createCaller(createContext());
    await caller.odoo.pickingTypes({ companyId: 3 });

    expect(mockedFetchPickingTypes).toHaveBeenCalledWith(3, undefined);
  });
});

describe("shipments.stockLocations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns mapped stock locations without filter", async () => {
    mockedFetchStockLocations.mockResolvedValue([
      {
        id: 10,
        name: "Finished Goods-Sokhna",
        complete_name: "MWCP/Finished Goods-Sokhna",
        warehouse_id: [1, "Main Warehouse Cairo Platform – Sokhna"],
        company_id: [5, "Cairo-PLATFARM FOR AGRICULTURE CONSULTANCY"],
        location_id: [8, "MWCP"],
      },
      {
        id: 11,
        name: "Stock",
        complete_name: "CWDAK/Stock",
        warehouse_id: [2, "CWDAK Warehouse"],
        company_id: [5, "Cairo-PLATFARM FOR AGRICULTURE CONSULTANCY"],
        location_id: [9, "CWDAK"],
      },
    ]);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.stockLocations({});

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 10,
      name: "Finished Goods-Sokhna",
      completeName: "MWCP/Finished Goods-Sokhna",
      warehouseId: 1,
      warehouseName: "Main Warehouse Cairo Platform – Sokhna",
      companyId: 5,
      companyName: "Cairo-PLATFARM FOR AGRICULTURE CONSULTANCY",
      parentId: 8,
      parentName: "MWCP",
    });
    expect(mockedFetchStockLocations).toHaveBeenCalledWith(undefined);
  });

  it("passes companyId filter to fetchStockLocations", async () => {
    mockedFetchStockLocations.mockResolvedValue([
      {
        id: 10,
        name: "Finished Goods-Sokhna",
        complete_name: "MWCP/Finished Goods-Sokhna",
        warehouse_id: [1, "Main WH"],
        company_id: [5, "Cairo Co"],
        location_id: [8, "MWCP"],
      },
    ]);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.stockLocations({ companyId: 5 });

    expect(result).toHaveLength(1);
    expect(mockedFetchStockLocations).toHaveBeenCalledWith(5);
  });

  it("handles locations with missing warehouse_id", async () => {
    mockedFetchStockLocations.mockResolvedValue([
      {
        id: 15,
        name: "Virtual Location",
        complete_name: "Virtual/Location",
        warehouse_id: false,
        company_id: [3, "Abu Dhabi Co"],
        location_id: false,
      },
    ]);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.stockLocations({});

    expect(result[0].warehouseId).toBeNull();
    expect(result[0].warehouseName).toBeNull();
    expect(result[0].parentId).toBeNull();
    expect(result[0].parentName).toBeNull();
  });
});

describe("shipments.productStockByLocation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns stock data for given product IDs at a location", async () => {
    mockedFetchProductStockByLocation.mockResolvedValue([
      { productId: 10, locationId: 20, locationName: "MWCP/Finished Goods-Sokhna", quantity: 50000, reservedQuantity: 2000, availableQuantity: 48000 },
      { productId: 20, locationId: 20, locationName: "MWCP/Finished Goods-Sokhna", quantity: 30000, reservedQuantity: 2000, availableQuantity: 28000 },
    ]);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.productStockByLocation({ productIds: [10, 20], locationId: 20 });

    expect(result).toHaveLength(2);
    expect(result[0].productId).toBe(10);
    expect(result[0].availableQuantity).toBe(48000);
    expect(result[0].locationName).toBe("MWCP/Finished Goods-Sokhna");
    expect(mockedFetchProductStockByLocation).toHaveBeenCalledWith([10, 20], 20);
  });

  it("returns all locations when no locationId filter", async () => {
    mockedFetchProductStockByLocation.mockResolvedValue([
      { productId: 10, locationId: 20, locationName: "MWCP/Finished Goods", quantity: 30000, reservedQuantity: 0, availableQuantity: 30000 },
      { productId: 10, locationId: 21, locationName: "MWCP/Raw Material", quantity: 20000, reservedQuantity: 0, availableQuantity: 20000 },
    ]);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.productStockByLocation({ productIds: [10] });

    expect(result).toHaveLength(2);
    expect(mockedFetchProductStockByLocation).toHaveBeenCalledWith([10], undefined);
  });

  it("returns empty array when no stock found", async () => {
    mockedFetchProductStockByLocation.mockResolvedValue([]);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.productStockByLocation({ productIds: [999] });

    expect(result).toEqual([]);
  });

  it("handles reserved quantities correctly", async () => {
    mockedFetchProductStockByLocation.mockResolvedValue([
      { productId: 10, locationId: 20, locationName: "MWCP/Finished Goods", quantity: 50000, reservedQuantity: 15000, availableQuantity: 35000 },
    ]);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.productStockByLocation({ productIds: [10], locationId: 20 });

    expect(result[0].quantity).toBe(50000);
    expect(result[0].reservedQuantity).toBe(15000);
    expect(result[0].availableQuantity).toBe(35000);
  });
});

describe("shipments.allStockAtLocation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all products with positive stock at a location", async () => {
    mockedFetchAllStockAtLocation.mockResolvedValue([
      { productId: 10, productName: "Wheat Flour", locationId: 20, locationName: "MWCP/Finished Goods", quantity: 50000, reservedQuantity: 2000, availableQuantity: 48000, uomName: "kg" },
      { productId: 20, productName: "Rice", locationId: 20, locationName: "MWCP/Finished Goods", quantity: 30000, reservedQuantity: 0, availableQuantity: 30000, uomName: "kg" },
    ]);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.allStockAtLocation({ locationId: 20 });

    expect(result).toHaveLength(2);
    expect(result[0].productName).toBe("Wheat Flour");
    expect(result[0].availableQuantity).toBe(48000);
    expect(result[0].uomName).toBe("kg");
    expect(result[1].productName).toBe("Rice");
    expect(mockedFetchAllStockAtLocation).toHaveBeenCalledWith(20);
  });

  it("returns empty array when no stock at location", async () => {
    mockedFetchAllStockAtLocation.mockResolvedValue([]);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.allStockAtLocation({ locationId: 999 });

    expect(result).toEqual([]);
    expect(mockedFetchAllStockAtLocation).toHaveBeenCalledWith(999);
  });

  it("includes reserved quantity and UOM info", async () => {
    mockedFetchAllStockAtLocation.mockResolvedValue([
      { productId: 10, productName: "Sugar", locationId: 20, locationName: "MWCP/Raw Material", quantity: 100000, reservedQuantity: 25000, availableQuantity: 75000, uomName: "Tons" },
    ]);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.shipments.allStockAtLocation({ locationId: 20 });

    expect(result[0].quantity).toBe(100000);
    expect(result[0].reservedQuantity).toBe(25000);
    expect(result[0].availableQuantity).toBe(75000);
    expect(result[0].uomName).toBe("Tons");
  });
});
