"""Recorded layout hierarchy and native PDF tags are distinct, unverified evidence."""
from __future__ import annotations

from .models import Document, PdfStructure, PdfTag, StructureNode


def docling_structure(payload: dict, source_refs: dict[str, str]):
    """Traverse body children, never assume the texts array is reading order.

    Reject malformed/cyclic reference graphs as order evidence while retaining
    extracted text. Furniture and unplaced blocks stay explicitly unordered.
    """
    body = payload.get("body")
    if not isinstance(body, dict) or not isinstance(body.get("children"), list):
        return (), (), ("READING_ORDER_UNAVAILABLE",)
    index = {}
    for name in ("groups", "texts", "tables", "pictures", "key_value_items", "form_items"):
        for number, item in enumerate(payload.get(name, []) or []):
            if isinstance(item, dict):
                index[f"#/{name}/{number}"] = item
    nodes, order, seen = [], [], set()

    def walk(ref: object, depth: int):
        if not isinstance(ref, dict) or not isinstance(ref.get("$ref"), str):
            raise ValueError()
        key = ref["$ref"]
        if key not in index or key in seen or depth > 64 or len(seen) >= 6000:
            raise ValueError()
        seen.add(key)
        item = index[key]
        children = item.get("children", [])
        if not isinstance(children, list) or len(children) > 4000:
            raise ValueError()
        source = source_refs.get(key)
        if source:
            order.append(source)
        position = len(nodes)
        nodes.append(None)
        child_ids = tuple(walk(child, depth + 1) for child in children)
        kind = str(item.get("label", "unknown"))[:80]
        level = item.get("level")
        nodes[position] = StructureNode(key, kind, child_ids, (source,) if source else (),
                                        level if type(level) is int and 1 <= level <= 10 else None)
        return key

    try:
        if len(body["children"]) > 4000:
            raise ValueError()
        for child in body["children"]:
            walk(child, 0)
    except (ValueError, TypeError):
        return (), (), ("READING_ORDER_INVALID",)
    missing = set(source_refs.values()) - set(order)
    return tuple(nodes), tuple(order), (("READING_ORDER_PARTIAL",) if missing else ())


def inspect_pdf_tags(pdf) -> PdfStructure:
    """Inspect an already opened pypdf reader. No layout inference or certification."""
    root = pdf.trailer["/Root"]
    tree = root.get("/StructTreeRoot")
    if tree is None:
        return PdfStructure(False, issues=("PDF_TAG_TREE_ABSENT",))
    nodes, seen, issues = [], set(), set()
    pages = {(p.indirect_reference.idnum, p.indirect_reference.generation): i + 1
             for i, p in enumerate(pdf.pages) if p.indirect_reference}

    def resolve(value):
        return value.get_object() if hasattr(value, "get_object") else value

    tree = resolve(tree)
    if not isinstance(tree, dict):
        return PdfStructure(True, issues=("PDF_TAG_TREE_INVALID",))
    roles = resolve(tree.get("/RoleMap", {}))

    def role(raw):
        visited = set()
        current = raw
        while isinstance(roles, dict) and current in roles:
            if current in visited or len(visited) > 16:
                issues.add("PDF_ROLE_MAP_CYCLE")
                break
            visited.add(current)
            current = str(roles[current])
        return current.lstrip("/")

    def walk(value, parent, inherited_page, depth):
        if depth > 64 or len(nodes) >= 5000:
            raise ValueError()
        value = resolve(value)
        if isinstance(value, list):
            result = []
            for child in value:
                result.extend(walk(child, parent, inherited_page, depth + 1))
            return result
        if isinstance(value, int):
            return []
        if not isinstance(value, dict):
            raise ValueError()
        if value.get("/Type") in ("/MCR", "/OBJR"):
            return []
        identity = id(value)
        if identity in seen:
            raise ValueError()
        seen.add(identity)
        raw = str(value.get("/S", ""))
        if not raw.startswith("/"):
            raise ValueError()
        key = "tag-" + str(len(nodes))
        page_ref = value.get("/Pg")
        page = pages.get((page_ref.idnum, page_ref.generation)) if hasattr(page_ref, "idnum") else inherited_page
        # Reserve the node index before descending; IDs remain stable and unique.
        position = len(nodes)
        nodes.append(None)
        children = resolve(value.get("/K", []))
        parts = children if isinstance(children, list) else [children]
        mcids = []
        for part in parts:
            part = resolve(part)
            if isinstance(part, int) and part >= 0:
                mcids.append(int(part))
            elif isinstance(part, dict) and part.get("/Type") == "/MCR" and isinstance(part.get("/MCID"), int):
                mcids.append(int(part["/MCID"]))
        child_ids = walk(children, key, page, depth + 1)
        attributes = resolve(value.get("/A", {}))
        attributes = attributes if isinstance(attributes, list) else [attributes]
        scope, headers = None, []
        for attr in attributes:
            attr = resolve(attr)
            if not isinstance(attr, dict) or attr.get("/O") != "/Table":
                continue
            raw_scope = str(attr.get("/Scope", ""))
            if raw_scope in ("/Row", "/Column", "/Both"):
                scope = raw_scope.lstrip("/")
            raw_headers = resolve(attr.get("/Headers", []))
            if isinstance(raw_headers, list):
                headers.extend(str(h)[:200] for h in raw_headers[:100])
        nodes[position] = PdfTag(key, role(raw), raw.lstrip("/"), parent, tuple(child_ids), page, tuple(mcids), scope, tuple(headers))
        return [key]

    try:
        walk(tree.get("/K", []), None, None, 0)
    except (ValueError, TypeError, RecursionError):
        issues.add("PDF_TAG_TREE_INVALID")
    return PdfStructure(True, tuple(node for node in nodes if node is not None), tuple(sorted(issues)))


def pdf_structure_from_dict(data: dict) -> PdfStructure:
    return PdfStructure(bool(data["present"]), tuple(PdfTag(
        n["id"], n["role"], n["raw_role"], n.get("parent_id"), tuple(n.get("children", [])),
        n.get("page"), tuple(n.get("mcids", [])), n.get("scope"), tuple(n.get("headers", []))) for n in data.get("nodes", [])), tuple(data.get("issues", [])))


def validate_structure(document: Document):
    """Structural preservation checks, not WCAG/PDF-UA validation or OCR accuracy."""
    from .validation import Finding, ValidationReport
    findings = [Finding(code, "warning") for code in document.structure_issues]
    if document.native_structure is None:
        findings.append(Finding("PDF_TAG_TREE_NOT_INSPECTED", "warning"))
    else:
        findings.extend(Finding(code, "warning") for code in document.native_structure.issues)
    source_ids = {s.id for s in document.sources}
    for page in document.pages:
        if not page.reading_order:
            findings.append(Finding("PAGE_ORDER_UNAVAILABLE", "warning"))
        if len(page.reading_order) != len(set(page.reading_order)) or any(s not in source_ids for s in page.reading_order):
            findings.append(Finding("PAGE_ORDER_INVALID", "error"))
    for table in document.tables:
        if not any(cell.column_header is True for cell in table.cells):
            findings.append(Finding("TABLE_COLUMN_HEADERS_NOT_RECORDED", "warning", (table.source_id,)))
        if not any(cell.row_header is True for cell in table.cells):
            findings.append(Finding("TABLE_ROW_HEADERS_NOT_RECORDED", "warning", (table.source_id,)))
    return ValidationReport(document.id, tuple(findings), rule_version="document-structure-v1")
