"""Private, single-writer document ETL. No model, network, public bucket or source-PDF copy."""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import time
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

import duckdb

VERSION = "document-medallion-v2"
MONEY_FIELDS = {"invoiceTotal", "netIncome", "payoutAmount", "premium", "deductible"}


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def normalize_money(raw, context):
    """Fail closed on ambiguous separators/currencies; preserve original alongside normalization."""
    aliases = {"€": "EUR", "₹": "INR", "£": "GBP"}
    currencies = set(re.findall(r"\b(?:EUR|INR|USD|GBP)\b", raw + " " + context))
    currencies.update(code for symbol, code in aliases.items() if symbol in raw + " " + context)
    if len(currencies) != 1:
        return None, None, "CURRENCY_UNKNOWN_OR_AMBIGUOUS"
    value = re.sub(r"EUR|INR|USD|GBP|[€₹£\s]", "", raw).strip()
    if re.fullmatch(r"-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{2}", value):
        value = value.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"-?\d{1,3}(?:,\d{3})+\.\d{2}", value):
        value = value.replace(",", "")
    elif not re.fullmatch(r"-?\d+(?:\.\d{2})?", value):
        return None, next(iter(currencies)), "AMOUNT_FORMAT_AMBIGUOUS"
    try:
        amount = Decimal(value)
        if abs(amount) >= Decimal("1e15"):
            raise InvalidOperation()
        return amount, next(iter(currencies)), "VALID"
    except InvalidOperation:
        return None, next(iter(currencies)), "AMOUNT_OUT_OF_RANGE"


def validate(payload):
    if payload.get("format") != "document-etl-v1" or not re.fullmatch(r"etl-[a-f0-9-]{36}", payload.get("id", "")):
        raise ValueError("INVALID_CONTRACT")
    if not re.fullmatch(r"[a-f0-9]{64}", payload.get("scope", "")) or not re.fullmatch(r"[a-f0-9]{64}", payload.get("sourceHash", "")):
        raise ValueError("INVALID_SCOPE")
    docs = payload.get("documents", [])
    if not 1 <= len(docs) <= 40 or len({d["id"] for d in docs}) != len(docs):
        raise ValueError("INVALID_DOCUMENTS")
    for doc in docs:
        pages = doc.get("pages", [])
        if not doc.get("originalAvailable") or not pages or len(pages) > 40:
            raise ValueError("ORIGINAL_REQUIRED")
        if any(not isinstance(p.get("number"), int) or p["number"] < 1 for p in pages):
            raise ValueError("INVALID_PAGE")


