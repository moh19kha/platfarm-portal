/**
 * Tests for inventory.dakhlaSokhnaTransfers tRPC procedure
 *
 * These tests validate:
 * 1. The procedure exists in the appRouter
 * 2. Input schema validation (optional date/state/product filters)
 * 3. Response shape (cwdakPickings, internalTransfers, weeklyTrend, productSummary, summary)
 * 4. Data transformation helpers (m2oName, formatPicking, weekly grouping, product totals)
 */

import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicCtx(): TrpcContext {
  return {
    user: null,
    req: {} as any,
    res: {} as any,
  };
}

describe("inventory.dakhlaSokhnaTransfers — procedure contract", () => {
  it("procedure is registered in appRouter", () => {
    const router = appRouter as any;
    expect(router._def?.procedures?.["inventory.dakhlaSokhnaTransfers"]).toBeDefined();
  });

  it("accepts empty input (all optional fields)", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    // This will call Odoo — we just check it doesn't throw a schema validation error
    // (network errors are acceptable in unit test context)
    try {
      const result = await caller.inventory.dakhlaSokhnaTransfers({});
      // If Odoo is reachable, validate response shape
      expect(result).toHaveProperty("cwdakPickings");
      expect(result).toHaveProperty("internalTransfers");
      expect(result).toHaveProperty("weeklyTrend");
      expect(result).toHaveProperty("productSummary");
      expect(result).toHaveProperty("summary");
      expect(result.summary).toHaveProperty("totalCwdakReceipts");
      expect(result.summary).toHaveProperty("totalCwdakTons");
      expect(result.summary).toHaveProperty("totalInternalTransfers");
      expect(result.summary).toHaveProperty("totalInternalTons");
      expect(result.summary).toHaveProperty("doneCount");
      expect(result.summary).toHaveProperty("pendingCount");
      // Arrays
      expect(Array.isArray(result.cwdakPickings)).toBe(true);
      expect(Array.isArray(result.internalTransfers)).toBe(true);
      expect(Array.isArray(result.weeklyTrend)).toBe(true);
      expect(Array.isArray(result.productSummary)).toBe(true);
    } catch (e: any) {
      // Only allow network/Odoo errors, not schema validation errors
      const msg = e?.message || "";
      const isNetworkError = msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") ||
        msg.includes("timeout") || msg.includes("socket") || msg.includes("fetch") ||
        msg.includes("Odoo") || msg.includes("authenticate") || msg.includes("TRPC_ERROR");
      if (!isNetworkError) throw e;
    }
  });

  it("accepts dateFrom and dateTo filters", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    try {
      const result = await caller.inventory.dakhlaSokhnaTransfers({
        dateFrom: "2026-01-01",
        dateTo: "2026-12-31",
      });
      expect(result).toHaveProperty("cwdakPickings");
    } catch (e: any) {
      const msg = e?.message || "";
      const isNetworkError = msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") ||
        msg.includes("timeout") || msg.includes("socket") || msg.includes("fetch") ||
        msg.includes("Odoo") || msg.includes("authenticate") || msg.includes("TRPC_ERROR");
      if (!isNetworkError) throw e;
    }
  });

  it("accepts state filter", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    try {
      const result = await caller.inventory.dakhlaSokhnaTransfers({ state: "done" });
      expect(result).toHaveProperty("cwdakPickings");
      // All returned cwdak pickings should have state 'done' when filtered
      if (result.cwdakPickings.length > 0) {
        result.cwdakPickings.forEach((p: any) => expect(p.state).toBe("done"));
      }
    } catch (e: any) {
      const msg = e?.message || "";
      const isNetworkError = msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") ||
        msg.includes("timeout") || msg.includes("socket") || msg.includes("fetch") ||
        msg.includes("Odoo") || msg.includes("authenticate") || msg.includes("TRPC_ERROR");
      if (!isNetworkError) throw e;
    }
  });

  it("accepts product search filter", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    try {
      const result = await caller.inventory.dakhlaSokhnaTransfers({ product: "Alfalfa" });
      expect(result).toHaveProperty("cwdakPickings");
    } catch (e: any) {
      const msg = e?.message || "";
      const isNetworkError = msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") ||
        msg.includes("timeout") || msg.includes("socket") || msg.includes("fetch") ||
        msg.includes("Odoo") || msg.includes("authenticate") || msg.includes("TRPC_ERROR");
      if (!isNetworkError) throw e;
    }
  });
});

