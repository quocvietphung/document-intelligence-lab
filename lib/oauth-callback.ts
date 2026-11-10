import { oauthCookie } from "./connector-proxy";

const locales = ["en", "de", "vi"];

/**
 * Google redirects here after consent. The code and state are moved into a short-lived HttpOnly cookie scoped
 * to /api/connectors, so page JavaScript, history and referrers never see them. The workspace then completes
 * the exchange with an authenticated request; Java validates state, the PKCE verifier and the user binding.
 */
export function oauthCallbackRedirect(request: Request) {
  const url = new URL(request.url);
  const preferred = request.headers.get("cookie")?.match(/(?:^|;\s*)NEXT_LOCALE=([a-z]{2})/)?.[1];
  const locale = preferred && locales.includes(preferred) ? preferred : "en";
  const code = url.searchParams.get("code"), state = url.searchParams.get("state");
  const valid = !!code && code.length <= 512 && !/[\u0000-\u001f]/.test(code) && !!state && /^[A-Za-z0-9_-]{40,64}$/.test(state);
  const target = new URL(`/${locale}?googleOAuth=${valid ? "1" : "denied"}#integrations`, url.origin);
  const headers = new Headers({ Location: target.pathname + target.search + target.hash, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  if (valid) {
    const value = Buffer.from(JSON.stringify({ code, state })).toString("base64url");
    const secure = url.protocol === "https:" ? "; Secure" : "";
    headers.append("Set-Cookie", `${oauthCookie}=${value}; Path=/api/connectors; HttpOnly; SameSite=Lax; Max-Age=300${secure}`);
  }
  return new Response(null, { status: 303, headers });
}
