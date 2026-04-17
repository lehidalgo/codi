# Blog — Platform Playbook

One variant lives under `content/blog/`:

| Plan (Markdown) | Rendered HTML | Format | Canvas | Card wrapper |
|-----------------|---------------|--------|--------|--------------|
| `post.md` | `post.html` | Long-form blog post | 1240×1754 (A4) | `<article class="doc-page">` |

**Plan-first pipeline.** The blog plan is the longest of any platform
plan — it essentially IS the blog, expressed as prose. Iterate with the
user on outline, headings, pull quotes, and CTA before rendering
`post.html`. See `[[/references/plan-authoring.md]]`.

---

## post.html — Blog post

**Audience mode:** Intentional readers who clicked through from a social
link or search. They want the full argument, not a skimmable summary.

### Distinction vs. the anchor

The anchor is Markdown. The blog variant is an HTML document intended
for either:
- Export as `.docx` / `.pdf` and pasted into a blog CMS, or
- Direct paste into a CMS that accepts HTML

The blog post should be a near-verbatim expansion of the anchor with
blog-specific additions:

- **Structured heading tree** — blog CMS rendering needs H1 → H2 → H3
  with no skips
- **A table of contents** (generated from H2s) after the intro
- **Pull quotes** on key claims (turns into blockquote-styled spans)
- **Reference links** for every statistic and external claim
- **Author bio block** at the bottom
- **Related posts placeholder** (the CMS fills this)

### Structure

| Slide/section | Role | Source |
|---------------|------|--------|
| Header page | Title + subtitle + author + date + reading-time estimate | Anchor frontmatter |
| Intro page | Hook + thesis statement + TOC | Anchor hook + problem section |
| Body pages | One page per anchor H2, expanded to full paragraphs | Anchor body |
| Synthesis page | What this means + key takeaways (3–5 bullets) | Anchor synthesis |
| CTA page | Call to action + author bio + related content placeholder | Anchor CTA |

### SEO integration

If `claude-seo` is installed:
- Before export: run `/seo content` on `post.html` to check keyword
  coverage against the target topic
- Generate schema markup via `/seo schema` — the result is a
  `<script type="application/ld+json">` block appended to the page head
- Pre-publish: `/seo audit <url>` once the post is live

If `claude-seo` is absent: inline-generate a basic Article+BlogPosting
JSON-LD block using the anchor frontmatter + the canonical URL the user
provides.

### Blog-specific density rules

Unlike social cards, blog pages do not need to fill 85% of canvas. The
A4 document constraint matches print conventions: generous margins
(~72px padding), comfortable line-height (1.65–1.7), one column of
measured body text (~65ch max line length).

### Word count targets by anchor length class

| Anchor `length_class` | Target blog word count |
|-----------------------|------------------------|
| short | 600–900 |
| standard (default) | 1400–2000 |
| deep | 3000–5000 |

The blog post is typically 20–30% longer than the anchor because it
expands telegraphic anchor phrasing into full blog prose, adds
transitions, and includes reference citations.
