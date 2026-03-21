/**
 * Tests for Operations Dashboard CWDAK warehouse fix
 * - Date fallback logic: x_studio_loading_datetime → scheduled_date → date_done
 * - OR domain filter construction for Odoo
 * - Records with empty x_studio_loading_datetime are included via fallback dates
 */
import { describe, it, expect } from "vitest";

// Inline the date extraction logic (same as in operations.ts)
function extractDate(p: {
  x_studio_loading_datetime: string | false;
  scheduled_date: string | false;
  date_done: string | false;
}): string {
  return (
    (p.x_studio_loading_datetime || p.scheduled_date || p.date_done || "") as string
  ).slice(0, 10);
}

describe("CWDAK date fallback logic", () => {
  it("uses x_studio_loading_datetime when available", () => {
    const p = {
      x_studio_loading_datetime: "2026-03-10 15:00:00",
      scheduled_date: "2026-03-08 00:00:00",
      date_done: "2026-03-11 07:25:55",
    };
    expect(extractDate(p)).toBe("2026-03-10");
  });

  it("falls back to scheduled_date when loading_datetime is false", () => {
    const p = {
      x_studio_loading_datetime: false as const,
      scheduled_date: "2026-03-13 00:00:00",
      date_done: "2026-03-14 13:06:50",
    };
    expect(extractDate(p)).toBe("2026-03-13");
  });

  it("falls back to date_done when both loading_datetime and scheduled_date are false", () => {
    const p = {
      x_studio_loading_datetime: false as const,
      scheduled_date: false as const,
      date_done: "2026-03-14 12:49:09",
    };
    expect(extractDate(p)).toBe("2026-03-14");
  });

  it("returns empty string when all date fields are false", () => {
    const p = {
      x_studio_loading_datetime: false as const,
      scheduled_date: false as const,
      date_done: false as const,
    };
    expect(extractDate(p)).toBe("");
  });

  it("handles CWDAK-style records (no loading datetime, has scheduled/done dates)", () => {
    // Real CWDAK record: CWDAK/RM/IN/00027
    const cwdakRecord = {
      x_studio_loading_datetime: false as const,
      scheduled_date: "2026-03-13 00:00:00",
      date_done: "2026-03-14 13:06:50",
    };
    const dateStr = extractDate(cwdakRecord);
    expect(dateStr).toBe("2026-03-13");
    expect(dateStr).not.toBe("");
  });

  it("handles MWCP-style records (has loading datetime)", () => {
    // Real MWCP record: MWCP/RM/IN/00052
    const mwcpRecord = {
      x_studio_loading_datetime: "2026-03-06 15:00:00",
      scheduled_date: "2026-03-08 15:37:54",
      date_done: "2026-03-11 07:25:55",
    };
    const dateStr = extractDate(mwcpRecord);
    expect(dateStr).toBe("2026-03-06");
  });
});

