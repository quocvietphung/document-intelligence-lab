"""Evidence Intelligence Control Tower marts: Bronze -> Silver -> reviewed Gold -> BI star schema -> Power BI-ready export.

Built inside the existing ETL worker from the same run, in the same per-scope DuckDB file. Every row carries the
tenant key, the project, the run and a measurement mode:

- ``measured``: observed in this run (extraction, reviews, stage timings).
- ``deterministic``: a fixed rule computed on this run's extracted text (retrieval, citation and injection checks).
- ``configured``: a configured price or setting, not an observation (local cost per token is 0 EUR).
- ``simulated``: fixture data, only when the caller passes it explicitly (``simulate_ocr``); never mixed into
  measured KPIs.

No PDF is stored: page text appears only as a bounded snippet of the region that holds an observed value.
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
import re
import shutil
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

SCHEMA_VERSION = "control-tower-v1"
SPEC = Path(__file__).with_name("powerbi")
EVALUATION_CASES = Path(__file__).with_name("evaluation_cases.json")
SNIPPET = 160
DRILL_LIMIT = 150

TABLES = {
    "dim_tenant": "tenant_key VARCHAR, label VARCHAR",
    "dim_project": "tenant_key VARCHAR, project_id VARCHAR, domain VARCHAR",
    "dim_date": "date_key INTEGER, date DATE, year INTEGER, month INTEGER, day INTEGER",
    "dim_provider": "provider VARCHAR, provider_kind VARCHAR",
    "dim_model": "model_key VARCHAR, provider VARCHAR, model_version VARCHAR",
    "dim_prompt_version": "prompt_version VARCHAR, description VARCHAR",
    "dim_pipeline_version": "pipeline_version VARCHAR, description VARCHAR",
    "dim_document_type": "document_type VARCHAR",
    "dim_document": "document_key VARCHAR, tenant_key VARCHAR, project_id VARCHAR, document_id VARCHAR, name VARCHAR, document_type VARCHAR, "
                    "content_hash VARCHAR, source_hash VARCHAR, valid_from TIMESTAMPTZ, valid_to TIMESTAMPTZ, is_current BOOLEAN",
    "fact_ai_run": "run_id VARCHAR, tenant_key VARCHAR, project_id VARCHAR, pipeline_version VARCHAR, provider VARCHAR, model_version VARCHAR, "
                   "prompt_version VARCHAR, date_key INTEGER, documents INTEGER, fields INTEGER, status VARCHAR, latency_ms DOUBLE, measurement_mode VARCHAR, created_at TIMESTAMPTZ",
    "fact_document_extraction": "run_id VARCHAR, tenant_key VARCHAR, project_id VARCHAR, document_id VARCHAR, document_key VARCHAR, source_hash VARCHAR, "
                                "document_type VARCHAR, provider VARCHAR, model_version VARCHAR, pages INTEGER, regions INTEGER, tables INTEGER, fields INTEGER, "
                                "review_status VARCHAR, mean_confidence DOUBLE, instruction_pages INTEGER, measurement_mode VARCHAR, created_at TIMESTAMPTZ",
    "fact_field_observation": "observation_id VARCHAR, run_id VARCHAR, tenant_key VARCHAR, project_id VARCHAR, document_id VARCHAR, source_hash VARCHAR, "
                              "page_number INTEGER, bounding_box VARCHAR, bbox_source VARCHAR, region_text VARCHAR, field_key VARCHAR, provider VARCHAR, "
                              "model_version VARCHAR, prompt_version VARCHAR, raw_value VARCHAR, normalized_value VARCHAR, reviewed_value VARCHAR, "
                              "review_status VARCHAR, quality VARCHAR, confidence DOUBLE, latency_ms DOUBLE, token_count INTEGER, estimated_cost DOUBLE, "
                              "measurement_mode VARCHAR, created_at TIMESTAMPTZ",
    "fact_human_correction": "correction_id VARCHAR, run_id VARCHAR, tenant_key VARCHAR, project_id VARCHAR, document_id VARCHAR, source_hash VARCHAR, "
                             "page_number INTEGER, region_id VARCHAR, provider VARCHAR, model_version VARCHAR, original_text VARCHAR, corrected_text VARCHAR, "
                             "reason VARCHAR, evaluation_case_id VARCHAR, measurement_mode VARCHAR, created_at TIMESTAMPTZ",
    "fact_retrieval_evaluation": "run_id VARCHAR, tenant_key VARCHAR, project_id VARCHAR, case_id VARCHAR, retriever VARCHAR, k INTEGER, expected_document VARCHAR, "
                                 "expected_page INTEGER, rank INTEGER, hit_at_k BOOLEAN, reciprocal_rank DOUBLE, recall_at_k DOUBLE, expected_abstain BOOLEAN, "
                                 "abstained BOOLEAN, passed BOOLEAN, measurement_mode VARCHAR",
    "fact_citation_evaluation": "run_id VARCHAR, tenant_key VARCHAR, project_id VARCHAR, case_id VARCHAR, expected_value VARCHAR, expected_document VARCHAR, "
                                "expected_page INTEGER, found_document VARCHAR, found_page INTEGER, bounding_box VARCHAR, document_match BOOLEAN, page_match BOOLEAN, "
                                "bbox_match BOOLEAN, measurement_mode VARCHAR",
    "fact_pipeline_stage": "run_id VARCHAR, tenant_key VARCHAR, project_id VARCHAR, stage VARCHAR, stage_order INTEGER, latency_ms DOUBLE, rows_out INTEGER, "
                           "status VARCHAR, measurement_mode VARCHAR",
    "fact_ai_cost": "run_id VARCHAR, tenant_key VARCHAR, project_id VARCHAR, provider VARCHAR, model_version VARCHAR, documents INTEGER, token_count INTEGER, "
                    "estimated_cost DOUBLE, currency VARCHAR, pricing_source VARCHAR, measurement_mode VARCHAR",
    "dq_results": "run_id VARCHAR, tenant_key VARCHAR, project_id VARCHAR, check_name VARCHAR, passed BOOLEAN, detail VARCHAR",
    "lineage_edges": "run_id VARCHAR, tenant_key VARCHAR, project_id VARCHAR, source_table VARCHAR, target_table VARCHAR, rows_in INTEGER, rows_out INTEGER",
}
FACTS = [name for name in TABLES if name.startswith(("fact_", "dq_", "lineage_"))]
DIMENSIONS = [name for name in TABLES if name.startswith("dim_")]

# Mirrors labs/ai103/contractor_lab/guard.py and the Java EvidenceGuard (same probe sentences in the tests).
_START, _END, _WORD = r"(?<![^\W_])", r"(?![^\W_])", r"\w"
AUTOMATED_APPROVAL = re.compile(
    rf"(?iu)(?:{_START}automatisch{_WORD}*{_END}.{{0,40}}{_START}(?:freigeben|genehmigen|bezahlen|überweisen|anweisen)"
    rf"|{_START}(?:ki|ai|assistent{_WORD}*|assistant|llm|copilot|nova|chatbot|(?:ki|ai)[- ]agent{_WORD}*|sprachmodell|language model){_END}.{{0,120}}"
    rf"{_START}(?:freigeben|genehmigen|approve|release (?:the )?payment|mark (?:it|this|the invoice) as (?:approved|reviewed|verified)|send .{{0,30}}(?:e-?mail|confirmation)|e-?mail .{{0,60}}senden)"
    rf"|{_START}auto(?:matically)?[- ]approve|{_START}approve{_END}.{{0,40}}{_START}(?:automatically|without (?:human )?review)"
    r"|(?:tự động|hãy|vui lòng)\s.{0,40}(?:phê duyệt|duyệt thanh toán|duyệt hóa đơn|chuyển khoản|gửi email)"
    rf"|(?:{_START}ai{_END}|trợ lý).{{0,80}}(?:phê duyệt|duyệt|chuyển khoản|gửi email))")
TOKEN = re.compile(r"[\w\-]+", re.UNICODE)


def instruction_lines(text):
    return [line for line in (text or "").splitlines() if AUTOMATED_APPROVAL.search(re.sub(r"\s+", " ", line).strip())]


def identifier(*parts):
    return hashlib.sha256(json.dumps(parts, ensure_ascii=False, default=str).encode()).hexdigest()[:24]


def partition(payload):
    """Tenant key and project for every row. The scope hash is already tenant- and case-bound; we keep a short,
    pseudonymous prefix as the tenant key and the case id as the project."""
    return payload["scope"][:16], str(payload.get("caseId") or payload["scope"][16:32])


def date_key(value):
    moment = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return int(moment.strftime("%Y%m%d")), moment.date()


def provider_kind(provider):
    value = (provider or "").lower()
    if value.startswith("azure"):
        return "azure"
    if value in {"fixture", "synthetic-fixture", "datev-reference-values"} or value == "simulated-fixture":
        return "fixture"
    return "local"


def money_text(value):
    """Canonical text of a normalized amount so different spellings compare equal (48.780,00 EUR -> 48780.00)."""
    return None if value is None else format(Decimal(value).quantize(Decimal("0.01")), "f")


def locate(regions, value):
    """The region on the field's page whose text contains the value; coordinates are normalized, top-left."""
    needle = re.sub(r"\s+", " ", value or "").strip()
    if not needle:
        return None
    for region in regions:
        if needle in re.sub(r"\s+", " ", region.get("text") or ""):
            return region
    return None


