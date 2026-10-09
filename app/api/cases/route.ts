import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const apiUrl = process.env.CREDIT_API_URL;
  const authorization = request.headers.get("authorization");
  if (!apiUrl) {
    return NextResponse.json(
      { mode: "synthetic-demo", cases: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/cases`, {
      headers: { Authorization: authorization, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Credit API unavailable" }, { status: 503 });
  }
}
