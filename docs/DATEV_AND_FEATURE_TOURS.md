# DATEV samples and native page walkthroughs — 13 October 2026

## Corrected tour design

The previous selector **inside Nova was not the requested experience**. It has been replaced by a website walkthrough on the page itself:

- Each of nine workspace pages has a **Guide this page** button. The compass beside Nova and in its header starts the current page's guide.
- A separate body portal dims the surrounding page, spotlights an actual control and places a localized coachmark nearby. No tour content is rendered inside the Nova chat panel.
- AI Studio has seven steps: menu entry → question field → suggestions → retrieval button → result passages/sources → Ask Nova → recorded runs.
- Other guides cover overview, DATEV documents, processing queue, controls, banking simulation, evaluation, operations and audit.
- Back/Next scroll to the target. Skip/Close/Escape exits. Changing the section or selected case closes the tour. Hidden mobile sidebar targets use the visible page-guide button.
- On short/narrow screens, small controls are repositioned by scrolling the page when a centered target would leave insufficient space for the coachmark. Cards stay within the viewport; long content scrolls inside the card.
- A highlighted control remains interactive. The walkthrough never clicks it, submits uploads, runs a benchmark, confirms evidence or sends an AI request. Starting a tour minimizes Nova while preserving chat and the unsent draft.
- English, German and Vietnamese share a typed catalog and static source-defined selectors. Missing controls are reported, not silently replaced with unrelated elements.

## DATEV boundary (unchanged)

The only offered payroll sample PDFs are the two prepared, unchanged official fictional DATEV LODAS 2025 pages (Robert/Melanie), served through authenticated private endpoints. The source and prepared pages remain in ignored `.local/` storage, not Git or public assets. See [source and preparation](PUBLIC_PAYROLL_TESTS.md).

The deterministic browser demo and fresh Java seed use explicitly labelled publisher reference values, not simulated OCR percentages or substituted homemade PDFs. The reference people are not asserted to be the demo borrower. Net earnings and payout remain separate fields.

Four old homemade PDFs were moved from `public/demo/` to `services/credit-api/src/test/resources/legacy-payroll/` for regression testing only. They are recoverable and no longer served at their former public URLs. Generic unit-test and synthetic-text evaluation fixtures remain test data, not DATEV payroll documents. The text benchmark is not a representative DATEV PDF/OCR evaluation.

No existing database evidence was overwritten, deleted or renamed. Old non-library payroll remains separately preserved. Explicit case selection is honored; otherwise a DATEV-only case is preferred. Arbitrary uploads remain available for other document workflows; a matching filename alone never guarantees authenticity.

## Automated verification

- Current frontend: **100 tests passed**, 19 files; lint and TypeScript passed. Covers nine page catalogs, three languages, source anchors, geometry/clipping, separate Nova guide entry, composer shortcuts and DATEV preservation.
- The earlier selector implementation had 102 frontend tests. Its two more tests do not indicate two extra user features; the old tour tests were replaced by tests of the corrected native walkthrough.
- Docker web production build passed. Only the web image changes for this correction; Java and database volumes are retained.
- Read-only OAuth/reference smoke test passed **29 checks**: PKCE/authorization, both authenticated private PDFs byte-identical to prepared files, and four former homemade payroll URLs returning 404. No files or questions are sent to Azure and no cases are created.
- Java's preceding verification remains **126 passed**, 1 opt-in live test skipped. No Java changes are needed for the tour correction. The preceding normal API Docker build stalled on Maven dependencies, so its successful host artifact was packaged into the local Java runtime; this is not a claim that the normal multistage cloud build completed.

The previous `local-nova-feature-guides-2026-10-13.jpg` screenshot is historical and does **not** show the corrected tour. README now points to `local-page-tour-studio-2026-10-13.jpg`.

## Browser verification on the final Docker web image

- All **34 steps across nine pages** were opened with Next/Finish. Every step had a visible target and every coachmark was inside the viewport. No uploads, reviews, benchmark runs or payment actions were executed by this walkthrough.
- The AI Studio question field remained editable with the tour open. A manual local retrieval returned **36 indexed chunks** from Qdrant and ranked the existing DATEV documents. Cold-start retrieval took 9,162 ms; this is one measured run, not a performance guarantee. Ask Nova opened an editable draft matching the current query and did not send it.
- Desktop and **390×844** mobile checks after focusing/typing confirmed no intersection between the question field and coachmark, and no horizontal document overflow. Back returned to step 1; Escape closed the overlay. The viewport override was reset.
- English, German and Vietnamese guides were checked in the browser. Nova remained a separate chat panel; starting the guide retained its unsent draft.
- Following the highlighted DATEV-library button in the pipeline opened Documents and closed the old tour through hash navigation. The final tab was left on AI Studio's question-field step; its captured browser error log was empty.
- Screenshots contain app controls, not republished DATEV PDF pages: `screenshots/local-page-tour-studio-2026-10-13.jpg` and `screenshots/local-page-tour-mobile-2026-10-13.jpg`.
- Docker Desktop had stopped between the two work sessions. It was reopened and the existing stack restarted with retained volumes. ClamAV completed its signature update; all six configured healthchecks were healthy and nine long-running services were up. The successful one-shot storage initializer remains stopped normally.

No Azure resources were started or modified, and no commit, push or Vercel deployment was performed.
