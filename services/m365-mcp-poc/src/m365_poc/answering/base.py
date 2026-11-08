"""Structured answer contract shared by the deterministic and the Azure OpenAI providers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from ..evidence import EvidenceItem, Selection


@dataclass(frozen=True)
class ClaimOut:
    text: str
    evidence_ids: tuple[str, ...]


@dataclass(frozen=True)
class StructuredAnswer:
    answer: str
    claims: tuple[ClaimOut, ...]
    uncertainty: str
    requires_review: bool
    abstained: bool
    provider: str
    model: str
    reason: str | None = None
    usage: dict[str, int] | None = None
    cited: tuple[EvidenceItem, ...] = field(default=())


class AnswerProvider(Protocol):
    name: str
    model: str

    def compose(self, question: str, selection: Selection) -> StructuredAnswer: ...
