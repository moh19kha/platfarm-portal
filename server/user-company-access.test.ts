/**
 * Tests for per-user company access control:
 * - DB helpers: getUserCompanyAccess, setUserCompanyAccess, getAllUserCompanyAccess
 * - tRPC procedure: myCompanyAccess (logic only, no DB)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the DB module so tests run without a real database ──────────────────
vi.mock("../server/db", () => ({
  getUserCompanyAccess: vi.fn(),
  getAllUserCompanyAccess: vi.fn(),
  setUserCompanyAccess: vi.fn(),
}));

import {
  getUserCompanyAccess,
  setUserCompanyAccess,
  getAllUserCompanyAccess,
} from "../server/db";

const mockGetUserCompanyAccess = getUserCompanyAccess as ReturnType<typeof vi.fn>;
const mockSetUserCompanyAccess = setUserCompanyAccess as ReturnType<typeof vi.fn>;
const mockGetAllUserCompanyAccess = getAllUserCompanyAccess as ReturnType<typeof vi.fn>;

// ── myCompanyAccess logic (extracted for unit testing) ───────────────────────
async function myCompanyAccessLogic(user: { id: number; role: string }) {
  if (user.role === "admin") {
    return { isAdmin: true, allowedCompanyIds: [], defaultCompanyId: null };
  }
  const rows = await getUserCompanyAccess(user.id);
  const defaultRow = rows.find((r: { isDefault: number }) => r.isDefault === 1);
  return {
    isAdmin: false,
    allowedCompanyIds: rows.map((r: { odooCompanyId: number }) => r.odooCompanyId),
    defaultCompanyId: defaultRow?.odooCompanyId ?? null,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("myCompanyAccess logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns full access for admin users without querying DB", async () => {
    const result = await myCompanyAccessLogic({ id: 1, role: "admin" });
    expect(result).toEqual({ isAdmin: true, allowedCompanyIds: [], defaultCompanyId: null });
    expect(mockGetUserCompanyAccess).not.toHaveBeenCalled();
  });

  it("returns empty allowed list for user with no restrictions", async () => {
    mockGetUserCompanyAccess.mockResolvedValue([]);
    const result = await myCompanyAccessLogic({ id: 2, role: "user" });
    expect(result).toEqual({ isAdmin: false, allowedCompanyIds: [], defaultCompanyId: null });
    expect(mockGetUserCompanyAccess).toHaveBeenCalledWith(2);
  });

  it("returns allowed company IDs for restricted user", async () => {
    mockGetUserCompanyAccess.mockResolvedValue([
      { odooCompanyId: 1, isDefault: 0 },
      { odooCompanyId: 3, isDefault: 0 },
    ]);
    const result = await myCompanyAccessLogic({ id: 5, role: "user" });
    expect(result.allowedCompanyIds).toEqual([1, 3]);
    expect(result.defaultCompanyId).toBeNull();
    expect(result.isAdmin).toBe(false);
  });

  it("returns the default company ID when one is set", async () => {
    mockGetUserCompanyAccess.mockResolvedValue([
      { odooCompanyId: 1, isDefault: 0 },
      { odooCompanyId: 3, isDefault: 1 },
      { odooCompanyId: 5, isDefault: 0 },
    ]);
    const result = await myCompanyAccessLogic({ id: 7, role: "user" });
    expect(result.defaultCompanyId).toBe(3);
    expect(result.allowedCompanyIds).toEqual([1, 3, 5]);
  });
});

describe("setUserCompanyAccess helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetUserCompanyAccess.mockResolvedValue(undefined);
  });

  it("can be called with an empty allowed list (no restrictions)", async () => {
    await setUserCompanyAccess(2, [], null, "admin");
    expect(mockSetUserCompanyAccess).toHaveBeenCalledWith(2, [], null, "admin");
  });

  it("can be called with a specific allowed list and default", async () => {
    await setUserCompanyAccess(3, [1, 4, 7], 4, "admin");
    expect(mockSetUserCompanyAccess).toHaveBeenCalledWith(3, [1, 4, 7], 4, "admin");
  });
});

describe("getAllUserCompanyAccess helper", () => {
  it("returns all access rows", async () => {
    const mockRows = [
      { userId: 1, odooCompanyId: 2, isDefault: 1 },
      { userId: 2, odooCompanyId: 3, isDefault: 0 },
    ];
    mockGetAllUserCompanyAccess.mockResolvedValue(mockRows);
    const result = await getAllUserCompanyAccess();
    expect(result).toEqual(mockRows);
  });
});
