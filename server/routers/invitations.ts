// INVITATIONS ROUTER
// Admin-only procedures for inviting new users and managing invitations.
// Public procedure for looking up an invitation by token (used by onboarding page).
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { z } from "zod";
import {
  createInvitation,
  getInvitationByToken,
  listInvitations,
  updateInvitationStatus,
} from "../db";
import { sendInvitationEmail } from "../email";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

// Admin-only middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

/** Generate a cryptographically secure invitation token */
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Build the full invitation URL for a given token */
function buildInviteUrl(token: string): string {
  // Use the request origin or fall back to the production domain
  const base = "https://erp.platfarm.io";
  return `${base}/invite/${token}`;
}

export const invitationsRouter = router({
  /** Send an invitation email to a new user */
  inviteUser: adminProcedure
    .input(
      z.object({
        email: z.string().email("Please enter a valid email address"),
        role: z.enum(["user", "admin"]).default("user"),
        presetPermissions: z
          .array(
            z.object({
              moduleId: z.string(),
              canView: z.number().min(0).max(1),
              canCreate: z.number().min(0).max(1),
              canEdit: z.number().min(0).max(1),
              canDelete: z.number().min(0).max(1),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const invitedBy = ctx.user.name ?? ctx.user.email ?? "Platfarm Admin";

      await createInvitation({
        token,
        email: input.email,
        role: input.role,
        invitedBy,
        status: "pending",
        presetPermissions: input.presetPermissions ?? null,
        expiresAt,
      });

      const inviteUrl = buildInviteUrl(token);

      const emailSent = await sendInvitationEmail({
        to: input.email,
        invitedBy,
        role: input.role,
        inviteUrl,
        expiresAt,
      });

      return { success: true, emailSent, inviteUrl };
    }),

  /** List all invitations (admin only) */
  listInvitations: adminProcedure.query(async () => {
    const rows = await listInvitations();
    // Mark expired invitations (status still "pending" but past expiresAt)
    const now = new Date();
    return rows.map((inv) => ({
      ...inv,
      isExpired: inv.status === "pending" && inv.expiresAt < now,
    }));
  }),

  /** Revoke a pending invitation */
  revokeInvitation: adminProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const inv = await getInvitationByToken(input.token);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      if (inv.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only pending invitations can be revoked" });
      }
      await updateInvitationStatus(input.token, "revoked");
      return { success: true };
    }),

  /** Get invitation details by token (public — used by the onboarding page) */
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const inv = await getInvitationByToken(input.token);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found or already used" });

      const now = new Date();
      if (inv.status === "revoked") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This invitation has been revoked" });
      }
      if (inv.status === "accepted") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This invitation has already been accepted" });
      }
      if (inv.status === "pending" && inv.expiresAt < now) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This invitation has expired" });
      }

      return {
        email: inv.email,
        role: inv.role,
        invitedBy: inv.invitedBy,
        expiresAt: inv.expiresAt,
        presetPermissions: inv.presetPermissions,
      };
    }),
});
