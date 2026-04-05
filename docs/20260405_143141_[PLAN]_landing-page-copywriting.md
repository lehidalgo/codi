# Landing Page Copywriting Redesign
**Date**: 2026-04-05 14:31
**Document**: 20260405_143141_[PLAN]_landing-page-copywriting.md
**Category**: PLAN

## Objective

Redesign the landing page copy to convey the combined messaging narrative:

1. **Fragmentation tax (C)** — adding AI agents to a team multiplies the maintenance burden and knowledge gap
2. **Knowledge drift reframe (A)** — the real problem is scattered, unversioned AI coding knowledge, not just different config file formats
3. **Compounding intelligence (B)** — Codi centralizes that knowledge so it versions, shares, and compounds sprint after sprint

**Core tagline:** "The AI knowledge your team builds should compound — not scatter."

## Scope

Changes are copy-only: text content, translation strings, and page metadata. No layout, CSS, structural HTML, or JavaScript logic changes.

Files changed:
- `site/index.html` — all `data-i18n`, `data-i18n-html`, and static text nodes
- `site/app.js` — `TRANSLATIONS.en` and `TRANSLATIONS.es` objects

No new sections, no removed sections, no new HTML elements.

---

## Section-by-Section Copy Changes

### 1. Page Title & Meta

**Current:**
```
title: Codi — One config. Every AI agent. Zero drift.
description: Write your AI agent configuration once. Codi generates CLAUDE.md, .cursorrules, AGENTS.md and more. Zero drift across Claude Code, Cursor, Codex, Windsurf, and Cline.
og:title: Codi — One config. Every AI agent. Zero drift.
og:description: Unified config management for AI coding agents.
```

**New:**
```
title: Codi — Your AI coding knowledge. Centralized.
description: AI coding agents multiply. Your knowledge should too. Codi turns your team's rules, skills, and conventions into a version-controlled knowledge base that syncs to every agent, every time.
og:title: Codi — Your AI coding knowledge. Centralized.
og:description: The AI knowledge your team builds should compound — not scatter.
```

---

### 2. Hero Section

**badge** (data-i18n: `hero.badge`)
- Current: `v{version} — now supporting {agents} agents`
- New: `v{version} — {agents} agents, one knowledge base`

**h1** (data-i18n-html: `hero.h1`)
- Current: `One config.<br><span class="gradient-text">Every AI agent.</span>`
- New: `Your AI knowledge.<br><span class="gradient-text">Finally centralized.</span>`

**hero.sub** (data-i18n-html: `hero.sub`)
- Current: `Write your rules once in <code>.codi/</code> — Codi generates <code>CLAUDE.md</code>, <code>.cursorrules</code>, <code>AGENTS.md</code> and more. Zero drift, every time.`
- New: `Different agents, different teams, different tools — your AI coding knowledge scatters across files nobody keeps in sync. Codi centralizes it in <code>.codi/</code>, versions it with git, and generates every agent config automatically. The knowledge compounds. The drift stops.`

**hero.stat1**
- Current: `AI agents synced`
- New: `AI agents in sync`

**hero.stat2**
- Current: `Built-in templates`
- New: `Ready-to-use templates`

**hero.stat3**
- Current: `Shareable presets`
- New: `Share as a preset`

**hero.stat4**
- Current: `Config drift`
- New: `Knowledge drift`

---

### 3. Why / Problem Section

**section-label** (data-i18n: `why.label`)
- Current: `The Problem`
- New: `Why Codi Exists`

**why.problem-h3**
- Current: `The drift problem`
- New: `Your AI knowledge is fragmented`

**why.problem-p** (data-i18n-html)
- Current: `Every AI coding agent speaks a different language. Claude Code reads <code>CLAUDE.md</code>, Cursor reads <code>.cursorrules</code>, Codex reads <code>AGENTS.md</code>. Maintaining multiple agents means duplicate configs that inevitably drift.`
- New: `You added a security rule to Claude Code. Your teammate's Cursor doesn't know it. Your CI runs Codex with last month's conventions. Add a second AI tool and the fragmentation doubles. Add a second developer and it doubles again. The more agents and people involved, the worse it gets.`

**why.problem-li1**
- Current: `Security rule added to <code>CLAUDE.md</code> — never reaches <code>.cursorrules</code>`
- New: `Every new agent adds another config file to maintain`

**why.problem-li2**
- Current: `Coding convention enforced in one agent, ignored by others`
- New: `Rules added by one developer never reach the rest of the team`

**why.problem-li3**
- Current: `One source of truth? It doesn't exist`
- New: `New hires start from zero — no shared AI knowledge baseline`

**why.solution-h3**
- Current: `The Codi solution`
- New: `One knowledge base. Every agent. Every teammate.`

