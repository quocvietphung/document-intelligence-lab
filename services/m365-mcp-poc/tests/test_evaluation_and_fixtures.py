import json
from pathlib import Path

from m365_poc.evaluation import run_evaluation
from m365_poc.extraction import extract_pages
from m365_poc.providers.mock import MockGraphProvider

ROOT = Path(__file__).resolve().parents[1]


def test_manifest_matches_fixture_files(settings):
    manifest = json.loads(settings.manifest_path.read_text(encoding="utf-8"))
    for item in manifest["documents"]:
        assert (settings.fixtures_dir / item["filename"]).is_file(), item["filename"]
    assert {i["tenant_id"] for i in manifest["documents"]} == {"fictional-tenant-001"}


def test_fictional_core_fields_are_extractable(settings):
    pages = extract_pages((settings.fixtures_dir / "projektstatus-berlin-living.pdf").read_bytes())
    assert "Status: Baugenehmigung beantragt" in pages[0].text
    assert "Nächster Termin: 20.11.2026" in pages[0].text
    assert "12.000.000 EUR" in pages[1].text


def test_rotated_fixture_carries_rotation_metadata(settings):
    pages = extract_pages((settings.fixtures_dir / "potsdam-quartier-rotiert.pdf").read_bytes())
    assert pages[0].rotation == 90


def test_offline_evaluation_regression(mock_service, local_ctx):
    dataset = json.loads((ROOT / "eval" / "dataset.v2.json").read_text(encoding="utf-8"))
    report = run_evaluation(mock_service, dataset, local_ctx)
    m = report["metrics"]
    assert report["items"] == len(dataset["items"]) == 15
    assert report["answer_provider"] == "deterministic"
    assert m["retrieval_hit_at_5"] == 1.0
    assert m["citation_correctness"] == 1.0
    assert m["answer_correctness"] == 1.0
    assert m["abstention_accuracy"] == 1.0
    assert m["unsupported_claim_rate"] == 0.0
    assert "Not a production benchmark" in report["scope"]


def test_mock_provider_enumerates_only_manifest_documents(settings, local_ctx):
    provider = MockGraphProvider(settings.fixtures_dir, settings.manifest_path)
    names = {r.name for r in provider.list_documents(local_ctx, 50)}
    assert "vorstandsnotiz-berlin-living.pdf" not in names and "projektstatus-berlin-living.pdf" in names
