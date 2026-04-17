# Copywriting Formulas

The seven battle-tested structures used to organize persuasive prose.
Every Content Factory variant that has to sell, teach, or change a
reader's mind should map to one of them. Formulas are planning tools —
you pick one BEFORE you write the first line, not after.

---

## 1. How to pick a formula

Match the formula to the reader's starting state:

| Reader starts feeling | Use |
|-----------------------|-----|
| Unaware there is a problem | AIDA |
| Aware of a problem but not the pain | PAS |
| Skeptical / happy with status quo | BAB |
| Ready to buy but shopping | 4Ps |
| Time-crunched, needs the TL;DR | 1-2-3-4 |
| Needs justification for a decision | 4Us |
| Feature-focused (B2B, technical) | FAB |

One formula per variant. Never stack two — the reader loses the thread.

---

## 2. AIDA — Attention, Interest, Desire, Action

The oldest, still the strongest default for cold audiences.

| Slot | Purpose | Length |
|------|---------|--------|
| Attention | Hook (see `[[/references/hooks-and-retention.md]]`) | 1 sentence or 1 slide |
| Interest | Specific detail that makes the hook credible | 2-4 sentences / 1-2 slides |
| Desire | The payoff the reader will get, stated concretely | 2-4 sentences / 1-2 slides |
| Action | Single CTA — one verb, one destination | 1 sentence / 1 slide |

**When to use:** Cold-audience social posts (LinkedIn feed post, X tweet,
IG single), landing page hero sections, cold email first touch.

**Worked example (LinkedIn post):**

> **A:** Your team writes rules in five different config files.
>
> **I:** Claude Code reads CLAUDE.md. Cursor reads .cursorrules. Every
> new agent adds another format. We measured it at a 40-person shop: 180
> minutes a week spent propagating a single rule change.
>
> **D:** Codi writes each rule once and generates every agent's native
> format. One PR, five agents updated, zero drift.
>
> **A:** Install Codi: `npm i -g codi-cli` → `codi init`. Done.

---

## 3. PAS — Problem, Agitate, Solve

Best when the reader knows they have a problem but hasn't felt the
cost. PAS makes the cost concrete.

| Slot | Purpose |
|------|---------|
| Problem | Name the specific, observable problem |
| Agitate | Show the cost — time, money, morale, opportunity — in concrete numbers |
| Solve | Present the fix as the obvious next move |

**When to use:** Mid-funnel blog posts, sales-enablement one-pagers,
churn-prevention emails, demo request CTAs.

**Worked example (Instagram carousel slide 02-04):**

> **P:** "Your agents can't agree on your own coding standards."
>
> **A:** "Every time a new engineer joins, they re-teach the standards
> to each AI tool. That's three hours of onboarding that isn't teaching
> them your codebase. We surveyed 200 engineering teams. The median
> team re-teaches their AI tools twice a quarter."
>
> **S:** "One `.codi/` folder. Every agent reads the same source. New
> engineer clones the repo, AI tools are already aligned."

---

## 4. BAB — Before, After, Bridge

Best for skeptical audiences. Show the two states; the bridge is how
they get from one to the other.

| Slot | Purpose |
|------|---------|
| Before | The reader's current reality — observable, specific, uncomfortable |
| After | The post-solution reality — observable, specific, desirable |
| Bridge | The mechanism that gets them from Before to After |

**When to use:** Testimonial-heavy content, case studies, founder
letters, product launch announcements.

**Worked example (blog intro):**

> **B:** "Last quarter we shipped 40 features. Eleven of them had
> rollback commits the next day. We blamed the test suite. It wasn't
> the test suite."
>
> **A:** "This quarter: 52 features shipped, two rollbacks. Same team,
> same tests."
>
> **Bridge:** "We stopped letting the AI assistant generate tests without
> human review. Here's what that process looks like."

---

## 5. 4Ps — Promise, Picture, Proof, Push

The long-form version of AIDA. Better for landing pages and sales
emails because it front-loads the promise.

| Slot | Purpose |
|------|---------|
| Promise | The single specific payoff |
| Picture | Paint the reader already living in the post-purchase reality |
| Proof | Named evidence — data, testimonials, credentialed sources |
| Push | CTA with the single next action |

**When to use:** Landing pages, product announcement emails, sales
pages, conference proposals.

