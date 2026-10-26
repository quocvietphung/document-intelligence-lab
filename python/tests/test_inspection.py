"""Real glyph/OCR/rotation regression, explicitly separate from synthetic contracts."""
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from document_evidence import ground_pdf,read_pdf_structure
from document_evidence._inspection_worker import _matches

ROOT=Path(__file__).resolve().parents[2]
PDFS=ROOT/'services/credit-api/src/test/resources/evidence'


class InspectionContractTest(unittest.TestCase):
    def test_money_matches_do_not_change_currency_digits_or_separators(self):
        self.assertEqual(len(_matches('Total: $500 Total: $500','Total: $500')),2)
        for text,value in [('1,500','500'),('8,500','3,500'),('€500','$500'),('500.00','500')]:
            self.assertFalse(_matches(text,value))

    def test_core_import_does_not_load_pdf_or_model_dependencies(self):
        result=subprocess.run([sys.executable,'-c','import document_evidence,sys; assert not set(["docling","torch","pypdfium2","pypdf","cv2"]) & set(sys.modules)'],capture_output=True,timeout=10)
        self.assertEqual(result.returncode,0,result.stderr.decode())

    def test_bad_options_fail_before_any_file_or_network_access(self):
        for options in [{'page':5},{'languages':'eng;curl'},{'timeout_seconds':0},{'occurrence_id':'x'*201}]:
            with self.subTest(options=options),self.assertRaises(ValueError):
                ground_pdf('/does/not/exist.pdf','500',**options)


@unittest.skipUnless(os.environ.get('TEST_PDF_INSPECTION')=='1','Set TEST_PDF_INSPECTION=1 with inspection dependencies and local Tesseract')
class ActualPdfInspectionTest(unittest.TestCase):
    def test_native_tag_hierarchy_role_map_and_table_scope_are_preserved(self):
        structure=read_pdf_structure(PDFS/'structure-regression.pdf')
        self.assertTrue(structure.present);self.assertFalse(structure.accessibility_certified)
        self.assertEqual(structure.issues,())
        mapped=next(n for n in structure.nodes if n.raw_role=='LabHeading')
        self.assertEqual((mapped.role,mapped.mcids),('H1',(0,)))
        self.assertEqual(len([n for n in structure.nodes if n.role=='TH' and n.scope=='Column']),2)
        self.assertIn('L',[n.role for n in structure.nodes])
        self.assertTrue(all(n.page==1 for n in structure.nodes))
        self.assertFalse(read_pdf_structure(PDFS/'scanned-skew-regression.pdf').present)

    def test_duplicate_native_values_and_pdf_rotation_have_valid_distinct_locations(self):
        normal=ground_pdf(PDFS/'evidence-inspection-regression.pdf','Total: $500',page=1)
        rotated=ground_pdf(PDFS/'evidence-inspection-regression.pdf','Total: $500',page=2)
        self.assertEqual(normal.status,'ambiguous');self.assertEqual(rotated.status,'ambiguous')
        self.assertIsNone(normal.selected_id)
        for result in (normal,rotated):
            self.assertEqual(len(result.candidates),4)
            self.assertEqual(len({c.id for c in result.candidates}),4)
            self.assertTrue(result.human_review_required)
            self.assertEqual(result.verification,'text-match-only')
        normal_centres=[((c.bbox[0]+c.bbox[2])/2,(c.bbox[1]+c.bbox[3])/2) for c in normal.candidates]
        actual=sorted(((c.bbox[0]+c.bbox[2])/2,(c.bbox[1]+c.bbox[3])/2) for c in rotated.candidates)
        expected=sorted((1-y,x) for x,y in normal_centres)
        for a,b in zip(actual,expected):
            self.assertAlmostEqual(a[0],b[0],delta=.005);self.assertAlmostEqual(a[1],b[1],delta=.005)
        chosen=ground_pdf(PDFS/'evidence-inspection-regression.pdf','Total: $500',page=1,occurrence_id=normal.candidates[2].id)
        self.assertEqual(chosen.selected_id,normal.candidates[2].id)
        self.assertEqual(chosen.status,'selected-candidate')

    def test_original_crop_box_offsets_are_not_ignored(self):
        from pypdf import PdfReader,PdfWriter
        from pypdf.generic import RectangleObject
        with tempfile.TemporaryDirectory() as folder:
            pdf=PdfReader(PDFS/'evidence-inspection-regression.pdf');page=pdf.pages[0]
            page.cropbox=RectangleObject([30,100,560,750]);writer=PdfWriter();writer.add_page(page)
            path=Path(folder)/'cropped.pdf'
            with path.open('wb') as f:writer.write(f)
            result=ground_pdf(path,'Total: $500',ocr=False)
            self.assertEqual(len(result.candidates),4)
            self.assertTrue(all(.02<c.bbox[0]<.06 for c in result.candidates))

    def test_real_scans_use_tesseract_and_deskew_boxes_map_back_to_original(self):
        upright=ground_pdf(PDFS/'scanned-skew-regression.pdf','Total: $500',page=1,timeout_seconds=120)
        skew=ground_pdf(PDFS/'scanned-skew-regression.pdf','Total: $500',page=2,timeout_seconds=120)
        self.assertEqual(len(upright.candidates),4);self.assertEqual(len(skew.candidates),4)
        self.assertEqual(skew.status,'ambiguous')
        angle=math.radians(4)
        expected=[]
        for candidate in upright.candidates:
            x=(candidate.bbox[0]+candidate.bbox[2])*300-300
            y=(candidate.bbox[1]+candidate.bbox[3])*400-400
            expected.append(((math.cos(angle)*x+math.sin(angle)*y+300)/600,(-math.sin(angle)*x+math.cos(angle)*y+400)/800))
        for candidate,(x,y) in zip(skew.candidates,expected):
            self.assertEqual(candidate.method,'tesseract')
            self.assertAlmostEqual(abs(candidate.deskew_degrees),4,delta=.4)
            self.assertAlmostEqual((candidate.bbox[0]+candidate.bbox[2])/2,x,delta=.01)
            self.assertAlmostEqual((candidate.bbox[1]+candidate.bbox[3])/2,y,delta=.01)
        self.assertFalse(ground_pdf(PDFS/'scanned-skew-regression.pdf','Total: $500',page=1,ocr=False).candidates)


if __name__=='__main__':
    unittest.main()
