"""MockGraphProvider: serves only the fictional PDFs listed in fixtures/manifest.json.

It has the same interface as the live Graph provider but is NOT a Microsoft integration.
Its results are labelled `provider: mock` and it applies the manifest ACL per tenant and principal.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..auth import AuthContext, can_read
from ..errors import ProviderNotFound
from ..evidence import query_terms
from ..extraction import extract_pages
from .base import DocumentRef, FetchedDocument

logger = logging.getLogger("m365_poc.mock")


@dataclass(frozen=True)
class _Entry:
    ref: DocumentRef
    filename: str


class MockGraphProvider:
    name = "mock"

    def __init__(self, fixtures_dir: Path, manifest_path: Path) -> None:
        self._dir = fixtures_dir
        data: dict[str, Any] = json.loads(manifest_path.read_text(encoding="utf-8"))
        self._entries: dict[str, _Entry] = {}
        for item in data["documents"]:
            ref = DocumentRef(
                document_id=item["document_id"],
                name=item["filename"],
                location=f"mock://{item['filename']}",
                tenant_id=item["tenant_id"],
                allowed_principals=frozenset(item["allowed_principals"]),
                acl_source="manifest",
                mime_type="application/pdf",
            )
            self._entries[ref.document_id] = _Entry(ref, item["filename"])
        self._cache: dict[str, bytes] = {}

    def _visible(self, ctx: AuthContext) -> list[DocumentRef]:
        return [
            e.ref
            for e in self._entries.values()
            if can_read(
                ctx, tenant_id=e.ref.tenant_id, allowed_principals=e.ref.allowed_principals, acl_source=e.ref.acl_source
            )
        ]

    def list_documents(self, ctx: AuthContext, max_results: int) -> list[DocumentRef]:
        return sorted(self._visible(ctx), key=lambda r: r.name)[:max_results]

    def search(self, ctx: AuthContext, query: str, max_results: int) -> list[DocumentRef]:
        terms = query_terms(query)
        if not terms:
            return []
        scored: list[DocumentRef] = []
        for ref in self._visible(ctx):
            data = self._bytes(ref.document_id)
            try:
                text = " ".join(p.text for p in extract_pages(data)).lower()
            except Exception:  # an unreadable mock file simply does not match
                logger.debug("mock document skipped: unreadable")
                continue
            score = float(sum(text.count(term) for term in terms))
            score += 2.0 * sum(1 for term in terms if term in ref.name.lower())
            if score > 0:
                scored.append(DocumentRef(**{**ref.__dict__, "score": score}))
        scored.sort(key=lambda r: (-r.score, r.name))
        return scored[:max_results]

    def _bytes(self, document_id: str) -> bytes:
        if document_id not in self._cache:
            path = self._dir / self._entries[document_id].filename
            if not path.is_file():
                raise ProviderNotFound("fixture is missing")
            self._cache[document_id] = path.read_bytes()
        return self._cache[document_id]

    def fetch_pdf(self, ctx: AuthContext, document_id: str) -> FetchedDocument:
        entry = self._entries.get(document_id)
        # Unknown and unauthorised documents look identical to the caller: no existence oracle.
        if entry is None or not can_read(
            ctx,
            tenant_id=entry.ref.tenant_id,
            allowed_principals=entry.ref.allowed_principals,
            acl_source=entry.ref.acl_source,
        ):
            raise ProviderNotFound("document not found")
        return FetchedDocument(ref=entry.ref, data=self._bytes(document_id))
