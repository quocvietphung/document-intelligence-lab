import { boundedBody } from "./request-body";
import { hasAllowedOrigin } from "./request-origin";
import { safeErrorCode } from "./case-proxy";

/** HttpOnly cookie that carries the Google authorization code from the callback to one authenticated request. */
export const oauthCookie = "lab_google_oauth";
const routes: Record<string, "GET" | "POST"> = {
  "": "GET",
  "use-cases": "GET",
  "google/authorize": "POST",
  "google/callback": "POST",
  "google/disconnect": "POST",
};

export function readOauthCookie(header: string | null): { code: string; state: string } | undefined {
  const raw = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${oauthCookie}=`))?.slice(oauthCookie.length + 1);
  if (!raw || raw.length > 2000) return undefined;
  try {
    const value: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof value !== "object" || !value || !("code" in value) || !("state" in value)) return undefined;
    const { code, state } = value as { code: unknown; state: unknown };
    return typeof code === "string" && typeof state === "string" && code.length <= 512 && /^[A-Za-z0-9_-]{40,64}$/.test(state) ? { code, state } : undefined;
  } catch {
    return undefined;
  }
}

export async function proxyConnectors(request: Request, segments: string[] = []) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return Response.json({ error: "Public demo: API disabled" }, { status: 503 });
  const root = process.env.CREDIT_API_URL;
  if (!root) return Response.json({ error: "Persistent API not configured" }, { status: 503 });
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (segments.some((segment) => !/^[-a-z]{1,40}$/.test(segment))) return Response.json({ error: "Invalid path" }, { status: 400 });
  const path = segments.join("/");
  const method = routes[path];
  if (!method) return Response.json({ error: "Not found" }, { status: 404 });
  if (request.method !== method) return Response.json({ error: "Method not allowed" }, { status: 405 });
  if (!hasAllowedOrigin(request)) return Response.json({ error: "Origin not allowed" }, { status: 403 });
  let body: Uint8Array | undefined;
  if (method === "POST") {
    if (path === "google/callback") {
      // The code never passes through page JavaScript; it is read from the HttpOnly cookie set by /oauth/google/callback.
      const pending = readOauthCookie(request.headers.get("cookie"));
      if (!pending) return Response.json({ error: "OAUTH_STATE_INVALID" }, { status: 422 });
      body = new TextEncoder().encode(JSON.stringify(pending));
    } else body = await boundedBody(request, 16_000);
  }
  const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  if (path === "google/callback") headers.append("Set-Cookie", `${oauthCookie}=; Path=/api/connectors; HttpOnly; SameSite=Lax; Max-Age=0`);
  try {
    const response = await fetch(`${root.replace(/\/$/, "")}/api/connectors${path ? `/${path}` : ""}`, {
      method,
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: body ? Buffer.from(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
    const type = response.headers.get("content-type");
    if (type) headers.set("content-type", type);
    if (!response.ok) {
      const code = await safeErrorCode(response);
      return Response.json({ error: code || `Request failed (${response.status})` }, { status: response.status, headers });
    }
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return Response.json({ error: "Request unavailable" }, { status: 503, headers });
  }
}
