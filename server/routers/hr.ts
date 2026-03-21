/**
 * HR tRPC Router
 * Exposes Odoo HR data to the frontend via type-safe tRPC procedures.
 * Includes: employees, departments, contracts, leaves, payslips, attendance, expenses.
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { runIncentiveCalculation } from "../odoo-incentives";
import { getLeaveSettingByEmployee, getAllLeaveSettings, upsertLeaveSetting, calculateLeaveBalance, logSalaryChange, getSalaryHistory } from "../db";
import {
  fetchEmployees,
  fetchEmployeeById,
  fetchEmployeeCount,
  createEmployee,
  updateEmployee,
  searchCountryByName,
  fetchDepartments,
  fetchJobs,
  fetchContracts,
  createContract,
  updateContract,
  fetchLeaves,
  createLeave,
  approveLeave,
  refuseLeave,
  fetchLeaveTypes,
  fetchLeaveAllocations,
  createLeaveAllocation,
  validateAllocation,
  fetchPayslips,
  createPayslip,
  fetchAttendance,
  fetchExpenses,
  fetchBonusFines,
  createBonusFine,
  approveBonusFine,
  refuseBonusFine,
  fetchBonusFineTypes,
  fetchHRDashboardStats,
  fetchPeriodicMeetings,
  fetchPeriodicMeetingDetail,
  createPeriodicMeeting,
  updateMeetingActionStatus,
  updateMeetingState,
  getMeetingActions,
  updatePeriodicMeeting,
  addMeetingActionPoint,
  updateMeetingActionDetails,
  clearHRCache,
  uploadEmployeeAttachment,
  fetchEmployeeAttachments,
  deleteEmployeeAttachment,
  updateEmployeeImage,
  getAttachmentData,
} from "../odoo-hr";

// ─── Helper: format Odoo many2one to { id, name } or null ────────────────
function m2o(val: [number, string] | false): { id: number; name: string } | null {
  return val ? { id: val[0], name: val[1] } : null;
}

export const hrRouter = router({
  // ─── Dashboard ──────────────────────────────────────────────────────────
  dashboardStats: publicProcedure
    .input(z.object({ companyId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const stats = await fetchHRDashboardStats(input?.companyId);
      return {
        totalEmployees: stats.totalEmployees,
        presentCount: stats.presentCount,
        absentCount: stats.absentCount,
        pendingLeaves: stats.pendingLeaves,
        totalExpenses: stats.totalExpenses,
        departments: stats.departments.map(d => ({
          id: d.id,
          name: d.name,
          company: m2o(d.company_id),
          manager: m2o(d.manager_id),
          totalEmployee: d.total_employee,
        })),
        leaveTypes: stats.leaveTypes.map(lt => ({
          id: lt.id,
          name: lt.name,
          company: m2o(lt.company_id),
          validationType: lt.leave_validation_type,
        })),
        recentExpenses: stats.recentExpenses.map(e => ({
          id: e.id,
          name: e.name,
          employee: m2o(e.employee_id),
          amount: e.total_amount,
          state: e.state,
          date: e.date,
          company: m2o(e.company_id),
          product: m2o(e.product_id),
          description: e.description || "",
        })),
      };
    }),

  // ─── Employees ──────────────────────────────────────────────────────────
  employees: publicProcedure
    .input(z.object({ companyId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const emps = await fetchEmployees(input?.companyId);
      return emps.map(e => ({
        id: e.id,
        name: e.name,
        jobTitle: e.job_title || "",
        job: m2o(e.job_id),
        department: m2o(e.department_id),
        company: m2o(e.company_id),
        workEmail: e.work_email || "",
        workPhone: e.work_phone || "",
        mobilePhone: e.mobile_phone || "",
        phone: e.phone || "",
        birthday: e.birthday || "",
        gender: e.gender || "",
        marital: e.marital || "",
        children: e.children,
        identificationId: e.identification_id || "",
        passportId: e.passport_id || "",
        visaNo: e.visa_no || "",
        visaExpire: e.visa_expire || "",
        permitNo: e.permit_no || "",
        workPermitExpiration: e.work_permit_expiration_date || "",
        country: m2o(e.country_id),
        countryOfBirth: m2o(e.country_of_birth),
        placeOfBirth: e.place_of_birth || "",
        certificate: e.certificate || "",
        studyField: e.study_field || "",
        studySchool: e.study_school || "",
        emergencyContact: e.emergency_contact || "",
        emergencyPhone: e.emergency_phone || "",
        bankAccount: m2o(e.bank_account_id),
        currentContract: m2o(e.contract_id),
        contractIds: e.contract_ids,
        attendanceState: e.attendance_state || "checked_out",
        presenceState: e.hr_presence_state || "absent",
        allocationCount: e.allocation_count,
        allocationRemaining: e.allocation_remaining_display || "0",
        payslipCount: e.payslip_count,
        employeeType: e.employee_type || "employee",
        active: e.active,
        manager: m2o(e.parent_id),
        coach: m2o(e.coach_id),
        leaveManager: m2o(e.leave_manager_id),
        createDate: e.create_date,
        barcode: e.barcode || "",
        avatar: e.image_128 || "",
      }));
    }),

  employeeById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const e = await fetchEmployeeById(input.id);
      if (!e) return null;
      return {
        id: e.id,
        name: e.name,
        jobTitle: e.job_title || "",
        job: m2o(e.job_id),
        department: m2o(e.department_id),
        company: m2o(e.company_id),
        workEmail: e.work_email || "",
        workPhone: e.work_phone || "",
        mobilePhone: e.mobile_phone || "",
        phone: e.phone || "",
        birthday: e.birthday || "",
        gender: e.gender || "",
        marital: e.marital || "",
        children: e.children,
        identificationId: e.identification_id || "",
        passportId: e.passport_id || "",
        visaNo: e.visa_no || "",
        visaExpire: e.visa_expire || "",
        permitNo: e.permit_no || "",
        workPermitExpiration: e.work_permit_expiration_date || "",
        country: m2o(e.country_id),
        countryOfBirth: m2o(e.country_of_birth),
        placeOfBirth: e.place_of_birth || "",
        certificate: e.certificate || "",
        studyField: e.study_field || "",
        studySchool: e.study_school || "",
        emergencyContact: e.emergency_contact || "",
        emergencyPhone: e.emergency_phone || "",
        bankAccount: m2o(e.bank_account_id),
        currentContract: m2o(e.contract_id),
        contractIds: e.contract_ids,
        attendanceState: e.attendance_state || "checked_out",
        presenceState: e.hr_presence_state || "absent",
        allocationCount: e.allocation_count,
        allocationRemaining: e.allocation_remaining_display || "0",
        payslipCount: e.payslip_count,
        employeeType: e.employee_type || "employee",
        active: e.active,
        manager: m2o(e.parent_id),
        coach: m2o(e.coach_id),
        leaveManager: m2o(e.leave_manager_id),
        createDate: e.create_date,
        barcode: e.barcode || "",
        avatar: e.image_128 || "",
      };
    }),

  createEmployee: publicProcedure
    .input(z.object({
      name: z.string(),
      job_title: z.string().optional(),
      job_id: z.number().optional(),
      department_id: z.number().optional(),
      company_id: z.number(),
      work_email: z.string().optional(),
      work_phone: z.string().optional(),
      mobile_phone: z.string().optional(),
      birthday: z.string().optional(),
      gender: z.string().optional(),
      marital: z.string().optional(),
      identification_id: z.string().optional(),
      passport_id: z.string().optional(),
      emergency_contact: z.string().optional(),
      emergency_phone: z.string().optional(),
      country_id: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const vals: Record<string, unknown> = { name: input.name, company_id: input.company_id };
      if (input.job_title) vals.job_title = input.job_title;
      if (input.job_id) vals.job_id = input.job_id;
      if (input.department_id) vals.department_id = input.department_id;
      if (input.work_email) vals.work_email = input.work_email;
      if (input.work_phone) vals.work_phone = input.work_phone;
      if (input.mobile_phone) vals.mobile_phone = input.mobile_phone;
      if (input.birthday) vals.birthday = input.birthday;
      if (input.gender) vals.gender = input.gender;
      if (input.marital) vals.marital = input.marital;
      if (input.identification_id) vals.identification_id = input.identification_id;
      if (input.passport_id) vals.passport_id = input.passport_id;
      if (input.emergency_contact) vals.emergency_contact = input.emergency_contact;
      if (input.emergency_phone) vals.emergency_phone = input.emergency_phone;
      if (input.country_id) vals.country_id = input.country_id;
      const id = await createEmployee(vals);
      return { id };
    }),

  updateEmployee: publicProcedure
    .input(z.object({
      id: z.number(),
      vals: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input }) => {
      const vals = { ...input.vals };
      // Convert country_name -> country_id (Odoo requires country_id, not country_name)
      if (vals.country_name && typeof vals.country_name === 'string') {
        const countryId = await searchCountryByName(vals.country_name);
        delete vals.country_name;
        if (countryId) vals.country_id = countryId;
      }
      // Validate barcode: Odoo requires alphanumeric, max 18 chars
      if (vals.barcode && typeof vals.barcode === 'string') {
        const cleaned = vals.barcode.replace(/[^a-zA-Z0-9]/g, '').slice(0, 18);
        vals.barcode = cleaned || false;
      }
      await updateEmployee(input.id, vals);
      clearHRCache(); // invalidate so next load gets fresh data
      return { success: true };
    }),

  // ─── Departments ────────────────────────────────────────────────────────
  departments: publicProcedure
    .input(z.object({ companyId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const depts = await fetchDepartments(input?.companyId);
      return depts.map(d => ({
        id: d.id,
        name: d.name,
        company: m2o(d.company_id),
        manager: m2o(d.manager_id),
        totalEmployee: d.total_employee,
      }));
    }),

  // ─── Job Positions ──────────────────────────────────────────────────────
  jobs: publicProcedure
    .input(z.object({ companyId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const jobs = await fetchJobs(input?.companyId);
      return jobs.map(j => ({
        id: j.id,
        name: j.name,
        department: m2o(j.department_id),
        company: m2o(j.company_id),
        employeeCount: j.no_of_employee,
        recruitmentCount: j.no_of_recruitment,
      }));
    }),

  // ─── Contracts ──────────────────────────────────────────────────────────
  contracts: publicProcedure
    .input(z.object({ employeeId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const contracts = await fetchContracts(input?.employeeId);
      return contracts.map(c => ({
        id: c.id,
        name: c.name,
        employee: m2o(c.employee_id),
        state: c.state,
        dateStart: c.date_start || "",
        dateEnd: c.date_end || "",
        wage: c.wage,
        job: m2o(c.job_id),
        department: m2o(c.department_id),
        company: m2o(c.company_id),
        structureType: m2o(c.structure_type_id),
        responsible: m2o(c.hr_responsible_id),
        workSchedule: m2o(c.resource_calendar_id),
        notes: c.notes || "",
        egHousingAllowance: c.l10n_eg_housing_allowance || 0,
        egTransportAllowance: c.l10n_eg_transportation_allowance || 0,
        egOtherAllowances: c.l10n_eg_other_allowances || 0,
        aeHousingAllowance: c.l10n_ae_housing_allowance || 0,
        aeTransportAllowance: c.l10n_ae_transportation_allowance || 0,
        aeOtherAllowances: c.l10n_ae_other_allowances || 0,
        socialInsurance: c.l10n_eg_social_insurance || 0,
      }));
    }),

  createContract: publicProcedure
    .input(z.object({
      employee_id: z.number(),
      name: z.string(),
      date_start: z.string(),
      date_end: z.string().optional(),
      wage: z.number(),
      job_id: z.number().optional(),
      department_id: z.number().optional(),
      structure_type_id: z.number().optional(),
      l10n_eg_housing_allowance: z.number().optional(),
      l10n_eg_transportation_allowance: z.number().optional(),
      l10n_eg_other_allowances: z.number().optional(),
      l10n_ae_housing_allowance: z.number().optional(),
      l10n_ae_transportation_allowance: z.number().optional(),
      l10n_ae_other_allowances: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await createContract(input);
      clearHRCache();
      return { id };
    }),
  updateContract: publicProcedure
    .input(z.object({
      id: z.number(),
      vals: z.object({
        date_start: z.string().optional(),
        date_end: z.union([z.string(), z.literal(false)]).optional(),
        wage: z.number().optional(),
        resource_calendar_id: z.number().optional(),
        structure_type_id: z.number().optional(),
        l10n_eg_housing_allowance: z.number().optional(),
        l10n_eg_transportation_allowance: z.number().optional(),
        l10n_eg_other_allowances: z.number().optional(),
        l10n_ae_housing_allowance: z.number().optional(),
        l10n_ae_transportation_allowance: z.number().optional(),
        l10n_ae_other_allowances: z.number().optional(),
        l10n_eg_social_insurance: z.number().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const ok = await updateContract(input.id, input.vals);
      clearHRCache();
      return { success: ok };
    }),
  // ─── Leaves ─────────────────────────────────────────────────────────────
  leaves: publicProcedure
    .input(z.object({
      employeeId: z.number().optional(),
      companyId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const leaves = await fetchLeaves(input?.employeeId, input?.companyId);
      return leaves.map(l => ({
        id: l.id,
        name: l.name || "",
        employee: m2o(l.employee_id),
        leaveType: m2o(l.holiday_status_id),
        dateFrom: l.date_from || "",
        dateTo: l.date_to || "",
        days: l.number_of_days,
        state: l.state,
        company: m2o(l.company_id),
      }));
    }),

  createLeave: publicProcedure
    .input(z.object({
      employee_id: z.number(),
      holiday_status_id: z.number(),
      date_from: z.string(),
      date_to: z.string(),
      name: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Calculate leave days for auto-allocation
      const msPerDay = 86400000;
      const dFrom = new Date(input.date_from);
      const dTo = new Date(input.date_to);
      const leaveDays = Math.max(1, Math.ceil((dTo.getTime() - dFrom.getTime()) / msPerDay));
      try {
        const id = await createLeave(input);
        try { await approveLeave(id); } catch { /* approval may fail if already approved */ }
        clearHRCache();
        return { id };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Auto-allocate if no allocation exists for this leave type
        if (msg.includes('allocation') || msg.includes('balance') || msg.includes('insufficient')) {
          // Use year-wide allocation to cover any date within the year
          const leaveYear = input.date_from.slice(0, 4);
          const allocId = await createLeaveAllocation({
            employee_id: input.employee_id,
            holiday_status_id: input.holiday_status_id,
            number_of_days: 365,
            name: `Portal allocation ${leaveYear} (auto)`,
            date_from: `${leaveYear}-01-01`,
            date_to: `${leaveYear}-12-31`,
          });
          await validateAllocation(allocId);
          const id = await createLeave(input);
          try { await approveLeave(id); } catch { /* approval may fail */ }
          clearHRCache();
          return { id, autoAllocated: true };
        }
        throw err;
      }
    }),
  approveLeave: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await approveLeave(input.id);
      return { success: true };
    }),

  refuseLeave: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await refuseLeave(input.id);
      return { success: true };
    }),

  approveBonusFine: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await approveBonusFine(input.id);
      return { success: true };
    }),

  refuseBonusFine: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await refuseBonusFine(input.id);
      return { success: true };
    }),

  // ─── Leave Types ────────────────────────────────────────────────────────
  leaveTypes: publicProcedure.query(async () => {
    const types = await fetchLeaveTypes();
    return types.map(lt => ({
      id: lt.id,
      name: lt.name,
      company: m2o(lt.company_id),
      validationType: lt.leave_validation_type,
    }));
  }),

  // ─── Leave Allocations ──────────────────────────────────────────────────
  leaveAllocations: publicProcedure
    .input(z.object({ employeeId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const allocs = await fetchLeaveAllocations(input?.employeeId);
      return allocs.map(a => ({
        id: a.id,
        name: a.name || "",
        employee: m2o(a.employee_id),
        leaveType: m2o(a.holiday_status_id),
        days: a.number_of_days,
        state: a.state,
        dateFrom: a.date_from || "",
        dateTo: a.date_to || "",
      }));
    }),

  createLeaveAllocation: publicProcedure
    .input(z.object({
      employee_id: z.number(),
      holiday_status_id: z.number(),
      number_of_days: z.number(),
      name: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await createLeaveAllocation(input);
      return { id };
    }),

  // ─── Payslips ───────────────────────────────────────────────────────────
  payslips: publicProcedure
    .input(z.object({ employeeId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const slips = await fetchPayslips(input?.employeeId);
      return slips.map(p => ({
        id: p.id,
        name: p.name || "",
        number: p.number || "",
        employee: m2o(p.employee_id),
        dateFrom: p.date_from || "",
        dateTo: p.date_to || "",
        state: p.state,
        company: m2o(p.company_id),
        structure: m2o(p.struct_id),
        basicWage: p.basic_wage,
        netWage: p.net_wage,
        grossWage: p.gross_wage,
      }));
    }),

  createPayslip: publicProcedure
    .input(z.object({
      employee_id: z.number(),
      date_from: z.string(),
      date_to: z.string(),
      name: z.string().optional(),
      struct_id: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await createPayslip(input);
      clearHRCache();
      return { id };
    }),

  // ─── Attendance ─────────────────────────────────────────────────────────
  attendance: publicProcedure
    .input(z.object({
      employeeId: z.number().optional(),
      limit: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const recs = await fetchAttendance(input?.employeeId, input?.limit || 50);
      return recs.map(a => ({
        id: a.id,
        employee: m2o(a.employee_id),
        checkIn: a.check_in,
        checkOut: a.check_out || "",
        workedHours: a.worked_hours,
      }));
    }),

  // ─── Expenses ───────────────────────────────────────────────────────────
  expenses: publicProcedure
    .input(z.object({
      employeeId: z.number().optional(),
      companyId: z.number().optional(),
      limit: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const exps = await fetchExpenses(input?.employeeId, input?.companyId, input?.limit || 100);
      return exps.map(e => ({
        id: e.id,
        name: e.name,
        employee: m2o(e.employee_id),
        amount: e.total_amount,
        state: e.state,
        date: e.date,
        company: m2o(e.company_id),
        product: m2o(e.product_id),
        description: e.description || "",
      }));
    }),

  // ─── Bonus & Fines (bonus.fine model) ───────────────────────────────────────────────
  bonusFines: publicProcedure
    .input(z.object({
      employeeId: z.number().optional(),
      companyId: z.number().optional(),
      limit: z.number().optional(),
    }).optional().nullable())
    .query(async ({ input }) => {
      const records = await fetchBonusFines(input?.employeeId, input?.companyId, input?.limit || 200);
      return records.map(r => ({
        id: r.id,
        ref: r.name,
        date: r.date,
        employee: m2o(r.employee_id),
        typeId: m2o(r.type_id),
        typeClass: r.type_class, // 'bonus' | 'fine'
        category: r.category,
        topic: r.topic || "",
        days: r.days,
        dailyRate: r.daily_rate,
        amount: r.final_amount,
        state: r.state,
        company: m2o(r.company_id),
        details: r.details || "",
      }));
    }),

  bonusFineTypes: publicProcedure
    .query(async () => {
      const types = await fetchBonusFineTypes();
      return types
        .filter(t => t.name && t.name.toLowerCase() !== "test")
        .map(t => ({ id: t.id, name: t.name, typeClass: t.type_class }));
    }),

  createBonusFine: publicProcedure
    .input(z.object({
      employee_id: z.number(),
      type_id: z.number(),
      type_class: z.string(), // 'bonus' | 'fine'
      date: z.string(),
      days: z.number().optional(),
      daily_rate: z.number().optional(),
      final_amount: z.number().optional(),
      details: z.string().optional(),
      company_id: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const vals: Record<string, unknown> = {
        employee_id: input.employee_id,
        type_id: input.type_id,
        type_class: input.type_class,
        date: input.date,
        days: input.days || 0,
        daily_rate: input.daily_rate || 0,
        final_amount: input.final_amount || 0,
        details: input.details || false,
      };
      if (input.company_id) vals.company_id = input.company_id;
      const id = await createBonusFine(vals);
      clearHRCache();
      return { id };
    }),

  // ─── Periodic Meetings (periodic.meeting) ───────────────────────────────────
  periodicMeetings: publicProcedure
    .input(z.object({
      companyId: z.number().optional(),
      year: z.number().optional(),
      month: z.number().min(1).max(12).optional(),
      meetingType: z.string().optional(),
      limit: z.number().optional(),
    }).optional().nullable())
    .query(async ({ input }) => {
      const meetings = await fetchPeriodicMeetings({
        companyId: input?.companyId,
        year: input?.year,
        month: input?.month,
        meetingType: input?.meetingType,
        limit: input?.limit || 200,
      });
      return meetings.map(m => ({
        id: m.id,
        ref: m.name,
        date: m.meeting_date,
        type: m.meeting_type,
        topic: m.topic || "",
        details: m.details || "",
        attendeeIds: m.attendee_ids,
        attendeeCount: m.attendee_count,
        state: m.state,
        company: m2o(m.company_id),
        createdBy: m2o(m.user_id),
        actionCount: m.action_count,
      }));
    }),

  // ─── Periodic Meeting Detail ───────────────────────────────────────────────────
  meetingDetail: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const m = await fetchPeriodicMeetingDetail(input.id);
      return {
        id: m.id,
        ref: m.name,
        date: m.meeting_date,
        type: m.meeting_type,
        topic: m.topic || "",
        details: m.details || "",
        attendeeIds: m.attendee_ids,
        attendeeCount: m.attendee_count,
        state: m.state,
        company: m2o(m.company_id),
        createdBy: m2o(m.user_id),
        actionCount: m.action_count,
        actions: m.actions.map(a => ({
          id: a.id,
          sequence: a.sequence,
          name: a.name,
          assignedTo: a.assigned_to ? { id: a.assigned_to[0], name: a.assigned_to[1] } : null,
          dueDate: a.due_date || null,
          status: a.status,
          notes: a.notes || "",
          createDate: a.create_date,
          writeDate: a.write_date,
        })),
      };
    }),

  // ─── Create Meeting ────────────────────────────────────────────────────────────
  createMeeting: publicProcedure
    .input(z.object({
      meeting_date: z.string(),
      meeting_type: z.enum(["weekly", "daily", "adhoc"]),
      topic: z.string().min(1),
      details: z.string().optional(),
      company_id: z.number().optional(),
      attendee_ids: z.array(z.number()).optional(),
      action_points: z.array(z.object({
        name: z.string().min(1),
        assigned_to: z.number().optional(),
        due_date: z.string().optional(),
        notes: z.string().optional(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      const newId = await createPeriodicMeeting(input);
      return { id: newId, success: true };
    }),

  // ─── Update Meeting Action Status ──────────────────────────────────────────────
  updateMeetingAction: publicProcedure
    .input(z.object({
      actionId: z.number(),
      status: z.enum(["pending", "in_progress", "done", "cancelled"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const ok = await updateMeetingActionStatus(input.actionId, input.status, input.notes);
      return { success: ok };
    }),

  // ─── Update Meeting State ──────────────────────────────────────────────────────
  updateMeetingStatus: publicProcedure
    .input(z.object({
      meetingId: z.number(),
      state: z.enum(["draft", "done", "cancelled"]),
    }))
    .mutation(async ({ input }) => {
      const ok = await updateMeetingState(input.meetingId, input.state);
      return { success: ok };
    }),

  // ─── Meeting Actions (Efficiency Dashboard) ───────────────────────────────────
  meetingActions: publicProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const actions = await getMeetingActions(input ?? undefined);
      return actions;
    }),

  // ─── Update Meeting Fields ────────────────────────────────────────────────────
  updateMeeting: publicProcedure
    .input(z.object({
      meetingId: z.number(),
      meeting_date: z.string().optional(),
      meeting_type: z.enum(["weekly", "daily", "adhoc"]).optional(),
      topic: z.string().optional(),
      details: z.string().optional(),
      company_id: z.number().optional(),
      attendee_ids: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input }) => {
      const { meetingId, ...vals } = input;
      const ok = await updatePeriodicMeeting(meetingId, vals);
      return { success: ok };
    }),

  // ─── Add Action Point to Existing Meeting ────────────────────────────────────
  addMeetingAction: publicProcedure
    .input(z.object({
      meetingId: z.number(),
      name: z.string().min(1),
      assigned_to: z.number().optional(),
      due_date: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { meetingId, ...vals } = input;
      const newId = await addMeetingActionPoint(meetingId, vals);
      return { id: newId, success: true };
    }),

  // ─── Update Action Point Details ──────────────────────────────────────────────
  updateMeetingActionDetails: publicProcedure
    .input(z.object({
      actionId: z.number(),
      name: z.string().optional(),
      assigned_to: z.number().nullable().optional(),
      due_date: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      status: z.enum(["pending", "in_progress", "done", "cancelled"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { actionId, ...vals } = input;
      const ok = await updateMeetingActionDetails(actionId, vals);
      return { success: ok };
    }),
  // ─── Incentive Calculation ─────────────────────────────────────────────────────
  runIncentiveCalculation: publicProcedure
    .input(z.object({
      year: z.number(),
      month: z.number().min(1).max(12),
    }))
    .mutation(async ({ input }) => {
      const result = await runIncentiveCalculation(input.year, input.month);
      return result;
    }),

  // ─── Leave Settings (Accrual-based balance) ─────────────────────────────
  getLeaveSettings: publicProcedure
    .input(z.object({ odooEmployeeId: z.number() }))
    .query(async ({ input }) => {
      const setting = await getLeaveSettingByEmployee(input.odooEmployeeId);
      return setting;
    }),

  getAllLeaveSettings: publicProcedure
    .query(async () => {
      return getAllLeaveSettings();
    }),

  upsertLeaveSetting: publicProcedure
    .input(z.object({
      odooEmployeeId: z.number(),
      employeeName: z.string().optional(),
      companyId: z.number().optional(),
      companyName: z.string().optional(),
      joiningDate: z.string(), // YYYY-MM-DD
      annualLeaveDays: z.number().min(0).max(365),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await upsertLeaveSetting(input);
      const result = await getLeaveSettingByEmployee(input.odooEmployeeId);
      return result;
    }),

  calculateLeaveBalance: publicProcedure
    .input(z.object({
      odooEmployeeId: z.number(),
      usedDays: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const setting = await getLeaveSettingByEmployee(input.odooEmployeeId);
      if (!setting) {
        return null; // No settings configured — frontend should use Odoo defaults
      }
      const balance = calculateLeaveBalance(
        setting.joiningDate as unknown as string,
        parseFloat(setting.annualLeaveDays as any),
        input.usedDays
      );
      return {
        ...balance,
        joiningDate: setting.joiningDate,
        annualLeaveDays: parseFloat(setting.annualLeaveDays as any),
      };
    }),

  // ─── Salary History ───────────────────────────────────────────────────────
  getSalaryHistory: publicProcedure
    .input(z.object({ odooEmployeeId: z.number() }))
    .query(async ({ input }) => {
      const rows = await getSalaryHistory(input.odooEmployeeId);
      return rows.map(r => ({
        id: r.id,
        previousWage: parseFloat(r.previousWage as any),
        newWage: parseFloat(r.newWage as any),
        previousHousing: parseFloat(r.previousHousing as any),
        newHousing: parseFloat(r.newHousing as any),
        previousTransport: parseFloat(r.previousTransport as any),
        newTransport: parseFloat(r.newTransport as any),
        previousOther: parseFloat(r.previousOther as any),
        newOther: parseFloat(r.newOther as any),
        currency: r.currency,
        note: r.note ?? '',
        createdAt: r.createdAt,
      }));
    }),

  logSalaryChange: publicProcedure
    .input(z.object({
      odooEmployeeId: z.number(),
      employeeName: z.string(),
      odooContractId: z.number(),
      previousWage: z.number(),
      newWage: z.number(),
      previousHousing: z.number().default(0),
      newHousing: z.number().default(0),
      previousTransport: z.number().default(0),
      newTransport: z.number().default(0),
      previousOther: z.number().default(0),
      newOther: z.number().default(0),
      currency: z.string().default('EGP'),
      note: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await logSalaryChange(input);
      return { success: true };
    }),

  // ─── Employee Documents (ir.attachment) ──────────────────────────────
  employeeDocs: publicProcedure
    .input(z.object({ employeeId: z.number() }))
    .query(async ({ input }) => {
      return fetchEmployeeAttachments(input.employeeId);
    }),

  uploadEmployeeDoc: publicProcedure
    .input(z.object({
      employeeId: z.number(),
      name: z.string(),
      data: z.string(),
      mimeType: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await uploadEmployeeAttachment({
        employeeId: input.employeeId,
        name: input.name,
        data: input.data,
        mimeType: input.mimeType,
        description: input.description,
      });
      clearHRCache();
      return { id, success: true };
    }),

  deleteEmployeeDoc: publicProcedure
    .input(z.object({ attachmentId: z.number() }))
    .mutation(async ({ input }) => {
      await deleteEmployeeAttachment(input.attachmentId);
      clearHRCache();
      return { success: true };
    }),

  updateEmployeePhoto: publicProcedure
    .input(z.object({
      employeeId: z.number(),
      imageBase64: z.string(),
    }))
    .mutation(async ({ input }) => {
      const ok = await updateEmployeeImage(input.employeeId, input.imageBase64);
      clearHRCache();
      return { success: ok };
    }),

  removeEmployeePhoto: publicProcedure
    .input(z.object({ employeeId: z.number() }))
    .mutation(async ({ input }) => {
      const ok = await updateEmployeeImage(input.employeeId, '');
      clearHRCache();
      return { success: ok };
    }),

  getDocContent: publicProcedure
    .input(z.object({ attachmentId: z.number() }))
    .query(async ({ input }) => {
      const data = await getAttachmentData(input.attachmentId);
      return { data };
    }),
});
