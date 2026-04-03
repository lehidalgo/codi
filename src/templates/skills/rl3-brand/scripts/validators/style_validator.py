"""
style_validator.py — Validate text files against RL3 brand style rules.

Rules:
  1. forbidden_phrases  — flags any phrase from brand_tokens.PHRASES_AVOID
  2. passive_voice      — flags Spanish passive constructions
  3. em_dash_misuse     — flags em dashes not used as section labels (NN —)
  4. generic_filler     — flags hollow marketing clichés

Usage:
  python style_validator.py --input file.txt
  python style_validator.py --stdin          (reads from stdin)

Output: JSON to stdout. Exit 0 if passed, exit 1 if errors.
"""

import sys, os, re, json, argparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import brand_tokens as bt

# ── Constants ───────────────────────────────────────────────────────

GENERIC_FILLER: list[str] = [
    "lideres del sector",
    "de primer nivel",
    "a la vanguardia",
    "referente en",
]

PASSIVE_RE = re.compile(
    r"\b(son|es|fue|fueron|sido|ser)\s+\w+(ado|ido|tos|das|dos|tas)\b",
    re.IGNORECASE,
)

# Em dash NOT preceded by a two-digit section label pattern (e.g. "01 ")
# We look for "—" where the preceding context is NOT "\d\d "
EM_DASH_MISUSE_RE = re.compile(r"(?<!\d{2}\s)\u2014")


# ── Core validator ──────────────────────────────────────────────────

def validate_style(filepath: str) -> dict:
    """Validate a text file against RL3 style rules.

    Returns dict with keys: passed (bool), errors (list), warnings (list).
    """
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    errors: list[dict[str, str]] = []

    for i, line in enumerate(lines, start=1):
        stripped = line.rstrip("\n")

        # 1. Forbidden phrases (case-insensitive)
        for phrase in bt.PHRASES_AVOID:
            if phrase.lower() in stripped.lower():
                errors.append({
                    "rule": "forbidden_phrases",
                    "message": f"Forbidden phrase detected: '{phrase}'",
                    "detail": f"Line {i}: '{stripped.strip()}'",
                })

        # 2. Passive voice
        match = PASSIVE_RE.search(stripped)
        if match:
            errors.append({
                "rule": "passive_voice",
                "message": f"Passive voice detected: '{match.group()}'",
                "detail": f"Line {i}: '{stripped.strip()}'",
            })

        # 3. Em dash misuse
        if EM_DASH_MISUSE_RE.search(stripped):
            errors.append({
                "rule": "em_dash_misuse",
                "message": "Em dash used to connect clauses (only section labels allowed)",
                "detail": f"Line {i}: '{stripped.strip()}'",
            })

        # 4. Generic filler (case-insensitive)
        for filler in GENERIC_FILLER:
            if filler.lower() in stripped.lower():
                errors.append({
                    "rule": "generic_filler",
                    "message": f"Generic filler detected: '{filler}'",
                    "detail": f"Line {i}: '{stripped.strip()}'",
                })

    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "warnings": [],
    }


# ── CLI ─────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="RL3 brand style validator")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--input", type=str, help="Path to text file to validate")
    group.add_argument("--stdin", action="store_true", help="Read text from stdin")
    args = parser.parse_args()

    if args.stdin:
        import tempfile
        text = sys.stdin.read()
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
            f.write(text)
            tmp_path = f.name
        try:
            result = validate_style(tmp_path)
        finally:
            os.unlink(tmp_path)
    else:
        result = validate_style(args.input)

    print(json.dumps(result, indent=2, ensure_ascii=False))
    sys.exit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
