"""Claim-level citation checks for Nova suggestions, and quarantine before any model call (AI-103 2b)."""
from __future__ import annotations

import copy
import io
import json
import unittest
import urllib.error

from contractor_lab import FIXTURES
from contractor_lab.nova import draft_with_nova, question, validate

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

    def test_placeholder_in_square_brackets_is_not_a_citation(self):
        # "[Name]" is ordinary bracket text. The Java API refuses it, and the lab's own check must agree.
        answer = ("Herr [Name], die Rechnung 49.980,00 EUR brutto [" + INVOICE_ID + "]. Differenz 1.200,00 EUR [" + INVOICE_ID + "]. "
                  "Thiếu bằng chứng thanh toán [doc-payment:p1:c1].")
        self.assertTrue(any(p.startswith("UNKNOWN_CITATION ['Name']") for p in validate(answer, PRECHECK, SOURCES)))

    def test_a_repeated_amount_needs_a_citation_every_time_it_appears(self):
        answer = ("Genehmigt sind 48.780,00 EUR brutto [" + APPROVED_ID + "]. Später nennt der Entwurf 48.780,00 EUR brutto ohne Quelle. "
                  "Differenz 1.200,00 EUR [" + INVOICE_ID + "]. Thiếu bằng chứng thanh toán [doc-payment:p1:c1].")
        self.assertTrue(any(p.startswith("UNCITED_AMOUNT 48780.00") for p in validate(answer, PRECHECK, SOURCES)))

    def test_affirmative_payment_claim_must_cite_a_page_that_is_about_payment(self):
        wrong_page = "Die Zahlung ist erfolgt [" + INVOICE_ID + "]. Differenz 1.200,00 EUR [" + INVOICE_ID + "]."
        self.assertTrue(any(p.startswith("CITATION_DOES_NOT_SUPPORT_CLAIM payment") for p in validate(wrong_page, PRECHECK, SOURCES)))
        uncited = "Die Zahlungsbestätigung liegt vor. Differenz 1.200,00 EUR [" + INVOICE_ID + "]."
        self.assertTrue(any(p.startswith("UNCITED_CLAIM payment") for p in validate(uncited, PRECHECK, SOURCES)))
        # A statement that evidence is missing needs no citation, but the cited payment page is still accepted.
        missing = "Zahlungsbestätigung fehlt [doc-payment:p1:c1]. Differenz 1.200,00 EUR [" + INVOICE_ID + "]."
        self.assertEqual([], validate(missing, PRECHECK, SOURCES))

    def test_acceptance_of_a_position_needs_the_acceptance_page_that_names_it(self):
        good = ("Position 3 nicht angenommen [doc-acceptance:p1:c1]. Differenz 1.200,00 EUR [" + INVOICE_ID + "]. "
                "Thiếu bằng chứng thanh toán [doc-payment:p1:c1].")
        self.assertEqual([], validate(good, PRECHECK, SOURCES))
        wrong_page = ("Position 3 nicht angenommen [doc-payment:p1:c1]. Differenz 1.200,00 EUR [" + INVOICE_ID + "]. "
                      "Thiếu bằng chứng thanh toán [doc-payment:p1:c1].")
        self.assertTrue(any(p.startswith("CITATION_DOES_NOT_SUPPORT_CLAIM line 3") for p in validate(wrong_page, PRECHECK, SOURCES)))

    def test_instruction_states_the_variance_and_asks_for_a_source_per_figure(self):
        text = question(PRECHECK, "de")
        self.assertIn("Phải nêu chênh lệch 1.200,00 EUR", text)
        self.assertIn("Mỗi số tiền kèm mã nguồn", text)

    def test_instruction_contains_no_square_brackets_and_keeps_every_rule(self):
        for locale in ("vi", "de", "en"):
            text = question(PRECHECK, locale)
            self.assertNotIn("[", text, locale)
            self.assertLess(len(text), 2000, locale)
            self.assertIn("Không tuyên bố hóa đơn đã được duyệt", text, locale)
            self.assertIn("lời chào chung", text, locale)


class RefusingApi:
    """Stands in for the Java refusal: HTTP 422 with the same small JSON body the API returns."""
    def __init__(self, code, reason=None):
        self.payload = {"code": code} if reason is None else {"code": code, "reason": reason}

    def post(self, path, body, allow_model=False):
        raise urllib.error.HTTPError(path, 422, "Unprocessable Entity", {}, io.BytesIO(json.dumps(self.payload).encode("utf-8")))


class UnfinishedApi:
    """Stands in for the Java 503 with an empty body: the local model did not finish a complete answer."""
    def post(self, path, body, allow_model=False):
        raise urllib.error.HTTPError(path, 503, "Service Unavailable", {}, io.BytesIO(b""))


