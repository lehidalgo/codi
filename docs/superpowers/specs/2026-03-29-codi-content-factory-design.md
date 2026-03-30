# codi-content-factory — Design Specification

**Date**: 2026-03-29
**Document**: 2026-03-29-codi-content-factory-design.md
**Category**: SPEC

---

## Context

Creating technical content that resonates across platforms is a multi-step, multi-format challenge. A single insight needs to become a blog post, a LinkedIn carousel, an Instagram reel script, a Substack newsletter, and more — each adapted to its platform's conventions, audience expectations, and algorithmic preferences. Today this requires manual effort at every stage: writing, editing for AI tells, reformatting per platform, generating visuals, and planning a publishing calendar.

This skill automates that pipeline: take any input (rough notes, brain dumps, half-written drafts) and produce a polished blog post as the anchor, then systematically derive platform-specific content with visual assets — all while ensuring the output reads as genuinely human, not AI-generated.

## Goals and Content Vision

- Transform any-quality input into publication-ready technical content
- Maintain an accessible, engaging tone: technically credible but not dry — the sweet spot between developer advocacy and copywriting
- Produce content that passes as human-written via a two-layer humanization pipeline
- Generate derivative formats (carousels, reels, posts) that extract unique angles, not just compress the source
- Deliver export-ready visual assets by orchestrating existing Codi skills
- Propose a cross-platform publishing strategy with timing and sequencing

## Skill Architecture

### Pattern: Orchestrator + References

**SKILL.md** (~300 lines) acts as a guided wizard — defining the 8-step workflow, human/agent gates, and integration points. Heavy content lives in 11 reference files loaded on-demand per step.

This follows the `codi-internal-comms` pattern (lean skill, external guidelines) and respects the 500-line file limit.

### Directory Structure

```
.codi/skills/codi-content-factory/
├── SKILL.md                          # ~300 lines — wizard orchestrator
├── evals/
│   └── evals.json                    # 10+ eval cases (positive + negative)
├── scripts/
│   └── .gitkeep
├── references/
│   ├── writing-guidelines.md         # ~150 lines: voice, structure, word rules
│   ├── humanization-rules.md         # ~250 lines: 25+ anti-patterns + extensions
│   ├── platform-linkedin.md          # ~120 lines: hooks, carousels, engagement
│   ├── platform-medium.md            # ~100 lines: SEO, structure, canonical URLs
│   ├── platform-substack.md          # ~100 lines: newsletter format, Notes
│   ├── platform-tiktok.md            # ~100 lines: hooks, script structure, energy
│   ├── platform-instagram.md         # ~120 lines: carousel design, reels, hashtags
│   ├── format-carousel.md            # ~150 lines: HTML/CSS carousel template
│   ├── format-reel-script.md         # ~100 lines: video script template with beats
│   ├── format-social-post.md         # ~100 lines: IPO framework, post templates
│   └── publishing-strategy.md        # ~100 lines: calendar, sequencing, metrics
└── assets/
    └── .gitkeep
```

**Total reference content**: ~1,390 lines across 11 files, loaded progressively.

---

## SKILL.md Design

### Frontmatter

```yaml
---
name: codi-content-factory
description: |
  Content creation and repurposing factory. Use when the user asks to write
  a blog post, create social media content, generate LinkedIn posts, write
  a newsletter, create carousels, write video scripts, or repurpose content
  across platforms. Also activate when the user mentions content strategy,
  content calendar, cross-posting, or wants to turn an idea into publishable
  content. Handles Medium, Substack, LinkedIn, TikTok, and Instagram.
category: Creative and Design
compatibility: [claude-code, cursor, codex]
managed_by: codi
user-invocable: true
---
```

### When to Activate

- User asks to write a blog post, article, or technical content
- User wants to create social media content (LinkedIn, Instagram, TikTok)
- User wants to repurpose existing content across platforms
- User mentions content calendars, publishing strategy, or cross-posting
- User provides rough notes/ideas and wants polished output
- User asks for carousels, reel scripts, or newsletter issues

