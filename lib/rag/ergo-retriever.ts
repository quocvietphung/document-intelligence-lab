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
        const data = JSON.parse(fileContent);

        // Handle both array and object formats
        if (Array.isArray(data)) {
            const converted: ErgoDocsData = {};

            for (const item of data) {
                if (item && item.file && item.text) {
                    const fileKey = item.file;
                    if (!converted[fileKey]) {
                        converted[fileKey] = [];
                    }
                    converted[fileKey].push(item.text);
                }
            }

            cachedErgoDocs = converted;
        } else if (data && data.docs && typeof data.docs === "object") {
            // Handle new format from extract-ergo-pdf.js with { generatedAt, totalPdfs, totalChunks, docs: {...} }
            const converted: ErgoDocsData = {};

            for (const [fileKey, chunks] of Object.entries(data.docs)) {
                if (Array.isArray(chunks)) {
                    // Ensure all chunks are strings
                    converted[fileKey] = chunks.map((chunk: any) =>
                        typeof chunk === "string" ? chunk : String(chunk || "").trim()
                    ).filter((chunk: string) => chunk.length > 0);
                }
            }

            cachedErgoDocs = converted;
        } else if (typeof data === "object" && data !== null) {
            // Handle old object format
            const converted: ErgoDocsData = {};

            for (const [fileKey, value] of Object.entries(data)) {
                if (fileKey !== "generatedAt" && fileKey !== "totalPdfs" && fileKey !== "totalChunks") {
                    if (Array.isArray(value)) {
                        converted[fileKey] = value.map((chunk: any) =>
                            typeof chunk === "string" ? chunk : String(chunk || "").trim()
                        ).filter((chunk: string) => chunk.length > 0);
                    }
                }
            }

            cachedErgoDocs = Object.keys(converted).length > 0 ? converted : data;
        } else {
            cachedErgoDocs = data;
        }

        console.log(`[ergo-retriever] Loaded ERGO docs with ${Object.keys(cachedErgoDocs || {}).length} files`);
        return cachedErgoDocs || {};
    } catch (error) {
        console.error("[ergo-retriever] Error loading ERGO documentation:", error);
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
    try {
        const ergoDocs = await loadErgoDocs();
        const results: ErgoBundleItem[] = [];

        // Check if query is related to ERGO products
        if (!isErgoRelated(query)) {
            // Return empty results if query is not ERGO-related
            return results;
        }

        let chunkIndex = 0;
        for (const [fileId, chunks] of Object.entries(ergoDocs)) {

            // Ensure chunks is an array
            const chunkArray = Array.isArray(chunks) ? chunks : [];

            for (let i = 0; i < chunkArray.length; i++) {
                const chunk = chunkArray[i];

                // Ensure chunk is converted to string safely
                const chunkText = typeof chunk === "string" ? chunk : String(chunk || "").trim();

                // Skip empty chunks
                if (!chunkText || chunkText.length === 0) {
                    chunkIndex++;
                    continue;
                }

                const relevance = calculateRelevance(query, chunkText);

                if (relevance > 0) {
                    const filePath = getFilePathFromId(fileId);
                    const fileName =
                        filePath.split("/").pop() || fileId.split("::")[0] || "Unknown";

                    results.push({
                        id: `${fileId}::${i}`,
                        file: fileName,
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
            `[ergo-retriever] ✅ Retrieved ${results.length} relevant chunks, returning top ${topK}`
        );

        return results.slice(0, topK);
    } catch (error) {
        console.error("[ergo-retriever] Error retrieving documents:", error);
        return [];
    }
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

