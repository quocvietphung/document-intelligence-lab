import {NextResponse} from "next/server";
import {runCapabilityCheck} from "@/lib/ai103/checks";
import {capabilityById} from "@/lib/ai103/model";

export const dynamic = "force-dynamic";

/**
 * Runs the in-app check of one capability on the server and returns what it compared.
 * The check reads bundled fixtures only; it writes nothing and calls no network service.
 * A capability without an in-app check answers with mode "command" and the command that produces its recorded
 * result; nothing is run and no status changes.
 */
export async function POST(_request: Request, context: {params: Promise<{id: string}>}) {
  const {id} = await context.params;
  const capability = capabilityById(id);
  if (!capability) return NextResponse.json({error: "unknown-capability"}, {status: 404});
  const result = runCapabilityCheck(capability.id);
  if (!result) {
    return NextResponse.json({mode: "command", capability: capability.id, command: capability.local.command}, {headers: {"Cache-Control": "no-store"}});
  }
  return NextResponse.json({mode: "check", ...result}, {headers: {"Cache-Control": "no-store"}});
}
