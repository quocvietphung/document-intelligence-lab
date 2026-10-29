"""Source-bound analytical projections. These rules never approve extracted values."""
from __future__ import annotations

import hashlib
import json
import re
from decimal import Decimal

SCHEMA = "document-analytics-v1"
TABLES = {
    "document_facts": "document_id VARCHAR,name VARCHAR,document_type VARCHAR,provider VARCHAR,model VARCHAR,original_sha256 VARCHAR,reviewed BOOLEAN,pages INTEGER,fields INTEGER",
    "field_observations": "observation_id VARCHAR,document_id VARCHAR,page INTEGER,field_key VARCHAR,raw_value VARCHAR,original_value VARCHAR,amount DECIMAL(24,6),currency VARCHAR,quality VARCHAR,reviewed BOOLEAN",
    "invoice_lines": "document_id VARCHAR,page INTEGER,table_index INTEGER,row_index INTEGER,description VARCHAR,quantity_raw VARCHAR,unit_price_raw VARCHAR,gross_raw VARCHAR,gross_amount DECIMAL(24,6),currency VARCHAR",
    "quality_findings": "finding_id VARCHAR,document_id VARCHAR,page INTEGER,field_key VARCHAR,code VARCHAR,source_ids VARCHAR",
}


def identifier(*parts):
    return hashlib.sha256(json.dumps(parts, ensure_ascii=False).encode()).hexdigest()[:24]


def project(payload, field_rows, issues, normalize_money):
    facts, observations, lines, findings = [], [], [], []

    def finding(doc, page, field, code, sources=()):
        item = {"id": identifier(doc, page, field, code, sources), "documentId": doc, "page": page,
                "field": field, "code": code, "category": "quality", "sourceIds": list(sources)}
        if item["id"] not in {f["id"] for f in findings}:
            findings.append(item)

    for doc in payload["documents"]:
        facts.append([doc["id"], doc["name"], doc.get("type", "unknown"), doc.get("analysisProvider", "unknown"),
                      doc.get("modelId", "unknown"), doc.get("originalSha256", ""), doc["status"] == "verified",
                      len(doc["pages"]), len(doc.get("fields", []))])
    fields = [f for doc in payload["documents"] for f in doc.get("fields", [])]
    for index, (row, field) in enumerate(zip(field_rows, fields, strict=True)):
        _, doc, page, key, raw, amount, currency, quality, reviewed = row
        observation = identifier(doc, page, key, index, raw)
        observations.append([observation, doc, page, key, raw, field.get("originalValue", raw), amount, currency, quality, reviewed])
    for issue in issues:
        sources = [r[0] for r in observations if (r[1], r[2], r[3]) == (issue["documentId"], issue["page"], issue["field"])]
        finding(issue["documentId"], issue["page"], issue["field"], issue["code"], sources)
    seen = {}
    for doc in payload["documents"]:
        sha = doc.get("originalSha256", "")
        if re.fullmatch(r"[a-f0-9]{64}", sha):
            seen.setdefault(sha, []).append(doc["id"])
        if not doc.get("fields"):
            finding(doc["id"], doc["pages"][0]["number"], "document", "NO_STRUCTURED_FIELDS")
        if doc.get("type") != "invoice":
            continue
        for required in ("invoiceNumber", "invoiceTotal"):
            if not any(r[1] == doc["id"] and r[3] == required for r in observations):
                finding(doc["id"], doc["pages"][0]["number"], required, "REQUIRED_INVOICE_FIELD_MISSING")
        pages = {p["number"]: p["text"] for p in doc["pages"]}
        for ti, table in enumerate(doc.get("tables", [])):
            cells = table.get("cells", [])
            # Accept only uniquely observed column labels and unit-sized cells.
            roles = {"description": {"description", "itemdescription", "bezeichnung"}, "quantity": {"qty", "quantity", "menge"},
                     "unit": {"netprice", "unitprice", "einzelpreis"}, "gross": {"grossworth", "grossamount", "bruttobetrag"}}
            columns = {}
            for role, labels in roles.items():
                found = [c for c in cells if re.sub(r"[^a-z]", "", c["text"].lower()) in labels]
                if len(found) == 1:
                    columns[role] = found[0]
            if not {"description", "gross"}.issubset(columns):
                continue
            header_row = max(c["row"] for c in columns.values())
            for ri in sorted({c["row"] for c in cells if c["row"] > header_row}):
                selected = {}
                for role, header in columns.items():
                    values = [c for c in cells if c["row"] == ri and c["column"] == header["column"]]
                    if len(values) == 1 and values[0].get("rowSpan", 1) == 1 and values[0].get("columnSpan", 1) == 1:
                        selected[role] = values[0]["text"].strip()
                if not selected.get("description") or "gross" not in selected:
                    continue
                if re.sub(r"[^a-z]", "", selected["description"].lower()) in {"total", "grandtotal", "gesamt", "summe"}:
                    continue
                amount, currency, quality = normalize_money(selected["gross"], pages.get(table["page"], ""))
                lines.append([doc["id"], table["page"], ti, ri, selected["description"], selected.get("quantity", ""),
                              selected.get("unit", ""), selected["gross"], amount if quality == "VALID" else None, currency])
        doc_lines = [line for line in lines if line[0] == doc["id"]]
        totals = [r for r in observations if r[1] == doc["id"] and r[3] == "invoiceTotal" and r[8] == "VALID"]
        if doc_lines and len(totals) == 1 and all(line[8] is not None and line[9] == totals[0][7] for line in doc_lines):
            if abs(sum((line[8] for line in doc_lines), Decimal(0)) - totals[0][6]) > Decimal("0.01"):
                finding(doc["id"], totals[0][2], "invoiceTotal", "LINE_SUM_DIFFERS_FROM_RECORDED_TOTAL", [totals[0][0]])
    for ids in seen.values():
        if len(ids) > 1:
            for doc in ids:
                finding(doc, next(d["pages"][0]["number"] for d in payload["documents"] if d["id"] == doc), "document", "DUPLICATE_ORIGINAL_HASH")
    result = {"schemaVersion": SCHEMA, "sourceHash": payload["sourceHash"], "documents": len(facts),
              "fields": len(observations), "invoiceLines": len(lines), "findings": findings,
              "reviewedDocuments": sum(r[6] for r in facts), "statisticalStatus": "NOT_RUN",
              "limitations": ["Findings request inspection; they do not establish fraud or approve a document.",
                              "Table line sums need complete, correctly extracted rows and matching currencies."]}
    return {"document_facts": facts, "field_observations": observations, "invoice_lines": lines,
            "quality_findings": [[f["id"], f["documentId"], f["page"], f["field"], f["code"], json.dumps(f["sourceIds"])] for f in findings]}, result


def export(db, folder, payload, field_rows, issues, normalize_money):
    tables, result = project(payload, field_rows, issues, normalize_money)
    for name, columns in TABLES.items():
        db.execute(f"CREATE OR REPLACE TEMP TABLE {name}({columns})")
        if tables[name]:
            db.executemany(f"INSERT INTO {name} VALUES({','.join('?' for _ in tables[name][0])})", tables[name])
        destination = str(folder / (name + ".parquet")).replace("'", "''")
        db.execute(f"COPY {name} TO '{destination}' (FORMAT PARQUET)")
    return result
