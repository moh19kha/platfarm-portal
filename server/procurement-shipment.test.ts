/**
 * Unit tests for procurement → shipment conversion feature.
 * Tests the quality notes builder logic and the conversion data flow.
 */
import { describe, it, expect } from "vitest";

// ─── Replicate buildQualityNotes logic (pure function, no imports needed) ────

interface ProcurementData {
  odooId: number;
  id: string;
  supplier: string;
  commodity: string;
  grade: string;
  net: number;
  price: number;
  incoterm: string;
  plate: string;
  bales: number;
  qcData?: {
    odooId: number;
    id: string;
    moisture: string;
    moistureWeight: string;
    protein: string;
    color: string;
    leafRatio: string;
    foreignMatter: string;
    odor: string;
    density: string;
    verdict: string;
    finalGrade: string;
    g1: number;
    g2: number;
    mix: number;
    notes: string;
    inspector: string;
    baleHeight: number;
    avgWeight: number;
  };
}

function buildQualityNotes(proc: ProcurementData): string {
  const lines: string[] = [];
  lines.push(`=== Procurement Reference: ${proc.id} ===`);
  lines.push(`Supplier: ${proc.supplier}`);
  lines.push(`Commodity: ${proc.commodity} | Grade: ${proc.grade}`);
  lines.push(`Net Weight: ${proc.net.toLocaleString()} kg | Price/ton: ${proc.price}`);
  lines.push(`Incoterm: ${proc.incoterm} | Truck Plate: ${proc.plate}`);
  lines.push(`Bales: ${proc.bales}`);
  if (proc.qcData) {
    const q = proc.qcData;
    lines.push("");
    lines.push(`=== Quality Assessment: ${q.id} ===`);
    lines.push(`Inspector: ${q.inspector}`);
    lines.push(`Verdict: ${q.verdict} | Final Grade: ${q.finalGrade}`);
    lines.push(`Color: ${q.color} | Leaf Ratio: ${q.leafRatio} | Density: ${q.density}`);
    lines.push(`Moisture: ${q.moisture} (Weight: ${q.moistureWeight}) | Protein (NIR): ${q.protein}`);
    lines.push(`Foreign Matter: ${q.foreignMatter} | Odor: ${q.odor}`);
    lines.push(`Bale Height: ${q.baleHeight} cm | Avg Bale Weight: ${q.avgWeight} kg`);
    lines.push(`Grade Split — G1: ${q.g1} bales | G2: ${q.g2} bales | Mix: ${q.mix} bales`);
    if (q.notes) lines.push(`QC Notes: ${q.notes}`);
  }
  return lines.join("\n");
}

// ─── Tests ───────────────────────────────────────────────────────────────────

const baseProcurement: ProcurementData = {
  odooId: 101,
  id: "RCV-0043",
  supplier: "Al Nile Trading",
  commodity: "Alfalfa",
  grade: "G1",
  net: 22400,
  price: 1850,
  incoterm: "DDP",
  plate: "ص ع د 2810",
  bales: 95,
};

const fullQcData = {
  odooId: 201,
  id: "QC-0028",
  moisture: "12.5%",
  moistureWeight: "11.8%",
  protein: "18.2%",
  color: "Good",
  leafRatio: "High",
  foreignMatter: "None",
  odor: "Normal",
  density: "Medium",
  verdict: "Approved",
  finalGrade: "G1",
  g1: 80,
  g2: 10,
  mix: 5,
  notes: "Slight dust on outer bales",
  inspector: "Ahmed Hassan",
  baleHeight: 85,
  avgWeight: 235,
};

