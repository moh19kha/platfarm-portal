/**
 * Comprehensive Vitest tests for the Double Press Production module.
 *
 * These tests call the live Odoo backend via the tRPC router to validate:
 *   - Dashboard stats
 *   - List / filter / search / pagination
 *   - Count per state
 *   - Detail view (getById) with all sub-sections
 *   - Lookup endpoints (employees, products, BOMs)
 *   - Data integrity & cross-validation between endpoints
 */

import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Shared Context ────────────────────────────────────────────────────────

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

let caller: ReturnType<typeof appRouter.createCaller>;

beforeAll(() => {
  caller = appRouter.createCaller(createPublicContext());
});

// ─── Dashboard Stats ───────────────────────────────────────────────────────

describe("production.stats", () => {
  it("returns all required stat fields with valid numbers", async () => {
    const stats = await caller.production.stats();

    expect(stats).toBeDefined();
    expect(typeof stats.totalOrders).toBe("number");
    expect(typeof stats.draftOrders).toBe("number");
    expect(typeof stats.confirmedOrders).toBe("number");
    expect(typeof stats.inProgressOrders).toBe("number");
    expect(typeof stats.doneOrders).toBe("number");
    expect(typeof stats.cancelledOrders).toBe("number");
    expect(typeof stats.totalProducedKg).toBe("number");
    expect(typeof stats.totalDieselLiters).toBe("number");
    expect(typeof stats.avgProductionHours).toBe("number");

    // Sanity: total should equal sum of states
    expect(stats.totalOrders).toBe(
      stats.draftOrders +
        stats.confirmedOrders +
        stats.inProgressOrders +
        stats.doneOrders +
        stats.cancelledOrders
    );

    // Non-negative
    expect(stats.totalOrders).toBeGreaterThan(0);
    expect(stats.totalProducedKg).toBeGreaterThan(0);
    expect(stats.avgProductionHours).toBeGreaterThan(0);
  });
});

// ─── List ──────────────────────────────────────────────────────────────────

