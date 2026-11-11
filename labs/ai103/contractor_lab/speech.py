"""Exercise 2f+ – speech: audio → transcript → Nova answer with sources → listen.

Offline (default): the synthetic site note is transcribed from its reference transcript (`mock`), so no network is used.
Live (opt-in only): Azure AI Speech fast transcription (speech to text) and text to speech (SSML). Both calls go through
`cloud.require_live("speech")` first; keys are never read, and the caller passes a Microsoft Entra bearer token on stdin.

Documented shapes this module follows (learn.microsoft.com, read 2026-11-11):
- fast transcription: POST {endpoint}/speechtotext/transcriptions:transcribe?api-version=2025-10-15, multipart parts
  "audio" and "definition"; response durationMilliseconds, combinedPhrases[], phrases[]. GA status of that version
  and the escaping of the definition part were NOT verified.
- text to speech: POST https://{region}.tts.speech.microsoft.com/cognitiveservices/v1 with an SSML body
  (Content-Type application/ssml+xml). The 16 kHz RIFF/WAV format is not in the documented list; this lab asks for
  riff-24khz-16bit-mono-pcm. Voices used: de-DE-KatjaNeural, vi-VN-HoaiMyNeural.
- speech translation is documented for the Speech SDK; the REST API page has no speech-to-speech guide. This lab
  therefore translates the transcript with the Translator text API (see translator.py).

Telemetry from live calls holds only the service, the operation, the duration, the HTTP status, an error type and the
correlation id. Request bodies, transcripts and audio are never logged.
"""
from __future__ import annotations

import json
import platform as host_platform
import re
import shutil
import subprocess
import uuid
from decimal import Decimal
from pathlib import Path
from xml.sax.saxutils import escape

from . import FIXTURES, OUTPUT
from .azure_http import AzureCallError, post
from .cloud import LiveCallRefused, require_live

SPEECH_API_VERSION = "2025-10-15"
TTS_OUTPUT_FORMAT = "riff-24khz-16bit-mono-pcm"
SITE_NOTE_WAV = FIXTURES / "speech/site-note-invoice.wav"
SITE_NOTE_REFERENCE = FIXTURES / "speech/site-note-invoice.transcript.json"
INVOICE_CODE = "RG-2026-0457"
INVOICE_AMOUNT = Decimal("49980.00")
INVOICE_CURRENCY = "EUR"
MONEY = re.compile(r"(?<![\d.,])(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)(?![\d,])")
CURRENCY_WORD = re.compile(r"(?i)\b(EUR|Euro)\b|€")


def reference_transcript() -> dict:
    data = json.loads(SITE_NOTE_REFERENCE.read_text(encoding="utf-8"))
    return {"source": data["source"], "locale": data["locale"], "text": " ".join(s["text"] for s in data["segments"])}


def parse_fast_transcription(body: dict) -> dict:
    """Maps the documented response to the lab's transcript shape. Missing keys stay empty; nothing is inferred."""
    phrases = [{"text": p.get("text", ""), "offsetMs": p.get("offsetMilliseconds"), "confidence": p.get("confidence"),
                "locale": p.get("locale")} for p in body.get("phrases", [])]
    text = " ".join(p.get("text", "") for p in body.get("combinedPhrases", []) if p.get("text"))
    return {"source": "azure-fast-transcription", "apiVersion": SPEECH_API_VERSION, "durationMs": body.get("durationMilliseconds"),
            "text": text, "phrases": phrases}


def multipart(fields: dict[str, str], files: dict[str, tuple[str, bytes, str]]) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    parts: list[bytes] = []
    for name, value in fields.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\nContent-Type: application/json\r\n\r\n{value}\r\n'.encode("utf-8"))
    for name, (filename, data, content_type) in files.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{filename}"\r\nContent-Type: {content_type}\r\n\r\n'.encode("utf-8")
                     + data + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def _post(service: str, operation: str, url: str, body: bytes, headers: dict[str, str], timeout: float, tracer=None) -> bytes:
    payload, _ = post(service, operation, url, body, headers, timeout, tracer)
    return payload