// Test the OR domain construction for Odoo
describe("Odoo OR domain construction", () => {
  it("builds correct Polish-notation domain for multi-date OR filter", () => {
    const domain: unknown[] = [
      ["picking_type_code", "=", "incoming"],
      ["state", "=", "done"],
    ];
    const companyId = 3;
    const from = "2026-03-08";
    const to = "2026-03-15";

    if (companyId) domain.push(["company_id", "=", companyId]);
    domain.push(
      "|",
      "|",
      "&",
      ["x_studio_loading_datetime", ">=", from + " 00:00:00"],
      ["x_studio_loading_datetime", "<=", to + " 23:59:59"],
      "&",
      ["scheduled_date", ">=", from + " 00:00:00"],
      ["scheduled_date", "<=", to + " 23:59:59"],
      "&",
      ["date_done", ">=", from + " 00:00:00"],
      ["date_done", "<=", to + " 23:59:59"]
    );

    // Verify structure: 3 base conditions + 2 OR operators + 3 AND operators + 6 date conditions = 14 elements
    expect(domain).toHaveLength(14);

    // Verify the OR operators are at positions 3 and 4
    expect(domain[3]).toBe("|");
    expect(domain[4]).toBe("|");

    // Verify the AND operators are at positions 5, 8, 11
    expect(domain[5]).toBe("&");
    expect(domain[8]).toBe("&");
    expect(domain[11]).toBe("&");

    // Verify the base conditions
    expect(domain[0]).toEqual(["picking_type_code", "=", "incoming"]);
    expect(domain[1]).toEqual(["state", "=", "done"]);
    expect(domain[2]).toEqual(["company_id", "=", 3]);
  });

  it("includes all three date field pairs in the OR filter", () => {
    const domain: unknown[] = [];
    const from = "2026-03-08";
    const to = "2026-03-15";

    domain.push(
      "|",
      "|",
      "&",
      ["x_studio_loading_datetime", ">=", from + " 00:00:00"],
      ["x_studio_loading_datetime", "<=", to + " 23:59:59"],
      "&",
      ["scheduled_date", ">=", from + " 00:00:00"],
      ["scheduled_date", "<=", to + " 23:59:59"],
      "&",
      ["date_done", ">=", from + " 00:00:00"],
      ["date_done", "<=", to + " 23:59:59"]
    );

    // Verify all three date fields are present
    const dateFields = domain
      .filter((d) => Array.isArray(d))
      .map((d) => (d as string[])[0]);
    expect(dateFields).toContain("x_studio_loading_datetime");
    expect(dateFields).toContain("scheduled_date");
    expect(dateFields).toContain("date_done");

    // Each date field appears twice (>= and <=)
    const loadingDateCount = dateFields.filter(
      (f) => f === "x_studio_loading_datetime"
    ).length;
    const scheduledDateCount = dateFields.filter(
      (f) => f === "scheduled_date"
    ).length;
    const dateDoneCount = dateFields.filter((f) => f === "date_done").length;
    expect(loadingDateCount).toBe(2);
    expect(scheduledDateCount).toBe(2);
    expect(dateDoneCount).toBe(2);
  });
});

// Test the toUsd currency conversion (inline for testing)
function toUsd(
  price: number,
  currencyCode: string,
  egpToUsd: number
): number {
  if (!price || price <= 0) return 0;
  if (currencyCode === "USD" && price > 500) return price * egpToUsd;
  if (currencyCode === "USD" && price < 1) return 0;
  if (currencyCode === "USD") return price;
  return price * egpToUsd;
}