describe("production.list", () => {
  it("returns an array of manufacturing orders", async () => {
    const orders = await caller.production.list({ limit: 5 });

    expect(Array.isArray(orders)).toBe(true);
    expect(orders.length).toBeGreaterThan(0);
    expect(orders.length).toBeLessThanOrEqual(5);
  });

  it("each order has required fields with correct types", { timeout: 15000 }, async () => {
    const orders = await caller.production.list({ limit: 3 });

    for (const o of orders) {
      expect(typeof o.id).toBe("number");
      expect(typeof o.name).toBe("string");
      expect(o.name).toMatch(/^WH\/MO\//);
      expect(typeof o.productQty).toBe("number");
      expect(typeof o.qtyProduced).toBe("number");
      expect(typeof o.state).toBe("string");
      expect(["draft", "confirmed", "progress", "to_close", "done", "cancel"]).toContain(o.state);

      // product can be null but usually isn't
      if (o.product) {
        expect(typeof o.product.id).toBe("number");
        expect(typeof o.product.name).toBe("string");
      }

      // company can be null
      if (o.company) {
        expect(typeof o.company.id).toBe("number");
        expect(typeof o.company.name).toBe("string");
      }

      // totalBales should be a non-negative number
      expect(typeof o.totalBales).toBe("number");
      expect(o.totalBales).toBeGreaterThanOrEqual(0);
    }
  });

  it("filters by state correctly", async () => {
    const doneOrders = await caller.production.list({ state: "done", limit: 5 });
    for (const o of doneOrders) {
      expect(o.state).toBe("done");
    }
  });

  it("search by MO name returns matching results", async () => {
    const results = await caller.production.list({ search: "WH/MO/00276", limit: 5 });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("WH/MO/00276");
  });

  it("search by input source returns matching results", async () => {
    const results = await caller.production.list({ search: "Dakhla", limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    for (const o of results) {
      expect(o.inputSource?.toLowerCase()).toContain("dakhla");
    }
  });

  it("search by product name returns matching results", async () => {
    const results = await caller.production.list({ search: "Standard", limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    for (const o of results) {
      expect(o.product?.name.toLowerCase()).toContain("standard");
    }
  });

  it("respects offset for pagination", async () => {
    const page1 = await caller.production.list({ limit: 3, offset: 0 });
    const page2 = await caller.production.list({ limit: 3, offset: 3 });

    expect(page1.length).toBe(3);
    expect(page2.length).toBe(3);

    // Pages should not overlap
    const page1Ids = new Set(page1.map(o => o.id));
    for (const o of page2) {
      expect(page1Ids.has(o.id)).toBe(false);
    }
  });

  it("totalBales calculation is correct (sum of all grade bales)", async () => {
    // Get a specific MO with known bales from getById, then compare with list
    const detail = await caller.production.getById({ id: 279 }); // WH/MO/00276
    const expectedTotal =
      detail.bales.supreme +
      detail.bales.premium +
      detail.bales.grade1 +
      detail.bales.fair +
      (detail.bales.fairGrade3 || 0) +
      detail.bales.alfamix +
      detail.bales.mixGrass +
      detail.bales.wheatStraw;

    const listOrders = await caller.production.list({ search: "WH/MO/00276", limit: 1 });
    expect(listOrders.length).toBe(1);
    expect(listOrders[0].totalBales).toBe(expectedTotal);
  }, 15000);
});

// ─── Count ─────────────────────────────────────────────────────────────────

describe("production.count", () => {
  it("returns total count matching stats", async () => {
    const [count, stats] = await Promise.all([
      caller.production.count({}),
      caller.production.stats(),
    ]);
    expect(count).toBe(stats.totalOrders);
  });

  it("returns correct count for each state", async () => {
    const [all, draft, confirmed, progress, done, cancel] = await Promise.all([
      caller.production.count({}),
      caller.production.count({ state: "draft" }),
      caller.production.count({ state: "confirmed" }),
      caller.production.count({ state: "progress" }),
      caller.production.count({ state: "done" }),
      caller.production.count({ state: "cancel" }),
    ]);

    expect(all).toBe(draft + confirmed + progress + done + cancel);
    expect(draft).toBeGreaterThanOrEqual(0);
    expect(done).toBeGreaterThan(0); // We know there are done orders
  });
});

// ─── Get By ID (Detail) ───────────────────────────────────────────────────

describe("production.getById", () => {
  it("returns full detail for a known MO (WH/MO/00276 = id 279)", async () => {
    const mo = await caller.production.getById({ id: 279 });

    // Basic fields
    expect(mo.id).toBe(279);
    expect(mo.name).toBe("WH/MO/00276");
    expect(mo.state).toBe("done");
    expect(mo.product).not.toBeNull();
    expect(mo.product!.name).toContain("Double Press");
    expect(mo.product!.name).toContain("Grade 1");

    // Quantities
    expect(mo.productQty).toBe(31695);
    expect(mo.qtyProduced).toBe(31695);

    // Company
    expect(mo.company).not.toBeNull();
    expect(mo.company!.name).toContain("PLATFARM");

    // Production Info
    expect(mo.productionDate).toBe("2026-02-28");
    expect(mo.shiftStart).toBeTruthy();
    expect(mo.shiftEnd).toBeTruthy();
    expect(mo.actualHours).toBe(8);
    expect(mo.downTimeMinutes).toBe(0);

    // Input Quality
    expect(mo.inputSource).toBe("Dakhla");
    expect(mo.avgInputBaleWeight).toBe(20);
    expect(mo.containsGrasses).toBe(false);
    expect(mo.containsHighMoisture).toBe(false);

    // Bales
    expect(mo.bales.grade1).toBe(78);
    expect(mo.bales.supreme).toBe(0);
    expect(mo.bales.premium).toBe(0);

    // Machine
    expect(mo.oilMeasurements).toBe(9);
    expect(mo.maxOilTemperature).toBe(45);
    expect(mo.maxOilPressure).toBe(55);
    expect(mo.equipmentFailure).toBe(false);

    // Diesel & Materials
    expect(mo.sleeveBagsUsed).toBe(78);

    // Incentive
    expect(mo.incentiveCancelled).toBe(false);
  });

  it("returns employees with correct structure", async () => {
    const mo = await caller.production.getById({ id: 279 });

    // Supervisors
    expect(Array.isArray(mo.supervisors)).toBe(true);
    expect(mo.supervisors.length).toBeGreaterThan(0);
    for (const sup of mo.supervisors) {
      expect(typeof sup.id).toBe("number");
      expect(typeof sup.name).toBe("string");
      expect(sup.name.length).toBeGreaterThan(0);
    }

    // Production Labors
    expect(Array.isArray(mo.productionLabors)).toBe(true);
    expect(mo.productionLabors.length).toBeGreaterThan(0);

    // Quality Labors
    expect(Array.isArray(mo.qualityLabors)).toBe(true);
    expect(mo.qualityLabors.length).toBeGreaterThan(0);

    // Drivers
    expect(Array.isArray(mo.drivers)).toBe(true);
    expect(mo.drivers.length).toBeGreaterThan(0);
  });

  it("returns raw materials and finished products", async () => {
    const mo = await caller.production.getById({ id: 279 });

    // Raw Materials
    expect(Array.isArray(mo.rawMaterials)).toBe(true);
    expect(mo.rawMaterials.length).toBeGreaterThan(0);
    for (const rm of mo.rawMaterials) {
      expect(typeof rm.id).toBe("number");
      expect(rm.product).not.toBeNull();
      expect(typeof rm.demandQty).toBe("number");
      expect(typeof rm.doneQty).toBe("number");
      expect(typeof rm.state).toBe("string");
    }

    // Finished Products
    expect(Array.isArray(mo.finishedProducts)).toBe(true);
    expect(mo.finishedProducts.length).toBeGreaterThan(0);
    for (const fp of mo.finishedProducts) {
      expect(typeof fp.id).toBe("number");
      expect(fp.product).not.toBeNull();
      expect(typeof fp.demandQty).toBe("number");
      expect(typeof fp.doneQty).toBe("number");
    }
  });

  it("throws error for non-existent MO", async () => {
    await expect(caller.production.getById({ id: 999999 })).rejects.toThrow(
      "Manufacturing order not found"
    );
  });
});

// ─── Cross-Validation: List vs GetById ─────────────────────────────────────

describe("cross-validation: list vs getById", () => {
  it("list data matches getById data for the same MO", async () => {
    const listOrders = await caller.production.list({ search: "WH/MO/00276", limit: 1 });
    expect(listOrders.length).toBe(1);
    const listMo = listOrders[0];

    const detail = await caller.production.getById({ id: listMo.id });

    // Core fields should match
    expect(detail.id).toBe(listMo.id);
    expect(detail.name).toBe(listMo.name);
    expect(detail.state).toBe(listMo.state);
    expect(detail.productQty).toBe(listMo.productQty);
    expect(detail.qtyProduced).toBe(listMo.qtyProduced);
    expect(detail.productionDate).toBe(listMo.productionDate);
    expect(detail.actualHours).toBe(listMo.actualHours);
    expect(detail.inputSource).toBe(listMo.inputSource);
    expect(detail.dieselLiters).toBe(listMo.dieselLiters);
    expect(detail.equipmentFailure).toBe(listMo.equipmentFailure);
    expect(detail.incentiveCancelled).toBe(listMo.incentiveCancelled);

    // Product
    expect(detail.product?.id).toBe(listMo.product?.id);
    expect(detail.product?.name).toBe(listMo.product?.name);

    // Company
    expect(detail.company?.id).toBe(listMo.company?.id);
  });
});

// ─── Cross-Validation: Stats vs Count ──────────────────────────────────────

describe("cross-validation: stats vs count", () => {
  it("stats state counts match individual count queries", async () => {
    const stats = await caller.production.stats();
    const [draft, confirmed, progress, done, cancel] = await Promise.all([
      caller.production.count({ state: "draft" }),
      caller.production.count({ state: "confirmed" }),
      caller.production.count({ state: "progress" }),
      caller.production.count({ state: "done" }),
      caller.production.count({ state: "cancel" }),
    ]);

    expect(stats.draftOrders).toBe(draft);
    expect(stats.confirmedOrders).toBe(confirmed);
    expect(stats.inProgressOrders).toBe(progress);
    expect(stats.doneOrders).toBe(done);
    expect(stats.cancelledOrders).toBe(cancel);
  });
});

// ─── Lookups ───────────────────────────────────────────────────────────────

describe("production.employees", () => {
  it("returns a list of employees with required fields", async () => {
    const employees = await caller.production.employees({});

    expect(Array.isArray(employees)).toBe(true);
    expect(employees.length).toBeGreaterThan(0);

    for (const emp of employees.slice(0, 5)) {
      expect(typeof emp.id).toBe("number");
      expect(typeof emp.name).toBe("string");
      expect(emp.name.length).toBeGreaterThan(0);
      expect(typeof emp.department).toBe("string");
      expect(typeof emp.jobTitle).toBe("string");
    }
  });

  it("search filters employees by name", async () => {
    const results = await caller.production.employees({ search: "Mohamed" });
    expect(results.length).toBeGreaterThan(0);
    for (const emp of results) {
      expect(emp.name.toLowerCase()).toContain("mohamed");
    }
  });
});

describe("production.products", () => {
  it("returns a list of products", async () => {
    const products = await caller.production.products({});

    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);

    for (const p of products.slice(0, 5)) {
      expect(typeof p.id).toBe("number");
      expect(typeof p.name).toBe("string");
      expect(p.name.length).toBeGreaterThan(0);
    }
  });

  it("filters finished products (Double Press)", async () => {
    const results = await caller.production.products({ type: "finished" });
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.name.toLowerCase()).toContain("double press");
    }
  });

  it("filters raw products (Single Press / Alfalfa)", async () => {
    const results = await caller.production.products({ type: "raw" });
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      const name = p.name.toLowerCase();
      expect(name.includes("single press") || name.includes("alfalfa")).toBe(true);
    }
  });
});

describe("production.boms", () => {
  it("returns a list of BOMs", async () => {
    const boms = await caller.production.boms({});

    expect(Array.isArray(boms)).toBe(true);
    expect(boms.length).toBeGreaterThan(0);

    for (const b of boms.slice(0, 5)) {
      expect(typeof b.id).toBe("number");
      expect(typeof b.name).toBe("string");
      expect(typeof b.productQty).toBe("number");
    }
  });
});

// ─── Data Integrity Checks ─────────────────────────────────────────────────

describe("data integrity", () => {
  it("done orders have qtyProduced > 0", async () => {
    const doneOrders = await caller.production.list({ state: "done", limit: 20 });
    for (const o of doneOrders) {
      expect(o.qtyProduced).toBeGreaterThan(0);
    }
  });

  it("all orders have valid product references", async () => {
    const orders = await caller.production.list({ limit: 20 });
    for (const o of orders) {
      // product should exist for all MOs
      expect(o.product).not.toBeNull();
      expect(o.product!.id).toBeGreaterThan(0);
      expect(o.product!.name.length).toBeGreaterThan(0);
    }
  });

  it("bales total matches sum of individual grades in detail view", async () => {
    const detail = await caller.production.getById({ id: 279 });
    const balesSum =
      detail.bales.supreme +
      detail.bales.premium +
      detail.bales.grade1 +
      detail.bales.fair +
      detail.bales.alfamix +
      detail.bales.mixGrass +
      detail.bales.wheatStraw;

    // For MO 279, we know grade1 = 78 and all others = 0
    expect(balesSum).toBe(78);
    expect(detail.bales.grade1).toBe(78);
  });

  it("raw material done quantities match for completed MOs", async () => {
    const detail = await caller.production.getById({ id: 279 });
    for (const rm of detail.rawMaterials) {
      // For done MOs, done qty should equal demand qty
      expect(rm.doneQty).toBe(rm.demandQty);
      expect(rm.state).toBe("done");
    }
  });

  it("finished product done quantities match for completed MOs", async () => {
    const detail = await caller.production.getById({ id: 279 });
    for (const fp of detail.finishedProducts) {
      expect(fp.doneQty).toBe(fp.demandQty);
      expect(fp.state).toBe("done");
    }
  });
});
