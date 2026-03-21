// Custom email/password authentication routes
// These run alongside the existing Manus OAuth flow.
// Invited users register here; returning users log in here.
//
// KEY DESIGN: We reuse the SAME `app_session_id` cookie and sdk.createSessionToken()
// so that the existing Manus OAuth session infrastructure picks up local auth users
// without any special handling in the tRPC context.
// ══════════════════════════════════════════════════════════════════════════════

import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import * as db from "../db";
import { sendPasswordResetEmail } from "../email";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const ONE_HOUR_MS = 60 * 60 * 1000;

const SALT_ROUNDS = 12;

export function registerLocalAuthRoutes(app: Express) {
  // ── POST /api/auth/register ──────────────────────────────────────────────
  // Called from the /invite/:token onboarding page.
  // Validates the invite token, creates the user with a hashed password,
  // applies pre-configured permissions, and issues a session cookie.
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { token, name, password } = req.body as {
        token?: string;
        name?: string;
        password?: string;
      };

      if (!token || !name || !password) {
        res.status(400).json({ error: "token, name, and password are required" });
        return;
      }

      if (password.length < 8) {
        res.status(400).json({ error: "Password must be at least 8 characters" });
        return;
      }

      // Validate invitation token
      const invitation = await db.getInvitationByToken(token);
      if (!invitation) {
        res.status(400).json({ error: "Invalid or expired invitation link" });
        return;
      }
      if (invitation.status !== "pending") {
        res.status(400).json({ error: `This invitation has already been ${invitation.status}` });
        return;
      }
      if (new Date(invitation.expiresAt) < new Date()) {
        res.status(400).json({ error: "This invitation has expired. Please request a new one." });
        return;
      }

      // Check if a user with this email already exists
      const existing = await db.getUserByEmail(invitation.email);
      if (existing) {
        // If user exists but has no password (OAuth user), set their password
        if (!existing.passwordHash) {
          const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
          await db.updateUserPassword(existing.id, passwordHash);
          await db.updateUserLastSignedIn(existing.id);
          await db.updateInvitationStatus(token, "accepted", existing.id);
          const sessionToken = await sdk.createSessionToken(existing.openId, {
            name: existing.name ?? "",
            expiresInMs: ONE_YEAR_MS,
          });
          res.cookie(COOKIE_NAME, sessionToken, {
            ...getSessionCookieOptions(req),
            maxAge: ONE_YEAR_MS,
          });
          res.json({ ok: true, user: { id: existing.id, name: existing.name, email: existing.email, role: existing.role } });
          return;
        }
        res.status(409).json({ error: "An account with this email already exists. Please log in instead." });
        return;
      }

      // Hash password and create user
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const user = await db.createLocalUser({
        name: name.trim(),
        email: invitation.email,
        passwordHash,
        role: (invitation.role as "user" | "admin") ?? "user",
      });

      if (!user) {
        res.status(500).json({ error: "Failed to create account" });
        return;
      }

      // Apply pre-configured module permissions
      if (invitation.presetPermissions) {
        try {
          const perms = invitation.presetPermissions as Array<{
            moduleId: string;
            canView: number;
            canCreate: number;
            canEdit: number;
            canDelete: number;
          }>;
          if (Array.isArray(perms) && perms.length > 0) {
            for (const p of perms) {
              await db.setUserModulePermission(user.id, p.moduleId, {
                canView: p.canView,
                canCreate: p.canCreate,
                canEdit: p.canEdit,
                canDelete: p.canDelete,
              }, invitation.invitedBy ?? "system");
            }
          }
        } catch (permErr) {
          console.warn("[LocalAuth] Failed to apply preset permissions:", permErr);
        }
      }

      // Mark invitation as accepted
      await db.updateInvitationStatus(token, "accepted", user.id);

      // Issue session using the same cookie/token format as Manus OAuth
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name ?? "",
        expiresInMs: ONE_YEAR_MS,
      });
      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });

      console.log(`[LocalAuth] New user registered: ${user.email} (id=${user.id})`);
      res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
      console.error("[LocalAuth] Register failed:", err);
      res.status(500).json({ error: "Registration failed. Please try again." });
    }
  });

  // ── POST /api/auth/login ─────────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };

      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      const user = await db.getUserByEmail(email.toLowerCase().trim());
      if (!user || !user.passwordHash) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      if (user.status === "inactive") {
        res.status(403).json({ error: "Your account has been deactivated. Please contact your administrator." });
        return;
      }

      const passwordMatch = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatch) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      await db.updateUserLastSignedIn(user.id);

      // Issue session using the same cookie/token format as Manus OAuth
      // This ensures the existing sdk.authenticateRequest picks it up automatically
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name ?? "",
        expiresInMs: ONE_YEAR_MS,
      });
      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });

      console.log(`[LocalAuth] User logged in: ${user.email} (id=${user.id})`);
      res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
      console.error("[LocalAuth] Login failed:", err);
      res.status(500).json({ error: "Login failed. Please try again." });
    }
  });

  // ── POST /api/auth/request-reset ───────────────────────────────────────
  // Accepts an email address, generates a 1-hour reset token, and sends the
  // reset link by email. Always returns 200 to avoid user enumeration.
  app.post("/api/auth/request-reset", async (req: Request, res: Response) => {
    try {
      const { email } = req.body as { email?: string };
      if (!email) {
        res.status(400).json({ error: "Email is required" });
        return;
      }
      const user = await db.getUserByEmail(email.toLowerCase().trim());
      // Always respond OK to prevent user enumeration
      if (!user || !user.passwordHash) {
        res.json({ ok: true });
        return;
      }
      if (user.status === "inactive") {
        res.json({ ok: true });
        return;
      }
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + ONE_HOUR_MS);
      await db.createPasswordResetToken({ token, userId: user.id, email: user.email!, expiresAt });
      // Build reset URL from request origin
      const origin = `${req.protocol}://${req.get("host")}`;
      const resetUrl = `${origin}/reset-password/${token}`;
      await sendPasswordResetEmail({ to: user.email!, name: user.name ?? "there", resetUrl, expiresAt });
      console.log(`[LocalAuth] Password reset requested for: ${user.email}`);
      res.json({ ok: true });
    } catch (err) {
      console.error("[LocalAuth] request-reset failed:", err);
      res.status(500).json({ error: "Failed to process request. Please try again." });
    }
  });

  // ── POST /api/auth/reset-password ───────────────────────────────────────
  // Validates the reset token, updates the user’s password, and marks the
  // token as used. Issues a new session so the user is logged in immediately.
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body as { token?: string; password?: string };
      if (!token || !password) {
        res.status(400).json({ error: "token and password are required" });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: "Password must be at least 8 characters" });
        return;
      }
      const resetToken = await db.getPasswordResetToken(token);
      if (!resetToken) {
        res.status(400).json({ error: "Invalid or expired reset link" });
        return;
      }
      if (resetToken.usedAt) {
        res.status(400).json({ error: "This reset link has already been used" });
        return;
      }
      if (new Date(resetToken.expiresAt) < new Date()) {
        res.status(400).json({ error: "This reset link has expired. Please request a new one." });
        return;
      }
      const user = await db.getUserById(resetToken.userId);
      if (!user) {
        res.status(400).json({ error: "User not found" });
        return;
      }
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      await db.updateUserPassword(user.id, passwordHash);
      await db.markResetTokenUsed(token);
      await db.updateUserLastSignedIn(user.id);
      // Issue a new session so the user is logged in immediately after reset
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name ?? "",
        expiresInMs: ONE_YEAR_MS,
      });
      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });
      console.log(`[LocalAuth] Password reset completed for: ${user.email}`);
      res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
      console.error("[LocalAuth] reset-password failed:", err);
      res.status(500).json({ error: "Failed to reset password. Please try again." });
    }
  });

  // ── POST /api/auth/logout ──────────────────────────────────────────
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ ok: true });
  });

  // ── GET /api/auth/me ─────────────────────────────────────────────────────
  // Lightweight endpoint for the login page to check if already authenticated
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      res.json({ id: user.id, name: user.name, email: user.email, role: user.role, status: user.status });
    } catch {
      res.status(401).json({ error: "Not authenticated" });
    }
  });
}

// ── Helper: read local auth session from request (kept for backwards compat) ──
// Now unused since we use the same app_session_id cookie as Manus OAuth.
export async function getLocalAuthUser(_req: Request) {
  return null;
}
