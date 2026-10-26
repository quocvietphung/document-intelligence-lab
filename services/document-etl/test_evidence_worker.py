import base64
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from evidence_worker import process_evidence


class EvidenceSpoolTest(unittest.TestCase):
    def test_original_copy_is_removed_and_a_safe_immutable_receipt_is_left(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);scope='a'*64;job='insp-12345678-1234-1234-1234-123456789abc'
            directory=root/'inspection'/scope;directory.mkdir(parents=True);content=b'%PDF-private-test'
            payload={'id':job,'scope':scope,'format':'document-inspection-request-v1','sha256':hashlib.sha256(content).hexdigest(),'pdf':base64.b64encode(content).decode(),'page':1,'value':'500'}
            path=directory/(job+'.input.json');path.write_text(json.dumps(payload))
            with patch('document_evidence.inspect_evidence',return_value={'sha256':payload['sha256'],'candidates':[]}):process_evidence(root)
            self.assertFalse(path.exists());receipt=json.loads((directory/(job+'.result.json')).read_text())
            self.assertEqual(receipt['status'],'COMPLETE');self.assertNotIn('pdf',receipt)
            self.assertFalse(list(root.rglob('*.pdf')))

    def test_changed_source_hash_never_reaches_the_pdf_engine(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);scope='b'*64;job='insp-12345678-1234-1234-1234-123456789abc';directory=root/'inspection'/scope;directory.mkdir(parents=True)
            path=directory/(job+'.input.json');path.write_text(json.dumps({'id':job,'scope':scope,'format':'document-inspection-request-v1','sha256':'0'*64,'pdf':base64.b64encode(b'%PDF-private').decode()}))
            with patch('document_evidence.inspect_evidence') as engine:process_evidence(root);engine.assert_not_called()
            result=(directory/(job+'.result.json')).read_text();self.assertNotIn('private',result);self.assertEqual(json.loads(result)['status'],'FAILED');self.assertFalse(path.exists())
