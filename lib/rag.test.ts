/**
 * RAG System Test Suite
 *
 * Run tests to verify RAG integration is working correctly
 *
 * Usage: npx ts-node lib/rag.test.ts
 * Or integrate with Jest/Vitest test runner
 */

import { retrieveErgoDocuments, formatRetrievedContext } from "./ergo-retriever";
import { detectLanguage, getSystemPrompt, createSystemMessage } from "./prompt-templates";
import {
  calculateAdvancedRelevance,
  isErgoRelated,
  formatDocumentText,
} from "./rag-utils";

// ============================================
// Test Suite: Language Detection
// ============================================

async function testLanguageDetection() {
  console.log("\n🧪 Testing Language Detection...");

  const testCases = [
    { text: "Wie kann ich die ERGO Altersvorsorge nutzen?", expected: "de" },
    { text: "Tell me about ERGO pension products", expected: "en" },
    {
      text: "ERGO có cung cấp những sản phẩm bảo hiểm nào?",
      expected: "vi",
    },
    { text: "Ich möchte eine Versicherung abschließen", expected: "de" },
    { text: "I want to buy insurance", expected: "en" },
  ];

  for (const { text, expected } of testCases) {
    const detected = detectLanguage(text);
    const status = detected === expected ? "✓" : "✗";
    console.log(
      `${status} "${text.substring(0, 40)}..." → ${detected} (expected: ${expected})`
    );
  }
}

// ============================================
// Test Suite: ERGO Relevance Check
// ============================================

async function testErgoRelevance() {
  console.log("\n🧪 Testing ERGO Relevance Detection...");

  const testCases = [
    { text: "ERGO Krankenversicherung", expected: true },
    { text: "Welche Versicherungen gibt es?", expected: true },
    { text: "Tell me about ERGO pension", expected: true },
    { text: "Altersvorsorge mit ERGO", expected: true },
    { text: "What's the weather today?", expected: false },
    { text: "How do I make coffee?", expected: false },
    { text: "Pizza recipe", expected: false },
    { text: "ERGO Sachversicherung für Immobilien", expected: true },
  ];

  for (const { text, expected } of testCases) {
    const isRelevant = isErgoRelated(text);
    const status = isRelevant === expected ? "✓" : "✗";
    console.log(
      `${status} "${text}" → ${isRelevant ? "ERGO-related" : "Not ERGO"} ${isRelevant === expected ? "(correct)" : "(wrong)"}`
    );
  }
}

// ============================================
// Test Suite: Document Retrieval
// ============================================

async function testDocumentRetrieval() {
  console.log("\n🧪 Testing Document Retrieval...");

  const testQueries = [
    "ERGO Krankenversicherung Zusatzleistungen",
    "Altersvorsorge und Rentenversicherung",
    "Sachversicherung für Immobilien",
    "Non-ERGO query about pizza",
  ];

  for (const query of testQueries) {
    console.log(`\n  Query: "${query}"`);

    const documents = await retrieveErgoDocuments(query, 3);

    if (documents.length === 0) {
      console.log("    → No documents retrieved (not ERGO-related)");
    } else {
      console.log(`    → Found ${documents.length} relevant documents:`);
      for (const doc of documents) {
        const score = calculateAdvancedRelevance(query, doc.text).score;
        console.log(`      • ${doc.file} (score: ${score.toFixed(2)})`);
      }
    }
  }
}

// ============================================
// Test Suite: System Prompt Generation
// ============================================

async function testSystemPromptGeneration() {
  console.log("\n🧪 Testing System Prompt Generation...");

  const testCases = [
    "Wie kann ich mit ERGO sparen?",
    "Tell me about ERGO products",
    "ERGO sản phẩm bảo hiểm nào?",
  ];

  for (const text of testCases) {
    console.log(`\n  Text: "${text}"`);

    const language = detectLanguage(text);
    const basePrompt = getSystemPrompt(text, false);
    const withRagPrompt = getSystemPrompt(text, true);

    console.log(
      `    Language detected: ${language === "de" ? "🇩🇪 German" : language === "en" ? "🇬🇧 English" : "🇻🇳 Vietnamese"}`
    );
    console.log(
      `    Base prompt length: ${basePrompt.length} characters`
    );
    console.log(
      `    With RAG prompt length: ${withRagPrompt.length} characters`
    );
  }
}

// ============================================
// Test Suite: Relevance Scoring
// ============================================

