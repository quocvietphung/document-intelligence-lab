"""Compare observations without deciding which engine or transcription is correct."""
from __future__ import annotations

import re


def compare_observations(recorded: str, observed: str) -> dict:
    compact = lambda text: re.sub(r"\s+", " ", text).strip()
    numbers = lambda text: re.findall(r"(?<!\w)-?\d+(?:[.,]\d+)*(?!\w)", text)
    if not recorded.strip() or not observed.strip():
        status = "NOT_COMPARABLE"
    elif compact(recorded) == compact(observed):
        status = "AGREEMENT_NOT_VERIFIED"
    else:
        status = "DIFFERENT"
    return {"status": status, "numericDisagreement": bool(recorded.strip() and observed.strip() and numbers(recorded) != numbers(observed)),
            "recordedText": recorded, "independentOcrText": observed,
            "humanReviewRequired": True, "automaticCorrection": False}