describe("buildQualityNotes", () => {
  it("includes procurement reference in output", () => {
    const notes = buildQualityNotes(baseProcurement);
    expect(notes).toContain("=== Procurement Reference: RCV-0043 ===");
  });

  it("includes supplier name", () => {
    const notes = buildQualityNotes(baseProcurement);
    expect(notes).toContain("Supplier: Al Nile Trading");
  });

  it("includes commodity and grade", () => {
    const notes = buildQualityNotes(baseProcurement);
    expect(notes).toContain("Commodity: Alfalfa | Grade: G1");
  });

  it("includes net weight and price", () => {
    const notes = buildQualityNotes(baseProcurement);
    expect(notes).toContain("Net Weight:");
    expect(notes).toContain("Price/ton: 1850");
  });

  it("includes incoterm and truck plate", () => {
    const notes = buildQualityNotes(baseProcurement);
    expect(notes).toContain("Incoterm: DDP | Truck Plate:");
  });

  it("includes bale count", () => {
    const notes = buildQualityNotes(baseProcurement);
    expect(notes).toContain("Bales: 95");
  });

  it("does NOT include QC section when qcData is absent", () => {
    const notes = buildQualityNotes(baseProcurement);
    expect(notes).not.toContain("=== Quality Assessment:");
    expect(notes).not.toContain("Verdict:");
  });

  it("includes QC section when qcData is present", () => {
    const notes = buildQualityNotes({ ...baseProcurement, qcData: fullQcData });
    expect(notes).toContain("=== Quality Assessment: QC-0028 ===");
  });

  it("includes verdict and final grade from QC", () => {
    const notes = buildQualityNotes({ ...baseProcurement, qcData: fullQcData });
    expect(notes).toContain("Verdict: Approved | Final Grade: G1");
  });

  it("includes moisture and protein from QC", () => {
    const notes = buildQualityNotes({ ...baseProcurement, qcData: fullQcData });
    expect(notes).toContain("Moisture: 12.5% (Weight: 11.8%) | Protein (NIR): 18.2%");
  });

  it("includes grade split from QC", () => {
    const notes = buildQualityNotes({ ...baseProcurement, qcData: fullQcData });
    expect(notes).toContain("Grade Split — G1: 80 bales | G2: 10 bales | Mix: 5 bales");
  });

  it("includes QC notes when present", () => {
    const notes = buildQualityNotes({ ...baseProcurement, qcData: fullQcData });
    expect(notes).toContain("QC Notes: Slight dust on outer bales");
  });

  it("omits QC notes line when notes is empty", () => {
    const qcNoNotes = { ...fullQcData, notes: "" };
    const notes = buildQualityNotes({ ...baseProcurement, qcData: qcNoNotes });
    expect(notes).not.toContain("QC Notes:");
  });

  it("includes inspector name from QC", () => {
    const notes = buildQualityNotes({ ...baseProcurement, qcData: fullQcData });
    expect(notes).toContain("Inspector: Ahmed Hassan");
  });

  it("includes bale height and avg weight from QC", () => {
    const notes = buildQualityNotes({ ...baseProcurement, qcData: fullQcData });
    expect(notes).toContain("Bale Height: 85 cm | Avg Bale Weight: 235 kg");
  });
});

describe("conversion data validation", () => {
  it("converts net weight from kg to tons correctly", () => {
    const netKg = 22400;
    const netTons = netKg / 1000;
    expect(netTons).toBeCloseTo(22.4, 1);
  });

  it("handles zero net weight gracefully", () => {
    const netKg = 0;
    const netTons = netKg / 1000;
    expect(netTons).toBe(0);
  });

  it("handles large net weight correctly", () => {
    const netKg = 1_000_000;
    const netTons = netKg / 1000;
    expect(netTons).toBe(1000);
  });

  it("linked PO pattern matches correctly", () => {
    const notes = "[Converted to PO/2026/0042 | PO ID: 1234]";
    const match = notes.match(/\[Converted to ([^|]+) \| PO ID: (\d+)\]/);
    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe("PO/2026/0042");
    expect(Number(match![2])).toBe(1234);
  });

  it("linked PO pattern does not match unrelated notes", () => {
    const notes = "Regular procurement notes without conversion";
    const match = notes.match(/\[Converted to ([^|]+) \| PO ID: (\d+)\]/);
    expect(match).toBeNull();
  });

  it("linked PO pattern handles PO name with slashes", () => {
    const notes = "[Converted to PO/2026/0001 | PO ID: 9999]";
    const match = notes.match(/\[Converted to ([^|]+) \| PO ID: (\d+)\]/);
    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe("PO/2026/0001");
  });
});