async function testRelevanceScoring() {
  console.log("\n🧪 Testing Relevance Scoring...");

  const query = "ERGO Krankenversicherung";

  const testTexts = [
    "ERGO Krankenversicherung bietet umfangreiche Deckung",
    "Die Altersvorsorge von ERGO",
    "Krankenversicherung im Vergleich",
    "Volkswagen Aktie steigt",
  ];

  for (const text of testTexts) {
    const relevance = calculateAdvancedRelevance(query, text);
    const preview = text.substring(0, 50);
    console.log(`\n  Text: "${preview}..."`);
    console.log(`    Total Score: ${relevance.score.toFixed(2)}`);
    console.log(`    Keyword Matches: ${relevance.keyword_matches}`);
    console.log(`    Term Frequency: ${relevance.term_frequency}`);
    console.log(`    Doc Length Factor: ${relevance.document_length_factor.toFixed(2)}`);
  }
}

// ============================================
// Test Suite: Text Formatting
// ============================================

async function testTextFormatting() {
  console.log("\n🧪 Testing Text Formatting...");

  const longText = `
    Dies ist ein sehr langer Text über ERGO Versicherungsprodukte. 
    Die ERGO bietet eine Vielzahl von Versicherungslösungen für Privat- und Geschäftskunden.
    Mit über 100 Jahren Erfahrung in der Versicherungsbranche...
  `.repeat(5);

  const formatted = formatDocumentText(longText, 300);

  console.log(`\n  Original length: ${longText.length} characters`);
  console.log(`  Formatted length: ${formatted.length} characters`);
  console.log(`  Formatted text: "${formatted}"`);
}

// ============================================
// Test Suite: Full RAG Flow
// ============================================

async function testFullRagFlow() {
  console.log("\n🧪 Testing Full RAG Flow...");

  const userQueries = [
    {
      lang: "German",
      query: "Was sind die Vorteile der ERGO Altersvorsorge?",
    },
    {
      lang: "English",
      query: "Tell me about ERGO health insurance",
    },
    { lang: "Vietnamese", query: "ERGO bảo hiểm gì?" },
  ];

  for (const { lang, query } of userQueries) {
    console.log(`\n  📝 ${lang} Query: "${query}"`);

    // Step 1: Detect language
    const language = detectLanguage(query);
    console.log(`    1. Language detected: ${language}`);

    // Step 2: Check ERGO relevance
    const isRelevant = isErgoRelated(query);
    console.log(`    2. ERGO-related: ${isRelevant}`);

    if (isRelevant) {
      // Step 3: Retrieve documents
      const documents = await retrieveErgoDocuments(query, 3);
      console.log(`    3. Documents retrieved: ${documents.length}`);

      // Step 4: Format context
      const context = formatRetrievedContext(documents);
      console.log(`    4. Context prepared: ${context.length} characters`);

      // Step 5: Create system message
      const systemMessage = createSystemMessage(query, context);
      console.log(`    5. System message created: ${systemMessage.length} characters`);
    } else {
      console.log(
        "    → Query not ERGO-related, would proceed without RAG context"
      );
    }
  }
}

// ============================================
// Test Suite: Error Handling
// ============================================

async function testErrorHandling() {
  console.log("\n🧪 Testing Error Handling...");

  // Test with empty query
  console.log("\n  Testing empty query...");
  try {
    const result = await retrieveErgoDocuments("", 3);
    console.log(`    ✓ Empty query handled: ${result.length} documents`);
  } catch (err) {
    console.log(`    ✗ Error: ${err}`);
  }

  // Test with very long query
  console.log("\n  Testing very long query...");
  try {
    const longQuery = "a".repeat(10000);
    const result = await retrieveErgoDocuments(longQuery, 3);
    console.log(`    ✓ Long query handled: ${result.length} documents`);
  } catch (err) {
    console.log(`    ✗ Error: ${err}`);
  }

  // Test with special characters
  console.log("\n  Testing special characters...");
  try {
    const specialQuery = "ERGO @#$%^&*() Versicherung";
    const result = await retrieveErgoDocuments(specialQuery, 3);
    console.log(`    ✓ Special characters handled: ${result.length} documents`);
  } catch (err) {
    console.log(`    ✗ Error: ${err}`);
  }
}

// ============================================
// Run All Tests
// ============================================

async function runAllTests() {
  console.log("========================================");
  console.log("🚀 RAG System Test Suite");
  console.log("========================================");

  try {
    await testLanguageDetection();
    await testErgoRelevance();
    await testRelevanceScoring();
    await testTextFormatting();
    await testSystemPromptGeneration();
    await testDocumentRetrieval();
    await testFullRagFlow();
    await testErrorHandling();

    console.log("\n========================================");
    console.log("✅ All tests completed!");
    console.log("========================================\n");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Export for testing frameworks
export {
  testLanguageDetection,
  testErgoRelevance,
  testRelevanceScoring,
  testTextFormatting,
  testSystemPromptGeneration,
  testDocumentRetrieval,
  testFullRagFlow,
  testErrorHandling,
  runAllTests,
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

