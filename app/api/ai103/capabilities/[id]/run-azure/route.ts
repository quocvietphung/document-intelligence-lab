import {NextResponse} from "next/server";
import {AZURE_OPT_IN_VALUE, capabilityById} from "@/lib/ai103/model";

export const dynamic = "force-dynamic";

/**
 * Azure tests never run from the web app in this pass. Without the explicit opt-in the answer is 403; with it,
 * the answer is 501 because no live adapter is wired here. Either way no request leaves the server and no
 * resource is created. Live checks run from the lab CLI behind `require_live`, after the cost plan is shown.
 */
export async function POST(_request: Request, context: {params: Promise<{id: string}>}) {
  const {id} = await context.params;
  const capability = capabilityById(id);
  if (!capability) return NextResponse.json({error: "unknown-capability"}, {status: 404});
  if (!capability.azure) {
    return NextResponse.json({capability: capability.id, status: "not-applicable", requestSent: false}, {status: 409});
  }
  const optedIn = process.env.AI103_AZURE_OPT_IN === AZURE_OPT_IN_VALUE;
  return NextResponse.json(
    {
      capability: capability.id,
      status: capability.azure.status,
      reason: optedIn ? "no-live-adapter-in-the-web-app" : "opt-in-off",
      command: capability.azure.command,
      requestSent: false,
    },
    {status: optedIn ? 501 : 403},
  );
}
