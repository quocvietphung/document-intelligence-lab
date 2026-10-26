"""Short-lived, offline PDF inspection worker. No document data in error messages."""
from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import re
import statistics
import subprocess
import sys
from importlib.metadata import version
from contextlib import closing
from dataclasses import asdict


class InspectionFailure(Exception):
    pass


def _matches(text, value):
    # Whitespace only: never conflate currency, decimal separators or OCR digits.
    value = re.sub(r"\s+", " ", value).strip()
    left = r"(?<![\w.,])" if value[0].isalnum() else ""
    right = r"(?![\w.,])" if value[-1].isalnum() else ""
    return list(re.finditer(left + re.escape(value) + right, text))


def _compact(text, boxes):
    result, mapped = [], []
    for char, box in zip(text, boxes):
        if char.isspace():
            if result and result[-1] != " ":
                result.append(" "); mapped.append(None)
        else:
            result.append(char); mapped.append(box)
    return "".join(result), mapped


def _deskew(image):
    import cv2
    import numpy as np
    grey = cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2GRAY)
    lines = cv2.HoughLinesP(cv2.Canny(grey, 50, 150), 1, math.pi / 1800, 50,
                            minLineLength=max(60, image.width // 8), maxLineGap=15)
    angles = []
    if lines is not None:
        for x1, y1, x2, y2 in np.asarray(lines).reshape(-1,4):
            angle = math.degrees(math.atan2(int(y2)-int(y1), int(x2)-int(x1)))
            if abs(angle) <= 12:
                angles.append(angle)
    if len(angles) < 3:
        return image, None, 0.0
    angle = statistics.median(angles)
    if abs(angle) < .2 or statistics.median(abs(a-angle) for a in angles) > 1:
        return image, None, 0.0
    matrix = cv2.getRotationMatrix2D((image.width/2, image.height/2), angle, 1)
    from PIL import Image
    adjusted = cv2.warpAffine(np.array(image.convert("RGB")), matrix, image.size, borderValue=(255,255,255))
    return Image.fromarray(adjusted), cv2.invertAffineTransform(matrix), round(angle, 4)


def _ocr_lines(image, languages):
    buf = io.BytesIO(); image.save(buf, format="PNG")
    try:
        reply = subprocess.run(["tesseract", "stdin", "stdout", "-l", languages, "--psm", "3", "tsv"],
                               input=buf.getvalue(), capture_output=True, timeout=35)
    except FileNotFoundError:
        raise InspectionFailure("OCR_UNAVAILABLE") from None
    except subprocess.TimeoutExpired:
        raise InspectionFailure("OCR_TIMEOUT") from None
    if reply.returncode or len(reply.stdout) > 2_000_000:
        raise InspectionFailure("OCR_FAILED")
    lines = {}
    for row in csv.DictReader(io.StringIO(reply.stdout.decode("utf-8")), delimiter="\t", quoting=csv.QUOTE_NONE):
        text = row.get("text", "").strip()
        if not text or row.get("level") != "5":
            continue
        key = tuple(row[k] for k in ("block_num", "par_num", "line_num"))
        lines.setdefault(key, []).append((text, (int(row["left"]), int(row["top"]), int(row["width"]), int(row["height"])), float(row["conf"])))
    return list(lines.values())


def ground(content, options):
    import pypdfium2 as pdfium
    digest = hashlib.sha256(content).hexdigest()
    candidates = []
    engines = {"pypdfium2": version("pypdfium2")}
    with closing(pdfium.PdfDocument(content)) as pdf:
        if not 1 <= len(pdf) <= 4:
            raise InspectionFailure("PDF_REJECTED")
        if options.get("page") and options["page"] > len(pdf):
            raise InspectionFailure("PDF_REJECTED")
        for number in range(len(pdf)):
            if options.get("page") and number+1 != options["page"]:
                continue
            with closing(pdf[number]) as page:
                width, height = page.get_size()
                if not all(math.isfinite(v) and v>0 for v in (width,height)):
                    raise InspectionFailure("INSPECTION_LIMIT")
                scale = min(2.5, math.sqrt(6_000_000 / (width * height)))
                if scale < .1:
                    raise InspectionFailure("INSPECTION_LIMIT")
                with closing(page.render(scale=scale, may_draw_forms=False)) as bitmap:
                    image = bitmap.to_pil().convert("RGB")
                    with closing(page.get_textpage()) as textpage:
                        count = textpage.count_chars()
                        if count > 60000:
                            raise InspectionFailure("INSPECTION_LIMIT")
                        text, boxes = [], []
                        conv = bitmap.get_posconv(page)
                        for index in range(count):
                            char = textpage.get_text_range(index, 1)
                            left, bottom, right, top = textpage.get_charbox(index)
                            points = [conv.to_bitmap(x, y) for x, y in ((left,bottom),(right,bottom),(right,top),(left,top))]
                            box = (min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points))
                            text.extend(char); boxes.extend([box] * len(char))
                    raw = "".join(text)
                    streams = []
                    inverse, angle = None, 0.0
                    if raw.strip():
                        compact, mapped = _compact(raw, boxes)
                        streams.append((compact, mapped, "pdf-text", None))
                    elif options.get("ocr"):
                        if "tesseract" not in engines:
                            try:
                                engines["tesseract"]=subprocess.run(["tesseract","--version"],capture_output=True,timeout=5,check=True).stdout.decode('utf-8').splitlines()[0][:100]
                            except (OSError,subprocess.SubprocessError):
                                raise InspectionFailure("OCR_UNAVAILABLE") from None
                        adjusted = image
                        if options.get("deskew"):
                            adjusted, inverse, angle = _deskew(image)
                        for words in _ocr_lines(adjusted, options["languages"]):
                            line, mapped, confidence = "", [], []
                            for text, (x,y,w,h), score in words:
                                if line:
                                    line += " "; mapped.append(None)
                                line += text; mapped.extend([(x,y,x+w,y+h)]*len(text)); confidence.append(score)
                            streams.append((line, mapped, "tesseract", min(confidence)))
                    for stream_index, (text, mapped, method, confidence) in enumerate(streams):
                        for match in _matches(text, options["value"]):
                            boxes = [b for b in mapped[match.start():match.end()] if b is not None]
                            if not boxes:
                                continue
                            left=min(b[0] for b in boxes); top=min(b[1] for b in boxes)
                            right=max(b[2] for b in boxes); bottom=max(b[3] for b in boxes)
                            polygon = [(left,top),(right,top),(right,bottom),(left,bottom)]
                            if inverse is not None:
                                polygon = [(float(inverse[0,0]*x+inverse[0,1]*y+inverse[0,2]),float(inverse[1,0]*x+inverse[1,1]*y+inverse[1,2])) for x,y in polygon]
                            polygon = [(max(0,min(1,x/image.width)), max(0,min(1,y/image.height))) for x,y in polygon]
                            bbox = (min(p[0] for p in polygon),min(p[1] for p in polygon),max(p[0] for p in polygon),max(p[1] for p in polygon))
                            if bbox[0] >= bbox[2] or bbox[1] >= bbox[3]:
                                continue
                            candidates.append({"id":f"sha256-{digest}:p{number+1}:{method}:s{stream_index}:c{match.start()}-{match.end()}","page":number+1,"text":match.group(),"bbox":bbox,"polygon":polygon,"method":method,"context":text[max(0,match.start()-80):match.end()+80],"deskew_degrees":angle,"ocr_confidence":confidence})
                            if len(candidates) > 100:
                                raise InspectionFailure("INSPECTION_LIMIT")
    return {"sha256":digest,"candidates":candidates,"engine_versions":engines}


def main():
    from ._docling_worker import _deny_network
    sys.addaudithook(_deny_network)
    try:
        content = sys.stdin.buffer.read(3_000_001)
        if len(content)>3_000_000 or not content.startswith(b"%PDF-"):
            raise InspectionFailure("PDF_REJECTED")
        from pypdf import PdfReader
        pdf = PdfReader(io.BytesIO(content))
        if pdf.is_encrypted or not 1<=len(pdf.pages)<=4:
            raise InspectionFailure("PDF_REJECTED")
        if sys.argv[1]=="structure":
            from .structure import inspect_pdf_tags
            result={"sha256":hashlib.sha256(content).hexdigest(),"structure":asdict(inspect_pdf_tags(pdf))}
        elif sys.argv[1]=="ground":
            result=ground(content,json.loads(sys.argv[2]))
        else:
            raise InspectionFailure("PDF_REJECTED")
        print(json.dumps(result,ensure_ascii=False,allow_nan=False))
        return 0
    except ImportError:
        code="INSPECTION_DEPENDENCY_MISSING"
    except InspectionFailure as error:
        code=str(error)
    except Exception:
        code="INSPECTION_FAILED"
    print(json.dumps({"error":code})); return 1


if __name__=="__main__":
    raise SystemExit(main())
