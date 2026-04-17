# External Skills — Soft Dependencies

Content Factory produces higher-quality variants when paired with
community-maintained Claude skills for marketing, SEO, blog authoring,
and hero-image generation. These are **soft dependencies**: if a skill is
installed, use it; if not, inline-generate with lower fidelity and tell
the user what's available.

| Detection order: check first, use if present, otherwise install-instruct. |
| :--- |

---

## Skills we integrate

### marketingskills — copy, strategy, conversion

**Repo:** https://github.com/coreyhaines31/marketingskills
**Install:**
```
/plugin install marketing-skills
```
Or: `npx skills add coreyhaines31/marketingskills`

**Detection:** check for `~/.claude/plugins/marketing-skills/` or any
`/copywriting`, `/content-strategy`, `/social-content`, `/launch-strategy`
slash command registration.

**Used by Content Factory for:**

| Step | Skill | What it does |
|------|-------|--------------|
| Intake | `/marketing-psychology` | Validate the hook promises a concrete payoff |
| Intake | `/customer-research` | If the user doesn't know their audience, surface past interviews |
| Intake | `/launch-strategy` | If the request is a launch, derive the sequence and cadence |
| Anchor authoring | `/content-strategy` | Confirm the topic fits the content pillar |
| Anchor authoring | `/copywriting` | Review the hook and CTA for clarity |
| Distillation | `/social-content` | Platform-specific voice review per variant |
| Distillation | `/ad-creative` | For paid-post variants (LinkedIn sponsored, Meta ads) |
| Post-distillation | `/copy-editing` | Final pass before humanizer |
| Pricing copy | `/pricing-strategy` | When the anchor's CTA is a paid upsell |

---

### claude-blog — blog authoring, SEO, factcheck

**Repo:** https://github.com/AgriciDaniel/claude-blog
**Install:**
```
/plugin install claude-blog@AgriciDaniel-claude-blog
```
Or (Unix): `curl -fsSL https://raw.githubusercontent.com/AgriciDaniel/claude-blog/main/install.sh | bash`

**Detection:** check for `~/.claude/plugins/claude-blog/` or the
`/blog write`, `/blog outline`, `/blog seo-check` commands.

**Used by Content Factory for:**

| Step | Skill | What it does |
|------|-------|--------------|
| Anchor authoring | `/blog outline` | Generate a structured outline before drafting prose |
| Anchor authoring | `/blog write` | Draft the standard or deep anchor from the outline |
| Anchor authoring | `/blog factcheck` | Verify statistics and citations |
| Blog variant | `/blog schema` | Generate JSON-LD schema for the blog post |
| Blog variant | `/blog seo-check` | SEO validation before export |
| Blog variant | `/blog cannibalization` | Check for keyword overlap with existing content |
| Blog variant | `/blog image` | Source or generate header images (falls back to banana-claude) |
| Blog variant | `/blog audit` | Post-publish audit of the blog variant |

---

### claude-seo — SEO analysis, technical audits

**Repo:** https://github.com/AgriciDaniel/claude-seo
**Install:**
```
/plugin marketplace add AgriciDaniel/claude-seo
/plugin install claude-seo@AgriciDaniel-claude-seo
```

**Detection:** check for `~/.claude/plugins/claude-seo/` or the `/seo`
command family (`/seo audit`, `/seo schema`, `/seo content`, `/seo google`,
`/seo local`, `/seo programmatic`, `/seo hreflang`).

**Used by Content Factory for:**

| Step | Skill | What it does |
|------|-------|--------------|
| Anchor authoring | `/seo content` | Keyword density and semantic coverage check on anchor |
| Blog variant | `/seo audit <url>` | Full technical + on-page audit once the blog is live |
| Blog variant | `/seo schema` | Generate structured data markup |
| Blog variant | `/seo hreflang` | If the campaign targets multiple locales |
| Programmatic | `/seo programmatic` | For campaigns generating many near-duplicate pages |
| Local campaigns | `/seo local` · `/seo maps` | When the topic is geography-bound |
| Post-publish | `/seo google` | Connect to Search Console / PageSpeed / GA4 for live metrics |

---

### banana-claude — AI image generation

**Repo:** https://github.com/AgriciDaniel/banana-claude
**Install:**
```
/plugin install banana-claude@banana-claude-marketplace
```
Or: `bash banana-claude/install.sh`

**Detection:** check for `~/.claude/plugins/banana-claude/` or the
`/banana generate`, `/banana edit`, `/banana batch`, `/banana inspire`
commands.

**Used by Content Factory for:**

| Step | Skill | What it does |
|------|-------|--------------|
| Variant hero images | `/banana generate` | One hero image per variant that needs one (LinkedIn single post, IG feed, X card, blog header) |
| Carousel illustrations | `/banana batch` | Matched set of 4–10 images for a carousel, shared visual DNA |
| Iteration | `/banana edit` | Refine a generated image without re-prompting from scratch |
| Inspiration | `/banana inspire` | Browse 2,500+ reference prompts when the user is unsure what they want |

---

## Integration pattern

Before starting distillation, probe for each external skill and build a
capability map:

```js
const external = {
  marketingskills: detectPlugin('marketing-skills'),
  claudeBlog:      detectPlugin('claude-blog'),
  claudeSeo:       detectPlugin('claude-seo'),
  bananaClaude:    detectPlugin('banana-claude'),
};
```

`detectPlugin(name)` returns `true` if `~/.claude/plugins/<name>/` exists
OR the matching slash command is registered. In the Claude Code runtime,
the simplest check is whether `/blog`, `/seo`, `/banana`, or
`/marketing-*` commands are known to the current session. Fall back to
a filesystem check when in doubt.

When a skill is present, invoke its slash commands inline during the
relevant methodology step. When absent, inline-generate and log:

```
Missing external skill: claude-blog. Blog variant will use inline authoring.
To upgrade, install with:
  /plugin install claude-blog@AgriciDaniel-claude-blog
```

Output files are byte-identical in terms of structure whether or not the
external skill is installed — the difference is only in fidelity
(keyword-optimized vs. inline-generated, matched-DNA images vs. none).

---

## When NOT to install

Do not auto-install any of these skills. The user controls their plugin
set. When an external skill would meaningfully improve the current
campaign, say so once and let the user decide:

> I can generate matched hero images for all 4 variants if you install
> `banana-claude` — install with `/plugin install banana-claude@...`.
> Otherwise I'll use text-only cards. Which would you prefer?

Never block the workflow on an external skill. Content Factory always
produces a complete output even when every external skill is absent.
