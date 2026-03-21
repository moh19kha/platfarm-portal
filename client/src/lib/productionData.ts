// ══════════════════════════════════════════════════════════════════════════════
// PLATFARM — DOUBLE PRESSING PRODUCTION MODULE — DATA & CONSTANTS
// Manufacturing Order = One Production Shift on the baling machine
// Single Press bales (raw) → Double Press bales (dense, export-quality)
// ══════════════════════════════════════════════════════════════════════════════

import { C } from "./data";

// ─── MO WORKFLOW STAGES ───────────────────────────────────────────────────
export const MO_STAGES = [
  { id: "draft", label: "Draft" },
  { id: "confirmed", label: "Confirmed" },
  { id: "progress", label: "In Progress" },
  { id: "to_close", label: "To Close" },
  { id: "done", label: "Done" },
  { id: "cancel", label: "Cancelled" },
];

export const moStgBdg = (id: string): string => ({
  draft: "default", confirmed: "sage", progress: "terra",
  to_close: "amber", done: "green", cancel: "red",
} as Record<string, string>)[id] || "default";

export const moStgClr = (id: string): string => ({
  draft: C.muted, confirmed: C.sage, progress: C.terra,
  to_close: C.amber, done: C.forest, cancel: C.red,
} as Record<string, string>)[id] || C.muted;

// ─── INPUT MATERIAL SOURCES ──────────────────────────────────────────────
export const INPUT_SOURCES = ["Dakhla", "Farafrah", "Owainat", "Toshka", "Others"];

// ─── QUALITY GRADES ──────────────────────────────────────────────────────
export const INPUT_QUALITY_GRADES = [
  { id: "premium", label: "Premium" },
  { id: "grade_1", label: "Grade 1" },
  { id: "fair", label: "Fair" },
  { id: "alfamix", label: "AlfaMix" },
  { id: "straw", label: "Straw" },
];

export const OUTPUT_QUALITY_GRADES = [
  "Supreme", "Premium", "Grade 1", "Fair", "Grade 3", "AlfaMix", "MixGrass", "Wheat Straw",
];

// ─── EQUIPMENT FAILURE REASONS ───────────────────────────────────────────
export const EQUIPMENT_FAILURE_REASONS = [
  { id: "no_problem", label: "No Problem" },
  { id: "belt_problem", label: "Belt Problem" },
  { id: "hydraulic_issue", label: "Hydraulic Issue" },
  { id: "mechanical_issue", label: "Mechanical Issue" },
  { id: "diesel_shortage", label: "Diesel Shortage" },
  { id: "generator_problem", label: "Generator Problem" },
];

// ─── EMPLOYEE ROLES ──────────────────────────────────────────────────────
export const EMPLOYEE_ROLES = [
  { id: "supervisor", label: "Supervisor", icon: "◈", color: C.forest },
  { id: "quality_supervisor", label: "Quality Supervisor", icon: "✦", color: C.sage },
  { id: "production_labor", label: "Production Labor", icon: "⚙", color: C.terra },
  { id: "quality_labor", label: "Quality Labor", icon: "◎", color: C.blue },
  { id: "driver", label: "Driver", icon: "↔", color: C.amber },
  { id: "loading_driver", label: "Loading Driver", icon: "↑", color: C.gray },
  { id: "labor", label: "General Labor", icon: "●", color: C.muted },
];

// ─── PRODUCT CATALOGS ────────────────────────────────────────────────────
export const FINISHED_PRODUCTS = [
  { id: "DP-G1-AM-350", name: "Double Press, Grade 1 American SunCured Alfalfa, 350-375 Kg", weight: "350–375 kg", height: "85 cm" },
  { id: "DP-G1-EG-350", name: "Double Press, Grade 1 Egyptian SunCured Alfalfa, 350-375 Kg", weight: "350–375 kg", height: "85 cm" },
  { id: "DP-G1-EG-400", name: "Double Press, Grade 1 Egyptian SunCured Alfalfa, 400-425 Kg", weight: "400–425 kg", height: "85 cm" },
  { id: "DP-G1-RG-425", name: "Double Press, Grade 1 Egyptian SunCured Rhodes Grass, 425-450 Kg", weight: "425–450 kg", height: "85 cm" },
  { id: "DP-G3-EG-400", name: "Double Press, Grade 3 Egyptian SunCured Alfalfa, 400-425 Kg", weight: "400–425 kg", height: "85 cm" },
  { id: "DP-G3-WS-400", name: "Double Press, Grade 3 Egyptian SunCured Alfalfa+WheatStraw, 400-425 Kg", weight: "400–425 kg", height: "85 cm" },
  { id: "DP-STD-EG-325", name: "Double Press, Standard Egyptian SunCured Alfalfa, 325-350 Kg", weight: "325–350 kg", height: "80 cm" },
  { id: "DP-STD-EG-350", name: "Double Press, Standard Egyptian SunCured Alfalfa, 350-375 Kg", weight: "350–375 kg", height: "85 cm" },
  { id: "DP-STD-EG-375", name: "Double Press, Standard Egyptian SunCured Alfalfa, 375-400 Kg", weight: "375–400 kg", height: "85 cm" },
  { id: "DP-STD-EG-400", name: "Double Press, Standard Egyptian SunCured Alfalfa, 400-425 Kg", weight: "400–425 kg", height: "85 cm" },
  { id: "DP-STD-EG-425", name: "Double Press, Standard Egyptian SunCured Alfalfa, 425-450 Kg", weight: "425–450 kg", height: "85 cm" },
  { id: "DP-STD-EG-450", name: "Double Press, Standard Egyptian SunCured Alfalfa, 450-475 Kg", weight: "450–475 kg", height: "85 cm" },
  { id: "DP-STD-RG-400", name: "Double Press, Standard Egyptian SunCured Alfalfa+RhodesGrass, 400-425 Kg", weight: "400–425 kg", height: "85 cm" },
  { id: "DP-STD-WS-400", name: "Double Press, Standard Egyptian SunCured Alfalfa+WheatStraw, 400-425 Kg", weight: "400–425 kg", height: "85 cm" },
];

