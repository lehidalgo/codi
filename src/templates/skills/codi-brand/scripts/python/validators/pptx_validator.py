#!/usr/bin/env python3
"""
pptx_validator.py — Codi brand rule checker for PPTX files (Python fallback).

Usage:
    python3 pptx_validator.py --input file.pptx

Exit code: 0 = all checks pass, 1 = one or more checks fail
"""

import sys
import subprocess
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
import brand_tokens as bt


def extract_text(pptx_path: str) -> str:
    try:
        result = subprocess.run(
            ["python3", "-m", "markitdown", pptx_path],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result.stdout
    except Exception:
        return ""


def check_file_exists(path: str) -> tuple[bool, str]:
    exists = Path(path).exists()
    return exists, f"File found: {path}" if exists else f"File not found: {path}"


def check_has_slides(text: str) -> tuple[bool, str]:
    count = text.count("\n## ")
    ok = count >= 1
    return ok, f"Detected {count} slide(s)" if ok else "No slides detected"


def check_has_content(text: str) -> tuple[bool, str]:
    ok = len(text.strip()) > 50
    return ok, "Presentation has content" if ok else "Presentation appears empty"


def check_brand_mention(text: str) -> tuple[bool, str]:
    ok = "codi" in text.lower()
    return ok, "Codi brand mention found" if ok else "No 'codi' mention found"


def check_no_forbidden(text: str) -> tuple[bool, str]:
    found = [p for p in bt.VOICE["phrases_avoid"] if p.lower() in text.lower()]
    ok = len(found) == 0
    return ok, "No forbidden phrases" if ok else f"Forbidden: {', '.join(found)}"


CHECKS = [
    ("has_slides", check_has_slides),
    ("has_content", check_has_content),
    ("brand_mention", check_brand_mention),
    ("no_forbidden_phrases", check_no_forbidden),
]


def run(pptx_path: str) -> int:
    results = []

    ok, msg = check_file_exists(pptx_path)
    results.append(("file_exists", ok, msg))
    if not ok:
        _report(results)
        return 1

    text = extract_text(pptx_path)
    for name, fn in CHECKS:
        ok, msg = fn(text)
        results.append((name, ok, msg))

    _report(results)
    failed = sum(1 for _, ok, _ in results if not ok)
    return 0 if failed == 0 else 1


def _report(results: list[tuple[str, bool, str]]) -> None:
    print("\nCodi PPTX Brand Validation")
    print("=" * 50)
    for name, ok, msg in results:
        icon = "✓" if ok else "✗"
        status = "PASS" if ok else "FAIL"
        print(f"{icon} [{status}] {name:<30} {msg}")
    print("=" * 50)
    failed = sum(1 for _, ok, _ in results if not ok)
    if failed == 0:
        print(f"\nAll {len(results)} checks passed.")
    else:
        print(f"\n{failed}/{len(results)} checks failed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Codi PPTX brand validator")
    parser.add_argument("--input", required=True, help="Path to .pptx file")
    args = parser.parse_args()
    sys.exit(run(args.input))
