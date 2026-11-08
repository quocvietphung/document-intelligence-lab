"""Read-only MCP server over the same EvidenceService.

MCP standardises how a client calls tools. It does NOT provide OAuth, tenant authorisation or document ACLs:
those remain in the API boundary (Entra JWT), the provider and the service's authorisation check.

Hardening:
  * every tool requires an AuthContext; with no context the call is refused before any work;
  * inputs are length- and pattern-validated; control characters and path-like IDs are rejected;
  * results are capped; only documents the context may read are returned;
  * in Entra mode the stdio transport carries no bearer token, so tools refuse all calls. An HTTP transport
    with JWT validation would be the production path (future work, not built here).
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Annotated, Any

from mcp.server.mcpserver import MCPServer
from mcp.types import ToolAnnotations
from pydantic import Field

from .auth import AuthContext
from .config import Settings, load_settings
from .models import DOCUMENT_ID_PATTERN, MAX_RESULTS, MAX_SEARCH_QUERY_CHARS
from .service import EvidenceService

logger = logging.getLogger("m365_poc.mcp")
READ_ONLY = ToolAnnotations(
    title="Read-only", read_only_hint=True, destructive_hint=False, idempotent_hint=True, open_world_hint=False
)
SAFE_TEXT = r"^[^\x00-\x1f\x7f]+$"


class ContextRequired(Exception):
    """Raised when a tool is invoked without an authenticated context."""


def build_mcp_server(service: EvidenceService, context: Callable[[], AuthContext | None]) -> MCPServer:
    server = MCPServer(
        "m365-document-evidence-poc",
        instructions=(
            "Read-only search over authorised project documents. Results are excerpts with document "
            "and page metadata. Nothing is written, sent, approved or changed."
        ),
    )

    def _ctx() -> AuthContext:
        ctx = context()
        if ctx is None:
            raise ContextRequired("an authenticated context is required for this tool")
        return ctx

    @server.tool(
        name="search_project_documents",
        annotations=READ_ONLY,
        description="Search authorised project documents. Returns IDs, names, locations and scores.",
    )
    def search_project_documents(
        query: Annotated[str, Field(min_length=1, max_length=MAX_SEARCH_QUERY_CHARS, pattern=SAFE_TEXT)],
        max_results: Annotated[int, Field(ge=1, le=MAX_RESULTS)] = 5,
    ) -> dict[str, Any]:
        hits = service.search(_ctx(), query, max_results)
        return {"query": query, "results": [h.model_dump() for h in hits]}

    @server.tool(
        name="get_project_document",
        annotations=READ_ONLY,
        description="Return the page-numbered text of one authorised document (truncated per page).",
    )
    def get_project_document(
        document_id: Annotated[str, Field(pattern=DOCUMENT_ID_PATTERN)],
    ) -> dict[str, Any]:
        return service.get_document(_ctx(), document_id).model_dump()

    return server


def _stdio_context(settings: Settings) -> Callable[[], AuthContext | None]:
    from .auth import local_dev_context
    from .config import AUTH_LOCAL_DEV

    if settings.auth_mode == AUTH_LOCAL_DEV:
        ctx = local_dev_context(settings)
        return lambda: ctx
    return lambda: None  # Entra mode: no bearer token on stdio, so every call is refused


def main() -> None:
    from .api import build_service

    settings = load_settings()
    server = build_mcp_server(build_service(settings), _stdio_context(settings))
    logger.info("starting read-only MCP server over stdio")
    server.run("stdio")


if __name__ == "__main__":
    main()
