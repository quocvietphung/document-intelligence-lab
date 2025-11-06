#!/usr/bin/env node

/**
 * Extract text from ERGO PDF documents and generate ergo_docs.json
 * This script processes all PDF files in ERGO_products_data folder
 */

const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const ERGO_DATA_DIR = path.join(__dirname, "../ERGO_products_data");
const OUTPUT_FILE = path.join(__dirname, "../data/ergo_docs.json");

async function extractPdfText(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(fileBuffer);

    // Clean up text - remove extra whitespace
    let text = (data.text || "")
      .replace(/\s+/g, " ")
      .trim();

    // Limit to first 50000 characters per PDF to save memory
    if (text.length > 50000) {
      text = text.substring(0, 50000);
    }

    return text;
  } catch (error) {
    console.error(`Error extracting PDF ${filePath}:`, error.message);
    return "";
  }
}

function chunkText(text, chunkSize = 800, overlap = 100) {
  const chunks = [];

  // Split by paragraphs first
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if ((currentChunk + "\n" + paragraph).length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? "\n" : "") + paragraph;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      await walkDir(filePath, callback);
    } else if (file.endsWith(".pdf")) {
      await callback(filePath);
    }
  }
}

async function main() {
  console.log("🔍 Scanning ERGO_products_data directory...");

  const documents = {};
  let totalPdfs = 0;
  let totalChunks = 0;

  try {
    await walkDir(ERGO_DATA_DIR, async (filePath) => {
      const fileName = path.basename(filePath);
      const fileNameWithoutExt = fileName.replace(".pdf", "");

      console.log(`📄 Processing: ${fileName}...`);

      const text = await extractPdfText(filePath);

      if (text && text.trim().length > 0) {
        const chunks = chunkText(text, 1000, 100);
        documents[fileNameWithoutExt] = chunks;
        totalChunks += chunks.length;
        totalPdfs++;

        console.log(`   ✓ Extracted ${chunks.length} chunks`);
      } else {
        console.log(`   ⚠ No text extracted from PDF`);
      }
    });

    // Create output structure
    const output = {
      generatedAt: new Date().toISOString(),
      totalPdfs,
      totalChunks,
      docs: documents,
    };

    // Write to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

    console.log("\n✅ Successfully extracted PDF data!");
    console.log(`   - Total PDFs: ${totalPdfs}`);
    console.log(`   - Total chunks: ${totalChunks}`);
    console.log(`   - Output file: ${OUTPUT_FILE}`);
  } catch (error) {
    console.error("❌ Error during extraction:", error);
    process.exit(1);
  }
}

main();

