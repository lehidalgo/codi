"""
html_validator.py — Validates RL3 brand HTML output against 12 brand rules.

Uses lxml.html for DOM checks and regex for pattern matching.
Imports values from brand_tokens for single-source-of-truth validation.
"""

import sys
import os
import re
import json
import argparse

# Allow imports from parent (rl3-brand root)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import brand_tokens as bt


def validate_html(filepath: str) -> dict:
    """
    Validate an HTML file against 12 RL3 brand rules.

    Returns:
        {
            "passed": bool,
            "errors": [{"rule": str, "message": str, "detail": str}, ...],
            "warnings": []
        }
    """
    from lxml import html as lxml_html

    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    tree = lxml_html.fromstring(content)
    errors = []

    # ── Rule 1: css_variables ───────────────────────────────────────────
    # All 8 CSS variables present with exact hex from brand_tokens.COLORS
    for key, value in bt.COLORS.items():
        css_var = f"--rl3-{key.replace('_', '-')}"
        pattern = rf"{re.escape(css_var)}\s*:\s*{re.escape(value)}"
        if not re.search(pattern, content):
            errors.append({
                "rule": "css_variables",
                "message": f"CSS variable {css_var} with value {value} not found",
                "detail": f"Expected '{css_var}: {value}' in :root block",
            })

    # ── Rule 2: google_fonts ────────────────────────────────────────────
    # URL loads Space Grotesk, Space Mono, Instrument Sans
    required_fonts = ["Space+Grotesk", "Space+Mono", "Instrument+Sans"]
    # Find all href attributes that point to fonts.googleapis.com
    font_links = re.findall(r'href="([^"]*fonts\.googleapis\.com[^"]*)"', content)
    font_link_text = " ".join(font_links)
    missing_fonts = [f for f in required_fonts if f not in font_link_text]
    if missing_fonts:
        errors.append({
            "rule": "google_fonts",
            "message": f"Google Fonts link missing font families: {', '.join(missing_fonts)}",
            "detail": "Link must load Space Grotesk, Space Mono, and Instrument Sans",
        })

    # ── Rule 3: logo_structure ──────────────────────────────────────────
    # Logo uses one <text> with <tspan> for "3", not two separate <text>
    # Look for SVG elements in the HTML — find all <svg> that contain <text> with RL
    # We need to check via regex on the raw HTML to preserve SVG structure
    svg_blocks = re.findall(r'<svg[^>]*>.*?</svg>', content, re.DOTALL)
    logo_found = False
    logo_valid = False
    for svg_block in svg_blocks:
        # Check if this SVG is the logo (contains RL and 3)
        if "RL" in svg_block and "3" in svg_block:
            logo_found = True
            # Count <text> elements that contain "RL" — should be exactly one with tspan
            # The correct pattern: single <text> containing "RL" with a <tspan> child for "3"
            rl_text_elements = re.findall(r'<text[^>]*>[^<]*RL[^<]*<tspan[^>]*>3</tspan>[^<]*</text>', svg_block)
            if rl_text_elements:
                logo_valid = True
            break

    if not logo_found:
        errors.append({
            "rule": "logo_structure",
            "message": "Logo SVG not found",
            "detail": "Expected an SVG with <text> containing 'RL' and <tspan> for '3'",
        })
    elif not logo_valid:
        errors.append({
            "rule": "logo_structure",
            "message": "Logo must use single <text> with <tspan> for '3'",
            "detail": "Found logo SVG but it uses separate <text> elements instead of <text>RL<tspan>3</tspan></text>",
        })

    # ── Rule 4: logo_3_color ───────────────────────────────────────────
    # The "3" tspan fill is exactly #c8b88a
    tspan_fills = re.findall(r'<tspan[^>]*fill="([^"]*)"[^>]*>3</tspan>', content)
    if not tspan_fills:
        # Also check if tspan exists with 3 but fill is elsewhere
        tspan_fills = re.findall(r'<tspan[^>]*>3</tspan>', content)
        if tspan_fills:
            errors.append({
                "rule": "logo_3_color",
                "message": "Logo '3' tspan has no fill attribute",
                "detail": "Expected fill=\"#c8b88a\" on tspan containing '3'",
            })
        # If no tspan at all, logo_structure already flags this
    else:
        accent = bt.COLORS["accent"]
        if not any(f == accent for f in tspan_fills):
            errors.append({
                "rule": "logo_3_color",
                "message": f"Logo '3' tspan fill is '{tspan_fills[0]}', expected '{accent}'",
                "detail": f"The tspan for '3' must use fill=\"{accent}\"",
            })

    # ── Rule 5: forbidden_phrases ──────────────────────────────────────
    for phrase in bt.PHRASES_AVOID:
        if phrase.lower() in content.lower():
            errors.append({
                "rule": "forbidden_phrases",
                "message": f"Forbidden phrase found: '{phrase}'",
                "detail": f"The phrase '{phrase}' is not allowed in RL3 brand content",
            })

    # ── Rule 6: section_labels ─────────────────────────────────────────
    # Labels follow "01 — Name" format (regex: \d{2}\s*—\s*\w+)
    # Find elements with class section-label in the DOM
    label_elements = tree.xpath('//*[contains(@class, "section-label")]')
    if label_elements:
        section_label_pattern = re.compile(r'\d{2}\s*\u2014\s*\w+')
        for el in label_elements:
            text = el.text_content().strip()
            if not section_label_pattern.search(text):
                errors.append({
                    "rule": "section_labels",
                    "message": f"Section label '{text}' does not match format 'NN — Name'",
                    "detail": "Section labels must follow the pattern: two digits, em-dash, name (e.g., '01 — Contexto')",
                })

    # ── Rule 7: background_color ───────────────────────────────────────
    # Background is #0a0a0b
    bg_color = bt.COLORS["black"]
    bg_pattern = re.compile(r'background\s*:\s*' + re.escape(bg_color))
    bg_color_pattern = re.compile(r'background-color\s*:\s*' + re.escape(bg_color))
    if not bg_pattern.search(content) and not bg_color_pattern.search(content):
        errors.append({
            "rule": "background_color",
            "message": f"Body background is not {bg_color}",
            "detail": f"Expected 'background: {bg_color}' or 'background-color: {bg_color}'",
        })

    # ── Rule 8: cursor_crosshair ───────────────────────────────────────
    cursor_pattern = re.compile(r'cursor\s*:\s*crosshair')
    if not cursor_pattern.search(content):
        errors.append({
            "rule": "cursor_crosshair",
            "message": "cursor: crosshair not found on body",
            "detail": "The body must have cursor: crosshair set",
        })

    # ── Rule 9: grain_overlay ──────────────────────────────────────────
    # feTurbulence or CSS equivalent present
    if "feTurbulence" not in content and "feturbulence" not in content.lower():
        errors.append({
            "rule": "grain_overlay",
            "message": "Grain overlay (feTurbulence) not found",
            "detail": "Expected feTurbulence SVG filter for grain overlay effect",
        })

    # ── Rule 10: max_width ─────────────────────────────────────────────
    max_width = bt.LAYOUT["max_width"]
    max_width_pattern = re.compile(r'max-width\s*:\s*' + re.escape(max_width))
    if not max_width_pattern.search(content):
        errors.append({
            "rule": "max_width",
            "message": f"Content max-width {max_width} not found",
            "detail": f"Expected 'max-width: {max_width}' for content container",
        })

    # ── Rule 11: mobile_breakpoint ─────────────────────────────────────
    breakpoint = bt.LAYOUT["mobile_breakpoint"]
    bp_pattern = re.compile(r'@media\s*\(\s*max-width\s*:\s*' + re.escape(breakpoint) + r'\s*\)')
    if not bp_pattern.search(content):
        errors.append({
            "rule": "mobile_breakpoint",
            "message": f"Mobile breakpoint @media (max-width: {breakpoint}) not found",
            "detail": f"Expected media query at {breakpoint}",
        })

    # ── Rule 12: fade_animation ────────────────────────────────────────
    fade_pattern = re.compile(r'@keyframes\s+fadeUp')
    if not fade_pattern.search(content):
        errors.append({
            "rule": "fade_animation",
            "message": "fadeUp keyframe animation not found",
            "detail": "Expected '@keyframes fadeUp' definition",
        })

    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "warnings": [],
    }


# ── CLI ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validate RL3 brand HTML")
    parser.add_argument("--input", required=True, help="Path to HTML file to validate")
    args = parser.parse_args()

    result = validate_html(args.input)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    sys.exit(0 if result["passed"] else 1)
