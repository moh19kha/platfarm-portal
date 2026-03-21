/**
 * Odoo Documents API Helper (Odoo 18+ unified model)
 * 
 * In Odoo 18, the Documents module uses a single `documents.document` model
 * for both folders (type='folder') and files (type='binary'|'url').
 * The `folder_id` field points to the parent folder (also a documents.document).
 */

import axios from "axios";

// ─── Odoo Connection Config ────────────────────────────────────────────────
const ODOO_URL = "https://odoo.platfarm.io";
const ODOO_DB = "odoo";
const ODOO_USER = "aiagent";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD ?? "Platfarm@2025";
const ALLOWED_COMPANY_IDS = [1, 2, 3, 4, 5];

const odooClient = axios.create({
  baseURL: ODOO_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 120000,
});

// ─── UID Cache ─────────────────────────────────────────────────────────────
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
      if (!uid || typeof uid !== "number") throw new Error("Odoo auth failed: invalid credentials");
      return uid;
    } catch (err) {
      _uidPromise = null;
      throw err;
    }
  })();
  return _uidPromise;
}

// ─── Core RPC Helper ───────────────────────────────────────────────────────
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
        err.code === "ECONNRESET" || err.code === "ECONNREFUSED";
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

// ─── Types ─────────────────────────────────────────────────────────────────

export interface OdooDocument {
  id: number;
  name: string;
  type: "folder" | "binary" | "url";
  mimetype: string | false;
  file_size: number;
  file_extension: string | false;
  folder_id: [number, string] | false;
  children_ids: number[];
  tag_ids: number[];
  owner_id: [number, string] | false;
  company_id: [number, string] | false;
  is_locked: boolean;
  lock_uid: [number, string] | false;
  is_favorited: boolean;
  is_pinned_folder: boolean;
  document_count: number;
  create_date: string;
  write_date: string;
  url: string | false;
  description: string | false;
  checksum: string | false;
}

export interface OdooTag {
  id: number;
  name: string;
  color: number;
}

const DOC_FIELDS = [
  "id", "name", "type", "mimetype", "file_size", "file_extension",
  "folder_id", "children_ids", "tag_ids", "owner_id", "company_id",
  "is_locked", "lock_uid", "is_favorited", "is_pinned_folder",
  "document_count", "create_date", "write_date", "url", "description", "checksum",
];

// ─── Folder Operations ─────────────────────────────────────────────────────

/**
 * Fetch all folders (type='folder') from Odoo Documents.
 */
export async function fetchDocumentFolders(): Promise<OdooDocument[]> {
  return executeKw<OdooDocument[]>(
    "documents.document",
    "search_read",
    [[["type", "=", "folder"]]],
    { fields: DOC_FIELDS, order: "name asc" }
  );
}

/**
 * Fetch root folders (no parent folder).
 */
export async function fetchRootFolders(): Promise<OdooDocument[]> {
  return executeKw<OdooDocument[]>(
    "documents.document",
    "search_read",
    [[["type", "=", "folder"], ["folder_id", "=", false]]],
    { fields: DOC_FIELDS, order: "name asc" }
  );
}

/**
 * Create a new folder in Odoo Documents.
 */
export async function createFolder(params: {
  name: string;
  parentFolderId?: number;
  companyId?: number;
}): Promise<number> {
  const vals: Record<string, unknown> = {
    name: params.name,
    type: "folder",
  };
  if (params.parentFolderId) vals.folder_id = params.parentFolderId;
  if (params.companyId) vals.company_id = params.companyId;
  return executeKw<number>("documents.document", "create", [vals]);
}

// ─── Tag Operations ─────────────────────────────────────────────────────────

/**
 * Fetch all document tags.
 */
export async function fetchDocumentTags(): Promise<OdooTag[]> {
  return executeKw<OdooTag[]>(
    "documents.tag",
    "search_read",
    [[]],
    { fields: ["id", "name", "color"], order: "name asc" }
  );
}

// ─── Document Operations ────────────────────────────────────────────────────

/**
 * Fetch documents (non-folder) in a specific folder.
 */
export async function fetchDocumentsByFolder(
  folderId: number,
  includeSubfolders = false
): Promise<OdooDocument[]> {
  if (includeSubfolders) {
    // Get all subfolder IDs recursively
    const allFolders = await fetchDocumentFolders();
    const folderIds = getSubfolderIds(folderId, allFolders);
    folderIds.push(folderId);
    return executeKw<OdooDocument[]>(
      "documents.document",
      "search_read",
      [[["type", "!=", "folder"], ["folder_id", "in", folderIds]]],
      { fields: DOC_FIELDS, order: "write_date desc" }
    );
  }
  return executeKw<OdooDocument[]>(
    "documents.document",
    "search_read",
    [[["type", "!=", "folder"], ["folder_id", "=", folderId]]],
    { fields: DOC_FIELDS, order: "write_date desc" }
  );
}

/**
 * Fetch child folders of a given folder.
 */
export async function fetchChildFolders(folderId: number): Promise<OdooDocument[]> {
  return executeKw<OdooDocument[]>(
    "documents.document",
    "search_read",
    [[["type", "=", "folder"], ["folder_id", "=", folderId]]],
    { fields: DOC_FIELDS, order: "name asc" }
  );
}

function getSubfolderIds(parentId: number, allFolders: OdooDocument[]): number[] {
  const children = allFolders.filter(f => f.folder_id && f.folder_id[0] === parentId);
  const ids: number[] = [];
  for (const child of children) {
    ids.push(child.id);
    ids.push(...getSubfolderIds(child.id, allFolders));
  }
  return ids;
}