def bbox(region):
    if not region:
        return None
    return json.dumps([round(region.get(key, 0.0), 4) for key in ("left", "top", "right", "bottom")])


def tokens(text):
    return [token.lower() for token in TOKEN.findall(text or "") if len(token) > 2]


def bm25(pages, query, k1=1.2, b=0.75):
    documents = [Counter(tokens(page["text"])) for page in pages]
    lengths = [sum(counts.values()) for counts in documents]
    average = sum(lengths) / max(1, len(lengths))
    scored = []
    for page, counts, length in zip(pages, documents, lengths):
        score = 0.0
        for term in set(tokens(query)):
            frequency = counts.get(term, 0)
            if not frequency:
                continue
            containing = sum(1 for other in documents if other.get(term))
            idf = math.log(1 + (len(documents) - containing + 0.5) / (containing + 0.5))
            score += idf * frequency * (k1 + 1) / (frequency + k1 * (1 - b + b * length / average))
        scored.append((score, page))
    return [page for score, page in sorted(scored, key=lambda item: item[0], reverse=True) if score > 0]


def load_cases():
    return json.loads(EVALUATION_CASES.read_text(encoding="utf-8")) if EVALUATION_CASES.is_file() else {"retrieval": [], "citations": []}


def evaluate(payload, tenant, project, run_id, cases):
    """Retrieval and citation checks on this run's extracted text. A case runs only when its documents are present."""
    names = {doc["name"] for doc in payload["documents"]}
    pages = [{"document": doc["name"], "page": page["number"], "text": page.get("text") or "", "regions": page.get("regions") or []}
             for doc in payload["documents"] for page in doc["pages"]]
    retrieval, citations = [], []
    for case in cases.get("retrieval", []):
        if not set(case.get("requires", [])).issubset(names):
            continue
        k = int(case.get("k", 5))
        ranked = bm25(pages, case["query"])[:k]
        expected = case.get("expected")
        if expected is None:
            confirmed = [page for page in ranked if re.search(case["confirmationPattern"], page["text"], re.IGNORECASE)]
            abstained = not confirmed
            retrieval.append([run_id, tenant, project, case["id"], "etl-bm25-extracted-text", k, None, None, None, None, None, None,
                              True, abstained, abstained, "deterministic"])
            continue
        rank = next((index + 1 for index, page in enumerate(ranked) if page["document"] == expected["document"] and page["page"] == expected["page"]), None)
        hit = rank is not None
        retrieval.append([run_id, tenant, project, case["id"], "etl-bm25-extracted-text", k, expected["document"], expected["page"], rank, hit,
                          (1.0 / rank) if rank else 0.0, 1.0 if hit else 0.0, False, False, hit, "deterministic"])
    for case in cases.get("citations", []):
        if case["document"] not in names:
            continue
        found = next(((page, region) for page in pages for region in page["regions"] if case["value"] in (region.get("text") or "")), None)
        if found is None:
            found = next(((page, None) for page in pages if case["value"] in page["text"]), (None, None))
        page, region = found
        citations.append([run_id, tenant, project, case["id"], case["value"], case["document"], case["page"],
                          page["document"] if page else None, page["page"] if page else None, bbox(region),
                          bool(page and page["document"] == case["document"]), bool(page and page["document"] == case["document"] and page["page"] == case["page"]),
                          bool(region and page["document"] == case["document"] and page["page"] == case["page"]), "deterministic"])
    return retrieval, citations


