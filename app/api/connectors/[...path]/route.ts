import { proxyConnectors } from "@/lib/connector-proxy";
export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
async function forward(request: Request, context: Context) { return proxyConnectors(request, (await context.params).path); }
export const GET = forward;
export const POST = forward;
