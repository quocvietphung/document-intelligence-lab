"""Actual installed-library acceptance; prints metadata only, never PDF text."""
import json
import sys
import time
from document_evidence import DoclingReader,__version__

start=time.monotonic()
document=DoclingReader(timeout_seconds=240).read(sys.argv[1])
assert document.pages and document.tables and not document.human_approved
result={"version":__version__,"pages":len(document.pages),"tables":len(document.tables),
        "provider_version":document.provider_version,"sources":len(document.sources),
        "seconds":round(time.monotonic()-start,2),"human_approved":document.human_approved}
if hasattr(document,'structure'):
    assert document.structure and document.pages[0].reading_order
    text=document.pages[0].text
    assert text.index('Read this left column first.') < text.index('2. Recorded amounts')
    assert document.native_structure.present and not document.native_structure.accessibility_certified
    assert any(cell.column_header for table in document.tables for cell in table.cells)
    result.update(layout_nodes=len(document.structure),order_method=document.pages[0].reading_order_method,
                  native_tags=len(document.native_structure.nodes),issues=document.structure_issues)
print(json.dumps(result))