def project_rows(payload, field_rows, normalize_money, pipeline_version, run_seconds, stages):
    tenant, project = partition(payload)
    run_id, created = payload["id"], payload["time"]
    day, day_date = date_key(created)
    rows = {name: [] for name in TABLES}
    rows["dim_tenant"].append([tenant, "tenant " + tenant[:6]])
    rows["dim_project"].append([tenant, project, payload.get("domain", "general")])
    rows["dim_date"].append([day, day_date, day_date.year, day_date.month, day_date.day])
    rows["dim_prompt_version"].append(["none", "ETL extraction uses no prompt; Nova prompts are versioned in the credit API"])
    rows["dim_pipeline_version"].append([pipeline_version, f"{pipeline_version} with {SCHEMA_VERSION}"])
    fields_by_doc = Counter()
    observations = []
    flat_fields = [(doc, field) for doc in payload["documents"] for field in doc.get("fields", [])]
    for index, (row, (doc, field)) in enumerate(zip(field_rows, flat_fields, strict=True)):
        _, document_id, page_number, key, value, amount, currency, quality, reviewed = row
        page = next((p for p in doc["pages"] if p["number"] == page_number), {})
        raw = field.get("originalValue") or value
        region = locate(page.get("regions") or [], value) or locate(page.get("regions") or [], raw)
        source = "provider-region-value-match" if region else None
        normalized = money_text(amount) if amount is not None else (re.sub(r"\s+", " ", value).strip() or None)
        if currency and normalized:
            normalized = f"{normalized} {currency}"
        status = "reviewed" if reviewed else "awaiting-review"
        observation_id = identifier(run_id, document_id, page_number, key, index, raw)
        confidence = field.get("confidence")
        observations.append([observation_id, run_id, tenant, project, document_id, doc.get("originalSha256") or "", page_number, bbox(region), source,
                             (region.get("text") or "")[:SNIPPET] if region else None, key, doc.get("analysisProvider") or "unknown",
                             doc.get("modelId") or "unknown", "none", raw, normalized, value if reviewed else None, status, quality,
                             float(confidence) / 100.0 if isinstance(confidence, (int, float)) else None, None, None, 0.0, "measured", created])
        fields_by_doc[document_id] += 1
    rows["fact_field_observation"] = observations
    providers = Counter()
    for doc in payload["documents"]:
        provider, model = doc.get("analysisProvider") or "unknown", doc.get("modelId") or "unknown"
        providers[(provider, model)] += 1
        rows["dim_provider"].append([provider, provider_kind(provider)])
        rows["dim_model"].append([identifier(provider, model), provider, model])
        rows["dim_document_type"].append([doc.get("type") or "unknown"])
        confidences = [f["confidence"] for f in doc.get("fields", []) if isinstance(f.get("confidence"), (int, float))]
        instruction_pages = sum(1 for page in doc["pages"] if instruction_lines(page.get("text")))
        rows["fact_document_extraction"].append([run_id, tenant, project, doc["id"], None, doc.get("originalSha256") or "", doc.get("type") or "unknown",
                                                 provider, model, len(doc["pages"]), sum(len(p.get("regions") or []) for p in doc["pages"]),
                                                 len(doc.get("tables", [])), fields_by_doc[doc["id"]], "reviewed" if doc.get("status") == "verified" else "awaiting-review",
                                                 (sum(confidences) / len(confidences) / 100.0) if confidences else None, instruction_pages, "measured", created])
        for correction in doc.get("ocrCorrections", []) or []:
            case_id = identifier("eval", doc.get("originalSha256"), correction.get("page"), correction.get("sourceId"), correction.get("correctedText"))
            rows["fact_human_correction"].append([identifier(run_id, correction.get("id")), run_id, tenant, project, doc["id"], doc.get("originalSha256") or "",
                                                  correction.get("page"), correction.get("sourceId"), provider, model, correction.get("originalText"),
                                                  correction.get("correctedText"), correction.get("reason"), case_id, "measured", correction.get("time") or created])
    for (provider, model), documents in providers.items():
        provider_fields = sum(1 for o in observations if o[11] == provider and o[12] == model)
        rows["fact_ai_run"].append([run_id, tenant, project, pipeline_version, provider, model, "none", day, documents, provider_fields, "COMPLETE",
                                    round(run_seconds * 1000, 3), "measured", created])
        rows["fact_ai_cost"].append([run_id, tenant, project, provider, model, documents, None, 0.0, "EUR",
                                     "Azure price list not applied" if provider_kind(provider) == "azure" else "local engine: no per-token fee",
                                     "configured"])
    for order, (stage, latency, produced) in enumerate(stages, start=1):
        rows["fact_pipeline_stage"].append([run_id, tenant, project, stage, order, round(latency * 1000, 3), produced, "COMPLETE", "measured"])
    rows["fact_retrieval_evaluation"], rows["fact_citation_evaluation"] = evaluate(payload, tenant, project, run_id, load_cases())
    return rows, tenant, project


