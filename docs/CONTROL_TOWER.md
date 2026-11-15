# Data & AI Control Tower

One page (`/en/control-tower`, `/de/control-tower`, `/vi/control-tower`; menu entry **Data & AI Control Tower**) that reads a dossier's latest ETL run and shows four areas, one at a time:

1. **Pipeline Operations:** success rate, stage latency, Bronze → Silver → Gold lineage and the data-quality checks.
2. **Document Data Quality:** human correction rate, OCR disagreement rate and a drill-through from the KPI to the document, page, bounding box, OCR text, normalized value and reviewed value.
3. **RAG & Citation Quality:** Hit@K, Recall@K, MRR, correct abstention, citation document, page and bounding-box accuracy, and the prompt-injection blocked rate.
4. **AI Cost & Model Benchmark:** configured cost per document and the providers and models of the run.

**Which dossier opens:** the dossier list shows dossiers that already have Control Tower data first (from `GET /api/cases/control-tower-runs`, which returns only dossier ids, run ids and times for the caller's tenant). A link with `?case=` opens that dossier; without it, the page opens the dossier with the newest run. A dossier without a run explains what to do, links to **Processing & data → Data layers & exports** and offers up to three dossiers that already have data. An older API without the list endpoint still shows every dossier.

**Charts:** plain SVG and CSS drawn from the same marts, with no chart library, no Power BI login and no cloud call. Each number appears once: in a chart, a tile or a table. Pipeline: step latency with row counts, the Bronze → Silver → Gold row flow and the data-quality checks. Quality: the correction and OCR disagreement tiles, then the observations table. RAG: the ratio KPIs on a 0–100% scale, then the retrieval and citation case tables. Cost: the per-document cost, then configured cost and valid observations per model. Simulated values are never charted.

Badges separate **Measured**, **Simulated** and **Configured only**. Deterministic rules on the run's own text count as measured and name the rule. Simulated values appear in their own box and never in a KPI tile.

## Data flow

```
PDF or fixture → ClamAV → Docling (credit API) → ETL snapshot (document-etl-v1)
  → Bronze (bronze_documents, document_versions SCD2)
  → Silver (silver_fields: raw and normalized values, quality codes)
  → reviewed Gold (dbt: gold_currency_totals; only verified documents, VALID amounts)
  → Control Tower marts (control_tower.py: dim_*, fact_*, dq_results, lineage_edges)
  → manifest.controlTower → credit API /platform/etl → this page
  → powerbi/ export (CSV, Parquet, relationships, measures)
```

Everything runs in the existing ETL worker and its per-scope DuckDB file. There is no second ETL service, no new container and no cloud call.

## Rules

- **Idempotent:** a run id is bound to its source hash (`IDEMPOTENCY_CONFLICT` otherwise); rebuilding replaces only that run's fact rows; dimensions are upserted by natural key.
- **Partitioned:** every fact row carries `tenant_key` (pseudonymous prefix of the tenant- and case-bound scope) and `project_id` (the dossier); exports are filtered by both.
- **Reviewed Gold only:** an extracted value reaches Gold only when a person verified the document and the value is valid. Fields on a page that tells an AI to approve, pay or send are marked `UNTRUSTED_INSTRUCTION_PAGE` and never reach Gold.
- **Raw, normalized and reviewed stay apart:** `raw_value` is the provider's text, `normalized_value` the parsed amount with currency, `reviewed_value` exists only after review.
- **Corrections become evaluation cases:** each human OCR correction writes a case (input page, expected value, observed value, provider) to `evaluation_cases.jsonl`, reusable for another provider.
- **No full PDF text:** a region snippet of at most 160 characters is the only page text in the marts.
- **No invented benchmarks:** retrieval and citation cases come from `services/document-etl/evaluation_cases.json` (labelled fictional dossier) and run only when the dossier's documents are present.
- **Quality gate:** if a data-quality check fails, the run fails instead of publishing marts.

## Simulated OCR example

The fictional OCR sample (`labs/ai103/fixtures/capability/ocr-misread.sample.json`) reads 48.730,00 where the change order says 48.780,00. Rebuild a run with it to see the correction path end to end; the rows are labelled `simulated`:

```bash
docker exec -i credit-intelligence-lab-etl-1 sh -c 'cat > /tmp/ocr-misread.sample.json' < labs/ai103/fixtures/capability/ocr-misread.sample.json
docker exec credit-intelligence-lab-etl-1 /opt/venv/bin/python /app/control_tower.py /data/assets/<scope>/<run id> --simulate-ocr /tmp/ocr-misread.sample.json
```

## Limits

- Retrieval here uses BM25 over the run's extracted text; the Qdrant hybrid path of the credit API is evaluated by the AI-103 Lab and the RAG benchmark.
- ClamAV, OCR, indexing and Nova timings are measured by the credit API (pre-check steps), not by these marts.
- Local cost is a configured 0 EUR; the local extraction reports no token counts.
- The page reads the run result stored by the credit API; a CLI rebuild (for example with the simulated fixture) updates the marts and the export, not that stored result.
- Power BI files stay in the ETL volume; there is no download button yet.
