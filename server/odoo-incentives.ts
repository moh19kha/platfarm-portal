/**
 * Odoo Incentives Data Module
 *
 * Fetches real data from Odoo for incentive calculations:
 * - Manufacturing Orders (mrp.production) — count & bale totals
 * - Quality Inspections (quality.check)
 * - Purchase Receipts (stock.picking, incoming, done)
 * - Container Loads (export.container)
 * - Attendance (hr.attendance)
 * - Bonus & Fines (hr.payslip)
 */

import axios from "axios";

// ─── Odoo Connection Config ──────────────────────────────────────────────────
const ODOO_URL = "https://odoo.platfarm.io";
const ODOO_DB = "odoo";
const ODOO_USER = "aiagent";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD ?? "Platfarm@2025";

const odooClient = axios.create({
  baseURL: ODOO_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 120000,
});

// ─── UID Cache ───────────────────────────────────────────────────────────────
let _uidPromise: Promise<number> | null = null;

function getUid(): Promise<number> {
  if (_uidPromise) return _uidPromise;
  _uidPromise = (async () => {
    try {
      const res = await odooClient.post("/jsonrpc", {
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "common",
          method: "authenticate",
          args: [ODOO_DB, ODOO_USER, ODOO_PASSWORD, {}],
        },
      });
      if (res.data.error) throw new Error(`Odoo auth error: ${res.data.error.data.message}`);
      const uid = res.data.result;
      if (!uid || typeof uid !== "number") throw new Error("Odoo authentication failed");
      return uid;
    } catch (err) {
      _uidPromise = null;
      throw err;
    }
  })();
  return _uidPromise;
}

const ALLOWED_COMPANY_IDS = [1, 2, 3, 4, 5];

