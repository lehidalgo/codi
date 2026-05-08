#!/usr/bin/env python3
"""
generate-skill-map.py — Auto-generates a relational map of all devloop skills.

Scans every SKILL.md + references/*.md + contract.json under skills/,
extracts cross-references between skills, and emits a Markdown doc with:

  - Per-skill summary (description first sentence)
  - Outbound and inbound reference tables
  - Mermaid diagram of the connection graph
  - Boundary section (X says "does NOT replace Y")

Usage:
    python3 skills/skill-creator/scripts/generate-skill-map.py [--root skills] [--out docs/...]

The output is deterministic — run it after any skill change to refresh the map.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


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


def first_sentence(text: str) -> str:
    """Extract the first sentence of the description."""
    text = re.sub(r"\s+", " ", text).strip()
    m = re.match(r"^(.+?[.!?])(?:\s|$)", text)
    return m.group(1) if m else text[:200]


def collect_skill_names(skills_root: Path) -> list[str]:
    return sorted(
        d.name
        for d in skills_root.iterdir()
        if d.is_dir() and (d / "SKILL.md").exists()
    )


def gather_skill_text(skill_dir: Path) -> str:
    """Concatenate SKILL.md + references/*.md text for reference scanning."""
    parts: list[str] = []
    skill_md = skill_dir / "SKILL.md"
    if skill_md.exists():
        parts.append(skill_md.read_text())
    refs_dir = skill_dir / "references"
    if refs_dir.is_dir():
        for ref in sorted(refs_dir.glob("*.md")):
            parts.append(ref.read_text())
    return "\n".join(parts)


def find_references(
    text: str, skill_names: list[str], self_name: str
) -> dict[str, list[str]]:
    """
    Scan text for references to other skills. Classify each reference.

    Returns a dict mapping target_skill_name -> list of context strings.
    Excludes self-references.
    """
    results: dict[str, list[str]] = defaultdict(list)

    # Build a regex that matches skill names with word boundaries.
    # Sort by length desc so longer names (e.g., "subagent-orchestration") match before "subagent".
    sorted_names = sorted(skill_names, key=len, reverse=True)
    pattern = r"\b(" + "|".join(re.escape(n) for n in sorted_names) + r")\b"

    # Walk lines for context
    for line in text.splitlines():
        line_stripped = line.strip()
        if not line_stripped:
            continue
        # Skip yaml frontmatter / code fences
        if line_stripped.startswith(("---", "```", "    ", "\t")):
            continue
        for m in re.finditer(pattern, line):
            target = m.group(1)
            if target == self_name:
                continue
            results[target].append(line_stripped)

    return results


def classify_reference(context: str, target: str) -> str:
    """Classify a reference: invokes, boundary, mode-pointer, mention."""
    ctx_lower = context.lower()
    if any(
        p in ctx_lower
        for p in [
            "does not replace",
            "does not handle",
            "does not produce",
            "boundaries",
            "boundary",
        ]
    ):
        return "boundary"
    if any(
        p in ctx_lower
        for p in ["invoke", "chain", "hand off", "delegates", "passes to", "calls into"]
    ):
        return "invokes"
    if "mode " in ctx_lower:
        return "mode-pointer"
    return "mention"


def build_graph(skills_root: Path) -> dict:
    """Build the full graph of skill relationships."""
    skill_names = collect_skill_names(skills_root)

    skill_data: dict[str, dict] = {}
    for name in skill_names:
        skill_dir = skills_root / name
        skill_md = skill_dir / "SKILL.md"
        fm, body = parse_frontmatter(skill_md.read_text())
        contract_path = skill_dir / "contract.json"
        contract = {}
        if contract_path.exists():
            try:
                contract = json.loads(contract_path.read_text())
            except json.JSONDecodeError:
                contract = {}
        text = gather_skill_text(skill_dir)
        refs = find_references(text, skill_names, name)

        # Categorize each reference
        outbound: dict[str, dict[str, list[str]]] = defaultdict(
            lambda: defaultdict(list)
        )
        for target, contexts in refs.items():
            for ctx in contexts:
                kind = classify_reference(ctx, target)
                outbound[target][kind].append(ctx)

        skill_data[name] = {
            "description_first_sentence": first_sentence(fm.get("description", "")),
            "user_invocable": fm.get("user-invocable", "true (default)"),
            "skill_type": contract.get("skill_type", "single"),
            "modes": [m.get("id") for m in contract.get("modes", [])],
            "outbound": dict(outbound),
        }

    # Build inbound from outbound
    for name, data in skill_data.items():
        inbound: dict[str, dict[str, list[str]]] = defaultdict(
            lambda: defaultdict(list)
        )
        for src_name, src_data in skill_data.items():
            if src_name == name:
                continue
            if name in src_data["outbound"]:
                for kind, ctxs in src_data["outbound"][name].items():
                    inbound[src_name][kind].extend(ctxs)
        data["inbound"] = dict(inbound)

    return skill_data


def render_mermaid(skill_data: dict) -> str:
    """Render a Mermaid graph showing the skill relationships."""
    lines = ["```mermaid", "graph LR"]

    # Group skills by type for better layout
    workflow_skills = []
    discipline_skills = []
    composable_skills = []
    internal_skills = []

    for name, data in sorted(skill_data.items()):
        if name.endswith("-workflow"):
            workflow_skills.append(name)
        elif name.startswith("gate-"):
            internal_skills.append(name)
        elif name in ("tdd", "verify-evidence", "diagnose"):
            discipline_skills.append(name)
        else:
            composable_skills.append(name)

    # Subgraphs
    if workflow_skills:
        lines.append("  subgraph Workflows")
        for n in workflow_skills:
            lines.append(f"    {n}([{n}])")
        lines.append("  end")
    if discipline_skills:
        lines.append("  subgraph Discipline")
        for n in discipline_skills:
            lines.append(f"    {n}[/{n}/]")
        lines.append("  end")
    if internal_skills:
        lines.append("  subgraph Internal")
        for n in internal_skills:
            lines.append(f"    {n}[({n})]")
        lines.append("  end")
    if composable_skills:
        lines.append("  subgraph Composable")
        for n in composable_skills:
            lines.append(f"    {n}[{n}]")
        lines.append("  end")

    # Edges (only invocation edges to keep diagram readable)
    edges: set[tuple[str, str]] = set()
    for name, data in skill_data.items():
        for target, kinds in data["outbound"].items():
            if "invokes" in kinds:
                edges.add((name, target))
    for src, dst in sorted(edges):
        lines.append(f"  {src} --> {dst}")

    lines.append("```")
    return "\n".join(lines)


def render_per_skill_section(skill_data: dict) -> str:
    """Per-skill index with outbound and inbound tables."""
    lines = []
    for name in sorted(skill_data.keys()):
        data = skill_data[name]
        lines.append(f"### `{name}`")
        lines.append("")
        lines.append(f"_{data['description_first_sentence']}_")
        lines.append("")
        modes = data.get("modes", [])
        meta = []
        if data["user_invocable"] == "false":
            meta.append("user-invocable: false")
        if modes:
            meta.append(f"modes: {', '.join(modes)}")
        if meta:
            lines.append(f"**Metadata:** {' • '.join(meta)}")
            lines.append("")

        # Outbound
        if data["outbound"]:
            lines.append("**Outbound (this skill references):**")
            lines.append("")
            lines.append("| Target | Relationship |")
            lines.append("|---|---|")
            for target in sorted(data["outbound"].keys()):
                kinds = data["outbound"][target]
                kind_summary = ", ".join(sorted(kinds.keys()))
                lines.append(f"| `{target}` | {kind_summary} |")
            lines.append("")

        # Inbound
        if data["inbound"]:
            lines.append("**Inbound (referenced by):**")
            lines.append("")
            lines.append("| Source | Relationship |")
            lines.append("|---|---|")
            for source in sorted(data["inbound"].keys()):
                kinds = data["inbound"][source]
                kind_summary = ", ".join(sorted(kinds.keys()))
                lines.append(f"| `{source}` | {kind_summary} |")
            lines.append("")

        if not data["outbound"] and not data["inbound"]:
            lines.append("_No references to or from other skills._")
            lines.append("")

    return "\n".join(lines)


def render_summary_table(skill_data: dict) -> str:
    """Compact catalog overview table."""
    lines = []
    lines.append("| Skill | Type | Modes | User-invocable | Outbound | Inbound |")
    lines.append("|---|---|---|---|---|---|")
    for name in sorted(skill_data.keys()):
        data = skill_data[name]
        modes = ", ".join(data.get("modes", [])) or "—"
        ui = data.get("user_invocable", "true (default)")
        ui_short = "false" if ui == "false" else "true"
        out_count = len(data["outbound"])
        in_count = len(data["inbound"])
        lines.append(
            f"| `{name}` | {data.get('skill_type', 'single')} | {modes} | {ui_short} | {out_count} | {in_count} |"
        )
    return "\n".join(lines)


def render_boundaries(skill_data: dict) -> str:
    """Surface 'does NOT replace X' style boundary edges."""
    lines = [
        "| Skill | Says it does NOT replace / handle | Refers to |",
        "|---|---|---|",
    ]
    rows: list[tuple[str, str, str]] = []
    for name, data in skill_data.items():
        for target, kinds in data["outbound"].items():
            if "boundary" in kinds:
                ctx = kinds["boundary"][0]
                # Trim long contexts
                ctx_short = ctx[:120] + ("…" if len(ctx) > 120 else "")
                rows.append((name, ctx_short, target))
    rows.sort()
    for src, ctx, dst in rows:
        lines.append(f"| `{src}` | {ctx.replace('|', '\\|')} | `{dst}` |")
    if len(lines) == 2:
        return "_No explicit boundary statements detected._"
    return "\n".join(lines)


def render_doc(skill_data: dict) -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    sections = []
    sections.append("# Skill map — devloop catalog")
    sections.append("")
    sections.append(
        f"_Auto-generated by `skills/skill-creator/scripts/generate-skill-map.py` on {timestamp}._"
    )
    sections.append("")
    sections.append(
        "This document is regenerated from the SKILL.md, references, and contract.json of every skill under `skills/`. Do NOT edit by hand — re-run the script after any skill change."
    )
    sections.append("")

    sections.append("## Catalog overview")
    sections.append("")
    sections.append(render_summary_table(skill_data))
    sections.append("")

    sections.append("## Connection graph")
    sections.append("")
    sections.append(
        "Edges show invocation relationships only (skill A → skill B means A invokes B). Boundary, mode-pointer, and mention edges omitted to keep the diagram readable; see the per-skill section below for full reference detail."
    )
    sections.append("")
    sections.append(render_mermaid(skill_data))
    sections.append("")

    sections.append("## Boundaries (does NOT replace / handle)")
    sections.append("")
    sections.append(
        "Cross-skill boundary statements extracted from SKILL.md and references. These mark explicit non-overlaps."
    )
    sections.append("")
    sections.append(render_boundaries(skill_data))
    sections.append("")

    sections.append("## Per-skill detail")
    sections.append("")
    sections.append(render_per_skill_section(skill_data))

    return "\n".join(sections)


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description="Generate the auto-map of devloop skills")
    p.add_argument("--root", default="skills", help="path to skills/ directory")
    p.add_argument(
        "--out",
        default=None,
        help="output path; default: docs/<timestamp>_[ARCHITECTURE]_skill-map.md",
    )
    args = p.parse_args(argv)

    skills_root = Path(args.root)
    if not skills_root.is_dir():
        print(f"error: skills root '{skills_root}' is not a directory", file=sys.stderr)
        return 2

    if args.out:
        out_path = Path(args.out)
    else:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_path = Path(f"docs/{ts}_[ARCHITECTURE]_skill-map.md")

    out_path.parent.mkdir(parents=True, exist_ok=True)

    skill_data = build_graph(skills_root)
    doc = render_doc(skill_data)
    out_path.write_text(doc)
    print(f"Skill map written to {out_path}")
    print(f"  {len(skill_data)} skills mapped")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
