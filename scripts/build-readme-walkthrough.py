"""Assemble actual browser captures into an explicitly edited English walkthrough.

Usage: python scripts/build-readme-walkthrough.py CAPTURE_DIRECTORY OUTPUT.gif
Requires Pillow. Screenshots must be captured from the real running app; this
script adds framing/captions only and never replaces screenshot content.
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SCENES = [
    ("01-login.jpg", "Sign in with Keycloak", "Local workspace authentication; no credentials are shown.", 3000),
    ("02-overview.jpg", "Find the right AI workflow", "17 AI-assisted workflows; catalogue entries are not live model calls.", 4000),
    ("03-documents.jpg", "Open a prepared PDF result", "Saved Docling extraction; its recorded review state is unchanged for this walkthrough.", 4000),
    ("04-evidence.jpg", "Compare extraction with the original PDF", "Inspect the source page, recorded fields and tables before using a value.", 4500),
    ("05-source.jpg", "Inspect one source occurrence", "The PDF crop, recorded OCR and checked value are separate observations.", 5000),
    ("06a-nova-guide.jpg", "Use Nova's app guidance", "Local navigation help in the expanded chat; this mode does not invoke an LLM.", 5000),
    ("06-nova.jpg", "Review a saved local Nova answer", "Previously saved Ollama response; source-version warnings remain visible. No regeneration is implied.", 6500),
    ("07-pipeline.jpg", "Inspect the recorded processing stages", "Source hashes and saved events keep scanning, extraction and reviewer confirmation separate.", 4000),
    ("08-etl.jpg", "Inspect Bronze, Silver and Gold", "Saved local DuckDB / dbt artifacts; only reviewer-confirmed values are eligible for Gold.", 4500),
    ("09-sources.jpg", "Switch to the PDF benchmark dossier", "9 prepared PDFs with publisher links and original-page mappings; no automatic cloud upload.", 4500),
    ("09b-domains.jpg", "Browse DATEV and insurance sources", "Publisher pages stay explicit across payroll, policy wording and official coverage forms.", 4500),
    ("10-research.jpg", "Compare retrieval on actual PDF evidence", "77 authored questions: 69 answerable, 8 unanswerable; no LLM judge score.", 5000),
    ("11-holdout.jpg", "Check held-out results and missing evidence", "Inspect source-grouped metrics and incomplete multi-page results; retrieval is not answer accuracy.", 6000),
    ("12-analytics.jpg", "Inspect source-bound document analytics", "Observed fields, invoice lines and quality findings link back to the PDF; no automatic approval.", 5500),
    ("13-mlflow.jpg", "Track a real local cohort experiment", "The small PDF set has insufficient baseline data. No anomaly accuracy or fraud probability is claimed.", 5500),
]


def font(size):
    for name in ["/System/Library/Fonts/Supplemental/Arial.ttf", "DejaVuSans.ttf"]:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)


def caption_lines(draw, text, typeface, max_width):
    lines = []
    for word in text.split():
        if not lines or draw.textlength(lines[-1] + " " + word, font=typeface) > max_width:
            lines.append(word)
        else:
            lines[-1] += " " + word
    if len(lines) > 2:
        raise ValueError("Caption exceeds two lines; shorten it instead of hiding content")
    return lines


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("captures", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    screenshots = []
    for filename, *_ in SCENES:
        with Image.open(args.captures / filename) as original:
            screenshots.append(original.convert("RGB"))
    width = max(image.width for image in screenshots)
    height = max(image.height for image in screenshots)
    frames = []
    for index, (filename, title, subtitle, duration) in enumerate(SCENES):
        screenshot = screenshots[index]
        frame = Image.new("RGB", (width, height + 136), "#102c34")
        # Pad captures if the browser window changed size; never rescale source pixels.
        frame.paste(screenshot, ((width - screenshot.width) // 2, 104))
        draw = ImageDraw.Draw(frame)
        draw.text((24, 12), f"{index + 1:02d} / {len(SCENES):02d}   {title}", font=font(24), fill="#f2faf7")
        subtitle_font = font(16)
        for line, content in enumerate(caption_lines(draw, subtitle, subtitle_font, width - 48)):
            draw.text((24, 47 + line * 21), content, font=subtitle_font, fill="#b8d9d1")
        draw.text((24, height + 113), "DOCUMENT INTELLIGENCE LAB  /  ENGLISH  /  EDITED WALKTHROUGH  /  NO HUMAN APPROVAL IMPLIED", font=font(13), fill="#b8d9d1")
        draw.rectangle((0, height + 133, round(width * (index + 1) / len(SCENES)), height + 135), fill="#75d6bd")
        frames.append(frame.quantize(colors=192))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(args.output, save_all=True, append_images=frames[1:],
                   duration=[scene[3] for scene in SCENES], loop=0, disposal=2, optimize=True)
    with Image.open(args.output) as result:
        assert result.n_frames == len(SCENES)
    print(f"Created {args.output.name}: {len(frames)} actual UI captures, {sum(s[3] for s in SCENES) / 1000:g} seconds")


if __name__ == "__main__":
    main()
