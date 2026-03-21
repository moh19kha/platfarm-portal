import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Tests for the Odoo agreements tRPC routes.
 * Mocks axios to avoid hitting the real Odoo server.
 * Verifies data fetching and transformation for both
 * purchase.requisition and sale.order.template models.
 */

// Mock axios before importing the module
vi.mock("axios", () => {
  const mockPost = vi.fn();
  return {
    default: {
      create: () => ({
        post: mockPost,
      }),
      post: mockPost,
    },
    __mockPost: mockPost,
  };
});

// Import after mocking
import {
  fetchPurchaseAgreements,
  fetchPurchaseAgreementLines,
  fetchSalesAgreements,
  fetchSalesAgreementLines,
  resetOdooSession,
} from "./odoo";
import axios from "axios";

// Get the mock post function
const mockAxiosInstance = axios.create();
const mockPost = mockAxiosInstance.post as ReturnType<typeof vi.fn>;

// ─── Mock Data ────────────────────────────────────────────────────────────

const MOCK_PURCHASE_AGREEMENTS = [
  {
    id: 18,
    name: "BO00018",
    reference: "25POEL-UCF03-0900012",
    vendor_id: [42, "Nafosa -NAVARRO-ARAGONESA DE FORRAJES S.A.U."],
    requisition_type: "blanket_order",
    date_start: "2025-09-03",
    date_end: "2025-09-30",
    state: "open",
    company_id: [2, "ABU DHABI-PLATFARM"],
    currency_id: [2, "AED"],
    product_id: false,
    order_count: 1,
    line_ids: [30],
  },
  {
    id: 10,
    name: "BO00010",
    reference: false,
    vendor_id: [55, "Kamal Mohamed Fallah"],
    requisition_type: "blanket_order",
    date_start: false,
    date_end: false,
    state: "done",
    company_id: [3, "Cairo-PLATFARM"],
    currency_id: [49, "EGP"],
    product_id: false,
    order_count: 0,
    line_ids: [10, 11],
  },
];

const MOCK_PURCHASE_LINES = [
  {
    id: 30,
    product_id: [101, "Double Press, Grade 1 Spanish Dehydrated Alfalfa"],
    product_qty: 489.18,
    price_unit: 315,
    product_uom_id: [5, "Ton"],
    requisition_id: [18, "BO00018"],
    qty_ordered: 0,
  },
  {
    id: 10,
    product_id: [102, "Single Press, Standard Egyptian SunCured Alfalfa"],
    product_qty: 500,
    price_unit: 200,
    product_uom_id: [5, "Ton"],
    requisition_id: [10, "BO00010"],
    qty_ordered: 500,
  },
  {
    id: 11,
    product_id: [103, "Egyptian Straw"],
    product_qty: 300,
    price_unit: 150,
    product_uom_id: [5, "Ton"],
    requisition_id: [10, "BO00010"],
    qty_ordered: 0,
  },
];

const MOCK_SALES_AGREEMENTS = [
  {
    id: 5,
    name: "25POEL-UCF03-0400005",
    display_name: "25POEL-UCF03-0400005",
    partner_id: [80, "ELAGRO AGRICULTURE TRADING"],
    x_studio_customer: [80, "ELAGRO AGRICULTURE TRADING"],
    x_studio_ultimate_customer: false,
    x_studio_sales_incoterm_condition: "DDP",
    x_studio_sales_currency: "AED",
    x_studio_insurance_included: false,
    x_studio_total_po_quantity_in_tons: 1000,
    x_studio_supply_start_date: "2025-04-01",
    x_studio_supply_end_date: "2025-12-31",
    x_studio_notes: false,
    x_studio_payment_terms: false,
    sale_order_count: 0,
    sale_order_template_line_ids: [10, 11],
    company_id: [2, "ABU DHABI-PLATFARM"],
    active: true,
    number_of_days: 365,
    create_date: "2025-03-15 10:30:00",
  },
  {
    id: 8,
    name: "PO-U1H3-01143",
    display_name: "PO-U1H3-01143",
    partner_id: [90, "Al Dahra Agriculture"],
    x_studio_customer: [90, "Al Dahra Agriculture"],
    x_studio_ultimate_customer: "Al Dahra Agriculture",
    x_studio_sales_incoterm_condition: "CIF",
    x_studio_sales_currency: "AED",
    x_studio_insurance_included: true,
    x_studio_total_po_quantity_in_tons: 0,
    x_studio_supply_start_date: false,
    x_studio_supply_end_date: false,
    x_studio_notes: "Priority customer",
    x_studio_payment_terms: "Net 30",
    sale_order_count: 2,
    sale_order_template_line_ids: [],
    company_id: [2, "ABU DHABI-PLATFARM"],
    active: true,
    number_of_days: 0,
    create_date: "2025-02-01 08:00:00",
  },
];

