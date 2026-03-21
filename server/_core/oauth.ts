import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // Check if this is a brand-new user (no existing record)
      const existingUser = await db.getUserByOpenId(userInfo.openId);
      const isNewUser = !existingUser;

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      // ── Invitation: apply pre-configured permissions on first login ──────────
      // The frontend stores the invite token in a cookie header via a custom
      // query param so we can retrieve it server-side without sessionStorage.
      // The invite token is passed as ?invite_token=<token> in the OAuth state
      // OR as the X-Invite-Token request header (set by the onboarding page).
      // We also check the invite_token query param directly.
      const inviteToken =
        getQueryParam(req, "invite_token") ??
        (req.headers["x-invite-token"] as string | undefined);

      if (inviteToken) {
        try {
          const invitation = await db.getInvitationByToken(inviteToken);
          if (
            invitation &&
            invitation.status === "pending" &&
            invitation.expiresAt > new Date()
          ) {
            // Get the freshly-upserted user record
            const user = await db.getUserByOpenId(userInfo.openId);
            if (user) {
              // Apply pre-configured role
              if (invitation.role && invitation.role !== user.role) {
                await db.updateUserRole(user.id, invitation.role);
              }

              // Apply pre-configured module permissions (only for new users or
              // if the user has no permissions yet)
              if (invitation.presetPermissions && (isNewUser || (await db.getUserPermissions(user.id)).length === 0)) {
                const perms = invitation.presetPermissions as Array<{
                  moduleId: string;
                  canView: number;
                  canCreate: number;
                  canEdit: number;
                  canDelete: number;
                }>;
                if (Array.isArray(perms) && perms.length > 0) {
                  await db.deleteUserPermissions(user.id);
                  for (const p of perms) {
                    await db.setUserModulePermission(user.id, p.moduleId, {
                      canView: p.canView,
                      canCreate: p.canCreate,
                      canEdit: p.canEdit,
                      canDelete: p.canDelete,
                    }, invitation.invitedBy ?? "system");
                  }
                }
              }

              // Mark invitation as accepted
              await db.updateInvitationStatus(inviteToken, "accepted", user.id);
              console.log(`[OAuth] Invitation accepted for user ${user.id} (${user.email})`);
            }
          }
        } catch (inviteErr) {
          // Non-fatal: log and continue — user still gets logged in
          console.warn("[OAuth] Failed to apply invitation permissions:", inviteErr);
        }
      }
      // ─────────────────────────────────────────────────────────────────────────

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
