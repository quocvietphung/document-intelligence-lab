"""Exercise 2b – Nova (local Ollama through the Java API) words a summary and an email draft.

Nova receives only figures the Java pre-check already computed, plus its own authorized retrieval. Its reply is
checked claim by claim before anyone sees it as a suggestion:

- every amount must be one of the computed amounts;
- a stated amount (an amount that is printed on a page) must be cited to a source whose text contains it;
- a computed amount (the difference, the unapproved net or gross) must at least cite a source;
- an affirmative acceptance, payment or invoice-line claim must cite a source that actually contains that text or
  line amount; a statement that something is missing needs no citation;
- missing evidence must be mentioned, and nothing may claim approval, payment or sending.

A citation that points to an existing source with the wrong content is rejected like a missing one. Square brackets are
reserved for source IDs: a placeholder such as [Name] is refused by the Java API with a reason code, and the lab keeps
the deterministic draft. Sources from a quarantined page are never sent to the model.
"""
from __future__ import annotations

import json
import re
import time
import urllib.error
from decimal import Decimal

# An amount is not followed by another digit group: "15.12.2026" is a date, not the amount 15.12.
MONEY = re.compile(r"(?<![\d.,])(\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2}|\d+[.,]\d{2})(?![\d])(?![.,]\d)")
CITATION = re.compile(r"\[([^\]\n]{1,150})\]")
# An affirmative approval, payment or sending claim. A negated form ("nicht genehmigt", "chưa thanh toán") is not a claim.
_NOT_NEGATED = r"(?<!nicht )(?<!not )(?<!chưa )(?<!không )\b(?:"
CLAIM_PATTERNS = [re.compile(r"(?iu)" + _NOT_NEGATED + pattern + r")") for pattern in (
    r"wurde (?:zur zahlung )?freigegeben|ist freigegeben|wurde (?:bereits |vollständig )?genehmigt|ist genehmigt",
    r"wurde (?:bereits )?(?:bezahlt|versendet|gesendet)",
    r"has been (?:approved|paid|sent)|was (?:approved|paid|sent)|approved for payment",
    r"đã được (?:phê duyệt|duyệt|thanh toán)|đã (?:phê duyệt|thanh toán|gửi email|gửi)",
)]
MISSING_WORDS = re.compile(r"(?iu)(thiếu|chưa có|không có|fehlt|kein(?:e|en)? (?:zahlungs|abnahme)|missing|no payment)")
# A sentence that says something is absent or negated describes the evidence set, so it needs no citation.
ABSENCE = re.compile(r"(?iu)(thiếu|chưa|không|\bfehlt\w*|\bnicht\b|\bkein\w*|\bmissing\b|\bno\b|\bnot\b)")
PAYMENT = re.compile(r"(?iu)(zahlung|bezahlt|payment|\bpaid\b|thanh toán)")
PAYMENT_SOURCE = re.compile(r"(?iu)(zahlung|bezahlt|überweisung|payment|\bpaid\b|thanh toán)")
ACCEPTANCE_SENTENCE = re.compile(r"(?iu)abnahme|abgenommen|angenommen|acceptance|accepted|nghiệm thu")
ACCEPTANCE_SOURCE = re.compile(r"(?iu)abnahme|abgenommen|angenommen|acceptance|accepted|nghiệm thu")
LINE_SENTENCE = re.compile(r"(?iu)\b(?:position|pos\.?|dòng|line|zeile)\s*(\d{1,2})\b")
CITATION_CODE = "MODEL_CITATION_CONTRACT_FAILED"
OUTPUT_CONTRACT_CODES = {CITATION_CODE, "MODEL_EVIDENCE_CONTRACT_FAILED"}
REASON = re.compile(r"[A-Z_]{1,40}")


