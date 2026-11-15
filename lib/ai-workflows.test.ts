import {describe, expect, it} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {AIWorkflowGuide, AIWorkflowRow} from "@/components/workspace/AIWorkflowGuide";
import {dashboardFeatures} from "./ai-dashboard";
import type {AICapabilities} from "./ai-capabilities";
import type {CreditDocument} from "./credit-data";
import type {DocumentJob} from "./document-results";
import {environmentSteps, trustWorkflowFacts, useFeatures, userSteps, workflowAction, workflowFacts, workflowFor, workflowGroups, workflowList, workflowPlans, workflowSteps, workflowSummary, type WorkflowFacts, type WorkflowFeature} from "./ai-workflows";
import {stepDetail, workflowLanguages, workflowText} from "./ai-workflows-language";

const capabilities: AICapabilities = {
  scope: "configuration-only", automaticInference: false,
  chat: {provider: "ollama", modelId: "qwen3:4b", configured: true},
  documents: {provider: "docling", modelId: "docling-2", mode: "docling", configured: true},
  retrieval: {semantic: true, embeddingModel: "all-MiniLM-L6-v2", vectorStore: "qdrant", ranking: "hybrid", languageCoverage: "en"},
};
const doc = (id: string, status: CreditDocument["status"], extra: Partial<CreditDocument> = {}): CreditDocument =>
  ({id, name: `${id}.pdf`, type: "invoice", status, originalAvailable: true, fields: [{label: "total", value: "48.780,00 EUR", confidence: null, page: 2}], ...extra});
const job = (id: string, status: string, createdAt: string, sha = id.padEnd(64, "a")): DocumentJob =>
  ({id, name: `${id}.pdf`, status, stage: "extract", document_id: null, scan_result: null, error_code: null, sha256: sha, createdAt, expiresAt: "2099-01-01T00:00:00Z", attempt: 1});
const base: WorkflowFacts = {demo: false, originals: 0, verified: 0, awaiting: 0, active: 0, failed: 0, tables: false, fieldPages: false, issues: 0, documentEngine: true, languageModel: true, semanticIndex: true, searches: 0, answers: 0, claimsNeedingReview: 0, feedback: 0, tasks: 0, openTasks: 0};
const reviewed: WorkflowFacts = {...base, originals: 4, verified: 4, tables: true, fieldPages: true, searches: 2, answers: 3, tasks: 1, openTasks: 1};

describe("AI workflow plans", () => {
  it("gives every catalog feature an end-to-end process with known steps", () => {
    expect(Object.keys(workflowPlans).sort()).toEqual(dashboardFeatures.map((feature) => feature.id).sort());
    for (const [id, plan] of Object.entries(workflowPlans)) {
      expect(plan.length, id).toBeGreaterThan(0);
      expect(new Set(plan).size, `${id} repeats a step`).toBe(plan.length);
      for (const step of plan) expect(workflowSteps, id).toContain(step);
      const user = plan.findIndex((step) => (userSteps as readonly string[]).includes(step));
      if (user >= 0) expect(user, `${id}: the user's own step comes last`).toBe(plan.length - 1);
      const environment = plan.map((step, index) => (environmentSteps as readonly string[]).includes(step) ? index : -1).filter((index) => index >= 0);
      expect(environment, `${id}: operator set-up comes first`).toEqual(environment.map((_, index) => index));
    }
  });

  it("has every text in English, German and Vietnamese, including a how-to for each feature used directly", () => {
    const shape = (value: unknown): unknown => Array.isArray(value) ? value.map(shape) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, shape(entry)])) : typeof value;
    expect(shape(workflowLanguages.de)).toEqual(shape(workflowLanguages.en));
    expect(shape(workflowLanguages.vi)).toEqual(shape(workflowLanguages.en));
    for (const [language, text] of Object.entries(workflowLanguages)) {
      expect(Object.keys(text.how).sort(), language).toEqual([...useFeatures].sort());
      for (const step of workflowSteps.filter((step) => step !== "use")) for (const part of text.steps[step]) expect(part.trim(), `${language} ${step}`).not.toBe("");
      for (const value of Object.values(text.how)) expect(value.length, language).toBeGreaterThan(40);
    }
    expect(workflowText("fr")).toBe(workflowLanguages.en);
    expect(workflowText("vi").labels.title).toBe("Quy trình AI");
  });
});