**Do NOT activate when**:
- Internal communications (defer to `codi-internal-comms`)
- Presentation decks without content strategy context (defer to `codi-deck-engine`)
- Pure design tasks with no writing component (defer to `codi-canvas-design`)

### Wizard Steps

#### Step 1: Session Setup

**[CODING AGENT]** Ask the user:
1. What to create content about (accept any input format)
2. Authoring voice — present three archetypes as starting points:
   - *Developer Advocate*: conversational, technically credible, skeptical of hype
   - *Thought Leader*: authoritative, insight-driven, contrarian takes
   - *Educator*: patient, structured, known-to-unknown bridges
   - Or: describe your own voice
3. Target audience and goal (thought leadership, lead gen, community building)

**[CODING AGENT]** Load `${CLAUDE_SKILL_DIR}/references/writing-guidelines.md` and `${CLAUDE_SKILL_DIR}/references/humanization-rules.md` (Layer 1 prevention rules).

**Gate**: Do not proceed until voice, audience, and raw input are confirmed.

#### Step 2: Input Processing

**[CODING AGENT]** Parse whatever the user provided. Extract:
- Core thesis (one sentence)
- 3-5 supporting points
- Reader's current belief vs. desired belief
- The "so what" — why this matters now

Present extraction back to user for confirmation.

**[HUMAN]** Confirms or corrects the extraction.

**Gate**: User must explicitly confirm thesis and framing.

#### Step 3: Blog Generation

**[CODING AGENT]** Generate 1,200-1,800 word blog post using `writing-guidelines.md`:
- Hook paragraph (problem or contrarian claim)
- Context bridge (what the reader already knows)
- Core insight with evidence (2-3 sections)
- Practical application or framework
- Forward-looking conclusion (not a generic summary)

Apply Layer 1 humanization during generation. Save draft to working file. Present with section commentary.

**[HUMAN]** Reviews substance, provides feedback.

**Gate**: User must approve substance before humanization audit.

#### Step 4: Blog Review and Humanization Audit

**[CODING AGENT]** Incorporate feedback. Run Layer 2 audit against full `humanization-rules.md`:
- Scan every paragraph against all 5 categories (25+ patterns)
- Present findings table: `| Section | Pattern ID | Pattern Name | Detected Text | Fix |`
- Severity: Critical/High auto-fixed, Medium presented for decision
- Apply fixes. Present clean version.

**[HUMAN]** Final sign-off on the blog post.

**Gate**: User must approve final blog before derivatives.

#### Step 5: Derivative Format Selection

**[CODING AGENT]** Present the repurposing menu:
- LinkedIn post
- LinkedIn carousel
- Medium article
- Substack newsletter issue
- TikTok/Reel script
- Instagram carousel
- Instagram caption + reel script
- Short-form social post (any platform)

Briefly explain what each would look like for this specific content. Each derivative must extract a DIFFERENT angle from the blog.

**[HUMAN]** Selects which derivatives to generate.

#### Step 6: Per-Format Generation with Previews

**[CODING AGENT]** For each selected format, in sequence:
1. Load relevant platform + format reference files
2. Extract a unique angle from the blog
3. Generate the content
4. Apply Layer 1 humanization + format-specific anti-patterns
5. Present preview with platform-specific commentary

**[HUMAN]** Approves or requests changes per derivative.

**Gate**: Each derivative approved individually before the next.

#### Step 7: Publishing Strategy

**[CODING AGENT]** Load `${CLAUDE_SKILL_DIR}/references/publishing-strategy.md`. Propose:
- Publishing calendar with suggested dates/times per platform
- Cross-linking strategy
- Canonical URL setup for cross-posts
- Hashtag recommendations

**[HUMAN]** Approves or adjusts. This step is advisory — user can skip.

#### Step 8: Export and Delivery

