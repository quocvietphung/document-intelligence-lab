"""Exercise 4 (translator): identifiers, amounts and currency survive translation; the documented shapes parse."""
from __future__ import annotations

import json
import unittest
from unittest import mock

from contractor_lab import FIXTURES
from contractor_lab.cloud import LiveCallRefused
from contractor_lab.translator import (
    amounts,
    load_email,
    offline_translation,
    parse_translate_response,
    parse_transliterate_response,
    preservation_problems,
    run_offline,
    translate_live,
    transliterate_live,
)

SAMPLE = json.loads((FIXTURES / "translation/translate-response.sample.json").read_text(encoding="utf-8"))


class PreservationTests(unittest.TestCase):
    def setUp(self):
        self.email = load_email()
        self.reference = offline_translation()["text"]

    def test_reference_translation_keeps_identifier_amounts_and_currency(self):
        self.assertEqual([], preservation_problems(self.email["source"], self.reference, self.email["identifiers"]))

    def test_number_format_may_change_without_changing_the_value(self):
        target = "Final invoice RG-2026-0457 for EUR 49,980.00 gross and 1,008.40 EUR net, 42,000.00 net, 7,980.00 VAT"
        self.assertEqual([], preservation_problems(self.email["source"], target, ["RG-2026-0457"]))

    def test_a_lost_identifier_is_reported(self):
        problems = preservation_problems(self.email["source"], self.reference.replace("RG-2026-0457", "RG-2026-0475"), ["RG-2026-0457"])
        self.assertIn("IDENTIFIER_LOST RG-2026-0457", problems)

    def test_a_wrong_amount_is_reported(self):
        problems = preservation_problems(self.email["source"], self.reference.replace("49,980.00", "49,890.00"), ["RG-2026-0457"])
        self.assertIn("AMOUNT_NOT_PRESERVED 49980.00", problems)

    def test_a_changed_currency_is_reported(self):
        problems = preservation_problems(self.email["source"], self.reference.replace("EUR 49,980.00", "USD 49,980.00"), ["RG-2026-0457"])
        self.assertIn("CURRENCY_CHANGED 49980.00 EUR", problems)

    def test_currency_symbols_and_codes_are_read_the_same_way(self):
        self.assertEqual([("49980.00" and amounts("49.980,00 €", "de")[0][0], "EUR")], amounts("49.980,00 €", "de"))
        self.assertEqual(("49980.00", "EUR"), (str(amounts("EUR 49,980.00", "en")[0][0]), amounts("EUR 49,980.00", "en")[0][1]))

    def test_the_offline_suite_reports_each_failure_mode(self):
        result = run_offline()
        self.assertEqual([], result["problems"])
        self.assertTrue(result["lostIdentifier"] and result["wrongAmount"] and result["currencyChanged"])


class ResponseTests(unittest.TestCase):
    def test_documented_translate_response_yields_the_text(self):
        self.assertTrue(parse_translate_response(SAMPLE["response"]).startswith("Subject: Final invoice RG-2026-0457"))

    def test_documented_transliterate_response_yields_text_and_script(self):
        self.assertEqual({"text": "Primer Testov", "script": "Latn"},
                         parse_transliterate_response([{"text": "Primer Testov", "script": "Latn"}]))
        self.assertEqual("Пример Тестов", SAMPLE["transliterateSource"]["text"])
        self.assertEqual(("ru", "Cyrl", "Latn"), (SAMPLE["transliterateSource"]["language"], SAMPLE["transliterateSource"]["fromScript"],
                                                  SAMPLE["transliterateSource"]["toScript"]))

    def test_live_translation_refuses_without_opt_in(self):
        with mock.patch("urllib.request.urlopen", side_effect=AssertionError("network used")):
            with self.assertRaises(LiveCallRefused):
                translate_live("Hallo", "token", {})
            with self.assertRaises(LiveCallRefused):
                transliterate_live("Пример", "ru", "Cyrl", "Latn", "token", {})


if __name__ == "__main__":
    unittest.main()
