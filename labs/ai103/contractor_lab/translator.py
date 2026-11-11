"""Exercise 3b – Azure AI Translator on a fictional contractor e-mail (German → English).

Offline (default): the English reference translation is used (`mock`), so no network is touched. The same fixture
feeds the live adapter's tests, so both paths are checked against one set of identifiers, amounts and currencies.

Live (opt-in only, `cloud.require_live("translator")`): POST https://api.cognitive.microsofttranslator.com/translate
?api-version=3.0 and the transliterate path. The documented body is a JSON array of objects with a "Text" property.
Authentication is a Microsoft Entra bearer token from stdin; a regional or multi-service resource also needs the
Ocp-Apim-Subscription-Region header. Keys are never read.

Checks (in code, not by a model): every identifier such as RG-2026-0457 survives unchanged; every amount survives with
the same value and currency, even when the number format changes (49.980,00 EUR → EUR 49,980.00).
"""
from __future__ import annotations

import json
import re
import uuid
from decimal import Decimal

from . import FIXTURES
from .azure_http import post
from .cloud import require_live

TRANSLATOR_API_VERSION = "3.0"
TRANSLATOR_HOST = "https://api.cognitive.microsofttranslator.com"
EMAIL = FIXTURES / "translation/contractor-email.json"
TRANSLATE_SAMPLE = FIXTURES / "translation/translate-response.sample.json"
IDENTIFIER = re.compile(r"\b[A-Z]{2}-\d{4}-\d{4}\b")
MONEY_DE = re.compile(r"(?<![\d.,])(\d{1,3}(?:\.\d{3})*,\d{2})(?![\d,])")
MONEY_EN = re.compile(r"(?<![\d.,])(\d{1,3}(?:,\d{3})*\.\d{2})(?![\d.])")
CURRENCY = re.compile(r"(?i)\b(EUR|USD|GBP|CHF)\b|€|\$|£")
SYMBOLS = {"€": "EUR", "$": "USD", "£": "GBP"}


def load_email() -> dict:
    return json.loads(EMAIL.read_text(encoding="utf-8"))


def amounts(text: str, language: str) -> list[tuple[Decimal, str | None]]:
    """Each amount with its currency code when one is written next to it. Only the stated notation is parsed."""
    pattern = MONEY_DE if language == "de" else MONEY_EN
    found = []
    for match in pattern.finditer(text):
        raw = match.group(1)
        value = Decimal(raw.replace(".", "").replace(",", ".")) if language == "de" else Decimal(raw.replace(",", ""))
        window = text[max(0, match.start() - 8):match.end() + 8]
        currency = CURRENCY.search(window)
        code = None
        if currency:
            code = (currency.group(1) or SYMBOLS.get(currency.group(0), "")).upper() or None
        found.append((value, code))
    return found


def preservation_problems(source: str, target: str, identifiers: list[str] | None = None) -> list[str]:
    """Problems in the translation; an empty list means identifiers, amounts and currencies survived."""
    problems = []
    for code in sorted(set(identifiers or []) | set(IDENTIFIER.findall(source))):
        if code not in target:
            problems.append(f"IDENTIFIER_LOST {code}")
    target_amounts = amounts(target, "en")
    for value, currency in amounts(source, "de"):
        same_value = [code for amount, code in target_amounts if amount == value]
        if not same_value:
            problems.append(f"AMOUNT_NOT_PRESERVED {value}")
        elif currency and any(code and code != currency for code in same_value) and currency not in same_value:
            problems.append(f"CURRENCY_CHANGED {value} {currency}")
    return problems


def offline_translation() -> dict:
    email = load_email()
    return {"source": "mock-reference-translation", "from": email["from"], "to": email["to"], "text": email["reference"]}


def parse_translate_response(body: list) -> str:
    """The documented response: one element per input, translations[] with text and to."""
    return body[0]["translations"][0]["text"]


def parse_transliterate_response(body: list) -> dict:
    return {"text": body[0]["text"], "script": body[0]["script"]}


def _headers(token: str, env: dict) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=UTF-8", "X-ClientTraceId": str(uuid.uuid4())}
    region = env.get("AZURE_TRANSLATOR_REGION", "").strip()
    if region:
        headers["Ocp-Apim-Subscription-Region"] = region
    return headers


def translate_live(text: str, token: str, env: dict, tracer=None) -> dict:
    require_live("translator", env)
    host = env.get("AZURE_TRANSLATOR_ENDPOINT", TRANSLATOR_HOST).rstrip("/")
    url = f"{host}/translate?api-version={TRANSLATOR_API_VERSION}&from=de&to=en"
    payload, meta = post("translator", "translate", url, json.dumps([{"Text": text}]).encode("utf-8"), _headers(token, env), 60, tracer)
    return {"source": "azure-translator", "text": parse_translate_response(json.loads(payload.decode("utf-8"))),
            "apiVersion": TRANSLATOR_API_VERSION, "correlationId": meta["correlationId"]}


def transliterate_live(text: str, language: str, from_script: str, to_script: str, token: str, env: dict, tracer=None) -> dict:
    require_live("translator", env)
    host = env.get("AZURE_TRANSLATOR_ENDPOINT", TRANSLATOR_HOST).rstrip("/")
    url = (f"{host}/transliterate?api-version={TRANSLATOR_API_VERSION}&language={language}"
           f"&fromScript={from_script}&toScript={to_script}")
    payload, _ = post("translator", "transliterate", url, json.dumps([{"Text": text}]).encode("utf-8"), _headers(token, env), 60, tracer)
    return parse_transliterate_response(json.loads(payload.decode("utf-8")))


def transliteration_sample() -> dict:
    """The fictional Russian name from the sample file: Cyrillic → Latin, a pair Translator documents as supported."""
    sample = json.loads(TRANSLATE_SAMPLE.read_text(encoding="utf-8"))
    return {"source": "sample-response", "input": sample["transliterateSource"], "output": sample["transliterate"][0]}


def run_offline() -> dict:
    email = load_email()
    translation = offline_translation()
    problems = preservation_problems(email["source"], translation["text"], email["identifiers"])
    broken = preservation_problems(email["source"], translation["text"].replace("RG-2026-0457", "RG-2026-0475"), email["identifiers"])
    wrong_amount = preservation_problems(email["source"], translation["text"].replace("49,980.00", "49,890.00"), email["identifiers"])
    currency = preservation_problems(email["source"], translation["text"].replace("EUR 49,980.00", "USD 49,980.00"), email["identifiers"])
    return {"translation": translation, "problems": problems, "lostIdentifier": broken, "wrongAmount": wrong_amount,
            "currencyChanged": currency, "transliteration": transliteration_sample()}
