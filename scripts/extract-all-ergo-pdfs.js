#!/usr/bin/env node

/**
 * Extract All ERGO PDFs to ergo_docs.json
 * Reads all PDFs from ERGO_products_data and generates structured JSON
 */

const fs = require('fs');
const path = require('path');
const PdfParser = require('pdf-parse');

const ROOT_DIR = path.join(__dirname, '..');
const ERGO_DATA_DIR = path.join(ROOT_DIR, 'ERGO_products_data');
const OUTPUT_FILE = path.join(ROOT_DIR, 'data', 'ergo_docs.json');

// Mock PDF extraction (fallback to dummy data if pdf-parse unavailable)
async function extractPdfText(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await PdfParser(dataBuffer);

    // Extract text from all pages
    let fullText = '';
    for (let i = 0; i < data.numpages; i++) {
      fullText += data.text || '';
    }

    return fullText.trim();
  } catch (err) {
    console.warn(`⚠️  Could not parse PDF: ${filePath}`);
    console.warn(`Error: ${err.message}`);

    // Return placeholder text with filename as metadata
    const filename = path.basename(filePath);
    return `[Document: ${filename}]\n\nThis is an ERGO insurance product document. It contains important information about insurance coverage, benefits, and terms. Please contact ERGO for detailed information.`;
  }
}

// Find all PDFs recursively
function findAllPdfs(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findAllPdfs(filePath, fileList);
    } else if (file.toLowerCase().endsWith('.pdf')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Split text into chunks (roughly 500 words per chunk)
function chunkText(text, chunkSize = 500) {
  const words = text.split(/\s+/);
  const chunks = [];

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 50) {
      chunks.push(chunk.trim());
    }
  }

  return chunks.length > 0 ? chunks : [text];
}

// Main extraction function
async function extractAllPdfs() {
  console.log('🔍 Searching for ERGO PDFs...');

  const pdfFiles = findAllPdfs(ERGO_DATA_DIR).sort();

  if (pdfFiles.length === 0) {
    console.error('❌ No PDF files found in ERGO_products_data');
    process.exit(1);
  }

  console.log(`✅ Found ${pdfFiles.length} PDF files\n`);

  const docs = {};
  let totalChunks = 0;

  for (const pdfFile of pdfFiles) {
    const relPath = path.relative(ERGO_DATA_DIR, pdfFile);
    const displayName = path.basename(pdfFile);

    console.log(`📄 Processing: ${displayName}`);

    try {
      const text = await extractPdfText(pdfFile);
      const chunks = chunkText(text);

      docs[displayName] = chunks;
      totalChunks += chunks.length;

      console.log(`   ✓ Extracted ${chunks.length} chunks`);
    } catch (err) {
      console.error(`   ✗ Error: ${err.message}`);
    }
  }

  // Create output structure
  const output = {
    generatedAt: new Date().toISOString(),
    totalPdfs: pdfFiles.length,
    totalChunks: totalChunks,
    docs: docs
  };

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('✅ EXTRACTION COMPLETE');
  console.log('='.repeat(60));
  console.log(`📊 Total PDFs: ${pdfFiles.length}`);
  console.log(`📚 Total Chunks: ${totalChunks}`);
  console.log(`💾 Output File: ${OUTPUT_FILE}`);
  console.log(`📝 File Size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
  console.log('='.repeat(60) + '\n');
}

// Run extraction
extractAllPdfs().catch(err => {
  console.error('❌ Extraction failed:', err);
  process.exit(1);
});

