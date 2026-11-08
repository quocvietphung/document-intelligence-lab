from m365_poc.evidence import DocumentText, select_evidence
from m365_poc.extraction import PageText


def doc(doc_id, name, *pages, rotation=0, needs_ocr=False):
    return DocumentText(
        doc_id,
        name,
        f"mock://{name}",
        [
            PageText(page=i, text=t, rotation=rotation if i == 1 else 0, needs_ocr=needs_ocr)
            for i, t in enumerate(pages, start=1)
        ],
    )


def test_missing_field_is_reported_and_never_invented():
    d = doc("p", "p.pdf", "Projektname: Berlin Living\nStatus: Baugenehmigung beantragt")
    sel = select_evidence("Wie hoch ist das Budget des Projekts Berlin Living?", [d])
    assert sel.abstain_reason == "no_evidence"


def test_conflicting_single_values_are_a_conflict():
    a = doc("a", "a.pdf", "Projektname: Berlin Living\nStatus: Baugenehmigung beantragt")
    b = doc("b", "b.pdf", "Projektname: Berlin Living\nStatus: Baugenehmigung erteilt")
    sel = select_evidence("Wie ist der Status des Projekts Berlin Living?", [a, b])
    assert any(r.conflict for r in sel.fields)


def test_multi_valued_open_items_are_not_a_conflict():
    a = doc("a", "a.pdf", "Projektname: Berlin Living\nOffene Punkte: X")
    b = doc("b", "b.pdf", "Projektname: Berlin Living\nOffene Punkte: Y")
    sel = select_evidence("Welche offenen Punkte gibt es bei Berlin Living?", [a, b])
    assert not any(r.conflict for r in sel.fields)


def test_project_named_without_the_word_projekt_is_scoped():
    potsdam = doc("p", "p.pdf", "Projektname: Potsdam Quartier\nBudget: 8.400.000 EUR")
    berlin = doc("b", "b.pdf", "Projektname: Berlin Living\nBudget: 12.000.000 EUR")
    sel = select_evidence("Wie hoch ist das Budget für Potsdam Quartier?", [potsdam, berlin])
    values = [v for r in sel.fields for v in r.values]
    assert values == ["8.400.000 EUR"]


def test_several_projects_without_a_name_is_ambiguous():
    a = doc("a", "a.pdf", "Projektname: Berlin Living\nBudget: 1 EUR")
    b = doc("b", "b.pdf", "Projektname: Potsdam Quartier\nBudget: 2 EUR")
    sel = select_evidence("Wie hoch ist das Budget?", [a, b])
    assert sel.abstain_reason == "ambiguous_project"


def test_unknown_project_phrase_abstains():
    d = doc("p", "p.pdf", "Projektname: Berlin Living\nStatus: beantragt")
    assert select_evidence("Wie ist der Status des Projekts Hamburg Hafen?", [d]).abstain_reason == "unknown_project"


def test_identifier_not_present_abstains_and_present_identifier_selects():
    d = doc("p", "p.pdf", "Projektname: Berlin Living\nProjektnummer: BL-2026-017")
    assert (
        select_evidence("Welches Projekt gehört zur Projektnummer BL-2026-999?", [d]).abstain_reason
        == "identifier_not_found"
    )
    sel = select_evidence("Welches Projekt gehört zur Projektnummer BL-2026-017?", [d])
    assert [r.values for r in sel.fields] == [["Berlin Living"], ["BL-2026-017"]]


def test_question_without_field_intent_abstains():
    d = doc("p", "p.pdf", "Projektname: Berlin Living\nStatus: beantragt")
    assert (
        select_evidence("Wie hoch sind die Mietpreise im Projekt Berlin Living?", [d]).abstain_reason
        == "no_field_intent"
    )


def test_review_flags_only_from_contributing_documents():
    clean = doc("c", "c.pdf", "Projektname: Berlin Living\nNächster Termin: 20.11.2026")
    rotated = doc("r", "r.pdf", "Projektname: Berlin Living\nStatus: Planung", rotation=90)
    sel = select_evidence("Wann ist der nächste Termin für Berlin Living?", [clean, rotated])
    assert sel.review_reasons == []


def test_rotated_contributing_document_sets_review_flag():
    rotated = doc("r", "r.pdf", "Projektname: Berlin Living\nStatus: Planung", rotation=90)
    sel = select_evidence("Wie ist der Status von Berlin Living?", [rotated])
    assert "rotated_page" in sel.review_reasons


def test_scan_without_text_layer_sets_ocr_flag():
    scan = doc("s", "s.pdf", "Projektname: Berlin Living\nStatus: Planung", needs_ocr=True)
    assert "needs_ocr" in select_evidence("Wie ist der Status von Berlin Living?", [scan]).review_reasons
