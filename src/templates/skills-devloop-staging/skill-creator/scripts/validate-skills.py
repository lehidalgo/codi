#!/usr/bin/env python3
"""
validate-skills.py — Audits every skill under skills/ against the devloop skill standard.

Usage:
    python3 validate-skills.py                    # audit all skills
    python3 validate-skills.py --skill discover   # audit one
    python3 validate-skills.py --strict           # exit 1 on any HIGH violation
    python3 validate-skills.py --json             # JSON output instead of table

The standard is documented in references/standard.md and references/anti-patterns.md.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

SEVERITY_ORDER = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}

# Standard frontmatter fields per agentskills.io/specification + Claude Code plugin spec.
# Devloop convention aligned to codi's .claude/skills pattern: name + description + user-invocable.
STANDARD_FIELDS = {
    # Universally required
    "name",  # kebab-case identifier, ≤64 chars
    "description",  # discovery field, ≤1024 chars
    # Devloop preferred (codi pattern)
    "user-invocable",  # true = can be invoked by user; false = internal/programmatic only
    # Anthropic-permitted optional fields (tolerated; devloop converges on user-invocable)
    "metadata",  # block with version, priority, docs, sitemap
    "retrieval",  # block with aliases, intents, entities
    "validate",  # array of pattern/message/severity validation rules
    "license",  # e.g. "Apache-2.0"
    "category",  # taxonomy bucket
    "parent",  # parent skill name (hierarchical skills)
    "summary",  # short summary
    "disable-model-invocation",  # alternative to user-invocable; devloop prefers user-invocable
    "role",  # role-specific skill
    "argument-hint",  # for slash commands
    "chainTo",  # skill chaining
}

# Devloop convention forbids these even though Anthropic permits them
DEVLOOP_FORBIDDEN = {
    "allowed-tools": "tool restrictions belong in plugin.json or contract.json, not SKILL.md (codi pattern)",
}

# Skills exempt from some rules (legacy or special).
# Keep this list minimal; the goal is to drive it to zero.
EXEMPT = {
    # Skills that user-invoke only and follow a different shape:
    "zoom-out": {
        "missing_when_to_use_section"
    },  # output-shape doc serves the same purpose
    "caveman": {"missing_evals", "body_short"},  # tiny mode-toggle skill
}


@dataclass
class Violation:
    severity: str
    code: str
    message: str


@dataclass
class SkillReport:
    name: str
    path: Path
    violations: list[Violation] = field(default_factory=list)
    desc_chars: int = 0
    body_words: int = 0
    nonstandard_fields: list[str] = field(default_factory=list)

    def add(self, severity: str, code: str, message: str) -> None:
        if code in EXEMPT.get(self.name, set()):
            return
        self.violations.append(Violation(severity, code, message))

    @property
    def worst_severity(self) -> str | None:
        if not self.violations:
            return None
        return min(self.violations, key=lambda v: SEVERITY_ORDER[v.severity]).severity


def parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    m = re.match(r"---\n(.+?)\n---\n", text, re.DOTALL)
    if not m:
        return {}, text
    fm_text = m.group(1)
    body = text[m.end() :]
    fm: dict[str, str] = {}
    cur_key: str | None = None
    for line in fm_text.splitlines():
        if line.startswith((" ", "\t")):
            if cur_key:
                fm[cur_key] = (fm[cur_key] + " " + line.strip()).strip()
        else:
            mm = re.match(r"^(\w[\w-]*):\s*(.*)$", line)
            if mm:
                cur_key = mm.group(1)
                fm[cur_key] = mm.group(2).strip()
    return fm, body


def count_words(text: str) -> int:
    return len(re.findall(r"\S+", text))


def check_skill(skill_dir: Path) -> SkillReport:
    report = SkillReport(name=skill_dir.name, path=skill_dir)
    skill_md = skill_dir / "SKILL.md"

    if not skill_md.exists():
        report.add("HIGH", "missing_skill_md", "SKILL.md does not exist")
        return report

    text = skill_md.read_text()
    fm, body = parse_frontmatter(text)

    desc = fm.get("description", "").strip()
    name = fm.get("name", "").strip()

    report.desc_chars = len(desc)
    report.body_words = count_words(body)

    # ---- Frontmatter checks ----

    if not name:
        report.add("HIGH", "missing_name", "frontmatter missing `name`")
    elif not re.fullmatch(r"[a-z0-9][a-z0-9-]*", name):
        report.add(
            "HIGH",
            "name_format",
            f"name '{name}' must be kebab-case (lowercase letters, digits, hyphens)",
        )

    if len(desc) > 1024:
        report.add(
            "HIGH", "desc_too_long", f"description is {len(desc)} chars (limit 1024)"
        )

    # Devloop-forbidden fields (Anthropic permits but devloop forbids per codi pattern)
    for forbidden_field, reason in DEVLOOP_FORBIDDEN.items():
        if forbidden_field in fm:
            report.add(
                "HIGH",
                f"devloop_forbidden_{forbidden_field}",
                f"frontmatter contains `{forbidden_field}` — {reason}",
            )

    # Non-standard frontmatter fields (per agentskills.io/specification + Claude Code plugin spec)
    forbidden_set = set(DEVLOOP_FORBIDDEN.keys())
    report.nonstandard_fields = sorted(set(fm.keys()) - STANDARD_FIELDS - forbidden_set)
    for f in report.nonstandard_fields:
        if f == "when_to_use":
            report.add(
                "HIGH",
                "nonstandard_when_to_use",
                "frontmatter contains `when_to_use` — non-standard. Fold content into `description` and remove the field. Standard fields per codi pattern: name, description, user-invocable",
            )
        else:
            report.add(
                "MEDIUM",
                f"nonstandard_field_{f}",
                f"frontmatter contains non-standard field `{f}`. Standard fields: {', '.join(sorted(STANDARD_FIELDS))}",
            )

    if not desc:
        report.add("HIGH", "desc_empty", "description is empty")
    else:
        if not desc.lower().lstrip().startswith("use when"):
            report.add(
                "HIGH",
                "desc_not_use_when",
                f"description should start with 'Use when …' (starts with: '{desc[:40]}…')",
            )

        # First/second person check (excluding 'use' which appears as 'Use when')
        # Match standalone words "I", "my", "you", "your", "we", "our", "us"
        bad_pronouns = []
        lower = " " + desc.lower() + " "
        for pronoun in [
            " i ",
            " my ",
            " you ",
            " your ",
            " yours ",
            " we ",
            " our ",
            " us ",
        ]:
            if pronoun in lower:
                bad_pronouns.append(pronoun.strip())
        # "I'm", "I'd" etc.
        if re.search(r"\bI'", desc):
            bad_pronouns.append("I'…")
        if bad_pronouns:
            report.add(
                "HIGH",
                "first_second_person",
                f"description contains first/second person pronouns: {', '.join(set(bad_pronouns))}",
            )

        # Workflow-summary anti-pattern: arrows, mode listing, phase chains
        wf_signals = []
        if re.search(r"→|->", desc):
            wf_signals.append("contains arrow (→ or ->)")
        # Detect "Mode X / Mode Y / Mode Z" pattern with two or more modes named
        mode_mentions = re.findall(
            r"\bmode[d]?\s+`?[a-z][a-z-]*`?", desc, re.IGNORECASE
        )
        if len(mode_mentions) >= 2:
            wf_signals.append("names ≥2 modes inline")
        if re.search(r"\bphase\s+\w+\b.*\bphase\s+\w+\b", desc, re.IGNORECASE):
            wf_signals.append("names multiple phases inline")
        if wf_signals:
            report.add(
                "MEDIUM",
                "desc_workflow_summary",
                f"description summarizes workflow/modes ({'; '.join(wf_signals)}) — this creates a shortcut Claude takes instead of reading the body",
            )

    # ---- Body checks ----

    body_lower = body.lower()

    # Required sections
    has_when = any(
        s in body_lower for s in ["when to use", "when to skip", "pick a mode"]
    )
    has_core = any(s in body_lower for s in ["core principle", "process", "## modes"])
    has_anti = any(
        s in body_lower for s in ["anti-pattern", "red flag", "common mistakes"]
    )
    has_term = any(
        s in body_lower for s in ["termination", "when to transition", "## output"]
    )
    has_bound = any(s in body_lower for s in ["boundaries", "## boundary"])

    if not has_when:
        report.add(
            "MEDIUM",
            "missing_when_to_use_section",
            "no 'When to use' / 'Pick a mode' section in body",
        )
    if not has_core:
        report.add(
            "MEDIUM",
            "missing_core_section",
            "no 'Core principle' / 'Process' section in body",
        )
    if not has_anti:
        report.add(
            "MEDIUM",
            "missing_anti_patterns",
            "no 'Anti-patterns' / 'Common mistakes' / 'Red flags' section",
        )
    if not has_term:
        report.add("LOW", "missing_termination", "no 'Termination' / 'Output' section")
    if not has_bound:
        report.add("LOW", "missing_boundaries", "no 'Boundaries' section")

    # Word count
    if report.body_words > 500:
        sev = "MEDIUM" if report.body_words <= 800 else "HIGH"
        report.add(
            sev,
            "body_too_long",
            f"body is {report.body_words} words (target <500; push detail to references/)",
        )
    elif report.body_words < 50:
        report.add(
            "LOW",
            "body_short",
            f"body is only {report.body_words} words — suspiciously sparse",
        )

    # Origin attribution scrub
    attribution_patterns = [
        r"\bobra/",
        r"\bMatt/",
        r"\bmatt/",
        r"\bPocock\b",
        r"\bhereda lo mejor\b",
        r"\bported from\b",
        r"\bforked from\b",
        r"superpowers/skills/",
    ]
    for pat in attribution_patterns:
        if re.search(pat, body, re.IGNORECASE):
            report.add(
                "LOW",
                "origin_attribution",
                f"body contains origin attribution pattern '{pat}' — attribution belongs in git history, not skill content",
            )
            break

    # @ path references
    if re.search(r"^@[\w/.-]+", body, re.MULTILINE):
        report.add(
            "LOW",
            "at_path_reference",
            "body contains @-prefixed file references — those force-load. Use plain links or references/ pointers",
        )

    # ---- Sibling files ----

    contract = skill_dir / "contract.json"
    changelog = skill_dir / "CHANGELOG.md"
    evals_dir = skill_dir / "evals"
    evals_json = evals_dir / "evals.json"

    if not contract.exists():
        report.add("MEDIUM", "missing_contract", "contract.json missing")
    else:
        try:
            json.loads(contract.read_text())
        except json.JSONDecodeError as e:
            report.add(
                "HIGH", "contract_invalid_json", f"contract.json is invalid JSON: {e}"
            )

    if not changelog.exists():
        report.add("LOW", "missing_changelog", "CHANGELOG.md missing")

    if not evals_json.exists():
        report.add(
            "HIGH",
            "missing_evals",
            "evals/evals.json missing — Iron Law: no skill without a failing test first",
        )
    else:
        try:
            evals = json.loads(evals_json.read_text())
            cases = evals.get("cases", [])
            if not cases:
                report.add("HIGH", "evals_empty", "evals/evals.json has zero cases")
            for i, case in enumerate(cases):
                missing = [
                    k
                    for k in ("id", "description", "prompt", "expectations")
                    if k not in case
                ]
                if missing:
                    report.add(
                        "MEDIUM",
                        "evals_case_incomplete",
                        f"case {i} missing fields: {', '.join(missing)}",
                    )
                if "expectations" in case and not case["expectations"]:
                    report.add(
                        "MEDIUM",
                        "evals_case_no_expectations",
                        f"case {i} ('{case.get('id', '?')}') has empty expectations array",
                    )
        except json.JSONDecodeError as e:
            report.add(
                "HIGH", "evals_invalid_json", f"evals/evals.json is invalid JSON: {e}"
            )

    return report


def find_skill_dirs(skills_root: Path) -> list[Path]:
    return sorted(
        p for p in skills_root.iterdir() if p.is_dir() and (p / "SKILL.md").exists()
    )


def print_table(reports: list[SkillReport]) -> None:
    print(f"{'skill':<26} {'desc':>5} {'words':>5}  {'severity':<8} {'violations'}")
    print("-" * 100)
    for r in reports:
        sev = r.worst_severity or "-"
        vc = len(r.violations)
        print(
            f"{r.name:<26} {r.desc_chars:>5} {r.body_words:>5}  {sev:<8} {vc} violation(s)"
        )
        for v in r.violations:
            print(f"    [{v.severity}] {v.code}: {v.message}")


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(
        description="Validate devloop skills against the standard"
    )
    p.add_argument("--skill", help="audit one skill by name")
    p.add_argument(
        "--strict", action="store_true", help="exit 1 if any HIGH violations found"
    )
    p.add_argument("--json", action="store_true", help="JSON output instead of table")
    p.add_argument("--root", default="skills", help="path to skills/ directory")
    args = p.parse_args(argv)

    skills_root = Path(args.root)
    if not skills_root.is_dir():
        print(f"error: skills root '{skills_root}' is not a directory", file=sys.stderr)
        return 2

    if args.skill:
        skill_dir = skills_root / args.skill
        if not skill_dir.is_dir():
            print(
                f"error: skill '{args.skill}' not found at {skill_dir}", file=sys.stderr
            )
            return 2
        reports = [check_skill(skill_dir)]
    else:
        reports = [check_skill(d) for d in find_skill_dirs(skills_root)]

    if args.json:
        out = [
            {
                "name": r.name,
                "path": str(r.path),
                "desc_chars": r.desc_chars,
                "body_words": r.body_words,
                "nonstandard_fields": r.nonstandard_fields,
                "violations": [
                    {"severity": v.severity, "code": v.code, "message": v.message}
                    for v in r.violations
                ],
            }
            for r in reports
        ]
        print(json.dumps(out, indent=2))
    else:
        print_table(reports)
        # Summary
        total_v = sum(len(r.violations) for r in reports)
        by_sev = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
        for r in reports:
            for v in r.violations:
                by_sev[v.severity] = by_sev.get(v.severity, 0) + 1
        print()
        print(
            f"Summary: {len(reports)} skills, {total_v} violations "
            f"(HIGH={by_sev['HIGH']}, MEDIUM={by_sev['MEDIUM']}, LOW={by_sev['LOW']})"
        )

    if args.strict and any(v.severity == "HIGH" for r in reports for v in r.violations):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