const MOCK_SALES_LINES = [
  {
    id: 10,
    product_id: [201, "Double Press Alfalfa"],
    product_uom_qty: 500,
    price_unit: 280,
    product_uom_id: [5, "Ton"],
    sale_order_template_id: [5, "25POEL-UCF03-0400005"],
    name: "Double Press Alfalfa",
  },
  {
    id: 11,
    product_id: [202, "Single Press Alfalfa"],
    product_uom_qty: 500,
    price_unit: 220,
    product_uom_id: [5, "Ton"],
    sale_order_template_id: [5, "25POEL-UCF03-0400005"],
    name: "Single Press Alfalfa",
  },
];

// ─── Helper: set up auth mock ──────────────────────────────────────────────

function mockAuth() {
  mockPost.mockResolvedValueOnce({
    data: { jsonrpc: "2.0", id: null, result: 42 },
    headers: {},
  });
}

function mockRpcResult(data: unknown) {
  mockPost.mockResolvedValueOnce({
    data: { jsonrpc: "2.0", id: null, result: data },
  });
}

function mockRpcError(message: string) {
  mockPost.mockResolvedValueOnce({
    data: {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: 200,
        message: "Server Error",
        data: { message, debug: "" },
      },
    },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("Odoo Purchase Agreements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOdooSession();
  });

  it("fetches purchase agreements from purchase.requisition model", async () => {
    mockAuth();
    mockRpcResult(MOCK_PURCHASE_AGREEMENTS);

    const agreements = await fetchPurchaseAgreements();

    expect(agreements).toHaveLength(2);
    expect(agreements[0].name).toBe("BO00018");
    expect(agreements[0].reference).toBe("25POEL-UCF03-0900012");
    expect(agreements[0].state).toBe("open");
    expect(agreements[0].vendor_id).toEqual([42, "Nafosa -NAVARRO-ARAGONESA DE FORRAJES S.A.U."]);
    expect(agreements[0].currency_id).toEqual([2, "AED"]);
    expect(agreements[0].company_id).toEqual([2, "ABU DHABI-PLATFARM"]);
    expect(agreements[0].line_ids).toEqual([30]);

    // Verify the correct model was called
    const searchCall = mockPost.mock.calls[1];
    const args = searchCall[1].params.args;
    expect(args[3]).toBe("purchase.requisition");
    expect(args[4]).toBe("search_read");
  });

  it("fetches purchase agreement lines by IDs", async () => {
    mockAuth();
    mockRpcResult(MOCK_PURCHASE_LINES);

    const lines = await fetchPurchaseAgreementLines([30, 10, 11]);

    expect(lines).toHaveLength(3);
    expect(lines[0].product_qty).toBe(489.18);
    expect(lines[0].price_unit).toBe(315);
    expect(lines[0].product_uom_id).toEqual([5, "Ton"]);

    // Verify the domain filter
    const searchCall = mockPost.mock.calls[1];
    const args = searchCall[1].params.args;
    expect(args[3]).toBe("purchase.requisition.line");
    expect(args[5]).toEqual([[["id", "in", [30, 10, 11]]]]);
  });

  it("returns empty array for empty line IDs", async () => {
    const lines = await fetchPurchaseAgreementLines([]);
    expect(lines).toEqual([]);
    // Should not make any API calls
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("handles purchase agreements with false/missing fields", async () => {
    mockAuth();
    mockRpcResult(MOCK_PURCHASE_AGREEMENTS);

    const agreements = await fetchPurchaseAgreements();

    // Second agreement has false reference and dates
    expect(agreements[1].reference).toBe(false);
    expect(agreements[1].date_start).toBe(false);
    expect(agreements[1].date_end).toBe(false);
    expect(agreements[1].state).toBe("done");
  });

  it("throws on RPC error for purchase agreements", async () => {
    mockAuth();
    mockRpcError("Access Denied");

    await expect(fetchPurchaseAgreements()).rejects.toThrow(
      "Odoo RPC error (purchase.requisition.search_read): Access Denied"
    );
  });
});

describe("Odoo Sales Agreements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOdooSession();
  });

  it("fetches sales agreements from sale.order.template model", async () => {
    mockAuth();
    mockRpcResult(MOCK_SALES_AGREEMENTS);

    const agreements = await fetchSalesAgreements();

    expect(agreements).toHaveLength(2);
    expect(agreements[0].name).toBe("25POEL-UCF03-0400005");
    expect(agreements[0].partner_id).toEqual([80, "ELAGRO AGRICULTURE TRADING"]);
    expect(agreements[0].x_studio_sales_incoterm_condition).toBe("DDP");
    expect(agreements[0].x_studio_sales_currency).toBe("AED");
    expect(agreements[0].x_studio_total_po_quantity_in_tons).toBe(1000);
    expect(agreements[0].company_id).toEqual([2, "ABU DHABI-PLATFARM"]);
    expect(agreements[0].active).toBe(true);
    expect(agreements[0].number_of_days).toBe(365);

    // Verify the correct model was called
    const searchCall = mockPost.mock.calls[1];
    const args = searchCall[1].params.args;
    expect(args[3]).toBe("sale.order.template");
    expect(args[4]).toBe("search_read");
  });

  it("handles sales agreement custom studio fields including end date", async () => {
    mockAuth();
    mockRpcResult(MOCK_SALES_AGREEMENTS);

    const agreements = await fetchSalesAgreements();

    // First agreement: has supply end date, no ultimate customer, no insurance
    expect(agreements[0].x_studio_ultimate_customer).toBe(false);
    expect(agreements[0].x_studio_insurance_included).toBe(false);
    expect(agreements[0].x_studio_notes).toBe(false);
    expect(agreements[0].x_studio_supply_start_date).toBe("2025-04-01");
    expect(agreements[0].x_studio_supply_end_date).toBe("2025-12-31");

    // Second agreement: has ultimate customer, insurance, notes, no end date
    expect(agreements[1].x_studio_ultimate_customer).toBe("Al Dahra Agriculture");
    expect(agreements[1].x_studio_insurance_included).toBe(true);
    expect(agreements[1].x_studio_notes).toBe("Priority customer");
    expect(agreements[1].x_studio_supply_end_date).toBe(false);
  });

  it("fetches sales agreement lines by IDs", async () => {
    mockAuth();
    mockRpcResult(MOCK_SALES_LINES);

    const lines = await fetchSalesAgreementLines([10, 11]);

    expect(lines).toHaveLength(2);
    expect(lines[0].product_uom_qty).toBe(500);
    expect(lines[0].price_unit).toBe(280);
    expect(lines[0].product_uom_id).toEqual([5, "Ton"]);
    expect(lines[0].product_id).toEqual([201, "Double Press Alfalfa"]);

    // Verify the correct model was called
    const searchCall = mockPost.mock.calls[1];
    const args = searchCall[1].params.args;
    expect(args[3]).toBe("sale.order.template.line");
    expect(args[5]).toEqual([[["id", "in", [10, 11]]]]);
  });

  it("returns empty array for empty SA line IDs", async () => {
    const lines = await fetchSalesAgreementLines([]);
    expect(lines).toEqual([]);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("throws on RPC error for sales agreements", async () => {
    mockAuth();
    mockRpcError("Model not found");

    await expect(fetchSalesAgreements()).rejects.toThrow(
      "Odoo RPC error (sale.order.template.search_read): Model not found"
    );
  });
});

