#!/usr/bin/env node

/**
 * Generate optimized ergo_prompt.json - Memory optimized version
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const ERGO_DOCS_FILE = path.join(ROOT_DIR, 'data', 'ergo_docs.json');
const OUTPUT_FILE = path.join(ROOT_DIR, 'data', 'ergo_prompt.json');

const IMPORTANCE_KEYWORDS = [
  'versicherung', 'leistung', 'tarif', 'beitrag', 'deckung',
  'produktübersicht', 'highlights', 'krankheit', 'zahnarzt', 'pflege',
  'altersvorsorge', 'pension', 'rente', 'zahnersatz', 'ambulant',
  'stationär', 'operativ', 'prämie', 'kosten', 'preis'
];

function scoreChunk(text) {
  if (!text || text.length < 50) return 0;

  const lowerText = text.toLowerCase();
  let score = 0;

  // Count keywords
  const keywordMatches = IMPORTANCE_KEYWORDS.filter(kw => lowerText.includes(kw)).length;
  score += keywordMatches * 0.5;

  // Boost for pricing/numbers
  if (text.match(/€|EUR|Euro/)) score += 3;
  if (text.match(/\d+\s*%/)) score += 1;
  if (text.match(/\d+,\d+\s*€/)) score += 2;

  // Structure bonus
  if (text.match(/^[-•]\s+|^\d+\.\s+/m)) score += 1;

  // Length quality
  if (text.length > 300) score += 2;

  return Math.max(0, Math.round(score * 10) / 10);
}

async function generate() {
  console.log('📖 Loading ergo_docs.json...');

  const data = JSON.parse(fs.readFileSync(ERGO_DOCS_FILE, 'utf-8'));
  const docs = data.docs || {};

  console.log(`✅ Loaded ${Object.keys(docs).length} documents with ${data.totalChunks} chunks\n`);
  console.log('🔍 Scoring chunks...');

  const scored = [];
  let processedCount = 0;

  // Process each document
  Object.entries(docs).forEach(([filename, chunks]) => {
    chunks.forEach((chunk, idx) => {
      const score = scoreChunk(chunk);
      if (score > 0) {
        scored.push({
          file: filename,
          chunkIndex: idx,
          text: chunk,
          score: score
        });
      }
      processedCount++;
    });
  });

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  console.log(`✅ Processed ${processedCount} chunks\n`);

  // Select top chunks (~15KB)
  const selected = [];
  let totalSize = 0;
  const maxSize = 15000;

  for (const chunk of scored) {
    if (totalSize + chunk.text.length <= maxSize) {
      selected.push(chunk);
      totalSize += chunk.text.length;
    } else {
      break;
    }
  }

  console.log(`📝 Selected ${selected.length} top chunks (${totalSize} bytes)`);

  // Build included metadata
  const included = selected.map(c => ({
    id: `${c.file}::${c.chunkIndex}`,
    file: `ERGO_products_data/${c.file}`,
    chunkIndex: c.chunkIndex,
    length: c.text.length,
    score: c.score
  }));

  // Combine text
  const combinedPrompt = selected
    .map(c => c.text)
    .join('\n\n---\n\n');

  // Output
  const output = {
    generatedAt: new Date().toISOString(),
    version: '2.0',
    maxChars: maxSize,
    selectedCount: selected.length,
    totalChars: totalSize,
    totalDocsAvailable: Object.keys(docs).length,
    totalChunksAvailable: data.totalChunks,
    topScores: selected.slice(0, 5).map(c => c.score),
    included: included,
    combinedPrompt: combinedPrompt
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log('\n' + '='.repeat(50));
  console.log('✅ SUCCESS');
  console.log('='.repeat(50));
  console.log(`📄 ergo_prompt.json: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)} KB`);
  console.log(`📚 Selected: ${selected.length} chunks`);
  console.log(`💾 Total: ~${totalSize} bytes`);
  console.log('='.repeat(50));
}

generate().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

