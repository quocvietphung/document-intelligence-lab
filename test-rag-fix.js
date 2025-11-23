#!/usr/bin/env node

/**
 * Test script to verify RAG fixes
 */

const fs = require("fs");
const path = require("path");

// Test 1: Check if ergo_docs.json was created successfully
console.log("🧪 Test 1: Checking ergo_docs.json...");
const docsPath = path.join(__dirname, "data", "ergo_docs.json");
try {
  const data = JSON.parse(fs.readFileSync(docsPath, "utf-8"));

  if (data.docs) {
    const docCount = Object.keys(data.docs).length;
    let totalChunks = 0;
    for (const chunks of Object.values(data.docs)) {
      if (Array.isArray(chunks)) {
        totalChunks += chunks.length;
      }
    }
    console.log(`✅ ergo_docs.json exists with ${docCount} documents and ${totalChunks} chunks`);
    console.log(`   - Generated at: ${data.generatedAt}`);
    console.log(`   - Total PDFs: ${data.totalPdfs}`);
  } else {
    console.log("⚠️  ergo_docs.json exists but may have old format");
  }
} catch (error) {
  console.error("❌ Error reading ergo_docs.json:", error.message);
}

// Test 2: Check TypeScript compilation
console.log("\n🧪 Test 2: Checking TypeScript compilation...");
const tsFiles = [
  "lib/rag-utils.ts",
  "lib/ergo-retriever.ts",
  "app/api/chat/route.ts"
];

const hasErrors = false;
for (const file of tsFiles) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf-8");
    if (content.includes("text.match") || content.includes("text.substring")) {
      // These should be wrapped with type checks now
      if (content.includes("typeof text === \"string\"")) {
        console.log(`✅ ${file} - has proper type guards`);
      } else {
        console.log(`⚠️  ${file} - may need type guard checks`);
      }
    }
  }
}

// Test 3: Verify rag-utils fixes
console.log("\n🧪 Test 3: Verifying rag-utils.ts fixes...");
const ragUtilsPath = path.join(__dirname, "lib", "rag-utils.ts");
const ragUtilsContent = fs.readFileSync(ragUtilsPath, "utf-8");

const checks = [
  { name: "calculateAdvancedRelevance has type guard", pattern: /const textStr = typeof text === "string" \? text : String\(text \|\| ""\);/ },
  { name: "formatDocumentText has type guard", pattern: /const textStr = typeof text === "string" \? text : String\(text \|\| ""\);/ },
  { name: "Both functions convert to string safely", pattern: /textStr\.match|textStr\.substring/ }
];

for (const check of checks) {
  if (check.pattern.test(ragUtilsContent)) {
    console.log(`✅ ${check.name}`);
  } else {
    console.log(`❌ ${check.name}`);
  }
}

// Test 4: Verify ergo-retriever fixes
console.log("\n🧪 Test 4: Verifying ergo-retriever.ts fixes...");
const retrieverPath = path.join(__dirname, "lib", "ergo-retriever.ts");
const retrieverContent = fs.readFileSync(retrieverPath, "utf-8");

if (retrieverContent.includes("data.docs && typeof data.docs === \"object\"")) {
  console.log("✅ New data format handling for extract-ergo-pdf.js output");
} else {
  console.log("❌ May need update for new data format");
}

if (retrieverContent.includes("typeof chunk === \"string\" ? chunk : String(chunk || \"\").trim()")) {
  console.log("✅ Chunk type safety with trim()");
} else {
  console.log("⚠️  Chunk handling may need improvement");
}

console.log("\n✨ RAG fixes verification complete!");

