# Nova: listen to answers and evidence-context measurements

## Listen to an answer

**Where:** every completed Nova answer has **Listen to answer** (DE *Antwort anhören*, VI *Nghe câu trả lời*) next to **Copy**:

- in the Nova chat panel;
- in **AI transparency → Answer history**, where the same component is reused.

**Behaviour:**

- Playback starts only when you click, and only once the answer is complete.
- While it reads, the button becomes **Stop** and a *Reading aloud…* status appears. When it finishes, the button changes to **Listen again**.
- Only one answer plays at a time. Starting another answer stops the current one.
- Reading stops when Nova closes, when you change the dossier (both views are keyed by dossier) and when you leave or reload the page (`pagehide`).

**Privacy:** the browser's Web Speech API reads the text using only voices that report `localService: true`, that is voices rendered on the device. Nothing is recorded, saved or sent to a speech service, and the chat provider does not change. A voice must match the answer language: `vi` → `vi-VN`, `de` → `de-DE`, `en` → `en-US`/`en-GB`. Remote voices, such as Chrome's *Google …* voices, are never used.

**Language:** the voice follows the language of the answer text, not the interface. A stored English answer shown in the German interface is read with an English voice, and each paragraph of a German–Vietnamese summary is read with its own voice. Labels follow the interface.

**What is read:** the visible answer text with Markdown, links and citation IDs removed. Amounts, dates, units, currencies and names stay exactly as written, so `2.967,11 EUR` and `2.882,11 EUR` remain two separate values. Citations stay on screen so you can check the PDF. Each line becomes its own sentence, and long answers are split at sentence boundaries without splitting numbers.

**No suitable voice:** macOS sound-effect voices (for example *Bad News*) are skipped, and the system default voice of the region is preferred. If no on-device voice exists for the answer language, Nova shows a short guide that names the language (macOS: *System Settings → Accessibility → Spoken Content → System voice → Manage voices*) and the text answer stays unchanged. Browsers without speech synthesis show a similar note.

All labels, states and messages are available in English, German and Vietnamese (`lib/nova-speech.ts`).

## Evidence context and prompt switches

Each switch can be set independently, so its effect can be measured on its own. Environment variables map to `app.ai.*` in `application.yml`:

| Variable | Default | Effect |
|---|---|---|
| `NOVA_CONTEXT_DEDUPE` | `true` | Drops an excerpt whose text is fully contained in another excerpt of the **same** document; a wider excerpt replaces a narrower one at the better rank. Also drops a table excerpt (`…:pN:tK:cM`) when every cell is already in a kept text excerpt of the same page. Identical text in different documents always stays. |
| `NOVA_CONTEXT_RELATIVE_SCORE` | `0` (off) | Drops retrieval hits, from any document, that score below this share of the best hit. |
| `NOVA_PROMPT_STATIC_FIRST` | `false` | Azure only: fixed response rules first, then domain, evidence and the allowed citation IDs, with the question once at the end. |

These rules apply to every switch:

- None of them removes the case summary, the policy, the app guide or an exact field selection (`…:pN:rK`).
- Dedupe removes only text that is still present in another kept excerpt of the same document. The relevance cut can remove a whole document, so the benchmark checks that comparison questions keep every document they need.
- Bounded reviews (timeline, obligations, privacy review) and exact selections are never changed.
- The local Ollama prompt order is unchanged.

## Metrics

Every answer returns a `metrics` object, and the API log line `nova-metrics` repeats it. Both hold numbers and IDs only, never prompts, document text, answers or tokens of any credential:

| Field | Meaning | Source |
|---|---|---|
| `latencyMs`, `modelMs` | Request time up to a validated answer; time inside the model call | measured (server clock) |
| `evidenceSources`, `evidenceChars`, `evidenceDocuments` | Excerpts, characters and distinct documents sent to the model | measured |
| `promptChars` | Length of the user prompt sent | measured |
| `inputTokens`, `outputTokens` | Tokens reported by the provider (`tokenSource: provider`), otherwise `null` (`unavailable`) | provider report |
| `cachedInputTokens` | Always `null`: LangChain4j 1.8 does not expose cached-token details for Azure OpenAI or Ollama (`cacheSource: not-reported-by-client`) | not measured |
| `toolCalls` | Tool executions in an Azure tool round | measured |
| `duplicatesRemoved`, `belowRelevanceRemoved`, `removedSources` | What each switch removed | measured |

