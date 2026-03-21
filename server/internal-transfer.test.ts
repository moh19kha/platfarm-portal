/**
 * Internal Transfer Tests
 *
 * Tests the transfer feature logic:
 * - Input validation (Zod schemas matching the tRPC procedure)
 * - Unit conversion (tons → kg) matching frontend logic
 * - Transfer data structure and defaults
 * - Picking type and location ID mapping
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─── Schemas matching the tRPC procedure definitions ────────────────────────

const lineSchema = z.object({
  productId: z.number(),
  quantity: z.number().positive(),
  uomId: z.number().default(12),
  bales: z.number().optional(),
});

const createTransferSchema = z.object({
  sourceLocationId: z.number(),
  destLocationId: z.number(),
  pickingTypeId: z.number().default(66),
  companyId: z.number().default(3),
  origin: z.string().optional(),
  scheduledDate: z.string().optional(),
  lines: z.array(lineSchema).min(1),
  autoConfirm: z.boolean().default(true),
});

const validateTransferSchema = z.object({
  pickingId: z.number(),
  companyId: z.number().default(3),
});

const searchProductsSchema = z.object({
  search: z.string().default(""),
  companyId: z.number().default(3),
  limit: z.number().default(30),
});

// ─── Frontend conversion logic (mirrored from NewTransferWizard) ────────────

function toKg(qty: number, unit: "kg" | "tons"): number {
  return unit === "tons" ? qty * 1000 : qty;
}

// ─── Default location constants (mirrored from NewTransferWizard) ───────────

const DEFAULT_SRC_WH = 13;   // CWDAK
const DEFAULT_SRC_LOC = 131;  // CWDAK/Finished Goods-Dakhla
const DEFAULT_DST_WH = 6;    // MWCP
const DEFAULT_DST_LOC = 115;  // MWCP/Finished Goods-Sokhna
const DEFAULT_PICKING_TYPE = 66;
const DEFAULT_COMPANY = 3;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Internal Transfer — Input Validation", () => {
  describe("createTransfer schema", () => {
    it("should accept valid transfer with one line", () => {
      const input = {
        sourceLocationId: 131,
        destLocationId: 115,
        lines: [{ productId: 10, quantity: 5000 }],
      };
      const parsed = createTransferSchema.parse(input);
      expect(parsed.sourceLocationId).toBe(131);
      expect(parsed.destLocationId).toBe(115);
      expect(parsed.pickingTypeId).toBe(66); // default
      expect(parsed.companyId).toBe(3); // default
      expect(parsed.autoConfirm).toBe(true); // default
      expect(parsed.lines).toHaveLength(1);
      expect(parsed.lines[0].uomId).toBe(12); // default
    });

    it("should accept valid transfer with multiple lines", () => {
      const input = {
        sourceLocationId: 131,
        destLocationId: 115,
        lines: [
          { productId: 10, quantity: 3000, uomId: 12, bales: 30 },
          { productId: 20, quantity: 2000, uomId: 12, bales: 20 },
        ],
      };
      const parsed = createTransferSchema.parse(input);
      expect(parsed.lines).toHaveLength(2);
      expect(parsed.lines[0].bales).toBe(30);
      expect(parsed.lines[1].bales).toBe(20);
    });

    it("should reject empty lines array", () => {
      const input = {
        sourceLocationId: 131,
        destLocationId: 115,
        lines: [],
      };
      expect(() => createTransferSchema.parse(input)).toThrow();
    });

    it("should reject negative quantity", () => {
      const input = {
        sourceLocationId: 131,
        destLocationId: 115,
        lines: [{ productId: 10, quantity: -100 }],
      };
      expect(() => createTransferSchema.parse(input)).toThrow();
    });

    it("should reject zero quantity", () => {
      const input = {
        sourceLocationId: 131,
        destLocationId: 115,
        lines: [{ productId: 10, quantity: 0 }],
      };
      expect(() => createTransferSchema.parse(input)).toThrow();
    });

    it("should reject missing sourceLocationId", () => {
      const input = {
        destLocationId: 115,
        lines: [{ productId: 10, quantity: 500 }],
      };
      expect(() => createTransferSchema.parse(input)).toThrow();
    });

    it("should reject missing destLocationId", () => {
      const input = {
        sourceLocationId: 131,
        lines: [{ productId: 10, quantity: 500 }],
      };
      expect(() => createTransferSchema.parse(input)).toThrow();
    });

    it("should accept custom pickingTypeId and companyId", () => {
      const input = {
        sourceLocationId: 131,
        destLocationId: 115,
        pickingTypeId: 125,
        companyId: 5,
        lines: [{ productId: 10, quantity: 500 }],
      };
      const parsed = createTransferSchema.parse(input);
      expect(parsed.pickingTypeId).toBe(125);
      expect(parsed.companyId).toBe(5);
    });

    it("should accept optional origin and scheduledDate", () => {
      const input = {
        sourceLocationId: 131,
        destLocationId: 115,
        origin: "Portal Transfer DAK→SOK",
        scheduledDate: "2026-03-18 10:00:00",
        lines: [{ productId: 10, quantity: 500 }],
      };
      const parsed = createTransferSchema.parse(input);
      expect(parsed.origin).toBe("Portal Transfer DAK→SOK");
      expect(parsed.scheduledDate).toBe("2026-03-18 10:00:00");
    });
  });

  describe("validateTransfer schema", () => {
    it("should accept valid pickingId", () => {
      const parsed = validateTransferSchema.parse({ pickingId: 42 });
      expect(parsed.pickingId).toBe(42);
      expect(parsed.companyId).toBe(3); // default
    });

    it("should reject missing pickingId", () => {
      expect(() => validateTransferSchema.parse({})).toThrow();
    });
  });

  describe("searchProducts schema", () => {
    it("should apply defaults when no input provided", () => {
      const parsed = searchProductsSchema.parse({});
      expect(parsed.search).toBe("");
      expect(parsed.companyId).toBe(3);
      expect(parsed.limit).toBe(30);
    });

    it("should accept custom search params", () => {
      const parsed = searchProductsSchema.parse({
        search: "alfalfa",
        companyId: 5,
        limit: 10,
      });
      expect(parsed.search).toBe("alfalfa");
      expect(parsed.companyId).toBe(5);
      expect(parsed.limit).toBe(10);
    });
  });
});

describe("Internal Transfer — Unit Conversion", () => {
  it("should convert tons to kg", () => {
    expect(toKg(5, "tons")).toBe(5000);
    expect(toKg(1, "tons")).toBe(1000);
    expect(toKg(0.5, "tons")).toBe(500);
    expect(toKg(25.5, "tons")).toBe(25500);
  });

  it("should keep kg as-is", () => {
    expect(toKg(5, "kg")).toBe(5);
    expect(toKg(100, "kg")).toBe(100);
    expect(toKg(5000, "kg")).toBe(5000);
  });

  it("should handle fractional tons", () => {
    expect(toKg(0.001, "tons")).toBe(1);
    expect(toKg(0.1, "tons")).toBe(100);
    expect(toKg(2.75, "tons")).toBe(2750);
  });
});

describe("Internal Transfer — Default Location Mapping", () => {
  it("should have correct Dakhla source defaults", () => {
    expect(DEFAULT_SRC_WH).toBe(13);   // CWDAK warehouse ID
    expect(DEFAULT_SRC_LOC).toBe(131);  // Finished Goods-Dakhla location ID
  });

  it("should have correct Sokhna destination defaults", () => {
    expect(DEFAULT_DST_WH).toBe(6);    // MWCP warehouse ID
    expect(DEFAULT_DST_LOC).toBe(115);  // Finished Goods-Sokhna location ID
  });

  it("should use company 3 (Cairo) as default", () => {
    expect(DEFAULT_COMPANY).toBe(3);
  });

  it("should use picking type 66 (MWCP internal transfers) as default", () => {
    expect(DEFAULT_PICKING_TYPE).toBe(66);
  });
});

describe("Internal Transfer — Odoo stock.picking Workflow Correctness", () => {
  it("should build correct picking vals structure", () => {
    // Simulates what createInternalTransfer sends to Odoo
    const pickingVals = {
      picking_type_id: DEFAULT_PICKING_TYPE,
      location_id: DEFAULT_SRC_LOC,
      location_dest_id: DEFAULT_DST_LOC,
      company_id: DEFAULT_COMPANY,
      origin: "Platfarm Portal — Dakhla → Sokhna Transfer",
      scheduled_date: "2026-03-18 10:00:00",
      move_type: "direct",
    };

    expect(pickingVals.picking_type_id).toBe(66);
    expect(pickingVals.location_id).toBe(131);
    expect(pickingVals.location_dest_id).toBe(115);
    expect(pickingVals.company_id).toBe(3);
    expect(pickingVals.move_type).toBe("direct");
  });

  it("should build correct move vals structure for each product line", () => {
    const lines = [
      { productId: 10, quantity: 5000, uomId: 12, bales: 50 },
      { productId: 20, quantity: 3000, uomId: 12 },
    ];

    const pickingId = 42;
    const moveVals = lines.map((line) => ({
      name: line.bales
        ? `${line.bales} bales — Portal Transfer`
        : "Portal Transfer",
      picking_id: pickingId,
      product_id: line.productId,
      product_uom_qty: line.quantity,
      product_uom: line.uomId,
      location_id: DEFAULT_SRC_LOC,
      location_dest_id: DEFAULT_DST_LOC,
      company_id: DEFAULT_COMPANY,
    }));

    expect(moveVals).toHaveLength(2);
    expect(moveVals[0].name).toBe("50 bales — Portal Transfer");
    expect(moveVals[0].product_id).toBe(10);
    expect(moveVals[0].product_uom_qty).toBe(5000);
    expect(moveVals[1].name).toBe("Portal Transfer");
    expect(moveVals[1].product_id).toBe(20);
  });

  it("should prepare correct lines when converting from frontend input", () => {
    // Simulates the frontend wizard converting user input to API call
    const frontendLines = [
      { productId: 10, productName: "Alfalfa", quantity: 5, unit: "tons" as const, bales: 50, uomId: 12 },
      { productId: 20, productName: "Rhodes Grass", quantity: 3000, unit: "kg" as const, bales: 30, uomId: 12 },
    ];

    const apiLines = frontendLines.map((l) => ({
      productId: l.productId,
      quantity: toKg(l.quantity, l.unit),
      uomId: l.uomId,
      bales: l.bales || undefined,
    }));

    expect(apiLines[0].quantity).toBe(5000); // 5 tons → 5000 kg
    expect(apiLines[1].quantity).toBe(3000); // 3000 kg stays 3000 kg
    expect(apiLines[0].bales).toBe(50);
    expect(apiLines[1].bales).toBe(30);
  });
});

describe("Internal Transfer — Product Search Result Formatting", () => {
  it("should format Odoo product.product response correctly", () => {
    // Simulates what searchTransferProducts does with Odoo response
    const odooProducts = [
      { id: 10, name: "Alfalfa", display_name: "[ALF] Alfalfa", uom_id: [12, "kg"] },
      { id: 20, name: "Rhodes Grass", display_name: "[RHO] Rhodes Grass", uom_id: [12, "kg"] },
      { id: 30, name: "Timothy Hay", display_name: "[TIM] Timothy Hay", uom_id: [14, "Tons"] },
    ];

    const formatted = odooProducts.map((p) => ({
      id: p.id,
      name: p.name,
      displayName: p.display_name,
      uomId: p.uom_id[0],
      uomName: p.uom_id[1],
    }));

    expect(formatted).toHaveLength(3);
    expect(formatted[0]).toEqual({
      id: 10,
      name: "Alfalfa",
      displayName: "[ALF] Alfalfa",
      uomId: 12,
      uomName: "kg",
    });
    expect(formatted[2].uomName).toBe("Tons");
  });
});
