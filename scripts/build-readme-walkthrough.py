"""Assemble actual browser captures into an explicitly edited English walkthrough.

Usage: python scripts/build-readme-walkthrough.py CAPTURE_DIRECTORY OUTPUT.gif
Requires Pillow. Screenshots must be captured from the real running app; this
script adds framing/captions only and never replaces screenshot content.
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SCENES = [
    ("01-processing.jpg", "Track each file from receipt to review", "Processing control room: each file moves through recorded stages, and extraction is not approval.", 5000),
    ("02-sources.jpg", "Use local files as sources", "Local files and fictional fixtures are the only sources offered; each import uses the same scan, extraction and review path.", 4500),
    ("03-documents.jpg", "Review extracted evidence", "A reviewer confirms each document before its JSON report can be downloaded.", 5000),
    ("04-evaluation.jpg", "Read PDF evidence without invented scores", "Counts come from uploaded PDFs; OCR confidence is not measured accuracy, and no ground-truth score is shown.", 5000),
    ("05-control-pipeline.jpg", "Measure the Bronze to Gold pipeline", "Step timings and row flow come from the latest ETL run; each value carries a Measured badge.", 5500),
    ("06-control-quality.jpg", "Compare raw and reviewed values", "Each observation shows the raw and reviewed value; select one to follow it through the drill-through panel.", 5000),
    ("07-control-rag.jpg", "Read retrieval and citation results", "Labelled evaluation cases; a dash marks a case that has not run yet.", 5000),
    ("08-control-cost.jpg", "Separate measured from configured cost", "Estimated costs come from configuration and are labelled Configured only; local engines carry no per-token fee.", 5000),
    ("09-trust.jpg", "Keep a person responsible for AI use", "A reviewer task is only a task: it does not approve evidence or credit.", 5000),
    ("10-ai103.jpg", "Track AI-103 capability status", "Eighteen capability groups, each tied to a fictional document; statuses come from one manifest, and nothing here calls Azure.", 5000),
    ("11-audit.jpg", "Review the recorded history", "Each upload and extraction step is recorded with its time and account ID.", 4500),
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
