import fs from "fs";
import path from "path";
import {
  calculateAdvancedRelevance,
  formatDocumentText,
  isErgoRelated,
} from "./rag-utils";

export interface ErgoBundleItem {
  id: string;
  file: string;
  chunkIndex: number;
  text: string;
}

export interface ErgoDocsData {
  [key: string]: string[];
}

let cachedErgoDocs: ErgoDocsData | null = null;

/**
 * Load ERGO documentation from the ergo_docs.json file
 */
export async function loadErgoDocs(): Promise<ErgoDocsData> {
  if (cachedErgoDocs) {
    return cachedErgoDocs;
  }

  try {
    const filePath = path.join(process.cwd(), "data", "ergo_docs.json");
    const fileContent = fs.readFileSync(filePath, "utf-8");
    cachedErgoDocs = JSON.parse(fileContent);
    return cachedErgoDocs || {};
  } catch (error) {
    console.error("Error loading ERGO documentation:", error);
    return {};
  }
}

/**
 * Simple BM25-like relevance scoring for retrieval
 */
function calculateRelevance(query: string, text: string): number {
  const relevanceData = calculateAdvancedRelevance(query, text);
  return relevanceData.score;
}

/**
 * Retrieve relevant ERGO documents based on query
 */
export async function retrieveErgoDocuments(
  query: string,
  topK: number = 3
): Promise<ErgoBundleItem[]> {
  const ergoDocs = await loadErgoDocs();
  const results: ErgoBundleItem[] = [];

  // Check if query is related to ERGO products
  if (!isErgoRelated(query)) {
    // Return empty results if query is not ERGO-related
    return results;
  }

  let chunkIndex = 0;
  for (const [fileId, chunks] of Object.entries(ergoDocs)) {
    console.log(`[ergo-retriever] Processing file: ${fileId}`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Ensure chunk is a string
      const chunkText = typeof chunk === "string" ? chunk : String(chunk || "");

      const relevance = calculateRelevance(query, chunkText);

      if (relevance > 0) {
        const filePath = getFilePathFromId(fileId);
        const fileName =
          filePath.split("/").pop() || fileId.split("::")[0] || "Unknown";

        console.log(
          `[ergo-retriever] Found relevant doc: ${fileName} (score: ${relevance.toFixed(2)})`
        );

        results.push({
          id: `${fileId}::${i}`,
          file: fileName, // Use just the file name, not full path
          chunkIndex: i,
          text: chunkText,
        });
      }
      chunkIndex++;
    }
  }

  // Sort by relevance score descending
  results.sort((a, b) => {
    const scoreA = calculateRelevance(query, a.text);
    const scoreB = calculateRelevance(query, b.text);
    return scoreB - scoreA;
  });

  console.log(
    `[ergo-retriever] Retrieved ${results.length} documents, returning top ${topK}`
  );

  return results.slice(0, topK);
}

/**
 * Map document ID to actual file path
 */
function getFilePathFromId(fileId: string): string {
  const fileNameMap: { [key: string]: string } = {
    "50076048-KV Zusatzmappe_DKV und EKV_01.2026":
      "ERGO_products_data/health/50076048-KV Zusatzmappe_DKV und EKV_01.2026.pdf",
    "50062839_01-25_Infoblatt_Steuerliche_Regelungen_final":
      "ERGO_products_data/pension/50062839_01-25_Infoblatt_Steuerliche_Regelungen_final.pdf",
    "50071920_1025_ERGO_Produktuebersicht_Leben_final":
      "ERGO_products_data/pension/50071920_1025_ERGO_Produktuebersicht_Leben_final.pdf",
    "50079900_1124_ERGO_Highlightblatt_FuA_AO_V1_Internet":
      "ERGO_products_data/pension/50079900_1124_ERGO_Highlightblatt_FuA_AO_V1_Internet.pdf",
    "50080359_0125_ERGO_Altersvorsorge_Vermittler-Infoblatt_V2_x4":
      "ERGO_products_data/pension/50080359_0125_ERGO_Altersvorsorge_Vermittler-Infoblatt_V2_x4.pdf",
    "50081351_12-24_ERGO_Highlightblatt_Happy_New_YEAH_final1":
      "ERGO_products_data/pension/50081351_12-24_ERGO_Highlightblatt_Happy_New_YEAH_final1.pdf",
    "50081387_0125_ERGO_Infoblatt_Sozialversicherungswerte_final1":
      "ERGO_products_data/pension/50081387_0125_ERGO_Infoblatt_Sozialversicherungswerte_final1.pdf",
    "50066783_BR_RS_Familien_Singles_09_2025_final":
      "ERGO_products_data/property casualty/50066783_BR_RS_Familien_Singles_09_2025_final.pdf",
    "50068082_Taschentarif_PK100_07.2025 - final":
      "ERGO_products_data/property casualty/50068082_Taschentarif_PK100_07.2025 - final.pdf",
    "ERGO_Eigentum-Vermoegen_Flyer_50078776_WEB":
      "ERGO_products_data/property casualty/ERGO_Eigentum-Vermoegen_Flyer_50078776_WEB.pdf",
  };

  for (const [key, path] of Object.entries(fileNameMap)) {
    if (fileId.includes(key) || fileId.startsWith(key)) {
      return path;
    }
  }

  return fileId;
}

/**
 * Format retrieved documents for context in prompts
 */
export function formatRetrievedContext(
  documents: ErgoBundleItem[]
): string {
  if (documents.length === 0) {
    return "";
  }

  let context =
    "## Relevante ERGO Dokumentation\n\nNutze folgende Informationen aus den ERGO Dokumenten zur Beantwortung:\n\n";

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const formattedText = formatDocumentText(doc.text, 600);
    context += `### Quelle ${i + 1}: ${doc.file}\n`;
    context += `${formattedText}\n\n`;
  }

  return context;
}

