#!/usr/bin/env python3
# scripts/hooks/check_file_lines.py
#
# Enforce a per-file line cap on code files. RL3 standard is 700 lines.
# Per-call args override the default — e.g. for a stricter cap in a sub-tree.
#
# Pre-commit invokes this with the staged-file paths as positional args.
# Manual invocation:
#   python3 scripts/hooks/check_file_lines.py --cap=700 path/to/file.py

from __future__ import annotations

import argparse
import sys
from pathlib import Path

DEFAULT_EXTENSIONS = ("py", "ts", "tsx", "js", "jsx", "go", "rs", "java", "kt", "swift")
DEFAULT_CAP = 700


def count_lines(path: Path) -> int:
    try:
        with path.open("rb") as fh:
            return sum(1 for _ in fh)
    except OSError:
        return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Block files exceeding the line cap. "
        "File paths come from pre-commit (positional args) or CLI."
    )
    parser.add_argument("--cap", type=int, default=DEFAULT_CAP)
    parser.add_argument(
        "--extensions",
        type=str,
        default=",".join(DEFAULT_EXTENSIONS),
        help="Comma-separated extensions to check (no leading dot).",
    )
    parser.add_argument("files", nargs="*")
    args = parser.parse_args()

    extensions = tuple(
        f".{e.strip().lower()}" for e in args.extensions.split(",") if e.strip()
    )
    failed: list[tuple[Path, int]] = []

    for raw in args.files:
        path = Path(raw)
        if not path.is_file():
            continue
        if path.suffix.lower() not in extensions:
            continue
        n = count_lines(path)
        if n > args.cap:
            failed.append((path, n))

    if failed:
        print(f"FAIL: file size cap violation (max {args.cap} lines)", file=sys.stderr)
        for path, n in failed:
            print(f"  {path}: {n} lines", file=sys.stderr)
        print(
            "\nModularise the file. Split by responsibility, not by size.",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