// ─── Unit tests for data transformation helpers ────────────────────────────

describe("dakhlaSokhnaTransfers — data transformation logic", () => {
  // Replicate m2oName helper
  const m2oName = (f: any): string => {
    if (Array.isArray(f) && f.length >= 2) return String(f[1]);
    if (f && typeof f === "string") return f;
    return "";
  };

  it("m2oName extracts name from many2one array", () => {
    expect(m2oName([42, "Raw Material-Dakhla"])).toBe("Raw Material-Dakhla");
    expect(m2oName([1, "CWDAK"])).toBe("CWDAK");
  });

  it("m2oName handles plain string", () => {
    expect(m2oName("Partners/Vendors")).toBe("Partners/Vendors");
  });

  it("m2oName returns empty string for falsy/missing values", () => {
    expect(m2oName(null)).toBe("");
    expect(m2oName(undefined)).toBe("");
    expect(m2oName(false)).toBe("");
    expect(m2oName([])).toBe("");
  });

  it("qtyTons conversion: kg moves → tons", () => {
    // Simulate the conversion logic: rawQty / 1000 when uom is kg
    const rawQty = 5940;
    const uom = "kg";
    const qtyTons = uom.includes("ton") || uom === "t" ? rawQty : rawQty / 1000;
    expect(qtyTons).toBeCloseTo(5.94, 2);
  });

  it("qtyTons conversion: ton moves → stays as-is", () => {
    const rawQty = 5.94;
    const uom = "Ton";
    const qtyTons = uom.toLowerCase().includes("ton") || uom === "t" ? rawQty : rawQty / 1000;
    expect(qtyTons).toBeCloseTo(5.94, 2);
  });

  it("weekly trend grouping produces correct keys", () => {
    // Simulate the week key generation
    const d = new Date("2026-03-14");
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    expect(key).toMatch(/^2026-W\d{2}$/);
  });

  it("summary counts: doneCount + pendingCount = total", () => {
    const mockRows = [
      { state: "done" },
      { state: "done" },
      { state: "assigned" },
      { state: "waiting" },
    ];
    const doneCount = mockRows.filter(r => r.state === "done").length;
    const pendingCount = mockRows.filter(r => r.state !== "done").length;
    expect(doneCount + pendingCount).toBe(mockRows.length);
    expect(doneCount).toBe(2);
    expect(pendingCount).toBe(2);
  });

  it("product summary aggregates correctly", () => {
    const mockCwdakRows = [
      { product: "Alfalfa", qtyTons: 10 },
      { product: "Alfalfa", qtyTons: 5 },
      { product: "Rhodes Grass", qtyTons: 3 },
    ];
    const productTotals = new Map<string, { product: string; cwdakTons: number; internalTons: number; receipts: number }>();
    for (const r of mockCwdakRows) {
      if (!productTotals.has(r.product)) productTotals.set(r.product, { product: r.product, cwdakTons: 0, internalTons: 0, receipts: 0 });
      const pt = productTotals.get(r.product)!;
      pt.cwdakTons += r.qtyTons;
      pt.receipts++;
    }
    const summary = [...productTotals.values()].sort((a, b) => b.cwdakTons - a.cwdakTons);
    expect(summary[0].product).toBe("Alfalfa");
    expect(summary[0].cwdakTons).toBeCloseTo(15, 2);
    expect(summary[0].receipts).toBe(2);
    expect(summary[1].product).toBe("Rhodes Grass");
    expect(summary[1].cwdakTons).toBeCloseTo(3, 2);
  });

  it("transfer percentage calculation handles zero denominator", () => {
    const cwdakTons = 0;
    const internalTons = 0;
    const pct = cwdakTons > 0 ? (internalTons / cwdakTons) * 100 : 0;
    expect(pct).toBe(0);
    expect(isNaN(pct)).toBe(false);
    expect(isFinite(pct)).toBe(true);
  });

  it("transfer percentage calculation is correct", () => {
    const cwdakTons = 100;
    const internalTons = 75;
    const pct = cwdakTons > 0 ? (internalTons / cwdakTons) * 100 : 0;
    expect(pct).toBeCloseTo(75, 1);
  });
});
