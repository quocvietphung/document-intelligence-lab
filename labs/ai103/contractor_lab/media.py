"""Exercises 2e and 2f – link acceptance photos and turn image/audio evidence into schema-valid JSON.

Local and real: PNG hashing and dimensions (stdlib), OCR of the burned-in caption with the local
Tesseract CLI (or the Docling OCR text the API already stored), WAV duration with `wave`, and rule-based
extraction. Mock: the speech-to-text step uses a reference transcript labelled `mock-reference-transcript`.
Azure AI Vision / Content Understanding / Speech can replace the mocked or missing semantic steps later
(cloud.py); the output schema stays the same.
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import struct
import subprocess
import wave
from datetime import datetime
from pathlib import Path

from . import DOSSIER, FIXTURES
from .schema import load, validate

PHOTO_ID = re.compile(r"\bF\s?-\s?([0-9OoIl]{2})\b")
DATE = re.compile(r"\b(\d{2})\.(\d{2})\.(\d{4})\b")
MONEY = re.compile(r"\d{1,3}(?:\.\d{3})*,\d{2}\s*EUR")
DEFECT = re.compile(r"(?iu)\b(fehlt|fehlend|beschädigt|mangel|riss|defect|missing|thiếu|hỏng)\b")


def photo_id(raw: str) -> str:
    return "F-" + raw.translate(str.maketrans("OoIl", "0011"))


def iso(day: str, month: str, year: str) -> str | None:
    try:
        return datetime(int(year), int(month), int(day)).date().isoformat()
    except ValueError:
        return None


def png_info(path: Path) -> dict:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError(f"{path.name} is not a PNG")
    width, height = struct.unpack(">II", data[16:24])
    return {"name": path.name, "sha256": hashlib.sha256(data).hexdigest(), "mediaType": "image/png", "width": width, "height": height}


def local_ocr(path: Path) -> str | None:
    """Real local OCR with Tesseract when installed; None (not an empty success) when it is not."""
    if not shutil.which("tesseract"):
        return None
    result = subprocess.run(["tesseract", str(path), "stdout", "-l", "eng", "--psm", "6"], capture_output=True, text=True, timeout=60, check=False)
    return result.stdout if result.returncode == 0 else None


def analyze_photo(path: Path, ocr_text: str | None, ocr_method: str, acceptance_text: str = "") -> dict:
    info = png_info(path)
    text = re.sub(r"[ \t]+", " ", ocr_text or "").strip()
    ids = [photo_id(m.group(1)) for m in PHOTO_ID.finditer(text)]
    date = DATE.search(text)
    # OCR reads the drawn "·" separator as ":", "-" or "•"; accept any of them between spaces.
    caption = [line.strip() for line in text.splitlines()
               if line.strip() and not PHOTO_ID.search(line) and not DATE.search(line)]
    parts = re.split(r"\s+[·:•|-]\s+", caption[0], maxsplit=1) if caption else []
    location, subject = (parts + [None, None])[:2] if parts else (None, None)
    defect_id = None
    if ids:
        mention = re.search(r"(Mangel\s+M-\d+)[^.\n]*" + re.escape(ids[0]), acceptance_text)
        defect_id = mention.group(1).replace("Mangel ", "") if mention else None
    return {
        "photoId": ids[0] if ids else None,
        "file": {"name": info["name"], "sha256": info["sha256"], "mediaType": info["mediaType"]},
        "image": {"width": info["width"], "height": info["height"]},
        "captionText": text,
        "capturedOn": iso(*date.groups()) if date else None,
        "location": location.strip() if location else None,
        "subject": subject.strip() if subject else None,
        "defectIndicated": bool(DEFECT.search(subject or "")) if subject else None,
        "linkedTo": {"acceptanceReference": "AP-2026-019" if ids and ids[0] in acceptance_text else None, "defectId": defect_id},
        "analysis": {"ocr": ocr_method, "semanticDescription": None, "semanticMethod": "not-run-local", "humanReviewRequired": True},
    }


def link_photos(referenced: list[str], analyses: list[dict]) -> dict:
    provided = {a["photoId"]: a for a in analyses if a["photoId"]}
    return {"referenced": referenced,
            "linked": [{"photoId": p, "file": provided[p]["file"]["name"], "sha256": provided[p]["file"]["sha256"],
                        "defectId": provided[p]["linkedTo"]["defectId"]} for p in referenced if p in provided],
            "missing": [p for p in referenced if p not in provided],
            "unreferenced": [p for p in provided if p not in referenced]}


def analyze_audio(transcript: dict, audio: Path | None = None) -> dict:
    duration = None
    if audio and audio.exists():
        with wave.open(str(audio), "rb") as handle:
            duration = round(handle.getnframes() / handle.getframerate(), 2)
    segments = transcript["segments"]
    full = " ".join(s["text"] for s in segments)
    date = DATE.search(full)
    defects, not_accepted = [], []
    for segment in segments:
        ids = [photo_id(m.group(1)) for m in PHOTO_ID.finditer(segment["text"])]
        if DEFECT.search(segment["text"]):
            defects.append({"text": segment["text"].strip(), "photoId": ids[0] if ids else None, "startSeconds": segment["start"]})
        if re.search(r"(?iu)nicht abgenommen|not accepted|chưa nghiệm thu", segment["text"]):
            not_accepted.append(segment["text"].strip())
    return {
        "memoId": transcript["memoId"], "language": transcript["language"],
        "recordedOn": iso(*date.groups()) if date else None,
        "transcriptSource": transcript["source"], "durationSeconds": duration if duration is not None else transcript.get("durationSeconds"),
        "audioFile": {"name": audio.name, "sha256": hashlib.sha256(audio.read_bytes()).hexdigest()} if audio and audio.exists() else None,
        "mentions": {"photos": sorted({photo_id(m.group(1)) for m in PHOTO_ID.finditer(full)}),
                     "documents": sorted(set(re.findall(r"\b(?:AP|WV|RG)-\d{4}-\d{3,4}\b", full)))},
        "defects": defects, "notAccepted": not_accepted,
        "amountsMentioned": MONEY.findall(full),
        "humanReviewRequired": True,
    }


def run_media(use_ocr: bool = True, audio: Path | None = None) -> dict:
    manifest = json.loads((DOSSIER / "manifest.json").read_text(encoding="utf-8"))
    acceptance_text = (FIXTURES / "acceptance-report.txt").read_text(encoding="utf-8")
    referenced = manifest["expected"]["photos"]["referenced"]
    analyses, ocr_used = [], None
    for item in (f for f in manifest["files"] if f["role"] == "acceptance-photo"):
        path = DOSSIER / item["file"]
        text = local_ocr(path) if use_ocr else None
        ocr_used = "tesseract-local" if text else "mock"
        if text is None:  # labelled fallback: the caption the generator drew, not an OCR result
            text = (FIXTURES / "photo-captions.json").read_text(encoding="utf-8")
            text = json.loads(text)[item["file"]]
        analyses.append(analyze_photo(path, text, ocr_used, acceptance_text))
    photo_schema, audio_schema = load(FIXTURES / "schemas/photo-evidence.schema.json"), load(FIXTURES / "schemas/audio-memo.schema.json")
    memo = analyze_audio(json.loads((FIXTURES / "site-memo.transcript.json").read_text(encoding="utf-8")), audio)
    links = link_photos(referenced, analyses)
    return {"photos": analyses, "photoErrors": {a["file"]["name"]: validate(a, photo_schema) for a in analyses},
            "links": links, "audio": memo, "audioErrors": validate(memo, audio_schema), "ocr": ocr_used}