**why.solution-p** (data-i18n-html)
- Current: `Write your configuration once in <code>.codi/</code>. Codi generates the correct native config for every agent, every time. One source of truth, zero drift.`
- New: `Write your rules, skills, and conventions once in <code>.codi/</code>. Version control it with git. Share it as a preset. Codi generates the native config each agent understands — and keeps every agent in sync as your knowledge grows.`

**why.solution-li1** (data-i18n-html)
- Current: `Define rules in <code>.codi/rules/</code>`
- New: `Version-controlled knowledge your whole team shares`

**why.solution-li2** (data-i18n-html)
- Current: `Run <code>codi generate</code>`
- New: `One preset installs your full AI knowledge base`

**why.solution-li3**
- Current: `All 5 agents stay in sync — forever`
- New: `Every rule you add makes every agent smarter, instantly`

---

### 4. Features Section

**feat.h2** (data-i18n-html)
- Current: `Everything you need,<br>nothing you don't`
- New: `Built to grow<br><span class="gradient-text">with your knowledge</span>`

**feat.multi-h4**
- Current: `5 agents, 1 config`
- New: `One source, {agents} agents`

**feat.multi-p**
- Current: `One source of truth generates native configs for Claude Code, Cursor, Codex, Windsurf, and Cline.`
- New: `Your knowledge in <code>.codi/</code> generates native configs for every agent — Claude Code, Cursor, Codex, Windsurf, and Cline all read from the same source.`

**feat.templates-h4**
- Current: `Rich built-in library`
- New: `Start with proven knowledge`

**feat.templates-p**
- Current: `100+ templates covering 11 languages, security, testing, and 3 frameworks — ready to use from day one.`
- New: `{templates}+ templates covering 11 languages, security, testing, and 3 frameworks. Start with what experts already know — then build on it.`

**feat.presets-h4**
- Current: `Build & share presets`
- New: `Package & share knowledge`

**feat.presets-p**
- Current: `Package your rules, skills, and agents into a preset. Install from GitHub or ZIP. Share with your team or the community.`
- New: `Bundle your rules, skills, and agents into a preset. Publish to GitHub. Your team installs it with one command and every agent inherits your full knowledge base.`

**feat.flags-p**
- Current: `3-layer config resolution: preset → repo → user. Tech leads lock values teams cannot override.`
- New: `3-layer resolution: preset → repo → user. Tech leads lock critical rules — security standards, test requirements — that the team cannot override.`

**feat.drift-p**
- Current: `Hash-based tracking instantly catches when generated files diverge from your source config.`
- New: `Hash-based tracking catches when generated files diverge from your source. Knowledge stays canonical.`

---

### 5. Solo & Teams Personas Section

**who.h2** (data-i18n-html)
- Current: `One tool,<br><span class="gradient-text">two superpowers</span>`
- New: `One knowledge base.<br><span class="gradient-text">Two ways to win.</span>`

**who.sub**
- Current: `Whether you code alone or lead a team, Codi gives you a different kind of advantage. Same tool, fundamentally different payoff.`
- New: `Whether you code alone or lead a team, the core value is the same: your AI coding knowledge centralizes, versions, and compounds over time. The payoff scales with your team.`

**who.solo-h3**
- Current: `Grow together with your agents`
- New: `Your knowledge compounds with every sprint`

**who.solo-p** (data-i18n-html)
- Current: `Your <code>.codi/</code> becomes a living knowledge base that compounds over time. Start from a built-in preset, add your own rules and skills as you go, and watch your AI pair programmer get sharper with every sprint. By month 3, your agents know your conventions better than most code reviewers do.`
- New: `Start from a built-in preset. Each time an agent misses your pattern, write a rule. Each rule makes every agent smarter. By sprint 20, your <code>.codi/</code> is a living record of everything you've learned — and every AI tool you add to your workflow inherits it from day one.`

**who.solo-li2**
- Current: `Add a rule each time an agent misses your pattern`
- New: `Encode what you learn — the gap closes permanently`

**who.solo-li5**
- Current: `Quality compounds — every sprint better than the last`
- New: `Knowledge compounds — every sprint better than the last`

**who.team-h3**
- Current: `One canonical config, everyone synced`
- New: `Shared knowledge. Every developer, every agent.`

**who.team-p**
- Current: `The tech lead writes the rules once. Every developer, every machine, every AI agent runs from the same canonical config. Locked flags prevent critical rules from being overridden. New hires pull the preset and are productive in minutes, not days.`
- New: `Without Codi, every developer maintains their own AI config. Rules added by one person never reach the others. New hires start from scratch. With Codi, the tech lead publishes a preset once — and every developer, every machine, every AI agent runs from the same knowledge base. New hires inherit years of team knowledge on day one.`

