"""Request and response models. Limits are enforced here, before any work happens."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

MAX_SEARCH_QUERY_CHARS = 200
MAX_QUESTION_CHARS = 500
MAX_RESULTS = 20
DEFAULT_RESULTS = 5
MAX_SOURCES = 12
MAX_CLAIMS = 8
MAX_EVIDENCE_CHARS = 300
MAX_PAGE_TEXT_CHARS = 4000
MAX_REQUEST_BODY_BYTES = 4096
DOCUMENT_ID_PATTERN = r"^[A-Za-z0-9!_\-]{1,256}$"

# Read-only tools the controlled orchestrator may call. Nothing else is reachable from the model or MCP.
ALLOWED_TOOLS = ("search_documents", "extract_evidence", "select_evidence", "compose_answer", "validate_answer")


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SearchHit(_Strict):
    document_id: str
    name: str
    location: str
    score: float


class SearchResponse(_Strict):
    query: str
    results: list[SearchHit]


class AskRequest(_Strict):
    question: str = Field(min_length=3, max_length=MAX_QUESTION_CHARS)


class Claim(_Strict):
    text: str = Field(max_length=MAX_EVIDENCE_CHARS)
    evidence_ids: list[str] = Field(min_length=1, max_length=MAX_SOURCES)


class Source(_Strict):
    evidence_id: str
    document_id: str
    name: str
    location: str
    page: int = Field(ge=1)
    evidence: str = Field(max_length=MAX_EVIDENCE_CHARS)
    extractor: str
    rotation: int = 0
    polygon: list[float] | None = None
    table_id: str | None = None


class AskResponse(_Strict):
    answer: str
    claims: list[Claim] = Field(max_length=MAX_CLAIMS)
    sources: list[Source] = Field(max_length=MAX_SOURCES)
    provider: str
    extractor: str
    answer_provider: str
    model: str
    grounded: bool
    abstained: bool
    requires_review: bool
    uncertainty: str = Field(max_length=MAX_EVIDENCE_CHARS)
    reason: str | None = None
    tools_used: list[str]
    labels: dict[str, str] = Field(default_factory=dict)
    usage: dict[str, int] | None = None


class DocumentPage(_Strict):
    page: int = Field(ge=1)
    text: str = Field(max_length=MAX_PAGE_TEXT_CHARS)


class DocumentDetail(_Strict):
    document_id: str
    name: str
    location: str
    page_count: int
    extractor: str
    pages: list[DocumentPage]
