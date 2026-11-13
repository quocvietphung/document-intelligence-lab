"""Exercise 4 (speech): transcript checks, SSML, the multipart request, the live gate and telemetry safety."""
from __future__ import annotations

import io
import json
import unittest
import urllib.error
import xml.etree.ElementTree as ET
from unittest import mock

from contractor_lab import FIXTURES
from contractor_lab.azure_http import AzureCallError
from contractor_lab.cloud import LiveCallRefused
from contractor_lab.speech import (
    SITE_NOTE_WAV,
    build_ssml,
    check_transcript,
    fast_transcribe,
    listen_engine,
    multipart,
    parse_fast_transcription,
    reference_transcript,
    synthesize,
)

SAMPLE = json.loads((FIXTURES / "speech/azure-fast-transcription.sample.json").read_text(encoding="utf-8"))
MISHEARD = json.loads((FIXTURES / "speech/azure-fast-transcription.misheard.json").read_text(encoding="utf-8"))


class TranscriptTests(unittest.TestCase):
    def test_reference_transcript_keeps_code_gross_amount_and_currency(self):
        self.assertEqual({"invoiceCode": True, "grossAmount": True, "currency": True, "passed": True},
                         check_transcript(reference_transcript()["text"]))

    def test_sample_fast_transcription_response_maps_to_the_lab_shape(self):
        parsed = parse_fast_transcription(SAMPLE)
        self.assertEqual("azure-fast-transcription", parsed["source"])
        self.assertEqual(26600, parsed["durationMs"])
        self.assertIn("RG-2026-0457", parsed["text"])
        self.assertEqual("de-DE", parsed["phrases"][0]["locale"])
        self.assertTrue(check_transcript(parsed["text"])["passed"])

    def test_misheard_invoice_number_and_missing_currency_are_rejected(self):
        result = check_transcript(MISHEARD["combinedPhrases"][0]["text"])
        self.assertFalse(result["invoiceCode"], "RG-2026-0475 is not RG-2026-0457")
        self.assertFalse(result["currency"], "49.980,00 brutto has no currency word")
        self.assertTrue(result["grossAmount"])
        self.assertFalse(result["passed"])

    def test_listening_engine_is_always_named(self):
        self.assertTrue(listen_engine("browser").startswith("Browser voice"))
        self.assertTrue(listen_engine("azure").startswith("Azure Speech"))

    def test_the_synthetic_wav_is_mono_pcm16_at_16_khz(self):
        import wave
        with wave.open(str(SITE_NOTE_WAV)) as wav:
            self.assertEqual((1, 2, 16000), (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()))
            self.assertGreater(wav.getnframes() / wav.getframerate(), 20)


class SsmlTests(unittest.TestCase):
    def test_text_is_escaped_so_it_cannot_add_markup(self):
        ssml = build_ssml("Summe <b>1.200,00</b> & Rest. Ende.")
        root = ET.fromstring(ssml)
        self.assertEqual("speak", root.tag.split("}")[1])
        self.assertNotIn("<b>", ssml)
        self.assertIn("&lt;b&gt;", ssml)

    def test_voice_locale_matches_xml_lang(self):
        ssml = build_ssml("Hallo.", voice="de-DE-KatjaNeural")
        self.assertIn('xml:lang="de-DE"', ssml)
        self.assertIn('<voice name="de-DE-KatjaNeural">', ssml)

    def test_the_documented_example_is_well_formed_and_uses_a_german_voice(self):
        example = (FIXTURES / "speech/answer-de.ssml").read_text(encoding="utf-8")
        root = ET.fromstring(example)
        voice = root.find("{http://www.w3.org/2001/10/synthesis}voice")
        self.assertEqual("de-DE-KatjaNeural", voice.attrib["name"])
        self.assertEqual("de-DE", root.attrib["{http://www.w3.org/XML/1998/namespace}lang"])


class RequestAndGateTests(unittest.TestCase):
    def test_multipart_carries_the_definition_and_the_audio_parts(self):
        body, content_type = multipart({"definition": '{"locales": ["de-DE"]}'}, {"audio": ("note.wav", b"RIFF", "audio/wav")})
        boundary = content_type.split("boundary=")[1]
        self.assertIn(f"--{boundary}".encode(), body)
        self.assertIn(b'name="definition"', body)
        self.assertIn(b'name="audio"; filename="note.wav"', body)
        self.assertTrue(body.endswith(f"--{boundary}--\r\n".encode()))

    def test_live_speech_refuses_without_opt_in_and_makes_no_request(self):
        with mock.patch("urllib.request.urlopen", side_effect=AssertionError("network used")):
            with self.assertRaises(LiveCallRefused):
                fast_transcribe(SITE_NOTE_WAV, "token", {"AZURE_SPEECH_ENDPOINT": "https://x.cognitiveservices.azure.com"})
            with self.assertRaises(LiveCallRefused):
                synthesize("<speak/>", "token", {"AZURE_SPEECH_REGION": "westeurope"})

    def test_opt_in_for_another_service_still_refuses_speech(self):
        env = {"AI103_AZURE_OPT_IN": "billable-calls-approved", "AI103_AZURE_SERVICES": "translator",
               "AZURE_SPEECH_ENDPOINT": "https://x.cognitiveservices.azure.com"}
        with mock.patch("urllib.request.urlopen", side_effect=AssertionError("network used")), self.assertRaises(LiveCallRefused):
            fast_transcribe(SITE_NOTE_WAV, "token", env)

    def test_telemetry_of_a_failed_call_never_contains_the_response_body(self):
        body = io.BytesIO(b'{"error": "secret-response-body"}')
        error = urllib.error.HTTPError("https://x", 429, "Too Many Requests", {"apim-request-id": "req-123"}, body)
        env = {"AI103_AZURE_OPT_IN": "billable-calls-approved", "AI103_AZURE_SERVICES": "speech",
               "AZURE_SPEECH_ENDPOINT": "https://x.cognitiveservices.azure.com", "AZURE_SPEECH_REGION": "westeurope"}
        with mock.patch("urllib.request.urlopen", side_effect=error), self.assertRaises(AzureCallError) as raised:
            fast_transcribe(SITE_NOTE_WAV, "token", env)
        telemetry = json.dumps(raised.exception.telemetry)
        self.assertIn("req-123", telemetry)
        self.assertIn("429", telemetry)
        self.assertNotIn("secret-response-body", telemetry)
        self.assertNotIn("token", telemetry)


if __name__ == "__main__":
    unittest.main()
