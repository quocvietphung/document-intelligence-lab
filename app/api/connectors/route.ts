import { proxyConnectors } from "@/lib/connector-proxy";
export const runtime = "nodejs";
export async function GET(request: Request) { return proxyConnectors(request, []); }
