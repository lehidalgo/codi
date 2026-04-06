"""
brand_tokens.py — Python adapter for Codi brand tokens.
Reads brand_tokens.json and exposes typed constants for python-pptx use.
"""

import json
import os

_DIR = os.path.dirname(__file__)
_JSON = os.path.join(_DIR, "..", "brand_tokens.json")

with open(_JSON, "r", encoding="utf-8") as _f:
    _data = json.load(_f)

COLORS: dict[str, str] = _data["colors"]
FONTS: dict[str, str] = _data["fonts"]
LAYOUT: dict[str, str] = _data["layout"]
ASSETS: dict[str, str] = _data["assets"]
VOICE: dict = _data["voice"]


def hex_color(key: str) -> str:
    """Return 6-char hex string without # (for pptx RGBColor)."""
    color = COLORS.get(key, "")
    if not color:
        raise ValueError(
            f"Unknown Codi color token: '{key}'. Available: {list(COLORS)}"
        )
    return color.lstrip("#")


def rgb(key: str) -> tuple[int, int, int]:
    """Return (r, g, b) tuple for a color token."""
    h = hex_color(key)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
