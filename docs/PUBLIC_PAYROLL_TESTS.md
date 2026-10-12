# Public German payroll references and full local audit

Verified 11 October 2026. Engineering lab only; no real employee or credit decision.

## Source and private handling

The official publisher is [DATEV: LODAS sample evaluations 2025](https://www.datev.de/content/dam/markenassets/themen-und-produktgruppen/zielgruppen/zielgruppenuebergreifend/shop-assets/personalwirtschaft/lodas-musterauswertung-2025-deutsch.pdf).
The public PDF has 30 pages. Pages 2 and 3 show fictional Robert-Muster and Melanie-Muster payroll examples. This is a historical demonstration of a real software layout, not a claim that its tax figures match current payroll rules.

No open redistribution license was established. The original and derived pages are kept only in ignored `.local/` paths and the authenticated local case database, never bundled into `public/`, Docker build context or GitHub. The UI links to the publisher rather than copying the PDF. Explicit owner consent was obtained before sending the two sample pages to Azure Document Intelligence and their context to Nova.

Download the source privately, then split the two unmodified sample pages (Python needs `pypdf`):

```bash
python3 scripts/prepare-datev-reference.py .local/datev-lodas-musterauswertung-2025.pdf
```

The splitter validates the sample's page count, cover and fictional names, refuses to overwrite an existing file and checks that each output meets the 3 MB / one-page upload constraints. Do not replace the reference with an actual person's payroll.

## Real Azure smoke test

With the token-renewal helper running and the shared Azure Docker profile active:

```bash
# This explicitly sends the two public fictional pages to Azure.
TEST_DATEV=1 TEST_CHAT=azure node scripts/test-oauth.mjs
```

Verified case: `CR-aa162f08-0bf`, **Public DATEV Muster References**.

| Sample | Net earnings | Payout | Verified behaviour |
|---|---:|---:|---|
| Robert-Muster | 2.967,11 EUR | 2.882,11 EUR | Both fields distinct, provider/model retained, original byte-identical |
| Melanie-Muster | 4.212,90 EUR | 3.069,93 EUR | Both fields distinct, provider/model retained, original byte-identical |

Nova's real Azure answer reported all four values with named document/page sources. Both documents remain `review` until an authorized person verifies them. This is a two-sample connectivity/extraction test, **not a representative payroll accuracy benchmark**.

## Extraction changes

- Recognize the common heading “Abrechnung der Brutto/Netto-Bezüge” and additional net-income labels.
- Treat `Auszahlungsbetrag` / `Nettoauszahlung` as `payoutAmount`, never an alias for net earnings.
- Supplement Azure key-value pairs using normalized line geometry: a money value beside or immediately below an exact supported label. Distant, ambiguous, malformed or conflicting candidates are ignored.
- Store page evidence; the supplemental rule has no fabricated confidence. It does not calculate payroll or invent a missing employer/date.
- A field-source button opens the page, not a precise bounding-box highlight; full bounding-region review is not implemented.

## UI and transport fixes

- Review issues show document names and open the exact evidence dialog.
- Uploads have visible processing feedback and a synchronous in-flight guard against double submission.
- Sample import labels reflect the selected local/Azure provider rather than always saying Azure.
- PNG/JPEG originals can be viewed alongside fields, not only downloaded. Original endpoints deliberately return `application/octet-stream` and `nosniff`; the viewer validates actual raster signatures before making a transient object URL. HTML/SVG cannot become a preview.
- Field inputs have their own labels; source buttons are not nested inside an input label. Model confidence is distinguished from validated accuracy.
- English, German and Vietnamese include the new payout, preview and source guidance.

## Audit coverage

Baseline and final automated checks include TypeScript parsing/translations/transport, Java JWT and role/tenant isolation, extraction, quotas, banking persistence/idempotency and Docker production builds. Browser checks cover login, case creation/edit, navigation, search, transaction filters/CSV, original-document review, sample preview, quality evaluation and workflow log. The full verification record is in [PLATFORM_VERIFICATION.md](PLATFORM_VERIFICATION.md).

Known boundaries remain: no production cloud upgrade, live bank connection, actual payments, malware scanning, encrypted object storage or representative OCR/LLM accuracy evaluation. Public availability is not permission to republish every document or upload genuine personal records.
