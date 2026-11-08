"""Verification labels shown with every response. A label describes how a component was checked, not answer accuracy.

Allowed values: verified-local, simulated, implemented-not-live-verified, live-verified, future.
`live-verified` is never assigned by code: it requires a recorded live test run outside this repository state.
"""

from __future__ import annotations

VERIFIED_LOCAL = "verified-local"
SIMULATED = "simulated"
IMPLEMENTED_NOT_LIVE = "implemented-not-live-verified"
LIVE_VERIFIED = "live-verified"
FUTURE = "future"

_PROVIDER_LABELS = {"mock": SIMULATED, "graph": IMPLEMENTED_NOT_LIVE}
_EXTRACTOR_LABELS = {
    "local-pypdf-native-text": VERIFIED_LOCAL,
    "azure-document-intelligence-prebuilt-layout": IMPLEMENTED_NOT_LIVE,
}
_ANSWER_LABELS = {"deterministic": VERIFIED_LOCAL, "azure-openai": IMPLEMENTED_NOT_LIVE}


def capability_labels(provider: str, extractor: str, answer_provider: str) -> dict[str, str]:
    return {
        "document_source": _PROVIDER_LABELS.get(provider, IMPLEMENTED_NOT_LIVE),
        "extraction": _EXTRACTOR_LABELS.get(extractor, IMPLEMENTED_NOT_LIVE),
        "answering": _ANSWER_LABELS.get(answer_provider, IMPLEMENTED_NOT_LIVE),
        "data": "fictional" if provider == "mock" else "configured-tenant",
    }
