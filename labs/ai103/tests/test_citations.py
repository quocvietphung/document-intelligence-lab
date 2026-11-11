"""Claim-level citation checks for Nova suggestions, and quarantine before any model call (AI-103 2b)."""
from __future__ import annotations

import copy
import json
import unittest

from contractor_lab import FIXTURES
from contractor_lab.nova import draft_with_nova, validate

PRECHECK = json.loads((FIXTURES / "precheck-sample.json").read_text(encoding="utf-8"))
APPROVED_ID = PRECHECK["approved"]["source"]["ref"].strip("[]")
INVOICE_ID = PRECHECK["invoice"]["source"]["ref"].strip("[]")
CHANGE_PAGE_ONE = "nachtrag-n01-wv-2026-031.pdf · p. 1"

SOURCES = [
    {"id": APPROVED_ID, "text": "Genehmigte Gesamtvergütung: 48.780,00 EUR brutto\nNachtrag N-01 · Freigabestatus: schriftlich freigegeben"},
    {"id": INVOICE_ID, "text": "Rechnungsbetrag: 49.980,00 EUR brutto\nNettobetrag: 42.000,00 EUR netto\nUmsatzsteuer 19 %: 7.980,00 EUR"},
    {"id": "doc-acceptance:p1:c1", "text": "Abnahmeprotokoll AP-2026-019\nAbnahmeergebnis: mit Vorbehalt\nPos. 1 und 2 abgenommen; Pos. 3 nicht abgenommen"},
    {"id": "doc-payment:p1:c1", "text": "Zahlungsbestätigung: keine Zahlung dokumentiert"},
    {"id": "doc-wrong-page:p1:c1", "text": "Nachtrag N-01 · Beschreibung der Vorsatzschale. Keine Summen auf dieser Seite."},
]


class FailingApi:
    """Stands in for the Java API; a quarantined pre-check must never reach it."""
    calls = 0

    def post(self, *args, **kwargs):
        FailingApi.calls += 1
        raise AssertionError("the model must not be called for a quarantined source")


class CitationTests(unittest.TestCase):
    def test_every_amount_cited_to_a_page_that_contains_it_passes(self):
        answer = ("Genehmigt sind 48.780,00 EUR brutto [" + APPROVED_ID + "]. Die Rechnung nennt 49.980,00 EUR brutto [" + INVOICE_ID + "]. "
                  "Die Differenz 1.200,00 EUR ist aus den nicht genehmigten Positionen berechnet [" + INVOICE_ID + "]. "
                  "Thiếu bằng chứng thanh toán [doc-payment:p1:c1].")
        self.assertEqual([], validate(answer, PRECHECK, SOURCES))

    def test_cited_page_that_exists_but_has_other_content_is_rejected(self):
        # The page exists and is cited, but it does not contain the approved total.
        answer = "Genehmigt sind 48.780,00 EUR brutto [doc-wrong-page:p1:c1]. Thiếu bằng chứng thanh toán [doc-payment:p1:c1]."
        problems = validate(answer, PRECHECK, SOURCES)
        self.assertTrue(any(p.startswith("CITATION_DOES_NOT_SUPPORT_AMOUNT 48780.00") for p in problems), problems)

    def test_an_uncited_stated_amount_is_rejected(self):
        answer = "Die Rechnung beträgt 49.980,00 EUR brutto. Thiếu bằng chứng thanh toán [doc-payment:p1:c1]."
        self.assertTrue(any(p.startswith("UNCITED_AMOUNT 49980.00") for p in validate(answer, PRECHECK, SOURCES)))

    def test_acceptance_statement_must_cite_acceptance_text(self):
        bad = ("Die Abnahme ist teilweise erfolgt [doc-payment:p1:c1]. Differenz 1.200,00 EUR [" + INVOICE_ID + "]. "
               "Thiếu bằng chứng thanh toán [doc-payment:p1:c1].")
        self.assertTrue(any(p.startswith("CITATION_DOES_NOT_SUPPORT_CLAIM acceptance") for p in validate(bad, PRECHECK, SOURCES)))
        good = ("Die Abnahme ist mit Vorbehalt erfolgt [doc-acceptance:p1:c1]. Differenz 1.200,00 EUR [" + INVOICE_ID + "]. "
                "Thiếu bằng chứng thanh toán [doc-payment:p1:c1].")
        self.assertEqual([], validate(good, PRECHECK, SOURCES))

    def test_invoice_line_claim_must_cite_a_source_with_that_amount(self):
        answer = "Dòng 3 (1.008,40 EUR netto) chưa có Nachtrag [doc-acceptance:p1:c1]. Thiếu bằng chứng thanh toán [doc-payment:p1:c1]."
        self.assertTrue(any(p.startswith("CITATION_DOES_NOT_SUPPORT_CLAIM line 3") for p in validate(answer, PRECHECK, SOURCES)))

    def test_ids_only_sources_keep_the_old_citation_rule(self):
        # Without source text the content checks cannot run; existence of the citation is still required.
        answer = ("Die Rechnung beträgt 49.980,00 EUR brutto [" + INVOICE_ID + "]. Differenz 1.200,00 EUR [" + INVOICE_ID + "]. "
                  "Thiếu bằng chứng thanh toán [doc-payment:p1:c1].")
        self.assertEqual([], validate(answer, PRECHECK, [INVOICE_ID, "doc-payment:p1:c1"]))

    def test_mock_quarantined_source_never_reaches_the_model(self):
        precheck = copy.deepcopy(PRECHECK)
        precheck["isolatedPages"] = [INVOICE_ID]
        FailingApi.calls = 0
        result = draft_with_nova(FailingApi(), "CR-x", precheck, "de")
        self.assertEqual("SKIPPED_ISOLATED_SOURCE", result["status"])
        self.assertEqual(0, FailingApi.calls)
        self.assertFalse(result["emailSent"])
        self.assertFalse(result["humanApproved"])

    def test_clean_sources_still_reach_the_model(self):
        class Recording:
            def __init__(self):
                self.bodies = []
            def post(self, path, body, allow_model=False):
                self.bodies.append(body)
                return {"answer": "Die Rechnung beträgt 49.980,00 EUR brutto [" + INVOICE_ID + "]. Differenz 1.200,00 EUR [" + INVOICE_ID + "]. Thiếu bằng chứng thanh toán [doc-payment:p1:c1].",
                        "mode": "local-ollama", "sources": SOURCES}
        api = Recording()
        precheck = copy.deepcopy(PRECHECK)
        precheck["isolatedPages"] = []
        result = draft_with_nova(api, "CR-x", precheck, "de")
        self.assertEqual(1, len(api.bodies))
        self.assertEqual("SUGGESTION_ACCEPTED_FOR_REVIEW", result["status"], result["problems"])


if __name__ == "__main__":
    unittest.main()
