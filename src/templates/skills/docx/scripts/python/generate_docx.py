#!/usr/bin/env python3
"""
generate_docx.py — Brand+theme-aware DOCX generator.
Usage: python3 generate_docx.py --content content.json [--tokens brand_tokens.json] [--theme dark|light] --output out.docx
"""

import argparse
import json
import sys
from pathlib import Path

try:
    from docx import Document
    from docx.shared import Pt, RGBColor, Inches
except ImportError:
    print(
        "Error: python-docx not installed. Run: pip install python-docx",
        file=sys.stderr,
    )
    sys.exit(1)


def hex_rgb(hex_color: str) -> RGBColor:
    h = hex_color.lstrip("#")
    return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def set_para_color(para, color_hex, size_pt, font_name, bold=False, italic=False):
    for run in para.runs:
        run.font.color.rgb = hex_rgb(color_hex)
        run.font.size = Pt(size_pt)
        run.font.name = font_name
        run.font.bold = bold
        run.font.italic = italic


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--content", required=True)
    p.add_argument("--tokens")
    p.add_argument("--theme", default="dark", choices=["dark", "light"])
    p.add_argument("--output", required=True)
    return p.parse_args()


def main():
    args = parse_args()
    default_tokens = Path(__file__).parent.parent / "brand_tokens.json"
    tokens_path = Path(args.tokens) if args.tokens else default_tokens
    tokens = json.loads(tokens_path.read_text())
    T = tokens["themes"][args.theme]
    F = tokens["fonts"]
    content = json.loads(Path(args.content).read_text())

    doc = Document()

    title_para = doc.add_heading(content["title"], level=0)
    set_para_color(title_para, T["text_primary"], 28, F["fallback_sans"], bold=True)

    if content.get("subtitle"):
        sub = doc.add_paragraph(content["subtitle"])
        set_para_color(sub, T["text_secondary"], 16, F["fallback_sans"], italic=True)

    if content.get("author"):
        auth = doc.add_paragraph(f"By {content['author']}")
        set_para_color(auth, T["text_secondary"], 11, F["fallback_sans"])

    doc.add_paragraph()

    for sec in content["sections"]:
        h = doc.add_heading(sec["heading"], level=1)
        set_para_color(h, T["primary"], 20, F["fallback_sans"], bold=True)

        if sec.get("body"):
            body_para = doc.add_paragraph(sec["body"])
            set_para_color(body_para, T["text_primary"], 11, F["fallback_sans"])

        for item in sec.get("items", []):
            bullet = doc.add_paragraph(item, style="List Bullet")
            set_para_color(bullet, T["text_primary"], 11, F["fallback_sans"])

        if sec.get("callout"):
            callout_para = doc.add_paragraph(sec["callout"])
            callout_para.paragraph_format.left_indent = Inches(0.3)
            callout_para.paragraph_format.right_indent = Inches(0.3)
            set_para_color(
                callout_para, T["accent"], 12, F["fallback_sans"], italic=True
            )

    doc.save(args.output)
    print(f"DOCX written: {args.output} ({len(content['sections'])} sections)")


if __name__ == "__main__":
    main()
