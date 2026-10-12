import { NextRequest, NextResponse } from "next/server";
import { creditCaseSchema } from "@/lib/credit-api";
import { proxyCase } from "@/lib/case-proxy";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return proxyCase(request);
}

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
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/cases`, {
      headers: { Authorization: authorization, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok)
      return NextResponse.json(
        {
          error:
            response.status === 401
              ? "Session expired. Sign in again."
              : response.status === 403
                ? "This account cannot access credit cases."
                : "Credit API unavailable",
        },
        {
          status: [401, 403].includes(response.status) ? response.status : 502,
          headers: { "Cache-Control": "no-store" },
        },
      );
    const body = creditCaseSchema.array().parse(await response.json());
    return NextResponse.json(body, {
      headers: { "Cache-Control": "no-store", "X-Data-Source": "java-api" },
    });
  } catch {
    return NextResponse.json(
      { error: "Credit API unavailable" },
      { status: 503 },
    );
  }
}