**[CODING AGENT]** For visual assets, delegate to existing skills:
- **Carousels** → `codi-deck-engine` with carousel CSS overrides from `format-carousel.md`
- **Social cards** → `codi-canvas-design` for quote/stat PNG cards
- **Blog HTML export** → `codi-doc-engine` for branded HTML with print CSS
- **Rich web artifact** → `codi-frontend-design` (optional premium path)

Generate summary checklist: all artifacts, file paths, target platforms, publishing order, manual steps.

### Constraints

- Do NOT generate content without user confirmation of core thesis (Step 2)
- Do NOT skip the humanization audit — it is mandatory
- Do NOT generate all derivatives at once — one at a time with approval
- Do NOT use any of the 25+ anti-patterns, even in drafts
- Do NOT generate visual assets directly — delegate to appropriate Codi skill
- Do NOT assume a platform — always ask

---

## Reference Files Design

### writing-guidelines.md (~150 lines)

The core writing DNA, loaded at session start.

**Voice Principles**:
- "Smart but unfamiliar": simplify language, never simplify ideas
- Known-to-unknown bridge: open each section from what reader already accepts
- Purpose-first: state the problem in the first paragraph, never background
- Honest and skeptical: acknowledge trade-offs and limitations
- Second person ("you"), friendly but not casual

**Structure Template**:
- Hook (problem/contrarian claim, 2-3 sentences)
- Bridge (what reader knows, 1 paragraph)
- Core insight with evidence (2-3 sections)
- Application (practical takeaway or framework)
- Forward look (where this leads, not a summary)

**Paragraph Discipline**: Max 4 sentences. Vary between 1 and 3 for rhythm. Subheadings are promises — "How caching reduces latency by 10x" not "Caching".

**Authenticity Premium**: Every piece must contain at least one insight that could ONLY come from the author's specific experience. "Would someone who has never done this be able to write this paragraph?" If yes, add more specificity.

**Sentence-Level Rules**: Lead with subject + verb. Vary length. Concrete nouns, active verbs. One idea per sentence. Logical transitions (not mechanical "Additionally").

**Word-Level Rules**: Banned vague words (various, numerous, robust, cutting-edge, game-changing, revolutionary, seamless, synergy). Prefer short words (use not utilize). Numbers over adjectives (3x faster not much faster).

### humanization-rules.md (~250 lines)

Extended anti-pattern set with two layers and format-specific additions.

**Layer 1 (Prevention)**: Loaded at session start. Writing guidelines prevent patterns structurally.

**Layer 2 (Audit)**: Post-generation scan against all categories with severity levels.

**Category 1 — Content Patterns (CP-01 to CP-05)**:
- CP-01 Undue Emphasis: no "It's important to note"
- CP-02 Promotional Language: no "game-changing", "revolutionary"
- CP-03 Vague Attributions: no "experts say" without citations
- CP-04 False Precision: no "precisely" with round numbers
- CP-05 Manufactured Urgency: no "now more than ever"

**Category 2 — Language Patterns (LP-01 to LP-05)**:
- LP-01 Overused AI Vocabulary: Additionally, Furthermore, Landscape, Interplay, Delve, Leverage, Utilize, Facilitate, Robust, Paradigm, Ecosystem (with specific replacements)
- LP-02 Passive Voice / Copula Avoidance
- LP-03 Negative Parallelisms: no "not only X but also Y"
- LP-04 Forced Rule-of-Three
- LP-05 Adverb Overload

**Category 3 — Style Patterns (SP-01 to SP-05)**:
- SP-01 Em-Dash Overuse: max 2 per 500 words
- SP-02 Mechanical Boldface: bold only terms being defined
- SP-03 Inline-Header Bullets
- SP-04 Exclamation Points: max 1 per 1,000 words
- SP-05 Colon Introductions

**Category 4 — Communication Patterns (CM-01 to CM-04)**:
- CM-01 Chatbot Artifacts
- CM-02 Sycophantic Tone
- CM-03 Meta-Commentary: no "In this article, we will explore..."
- CM-04 Conclusion Signaling: no "In conclusion"