export const RAW_MATERIALS = [
  { id: "SP-G1-375", name: "Single Press, Grade 1 Egyptian SunCured Alfalfa, 375-400 Kg", weight: "375–400 kg", height: "70 cm" },
  { id: "SP-G1-400", name: "Single Press, Grade 1 Egyptian SunCured Alfalfa, 400-425 Kg", weight: "400–425 kg", height: "70 cm" },
  { id: "SP-G1-425", name: "Single Press, Grade 1 Egyptian SunCured Alfalfa, 425-450 Kg", weight: "425–450 kg", height: "70 cm" },
  { id: "SP-STD-SM", name: "Single Press, Standard Egyptian SunCured Alfalfa, 18-22 Kg (small bales)", weight: "18–22 kg", height: "35 cm" },
  { id: "SP-STD-375", name: "Single Press, Standard Egyptian SunCured Alfalfa, 375-400 Kg", weight: "375–400 kg", height: "70 cm" },
  { id: "SP-STD-400", name: "Single Press, Standard Egyptian SunCured Alfalfa, 400-425 Kg", weight: "400–425 kg", height: "70 cm" },
  { id: "SP-FODDER", name: "Animal Fodder Alfalfa Hay Bales", weight: "Varies", height: "—" },
];

export const CONSUMABLES = [
  { id: "SLEEVE", name: "Sleeve Bags", uom: "Units" },
  { id: "STRAP", name: "Strapping Units", uom: "Units" },
];

// ─── TYPES ───────────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  initials: string;
}

export interface StockMove {
  id: string;
  direction: "input" | "output";
  product: string;
  productId: string;
  plannedQty: number;
  actualQty: number;
  uom: string;
  state: string;
}

export interface OutputBaleCount {
  supreme: number;
  premium: number;
  grade1: number;
  fair: number;
  grade3: number;
  alfamix: number;
  mixGrass: number;
  wheatStraw: number;
}

export interface InputQuality {
  avgBaleWeightKg: number;
  containsGrasses: boolean;
  grassPercentage: number;
  containsHighMoisture: boolean;
  highMoistureBigBales: number;
  highMoistureSmallBalesTons: number;
  qualityGrade: string;
  observations: string;
}

export interface DieselConsumption {
  dieselLiters: number;
  sleeveBagsUsed: number;
  strappingUnitsUsed: number;
  notes: string;
}

export interface MachineMonitoring {
  oilMeasurements: number;
  maxOilTemperature: number;
  maxOilPressure: number;
  equipmentFailure: boolean;
  failureReason: string;
  notes: string;
}

export interface ProductionActivity {
  date: string;
  time: string;
  user: string;
  action: string;
}

export interface ManufacturingOrder {
  id: string;
  name: string;
  state: string;
  priority: "normal" | "urgent";

  // Output product
  outputProduct: string;
  outputProductId: string;
  targetQtyKg: number;
  actualProducedKg: number;

  // Dates
  productionDate: string;
  dateStart: string;
  dateFinished: string;
  shiftStartTime: string;
  shiftEndTime: string;
  actualProductionHours: number;
  downTimeMinutes: number;

  // Source
  inputSource: string;

  // Employees
  supervisors: Employee[];
  qualitySupervisors: Employee[];
  productionLabors: Employee[];
  qualityLabors: Employee[];
  drivers: Employee[];
  loadingDrivers: Employee[];
  generalLabors: Employee[];
  facilityManagerAttended: boolean;

  // Stock moves
  inputMoves: StockMove[];
  outputMoves: StockMove[];

  // Quality
  inputQuality: InputQuality;
  outputBales: OutputBaleCount;
  outputQualityObservations: string;

  // Diesel & Materials
  diesel: DieselConsumption;

  // Machine Monitoring
  machine: MachineMonitoring;

  // Documents & Notes
  generalNotes: string;
  qualityNotes: string;
  supportingDocUploaded: boolean;
  qualityFormUploaded: boolean;
  outputQualityFormUploaded: boolean;
  machineFormUploaded: boolean;

  // Activity log
  activity: ProductionActivity[];

  // Incentive
  incentiveCancelled: boolean;
  incentiveCancelReason: string;
}

