#!/usr/bin/env node
// Merge ergo_docs.json chunks into a single combined prompt JSON, up to a max character length.

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const IN_FILE = path.join(ROOT, 'data', 'ergo_docs.json');
const OUT_FILE = path.join(ROOT, 'data', 'ergo_prompt.json');
const MAX_CHARS = parseInt(process.env.MAX_PROMPT_CHARS || '12000', 10);

if (!fs.existsSync(IN_FILE)) {
  console.error('Input file not found:', IN_FILE);
  process.exit(1);
}

const raw = fs.readFileSync(IN_FILE, 'utf8');
const obj = JSON.parse(raw);
const docs = obj.docs || [];

let combined = '';
const included = [];
for (const d of docs) {
  const text = (d.text || '').trim();
  if (!text) continue;
  if ((combined.length + text.length + 2) > MAX_CHARS) break;
  combined += '\n\n' + text;
  included.push({ id: d.id, file: d.file, chunkIndex: d.chunkIndex, length: text.length });
}

const output = {
  generatedAt: new Date().toISOString(),
  maxChars: MAX_CHARS,
  includedCount: included.length,
  included,
  combinedPrompt: combined.trim(),
};

fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
console.log('Wrote', OUT_FILE, 'chars:', output.combinedPrompt.length, 'chunks:', included.length);