describe("AI workflow status", () => {
  it("points an empty dossier to adding PDFs and names how many workflows that unlocks", () => {
    const list = workflowList(base);
    expect(workflowFor("document", base)).toMatchObject({status: "todo", next: "addDocuments", done: 1, total: 4});
    const summary = workflowSummary(list);
    expect(summary.unlock?.step).toBe("addDocuments");
    expect(summary.unlock?.workflows).toBe(list.filter((item) => item.next === "addDocuments").length);
    expect(summary.done + summary.ready + summary.todo + summary.blocked).toBe(dashboardFeatures.length);
    expect(workflowFor("app-guide", base)).toMatchObject({status: "ready", next: "use"});
  });

  it("marks a workflow complete only when this dossier's records prove every step", () => {
    expect(workflowFor("document", reviewed).status).toBe("done");
    expect(workflowFor("search", reviewed).status).toBe("done");
    expect(workflowFor("nova", reviewed).status).toBe("done");
    expect(workflowFor("validation", reviewed).status).toBe("done");
    expect(workflowFor("review", reviewed)).toMatchObject({status: "todo", next: "closeTasks"});
    expect(workflowFor("review", {...reviewed, openTasks: 0}).status).toBe("done");
    // The app never records which task template was run, so the last step stays the user's.
    expect(workflowFor("summary", reviewed)).toMatchObject({status: "ready", next: "use", done: 4, total: 5});
    expect(workflowFor("feedback", reviewed)).toMatchObject({status: "ready", next: "reportError"});
    expect(workflowFor("feedback", {...reviewed, feedback: 1}).status).toBe("done");
  });

  it("asks for the earliest missing step and keeps review, failures and claims honest", () => {
    expect(workflowFor("tables", {...reviewed, tables: false})).toMatchObject({status: "todo", next: "tables"});
    expect(workflowFor("document", {...reviewed, verified: 1, awaiting: 3})).toMatchObject({status: "todo", next: "reviewFields"});
    expect(workflowFor("document", {...reviewed, active: 1})).toMatchObject({status: "todo", next: "processing"});
    // A failed file stays under "Needs attention"; the documents that finished keep their workflows moving.
    expect(workflowFor("document", {...reviewed, failed: 1}).status).toBe("done");
    expect(workflowFor("document", {...base, failed: 1})).toMatchObject({status: "todo", next: "addDocuments"});
    expect(workflowFor("validation", {...reviewed, issues: 2})).toMatchObject({status: "todo", next: "resolveFindings"});
    expect(workflowFor("citations", {...reviewed, claimsNeedingReview: 2})).toMatchObject({status: "todo", next: "checkClaims"});
    expect(workflowFor("citations", {...reviewed, answers: 0})).toMatchObject({status: "todo", next: "askNova"});
  });

  it("sends missing operator set-up to an operator before anything else", () => {
    expect(workflowFor("nova", {...base, languageModel: false})).toMatchObject({status: "blocked", next: "languageModel"});
    expect(workflowFor("embeddings", {...reviewed, semanticIndex: false})).toMatchObject({status: "blocked", next: "semanticIndex"});
    expect(workflowFor("search", {...reviewed, semanticIndex: false}).status).toBe("done");
    expect(workflowSummary(workflowList({...base, languageModel: false})).blocked).toBeGreaterThan(10);
  });

  it("never counts data that could not be loaded as done", () => {
    const unknown = {...reviewed, searches: undefined, answers: undefined, claimsNeedingReview: undefined, tasks: undefined, openTasks: undefined, languageModel: undefined};
    expect(workflowFor("search", unknown)).toMatchObject({status: "ready", next: "askStudio"});
    expect(workflowFor("nova", unknown)).toMatchObject({status: "ready", next: "languageModel"});
    expect(workflowList(unknown).some((item) => ["search", "nova", "citations", "review"].includes(item.id) && item.status === "done")).toBe(false);
  });

  it("shows only the guides in demo mode", () => {
    const list = workflowList({...reviewed, demo: true});
    expect(list.every((item) => item.status === "demo" && item.next === undefined)).toBe(true);
    expect(workflowSummary(list).unlock).toBeUndefined();
  });

  it("groups workflows like the catalog", () => {
    const groups = workflowGroups(workflowList(base));
    expect(groups.flatMap((group) => group.workflows.map((item) => item.id)).sort()).toEqual(dashboardFeatures.map((feature) => feature.id).sort());
  });
});

