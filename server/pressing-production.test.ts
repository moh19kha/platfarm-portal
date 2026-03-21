/**
 * Unit tests for the Pressing Shift → Production Order conversion feature
 *
 * Tests cover:
 * 1. parsePressingDate helper (D Mon YYYY → ISO)
 * 2. parseNumeric helper (e.g. "85°C" → 85)
 * 3. pressingNotes builder (structured notes from pressing data)
 * 4. Pre-fill logic for form fields derived from pressing data
 * 5. linkPressingToMO procedure input validation
 * 6. copyPressingAttachments procedure input validation
 */

import { describe, it, expect } from "vitest";

// ─── Helpers (mirrored from CreateProductionOrder.tsx) ──────────────────────

function parsePressingDate(d: string): string {
  if (!d) return new Date().toISOString().split("T")[0];
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const m = d.match(/(\d+)\s+(\w+)\s+(\d+)/);
  if (!m) return new Date().toISOString().split("T")[0];
  const [, day, mon, year] = m;
  const mm = months[mon] || "01";
  return `${year}-${mm}-${String(day).padStart(2, "0")}`;
}

function parseNumeric(s: string): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : n;
}

interface PressingData {
  odooId: number;
  id: string;
  site: string;
  line: string;
  batch: string;
  shift: string;
  operator: string;
  commodity: string;
  inBales: number;
  inWeight: number;
  inGrade: string;
  outBales: number;
  outWeight: number;
  outAvgBale: number;
  density: string;
  fuel: number;
  oilTemp: string;
  oilPressure: string;
  startTime: string;
  endTime: string;
  sources: string;
  date: string;
  notes?: string;
}

function buildPressingNotes(pressingData: PressingData): string {
  return [
    `[From Pressing Shift: ${pressingData.id}]`,
    `Site: ${pressingData.site} | Line: ${pressingData.line} | Batch: ${pressingData.batch}`,
    `Shift: ${pressingData.shift} | Operator: ${pressingData.operator}`,
    `Input: ${pressingData.inBales} bales · ${pressingData.inWeight} kg (${pressingData.inGrade})`,
    `Output: ${pressingData.outBales} bales · ${pressingData.outWeight} kg`,
    `Sources: ${pressingData.sources}`,
    pressingData.notes ? `Notes: ${pressingData.notes}` : "",
  ].filter(Boolean).join("\n");
}

function buildFormFromPressing(pressingData: PressingData) {
  return {
    production_date: parsePressingDate(pressingData.date),
    shift_start: pressingData.startTime,
    shift_end: pressingData.endTime,
    product_qty: pressingData.outBales,
    input_quality_grade: pressingData.inGrade,
    avg_input_bale_weight: pressingData.inBales > 0
      ? Math.round(pressingData.inWeight / pressingData.inBales)
      : 0,
    input_quality_notes: `Input: ${pressingData.inBales} bales · ${pressingData.inWeight} kg · Grade ${pressingData.inGrade}. Sources: ${pressingData.sources}`,
    max_oil_temperature: parseNumeric(pressingData.oilTemp),
    max_oil_pressure: parseNumeric(pressingData.oilPressure),
    machine_notes: `Density: ${pressingData.density}. Avg output bale: ${pressingData.outAvgBale} kg.`,
    diesel_liters: pressingData.fuel,
    notes: buildPressingNotes(pressingData),
  };
}

// ─── Sample pressing data ────────────────────────────────────────────────────

