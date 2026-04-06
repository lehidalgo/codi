#!/usr/bin/env python3
"""
generate_pptx.py — Brand+theme-aware PPTX generator.
Usage: python3 generate_pptx.py --content content.json [--tokens brand_tokens.json] [--theme dark|light] --output out.pptx
"""

import argparse
import json
import sys
from pathlib import Path

try:
    from pptx import Presentation
    from pptx.util import Inches, Pt
    from pptx.dml.color import RGBColor
except ImportError:
    print(
        "Error: python-pptx not installed. Run: pip install python-pptx",
        file=sys.stderr,
    )
    sys.exit(1)


def hex_rgb(hex_color: str) -> RGBColor:
    h = hex_color.lstrip("#")
    return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--content", required=True)
    p.add_argument("--tokens")
    p.add_argument("--theme", default="dark", choices=["dark", "light"])
    p.add_argument("--output", required=True)
    return p.parse_args()


def add_rect(slide, x, y, w, h, fill_hex):
    shape = slide.shapes.add_shape(1, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.fill.solid()
    shape.fill.fore_color.rgb = hex_rgb(fill_hex)
    shape.line.fill.background()
    return shape


def add_textbox(
    slide, text, x, y, w, h, color_hex, size, font_name, bold=False, italic=False
):
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    run = p.add_run()
    run.text = text
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = hex_rgb(color_hex)
    run.font.name = font_name
    return tb


def build_title_slide(prs, content, T, F, W, H, M, BAR, brand):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = hex_rgb(T["background"])
    add_rect(slide, 0, 0, BAR, H, T["accent"])
    add_textbox(
        slide,
        brand.upper(),
        M,
        0.3,
        W - M * 2,
        0.4,
        T["accent"],
        11,
        F["fallback_sans"],
        bold=True,
    )
    add_textbox(
        slide,
        content["title"],
        M,
        H * 0.3,
        W - M * 2,
        2.4,
        T["text_primary"],
        40,
        F["fallback_sans"],
        bold=True,
    )
    if content.get("subtitle"):
        add_textbox(
            slide,
            content["subtitle"],
            M,
            H * 0.3 + 2.5,
            W - M * 2,
            0.8,
            T["text_secondary"],
            18,
            F["fallback_sans"],
        )
    if content.get("author"):
        add_textbox(
            slide,
            content["author"],
            M,
            H - 0.55,
            W - M * 2,
            0.35,
            T["text_secondary"],
            12,
            F["fallback_sans"],
        )


def build_section_slide(prs, sec, T, F, W, H, M, BAR):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = hex_rgb(T["background"])
    add_rect(slide, 0, 0, BAR, H, T["accent"])
    label_parts = [x for x in [sec.get("number"), sec.get("label")] if x]
    if label_parts:
        add_textbox(
            slide,
            "  ·  ".join(label_parts),
            M,
            0.3,
            W - M * 2,
            0.35,
            T["accent"],
            11,
            F["fallback_sans"],
            bold=True,
        )
    add_textbox(
        slide,
        sec["heading"],
        M,
        0.9,
        W - M * 2,
        1.4,
        T["text_primary"],
        32,
        F["fallback_sans"],
        bold=True,
    )
    y = 2.5
    if sec.get("body"):
        add_textbox(
            slide,
            sec["body"],
            M,
            y,
            W - M * 2,
            1.0,
            T["text_secondary"],
            16,
            F["fallback_sans"],
        )
        y += 1.15
    for item in sec.get("items", []):
        add_textbox(
            slide,
            f"• {item}",
            M + 0.2,
            y,
            W - M * 2 - 0.2,
            0.4,
            T["text_primary"],
            15,
            F["fallback_sans"],
        )
        y += 0.45
    if sec.get("callout"):
        add_rect(slide, M, y, W - M * 2, 0.75, T["surface"])
        add_textbox(
            slide,
            sec["callout"],
            M + 0.2,
            y + 0.12,
            W - M * 2 - 0.4,
            0.5,
            T["accent"],
            14,
            F["fallback_sans"],
            italic=True,
        )


def main():
    args = parse_args()
    default_tokens = Path(__file__).parent.parent / "brand_tokens.json"
    tokens_path = Path(args.tokens) if args.tokens else default_tokens
    tokens = json.loads(tokens_path.read_text())
    T = tokens["themes"][args.theme]
    F = tokens["fonts"]
    L = tokens["layout"]
    content = json.loads(Path(args.content).read_text())
    W, H, M, BAR = (
        float(L["slide_width_in"]),
        float(L["slide_height_in"]),
        float(L["content_margin_in"]),
        float(L["accent_bar_width_in"]),
    )

    prs = Presentation()
    prs.slide_width = Inches(W)
    prs.slide_height = Inches(H)

    build_title_slide(prs, content, T, F, W, H, M, BAR, tokens["brand"])
    for sec in content["sections"]:
        build_section_slide(prs, sec, T, F, W, H, M, BAR)

    prs.save(args.output)
    print(f"PPTX written: {args.output} ({len(content['sections'])} sections)")


if __name__ == "__main__":
    main()
