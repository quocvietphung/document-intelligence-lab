import { describe, expect, it } from "vitest";
import { buildCreditInstructions, demoAnswer } from "./credit-chat";

describe("credit copilot guardrails", () => {
  it("retrieves the current synthetic case without decision language", () => {
    const result = buildCreditInstructions("Welche Unterlagen fehlen?");
    expect(result.instructions).toContain("CR-2026-1048");
    expect(result.instructions).toContain("Never approve or reject credit");
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it("routes missing evidence to human review", () => {
    const answer = demoAnswer("Welche Unterlagen fehlen?");
    expect(answer).toContain("Praxisbewertung");
    expect(answer).toContain("manuell geprüft");
  });

  it("explains tenant isolation without API keys", () => {
    const answer = demoAnswer("Wie ist der Tenant geschützt?");
    expect(answer).toContain("geprüften Claims");
    expect(answer).toContain("statt eines gespeicherten API-Schlüssels");
  });

  it("explains conflicts without making a decision", () => {
    const answer = demoAnswer("Erkläre den erkannten Konflikt.");
    expect(answer).toContain("€ 1.250");
    expect(answer).toContain("autorisierte Fachperson");
  });
});