def question(precheck: dict, locale: str = "vi") -> str:
    """A bounded instruction (≤ 2000 characters) built only from computed values."""
    approved, invoice, variance = precheck["approved"], precheck["invoice"], precheck["variance"]
    lines = [l for l in precheck["invoiceLines"] if not l["approved"]]
    acceptance, payment = precheck["evidence"]["acceptance"], precheck["evidence"]["payment"]
    # Facts avoid round brackets: a model copies the notation it reads, and a source written in round brackets is not a
    # citation under the contract (the Java API accepts only square-bracket source IDs).
    facts = (f"Đã duyệt {de(approved['amount'])} EUR brutto, nguồn {approved['source']['documentName']} trang {approved['source']['page']}; "
             f"hóa đơn {invoice.get('number')} {de(invoice['amount'])} EUR brutto, nguồn {invoice['source']['documentName']} trang {invoice['source']['page']}; "
             f"chênh lệch {de(variance['amount'])} EUR cùng cơ sở brutto. "
             + "".join(f"Dòng {l['position']}: {l['description']}, {de(l['net'])} EUR netto, không có Nachtrag duyệt. " for l in lines)
             + f"Nghiệm thu: {acceptance['status']}, dòng chưa nghiệm thu: {_positions(acceptance.get('notAcceptedPositions'))}. "
             + f"Bằng chứng thanh toán: {payment['status']}.")
    # Local Nova stops at 420 output tokens (LocalAiConfiguration.numPredict) and rejects cut-off answers,
    # so the request is word-capped; Vietnamese needs roughly two tokens per word.
    ask = {"vi": "Viết bằng tiếng Việt, tổng cộng tối đa 110 từ: (1) tóm tắt 2 câu cho kế toán, (2) email nháp tối đa 4 câu gửi nhà thầu yêu cầu bổ sung chứng từ. ",
           "de": "Schreibe auf Deutsch, höchstens 110 Wörter: (1) Zusammenfassung in 2 Sätzen für die Buchhaltung, (2) E-Mail-Entwurf an den Auftragnehmer, höchstens 4 Sätze. ",
           "en": "Write in English, at most 110 words: (1) a 2-sentence summary for accounting, (2) an email draft to the contractor of at most 4 sentences. "}[locale if locale in ("de", "en") else "vi"]
    # No square bracket appears in the instruction itself: a model copies bracket text, and Java refuses any bracket
    # that is not a source ID.
    rules = ("Viết mã nguồn trong dấu ngoặc vuông ngay sau số liệu, đúng như trong dữ liệu; không dùng dấu ngoặc tròn cho mã nguồn. "
             "Không dùng ngoặc vuông cho tên, ngày, số trang, tên file hay ghi chú. "
             "Email dùng lời chào chung, không có tên người nhận hay chỗ trống. "
             f"Phải nêu chênh lệch {de(variance['amount'])} EUR. Mỗi số tiền kèm mã nguồn của đúng trang chứa số đó. "
             "Chỉ dùng các số đã cho, giữ nguyên định dạng. Nói rõ chứng từ còn thiếu. "
             "Không tuyên bố hóa đơn đã được duyệt, đã thanh toán hay email đã gửi; đây là bản nháp chờ người duyệt.")
    return (ask + "Dữ kiện đã tính bằng code: " + facts + " " + rules)[:2000]


def de(amount: str | None) -> str:
    if amount is None:
        return "?"
    integer, cents = amount.split(".")
    return f"{int(integer):,}".replace(",", ".") + "," + cents


def _positions(value) -> str:
    """Line numbers as plain text. A Python list would print square brackets, which the citation contract refuses."""
    if isinstance(value, (list, tuple)):
        return ", ".join(str(item) for item in value) if value else "không có"
    return "không có" if value in (None, "") else str(value)


def stated_amounts(precheck: dict) -> set[Decimal]:
    """Amounts printed on a page: they need a citation whose text contains them."""
    values: set[Decimal] = set()
    def add(value):
        if value not in (None, ""):
            values.add(Decimal(str(value)))
    add(precheck["approved"].get("amount")); add(precheck["invoice"].get("amount"))
    add(precheck["invoice"].get("net")); add(precheck["invoice"].get("vat"))
    cross = precheck["approved"].get("crossCheck") or {}
    add(cross.get("order")); add(cross.get("changeOrders"))
    for line in precheck["invoiceLines"]:
        add(line["net"])
    return values


def computed_amounts(precheck: dict) -> set[Decimal]:
    """Amounts derived in code (difference, VAT and unapproved parts): they need a citation, not a literal match."""
    values: set[Decimal] = set()
    for value in (precheck["variance"].get("amount"), precheck["variance"].get("net"), precheck["variance"].get("vat"),
                  (precheck.get("explanation") or {}).get("unapprovedNet"), (precheck.get("explanation") or {}).get("unapprovedGross"),
                  (precheck["approved"].get("crossCheck") or {}).get("sum")):
        if value not in (None, ""):
            values.add(Decimal(str(value)))
    return values


def allowed_amounts(precheck: dict) -> set[Decimal]:
    return stated_amounts(precheck) | computed_amounts(precheck)


def parse_amount(text: str) -> Decimal | None:
    compact = text.replace(" ", "")
    if re.fullmatch(r"\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}", compact):
        return Decimal(compact.replace(".", "").replace(",", "."))
    if re.fullmatch(r"\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2}", compact):
        return Decimal(compact.replace(",", ""))
    return None


