import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertInvitation, InsertUser, InsertUserModulePermission, invitations, passwordResetTokens, userModulePermissions, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.

// ── User Management Helpers ───────────────────────────────────────────────────

export async function listAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(users.createdAt);
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? undefined;
}

export async function updateUserRole(userId: number, role: 'admin' | 'user') {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ── Module Permission Helpers ─────────────────────────────────────────────────

export async function getUserPermissions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userModulePermissions).where(eq(userModulePermissions.userId, userId));
}

export async function getAllPermissions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userModulePermissions);
}

export async function setUserModulePermission(
  userId: number,
  moduleId: string,
  perms: { canView: number; canCreate: number; canEdit: number; canDelete: number },
  updatedBy: string
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const existing = await db
    .select()
    .from(userModulePermissions)
    .where(and(eq(userModulePermissions.userId, userId), eq(userModulePermissions.moduleId, moduleId)))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(userModulePermissions)
      .set({ ...perms, updatedBy })
      .where(and(eq(userModulePermissions.userId, userId), eq(userModulePermissions.moduleId, moduleId)));
  } else {
    const row: InsertUserModulePermission = { userId, moduleId, ...perms, updatedBy };
    await db.insert(userModulePermissions).values(row);
  }
}

export async function deleteUserPermissions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(userModulePermissions).where(eq(userModulePermissions.userId, userId));
}

// ── Invitation Helpers ────────────────────────────────────────────────────────

export async function createInvitation(data: InsertInvitation) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.insert(invitations).values(data);
}

export async function getInvitationByToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const rows = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
  return rows[0] ?? null;
}

export async function getInvitationByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const rows = await db.select().from(invitations)
    .where(and(eq(invitations.email, email), eq(invitations.status, 'pending')))
    .limit(1);
  return rows[0] ?? null;
}

export async function listInvitations() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.select().from(invitations).orderBy(invitations.createdAt);
}

export async function updateInvitationStatus(
  token: string,
  status: 'accepted' | 'revoked' | 'expired',
  acceptedByUserId?: number
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(invitations)
    .set({
      status,
      ...(status === 'accepted' ? { acceptedAt: new Date(), acceptedByUserId } : {}),
    })
    .where(eq(invitations.token, token));
}

// ── Custom Auth Helpers ───────────────────────────────────────────────────────
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function createLocalUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin';
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // Use email as openId for local users (prefixed to avoid collision with Manus OAuth openIds)
  const openId = `local:${data.email}`;
  await db.insert(users).values({
    openId,
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
    role: data.role,
    loginMethod: 'email',
    status: 'active',
    lastSignedIn: new Date(),
  });
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0] ?? null;
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(users).set({ passwordHash, status: 'active', updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function updateUserStatus(userId: number, status: 'active' | 'inactive' | 'pending') {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function updateUserLastSignedIn(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

// ── Password Reset Token Helpers ─────────────────────────────────────────────

export async function createPasswordResetToken(data: {
  token: string;
  userId: number;
  email: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.insert(passwordResetTokens).values(data);
}

export async function getPasswordResetToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const rows = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token)).limit(1);
  return rows[0] ?? null;
}

export async function markResetTokenUsed(token: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.token, token));
}

// ── Exchange Rate Helpers ────────────────────────────────────────────────────

import { exchangeRates, InsertExchangeRate } from "../drizzle/schema";

export async function getExchangeRate(fromCurrency: string, toCurrency: string = "USD") {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const rows = await db
    .select()
    .from(exchangeRates)
    .where(and(eq(exchangeRates.fromCurrency, fromCurrency), eq(exchangeRates.toCurrency, toCurrency)))
    .limit(1);
  return rows[0] ?? null;
}

export async function setExchangeRate(fromCurrency: string, toCurrency: string, rate: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const existing = await getExchangeRate(fromCurrency, toCurrency);
  const rateStr = rate.toString();
  if (existing) {
    await db
      .update(exchangeRates)
      .set({ rate: rateStr as any, updatedAt: new Date() })
      .where(and(eq(exchangeRates.fromCurrency, fromCurrency), eq(exchangeRates.toCurrency, toCurrency)));
  } else {
    const data: InsertExchangeRate = { fromCurrency, toCurrency, rate: rateStr as any };
    await db.insert(exchangeRates).values(data);
  }
}

export async function getAllExchangeRates() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.select().from(exchangeRates);
}

export async function convertCurrency(amount: number, fromCurrency: string, toCurrency: string = "USD"): Promise<number> {
  if (fromCurrency === toCurrency) return amount;
  const rate = await getExchangeRate(fromCurrency, toCurrency);
  if (!rate) {
    console.warn(`[Exchange Rate] No rate found for ${fromCurrency} -> ${toCurrency}, returning original amount`);
    return amount;
  }
  return amount * parseFloat(rate.rate.toString());
}

// ── User Company Access Helpers ───────────────────────────────────────────────
import { userCompanyAccess, InsertUserCompanyAccess } from "../drizzle/schema";

/** Get all company access rows for a user */
export async function getUserCompanyAccess(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userCompanyAccess).where(eq(userCompanyAccess.userId, userId));
}

/** Get company access rows for all users (for admin overview) */
export async function getAllUserCompanyAccess() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userCompanyAccess);
}

/**
 * Replace a user's entire company access list.
 * Deletes all existing rows for the user, then inserts the new set.
 * Pass allowedCompanyIds=[] to revert to "all companies" (no restrictions).
 * defaultCompanyId=null means no default (selector will auto-pick Cairo).
 */
