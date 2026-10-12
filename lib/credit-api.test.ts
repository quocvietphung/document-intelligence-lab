import { describe, expect, it } from "vitest";
import { toWorkspaceCase } from "./credit-api";
const input = {
  id: "CR-1",
  tenantId: "tenant-one",
  applicant: "Synthetic",
  coApplicant: "Demo",
  purpose: "Training",
  amountEuro: 1000,
  completeness: 78,
  status: "HUMAN_REVIEW",
  submittedAt: "Demo",
  missingDocuments: ["Valuation"],
  validationIssues: [
    {
      code: "RATE_CONFLICT",
      severity: "MEDIUM",
      message: "Source conflict",
      humanReviewRequired: true,
    },
  ],
  documents: [
    {
      id: "doc",
      name: "Demo",
      type: "Evidence",
      status: "missing",
      confidence: null,
      fields: [],
      pages: [],
      originalAvailable: false,
    },
  ],
  audit: [["14:00", "Demo created", "test"]],
  version: 0,
};
describe("Java case response mapping", () => {
  it("renders actual API values without overlaying demo records", () => {
    const result = toWorkspaceCase(input);
    expect(result.id).toBe("CR-1");
    expect(result.tenantId).toBe("tenant-one");
    expect(result.documents[0].confidence).toBeNull();
    expect(result.issues).toHaveLength(2);
  });
  it("rejects invalid confidence scores", () => {
    expect(() => toWorkspaceCase({ ...input, completeness: 150 })).toThrow();
  });
  it("resolves review issues to the document name and exact evidence target",()=>{
    const result=toWorkspaceCase({...input,validationIssues:[{code:"UNREVIEWED_DOCUMENT",severity:"MEDIUM",message:"doc",humanReviewRequired:true}]});
    expect(result.issues[1]).toMatchObject({detail:"Demo",documentId:"doc"});
  });
  it("rejects a malformed or absent Java response", () => {
    expect(() => toWorkspaceCase({})).toThrow();
  });
});
