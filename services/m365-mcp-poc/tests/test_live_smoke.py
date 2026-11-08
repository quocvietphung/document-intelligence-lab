"""The bounded live smoke test, exercised with mocked transports only (no Azure call)."""

import json

import httpx
import pytest

from m365_poc.errors import ConfigurationError
from m365_poc.live_smoke import MAX_DI_PAGES, MAX_OPENAI_REQUESTS, BudgetExceededError, CappedOpenAI, run

ENV = {
    "M365_POC_LIVE_SMOKE": "1",
    "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT": "https://example-docs.cognitiveservices.azure.com/",
    "AZURE_OPENAI_ENDPOINT": "https://example-openai.openai.azure.com/",
    "AZURE_OPENAI_DEPLOYMENT": "chat-test",
}
OP = "https://example-docs.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-layout/analyzeResults/1"


def di_handler(calls):
    def handler(request):
        calls.append(request.method)
        if request.method == "POST":
            return httpx.Response(202, headers={"Operation-Location": OP})
        lines = lambda texts: [{"content": t, "polygon": [1, 1, 2, 1, 2, 2, 1, 2]} for t in texts]  # noqa: E731
        return httpx.Response(
            200,
            json={
                "status": "succeeded",
                "analyzeResult": {
                    "pages": [
                        {
                            "pageNumber": 1,
                            "lines": lines(
                                [
                                    "Projektname: Berlin Living",
                                    "Status: Baugenehmigung beantragt",
                                    "Nächster Termin: 20.11.2026",
                                ]
                            ),
                        },
                        {"pageNumber": 2, "lines": lines(["Budget: 12.000.000 EUR"])},
                    ]
                },
            },
        )

    return handler


def openai_handler(calls):
    def handler(request):
        calls.append(1)
        evidence = json.loads(json.loads(request.content)["messages"][1]["content"])["evidence"]
        claims = [{"text": e["text"], "evidence_ids": [e["evidence_id"]]} for e in evidence]
        content = json.dumps(
            {
                "answer": " ".join(c["text"] for c in claims),
                "claims": claims,
                "uncertainty": "",
                "requires_review": False,
                "abstain": False,
            }
        )
        return httpx.Response(
            200,
            json={
                "model": "chat-test",
                "choices": [{"message": {"content": content}}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
            },
        )

    return handler


def test_refuses_without_explicit_opt_in():
    with pytest.raises(ConfigurationError):
        run(env={**ENV, "M365_POC_LIVE_SMOKE": "0"}, token_factory=lambda scope: lambda: "t")


def test_stays_within_page_and_request_budget():
    di_calls, oai_calls = [], []
    report = run(
        env=ENV,
        token_factory=lambda scope: lambda: "fake-token",
        di_transport=httpx.MockTransport(di_handler(di_calls)),
        openai_transport=httpx.MockTransport(openai_handler(oai_calls)),
    )
    assert report["document_intelligence"]["pages_sent"] == 2 <= MAX_DI_PAGES
    assert di_calls.count("POST") == 1  # the two-page document is analysed once and cached
    assert report["openai"]["requests_sent"] == len(oai_calls) == 3 <= MAX_OPENAI_REQUESTS
    results = report["results"]
    assert results["grounded_question_di_and_openai"]["grounded"] is True
    assert results["grounded_question_di_and_openai"]["sources"][0]["polygon"] is True
    assert results["unanswerable_no_model_call"]["abstained"] is True
    assert results["prompt_injection_local_extraction_openai"]["forbidden_text_present"] is False
    assert "fake-token" not in json.dumps(report)


def test_request_budget_is_enforced_before_sending():
    sent = []
    provider = CappedOpenAI(
        max_requests=1,
        endpoint=ENV["AZURE_OPENAI_ENDPOINT"],
        deployment="chat-test",
        api_version="2024-10-21",
        token_provider=lambda: "t",
        transport=httpx.MockTransport(lambda r: sent.append(r) or httpx.Response(200, json={})),
    )
    provider._post({"messages": []})
    with pytest.raises(BudgetExceededError):
        provider._post({"messages": []})
    assert len(sent) == 1
