import { describe, expect, it } from "vitest";
import { buildCreditInstructions, demoAnswer, retrieveCaseSources,caseChatPayload,conversationSchema,assistantModeKey } from "./credit-chat";
import type {UIMessage} from "ai";
import { demoCase } from "./credit-data";

describe("credit copilot guardrails", () => {
  it("keeps a long local transcript out of the next case question",()=>{
    const messages:UIMessage[]=Array.from({length:24},(_,i)=>({id:`old-${i}`,role:i%2?"assistant":"user",parts:[{type:"text",text:i%2?"Long model answer. ".repeat(500):"Old question"}]}));
    messages.push({id:"latest",role:"user",parts:[{type:"text",text:"Which document is missing?"}]});
    expect(conversationSchema.safeParse({caseId:"CR-SELECTED",locale:"en",messages}).success).toBe(false);
    const payload=caseChatPayload(messages,"CR-SELECTED","en");
    expect(conversationSchema.safeParse(payload).success).toBe(true);
    expect(payload.messages).toEqual([{id:"latest",role:"user",parts:[{type:"text",text:"Which document is missing?"}]}]);
  });
  it("does not substitute an assistant answer for a missing user question",()=>{
    expect(caseChatPayload([{id:"answer",role:"assistant",parts:[{type:"text",text:"Not a question"}]}],"CR-SELECTED","de").messages).toEqual([]);
  });
  it("never labels a blocked or unknown response as disconnected Azure",()=>{
    expect(assistantModeKey("guard-blocked")).toBe("guardBlocked");
    expect(assistantModeKey("synthetic-demo")).toBe("demo");
    expect(assistantModeKey("azure-entra")).toBe("azure");
    expect(assistantModeKey("unknown")).toBe("modeUnknown");
  });
  it("retrieves the current synthetic case without decision language", () => {
    const result = buildCreditInstructions("Welche Unterlagen fehlen?");
    expect(result.instructions).toContain("CR-2026-1048");
    expect(result.instructions).toContain("Never approve or reject credit");
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it("routes missing evidence to human review", () => {
    const answer = demoAnswer("Welche Unterlagen fehlen?");
    expect(answer).toContain("Praxisbewertung");
    expect(answer).toContain("Pflichtdokument fehlt");
    expect(answer).toContain("Nettoeinkommen");
    expect(answer).not.toContain("Missing required document");
    expect(answer).toContain("autorisierte Fachperson");
  });

  it("localizes the deterministic Vietnamese fallback", () => {
    const answer = demoAnswer("Thiếu tài liệu nào?", demoCase, "vi");
    expect(answer).toContain("Thiếu tài liệu bắt buộc");
    expect(answer).toContain("Thu nhập ròng");
    expect(answer).not.toContain("Missing required document");
  });

  it("explains tenant isolation without API keys", () => {
    const result = buildCreditInstructions("Wie ist der Tenant geschützt?");
    expect(result.instructions).toContain("untrusted DATA");
    expect(result.sources.some(source => source.id === "policy")).toBe(true);
  });

  it("explains conflicts without making a decision", () => {
    const answer = demoAnswer("Erkläre den erkannten Konflikt.");
    expect(answer).toContain("€ 1.250");
    expect(answer).toContain("autorisierte Fachperson");
  });
  it("retrieves only pages from the selected case and handles Vietnamese accents", () => {
    const selected={...demoCase,id:"CR-SELECTED",documents:[{id:"doc-a",name:"nguon.txt",type:"statement",status:"review" as const,fields:[],pages:[{number:1,text:"Tài liệu còn thiếu là báo cáo định giá.",method:"utf8-text"}],originalAvailable:true}]};
    const sources=retrieveCaseSources("thiếu định giá",selected);
    expect(sources[0].id).toBe("doc-a:p1");
    expect(sources.some(source=>source.text.includes("CR-2026-1048"))).toBe(false);
  });
});
