/**
 * Finance tRPC Router
 *
 * Provides endpoints for all 9 finance sub-pages:
 * - health: Financial Health Scorecard (derived from other data)
 * - cashOverview: Bank balances + cash flow
 * - receivables: AR aging, DSO, overdue invoices, customer concentration
 * - payables: AP aging, DPO, due-this-week bills
 * - expenses: Expense breakdown by category with period filters
 * - expenditure: All outflow distribution
 * - soa: Statement of Account for a specific partner
 * - exportFees: Specific account code tracking
 * - inventoryValuation: Inventory value summary (reuses inventory data)
 * - partners: Customer/supplier list for SOA selector
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  fetchBankBalances,
  fetchCashFlowLines,
  fetchOpenReceivables,
  fetchOpenPayables,
  fetchExpenseLines,
  fetchPartners,
  fetchPartnerLedger,
  fetchAccountCodeLines,
  fetchRevenueTotal,
  fetchCOGSTotal,
  fetchAccounts,
} from "../odoo-finance";

// ─── Helpers ───────────────────────────────────────────────────────────────

function daysBetween(d1: string, d2: string): number {
  return Math.floor((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000);
}

function toMonthKey(dateStr: string): string {
  // Use string slicing (timezone-safe) — new Date("YYYY-MM-DD") parses as UTC
  // which can shift to a different month when the server is behind UTC.
  const [year, month] = dateStr.slice(0, 7).split("-");
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${monthNames[parseInt(month, 10) - 1]} ${year}`;
}

function toWeekKey(dateStr: string): string {
  // Timezone-safe: parse date parts directly from the string
  const [year, month, day] = dateStr.slice(0, 10).split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const start = new Date(year, 0, 1);
  const wk = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `W${wk} ${year}`;
}

const today = () => new Date().toISOString().slice(0, 10);

function periodDates(period: string, customFrom?: string, customTo?: string) {
  const t = today();
  if (period === "custom" && customFrom && customTo) return { from: customFrom, to: customTo };
  const d = new Date(t);
  if (period === "7d") { d.setDate(d.getDate() - 7); return { from: d.toISOString().slice(0, 10), to: t }; }
  if (period === "30d") { d.setDate(d.getDate() - 30); return { from: d.toISOString().slice(0, 10), to: t }; }
  if (period === "90d") { d.setDate(d.getDate() - 90); return { from: d.toISOString().slice(0, 10), to: t }; }
  if (period === "ytd") { return { from: `${d.getFullYear()}-01-01`, to: t }; }
  // default 90d
  d.setDate(d.getDate() - 90);
  return { from: d.toISOString().slice(0, 10), to: t };
}

// ─── Expense category mapping from account codes ───────────────────────────

function categorizeExpenseAccount(code: string | false, name: string | false): string {
  const c = (code || "").toString().toLowerCase();
  const n = (name || "").toString().toLowerCase();
  // Cost of Sale / COGS
  if (c.startsWith("51") || n.includes("cost of") || n.includes("cogs") || n.includes("freight") || n.includes("trucking") || n.includes("export fee") || n.includes("clearance")) return "Cost of Sale";
  // Salaries
  if (c.startsWith("52") || n.includes("salar") || n.includes("wage") || n.includes("payroll") || n.includes("incentive") || n.includes("bonus")) return "Salaries";
  // Transportation
  if (n.includes("transport") || n.includes("fuel") || n.includes("diesel") || n.includes("container") || n.includes("domestic")) return "Transportation";
  // Admin
  if (n.includes("admin") || n.includes("software") || n.includes("comm") || n.includes("supplies") || n.includes("office")) return "Admin";
  // Financial
  if (n.includes("bank") || n.includes("audit") || n.includes("legal") || n.includes("interest") || n.includes("financial") || n.includes("insurance")) return "Financial";
  // Facilities
  if (n.includes("rent") || n.includes("electric") || n.includes("water") || n.includes("utilit") || n.includes("maintenance") || n.includes("facilit")) return "Facilities";
  // Depreciation
  if (n.includes("deprec") || n.includes("amort")) return "Depreciation";
  // Default: use first 2 digits
  if (c.startsWith("51")) return "Cost of Sale";
  if (c.startsWith("52")) return "Salaries";
  if (c.startsWith("53")) return "Admin";
  if (c.startsWith("54")) return "Financial";
  if (c.startsWith("6")) return "Other Expenses";
  return "Other";
}

// ─── Router ─────────────────────────────────────────────────────────────────

export const financeRouter = router({

  /**
   * Cash Overview — bank balances + cash flow for a period
   */
  cashOverview: publicProcedure
    .input(z.object({
      companyId: z.number().optional(),
      period: z.string().default("90d"),
      customFrom: z.string().optional(),
      customTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const companyId = input?.companyId;
      const { from, to } = periodDates(input?.period || "90d", input?.customFrom, input?.customTo);

      // Fetch bank balances and cash flow lines in parallel
      const [bankBalances, cfLines] = await Promise.all([
        fetchBankBalances(companyId),
        fetchCashFlowLines(companyId, from, to),
      ]);

      // Also fetch previous period for comparison
      const days = daysBetween(from, to);
      const prevTo = from;
      const prevFromDate = new Date(from);
      prevFromDate.setDate(prevFromDate.getDate() - days);
      const prevFrom = prevFromDate.toISOString().slice(0, 10);
      const prevCfLines = await fetchCashFlowLines(companyId, prevFrom, prevTo);

      // Aggregate cash flow
      const inflows = cfLines.reduce((s, l) => s + l.debit, 0);
      const outflows = cfLines.reduce((s, l) => s + l.credit, 0);
      const net = inflows - outflows;
      const prevInflows = prevCfLines.reduce((s, l) => s + l.debit, 0);
      const prevOutflows = prevCfLines.reduce((s, l) => s + l.credit, 0);

      // Group by week or month
      const useMonths = days > 45;
      const periodGroups: Record<string, { inflow: number; outflow: number }> = {};
      cfLines.forEach(l => {
        const key = useMonths ? toMonthKey(l.date) : toWeekKey(l.date);
        if (!periodGroups[key]) periodGroups[key] = { inflow: 0, outflow: 0 };
        periodGroups[key].inflow += l.debit;
        periodGroups[key].outflow += l.credit;
      });
      const periods = Object.entries(periodGroups).map(([label, data]) => ({
        label,
        inflow: Math.round(data.inflow),
        outflow: Math.round(data.outflow),
      }));

      // Total cash — convert foreign currencies to EGP
      const fxToEGP: Record<string, number> = { USD: 49, AED: 13.35, EUR: 53, GBP: 62 };
      const totalCash = bankBalances.reduce((s, b) => {
        const rate = fxToEGP[b.currency] || 1;
        return s + b.balance * rate;
      }, 0);
      const prevTotalCash = totalCash - net; // approximate

      return {
        banks: bankBalances.map(b => ({
          id: b.journalId,
          name: b.journalName,
          code: b.journalCode,
          balance: Math.round(b.balance),
          currency: b.currency,
          companyId: b.companyId,
          companyName: b.companyName,
        })),
        totalCash: Math.round(totalCash),
        prevTotalCash: Math.round(prevTotalCash),
        cashFlow: {
          inflows: Math.round(inflows),
          outflows: Math.round(outflows),
          net: Math.round(net),
          prevInflows: Math.round(prevInflows),
          prevOutflows: Math.round(prevOutflows),
          periods,
        },
        dateRange: { from, to },
      };
    }),

  /**
   * Receivables — AR aging, DSO, overdue invoices, customer concentration
   */
  receivables: publicProcedure
    .input(z.object({ companyId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const companyId = input?.companyId;
      const t = today();

      // Fetch open receivables and revenue for DSO
      const [invoices, revenue] = await Promise.all([
        fetchOpenReceivables(companyId),
        fetchRevenueTotal(companyId, new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().slice(0, 10), t),
      ]);

      const totalAR = invoices.reduce((s, inv) => s + inv.amount_residual, 0);
      const dso = revenue > 0 ? Math.round((totalAR / revenue) * 365) : 0;

      // Aging buckets
      const aging = { current: { amount: 0, count: 0 }, d31: { amount: 0, count: 0 }, d61: { amount: 0, count: 0 }, d90: { amount: 0, count: 0 } };
      const overdueList: Array<{
        id: number; ref: string; customer: string; amount: number;
        dueDate: string; daysOverdue: number; risk: string; soRef: string; soId: number | null;
      }> = [];

      invoices.forEach(inv => {
        const dueDate = inv.invoice_date_due || inv.date;
        const daysOld = daysBetween(dueDate, t);
        const bucket = daysOld <= 0 ? "current" : daysOld <= 30 ? "d31" : daysOld <= 60 ? "d61" : "d90";
        aging[bucket].amount += inv.amount_residual;
        aging[bucket].count++;

        if (daysOld > 0) {
          overdueList.push({
            id: inv.id,
            ref: inv.name,
            customer: inv.partner_id ? (inv.partner_id as [number, string])[1] : "Unknown",
            amount: Math.round(inv.amount_residual),
            dueDate,
            daysOverdue: daysOld,
            risk: daysOld > 90 ? "high" : daysOld > 30 ? "medium" : "low",
            soRef: (inv.invoice_origin as string) || "",
            soId: null,
          });
        }
      });

      // Batch-lookup SO ids so we can link overdue rows to the portal shipment page
      const { executeKw: exKw2 } = await import("../odoo");
      const soNames2 = [...new Set(overdueList.map(o => o.soRef).filter(Boolean))];
      if (soNames2.length > 0) {
        const sos2 = await exKw2<{id:number;name:string}[]>("sale.order","search_read",[[["name","in",soNames2]]],{fields:["id","name"],limit:2000});
        const soIdMap2: Record<string,number> = {};
        sos2.forEach(s => { soIdMap2[s.name] = s.id; });
        overdueList.forEach(o => { if (o.soRef && soIdMap2[o.soRef]) o.soId = soIdMap2[o.soRef]; });
      }

      // Customer concentration
      const customerMap: Record<string, { name: string; amount: number; invoiceCount: number; oldestDays: number }> = {};
      invoices.forEach(inv => {
        const name = inv.partner_id ? (inv.partner_id as [number, string])[1] : "Unknown";
        if (!customerMap[name]) customerMap[name] = { name, amount: 0, invoiceCount: 0, oldestDays: 0 };
        customerMap[name].amount += inv.amount_residual;
        customerMap[name].invoiceCount++;
        const dueDate = inv.invoice_date_due || inv.date;
        const daysOld = Math.max(0, daysBetween(dueDate, t));
        customerMap[name].oldestDays = Math.max(customerMap[name].oldestDays, daysOld);
      });
      const topCustomers = Object.values(customerMap)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)
        .map(c => ({
          ...c,
          amount: Math.round(c.amount),
          share: totalAR > 0 ? Math.round((c.amount / totalAR) * 1000) / 10 : 0,
          risk: c.oldestDays > 90 ? "high" : c.oldestDays > 30 ? "medium" : "low",
        }));

      const collectionRate = revenue > 0 ? Math.round(((revenue - totalAR) / revenue) * 100) : 0;
      const badDebt = Math.round(aging.d90.amount * 0.5 + aging.d61.amount * 0.2 + aging.d31.amount * 0.05);

      return {
        total: Math.round(totalAR),
        dso,
        collectionRate,
        badDebt,
        aging: {
          current: { amount: Math.round(aging.current.amount), count: aging.current.count, pct: totalAR > 0 ? Math.round((aging.current.amount / totalAR) * 100) : 0 },
          d31: { amount: Math.round(aging.d31.amount), count: aging.d31.count, pct: totalAR > 0 ? Math.round((aging.d31.amount / totalAR) * 100) : 0 },
          d61: { amount: Math.round(aging.d61.amount), count: aging.d61.count, pct: totalAR > 0 ? Math.round((aging.d61.amount / totalAR) * 100) : 0 },
          d90: { amount: Math.round(aging.d90.amount), count: aging.d90.count, pct: totalAR > 0 ? Math.round((aging.d90.amount / totalAR) * 100) : 0 },
        },
        overdue: overdueList.sort((a, b) => b.daysOverdue - a.daysOverdue).slice(0, 250),
        topCustomers,
        topConcentration: topCustomers.length > 0 ? topCustomers[0].share : 0,
      };
    }),

  /**
   * Payables — AP aging, DPO, due-this-week bills
   */
  payables: publicProcedure
    .input(z.object({ companyId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const companyId = input?.companyId;
      const t = today();

      const [bills, cogs] = await Promise.all([
        fetchOpenPayables(companyId),
        fetchCOGSTotal(companyId, new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().slice(0, 10), t),
      ]);

      const totalAP = bills.reduce((s, b) => s + b.amount_residual, 0);
      const dpo = cogs > 0 ? Math.round((totalAP / cogs) * 365) : 0;

      // Aging buckets
      const aging = { d7: 0, d30: 0, d60: 0, d60p: 0 };
      bills.forEach(b => {
        const dueDate = b.invoice_date_due || b.date;
        const daysOld = daysBetween(dueDate, t);
        if (daysOld <= 7) aging.d7 += b.amount_residual;
        else if (daysOld <= 30) aging.d30 += b.amount_residual;
        else if (daysOld <= 60) aging.d60 += b.amount_residual;
        else aging.d60p += b.amount_residual;
      });

      // Due this week
      const weekEnd = new Date(t);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const dueThisWeek = bills
        .filter(b => {
          const due = b.invoice_date_due || b.date;
          return due >= t && due <= weekEnd.toISOString().slice(0, 10);
        })
        .map(b => ({
          ref: b.name,
          supplier: b.partner_id ? (b.partner_id as [number, string])[1] : "Unknown",
          amount: Math.round(b.amount_residual),
          dueDate: b.invoice_date_due || b.date,
          daysUntil: daysBetween(t, b.invoice_date_due || b.date),
          urgency: daysBetween(t, b.invoice_date_due || b.date) <= 2 ? "Critical" : "OK",
        }))
        .sort((a, b) => a.daysUntil - b.daysUntil);

      // Supplier concentration
      const supplierMap: Record<string, { name: string; amount: number; count: number }> = {};
      bills.forEach(b => {
        const name = b.partner_id ? (b.partner_id as [number, string])[1] : "Unknown";
        if (!supplierMap[name]) supplierMap[name] = { name, amount: 0, count: 0 };
        supplierMap[name].amount += b.amount_residual;
        supplierMap[name].count++;
      });
      const topSuppliers = Object.values(supplierMap)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)
        .map(s => ({ ...s, amount: Math.round(s.amount) }));

      const topConcentration = totalAP > 0 && topSuppliers.length > 0
        ? Math.round((topSuppliers[0].amount / totalAP) * 1000) / 10 : 0;

      // Cash gap (DSO - DPO approximation — we'll compute DSO here too)
      const cashGap = dpo; // simplified; full CCC comes from health endpoint

      return {
        total: Math.round(totalAP),
        dpo,
        billCount: bills.length,
        aging: {
          d7: Math.round(aging.d7),
          d30: Math.round(aging.d30),
          d60: Math.round(aging.d60),
          d60p: Math.round(aging.d60p),
        },
        dueThisWeek,
        topSuppliers,
        topConcentration,
        dueWithin7d: Math.round(aging.d7),
      };
    }),

  /**
   * Expenses — category breakdown with period filters
   */
  expenses: publicProcedure
    .input(z.object({
      companyId: z.number().optional(),
      period: z.string().default("90d"),
      customFrom: z.string().optional(),
      customTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const companyId = input?.companyId;
      const { from, to } = periodDates(input?.period || "90d", input?.customFrom, input?.customTo);

      // Fetch expense lines and accounts
      const [lines, accounts] = await Promise.all([
        fetchExpenseLines(companyId, from, to),
        fetchAccounts(companyId),
      ]);

      // Also fetch previous period for comparison
      const days = daysBetween(from, to);
      const prevTo = from;
      const prevFromDate = new Date(from);
      prevFromDate.setDate(prevFromDate.getDate() - days);
      const prevFrom = prevFromDate.toISOString().slice(0, 10);
      const prevLines = await fetchExpenseLines(companyId, prevFrom, prevTo);

      // Build account lookup
      const accountMap = new Map<number, { code: string; name: string }>();
      accounts.forEach(a => accountMap.set(a.id, { code: a.code, name: a.name }));

      // Categorize expenses
      const catMap: Record<string, { amount: number; prevAmount: number; subs: Record<string, number> }> = {};
      lines.forEach(l => {
        const accId = l.account_id ? (l.account_id as [number, string])[0] : 0;
        const acc = accountMap.get(accId);
        const cat = acc ? categorizeExpenseAccount(acc.code, acc.name) : "Other";
        const subName = acc?.name || "Other";
        if (!catMap[cat]) catMap[cat] = { amount: 0, prevAmount: 0, subs: {} };
        catMap[cat].amount += l.debit;
        catMap[cat].subs[subName] = (catMap[cat].subs[subName] || 0) + l.debit;
      });

      // Previous period amounts
      prevLines.forEach(l => {
        const accId = l.account_id ? (l.account_id as [number, string])[0] : 0;
        const acc = accountMap.get(accId);
        const cat = acc ? categorizeExpenseAccount(acc.code, acc.name) : "Other";
        if (!catMap[cat]) catMap[cat] = { amount: 0, prevAmount: 0, subs: {} };
        catMap[cat].prevAmount += l.debit;
      });

      const total = Object.values(catMap).reduce((s, c) => s + c.amount, 0);
      const prevTotal = Object.values(catMap).reduce((s, c) => s + c.prevAmount, 0);

      const groups = Object.entries(catMap)
        .sort((a, b) => b[1].amount - a[1].amount)
        .map(([name, data]) => ({
          name,
          amount: Math.round(data.amount),
          prevAmount: Math.round(data.prevAmount),
          subs: Object.entries(data.subs)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([n, a]) => ({ name: n, amount: Math.round(a) })),
        }));

      // Monthly breakdown (total + by category for stacked chart)
      const monthMap: Record<string, number> = {};
      const monthCatMap: Record<string, Record<string, number>> = {};
      lines.forEach(l => {
        const key = toMonthKey(l.date);
        monthMap[key] = (monthMap[key] || 0) + l.debit;
        const accId = l.account_id ? (l.account_id as [number, string])[0] : 0;
        const acc = accountMap.get(accId);
        const cat = acc ? categorizeExpenseAccount(acc.code, acc.name) : "Other";
        if (!monthCatMap[key]) monthCatMap[key] = {};
        monthCatMap[key][cat] = (monthCatMap[key][cat] || 0) + l.debit;
      });
      // Get all category names sorted by total amount
      const allCatNames = groups.map(g => g.name);
      // Sort chronologically: "Jan 2026" → parse to date for comparison
      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const parseMonthKey = (k: string) => {
        const [mon, yr] = k.split(" ");
        return parseInt(yr) * 100 + monthNames.indexOf(mon);
      };
      const monthly = Object.entries(monthMap)
        .sort((a, b) => parseMonthKey(a[0]) - parseMonthKey(b[0]))
        .map(([month, amount]) => ({
          month,
          amount: Math.round(amount),
          categories: Object.fromEntries(
            allCatNames.map(cat => [cat, Math.round(monthCatMap[month]?.[cat] || 0)])
          ) as Record<string, number>,
        }));

      const runRate = days > 0 ? Math.round(total / days * 30) : 0;
      const cogsTotal = groups.find(g => g.name === "Cost of Sale")?.amount || 0;
      const cogsPct = total > 0 ? Math.round((cogsTotal / total) * 1000) / 10 : 0;

      return {
        total: Math.round(total),
        prevTotal: Math.round(prevTotal),
        runRate,
        cogsPct,
        groups,
        monthly,
        dateRange: { from, to, days },
      };
    }),

  /**
   * Expenditure — all outflow distribution (broader than expenses)
   */
  expenditure: publicProcedure
    .input(z.object({
      companyId: z.number().optional(),
      period: z.string().default("90d"),
      customFrom: z.string().optional(),
      customTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const companyId = input?.companyId;
      const { from, to } = periodDates(input?.period || "90d", input?.customFrom, input?.customTo);

      const [lines, accounts] = await Promise.all([
        fetchExpenseLines(companyId, from, to),
        fetchAccounts(companyId),
      ]);

      const prevTo = from;
      const days = daysBetween(from, to);
      const prevFromDate = new Date(from);
      prevFromDate.setDate(prevFromDate.getDate() - days);
      const prevFrom = prevFromDate.toISOString().slice(0, 10);
      const prevLines = await fetchExpenseLines(companyId, prevFrom, prevTo);

      const accountMap = new Map<number, { code: string; name: string }>();
      accounts.forEach(a => accountMap.set(a.id, { code: a.code, name: a.name }));

      const catMap: Record<string, { amount: number; count: number }> = {};
      lines.forEach(l => {
        const accId = l.account_id ? (l.account_id as [number, string])[0] : 0;
        const acc = accountMap.get(accId);
        const cat = acc ? categorizeExpenseAccount(acc.code, acc.name) : "Other";
        if (!catMap[cat]) catMap[cat] = { amount: 0, count: 0 };
        catMap[cat].amount += l.debit;
        catMap[cat].count++;
      });

      const total = Object.values(catMap).reduce((s, c) => s + c.amount, 0);
      const prevTotal = prevLines.reduce((s, l) => s + l.debit, 0);

      const distribution = Object.entries(catMap)
        .sort((a, b) => b[1].amount - a[1].amount)
        .map(([cat, data]) => ({
          category: cat,
          amount: Math.round(data.amount),
          count: data.count,
          pct: total > 0 ? Math.round((data.amount / total) * 1000) / 10 : 0,
        }));

      return {
        total: Math.round(total),
        prevTotal: Math.round(prevTotal),
        distribution,
      };
    }),

  /**
   * SOA — Statement of Account for a specific partner
   */
  soa: publicProcedure
    .input(z.object({
      partnerId: z.number(),
      mode: z.enum(["customer", "supplier"]),
      companyId: z.number().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const accountType = input.mode === "customer" ? "receivable" : "payable";
      const lines = await fetchPartnerLedger(
        input.partnerId,
        accountType as "receivable" | "payable",
        input.companyId,
        input.dateFrom,
        input.dateTo,
      );

      // Compute opening balance (sum of all entries before dateFrom)
      let openingBalance = 0;
      if (input.dateFrom) {
        const priorLines = await fetchPartnerLedger(
          input.partnerId,
          accountType as "receivable" | "payable",
          input.companyId,
          undefined,
          // Day before dateFrom
          new Date(new Date(input.dateFrom).getTime() - 86400000).toISOString().slice(0, 10),
        );
        openingBalance = priorLines.reduce((s, l) => s + l.debit - l.credit, 0);
      }

      // Build running balance
      let runningBalance = openingBalance;
      const entries = lines.map(l => {
        runningBalance += l.debit - l.credit;
        return {
          id: l.id,
          date: l.date,
          ref: l.move_id ? (l.move_id as [number, string])[1] : "",
          description: l.name || (l.ref || ""),
          dueDate: l.date_maturity || null,
          debit: Math.round(l.debit),
          credit: Math.round(l.credit),
          runningBalance: Math.round(runningBalance),
        };
      });

      return {
        openingBalance: Math.round(openingBalance),
        entries,
        totalDebit: Math.round(entries.reduce((s, e) => s + e.debit, 0)),
        totalCredit: Math.round(entries.reduce((s, e) => s + e.credit, 0)),
        closingBalance: Math.round(runningBalance),
      };
    }),

  /**
   * Export Fees — specific account code tracking
   */
  exportFees: publicProcedure
    .input(z.object({
      companyId: z.number().optional(),
      accountCode: z.string().default("51010403"),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const companyId = input?.companyId;
      const accountCode = input?.accountCode || "51010403";
      const dateFrom = input?.dateFrom;
      const dateTo = input?.dateTo;

      const lines = await fetchAccountCodeLines(accountCode, companyId, dateFrom, dateTo);

      const total = lines.reduce((s, l) => s + l.debit, 0);

      // Monthly breakdown
      const monthMap: Record<string, { amount: number; cumulative: number }> = {};
      const sortedLines = [...lines].sort((a, b) => a.date.localeCompare(b.date));
      let cumulative = 0;
      sortedLines.forEach(l => {
        const key = toMonthKey(l.date);
        if (!monthMap[key]) monthMap[key] = { amount: 0, cumulative: 0 };
        monthMap[key].amount += l.debit;
        cumulative += l.debit;
        monthMap[key].cumulative = cumulative;
      });
      const monthly = Object.entries(monthMap).map(([month, data]) => ({
        month,
        amount: Math.round(data.amount),
        cumulative: Math.round(data.cumulative),
      }));

      // Recent entries
      const recent = lines.slice(0, 10).map(l => ({
        id: l.id,
        date: l.date,
        journalEntry: l.move_id ? (l.move_id as [number, string])[1] : "",
        partner: l.partner_id ? (l.partner_id as [number, string])[1] : "",
        label: l.name || (l.ref || ""),
        debit: Math.round(l.debit),
      }));

      return {
        total: Math.round(total),
        accountCode,
        transactionCount: lines.length,
        monthly,
        recent,
      };
    }),

  /**
   * Partners — customer/supplier list for SOA selector
   */
  partners: publicProcedure
    .input(z.object({
      companyId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const partners = await fetchPartners("both", input?.companyId);
      return partners.map(p => ({
        id: p.id,
        name: p.name,
        type: p.customer_rank > 0 && p.supplier_rank > 0 ? "both" as const
          : p.customer_rank > 0 ? "customer" as const
          : "supplier" as const,
      }));
    }),

  /**
   * Financial Health — aggregated scorecard from all data sources
   */
  health: publicProcedure
    .input(z.object({ companyId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const companyId = input?.companyId;
      const t = today();
      const yearAgo = new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().slice(0, 10);

      // Fetch all data in parallel
      const [bankBalances, receivables, payables, revenue, cogs] = await Promise.all([
        fetchBankBalances(companyId),
        fetchOpenReceivables(companyId),
        fetchOpenPayables(companyId),
        fetchRevenueTotal(companyId, yearAgo, t),
        fetchCOGSTotal(companyId, yearAgo, t),
      ]);

      const fxToEGP2: Record<string, number> = { USD: 49, AED: 13.35, EUR: 53, GBP: 62 };
      const totalCash = bankBalances.reduce((s, b) => {
        const rate = fxToEGP2[b.currency] || 1;
        return s + b.balance * rate;
      }, 0);
      const totalAR = receivables.reduce((s, inv) => s + inv.amount_residual, 0);
      const totalAP = payables.reduce((s, b) => s + b.amount_residual, 0);

      const dso = revenue > 0 ? Math.round((totalAR / revenue) * 365) : 0;
      const dpo = cogs > 0 ? Math.round((totalAP / cogs) * 365) : 0;
      // DIO — approximate from inventory if available, otherwise use 40 as default
      const dio = 40;
      const ccc = dso + dio - dpo;
      const cashGap = dso - dpo;

      const cr = totalAP > 0 ? Math.round(((totalCash + totalAR) / totalAP) * 100) / 100 : 99;
      const qr = totalAP > 0 ? Math.round((totalCash / totalAP) * 100) / 100 : 99;

      // Aging for bad debt
      const agingD90 = receivables.filter(inv => {
        const due = inv.invoice_date_due || inv.date;
        return daysBetween(due, t) > 90;
      }).reduce((s, inv) => s + inv.amount_residual, 0);
      const agingD61 = receivables.filter(inv => {
        const due = inv.invoice_date_due || inv.date;
        const d = daysBetween(due, t);
        return d > 60 && d <= 90;
      }).reduce((s, inv) => s + inv.amount_residual, 0);
      const agingD31 = receivables.filter(inv => {
        const due = inv.invoice_date_due || inv.date;
        const d = daysBetween(due, t);
        return d > 30 && d <= 60;
      }).reduce((s, inv) => s + inv.amount_residual, 0);
      const badDebt = Math.round(agingD90 * 0.5 + agingD61 * 0.2 + agingD31 * 0.05);

      // Top customer concentration
      const customerMap: Record<string, number> = {};
      receivables.forEach(inv => {
        const name = inv.partner_id ? (inv.partner_id as [number, string])[1] : "Unknown";
        customerMap[name] = (customerMap[name] || 0) + inv.amount_residual;
      });
      const topCustomerPct = totalAR > 0
        ? Math.round((Math.max(...Object.values(customerMap), 0) / totalAR) * 1000) / 10
        : 0;

      // Risk signals
      const risks: Array<{ label: string; value: string; status: "ok" | "warning" | "danger" }> = [];
      risks.push({ label: "Current Ratio", value: cr.toFixed(2), status: cr >= 1.5 ? "ok" : cr >= 1 ? "warning" : "danger" });
      risks.push({ label: "Quick Ratio", value: qr.toFixed(2), status: qr >= 1 ? "ok" : qr >= 0.5 ? "warning" : "danger" });
      risks.push({ label: "Cash Gap", value: `${cashGap}d`, status: cashGap <= 0 ? "ok" : cashGap <= 10 ? "warning" : "danger" });
      risks.push({ label: "Top Customer", value: `${topCustomerPct}%`, status: topCustomerPct < 25 ? "ok" : topCustomerPct < 40 ? "warning" : "danger" });
      risks.push({ label: "Bad Debt Est.", value: `${Math.round(badDebt).toLocaleString()}`, status: badDebt < totalAR * 0.05 ? "ok" : badDebt < totalAR * 0.15 ? "warning" : "danger" });

      return {
        totalCash: Math.round(totalCash),
        totalAR: Math.round(totalAR),
        totalAP: Math.round(totalAP),
        revenue: Math.round(revenue),
        cogs: Math.round(cogs),
        dso,
        dpo,
        dio,
        ccc,
        cashGap,
        cr,
        qr,
        badDebt,
        topCustomerPct,
        risks,
      };
    }),

  /**
   * Sales Analytics — sales per customer during a period.
   * Uses account.move (out_invoice) + account.move.line for tonnage (quantity in kg ÷ 1000).
   * Looks up sale.order by name (invoice_origin) for number_of_loads and x_studio_ultimate_customer.
   */
  salesAnalytics: publicProcedure
    .input(z.object({
      companyId: z.number().optional(),
      period: z.string().default("90d"),
      customFrom: z.string().optional(),
      customTo: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { executeKw } = await import("../odoo");
      const { from, to } = periodDates(input.period, input.customFrom, input.customTo);

      // Step 1: Fetch posted out_invoices in the period for the company
      const invDomain: unknown[][] = [
        ["move_type", "=", "out_invoice"],
        ["state", "=", "posted"],
        ["invoice_date", ">=", from],
        ["invoice_date", "<=", to],
      ];
      if (input.companyId) invDomain.push(["company_id", "=", input.companyId]);

      const invoices = await executeKw<Record<string, any>[]>("account.move", "search_read",
        [invDomain],
        { fields: ["id", "name", "invoice_date", "partner_id", "currency_id", "amount_total", "invoice_origin"], limit: 2000 }
      );
      console.log(`[salesAnalytics] companyId=${input.companyId}, period=${from}..${to}, invoices=${invoices.length}`);

      // Step 2: Fetch invoice lines for all invoices (product lines only)
      const invoiceIds = invoices.map(inv => inv.id);
      let allInvLines: Record<string, any>[] = [];
      if (invoiceIds.length > 0) {
        allInvLines = await executeKw<Record<string, any>[]>("account.move.line", "search_read",
          [[["move_id", "in", invoiceIds], ["display_type", "=", "product"]]],
          { fields: ["id", "move_id", "product_id", "quantity", "product_uom_id", "price_subtotal", "currency_id"], limit: 10000 }
        );
      }
      console.log(`[salesAnalytics] invoice lines fetched: ${allInvLines.length}`);

      // Step 3: Look up sale.orders by name (invoice_origin) for number_of_loads + ultimate customer
      const soNames = [...new Set(invoices.map(inv => inv.invoice_origin).filter(Boolean))];
      const soByName: Record<string, Record<string, any>> = {};
      if (soNames.length > 0) {
        try {
          const sos = await executeKw<Record<string, any>[]>("sale.order", "search_read",
            [[["name", "in", soNames]]],
            { fields: ["id", "name", "number_of_loads", "x_studio_ultimate_customer"], limit: 500 }
          );
          for (const so of sos) soByName[so.name] = so;
        } catch (e) {
          console.warn("[salesAnalytics] Could not read sale.orders by name:", e);
        }
      }

      // Build invoice → SO map
      const invSoMap: Record<number, Record<string, any>> = {};
      for (const inv of invoices) {
        if (inv.invoice_origin && soByName[inv.invoice_origin]) {
          invSoMap[inv.id] = soByName[inv.invoice_origin];
        }
      }

      // Build invoice → invoice data map
      const invMap: Record<number, Record<string, any>> = {};
      for (const inv of invoices) invMap[inv.id] = inv;

      // Helper: strip customer code prefix
      const cleanName = (raw: string) => {
        const m = raw.match(/^\d+\s*[-–]\s*(.+)$/i);
        return m ? m[1].trim() : raw.trim();
      };

      // Aggregate by customer
      type CustData = {
        name: string;
        invoiceIds: Set<number>;
        totalTons: number;
        totalContainers: number;
        totalAmount: number;
        currency: string;
        products: Record<string, { tons: number; containers: number; amount: number }>;
        monthly: Record<string, { tons: number; invoiceIds: Set<number>; containers: number; amount: number }>;
      };
      const custMap: Record<string, CustData> = {};
      const monthlyAll: Record<string, { tons: number; invoiceIds: Set<number>; containers: number; amount: number }> = {};

      for (const l of allInvLines) {
        const invId = Array.isArray(l.move_id) ? l.move_id[0] : l.move_id;
        const inv = invMap[invId];
        if (!inv) continue;

        const rawName = Array.isArray(inv.partner_id) ? inv.partner_id[1] : "Unknown";
        const name = cleanName(String(rawName || "Unknown"));
        const dateStr = inv.invoice_date ? String(inv.invoice_date).slice(0, 10) : "";
        const monthKey = dateStr ? toMonthKey(dateStr) : "Unknown";

        // Tonnage: quantity in kg ÷ 1000
        const qty = typeof l.quantity === "number" ? l.quantity : 0;
        const tons = qty / 1000;

        const amount = typeof l.price_subtotal === "number" ? l.price_subtotal : 0;
        const cur = Array.isArray(inv.currency_id) ? inv.currency_id[1] : "USD";
        const prodName = Array.isArray(l.product_id) ? l.product_id[1] : "Unknown";

        if (!custMap[name]) {
          custMap[name] = { name, invoiceIds: new Set(), totalTons: 0, totalContainers: 0, totalAmount: 0, currency: cur, products: {}, monthly: {} };
        }
        const c = custMap[name];
        c.invoiceIds.add(invId);
        c.totalTons += tons;
        c.totalAmount += amount;

        if (!c.products[prodName]) c.products[prodName] = { tons: 0, containers: 0, amount: 0 };
        c.products[prodName].tons += tons;
        c.products[prodName].amount += amount;

        if (monthKey !== "Unknown") {
          if (!c.monthly[monthKey]) c.monthly[monthKey] = { tons: 0, invoiceIds: new Set(), containers: 0, amount: 0 };
          c.monthly[monthKey].tons += tons;
          c.monthly[monthKey].invoiceIds.add(invId);
          c.monthly[monthKey].amount += amount;

          if (!monthlyAll[monthKey]) monthlyAll[monthKey] = { tons: 0, invoiceIds: new Set(), containers: 0, amount: 0 };
          monthlyAll[monthKey].tons += tons;
          monthlyAll[monthKey].invoiceIds.add(invId);
          monthlyAll[monthKey].amount += amount;
        }
      }

      // Step 4: Add container counts from sale.order.number_of_loads (per SO, not per invoice)
      const ultimateMap: Record<string, { tons: number; amount: number; invoiceIds: Set<number> }> = {};
      const processedSOs = new Set<string>(); // avoid double-counting containers per SO

      for (const c of Object.values(custMap)) {
        for (const invId of c.invoiceIds) {
          const inv = invMap[invId];
          const so = invSoMap[invId];
          const soName = inv?.invoice_origin || "";

          if (so && !processedSOs.has(soName)) {
            const containers = typeof so.number_of_loads === "number" ? so.number_of_loads : 0;
            c.totalContainers += containers;
            processedSOs.add(soName);

            const dateStr = inv?.invoice_date ? String(inv.invoice_date).slice(0, 10) : "";
            const mk = dateStr ? toMonthKey(dateStr) : "Unknown";
            if (mk !== "Unknown" && c.monthly[mk]) c.monthly[mk].containers += containers;
            if (mk !== "Unknown" && monthlyAll[mk]) monthlyAll[mk].containers += containers;
          }
        }
      }

      // Build ultimate customer map from sale.order x_studio_ultimate_customer (via invoice_origin)
      for (const inv of invoices) {
        const so = invSoMap[inv.id];
        const rawUC = so?.x_studio_ultimate_customer;
        if (!rawUC) continue;
        const ucName = cleanName(String(rawUC).trim());
        if (!ucName) continue;

        // Sum tons and amount from this invoice's lines
        const invLines = allInvLines.filter(l => (Array.isArray(l.move_id) ? l.move_id[0] : l.move_id) === inv.id);
        let ucTons = 0, ucAmount = 0;
        for (const l of invLines) {
          ucTons += (typeof l.quantity === "number" ? l.quantity : 0) / 1000;
          ucAmount += typeof l.price_subtotal === "number" ? l.price_subtotal : 0;
        }

        if (!ultimateMap[ucName]) ultimateMap[ucName] = { tons: 0, amount: 0, invoiceIds: new Set() };
        ultimateMap[ucName].tons += ucTons;
        ultimateMap[ucName].amount += ucAmount;
        ultimateMap[ucName].invoiceIds.add(inv.id);
      }

      // Sort customers by totalTons descending (fallback to invoice count)
      const customers = Object.values(custMap).sort((a, b) =>
        b.totalTons !== a.totalTons ? b.totalTons - a.totalTons : b.invoiceIds.size - a.invoiceIds.size
      );

      // Overall totals
      const totalTons = customers.reduce((s, c) => s + c.totalTons, 0);
      const totalShipments = customers.reduce((s, c) => s + c.invoiceIds.size, 0);
      const totalContainers = customers.reduce((s, c) => s + c.totalContainers, 0);
      const totalAmount = customers.reduce((s, c) => s + c.totalAmount, 0);

      // Sort months chronologically
      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const sortMonths = <T extends { month: string }>(arr: T[]): T[] =>
        arr.sort((a, b) => {
          const [aM, aY] = a.month.split(" ");
          const [bM, bY] = b.month.split(" ");
          return (monthNames.indexOf(aM) + parseInt(aY) * 12) - (monthNames.indexOf(bM) + parseInt(bY) * 12);
        });

      const monthlyArr = sortMonths(
        Object.entries(monthlyAll).map(([month, data]) => ({
          month,
          tons: data.tons,
          orders: data.invoiceIds.size,
          containers: data.containers,
          amount: data.amount,
        }))
      );

      // Build ultimate customer array sorted by tons
      const totalUCTons = Object.values(ultimateMap).reduce((s, u) => s + u.tons, 0);
      const ultimateCustomers = Object.entries(ultimateMap)
        .map(([name, d]) => ({
          name,
          tons: d.tons,
          amount: d.amount,
          orderCount: d.invoiceIds.size,
          pctTons: totalUCTons > 0 ? (d.tons / totalUCTons * 100) : 0,
        }))
        .sort((a, b) => b.tons - a.tons);

      return {
        from,
        to,
        totalTons,
        totalAmount,
        totalOrders: totalShipments,
        totalContainers,
        customerCount: customers.length,
        customers: customers.map(c => ({
          name: c.name,
          orderCount: c.invoiceIds.size,
          totalTons: c.totalTons,
          totalContainers: c.totalContainers,
          totalAmount: c.totalAmount,
          currency: c.currency,
          amountUSD: c.totalAmount,
          pctTons: totalTons > 0 ? (c.totalTons / totalTons * 100) : 0,
          pctAmount: totalAmount > 0 ? (c.totalAmount / totalAmount * 100) : 0,
          topProducts: Object.entries(c.products)
            .map(([name, d]) => ({ name, ...d }))
            .sort((a, b) => b.tons - a.tons)
            .slice(0, 5),
          monthly: sortMonths(
            Object.entries(c.monthly).map(([month, d]) => ({
              month,
              tons: d.tons,
              orders: d.invoiceIds.size,
              containers: d.containers,
              amount: d.amount,
            }))
          ),
        })),
        monthly: monthlyArr,
        ultimateCustomers,
      };
    }),
});