def money_values(text: str) -> set[Decimal]:
    return {value for value in (parse_amount(m.group(1)) for m in MONEY.finditer(text)) if value is not None}


def sentences(answer: str) -> list[str]:
    # Split only after a sentence mark followed by a space, so "49.980,00" is never cut.
    return [part.strip() for part in re.split(r"(?<=[.!?;])\s+|\n+", answer) if part.strip()]


def _without_citations(text: str) -> str:
    return CITATION.sub(" ", text)


def _amount_problems(body: str, cited: list[str], cited_texts: list[str], stated: set[Decimal], computed: set[Decimal]) -> list[str]:
    problems: list[str] = []
    for amount in {parse_amount(m.group(1)) for m in MONEY.finditer(body)} - {None}:
        if amount in stated:
            if not cited:
                problems.append(f"UNCITED_AMOUNT {amount}")
            elif cited_texts and not any(amount in money_values(text) for text in cited_texts):
                problems.append(f"CITATION_DOES_NOT_SUPPORT_AMOUNT {amount} {cited}")
        elif amount in computed and not cited:
            problems.append(f"UNCITED_AMOUNT {amount}")
    return problems


def _topic_problems(body: str, cited: list[str], cited_texts: list[str], topic: re.Pattern, source: re.Pattern, label: str) -> list[str]:
    """An affirmative acceptance or payment statement needs a cited page that is about that topic."""
    if ABSENCE.search(body) or not topic.search(body):
        return []
    if not cited:
        return [f"UNCITED_CLAIM {label}"]
    if cited_texts and not any(source.search(text) for text in cited_texts):
        return [f"CITATION_DOES_NOT_SUPPORT_CLAIM {label} {cited}"]
    return []


def _line_problems(body: str, cited: list[str], cited_texts: list[str], lines: dict[str, dict]) -> list[str]:
    problems: list[str] = []
    for number in LINE_SENTENCE.findall(body):
        line = lines.get(number)
        if line is None:
            continue
        if not cited:
            problems.append(f"UNCITED_CLAIM line {number}")
        elif cited_texts and not any(_line_supported(text, number, line, body) for text in cited_texts):
            problems.append(f"CITATION_DOES_NOT_SUPPORT_CLAIM line {number} {cited}")
    return problems


def claim_problems(answer: str, precheck: dict, ids: list[str], texts: dict[str, str]) -> list[str]:
    problems: list[str] = []
    stated, computed = stated_amounts(precheck), computed_amounts(precheck)
    lines = {str(line["position"]): line for line in precheck["invoiceLines"]}
    for sentence in sentences(answer):
        cited = [c for c in CITATION.findall(sentence) if c in ids]
        cited_texts = [texts[c] for c in cited if c in texts]
        body = _without_citations(sentence)
        problems += _amount_problems(body, cited, cited_texts, stated, computed)
        problems += _topic_problems(body, cited, cited_texts, ACCEPTANCE_SENTENCE, ACCEPTANCE_SOURCE, "acceptance")
        problems += _topic_problems(body, cited, cited_texts, PAYMENT, PAYMENT_SOURCE, "payment")
        problems += _line_problems(body, cited, cited_texts, lines)
    return problems


def _line_supported(text: str, number: str, line: dict, sentence: str) -> bool:
    """A line claim needs the line's amount, or, for an acceptance statement, an acceptance page that names the position."""
    if Decimal(str(line["net"])) in money_values(text):
        return True
    names_position = re.search(rf"(?iu)(?:position|pos\.?|dòng|line|zeile)\s*{number}\b", text) is not None
    return bool(ACCEPTANCE_SENTENCE.search(sentence) and ACCEPTANCE_SOURCE.search(text) and names_position)


def validate(answer: str, precheck: dict, sources: list) -> list[str]:
    """`sources` holds ids (strings) or {"id", "text"} objects. Text enables the claim-level checks."""
    ids: list[str] = []
    texts: dict[str, str] = {}
    for source in sources:
        if isinstance(source, str):
            ids.append(source)
        else:
            ids.append(source["id"])
            if source.get("text") is not None:
                texts[source["id"]] = source["text"]
    problems = []
    allowed = allowed_amounts(precheck)
    seen = {parse_amount(m.group(1)) for m in MONEY.finditer(_without_citations(answer))} - {None}
    invented = sorted(str(v) for v in seen if v not in allowed)
    if invented:
        problems.append(f"UNSUPPORTED_AMOUNT {invented}")
    if Decimal(precheck["variance"]["amount"] or "0") not in seen:
        problems.append("VARIANCE_NOT_STATED")
    if any(pattern.search(answer) for pattern in CLAIM_PATTERNS):
        problems.append("CLAIMS_APPROVAL_PAYMENT_OR_SENDING")
    if precheck["evidence"]["payment"]["status"] == "MISSING" and not MISSING_WORDS.search(answer):
        problems.append("MISSING_EVIDENCE_NOT_MENTIONED")
    cited = CITATION.findall(answer)
    unknown = [c for c in cited if c not in ids]
    if unknown:
        # Covers placeholders such as [Name]: any square-bracket text that is not an authorized source ID.
        problems.append(f"UNKNOWN_CITATION {unknown[:3]}")
    if not cited:
        problems.append("NO_CITATION")
    problems.extend(claim_problems(answer, precheck, ids, texts))
    return problems


