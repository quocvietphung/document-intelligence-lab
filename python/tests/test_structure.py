"""Structural contracts using explicit synthetic exports, not model quality scores."""
import hashlib
import json
from importlib.resources import files
import unittest

from document_evidence import normalize_docling, validate_structure

HASH=hashlib.sha256(b"synthetic structure contract").hexdigest()


def payload():
    return json.loads(files('document_evidence').joinpath('contracts/structure-cases.json').read_text())['input']


class StructureTest(unittest.TestCase):
    def test_body_order_not_text_array_order_and_table_remains_in_sequence(self):
        doc=normalize_docling(payload(),name="test.pdf",sha256=HASH)
        self.assertEqual([s.rsplit(":",1)[-1] for s in doc.pages[0].reading_order],["b2","b3","t1","b1"])
        self.assertLess(doc.pages[0].text.index("Left column"),doc.pages[0].text.index("Right column"))
        self.assertEqual(doc.pages[0].text.count("8,500"),1)
        self.assertIn("list",[node.kind for node in doc.structure])
        self.assertTrue(all(node.origin=="docling-layout" for node in doc.structure))
        self.assertEqual(doc.pages[0].reading_order_method,"docling-body")

    def test_cell_geometry_header_flags_and_exact_source_are_retained(self):
        doc=normalize_docling(payload(),name="test.pdf",sha256=HASH)
        cell=doc.tables[0].cells[-1]
        source=next(s for s in doc.sources if s.id==cell.source_id)
        self.assertEqual(source.kind,"table_cell")
        self.assertEqual(source.bbox,(.5,.5,2/3,.525))
        self.assertTrue(doc.tables[0].cells[0].column_header)
        self.assertTrue(doc.tables[0].cells[2].row_header)
        self.assertNotIn("TABLE_COLUMN_HEADERS_NOT_RECORDED",[f.code for f in validate_structure(doc).findings])

    def test_missing_cycle_external_and_duplicate_references_never_claim_an_order(self):
        variants=[]
        for ref in ("https://example.com/text", "#/texts/99", "#/groups/0"):
            data=payload();data["groups"][0]["children"]=[{"$ref":ref}];variants.append(data)
        data=payload();data["body"]["children"].append({"$ref":"#/texts/0"});variants.append(data)
        for data in variants:
            with self.subTest(data=data["body"]):
                doc=normalize_docling(data,name="test.pdf",sha256=HASH)
                self.assertEqual(doc.pages[0].reading_order,())
                self.assertIn("READING_ORDER_INVALID",doc.structure_issues)
                self.assertTrue(doc.sources)

    def test_partial_order_exposes_unplaced_content(self):
        data=payload();data["body"]["children"].pop()
        doc=normalize_docling(data,name="test.pdf",sha256=HASH)
        self.assertIn("READING_ORDER_PARTIAL",doc.structure_issues)
        self.assertIn("Right column",doc.pages[0].text)
        self.assertFalse(doc.human_approved)
        self.assertTrue(validate_structure(doc).human_review_required)

    def test_legacy_export_remains_readable_and_reports_unknown_structure(self):
        data=payload();data.pop("body")
        doc=normalize_docling(data,name="legacy.pdf",sha256=HASH)
        self.assertIn("READING_ORDER_UNAVAILABLE",doc.structure_issues)
        self.assertIsNone(doc.native_structure)
        self.assertIn("PDF_TAG_TREE_NOT_INSPECTED",[f.code for f in validate_structure(doc).findings])


if __name__=="__main__":
    unittest.main()
