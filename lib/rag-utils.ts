/**
 * Advanced RAG utility with better relevance scoring
 * This module provides enhanced document retrieval capabilities
 */

export interface RelevanceScore {
  score: number;
  keyword_matches: number;
  term_frequency: number;
  document_length_factor: number;
}

/**
 * Calculate advanced relevance score using multiple factors
 */
export function calculateAdvancedRelevance(
  query: string,
  text: string
): RelevanceScore {
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2);

  let keywordMatches = 0;
  let termFrequency = 0;

  for (const term of queryTerms) {
    // Count exact word matches
    const wordRegex = new RegExp(`\\b${term}\\b`, "gi");
    const exactMatches = text.match(wordRegex);
    if (exactMatches) {
      keywordMatches += exactMatches.length;
    }

    // Count partial matches (important for German compound words)
    const partialRegex = new RegExp(`\\b${term}\\w*\\b`, "gi");
    const partialMatches = text.match(partialRegex);
    if (partialMatches) {
      termFrequency += partialMatches.length;
    }
  }

  // Factor in document length (prefer content-rich chunks)
  const documentLengthFactor = Math.log(text.length + 1) * 0.1;

  const totalScore =
    keywordMatches * 10 + termFrequency * 3 + documentLengthFactor;

  return {
    score: totalScore,
    keyword_matches: keywordMatches,
    term_frequency: termFrequency,
    document_length_factor: documentLengthFactor,
  };
}

/**
 * Extract key terms from query for better matching
 */
export function extractKeyTerms(query: string): string[] {
  // Common German stop words
  const stopWords = new Set([
    "der",
    "die",
    "das",
    "und",
    "oder",
    "ein",
    "eine",
    "einem",
    "einen",
    "einer",
    "eines",
    "ist",
    "sind",
    "im",
    "in",
    "zu",
    "für",
    "auf",
    "mit",
    "von",
    "an",
    "bei",
  ]);

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2 && !stopWords.has(term));
}

/**
 * Check if query is related to ERGO products
 */
export function isErgoRelated(query: string): boolean {
  const ergoKeywords = [
    "ergo",
    "versicherung",
    "versicherungen",
    "krankenversicherung",
    "altersvorsorge",
    "pension",
    "rente",
    "leben",
    "sachversicherung",
    "haftpflicht",
    "kfz",
    "auto",
    "haus",
    "immobilien",
    "steuer",
    "steuern",
    "steuerlich",
    "versicherter",
    "beiträge",
    "prämien",
    "versicherungsvertrag",
  ];

  const queryLower = query.toLowerCase();
  return ergoKeywords.some((keyword) => queryLower.includes(keyword));
}

/**
 * Format document text for display
 */
export function formatDocumentText(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Try to cut at sentence boundary
  const truncated = text.substring(0, maxLength);
  const lastPeriodIndex = truncated.lastIndexOf(".");
  const lastCommaIndex = truncated.lastIndexOf(",");
  const cutIndex = Math.max(lastPeriodIndex, lastCommaIndex);

  if (cutIndex > maxLength * 0.8) {
    return truncated.substring(0, cutIndex + 1) + " ...";
  }

  return truncated + " ...";
}

/**
 * Group documents by source file
 */
export function groupDocumentsBySource<T extends { file: string }>(
  documents: T[]
): { [file: string]: T[] } {
  return documents.reduce(
    (acc, doc) => {
      if (!acc[doc.file]) {
        acc[doc.file] = [];
      }
      acc[doc.file].push(doc);
      return acc;
    },
    {} as { [file: string]: T[] }
  );
}

/**
 * Create a summary of document sources
 */
export function _createSourceSummary(sources: string[]): string {
  if (sources.length === 0) {
    return "Keine Quellen verfügbar";
  }

  const unique = [...new Set(sources)];
  if (unique.length === 1) {
    return `Quelle: ${unique[0]}`;
  }

  return `Quellen (${unique.length}): ${unique.join(", ")}`;
}

/**
 * Calculate document relevance confidence (0-100)
 */
export function _getConfidenceLevel(relevanceScore: number): {
  level: "high" | "medium" | "low";
  percentage: number;
} {
  // Normalize score to 0-100 scale
  const percentage = Math.min(100, Math.max(0, relevanceScore * 2));

  if (percentage >= 70) {
    return { level: "high", percentage };
  } else if (percentage >= 40) {
    return { level: "medium", percentage };
  } else {
    return { level: "low", percentage };
  }
}