Ollama reports `prompt_eval_count` as the input tokens. This count can exclude a prompt prefix the server reused from the previous request, so compare `promptChars` as well.

## Benchmark method

The harness is `scripts/benchmark-nova.mjs`. It runs against the local stack and uses the real Keycloak login, Docling, ClamAV, Qdrant and the pinned local model `qwen3:4b-instruct-2507-q4_K_M`.

**Documents:** two dossiers with the same fictional documents in every variant:

- 11 bundled construction PDFs;
- the two approved public DATEV samples, prepared under `.local/reference-pdfs`.

**Questions:** ten questions covering:

- amounts and dates in German, English and Vietnamese;
- a three-document reconciliation: order sum, approved change order, invoice;
- a two-document payroll comparison;
- two questions whose answer is missing from the documents;
- net earnings versus payout for one person.

**Checks:**

- Citations are valid.
- The needed documents are still in the evidence sent to the model.
- The answer cites those documents and contains the expected values.
- Known wrong values are absent.
- Every label/value pair appears in the same statement, so net and payout are never swapped.
- Missing evidence is acknowledged.

The output contains numbers, document names and pass/fail flags, never answers or document text.

```bash
TEST_NOVA_BENCHMARK=1 TEST_NOVA_VARIANT=baseline TEST_NOVA_BENCHMARK_OUT=/tmp/baseline.json node scripts/test-oauth.mjs
# restart credit-api with other NOVA_CONTEXT_* values, then reuse the same dossiers (TEST_NOVA_BENCHMARK_ONLY picks questions):
TEST_NOVA_BENCHMARK=1 TEST_NOVA_VARIANT=dedupe TEST_NOVA_BENCHMARK_CASES=construction:CR-…,payroll:CR-… TEST_NOVA_BENCHMARK_OUT=/tmp/dedupe.json node scripts/test-oauth.mjs
node scripts/benchmark-nova.mjs --compare /tmp/baseline.json /tmp/dedupe.json
```

The Azure prompt layout is estimated without any Azure call:

```bash
cd services/credit-api && mvn test -Dtest=NovaPromptSizeReportTest -Dnova.promptReport=true
```

## Results (2026-11-11)

**Setup:**

- **Model:** local `qwen3:4b-instruct-2507-q4_K_M` on Ollama, 3 CPU threads inside Docker Desktop on an 8-core Mac, temperature 0, `num_ctx` 4096.
- **Data:** the same two dossiers and ten questions in every run.
- **Order:** the baseline ran first. The optimised runs followed while the host was under heavy external load: load average 10–60, with video encoding and the Claude desktop renderer active.

**Sizes on the six questions answered in every run:**

| Variant | Passed (of 10) | Evidence sources | Evidence chars | Prompt chars | Input tokens (Ollama) | Output tokens |
|---|---|---|---|---|---|---|
| Baseline (switches off) | 6 | 45 | 22,254 | 25,842 | 12,667 | 1,078 |
| Dedupe (default) | – | 39 (−13 %) | 19,889 (−11 %) | 23,159 (−10 %) | 11,066 (−13 %) | 1,171 (+9 %) |
| Dedupe + relevance 0.5 | 6 | 36 (−20 %) | 18,708 (−16 %) | 21,819 (−16 %) | 10,302 (−19 %) | 1,250 (+16 %) |

**Per question** (sources / evidence characters / input tokens):

