#!/usr/bin/env node

/**
 * Generate optimized ergo_prompt.json from ergo_docs.json
 * Selects best chunks for RAG to improve chatbot responses
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const ERGO_DOCS_FILE = path.join(ROOT_DIR, 'data', 'ergo_docs.json');
const OUTPUT_FILE = path.join(ROOT_DIR, 'data', 'ergo_prompt.json');

// Keywords to identify important chunks (for German insurance documents)
const IMPORTANCE_KEYWORDS = [
  'versicherung', 'leistung', 'versicherungsschutz', 'tarif', 'beitrag',
  'prämie', 'deckung', 'anspruch', 'bedingung', 'kündigung', 'ablauf',
  'garantie', 'risiko', 'preis', 'kosten', 'produktübersicht', 'highlights',
  'versicherte', 'leistungsbeispiel', 'ergo', 'dkv', 'aok', 'tk',
  'krankheit', 'unfall', 'zahnarzt', 'pflege', 'altersvorsorge', 'pension',
  'pension', 'rente', 'vermögen', 'immobilie', 'krankentagegeld',
  'zahnersatz', 'behandlung', 'ambulant', 'stationär', 'operativ'
];

function scoreChunk(text) {
  if (!text || text.length < 50) return 0;

  const lowerText = text.toLowerCase();
  let score = 0;

  // Score based on keyword presence
  IMPORTANCE_KEYWORDS.forEach(keyword => {
    if (lowerText.includes(keyword)) {
      score += 1;
    }
  });

  // Boost score for structured content (lists, numbers)
  if (text.includes('€') || text.includes('Euro')) score += 5;
  if (text.match(/\d{1,3}[.,]\d{2}/)) score += 3;
  if (text.match(/\d+\s*%/)) score += 2;
  if (text.match(/^-\s+|^•\s+|^\d+\.\s+/m)) score += 2;

  // Text length quality score
  if (text.length > 200) score += 2;
  if (text.length > 500) score += 1;

  // Penalize duplicates or too-short content
  if (text.length < 100) score -= 1;

  return Math.max(0, score);
}

async function generatePrompt() {
  console.log('📖 Reading ergo_docs.json...');

  if (!fs.existsSync(ERGO_DOCS_FILE)) {
    console.error('❌ ergo_docs.json not found. Run extract-all-ergo-pdfs.js first.');
    process.exit(1);
  }

  const docsData = JSON.parse(fs.readFileSync(ERGO_DOCS_FILE, 'utf-8'));
  const docs = docsData.docs || {};

  console.log(`✅ Loaded ${Object.keys(docs).length} documents`);
  console.log('🔍 Scoring chunks...\n');

  const scored = [];

  Object.entries(docs).forEach(([filename, chunks], fileIdx) => {
    chunks.forEach((chunk, chunkIdx) => {
      const score = scoreChunk(chunk);

      if (score > 0) {
        scored.push({
          file: filename,
          chunkIndex: chunkIdx,
          text: chunk,
          score: score,
          length: chunk.length
        });
      }
    });
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  console.log(`📊 Scored ${scored.length} chunks`);
  console.log(`🏆 Top scores: ${scored.slice(0, 5).map(s => s.score).join(', ')}`);

  // Select top chunks up to ~15,000 characters
  const selectedChunks = [];
  let totalChars = 0;
  const maxChars = 15000;

  for (const chunk of scored) {
    if (totalChars + chunk.length <= maxChars) {
      selectedChunks.push(chunk);
      totalChars += chunk.length;
    }
  }

  console.log(`\n📝 Selected ${selectedChunks.length} top chunks (~${totalChars} chars)`);

  // Create metadata for each selected chunk
  const included = selectedChunks.map((chunk, idx) => ({
    id: `${chunk.file}::${chunk.chunkIndex}`,
    file: `ERGO_products_data/${chunk.file}`,
    chunkIndex: chunk.chunkIndex,
    length: chunk.length,
    score: chunk.score
  }));

  // Combine top chunks into a single prompt
  const combinedPrompt = selectedChunks
    .map(c => `[${c.file} - Chunk ${c.chunkIndex}]\n${c.text}`)
    .join('\n\n---\n\n');

  // Create output
  const output = {
    generatedAt: new Date().toISOString(),
    maxChars: maxChars,
    selectedCount: selectedChunks.length,
    totalChars: totalChars,
    totalDocsAvailable: Object.keys(docs).length,
    totalChunksAvailable: scored.length,
    included: included,
    combinedPrompt: combinedPrompt,
    instructions: {
      de: 'Nutze die untenstehenden ERGO-Dokumente um Fragen zu Versicherungsprodukten zu beantworten.',
      en: 'Use the ERGO documents below to answer questions about insurance products.',
      vi: 'Sử dụng các tài liệu ERGO dưới đây để trả lời các câu hỏi về các sản phẩm bảo hiểm.'
    }
  };

  // Write to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('✅ PROMPT GENERATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`📄 Output File: ${OUTPUT_FILE}`);
  console.log(`📊 Included Chunks: ${selectedChunks.length}`);
  console.log(`💾 File Size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
  console.log('='.repeat(60) + '\n');
}

generatePrompt().catch(err => {
  console.error('❌ Generation failed:', err);
  process.exit(1);
});

