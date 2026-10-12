import { describe, expect, it } from "vitest";
import { hasAllowedOrigin } from "./request-origin";

function request(origin?: string, headers: Record<string, string> = {}) {
  return new Request("http://0.0.0.0:3000/api/chat", {
    headers: { ...(origin ? { Origin: origin } : {}), ...headers },
  });
}

describe("request origin validation", () => {
  it("accepts requests without a browser origin", () => {
    expect(hasAllowedOrigin(request())).toBe(true);
  });

  it("uses the public Host header behind a container proxy", () => {
    expect(
      hasAllowedOrigin(
        request("http://localhost:3000", { Host: "localhost:3000" }),
      ),
    ).toBe(true);
  });

  it("uses Vercel forwarded host and protocol", () => {
    expect(
      hasAllowedOrigin(
        request("https://credit.example", {
          "X-Forwarded-Host": "credit.example",
          "X-Forwarded-Proto": "https",
        }),
      ),
    ).toBe(true);
  });

  it("rejects a foreign or malformed origin", () => {
    expect(
      hasAllowedOrigin(
        request("https://attacker.example", { Host: "localhost:3000" }),
      ),
    ).toBe(false);
    expect(hasAllowedOrigin(request("not a url"))).toBe(false);
  });
});
