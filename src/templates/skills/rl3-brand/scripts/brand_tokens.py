"""
brand_tokens.py — Single source of truth for every RL3 visual and verbal constant.

Every generator, validator, and template imports from here.
Nothing is hard-coded elsewhere.
"""

# ── Colours ──────────────────────────────────────────────────────────

COLORS: dict[str, str] = {
    "black":      "#0a0a0b",
    "white":      "#ffffff",
    "accent":     "#c8b88a",
    "accent_dim": "#c8b88a33",
    "gray":       "#7a7a7a",
    "dark_gray":  "#1a1a1b",
    "mid_gray":   "#2a2a2b",
    "light_bg":   "#f5f5f5",
}

# ── CSS Variables ────────────────────────────────────────────────────

CSS_VARIABLES: str = """\
:root {
  --rl3-black: #0a0a0b;
  --rl3-white: #ffffff;
  --rl3-accent: #c8b88a;
  --rl3-accent-dim: #c8b88a33;
  --rl3-gray: #7a7a7a;
  --rl3-dark-gray: #1a1a1b;
  --rl3-mid-gray: #2a2a2b;
  --rl3-light-bg: #f5f5f5;
}"""

# ── Fonts ────────────────────────────────────────────────────────────

FONTS: dict[str, str] = {
    "headlines": "Space Grotesk",
    "mono":      "Space Mono",
    "body":      "Instrument Sans",
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
    "headline_weight":    "600-700",
    "headline_tracking":  "-0.02em",
    "label_tracking":     "0.3em",
    "label_size":         "0.65rem",
    "body_weight":        "400-600",
    "body_line_height":   "1.7",
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

# ── Layout ───────────────────────────────────────────────────────────

LAYOUT: dict[str, str] = {
    "max_width":          "1200px",
    "grid_size":          "60px",
    "card_padding":       "3rem",
    "section_padding":    "8rem",
    "mobile_breakpoint":  "768px",
}

# ── Animations ───────────────────────────────────────────────────────

ANIMATIONS: dict[str, str] = {
    "fade_up":      "opacity 0\u21921, translateY 20px\u21920",
    "hover_border": "scaleX 0\u21921, gold top-border",
    "pulse":        "radial-gradient glow on \u20183\u2019",
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
        "num":  "01",
        "name": "Estrategia AI",
        "en":   "Observe",
        "desc": "Observamos tu entorno, diseñamos la policy óptima",
    },
    {
        "num":  "02",
        "name": "Implementación",
        "en":   "Act",
        "desc": "Agentes, automatizaciones y sistemas inteligentes en producción",
    },
    {
        "num":  "03",
        "name": "Optimización Continua",
        "en":   "Iterate",
        "desc": "Cada dato es una señal de recompensa; iterar y escalar",
    },
]

# ── Approved / Forbidden Phrases ─────────────────────────────────────

PHRASES_USE: list[str] = [
    "Cada iteración nos acerca al resultado óptimo",
    "Observar · Actuar · Iterar",
    "No demos. Soluciones en producción",
    "Cada dato es una señal de mejora",
    "Sistemas que mejoran con el tiempo",
    "Entender antes de construir, construir lo que se va a usar, mejorar con datos reales",
]

PHRASES_AVOID: list[str] = [
    "Revolucionamos",
    "Disruptivo",
    "Cutting-edge",
    "Nuestro equipo de expertos",
    "Soluciones 360",
    "End-to-end",
    "Inteligencia artificial al servicio de",
]

# ── Section Label Format ─────────────────────────────────────────────

SECTION_LABEL_FORMAT: str = "01 — Section Name"
