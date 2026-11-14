import {NextResponse} from "next/server";
import {manifest, summarize} from "@/lib/ai103/model";

/** The capability manifest and its counts. Static data: no network call, no Azure call. */
export function GET() {
  return NextResponse.json(
    {format: manifest.format, summary: summarize(manifest.capabilities), capabilities: manifest.capabilities},
    {headers: {"Cache-Control": "no-store"}},
  );
}
