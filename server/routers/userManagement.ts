// USER MANAGEMENT ROUTER
// Admin-only procedures for managing users and per-module access privileges.
// All procedures require admin role via adminProcedure middleware.

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  deleteUserPermissions,
  getAllPermissions,
  getAllUserCompanyAccess,
  getUserById,
  getUserCompanyAccess,
  getUserPermissions,
  listAllUsers,
  setUserCompanyAccess,
  setUserModulePermission,
  updateUserRole,
  updateUserStatus,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

// Admin-only middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// All active module IDs in the portal
export const PORTAL_MODULES = [
  { id: "purchase", title: "Purchase & Sales Shipments" },
  { id: "production", title: "Production" },
  { id: "documents", title: "Document Generator" },
  { id: "investments", title: "Investments" },
  { id: "supplychain", title: "Supply Chain" },
  { id: "hr", title: "Human Resources" },
  { id: "dms", title: "Document Management" },
  { id: "accounting", title: "Finance" },
  { id: "inventory", title: "Inventory & Warehouse" },
  { id: "operations", title: "Operations Dashboard" },
  { id: "meetings", title: "Periodic Meetings" },
  { id: "crm", title: "CRM" },
  { id: "reports", title: "Reports & Analytics" },
] as const;

export const userManagementRouter = router({
  // List all users with their permissions
  listUsers: adminProcedure.query(async () => {
    const allUsers = await listAllUsers();
    const allPerms = await getAllPermissions();
    return allUsers.map((u) => ({
      ...u,
      permissions: allPerms.filter((p) => p.userId === u.id),
    }));
  }),

  // Get a single user with their permissions
  getUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const user = await getUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      const permissions = await getUserPermissions(input.userId);
      return { ...user, permissions };
    }),

  // Toggle a user's active/inactive status
  updateStatus: adminProcedure
    .input(z.object({ userId: z.number(), status: z.enum(["active", "inactive"]) }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot deactivate your own account" });
      }
      await updateUserStatus(input.userId, input.status);
      return { success: true };
    }),

  // Update a user's role (admin ↔ user)
  updateRole: adminProcedure
    .input(z.object({ userId: z.number(), role: z.enum(["admin", "user"]) }))
    .mutation(async ({ input, ctx }) => {
      // Prevent admin from demoting themselves
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot change your own role" });
      }
      await updateUserRole(input.userId, input.role);
      return { success: true };
    }),

  // Set permissions for a single module for a user (upsert)
  setModulePermission: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        moduleId: z.string(),
        canView: z.number().min(0).max(1),
        canCreate: z.number().min(0).max(1),
        canEdit: z.number().min(0).max(1),
        canDelete: z.number().min(0).max(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await setUserModulePermission(
        input.userId,
        input.moduleId,
        {
          canView: input.canView,
          canCreate: input.canCreate,
          canEdit: input.canEdit,
          canDelete: input.canDelete,
        },
        ctx.user.name ?? ctx.user.email ?? "admin"
      );
      return { success: true };
    }),

  // Set all module permissions for a user at once (batch upsert)
  setAllPermissions: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        permissions: z.array(
          z.object({
            moduleId: z.string(),
            canView: z.number().min(0).max(1),
            canCreate: z.number().min(0).max(1),
            canEdit: z.number().min(0).max(1),
            canDelete: z.number().min(0).max(1),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const updatedBy = ctx.user.name ?? ctx.user.email ?? "admin";
      for (const perm of input.permissions) {
        await setUserModulePermission(
          input.userId,
          perm.moduleId,
          {
            canView: perm.canView,
            canCreate: perm.canCreate,
            canEdit: perm.canEdit,
            canDelete: perm.canDelete,
          },
          updatedBy
        );
      }
      return { success: true };
    }),

  // Get the current user's own permissions (used by portal to filter modules)
  myPermissions: protectedProcedure.query(async ({ ctx }) => {
    // Admins always have full access
    if (ctx.user.role === "admin") {
      return {
        isAdmin: true,
        permissions: PORTAL_MODULES.map((m) => ({
          moduleId: m.id,
          canView: 1,
          canCreate: 1,
          canEdit: 1,
          canDelete: 1,
        })),
      };
    }
    const permissions = await getUserPermissions(ctx.user.id);
    return { isAdmin: false, permissions };
  }),

  // List all portal modules (for the permission matrix UI)
  listModules: adminProcedure.query(() => {
    return PORTAL_MODULES;
  }),

  // ── Company Access ────────────────────────────────────────────────────────

  // Get company access settings for a specific user (admin only)
  getUserCompanyAccess: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      return getUserCompanyAccess(input.userId);
    }),

  // Get company access settings for ALL users at once (admin overview)
  getAllCompanyAccess: adminProcedure.query(async () => {
    return getAllUserCompanyAccess();
  }),

  // Set company access for a user (admin only)
  // allowedCompanyIds=[] means unrestricted (all companies visible)
  // defaultCompanyId=null means no explicit default
  setUserCompanyAccess: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        allowedCompanyIds: z.array(z.number()),
        defaultCompanyId: z.number().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const updatedBy = ctx.user.name ?? ctx.user.email ?? "admin";
      await setUserCompanyAccess(
        input.userId,
        input.allowedCompanyIds,
        input.defaultCompanyId,
        updatedBy
      );
      return { success: true };
    }),

  // Get the current user's own company access (used by useCompanySelector hook)
  myCompanyAccess: protectedProcedure.query(async ({ ctx }) => {
    // Admins always see all companies with no default restriction
    if (ctx.user.role === "admin") {
      return { isAdmin: true, allowedCompanyIds: [], defaultCompanyId: null };
    }
    const rows = await getUserCompanyAccess(ctx.user.id);
    const allowedIds = rows.map((r) => r.odooCompanyId);
    const defaultRow = rows.find((r) => r.isDefault === 1);
    return {
      isAdmin: false,
      allowedCompanyIds: allowedIds,
      defaultCompanyId: defaultRow?.odooCompanyId ?? null,
    };
  }),
});
