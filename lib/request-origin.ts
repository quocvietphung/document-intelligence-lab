function firstForwardedValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim();
}

export function hasAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);
    const host =
      firstForwardedValue(request.headers.get("x-forwarded-host")) ||
      firstForwardedValue(request.headers.get("host")) ||
      requestUrl.host;
    const protocol =
      firstForwardedValue(request.headers.get("x-forwarded-proto")) ||
      requestUrl.protocol.replace(":", "");

    return (
      (protocol === "http" || protocol === "https") &&
      originUrl.protocol === `${protocol}:` &&
      originUrl.host.toLowerCase() === host.toLowerCase()
    );
  } catch {
    return false;
  }
}
