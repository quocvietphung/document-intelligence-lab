"""Bounded evidence tasks in the existing offline ETL spool. Source copies are temporary."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from datetime import datetime, timezone


def process_evidence(root: Path):
    for path in sorted((root / "inspection").glob("*/*.input.json"))[:20]:
        if path.is_symlink() or path.parent.is_symlink() or path.stat().st_size > 4_100_000:
            continue
        result_path=path.with_name(path.name.replace(".input.json", ".result.json"))
        if result_path.exists():
            path.unlink(missing_ok=True)
            continue
        payload={}
        try:
            payload=json.loads(path.read_text())
            if payload.get('format')!='document-inspection-request-v1' or not re.fullmatch(r'insp-[a-f0-9-]{36}',payload.get('id','')):
                raise ValueError('INVALID_CONTRACT')
            if not re.fullmatch(r'[a-f0-9]{64}',payload.get('scope','')) or payload['scope']!=path.parent.name or path.name!=payload['id']+'.input.json':
                raise ValueError('INVALID_SCOPE')
            content=base64.b64decode(payload['pdf'],validate=True)
            if len(content)>3_000_000 or hashlib.sha256(content).hexdigest()!=payload['sha256']:
                raise ValueError('SOURCE_INTEGRITY_FAILED')
            from document_evidence import inspect_evidence
            with tempfile.TemporaryDirectory(prefix='pdf-inspection-') as folder:
                source=Path(folder)/'source.pdf';source.write_bytes(content);source.chmod(0o600)
                result=inspect_evidence(source,payload['value'],page=payload['page'],recorded_text=payload.get('recordedText',''),
                    recorded_bbox=payload.get('recordedBox'),recorded_page_size=payload.get('recordedPageSize'),
                    languages=payload.get('languages','eng'),orientation=payload.get('orientation','auto'),timeout_seconds=150)
            receipt={'status':'COMPLETE','result':result}
        except Exception as error:
            from document_evidence.reader import DocumentReadError
            allowed={'OCR_UNAVAILABLE','OCR_TIMEOUT','INSPECTION_TIMEOUT','OCR_FAILED','PDF_REJECTED','INSPECTION_LIMIT','INSPECTION_DEPENDENCY_MISSING'}
            code=str(error) if isinstance(error,DocumentReadError) else ''
            receipt={'status':'FAILED','errorCode':code if code in allowed else 'INSPECTION_FAILED'}
        receipt.update(id=payload.get('id',''),sha256=payload.get('sha256',''),finishedAt=datetime.now(timezone.utc).isoformat())
        temporary=result_path.with_suffix('.tmp')
        temporary.write_text(json.dumps(receipt,ensure_ascii=False));temporary.chmod(0o600);os.replace(temporary,result_path)
        path.unlink(missing_ok=True)
        (root/'heartbeat').touch()