| Question | Baseline | Dedupe | Dedupe + relevance 0.5 |
|---|---|---|---|
| Forecast cost (de) | pass · 7 / 4,184 / 2,338 | pass · 5 / 3,353 / 1,741 | same evidence as dedupe |
| Gross amount (vi) | pass · 7 / 3,380 / 1,988 | same evidence as the next column | pass · 6 / 2,962 / 1,706 |
| Change-order offer (en) | pass · 8 / 3,586 / 2,062 | same evidence as the next column | pass · 7 / 3,323 / 1,861 |
| Topping-out date (de) | pass · 9 / 4,343 / 2,363 | pass · 8 / 3,908 / 2,124 | pass · 5 / 2,727 / 1,360 |
| Energy certificate (en) | HTTP 422 | HTTP 422 | fail · 2 / 1,878 / 936 |
| Order, change order and invoice (en, 3 documents) | pass · 7 / 3,589 / 1,972 | timeout | timeout (twice) |
| Market value, missing (de) | HTTP 422 | same evidence as the next column | pass · 7 / 3,101 / 1,607 |
| Invoice paid?, missing (en) | pass · 7 / 3,725 / 2,045 | same evidence as the next column | pass* · 6 / 3,307 / 1,763 |
| Robert Muster: net and payout (de) | fail · 7 / 3,036 / 1,871 | identical | identical evidence and answer |
| Two DATEV PDFs compared (en) | HTTP 422 | – | HTTP 422 |

**Reading the table:**

- "Same evidence" means the relevance cut removed nothing for that question, so dedupe alone sends exactly the same evidence. At temperature 0 the prompt, and in practice the answer, is then the same.
- \* The first grader flagged the phrase "has been paid" inside "No source confirms whether the invoice has been paid". The answer abstains correctly. The grader now ignores such phrases in negated or open sentences, and a test covers it.

**Findings:**

- **Dedupe:**
  - It removed only table excerpts whose every cell was already in a kept page excerpt of the same page. That was 1–2 sources in 6 of 10 questions.
  - No document was lost and no answer got worse. The missing-evidence question that failed the citation contract in the baseline now completes.
  - It stays **on**.
- **Relevance cut at 0.5:**
  - It changed only two questions.
  - On the topping-out date it dropped three weak hits from unrelated documents (−764 tokens), and the answer still passed.
  - On the energy certificate the retrieval never found the ESG PDF: an English question against German text. The cut left only the policy and case summary, so the model answered "not stated" instead of failing the citation contract. That question fails either way.
  - None of the comparison questions lost a document: their needed documents scored ≥ 0.53 against a cut below 0.33.
  - Because the cut can drop whole documents and the sample is small, it stays **off** by default. 0.5 is a candidate for a larger evaluation.
- **Latency is inconclusive:**
  - Baseline answers took 91–292 s.
  - The optimised runs took 205–324 s, with four timeouts at the 360-second local limit, because the host was 1.5–3× slower during those runs.
  - In one interleaved A/B pair under the same load, the forecast question timed out with the baseline evidence (> 360 s) and passed in 289 s with dedupe. Load fell during the second run, so this pair is indicative only.
  - Input tokens, a load-independent measure, fell 13 % (dedupe) and 19 % (with the relevance cut). Prompt evaluation dominates CPU time, so this should become a similar time saving on an idle machine. Output tokens rose slightly.
- **Ollama prefix reuse:** the same warm-up question asked twice in a row took 202 s, then 50 s. Repeated prompts benefit; different questions share only the system prompt.
- **Pre-existing limits that no switch changes:**
  - The 4B model fails the citation contract on two or three questions.
  - It refuses the Robert Muster question because the excerpt names only "Personal-Nr. 1".
  - Retrieval misses cross-language matches.

**Azure (estimated, not measured):**

- `NovaPromptSizeReportTest` builds the real Azure request, with system prompt, tools and user prompt, for the eight construction questions. It counts tokens locally with the o200k tokenizer, and nothing is sent.
- **Static-first layout:**
  - The user message shrinks from 12,021 to 11,424 tokens (−5 %), and the whole request from 18,261 to 17,664 tokens (−3 %).
  - The prefix shared by every request grows from about 790 to about 880 tokens.
