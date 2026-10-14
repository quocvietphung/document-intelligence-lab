import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {uploadedEvidence,documentFocusLanguages} from "./document-focus";
describe("original document evidence only",()=>{
 it("keeps analyzed originals but not placeholder/reference values",()=>{
  const doc={status:"review" as const,originalAvailable:true,analysisProvider:"azure-document-intelligence"};
  expect(uploadedEvidence([doc,{...doc,originalAvailable:false},{...doc,analysisProvider:"datev-reference-values"},{...doc,status:"missing" as const}])).toEqual([doc]);
 });
 it("provides matching translations without accuracy promises",()=>{
  for(const value of Object.values(documentFocusLanguages))expect(Object.keys(value).sort()).toEqual(Object.keys(documentFocusLanguages.en).sort());
 });
 it("does not render fixed experiments or banking widgets",()=>{
  const source=readFileSync("components/workspace/PlatformWorkbench.tsx","utf8"),bank=readFileSync("components/workspace/BankingWorkbench.tsx","utf8");
  expect(source).not.toContain("ResearchWorkbench");expect(source).not.toContain("synthetic-text-v2");expect(source).not.toContain('t("debits")');
  expect(bank).not.toContain("demoBanking");expect(bank).toContain("DocumentCorpus");
 });
 it("does not grant a demo session when Keycloak is unconfigured",()=>{
  const source=readFileSync("components/auth/KeycloakProvider.tsx","utf8");
  expect(source).toContain('mode: "keycloak"');expect(source).not.toContain('mode: configured ?');
  expect(source).toMatch(/ready: true,\s+authenticated: false,/);
 });
});
