import { oauthCallbackRedirect } from "@/lib/oauth-callback";
export const runtime = "nodejs";
export function GET(request: Request) { return oauthCallbackRedirect(request); }
