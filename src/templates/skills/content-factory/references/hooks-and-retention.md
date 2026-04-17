# Hooks & Retention

The first line of every variant is the only line most viewers read. If
the hook fails, the rest of the asset is invisible. This reference
consolidates hook formulas, anti-patterns, and platform-specific
retention rules that were previously scattered across seven platform
playbooks.

---

## 1. The hook job description

A hook must do three things in under three seconds of reading / viewing:

1. **Promise** a specific payoff the reader will get if they continue.
2. **Surprise** or contradict an expectation so the brain doesn't scroll.
3. **Address the reader directly** — second person beats third.

Any hook missing #1 is decoration. Any hook missing #2 is generic. Any
hook missing #3 is a headline, not a hook.

---

## 2. Ten hook archetypes that work in 2026

Each archetype ships with a structure and a worked example. Use one per
variant; never stack two hook archetypes in the same opening line.

### Archetype 1 — The contrarian claim

*Structure:* "Everyone says X. They're wrong. Here's what actually works."

> "Everyone tells you to wake up at 5am. Nobody who does it is happy. I
> tried it for a year and quit when I realized why."

### Archetype 2 — The specific number

*Structure:* "[Surprising number] + [concrete noun] + [implied consequence]."

> "Five agents. Five config files. Five drifts per quarter."

### Archetype 3 — The named moment

*Structure:* "[Specific date/place/name]: [unexpected event] happened.
Here's what we learned."

> "March 2024. Our deploy pipeline died at 2am the night before a
> launch. The fix took four lines of code and six months to find."

### Archetype 4 — The open loop

*Structure:* "I used to think X. Then Y happened. Now I [specific
change]."

> "I used to think rules were bureaucracy. Then I joined a team that
> didn't have any."

### Archetype 5 — The bracketed question

*Structure:* "[Thing most people assume] — is that actually true?"

> "Two developers, two AI assistants, two completely different outputs
> from the same prompt. Same company. Same codebase. Same day. Why?"

### Archetype 6 — The visible metric

*Structure:* "[Before state] → [after state]. Here's the one thing
that made the difference."

> "10-minute deploys → 90-second deploys. We didn't add hardware."

### Archetype 7 — The forbidden admission

*Structure:* "[Thing you're not supposed to say in your industry]."

> "Our first onboarding flow was bad. Like, measurably bad. Only 40%
> of trial signups reached day 2."

### Archetype 8 — The list promise

*Structure:* "[Number] [thing] that [specific benefit]. Number [X] is
the one nobody uses."

> "Four writing tricks that make your blog read human. Number 3 is the
> one every AI detector misses."

### Archetype 9 — The quoted observation

*Structure:* "'[Short quote from a specific source].' — [person/role].
Here's why that matters."

> "'I can't tell which agent wrote which config.' — our staff engineer,
> six months after we picked our fifth AI tool. Codi fixed that."

### Archetype 10 — The inside-baseball reveal

*Structure:* "[Thing insiders know, outsiders don't]."

> "Every senior engineer eventually builds the same internal doc. It
> never ships outside the company. Here's what's in it."

---

## 3. Hook anti-patterns — never open with these

| Anti-pattern | Why it fails |
|--------------|--------------|
| "Have you ever wondered…" | Begs for attention; loses it |
| "In today's fast-paced world…" | Dead premise; signals AI |
| "Let me tell you a story…" | Wastes the one line the reader will actually read |
| "Many people believe…" | Hedged; no stake |
| Questions with obvious yes/no answers | Reader answers internally and scrolls |
| Setup without promise ("Last week something happened") | No reason to keep reading |
| Generic superlatives ("the best X ever") | Ignored by default |
| Emoji-only openers | Read as noise on most platforms |
| Hashtag-stacked openers | Read as spam |
| "This is [blank]" openers ("This is huge") | No information content |

---

## 4. Platform length and format rules

Hooks are constrained by where the reader sees the first line before
deciding to continue.