def simulated_ocr_rows(payload, fixture, tenant, project):
    """One OCR observation from a fixture (48.730,00 read for 48.780,00) and the reviewer's correction. Marked simulated."""
    run_id, created = payload["id"], payload["time"]
    expected, observed = fixture["expectedMismatch"]["source"], fixture["expectedMismatch"]["ocr"]
    document = next((doc for doc in payload["documents"] if doc["name"] == fixture["source"]["documentName"]), None)
    document_id = document["id"] if document else fixture["source"]["documentName"]
    sha = (document or {}).get("originalSha256") or ""
    page = fixture["source"]["page"]
    observation_id = identifier(run_id, "simulated-ocr", document_id, page, observed)
    case_id = identifier("eval", sha or document_id, page, "simulated-ocr", expected)
    raw_amount = Decimal(observed.replace(".", "").replace(",", "."))
    observation = [observation_id, run_id, tenant, project, document_id, sha, page, None, None, None, "approvedTotal", "simulated-fixture",
                   "ocr-misread.sample", "none", observed, money_text(raw_amount) + " EUR", expected, "corrected", "OCR_DISAGREES_WITH_REFERENCE",
                   None, None, None, 0.0, "simulated", created]
    correction = [identifier(run_id, "simulated-correction", observation_id), run_id, tenant, project, document_id, sha, page, None,
                  "simulated-fixture", "ocr-misread.sample", observed, expected, "Reviewer compared the OCR value with the original page",
                  case_id, "simulated", created]
    evaluation_case = {"caseId": case_id, "input": {"documentSha256": sha or None, "documentName": fixture["source"]["documentName"], "page": page},
                       "field": "approvedTotal", "expected": expected, "observedBy": {"provider": "simulated-fixture", "value": observed},
                       "measurementMode": "simulated", "reuse": "Run any provider on the same input page and compare its value with `expected`."}
    return observation, correction, evaluation_case


