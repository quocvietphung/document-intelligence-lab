import unittest
from document_evidence import Document,Page,Source,Table,Cell,evaluate_document

class QualityDimensionsTest(unittest.TestCase):
    def document(self,text="Left section Right section"):
        return Document("id","synthetic.pdf","a"*64,(Page(1,(Source("p1",1,text),)),),
            (Table("table",1,1,2,(Cell(0,0,"Total",column_header=True),Cell(0,1,"8,500 USD"))),))
    def reference(self):
        return {"format":"document-quality-reference-v1","sha256":"a"*64,"labelProvenance":"generated-known-input-not-human-approved",
            "pages":[{"page":1,"text":"Left section Right section","readingOrder":["Left section","Right section"],
            "tables":[{"index":0,"cells":[{"row":0,"column":0,"text":"Total","column_header":True},{"row":0,"column":1,"text":"3,500 USD"}]}]}]}
    def test_correct_layout_cannot_hide_wrong_amount(self):
        row=evaluate_document(self.document(),self.reference())["pages"][0]
        self.assertEqual(row["readingOrder"]["pairAccuracy"],1)
        self.assertEqual(row["text"]["characterErrorRate"],0)
        self.assertEqual(row["tables"][0]["cellTextExactMatch"],.5)
        self.assertEqual(row["tables"][0]["cellStructureExactMatch"],1)
    def test_missing_duplicate_and_inverted_anchors_are_not_success(self):
        for text in ("Right section Left section","Left section","Left section Left section Right section"):
            result=evaluate_document(self.document(text),self.reference())
            self.assertEqual(result["pages"][0]["readingOrder"]["pairAccuracy"],0)
            self.assertTrue(result["humanReviewRequired"])
    def test_modified_source_and_unbounded_labels_are_rejected(self):
        reference=self.reference();reference["sha256"]="b"*64
        with self.assertRaises(ValueError):evaluate_document(self.document(),reference)
        reference=self.reference();reference["pages"][0]["text"]="x"*4001
        with self.assertRaises(ValueError):evaluate_document(self.document(),reference)