def transform(payload, folder, use_dbt=True):
    validate(payload)
    folder.mkdir(parents=True, exist_ok=True)
    database = folder.parent / "history.duckdb"
    db = duckdb.connect(str(database), config={"memory_limit": "128MB", "threads": "1"})
    run_id, source_hash = payload["id"], payload["sourceHash"]
    db.execute("CREATE TABLE IF NOT EXISTS bronze_documents(run_id VARCHAR,document_id VARCHAR,content_hash VARCHAR,raw_json VARCHAR,PRIMARY KEY(run_id,document_id))")
    db.execute("CREATE TABLE IF NOT EXISTS silver_fields(run_id VARCHAR,document_id VARCHAR,page INTEGER,field_key VARCHAR,raw_value VARCHAR,amount DECIMAL(24,6),currency VARCHAR,quality VARCHAR,reviewed BOOLEAN)")
    db.execute("CREATE TABLE IF NOT EXISTS document_versions(document_id VARCHAR,content_hash VARCHAR,valid_from TIMESTAMPTZ,valid_to TIMESTAMPTZ,is_current BOOLEAN,source_hash VARCHAR)")
    db.execute("ALTER TABLE document_versions ALTER valid_from TYPE TIMESTAMPTZ USING CAST(valid_from AS TIMESTAMPTZ)")
    db.execute("ALTER TABLE document_versions ALTER valid_to TYPE TIMESTAMPTZ USING CAST(valid_to AS TIMESTAMPTZ)")
    db.execute("CREATE TABLE IF NOT EXISTS etl_runs(run_id VARCHAR PRIMARY KEY,source_hash VARCHAR,method VARCHAR)")
    old = db.execute("SELECT source_hash FROM etl_runs WHERE run_id=?", [run_id]).fetchone()
    if old:
        db.close()
        if old[0] != source_hash:
            raise ValueError("IDEMPOTENCY_CONFLICT")
        manifest = folder / "manifest.json"
        if manifest.is_file():
            return json.loads(manifest.read_text())
        raise ValueError("INCOMPLETE_PREVIOUS_RUN")
    # A previous attempt may have saved Bronze/Silver before a failed dbt step.
    # Remove only this exact run's derived rows; source PDFs and other versions are untouched.
    db.execute("DELETE FROM bronze_documents WHERE run_id=?", [run_id])
    db.execute("DELETE FROM silver_fields WHERE run_id=?", [run_id])
    issues, field_rows, documents = [], [], []
    db.execute("BEGIN TRANSACTION")
    try:
        for doc in payload["documents"]:
            content_hash = digest(doc)
            db.execute("INSERT INTO bronze_documents VALUES(?,?,?,?)", [run_id, doc["id"], content_hash, json.dumps(doc, ensure_ascii=False)])
            previous = db.execute("SELECT content_hash FROM document_versions WHERE document_id=? AND is_current", [doc["id"]]).fetchone()
            if not previous or previous[0] != content_hash:
                db.execute("UPDATE document_versions SET valid_to=?,is_current=false WHERE document_id=? AND is_current", [payload["time"], doc["id"]])
                db.execute("INSERT INTO document_versions VALUES(?,?,?,NULL,true,?)", [doc["id"], content_hash, payload["time"], source_hash])
            pages = {p["number"]: p["text"] for p in doc["pages"]}
            duplicate = Counter((f["page"], f["label"]) for f in doc.get("fields", []))
            before = len(issues)
            for field in doc.get("fields", []):
                amount, currency, quality = None, None, "VALID"
                page = field["page"]
                if page not in pages:
                    quality = "SOURCE_PAGE_MISSING"
                elif duplicate[(page, field["label"])] > 1:
                    quality = "DUPLICATE_FIELD"
                elif not field["value"].strip():
                    quality = "EMPTY_VALUE"
                elif field["label"] in MONEY_FIELDS:
                    amount, currency, quality = normalize_money(field["value"], pages[page])
                if quality != "VALID":
                    issues.append({"documentId": doc["id"], "page": page, "field": field["label"], "code": quality})
                field_rows.append([run_id, doc["id"], page, field["label"], field["value"], amount, currency, quality, doc["status"] == "verified"])
            # Date strings are observations, not a guessed locale conversion.
            for page, text in pages.items():
                if re.search(r"\b(?:0?[1-9]|1[0-2])/(?:0?[1-9]|1[0-2])/\d{4}\b", text):
                    issues.append({"documentId": doc["id"], "page": page, "field": "date", "code": "AMBIGUOUS_DATE_PRESERVED"})
            documents.append({"id": doc["id"], "name": doc["name"], "reviewed": doc["status"] == "verified", "fields": len(doc.get("fields", [])), "issues": len(issues) - before})
        if field_rows:
            db.executemany("INSERT INTO silver_fields VALUES(?,?,?,?,?,?,?,?,?)", field_rows)
        current_ids = [d["id"] for d in payload["documents"]]
        db.execute("UPDATE document_versions SET valid_to=?,is_current=false WHERE is_current AND document_id NOT IN (SELECT unnest(?))", [payload["time"], current_ids])
        db.execute("COMMIT")
    except Exception:
        db.execute("ROLLBACK")
        db.close()
        raise
    db.close()
    if use_dbt:
        profiles = folder / "profiles"
        profiles.mkdir(exist_ok=True)
        (profiles / "profiles.yml").write_text("document_etl:\n  target: local\n  outputs:\n    local:\n      type: duckdb\n      path: " + str(database) + "\n      threads: 1\n      settings:\n        memory_limit: 128MB\n")
        result = subprocess.run(["dbt", "build", "--project-dir", str(Path(__file__).parent / "dbt"), "--profiles-dir", str(profiles), "--target-path", str(folder / "dbt-target"), "--log-path", str(folder / "dbt-logs"), "--vars", json.dumps({"run_id": run_id})], capture_output=True, timeout=120, env={**os.environ, "DBT_SEND_ANONYMOUS_USAGE_STATS": "false"})
        if result.returncode:
            raise ValueError("DBT_CHECKS_FAILED")
    db = duckdb.connect(str(database), config={"memory_limit": "128MB", "threads": "1"})
    if not use_dbt:
        db.execute("CREATE OR REPLACE TABLE gold_currency_totals AS SELECT field_key,currency,count(*) observations,sum(amount) total FROM silver_fields WHERE run_id=? AND reviewed AND quality='VALID' AND amount IS NOT NULL AND currency IS NOT NULL GROUP BY field_key,currency", [run_id])
    totals = [{"field": row[0], "currency": row[1], "observations": row[2], "total": str(row[3])} for row in db.execute("SELECT * FROM gold_currency_totals ORDER BY field_key,currency").fetchall()]
    for name, query in {"bronze": "SELECT * FROM bronze_documents WHERE run_id=?", "silver": "SELECT * FROM silver_fields WHERE run_id=?", "gold": "SELECT * FROM gold_currency_totals"}.items():
        # Paths are generated from a validated UUID/scope, never supplied by a user/model.
        destination = str(folder / (name + ".parquet")).replace("'", "''")
        db.execute("COPY (" + query + ") TO '" + destination + "' (FORMAT PARQUET)", [] if name == "gold" else [run_id])
    history_count = db.execute("SELECT count(*) FROM document_versions").fetchone()[0]
    db.execute("INSERT INTO etl_runs VALUES(?,?,?)", [run_id, source_hash, VERSION])
    db.close()
    manifest = {"method": VERSION, "sourceHash": source_hash, "bronze": len(documents), "silver": len(field_rows), "gold": len(totals), "historyVersions": history_count,
                "qualityIssues": issues, "documents": documents, "totals": totals, "dbtVerified": use_dbt,
                "artifacts": [{"name": name + ".parquet", "sha256": hashlib.sha256((folder / (name + ".parquet")).read_bytes()).hexdigest()} for name in ("bronze", "silver", "gold")],
                "limitations": ["Gold requires explicit human verification, not AI confidence.", "Ambiguous dates remain unnormalized.", "Artifacts contain private document data; original PDF expiry does not delete exported analytics."]}
    atomic_json(folder / "manifest.json", manifest)
    return manifest


