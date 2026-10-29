"""Optional local[2] Parquet batch with exact-decimal DuckDB parity checks."""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from snapshot import load_snapshot


def run(source, output, repeat=1):
    started = time.monotonic()
    source, output = Path(source).absolute(), Path(output).absolute()
    manifest, checksum = load_snapshot(source)
    if output.exists() or output.is_symlink():
        raise ValueError("CHOOSE_NEW_SEPARATE_OUTPUT_DIRECTORY")
    source, output = source.resolve(), output.resolve()
    if output == source or source in output.parents:
        raise ValueError("CHOOSE_NEW_SEPARATE_OUTPUT_DIRECTORY")
    if not 1 <= repeat <= 10_000:
        raise ValueError("REPEAT_OUT_OF_RANGE")
    import duckdb
    baseline_start = time.monotonic()
    path = str(source / "silver.parquet")
    with duckdb.connect(config={"memory_limit": "128MB", "threads": "1"}) as db:
        expected_count = db.execute("SELECT count(*) FROM read_parquet(?)", [path]).fetchone()[0] * repeat
        expected = db.execute("SELECT field_key,currency,count(*) * ?,sum(amount) * ? FROM read_parquet(?) WHERE reviewed AND quality='VALID' AND amount IS NOT NULL AND currency IS NOT NULL GROUP BY field_key,currency ORDER BY field_key,currency", [repeat, repeat, path]).fetchall()
    duck_ms = round((time.monotonic() - baseline_start) * 1000)
    spark_start = time.monotonic()
    from pyspark.sql import SparkSession, functions as F
    spark = SparkSession.builder.master("local[2]").appName("document-parquet-parity").config("spark.driver.host", "127.0.0.1").config("spark.driver.bindAddress", "127.0.0.1").config("spark.ui.enabled", "false").config("spark.sql.shuffle.partitions", "2").config("spark.sql.session.timeZone", "UTC").getOrCreate()
    spark.sparkContext.setLogLevel("ERROR")
    try:
        silver = spark.read.parquet(path)
        # Repetition tests analytical row volume, not OCR throughput or unique PDFs.
        rows = silver.crossJoin(spark.range(repeat).withColumnRenamed("id", "replica_index"))
        if expected_count > 2_000_000:
            raise ValueError("BENCHMARK_ROW_LIMIT")
        observed_count = rows.count()
        totals = rows.filter(F.col("reviewed") & (F.col("quality") == "VALID") & F.col("amount").isNotNull() & F.col("currency").isNotNull()).groupBy("field_key", "currency").agg(F.count("*").alias("observations"), F.sum("amount").alias("total"))
        actual = [(r["field_key"], r["currency"], r["observations"], r["total"]) for r in totals.orderBy("field_key", "currency").collect()]
        parity = actual == expected and observed_count == expected_count
        if not parity:
            raise ValueError("SPARK_DUCKDB_PARITY_FAILED")
        output.mkdir(parents=True)
        # Gzip uses the JRE codec and keeps /tmp non-executable in the offline container.
        totals.write.option("compression", "gzip").mode("errorifexists").parquet(str(output / "gold"))
        result = {"schemaVersion": "document-spark-benchmark-v1", "sourceHash": manifest["sourceHash"], "etlRunId": manifest["runId"],
                  "manifestSha256": checksum, "master": "local[2]", "distributedCluster": False, "parity": parity,
                  "sourceDocuments": manifest["bronze"], "rows": observed_count, "repeat": repeat,
                  "datasetKind": "source-snapshot" if repeat == 1 else "synthetic-repetition",
                  "outputCompression": "gzip", "duckdbQueryMs": duck_ms, "sparkStartupAndQueryMs": round((time.monotonic() - spark_start) * 1000),
                  "elapsedMs": round((time.monotonic() - started) * 1000), "sparkVersion": spark.version,
                  "totals": [{"field": a, "currency": b, "observations": c, "total": str(d)} for a, b, c, d in actual],
                  "limitations": ["Timings include one local Spark startup; DuckDB timing is its in-process query.",
                                  "Repeated rows are synthetic load, not additional PDF documents.",
                                  "Decimal aggregates preserve field/currency separation and the human-review gate.",
                                  "This benchmark does not measure distributed scaling or PDF extraction throughput."]}
        (output / "benchmark.json").write_text(json.dumps(result, indent=2, allow_nan=False))
        return result
    finally:
        spark.stop()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--repeat", type=int, default=1)
    args = parser.parse_args()
    result = run(args.input, args.output, args.repeat)
    print(json.dumps({k: result[k] for k in ("parity", "rows", "datasetKind", "elapsedMs")}, allow_nan=False))