export async function setUserCompanyAccess(
  userId: number,
  allowedCompanyIds: number[],
  defaultCompanyId: number | null,
  updatedBy: string
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // Delete existing rows
  await db.delete(userCompanyAccess).where(eq(userCompanyAccess.userId, userId));
  // Insert new rows
  if (allowedCompanyIds.length > 0) {
    const rows: InsertUserCompanyAccess[] = allowedCompanyIds.map((odooCompanyId) => ({
      userId,
      odooCompanyId,
      isDefault: odooCompanyId === defaultCompanyId ? 1 : 0,
      updatedBy,
    }));
    await db.insert(userCompanyAccess).values(rows);
  }
}

// ── Leave Settings Helpers ──────────────────────────────────────────────────

import { leaveSettings, InsertLeaveSetting } from "../drizzle/schema";

/** Get leave settings for a specific employee */
export async function getLeaveSettingByEmployee(odooEmployeeId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(leaveSettings).where(eq(leaveSettings.odooEmployeeId, odooEmployeeId)).limit(1);
  return rows[0] ?? null;
}

/** Get leave settings for multiple employees (bulk) */
export async function getAllLeaveSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leaveSettings);
}

/** Upsert leave settings for an employee */
export async function upsertLeaveSetting(data: {
  odooEmployeeId: number;
  employeeName?: string;
  companyId?: number;
  companyName?: string;
  joiningDate: string; // YYYY-MM-DD
  annualLeaveDays: number;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const existing = await getLeaveSettingByEmployee(data.odooEmployeeId);
  const joiningDateObj = new Date(data.joiningDate + 'T00:00:00Z');
  if (existing) {
    await db.update(leaveSettings).set({
      ...(data.employeeName ? { employeeName: data.employeeName } : {}),
      companyId: data.companyId ?? null,
      companyName: data.companyName ?? null,
      joiningDate: joiningDateObj,
      annualLeaveDays: data.annualLeaveDays.toFixed(2) as any,
      notes: data.notes ?? null,
    }).where(eq(leaveSettings.odooEmployeeId, data.odooEmployeeId));
  } else {
    await db.insert(leaveSettings).values({
      odooEmployeeId: data.odooEmployeeId,
      employeeName: data.employeeName || 'Unknown',
      companyId: data.companyId ?? null,
      companyName: data.companyName ?? null,
      joiningDate: joiningDateObj,
      annualLeaveDays: data.annualLeaveDays.toFixed(2) as any,
      notes: data.notes ?? null,
    });
  }
}

/** Calculate accrued leave balance for an employee */
export function calculateLeaveBalance(joiningDate: string, annualLeaveDays: number, usedDays: number): {
  monthsWorked: number;
  monthlyRate: number;
  accruedDays: number;
  usedDays: number;
  remainingDays: number;
} {
  const joining = new Date(joiningDate);
  const today = new Date();
  
  // Calculate months worked (fractional)
  const yearsDiff = today.getFullYear() - joining.getFullYear();
  const monthsDiff = today.getMonth() - joining.getMonth();
  const daysDiff = today.getDate() - joining.getDate();
  let monthsWorked = yearsDiff * 12 + monthsDiff;
  if (daysDiff > 0) monthsWorked += daysDiff / 30; // partial month
  else if (daysDiff < 0) monthsWorked -= 1 - (30 + daysDiff) / 30;
  
  monthsWorked = Math.max(0, monthsWorked);
  
  const monthlyRate = annualLeaveDays / 12;
  const accruedDays = Math.round(monthsWorked * monthlyRate * 100) / 100; // round to 2 decimals
  const remainingDays = Math.round((accruedDays - usedDays) * 100) / 100;
  
  return {
    monthsWorked: Math.round(monthsWorked * 100) / 100,
    monthlyRate: Math.round(monthlyRate * 100) / 100,
    accruedDays,
    usedDays,
    remainingDays,
  };
}

// ── Salary History ────────────────────────────────────────────────────────
import { salaryHistory, InsertSalaryHistory } from "../drizzle/schema";
import { desc } from "drizzle-orm";

/** Record a salary change for an employee */
export async function logSalaryChange(data: {
  odooEmployeeId: number;
  employeeName: string;
  odooContractId: number;
  previousWage: number;
  newWage: number;
  previousHousing: number;
  newHousing: number;
  previousTransport: number;
  newTransport: number;
  previousOther: number;
  newOther: number;
  currency: string;
  note?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.insert(salaryHistory).values({
    odooEmployeeId: data.odooEmployeeId,
    employeeName: data.employeeName,
    odooContractId: data.odooContractId,
    previousWage: data.previousWage.toFixed(2) as any,
    newWage: data.newWage.toFixed(2) as any,
    previousHousing: data.previousHousing.toFixed(2) as any,
    newHousing: data.newHousing.toFixed(2) as any,
    previousTransport: data.previousTransport.toFixed(2) as any,
    newTransport: data.newTransport.toFixed(2) as any,
    previousOther: data.previousOther.toFixed(2) as any,
    newOther: data.newOther.toFixed(2) as any,
    currency: data.currency,
    note: data.note ?? null,
  });
}

/** Get salary history for a specific employee (newest first) */
export async function getSalaryHistory(odooEmployeeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(salaryHistory)
    .where(eq(salaryHistory.odooEmployeeId, odooEmployeeId))
    .orderBy(desc(salaryHistory.createdAt))
    .limit(50);
}
