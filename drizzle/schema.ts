import { boolean, date, decimal, float, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  /** Bcrypt hash of the user's password. NULL for Manus OAuth-only users. */
  passwordHash: varchar("passwordHash", { length: 255 }),
  /** Account status: pending = invited but not registered, active = registered, inactive = deactivated */
  status: mysqlEnum("status", ["pending", "active", "inactive"]).default("active").notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Shipment Drafts ──────────────────────────────────────────────────────
export const shipmentDrafts = mysqlTable("shipment_drafts", {
  id: int("id").autoincrement().primaryKey(),
  /** Which wizard type: purchase, sales, multi_linked */
  wizardType: mysqlEnum("wizardType", ["purchase", "sales", "multi_linked"]).notNull(),
  /** Current step the user was on (1-4) */
  currentStep: int("currentStep").notNull().default(1),
  /** Human-readable label for the draft (auto-generated from form data) */
  label: varchar("label", { length: 255 }),
  /** Full wizard form state serialized as JSON */
  formData: json("formData").notNull(),
  /** User who created the draft */
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ShipmentDraft = typeof shipmentDrafts.$inferSelect;
export type InsertShipmentDraft = typeof shipmentDrafts.$inferInsert;

// ── Shipment Status Log ─────────────────────────────────────────────────
// Tracks every shipment status change for notification and audit purposes
export const shipmentStatusLog = mysqlTable("shipment_status_log", {
  id: int("id").autoincrement().primaryKey(),
  /** Odoo order ID (purchase.order or sale.order) */
  odooOrderId: int("odooOrderId").notNull(),
  /** Type: purchase or sales */
  orderType: mysqlEnum("orderType", ["purchase", "sales"]).notNull(),
  /** Order reference name (e.g., PO/AD/26/00048) */
  orderName: varchar("orderName", { length: 128 }).notNull(),
  /** Previous shipment status (null if first time) */
  previousStatus: varchar("previousStatus", { length: 128 }),
  /** New shipment status */
  newStatus: varchar("newStatus", { length: 128 }).notNull(),
  /** Whether notification was sent */
  notified: int("notified").notNull().default(0),
  /** Whether the user has read/dismissed this notification */
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShipmentStatusLog = typeof shipmentStatusLog.$inferSelect;
export type InsertShipmentStatusLog = typeof shipmentStatusLog.$inferInsert;

// ── Notification Preferences ────────────────────────────────────────────
// Global notification settings — single row, configurable by admins.
// Controls which stage transitions trigger notifications.
export const notificationPreferences = mysqlTable("notification_preferences", {
  id: int("id").autoincrement().primaryKey(),
  /** User's openId — null means global/system default row */
  userId: varchar("userId", { length: 64 }),
  /** JSON array of stage names that trigger notifications (e.g. ["In Transit","Delivered"]) */
  enabledStages: json("enabledStages").$type<string[]>().notNull(),
  /** Whether to send owner email/push notifications */
  notifyOwner: int("notifyOwner").notNull().default(1),
  /** Whether to show in-app bell notifications */
  notifyInApp: int("notifyInApp").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = typeof notificationPreferences.$inferInsert;

// ── Document Hard Copy Tracking ────────────────────────────────────────
// Tracks whether the physical hard copy of a document has been received
export const documentHardCopy = mysqlTable("document_hard_copy", {
  id: int("id").autoincrement().primaryKey(),
  /** Odoo order ID (purchase.order or sale.order) */
  odooOrderId: int("odooOrderId").notNull(),
  /** Type: purchase or sales */
  orderType: mysqlEnum("orderType", ["purchase", "sales"]).notNull(),
  /** Document field name (e.g. 'bl', 'certificate_of_origin', 'packing_list', 'phytosanitary') */
  documentField: varchar("documentField", { length: 128 }).notNull(),
  /** Whether hard copy has been received */
  received: int("received").notNull().default(0),
  /** User who marked it as received */
  receivedBy: varchar("receivedBy", { length: 128 }),
  /** When it was marked as received */
  receivedAt: timestamp("receivedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DocumentHardCopy = typeof documentHardCopy.$inferSelect;
export type InsertDocumentHardCopy = typeof documentHardCopy.$inferInsert;

// ── Document Alert Log ─────────────────────────────────────────────────
// Tracks daily alerts sent for missing documents on in-transit shipments
export const documentAlertLog = mysqlTable("document_alert_log", {
  id: int("id").autoincrement().primaryKey(),
  /** Date the alert was sent (YYYY-MM-DD format stored as varchar for easy dedup) */
  alertDate: varchar("alertDate", { length: 10 }).notNull(),
  /** JSON array of shipment names that were flagged */
  shipmentNames: json("shipmentNames").$type<string[]>().notNull(),
  /** Number of shipments flagged */
  shipmentCount: int("shipmentCount").notNull(),
  /** Whether notification was successfully sent */
  notified: int("notified").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DocumentAlertLog = typeof documentAlertLog.$inferSelect;
export type InsertDocumentAlertLog = typeof documentAlertLog.$inferInsert;
// ── Email Alert Recipients ────────────────────────────────────────────
// Stores email addresses that receive daily document alert emails
export const emailAlertRecipients = mysqlTable("email_alert_recipients", {
  id: int("id").autoincrement().primaryKey(),
  /** Email address */
  email: varchar("email", { length: 320 }).notNull(),
  /** Display name (optional) */
  name: varchar("name", { length: 128 }),
  /** Whether this recipient is active */
  active: int("active").notNull().default(1),
  /** Who added this recipient */
  addedBy: varchar("addedBy", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailAlertRecipient = typeof emailAlertRecipients.$inferSelect;
export type InsertEmailAlertRecipient = typeof emailAlertRecipients.$inferInsert;

// ── Production Order Documents ─────────────────────────────────────────
// Tracks documents uploaded to production orders (stored in S3)
export const productionDocuments = mysqlTable("production_documents", {
  id: int("id").autoincrement().primaryKey(),
  /** Odoo Manufacturing Order ID */
  moId: int("moId").notNull(),
  /** Tab the document belongs to: overview, io, quality, workforce, machine, diesel */
  tab: varchar("tab", { length: 32 }).notNull(),
  /** Document type label (e.g. "Shift Report", "Quality Inspection Report") */
  docType: varchar("docType", { length: 128 }).notNull(),
  /** Original filename */
  fileName: varchar("fileName", { length: 512 }).notNull(),
  /** MIME type */
  mimeType: varchar("mimeType", { length: 128 }),
  /** File size in bytes */
  fileSize: int("fileSize"),
  /** S3 file key */
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  /** S3 public URL */
  fileUrl: varchar("fileUrl", { length: 1024 }).notNull(),
  /** Who uploaded */
  uploadedBy: varchar("uploadedBy", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductionDocument = typeof productionDocuments.$inferSelect;
export type InsertProductionDocument = typeof productionDocuments.$inferInsert;

// ── Quotations & Invoices ─────────────────────────────────────────────────
// Stores quotations, invoices, and payment receipts created via the document generator
export const quotations = mysqlTable("quotations", {
  id: int("id").autoincrement().primaryKey(),
  /** Document type: quotation, invoice, or payment_receipt */
  documentType: mysqlEnum("documentType", ["quotation", "invoice", "payment_receipt"]).notNull().default("quotation"),
  /** Document number (e.g. Q-20260310, INV-20260310, REC-20260310) */
  quotationNo: varchar("quotationNo", { length: 128 }).notNull(),
  /** Client name */
  clientName: varchar("clientName", { length: 256 }).notNull(),
  /** Client address */
  clientAddress: text("clientAddress"),
  /** Client country */
  clientCountry: varchar("clientCountry", { length: 128 }),
  /** Client TRN (Tax Registration Number) */
  clientTrn: varchar("clientTrn", { length: 128 }),
  /** Project name (optional) */
  projectName: varchar("projectName", { length: 256 }),
  /** Document date */
  quotationDate: varchar("quotationDate", { length: 32 }),
  /** Valid until date */
  validUntil: varchar("validUntil", { length: 32 }),
  /** Incoterms (FOB, CIF, etc.) */
  incoterms: varchar("incoterms", { length: 32 }),
  /** Payment terms */
  paymentTerms: varchar("paymentTerms", { length: 256 }),
  /** Currency code (USD, AED, etc.) */
  currency: varchar("currency", { length: 8 }).notNull().default("USD"),
  /** Additional notes */
  notes: text("notes"),
  /** Payment schedule text */
  paymentSchedule: text("paymentSchedule"),
  /** Bank details JSON */
  bankDetails: text("bankDetails"),
  /** Products/items JSON array */
  products: text("products"),
  /** Subtotal in cents */
  subtotal: int("subtotal").notNull().default(0),
  /** VAT total in cents */
  vatTotal: int("vatTotal").notNull().default(0),
  /** Grand total in cents */
  total: int("total").notNull().default(0),
  /** User who created */
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = typeof quotations.$inferInsert;

// ── User Module Permissions ───────────────────────────────────────────────────
// Stores per-user, per-module CRUD access privileges.
// Admin role always has full access regardless of this table.
// For 'user' role: deny by default — access only granted via explicit rows here.
export const userModulePermissions = mysqlTable("user_module_permissions", {
  id: int("id").autoincrement().primaryKey(),
  /** FK → users.id */
  userId: int("userId").notNull(),
  /** Module identifier matching the portal module id (e.g. 'purchase', 'hr', 'inventory') */
  moduleId: varchar("moduleId", { length: 64 }).notNull(),
  /** Can view/open the module */
  canView: int("canView").notNull().default(0),
  /** Can create new records */
  canCreate: int("canCreate").notNull().default(0),
  /** Can edit existing records */
  canEdit: int("canEdit").notNull().default(0),
  /** Can delete records */
  canDelete: int("canDelete").notNull().default(0),
  /** Who last updated this permission row */
  updatedBy: varchar("updatedBy", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserModulePermission = typeof userModulePermissions.$inferSelect;
export type InsertUserModulePermission = typeof userModulePermissions.$inferInsert;

// ── User Invitations ──────────────────────────────────────────────────────────
// Tracks pending and accepted invitations sent by admins to new users.
// When an invited user completes OAuth registration, their pre-configured
// permissions are automatically applied and the invitation is marked accepted.
export const invitations = mysqlTable("invitations", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique secure token included in the invitation link */
  token: varchar("token", { length: 128 }).notNull().unique(),
  /** Email address the invitation was sent to */
  email: varchar("email", { length: 320 }).notNull(),
  /** Role to assign on acceptance */
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** Name of the admin who sent the invitation */
  invitedBy: varchar("invitedBy", { length: 128 }),
  /** Invitation status */
  status: mysqlEnum("status", ["pending", "accepted", "revoked", "expired"]).default("pending").notNull(),
  /** Pre-configured module permissions as JSON array */
  presetPermissions: json("presetPermissions"),
  /** When the invitation expires (default: 7 days after creation) */
  expiresAt: timestamp("expiresAt").notNull(),
  /** When the invitation was accepted */
  acceptedAt: timestamp("acceptedAt"),
  /** FK → users.id of the user who accepted (set on acceptance) */
  acceptedByUserId: int("acceptedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = typeof invitations.$inferInsert;

// ── Password Reset Tokens ─────────────────────────────────────────────────────
// Short-lived tokens for the "Forgot password?" flow.
// Each token is single-use and expires after 1 hour.
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  /** Secure random token included in the reset link */
  token: varchar("token", { length: 128 }).notNull().unique(),
  /** FK → users.id */
  userId: int("userId").notNull(),
  /** Email address the reset was requested for */
  email: varchar("email", { length: 320 }).notNull(),
  /** When this token expires (1 hour after creation) */
  expiresAt: timestamp("expiresAt").notNull(),
  /** When the token was used (null = not yet used) */
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// ── Periodic Inventory Submissions ──────────────────────────────────────
// Caches periodic inventory submissions from Odoo for display in the portal
export const periodicInventorySubmissions = mysqlTable("periodic_inventory_submissions", {
  id: int("id").autoincrement().primaryKey(),
  /** Odoo periodic.inventory ID */
  odooId: int("odooId").notNull().unique(),
  /** Sequence number: PINV/YYYY/MM/#### */
  name: varchar("name", { length: 64 }).notNull().unique(),
  /** Submission date */
  date: date("date").notNull(),
  /** Inventory type: animal_fodder, etc */
  inventoryType: varchar("inventoryType", { length: 64 }).notNull(),
  /** Reporting unit: bales, tons, kg, etc */
  reportingUnit: varchar("reportingUnit", { length: 64 }).notNull(),
  /** Product category name */
  productCategory: varchar("productCategory", { length: 255 }),
  /** Grade: Grade 1, Grade 3, etc */
  grade: varchar("grade", { length: 64 }),
  /** Weight range: 425-450, etc */
  weightRange: varchar("weightRange", { length: 64 }),
  /** Country of origin */
  country: varchar("country", { length: 128 }),
  /** Warehouse name */
  warehouse: varchar("warehouse", { length: 255 }),
  /** Stock location name */
  location: varchar("location", { length: 255 }),
  /** Workflow state: draft, supervisor_review, accounting_review, done, cancelled */
  state: mysqlEnum("state", ["draft", "supervisor_review", "accounting_review", "done", "cancelled"]).notNull(),
  /** Supervisor review status: pending, approved, rejected */
  supervisorReviewStatus: mysqlEnum("supervisorReviewStatus", ["pending", "approved", "rejected"]).notNull().default("pending"),
  /** Supervisor name */
  supervisorName: varchar("supervisorName", { length: 255 }),
  /** Supervisor review date */
  supervisorReviewDate: timestamp("supervisorReviewDate"),
  /** Accounting review status: pending, approved, rejected */
  accountingReviewStatus: mysqlEnum("accountingReviewStatus", ["pending", "approved", "rejected"]).notNull().default("pending"),
  /** Accountant name */
  accountantName: varchar("accountantName", { length: 255 }),
  /** Accounting review date */
  accountingReviewDate: timestamp("accountingReviewDate"),
  /** Who submitted */
  submittedBy: varchar("submittedBy", { length: 255 }),
  /** Submission timestamp */
  submittedDate: timestamp("submittedDate"),
  /** Total number of products in this submission */
  totalProducts: int("totalProducts").notNull().default(0),
  /** Total quantity across all products */
  totalQuantity: varchar("totalQuantity", { length: 64 }).notNull().default("0"),
  /** Additional notes */
  notes: text("notes"),
  /** When this record was synced from Odoo */
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  /** When this record was last updated */
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PeriodicInventorySubmission = typeof periodicInventorySubmissions.$inferSelect;
export type InsertPeriodicInventorySubmission = typeof periodicInventorySubmissions.$inferInsert;

// ── Periodic Inventory Line Items ───────────────────────────────────────
// Individual product entries within each periodic inventory submission
export const periodicInventoryLines = mysqlTable("periodic_inventory_lines", {
  id: int("id").autoincrement().primaryKey(),
  /** Reference to the parent submission */
  submissionId: int("submissionId").notNull(),
  /** Odoo periodic.inventory.line ID */
  odooLineId: int("odooLineId").notNull(),
  /** Product name */
  productName: varchar("productName", { length: 255 }).notNull(),
  /** Product category */
  productCategory: varchar("productCategory", { length: 255 }),
  /** Quantity counted */
  quantity: varchar("quantity", { length: 64 }).notNull(),
  /** Unit of measurement */
  unit: varchar("unit", { length: 64 }).notNull(),
  /** Grade of this product */
  grade: varchar("grade", { length: 64 }),
  /** Weight range */
  weightRange: varchar("weightRange", { length: 64 }),
  /** Notes for this line item */
  notes: text("notes"),
  /** When this record was synced from Odoo */
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});

export type PeriodicInventoryLine = typeof periodicInventoryLines.$inferSelect;
export type InsertPeriodicInventoryLine = typeof periodicInventoryLines.$inferInsert;

// ── Exchange Rates ──────────────────────────────────────────────────────────
// Stores configurable exchange rates for currency conversion in analytics
export const exchangeRates = mysqlTable("exchange_rates", {
  id: int("id").autoincrement().primaryKey(),
  /** Source currency code (e.g., EGP, AED) */
  fromCurrency: varchar("fromCurrency", { length: 8 }).notNull(),
  /** Target currency code (e.g., USD) */
  toCurrency: varchar("toCurrency", { length: 8 }).notNull().default("USD"),
  /** Exchange rate (e.g., 0.032 for EGP to USD) */
  rate: decimal("rate", { precision: 10, scale: 6 }).notNull(),
  /** When this rate was last updated */
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  uniquePair: uniqueIndex("unique_currency_pair").on(table.fromCurrency, table.toCurrency),
}));

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = typeof exchangeRates.$inferInsert;


// ── User Company Access ───────────────────────────────────────────────────────
// Controls which Odoo companies each user can see in the company selector.
// Admin role always sees all companies regardless of this table.
// For 'user' role: if no rows exist for a user, they see ALL companies (backward compat).
// If rows exist, they only see the listed companies.
export const userCompanyAccess = mysqlTable("user_company_access", {
  id: int("id").autoincrement().primaryKey(),
  /** FK → users.id */
  userId: int("userId").notNull(),
  /** Odoo company ID (integer, matches res.company.id in Odoo) */
  odooCompanyId: int("odooCompanyId").notNull(),
  /** Whether this company is the default for this user */
  isDefault: int("isDefault").notNull().default(0),
  /** Who last updated this row */
  updatedBy: varchar("updatedBy", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserCompanyAccess = typeof userCompanyAccess.$inferSelect;
export type InsertUserCompanyAccess = typeof userCompanyAccess.$inferInsert;

// ── Company Documents (Expiry Tracking) ──────────────────────────────────────
// Tracks required company documents stored in Odoo Documents module.
// Links to Odoo document IDs and manages expiry dates + reminder status.
// Each company must have 6 required document types.
export const companyDocuments = mysqlTable("company_documents", {
  id: int("id").autoincrement().primaryKey(),
  /** Odoo company ID (res.company.id) */
  odooCompanyId: int("odooCompanyId").notNull(),
  /** Company display name (cached for quick display) */
  companyName: varchar("companyName", { length: 255 }).notNull(),
  /** Document type enum */
  docType: mysqlEnum("docType", [
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
  ]).notNull(),
  /** Odoo documents.document ID (null if not yet uploaded) */
  odooDocumentId: int("odooDocumentId"),
  /** Document name from Odoo */
  documentName: varchar("documentName", { length: 512 }),
  /** Expiry date of the document */
  expiryDate: date("expiryDate"),
  /** Issue date of the document (optional) */
  issueDate: date("issueDate"),
  /** Document reference/registration number */
  referenceNumber: varchar("referenceNumber", { length: 255 }),
  /** Notes */
  notes: text("notes"),
  /** Whether 30-day reminder was sent */
  reminder30d: int("reminder30d").notNull().default(0),
  /** Whether 14-day reminder was sent */
  reminder14d: int("reminder14d").notNull().default(0),
  /** Whether 7-day reminder was sent */
  reminder7d: int("reminder7d").notNull().default(0),
  /** Whether expired notification was sent */
  reminderExpired: int("reminderExpired").notNull().default(0),
  /** Who last updated this record */
  updatedBy: varchar("updatedBy", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CompanyDocument = typeof companyDocuments.$inferSelect;
export type InsertCompanyDocument = typeof companyDocuments.$inferInsert;

// ── Document Renewal History ────────────────────────────────────────────
// Tracks every renewal of a company document, preserving old versions.
// When a document is renewed, the old Odoo doc link + expiry is saved here
// and the companyDocuments row is updated with the new document.
export const documentRenewals = mysqlTable("document_renewals", {
  id: int("id").autoincrement().primaryKey(),
  /** FK to company_documents.id */
  companyDocumentId: int("companyDocumentId").notNull(),
  /** Odoo company ID (denormalized for easy querying) */
  odooCompanyId: int("odooCompanyId").notNull(),
  /** Company display name */
  companyName: varchar("companyName", { length: 255 }).notNull(),
  /** Document type (denormalized) */
  docType: varchar("docType", { length: 64 }).notNull(),
  /** === OLD VERSION (what was replaced) === */
  /** Previous Odoo document ID */
  oldOdooDocumentId: int("oldOdooDocumentId"),
  /** Previous document name */
  oldDocumentName: varchar("oldDocumentName", { length: 512 }),
  /** Previous expiry date */
  oldExpiryDate: date("oldExpiryDate"),
  /** Previous issue date */
  oldIssueDate: date("oldIssueDate"),
  /** Previous reference number */
  oldReferenceNumber: varchar("oldReferenceNumber", { length: 255 }),
  /** === NEW VERSION (what replaced it) === */
  /** New Odoo document ID */
  newOdooDocumentId: int("newOdooDocumentId"),
  /** New document name */
  newDocumentName: varchar("newDocumentName", { length: 512 }),
  /** New expiry date */
  newExpiryDate: date("newExpiryDate"),
  /** New issue date */
  newIssueDate: date("newIssueDate"),
  /** New reference number */
  newReferenceNumber: varchar("newReferenceNumber", { length: 255 }),
  /** Notes about the renewal */
  notes: text("notes"),
  /** Who performed the renewal */
  renewedBy: varchar("renewedBy", { length: 128 }),
  /** When the renewal was recorded */
  renewedAt: timestamp("renewedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DocumentRenewal = typeof documentRenewals.$inferSelect;
export type InsertDocumentRenewal = typeof documentRenewals.$inferInsert;

// ── Cron Email Log ──────────────────────────────────────────────────────
// Tracks daily cron email sends to prevent duplicate emails on server restarts.
export const cronEmailLog = mysqlTable("cron_email_log", {
  id: int("id").autoincrement().primaryKey(),
  /** Type of cron email: 'company_doc_expiry', 'shipment_doc_alert', etc. */
  cronType: varchar("cronType", { length: 64 }).notNull(),
  /** The calendar date (YYYY-MM-DD) for which this email was sent */
  sentDate: varchar("sentDate", { length: 10 }).notNull(),
  /** Number of recipients the email was sent to */
  recipientCount: int("recipientCount").default(0),
  /** Number of items (documents/shipments) included in the email */
  itemCount: int("itemCount").default(0),
  /** Whether the email was sent successfully */
  success: int("success").default(1),
  /** Timestamp of when the email was sent */
  sentAt: timestamp("sentAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("cron_type_date_idx").on(table.cronType, table.sentDate),
]);
export type CronEmailLog = typeof cronEmailLog.$inferSelect;
export type InsertCronEmailLog = typeof cronEmailLog.$inferInsert;

// ── Petty Cash Transactions ────────────────────────────────────────────
// Tracks petty cash top-ups, expense deductions, and manual adjustments per employee.
export const pettyCashTransactions = mysqlTable("petty_cash_transactions", {
  id: int("id").autoincrement().primaryKey(),
  /** Odoo employee ID */
  employeeId: int("employeeId").notNull(),
  /** Employee display name (denormalized for fast reads) */
  employeeName: varchar("employeeName", { length: 255 }).notNull(),
  /** Odoo company ID */
  companyId: int("companyId").notNull(),
  /** Company display name */
  companyName: varchar("companyName", { length: 255 }).notNull(),
  /** Transaction type: top_up | expense_deduction | adjustment */
  type: mysqlEnum("type", ["top_up", "expense_deduction", "adjustment"]).notNull(),
  /** Amount (positive for top-up, negative for deduction) */
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  /** Reference or description */
  reference: text("reference"),
  /** Who created this transaction (user display name) */
  createdBy: varchar("createdBy", { length: 255 }),
  /** Linked expense sheet ID (if type = expense_deduction) */
  expenseSheetId: int("expenseSheetId"),
  /** Transaction date */
  txDate: timestamp("txDate").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PettyCashTransaction = typeof pettyCashTransactions.$inferSelect;
export type InsertPettyCashTransaction = typeof pettyCashTransactions.$inferInsert;

// ── Petty Cash Top-Up Requests ─────────────────────────────────────────
// Employees or managers request top-ups; accountant approves/rejects.
export const pettyCashRequests = mysqlTable("petty_cash_requests", {
  id: int("id").autoincrement().primaryKey(),
  /** Odoo employee ID */
  employeeId: int("employeeId").notNull(),
  employeeName: varchar("employeeName", { length: 255 }).notNull(),
  companyId: int("companyId").notNull(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  /** Requested amount */
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  /** Purpose / reason */
  purpose: text("purpose"),
  /** Additional notes */
  notes: text("notes"),
  /** Status: pending | disbursed | rejected */
  status: mysqlEnum("status", ["pending", "disbursed", "rejected"]).notNull().default("pending"),
  /** Accountant who processed */
  processedBy: varchar("processedBy", { length: 255 }),
  processedAt: timestamp("processedAt"),
  requestDate: timestamp("requestDate").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PettyCashRequest = typeof pettyCashRequests.$inferSelect;
export type InsertPettyCashRequest = typeof pettyCashRequests.$inferInsert;

// ── PCE Reminders ──────────────────────────────────────────────────────
// Configurable reminders for expense report submissions.
export const pceReminders = mysqlTable("pce_reminders", {
  id: int("id").autoincrement().primaryKey(),
  /** Odoo employee ID */
  employeeId: int("employeeId").notNull(),
  employeeName: varchar("employeeName", { length: 255 }).notNull(),
  /** Frequency: daily | weekly | monthly */
  freq: mysqlEnum("freq", ["daily", "weekly", "monthly"]).notNull().default("weekly"),
  /** Hour of day (0-23) */
  hour: int("hour").notNull().default(9),
  /** Day of week (0=Sun, 6=Sat) — used when freq=weekly */
  dow: int("dow").default(0),
  /** Day of month (1-31) — used when freq=monthly */
  dom: int("dom").default(1),
  /** Reminder message (Arabic/English) */
  message: text("message"),
  /** Whether this reminder is active */
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type PceReminder = typeof pceReminders.$inferSelect;
export type InsertPceReminder = typeof pceReminders.$inferInsert;

// ── Leave Settings ────────────────────────────────────────────────────
// Per-employee leave accrual configuration.
// Balance is calculated dynamically: accrued = months_worked × (annualLeaveDays / 12) - used
export const leaveSettings = mysqlTable("leave_settings", {
  id: int("id").autoincrement().primaryKey(),
  /** Odoo employee ID */
  odooEmployeeId: int("odooEmployeeId").notNull().unique(),
  /** Employee name (denormalized for display) */
  employeeName: varchar("employeeName", { length: 255 }).notNull(),
  /** Odoo company ID */
  companyId: int("companyId"),
  /** Company name (denormalized) */
  companyName: varchar("companyName", { length: 255 }),
  /** Joining date — the date the employee started working (from contract or manual entry) */
  joiningDate: date("joiningDate").notNull(),
  /** Annual leave entitlement in days (e.g., 21, 30). Default 21 days/year */
  annualLeaveDays: decimal("annualLeaveDays", { precision: 5, scale: 2 }).notNull().default("21.00"),
  /** Optional notes */
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LeaveSetting = typeof leaveSettings.$inferSelect;
export type InsertLeaveSetting = typeof leaveSettings.$inferInsert;

// ── Salary History ────────────────────────────────────────────────────────
// Records every wage change for an employee for audit and progression tracking.
export const salaryHistory = mysqlTable("salary_history", {
  id: int("id").autoincrement().primaryKey(),
  /** Odoo employee ID */
  odooEmployeeId: int("odooEmployeeId").notNull(),
  /** Employee name (denormalized for display) */
  employeeName: varchar("employeeName", { length: 255 }).notNull(),
  /** Odoo contract ID */
  odooContractId: int("odooContractId").notNull(),
  /** Previous basic salary (0 if first entry) */
  previousWage: decimal("previousWage", { precision: 12, scale: 2 }).notNull().default("0.00"),
  /** New basic salary */
  newWage: decimal("newWage", { precision: 12, scale: 2 }).notNull(),
  /** Previous housing allowance */
  previousHousing: decimal("previousHousing", { precision: 12, scale: 2 }).notNull().default("0.00"),
  /** New housing allowance */
  newHousing: decimal("newHousing", { precision: 12, scale: 2 }).notNull().default("0.00"),
  /** Previous transport allowance */
  previousTransport: decimal("previousTransport", { precision: 12, scale: 2 }).notNull().default("0.00"),
  /** New transport allowance */
  newTransport: decimal("newTransport", { precision: 12, scale: 2 }).notNull().default("0.00"),
  /** Previous other allowances */
  previousOther: decimal("previousOther", { precision: 12, scale: 2 }).notNull().default("0.00"),
  /** New other allowances */
  newOther: decimal("newOther", { precision: 12, scale: 2 }).notNull().default("0.00"),
  /** Currency code (EGP, AED, etc.) */
  currency: varchar("currency", { length: 8 }).notNull().default("EGP"),
  /** Optional note about the reason for change */
  note: text("note"),
  /** When the change was recorded */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SalaryHistory = typeof salaryHistory.$inferSelect;
export type InsertSalaryHistory = typeof salaryHistory.$inferInsert;

// ── Property Portfolio Management ──────────────────────────────────────────────

export const userSettings = mysqlTable("user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  egpToAedRate: decimal("egpToAedRate", { precision: 12, scale: 6 }).default("0.077000").notNull(),
  defaultCurrency: mysqlEnum("defaultCurrency", ["AED", "EGP", "Aggregated"]).default("AED").notNull(),
  emailNotifications: mysqlEnum("emailNotifications", ["on", "off"]).default("on").notNull(),
  paymentReminders: mysqlEnum("paymentReminders", ["on", "off"]).default("on").notNull(),
  reminderDaysBefore: int("reminderDaysBefore").default(7).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

export const properties = mysqlTable("properties", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  propertyName: varchar("propertyName", { length: 255 }).notNull(),
  developerName: varchar("developerName", { length: 255 }).notNull(),
  projectName: varchar("projectName", { length: 255 }).notNull(),
  country: mysqlEnum("country", ["UAE", "Egypt"]).notNull(),
  city: varchar("city", { length: 128 }).notNull(),
  district: varchar("district", { length: 128 }),
  fullAddress: text("fullAddress"),
  latitude: float("latitude"),
  longitude: float("longitude"),
  unitType: mysqlEnum("unitType", ["Apartment", "Villa", "Townhouse", "Twin House", "Duplex", "Chalet", "Penthouse", "Studio", "Land"]).notNull(),
  bedrooms: int("bedrooms").default(0),
  bathrooms: int("bathrooms"),
  builtUpAreaSqm: float("builtUpAreaSqm"),
  plotAreaSqm: float("plotAreaSqm"),
  floorNumber: int("floorNumber"),
  unitNumber: varchar("unitNumber", { length: 64 }),
  buildingName: varchar("buildingName", { length: 255 }),
  viewType: varchar("viewType", { length: 128 }),
  furnishing: mysqlEnum("furnishing", ["Unfurnished", "Semi-Furnished", "Fully-Furnished"]),
  parkingSpaces: int("parkingSpaces").default(0),
  purchaseDate: varchar("purchaseDate", { length: 10 }).notNull(),
  expectedDelivery: varchar("expectedDelivery", { length: 10 }),
  actualDelivery: varchar("actualDelivery", { length: 10 }),
  deliveryStatus: mysqlEnum("deliveryStatus", ["Off-Plan", "Under-Construction", "Delivered", "Handed-Over"]).notNull(),
  totalPrice: decimal("totalPrice", { precision: 18, scale: 2 }),
  currency: mysqlEnum("currency", ["AED", "EGP"]).notNull(),
  currentMarketValue: decimal("currentMarketValue", { precision: 18, scale: 2 }),
  valueLastUpdated: varchar("valueLastUpdated", { length: 10 }),
  purpose: mysqlEnum("purpose", ["Primary Residence", "Investment", "Holiday Home", "Rental"]),
  notes: text("notes"),
  status: mysqlEnum("status", ["Active", "Sold", "Transferred"]).default("Active").notNull(),
  purchaseType: mysqlEnum("purchaseType", ["Direct", "Mortgage", "Secondary Market"]),
  originalContractValue: decimal("originalContractValue", { precision: 18, scale: 2 }),
  premiumPaid: decimal("premiumPaid", { precision: 18, scale: 2 }),
  sellerName: varchar("sellerName", { length: 255 }),
  sellerContact: varchar("sellerContact", { length: 255 }),
  saleDate: varchar("saleDate", { length: 10 }),
  salePrice: decimal("salePrice", { precision: 18, scale: 2 }),
  buyerName: varchar("buyerName", { length: 255 }),
  buyerContact: varchar("buyerContact", { length: 255 }),
  buyerEmail: varchar("buyerEmail", { length: 320 }),
  premiumReceived: decimal("premiumReceived", { precision: 18, scale: 2 }),
  saleNotes: text("saleNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Property = typeof properties.$inferSelect;
export type InsertProperty = typeof properties.$inferInsert;

export const activityLog = mysqlTable("activity_log", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["note", "visit", "payment", "document", "maintenance", "valuation", "other"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  date: varchar("date", { length: 10 }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }),
  currency: mysqlEnum("currency", ["AED", "EGP"]),
  contactName: varchar("contactName", { length: 255 }),
  contactPhone: varchar("contactPhone", { length: 64 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = typeof activityLog.$inferInsert;

export const paymentSchedules = mysqlTable("payment_schedules", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  installmentLabel: varchar("installmentLabel", { length: 255 }).notNull(),
  installmentNumber: int("installmentNumber").notNull(),
  dueDate: varchar("dueDate", { length: 10 }).notNull(),
  amountDue: decimal("amountDue", { precision: 18, scale: 2 }).notNull(),
  amountPaid: decimal("amountPaid", { precision: 18, scale: 2 }).default("0").notNull(),
  paymentDate: varchar("paymentDate", { length: 10 }),
  paymentMethod: varchar("paymentMethod", { length: 128 }),
  paymentReference: varchar("paymentReference", { length: 255 }),
  paymentStatus: mysqlEnum("paymentStatus", ["Paid", "Pending", "Overdue", "Partially-Paid"]).default("Pending").notNull(),
  percentageOfTotal: float("percentageOfTotal"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PaymentSchedule = typeof paymentSchedules.$inferSelect;
export type InsertPaymentSchedule = typeof paymentSchedules.$inferInsert;

export const contracts = mysqlTable("contracts", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  contractType: mysqlEnum("contractType", ["SPA", "MOU", "Addendum", "NOC", "Title Deed", "Other"]).notNull(),
  contractNumber: varchar("contractNumber", { length: 128 }),
  signedDate: varchar("signedDate", { length: 10 }),
  expiryDate: varchar("expiryDate", { length: 10 }),
  counterpartyName: varchar("counterpartyName", { length: 255 }),
  notes: text("notes"),
  documentId: int("documentId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

export const propDocuments = mysqlTable("prop_documents", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId"),
  userId: int("userId").notNull(),
  documentType: varchar("documentType", { length: 128 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 128 }),
  description: text("description"),
  uploadDate: varchar("uploadDate", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PropDocument = typeof propDocuments.$inferSelect;
export type InsertPropDocument = typeof propDocuments.$inferInsert;

export const rentals = mysqlTable("rentals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  propertyName: varchar("propertyName", { length: 255 }).notNull(),
  unitRef: varchar("unitRef", { length: 128 }),
  location: varchar("location", { length: 255 }),
  landlord: varchar("landlord", { length: 255 }),
  contractNumber: varchar("contractNumber", { length: 128 }),
  contractStartDate: varchar("contractStartDate", { length: 10 }).notNull(),
  contractEndDate: varchar("contractEndDate", { length: 10 }).notNull(),
  annualRent: decimal("annualRent", { precision: 18, scale: 2 }).notNull(),
  currency: mysqlEnum("currency", ["AED", "EGP"]).default("AED").notNull(),
  securityDeposit: decimal("securityDeposit", { precision: 18, scale: 2 }),
  numberOfCheques: int("numberOfCheques").default(4),
  bankName: varchar("bankName", { length: 255 }),
  status: mysqlEnum("status", ["Active", "Expired", "Terminated", "Renewed"]).default("Active").notNull(),
  notes: text("notes"),
  contractDocumentId: int("contractDocumentId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Rental = typeof rentals.$inferSelect;
export type InsertRental = typeof rentals.$inferInsert;

export const rentalPayments = mysqlTable("rental_payments", {
  id: int("id").autoincrement().primaryKey(),
  rentalId: int("rentalId").notNull(),
  chequeNumber: varchar("chequeNumber", { length: 64 }),
  installmentLabel: varchar("installmentLabel", { length: 255 }).notNull(),
  installmentNumber: int("installmentNumber").notNull(),
  dueDate: varchar("dueDate", { length: 10 }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["Paid", "Pending", "Overdue", "Bounced"]).default("Pending").notNull(),
  paymentDate: varchar("paymentDate", { length: 10 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type RentalPayment = typeof rentalPayments.$inferSelect;
export type InsertRentalPayment = typeof rentalPayments.$inferInsert;

export const reminderAlertsSent = mysqlTable("reminder_alerts_sent", {
  id: int("id").autoincrement().primaryKey(),
  entityType: mysqlEnum("entityType", ["payment_schedule", "rental_payment"]).notNull(),
  entityId: int("entityId").notNull(),
  daysBefore: int("daysBefore").notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});
export type ReminderAlertSent = typeof reminderAlertsSent.$inferSelect;
export type InsertReminderAlertSent = typeof reminderAlertsSent.$inferInsert;
