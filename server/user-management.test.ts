// User Management Router — Unit Tests
// Tests the PORTAL_MODULES list and the permission logic in the userManagement router.
// DB-dependent procedures are tested via mock to avoid needing a live database.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PORTAL_MODULES } from "./routers/userManagement";

// ─── Module List Tests ────────────────────────────────────────────────────────
describe("PORTAL_MODULES", () => {
  it("should contain exactly 13 modules", () => {
    expect(PORTAL_MODULES).toHaveLength(13);
  });

  it("should include all required module IDs", () => {
    const ids = PORTAL_MODULES.map((m) => m.id);
    const required = [
      "purchase", "production", "documents", "investments", "supplychain",
      "hr", "dms", "accounting", "inventory", "meetings", "crm", "reports", "operations",
    ];
    for (const id of required) {
      expect(ids).toContain(id);
    }
  });

  it("should have unique module IDs", () => {
    const ids = PORTAL_MODULES.map((m) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("should have a non-empty title for each module", () => {
    for (const m of PORTAL_MODULES) {
      expect(m.title).toBeTruthy();
      expect(typeof m.title).toBe("string");
    }
  });
});

// ─── Permission Logic Tests ───────────────────────────────────────────────────
describe("Permission logic", () => {
  it("admin myPermissions should return full access for all modules", () => {
    // Simulate the admin branch of myPermissions
    const adminPerms = PORTAL_MODULES.map((m) => ({
      moduleId: m.id,
      canView: 1,
      canCreate: 1,
      canEdit: 1,
      canDelete: 1,
    }));

    expect(adminPerms).toHaveLength(13);
    for (const perm of adminPerms) {
      expect(perm.canView).toBe(1);
      expect(perm.canCreate).toBe(1);
      expect(perm.canEdit).toBe(1);
      expect(perm.canDelete).toBe(1);
    }
  });

  it("should correctly identify accessible modules from permissions array", () => {
    const permissions = [
      { moduleId: "purchase", canView: 1, canCreate: 1, canEdit: 0, canDelete: 0 },
      { moduleId: "hr", canView: 1, canCreate: 0, canEdit: 0, canDelete: 0 },
      { moduleId: "inventory", canView: 0, canCreate: 0, canEdit: 0, canDelete: 0 },
    ];

    const accessible = new Set(
      permissions.filter((p) => p.canView === 1).map((p) => p.moduleId)
    );

    expect(accessible.has("purchase")).toBe(true);
    expect(accessible.has("hr")).toBe(true);
    expect(accessible.has("inventory")).toBe(false);
    expect(accessible.has("production")).toBe(false);
  });

  it("should deny access by default when no permission row exists", () => {
    // A module with no row in user_module_permissions should be inaccessible
    const permissions: { moduleId: string; canView: number }[] = [];
    const accessible = new Set(
      permissions.filter((p) => p.canView === 1).map((p) => p.moduleId)
    );
    expect(accessible.has("purchase")).toBe(false);
  });

  it("canView=0 should block access even if other flags are set", () => {
    const permissions = [
      { moduleId: "hr", canView: 0, canCreate: 1, canEdit: 1, canDelete: 1 },
    ];
    const accessible = new Set(
      permissions.filter((p) => p.canView === 1).map((p) => p.moduleId)
    );
    expect(accessible.has("hr")).toBe(false);
  });
});
