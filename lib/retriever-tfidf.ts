// TF-IDF retriever for offline RAG
// Loads data/ergo_docs.json produced earlier and builds a TF-IDF index using 'natural'.

import fs from 'fs';
import path from 'path';
import natural from 'natural';

type Doc = { id: string; file: string; chunkIndex: number; text: string };

let docs: Doc[] = [];
let tfidf: natural.TfIdf | null = null;
let built = false;

export function buildIndex() {
  if (built) return;
  const infile = path.join(process.cwd(), 'data', 'ergo_docs.json');
  if (!fs.existsSync(infile)) {
    console.warn('[retriever] ergo_docs.json not found, skipping index build');
    built = true;
    return;
  }
  const raw = fs.readFileSync(infile, 'utf8');
  const parsed = JSON.parse(raw);
  docs = (parsed.docs || []).map((d: any) => ({ id: d.id, file: d.file, chunkIndex: d.chunkIndex, text: d.text }));

  tfidf = new natural.TfIdf();
  docs.forEach((d) => tfidf!.addDocument(d.text));
  built = true;
  console.log('[retriever] Built TF-IDF index, docs=', docs.length);
}

export function getTopK(query: string, k = 3) {
  if (!built || !tfidf) buildIndex();
  if (!tfidf) return [];

  // compute score for each doc
  const scores: { doc: Doc; score: number }[] = docs.map((d, i) => ({ doc: d, score: tfidf!.tfidf(query, i) }));
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, k).map((s) => ({ ...s.doc, score: s.score }));
}

export function getDocsCount() {
  if (!built) buildIndex();
  return docs.length;
}