// Test the stock.move.line weight fallback logic
describe("stock.move.line weight fallback", () => {
  // Simulate the enrichment logic from fetchSupplyPickings
  function enrichWithMoveLineWeights(
    pickings: { id: number; x_studio_net_weight_in_tons: number; _weight_from_move_lines?: boolean }[],
    moveLines: { picking_id: [number, string] | number; quantity: number; product_uom_id: [number, string] }[]
  ) {
    const zeroWeightIds = pickings.filter(p => !p.x_studio_net_weight_in_tons).map(p => p.id);
    if (zeroWeightIds.length === 0) return;

    const qtyByPicking: Record<number, number> = {};
    for (const ml of moveLines) {
      const pickId = Array.isArray(ml.picking_id) ? ml.picking_id[0] : ml.picking_id;
      if (!zeroWeightIds.includes(pickId)) continue;
      const uom = Array.isArray(ml.product_uom_id) ? ml.product_uom_id[1] : "";
      const qty = ml.quantity || 0;
      const tons = uom.toLowerCase().includes("ton") ? qty : qty / 1000;
      qtyByPicking[pickId] = (qtyByPicking[pickId] || 0) + tons;
    }
    for (const p of pickings) {
      if (!p.x_studio_net_weight_in_tons && qtyByPicking[p.id]) {
        p.x_studio_net_weight_in_tons = Math.round(qtyByPicking[p.id] * 1000) / 1000;
        p._weight_from_move_lines = true;
      }
    }
  }

  it("enriches zero-weight pickings with move line quantity in kg", () => {
    const pickings = [
      { id: 1, x_studio_net_weight_in_tons: 0 },
      { id: 2, x_studio_net_weight_in_tons: 19 }, // already has weight
    ];
    const moveLines = [
      { picking_id: [1, "CWDAK/RM/IN/00010"] as [number, string], quantity: 5660, product_uom_id: [1, "kg"] as [number, string] },
    ];
    enrichWithMoveLineWeights(pickings, moveLines);
    expect(pickings[0].x_studio_net_weight_in_tons).toBe(5.66);
    expect(pickings[0]._weight_from_move_lines).toBe(true);
    expect(pickings[1].x_studio_net_weight_in_tons).toBe(19); // unchanged
  });

  it("handles UoM in tons", () => {
    const pickings = [{ id: 1, x_studio_net_weight_in_tons: 0 }];
    const moveLines = [
      { picking_id: [1, "TEST"] as [number, string], quantity: 5.66, product_uom_id: [2, "Tons"] as [number, string] },
    ];
    enrichWithMoveLineWeights(pickings, moveLines);
    expect(pickings[0].x_studio_net_weight_in_tons).toBe(5.66);
  });

  it("sums multiple move lines for the same picking", () => {
    const pickings = [{ id: 1, x_studio_net_weight_in_tons: 0 }];
    const moveLines = [
      { picking_id: [1, "CWDAK"] as [number, string], quantity: 3000, product_uom_id: [1, "kg"] as [number, string] },
      { picking_id: [1, "CWDAK"] as [number, string], quantity: 2660, product_uom_id: [1, "kg"] as [number, string] },
    ];
    enrichWithMoveLineWeights(pickings, moveLines);
    expect(pickings[0].x_studio_net_weight_in_tons).toBe(5.66);
  });

  it("does not overwrite existing header weight", () => {
    const pickings = [{ id: 1, x_studio_net_weight_in_tons: 19 }];
    const moveLines = [
      { picking_id: [1, "MWCP"] as [number, string], quantity: 19000, product_uom_id: [1, "kg"] as [number, string] },
    ];
    enrichWithMoveLineWeights(pickings, moveLines);
    expect(pickings[0].x_studio_net_weight_in_tons).toBe(19); // unchanged
    expect(pickings[0]._weight_from_move_lines).toBeUndefined();
  });

  it("handles empty move lines gracefully", () => {
    const pickings = [{ id: 1, x_studio_net_weight_in_tons: 0 }];
    enrichWithMoveLineWeights(pickings, []);
    expect(pickings[0].x_studio_net_weight_in_tons).toBe(0);
  });

  it("handles Ali Gomaa's real CWDAK data (9 loads)", () => {
    const pickings = [
      { id: 10, x_studio_net_weight_in_tons: 0 },
      { id: 11, x_studio_net_weight_in_tons: 0 },
      { id: 12, x_studio_net_weight_in_tons: 0 },
      { id: 13, x_studio_net_weight_in_tons: 0 },
      { id: 17, x_studio_net_weight_in_tons: 0 },
      { id: 18, x_studio_net_weight_in_tons: 0 },
      { id: 19, x_studio_net_weight_in_tons: 0 },
      { id: 20, x_studio_net_weight_in_tons: 0 },
      { id: 21, x_studio_net_weight_in_tons: 0 },
    ];
    const moveLines = [
      { picking_id: [10, "CWDAK/RM/IN/00010"] as [number, string], quantity: 5660, product_uom_id: [1, "kg"] as [number, string] },
      { picking_id: [11, "CWDAK/RM/IN/00011"] as [number, string], quantity: 5710, product_uom_id: [1, "kg"] as [number, string] },
      { picking_id: [12, "CWDAK/RM/IN/00012"] as [number, string], quantity: 5370, product_uom_id: [1, "kg"] as [number, string] },
      { picking_id: [13, "CWDAK/RM/IN/00013"] as [number, string], quantity: 5540, product_uom_id: [1, "kg"] as [number, string] },
      { picking_id: [17, "CWDAK/RM/IN/00017"] as [number, string], quantity: 22050, product_uom_id: [1, "kg"] as [number, string] },
      { picking_id: [18, "CWDAK/RM/IN/00018"] as [number, string], quantity: 6150, product_uom_id: [1, "kg"] as [number, string] },
      { picking_id: [19, "CWDAK/RM/IN/00019"] as [number, string], quantity: 6000, product_uom_id: [1, "kg"] as [number, string] },
      { picking_id: [20, "CWDAK/RM/IN/00020"] as [number, string], quantity: 6270, product_uom_id: [1, "kg"] as [number, string] },
      { picking_id: [21, "CWDAK/RM/IN/00021"] as [number, string], quantity: 6960, product_uom_id: [1, "kg"] as [number, string] },
    ];
    enrichWithMoveLineWeights(pickings, moveLines);
    const totalTons = pickings.reduce((sum, p) => sum + p.x_studio_net_weight_in_tons, 0);
    expect(totalTons).toBeCloseTo(69.71, 1);
    expect(pickings.every(p => p._weight_from_move_lines)).toBe(true);
  });
});

