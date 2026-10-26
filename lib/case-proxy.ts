import { boundedBody } from "./request-body";
import { hasAllowedOrigin } from "./request-origin";

export async function proxyCase(request: Request, segments: string[] = []) {
  if(process.env.NEXT_PUBLIC_DEMO_MODE==="true") return Response.json({error:"Public demo: API disabled"},{status:503});
  const root = process.env.CREDIT_API_URL;
  if (!root) {
    return Response.json(
      { error: "Persistent API not configured" },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  if (segments.some((segment) => !/^[-a-zA-Z0-9]{1,80}$/.test(segment))) {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }
  const path = segments.join("/");
  if (
    path && path !== "document-analysis/status" &&
    !/^[-\w]+(?:\/documents(?:\/[-\w]+\/(?:original|review|ocr-corrections))?|\/banking|\/trust(?:\/(?:feedback|correction|prompt|features|tasks(?:\/[-\w]+)?))?|\/platform(?:\/(?:search|evaluate|experiments|batches|etl(?:\/etl-[a-f0-9-]{36}\/(?:bronze|silver|gold))?|integrations(?:\/(?:sources|import|evaluation-export|vision))?|research(?:\/(?:datasets|runs|export))?|jobs(?:\/[-\w]+\/(?:retry|cancel))?|reviews))?)?$/.test(path)
  ) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (["document-analysis/status","ai-capabilities"].includes(path) && request.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  if (path.endsWith('/ocr-corrections') && request.method!=='POST') return Response.json({error:'Method not allowed'},{status:405});
  if (/\/banking(?:\/|$)/.test(path)) {
    if (request.method !== "GET") return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  if (/\/platform(?:\/|$)/.test(path)) {
    const allowed=path.endsWith('/platform/experiments')||path.endsWith('/platform/batches')||path.endsWith('/platform/etl')?['GET','POST']:[path.endsWith('/platform')||path.endsWith('/platform/research')||path.endsWith('/platform/integrations')||/\/etl\/etl-[a-f0-9-]{36}\/(bronze|silver|gold)$/.test(path)?'GET':'POST'];
    if(!allowed.includes(request.method))return Response.json({error:'Method not allowed'},{status:405});
  }
  if (/\/trust(?:\/|$)/.test(path)) {
    const allowed=path.endsWith('/trust')?'GET':'POST';
    if(request.method!==allowed)return Response.json({error:'Method not allowed'},{status:405});
  }
  if (!hasAllowedOrigin(request)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }
  try {
    const body =
      request.method === "GET" ? undefined : await boundedBody(request, path.endsWith('/platform/batches')?12_100_000:4_000_000);
    const response = await fetch(
      `${root.replace(/\/$/, "")}/api/cases${path ? `/${path}` : ""}`,
      {
        method: request.method,
        headers: {
          Authorization: auth,
          "Content-Type":
            request.headers.get("content-type") || "application/json",
        },
        body: body ? Buffer.from(body) : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(45_000),
      },
    );
    const headers = new Headers({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    for (const key of ["content-type", "content-disposition", "x-request-id"]) {
      const value = response.headers.get(key);
      if (value) headers.set(key, value);
    }
    if (!response.ok) {
      return Response.json(
        { error: `Request failed (${response.status})` },
        { status: response.status, headers },
      );
    }
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    return Response.json(
      { error: "Request unavailable" },
      {
        status:
          error instanceof Error && error.message === "BODY_LIMIT" ? 413 : 503,
      },
    );
  }
}
