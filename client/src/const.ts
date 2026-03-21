export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Primary login URL — the custom email/password login page.
// Manus OAuth is still available as an option on the login page itself.
export const getLoginUrl = () => "/login";

// Manus OAuth URL — used as a fallback option on the login page.
export const getManusOAuthUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  // Always use the canonical domain for OAuth redirect to avoid landing on .manus.space
  const origin = "https://erp.platfarm.io";
  const redirectUri = `${origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