def atomic_json(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False))
    os.replace(temporary, path)


def work(root):
    root.mkdir(parents=True, exist_ok=True)
    while True:
        (root / "heartbeat").touch()
        for path in sorted((root / "queue").glob("*/*.input.json"), key=lambda p: p.stat().st_mtime)[:100]:
            result_path = path.with_name(path.name.replace(".input.json", ".result.json"))
            if result_path.exists() or path.is_symlink() or path.stat().st_size > 8_000_000:
                continue
            payload = {}
            try:
                payload = json.loads(path.read_text())
                validate(payload)
                if path.parent.name != payload["scope"] or path.name != payload["id"] + ".input.json":
                    raise ValueError("SCOPE_MISMATCH")
                folder = root / "assets" / payload["scope"] / payload["id"]
                result = transform(payload, folder)
                receipt = {"id": payload["id"], "sourceHash": payload["sourceHash"], "status": "COMPLETE", "result": result, "finishedAt": now()}
            except Exception:
                # Never emit PDF text, filesystem paths, dbt stdout or exception bodies.
                receipt = {"id": payload.get("id", ""), "sourceHash": payload.get("sourceHash", ""), "status": "FAILED", "finishedAt": now()}
            atomic_json(result_path, receipt)
            (root / "heartbeat").touch()
        time.sleep(2)


if __name__ == "__main__":
    work(Path(os.environ.get("ETL_ROOT", "/data")))
