"""Interfaces for future Azure AI services. NO implementation performs a network call.

These protocols document the boundary only. The PoC does not call Azure Document
Intelligence or Azure OpenAI, and it generates no simulated Azure responses. Configuration
is validated by config.load_azure_config (no request is made there either).
"""

from __future__ import annotations

from typing import Protocol


class DocumentIntelligenceClient(Protocol):
    """Future: page/table extraction via a prebuilt-layout model on a custom-subdomain endpoint."""

    def analyze_layout(self, pdf_bytes: bytes) -> object: ...


class ChatModelClient(Protocol):
    """Future: grounded answer composition from already-selected evidence, via an Azure OpenAI deployment."""

    def complete(self, system_prompt: str, evidence_block: str, question: str) -> str: ...
