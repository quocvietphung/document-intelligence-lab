# AI-103 lab · contractor pre-check before accounting

Exercises around one fictional contractor dossier (`services/credit-api/src/main/resources/contractor-dossier/`):
contract (Bauauftrag), change order N-01 (Nachtrag), final invoice RG-2026-0457 and acceptance report, plus two acceptance
photos and an invoice variant with a hidden self-approval sentence. The full guide, pass/fail criteria, the status of
every Azure service and the recorded results are in [docs/AI103_CONTRACTOR_PRECHECK.md](../../docs/AI103_CONTRACTOR_PRECHECK.md).

Standard library only (Python 3.10+). Run from this folder:

```bash
python3 -m unittest discover -s tests -v          # offline tests, no Docker
python3 -m ruff check . && python3 -m mypy contractor_lab   # optional lint and types; settings in pyproject.toml
python3 -m contractor_lab offline                 # 20 criteria, offline, prints PASS/FAIL
python3 -m contractor_lab speech                  # 4a audio → transcript → Nova → listen (mock transcript)
python3 -m contractor_lab translate               # 4b German e-mail → English, identifiers and amounts checked
python3 -m contractor_lab voice-live              # 4c barge-in on scripted Voice Live events
python3 -m contractor_lab search                  # 5 query → page check (BM25) and Azure configuration check
python3 -m contractor_lab content-understanding   # 6 documented request shape, no call
python3 -m contractor_lab agent --case CR-…       # 2a live, read-only (needs the local stack)
python3 -m contractor_lab nova  --case CR-…       # 2b live Nova suggestion (several minutes on CPU)
python3 -m contractor_lab cloud-plan --env-file ../../.local/ai103-azure.env   # 3, no network
```

| Module | Exercise |
| --- | --- |
| `agent.py`, `platform.py` | 2a read-only agent (scripted or local-Ollama planner), Keycloak PKCE login kept in memory |
| `nova.py` | 2b Nova summary and email draft, checked claim by claim; a quarantined source is never sent |
| `guard.py` | 2c self-approval instructions (mirrors the Java `EvidenceGuard.approvalInstructions`) |
| `emails.py` | 2d email classification and PII masking |
| `media.py` | 2e photo linking, 2f image/audio → JSON schema |
| `speech.py` | 4a fast transcription (live, opt-in), SSML text to speech (live, opt-in), transcript check, listen label |
| `translator.py` | 4b translation and transliteration (live, opt-in), identifier/amount/currency preservation |
| `voice_live.py` | 4c Voice Live session state machine on scripted events: barge-in, late audio, access rule |
| `search_lab.py` | 5 BM25 page check on the same PDF pages; Azure AI Search configuration check and query (live, opt-in) |
| `content_understanding.py` | 6 documented request shape (analyzer name, `mimeType`) |
| `azure_http.py` | the one HTTP helper for the live adapters; telemetry keeps only operation, status, duration, error type, correlation id |
| `otel.py` | 2g OpenTelemetry spans, `traceparent`, OTLP/JSON export to the local collector |
| `cloud.py`, `azure.env.example` | 3 opt-in Azure configuration plan (never calls Azure); `require_live` gates every live adapter |

Fixtures: `fixtures/speech/` (synthetic site note WAV, reference transcript, sample responses, SSML example),
`fixtures/translation/` (fictional e-mail and English reference), `fixtures/search/dossier-pages.json` (page texts),
`azure/search/` (Blob → indexer → skillset → index samples) and `azure/content-understanding/` (request sample).
Every fixture is labelled `FIKTIVE DATEN`; sample responses are marked as samples, not live output.

Outputs go to the git-ignored `.local/ai103/`. Nothing in this lab approves, pays or sends anything.