| Platform | Hook budget | Cut-off trigger |
|----------|-------------|-----------------|
| LinkedIn post | ~210 chars before "…see more" | The first line is the whole hook. No line break before it |
| LinkedIn carousel slide 01 | ~8 words at largest scale | Big type forces brevity |
| Instagram feed caption | ~125 chars before "…more" | First line only |
| Instagram carousel slide 01 | 6-10 words | Visual-dominant; headline is the hook |
| Instagram story | 10 words (full screen) | Top 20% is UI; keep hook in middle third |
| TikTok cover frame | 3-6 words | Competes in 3-up profile grid |
| TikTok caption | 80 chars before expand | Stop at 80 |
| X / Twitter tweet | ≤260 chars (with URL budget) | Single tweet IS the hook |
| X thread slot 01 | Add "🧵" or "1/" — promise a payoff | The thread promise is itself the hook |
| Facebook post | ~200 chars before expand | Similar to LinkedIn |
| Blog h1 | 8-14 words | Lives in the browser tab + SERP |
| Blog first sentence | Under 20 words | Mobile readers bounce past long openers |
| Slide deck cover | 5-9 words | Presenter says the longer version aloud |

---

## 5. Retention — what keeps the reader past the hook

The hook gets the first second. Retention fights for the next thirty.

### Retention tactic 1 — Open loops

A loop is a question, mystery, or consequence introduced but not yet
resolved. Each paragraph should close a small loop AND open a new one.
The reader stays because something unresolved pulls them forward.

> "We fired our first agent tool in Q2. The reason wasn't performance."

(Closed loop: we fired it. Open loop: why?)

### Retention tactic 2 — Scannable beats

On mobile, readers scroll. Give them a reason to stop on each scroll:
- A bolded claim
- A short line after a long paragraph
- A pull-quote
- A table row
- A numbered marker

One stop-beat per 150 words of body.

### Retention tactic 3 — The specific benefit restatement

Every 300 words, restate what the reader gets if they finish. Not a
reminder of the topic — a reminder of the payoff.

> "You'll know by the end of this post whether your deploy is worth
> rewriting or worth deleting."

### Retention tactic 4 — Pattern interrupts

Break the pattern the reader has settled into:
- A single-sentence paragraph after three long ones
- A list after five paragraphs of prose
- An em-dash aside
- A direct quote

One pattern interrupt per 400 words.

### Retention tactic 5 — Accountability markers

"Before I show you the fix, let me tell you what didn't work." This
promises a next section AND pre-validates the author as someone who
tried hard. Readers stay through the "didn't work" section.

---

## 6. Retention by format

| Format | Retention unit | What drops retention |
|--------|----------------|---------------------|
| Social carousel | Slide transition | A slide without a new payoff; a slide that repeats slide 1's point |
| Slide deck | Slide transition + presenter | Dense slides forcing the audience to read instead of listen |
| Blog post | Scroll-past-fold | Long hero image, lede paragraph >3 sentences, table of contents burying the thesis |
| Long anchor | Section break | Walls of text with no heading for 400+ words |
| Tweet thread | Tweet 1→2 drop-off | Tweet 1 that doesn't promise a payoff for tweet 2 |
| Reel cover | Cover-to-play | Cover that over-explains before the video starts |
| Email | Preview line + subject | Subject that doesn't match the payoff |

Rule of thumb: every unit of content (slide, paragraph, tweet) should
either CLOSE a loop, OPEN a loop, or DELIVER the payoff. If a unit does
none of the three, cut it.

---

## 7. The hook pass — a plan-time checklist

Before setting `status: approved` on a plan, confirm:

- [ ] Hook uses one of the 10 archetypes explicitly
- [ ] Hook contains at least one specific number, name, date, or quote
- [ ] Hook addresses the reader directly (you / we / I)
- [ ] Hook is within the platform's length budget (see table §4)
- [ ] No anti-pattern opener (§3)
- [ ] The penultimate unit introduces the CTA setup; the final unit delivers it
- [ ] Stop-beat inventory: ≥1 pattern interrupt per 400 body words
- [ ] Specific-benefit restatement present in anchor and blog variants

If the variant is a full campaign, hooks across variants should feel
connected but not identical — the same anchor should seed distinct
hooks per platform, not a single hook reused everywhere.
