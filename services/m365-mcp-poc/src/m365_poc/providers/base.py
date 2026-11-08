"""Provider interface. Providers return references and raw bytes; they never decide what a user may see."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from ..auth import AuthContext


@dataclass(frozen=True)
class DocumentRef:
    document_id: str
    name: str
    location: str
    tenant_id: str
    # None means the provider cannot state an explicit principal list (see acl_source).
    allowed_principals: frozenset[str] | None
    acl_source: str  # manifest | graph-delegated | none
    mime_type: str | None = None
    size: int | None = None
    version: str | None = None
    score: float = 0.0


@dataclass(frozen=True)
class FetchedDocument:
    ref: DocumentRef
    data: bytes


@runtime_checkable
class DocumentProvider(Protocol):
    """Read-only document access. Implementations raise ProviderError; they never return fabricated data."""

    name: str

    def search(self, ctx: AuthContext, query: str, max_results: int) -> list[DocumentRef]: ...

    def list_documents(self, ctx: AuthContext, max_results: int) -> list[DocumentRef]: ...

    def fetch_pdf(self, ctx: AuthContext, document_id: str) -> FetchedDocument: ...
