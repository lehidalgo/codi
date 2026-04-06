"""
brand_tokens.py — Python adapter for RL3 brand tokens.
Reads brand_tokens.json and exposes typed constants.
Preserves all extra constants (CSS, logo SVGs, typography, animations) for backward compatibility.
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

# Backward-compatible aliases
PHRASES_USE: list[str] = VOICE["phrases_use"]
PHRASES_AVOID: list[str] = VOICE["phrases_avoid"]


def hex_color(key: str) -> str:
    """Return 6-char hex string without # (for python-pptx RGBColor)."""
    color = COLORS.get(key, "")
    if not color:
        raise ValueError(f"Unknown RL3 color token: '{key}'. Available: {list(COLORS)}")
    return color.lstrip("#")


def rgb(key: str) -> tuple[int, int, int]:
    """Return (r, g, b) tuple for a color token."""
    h = hex_color(key)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


# ── CSS Variables (derived from JSON) ────────────────────────────────

CSS_VARIABLES: str = (
    f":root {{\n"
    f"  --rl3-black:      {COLORS['primary']};\n"
    f"  --rl3-white:      {COLORS['white']};\n"
    f"  --rl3-accent:     {COLORS['accent']};\n"
    f"  --rl3-accent-dim: {COLORS['accent_dim']};\n"
    f"  --rl3-gray:       {COLORS['text_secondary']};\n"
    f"  --rl3-dark-gray:  {COLORS['primary_light']};\n"
    f"  --rl3-mid-gray:   {COLORS['primary_mid']};\n"
    f"  --rl3-light-bg:   {COLORS['background']};\n"
    f"}}"
)

# ── Fonts (backward-compatible short aliases) ─────────────────────────

FONTS_SHORT: dict[str, str] = {
    "headlines": FONTS["pptx_headlines"],
    "mono": FONTS.get("web_mono", "Space Mono"),
    "body": FONTS["pptx_body"],
}

GOOGLE_FONTS_URL: str = (
    "https://fonts.googleapis.com/css2"
    "?family=Instrument+Sans:wght@400;500;600;700"
    "&family=Space+Grotesk:wght@400;500;600;700"
    "&family=Space+Mono:wght@400;700"
    "&display=swap"
)

# ── Typography ───────────────────────────────────────────────────────

TYPOGRAPHY: dict[str, str] = {
    "headline_weight": "600-700",
    "headline_tracking": "-0.02em",
    "label_tracking": "0.3em",
    "label_size": "0.65rem",
    "body_weight": "400-600",
    "body_line_height": "1.7",
}

# ── Logo SVGs ────────────────────────────────────────────────────────

LOGO_LIGHT_BG: str = """\
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60">
  <text x="10" y="42" font-family="Space Grotesk" font-size="48" font-weight="700" fill="#0a0a0b">RL<tspan fill="#c8b88a">3</tspan></text>
  <text x="10" y="56" font-family="Space Mono" font-size="8" letter-spacing="0.3em" fill="#7a7a7a">AI AGENCY</text>
</svg>"""

LOGO_DARK_BG: str = """\
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60">
  <text x="10" y="42" font-family="Space Grotesk" font-size="48" font-weight="700" fill="#ffffff">RL<tspan fill="#c8b88a">3</tspan></text>
  <text x="10" y="56" font-family="Space Mono" font-size="8" letter-spacing="0.3em" fill="#7a7a7a">AI AGENCY</text>
</svg>"""

# ── Web Layout (separate from slide LAYOUT which is loaded from JSON) ──

WEB_LAYOUT: dict[str, str] = {
    "max_width": "1200px",
    "grid_size": "60px",
    "card_padding": "3rem",
    "section_padding": "8rem",
    "mobile_breakpoint": "768px",
}

# ── Animations ───────────────────────────────────────────────────────

ANIMATIONS: dict[str, str] = {
    "fade_up": "opacity 0\u21921, translateY 20px\u21920",
    "hover_border": "scaleX 0\u21921, gold top-border",
    "pulse": "radial-gradient glow on \u20183\u2019",
}

# ── Grain Overlay ────────────────────────────────────────────────────

GRAIN_OVERLAY_CSS: str = """\
.grain-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.02;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)'/%3E%3C/svg%3E");
}"""

# ── Tagline & Cycle ─────────────────────────────────────────────────

TAGLINE: str = "Cada iteración nos acerca al resultado óptimo."
CYCLE_LABEL: str = "Observar · Actuar · Iterar"

# ── Service Pillars ──────────────────────────────────────────────────

SERVICE_PILLARS: list[dict[str, str]] = [
    {
        "num": "01",
        "name": "Estrategia AI",
        "en": "Observe",
        "desc": "Observamos tu entorno, diseñamos la policy óptima",
    },
    {
        "num": "02",
        "name": "Implementación",
        "en": "Act",
        "desc": "Agentes, automatizaciones y sistemas inteligentes en producción",
    },
    {
        "num": "03",
        "name": "Optimización Continua",
        "en": "Iterate",
        "desc": "Cada dato es una señal de recompensa; iterar y escalar",
    },
]

# ── Section Label Format ─────────────────────────────────────────────

SECTION_LABEL_FORMAT: str = "01 — Section Name"