// Test the extractWarehouse helper
describe("extractWarehouse", () => {
  function extractWarehouse(ref: string): string {
    if (!ref) return "Unknown";
    const prefix = ref.split("/")[0];
    if (prefix === "MWCP" || prefix === "CWDAK" || prefix === "WH") return prefix;
    return prefix || "Unknown";
  }

  it("extracts MWCP from MWCP/RM/IN/00052", () => {
    expect(extractWarehouse("MWCP/RM/IN/00052")).toBe("MWCP");
  });

  it("extracts CWDAK from CWDAK/RM/IN/00010", () => {
    expect(extractWarehouse("CWDAK/RM/IN/00010")).toBe("CWDAK");
  });

  it("extracts WH from WH/IN/03995", () => {
    expect(extractWarehouse("WH/IN/03995")).toBe("WH");
  });

  it("returns Unknown for empty string", () => {
    expect(extractWarehouse("")).toBe("Unknown");
  });

  it("returns prefix for unknown warehouse codes", () => {
    expect(extractWarehouse("NEWWH/RM/IN/00001")).toBe("NEWWH");
  });
});

describe("toUsd with CWDAK data", () => {
  const egpToUsd = 0.0191; // ~52.4 EGP/USD

  it("converts EGP prices to USD", () => {
    // Typical Dakhla price: 8200 EGP/ton
    const usd = toUsd(8200, "EGP", egpToUsd);
    expect(usd).toBeCloseTo(156.62, 0);
  });

  it("detects misclassified USD prices (>500 means actually EGP)", () => {
    // Price labeled USD but clearly in EGP range
    const usd = toUsd(8200, "USD", egpToUsd);
    expect(usd).toBeCloseTo(156.62, 0);
  });

  it("passes through valid USD prices", () => {
    // Toshka: ~$200-250 USD/ton
    const usd = toUsd(235, "USD", egpToUsd);
    expect(usd).toBe(235);
  });

  it("excludes junk entries (< $1/ton)", () => {
    const usd = toUsd(0.5, "USD", egpToUsd);
    expect(usd).toBe(0);
  });

  it("handles zero price", () => {
    const usd = toUsd(0, "EGP", egpToUsd);
    expect(usd).toBe(0);
  });
});

// ─── Tests for warehouse column in quality aggregations ───────────────────────
describe("Quality aggregation: warehouses field", () => {
  function extractWarehouse(ref: string): string {
    if (!ref) return "Unknown";
    const prefix = ref.split("/")[0];
    if (prefix === "MWCP" || prefix === "CWDAK" || prefix === "WH") return prefix;
    return prefix || "Unknown";
  }

  function aggregateQualityBySource(pickings: Array<{ ref: string; source: string; tons: number; protein: number }>) {
    const bySource: Record<string, { tons: number; proteinSum: number; count: number; warehouses: Set<string> }> = {};
    for (const p of pickings) {
      const wh = extractWarehouse(p.ref);
      if (!bySource[p.source]) bySource[p.source] = { tons: 0, proteinSum: 0, count: 0, warehouses: new Set() };
      bySource[p.source].tons += p.tons;
      bySource[p.source].warehouses.add(wh);
      if (p.protein > 0) { bySource[p.source].proteinSum += p.protein; bySource[p.source].count += 1; }
    }
    return Object.entries(bySource).map(([name, d]) => ({
      name,
      tons: d.tons,
      avgProtein: d.count > 0 ? d.proteinSum / d.count : 0,
      warehouses: Array.from(d.warehouses).sort().join(", "),
    }));
  }

  it("shows MWCP warehouse for MWCP receipts", () => {
    const pickings = [
      { ref: "MWCP/RM/IN/00052", source: "Dakhla", tons: 30, protein: 18.5 },
      { ref: "MWCP/RM/IN/00053", source: "Dakhla", tons: 25, protein: 19.0 },
    ];
    const result = aggregateQualityBySource(pickings);
    expect(result[0].warehouses).toBe("MWCP");
  });

  it("shows CWDAK warehouse for CWDAK receipts", () => {
    const pickings = [
      { ref: "CWDAK/RM/IN/00010", source: "Dakhla", tons: 40, protein: 17.5 },
    ];
    const result = aggregateQualityBySource(pickings);
    expect(result[0].warehouses).toBe("CWDAK");
  });

  it("shows comma-separated warehouses when source spans both MWCP and CWDAK", () => {
    const pickings = [
      { ref: "MWCP/RM/IN/00052", source: "Dakhla", tons: 30, protein: 18.5 },
      { ref: "CWDAK/RM/IN/00010", source: "Dakhla", tons: 40, protein: 17.5 },
    ];
    const result = aggregateQualityBySource(pickings);
    expect(result[0].warehouses).toBe("CWDAK, MWCP"); // sorted alphabetically
  });

  it("shows warehouse even when protein is 0 (no NIR data)", () => {
    const pickings = [
      { ref: "CWDAK/RM/IN/00015", source: "Toshka", tons: 50, protein: 0 },
    ];
    const result = aggregateQualityBySource(pickings);
    expect(result[0].warehouses).toBe("CWDAK");
    expect(result[0].avgProtein).toBe(0);
    expect(result[0].tons).toBe(50);
  });
});

