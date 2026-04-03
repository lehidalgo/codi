"""
run_tests.py — Deterministic test harness for RL3 brand artifacts.

Generates HTML, DOCX, and PPTX 3 times each, validates every artifact,
and verifies SHA-256 consistency across runs.
"""

import sys
import os
import json
import hashlib
import re

sys.path.insert(0, os.path.dirname(__file__))
import brand_tokens as bt
from generate_docx import generate_docx
from generate_pptx import generate_pptx
from validators.html_validator import validate_html
from validators.doc_validator import validate_docx
from validators.pptx_validator import validate_pptx
from validators.style_validator import validate_style


# ── Hardcoded test content ─────────────────────────────────────────────

TEST_CONTENT = {
    "title": "RL3 Test Document",
    "subtitle": "Validation Run",
    "date": "2026-01-01",
    "sections": [
        {
            "number": "01",
            "label": "Contexto",
            "heading": "Analisis inicial",
            "body": "Cada dato es una senal de mejora.",
            "items": ["Observar procesos", "Identificar oportunidades"],
            "callout": "Sistemas que mejoran con el tiempo",
        },
        {
            "number": "02",
            "label": "Implementacion",
            "heading": "Agentes en produccion",
            "body": "No demos. Soluciones en produccion.",
            "items": ["Agentes autonomos", "Automatizacion inteligente"],
        },
        {
            "number": "03",
            "label": "Resultados",
            "heading": "Optimizacion continua",
            "body": "Entender antes de construir, construir lo que se va a usar, mejorar con datos reales.",
            "items": ["Monitorizacion", "Iteracion", "Escalado"],
        },
    ],
    "footer_text": "RL3 AI AGENCY",
}


# ── HTML generator (test-only) ────────────────────────────────────────


def generate_test_html(content: dict, output_path: str) -> None:
    """Build a complete RL3-branded HTML page from *content* and write to *output_path*."""
    sections_html = ""
    for sec in content["sections"]:
        items_html = ""
        if sec.get("items"):
            items_li = "\n".join(
                f'            <li style="margin-bottom: 0.5rem;">{item}</li>'
                for item in sec["items"]
            )
            items_html = f"""
          <ul style="list-style: none; padding-left: 0;">
{items_li}
          </ul>"""

        callout_html = ""
        if sec.get("callout"):
            callout_html = f"""
          <blockquote style="
            border-left: 2px solid {bt.COLORS['accent']};
            padding-left: 1.5rem;
            margin: 2rem 0;
            font-style: italic;
            color: {bt.COLORS['accent']};
            font-family: '{bt.FONTS['body']}', sans-serif;
          ">{sec['callout']}</blockquote>"""

        sections_html += f"""
      <section class="content-section" style="
        padding: {bt.LAYOUT['section_padding']} 0;
        border-top: 1px solid {bt.COLORS['mid_gray']};
        animation: fadeUp 0.6s ease both;
      ">
        <div class="section-label" style="
          font-family: '{bt.FONTS['mono']}', monospace;
          font-size: {bt.TYPOGRAPHY['label_size']};
          letter-spacing: {bt.TYPOGRAPHY['label_tracking']};
          color: {bt.COLORS['gray']};
          text-transform: uppercase;
          margin-bottom: 1rem;
        ">{sec['number']} \u2014 {sec['label']}</div>
        <h2 style="
          font-family: '{bt.FONTS['headlines']}', sans-serif;
          font-weight: 700;
          letter-spacing: {bt.TYPOGRAPHY['headline_tracking']};
          color: {bt.COLORS['white']};
          font-size: 2rem;
          margin-bottom: 1.5rem;
        ">{sec['heading']}</h2>
        <p style="
          font-family: '{bt.FONTS['body']}', sans-serif;
          color: {bt.COLORS['white']};
          line-height: {bt.TYPOGRAPHY['body_line_height']};
          font-size: 1rem;
          max-width: 640px;
        ">{sec['body']}</p>{items_html}{callout_html}
      </section>"""

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{content['title']}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="{bt.GOOGLE_FONTS_URL}" rel="stylesheet">
  <style>
    {bt.CSS_VARIABLES}

    * {{ margin: 0; padding: 0; box-sizing: border-box; }}

    body {{
      background: {bt.COLORS['black']};
      color: {bt.COLORS['white']};
      font-family: '{bt.FONTS['body']}', sans-serif;
      cursor: crosshair;
      line-height: {bt.TYPOGRAPHY['body_line_height']};
    }}

    .container {{
      max-width: {bt.LAYOUT['max_width']};
      margin: 0 auto;
      padding: 0 2rem;
    }}

    @keyframes fadeUp {{
      from {{ opacity: 0; transform: translateY(20px); }}
      to {{ opacity: 1; transform: translateY(0); }}
    }}

    @media (max-width: {bt.LAYOUT['mobile_breakpoint']}) {{
      .container {{
        padding: 0 1rem;
      }}
      h2 {{
        font-size: 1.5rem;
      }}
    }}

    {bt.GRAIN_OVERLAY_CSS}
  </style>