// ─── EMPLOYEE SEED DATA ──────────────────────────────────────────────────
export const EMPLOYEES: Employee[] = [
  { id: "E-493", name: "Mohamed Blal", role: "supervisor", department: "Production", initials: "MB" },
  { id: "E-502", name: "Ahmed Yousef", role: "supervisor", department: "Production", initials: "AY" },
  { id: "E-510", name: "Magdy Abdul Ghani", role: "production_labor", department: "Production", initials: "MA" },
  { id: "E-515", name: "Housam Sebaq", role: "production_labor", department: "Production", initials: "HS" },
  { id: "E-520", name: "Mohamed Murad", role: "driver", department: "Logistics", initials: "MM" },
  { id: "E-525", name: "Mahmoud Abdul Hakem", role: "driver", department: "Logistics", initials: "MH" },
  { id: "E-530", name: "Adam Mohamed", role: "quality_labor", department: "Quality", initials: "AM" },
  { id: "E-535", name: "Ibrahim Hassan", role: "quality_supervisor", department: "Quality", initials: "IH" },
  { id: "E-540", name: "Youssef Said", role: "loading_driver", department: "Logistics", initials: "YS" },
  { id: "E-545", name: "Hassan Omar", role: "production_labor", department: "Production", initials: "HO" },
  { id: "E-550", name: "Ali Mahmoud", role: "labor", department: "Production", initials: "AL" },
  { id: "E-555", name: "Khaled Farouk", role: "supervisor", department: "Production", initials: "KF" },
  { id: "E-560", name: "Tarek Nabil", role: "driver", department: "Logistics", initials: "TN" },
  { id: "E-565", name: "Samir Adel", role: "quality_labor", department: "Quality", initials: "SA" },
];

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────
export const totalOutputBales = (b: OutputBaleCount): number =>
  b.supreme + b.premium + b.grade1 + b.fair + b.grade3 + b.alfamix + b.mixGrass + b.wheatStraw;

export const totalInputKg = (moves: StockMove[]): number =>
  moves.filter(m => m.direction === "input" && m.uom === "kg").reduce((s, m) => s + m.actualQty, 0);

export const totalOutputKg = (moves: StockMove[]): number =>
  moves.filter(m => m.direction === "output" && m.uom === "kg").reduce((s, m) => s + m.actualQty, 0);

export const kgToTons = (kg: number): number => +(kg / 1000).toFixed(2);

export const fmtKg = (n: number): string => Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) + " kg";