class RefusalTests(unittest.TestCase):
    def test_citation_refusal_keeps_the_draft_and_names_only_the_reason(self):
        result = draft_with_nova(RefusingApi("MODEL_CITATION_CONTRACT_FAILED", "NON_SOURCE_BRACKET"), "CR-x", copy.deepcopy(PRECHECK), "de")
        self.assertEqual("NOVA_REFUSED_BY_CITATION_CONTRACT", result["status"])
        self.assertEqual(["MODEL_CITATION_CONTRACT_FAILED", "reason=NON_SOURCE_BRACKET"], result["problems"])
        self.assertEqual("", result["answer"])
        self.assertFalse(result["aiGenerated"])
        self.assertFalse(result["emailSent"])
        self.assertTrue(result["deterministicDraft"])

    def test_reason_text_that_is_not_a_code_is_not_echoed(self):
        result = draft_with_nova(RefusingApi("MODEL_CITATION_CONTRACT_FAILED", "Herr Müller"), "CR-x", copy.deepcopy(PRECHECK), "de")
        self.assertIn("reason=UNSPECIFIED", result["problems"])
        self.assertNotIn("Müller", json.dumps(result))

    def test_an_unfinished_generation_is_reported_and_the_draft_stays(self):
        # The Java API answers 503 with an empty body when the local model stops before a complete answer.
        api = UnfinishedApi()
        result = draft_with_nova(api, "CR-x", copy.deepcopy(PRECHECK), "de")
        self.assertEqual("NOVA_NOT_COMPLETED", result["status"])
        self.assertEqual(["MODEL_GENERATION_NOT_COMPLETED"], result["problems"])
        self.assertFalse(result["emailSent"])
        self.assertTrue(result["deterministicDraft"])

    def test_other_output_contract_is_refused_with_its_own_status(self):
        result = draft_with_nova(RefusingApi("MODEL_EVIDENCE_CONTRACT_FAILED", "EVIDENCE_NOT_VERIFIED"), "CR-x", copy.deepcopy(PRECHECK), "de")
        self.assertEqual("NOVA_REFUSED_BY_OUTPUT_CONTRACT", result["status"])
        self.assertFalse(result["emailSent"])

    def test_a_422_without_a_contract_code_is_not_swallowed(self):
        api = RefusingApi("AI_SAFETY_FILTER")
        precheck = copy.deepcopy(PRECHECK)
        with self.assertRaises(urllib.error.HTTPError) as raised:
            draft_with_nova(api, "CR-x", precheck, "de")
        raised.exception.close()

    def test_a_date_is_not_read_as_an_amount_but_a_sentence_final_amount_still_is(self):
        dated = ("Die Position 3 bleibt offen bis 15.12.2026 [doc-acceptance:p1:c1]. Differenz 1.200,00 EUR [" + INVOICE_ID + "]. "
                 "Thiếu bằng chứng thanh toán [doc-payment:p1:c1].")
        self.assertFalse(any(p.startswith("UNSUPPORTED_AMOUNT") for p in validate(dated, PRECHECK, SOURCES)))
        final = "Differenz 1.200,00 EUR [" + INVOICE_ID + "]. Erfundene Summe 9.999,00 EUR [" + INVOICE_ID + "]. Thiếu bằng chứng thanh toán [doc-payment:p1:c1]."
        self.assertTrue(any(p.startswith("UNSUPPORTED_AMOUNT") and "9999.00" in p for p in validate(final, PRECHECK, SOURCES)))

    def test_claimed_approval_of_the_invoice_is_refused(self):
        claim = "Die Rechnung wurde genehmigt, obwohl die Position 3 fehlt. Differenz 1.200,00 EUR [" + INVOICE_ID + "]."
        self.assertIn("CLAIMS_APPROVAL_PAYMENT_OR_SENDING", validate(claim, PRECHECK, SOURCES))
        self.assertNotIn("CLAIMS_APPROVAL_PAYMENT_OR_SENDING", validate("Die Rechnung wurde nicht genehmigt. Differenz 1.200,00 EUR [" + INVOICE_ID + "]. Thiếu bằng chứng thanh toán [doc-payment:p1:c1].", PRECHECK, SOURCES))

    def test_question_never_prints_a_python_list_with_brackets(self):
        # Line numbers are printed as plain text; "[3]" would be copied by the model and refused by the citation contract.
        text = question(PRECHECK, "de")
        self.assertIn("dòng chưa nghiệm thu: 3.", text)
        self.assertNotIn("[", text)
        self.assertNotIn("(doc", text)


if __name__ == "__main__":
    unittest.main()
