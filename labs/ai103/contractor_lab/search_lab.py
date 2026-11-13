"""Advanced exercise 5 – Azure AI Search on the same fictional PDFs as the local Qdrant/BM25 path.

Offline (mock, default): a BM25 ranking over the page texts in fixtures/search/dossier-pages.json answers the four
queries that the Java pre-check sends. The check is whether the expected page is the top hit, with the document name
and page number kept for the citation. Azure AI Search is configured by the JSON files in azure/search/ and queried
only through `cloud.require_live("search")`.

Documented facts used (learn.microsoft.com, read 2026-11-11): latest GA api-version 2026-04-01; Blob indexer
configuration dataToExtract=contentAndMetadata and parsingMode=default (required with imageAction);
imageAction generateNormalizedImagePerPage (PDF only); OCR skill #Microsoft.Skills.Vision.OcrSkill on
/document/normalized_images/*; SplitSkill #Microsoft.Skills.Text.SplitSkill with textSplitMode=pages.
NOT verified: the page-number field of normalized images (needed for page citations) and the hybrid query body (the
Learn page returned 404). Hybrid search therefore stays a documented next step, not a tested claim.
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter

from . import FIXTURES, LAB_ROOT
from .azure_http import post
from .cloud import require_live

SEARCH_API_VERSION = "2026-04-01"
PAGES = FIXTURES / "search/dossier-pages.json"
CONFIG = LAB_ROOT / "azure/search"
TOKEN = re.compile(r"[\w\-]+", re.UNICODE)

# The four queries of the Java pre-check (ContractorPrecheck.search) and the page each must rank first.
QUERIES = {
    "approved": ("Genehmigte Gesamtvergütung brutto Nachtrag genehmigt", ("nachtrag-n01-wv-2026-031.pdf", 2)),
    "invoice": ("Rechnungsbetrag brutto Rechnungssumme Umsatzsteuer", ("baurechnung-rg-2026-0457.pdf", 2)),
    "acceptance": ("Abnahmeprotokoll Abnahmeergebnis abgenommen Umfang Mängel", ("abnahmeprotokoll-ap-2026-019.pdf", 1)),
    "payment": ("Zahlungsnachweis Zahlung bezahlt überwiesen Zahlungseingang", None),
}


def tokens(text: str) -> list[str]:
    return [t.lower() for t in TOKEN.findall(text) if len(t) > 2]


def load_pages() -> list[dict]:
    data = json.loads(PAGES.read_text(encoding="utf-8"))
    return [{"documentName": d["name"], "page": p["number"], "content": p["text"]} for d in data["documents"] for p in d["pages"]]


def bm25(pages: list[dict], query: str, k1: float = 1.2, b: float = 0.75) -> list[tuple[float, dict]]:
    docs = [Counter(tokens(p["content"])) for p in pages]
    lengths = [sum(d.values()) for d in docs]
    average = sum(lengths) / len(lengths)
    terms = set(tokens(query))
    scored = []
    for page, counts, length in zip(pages, docs, lengths):
        score = 0.0
        for term in terms:
            frequency = counts.get(term, 0)
            if not frequency:
                continue
            containing = sum(1 for d in docs if d.get(term))
            idf = math.log(1 + (len(docs) - containing + 0.5) / (containing + 0.5))
            score += idf * frequency * (k1 + 1) / (frequency + k1 * (1 - b + b * length / average))
        scored.append((round(score, 4), page))
    return sorted(scored, key=lambda item: item[0], reverse=True)


def local_check() -> list[dict]:
    pages = load_pages()
    rows = []
    for purpose, (query, expected) in QUERIES.items():
        ranked = bm25(pages, query)
        top_score, top = ranked[0]
        if expected is None:
            # Payment: no page may carry a dated confirmation; a keyword match alone is not evidence.
            confirmed = [p for _, p in ranked if re.search(r"(?iu)(bezahlt|überwiesen|zahlungseingang)\s+am\s+\d", p["content"])]
            rows.append({"purpose": purpose, "query": query, "top": None, "score": top_score, "passed": not confirmed,
                         "note": "no dated payment confirmation in the dossier"})
            continue
        passed = (top["documentName"], top["page"]) == expected
        rows.append({"purpose": purpose, "query": query, "top": f"{top['documentName']} p. {top['page']}", "score": top_score,
                     "passed": passed, "expected": f"{expected[0]} p. {expected[1]}"})
    return rows


def validate_config() -> list[str]:
    """Structural checks against the documented shapes. Returns problems; an empty list means the files are consistent."""
    problems = []
    files = {name: json.loads((CONFIG / f"{name}.json").read_text(encoding="utf-8")) for name in ("datasource", "skillset", "index", "indexer")}
    if files["datasource"].get("type") != "azureblob":
        problems.append("datasource type must be azureblob")
    skills = {s.get("@odata.type"): s for s in files["skillset"].get("skills", [])}
    ocr = skills.get("#Microsoft.Skills.Vision.OcrSkill")
    if not ocr or ocr["inputs"][0]["source"] != "/document/normalized_images/*":
        problems.append("OCR skill must read /document/normalized_images/*")
    split = skills.get("#Microsoft.Skills.Text.SplitSkill")
    if not split or split.get("textSplitMode") != "pages":
        problems.append("split skill must use textSplitMode pages")
    fields = {f["name"]: f for f in files["index"].get("fields", [])}
    if not any(f.get("key") for f in fields.values()):
        problems.append("index needs a key field")
    for name in ("documentName", "page", "content", "sourceId"):
        if name not in fields:
            problems.append(f"index field {name} is missing")
    if fields.get("page", {}).get("type") != "Edm.Int32":
        problems.append("page must be Edm.Int32")
    configuration = files["indexer"].get("parameters", {}).get("configuration", {})
    if configuration.get("dataToExtract") != "contentAndMetadata" or configuration.get("parsingMode") != "default":
        problems.append("imageAction needs dataToExtract contentAndMetadata and parsingMode default")
    if configuration.get("imageAction") not in ("generateNormalizedImages", "generateNormalizedImagePerPage"):
        problems.append("imageAction must generate normalized images")
    if files["indexer"].get("skillsetName") != files["skillset"].get("name") or files["indexer"].get("dataSourceName") != files["datasource"].get("name"):
        problems.append("indexer must reference the datasource and skillset by name")
    return problems


def parse_search_response(body: dict) -> list[dict]:
    """Maps documented search results (value[] with @search.score) to the lab's hit shape."""
    return [{"documentName": hit.get("documentName"), "page": hit.get("page"), "score": hit.get("@search.score"),
             "sourceId": hit.get("sourceId")} for hit in body.get("value", [])]


def live_query(query: str, token: str, env: dict, tracer=None) -> list[dict]:
    require_live("search", env)
    endpoint = env["AZURE_SEARCH_ENDPOINT"].rstrip("/")
    index = env["AZURE_SEARCH_INDEX"]
    version = env.get("AZURE_SEARCH_API_VERSION") or SEARCH_API_VERSION
    url = f"{endpoint}/indexes/{index}/docs/search?api-version={version}"
    body = json.dumps({"search": query, "top": 3, "select": "documentName,page,sourceId"}).encode("utf-8")
    payload, _ = post("search", "query", url, body, {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, 30, tracer)
    return parse_search_response(json.loads(payload.decode("utf-8")))
