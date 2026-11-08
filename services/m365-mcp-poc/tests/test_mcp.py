"""MCP hardening: read-only tools, required context, validated inputs, authorised results only."""

import asyncio

import pytest

from m365_poc.mcp_server import build_mcp_server


def _call(server, name, args):
    try:
        return asyncio.run(server.call_tool(name, args))
    except Exception as exc:  # validation or context failures surface as exceptions
        return exc


def _text(result):
    return "".join(getattr(c, "text", "") for c in result.content)


def _rejected(outcome):
    return isinstance(outcome, Exception) or getattr(outcome, "is_error", False) is True


@pytest.fixture
def server(mock_service, local_ctx):
    return build_mcp_server(mock_service, lambda: local_ctx)


def test_only_read_only_tools_are_listed(server):
    tools = asyncio.run(server.list_tools())
    listed = list(tools.tools) if hasattr(tools, "tools") else list(tools)
    assert {t.name for t in listed} == {"search_project_documents", "get_project_document"}
    assert all(t.annotations is not None and t.annotations.read_only_hint is True for t in listed)


def test_search_returns_only_authorised_documents(server):
    outcome = _call(
        server, "search_project_documents", {"query": "Vorstandsnotiz Budget Berlin Living", "max_results": 10}
    )
    assert not isinstance(outcome, Exception) and outcome.is_error is False
    assert "vorstandsnotiz" not in _text(outcome)


def test_restricted_document_cannot_be_fetched(server):
    outcome = _call(server, "get_project_document", {"document_id": "restricted-exec-001"})
    assert _rejected(outcome)
    assert "13.500.000" not in (_text(outcome) if not isinstance(outcome, Exception) else "")


def test_tool_invocation_without_context_is_refused(mock_service):
    server = build_mcp_server(mock_service, lambda: None)
    outcome = _call(server, "search_project_documents", {"query": "Berlin Living", "max_results": 3})
    assert _rejected(outcome)  # the tool body never ran; no document text was returned


@pytest.mark.parametrize(
    "args",
    [
        {"query": "", "max_results": 3},
        {"query": "Berlin", "max_results": 0},
        {"query": "Berlin", "max_results": 99},
        {"query": "x" * 201},
        {"query": "Berlin\x00Living", "max_results": 3},
        {"query": "Berlin\nLiving", "max_results": 3},
    ],
)
def test_malformed_or_oversized_search_input_is_rejected(server, args):
    assert _rejected(_call(server, "search_project_documents", args)), args


@pytest.mark.parametrize("bad", ["../etc/passwd", "a/b", "x" * 300, "with space", ""])
def test_path_like_or_oversized_document_ids_are_rejected(server, bad):
    assert _rejected(_call(server, "get_project_document", {"document_id": bad})), bad


def test_get_document_returns_page_text_within_limits(server):
    outcome = _call(server, "get_project_document", {"document_id": "approval-001"})
    assert not isinstance(outcome, Exception) and outcome.is_error is False
    assert "Genehmigungsstatus" in _text(outcome)