**Category 5 — Hedging and Filler (HF-01 to HF-04)**:
- HF-01 Filler Phrases
- HF-02 Excessive Hedging
- HF-03 Generic Conclusions
- HF-04 Throat-Clearing

**Format-Specific Extensions**:
- Carousel (CF-01 to CF-05): max 30 words/slide, no "Did you know?" hooks, specific CTA on last slide
- Social post (SF-01 to SF-05): no hashtag stuffing, no engagement bait, standalone readability
- Video script (VF-01 to VF-05): no "Hey guys", 2-second hook rule, written for spoken cadence

**Severity Levels**:
- Critical: chatbot artifacts, sycophantic tone — auto-fix
- High: overused AI vocabulary, em-dash overuse — auto-fix
- Medium: mechanical boldface, hedging — present for decision
- Low: style preferences — note only

### Platform Reference Files

**platform-linkedin.md (~120 lines)**:
- Character limits (3,000 total, 210 before "See more")
- Post anatomy: hook → single-sentence paragraphs → evidence → CTA
- Hook patterns with examples: Contrarian, Intrigue, Benefit, Story
- Carousel specs: 1:1 or 4:5, 8-10 slides, PDF upload
- Engagement mechanics: saves/shares > likes, respond in first 2 hours
- Anti-patterns: "I'm humbled to announce", walls of text

**platform-medium.md (~100 lines)**:
- SEO: keyword in title + first 100 words, H1→H2→H3 hierarchy
- Formatting: pull quotes, code blocks, subheadings every 300-400 words
- Canonical URLs for cross-posts via Medium import tool
- Reading time target: 6-8 minutes (1,500-2,000 words)
- Publication submission strategy

**platform-substack.md (~100 lines)**:
- Newsletter-first: write for inbox, subject line is key
- Structure: short paragraphs, bold sparingly, section breaks
- Notes strategy for discovery
- Authenticity premium: voice > information
- Growth mechanics: cross-recommendations, guest posts

**platform-tiktok.md (~100 lines)**:
- 2-second hook rule with proven templates
- Script structure: Hook (0-2s) → Setup (2-8s) → Core (8-25s) → CTA (25-30s)
- Edutainment format: education + entertainment
- Energy calibration: 20% higher, with markers [upbeat], [beat], [EMPHASIS]
- Technical specs: 9:16, captions mandatory, safe zones

**platform-instagram.md (~120 lines)**:
- Carousel: 8-10 slides, 4:5 portrait, first slide = hook, saves/sends matter
- Reel specs: 15-30s for reach, cover image, captions
- Caption strategy: hook in first line, 150-1,000 chars optimal
- Hashtag strategy: 5-10, mix broad + niche
- Content-type matrix: when carousel vs. reel vs. single image

### Format Template Files

**format-carousel.md (~150 lines)**:
- HTML/CSS template for generating carousel slides as exportable artifacts
- CSS variables for aspect ratio (1:1 LinkedIn, 4:5 Instagram)
- Slide types: hook, content, stat, quote, CTA — with HTML snippets
- Brand token integration (same variables as codi-deck-engine)
- Export instructions: browser print to PDF, or screenshot at exact dimensions
- Integration: invokes codi-deck-engine with carousel CSS overrides

**format-reel-script.md (~100 lines)**:
- Two-column script format: visual direction | spoken words + timing
- Complete markdown template with timing markers
- Hook library: 10 proven structures with templates
- Beat and pacing markers: [beat], [EMPHASIS], [CUT TO:], [TEXT ON SCREEN:]
- Pacing rules: 130-150 wpm conversational, 100-120 for emphasis
- Platform adaptation notes: TikTok vs. Instagram differences

**format-social-post.md (~100 lines)**:
- IPO framework: Insight → Proof → Outcome
- Post templates: Contrarian Take, Micro-Story, List Post, Question Post, Stat-Drop
- Platform-specific adaptations table
- Angle extraction: how to pull 4-6 distinct angles from one blog post

### publishing-strategy.md (~100 lines)