def column_index(table, column):
    return [part.split()[0] for part in TABLES[table].split(", ")].index(column)


def canonical(value):
    amount = money_text_safe(value)
    return amount if amount is not None else re.sub(r"\s+", " ", (value or "")).strip().lower()


def quality_checks(rows, tenant, project, run_id):
    observations = rows["fact_field_observation"]
    partitioned = all(row[column_index(name, "tenant_key")] == tenant and row[column_index(name, "project_id")] == project
                      for name in FACTS if name not in {"dq_results", "lineage_edges"} for row in rows[name])
    checks = [
        ("every fact row carries tenant and project", partitioned, ""),
        ("observation ids are unique", len({r[0] for r in observations}) == len(observations), f"{len(observations)} observations"),
        ("reviewed value only on reviewed rows", all((r[16] is None) == (r[17] == "awaiting-review") for r in observations), ""),
        ("raw value kept on every observation", all(r[14] not in (None, "") for r in observations), ""),
        ("page numbers are positive", all(isinstance(r[6], int) and r[6] >= 1 for r in observations), ""),
        ("no full page text in the mart", all(r[9] is None or len(r[9]) <= SNIPPET for r in observations), f"snippet <= {SNIPPET} characters"),
        ("measurement mode is set", all(r[23] in {"measured", "simulated"} for r in observations), ""),
    ]
    return [[run_id, tenant, project, name, bool(passed), detail] for name, passed, detail in checks]


def write_tables(db, rows, run_id, tenant, project):
    """Idempotent: this run's fact rows are replaced; dimension rows are upserted by their natural key."""
    for name, columns in TABLES.items():
        db.execute(f"CREATE TABLE IF NOT EXISTS {name}({columns})")
    for name in FACTS:
        db.execute(f"DELETE FROM {name} WHERE run_id=? AND tenant_key=? AND project_id=?", [run_id, tenant, project])
        if rows[name]:
            db.executemany(f"INSERT INTO {name} VALUES({','.join('?' for _ in rows[name][0])})", rows[name])
    keys = {"dim_tenant": [0], "dim_project": [0, 1], "dim_date": [0], "dim_provider": [0], "dim_model": [0], "dim_prompt_version": [0],
            "dim_pipeline_version": [0], "dim_document_type": [0]}
    for name, positions in keys.items():
        columns = [part.split()[0] for part in TABLES[name].split(", ")]
        for row in {tuple(row[i] for i in positions): row for row in rows[name]}.values():
            condition = " AND ".join(f"{columns[i]}=?" for i in positions)
            db.execute(f"DELETE FROM {name} WHERE {condition}", [row[i] for i in positions])
            db.execute(f"INSERT INTO {name} VALUES({','.join('?' for _ in row)})", row)
    # SCD Type 2 document dimension, derived from the worker's document_versions history (one row per content version).
    db.execute("DELETE FROM dim_document WHERE tenant_key=? AND project_id=?", [tenant, project])
    db.execute("""INSERT INTO dim_document
        SELECT substr(sha256(v.document_id || ':' || v.content_hash), 1, 24), ?, ?, v.document_id,
               coalesce(json_extract_string(b.raw_json, '$.name'), v.document_id), coalesce(json_extract_string(b.raw_json, '$.type'), 'unknown'),
               v.content_hash, v.source_hash, v.valid_from, v.valid_to, v.is_current
        FROM document_versions v
        LEFT JOIN (SELECT document_id, content_hash, any_value(raw_json) raw_json FROM bronze_documents GROUP BY document_id, content_hash) b
          ON b.document_id = v.document_id AND b.content_hash = v.content_hash""", [tenant, project])
    db.execute("""UPDATE fact_document_extraction f SET document_key = d.document_key FROM dim_document d
        WHERE d.document_id = f.document_id AND d.is_current AND f.run_id = ? AND f.tenant_key = d.tenant_key AND f.project_id = d.project_id""", [run_id])