</head>
<body>
  <div class="grain-overlay"></div>
  <div class="container">
    <header style="
      padding: {bt.LAYOUT['section_padding']} 0 4rem;
      animation: fadeUp 0.6s ease both;
    ">
      {bt.LOGO_DARK_BG}
      <h1 style="
        font-family: '{bt.FONTS['headlines']}', sans-serif;
        font-weight: 700;
        letter-spacing: {bt.TYPOGRAPHY['headline_tracking']};
        color: {bt.COLORS['white']};
        font-size: 2.5rem;
        margin-top: 2rem;
      ">{content['title']}</h1>
      <p style="
        font-family: '{bt.FONTS['body']}', sans-serif;
        color: {bt.COLORS['gray']};
        margin-top: 0.5rem;
      ">{content.get('subtitle', '')} | {content.get('date', '')}</p>
    </header>
{sections_html}
    <footer style="
      padding: 4rem 0;
      border-top: 1px solid {bt.COLORS['mid_gray']};
      text-align: center;
    ">
      <p style="
        font-family: '{bt.FONTS['mono']}', monospace;
        font-size: {bt.TYPOGRAPHY['label_size']};
        letter-spacing: {bt.TYPOGRAPHY['label_tracking']};
        color: {bt.COLORS['gray']};
        text-transform: uppercase;
      ">{content.get('footer_text', 'RL3 AI AGENCY')}</p>
    </footer>
  </div>
</body>
</html>"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)


# ── Helpers ────────────────────────────────────────────────────────────


def _strip_html_tags(html_text: str) -> str:
    """Remove HTML tags and return plain text."""
    text = re.sub(r"<style[^>]*>.*?</style>", "", html_text, flags=re.DOTALL)
    text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-zA-Z]+;", " ", text)
    text = re.sub(r"&#[0-9]+;", " ", text)
    # Collapse whitespace
    lines = []
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped:
            lines.append(stripped)
    return "\n".join(lines)


def _sha256(filepath: str) -> str:
    """Return hex SHA-256 digest of a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while True:
            chunk = f.read(8192)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _report_result(label: str, result: dict, expected: int, sha: str = "") -> bool:
    """Print a single validation line. Returns True if passed."""
    n_errors = len(result["errors"])
    passed = expected - n_errors
    ok = n_errors == 0
    mark = "PASS" if ok else "FAIL"
    sha_part = f"  SHA-256: {sha[:12]}..." if sha else ""
    print(f"  {label}: {passed:>2}/{expected}  passed {mark}{sha_part}")
    if not ok:
        for err in result["errors"]:
            print(f"    -> [{err['rule']}] {err['message']}")
    return ok


# ── Main ───────────────────────────────────────────────────────────────


def main() -> int:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    outputs_dir = os.path.join(base_dir, "outputs")
    os.makedirs(outputs_dir, exist_ok=True)

    all_ok = True
    sha_html = []
    sha_docx = []
    sha_pptx = []

    for n in range(1, 4):
        print(f"\n{'='*3} RUN {n}/3 {'='*3}")

        html_path = os.path.join(outputs_dir, f"test_html_{n}.html")
        docx_path = os.path.join(outputs_dir, f"test_doc_{n}.docx")
        pptx_path = os.path.join(outputs_dir, f"test_pptx_{n}.pptx")
        text_path = os.path.join(outputs_dir, f"test_text_{n}.txt")

        # Generate artifacts
        generate_test_html(TEST_CONTENT, html_path)
        generate_docx(TEST_CONTENT, docx_path)
        generate_pptx(TEST_CONTENT, pptx_path)

        # Extract plain text from HTML for style validation
        with open(html_path, "r", encoding="utf-8") as f:
            raw_html = f.read()
        plain_text = _strip_html_tags(raw_html)
        with open(text_path, "w", encoding="utf-8") as f:
            f.write(plain_text)

        # Compute hashes
        h_html = _sha256(html_path)
        h_docx = _sha256(docx_path)
        h_pptx = _sha256(pptx_path)
        sha_html.append(h_html)
        sha_docx.append(h_docx)
        sha_pptx.append(h_pptx)

        # Validate
        res_html = validate_html(html_path)
        res_docx = validate_docx(docx_path)
        res_pptx = validate_pptx(pptx_path)
        res_style = validate_style(text_path)

        ok_html = _report_result("HTML ", res_html, 12, h_html)
        ok_docx = _report_result("DOCX ", res_docx, 5, h_docx)
        ok_pptx = _report_result("PPTX ", res_pptx, 5, h_pptx)
        ok_style = _report_result("STYLE", res_style, 4)

        if not (ok_html and ok_docx and ok_pptx and ok_style):
            all_ok = False

    # Determinism check
    print(f"\n{'='*3} DETERMINISM CHECK {'='*3}")
    det_ok = True
    for label, hashes in [("HTML", sha_html), ("DOCX", sha_docx), ("PPTX", sha_pptx)]:
        match = len(set(hashes)) == 1
        status = "MATCH" if match else "MISMATCH"
        print(f"  {label}: {status}  ({hashes[0][:16]}...)")
        if not match:
            det_ok = False
            for i, h in enumerate(hashes, 1):
                print(f"    run {i}: {h}")

    if not det_ok:
        all_ok = False

    # Summary
    print()
    if all_ok:
        print("ALL TESTS PASSED - 3 runs, 0 errors, SHA-256 deterministic")
        return 0
    else:
        print("FAILURES DETECTED - see details above")
        return 1


if __name__ == "__main__":
    sys.exit(main())