**who.team-li1**
- Current: `Tech lead publishes a preset once — team installs it`
- New: `Tech lead publishes team knowledge once — team inherits it`

**who.team-li5** (data-i18n-html)
- Current: `New hire runs <code>codi init</code> — fully synced from day one`
- New: `New hire runs <code>codi init</code> — inherits full team knowledge instantly`

---

### 6. Improve / Compounding Section

**improve.label**
- Current: `For solo developers`
- New: `How it compounds`

**improve.h2** (data-i18n-html)
- Current: `The more you use it,<br><span class="gradient-text">the smarter your agents get</span>`
- New: `Every gap you encode<br><span class="gradient-text">makes every agent smarter</span>`

**improve.sub**
- Current: `Codi is the harness that turns your experience into structured knowledge. Every gap you notice becomes a rule. Every rule makes every agent smarter. Iterate on your config the same way you iterate on your code — and watch the quality compound sprint after sprint.`
- New: `You already know what good code looks like for your project. The problem is your agents don't — not yet. Codi is the layer that turns what you know into structured, versioned, shareable knowledge. Encode a gap once. Every agent reflects it from the next prompt, forever.`

**improve.step2-h4**
- Current: `Capture the gap`
- New: `Encode the gap`

**improve.step2-p**
- Current: `Write a rule, sharpen a skill, or define a new agent that encodes exactly what was missed. Takes minutes, lasts forever.`
- New: `Write a rule that captures exactly what was missed. It takes minutes. It stays in your knowledge base forever and applies to every agent from that moment on.`

**improve.step3-p** (data-i18n-html)
- Current: `Run <code>codi generate</code>. All 5 agents immediately reflect the improvement — no drift, no manual copying.`
- New: `Run <code>codi generate</code>. All {agents} agents immediately inherit the new knowledge — no drift, no manual updates across files.`

**improve.step4-h4**
- Current: `Better output, next sprint`
- New: `Smarter agents, next sprint`

**improve.step4-p**
- Current: `Your agents follow the refined rules from the first prompt. Quality compounds — iteration after iteration, forever.`
- New: `Every agent follows the new rule from the first prompt. The gap closes permanently. Repeat — and watch the knowledge compound.`

**improve.footer** (data-i18n-html)
- Current: `You and your agents improve Codi. Codi improves your agents. <strong>The loop closes — and compounds.</strong>`
- New: `You encode what you know. Codi makes every agent know it. <strong>The knowledge loop closes — and compounds.</strong>`

---

### 7. About Bio

**about.bio** (data-i18n-html)
- Current: `I built Codi because I was tired of maintaining four different config files for four different AI agents. One change in <code>CLAUDE.md</code> meant three more updates across Cursor, Codex, and Windsurf — and they always drifted. Codi is the tool I wished existed.`
- New: `I built Codi because I was tired of the fragmentation tax. Every time I added a new AI tool to my workflow, I had another config to maintain. Rules I added to <code>CLAUDE.md</code> never made it to Cursor. Knowledge I built up in one agent didn't transfer to others. Codi is the single knowledge base I wished all my agents shared.`

---

### 8. Stats Bar Labels

**bar.stat3**
- Current: `Build & share presets`
- New: `Share as a preset`

**bar.stat4**
- Current: `Config drift`
- New: `Knowledge drift`

---

## Spanish Translations (ES)

All `TRANSLATIONS.es` keys are updated to match the new EN copy in Spanish.

Key translation decisions:
- "knowledge base" → "base de conocimiento"
- "compounds" → "se acumula" / "crece con el tiempo"
- "fragmentation tax" → "el costo de la fragmentación"
- "encode" → "registra"
- "gap" → "brecha"
- "preset" → "preset" (keep as-is, technical term)
- "drift" → "desincronización"

Full ES translations are provided inline during implementation alongside EN changes.

---

## Implementation Notes

- All changes go into `data-i18n` / `data-i18n-html` attributes in `index.html` and matching keys in `TRANSLATIONS.en` / `TRANSLATIONS.es` in `app.js`
- `{agents}` and `{templates}` placeholders are resolved by `resolveStats()` at runtime — use them where dynamic counts appear in copy
- The `feat.multi-h4` uses `{agents}` placeholder (not hardcoded "5")
- Static HTML text nodes (e.g. in `.terminal-body`) remain in English — these are code demos, not copy
- Terminal demo content stays unchanged (code is language-neutral)
- No layout, CSS, or structural changes

## Acceptance Criteria

- Every section uses language from the combined narrative arc (fragmentation → knowledge centralization → compounding)
- No hardcoded counts — `{agents}` and `{templates}` used where counts appear in copy
- EN/ES toggle works correctly on all updated strings
- Page metadata (title, description, og:*) reflects the new positioning