def fast_transcribe(wav: Path, token: str, env: dict, locales: tuple[str, ...] = ("de-DE",), tracer=None) -> dict:
    """Live speech to text. Refuses before any network call unless the billable opt-in names speech."""
    require_live("speech", env)
    endpoint = env["AZURE_SPEECH_ENDPOINT"].rstrip("/")
    definition = json.dumps({"locales": list(locales), "profanityFilterMode": "Masked"}, ensure_ascii=False)
    body, content_type = multipart({"definition": definition}, {"audio": (wav.name, wav.read_bytes(), "audio/wav")})
    url = f"{endpoint}/speechtotext/transcriptions:transcribe?api-version={env.get('AZURE_SPEECH_API_VERSION') or SPEECH_API_VERSION}"
    payload = _post("speech", "fast-transcription", url, body,
                    {"Authorization": f"Bearer {token}", "Content-Type": content_type}, 300, tracer)
    return parse_fast_transcription(json.loads(payload.decode("utf-8")))


def build_ssml(text: str, voice: str = "de-DE-KatjaNeural", pause_ms: int = 500) -> str:
    """SSML with the voice's locale as xml:lang. Text is escaped, so user or model text cannot add markup."""
    lang = "-".join(voice.split("-")[:2])
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]
    body = f'<break time="{pause_ms}ms" />'.join(escape(s) for s in sentences)
    return (f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="{lang}">'
            f'<voice name="{voice}">{body}</voice></speak>')


def synthesize(ssml: str, token: str, env: dict, tracer=None) -> bytes:
    """Live text to speech. The audio is returned to the caller; this lab never stores it outside .local/."""
    require_live("speech", env)
    region = env["AZURE_SPEECH_REGION"].strip()
    url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
    return _post("speech", "text-to-speech", url, ssml.encode("utf-8"),
                 {"Authorization": f"Bearer {token}", "Content-Type": "application/ssml+xml",
                  "X-Microsoft-OutputFormat": TTS_OUTPUT_FORMAT, "User-Agent": "ai103-contractor-lab"}, 120, tracer)


def _amount(text: str) -> Decimal | None:
    compact = text.replace(".", "").replace(",", ".")
    try:
        return Decimal(compact)
    except ArithmeticError:
        return None


def check_transcript(text: str) -> dict:
    """The invoice number, the gross amount and its currency must be heard exactly. Nothing is guessed."""
    code_ok = INVOICE_CODE in text
    amounts = []
    for match in MONEY.finditer(text):
        value = _amount(match.group(1))
        if value is None:
            continue
        window = text[match.end():match.end() + 12]
        amounts.append((value, bool(CURRENCY_WORD.search(window))))
    amount_ok = any(value == INVOICE_AMOUNT for value, _ in amounts)
    currency_ok = any(value == INVOICE_AMOUNT and currency for value, currency in amounts)
    return {"invoiceCode": code_ok, "grossAmount": amount_ok, "currency": currency_ok,
            "passed": code_ok and amount_ok and currency_ok}


def listen_engine(mode: str) -> str:
    """The label the app shows: the browser voice runs on the device; Azure Speech is an explicit opt-in."""
    if mode == "azure":
        return "Azure Speech (cloud voice, opt-in)"
    return "Browser voice (on this device)"


def answer_flow(transcript: str, ask_nova, precheck: dict) -> dict:
    """Transcript → question → Nova answer with sources → code checks. `ask_nova` returns {answer, sources}."""
    from .nova import validate
    reply = ask_nova(transcript)
    problems = validate(reply["answer"], precheck, reply["sources"])
    return {"question": transcript, "answer": reply["answer"], "sources": [s["id"] for s in reply["sources"]],
            "problems": problems, "status": "SUGGESTION_ACCEPTED_FOR_REVIEW" if not problems else "SUGGESTION_REJECTED_KEEP_DETERMINISTIC_DRAFT",
            "humanApproved": False, "emailSent": False}


def make_site_note(out: Path = SITE_NOTE_WAV) -> bool:
    """Regenerates the synthetic site note with the macOS voice. Needs `say` and `afconvert`."""
    if host_platform.system() != "Darwin" or not shutil.which("say") or not shutil.which("afconvert"):
        return False
    text = " ".join(s["text"] for s in json.loads(SITE_NOTE_REFERENCE.read_text(encoding="utf-8"))["segments"])
    out.parent.mkdir(parents=True, exist_ok=True)
    aiff = OUTPUT / "site-note-invoice.aiff"
    OUTPUT.mkdir(parents=True, exist_ok=True)
    subprocess.run(["say", "-v", "Anna", "-o", str(aiff), text], check=True)
    subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@16000", str(aiff), str(out)], check=True)
    aiff.unlink()
    return True


__all__ = ["AzureCallError", "LiveCallRefused", "answer_flow", "build_ssml", "check_transcript", "fast_transcribe",
           "listen_engine", "make_site_note", "multipart", "parse_fast_transcription", "reference_transcript", "synthesize"]