export const fmtTons = (n: number): string => kgToTons(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " T";

export const fmtHours = (h: number): string => {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
};

export const shortProduct = (name: string): string => {
  // "Double Press, Standard Egyptian SunCured Alfalfa, 400-425 Kg" → "Std Alfalfa 400-425"
  const n = name.replace("Double Press, ", "").replace("Single Press, ", "");
  return n.length > 35 ? n.slice(0, 33) + "…" : n;
};

export const gradeLabel = (id: string): string =>
  INPUT_QUALITY_GRADES.find(g => g.id === id)?.label || id;

export const failureLabel = (id: string): string =>
  EQUIPMENT_FAILURE_REASONS.find(r => r.id === id)?.label || id;

// ─── SEED DATA: MANUFACTURING ORDERS ─────────────────────────────────────

function mkEmployee(id: string): Employee {
  return EMPLOYEES.find(e => e.id === id) || { id, name: "Unknown", role: "labor", department: "—", initials: "??" };
}

export function buildProductionSeed(): ManufacturingOrder[] {
  const mos: ManufacturingOrder[] = [
    // MO-001: Done — full shift, Dakhla source, Grade 1 output
    {
      id: "MO-288", name: "WH/MO/00288", state: "done", priority: "normal",
      outputProduct: "Double Press, Standard Egyptian SunCured Alfalfa, 400-425 Kg",
      outputProductId: "DP-STD-EG-400",
      targetQtyKg: 24000, actualProducedKg: 38075,
      productionDate: "2026-03-07", dateStart: "2026-03-07 06:00:00", dateFinished: "2026-03-07 14:30:00",
      shiftStartTime: "2026-03-07 06:00:00", shiftEndTime: "2026-03-07 14:30:00",
      actualProductionHours: 7.5, downTimeMinutes: 30,
      inputSource: "Dakhla",
      supervisors: [mkEmployee("E-493"), mkEmployee("E-502")],
      qualitySupervisors: [mkEmployee("E-535")],
      productionLabors: [mkEmployee("E-510"), mkEmployee("E-515")],
      qualityLabors: [mkEmployee("E-530")],
      drivers: [mkEmployee("E-493"), mkEmployee("E-520"), mkEmployee("E-525")],
      loadingDrivers: [mkEmployee("E-540")],
      generalLabors: [mkEmployee("E-550")],
      facilityManagerAttended: true,
      inputMoves: [
        { id: "SM-601", direction: "input", product: "Single Press, Standard Egyptian SunCured Alfalfa, 400-425 Kg", productId: "SP-STD-400", plannedQty: 24000, actualQty: 35170, uom: "kg", state: "done" },
        { id: "SM-602", direction: "input", product: "Single Press, Grade 1 Egyptian SunCured Alfalfa, 375-400 Kg", productId: "SP-G1-375", plannedQty: 0, actualQty: 2394, uom: "kg", state: "done" },
        { id: "SM-603", direction: "input", product: "Single Press, Grade 1 Egyptian SunCured Alfalfa, 425-450 Kg", productId: "SP-G1-425", plannedQty: 0, actualQty: 511, uom: "kg", state: "done" },
        { id: "SM-604", direction: "input", product: "Sleeve Bags", productId: "SLEEVE", plannedQty: 0, actualQty: 92, uom: "units", state: "done" },
      ],
      outputMoves: [
        { id: "SM-605", direction: "output", product: "Double Press, Standard Egyptian SunCured Alfalfa, 400-425 Kg", productId: "DP-STD-EG-400", plannedQty: 24000, actualQty: 38075, uom: "kg", state: "done" },
      ],
      inputQuality: {
        avgBaleWeightKg: 400, containsGrasses: false, grassPercentage: 0,
        containsHighMoisture: false, highMoistureBigBales: 0, highMoistureSmallBalesTons: 0,
        qualityGrade: "grade_1", observations: "Clean input, consistent bale sizes from Dakhla farm.",
      },
      outputBales: { supreme: 0, premium: 12, grade1: 60, fair: 18, grade3: 2, alfamix: 0, mixGrass: 0, wheatStraw: 0 },
      outputQualityObservations: "Good compression ratio. Premium bales from top of stack.",
      diesel: { dieselLiters: 65, sleeveBagsUsed: 92, strappingUnitsUsed: 0, notes: "" },
      machine: { oilMeasurements: 8, maxOilTemperature: 45, maxOilPressure: 55, equipmentFailure: false, failureReason: "no_problem", notes: "Smooth operation throughout shift." },
      generalNotes: "Full shift, no major issues. Output exceeded target by 58%.",
      qualityNotes: "All quality checks passed. No moisture issues detected.",
      supportingDocUploaded: true, qualityFormUploaded: true, outputQualityFormUploaded: true, machineFormUploaded: true,
      activity: [
        { date: "2026-03-07", time: "05:45 AM", user: "Mohamed Blal", action: "Manufacturing Order created" },
        { date: "2026-03-07", time: "06:00 AM", user: "Mohamed Blal", action: "Production started — shift began" },
        { date: "2026-03-07", time: "06:15 AM", user: "Ibrahim Hassan", action: "Input quality inspection completed" },
        { date: "2026-03-07", time: "10:30 AM", user: "Mohamed Blal", action: "30 min downtime — belt adjustment" },
        { date: "2026-03-07", time: "02:30 PM", user: "Mohamed Blal", action: "Production completed — 38,075 kg produced" },
        { date: "2026-03-07", time: "03:00 PM", user: "Ahmed Yousef", action: "Stage → Done" },
      ],
      incentiveCancelled: false, incentiveCancelReason: "",
    },

    // MO-002: Done — night shift, Farafrah source, equipment failure
    {
      id: "MO-287", name: "WH/MO/00287", state: "done", priority: "normal",
      outputProduct: "Double Press, Grade 1 Egyptian SunCured Alfalfa, 400-425 Kg",
      outputProductId: "DP-G1-EG-400",
      targetQtyKg: 20000, actualProducedKg: 22450,
      productionDate: "2026-03-06", dateStart: "2026-03-06 18:00:00", dateFinished: "2026-03-07 02:00:00",
      shiftStartTime: "2026-03-06 18:00:00", shiftEndTime: "2026-03-07 02:00:00",
      actualProductionHours: 6.5, downTimeMinutes: 90,
      inputSource: "Farafrah",
      supervisors: [mkEmployee("E-555")],
      qualitySupervisors: [mkEmployee("E-535")],
      productionLabors: [mkEmployee("E-510"), mkEmployee("E-545")],
      qualityLabors: [mkEmployee("E-530"), mkEmployee("E-565")],
      drivers: [mkEmployee("E-520"), mkEmployee("E-560")],
      loadingDrivers: [],
      generalLabors: [mkEmployee("E-550")],
      facilityManagerAttended: false,
      inputMoves: [
        { id: "SM-611", direction: "input", product: "Single Press, Grade 1 Egyptian SunCured Alfalfa, 400-425 Kg", productId: "SP-G1-400", plannedQty: 20000, actualQty: 21800, uom: "kg", state: "done" },
        { id: "SM-612", direction: "input", product: "Single Press, Standard Egyptian SunCured Alfalfa, 375-400 Kg", productId: "SP-STD-375", plannedQty: 0, actualQty: 650, uom: "kg", state: "done" },
        { id: "SM-613", direction: "input", product: "Sleeve Bags", productId: "SLEEVE", plannedQty: 0, actualQty: 55, uom: "units", state: "done" },
      ],
      outputMoves: [
        { id: "SM-614", direction: "output", product: "Double Press, Grade 1 Egyptian SunCured Alfalfa, 400-425 Kg", productId: "DP-G1-EG-400", plannedQty: 20000, actualQty: 22450, uom: "kg", state: "done" },
      ],
      inputQuality: {
        avgBaleWeightKg: 410, containsGrasses: true, grassPercentage: 8,
        containsHighMoisture: true, highMoistureBigBales: 3, highMoistureSmallBalesTons: 0.5,
        qualityGrade: "grade_1", observations: "Some grass contamination from Farafrah batch. 3 bales with moisture >12%.",
      },
      outputBales: { supreme: 0, premium: 5, grade1: 42, fair: 8, grade3: 0, alfamix: 0, mixGrass: 0, wheatStraw: 0 },
      outputQualityObservations: "Slightly lower premium yield due to grass contamination in input.",
      diesel: { dieselLiters: 52, sleeveBagsUsed: 55, strappingUnitsUsed: 0, notes: "" },
      machine: { oilMeasurements: 6, maxOilTemperature: 52, maxOilPressure: 62, equipmentFailure: true, failureReason: "belt_problem", notes: "Belt slipped at 21:30, 90 min to repair. Oil temp spiked before failure." },
      generalNotes: "Night shift. Belt failure caused 90 min downtime. Repaired on-site.",
      qualityNotes: "Grass contamination noted in input. Output quality acceptable.",
      supportingDocUploaded: true, qualityFormUploaded: true, outputQualityFormUploaded: false, machineFormUploaded: true,
      activity: [
        { date: "2026-03-06", time: "05:30 PM", user: "Khaled Farouk", action: "Manufacturing Order created" },
        { date: "2026-03-06", time: "06:00 PM", user: "Khaled Farouk", action: "Night shift started" },
        { date: "2026-03-06", time: "09:30 PM", user: "Khaled Farouk", action: "Belt failure — production halted" },
        { date: "2026-03-06", time: "11:00 PM", user: "Khaled Farouk", action: "Belt repaired — production resumed" },
        { date: "2026-03-07", time: "02:00 AM", user: "Khaled Farouk", action: "Production completed — 22,450 kg" },
        { date: "2026-03-07", time: "02:30 AM", user: "Khaled Farouk", action: "Stage → Done" },
      ],
      incentiveCancelled: false, incentiveCancelReason: "",
    },

    // MO-003: In Progress — current shift
    {
      id: "MO-289", name: "WH/MO/00289", state: "progress", priority: "normal",
      outputProduct: "Double Press, Standard Egyptian SunCured Alfalfa+RhodesGrass, 400-425 Kg",
      outputProductId: "DP-STD-RG-400",
      targetQtyKg: 25000, actualProducedKg: 14200,
      productionDate: "2026-03-10", dateStart: "2026-03-10 06:00:00", dateFinished: "",
      shiftStartTime: "2026-03-10 06:00:00", shiftEndTime: "",
      actualProductionHours: 4.2, downTimeMinutes: 0,
      inputSource: "Owainat",
      supervisors: [mkEmployee("E-493")],
      qualitySupervisors: [mkEmployee("E-535")],
      productionLabors: [mkEmployee("E-510"), mkEmployee("E-515"), mkEmployee("E-545")],
      qualityLabors: [mkEmployee("E-530")],
      drivers: [mkEmployee("E-520"), mkEmployee("E-525")],
      loadingDrivers: [mkEmployee("E-540")],
      generalLabors: [],
      facilityManagerAttended: true,
      inputMoves: [
        { id: "SM-621", direction: "input", product: "Single Press, Standard Egyptian SunCured Alfalfa, 400-425 Kg", productId: "SP-STD-400", plannedQty: 25000, actualQty: 13800, uom: "kg", state: "assigned" },
        { id: "SM-622", direction: "input", product: "Sleeve Bags", productId: "SLEEVE", plannedQty: 0, actualQty: 35, uom: "units", state: "assigned" },
      ],
      outputMoves: [
        { id: "SM-623", direction: "output", product: "Double Press, Standard Egyptian SunCured Alfalfa+RhodesGrass, 400-425 Kg", productId: "DP-STD-RG-400", plannedQty: 25000, actualQty: 14200, uom: "kg", state: "assigned" },
      ],
      inputQuality: {
        avgBaleWeightKg: 395, containsGrasses: false, grassPercentage: 0,
        containsHighMoisture: false, highMoistureBigBales: 0, highMoistureSmallBalesTons: 0,
        qualityGrade: "grade_1", observations: "Good quality input from Owainat.",
      },
      outputBales: { supreme: 0, premium: 3, grade1: 28, fair: 4, grade3: 0, alfamix: 0, mixGrass: 0, wheatStraw: 0 },
      outputQualityObservations: "Production in progress — counts are partial.",
      diesel: { dieselLiters: 28, sleeveBagsUsed: 35, strappingUnitsUsed: 0, notes: "" },
      machine: { oilMeasurements: 4, maxOilTemperature: 42, maxOilPressure: 50, equipmentFailure: false, failureReason: "no_problem", notes: "" },
      generalNotes: "Morning shift in progress. Good pace.",
      qualityNotes: "",
      supportingDocUploaded: false, qualityFormUploaded: false, outputQualityFormUploaded: false, machineFormUploaded: false,
      activity: [
        { date: "2026-03-10", time: "05:45 AM", user: "Mohamed Blal", action: "Manufacturing Order created" },
        { date: "2026-03-10", time: "06:00 AM", user: "Mohamed Blal", action: "Production started" },
        { date: "2026-03-10", time: "06:20 AM", user: "Ibrahim Hassan", action: "Input quality check — Grade 1, no issues" },
      ],
      incentiveCancelled: false, incentiveCancelReason: "",
    },

    // MO-004: Confirmed — waiting to start
    {
      id: "MO-290", name: "WH/MO/00290", state: "confirmed", priority: "urgent",
      outputProduct: "Double Press, Grade 1 Egyptian SunCured Alfalfa, 350-375 Kg",
      outputProductId: "DP-G1-EG-350",
      targetQtyKg: 18000, actualProducedKg: 0,
      productionDate: "2026-03-10", dateStart: "2026-03-10 18:00:00", dateFinished: "",
      shiftStartTime: "", shiftEndTime: "",
      actualProductionHours: 0, downTimeMinutes: 0,
      inputSource: "Toshka",
      supervisors: [mkEmployee("E-502")],
      qualitySupervisors: [],
      productionLabors: [],
      qualityLabors: [],
      drivers: [],
      loadingDrivers: [],
      generalLabors: [],
      facilityManagerAttended: false,
      inputMoves: [
        { id: "SM-631", direction: "input", product: "Single Press, Grade 1 Egyptian SunCured Alfalfa, 375-400 Kg", productId: "SP-G1-375", plannedQty: 18000, actualQty: 0, uom: "kg", state: "confirmed" },
        { id: "SM-632", direction: "input", product: "Sleeve Bags", productId: "SLEEVE", plannedQty: 50, actualQty: 0, uom: "units", state: "confirmed" },
      ],
      outputMoves: [
        { id: "SM-633", direction: "output", product: "Double Press, Grade 1 Egyptian SunCured Alfalfa, 350-375 Kg", productId: "DP-G1-EG-350", plannedQty: 18000, actualQty: 0, uom: "kg", state: "confirmed" },
      ],
      inputQuality: {
        avgBaleWeightKg: 0, containsGrasses: false, grassPercentage: 0,
        containsHighMoisture: false, highMoistureBigBales: 0, highMoistureSmallBalesTons: 0,
        qualityGrade: "", observations: "",
      },
      outputBales: { supreme: 0, premium: 0, grade1: 0, fair: 0, grade3: 0, alfamix: 0, mixGrass: 0, wheatStraw: 0 },
      outputQualityObservations: "",
      diesel: { dieselLiters: 0, sleeveBagsUsed: 0, strappingUnitsUsed: 0, notes: "" },
      machine: { oilMeasurements: 0, maxOilTemperature: 0, maxOilPressure: 0, equipmentFailure: false, failureReason: "no_problem", notes: "" },
      generalNotes: "Night shift planned. Toshka Grade 1 material ready in warehouse.",
      qualityNotes: "",
      supportingDocUploaded: false, qualityFormUploaded: false, outputQualityFormUploaded: false, machineFormUploaded: false,
      activity: [
        { date: "2026-03-10", time: "08:00 AM", user: "Ahmed Yousef", action: "Manufacturing Order created" },
        { date: "2026-03-10", time: "08:05 AM", user: "Ahmed Yousef", action: "Stage → Confirmed" },
      ],
      incentiveCancelled: false, incentiveCancelReason: "",
    },

    // MO-005: Draft
    {
      id: "MO-291", name: "WH/MO/00291", state: "draft", priority: "normal",
      outputProduct: "Double Press, Standard Egyptian SunCured Alfalfa, 450-475 Kg",
      outputProductId: "DP-STD-EG-450",
      targetQtyKg: 30000, actualProducedKg: 0,
      productionDate: "2026-03-11", dateStart: "", dateFinished: "",
      shiftStartTime: "", shiftEndTime: "",
      actualProductionHours: 0, downTimeMinutes: 0,
      inputSource: "Dakhla",
      supervisors: [],
      qualitySupervisors: [],
      productionLabors: [],
      qualityLabors: [],
      drivers: [],
      loadingDrivers: [],
      generalLabors: [],
      facilityManagerAttended: false,
      inputMoves: [
        { id: "SM-641", direction: "input", product: "Single Press, Standard Egyptian SunCured Alfalfa, 400-425 Kg", productId: "SP-STD-400", plannedQty: 30000, actualQty: 0, uom: "kg", state: "draft" },
      ],
      outputMoves: [
        { id: "SM-642", direction: "output", product: "Double Press, Standard Egyptian SunCured Alfalfa, 450-475 Kg", productId: "DP-STD-EG-450", plannedQty: 30000, actualQty: 0, uom: "kg", state: "draft" },
      ],
      inputQuality: {
        avgBaleWeightKg: 0, containsGrasses: false, grassPercentage: 0,
        containsHighMoisture: false, highMoistureBigBales: 0, highMoistureSmallBalesTons: 0,
        qualityGrade: "", observations: "",
      },
      outputBales: { supreme: 0, premium: 0, grade1: 0, fair: 0, grade3: 0, alfamix: 0, mixGrass: 0, wheatStraw: 0 },
      outputQualityObservations: "",
      diesel: { dieselLiters: 0, sleeveBagsUsed: 0, strappingUnitsUsed: 0, notes: "" },
      machine: { oilMeasurements: 0, maxOilTemperature: 0, maxOilPressure: 0, equipmentFailure: false, failureReason: "no_problem", notes: "" },
      generalNotes: "",
      qualityNotes: "",
      supportingDocUploaded: false, qualityFormUploaded: false, outputQualityFormUploaded: false, machineFormUploaded: false,
      activity: [
        { date: "2026-03-10", time: "10:00 AM", user: "Ahmed Yousef", action: "Draft Manufacturing Order created" },
      ],
      incentiveCancelled: false, incentiveCancelReason: "",
    },

    // MO-006: Done — older, Owainat, with wheat straw output
    {
      id: "MO-285", name: "WH/MO/00285", state: "done", priority: "normal",
      outputProduct: "Double Press, Standard Egyptian SunCured Alfalfa, 400-425 Kg",
      outputProductId: "DP-STD-EG-400",
      targetQtyKg: 4458, actualProducedKg: 4458,
      productionDate: "2026-03-05", dateStart: "2026-03-05 11:30:00", dateFinished: "2026-03-05 15:00:00",
      shiftStartTime: "2026-03-05 11:30:00", shiftEndTime: "2026-03-05 15:00:00",
      actualProductionHours: 3.3, downTimeMinutes: 0,
      inputSource: "Dakhla",
      supervisors: [mkEmployee("E-493"), mkEmployee("E-502")],
      qualitySupervisors: [mkEmployee("E-535")],
      productionLabors: [mkEmployee("E-510"), mkEmployee("E-515")],
      qualityLabors: [mkEmployee("E-530")],
      drivers: [mkEmployee("E-493"), mkEmployee("E-520"), mkEmployee("E-525")],
      loadingDrivers: [],
      generalLabors: [],
      facilityManagerAttended: false,
      inputMoves: [
        { id: "SM-651", direction: "input", product: "Single Press, Standard Egyptian SunCured Alfalfa, 18-22 Kg (small bales)", productId: "SP-STD-SM", plannedQty: 4458, actualQty: 4458, uom: "kg", state: "done" },
        { id: "SM-652", direction: "input", product: "Sleeve Bags", productId: "SLEEVE", plannedQty: 0, actualQty: 11, uom: "units", state: "done" },
      ],
      outputMoves: [
        { id: "SM-653", direction: "output", product: "Double Press, Standard Egyptian SunCured Alfalfa, 400-425 Kg", productId: "DP-STD-EG-400", plannedQty: 4458, actualQty: 4458, uom: "kg", state: "done" },
      ],
      inputQuality: {
        avgBaleWeightKg: 20, containsGrasses: false, grassPercentage: 0,
        containsHighMoisture: false, highMoistureBigBales: 0, highMoistureSmallBalesTons: 0,
        qualityGrade: "fair", observations: "Small bales from Dakhla. Lower weight per bale.",
      },
      outputBales: { supreme: 0, premium: 0, grade1: 0, fair: 11, grade3: 0, alfamix: 0, mixGrass: 0, wheatStraw: 0 },
      outputQualityObservations: "Fair grade output from small bale input.",
      diesel: { dieselLiters: 0, sleeveBagsUsed: 11, strappingUnitsUsed: 0, notes: "No diesel logged for this short shift." },
      machine: { oilMeasurements: 5, maxOilTemperature: 40, maxOilPressure: 55, equipmentFailure: false, failureReason: "no_problem", notes: "" },
      generalNotes: "Short afternoon shift. Small bale processing.",
      qualityNotes: "",
      supportingDocUploaded: false, qualityFormUploaded: true, outputQualityFormUploaded: false, machineFormUploaded: false,
      activity: [
        { date: "2026-03-05", time: "11:00 AM", user: "Mohamed Blal", action: "Manufacturing Order created" },
        { date: "2026-03-05", time: "11:30 AM", user: "Mohamed Blal", action: "Production started" },
        { date: "2026-03-05", time: "03:00 PM", user: "Mohamed Blal", action: "Production completed — 4,458 kg" },
        { date: "2026-03-05", time: "03:15 PM", user: "Ahmed Yousef", action: "Stage → Done" },
      ],
      incentiveCancelled: false, incentiveCancelReason: "",
    },

    // MO-007: Done — large shift, Toshka, mixed grass
    {
      id: "MO-284", name: "WH/MO/00284", state: "done", priority: "normal",
      outputProduct: "Double Press, Standard Egyptian SunCured Alfalfa+RhodesGrass, 400-425 Kg",
      outputProductId: "DP-STD-RG-400",
      targetQtyKg: 24360, actualProducedKg: 38075,
      productionDate: "2026-03-04", dateStart: "2026-03-04 06:00:00", dateFinished: "2026-03-04 15:00:00",
      shiftStartTime: "2026-03-04 06:00:00", shiftEndTime: "2026-03-04 15:00:00",
      actualProductionHours: 8.0, downTimeMinutes: 60,
      inputSource: "Toshka",
      supervisors: [mkEmployee("E-493")],
      qualitySupervisors: [mkEmployee("E-535")],
      productionLabors: [mkEmployee("E-510"), mkEmployee("E-515"), mkEmployee("E-545")],
      qualityLabors: [mkEmployee("E-530"), mkEmployee("E-565")],
      drivers: [mkEmployee("E-520"), mkEmployee("E-525"), mkEmployee("E-560")],
      loadingDrivers: [mkEmployee("E-540")],
      generalLabors: [mkEmployee("E-550")],
      facilityManagerAttended: true,
      inputMoves: [
        { id: "SM-661", direction: "input", product: "Single Press, Standard Egyptian SunCured Alfalfa, 400-425 Kg", productId: "SP-STD-400", plannedQty: 24360, actualQty: 35170, uom: "kg", state: "done" },
        { id: "SM-662", direction: "input", product: "Single Press, Grade 1 Egyptian SunCured Alfalfa, 375-400 Kg", productId: "SP-G1-375", plannedQty: 0, actualQty: 2394, uom: "kg", state: "done" },
        { id: "SM-663", direction: "input", product: "Single Press, Grade 1 Egyptian SunCured Alfalfa, 425-450 Kg", productId: "SP-G1-425", plannedQty: 0, actualQty: 511, uom: "kg", state: "done" },
        { id: "SM-664", direction: "input", product: "Sleeve Bags", productId: "SLEEVE", plannedQty: 0, actualQty: 92, uom: "units", state: "done" },
      ],
      outputMoves: [
        { id: "SM-665", direction: "output", product: "Double Press, Standard Egyptian SunCured Alfalfa+RhodesGrass, 400-425 Kg", productId: "DP-STD-RG-400", plannedQty: 24360, actualQty: 38075, uom: "kg", state: "done" },
      ],
      inputQuality: {
        avgBaleWeightKg: 405, containsGrasses: true, grassPercentage: 12,
        containsHighMoisture: false, highMoistureBigBales: 0, highMoistureSmallBalesTons: 0,
        qualityGrade: "grade_1", observations: "Mixed Alfalfa+RhodesGrass from Toshka. 12% grass content.",
      },
      outputBales: { supreme: 0, premium: 8, grade1: 55, fair: 22, grade3: 5, alfamix: 0, mixGrass: 2, wheatStraw: 0 },
      outputQualityObservations: "Good output despite grass content. MixGrass bales separated.",
      diesel: { dieselLiters: 72, sleeveBagsUsed: 92, strappingUnitsUsed: 0, notes: "" },
      machine: { oilMeasurements: 9, maxOilTemperature: 48, maxOilPressure: 58, equipmentFailure: false, failureReason: "no_problem", notes: "1 hour scheduled maintenance break." },
      generalNotes: "Full day shift. High output. Scheduled maintenance during lunch.",
      qualityNotes: "RhodesGrass content within acceptable range.",
      supportingDocUploaded: true, qualityFormUploaded: true, outputQualityFormUploaded: true, machineFormUploaded: true,
      activity: [
        { date: "2026-03-04", time: "05:45 AM", user: "Mohamed Blal", action: "Manufacturing Order created" },
        { date: "2026-03-04", time: "06:00 AM", user: "Mohamed Blal", action: "Production started" },
        { date: "2026-03-04", time: "12:00 PM", user: "Mohamed Blal", action: "Scheduled maintenance — 1 hour" },
        { date: "2026-03-04", time: "03:00 PM", user: "Mohamed Blal", action: "Production completed — 38,075 kg" },
        { date: "2026-03-04", time: "03:30 PM", user: "Ahmed Yousef", action: "Stage → Done" },
      ],
      incentiveCancelled: false, incentiveCancelReason: "",
    },

    // MO-008: Cancelled
    {
      id: "MO-283", name: "WH/MO/00283", state: "cancel", priority: "normal",
      outputProduct: "Double Press, Grade 3 Egyptian SunCured Alfalfa, 400-425 Kg",
      outputProductId: "DP-G3-EG-400",
      targetQtyKg: 15000, actualProducedKg: 0,
      productionDate: "2026-03-03", dateStart: "", dateFinished: "",
      shiftStartTime: "", shiftEndTime: "",
      actualProductionHours: 0, downTimeMinutes: 0,
      inputSource: "Farafrah",
      supervisors: [],
      qualitySupervisors: [],
      productionLabors: [],
      qualityLabors: [],
      drivers: [],
      loadingDrivers: [],
      generalLabors: [],
      facilityManagerAttended: false,
      inputMoves: [],
      outputMoves: [],
      inputQuality: {
        avgBaleWeightKg: 0, containsGrasses: false, grassPercentage: 0,
        containsHighMoisture: false, highMoistureBigBales: 0, highMoistureSmallBalesTons: 0,
        qualityGrade: "", observations: "",
      },
      outputBales: { supreme: 0, premium: 0, grade1: 0, fair: 0, grade3: 0, alfamix: 0, mixGrass: 0, wheatStraw: 0 },
      outputQualityObservations: "",
      diesel: { dieselLiters: 0, sleeveBagsUsed: 0, strappingUnitsUsed: 0, notes: "" },
      machine: { oilMeasurements: 0, maxOilTemperature: 0, maxOilPressure: 0, equipmentFailure: false, failureReason: "no_problem", notes: "" },
      generalNotes: "Cancelled due to generator failure. Rescheduled.",
      qualityNotes: "",
      supportingDocUploaded: false, qualityFormUploaded: false, outputQualityFormUploaded: false, machineFormUploaded: false,
      activity: [
        { date: "2026-03-03", time: "05:00 AM", user: "Ahmed Yousef", action: "Manufacturing Order created" },
        { date: "2026-03-03", time: "05:30 AM", user: "Ahmed Yousef", action: "Cancelled — generator failure" },
      ],
      incentiveCancelled: true, incentiveCancelReason: "Generator failure — no production possible",
    },
  ];

  return mos;
}