async function executeKw<T = unknown>(
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown> = {},
  retries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const uid = await getUid();
      const kwargsWithContext = {
        ...kwargs,
        context: {
          ...(kwargs.context as Record<string, unknown> || {}),
          allowed_company_ids: ALLOWED_COMPANY_IDS,
        },
      };
      const res = await odooClient.post("/jsonrpc", {
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "object",
          method: "execute_kw",
          args: [ODOO_DB, uid, ODOO_PASSWORD, model, method, args, kwargsWithContext],
        },
      });
      if (res.data.error) {
        if (res.data.error.code === 100 || res.data.error.code === 2) _uidPromise = null;
        throw new Error(`Odoo RPC error (${model}.${method}): ${res.data.error.data.message}`);
      }
      return res.data.result as T;
    } catch (err: any) {
      const isTransient = err.message?.includes("socket hang up") ||
        err.message?.includes("ECONNRESET") ||
        err.code === "ECONNRESET" ||
        err.code === "ECONNREFUSED";
      if (isTransient && attempt < retries) {
        _uidPromise = null;
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error("executeKw: exhausted retries");
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IncentiveDataSources {
  manufacturingOrders: {
    total: number;
    completed: number;
    totalBalesProduced: number;
    premiumBales: number;
    grade1Bales: number;
    fairGradeBales: number;
    alfamixBales: number;
    supremeBales: number;
    cancelledIncentives: number;
    facilityManagerAttended: number;
    orders: Array<{
      id: number;
      name: string;
      state: string;
      productName: string;
      qtyProduced: number;
      dateStart: string | false;
      dateFinished: string | false;
      incentiveCancelled: boolean;
      facilityManagerAttended: boolean;
    }>;
  };
  qualityInspections: {
    total: number;
    passed: number;
    failed: number;
    inspections: Array<{
      id: number;
      name: string;
      qualityState: string;
      productName: string;
      date: string;
    }>;
  };
  purchaseReceipts: {
    total: number;
    completed: number;
    receipts: Array<{
      id: number;
      name: string;
      state: string;
      partnerName: string;
      dateDone: string | false;
      origin: string | false;
    }>;
  };
  containerLoads: {
    total: number;
    containers: Array<{
      id: number;
      name: string;
      state: string;
      createDate: string;
    }>;
  };
  attendance: {
    totalRecords: number;
    uniqueEmployees: number;
    totalHoursWorked: number;
    records: Array<{
      id: number;
      employeeName: string;
      checkIn: string;
      checkOut: string | false;
      workedHours: number;
    }>;
  };
  bonusFines: {
    totalPayslips: number;
    payslips: Array<{
      id: number;
      name: string;
      employeeName: string;
      netWage: number;
      state: string;
    }>;
  };
}

export interface IncentiveCalculationResult {
  period: string;
  startDate: string;
  endDate: string;
  dataSources: IncentiveDataSources;
  summary: {
    totalMOs: number;
    completedMOs: number;
    totalBalesProduced: number;
    totalReceipts: number;
    totalContainerLoads: number;
    totalAttendanceHours: number;
    cancelledIncentives: number;
    facilityManagerMeetings: number;
  };
}

// ─── Data Fetching Functions ─────────────────────────────────────────────────

/**
 * Fetch manufacturing orders for a given period
 */
async function fetchMOsForPeriod(startDate: string, endDate: string) {
  const domain: unknown[] = [
    ["date_start", ">=", startDate],
    ["date_start", "<=", endDate + " 23:59:59"],
  ];

  const orders = await executeKw<any[]>("mrp.production", "search_read", [domain], {
    fields: [
      "id", "name", "state", "product_id", "product_qty", "qty_produced",
      "date_start", "date_finished",
      "no_produced_premium_bales", "no_produced_grade_1_bales",
      "no_produced_fair_grade_bales", "no_produced_alfamix_bales",
      "x_studio_no_produced_supreme_bales",
      "x_studio_incentive_cancelled", "x_studio_incentive_cancelation_details",
      "x_studio_facility_manager_attended",
    ],
    order: "date_start desc",
    limit: 500,
  });

  const completed = orders.filter(o => o.state === "done");
  const totalBales = orders.reduce((sum: number, o: any) =>
    sum + (o.no_produced_premium_bales || 0)
    + (o.no_produced_grade_1_bales || 0)
    + (o.no_produced_fair_grade_bales || 0)
    + (o.no_produced_alfamix_bales || 0)
    + (o.x_studio_no_produced_supreme_bales || 0), 0);

  return {
    total: orders.length,
    completed: completed.length,
    totalBalesProduced: totalBales,
    premiumBales: orders.reduce((s: number, o: any) => s + (o.no_produced_premium_bales || 0), 0),
    grade1Bales: orders.reduce((s: number, o: any) => s + (o.no_produced_grade_1_bales || 0), 0),
    fairGradeBales: orders.reduce((s: number, o: any) => s + (o.no_produced_fair_grade_bales || 0), 0),
    alfamixBales: orders.reduce((s: number, o: any) => s + (o.no_produced_alfamix_bales || 0), 0),
    supremeBales: orders.reduce((s: number, o: any) => s + (o.x_studio_no_produced_supreme_bales || 0), 0),
    cancelledIncentives: orders.filter((o: any) => o.x_studio_incentive_cancelled).length,
    facilityManagerAttended: orders.filter((o: any) => o.x_studio_facility_manager_attended).length,
    orders: orders.map((o: any) => ({
      id: o.id,
      name: o.name,
      state: o.state,
      productName: o.product_id ? o.product_id[1] : "N/A",
      qtyProduced: o.qty_produced || 0,
      dateStart: o.date_start || false,
      dateFinished: o.date_finished || false,
      incentiveCancelled: o.x_studio_incentive_cancelled || false,
      facilityManagerAttended: o.x_studio_facility_manager_attended || false,
    })),
  };
}

/**
 * Fetch quality inspections for a given period
 */
async function fetchQualityForPeriod(startDate: string, endDate: string) {
  try {
    const checks = await executeKw<any[]>("quality.check", "search_read", [
      [["create_date", ">=", startDate], ["create_date", "<=", endDate + " 23:59:59"]],
    ], {
      fields: ["id", "name", "quality_state", "product_id", "create_date"],
      order: "create_date desc",
      limit: 500,
    });

    return {
      total: checks.length,
      passed: checks.filter((c: any) => c.quality_state === "pass").length,
      failed: checks.filter((c: any) => c.quality_state === "fail").length,
      inspections: checks.map((c: any) => ({
        id: c.id,
        name: c.name || `QC-${c.id}`,
        qualityState: c.quality_state || "none",
        productName: c.product_id ? c.product_id[1] : "N/A",
        date: c.create_date || "",
      })),
    };
  } catch {
    return { total: 0, passed: 0, failed: 0, inspections: [] };
  }
}

/**
 * Fetch completed purchase receipts for a given period
 */
async function fetchReceiptsForPeriod(startDate: string, endDate: string) {
  const receipts = await executeKw<any[]>("stock.picking", "search_read", [
    [
      ["picking_type_code", "=", "incoming"],
      ["state", "=", "done"],
      ["date_done", ">=", startDate],
      ["date_done", "<=", endDate + " 23:59:59"],
    ],
  ], {
    fields: ["id", "name", "state", "partner_id", "date_done", "origin"],
    order: "date_done desc",
    limit: 500,
  });

  return {
    total: receipts.length,
    completed: receipts.length, // all are done
    receipts: receipts.map((r: any) => ({
      id: r.id,
      name: r.name || `REC-${r.id}`,
      state: r.state,
      partnerName: r.partner_id ? r.partner_id[1] : "N/A",
      dateDone: r.date_done || false,
      origin: r.origin || false,
    })),
  };
}

/**
 * Fetch container loads for a given period
 */
async function fetchContainersForPeriod(startDate: string, endDate: string) {
  try {
    const containers = await executeKw<any[]>("export.container", "search_read", [
      [["create_date", ">=", startDate], ["create_date", "<=", endDate + " 23:59:59"]],
    ], {
      fields: ["id", "name", "state", "create_date"],
      order: "create_date desc",
      limit: 500,
    });

    return {
      total: containers.length,
      containers: containers.map((c: any) => ({
        id: c.id,
        name: c.name || `CNT-${c.id}`,
        state: c.state || "unknown",
        createDate: c.create_date || "",
      })),
    };
  } catch {
    return { total: 0, containers: [] };
  }
}

/**
 * Fetch attendance records for a given period
 */
async function fetchAttendanceForPeriod(startDate: string, endDate: string) {
  try {
    const records = await executeKw<any[]>("hr.attendance", "search_read", [
      [["check_in", ">=", startDate], ["check_in", "<=", endDate + " 23:59:59"]],
    ], {
      fields: ["id", "employee_id", "check_in", "check_out", "worked_hours"],
      order: "check_in desc",
      limit: 1000,
    });

    const uniqueEmployees = new Set(records.map((r: any) => r.employee_id?.[0])).size;
    const totalHours = records.reduce((sum: number, r: any) => sum + (r.worked_hours || 0), 0);

    return {
      totalRecords: records.length,
      uniqueEmployees,
      totalHoursWorked: Math.round(totalHours * 100) / 100,
      records: records.slice(0, 100).map((r: any) => ({
        id: r.id,
        employeeName: r.employee_id ? r.employee_id[1] : "N/A",
        checkIn: r.check_in || "",
        checkOut: r.check_out || false,
        workedHours: r.worked_hours || 0,
      })),
    };
  } catch {
    return { totalRecords: 0, uniqueEmployees: 0, totalHoursWorked: 0, records: [] };
  }
}

/**
 * Fetch payslips (bonus/fines) for a given period
 */
async function fetchPayslipsForPeriod(startDate: string, endDate: string) {
  try {
    const payslips = await executeKw<any[]>("hr.payslip", "search_read", [
      [["date_from", ">=", startDate], ["date_from", "<=", endDate]],
    ], {
      fields: ["id", "name", "employee_id", "net_wage", "state"],
      order: "date_from desc",
      limit: 500,
    });

    return {
      totalPayslips: payslips.length,
      payslips: payslips.map((p: any) => ({
        id: p.id,
        name: p.name || `SLIP-${p.id}`,
        employeeName: p.employee_id ? p.employee_id[1] : "N/A",
        netWage: p.net_wage || 0,
        state: p.state || "draft",
      })),
    };
  } catch {
    return { totalPayslips: 0, payslips: [] };
  }
}

// ─── Main Calculation Function ───────────────────────────────────────────────

/**
 * Run a full incentive calculation for a given month/year.
 * Fetches all data sources from Odoo and returns aggregated results.
 */
export async function runIncentiveCalculation(
  year: number,
  month: number, // 1-12
): Promise<IncentiveCalculationResult> {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const period = `${monthNames[month - 1]} ${year}`;

  // Fetch all data sources in parallel
  const [mos, quality, receipts, containers, attendance, bonusFines] = await Promise.all([
    fetchMOsForPeriod(startDate, endDate),
    fetchQualityForPeriod(startDate, endDate),
    fetchReceiptsForPeriod(startDate, endDate),
    fetchContainersForPeriod(startDate, endDate),
    fetchAttendanceForPeriod(startDate, endDate),
    fetchPayslipsForPeriod(startDate, endDate),
  ]);

  return {
    period,
    startDate,
    endDate,
    dataSources: {
      manufacturingOrders: mos,
      qualityInspections: quality,
      purchaseReceipts: receipts,
      containerLoads: containers,
      attendance,
      bonusFines: bonusFines,
    },
    summary: {
      totalMOs: mos.total,
      completedMOs: mos.completed,
      totalBalesProduced: mos.totalBalesProduced,
      totalReceipts: receipts.total,
      totalContainerLoads: containers.total,
      totalAttendanceHours: attendance.totalHoursWorked,
      cancelledIncentives: mos.cancelledIncentives,
      facilityManagerMeetings: mos.facilityManagerAttended,
    },
  };
}
