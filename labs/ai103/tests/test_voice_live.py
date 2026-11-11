"""Exercise 4 (advanced): Voice Live session logic on scripted events, barge-in and the access rule."""
from __future__ import annotations

import unittest

from contractor_lab.voice_live import VoiceSession, run_scenario, scripted_events

CASE_A, CASE_B = "CR-contractor-a", "CR-other-case"


class VoiceLiveTests(unittest.TestCase):
    def test_session_uses_server_vad_and_no_interrupt_option(self):
        session = VoiceSession({CASE_A}, lambda q: {"answer": "x", "sources": []})
        session.start()
        update = session.outbox[0]
        self.assertEqual("session.update", update["type"])
        self.assertEqual("server_vad", update["session"]["turn_detection"]["type"])
        self.assertNotIn("interrupt_response", update["session"]["turn_detection"])

    def test_barge_in_cancels_and_truncates_at_the_played_position(self):
        result = run_scenario({CASE_A}, CASE_A, [{"id": "doc-inv:p1:c1", "caseId": CASE_A, "text": "x"}], "Die Differenz ist offen [doc-inv:p1:c1].")
        self.assertEqual(["session.update", "response.create", "response.cancel", "conversation.item.truncate"], result["outbox"])
        self.assertEqual({"type": "conversation.item.truncate", "item_id": "item-1", "content_index": 0, "audio_end_ms": 1200},
                         result["truncate"])
        self.assertEqual(1, result["bargeIns"])
        self.assertEqual(1200, result["playedMs"], "the late 400 ms delta after the interruption is not counted")
        self.assertEqual(1, result["lateDeltas"])

    def test_source_page_request_after_the_interruption_shows_the_allowed_source(self):
        result = run_scenario({CASE_A}, CASE_A, [{"id": "doc-inv:p1:c1", "caseId": CASE_A, "text": "x"}], "Antwort [doc-inv:p1:c1].")
        self.assertEqual({"status": "SHOWN", "sourceId": "doc-inv:p1:c1", "caseId": CASE_A}, result["shown"])

    def test_sources_of_another_case_are_dropped_before_the_answer_is_spoken(self):
        session = VoiceSession({CASE_A}, lambda q: {"answer": "Belegt durch Quelle A [doc-a:p1:c1].",
                                                    "sources": [{"id": "doc-a:p1:c1", "caseId": CASE_A, "text": "a"},
                                                                {"id": "doc-b:p1:c1", "caseId": CASE_B, "text": "b"}]})
        reply = session.ask("Was ist offen?")
        self.assertEqual(1, reply["dropped"])
        self.assertEqual(["doc-a:p1:c1"], reply["sources"])
        self.assertEqual(["response.create"], [e["type"] for e in session.outbox], "only the allowed answer is sent")

    def test_an_answer_that_still_cites_another_case_is_refused(self):
        session = VoiceSession({CASE_A}, lambda q: {"answer": "Siehe Akte [doc-b:p1:c1].",
                                                    "sources": [{"id": "doc-b:p1:c1", "caseId": CASE_B, "text": "b"}]})
        self.assertEqual("ANSWER_REFUSED_CROSS_CASE_REFERENCE", session.ask("Was steht in Akte B?")["status"])
        self.assertEqual([], [e for e in session.outbox if e["type"] == "response.create"])

    def test_a_source_page_request_for_another_case_is_refused(self):
        session = VoiceSession({CASE_A}, lambda q: {"answer": "ok [doc-x:p1:c1].", "sources": [{"id": "doc-x:p1:c1", "caseId": CASE_B, "text": "b"}]})
        session.allowed = {CASE_A}
        session.last_answer = {"answer": "ok", "sources": [{"id": "doc-x:p1:c1", "caseId": CASE_B, "text": "b"}]}
        self.assertEqual("SOURCE_NOT_ALLOWED", session.ask("Zeige mir die Quellseite")["status"])

    def test_state_returns_to_idle_when_the_answer_completes_without_interruption(self):
        session = VoiceSession({CASE_A}, lambda q: {"answer": "x", "sources": []})
        session.receive({"type": "response.created", "response": {"id": "r9"}})
        session.receive({"type": "response.done", "response": {"id": "r9", "status": "completed"}})
        self.assertEqual("IDLE", session.state)
        self.assertEqual(0, session.barge_ins)

    def test_scripted_events_cover_the_documented_names(self):
        names = {event["type"] for event in scripted_events([])}
        self.assertLessEqual(names, {"session.created", "response.created", "response.output_item.added", "response.audio.delta",
                                     "input_audio_buffer.speech_started", "response.done"})


if __name__ == "__main__":
    unittest.main()
