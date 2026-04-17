# Slide Deck — Platform Playbook

One variant lives under `content/deck/`:

| Plan (Markdown) | Rendered HTML | Format | Canvas | Card wrapper |
|-----------------|---------------|--------|--------|--------------|
| `slides.md` | `slides.html` | 16:9 slide deck | 1280×720 | `<article class="slide">` |

**Plan-first pipeline.** Write one `## Slide NN` block per deck slide
in `slides.md`. Include speaker-notes intent in the plan (not the final
HTML comments — those come at render time). Iterate with the user,
then render `slides.html`. See `[[/references/plan-authoring.md]]`.

---

## slides.html — Slide deck

**Audience mode:** Presentations — webinars, internal shares, investor
updates, conference talks. The viewer is captive (watching a
presentation) but can't skim; pacing matters more than per-slide density.

### Structure — default 8–12 slide summary deck

| Slide | Role | Content |
|-------|------|---------|
| 01 | Cover | Title + subtitle + author + date |
| 02 | Agenda / outline | 3–5 items from anchor H2s, no more |
| 03 | Problem | Single statement of the thesis |
| 04–N−2 | Points | One H2 per slide, title + 2-column body OR title + one chart |
| N−1 | Takeaway | "3 things to remember" as 3 stacked items |
| N | CTA | Contact / link / "questions?" |

For deep anchors, scale up to 15–20 slides by splitting dense points
across 2 slides (title + evidence, then worked example).

### Density rules

Decks use a different density philosophy from social cards:

- **Breathing room:** A slide with 40–60% fill is correct for a talk
  where the presenter speaks over visuals. Social-card 85% fill does
  not apply
- **One idea per slide:** The hardest rule. If a slide has two points,
  split it
- **Type hierarchy:** Title (large), supporting heading (medium), body
  (small). Max 3 scales per slide
- **No paragraphs:** Deck bodies are bullets or single lines. Anything
  longer belongs in the speaker notes, not the slide

### Speaker notes

If the user is presenting this deck, generate speaker notes as HTML
comments below each slide's body. Example:

```html
<article class="slide" data-type="point" data-index="04">
  <h2>Keep your rules in one file</h2>
  <ul>
    <li>One source of truth</li>
    <li>Five agents, zero drift</li>
  </ul>
  <!--
    SPEAKER NOTES:
    Mention the drift incident from last quarter. Reference the
    config-fragmentation table from the blog post. Time: ~90s.
  -->
</article>
```

### Motion and animation

The deck engine supports staggered entrance animations on
`.animate-in` children. Use sparingly — a deck with motion on every
slide feels amateurish. Apply to:
- Cover slide elements (title fades in, subtitle follows)
- A single emphasized element on the takeaway slide
- The CTA

See `[[/references/slide-deck-engine.md]]` for the animation contract.

### Export target

Decks export to **PPTX** for Keynote/PowerPoint compatibility. See the
codi-pptx skill for direct .pptx editing. PDF export is also available.
