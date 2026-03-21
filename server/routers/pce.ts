/**
 * Petty Cash & Expenses tRPC Router
 *
 * Uses 2 Odoo models (hr.expense.sheet removed — no accounting/ledger):
 * 1. pf.petty.cash (custom) — Petty cash transactions (top-ups, deductions, adjustments)
 *    States: draft, confirmed
 *    Types: top_up, expense_deduction, adjustment
 * 2. pf.petty.cash.request (custom) — Top-up requests from employees
 *    States: submitted (Pending Review), approved, refused
 *
 * Petty Cash flow: request → approve → top_up transaction created (balance increases)
 * Expense flow: create expense_deduction transaction → confirm → balance decreases
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  // pf.petty.cash
  fetchPCEEmployees,
  fetchPettyCashTransactions,
  fetchPettyCashById,
  fetchPettyCashByType,
  createPettyCashTransaction,
  confirmPettyCashTransaction,
  deletePettyCashTransaction,
  // Expense state transitions
  submitExpenseDeduction,
  approveExpenseDeduction,
  payExpenseDeduction,
  refuseExpenseDeduction,
  resetExpenseDeduction,
  // pf.petty.cash.request
  fetchPettyCashRequests,
  fetchPettyCashRequestById,
  createPettyCashRequest,
  approvePettyCashRequest,
  refusePettyCashRequest,
} from "../odoo-expenses";
import { getDb } from "../db";
import { pceReminders } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const pceRouter = router({
  // ── Employees (lightweight) ─────────────────────────────────────────────
  employees: publicProcedure
    .input(z.object({ companyId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const emps = await fetchPCEEmployees(input?.companyId);
      return emps.map((e) => ({
        id: e.id,
        name: e.name,
        job: typeof e.job_title === "string" ? e.job_title : "",
        companyId: Array.isArray(e.company_id) ? e.company_id[0] : 0,
        companyName: Array.isArray(e.company_id) ? e.company_id[1] : "",
        departmentId: Array.isArray(e.department_id) ? e.department_id[0] : 0,
        departmentName: Array.isArray(e.department_id) ? e.department_id[1] : "",
      }));
    }),

  // ═══════════════════════════════════════════════════════════════════════
  // EXPENSE DEDUCTIONS — pf.petty.cash (transaction_type = 'expense_deduction')
  // States: draft → submitted → approved → paid (or refused at any stage)
  // Balance decreases when expense deduction is confirmed/paid
  // ═══════════════════════════════════════════════════════════════════════

  expenses: publicProcedure
    .input(
      z.object({
        companyId: z.number().optional(),
        employeeId: z.number().optional(),
        state: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const txs = await fetchPettyCashByType(
        "expense_deduction",
        input?.employeeId,
        input?.companyId,
        input?.state
      );
      return txs.map((t) => {
        const empDisplay = Array.isArray(t.employee_id) ? t.employee_id[1] : "";
        return {
          id: t.id,
          name: t.name,
          employeeId: Array.isArray(t.employee_id) ? t.employee_id[0] : 0,
          employeeName: empDisplay,
          amount: t.amount,
          date: t.date,
          state: t.state,
          balanceAfter: t.balance_after,
          currencyId: Array.isArray(t.currency_id) ? t.currency_id[0] : 0,
          currencyName: Array.isArray(t.currency_id) ? t.currency_id[1] : "",
          notes: typeof t.notes === "string" ? t.notes : "",
          reference: typeof t.reference === "string" ? t.reference : "",
          createdBy: Array.isArray(t.created_by) ? t.created_by[1] : "",
          createDate: t.create_date,
          attachmentCount: t.message_attachment_count || 0,
        };
      });
    }),

  expenseDetail: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const t = await fetchPettyCashById(input.id);
      if (!t) return null;
      const empDisplay = Array.isArray(t.employee_id) ? t.employee_id[1] : "";
      return {
        id: t.id,
        name: t.name,
        employeeId: Array.isArray(t.employee_id) ? t.employee_id[0] : 0,
        employeeName: empDisplay,
        amount: t.amount,
        date: t.date,
        state: t.state,
        balanceAfter: t.balance_after,
        currencyId: Array.isArray(t.currency_id) ? t.currency_id[0] : 0,
        currencyName: Array.isArray(t.currency_id) ? t.currency_id[1] : "",
        notes: typeof t.notes === "string" ? t.notes : "",
        reference: typeof t.reference === "string" ? t.reference : "",
        createdBy: Array.isArray(t.created_by) ? t.created_by[1] : "",
        createDate: t.create_date,
      };
    }),

  createExpense: publicProcedure
    .input(
      z.object({
        employeeId: z.number(),
        amount: z.number(),
        date: z.string(),
        name: z.string(),
        notes: z.string().optional(),
        reference: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await createPettyCashTransaction({
        employee_id: input.employeeId,
        amount: input.amount,
        date: input.date,
        transaction_type: "expense_deduction",
        name: input.name,
        notes: input.notes,
        reference: input.reference,
      });
      // Auto-submit: expenses skip Draft and go straight to "submitted" (Pending Review)
      await submitExpenseDeduction(id);
      return { id, success: true };
    }),

  confirmExpense: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const ok = await confirmPettyCashTransaction(input.id);
      return { success: ok };
    }),

  submitExpense: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const ok = await submitExpenseDeduction(input.id);
      return { success: ok };
    }),

  approveExpense: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const ok = await approveExpenseDeduction(input.id);
      return { success: ok };
    }),

  payExpense: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const ok = await payExpenseDeduction(input.id);
      return { success: ok };
    }),

  refuseExpense: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const ok = await refuseExpenseDeduction(input.id);
      return { success: ok };
    }),

  resetExpense: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const ok = await resetExpenseDeduction(input.id);
      return { success: ok };
    }),

  deleteExpense: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const ok = await deletePettyCashTransaction(input.id);
      return { success: ok };
    }),

  // ═══════════════════════════════════════════════════════════════════════
  // PETTY CASH TRANSACTIONS — pf.petty.cash (all types)
  // States: draft | confirmed
  // Types: top_up | expense_deduction | adjustment
  // ═══════════════════════════════════════════════════════════════════════

  pettyCash: publicProcedure
    .input(
      z.object({
        companyId: z.number().optional(),
        employeeId: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const txs = await fetchPettyCashTransactions(input?.employeeId, input?.companyId);
      return txs.map((t) => ({
        id: t.id,
        name: t.name,
        employeeId: Array.isArray(t.employee_id) ? t.employee_id[0] : 0,
        employeeName: Array.isArray(t.employee_id) ? t.employee_id[1] : "",
        amount: t.amount,
        date: t.date,
        type: t.transaction_type,
        state: t.state,
        balanceAfter: t.balance_after,
        currencyId: Array.isArray(t.currency_id) ? t.currency_id[0] : 0,
        currencyName: Array.isArray(t.currency_id) ? t.currency_id[1] : "",
        expenseSheetId: Array.isArray(t.expense_sheet_id) ? t.expense_sheet_id[0] : null,
        expenseSheetName: Array.isArray(t.expense_sheet_id) ? t.expense_sheet_id[1] : "",
        notes: typeof t.notes === "string" ? t.notes : "",
        reference: typeof t.reference === "string" ? t.reference : "",
        createdBy: Array.isArray(t.created_by) ? t.created_by[1] : "",
        createDate: t.create_date,
      }));
    }),

  createPettyCash: publicProcedure
    .input(
      z.object({
        employeeId: z.number(),
        amount: z.number(),
        date: z.string(),
        type: z.enum(["top_up", "expense_deduction", "adjustment"]),
        name: z.string(),
        notes: z.string().optional(),
        reference: z.string().optional(),
        expenseSheetId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await createPettyCashTransaction({
        employee_id: input.employeeId,
        amount: input.amount,
        date: input.date,
        transaction_type: input.type,
        name: input.name,
        notes: input.notes,
        reference: input.reference,
        expense_sheet_id: input.expenseSheetId,
      });
      return { id, success: true };
    }),

  confirmPettyCash: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const ok = await confirmPettyCashTransaction(input.id);
      return { success: ok };
    }),

  deletePettyCash: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const ok = await deletePettyCashTransaction(input.id);
      return { success: ok };
    }),

  // ═══════════════════════════════════════════════════════════════════════
  // DIRECT TOP-UP — admin/accountant creates + confirms top-up in one step
  // ═══════════════════════════════════════════════════════════════════════

  directTopUp: publicProcedure
    .input(
      z.object({
        employeeId: z.number(),
        amount: z.number().positive(),
        reason: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // 1. Create a top_up transaction
      const today = new Date().toISOString().slice(0, 10);
      const id = await createPettyCashTransaction({
        employee_id: input.employeeId,
        amount: input.amount,
        date: today,
        transaction_type: "top_up",
        name: input.reason,
        notes: input.notes || "Direct top-up by admin",
      });
      // 2. Auto-confirm to update balance immediately
      await confirmPettyCashTransaction(id);
      return { id, success: true };
    }),

  // ═══════════════════════════════════════════════════════════════════════
  // TOP-UP REQUESTS — pf.petty.cash.request (custom Odoo)
  // States: submitted (Pending Review) | approved | refused
  // ═══════════════════════════════════════════════════════════════════════

  requests: publicProcedure
    .input(
      z.object({
        companyId: z.number().optional(),
        state: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const reqs = await fetchPettyCashRequests(input?.companyId, input?.state);
      return reqs.map((r) => {
        // Extract company name from employee_id display name (e.g. "Administrator - ADGM-PLATFARM...")
        const empDisplay = Array.isArray(r.employee_id) ? r.employee_id[1] : "";
        const dashIdx = empDisplay.indexOf(" - ");
        const empName = dashIdx >= 0 ? empDisplay.substring(0, dashIdx) : empDisplay;
        const companyName = dashIdx >= 0 ? empDisplay.substring(dashIdx + 3) : "";
        return {
          id: r.id,
          name: r.name,
          employeeId: Array.isArray(r.employee_id) ? r.employee_id[0] : 0,
          employeeName: empName,
          companyName,
          requestedAmount: r.requested_amount,
          approvedAmount: r.approved_amount,
          // Aliases for frontend compatibility
          amount: r.requested_amount,
          purpose: r.reason || "",
          requestDate: r.create_date,
          createdAt: r.create_date,
          currencyName: Array.isArray(r.currency_id) ? r.currency_id[1] : "EGP",
          reason: r.reason || "",
          rejectionReason: typeof r.rejection_reason === "string" ? r.rejection_reason : "",
          state: r.state,
          clientRef: typeof r.client_ref === "string" ? r.client_ref : "",
          pettyCashId: Array.isArray(r.petty_cash_id) ? r.petty_cash_id[0] : null,
          pettyCashName: Array.isArray(r.petty_cash_id) ? r.petty_cash_id[1] : "",
          reviewedBy: Array.isArray(r.reviewed_by) ? r.reviewed_by[1] : "",
          reviewedDate: typeof r.reviewed_date === "string" ? r.reviewed_date : null,
          notes: typeof r.notes === "string" ? r.notes : "",
          createDate: r.create_date,
          attachmentCount: r.message_attachment_count || 0,
        };
      });
    }),

  requestDetail: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const r = await fetchPettyCashRequestById(input.id);
      if (!r) return null;
      const empDisplay = Array.isArray(r.employee_id) ? r.employee_id[1] : "";
      const dashIdx = empDisplay.indexOf(" - ");
      const empName = dashIdx >= 0 ? empDisplay.substring(0, dashIdx) : empDisplay;
      const companyName = dashIdx >= 0 ? empDisplay.substring(dashIdx + 3) : "";
      return {
        id: r.id,
        name: r.name,
        employeeId: Array.isArray(r.employee_id) ? r.employee_id[0] : 0,
        employeeName: empName,
        companyName,
        requestedAmount: r.requested_amount,
        approvedAmount: r.approved_amount,
        amount: r.requested_amount,
        purpose: r.reason || "",
        requestDate: r.create_date,
        createdAt: r.create_date,
        currencyName: Array.isArray(r.currency_id) ? r.currency_id[1] : "EGP",
        reason: r.reason || "",
        rejectionReason: typeof r.rejection_reason === "string" ? r.rejection_reason : "",
        state: r.state,
        clientRef: typeof r.client_ref === "string" ? r.client_ref : "",
        pettyCashId: Array.isArray(r.petty_cash_id) ? r.petty_cash_id[0] : null,
        pettyCashName: Array.isArray(r.petty_cash_id) ? r.petty_cash_id[1] : "",
        reviewedBy: Array.isArray(r.reviewed_by) ? r.reviewed_by[1] : "",
        reviewedDate: typeof r.reviewed_date === "string" ? r.reviewed_date : null,
        notes: typeof r.notes === "string" ? r.notes : "",
        createDate: r.create_date,
        attachmentCount: r.message_attachment_count || 0,
      };
    }),

  createRequest: publicProcedure
    .input(
      z.object({
        employeeId: z.number(),
        requestedAmount: z.number(),
        reason: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await createPettyCashRequest({
        employee_id: input.employeeId,
        requested_amount: input.requestedAmount,
        reason: input.reason,
        notes: input.notes,
      });
      return { id, success: true };
    }),

  approveRequest: publicProcedure
    .input(z.object({ id: z.number(), approvedAmount: z.number().optional() }))
    .mutation(async ({ input }) => {
      // If approvedAmount not provided, fetch the request to get the requested amount
      let amount = input.approvedAmount;
      if (amount === undefined || amount === null) {
        const req = await fetchPettyCashRequestById(input.id);
        amount = req?.requested_amount ?? 0;
      }
      const ok = await approvePettyCashRequest(input.id, amount);
      return { success: ok };
    }),

  refuseRequest: publicProcedure
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      const ok = await refusePettyCashRequest(input.id, input.reason || "Rejected by admin");
      return { success: ok };
    }),

  // ═══════════════════════════════════════════════════════════════════════
  // REMINDERS — local DB
  // ═══════════════════════════════════════════════════════════════════════

  reminders: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(pceReminders)
      .orderBy(desc(pceReminders.createdAt))
      .limit(200);
  }),

  createReminder: publicProcedure
    .input(
      z.object({
        employeeId: z.number(),
        employeeName: z.string(),
        freq: z.enum(["daily", "weekly", "monthly"]),
        hour: z.number().min(0).max(23),
        dow: z.number().min(0).max(6).optional(),
        dom: z.number().min(1).max(31).optional(),
        message: z.string(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [result] = await db.insert(pceReminders).values({
        employeeId: input.employeeId,
        employeeName: input.employeeName,
        freq: input.freq,
        hour: input.hour,
        dow: input.dow ?? 0,
        dom: input.dom ?? 1,
        message: input.message,
        active: input.active ?? true,
      });
      return { id: result.insertId, success: true };
    }),

  updateReminder: publicProcedure
    .input(
      z.object({
        id: z.number(),
        employeeId: z.number().optional(),
        employeeName: z.string().optional(),
        freq: z.enum(["daily", "weekly", "monthly"]).optional(),
        hour: z.number().min(0).max(23).optional(),
        dow: z.number().min(0).max(6).optional(),
        dom: z.number().min(1).max(31).optional(),
        message: z.string().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...vals } = input;
      const updateVals: Record<string, unknown> = { ...vals, updatedAt: new Date() };
      Object.keys(updateVals).forEach((k) => {
        if (updateVals[k] === undefined) delete updateVals[k];
      });
      await db.update(pceReminders).set(updateVals).where(eq(pceReminders.id, id));
      return { success: true };
    }),

  deleteReminder: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(pceReminders).where(eq(pceReminders.id, input.id));
      return { success: true };
    }),

  toggleReminder: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [rem] = await db
        .select()
        .from(pceReminders)
        .where(eq(pceReminders.id, input.id))
        .limit(1);
      if (!rem) throw new Error("Reminder not found");
      await db
        .update(pceReminders)
        .set({ active: !rem.active, updatedAt: new Date() })
        .where(eq(pceReminders.id, input.id));
      return { success: true, active: !rem.active };
    }),
});
