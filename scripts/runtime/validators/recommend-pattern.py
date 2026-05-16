#!/usr/bin/env python3
"""
Recommend-X-because-Y linter (Iron Law 1).

Scans every elicitation reference in skills/*/references/ and flags any
question section that lacks the recommendation pattern. A "question section"
is any markdown heading that ends with a question mark.

The recommendation pattern is one of:

    Recommend X because Y.
    Recommendation: X — because Y.
    Default: X (because Y).

Case-insensitive. Searches the body BETWEEN the question heading and the
next heading (or end of file).

Exit codes:
    0  every elicitation file passes
    1  one or more violations
    2  bad invocation / IO error

Usage:
    python3 scripts/validators/recommend-pattern.py [path1 path2 ...]

When called with no args, scans skills/*/references/{elicitation*,phase-*}.md.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Iterable, NamedTuple


REPO_ROOT = Path(__file__).resolve().parents[2]

# Default file patterns: every workflow's elicitation + phase docs.
DEFAULT_GLOBS = [
    "skills/*/references/elicitation-questions.md",
    "skills/*/references/elicitation*.md",
    "skills/*/references/phase-*.md",
]

# Headings that end with `?` (rare in non-question sections, so a good signal).
HEADING_RE = re.compile(r"^(#{1,6})\s+(.+\?\s*)$", re.MULTILINE)
RECOMMEND_RE = re.compile(
    # Accepts: "Recommend X because Y", "Recommended: X because Y",
    # "Recommendation: X — because Y", "Default: X (because Y)".
    # X is anything on the same line (paths/code can include dots).
    r"(recommend\w*\b[^\n]{0,200}?\bbecause\b|default\s*:\s*[^\n]{0,200}?\(?because\b)",
    re.IGNORECASE,
)


class Violation(NamedTuple):
    file: Path
    line: int
    heading: str


def discover_files(args: list[str]) -> list[Path]:
    if args:
        return [REPO_ROOT / a if not Path(a).is_absolute() else Path(a) for a in args]
    found: list[Path] = []
    for pattern in DEFAULT_GLOBS:
        for path in REPO_ROOT.glob(pattern):
            found.append(path)
    # Deduplicate while preserving order.
    seen: set[Path] = set()
    unique: list[Path] = []
    for p in found:
        if p in seen:
            continue
        seen.add(p)
        unique.append(p)
    return unique


def find_question_sections(text: str) -> Iterable[tuple[int, str, str]]:
    """Yield (line_number, heading_text, section_body) for every heading
    ending with ?. The body covers everything between this heading and the
    next heading (any level)."""
    headings = list(HEADING_RE.finditer(text))
    for i, m in enumerate(headings):
        # Only headings ending with '?'.
        if not m.group(2).rstrip().endswith("?"):
            continue
        start = m.end()
        end = headings[i + 1].start() if i + 1 < len(headings) else len(text)
        body = text[start:end]
        line = text.count("\n", 0, m.start()) + 1
        yield line, m.group(2).rstrip(), body


def lint_file(path: Path) -> list[Violation]:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as e:
        print(f"error: cannot read {path}: {e}", file=sys.stderr)
        return []

    violations: list[Violation] = []
    for line, heading, body in find_question_sections(text):
        if RECOMMEND_RE.search(body):
            continue
        violations.append(Violation(file=path, line=line, heading=heading))
    return violations


def main(argv: list[str]) -> int:
    files = discover_files(argv[1:])
    if not files:
        print("no elicitation files found — nothing to lint", file=sys.stderr)
        return 0

    all_violations: list[Violation] = []
    for path in files:
        all_violations.extend(lint_file(path))

    if not all_violations:
        print(f"✓ recommend-pattern: {len(files)} file(s) clean")
        return 0

    print(f"✗ recommend-pattern: {len(all_violations)} violation(s)")
    print()
    for v in all_violations:
        rel = (
            v.file.relative_to(REPO_ROOT)
            if v.file.is_relative_to(REPO_ROOT)
            else v.file
        )
        print(f"  {rel}:{v.line}  question without recommendation:  {v.heading}")
    print()
    print("Iron Law 1: every question must include 'Recommend X because Y'.")
    print("See skills/team-charter/references/iron-laws.md.")
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv))
    except KeyboardInterrupt:
        sys.exit(130)
