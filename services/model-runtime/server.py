"""Private opt-in CPU model bridge. Never downloads a model or follows document URLs."""
import base64
import io
import json
import math
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from html.parser import HTMLParser
from pathlib import Path

MAX_BODY = 4_100_000
SLOT = threading.BoundedSemaphore(1)
MODELS = {}


def texts(data):
    values = data.get("texts")
    if not isinstance(values, list) or not 1 <= len(values) <= 24:
        raise ValueError("Bounded text list required")
    if any(not isinstance(t, str) or not t.strip() or len(t) > 12_000 for t in values):
        raise ValueError("Invalid text")
    return values


def model_path(name):
    path = Path("/models") / name
    if not path.is_dir() or not (path / "config.json").is_file():
        raise RuntimeError("Explicitly prepared local model required")
    return str(path)


def vectors(data):
    values = texts(data)
    if "embed" not in MODELS:
        from FlagEmbedding import BGEM3FlagModel
        MODELS["embed"] = BGEM3FlagModel(model_path("bge-m3"), use_fp16=False, devices=["cpu"])
    matrix = MODELS["embed"].encode(values, batch_size=1, max_length=2048)["dense_vecs"].tolist()
    if len(matrix) != len(values) or any(len(v) != 1024 or any(not math.isfinite(x) for x in v) for v in matrix):
        raise RuntimeError("Invalid model vector")
    return {"model": "BAAI/bge-m3", "dimensions": 1024, "vectors": matrix}


def rerank(data):
    values = texts(data)
    query = data.get("query")
    if not isinstance(query, str) or not 1 <= len(query) <= 2000:
        raise ValueError("Bounded query required")
    if "rerank" not in MODELS:
        from FlagEmbedding import FlagReranker
        MODELS["rerank"] = FlagReranker(model_path("bge-reranker-v2-m3"), use_fp16=False, devices=["cpu"])
    scores = MODELS["rerank"].compute_score([[query, value] for value in values], batch_size=1, max_length=2048, normalize=True)
    if hasattr(scores, "tolist"):
        scores = scores.tolist()
    if isinstance(scores, (int, float)):
        scores = [scores]
    if len(scores) != len(values) or any(not math.isfinite(s) or not 0 <= s <= 1 for s in scores):
        raise RuntimeError("Invalid reranker output")
    return {"model": "BAAI/bge-reranker-v2-m3", "scores": scores}


class Table(HTMLParser):
    """Retain cell positions; do not execute/render model-generated HTML."""
    def __init__(self):
        super().__init__()
        self.cells, self.used = [], set()
        self.row, self.col, self.cell = -1, 0, None
        self.rows = self.columns = 0

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row += 1
            self.col = 0
            if self.row >= 500:
                raise ValueError("Too many rows")
        if tag in ("td", "th"):
            if self.cell is not None or self.row < 0:
                raise ValueError("Ambiguous table")
            while (self.row, self.col) in self.used:
                self.col += 1
            attributes = dict(attrs)
            rs, cs = int(attributes.get("rowspan", 1)), int(attributes.get("colspan", 1))
            if not 1 <= rs <= 500 or not 1 <= cs <= 100 or self.row + rs > 500 or self.col + cs > 100:
                raise ValueError("Table exceeds bounds")
            for r in range(self.row, self.row + rs):
                for c in range(self.col, self.col + cs):
                    if (r, c) in self.used:
                        raise ValueError("Overlapping table cells")
                    self.used.add((r, c))
            self.cell = {"row": self.row, "column": self.col, "text": ""}
            self.rows, self.columns = max(self.rows, self.row + rs), max(self.columns, self.col + cs)
            self.col += cs

    def handle_data(self, value):
        if self.cell is not None:
            self.cell["text"] += value
            if len(self.cell["text"]) > 500:
                raise ValueError("Cell too long")

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None:
            self.cell["text"] = self.cell["text"].strip()
            self.cells.append(self.cell)
            self.cell = None
            if len(self.cells) > 1500:
                raise ValueError("Too many cells")


