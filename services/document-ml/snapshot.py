"""Read only completed, hash-checked analytical exports; never open the ETL database."""
import hashlib
import json
import re
from pathlib import Path

ARTIFACTS = {"bronze", "silver", "gold", "document_facts", "field_observations", "invoice_lines", "quality_findings"}


def load_snapshot(directory, expected_hash=None):
    directory = Path(directory).absolute()
    if directory.is_symlink() or directory.parent.is_symlink() or not re.fullmatch(r"etl-[a-f0-9-]{36}", directory.name):
        raise ValueError("INVALID_SNAPSHOT_PATH")
    # macOS /var and /tmp are system aliases; canonicalize those parent prefixes.
    directory = directory.resolve(strict=True)
    path = directory / "manifest.json"
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 500_000:
        raise ValueError("MANIFEST_UNAVAILABLE")
    raw = path.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    if expected_hash is not None and sha != expected_hash:
        raise ValueError("MANIFEST_CHANGED")
    manifest = json.loads(raw)
    if manifest.get("method") != "document-medallion-v3" or manifest.get("runId") != directory.name:
        raise ValueError("BUILD_CURRENT_ETL_FIRST")
    if not re.fullmatch(r"[a-f0-9]{64}", manifest.get("scope", "")) or directory.parent.name != manifest["scope"]:
        raise ValueError("SCOPE_MISMATCH")
    if not re.fullmatch(r"[a-f0-9]{64}", manifest.get("sourceHash", "")):
        raise ValueError("INVALID_SOURCE_HASH")
    artifacts = {item["name"]: item["sha256"] for item in manifest["artifacts"]}
    if set(artifacts) != {name + ".parquet" for name in ARTIFACTS}:
        raise ValueError("INVALID_ARTIFACT_SET")
    for name, checksum in artifacts.items():
        artifact = directory / name
        if artifact.is_symlink() or not artifact.is_file() or artifact.stat().st_size > 20_000_000:
            raise ValueError("ARTIFACT_UNAVAILABLE")
        if hashlib.sha256(artifact.read_bytes()).hexdigest() != checksum:
            raise ValueError("ARTIFACT_HASH_MISMATCH")
    return manifest, sha


def read_rows(directory, name):
    import duckdb
    if name not in ARTIFACTS:
        raise ValueError("UNKNOWN_ARTIFACT")
    with duckdb.connect(config={"memory_limit": "128MB", "threads": "1", "enable_external_access": "true"}) as db:
        cursor = db.execute("SELECT * FROM read_parquet(?) LIMIT 50001", [str(Path(directory) / (name + ".parquet"))])
        names = [column[0] for column in cursor.description]
        rows = cursor.fetchall()
        if len(rows) > 50_000:
            raise ValueError("DATASET_TOO_LARGE")
        return [dict(zip(names, row, strict=True)) for row in rows]
