/**
 * Document Management System Router
 * 
 * tRPC procedures for the DMS module.
 * All files are stored in Odoo — this portal is a frontend management layer only.
 * Uses Odoo 18 unified documents.document model (folders + files in same model).
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  fetchDocumentFolders,
  fetchRootFolders,
  fetchDocumentTags,
  fetchDocumentsByFolder,
  fetchChildFolders,
  searchDocuments,
  fetchAllDocuments,
  fetchFavoriteDocuments,
  getDocumentContent,
  uploadDocument,
  createFolder,
  toggleFavorite,
  toggleLock,
  deleteDocument,
  updateDocumentTags,
  renameDocument,
  moveDocument,
  fetchDocumentActivity,
  downloadDocumentProxy,
} from "../odoo-documents";

export const dmsRouter = router({
  // ── Folders ──────────────────────────────────────────────────────────────
  getFolders: publicProcedure.query(async () => {
    const folders = await fetchDocumentFolders();
    return folders.map(f => ({
      id: f.id,
      name: f.name,
      parentId: f.folder_id ? f.folder_id[0] : null,
      parentName: f.folder_id ? f.folder_id[1] : null,
      companyId: f.company_id ? f.company_id[0] : null,
      companyName: f.company_id ? f.company_id[1] : null,
      description: f.description || null,
      isPinned: f.is_pinned_folder || false,
      childrenIds: f.children_ids || [],
      documentCount: f.document_count || 0,
      ownerId: f.owner_id ? f.owner_id[0] : null,
      ownerName: f.owner_id ? f.owner_id[1] : null,
      createDate: f.create_date,
    }));
  }),

  getRootFolders: publicProcedure.query(async () => {
    const folders = await fetchRootFolders();
    return folders.map(f => ({
      id: f.id,
      name: f.name,
      isPinned: f.is_pinned_folder || false,
      childrenIds: f.children_ids || [],
      documentCount: f.document_count || 0,
      companyId: f.company_id ? f.company_id[0] : null,
      companyName: f.company_id ? f.company_id[1] : null,
    }));
  }),

  getChildFolders: publicProcedure
    .input(z.object({ folderId: z.number() }))
    .query(async ({ input }) => {
      const folders = await fetchChildFolders(input.folderId);
      return folders.map(f => ({
        id: f.id,
        name: f.name,
        childrenIds: f.children_ids || [],
        documentCount: f.document_count || 0,
        companyId: f.company_id ? f.company_id[0] : null,
        companyName: f.company_id ? f.company_id[1] : null,
      }));
    }),

  createFolder: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      parentFolderId: z.number().optional(),
      companyId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await createFolder(input);
      return { id, success: true };
    }),

  // ── Tags ──────────────────────────────────────────────────────────────
  getTags: publicProcedure.query(async () => {
    const tags = await fetchDocumentTags();
    return tags.map(t => ({
      id: t.id,
      name: t.name,
      color: t.color,
    }));
  }),

  // ── Documents ─────────────────────────────────────────────────────────
  getDocumentsByFolder: publicProcedure
    .input(z.object({
      folderId: z.number(),
      includeSubfolders: z.boolean().optional().default(false),
    }))
    .query(async ({ input }) => {
      const docs = await fetchDocumentsByFolder(input.folderId, input.includeSubfolders);
      return docs.map(mapDocument);
    }),

  searchDocuments: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      companyId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const docs = await searchDocuments(input.query, input.companyId);
      return docs.map(mapDocument);
    }),

  getAllDocuments: publicProcedure
    .input(z.object({
      companyId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const docs = await fetchAllDocuments(input?.companyId);
      return docs.map(mapDocument);
    }),

  getFavorites: publicProcedure.query(async () => {
    const docs = await fetchFavoriteDocuments();
    return docs.map(mapDocument);
  }),

  // ── Document Actions ──────────────────────────────────────────────────
  download: publicProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      const base64 = await getDocumentContent(input.documentId);
      return { data: base64 };
    }),

  upload: protectedProcedure
    .input(z.object({
      name: z.string(),
      folderId: z.number(),
      data: z.string(), // base64
      tagIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await uploadDocument({
        name: input.name,
        folderId: input.folderId,
        data: input.data,
        tagIds: input.tagIds,
      });
      return { id, success: true };
    }),

  toggleFavorite: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ input }) => {
      await toggleFavorite(input.documentId);
      return { success: true };
    }),

  toggleLock: protectedProcedure
    .input(z.object({ documentId: z.number(), lock: z.boolean() }))
    .mutation(async ({ input }) => {
      await toggleLock(input.documentId, input.lock);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ input }) => {
      await deleteDocument(input.documentId);
      return { success: true };
    }),

  updateTags: protectedProcedure
    .input(z.object({
      documentId: z.number(),
      tagIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      await updateDocumentTags(input.documentId, input.tagIds);
      return { success: true };
    }),

  rename: protectedProcedure
    .input(z.object({
      documentId: z.number(),
      newName: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      await renameDocument(input.documentId, input.newName);
      return { success: true };
    }),

  move: protectedProcedure
    .input(z.object({
      documentId: z.number(),
      folderId: z.number(),
    }))
    .mutation(async ({ input }) => {
      await moveDocument(input.documentId, input.folderId);
      return { success: true };
    }),

  // ── Activity ──────────────────────────────────────────────────────────
  getActivity: publicProcedure
    .input(z.object({ limit: z.number().optional().default(20) }).optional())
    .query(async ({ input }) => {
      const activity = await fetchDocumentActivity(input?.limit || 20);
      return activity.map(a => ({
        id: a.id,
        body: a.body,
        date: a.date,
        authorId: a.author_id ? a.author_id[0] : null,
        authorName: a.author_id ? a.author_id[1] : null,
        documentId: a.res_id,
      }));
    }),

  // ── Proxy download (returns base64 + metadata) ────────────────────────
  proxyDownload: publicProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      const result = await downloadDocumentProxy(input.documentId);
      return {
        data: result.data.toString("base64"),
        filename: result.filename,
        mimetype: result.mimetype,
      };
    }),
});

// ── Helper: map Odoo document to frontend shape ─────────────────────────
function mapDocument(doc: any) {
  const ext = doc.file_extension || extractExtension(doc.name || "");
  return {
    id: doc.id,
    name: doc.name || "Untitled",
    mimetype: doc.mimetype || null,
    ext,
    fileSize: doc.file_size || 0,
    folderId: doc.folder_id ? doc.folder_id[0] : null,
    folderName: doc.folder_id ? doc.folder_id[1] : null,
    ownerId: doc.owner_id ? doc.owner_id[0] : null,
    ownerName: doc.owner_id ? doc.owner_id[1] : null,
    createDate: doc.create_date,
    writeDate: doc.write_date,
    tagIds: doc.tag_ids || [],
    isLocked: doc.is_locked || false,
    lockUid: doc.lock_uid ? doc.lock_uid[0] : null,
    isFavorited: doc.is_favorited || false,
    type: doc.type || "binary",
    url: doc.url || null,
    companyId: doc.company_id ? doc.company_id[0] : null,
    companyName: doc.company_id ? doc.company_id[1] : null,
    checksum: doc.checksum || null,
  };
}

function extractExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1].toLowerCase();
}