---

## 6. 1-2-3-4 — The explainer formula

For teaching an idea that doesn't need emotional buildup.

| Slot | Purpose |
|------|---------|
| 1 — What you want | The reader's goal, stated plainly |
| 2 — Why it matters | The cost of not doing it |
| 3 — What makes you different | Why THIS approach beats the obvious one |
| 4 — What to do next | Single action |

**When to use:** Tutorial blog posts, developer docs, technical
announcements, internal communications.

**Worked example (deck slide sequence):**

> **1:** "You want your coding standards to be enforced automatically
> across every AI tool your team uses."
>
> **2:** "Manual enforcement fails. Drift creeps in every sprint."
>
> **3:** "Codi is the only tool that generates native config files per
> agent from a single source — not a wrapper, not a proxy."
>
> **4:** "Install it before your next sprint: codi init."

---

## 7. 4Us — Useful, Urgent, Unique, Ultra-specific

Headline and subject-line discipline. Every headline should score on
all four.

| U | Question to ask |
|---|-----------------|
| Useful | Does the reader get something if they click? |
| Urgent | Why now, not next week? |
| Unique | What's different about this vs the ten other similar posts? |
| Ultra-specific | Is there a number, name, or date that proves this isn't generic? |

**Use as a scoring rubric** on every headline + hook. Score each U on
0-2 (no / partial / yes). Total ≥ 6 before shipping. Below 6, rewrite.

**Worked example:**

Headline: "How to ship faster."
- Useful: 1 (yes, but generic)
- Urgent: 0 (no reason to read now)
- Unique: 0 (every blog says this)
- Ultra-specific: 0 (no numbers)
- **Total: 1 — rewrite.**

Rewrite: "How we cut deploy time from 10 minutes to 90 seconds — with
four lines of config, not a new CI vendor."
- Useful: 2 · Urgent: 1 · Unique: 2 · Ultra-specific: 2 — **Total: 7 —
  ship.**

---

## 8. FAB — Features, Advantages, Benefits

For feature-dense B2B/technical content. Each product capability gets
mapped to what it is, what it does, and what the reader gets.

| Slot | Purpose |
|------|---------|
| Feature | The concrete thing that exists |
| Advantage | What it does differently from alternatives |
| Benefit | What the reader's life looks like because of it |

**When to use:** Feature announcements, product pages, comparison
tables, internal sales decks.

**Worked example:**

> **Feature:** "Codi writes one .codi/ folder per project."
>
> **Advantage:** "Every supported agent (Claude Code, Cursor, Copilot,
> Codex, Continue) reads from this single source; rules don't need to
> be duplicated per tool."
>
> **Benefit:** "A new engineer clones the repo and their AI agent is
> already aligned with the team's standards. Zero onboarding time lost
> on tool setup."

---

## 9. Formula-to-variant mapping (defaults)

When the plan doesn't specify, default to these:

| Variant | Default formula |
|---------|----------------|
| LinkedIn carousel | AIDA or PAS |
| LinkedIn single post | AIDA |
| Instagram feed carousel | PAS or BAB |
| Instagram story | AIDA (collapsed to 1 frame) |
| IG / TikTok / FB reel cover | Just the "A" of AIDA — the hook |
| Twitter / X single tweet | AIDA collapsed to 1 sentence |
| Twitter / X thread | 4Ps or 1-2-3-4 |
| Blog post | 4Ps (commercial) or 1-2-3-4 (technical) |
| Slide deck | 1-2-3-4 |
| Business document (report) | BAB or 4Ps |
| Business document (one-pager) | 4Ps |
| Email — cold | AIDA |
| Email — nurture | PAS |
| Email — launch | 4Ps |

Override the default when the reader-state rubric in §1 suggests a
different match.

---

## 10. The formula pass — a plan-time checklist

Before setting `status: approved`:

- [ ] Plan frontmatter names the formula used (e.g. `formula: AIDA`)
- [ ] Each plan section maps to one formula slot
- [ ] No two formulas stacked in the same variant
- [ ] Headline scored ≥ 6 on the 4Us rubric
- [ ] CTA is a single verb + single destination
- [ ] Formula matches the reader's starting state (see §1)

If the formula doesn't fit, change the formula before you change the
content.
