import { eq, and, desc, asc, sql, like, or, gte, lte } from "drizzle-orm";
import { getDb } from "../db";
import {
  users, properties, paymentSchedules, contracts, propDocuments as documents,
  userSettings, activityLog, rentals, rentalPayments, reminderAlertsSent,
} from "../../drizzle/schema";
import type {
  InsertProperty, InsertPaymentSchedule, InsertContract, InsertPropDocument as InsertDocument,
  InsertUserSettings, InsertActivityLog,
} from "../../drizzle/schema";

export async function getUserSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function updateUserSettings(userId: number, data: Partial<InsertUserSettings>) {
  const db = await getDb();
  if (!db) return;
  const existing = await getUserSettings(userId);
  if (existing) {
    await db.update(userSettings).set({ ...data, updatedAt: new Date() }).where(eq(userSettings.userId, userId));
  } else {
    await db.insert(userSettings).values({ userId, ...data });
  }
}

export async function getPortfolioOwnerIds(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  // Return IDs of all admin users (portfolio owners)
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  return rows.map(r => r.id);
}

export async function resolvePortfolioUserId(userId: number, userRole: string): Promise<number> {
  if (userRole === "admin") return userId;
  const ownerIds = await getPortfolioOwnerIds();
  return ownerIds[0] ?? userId;
}

export async function createProperty(data: InsertProperty) {
  const db = await getDb();
  if (!db) throw new Error("No database");
  const result = await db.insert(properties).values(data);
  return result;
}

export async function getPropertiesByUser(userId: number, filters?: {
  country?: string;
  city?: string;
  unitType?: string;
  deliveryStatus?: string;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const ownerIds = await getPortfolioOwnerIds();
  const allowedIds = Array.from(new Set([userId, ...ownerIds]));

  let rows = await db.select().from(properties)
    .where(or(...allowedIds.map(id => eq(properties.userId, id))))
    .orderBy(desc(properties.createdAt));

  if (filters?.country) rows = rows.filter(r => r.country === filters.country);
  if (filters?.city) rows = rows.filter(r => r.city === filters.city);
  if (filters?.unitType) rows = rows.filter(r => r.unitType === filters.unitType);
  if (filters?.deliveryStatus) rows = rows.filter(r => r.deliveryStatus === filters.deliveryStatus);
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    rows = rows.filter(r =>
      r.propertyName.toLowerCase().includes(s) ||
      r.projectName.toLowerCase().includes(s) ||
      r.developerName.toLowerCase().includes(s) ||
      r.city.toLowerCase().includes(s)
    );
  }
  return rows;
}

export async function getPropertyById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateProperty(id: number, data: Partial<InsertProperty>) {
  const db = await getDb();
  if (!db) return;
  await db.update(properties).set({ ...data, updatedAt: new Date() }).where(eq(properties.id, id));
}

export async function deleteProperty(id: number) {
  const db = await getDb();
  if (!db) return;
  // Cascade: delete related records first
  const propPayments = await db.select({ id: paymentSchedules.id }).from(paymentSchedules).where(eq(paymentSchedules.propertyId, id));
  for (const pp of propPayments) {
    await db.delete(paymentSchedules).where(eq(paymentSchedules.id, pp.id));
  }
  await db.delete(contracts).where(eq(contracts.propertyId, id));
  await db.delete(documents).where(eq(documents.propertyId, id));
  await db.delete(activityLog).where(eq(activityLog.propertyId, id));
  await db.delete(properties).where(eq(properties.id, id));
}

export async function createPaymentSchedule(data: InsertPaymentSchedule) {
  const db = await getDb();
  if (!db) throw new Error("No database");
  await db.insert(paymentSchedules).values(data);
}

export async function createPaymentSchedulesBatch(items: InsertPaymentSchedule[]) {
  const db = await getDb();
  if (!db || items.length === 0) return;
  await db.insert(paymentSchedules).values(items);
}

export async function getPaymentsByProperty(propertyId: number) {
  const db = await getDb();
  if (!db) return [];
  const prop = await getPropertyById(propertyId);
  const rows = await db.select().from(paymentSchedules)
    .where(eq(paymentSchedules.propertyId, propertyId))
    .orderBy(asc(paymentSchedules.installmentNumber));
  return rows.map(r => ({ payment: r, propertyName: prop?.propertyName ?? "", currency: prop?.currency ?? "AED" }));
}