describe("AI workflow facts and destinations", () => {
  it("counts originals, review state, tables, page evidence and the latest job per file", () => {
    const documents = [doc("a", "verified", {tables: [{page: 1, rows: 2, columns: 2, cells: []}]}), doc("b", "review"), doc("c", "review", {originalAvailable: false, fields: []}), doc("d", "missing")];
    const jobs = [job("old", "FAILED", "2026-11-14T08:00:00Z", "f".repeat(64)), job("new", "COMPLETE", "2026-11-14T09:00:00Z", "f".repeat(64)), job("x", "PROCESSING", "2026-11-14T10:00:00Z"), job("y", "EXPIRED", "2026-11-14T10:00:00Z")];
    const facts = workflowFacts({documents, jobs, capabilities, demo: false, issueCount: 1, searches: 2});
    expect(facts).toMatchObject({originals: 2, verified: 1, awaiting: 1, active: 1, failed: 1, tables: true, fieldPages: true, issues: 1, documentEngine: true, languageModel: true, semanticIndex: true, searches: 2});
    expect(facts.answers).toBeUndefined();
    expect(workflowFacts({documents: [], jobs: [], demo: false, issueCount: 0}).documentEngine).toBeUndefined();
  });

  it("reads only counts from the transparency history of the same dossier", () => {
    const snapshot = {caseId: "CR-1", answers: [{id: "a1"}, {id: "a2"}], feedback: [{id: "f1"}], tasks: [{state: "OPEN"}, {state: "RESOLVED"}], metrics: {claimsNeedingReview: 3, openTasks: 1}};
    expect(trustWorkflowFacts(snapshot, "CR-1")).toEqual({answers: 2, claimsNeedingReview: 3, feedback: 1, tasks: 2, openTasks: 1});
    expect(trustWorkflowFacts(snapshot, "CR-2")).toBeUndefined();
    expect(trustWorkflowFacts({caseId: "CR-1"}, "CR-1")).toBeUndefined();
  });

  it("opens the same place as the catalog for the feature's own step", () => {
    expect(workflowAction("batches", "use")).toEqual({kind: "page", page: "pipeline", panel: "batches"});
    expect(workflowAction("summary", "use")).toEqual({kind: "trust", section: "library"});
    expect(workflowAction("app-guide", "use")).toEqual({kind: "nova"});
    expect(workflowAction("document", "reviewFields")).toEqual({kind: "review"});
    expect(workflowAction("document", "addDocuments")).toEqual({kind: "intake"});
    expect(workflowAction("nova", "languageModel")).toEqual({kind: "page", page: "operations"});
  });

  it("adds a short count only when it tells the user something", () => {
    const text = workflowText("en").details;
    expect(stepDetail("reviewFields", {...base, originals: 4, verified: 1, awaiting: 3}, text)).toBe("1 of 4 confirmed");
    expect(stepDetail("processing", {...base, active: 1, failed: 2}, text)).toBe("Running: 1 · failed: 2");
    expect(stepDetail("processing", base, text)).toBeUndefined();
    expect(stepDetail("checkClaims", {...base, claimsNeedingReview: 2}, workflowText("vi").details)).toBe("Cần kiểm tra: 2");
  });
});

describe("AI workflow guide on the task page", () => {
  const facts: WorkflowFacts = {...base, originals: 2, verified: 1, awaiting: 1, fieldPages: true};
  const row = (id: WorkflowFeature, locale = "vi", expanded = true, values: WorkflowFacts = facts) =>
    renderToStaticMarkup(createElement(AIWorkflowRow, {locale, item: workflowFor(id, values), facts: values, run: () => undefined, expanded}));

  it("shows the summary, the most useful next step and closed groups without building every workflow", () => {
    const html = renderToStaticMarkup(createElement(AIWorkflowGuide, {locale: "vi", facts, run: () => undefined}));
    expect(html).toContain("Quy trình AI");
    expect(html).toContain("Nên làm trước: Xác nhận trường đã trích xuất");
    expect((html.match(/data-ai-workflow-group="/g) || []).length).toBe(6);
    // Workflows are built only when their group is opened, so the task page stays light.
    expect(html).not.toContain('data-ai-workflow="');
    expect(html.length).toBeLessThan(20_000);
  });

  it("renders a workflow with its next step, the full process and the template step", () => {
    const document = row("document");
    expect(document).toContain("Bước tiếp theo:");
    expect(document).toContain("Quy trình đầu cuối (4 bước)");
    expect(document).toContain("1/2 đã xác nhận");
    expect(row("document", "vi", false)).not.toContain("1/2 đã xác nhận");
    expect(row("summary")).toContain("Thư viện tác vụ AI: chạy “AI tóm tắt hồ sơ”");
    expect(row("governance")).toContain("Quy trình đầu cuối (1 bước)");
    expect(row("governance", "en")).toContain("End-to-end process (1 step)");
    expect(row("governance", "en")).not.toContain("(1 steps)");
  });

  it("explains demo mode instead of claiming progress", () => {
    const demo = {...reviewed, demo: true};
    const html = renderToStaticMarkup(createElement(AIWorkflowGuide, {locale: "en", facts: demo, run: () => undefined}));
    expect(html).toContain("Demo mode shows the guides only.");
    expect(html).not.toContain("Start here:");
    expect(row("document", "en", true, demo)).not.toContain("Next step:");
  });
});
