/**
 * Company Documents Router
 * 
 * Manages required company documents (stored in Odoo Documents) with
 * expiry date tracking (stored in portal DB). All portal users can view;
 * only admins can create/edit/delete.
 */

import { z } from "zod";
import { protectedProcedure, router, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { companyDocuments, documentRenewals } from "../../drizzle/schema";
import { eq, and, sql, isNotNull, desc } from "drizzle-orm";
import {
  fetchDocumentsByFolder,
  fetchDocumentFolders,
  getDocumentContent,
  uploadDocument,
  createFolder,
  downloadDocumentProxy,
} from "../odoo-documents";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_DOC_TYPES = [
  "company_registration",
  "vat_registration",
  "tax_registration",
  "constitution_contract",
  "owner_id",
  "owner_passport",
  "office_lease_contract",
  "medical_insurance_policy",
  "export_certificate",
  "tax_portal_registration",
  "social_insurance",
  "company_establishment_card",
  "housing_lease_contract",
  "civil_defense",
] as const;

// Keep backward compat alias
const DOC_TYPES = ALL_DOC_TYPES;

const DOC_TYPE_LABELS: Record<string, string> = {
  company_registration: "Company Registration",
  vat_registration: "VAT Registration",
  tax_registration: "Tax Registration",
  constitution_contract: "Constitution Contract",
  owner_id: "Owner ID",
  owner_passport: "Owner Passport",
  office_lease_contract: "Office Lease Contract",
  medical_insurance_policy: "Medical Insurance Policy",
  export_certificate: "Export Certificate",
  tax_portal_registration: "Tax Portal Registration",
  social_insurance: "Social Insurance",
  company_establishment_card: "Company Establishment Card",
  housing_lease_contract: "Housing Lease Contract",
  civil_defense: "Civil Defense",
};

// ─── Country-specific document types ─────────────────────────────────────────
// Base docs for ALL companies
const BASE_DOC_TYPES = [
  "company_registration",
  "vat_registration",
  "tax_registration",
  "constitution_contract",
  "owner_id",
  "owner_passport",
  "office_lease_contract",
  "medical_insurance_policy",
] as const;

// Additional docs for Egypt companies (Cairo-PLATFARM id=3, Sokhna id=4, Cairo-AlfaGlobal id=5)
const EGYPT_DOC_TYPES = [
  "export_certificate",
  "tax_portal_registration",
  "social_insurance",
] as const;

// Additional docs for UAE companies (ABU DHABI id=2, ADGM id=1)
const UAE_DOC_TYPES = [
  "company_establishment_card",
] as const;

// Additional docs for ADGM only (id=1)
const ADGM_DOC_TYPES = [
  "housing_lease_contract",
] as const;

// Additional docs for Sokhna only (id=4)
const SOKHNA_DOC_TYPES = [
  "civil_defense",
] as const;

const SOKHNA_COMPANY_ID = 4;

// Egypt company IDs
const EGYPT_COMPANY_IDS = [3, 4, 5];
// UAE company IDs
const UAE_COMPANY_IDS = [1, 2];
// ADGM company ID
const ADGM_COMPANY_ID = 1;

/**
 * Get the list of required document types for a given company based on its country.
 */
function getDocTypesForCompany(odooCompanyId: number): (typeof ALL_DOC_TYPES[number])[] {
  const types: (typeof ALL_DOC_TYPES[number])[] = [...BASE_DOC_TYPES];
  if (EGYPT_COMPANY_IDS.includes(odooCompanyId)) {
    types.push(...EGYPT_DOC_TYPES);
  }
  if (UAE_COMPANY_IDS.includes(odooCompanyId)) {
    types.push(...UAE_DOC_TYPES);
  }
  if (odooCompanyId === ADGM_COMPANY_ID) {
    types.push(...ADGM_DOC_TYPES);
  }
  if (odooCompanyId === SOKHNA_COMPANY_ID) {
    types.push(...SOKHNA_DOC_TYPES);
  }
  return types;
}

// ─── Admin middleware ─────────────────────────────────────────────────────────

const adminOnly = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const companyDocumentsRouter = router({
  /**
   * Get all company documents for a specific company (or all companies).
   * Accessible by all authenticated users.
   */
  list: protectedProcedure
    .input(z.object({
      companyId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      let rows;
      if (input?.companyId) {
        rows = await db.select().from(companyDocuments)
          .where(eq(companyDocuments.odooCompanyId, input.companyId));
      } else {
        rows = await db.select().from(companyDocuments);
      }

      return {
        documents: rows,
        docTypes: ALL_DOC_TYPES,
        docTypeLabels: DOC_TYPE_LABELS,
        // Also return the per-company doc type mapping for the frontend
        companyDocTypes: {
          egyptCompanyIds: EGYPT_COMPANY_IDS,
          uaeCompanyIds: UAE_COMPANY_IDS,
          adgmCompanyId: ADGM_COMPANY_ID,
          baseDocTypes: [...BASE_DOC_TYPES],
          egyptDocTypes: [...EGYPT_DOC_TYPES],
          uaeDocTypes: [...UAE_DOC_TYPES],
          adgmDocTypes: [...ADGM_DOC_TYPES],
        },
      };
    }),

  /**
   * Get expiry summary across all companies.
   * Returns counts of expired, expiring soon (30 days), and valid documents.
   */
  expirySummary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const allDocs = await db.select().from(companyDocuments);
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let expired = 0;
    let expiringSoon = 0;
    let valid = 0;
    let missing = 0;

    for (const doc of allDocs) {
      if (!doc.expiryDate) {
        missing++; // No expiry date set = needs attention
        continue;
      }
      const expiry = new Date(doc.expiryDate);
      if (expiry < now) expired++;
      else if (expiry <= in30Days) expiringSoon++;
      else valid++;
    }

    return { expired, expiringSoon, valid, missing, total: allDocs.length };
  }),

  /**
   * Create or update a company document record.
   * Any logged-in user.
   */
  upsert: protectedProcedure
    .input(z.object({
      id: z.number().optional(), // If provided, update; otherwise create
      odooCompanyId: z.number(),
      companyName: z.string(),
      docType: z.enum(ALL_DOC_TYPES),
      odooDocumentId: z.number().nullable().optional(),
      documentName: z.string().nullable().optional(),
      expiryDate: z.string().nullable().optional(), // YYYY-MM-DD
      issueDate: z.string().nullable().optional(),
      referenceNumber: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const values = {
        odooCompanyId: input.odooCompanyId,
        companyName: input.companyName,
        docType: input.docType,
        odooDocumentId: input.odooDocumentId ?? null,
        documentName: input.documentName ?? null,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        issueDate: input.issueDate ? new Date(input.issueDate) : null,
        referenceNumber: input.referenceNumber ?? null,
        notes: input.notes ?? null,
        updatedBy: ctx.user.name || ctx.user.openId,
        // Reset reminders if expiry date changed
        reminder30d: 0,
        reminder14d: 0,
        reminder7d: 0,
        reminderExpired: 0,
      };

      if (input.id) {
        // Check if old record had a linked document — if so, save renewal history
        const [oldDoc] = await db.select().from(companyDocuments)
          .where(eq(companyDocuments.id, input.id));
        if (oldDoc && oldDoc.odooDocumentId && input.odooDocumentId && oldDoc.odooDocumentId !== input.odooDocumentId) {
          // Document is being replaced — save old version to renewal history
          await db.insert(documentRenewals).values({
            companyDocumentId: input.id,
            odooCompanyId: oldDoc.odooCompanyId,
            companyName: oldDoc.companyName,
            docType: oldDoc.docType,
            oldOdooDocumentId: oldDoc.odooDocumentId,
            oldDocumentName: oldDoc.documentName,
            oldExpiryDate: oldDoc.expiryDate ? new Date(oldDoc.expiryDate) : null,
            oldIssueDate: oldDoc.issueDate ? new Date(oldDoc.issueDate) : null,
            oldReferenceNumber: oldDoc.referenceNumber,
            newOdooDocumentId: input.odooDocumentId ?? null,
            newDocumentName: input.documentName ?? null,
            newExpiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
            newIssueDate: input.issueDate ? new Date(input.issueDate) : null,
            newReferenceNumber: input.referenceNumber ?? null,
            renewedBy: ctx.user.name || ctx.user.openId,
          } as any);
        }
        // Update existing
        await db.update(companyDocuments)
          .set(values)
          .where(eq(companyDocuments.id, input.id));
        return { id: input.id, action: "updated" as const };
      } else {
        // Check if record already exists for this company + docType
        const existing = await db.select().from(companyDocuments)
          .where(and(
            eq(companyDocuments.odooCompanyId, input.odooCompanyId),
            eq(companyDocuments.docType, input.docType),
          ));

        if (existing.length > 0) {
          // Check if old record had a linked document — if so, save renewal history
          const oldDoc = existing[0];
          if (oldDoc.odooDocumentId && input.odooDocumentId && oldDoc.odooDocumentId !== input.odooDocumentId) {
            await db.insert(documentRenewals).values({
              companyDocumentId: oldDoc.id,
              odooCompanyId: oldDoc.odooCompanyId,
              companyName: oldDoc.companyName,
              docType: oldDoc.docType,
              oldOdooDocumentId: oldDoc.odooDocumentId,
              oldDocumentName: oldDoc.documentName,
              oldExpiryDate: oldDoc.expiryDate ? new Date(oldDoc.expiryDate) : null,
              oldIssueDate: oldDoc.issueDate ? new Date(oldDoc.issueDate) : null,
              oldReferenceNumber: oldDoc.referenceNumber,
              newOdooDocumentId: input.odooDocumentId ?? null,
              newDocumentName: input.documentName ?? null,
              newExpiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
              newIssueDate: input.issueDate ? new Date(input.issueDate) : null,
              newReferenceNumber: input.referenceNumber ?? null,
              renewedBy: ctx.user.name || ctx.user.openId,
            } as any);
          }
          await db.update(companyDocuments)
            .set(values)
            .where(eq(companyDocuments.id, existing[0].id));
          return { id: existing[0].id, action: "updated" as const };
        }

        const result = await db.insert(companyDocuments).values(values as any);
        return { id: Number(result[0].insertId), action: "created" as const };
      }
    }),

  /**
   * Delete a company document record.
   * Admin only. Does NOT delete the Odoo document — only removes the tracking record.
   */
  delete: adminOnly
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db.delete(companyDocuments).where(eq(companyDocuments.id, input.id));
      return { success: true };
    }),

  /**
   * Initialize all 6 required document types for a company.
   * Creates empty placeholder rows so the checklist shows all required docs.
   * Admin only.
   */
  initializeCompany: adminOnly
    .input(z.object({
      odooCompanyId: z.number(),
      companyName: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get the required doc types for this specific company
      const requiredTypes = getDocTypesForCompany(input.odooCompanyId);

      // Check which doc types already exist for this company
      const existing = await db.select().from(companyDocuments)
        .where(eq(companyDocuments.odooCompanyId, input.odooCompanyId));
      const existingTypes = new Set(existing.map(d => d.docType));

      // Create missing doc type placeholders (only the ones required for this company)
      const toCreate = requiredTypes.filter(t => !existingTypes.has(t)) as typeof ALL_DOC_TYPES[number][];
      if (toCreate.length === 0) return { created: 0, message: "All document types already exist" };

      for (const docType of toCreate) {
        await db.insert(companyDocuments).values({
          odooCompanyId: input.odooCompanyId,
          companyName: input.companyName,
          docType,
          updatedBy: ctx.user.name || ctx.user.openId,
        } as any);
      }

      return { created: toCreate.length, message: `Created ${toCreate.length} document placeholders` };
    }),

  /**
   * Link an Odoo document to a company document record.
   * Any logged-in user.
   */
  linkOdooDocument: protectedProcedure
    .input(z.object({
      id: z.number(),
      odooDocumentId: z.number(),
      documentName: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db.update(companyDocuments)
        .set({
          odooDocumentId: input.odooDocumentId,
          documentName: input.documentName,
          updatedBy: ctx.user.name || ctx.user.openId,
        })
        .where(eq(companyDocuments.id, input.id));

      return { success: true };
    }),

  /**
   * Get documents expiring within N days (for the reminder cron).
   */
  getExpiring: protectedProcedure
    .input(z.object({ withinDays: z.number().default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const now = new Date();
      const futureDate = new Date(now.getTime() + input.withinDays * 24 * 60 * 60 * 1000);
      const nowStr = now.toISOString().split("T")[0];
      const futureStr = futureDate.toISOString().split("T")[0];

      const rows = await db.select().from(companyDocuments)
        .where(and(
          isNotNull(companyDocuments.expiryDate),
          sql`${companyDocuments.expiryDate} <= ${futureStr}`,
        ));

      return rows;
    }),

  /**
   * Search Odoo documents by name, optionally filtered by company.
   * Used for the "Link from Odoo" feature.
   */
  searchOdooDocuments: protectedProcedure
    .input(z.object({
      query: z.string().optional(),
      companyId: z.number().optional(),
      folderId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const { searchDocuments, fetchDocumentsByFolder, fetchChildFolders, fetchAllDocuments } = await import("../odoo-documents");

      // If folderId provided, fetch docs in that folder
      if (input.folderId) {
        const [docs, subfolders] = await Promise.all([
          fetchDocumentsByFolder(input.folderId),
          fetchChildFolders(input.folderId),
        ]);
        return {
          documents: docs.map(d => ({
            id: d.id,
            name: d.name,
            type: d.type,
            mimetype: d.mimetype || null,
            fileSize: d.file_size,
            fileExtension: d.file_extension || null,
            folderId: d.folder_id ? (d.folder_id as [number, string])[0] : null,
            folderName: d.folder_id ? (d.folder_id as [number, string])[1] : null,
            ownerId: d.owner_id ? (d.owner_id as [number, string])[0] : null,
            ownerName: d.owner_id ? (d.owner_id as [number, string])[1] : null,
            companyId: d.company_id ? (d.company_id as [number, string])[0] : null,
            companyName: d.company_id ? (d.company_id as [number, string])[1] : null,
            createDate: d.create_date,
            writeDate: d.write_date,
          })),
          subfolders: subfolders.map(f => ({
            id: f.id,
            name: f.name,
            documentCount: f.document_count,
          })),
        };
      }

      // If query provided, search by name
      if (input.query && input.query.trim()) {
        const docs = await searchDocuments(input.query, input.companyId);
        return {
          documents: docs.map(d => ({
            id: d.id,
            name: d.name,
            type: d.type,
            mimetype: d.mimetype || null,
            fileSize: d.file_size,
            fileExtension: d.file_extension || null,
            folderId: d.folder_id ? (d.folder_id as [number, string])[0] : null,
            folderName: d.folder_id ? (d.folder_id as [number, string])[1] : null,
            ownerId: d.owner_id ? (d.owner_id as [number, string])[0] : null,
            ownerName: d.owner_id ? (d.owner_id as [number, string])[1] : null,
            companyId: d.company_id ? (d.company_id as [number, string])[0] : null,
            companyName: d.company_id ? (d.company_id as [number, string])[1] : null,
            createDate: d.create_date,
            writeDate: d.write_date,
          })),
          subfolders: [],
        };
      }

      // Default: fetch all docs for company
      const docs = await fetchAllDocuments(input.companyId);
      return {
        documents: docs.map(d => ({
          id: d.id,
          name: d.name,
          type: d.type,
          mimetype: d.mimetype || null,
          fileSize: d.file_size,
          fileExtension: d.file_extension || null,
          folderId: d.folder_id ? (d.folder_id as [number, string])[0] : null,
          folderName: d.folder_id ? (d.folder_id as [number, string])[1] : null,
          ownerId: d.owner_id ? (d.owner_id as [number, string])[0] : null,
          ownerName: d.owner_id ? (d.owner_id as [number, string])[1] : null,
          companyId: d.company_id ? (d.company_id as [number, string])[0] : null,
          companyName: d.company_id ? (d.company_id as [number, string])[1] : null,
          createDate: d.create_date,
          writeDate: d.write_date,
        })),
        subfolders: [],
      };
    }),

  /**
   * Get the full folder tree from Odoo for the folder dropdown selector.
   * Returns root folders with their child folders.
   */
  getFolderTree: protectedProcedure.query(async () => {
    const { fetchDocumentFolders } = await import("../odoo-documents");
    const allFolders = await fetchDocumentFolders();

    // Build tree: root folders (no parent) and their children
    const rootFolders = allFolders.filter(f => !f.folder_id);
    
    const buildTree = (parentId: number): any[] => {
      return allFolders
        .filter(f => f.folder_id && (f.folder_id as [number, string])[0] === parentId)
        .map(f => ({
          id: f.id,
          name: f.name,
          documentCount: f.document_count || 0,
          children: buildTree(f.id),
        }));
    };

    return rootFolders.map(f => ({
      id: f.id,
      name: f.name,
      documentCount: f.document_count || 0,
      children: buildTree(f.id),
    }));
  }),

  /**
   * Download a document from Odoo (proxy).
   */
  downloadDocument: protectedProcedure
    .input(z.object({ odooDocumentId: z.number() }))
    .query(async ({ input }) => {
      try {
        const content = await getDocumentContent(input.odooDocumentId);
        return { data: content, success: true };
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to download document: ${err.message}`,
        });
      }
    }),

  /**
   * Upload a document to Odoo and link it to the company document record.
   * Any logged-in user.
   */
  uploadAndLink: protectedProcedure
    .input(z.object({
      companyDocId: z.number(), // portal DB record ID
      fileName: z.string(),
      fileData: z.string(), // base64
      folderId: z.number(), // Odoo folder ID to upload into
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Upload to Odoo Documents
      const odooDocId = await uploadDocument({
        name: input.fileName,
        folderId: input.folderId,
        data: input.fileData,
      });

      // Link to portal record
      await db.update(companyDocuments)
        .set({
          odooDocumentId: odooDocId,
          documentName: input.fileName,
          updatedBy: ctx.user.name || ctx.user.openId,
        })
        .where(eq(companyDocuments.id, input.companyDocId));

      return { odooDocumentId: odooDocId, success: true };
    }),

  /**
   * Manually trigger the document expiry check cron job.
   * Admin only. Useful for testing the email notification.
   */
  triggerExpiryCheck: adminOnly.mutation(async () => {
    const { runCompanyDocExpiryCheck } = await import("../cron/companyDocExpiry");
    const result = await runCompanyDocExpiryCheck();
    return result;
  }),

  /**
   * Get or create the "Company Documents" folder in Odoo.
   */
  getOrCreateFolder: adminOnly
    .input(z.object({
      companyName: z.string(),
    }))
    .query(async ({ input }) => {
      // Look for existing "Company Documents" root folder
      const allFolders = await fetchDocumentFolders();
      const companyDocsFolder = allFolders.find(f =>
        f.name === "Company Documents" && (!f.folder_id)
      );

      let rootFolderId: number;
      if (companyDocsFolder) {
        rootFolderId = companyDocsFolder.id;
      } else {
        // Create root folder
        rootFolderId = await createFolder({ name: "Company Documents" });
      }

      // Look for company subfolder
      const companyFolder = allFolders.find(f =>
        f.name === input.companyName && f.folder_id && (f.folder_id as [number, string])[0] === rootFolderId
      );

      if (companyFolder) {
        return { folderId: companyFolder.id, rootFolderId };
      }

      // Create company subfolder
      const folderId = await createFolder({
        name: input.companyName,
        parentFolderId: rootFolderId,
      });

      return { folderId, rootFolderId };
    }),

  /**
   * Get renewal history for a specific company document.
   * Returns all past renewals sorted by most recent first.
   */
  renewalHistory: protectedProcedure
    .input(z.object({ companyDocumentId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const rows = await db.select().from(documentRenewals)
        .where(eq(documentRenewals.companyDocumentId, input.companyDocumentId))
        .orderBy(desc(documentRenewals.renewedAt));

      return rows;
    }),

  /**
   * Get all renewal history across all documents (for a company or all).
   * Useful for the renewal history overview panel.
   */
  allRenewals: protectedProcedure
    .input(z.object({
      companyId: z.number().optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      if (input?.companyId) {
        return db.select().from(documentRenewals)
          .where(eq(documentRenewals.odooCompanyId, input.companyId))
          .orderBy(desc(documentRenewals.renewedAt))
          .limit(input.limit);
      }

      return db.select().from(documentRenewals)
        .orderBy(desc(documentRenewals.renewedAt))
        .limit(input?.limit ?? 50);
    }),

  /**
   * Explicitly renew a document: save old version to history, update with new version.
   * Any logged-in user.
   */
  renew: protectedProcedure
    .input(z.object({
      companyDocumentId: z.number(),
      newOdooDocumentId: z.number().nullable().optional(),
      newDocumentName: z.string().nullable().optional(),
      newExpiryDate: z.string().nullable().optional(),
      newIssueDate: z.string().nullable().optional(),
      newReferenceNumber: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get the current document
      const [currentDoc] = await db.select().from(companyDocuments)
        .where(eq(companyDocuments.id, input.companyDocumentId));
      if (!currentDoc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      }

      // Save old version to renewal history
      await db.insert(documentRenewals).values({
        companyDocumentId: input.companyDocumentId,
        odooCompanyId: currentDoc.odooCompanyId,
        companyName: currentDoc.companyName,
        docType: currentDoc.docType,
        oldOdooDocumentId: currentDoc.odooDocumentId,
        oldDocumentName: currentDoc.documentName,
        oldExpiryDate: currentDoc.expiryDate ? new Date(currentDoc.expiryDate) : null,
        oldIssueDate: currentDoc.issueDate ? new Date(currentDoc.issueDate) : null,
        oldReferenceNumber: currentDoc.referenceNumber,
        newOdooDocumentId: input.newOdooDocumentId ?? null,
        newDocumentName: input.newDocumentName ?? null,
        newExpiryDate: input.newExpiryDate ? new Date(input.newExpiryDate) : null,
        newIssueDate: input.newIssueDate ? new Date(input.newIssueDate) : null,
        newReferenceNumber: input.newReferenceNumber ?? null,
        notes: input.notes ?? null,
        renewedBy: ctx.user.name || ctx.user.openId,
      } as any);

      // Update the document with new version
      await db.update(companyDocuments)
        .set({
          odooDocumentId: input.newOdooDocumentId ?? null,
          documentName: input.newDocumentName ?? null,
          expiryDate: input.newExpiryDate ? new Date(input.newExpiryDate) : null,
          issueDate: input.newIssueDate ? new Date(input.newIssueDate) : null,
          referenceNumber: input.newReferenceNumber ?? null,
          notes: input.notes ?? currentDoc.notes,
          updatedBy: ctx.user.name || ctx.user.openId,
          // Reset reminders for new expiry date
          reminder30d: 0,
          reminder14d: 0,
          reminder7d: 0,
          reminderExpired: 0,
        })
        .where(eq(companyDocuments.id, input.companyDocumentId));

      return { success: true, renewalId: "created" };
    }),
});