- Cascade principle: "Create once, adapt downward" — blog → newsletter → LinkedIn → carousel → posts → reels
- Weekly calendar template: Monday blog → staggered derivatives through the week
- Cross-linking strategy per platform
- Sequencing rules: 24-48h exclusive window, one derivative per day max
- Measurement framework: what to track per platform (impressions, saves, open rate, watch time)

---

## Skill Integrations

| Skill | Used For | When |
|-------|----------|------|
| `codi-deck-engine` | Carousel HTML with custom aspect ratios | Step 8, carousel export |
| `codi-canvas-design` | Social media card PNGs (quotes, stats) | Step 8, visual cards |
| `codi-doc-engine` | Branded HTML blog export with print CSS | Step 8, blog export |
| `codi-frontend-design` | Interactive web artifacts (optional) | Step 8, premium path |

Integration pattern: the content factory provides content and specs, the target skill provides rendering. Example: "Activate codi-deck-engine for carousel generation. Pass slide content array + carousel dimensions from format-carousel.md."

---

## Humanization Pipeline

### Layer 1: Prevention During Generation

- Loaded at session start (Step 1)
- Writing guidelines structured to make AI patterns structurally impossible
- "Purpose-first structure" prevents throat-clearing. "One idea per sentence" prevents "Additionally/Furthermore". "Numbers over adjectives" prevents vague promotional language.
- Top 10 most common patterns explicitly banned in context during generation
- Handles ~80% of issues before they occur

### Layer 2: Post-Generation Audit

- Triggered after blog approval (Step 4) and after each derivative (Step 6)
- Full scan against all 5 categories + format-specific extensions
- Structured findings table with severity levels
- Critical/High: auto-fixed. Medium: presented for decision. Low: noted only
- Catches remaining ~20% of issues

### Why Two Layers

A single post-hoc pass produces text that reads like "an AI tried to sound human" — structure still betrays AI origin even when words are fixed. Prevention at the structural level (Layer 1) + catch at the word level (Layer 2) = naturally written content that happens to be well-edited.

---

## Evals Design

**Positive triggers** (should activate):
1. "Help me write a blog post about API rate limiting"
2. "Turn these rough notes into a LinkedIn post" + messy bullets
3. "I need a content calendar for this article"
4. "Create an Instagram carousel from my latest blog post"
5. "Write a TikTok script about developer productivity"
6. "Repurpose this article for social media"

**Negative triggers** (should NOT activate):
1. "Write a status report for my team" → codi-internal-comms
2. "Create a slide deck for my presentation" → codi-deck-engine
3. "Design a poster for the conference" → codi-canvas-design
4. "Write unit tests for the content service" → code task

---

## Market Context

### Existing Tools Analyzed

| Tool | Strength | Gap This Skill Fills |
|------|----------|---------------------|
| Jasper AI | Enterprise brand consistency, "Content Remix" | No humanization audit, no code-level asset generation |
| Copy.ai | Short-form content, strong free tier | No guided wizard, no platform-specific adaptation |
| Repurpose.io | Video/audio automation to 30+ platforms | No content creation, only distribution |
| Humanizer (blader) | 25 AI anti-patterns, multi-pass rewriting | Only rewrites existing text, no content creation pipeline |

### Differentiation

This skill combines what no single tool does:
1. End-to-end pipeline from raw idea to published content
2. Two-layer humanization (prevent + audit) vs. single-pass rewriting
3. Visual asset generation via existing Codi skill integrations
4. Platform-specific adaptation with researched specifications
5. Guided wizard with human gates at every stage

---

## Verification Plan

1. **Scaffold**: Run `codi add skill codi-content-factory` and verify directory structure
2. **Eval triggers**: Run all 10+ evals and verify 80%+ pass rate
3. **End-to-end test**: Provide rough notes about a technical topic, walk through the full wizard, verify each output format
4. **Humanization test**: Generate a blog post, run Layer 2 audit, verify pattern detection and fix quality
5. **Integration test**: Verify carousel generation delegates to codi-deck-engine correctly
6. **Negative test**: Verify "write a status report" does NOT trigger this skill
