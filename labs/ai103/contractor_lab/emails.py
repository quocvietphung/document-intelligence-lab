"""Exercise 2d – classify contractor emails and mask simulated PII before any model sees them.

Deterministic rules, local and offline. Masking replaces e-mail addresses, phone numbers, IBANs, VAT
IDs and person names with stable placeholders ([EMAIL_1], [PERSON_2], ...). The placeholder map is
returned separately so a reviewer can unmask locally; masked text alone contains no identifier.
Azure AI Language (PII detection, custom classification) is the opt-in cloud counterpart (cloud.py).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from .guard import approval_instructions

PATTERNS = [
    ("EMAIL", re.compile(r"[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}")),
    ("IBAN", re.compile(r"\b[A-Z]{2}\d{2}(?:\s?[0-9A-Z]{4}){3,7}(?:\s?[0-9A-Z]{1,4})?\b")),
    ("TAX_ID", re.compile(r"\b(?:USt-IdNr\.?|VAT ID|MST)\s*:?\s*([A-Z]{2}\d{9,12})\b")),
    # Must start with +country code or a trunk 0, and must not continue a reference like WV-2026-031.
    ("PHONE", re.compile(r"(?<![\w-])(?:\+\d{2,3}[\s/-]?|0)\d{1,4}[\s/-]\d{3,}(?:[\s/-]\d{2,})*(?![\w-])")),
]
TITLED_NAME = re.compile(r"\b(?:Herr|Frau|Mr\.?|Ms\.?|Mrs\.?|anh|chị|ông|bà)\s+((?:[A-ZÄÖÜĐ][\wäöüßàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ-]+\s?){1,3})")
SIGNATURE = re.compile(r"(?m)^(?:Mit freundlichen Grüßen|Viele Grüße|Best regards|Kind regards|Trân trọng),?\s*\n\s*([A-ZÄÖÜĐ][^\n,]{2,60})$")

CATEGORIES = ("APPROVAL_INSTRUCTION", "BANK_DETAILS_CHANGE", "INVOICE_SUBMISSION", "ACCEPTANCE_EVIDENCE",
              "PAYMENT_STATUS_REQUEST", "CHANGE_ORDER", "OTHER")
RULES = [
    ("BANK_DETAILS_CHANGE", re.compile(r"(?iu)(neue|geänderte|new|changed|updated) (bankverbindung|bank details|bank account|iban)|tài khoản (ngân hàng )?mới|đổi (số )?tài khoản")),
    ("INVOICE_SUBMISSION", re.compile(r"(?iu)(rechnung|invoice|hóa đơn)\b.{0,80}(anbei|im anhang|attached|đính kèm)|(anbei|attached|đính kèm).{0,80}(rechnung|invoice|hóa đơn)")),
    ("ACCEPTANCE_EVIDENCE", re.compile(r"(?iu)(abnahme|abnahmeprotokoll|acceptance|nghiệm thu|foto f-\d{2})")),
    ("PAYMENT_STATUS_REQUEST", re.compile(r"(?iu)(zahlungseingang|wann .{0,30}(bezahlt|überwiesen)|payment status|when .{0,30}paid|đã thanh toán chưa|khi nào .{0,30}thanh toán)")),
    ("CHANGE_ORDER", re.compile(r"(?iu)(nachtrag|change order|phụ lục|zusatzleistung)")),
]
HIGH_RISK = {"APPROVAL_INSTRUCTION", "BANK_DETAILS_CHANGE"}


def classify(email: dict) -> dict:
    text = f"{email['subject']}\n{email['body']}"
    instructions = approval_instructions(text)
    category = "APPROVAL_INSTRUCTION" if instructions else next((name for name, rule in RULES if rule.search(text)), "OTHER")
    reasons = ["embedded approval/payment instruction"] if instructions else [f"rule {category}"]
    return {"id": email["id"], "category": category, "risk": "HIGH" if category in HIGH_RISK else "NORMAL",
            "reasons": reasons, "requiresHumanReview": True, "automaticAction": None}


class Masker:
    """Stable placeholders across several fields of one message ([PERSON_1] is the same person everywhere)."""

    def __init__(self, names: list[str] | None = None):
        self.names = names or []
        self.mapping: dict[str, str] = {}
        self._reverse: dict[tuple[str, str], str] = {}
        self._counters: dict[str, int] = {}

    def mask(self, text: str) -> str:
        text = text[:20_000]  # bounded input keeps the regexes linear in practice
        found: list[tuple[int, int, str]] = []
        for kind, pattern in PATTERNS:
            for match in pattern.finditer(text):
                start, end = match.span(1) if kind == "TAX_ID" else match.span()
                found.append((start, end, kind))
        for pattern in (TITLED_NAME, SIGNATURE):
            for match in pattern.finditer(text):
                found.append((*match.span(1), "PERSON"))
        for name in self.names:
            for match in re.finditer(re.escape(name), text):
                found.append((*match.span(), "PERSON"))
        found.sort(key=lambda item: (item[0], -(item[1] - item[0])))
        out, cursor = [], 0
        for start, end, kind in found:
            if start < cursor:
                continue
            raw = text[start:end]
            original = raw.strip()
            key = (kind, original)
            if key not in self._reverse:
                self._counters[kind] = self._counters.get(kind, 0) + 1
                self._reverse[key] = f"[{kind}_{self._counters[kind]}]"
                self.mapping[self._reverse[key]] = original
            out += [text[cursor:start], self._reverse[key], raw[len(raw.rstrip()):]]
            cursor = end
        out.append(text[cursor:])
        return "".join(out)

    def counts(self) -> dict[str, int]:
        return {kind: self._counters.get(kind, 0) for kind in ("EMAIL", "PHONE", "IBAN", "TAX_ID", "PERSON")}


def mask(text: str, names: list[str] | None = None) -> tuple[str, dict[str, str]]:
    """Return masked text and the placeholder → original map (keep the map local)."""
    masker = Masker(names)
    return masker.mask(text), masker.mapping


def residual_pii(text: str, known: list[str]) -> list[str]:
    """Anything that still looks like an identifier after masking (should be empty)."""
    leftovers = [m.group() for _, pattern in PATTERNS for m in pattern.finditer(text)]
    leftovers += [name for name in known if name in text]
    return leftovers


def triage(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    known = data["knownPeople"]
    results = []
    for email in data["emails"]:
        decision = classify(email)
        masker = Masker(known)
        masked = {"from": masker.mask(email["from"]), "subject": masker.mask(email["subject"]), "maskedBody": masker.mask(email["body"])}
        decision.update({**masked, "maskedCounts": masker.counts(),
                         "residualPii": residual_pii("\n".join(masked.values()), known),
                         "expected": email["expected"]})
        results.append(decision)
    correct = sum(1 for r in results if r["category"] == r["expected"]["category"])
    return {"emails": results, "accuracy": f"{correct}/{len(results)}",
            "passed": correct == len(results) and all(not r["residualPii"] for r in results)
                      and all(r["maskedCounts"][k] >= v for r in results for k, v in r["expected"]["minMasked"].items())}
