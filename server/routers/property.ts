import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "./propertyDb";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import { notifyOwner } from "../_core/notification";
import bcrypt from "bcryptjs";

export const propertyRouter = router({

  // ─── Properties ───────────────────────────────────────────
  properties: router({
    list: protectedProcedure
      .input(z.object({
        country: z.string().optional(),
        city: z.string().optional(),
        unitType: z.string().optional(),
        deliveryStatus: z.string().optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return db.getPropertiesByUser(ctx.user.id, input ?? undefined);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const property = await db.getPropertyById(input.id);
        if (!property) return null;
        const ownerIds = await db.getPortfolioOwnerIds();
        const allowedIds = Array.from(new Set([ctx.user.id, ...ownerIds]));
        if (!allowedIds.includes(property.userId)) return null;
        return property;
      }),

    create: adminProcedure
      .input(z.object({
        propertyName: z.string().min(1),
        developerName: z.string().min(1),
        projectName: z.string().min(1),
        country: z.enum(["UAE", "Egypt"]),
        city: z.string().min(1),
        district: z.string().optional(),
        fullAddress: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        unitType: z.enum(["Apartment", "Villa", "Townhouse", "Twin House", "Duplex", "Chalet", "Penthouse", "Studio", "Land"]),
        bedrooms: z.number().int().min(0).optional(),
        bathrooms: z.number().int().min(0).optional(),
        builtUpAreaSqm: z.number().positive().optional(),
        plotAreaSqm: z.number().optional(),
        floorNumber: z.number().int().optional(),
        unitNumber: z.string().optional(),
        buildingName: z.string().optional(),
        viewType: z.string().optional(),
        furnishing: z.enum(["Unfurnished", "Semi-Furnished", "Fully-Furnished"]).optional(),
        parkingSpaces: z.number().int().min(0).optional(),
        purchaseDate: z.string(),
        expectedDelivery: z.string().optional(),
        actualDelivery: z.string().optional(),
        deliveryStatus: z.enum(["Off-Plan", "Under-Construction", "Delivered", "Handed-Over"]),
        totalPrice: z.string().optional(),
        currency: z.enum(["AED", "EGP"]),
        currentMarketValue: z.string().optional(),
        valueLastUpdated: z.string().optional(),
        purpose: z.enum(["Primary Residence", "Investment", "Holiday Home", "Rental"]).optional(),
        notes: z.string().optional(),
        status: z.enum(["Active", "Sold", "Transferred"]).optional(),
        purchaseType: z.enum(["Direct", "Secondary Market"]).optional(),
        originalContractValue: z.string().optional(),
        premiumPaid: z.string().optional(),
        sellerName: z.string().optional(),
        sellerContact: z.string().optional(),
        saleDate: z.string().optional(),
        salePrice: z.string().optional(),
        buyerName: z.string().optional(),
        buyerContact: z.string().optional(),
        buyerEmail: z.string().optional(),
        premiumReceived: z.string().optional(),
        saleNotes: z.string().optional(),
        paymentSchedule: z.array(z.object({
          installmentLabel: z.string(),
          installmentNumber: z.number().int(),
          dueDate: z.string(),
          amountDue: z.string(),
          amountPaid: z.string().optional(),
          paymentStatus: z.enum(["Paid", "Partially-Paid", "Pending", "Overdue"]).optional(),
          percentageOfTotal: z.number().optional(),
        })).optional(),
        contract: z.object({
          contractType: z.enum(["SPA", "MOU", "Reservation", "Amendment", "Addendum"]),
          contractNumber: z.string().optional(),
          signingDate: z.string(),
          parties: z.string().optional(),
          notes: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { paymentSchedule, contract, ...propertyData } = input;
        const userId = await db.resolvePortfolioUserId(ctx.user.id, ctx.user.role);
        const result = await db.createProperty({ ...propertyData, userId } as any);
        const insertId = (result as any).insertId ?? (result as any)[0]?.insertId;
        if (insertId && paymentSchedule?.length) {
          await db.createPaymentSchedulesBatch(paymentSchedule.map((item, idx) => ({
            ...item,
            propertyId: insertId,
            amountPaid: item.amountPaid ?? "0",
            paymentStatus: item.paymentStatus ?? "Pending",
          } as any)));
        }
        if (insertId && contract) {
          await db.createContract({
            propertyId: insertId,
            contractType: contract.contractType as any,
            contractNumber: contract.contractNumber ?? null,
            signedDate: contract.signingDate ?? null,
            notes: contract.notes ?? null,
          } as any);
        }
        return { success: true, id: insertId };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        propertyName: z.string().min(1).optional(),
        developerName: z.string().optional(),
        projectName: z.string().optional(),
        country: z.enum(["UAE", "Egypt"]).optional(),
        city: z.string().optional(),
        district: z.string().optional().nullable(),
        fullAddress: z.string().optional().nullable(),
        latitude: z.number().optional().nullable(),
        longitude: z.number().optional().nullable(),
        unitType: z.enum(["Apartment", "Villa", "Townhouse", "Twin House", "Duplex", "Chalet", "Penthouse", "Studio", "Land"]).optional(),
        bedrooms: z.number().int().min(0).optional().nullable(),
        bathrooms: z.number().int().min(0).optional().nullable(),
        builtUpAreaSqm: z.number().positive().optional().nullable(),
        plotAreaSqm: z.number().optional().nullable(),
        floorNumber: z.number().int().optional().nullable(),
        unitNumber: z.string().optional().nullable(),
        buildingName: z.string().optional().nullable(),
        viewType: z.string().optional().nullable(),
        furnishing: z.enum(["Unfurnished", "Semi-Furnished", "Fully-Furnished"]).optional().nullable(),
        parkingSpaces: z.number().int().min(0).optional(),
        purchaseDate: z.string().optional(),
        expectedDelivery: z.string().optional().nullable(),
        actualDelivery: z.string().optional().nullable(),
        deliveryStatus: z.enum(["Off-Plan", "Under-Construction", "Delivered", "Handed-Over"]).optional(),
        totalPrice: z.string().optional().nullable(),
        currency: z.enum(["AED", "EGP"]).optional(),
        currentMarketValue: z.string().optional().nullable(),
        valueLastUpdated: z.string().optional().nullable(),
        purpose: z.enum(["Primary Residence", "Investment", "Holiday Home", "Rental"]).optional().nullable(),
        notes: z.string().optional().nullable(),
        status: z.enum(["Active", "Sold", "Transferred"]).optional(),
        purchaseType: z.enum(["Direct", "Secondary Market"]).optional().nullable(),
        originalContractValue: z.string().optional().nullable(),
        premiumPaid: z.string().optional().nullable(),
        sellerName: z.string().optional().nullable(),
        sellerContact: z.string().optional().nullable(),
        saleDate: z.string().optional().nullable(),
        salePrice: z.string().optional().nullable(),
        buyerName: z.string().optional().nullable(),
        buyerContact: z.string().optional().nullable(),
        buyerEmail: z.string().optional().nullable(),
        premiumReceived: z.string().optional().nullable(),
        saleNotes: z.string().optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateProperty(id, data as any);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteProperty(input.id);
        return { success: true };
      }),
  }),

  // ─── Payment Schedules ────────────────────────────────────
  payments: router({
    byProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getPaymentsByProperty(input.propertyId);
      }),

    all: protectedProcedure.query(async ({ ctx }) => {
      return db.getAllPayments(ctx.user.id);
    }),

    create: adminProcedure
      .input(z.object({
        propertyId: z.number(),
        installmentLabel: z.string(),
        installmentNumber: z.number().int(),
        dueDate: z.string(),
        amountDue: z.string(),
        amountPaid: z.string().optional(),
        paymentStatus: z.enum(["Paid", "Pending", "Overdue", "Partially-Paid"]).optional(),
        percentageOfTotal: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createPaymentSchedule({
          ...input,
          amountPaid: input.amountPaid ?? "0",
          paymentStatus: input.paymentStatus ?? "Pending",
        } as any);
        return { success: true };
      }),

    recordPayment: protectedProcedure
      .input(z.object({
        id: z.number(),
        amountPaid: z.string(),
        paymentDate: z.string(),
        paymentMethod: z.string().optional(),
        paymentReference: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const payment = await db.getPaymentById(id);
        if (!payment) throw new Error("Payment not found");
        const amountDue = Number(payment.payment.amountDue);
        const newPaid = Number(data.amountPaid);
        let status: "Paid" | "Partially-Paid" | "Pending" | "Overdue" = "Pending";
        if (newPaid >= amountDue) status = "Paid";
        else if (newPaid > 0) status = "Partially-Paid";
        await db.updatePaymentSchedule(id, {
          ...data,
          paymentStatus: status,
        } as any);
        return { success: true };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        installmentLabel: z.string().optional(),
        dueDate: z.string().optional(),
        amountDue: z.string().optional(),
        paymentStatus: z.enum(["Paid", "Pending", "Overdue", "Partially-Paid"]).optional(),
        notes: z.string().optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updatePaymentSchedule(id, data as any);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deletePaymentSchedule(input.id);
        return { success: true };
      }),
  }),

  // ─── Contracts ────────────────────────────────────────────
  contracts: router({
    byProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getContractsByProperty(input.propertyId);
      }),

    create: adminProcedure
      .input(z.object({
        propertyId: z.number(),
        contractType: z.enum(["SPA", "MOU", "Addendum", "NOC", "Title Deed", "Other"]),
        contractNumber: z.string().optional(),
        signedDate: z.string().optional(),
        expiryDate: z.string().optional(),
        counterpartyName: z.string().optional(),
        notes: z.string().optional(),
        documentId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createContract(input as any);
        return { success: true };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        contractType: z.enum(["SPA", "MOU", "Addendum", "NOC", "Title Deed", "Other"]).optional(),
        contractNumber: z.string().optional().nullable(),
        signedDate: z.string().optional().nullable(),
        expiryDate: z.string().optional().nullable(),
        counterpartyName: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateContract(id, data as any);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteContract(input.id);
        return { success: true };
      }),
  }),

  // ─── Documents ────────────────────────────────────────────
  documents: router({
    byProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getDocumentsByProperty(input.propertyId);
      }),

    all: protectedProcedure
      .input(z.object({
        propertyId: z.number().optional(),
        documentType: z.string().optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return db.getAllDocuments(ctx.user.id, input ?? undefined);
      }),

    upload: protectedProcedure
      .input(z.object({
        propertyId: z.number().optional(),
        documentType: z.string(),
        fileName: z.string(),
        fileBase64: z.string(),
        mimeType: z.string(),
        fileSize: z.number().optional(),
        description: z.string().optional(),
        uploadDate: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        const fileKey = `prop-documents/${ctx.user.id}/${nanoid()}-${input.fileName}`;
        let fileUrl = "";
        try {
          const result = await storagePut(fileKey, buffer, input.mimeType);
          fileUrl = result.url;
        } catch {
          fileUrl = `/uploads/${input.fileName}`;
        }
        await db.createDocument({
          propertyId: input.propertyId ?? null,
          userId: ctx.user.id,
          documentType: input.documentType,
          fileName: input.fileName,
          fileUrl,
          fileSize: input.fileSize ?? null,
          mimeType: input.mimeType,
          description: input.description ?? null,
          uploadDate: input.uploadDate ?? new Date().toISOString().split("T")[0],
        } as any);
        return { success: true, url: fileUrl };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteDocument(input.id);
        return { success: true };
      }),
  }),

  // ─── Activity Log ─────────────────────────────────────────
  activityLog: router({
    byProperty: protectedProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getActivityLogByProperty(input.propertyId);
      }),

    create: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        type: z.enum(["note", "visit", "payment", "document", "maintenance", "valuation", "other"]),
        title: z.string().min(1),
        description: z.string().optional(),
        date: z.string(),
        amount: z.string().optional(),
        currency: z.enum(["AED", "EGP"]).optional(),
        contactName: z.string().optional(),
        contactPhone: z.string().optional(),
        contactEmail: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createActivityLog({ ...input, userId: ctx.user.id } as any);
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        type: z.enum(["note", "visit", "payment", "document", "maintenance", "valuation", "other"]).optional(),
        title: z.string().optional(),
        description: z.string().optional().nullable(),
        date: z.string().optional(),
        amount: z.string().optional().nullable(),
        currency: z.enum(["AED", "EGP"]).optional().nullable(),
        contactName: z.string().optional().nullable(),
        contactPhone: z.string().optional().nullable(),
        contactEmail: z.string().optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateActivityLog(id, data as any);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteActivityLog(input.id);
        return { success: true };
      }),
  }),

  // ─── Dashboard ────────────────────────────────────────────
  dashboard: router({
    metrics: protectedProcedure.query(async ({ ctx }) => {
      return db.getDashboardMetrics(ctx.user.id);
    }),
  }),

  // ─── Settings ─────────────────────────────────────────────
  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const userId = await db.resolvePortfolioUserId(ctx.user.id, ctx.user.role);
      return db.getUserSettings(userId);
    }),

    update: adminProcedure
      .input(z.object({
        egpToAedRate: z.string().optional(),
        defaultCurrency: z.enum(["AED", "EGP", "Aggregated"]).optional(),
        emailNotifications: z.enum(["on", "off"]).optional(),
        paymentReminders: z.enum(["on", "off"]).optional(),
        reminderDaysBefore: z.number().int().min(1).max(30).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserSettings(ctx.user.id, input as any);
        return { success: true };
      }),
  }),

  // ─── Rentals ──────────────────────────────────────────────
  rentals: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getRentals(ctx.user.id);
    }),

    payments: protectedProcedure
      .input(z.object({ rentalId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getRentalPayments(input.rentalId);
      }),

    create: adminProcedure
      .input(z.object({
        propertyName: z.string().min(1),
        unitRef: z.string().optional(),
        location: z.string().optional(),
        landlord: z.string().optional(),
        contractNumber: z.string().optional(),
        contractStartDate: z.string(),
        contractEndDate: z.string(),
        annualRent: z.string(),
        currency: z.enum(["AED", "EGP"]).default("AED"),
        securityDeposit: z.string().optional(),
        numberOfCheques: z.number().int().min(1).max(12).default(4),
        bankName: z.string().optional(),
        status: z.enum(["Active", "Expired", "Terminated", "Renewed"]).default("Active"),
        notes: z.string().optional(),
        payments: z.array(z.object({
          installmentNumber: z.number().int(),
          installmentLabel: z.string(),
          dueDate: z.string(),
          amount: z.string(),
          chequeNumber: z.string().optional(),
          paymentStatus: z.enum(["Paid", "Pending", "Overdue", "Bounced"]).default("Pending"),
          notes: z.string().optional(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { payments: paymentData, ...rentalData } = input;
        const userId = await db.resolvePortfolioUserId(ctx.user.id, ctx.user.role);
        const result = await db.createRental({ ...rentalData, userId } as any);
        const rentalId = (result as any).insertId ?? (result as any)[0]?.insertId;
        if (rentalId && paymentData?.length) {
          const { rentalPayments } = await import("../../drizzle/schema");
          const { getDb } = await import("../db");
          const db2 = await getDb();
          if (db2) {
            await db2.insert(rentalPayments).values(paymentData.map(p => ({
              ...p,
              rentalId,
              paymentStatus: p.paymentStatus ?? "Pending",
            } as any)));
          }
        }
        return { success: true, id: rentalId };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        propertyName: z.string().optional(),
        unitRef: z.string().optional().nullable(),
        location: z.string().optional().nullable(),
        landlord: z.string().optional().nullable(),
        contractNumber: z.string().optional().nullable(),
        contractStartDate: z.string().optional(),
        contractEndDate: z.string().optional(),
        annualRent: z.string().optional(),
        currency: z.enum(["AED", "EGP"]).optional(),
        securityDeposit: z.string().optional().nullable(),
        numberOfCheques: z.number().int().optional(),
        bankName: z.string().optional().nullable(),
        status: z.enum(["Active", "Expired", "Terminated", "Renewed"]).optional(),
        notes: z.string().optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateRental(id, data as any);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteRental(input.id);
        return { success: true };
      }),

    recordPayment: protectedProcedure
      .input(z.object({
        id: z.number(),
        paymentStatus: z.enum(["Paid", "Pending", "Overdue", "Bounced"]),
        paymentDate: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateRentalPayment(id, data as any);
        return { success: true };
      }),
  }),

  // ─── Auth extensions ──────────────────────────────────────
  propAuth: router({
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().min(1).optional(),
        email: z.string().email().optional().or(z.literal("")),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserProfile(ctx.user.id, input);
        return { success: true };
      }),

    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user || !(user as any).passwordHash) throw new Error("User not found or no password set");
        const valid = await bcrypt.compare(input.currentPassword, (user as any).passwordHash);
        if (!valid) throw new Error("Current password is incorrect");
        const newHash = await bcrypt.hash(input.newPassword, 12);
        await db.updateUserPassword(ctx.user.id, newHash);
        return { success: true };
      }),
  }),

  // ─── Payment Reminders ─────────────────────────────────────
  reminders: router({
    checkAndSend: adminProcedure.mutation(async ({ ctx }) => {
      const allPayments = await db.getAllPayments(ctx.user.id);
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const today = now.toISOString().split("T")[0];
      const thirtyStr = thirtyDaysFromNow.toISOString().split("T")[0];

      const upcoming = allPayments.filter(p => {
        if (p.payment.paymentStatus === "Paid") return false;
        return p.payment.dueDate >= today && p.payment.dueDate <= thirtyStr;
      });

      if (upcoming.length === 0) {
        return { sent: false, message: "No upcoming payments within 30 days" };
      }

      const lines = upcoming.map(p => {
        const dueDate = new Date(p.payment.dueDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        const amount = Number(p.payment.amountDue).toLocaleString();
        return `• ${p.propertyName}: ${p.payment.installmentLabel} — ${p.currency} ${amount} due ${dueDate}`;
      });

      const content = `You have ${upcoming.length} upcoming payment(s) due within the next 30 days:\n\n${lines.join("\n")}`;

      const sent = await notifyOwner({
        title: `Payment Reminder: ${upcoming.length} payment(s) due soon`,
        content,
      });

      return {
        sent,
        count: upcoming.length,
        payments: upcoming.map(p => ({
          propertyName: p.propertyName,
          label: p.payment.installmentLabel,
          amount: p.payment.amountDue,
          currency: p.currency,
          dueDate: p.payment.dueDate,
        })),
      };
    }),
  }),
});