- **Caching:** Azure OpenAI caches only prompts of at least 1,024 tokens whose first 1,024 tokens are identical (Microsoft Learn, *prompt caching*). Neither layout reaches that, so no cache hits are expected either way.
- **Decision:** static-first saves about 3 % of tokens but its answer quality on Azure is unverified, so it stays **off** (`NOVA_PROMPT_STATIC_FIRST=false`) until a real Azure A/B run.
- **Not measured:** real Azure tokens, cost, latency and cached tokens. LangChain4j 1.8 does not expose `prompt_tokens_details.cached_tokens`.

## Test record

| Case | How it was checked |
|---|---|
| Spoken text keeps amounts, dates, units and names; drops Markdown, links and citations; reads tables and DATEV-style net and payout as separate statements | Unit tests (`lib/nova-speech.test.ts`) |
| Only `localService` voices; sound-effect voices skipped; answer language per paragraph | Unit tests, plus in the browser: 191 local voices, 0 remote |
| Play, Stop, Listen again, one answer at a time, English, German and Vietnamese answers under the German interface | Browser, answer history: engine state from `speechSynthesis.speaking` and the utterances sent (voices Aaron en-US, Anna de-DE, Linh vi-VN) |
| Changing the dossier, and leaving the page, while reading | Browser: playback stops |
| No suitable voice | Browser, simulated by hiding the Vietnamese voice in the page: the localised guide appears, nothing is spoken, the text stays |
| Nova chat: Listen beside Copy, Stop, Listen again, minimising Nova while reading | Browser. The answer was the app's instant guard reply: a model answer timed out at 360 s while the host was overloaded |
| Disabled button until the answer is complete | Unit test (render); in the browser no button appears for an unfinished or timed-out answer |

Raw numbers, without answers or document text, are in [benchmarks/nova-context.json](benchmarks/nova-context.json).

Whether the audio sounds right still has to be confirmed by a person listening. The automated checks see only the speech engine's state and the text it receives.

## Next step: speak a question (proposal, not built)

The flow is **microphone → editable transcript → Send**. Nova never sends a transcript on its own: it goes into the question box, the person corrects names and amounts, then presses Send. Nothing is stored as audio.

1. **On-device first.** Use the Web Speech API `SpeechRecognition` with `processLocally = true`.
   - Check `SpeechRecognition.available({langs, processLocally: true})` for `vi-VN`, `de-DE` and `en-US`, and offer `install()` for missing language packs.
   - If on-device recognition is unavailable, hide the microphone. Never silently fall back: Chrome's default recognition is server-based and sends audio to the browser vendor.
2. **Cloud only by explicit opt-in.** This needs a separate approval, data-processing review and budget.
   - **Azure AI Speech** speech-to-text in the tenant's own Azure region. Its language support lists `vi-VN` and `de-DE` for speech-to-text, and neural voices such as `vi-VN-HoaiMyNeural` and `vi-VN-NamMinhNeural` for text-to-speech.
   - **OpenAI / Azure OpenAI transcription models.** The OpenAI documentation currently recommends `gpt-transcribe`. `whisper-1`, `gpt-4o-transcribe` and `gpt-4o-mini-transcribe` are scheduled for shutdown on 26 Feb 2027; `gpt-live-transcribe` handles live audio. Azure regional availability and API versions for these models were **not verified**: check the Azure OpenAI model and region tables before choosing a deployment.
   - **Cloud text-to-speech** is optional, because on-device voices already work. OpenAI lists `gpt-4o-mini-tts`, `tts-1` and `tts-1-hd` for shutdown on 6 Jan 2027, with migration to the Realtime API. OpenAI's usage policies require telling listeners that the voice is AI-generated. `/v1/audio/speech` content may be kept for up to 30 days for abuse monitoring unless Zero Data Retention applies.

Model names and dates were checked against the official OpenAI and Microsoft Learn pages on 2026-11-11. Re-check them before implementation.
