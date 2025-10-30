#!/usr/bin/env node
/*
  Script: build-ergo-json.js
  - Scans ERGO_products_data recursively for PDF files
  - Extracts text using pdf-parse
  - Chunks text into segments (~800-1200 chars) with simple sentence boundary handling
  - Writes output JSON to data/ergo_docs.json
*/

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const ROOT_DIR = path.resolve(process.cwd());
const SOURCE_DIR = path.join(ROOT_DIR, 'ERGO_products_data');
const OUT_FILE = path.join(ROOT_DIR, 'data', 'ergo_docs.json');

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function (file) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(filePath));
    } else {
      results.push(filePath);
    }
  });
  return results;
}

function chunkText(text, maxLen = 1000, overlap = 200) {
  const sentences = text.match(/[^\.!?]+[\.!?]+|[^\.!?]+$/g) || [text];
  const chunks = [];
  let current = '';
  for (const s of sentences) {
    if ((current + ' ' + s).length > maxLen) {
      if (current.length > 0) chunks.push(current.trim());
      // start new chunk with overlap
      current = s.slice(0, overlap);
    } else {
      current = (current + ' ' + s).trim();
    }
  }
  if (current.length > 0) chunks.push(current.trim());
  return chunks;
}

(async function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error('Source directory ERGO_products_data not found at', SOURCE_DIR);
    process.exit(1);
  }

  const files = walkDir(SOURCE_DIR).filter((f) => f.toLowerCase().endsWith('.pdf'));
  console.log('Found PDF files:', files.length);

  const docs = [];

  for (const filePath of files) {
    console.log('Processing', filePath);
    const dataBuffer = fs.readFileSync(filePath);
    try {
      const data = await pdf(dataBuffer);
      const text = (data && data.text) ? data.text : '';
      if (!text || text.trim().length === 0) {
        console.warn('No text extracted from', filePath);
        continue;
      }

      const chunks = chunkText(text, 1000, 200);
      const relPath = path.relative(ROOT_DIR, filePath);
      chunks.forEach((chunk, idx) => {
        docs.push({
          id: `${path.basename(filePath)}::${idx}`,
          file: relPath,
          chunkIndex: idx,
          text: chunk,
        });
      });
    } catch (err) {
      console.error('Error parsing PDF', filePath, err);
    }
  }

  // Ensure data directory exists
  const dataDir = path.join(ROOT_DIR, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  fs.writeFileSync(OUT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), count: docs.length, docs }, null, 2));
  console.log('Wrote', OUT_FILE, 'with', docs.length, 'chunks');
})();