def _refs(precheck: dict) -> list[str]:
    refs = [(precheck["approved"].get("source") or {}).get("ref"), (precheck["invoice"].get("source") or {}).get("ref")]
    refs += [(line.get("source") or {}).get("ref") for line in precheck["invoiceLines"]]
    return [ref.strip("[]") for ref in refs if ref]


def _refusal_body(error: urllib.error.HTTPError) -> dict:
    """The Java refusal body carries a code and a reason only. Anything else is treated as unknown."""
    try:
        body = json.loads(error.read().decode("utf-8", "replace") or "{}")
    except (OSError, ValueError):
        body = {}
    finally:
        error.close()
    return body if isinstance(body, dict) else {}


def draft_with_nova(api, case_id: str, precheck: dict, locale: str = "vi") -> dict:
    """Calls the existing Nova endpoint once (local Ollama in the default stack). Several minutes on CPU."""
    started = time.monotonic()
    isolated = set(precheck.get("isolatedPages", []))
    if any(ref in isolated for ref in _refs(precheck)):
        # A figure taken from a quarantined page must not reach the model; the deterministic draft stays.
        return {"status": "SKIPPED_ISOLATED_SOURCE", "problems": ["SOURCE_QUARANTINED_FROM_MODEL_CONTEXT"], "mode": None,
                "aiGenerated": False, "humanApproved": False, "emailSent": False, "durationMs": 0, "answer": "", "sources": [],
                "deterministicDraft": precheck["draft"]["summary"]}
    try:
        reply = api.post("/api/assistant/chat", {"caseId": case_id, "locale": locale, "question": question(precheck, locale),
                                                  "caseVersion": precheck["caseVersion"]}, allow_model=True)
    except urllib.error.HTTPError as refused:
        body = _refusal_body(refused)
        code = body.get("code")
        if refused.code == 503 and code is None:
            # The Java API could not finish a local generation (the output budget was reached or no answer came back).
            # Nothing is sent; the deterministic draft stays and the run is reported, not crashed.
            return {"status": "NOVA_NOT_COMPLETED", "problems": ["MODEL_GENERATION_NOT_COMPLETED"],
                    "mode": "local-ollama", "aiGenerated": False, "humanApproved": False, "emailSent": False,
                    "durationMs": round((time.monotonic() - started) * 1000), "answer": "", "sources": [],
                    "deterministicDraft": precheck["draft"]["summary"]}
        if code not in OUTPUT_CONTRACT_CODES:
            raise
        # The Java API refused an answer it could not verify. Nothing is sent and the deterministic draft stays.
        reason = str(body.get("reason", ""))
        return {"status": "NOVA_REFUSED_BY_CITATION_CONTRACT" if code == CITATION_CODE else "NOVA_REFUSED_BY_OUTPUT_CONTRACT",
                "problems": [code, f"reason={reason if REASON.fullmatch(reason) else 'UNSPECIFIED'}"],
                "mode": "local-ollama", "aiGenerated": False, "humanApproved": False, "emailSent": False,
                "durationMs": round((time.monotonic() - started) * 1000), "answer": "", "sources": [],
                "deterministicDraft": precheck["draft"]["summary"]}
    sources = reply.get("sources", [])
    problems = validate(reply.get("answer", ""), precheck, sources)
    return {"status": "SUGGESTION_ACCEPTED_FOR_REVIEW" if not problems else "SUGGESTION_REJECTED_KEEP_DETERMINISTIC_DRAFT",
            "problems": problems, "mode": reply.get("mode"), "aiGenerated": True, "humanApproved": False, "emailSent": False,
            "durationMs": round((time.monotonic() - started) * 1000), "answer": reply.get("answer", ""),
            "sources": [s["id"] if isinstance(s, dict) else s for s in sources],
            "deterministicDraft": precheck["draft"]["summary"]}