def parsed_page(raw, number):
    result = raw.get("res", raw)
    blocks = result.get("parsing_res_list")
    if not isinstance(blocks, list) or not blocks or len(blocks) > 4000:
        raise ValueError("No complete page evidence")
    content, tables = [], []
    for block in blocks:
        value = block.get("block_content")
        if not isinstance(value, str):
            raise ValueError("Missing block content")
        if block.get("block_label") == "table":
            table = Table()
            table.feed(value)
            table.close()
            if table.cell is not None or not table.cells or len(tables) >= 30:
                raise ValueError("Invalid table")
            tables.append({"page": number, "rows": table.rows, "columns": table.columns, "cells": table.cells})
            content.extend(c["text"] for c in table.cells)
        else:
            content.append(value)
    text = "\n".join(content).strip()
    if not text or len(text) > 12_000:
        raise ValueError("Page text missing or too large")
    return {"number": number, "text": text}, tables


def parse(data):
    if os.environ.get("PADDLE_ENABLED") != "true":
        raise RuntimeError("PaddleOCR is disabled")
    encoded = data.get("base64")
    if not isinstance(encoded, str):
        raise ValueError("File bytes required")
    source = base64.b64decode(encoded, validate=True)
    if not 1 <= len(source) <= 3_000_000:
        raise ValueError("File size out of bounds")
    from PIL import Image
    import numpy as np
    Image.MAX_IMAGE_PIXELS = 6_000_000
    images = []
    if source.startswith(b"%PDF-"):
        import pypdfium2 as pdfium
        with pdfium.PdfDocument(source) as document:
            if not 1 <= len(document) <= 4:
                raise ValueError("Page limit exceeded")
            for index in range(len(document)):
                with document[index] as page:
                    if page.get_width() * page.get_height() * 4 > 6_000_000:
                        raise ValueError("Rendered page too large")
                    bitmap = page.render(scale=2)
                    try:
                        images.append(np.array(bitmap.to_pil().convert("RGB")))
                    finally:
                        bitmap.close()
    else:
        with Image.open(io.BytesIO(source)) as image:
            if image.format not in ("PNG", "JPEG") or image.width * image.height > 6_000_000:
                raise ValueError("Unsupported image")
            images.append(np.array(image.convert("RGB")))
    if "paddle" not in MODELS:
        # Models must already be cached in the mounted private cache. Runtime has no network egress.
        from paddleocr import PPStructureV3
        MODELS["paddle"] = PPStructureV3(device="cpu", use_doc_orientation_classify=False,
                                       use_doc_unwarping=False, use_textline_orientation=False,
                                       use_formula_recognition=False, use_seal_recognition=False)
    pages, tables = [], []
    for index, image in enumerate(images, 1):
        results = list(MODELS["paddle"].predict(input=image))
        if len(results) != 1:
            raise ValueError("Ambiguous page output")
        raw = results[0].json
        if isinstance(raw, str):
            raw = json.loads(raw)
        page, page_tables = parsed_page(raw, index)
        pages.append(page)
        tables.extend(page_tables)
    return {"model": "PP-StructureV3", "provider": "paddleocr", "pages": pages, "tables": tables}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # No prompts, bytes, paths or model exception bodies in request logs.

    def reply(self, status, body):
        encoded = json.dumps(body, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        self.reply(200 if self.path == "/health" else 404, {"status": "ready", "modelLoaded": bool(MODELS), "automaticDownloads": False})

    def do_POST(self):
        self.connection.settimeout(120)
        if self.path not in ("/embed", "/rerank", "/parse"):
            return self.reply(404, {"error": "Unknown operation"})
        if not SLOT.acquire(blocking=False):
            return self.reply(429, {"error": "Model busy"})
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 1 <= size <= MAX_BODY or self.headers.get("Transfer-Encoding"):
                return self.reply(413, {"error": "Body limit"})
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError("Object required")
            result = {"/embed": vectors, "/rerank": rerank, "/parse": parse}[self.path](data)
            self.reply(200, result)
        except (ValueError, TypeError, KeyError):
            self.reply(422, {"error": "Invalid bounded model input"})
        except Exception:
            self.reply(503, {"error": "Local model unavailable; no fallback"})
        finally:
            SLOT.release()


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8090), Handler).serve_forever()
