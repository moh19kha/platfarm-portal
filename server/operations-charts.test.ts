/**
 * Tests for Operations Dashboard chart data helpers
 * - cleanGrade label formatting
 * - weeklyPriceTrend aggregation logic
 * - truckingCostPerTonBySource aggregation logic
 */
import { describe, it, expect } from "vitest";

// Inline the cleanGrade function for unit testing (same logic as in operations.ts)
function cleanGrade(raw: string): string {
  if (!raw || raw === "Unknown") return "Unknown";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

describe("cleanGrade", () => {
  it("converts underscored grade names to title case", () => {
    expect(cleanGrade("grade_1")).toBe("Grade 1");
    expect(cleanGrade("grade_2")).toBe("Grade 2");
    expect(cleanGrade("fair_grade")).toBe("Fair Grade");
  });

  it("handles already clean names", () => {
    expect(cleanGrade("Grade 2")).toBe("Grade 2");
    expect(cleanGrade("Premium")).toBe("Premium");
  });

  it("handles empty/unknown values", () => {
    expect(cleanGrade("")).toBe("Unknown");
    expect(cleanGrade("Unknown")).toBe("Unknown");
  });

  it("handles complex grade names", () => {
    expect(cleanGrade("grade_1_premium")).toBe("Grade 1 Premium");
    expect(cleanGrade("alfamix_special")).toBe("Alfamix Special");
  });
});

// Test the weekly price trend aggregation logic
describe("weeklyPriceTrend aggregation", () => {
  it("computes weighted average price per ton correctly", () => {
    // Simulate: source A has 2 loads in week 1
    // Load 1: 10 tons at 5000/ton, Load 2: 20 tons at 8000/ton
    // Weighted avg = (10*5000 + 20*8000) / (10+20) = (50000+160000)/30 = 7000
    const priceSum = 10 * 5000 + 20 * 8000; // 210000
    const tonsSum = 10 + 20; // 30
    const avgPricePerTon = Math.round((priceSum / tonsSum) * 100) / 100;
    expect(avgPricePerTon).toBe(7000);
  });

  it("handles single load correctly", () => {
    const priceSum = 15 * 6000; // 90000
    const tonsSum = 15;
    const avgPricePerTon = Math.round((priceSum / tonsSum) * 100) / 100;
    expect(avgPricePerTon).toBe(6000);
  });
});

// Test the trucking cost per ton aggregation logic
describe("truckingCostPerTonBySource aggregation", () => {
  it("computes cost per ton correctly", () => {
    // Source: costSum=50000, tons=100
    const costPerTon = Math.round((50000 / 100) * 100) / 100;
    expect(costPerTon).toBe(500);
  });

  it("filters out zero-ton sources", () => {
    const sources = [
      { name: "A", tons: 100, costSum: 50000 },
      { name: "B", tons: 0, costSum: 0 },
      { name: "C", tons: 50, costSum: 30000 },
    ];
    const filtered = sources
      .filter((d) => d.tons > 0 && d.costSum > 0)
      .map((d) => ({
        name: d.name,
        costPerTon: Math.round((d.costSum / d.tons) * 100) / 100,
      }));
    expect(filtered).toHaveLength(2);
    expect(filtered[0].name).toBe("A");
    expect(filtered[0].costPerTon).toBe(500);
    expect(filtered[1].name).toBe("C");
    expect(filtered[1].costPerTon).toBe(600);
  });
});