def lineage(db, run_id, tenant, project, field_rows, rows):
    bronze = db.execute("SELECT count(*) FROM bronze_documents WHERE run_id=?", [run_id]).fetchone()[0]
    silver = db.execute("SELECT count(*) FROM silver_fields WHERE run_id=?", [run_id]).fetchone()[0]
    gold = db.execute("SELECT count(*) FROM silver_fields WHERE run_id=? AND reviewed AND quality='VALID' AND amount IS NOT NULL", [run_id]).fetchone()[0]
    edges = [["bronze_documents", "silver_fields", bronze, silver], ["silver_fields", "gold_currency_totals", silver, gold],
             ["silver_fields", "fact_field_observation", silver, len(rows["fact_field_observation"])],
             ["bronze_documents", "fact_document_extraction", bronze, len(rows["fact_document_extraction"])],
             ["bronze_documents", "fact_retrieval_evaluation", bronze, len(rows["fact_retrieval_evaluation"])]]
    db.execute("DELETE FROM lineage_edges WHERE run_id=? AND tenant_key=? AND project_id=?", [run_id, tenant, project])
    db.executemany("INSERT INTO lineage_edges VALUES(?,?,?,?,?,?,?)", [[run_id, tenant, project, *edge] for edge in edges])
    return {"bronze": bronze, "silver": silver, "reviewedGold": gold, "edges": [{"from": e[0], "to": e[1], "rowsIn": e[2], "rowsOut": e[3]} for e in edges]}


def export(db, folder, tenant, project):
    """CSV and Parquet per table, filtered to this tenant and project, plus the relationship and measure specification."""
    target = folder / "powerbi"
    target.mkdir(parents=True, exist_ok=True)
    files = []
    for name in TABLES:
        has_partition = "tenant_key" in TABLES[name]
        query = f"SELECT * FROM {name}" + (" WHERE tenant_key=?" + (" AND project_id=?" if "project_id" in TABLES[name] else "") if has_partition else "")
        params = ([tenant, project] if "project_id" in TABLES[name] else [tenant]) if has_partition else []
        relation = db.execute(query, params)
        header = [column[0] for column in relation.description]
        data = relation.fetchall()
        with (target / f"{name}.csv").open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(header)
            writer.writerows(data)
        destination = str(target / f"{name}.parquet").replace("'", "''")
        db.execute(f"COPY ({query}) TO '{destination}' (FORMAT PARQUET)", params)
        files.append({"table": name, "rows": len(data), "csv": f"powerbi/{name}.csv", "parquet": f"powerbi/{name}.parquet"})
    for spec in ("relationships.json", "measures.json"):
        if (SPEC / spec).is_file():
            shutil.copyfile(SPEC / spec, target / spec)
    return files


def ratio(numerator, denominator):
    return None if not denominator else round(numerator / denominator, 4)