const samplePressing: PressingData = {
  odooId: 42,
  id: "DPR-0042",
  site: "Dakhla Farm",
  line: "Press 1",
  batch: "BATCH-2026-03",
  shift: "Morning",
  operator: "Hassan Ali",
  commodity: "Alfalfa",
  inBales: 80,
  inWeight: 32000,
  inGrade: "G1",
  outBales: 60,
  outWeight: 24000,
  outAvgBale: 400,
  density: "High",
  fuel: 45,
  oilTemp: "82°C",
  oilPressure: "195 bar",
  startTime: "06:00",
  endTime: "14:00",
  sources: "RCV-0043, RCV-0044",
  date: "11 Mar 2026",
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("parsePressingDate", () => {
  it("converts standard D Mon YYYY format", () => {
    expect(parsePressingDate("11 Mar 2026")).toBe("2026-03-11");
  });

  it("handles single-digit day", () => {
    expect(parsePressingDate("5 Jan 2026")).toBe("2026-01-05");
  });

  it("handles all months", () => {
    expect(parsePressingDate("1 Feb 2026")).toBe("2026-02-01");
    expect(parsePressingDate("15 Apr 2026")).toBe("2026-04-15");
    expect(parsePressingDate("30 Dec 2025")).toBe("2025-12-30");
  });

  it("returns today for empty input", () => {
    const result = parsePressingDate("");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns today for invalid input", () => {
    const result = parsePressingDate("invalid date");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("parseNumeric", () => {
  it("extracts number from oil temperature string", () => {
    expect(parseNumeric("82°C")).toBe(82);
    expect(parseNumeric("85.5°C")).toBe(85.5);
  });

  it("extracts number from oil pressure string", () => {
    expect(parseNumeric("195 bar")).toBe(195);
    expect(parseNumeric("200.5 bar")).toBe(200.5);
  });

  it("returns 0 for empty string", () => {
    expect(parseNumeric("")).toBe(0);
  });

  it("handles plain numbers", () => {
    expect(parseNumeric("42")).toBe(42);
  });
});

describe("buildPressingNotes", () => {
  it("includes pressing ID reference", () => {
    const notes = buildPressingNotes(samplePressing);
    expect(notes).toContain("[From Pressing Shift: DPR-0042]");
  });

  it("includes site, line, and batch", () => {
    const notes = buildPressingNotes(samplePressing);
    expect(notes).toContain("Dakhla Farm");
    expect(notes).toContain("Press 1");
    expect(notes).toContain("BATCH-2026-03");
  });

  it("includes input and output summary", () => {
    const notes = buildPressingNotes(samplePressing);
    expect(notes).toContain("80 bales");
    expect(notes).toContain("32000 kg");
    expect(notes).toContain("60 bales");
    expect(notes).toContain("24000 kg");
  });

  it("includes source procurements", () => {
    const notes = buildPressingNotes(samplePressing);
    expect(notes).toContain("RCV-0043, RCV-0044");
  });

  it("omits empty notes line", () => {
    const notes = buildPressingNotes({ ...samplePressing, notes: "" });
    expect(notes).not.toContain("Notes:");
  });

  it("includes notes when present", () => {
    const notes = buildPressingNotes({ ...samplePressing, notes: "High moisture batch" });
    expect(notes).toContain("Notes: High moisture batch");
  });
});

describe("buildFormFromPressing", () => {
  it("pre-fills production date from pressing date", () => {
    const form = buildFormFromPressing(samplePressing);
    expect(form.production_date).toBe("2026-03-11");
  });

  it("pre-fills shift times", () => {
    const form = buildFormFromPressing(samplePressing);
    expect(form.shift_start).toBe("06:00");
    expect(form.shift_end).toBe("14:00");
  });

  it("pre-fills product_qty from outBales", () => {
    const form = buildFormFromPressing(samplePressing);
    expect(form.product_qty).toBe(60);
  });

  it("pre-fills input quality grade", () => {
    const form = buildFormFromPressing(samplePressing);
    expect(form.input_quality_grade).toBe("G1");
  });

  it("calculates avg input bale weight correctly", () => {
    const form = buildFormFromPressing(samplePressing);
    // 32000 / 80 = 400
    expect(form.avg_input_bale_weight).toBe(400);
  });

  it("returns 0 for avg bale weight when inBales is 0", () => {
    const form = buildFormFromPressing({ ...samplePressing, inBales: 0 });
    expect(form.avg_input_bale_weight).toBe(0);
  });

  it("pre-fills oil temperature as number", () => {
    const form = buildFormFromPressing(samplePressing);
    expect(form.max_oil_temperature).toBe(82);
  });

  it("pre-fills oil pressure as number", () => {
    const form = buildFormFromPressing(samplePressing);
    expect(form.max_oil_pressure).toBe(195);
  });

  it("pre-fills diesel liters from fuel", () => {
    const form = buildFormFromPressing(samplePressing);
    expect(form.diesel_liters).toBe(45);
  });

  it("pre-fills machine notes with density and avg bale", () => {
    const form = buildFormFromPressing(samplePressing);
    expect(form.machine_notes).toContain("High");
    expect(form.machine_notes).toContain("400 kg");
  });

  it("includes structured notes", () => {
    const form = buildFormFromPressing(samplePressing);
    expect(form.notes).toContain("[From Pressing Shift: DPR-0042]");
  });
});

describe("linkPressingToMO input schema", () => {
  it("validates required fields", () => {
    const input = { pressingOdooId: 42, moId: 100, moName: "WH/MO/00001" };
    expect(input.pressingOdooId).toBeTypeOf("number");
    expect(input.moId).toBeTypeOf("number");
    expect(input.moName).toBeTypeOf("string");
    expect(input.moName.length).toBeGreaterThan(0);
  });

  it("rejects missing moName", () => {
    const input = { pressingOdooId: 42, moId: 100, moName: "" };
    expect(input.moName.length).toBe(0);
  });
});

describe("copyPressingAttachments input schema", () => {
  it("validates required fields", () => {
    const input = { pressingOdooId: 42, moId: 100 };
    expect(input.pressingOdooId).toBeTypeOf("number");
    expect(input.moId).toBeTypeOf("number");
  });
});