// ─── Tests for weekly protein allRefs fix ─────────────────────────────────────
describe("Weekly protein trend: allRefs includes loads without NIR data", () => {
  function aggregateWeeklyProtein(pickings: Array<{ ref: string; protein: number; week: string }>) {
    const weeklyProtein: Record<string, { label: string; proteinSum: number; count: number; refs: string[]; allRefs: string[] }> = {};
    for (const p of pickings) {
      if (!weeklyProtein[p.week]) weeklyProtein[p.week] = { label: p.week, proteinSum: 0, count: 0, refs: [], allRefs: [] };
      weeklyProtein[p.week].allRefs.push(p.ref);
      if (p.protein > 0) {
        weeklyProtein[p.week].proteinSum += p.protein;
        weeklyProtein[p.week].count += 1;
        weeklyProtein[p.week].refs.push(p.ref);
      }
    }
    return Object.entries(weeklyProtein).map(([week, d]) => ({
      week,
      avgProtein: d.count > 0 ? d.proteinSum / d.count : 0,
      refs: d.allRefs,
      proteinRefs: d.refs,
      loadCount: d.allRefs.length,
      proteinCount: d.count,
    }));
  }

  it("includes all loads in refs even when no protein data", () => {
    const pickings = [
      { ref: "CWDAK/RM/IN/00010", protein: 0, week: "W11Y26" },
      { ref: "CWDAK/RM/IN/00011", protein: 0, week: "W11Y26" },
      { ref: "CWDAK/RM/IN/00012", protein: 0, week: "W11Y26" },
    ];
    const result = aggregateWeeklyProtein(pickings);
    expect(result[0].refs).toHaveLength(3);
    expect(result[0].proteinCount).toBe(0);
    expect(result[0].avgProtein).toBe(0);
    expect(result[0].loadCount).toBe(3);
  });

  it("separates protein refs from all refs when some loads have NIR data", () => {
    const pickings = [
      { ref: "MWCP/RM/IN/00052", protein: 18.5, week: "W10Y26" },
      { ref: "CWDAK/RM/IN/00010", protein: 0, week: "W10Y26" },
      { ref: "CWDAK/RM/IN/00011", protein: 0, week: "W10Y26" },
    ];
    const result = aggregateWeeklyProtein(pickings);
    expect(result[0].refs).toHaveLength(3); // all 3 loads shown in tooltip
    expect(result[0].proteinRefs).toHaveLength(1); // only 1 has NIR
    expect(result[0].proteinCount).toBe(1);
    expect(result[0].avgProtein).toBeCloseTo(18.5);
  });

  it("shows correct loadCount vs proteinCount for subLabel", () => {
    const pickings = [
      { ref: "MWCP/RM/IN/00052", protein: 18.5, week: "W10Y26" },
      { ref: "MWCP/RM/IN/00053", protein: 19.0, week: "W10Y26" },
      { ref: "CWDAK/RM/IN/00010", protein: 0, week: "W10Y26" },
    ];
    const result = aggregateWeeklyProtein(pickings);
    expect(result[0].loadCount).toBe(3);
    expect(result[0].proteinCount).toBe(2);
    // subLabel would show: "2/3 loads with NIR"
  });
});