def summary(db, payload, run_id, tenant, project, rows, lineage_info, files, evaluation_cases):
    observations = [r for r in rows["fact_field_observation"]]
    measured = [r for r in observations if r[23] == "measured"]
    simulated = [r for r in observations if r[23] == "simulated"]
    reviewed = [r for r in measured if r[17] != "awaiting-review"]
    corrections = rows["fact_human_correction"]
    measured_corrections = [r for r in corrections if r[14] == "measured"]
    retrieval = [r for r in rows["fact_retrieval_evaluation"] if not r[12]]
    abstain = [r for r in rows["fact_retrieval_evaluation"] if r[12]]
    citations = rows["fact_citation_evaluation"]
    extraction = rows["fact_document_extraction"]
    instruction_pages = [(doc["id"], page["number"]) for doc in payload["documents"] for page in doc["pages"] if instruction_lines(page.get("text"))]
    flagged = set(instruction_pages)
    on_instruction_pages = [row[1] for row in db.execute("SELECT document_id, quality, page FROM silver_fields WHERE run_id=?", [run_id]).fetchall()
                            if (row[0], row[2]) in flagged]
    blocked = (len(on_instruction_pages), sum(1 for quality in on_instruction_pages if quality == "UNTRUSTED_INSTRUCTION_PAGE"))
    disagreement_measured = [r for r in reviewed if r[16] is not None and canonical(r[16]) != canonical(r[14])]

    def kpi(key, value, mode, unit="ratio", detail=""):
        return {"key": key, "value": value, "mode": mode, "unit": unit, "detail": detail}

    kpis = [
        kpi("success_rate", ratio(sum(1 for r in rows["fact_ai_run"] if r[10] == "COMPLETE"), len(rows["fact_ai_run"])), "measured"),
        kpi("average_stage_latency_ms", round(sum(r[5] for r in rows["fact_pipeline_stage"]) / max(1, len(rows["fact_pipeline_stage"])), 3), "measured", "ms",
            "ETL stages only; ClamAV and OCR time are measured upstream"),
        kpi("human_correction_rate", ratio(len(measured_corrections), len(measured)), "measured", detail=f"{len(measured_corrections)} corrections, {len(measured)} observations"),
        kpi("ocr_disagreement_rate", ratio(len(disagreement_measured), len(reviewed)), "measured" if reviewed else "not-run",
            detail=f"{len(reviewed)} reviewed observations" if reviewed else "no reviewed observation in this run"),
        kpi("citation_document_accuracy", ratio(sum(r[10] for r in citations), len(citations)), "deterministic" if citations else "not-run"),
        kpi("citation_page_accuracy", ratio(sum(r[11] for r in citations), len(citations)), "deterministic" if citations else "not-run"),
        kpi("citation_bbox_accuracy", ratio(sum(r[12] for r in citations), len(citations)), "deterministic" if citations else "not-run"),
        kpi("hit_at_k", ratio(sum(1 for r in retrieval if r[9]), len(retrieval)), "deterministic" if retrieval else "not-run", detail="k=5, BM25 over extracted text"),
        kpi("recall_at_k", ratio(sum(r[11] for r in retrieval), len(retrieval)), "deterministic" if retrieval else "not-run"),
        kpi("mrr", ratio(sum(r[10] for r in retrieval), len(retrieval)), "deterministic" if retrieval else "not-run"),
        kpi("abstention_correct_rate", ratio(sum(1 for r in abstain if r[14]), len(abstain)), "deterministic" if abstain else "not-run",
            detail="questions without evidence must stay unanswered"),
        kpi("estimated_cost_per_document_eur", round(sum(r[7] for r in rows["fact_ai_cost"]) / max(1, len(extraction)), 4), "configured", "EUR",
            "local engines carry no per-token fee"),
        kpi("prompt_injection_blocked_rate", ratio(blocked[1], blocked[0]) if blocked[0] else None, "deterministic" if blocked[0] else "not-run",
            detail="share of fields on instruction pages kept out of reviewed Gold"),
    ]
    simulated_kpis = []
    if simulated:
        simulated_kpis.append(kpi("ocr_disagreement_rate", ratio(sum(1 for r in simulated if r[18] == "OCR_DISAGREES_WITH_REFERENCE"), len(simulated)),
                                  "simulated", detail="fixture ocr-misread.sample.json; not a production metric"))
    drill = sorted(observations, key=lambda r: (r[23] != "simulated", r[4], r[6], r[10]))[:DRILL_LIMIT]
    names = {doc["id"]: doc["name"] for doc in payload["documents"]}
    models = {}
    for r in measured:
        entry = models.setdefault((r[11], r[12]), {"provider": r[11], "model": r[12], "observations": 0, "valid": 0, "reviewed": 0})
        entry["observations"] += 1
        entry["valid"] += r[18] == "VALID"
        entry["reviewed"] += r[17] != "awaiting-review"
    return {
        "schemaVersion": SCHEMA_VERSION,
        "partition": {"tenantKey": tenant, "projectId": project},
        "rowCounts": {**{"bronze": lineage_info["bronze"], "silver": lineage_info["silver"], "reviewedGold": lineage_info["reviewedGold"]},
                      **{name: len(rows[name]) for name in TABLES if name.startswith("fact_")}},
        "lineage": lineage_info["edges"],
        "dataQuality": [{"check": r[3], "passed": r[4], "detail": r[5]} for r in rows["dq_results"]],
        "kpis": kpis,
        "simulatedKpis": simulated_kpis,
        "stages": [{"stage": r[3], "latencyMs": r[5], "rows": r[6], "mode": r[8]} for r in rows["fact_pipeline_stage"]],
        "retrieval": [{"case": r[3], "retriever": r[4], "k": r[5], "expected": r[6] and f"{r[6]} p. {r[7]}", "rank": r[8], "passed": r[14],
                       "expectedAbstain": r[12], "abstained": r[13], "mode": r[15]} for r in rows["fact_retrieval_evaluation"]],
        "citations": [{"case": r[3], "value": r[4], "expected": f"{r[5]} p. {r[6]}", "found": r[7] and f"{r[7]} p. {r[8]}", "boundingBox": r[9],
                       "documentMatch": r[10], "pageMatch": r[11], "bboxMatch": r[12], "mode": r[13]} for r in citations],
        "models": list(models.values()),
        "cost": [{"provider": r[3], "model": r[4], "documents": r[5], "estimatedCost": r[7], "currency": r[8], "pricing": r[9], "mode": r[10]} for r in rows["fact_ai_cost"]],
        "drill": [{"observationId": r[0], "documentId": r[4], "documentName": names.get(r[4], r[4]), "page": r[6], "boundingBox": r[7], "bboxSource": r[8], "ocrText": r[9], "field": r[10],
                   "provider": r[11], "model": r[12], "rawValue": r[14], "normalizedValue": r[15], "reviewedValue": r[16], "reviewStatus": r[17],
                   "quality": r[18], "mode": r[23]} for r in drill],
        "corrections": len(corrections),
        "evaluationCases": evaluation_cases,
        "export": files,
        "limitations": [
            "Retrieval is checked with BM25 over the extracted page text inside the ETL, not with the Qdrant hybrid of the credit API.",
            "Upstream stages (ClamAV, OCR, indexing, Nova) are timed by the credit API, not by this mart.",
            "Local cost is a configured 0 EUR; no token counts are reported by the local extraction.",
        ],
    }


