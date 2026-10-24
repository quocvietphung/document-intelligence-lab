"""Assemble fresh browser captures into an explicitly edited English walkthrough.

Usage: python scripts/build-readme-walkthrough.py CAPTURE_DIRECTORY OUTPUT.gif
Requires Pillow. Screenshots must be captured from the real running app; this
script adds framing/captions only and never replaces screenshot content.
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SCENES = [
    ("01-login.jpg", "Sign in with Keycloak", "Local workspace authentication; no credentials are shown.", 3500),
    ("02-overview.jpg", "Find the right AI workflow", "16 AI-assisted workflows; engine configuration is not a live health check.", 4500),
    ("03-documents.jpg", "Open an analyzed document", "Saved Docling extraction: one original, two fields and two tables; review is still required.", 4500),
    ("04-evidence.jpg", "Compare extraction with the original PDF", "Inspect page-bound evidence and preserve the source currency; extraction is not approval.", 5500),
    ("05-nova.jpg", "Ask Nova and inspect its source", "Actual local Ollama answer generated for this capture; inference waiting time is omitted.", 6500),
    ("06-pipeline.jpg", "Track the durable processing queue", "Saved receipt: ClamAV scan completed; the document awaits human review.", 4500),
    ("07-etl.jpg", "Inspect Bronze, Silver and Gold", "Saved local DuckDB / dbt result: Gold remains empty because evidence is unreviewed.", 5000),
    ("08-quality.jpg", "Keep uncertainty visible", "Saved quality finding: ambiguous day/month order is preserved, not silently guessed.", 5000),
    ("09-research.jpg", "Evaluate against independently checked references", "The research workspace separates labels, extraction checks and retrieval experiments.", 4500),
]


def font(size):
    for name in ["/System/Library/Fonts/Supplemental/Arial.ttf", "DejaVuSans.ttf"]:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("captures", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    frames = []
    size = None
    for index, (filename, title, subtitle, duration) in enumerate(SCENES):
        with Image.open(args.captures / filename) as original:
            screenshot = original.convert("RGB")
        if size is None:
            size = screenshot.size
        if screenshot.size != size:
            raise ValueError("All captures must have the same unmodified viewport size")
        width, height = size
        frame = Image.new("RGB", (width, height + 114), "#102c34")
        frame.paste(screenshot, (0, 82))
        draw = ImageDraw.Draw(frame)
        draw.text((24, 12), f"{index + 1:02d} / {len(SCENES):02d}   {title}", font=font(24), fill="#f2faf7")
        draw.text((24, 47), subtitle, font=font(16), fill="#b8d9d1")
        draw.text((24, height + 91), "DOCUMENT INTELLIGENCE LAB  /  ENGLISH  /  EDITED WALKTHROUGH  /  NO HUMAN APPROVAL IMPLIED", font=font(13), fill="#b8d9d1")
        draw.rectangle((0, height + 111, round(width * (index + 1) / len(SCENES)), height + 113), fill="#75d6bd")
        frames.append(frame.quantize(colors=192))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(args.output, save_all=True, append_images=frames[1:],
                   duration=[scene[3] for scene in SCENES], loop=0, disposal=2, optimize=True)
    with Image.open(args.output) as result:
        assert result.n_frames == len(SCENES)
    print(f"Created {args.output.name}: {len(frames)} actual UI captures, {sum(s[3] for s in SCENES) / 1000:g} seconds")


if __name__ == "__main__":
    main()
