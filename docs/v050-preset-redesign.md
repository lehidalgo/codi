# CODI v0.5.0 — Preset & Artifact Ecosystem Redesign

## The Mental Model

```
CODI Library (upstream)
  ├── Built-in Artifacts (rules, skills, agents, commands)
  └── Built-in Presets (curated bundles of artifacts)
         ↓
    User installs a preset (or creates custom)
         ↓
    Project (.codi/)
    ├── Active preset (reference to which artifacts to use)
    ├── Artifacts (installed from templates or user-created)
    └── Custom modifications
         ↓
    User contributes back → PR to CODI upstream
```

## Hierarchy

```
Artifacts (units of configuration)
  ├── rule     — single .md file with frontmatter
  ├── skill    — directory: SKILL.md + optional scripts, assets, configs
  ├── agent    — single .md file with frontmatter
  └── command  — single .md file with frontmatter

Presets (selections of artifacts)
  └── A named combination: "use these rules + these skills + these agents + these flags"
  └── A preset does NOT contain artifact files — it references them by name

Sources:
  └── Built-in: ships with codi npm package
  └── Custom: user-created, lives locally
  └── External: from ZIP or GitHub repo
```

Note: Skills are the richest artifact type — they can include supporting scripts, data files, or helper assets alongside the main SKILL.md definition. When contributing or packaging a skill, the entire skill directory is included.

## The Full Loop

### Step 1: Install (init)

```
codi init
  → Select IDE agents (claude-code, cursor, etc.)
  → Choose preset:
      a) Built-in preset (balanced, python-web, typescript-fullstack, etc.)
      b) Import from ZIP / GitHub
      c) Custom — searchable selection of artifacts
  → If custom: save as named preset for reuse
  → Artifacts installed + configs generated. Done.
```

### Step 2: Customize (day-to-day)

```
codi add rule my-company-standards        # create custom artifact
codi add skill deploy-checker             # create custom skill
codi preset update my-preset              # add new artifacts to preset
codi preset edit my-preset                # interactive: add/remove artifacts from preset
```

The preset manifest updates automatically — it's just a list of artifact names. The artifacts themselves live in `.codi/rules/`, `.codi/skills/`, etc.

### Step 3: Create & author artifacts (AI-assisted)

The coding agent helps users **create new artifacts from scratch**. Built-in skills guide the agent through authoring any artifact type:

- **`artifact-creator` skill** (already exists) — guides creation of rules, skills, agents, commands with proper frontmatter, structure, and quality content
- **`preset-creator` skill** (already exists) — guides creation of presets with artifact selection
- The agent can also **edit existing artifacts** — improve rules, expand skills, refine agent prompts

This means users don't need to know the .md format or frontmatter schema — the agent handles it.

### Step 4: Contribute back

Two paths for contributing:

**Path A: Interactive (guided by coding agent)**
```
User: "I want to contribute my custom deploy-checker skill to codi"
Agent (using contribute skill):
  → Validates the artifact structure and quality
  → Checks if gh CLI is authenticated, helps troubleshoot if not
  → Forks codi-cli repo (if needed)
  → Creates branch, copies artifact to correct template location
  → Opens PR with description and test results
  → Shows PR URL to user
```

**Path B: Advanced (manual PR)**
Advanced users can also create conventional PRs directly to the codi-cli repo. The contribute skill still helps here — validating artifact format, suggesting the right directory, generating the PR description.

**Path C: Private sharing (no GitHub)**
```
codi contribute
  → Export as ZIP → share privately
  → Or push to own org's preset repo
```

This makes the user's custom work available to everyone (path A/B) or their team (path C). PRs go through review, and if accepted, ship in the next codi release as built-in templates.

## Analysis: Does This Make Sense?

### Pros

1. **Clean hierarchy** — Artifacts are atomic, presets are selections, no duplication
2. **Preset = reference not copy** — Adding a rule to a preset doesn't create files in two places
3. **Full loop** — Install → Customize → Contribute → others install your preset
4. **Upstream contribution is frictionless** — `codi contribute` handles the PR mechanics
5. **Scales** — As artifacts grow, presets let users discover curated bundles instead of 51+ individual templates
6. **Privacy preserved** — Custom presets stay local until you explicitly contribute
7. **Git-native** — PRs for contribution, repos for external presets, tags for versioning

### Cons / Risks

1. **PR to codi-cli repo requires GitHub auth** — User needs `gh` CLI configured or a personal access token. Not all users will have this.
   - Mitigation 1: ZIP export for sharing without GitHub
   - Mitigation 2: **Contribute skill** — a built-in skill (or section in codi-operations) that the AI coding agent uses to guide the user through the contribution process step by step. The agent handles the git/gh commands, explains what's happening, troubleshoots auth issues, and walks the user through fork → branch → commit → PR. This way even users unfamiliar with GitHub PRs can contribute — the agent does the heavy lifting.
2. **Upstream review bottleneck** — If many users contribute, PR review becomes a burden on maintainers
   - Mitigation: Clear contribution guidelines, automated quality checks in CI
3. **Template naming conflicts** — Two users might create `my-deploy-rule` with different content
   - Mitigation: Namespace by author? Or reject duplicates in PR review
4. **Breaking change** — Current presets copy files into `.codi/presets/{name}/rules/`. New presets are just manifests. Need migration path.
   - Mitigation: Phase 2 supports both formats during transition
5. **Contribution quality** — User-submitted templates may be low quality
   - Mitigation: PR review + automated schema validation + linting in CI
6. **Preset versioning** — If a built-in preset changes (adds/removes artifacts), what happens to users who installed it?
   - Mitigation: `codi update` refreshes managed artifacts; preset-lock.json tracks installed version

### What We Have in the Codebase Today

| Feature | Current State | Needed for v0.5.0 |
|---------|--------------|-------------------|
| Built-in artifacts | 51 templates (21 rules, 14 skills, 8 agents, 8 commands) | No change |
| Built-in presets | 6 (3 flag-only + 3 full) | Migrate to reference-based manifests |
| Preset manifest | Has rules/skills/agents/commands dirs (copies) | Change to `artifacts:` field (references) |
| Init wizard | Artifact-first (select individual templates) | Preset-first (choose preset or custom) |
| Searchable selection | Not implemented | Need `autocompleteMultiselect` or `@inquirer/prompts` |
| Contribute command | Does not exist | New `codi contribute` command |
| PR creation | Not in codebase | Use `gh pr create` via child_process |
| ZIP export | Works (`codi preset export`) | Keep as alternative to PR |
| GitHub preset install | Works (`codi preset install github:`) | Keep as-is |

## Phased Implementation

**Phase 1:** Save this design doc. Complete v0.4.x QA.

**Phase 2:** New preset schema — `artifacts:` field with named references. Support both old (dir-copy) and new (reference) formats. Backward compatible.

**Phase 3:** Preset-first init wizard with searchable selection. Replace `prompts` multiselect with `autocompleteMultiselect` or `@inquirer/prompts`.

**Phase 4:** `codi contribute` command — interactive selection, PR to codi-cli repo, ZIP fallback.

**Phase 5:** Migration — deprecate dir-copy presets, auto-migrate existing ones to reference format.
