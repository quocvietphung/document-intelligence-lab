"""Bounded, source-hash-bound quality dimensions. Scores never grant approval."""
from __future__ import annotations
import re
from .models import Document


def _text(value):
    if not isinstance(value,str) or len(value)>4000:
        raise ValueError("Quality text must be a string of at most 4000 characters")
    return re.sub(r"\s+"," ",value).strip()


def _distance(a,b):
    previous=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        current=[i]
        for j,y in enumerate(b,1):current.append(min(current[-1]+1,previous[j]+1,previous[j-1]+(x!=y)))
        previous=current
    return previous[-1]


def evaluate_document(document: Document, reference: dict) -> dict:
    """Compare only explicitly labelled pages/cells/anchors, preserving missing cases.

    References must be independently prepared from the PDF, never model predictions.
    Generated fixtures are useful regression labels, not representative ground truth.
    """
    if reference.get("format")!="document-quality-reference-v1" or reference.get("sha256")!=document.sha256:
        raise ValueError("A matching original PDF SHA-256 reference is required")
    provenance=reference.get("labelProvenance")
    if provenance not in ("generated-known-input-not-human-approved","human-reviewed-source"):
        raise ValueError("Declare label provenance")
    labels=reference.get("pages")
    if not isinstance(labels,list) or not 1<=len(labels)<=4:
        raise ValueError("Label between one and four pages")
    pages={page.number:page for page in document.pages};seen=set();rows=[]
    for label in labels:
        number=label.get("page")
        if type(number) is not int or number<1 or number>4 or number in seen:raise ValueError("Invalid labelled page")
        seen.add(number);page=pages.get(number);actual=_text(page.text if page else "")
        row={"page":number,"available":page is not None}
        if "text" in label:
            expected=_text(label["text"])
            if not expected:raise ValueError("Reference text cannot be empty")
            distance=_distance(expected,actual)
            row["text"]={"editDistance":distance,"referenceCharacters":len(expected),
                         "characterErrorRate":distance/len(expected)}
        anchors=label.get("readingOrder",[])
        if not isinstance(anchors,list) or len(anchors)>40 or len(set(anchors))!=len(anchors):raise ValueError("Invalid reading-order anchors")
        if anchors:
            positions=[actual.index(a) if actual.count(a)==1 else None for a in map(_text,anchors)]
            pairs=[(i,j) for i in range(len(positions)) for j in range(i+1,len(positions))]
            correct=sum(positions[i] is not None and positions[j] is not None and positions[i]<positions[j] for i,j in pairs)
            row["readingOrder"]={"referencePairs":len(pairs),"correctPairs":correct,
                "pairAccuracy":correct/len(pairs) if pairs else None,
                "missingOrAmbiguousAnchors":[anchors[i] for i,p in enumerate(positions) if p is None]}
        tables=label.get("tables",[])
        if not isinstance(tables,list) or len(tables)>8:raise ValueError("Too many labelled tables")
        row["tables"]=[]
        for target in tables:
            index=target.get("index",0);cells=target.get("cells",[])
            if type(index) is not int or not 0<=index<8 or not 1<=len(cells)<=300:raise ValueError("Invalid table reference")
            available=[t for t in document.tables if t.page==number]
            table=available[index] if index<len(available) else None
            actual_cells={(c.row,c.column):c for c in table.cells} if table else {}
            keys=set();text_hits=structure_hits=0
            for cell in cells:
                key=(cell.get("row"),cell.get("column"))
                if any(type(v) is not int or v<0 for v in key) or key in keys:raise ValueError("Invalid or duplicate cell")
                keys.add(key);candidate=actual_cells.get(key)
                if candidate and _text(candidate.text)==_text(cell["text"]):text_hits+=1
                if candidate and all(getattr(candidate,attr)==cell[attr] for attr in ("row_span","column_span","column_header","row_header") if attr in cell):structure_hits+=1
            row["tables"].append({"index":index,"available":table is not None,"labelledCells":len(cells),
                "matchingTextCells":text_hits,"cellTextExactMatch":text_hits/len(cells),
                "matchingStructureCells":structure_hits,"cellStructureExactMatch":structure_hits/len(cells),
                "unlabelledActualCells":len(set(actual_cells)-keys)})
        rows.append(row)
    return {"format":"document-quality-results-v1","sha256":document.sha256,"provider":document.provider,
        "providerVersion":document.provider_version,"labelProvenance":provenance,"pages":rows,
        "humanReviewRequired":True,"limitations":["Only supplied labels are measured; no global quality score.",
        "Reading order uses unique text anchors; missing/duplicate anchors remain failures.",
        "Cell checks are position-based exact matches, not TEDS or general table accuracy."]}
