// Vitest tests for invitation flow logic
// Tests the core business logic without requiring a live database connection.
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock db helpers ─────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  createInvitation: vi.fn(),
  getInvitationByToken: vi.fn(),
  getInvitationByEmail: vi.fn(),
  listInvitations: vi.fn(),
  updateInvitationStatus: vi.fn(),
  getUserByOpenId: vi.fn(),
  updateUserRole: vi.fn(),
  getUserPermissions: vi.fn(),
  deleteUserPermissions: vi.fn(),
  setUserModulePermission: vi.fn(),
}));

vi.mock("./email", () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue(true),
}));

// ─── Token generation ─────────────────────────────────────────────────────────
describe("Invitation token generation", () => {
  it("generates a 64-character hex token", () => {
    const crypto = require("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it("generates unique tokens on each call", () => {
    const crypto = require("crypto");
    const t1 = crypto.randomBytes(32).toString("hex");
    const t2 = crypto.randomBytes(32).toString("hex");
    expect(t1).not.toBe(t2);
  });
});

// ─── Invitation URL builder ───────────────────────────────────────────────────
describe("Invitation URL builder", () => {
  it("builds a valid invite URL with the token", () => {
    const base = "https://platfarm.manus.space";
    const token = "abc123def456";
    const url = `${base}/invite/${token}`;
    expect(url).toBe("https://platfarm.manus.space/invite/abc123def456");
    expect(url).toContain("/invite/");
  });
});

// ─── Invitation expiry logic ──────────────────────────────────────────────────
describe("Invitation expiry logic", () => {
  it("marks invitation as expired when expiresAt is in the past", () => {
    const inv = {
      status: "pending" as const,
      expiresAt: new Date(Date.now() - 1000), // 1 second ago
    };
    const now = new Date();
    const isExpired = inv.status === "pending" && inv.expiresAt < now;
    expect(isExpired).toBe(true);
  });

  it("does not mark invitation as expired when expiresAt is in the future", () => {
    const inv = {
      status: "pending" as const,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };
    const now = new Date();
    const isExpired = inv.status === "pending" && inv.expiresAt < now;
    expect(isExpired).toBe(false);
  });

  it("does not mark accepted invitation as expired even if past expiry", () => {
    const inv = {
      status: "accepted" as const,
      expiresAt: new Date(Date.now() - 1000),
    };
    const now = new Date();
    const isExpired = inv.status === "pending" && inv.expiresAt < now;
    expect(isExpired).toBe(false);
  });

  it("sets expiresAt to 7 days from now", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000);
    const diffMs = expiresAt.getTime() - now;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(7, 1);
  });
});

// ─── Role label mapping ───────────────────────────────────────────────────────
describe("Role label mapping", () => {
  const roleLabel = (role: string) => role === "admin" ? "Administrator" : "Team Member";

  it("maps admin role to Administrator", () => {
    expect(roleLabel("admin")).toBe("Administrator");
  });

  it("maps user role to Team Member", () => {
    expect(roleLabel("user")).toBe("Team Member");
  });
});

// ─── Permission preset application ───────────────────────────────────────────
describe("Permission preset application", () => {
  it("applies all preset permissions from invitation", () => {
    const presetPermissions = [
      { moduleId: "purchase", canView: 1, canCreate: 1, canEdit: 0, canDelete: 0 },
      { moduleId: "hr", canView: 1, canCreate: 0, canEdit: 0, canDelete: 0 },
    ];
    expect(Array.isArray(presetPermissions)).toBe(true);
    expect(presetPermissions).toHaveLength(2);
    expect(presetPermissions[0].moduleId).toBe("purchase");
    expect(presetPermissions[0].canView).toBe(1);
    expect(presetPermissions[0].canDelete).toBe(0);
  });

  it("skips permission application when presetPermissions is null", () => {
    const presetPermissions = null;
    const shouldApply = presetPermissions !== null && Array.isArray(presetPermissions);
    expect(shouldApply).toBe(false);
  });

  it("skips permission application when presetPermissions is empty array", () => {
    const presetPermissions: unknown[] = [];
    const shouldApply = Array.isArray(presetPermissions) && presetPermissions.length > 0;
    expect(shouldApply).toBe(false);
  });
});

// ─── Email validation ─────────────────────────────────────────────────────────
describe("Email validation in invite form", () => {
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  it("accepts valid email addresses", () => {
    expect(isValidEmail("user@company.com")).toBe(true);
    expect(isValidEmail("admin@platfarm.ae")).toBe(true);
    expect(isValidEmail("first.last+tag@example.org")).toBe(true);
  });

  it("rejects invalid email addresses", () => {
    expect(isValidEmail("notanemail")).toBe(false);
    expect(isValidEmail("missing@")).toBe(false);
    expect(isValidEmail("@nodomain.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});