describe("Odoo Agreements tRPC Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOdooSession();
  });

  it("transforms purchase agreements via tRPC caller", async () => {
    mockAuth();
    mockRpcResult(MOCK_PURCHASE_AGREEMENTS);
    // Single batch fetch for all lines
    mockRpcResult(MOCK_PURCHASE_LINES);

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: vi.fn() } as any,
    });

    const result = await caller.odoo.purchaseAgreements();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("BO00018");
    expect(result[0].state).toBe("open");
    expect(result[0].currency).toBe("AED");
    expect(result[0].vendor).toBe("Nafosa -NAVARRO-ARAGONESA DE FORRAJES S.A.U.");
    expect(result[0].companyId).toBe(2);
    expect(result[0].companyName).toBe("ABU DHABI-PLATFARM");
    expect(result[0].lines).toHaveLength(1);
    expect(result[0].lines[0].product).toBe(
      "Double Press, Grade 1 Spanish Dehydrated Alfalfa"
    );
    expect(result[0].lines[0].quantity).toBe(489.18);
    expect(result[0].lines[0].priceUnit).toBe(315);
  });

  it("transforms sales agreements via tRPC caller with lines and end date", async () => {
    mockAuth();
    mockRpcResult(MOCK_SALES_AGREEMENTS);
    // Lines batch fetch
    mockRpcResult(MOCK_SALES_LINES);

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: vi.fn() } as any,
    });

    const result = await caller.odoo.salesAgreements();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("25POEL-UCF03-0400005");
    expect(result[0].customer).toBe("ELAGRO AGRICULTURE TRADING");
    expect(result[0].incoterm).toBe("DDP");
    expect(result[0].currency).toBe("AED");
    expect(result[0].totalQuantityTons).toBe(1000);
    expect(result[0].companyId).toBe(2);
    expect(result[0].companyName).toBe("ABU DHABI-PLATFARM");
    expect(result[0].active).toBe(true);
    expect(result[0].durationDays).toBe(365);
    expect(result[0].supplyStartDate).toBe("2025-04-01");
    expect(result[0].supplyEndDate).toBe("2025-12-31");

    // Verify lines are transformed correctly
    expect(result[0].lines).toHaveLength(2);
    expect(result[0].lines[0].product).toBe("Double Press Alfalfa");
    expect(result[0].lines[0].quantity).toBe(500);
    expect(result[0].lines[0].priceUnit).toBe(280);
    expect(result[0].lines[0].uom).toBe("Ton");
    expect(result[0].lines[1].product).toBe("Single Press Alfalfa");
    expect(result[0].lines[1].quantity).toBe(500);
    expect(result[0].lines[1].priceUnit).toBe(220);

    // Second agreement has no lines
    expect(result[1].lines).toHaveLength(0);
    expect(result[1].supplyEndDate).toBeNull();
  });
});
