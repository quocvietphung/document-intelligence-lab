"""Advanced exercise 4 – Voice Live, kept apart from Nova's read-aloud button.

A voice session is a small state machine over the documented Voice Live event names (learn.microsoft.com, read
2026-11-11): the client sends session.update, response.create, response.cancel and conversation.item.truncate, and
receives session.created/updated, input_audio_buffer.speech_started, response.created, response.audio.delta and
response.done. Barge-in is handled by the client: the documentation says the server's interrupt_response option is
only available with the azure semantic turn detectors, so this lab uses server_vad and cancels the answer itself.

Everything here runs on scripted events (mock). The live session needs the Voice Live endpoint, a model and the
official SDK sample; it is NOT run by this lab (see the status in docs/AI103_CONTRACTOR_PRECHECK.md).

Access rule: a spoken answer may only use sources of cases the person is allowed to open. Sources of other cases are
dropped before the answer is generated, and an answer that still cites them is refused.
"""
from __future__ import annotations

import re

PAGE_REQUEST = re.compile(r"(?iu)quellseite|zeige mir (?:die )?seite|source page|show (?:me )?the (?:source|page)|trang nguồn|xem trang")
CITATION = re.compile(r"\[([^\]\n]{1,150})\]")


class VoiceSession:
    def __init__(self, allowed_case_ids: set[str], answer_fn):
        self.allowed = set(allowed_case_ids)
        self.answer_fn = answer_fn
        self.outbox: list[dict] = []
        self.state = "IDLE"
        self.current: str | None = None
        self.item_id: str | None = None
        self.played_ms = 0
        self.cancelled: set[str] = set()
        self.late_deltas = 0
        self.barge_ins = 0
        self.last_answer: dict | None = None

    def send(self, event: dict) -> None:
        self.outbox.append(event)

    def start(self) -> None:
        # server_vad creates responses itself; interrupt_response is deliberately absent (azure semantic types only).
        self.send({"type": "session.update", "session": {
            "modalities": ["text", "audio"],
            "turn_detection": {"type": "server_vad", "create_response": True},
            "instructions": "Answer only from the supplied dossier sources and say when evidence is missing."}})

    def receive(self, event: dict) -> None:
        kind = event.get("type")
        if kind == "response.created":
            self.current = event["response"]["id"]
            self.state = "SPEAKING"
            self.played_ms = 0
        elif kind == "response.output_item.added":
            self.item_id = event["item"]["id"]
        elif kind == "response.audio.delta":
            if event["response_id"] in self.cancelled:
                self.late_deltas += 1
                return
            self.played_ms += int(event["duration_ms"])
        elif kind == "input_audio_buffer.speech_started":
            if self.state == "SPEAKING" and self.current:
                self.barge_ins += 1
                self.cancelled.add(self.current)
                self.send({"type": "response.cancel"})
                self.send({"type": "conversation.item.truncate", "item_id": self.item_id, "content_index": 0,
                           "audio_end_ms": self.played_ms})
                self.state = "LISTENING"
        elif kind == "response.done":
            if event["response"]["id"] == self.current and self.current not in self.cancelled:
                self.state = "IDLE"
        elif kind == "error":
            self.state = "ERROR"

    def ask(self, question: str) -> dict:
        if PAGE_REQUEST.search(question) and self.last_answer:
            return self.show_source()
        reply = self.answer_fn(question)
        allowed_sources = [s for s in reply["sources"] if s["caseId"] in self.allowed]
        dropped = len(reply["sources"]) - len(allowed_sources)
        allowed_ids = {s["id"] for s in allowed_sources}
        cited = [c for c in CITATION.findall(reply["answer"]) if c not in allowed_ids]
        if cited:
            return {"status": "ANSWER_REFUSED_CROSS_CASE_REFERENCE", "dropped": dropped}
        self.last_answer = {"answer": reply["answer"], "sources": allowed_sources}
        self.send({"type": "response.create", "response": {"instructions": reply["answer"]}})
        return {"status": "ANSWERED", "dropped": dropped, "sources": [s["id"] for s in allowed_sources]}

    def show_source(self) -> dict:
        if self.last_answer is None:
            return {"status": "NO_SOURCE"}
        sources = self.last_answer["sources"]
        if not sources:
            return {"status": "NO_SOURCE"}
        source = sources[0]
        if source["caseId"] not in self.allowed:
            return {"status": "SOURCE_NOT_ALLOWED"}
        return {"status": "SHOWN", "sourceId": source["id"], "caseId": source["caseId"]}


def scripted_events(answer_sources: list[dict]) -> list[dict]:
    """Server events for one answer that the person interrupts after 1200 ms of speech."""
    return [
        {"type": "session.created"},
        {"type": "response.created", "response": {"id": "resp-1"}},
        {"type": "response.output_item.added", "item": {"id": "item-1"}},
        {"type": "response.audio.delta", "response_id": "resp-1", "duration_ms": 400},
        {"type": "response.audio.delta", "response_id": "resp-1", "duration_ms": 400},
        {"type": "response.audio.delta", "response_id": "resp-1", "duration_ms": 400},
        {"type": "input_audio_buffer.speech_started", "audio_start_ms": 1234},
        {"type": "response.audio.delta", "response_id": "resp-1", "duration_ms": 400},
        {"type": "response.done", "response": {"id": "resp-1", "status": "cancelled"}},
    ]


def run_scenario(allowed_case_ids: set[str], case_id: str, sources: list[dict], answer_text: str) -> dict:
    """Question → spoken answer → barge-in → source page. Returns what was sent and what was shown."""
    def answer_fn(question: str) -> dict:
        return {"answer": answer_text, "sources": sources}
    session = VoiceSession(allowed_case_ids, answer_fn)
    session.start()
    session.receive({"type": "session.created"})
    question = session.ask("Warum weicht die Rechnung ab?")
    for event in scripted_events(sources)[1:]:
        session.receive(event)
    shown = session.ask("Zeige mir die Quellseite")
    return {"question": question, "shown": shown, "outbox": [e["type"] for e in session.outbox],
            "truncate": next((e for e in session.outbox if e["type"] == "conversation.item.truncate"), None),
            "lateDeltas": session.late_deltas, "bargeIns": session.barge_ins, "playedMs": session.played_ms,
            "state": session.state, "caseId": case_id}
