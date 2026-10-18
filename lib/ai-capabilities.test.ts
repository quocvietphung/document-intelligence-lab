import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {readFileSync} from "node:fs";
import {describe,expect,it,vi,afterEach} from "vitest";
import {aiCapabilitiesSchema,aiLanguageTables,aiText,chatEngine,documentAI,pageAIKind,type AICapabilities} from "./ai-capabilities";
import {AIChatIdentity,AIDocumentBadge,AIPageBanner} from "@/components/workspace/AITransparency";
import {WorkspaceAIOverview} from "@/components/workspace/WorkspaceAIOverview";
import {proxyCase} from "./case-proxy";

const capabilities:AICapabilities={scope:"configuration-only",automaticInference:false,
  chat:{provider:"azure-openai",modelId:"configured-lab-model",configured:true},
  documents:{provider:"azure-document-intelligence",modelId:"prebuilt-layout",mode:"azure",configured:true},
  retrieval:{semantic:true,embeddingModel:"all-MiniLM-L6-v2 quantized (ONNX, 384d)",vectorStore:"Qdrant",ranking:"BM25 + cosine + query coverage",languageCoverage:"English-focused"}};
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe("AI identity and honest provenance",()=>{
  it("accepts only configuration metadata with no automatic inference",()=>{
    expect(aiCapabilitiesSchema.safeParse(capabilities).success).toBe(true);
    expect(aiCapabilitiesSchema.safeParse({...capabilities,automaticInference:true}).success).toBe(false);
    expect(aiCapabilitiesSchema.safeParse({...capabilities,scope:"verified-live"}).success).toBe(false);
  });
  it("provides complete translated copy",()=>{
    for(const table of Object.values(aiLanguageTables)){
      expect(Object.keys(table).sort()).toEqual(Object.keys(aiLanguageTables.en).sort());
      expect(Object.values(table).every(value=>value.trim())).toBe(true);
    }
    expect(aiText("other")).toEqual(aiLanguageTables.en);
  });
  it("uses deployment metadata rather than a hardcoded chat model",()=>{
    expect(chatEngine(capabilities,"en").model).toBe("configured-lab-model");
    expect(chatEngine(undefined,"en").kind).toBe("unknown");
    expect(chatEngine(capabilities,"en",true).kind).toBe("demo");
  });
  it("distinguishes Azure source analysis from fixture reference values",()=>{
    expect(documentAI({analysisProvider:"azure-document-intelligence",modelId:"prebuilt-layout",status:"review"},"en").kind).toBe("ai");
    expect(documentAI({analysisProvider:"datev-reference-values",status:"review"},"en").kind).toBe("demo");
    expect(documentAI({analysisProvider:"local-pdfbox-tesseract",status:"review"},"en").kind).toBe("rules");
    expect(documentAI({status:"review"},"en").kind).toBe("unknown");
  });
  it("does not label validation or quality measurement as generative AI",()=>{
    expect(pageAIKind("controls")).toBe("rules");expect(pageAIKind("evaluation")).toBe("rules");
    expect(pageAIKind("banking")).toBe("context");
    const html=renderToStaticMarkup(createElement(AIPageBanner,{page:"controls",locale:"en",capabilities,ask:()=>{}}));
    expect(html).toContain('data-ai-kind="rules"');expect(html).toContain("deterministic rules");expect(html).not.toContain('data-ai-kind="ai"');
  });
  it("identifies Docling as local AI throughout the UI, without inventing Azure or an accuracy",()=>{
    const local={...capabilities,documents:{provider:'docling',modelId:'docling-layout-tableformer',mode:'docling',configured:true}};
    for(const locale of ['en','de','vi']){
      const identity=documentAI({analysisProvider:'docling',status:'review'},locale);
      expect(identity.engine).toBe('Docling · Local AI');expect(identity.kind).toBe('ai');
      const html=renderToStaticMarkup(createElement(AIPageBanner,{page:'documents',locale,capabilities:local,ask:()=>{}}));
      expect(html).toContain('Docling · Local AI');expect(html).not.toContain('Azure Document Intelligence');expect(html).not.toContain('100%');
    }
    const html=renderToStaticMarkup(createElement(WorkspaceAIOverview,{locale:'en',demo:false,capabilities:local,navigate:()=>{},openNova:()=>{}}));
    expect(html).toContain('Docling · Local AI');expect(html).not.toContain('Azure Document Intelligence');
  });
  it("discloses the actual retrieval choices and language limitation",()=>{
    const html=renderToStaticMarkup(createElement(AIPageBanner,{page:"studio",locale:"en",capabilities,ask:()=>{}}));
    expect(html).toContain("all-MiniLM-L6-v2");expect(html).toContain("Qdrant");expect(html).toContain("English-focused");
    expect(html).toContain("not a live health check");
  });
  it("keeps demo and unavailable metadata honest",()=>{
    const demo=renderToStaticMarkup(createElement(AIPageBanner,{page:"studio",locale:"en",capabilities,demo:true,ask:()=>{}}));
    expect(demo).toContain('data-ai-kind="demo"');expect(demo).not.toContain("all-MiniLM");
    const unknown=renderToStaticMarkup(createElement(AIPageBanner,{page:"documents",locale:"en",ask:()=>{}}));
    expect(unknown).toContain('data-ai-kind="unknown"');expect(unknown).not.toContain("PDFBox");
  });
  it("exposes source model provenance but never an invented accuracy",()=>{
    const html=renderToStaticMarkup(createElement(AIDocumentBadge,{locale:"vi",doc:{id:"D",name:"datev.pdf",type:"income",status:"review",analysisProvider:"azure-document-intelligence",modelId:"prebuilt-layout"}}));
    expect(html).toContain("Azure Document Intelligence");expect(html).toContain("prebuilt-layout");expect(html).toContain("quy tắc");expect(html).not.toContain("100%");
  });
  it("distinguishes app help from the configured LLM",()=>{
    const html=renderToStaticMarkup(createElement(AIChatIdentity,{locale:"en",capabilities,mode:"app-guide"}));
    expect(html).toContain("configured-lab-model");expect(html).toContain("App guide · no LLM call");
  });
  it("places the three model identities in the overview",()=>{
    const html=renderToStaticMarkup(createElement(WorkspaceAIOverview,{locale:"en",demo:false,capabilities,documentMode:"azure",navigate:()=>{},openNova:()=>{}}));
    expect(html).toContain("prebuilt-layout");expect(html).toContain("configured-lab-model");expect(html).toContain("all-MiniLM");expect(html).toContain("Human verification");
  });
  it("permits only authenticated GET metadata without forwarding writes",async()=>{
    vi.stubEnv("CREDIT_API_URL","http://java:8080");
    const spy=vi.fn().mockResolvedValue(Response.json(capabilities));vi.stubGlobal("fetch",spy);
    const url="http://localhost:3000/api/cases/ai-capabilities",headers={Authorization:"Bearer synthetic-test-token"};
    expect((await proxyCase(new Request(url,{headers}),["ai-capabilities"])).status).toBe(200);
    expect((await proxyCase(new Request(url),["ai-capabilities"])).status).toBe(401);
    expect((await proxyCase(new Request(url,{headers,method:"POST",body:"{}"}),["ai-capabilities"])).status).toBe(405);
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it("field explanation is explicit and cannot silently call or upload",()=>{
    const source=readFileSync("components/workspace/DocumentEvidence.tsx","utf8");
    expect(source).toContain('type="button" className="ai-field-explain"');expect(source).toContain("onExplain(");
    expect(source).not.toContain("sendMessage");expect(source).not.toContain("fetch(");
    const shell=readFileSync("components/workspace/CreditWorkspace.tsx","utf8");
    expect(shell).toContain("setInspected(null);askNova(question);");
  });
  it("minimizes Nova on section navigation without clearing its draft or history",()=>{
    const source=readFileSync("components/workspace/CreditWorkspace.tsx","utf8");
    const navigation=source.split("\n").find(line=>line.includes("function navigate(id:"))!;
    expect(navigation).toContain("setChat(false)");expect(navigation).not.toMatch(/setChatQuestion|setMessages|setText/);
  });
});