export async function getAllPayments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const userProps = await getPropertiesByUser(userId);
  const results = [];
  for (const prop of userProps) {
    const payments = await db.select().from(paymentSchedules)
      .where(eq(paymentSchedules.propertyId, prop.id))
      .orderBy(asc(paymentSchedules.dueDate));
    for (const pmt of payments) {
      results.push({ payment: pmt, propertyName: prop.propertyName, propertyId: prop.id, currency: prop.currency });
    }
  }
  // Auto-mark overdue
  const today = new Date().toISOString().split("T")[0];
  for (const item of results) {
    if (item.payment.paymentStatus === "Pending" && item.payment.dueDate < today) {
      await updatePaymentSchedule(item.payment.id, { paymentStatus: "Overdue" });
      item.payment.paymentStatus = "Overdue";
    }
  }
  return results;
}

export async function updatePaymentSchedule(id: number, data: Partial<InsertPaymentSchedule>) {
  const db = await getDb();
  if (!db) return;
  await db.update(paymentSchedules).set({ ...data, updatedAt: new Date() }).where(eq(paymentSchedules.id, id));
}

export async function deletePaymentSchedule(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(paymentSchedules).where(eq(paymentSchedules.id, id));
}

export async function getPaymentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(paymentSchedules).where(eq(paymentSchedules.id, id)).limit(1);
  if (!rows[0]) return null;
  const prop = await getPropertyById(rows[0].propertyId);
  return { payment: rows[0], propertyName: prop?.propertyName ?? "", currency: prop?.currency ?? "AED" };
}

export async function createContract(data: InsertContract) {
  const db = await getDb();
  if (!db) throw new Error("No database");
  await db.insert(contracts).values(data);
}

export async function getContractsByProperty(propertyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contracts).where(eq(contracts.propertyId, propertyId)).orderBy(desc(contracts.createdAt));
}

export async function updateContract(id: number, data: Partial<InsertContract>) {
  const db = await getDb();
  if (!db) return;
  await db.update(contracts).set({ ...data, updatedAt: new Date() }).where(eq(contracts.id, id));
}

export async function deleteContract(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(contracts).where(eq(contracts.id, id));
}

export async function createDocument(data: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("No database");
  await db.insert(documents).values(data);
}

export async function getDocumentsByProperty(propertyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documents).where(eq(documents.propertyId, propertyId)).orderBy(desc(documents.createdAt));
}

export async function getAllDocuments(userId: number, filters?: {
  propertyId?: number;
  documentType?: string;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const userProps = await getPropertiesByUser(userId);
  const propIds = userProps.map(p => p.id);

  let rows = await db.select().from(documents)
    .where(or(
      eq(documents.userId, userId),
      ...propIds.map(id => eq(documents.propertyId, id))
    ))
    .orderBy(desc(documents.createdAt));

  if (filters?.propertyId) rows = rows.filter(r => r.propertyId === filters.propertyId);
  if (filters?.documentType) rows = rows.filter(r => r.documentType === filters.documentType);
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    rows = rows.filter(r =>
      r.fileName.toLowerCase().includes(s) ||
      (r.description ?? "").toLowerCase().includes(s)
    );
  }

  return rows.map(doc => ({
    doc,
    propertyName: userProps.find(p => p.id === doc.propertyId)?.propertyName ?? null,
  }));
}

export async function getDocumentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateDocument(id: number, data: Partial<InsertDocument>) {
  const db = await getDb();
  if (!db) return;
  await db.update(documents).set({ ...data, updatedAt: new Date() }).where(eq(documents.id, id));
}

export async function deleteDocument(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(documents).where(eq(documents.id, id));
}

export async function createActivityLog(data: InsertActivityLog) {
  const db = await getDb();
  if (!db) throw new Error("No database");
  await db.insert(activityLog).values(data);
}

export async function getActivityLogByProperty(propertyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activityLog).where(eq(activityLog.propertyId, propertyId)).orderBy(desc(activityLog.date));
}

export async function deleteActivityLog(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(activityLog).where(eq(activityLog.id, id));
}

export async function updateActivityLog(id: number, data: Partial<InsertActivityLog>) {
  const db = await getDb();
  if (!db) return;
  await db.update(activityLog).set({ ...data, updatedAt: new Date() }).where(eq(activityLog.id, id));
}

