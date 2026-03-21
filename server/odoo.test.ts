import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Tests for the Odoo companies tRPC route.
 * We mock the axios calls to avoid hitting the real Odoo server in tests,
 * but verify the full data transformation pipeline.
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
import { fetchCompanies, resetOdooSession } from "./odoo";
import axios from "axios";

// Get the mock post function
const mockAxiosInstance = axios.create();
const mockPost = mockAxiosInstance.post as ReturnType<typeof vi.fn>;

// Sample Odoo response data
const MOCK_ODOO_COMPANIES = [
  {
    id: 2,
    name: "ABU DHABI-PLATFARM FOR AGRITECH AND AGRIBUSINESS LTD",
    display_name: "ABU DHABI-PLATFARM FOR AGRITECH AND AGRIBUSINESS LTD",
    currency_id: [2, "AED"],
    country_id: [232, "United Arab Emirates"],
    city: false,
    parent_id: false,
    child_ids: [],
  },
  {
    id: 3,
    name: "Cairo-PLATFARM FOR AGRICULTURE CONSULTANCY",
    display_name: "Cairo-PLATFARM FOR AGRICULTURE CONSULTANCY",
    currency_id: [49, "EGP"],
    country_id: [65, "Egypt"],
    city: "Cairo",
    parent_id: false,
    child_ids: [],
  },
  {
    id: 1,
    name: "ADGM-PLATFARM FOR AGRITECH AND AGRIBUSINESS LTD",
    display_name: "ADGM-PLATFARM FOR AGRITECH AND AGRIBUSINESS LTD",
    currency_id: [2, "AED"],
    country_id: [232, "United Arab Emirates"],
    city: false,
    parent_id: false,
    child_ids: [2, 3],
  },
];

describe("Odoo Companies Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOdooSession();
  });

  it("authenticates and fetches companies from Odoo", async () => {
    // First call: authenticate → returns uid
    mockPost.mockResolvedValueOnce({
      data: { jsonrpc: "2.0", id: null, result: 42 },
      headers: {},
    });
    // Second call: search_read → returns companies
    mockPost.mockResolvedValueOnce({
      data: { jsonrpc: "2.0", id: null, result: MOCK_ODOO_COMPANIES },
    });

    const companies = await fetchCompanies();

    // Verify authenticate was called first
    expect(mockPost).toHaveBeenCalledTimes(2);
    const authCall = mockPost.mock.calls[0];
    expect(authCall[0]).toBe("/jsonrpc");
    expect(authCall[1].params.service).toBe("common");
    expect(authCall[1].params.method).toBe("authenticate");

    // Verify search_read was called with correct model and fields
    const searchCall = mockPost.mock.calls[1];
    expect(searchCall[0]).toBe("/jsonrpc");
    expect(searchCall[1].params.service).toBe("object");
    expect(searchCall[1].params.method).toBe("execute_kw");
    const args = searchCall[1].params.args;
    expect(args[3]).toBe("res.company"); // model
    expect(args[4]).toBe("search_read"); // method

    // Verify returned data
    expect(companies).toHaveLength(3);
    expect(companies[0]).toEqual(MOCK_ODOO_COMPANIES[0]);
    expect(companies[1]).toEqual(MOCK_ODOO_COMPANIES[1]);
    expect(companies[2]).toEqual(MOCK_ODOO_COMPANIES[2]);
  });

  it("caches the uid after first authentication", async () => {
    // First call: authenticate
    mockPost.mockResolvedValueOnce({
      data: { jsonrpc: "2.0", id: null, result: 42 },
      headers: {},
    });
    // Second call: search_read
    mockPost.mockResolvedValueOnce({
      data: { jsonrpc: "2.0", id: null, result: MOCK_ODOO_COMPANIES },
    });

    await fetchCompanies();

    // Third call (second fetchCompanies): should NOT re-authenticate
    mockPost.mockResolvedValueOnce({
      data: { jsonrpc: "2.0", id: null, result: MOCK_ODOO_COMPANIES },
    });

    await fetchCompanies();

    // Total calls: 2 (auth + search_read) + 1 (search_read only) = 3
    expect(mockPost).toHaveBeenCalledTimes(3);
    // The third call should be search_read, not authenticate
    const thirdCall = mockPost.mock.calls[2];
    expect(thirdCall[1].params.service).toBe("object");
  });

  it("throws on authentication failure", async () => {
    mockPost.mockResolvedValueOnce({
      data: { jsonrpc: "2.0", id: null, result: false },
      headers: {},
    });

    await expect(fetchCompanies()).rejects.toThrow(
      "Odoo authentication failed: invalid credentials"
    );
  });

  it("throws on Odoo RPC error", async () => {
    // Auth succeeds
    mockPost.mockResolvedValueOnce({
      data: { jsonrpc: "2.0", id: null, result: 42 },
      headers: {},
    });
    // search_read fails
    mockPost.mockResolvedValueOnce({
      data: {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: 200,
          message: "Server Error",
          data: { message: "Access Denied", debug: "" },
        },
      },
    });

    await expect(fetchCompanies()).rejects.toThrow(
      "Odoo RPC error (res.company.search_read): Access Denied"
    );
  });

  it("resets session on resetOdooSession call", async () => {
    // Auth + fetch
    mockPost.mockResolvedValueOnce({
      data: { jsonrpc: "2.0", id: null, result: 42 },
      headers: {},
    });
    mockPost.mockResolvedValueOnce({
      data: { jsonrpc: "2.0", id: null, result: MOCK_ODOO_COMPANIES },
    });
    await fetchCompanies();

    // Reset
    resetOdooSession();

    // Next call should re-authenticate
    mockPost.mockResolvedValueOnce({
      data: { jsonrpc: "2.0", id: null, result: 42 },
      headers: {},
    });
    mockPost.mockResolvedValueOnce({
      data: { jsonrpc: "2.0", id: null, result: MOCK_ODOO_COMPANIES },
    });
    await fetchCompanies();

    // Total: 2 + 2 = 4 calls (auth was called again after reset)
    expect(mockPost).toHaveBeenCalledTimes(4);
    // Verify the 3rd call is an auth call
    expect(mockPost.mock.calls[2][1].params.service).toBe("common");
  });
});

describe("Odoo tRPC Router - companies transform", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOdooSession();
  });

  it("transforms Odoo records to frontend-friendly shape", async () => {
    // Auth
    mockPost.mockResolvedValueOnce({
      data: { jsonrpc: "2.0", id: null, result: 42 },
      headers: {},
    });
    // search_read
    mockPost.mockResolvedValueOnce({
      data: { jsonrpc: "2.0", id: null, result: MOCK_ODOO_COMPANIES },
    });

    // Import the router and test the transform via tRPC caller
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: vi.fn() } as any,
    });

    const result = await caller.odoo.companies();

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      id: 2,
      name: "ABU DHABI-PLATFARM FOR AGRITECH AND AGRIBUSINESS LTD",
      displayName: "ABU DHABI-PLATFARM FOR AGRITECH AND AGRIBUSINESS LTD",
      currency: "AED",
      country: "United Arab Emirates",
      city: null,
      parentId: null,
      childIds: [],
    });
    expect(result[1]).toMatchObject({
      id: 3,
      name: "Cairo-PLATFARM FOR AGRICULTURE CONSULTANCY",
      currency: "EGP",
      country: "Egypt",
      city: "Cairo",
    });
    // Verify parent_id transform
    expect(result[2]).toMatchObject({
      id: 1,
      childIds: [2, 3],
      parentId: null,
    });
  });
});
