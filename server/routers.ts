import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { odooRouter } from "./routers/odoo";
import { shipmentsRouter } from "./routers/shipments";
import { salesShipmentsRouter } from "./routers/salesShipments";
import { vesselTrackingRouter } from "./routers/vesselTracking";
import { draftsRouter } from "./routers/drafts";
import { notificationsRouter } from "./routers/notifications";
import { documentsRouter } from "./routers/documents";
import { productionRouter } from "./routers/production";
import { quotationsRouter } from "./routers/quotations";
import { hrRouter } from "./routers/hr";
import { dmsRouter } from "./routers/dms";
import { crmRouter } from "./routers/crm";
import { inventoryRouter } from "./routers/inventory";
import { periodicInventoryRouter } from "./routers/periodic-inventory";
import { financeRouter } from "./routers/finance";
import { operationsRouter } from "./routers/operations";
import { userManagementRouter } from "./routers/userManagement";
import { invitationsRouter } from "./routers/invitations";
import { offlineOpsRouter } from "./routers/offlineOps";
import { companyDocumentsRouter } from "./routers/companyDocuments";
import { pceRouter } from "./routers/pce";
import { propertyRouter } from "./routers/property";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      // Clear Manus OAuth session
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      // Also clear local email/password session
      ctx.res.clearCookie("platfarm_session", { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Odoo ERP integration
  odoo: odooRouter,

  // Purchase Shipments
  shipments: shipmentsRouter,

  // Sales Shipments
  salesShipments: salesShipmentsRouter,

  // Vessel Tracking (Tradlinx)
  vesselTracking: vesselTrackingRouter,

  // Shipment Drafts
  drafts: draftsRouter,

  // Notifications (status change alerts)
  notifications: notificationsRouter,

  // Document hard copy tracking & alerts
  documents: documentsRouter,

  // Double Press Production (Manufacturing)
  production: productionRouter,

  // Quotations, Invoices & Payment Receipts
  quotations: quotationsRouter,

  // HR Management
  hr: hrRouter,

  // Document Management System (Odoo Documents)
  dms: dmsRouter,

  // CRM — Investment Cycles Management
  crm: crmRouter,

  // Inventory & Warehouse Management
  inventory: inventoryRouter,

  // Periodic Inventory Submissions
  periodicInventory: periodicInventoryRouter,

  // Finance & Accounting
  finance: financeRouter,
  // Operations Dashboard
  operations: operationsRouter,

  // User Management & Access Control (admin-only)
  userMgmt: userManagementRouter,

  // User Invitations & Onboarding
  invitations: invitationsRouter,

  // Offline Operations (Field Ops)
  offlineOps: offlineOpsRouter,

  // Company Documents (Expiry Tracking)
  companyDocs: companyDocumentsRouter,
  // Petty Cash & Expenses
  pce: pceRouter,

  // Property Portfolio
  property: propertyRouter,

});

export type AppRouter = typeof appRouter;