export async function getDashboardMetrics(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const userProps = await getPropertiesByUser(userId);
  const activeProps = userProps.filter(p => p.status === "Active");

  const allPayments: any[] = [];
  for (const prop of activeProps) {
    const pmts = await db.select().from(paymentSchedules)
      .where(eq(paymentSchedules.propertyId, prop.id));
    for (const pmt of pmts) {
      allPayments.push({ payment: pmt, propertyName: prop.propertyName, propertyId: prop.id, currency: prop.currency });
    }
  }

  // Auto-mark overdue
  const today = new Date().toISOString().split("T")[0];
  for (const item of allPayments) {
    if (item.payment.paymentStatus === "Pending" && item.payment.dueDate < today) {
      await updatePaymentSchedule(item.payment.id, { paymentStatus: "Overdue" });
      item.payment.paymentStatus = "Overdue";
    }
  }

  const upcomingCutoff = new Date();
  upcomingCutoff.setDate(upcomingCutoff.getDate() + 30);
  const upcomingStr = upcomingCutoff.toISOString().split("T")[0];

  const upcoming = allPayments.filter(p =>
    (p.payment.paymentStatus === "Pending" || p.payment.paymentStatus === "Partially-Paid") &&
    p.payment.dueDate >= today &&
    p.payment.dueDate <= upcomingStr
  );
  const overdue = allPayments.filter(p => p.payment.paymentStatus === "Overdue");

  // ── Aggregated metrics by currency ──────────────────────────────────────
  let portfolioValueAED = 0;
  let portfolioValueEGP = 0;
  let marketValueAED = 0;
  let marketValueEGP = 0;
  for (const p of activeProps) {
    const price = Number(p.totalPrice) || 0;
    const marketVal = Number(p.currentMarketValue) || 0;
    if (p.currency === "AED") {
      portfolioValueAED += price;
      marketValueAED += marketVal;
    } else {
      portfolioValueEGP += price;
      marketValueEGP += marketVal;
    }
  }

  let totalPaidAED = 0;
  let totalPaidEGP = 0;
  let totalOutstandingAED = 0;
  let totalOutstandingEGP = 0;
  let overdueAmountAED = 0;
  let overdueAmountEGP = 0;
  for (const item of allPayments) {
    const paid = Number(item.payment.amountPaid) || 0;
    const due = Number(item.payment.amountDue) || 0;
    const balance = Math.max(due - paid, 0);
    if (item.currency === "AED") {
      totalPaidAED += paid;
      if (item.payment.paymentStatus !== "Paid") totalOutstandingAED += balance;
      if (item.payment.paymentStatus === "Overdue") overdueAmountAED += balance;
    } else {
      totalPaidEGP += paid;
      if (item.payment.paymentStatus !== "Paid") totalOutstandingEGP += balance;
      if (item.payment.paymentStatus === "Overdue") overdueAmountEGP += balance;
    }
  }

  // Next upcoming payment: soonest by due date
  const sortedUpcoming = [...upcoming].sort((a, b) =>
    a.payment.dueDate.localeCompare(b.payment.dueDate)
  );
  const nextRaw = sortedUpcoming[0] ?? null;
  const nextPayment = nextRaw ? {
    id: nextRaw.payment.id,
    propertyName: nextRaw.propertyName,
    label: nextRaw.payment.installmentLabel || "Payment",
    amount: Math.max(Number(nextRaw.payment.amountDue) - Number(nextRaw.payment.amountPaid), 0),
    currency: nextRaw.currency,
    dueDate: nextRaw.payment.dueDate,
  } : null;

  return {
    properties: activeProps,
    payments: allPayments,
    upcoming,
    overdue,
    totalProperties: userProps.length,
    activeProperties: activeProps.length,
    portfolioValueAED,
    portfolioValueEGP,
    marketValueAED,
    marketValueEGP,
    totalPaidAED,
    totalPaidEGP,
    totalOutstandingAED,
    totalOutstandingEGP,
    overdueAmountAED,
    overdueAmountEGP,
    overdueCount: overdue.length,
    nextPayment,
  };
}

export async function getRentals(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const ownerIds = await getPortfolioOwnerIds();
  const allowedIds = Array.from(new Set([userId, ...ownerIds]));
  return db.select().from(rentals)
    .where(or(...allowedIds.map(id => eq(rentals.userId, id))))
    .orderBy(desc(rentals.createdAt));
}

export async function getRentalById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(rentals).where(eq(rentals.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createRental(data: typeof rentals.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("No database");
  const result = await db.insert(rentals).values(data);
  return result;
}

export async function updateRental(id: number, data: Partial<typeof rentals.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(rentals).set({ ...data, updatedAt: new Date() }).where(eq(rentals.id, id));
}

export async function deleteRental(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(rentalPayments).where(eq(rentalPayments.rentalId, id));
  await db.delete(rentals).where(eq(rentals.id, id));
}

export async function getRentalPayments(rentalId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rentalPayments).where(eq(rentalPayments.rentalId, rentalId)).orderBy(asc(rentalPayments.installmentNumber));
}

export async function updateRentalPayment(id: number, data: Partial<typeof rentalPayments.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(rentalPayments).set({ ...data, updatedAt: new Date() }).where(eq(rentalPayments.id, id));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateUserPassword(userId: number, newPasswordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash: newPasswordHash, updatedAt: new Date() } as any).where(eq(users.id, userId));
}

export async function updateUserProfile(userId: number, data: { name?: string; email?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ ...data, updatedAt: new Date() } as any).where(eq(users.id, userId));
}
