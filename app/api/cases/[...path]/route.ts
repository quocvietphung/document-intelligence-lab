import { proxyCase } from "@/lib/case-proxy";
export const runtime="nodejs";
export const maxDuration=60;
type Context={params:Promise<{path:string[]}>};
async function forward(request:Request,context:Context) { return proxyCase(request,(await context.params).path); }
export const GET=forward;
export const POST=forward;
export const PATCH=forward;