def money_text_safe(value):
    try:
        cleaned = re.sub(r"[^\d,.\-]", "", value or "")
        if re.fullmatch(r"-?\d{1,3}(?:\.\d{3})*,\d{2}", cleaned):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        elif re.fullmatch(r"-?\d{1,3}(?:,\d{3})*\.\d{2}", cleaned):
            cleaned = cleaned.replace(",", "")
        return money_text(Decimal(cleaned))
    except Exception:
        return None


def build(db, folder, payload, field_rows, normalize_money, pipeline_version, run_seconds, stages, simulate_ocr=None):
    """Write the star schema for this run, run the quality checks and lineage, export, and return the summary."""
    rows, tenant, project = project_rows(payload, field_rows, normalize_money, pipeline_version, run_seconds, stages)
    evaluation_cases = []
    for correction in rows["fact_human_correction"]:
        evaluation_cases.append({"caseId": correction[13], "input": {"documentSha256": correction[5] or None, "page": correction[6], "regionId": correction[7]},
                                 "expected": correction[11], "observedBy": {"provider": correction[8], "model": correction[9], "value": correction[10]},
                                 "measurementMode": correction[14], "reuse": "Run any provider on the same input and compare with `expected`."})
    if simulate_ocr:
        observation, correction, case = simulated_ocr_rows(payload, simulate_ocr, tenant, project)
        rows["fact_field_observation"].append(observation)
        rows["fact_human_correction"].append(correction)
        evaluation_cases.append(case)
    rows["dq_results"] = quality_checks(rows, tenant, project, payload["id"])
    write_tables(db, rows, payload["id"], tenant, project)
    lineage_info = lineage(db, payload["id"], tenant, project, field_rows, rows)
    files = export(db, folder, tenant, project)
    (folder / "powerbi" / "evaluation_cases.jsonl").write_text("".join(json.dumps(case, ensure_ascii=False) + "\n" for case in evaluation_cases), encoding="utf-8")
    result = summary(db, payload, payload["id"], tenant, project, rows, lineage_info, files, evaluation_cases)
    if not all(check["passed"] for check in result["dataQuality"]):
        raise ValueError("CONTROL_TOWER_QUALITY_FAILED")
    return result


def rebuild(run_folder, simulate_fixture=None):
    """Re-run the marts for an existing ETL run from its stored Bronze snapshot, optionally with the simulated OCR fixture."""
    import duckdb
    import worker

    run_folder = Path(run_folder)
    database = run_folder.parent / "history.duckdb"
    db = duckdb.connect(str(database), config={"memory_limit": "128MB", "threads": "1"})
    try:
        run_id = run_folder.name
        documents = [json.loads(row[0]) for row in db.execute("SELECT raw_json FROM bronze_documents WHERE run_id=? ORDER BY rowid", [run_id]).fetchall()]
        if not documents:
            raise ValueError("RUN_NOT_FOUND")
        manifest = json.loads((run_folder / "manifest.json").read_text())
        payload = {"id": run_id, "scope": manifest["scope"], "sourceHash": manifest["sourceHash"], "documents": documents,
                   "caseId": manifest.get("controlTower", {}).get("partition", {}).get("projectId"),
                   "time": manifest.get("time") or datetime.now(timezone.utc).isoformat(), "domain": manifest.get("domain", "general")}
        field_rows = db.execute("SELECT * FROM silver_fields WHERE run_id=? ORDER BY rowid", [run_id]).fetchall()
        stages = [(r[0], r[1] / 1000.0, r[2]) for r in db.execute(
            "SELECT stage, latency_ms, rows_out FROM fact_pipeline_stage WHERE run_id=? ORDER BY stage_order", [run_id]).fetchall()]
        fixture = json.loads(Path(simulate_fixture).read_text(encoding="utf-8")) if simulate_fixture else None
        result = build(db, run_folder, payload, field_rows, worker.normalize_money, worker.VERSION, 0.0, stages, simulate_ocr=fixture)
        manifest["controlTower"] = result
        worker.atomic_json(run_folder / "manifest.json", manifest)
        return result
    finally:
        db.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Rebuild the Control Tower marts of an existing ETL run.")
    parser.add_argument("run_folder")
    parser.add_argument("--simulate-ocr", help="fixture with an OCR value that disagrees with the reference (marked simulated)")
    arguments = parser.parse_args()
    built = rebuild(arguments.run_folder, arguments.simulate_ocr)
    print(json.dumps({"rowCounts": built["rowCounts"], "dataQuality": all(c["passed"] for c in built["dataQuality"]), "files": len(built["export"])}))
