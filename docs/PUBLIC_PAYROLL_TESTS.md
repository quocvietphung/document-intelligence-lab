# Document samples and private DATEV references

Use fictional or explicitly permitted documents. Do not upload an actual employee's payslip, policyholder record or customer invoice merely to try the app.

## Included research PDFs

These repository-authored fictional files are available after cloning:

| Domain | File |
| --- | --- |
| Insurance | `public/samples/insurance-policy-fictional.pdf` |
| Insurance | `public/samples/insurance-claim-fictional.pdf` |
| General documents | `public/samples/invoice-fictional.pdf` |

Create a dossier in the matching domain, preview the sample and explicitly confirm analysis. Local mode uses PDFBox/Tesseract. Azure mode sends the selected file to the configured document provider.

## Official DATEV payroll sources

The user-facing payroll library contains only two fictional pages from [DATEV's LODAS sample evaluations 2025](https://www.datev.de/content/dam/markenassets/themen-und-produktgruppen/zielgruppen/zielgruppenuebergreifend/shop-assets/personalwirtschaft/lodas-musterauswertung-2025-deutsch.pdf):

| Publisher page | Fictional sample | Net earnings | Payout |
| --- | --- | --- | --- |
| 2 | Robert-Muster Wichtig | 2.967,11 EUR | 2.882,11 EUR |
| 3 | Melanie-Muster Sommer | 4.212,90 EUR | 3.069,93 EUR |

Values above retain the publisher's German formatting. They are reference values, not AI predictions. This historical layout is not current payroll/tax advice.

No open redistribution license was established. Original and split PDFs are private and not bundled into GitHub, `public/` or a Docker image. The app links to the publisher; README images show the current review UI and an excerpt, not a downloadable replacement for the publisher PDF.

## Prepare the private pages

1. Download the unchanged 30-page publisher PDF into an ignored local path such as `.local/datev-lodas-musterauswertung-2025.pdf`.
2. Install `pypdf` in your preferred private Python environment if needed.
3. From the repository root:

```bash
python3 scripts/prepare-datev-reference.py .local/datev-lodas-musterauswertung-2025.pdf
```

The splitter checks the page count, cover text, fictional names, one-page outputs and file-size limit. It refuses to overwrite existing references.

Expected outputs:

```text
.local/reference-pdfs/datev-lodas-2025-robert-muster.pdf
.local/reference-pdfs/datev-lodas-2025-melanie-muster.pdf
```

If the web container was started before the directory existed, recreate the web container using your current profile. Do not remove database volumes.

## Try a DATEV document

1. Open `http://localhost:3000/en` and select a **Banking & payroll** dossier.
2. Open **Documents & review → Official DATEV payroll library**.
3. Preview the private PDF, then choose **Import & analyze** and confirm the provider/data destination.
4. Look in **Analysis results**, above the sample library. Select **View result & PDF**.
5. Compare net earnings and payout separately against the original.
6. In Azure mode, ask Nova to explain the selected evidence with page sources.

Original PDF text, names and number formatting are intentionally not translated when switching UI language. A filename alone is not proof of publisher authenticity.

## Confidence and verification

Azure layout confidence, field-rule output and human verification are different signals. Geometry-based field supplements do not invent a confidence value. Net earnings are not an alias for payout.

A correct result on these two examples demonstrates that particular extraction/connection flow, not representative OCR or payroll accuracy. Use independently checked reference sets in [AI Experiments](RESEARCH_WORKSPACES.md) for measurable comparisons.

## Optional real-Azure acceptance

Only run after reviewing and authorizing transmission of the two fictional publisher pages to your Azure resources:

```bash
TEST_DATEV=1 TEST_CHAT=azure node scripts/test-oauth.mjs
```

This can create fictional test records and incur inference usage. It is not needed for a fresh-clone/no-Azure Docker check. Legacy self-authored payroll PDFs remain **test-only** regression fixtures and are not offered as DATEV samples.
