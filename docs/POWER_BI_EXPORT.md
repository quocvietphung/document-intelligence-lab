# Power BI-ready export

Every ETL run writes a star schema for one tenant and one dossier, as CSV and Parquet, into its run folder in the ETL volume. Power BI is not installed or called by the lab: no login, no dataset publish, no API call. The same tables feed the Data & AI Control Tower page (`/en/control-tower`), so the local KPIs do not depend on Power BI.

## Where the files are

```
<ETL volume>/assets/<scope>/<run id>/powerbi/
  dim_*.csv | dim_*.parquet        dimensions (dim_document is SCD Type 2)
  fact_*.csv | fact_*.parquet      facts, every row with tenant_key, project_id, run_id and measurement_mode
  dq_results.*, lineage_edges.*    data-quality checks and Bronze → Silver → Gold lineage
  relationships.json               star-schema relationships and the row-level security note
  measures.json                    DAX for the KPIs
  evaluation_cases.jsonl           reusable evaluation cases from human corrections
```

Copy a run folder out of the running ETL container without stopping it, for example:

```bash
docker cp credit-intelligence-lab-etl-1:/data/assets/<scope>/<run id>/powerbi ./powerbi-export
```

The export holds field values, page numbers, bounding boxes and a region snippet of at most 160 characters; it never holds a whole PDF page. It is private dossier data: keep it out of Git and shared drives.

## Tables

| Table | Grain |
| --- | --- |
| `fact_ai_run` | one row per run, provider and model |
| `fact_document_extraction` | one row per document in the run |
| `fact_field_observation` | one row per extracted field: `raw_value`, `normalized_value`, `reviewed_value`, page, bounding box, provider, model, prompt version, confidence, cost, `measurement_mode` |
| `fact_human_correction` | one row per OCR correction made by a person, with its evaluation case id |
| `fact_retrieval_evaluation` | one row per labelled retrieval case (BM25 over the run's extracted text) |
| `fact_citation_evaluation` | one row per labelled value: document, page and bounding-box match |
| `fact_pipeline_stage` | one row per ETL stage with its measured latency |
| `fact_ai_cost` | one row per provider and model with the configured price |
| `dim_document` | SCD Type 2: one row per content version, `valid_from`, `valid_to`, `is_current` |
| `dim_document_type`, `dim_provider`, `dim_model`, `dim_prompt_version`, `dim_pipeline_version`, `dim_tenant`, `dim_project`, `dim_date` | dimensions |

## Import into Power BI Desktop

1. **Get data → Folder** (or **Parquet** for single files) and select the `powerbi` folder. Load the `fact_*`, `dim_*`, `dq_results` and `lineage_edges` tables.
2. **Model view:** create the relationships listed in `relationships.json`. Mark `dim_date` as a date table on `date`.
3. **Row-level security:** add a role that filters `dim_tenant[tenant_key]` (and `dim_project[project_id]`) to the viewer's tenant.
4. **Measures:** create one measure per entry in `measures.json` (Success rate, Average stage latency, Human correction rate, OCR disagreement rate, Citation document, page and bounding-box accuracy, Recall@K, Hit@K, MRR, Estimated cost per document). The prompt-injection blocked rate is computed in the ETL summary and shown in the Control Tower.
5. **Production pages:** filter `measurement_mode <> "simulated"`. Simulated rows appear only when a run was rebuilt with the OCR fixture (`control_tower.py --simulate-ocr`).

## Measurement modes

| Mode | Meaning |
| --- | --- |
| `measured` | observed in the run |
| `deterministic` | a fixed rule on the run's extracted text (shown as "Measured" with the rule named) |
| `configured` | a configured price or setting, not an observation |
| `simulated` | fixture data; never a production metric |

## Azure later (documented only)

```
Blob Storage → Data Factory or event ingestion → Bronze/Silver/Gold in ADLS or Azure SQL
  → Power BI semantic model → Power BI Embedded or the customer's workspace
```

The table names, keys and measures stay the same; only the storage and the refresh move. Nothing of this path is built or called in the lab.
