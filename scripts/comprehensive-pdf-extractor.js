#!/usr/bin/env node

/**
 * Comprehensive PDF Extractor - Scans all ERGO PDFs and creates unified JSON database
 * Purpose: Extract all content from 12 ERGO PDFs into a single searchable JSON file
 */

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

// Configuration
const PDF_DIR = '/Users/vietphung/WebstormProjects/tax-consulting/ERGO_products_data';
const OUTPUT_FILE = '/Users/vietphung/WebstormProjects/tax-consulting/data/ergo_docs.json';
const CHUNK_SIZE = 800; // Characters per chunk

console.log('🔍 ERGO PDF Comprehensive Extractor');
console.log('=====================================');
console.log(`Scanning directory: ${PDF_DIR}`);
console.log('');

/**
 * Find all PDF files recursively
 */
function findPdfFiles(dir) {
  let files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(findPdfFiles(fullPath));
    } else if (item.name.toLowerCase().endsWith('.pdf')) {
      files.push({
        path: fullPath,
        name: item.name,
        relativePath: path.relative(PDF_DIR, fullPath)
      });
    }
  }
  return files;
}

/**
 * Extract text from PDF
 */
async function extractFromPdf(filePath, fileName) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    console.log(`✓ ${fileName} - ${data.numpages} pages, ${data.text.length} chars`);
    return {
      fileName,
      filePath,
      totalPages: data.numpages,
      totalCharacters: data.text.length,
      text: data.text
    };
  } catch (error) {
    console.log(`✗ Error reading ${fileName}: ${error.message}`);
    return null;
  }
}

/**
 * Split text into chunks
 */
function createChunks(text, chunkSize) {
  const chunks = [];
  let currentChunk = '';

  // Split by sentences for better chunking
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Main extraction process
 */
async function main() {
  try {
    // Find all PDFs
    const pdfFiles = findPdfFiles(PDF_DIR);
    console.log(`Found ${pdfFiles.length} PDF files\n`);

    if (pdfFiles.length === 0) {
      console.log('❌ No PDF files found!');
      process.exit(1);
    }

    // Extract from each PDF
    const database = {
      generatedAt: new Date().toISOString(),
      totalPdfs: pdfFiles.length,
      totalChunks: 0,
      docs: {}
    };

    let totalChunks = 0;

    for (const pdfFile of pdfFiles) {
      const result = await extractFromPdf(pdfFile.path, pdfFile.name);

      if (result) {
        // Create chunks
        const chunks = createChunks(result.text, CHUNK_SIZE);
        totalChunks += chunks.length;

        // Store in database
        database.docs[pdfFile.name] = {
          filePath: pdfFile.relativePath,
          pages: result.totalPages,
          characters: result.totalCharacters,
          chunks: chunks.length,
          content: chunks
        };

        console.log(`  → Created ${chunks.length} chunks`);
      }
    }

    database.totalChunks = totalChunks;

    // Write to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(database, null, 2));
    console.log(`\n✅ Successfully created: ${OUTPUT_FILE}`);
    console.log(`📊 Summary:`);
    console.log(`   - Total PDFs: ${database.totalPdfs}`);
    console.log(`   - Total Chunks: ${database.totalChunks}`);
    console.log(`   - File Size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
    console.log(`   - Generated: ${database.generatedAt}`);
    console.log('\n✨ Database ready for RAG retrieval!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run extraction
main();

