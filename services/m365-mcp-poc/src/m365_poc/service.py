"""Controlled, read-only orchestration with a fixed tool sequence and backend-enforced authorisation.

search_documents → extract_evidence → select_evidence → compose_answer → validate_answer

The sequence is code, not model output. Only the read-only tools in models.ALLOWED_TOOLS run, and each
call is recorded in `tools_used`. Authorisation is checked here (the single decision point) in addition to
the provider, and a model never receives evidence the caller could not read.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from time import perf_counter
from typing import TypeVar

from .answering.base import AnswerProvider, StructuredAnswer
from .answering.deterministic import DeterministicAnswerProvider
from .answering.validator import abstention_text
from .auth import AuthContext, can_read
from .errors import AnswerRejected, ExtractionError, ProviderError, ProviderNotFound
from .evidence import DocumentText, EvidenceItem, Selection, query_terms, select_evidence
from .extraction import PageText, extract_pages
from .labels import capability_labels
from .models import (
    ALLOWED_TOOLS,
    DEFAULT_RESULTS,
    MAX_CLAIMS,
    MAX_PAGE_TEXT_CHARS,
    MAX_RESULTS,
    MAX_SEARCH_QUERY_CHARS,
    MAX_SOURCES,
    AskResponse,
    Claim,
    DocumentDetail,
    DocumentPage,
    SearchHit,
    Source,
)
from .providers.base import DocumentProvider, DocumentRef, FetchedDocument
from .telemetry import Telemetry

logger = logging.getLogger("m365_poc.service")
MAX_CANDIDATES = 5
T = TypeVar("T")

Extractor = Callable[[bytes], list[PageText]]


@dataclass(frozen=True)
class ExtractorInfo:
    name: str
    extract: Extractor


class EvidenceService:
    def __init__(
        self,
        provider: DocumentProvider,
        *,
        extractor: ExtractorInfo | None = None,
        answer_provider: AnswerProvider | None = None,
        telemetry: Telemetry | None = None,
    ) -> None:
        self._provider = provider
        self._extractor = extractor or ExtractorInfo("local-pypdf-native-text", extract_pages)
        self._answers: AnswerProvider = answer_provider or DeterministicAnswerProvider()
        self._telemetry = telemetry or Telemetry()

    @property
    def provider_name(self) -> str:
        return self._provider.name

    @property
    def extractor_name(self) -> str:
        return self._extractor.name

    @property
    def answer_provider_name(self) -> str:
        return self._answers.name

    @property
    def telemetry(self) -> Telemetry:
        return self._telemetry

    # -- helpers -------------------------------------------------------------
    def _timed(self, operation: str, fn: Callable[[], T]) -> T:
        started = perf_counter()
        try:
            result = fn()
        except ProviderError as exc:
            self._telemetry.record_provider(self.provider_name, operation, "error", (perf_counter() - started) * 1000)
            self._telemetry.record_provider_error(self.provider_name, exc.code)
            raise
        self._telemetry.record_provider(self.provider_name, operation, "ok", (perf_counter() - started) * 1000)
        return result

    @staticmethod
    def _authorised(ctx: AuthContext, ref: DocumentRef) -> bool:
        return can_read(
            ctx, tenant_id=ref.tenant_id, allowed_principals=ref.allowed_principals, acl_source=ref.acl_source
        )

    def extract_bytes(self, data: bytes) -> list[PageText]:
        """Extract with the configured extractor only. Used by the pipeline; never falls back."""
        return self._extract(data)

    def _extract(self, data: bytes) -> list[PageText]:
        try:
            return self._extractor.extract(data)
        except ExtractionError as exc:
            self._telemetry.record_extraction_error(exc.reason)
            raise

    # -- read-only API surface -------------------------------------------------
    def search(self, ctx: AuthContext, query: str, max_results: int = DEFAULT_RESULTS) -> list[SearchHit]:
        limit = max(1, min(max_results, MAX_RESULTS))
        refs = self._timed("search", lambda: self._provider.search(ctx, query[:MAX_SEARCH_QUERY_CHARS], limit))
        return [
            SearchHit(document_id=r.document_id, name=r.name, location=r.location, score=round(r.score, 3))
            for r in refs
            if self._authorised(ctx, r)
        ][:limit]

    def list_documents(self, ctx: AuthContext, max_results: int = DEFAULT_RESULTS) -> list[SearchHit]:
        limit = max(1, min(max_results, MAX_RESULTS))
        refs = self._timed("list", lambda: self._provider.list_documents(ctx, limit))
        return [
            SearchHit(document_id=r.document_id, name=r.name, location=r.location, score=0.0)
            for r in refs
            if self._authorised(ctx, r)
        ][:limit]

    def fetch_authorised(self, ctx: AuthContext, document_id: str) -> FetchedDocument:
        fetched = self._timed("fetch", lambda: self._provider.fetch_pdf(ctx, document_id))
        if not self._authorised(ctx, fetched.ref):
            # Same answer as an unknown document: no existence oracle.
            raise ProviderNotFound("document not found")
        return fetched

    def get_document(self, ctx: AuthContext, document_id: str) -> DocumentDetail:
        fetched = self.fetch_authorised(ctx, document_id)
        pages = self._extract(fetched.data)
        return DocumentDetail(
            document_id=fetched.ref.document_id,
            name=fetched.ref.name,
            location=fetched.ref.location,
            page_count=len(pages),
            extractor=self.extractor_name,
            pages=[DocumentPage(page=p.page, text=p.text[:MAX_PAGE_TEXT_CHARS]) for p in pages],
        )

    def ask(self, ctx: AuthContext, question: str, correlation_id: str | None = None) -> AskResponse:
        tools: list[str] = []
        started = perf_counter()

        def use(tool: str) -> None:
            if tool not in ALLOWED_TOOLS:
                raise RuntimeError("tool is not allowed")
            tools.append(tool)

        # 1. search (tenant- and ACL-scoped)
        use("search_documents")
        terms = query_terms(question)
        refs = (
            self._timed(
                "search", lambda: self._provider.search(ctx, " ".join(terms)[:MAX_SEARCH_QUERY_CHARS], MAX_CANDIDATES)
            )
            if terms
            else []
        )
        refs = [r for r in refs if self._authorised(ctx, r)][:MAX_CANDIDATES]
        if not refs:
            return self._finish(ctx, question, correlation_id, tools, started, _empty_selection("no_candidates"))

        # 2. extract (fail closed: provider errors propagate, unreadable candidates are skipped)
        use("extract_evidence")
        docs: list[DocumentText] = []
        for ref in refs:
            try:
                fetched = self.fetch_authorised(ctx, ref.document_id)
            except ProviderNotFound:
                continue
            try:
                pages = self._extract(fetched.data)
            except ExtractionError:
                logger.info("candidate skipped: unreadable document cid=%s", correlation_id)
                continue
            docs.append(DocumentText(fetched.ref.document_id, fetched.ref.name, fetched.ref.location, pages))

        # 3. select (deterministic)
        use("select_evidence")
        selection = select_evidence(question, docs)
        return self._finish(ctx, question, correlation_id, tools, started, selection)

    def _finish(
        self,
        ctx: AuthContext,
        question: str,
        correlation_id: str | None,
        tools: list[str],
        started: float,
        selection: Selection,
    ) -> AskResponse:
        del ctx  # authorisation was applied to every input above
        # 4. compose (model or deterministic); a rejected model output becomes an abstention, never an answer
        tools.append("compose_answer")
        try:
            answer = self._answers.compose(question, selection)
        except AnswerRejected as exc:
            self._telemetry.record_citation_failure(exc.reason)
            if exc.reason.startswith("unsupported"):
                self._telemetry.record_unsupported()
            answer = _rejected_answer(self._answers.name, getattr(self._answers, "model", "unknown"))
        # 5. validate (structural checks already applied by the answer provider)
        tools.append("validate_answer")

        cited: list[EvidenceItem] = list(answer.cited)
        sources = [
            Source(
                evidence_id=item.evidence_id,
                document_id=item.document_id,
                name=item.name,
                location=item.location,
                page=item.page,
                evidence=item.text[:300],
                extractor=item.extractor,
                rotation=item.rotation,
                polygon=list(item.polygon) if item.polygon else None,
                table_id=item.table_id,
            )
            for item in cited
        ][:MAX_SOURCES]
        claims = [Claim(text=c.text, evidence_ids=list(c.evidence_ids)) for c in answer.claims][:MAX_CLAIMS]
        # Every citation must be present in the returned sources. Anything else is a rejected answer.
        source_ids = {s.evidence_id for s in sources}
        if any(i not in source_ids for c in claims for i in c.evidence_ids) or len(answer.claims) > MAX_CLAIMS:
            self._telemetry.record_citation_failure("claim_citation_not_returned")
            answer = _rejected_answer(answer.provider, answer.model)
            claims, sources = [], []
        grounded = bool(claims) and not answer.abstained
        reason = answer.reason or selection.abstain_reason
        self._telemetry.record_usage(answer.model, answer.usage)
        outcome = "abstained" if answer.abstained else "answered"
        self._telemetry.record_answer(outcome, reason)
        self._telemetry.record_provider("answer", "compose", outcome, (perf_counter() - started) * 1000)
        logger.info("ask outcome=%s reason=%s cid=%s", outcome, reason, correlation_id)
        return AskResponse(
            answer=answer.answer,
            claims=claims,
            sources=sources,
            provider=self.provider_name,
            extractor=self.extractor_name,
            answer_provider=answer.provider,
            model=answer.model,
            grounded=grounded,
            abstained=answer.abstained,
            requires_review=answer.requires_review,
            uncertainty=answer.uncertainty[:300],
            reason=reason,
            tools_used=tools,
            labels=capability_labels(self.provider_name, self.extractor_name, answer.provider),
            usage=answer.usage,
        )


def _empty_selection(reason: str) -> Selection:
    return Selection(abstain_reason=reason)


def _rejected_answer(provider: str, model: str) -> StructuredAnswer:
    return StructuredAnswer(
        answer=abstention_text(),
        claims=(),
        uncertainty="Die Modellausgabe konnte nicht verifiziert werden.",
        requires_review=True,
        abstained=True,
        provider=provider,
        model=model,
        reason="citation_validation_failed",
    )
