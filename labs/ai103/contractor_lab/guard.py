"""Self-approval / payment-release instructions inside untrusted text (PDF pages, emails).

Mirrors EvidenceGuard.approvalInstructions in the Java API so both sides agree on the fixtures. A match
is reported and the text is kept out of model context; it never triggers an action.
"""
from __future__ import annotations

import re
import unicodedata

AUTOMATED_APPROVAL = re.compile(
    r"(?iu)(?:\bautomatisch\w*\b.{0,40}\b(?:freigeben|genehmigen|bezahlen|überweisen|anweisen)"
    r"|\b(?:ki|ai|assistent\w*|assistant|llm|copilot|nova|chatbot|(?:ki|ai)[- ]agent\w*|sprachmodell|language model)\b.{0,120}\b(?:freigeben|genehmigen|approve|release (?:the )?payment|mark (?:it|this|the invoice) as (?:approved|reviewed|verified)|send .{0,30}(?:e-?mail|confirmation)|e-?mail .{0,60}senden)"
    r"|\bauto(?:matically)?[- ]approve|\bapprove\b.{0,40}\b(?:automatically|without (?:human )?review)"
    r"|(?:tự động|hãy|vui lòng)\s.{0,40}(?:phê duyệt|duyệt thanh toán|duyệt hóa đơn|chuyển khoản|gửi email)"
    r"|(?:\bai\b|trợ lý).{0,80}(?:phê duyệt|duyệt|chuyển khoản|gửi email))")


def approval_instructions(text: str) -> list[str]:
    found = []
    for line in (text or "").splitlines():
        normalized = re.sub(r"\s+", " ", "".join(c for c in unicodedata.normalize("NFKC", line) if unicodedata.category(c) != "Cf")).strip()
        if normalized and AUTOMATED_APPROVAL.search(normalized):
            found.append(normalized[:300])
    return found