/**
 * Search documents by name.
 */
export async function searchDocuments(
  query: string,
  companyId?: number
): Promise<OdooDocument[]> {
  const domain: any[] = [
    ["type", "!=", "folder"],
    ["name", "ilike", query],
  ];
  if (companyId) domain.push(["company_id", "=", companyId]);
  return executeKw<OdooDocument[]>(
    "documents.document",
    "search_read",
    [domain],
    { fields: DOC_FIELDS, order: "write_date desc", limit: 50 }
  );
}

/**
 * Fetch all documents (non-folder), optionally filtered by company.
 */
export async function fetchAllDocuments(companyId?: number): Promise<OdooDocument[]> {
  const domain: any[] = [["type", "!=", "folder"]];
  if (companyId) domain.push(["company_id", "=", companyId]);
  return executeKw<OdooDocument[]>(
    "documents.document",
    "search_read",
    [domain],
    { fields: DOC_FIELDS, order: "write_date desc", limit: 200 }
  );
}

/**
 * Fetch favorited documents.
 */
export async function fetchFavoriteDocuments(): Promise<OdooDocument[]> {
  return executeKw<OdooDocument[]>(
    "documents.document",
    "search_read",
    [[["type", "!=", "folder"], ["is_favorited", "=", true]]],
    { fields: DOC_FIELDS, order: "write_date desc" }
  );
}

/**
 * Get document file content (base64).
 */
export async function getDocumentContent(documentId: number): Promise<string> {
  const result = await executeKw<any[]>(
    "documents.document",
    "read",
    [[documentId]],
    { fields: ["datas"] }
  );
  if (!result || result.length === 0) throw new Error("Document not found");
  return result[0].datas || "";
}

/**
 * Upload a document to Odoo.
 */
export async function uploadDocument(params: {
  name: string;
  folderId: number;
  data: string; // base64
  tagIds?: number[];
}): Promise<number> {
  const vals: Record<string, unknown> = {
    name: params.name,
    folder_id: params.folderId,
    datas: params.data,
    type: "binary",
  };
  if (params.tagIds && params.tagIds.length > 0) {
    vals.tag_ids = [[6, 0, params.tagIds]];
  }
  return executeKw<number>("documents.document", "create", [vals]);
}

/**
 * Toggle favorite status.
 */
export async function toggleFavorite(documentId: number): Promise<void> {
  // Read current state
  const result = await executeKw<any[]>(
    "documents.document",
    "read",
    [[documentId]],
    { fields: ["is_favorited"] }
  );
  if (!result || result.length === 0) throw new Error("Document not found");
  
  // Toggle via action_toggle_favorite if available, otherwise use write
  try {
    await executeKw("documents.document", "action_toggle_favorite", [[documentId]]);
  } catch {
    // Fallback: use write with favorited_ids
    const uid = await getUid();
    const isFav = result[0].is_favorited;
    if (isFav) {
      await executeKw("documents.document", "write", [[documentId], { favorited_ids: [[3, uid]] }]);
    } else {
      await executeKw("documents.document", "write", [[documentId], { favorited_ids: [[4, uid]] }]);
    }
  }
}

/**
 * Toggle lock status.
 */
export async function toggleLock(documentId: number, lock: boolean): Promise<void> {
  if (lock) {
    try {
      await executeKw("documents.document", "action_lock", [[documentId]]);
    } catch {
      const uid = await getUid();
      await executeKw("documents.document", "write", [[documentId], { lock_uid: uid }]);
    }
  } else {
    try {
      await executeKw("documents.document", "action_unlock", [[documentId]]);
    } catch {
      await executeKw("documents.document", "write", [[documentId], { lock_uid: false }]);
    }
  }
}

/**
 * Delete a document.
 */
export async function deleteDocument(documentId: number): Promise<void> {
  await executeKw("documents.document", "unlink", [[documentId]]);
}

/**
 * Update document tags.
 */
export async function updateDocumentTags(
  documentId: number,
  tagIds: number[]
): Promise<void> {
  await executeKw("documents.document", "write", [
    [documentId],
    { tag_ids: [[6, 0, tagIds]] },
  ]);
}

/**
 * Rename a document.
 */
export async function renameDocument(
  documentId: number,
  newName: string
): Promise<void> {
  await executeKw("documents.document", "write", [
    [documentId],
    { name: newName },
  ]);
}

/**
 * Move a document to a different folder.
 */
export async function moveDocument(
  documentId: number,
  folderId: number
): Promise<void> {
  await executeKw("documents.document", "write", [
    [documentId],
    { folder_id: folderId },
  ]);
}

/**
 * Fetch recent document activity (mail.message on documents.document).
 */
export async function fetchDocumentActivity(limit = 20): Promise<any[]> {
  return executeKw<any[]>(
    "mail.message",
    "search_read",
    [[["model", "=", "documents.document"], ["message_type", "!=", "notification"]]],
    {
      fields: ["id", "body", "date", "author_id", "res_id", "subtype_id"],
      order: "date desc",
      limit,
    }
  );
}

/**
 * Download document content as base64 with metadata.
 */
export async function downloadDocumentProxy(documentId: number): Promise<{
  data: Buffer;
  filename: string;
  mimetype: string;
}> {
  const result = await executeKw<any[]>(
    "documents.document",
    "read",
    [[documentId]],
    { fields: ["datas", "name", "mimetype"] }
  );
  if (!result || result.length === 0) throw new Error("Document not found");
  const doc = result[0];
  const data = Buffer.from(doc.datas || "", "base64");
  return {
    data,
    filename: doc.name || "download",
    mimetype: doc.mimetype || "application/octet-stream",
  };
}
