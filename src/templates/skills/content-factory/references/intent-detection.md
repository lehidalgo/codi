# Intent Detection

How to read a content request and decide what to do. Signals, not
phrases. Judgment, not a table.

Read this at the start of every new content request. The decision
shapes whether you go anchor-first or fast-path, which formats to
produce, and how much intake you need before authoring.

---

## 1. Signals the agent reads

Five signals come together into a decision.

### 1.1 What was said

The literal request. Which formats were named? What topic? Any
modifiers ("quick", "polished", "pitch-ready", "campaign")? Any
audience hints ("for execs", "for engineers", "internal")?

### 1.2 What was omitted

What's missing that a typical request of this shape would include?
Missing topic → probably wants you to propose one. Missing format →
probably wants you to recommend one. Missing audience → use a
sensible default for the format and mention your choice.

### 1.3 Topic complexity

A topic that needs argument (a position piece, a case study, a
manifesto) benefits from an anchor. A topic that's self-contained (a
product announcement, a single data point) often doesn't. Prose-first
helps most when the content is carrying an argument.

### 1.4 Format count

One format is often a fast-path candidate, especially if it's small
(tweet, single card, one story). Multiple formats almost always
warrant an anchor — consistency across variants is the whole point.

### 1.5 Context from the project state

Does `/api/state` show an existing anchor? Is there a brief already?
Is the user iterating on something or starting fresh? Prior state
usually answers questions you'd otherwise ask.

---

## 2. The decision

Anchor-first or fast-path is a judgment call. Some patterns that
usually resolve it:

- **Fast-path** when the user explicitly signals one-off ("quick",
  "just", "simple", "real fast", "one tweet"), when the request is a
  single small artifact, when the user pastes full substance and wants
  pure formatting.
- **Anchor-first** when the user names multiple formats, when the
  topic needs argument construction, when the content will be iterated
  on, when the user is uncertain what they want.
- **Ambiguous** when the signals pull in different directions.
  Default to anchor-first with an explicit offer to skip: "I can draft
  a quick article first so every format tells the same story, or skip
  straight to the [format] — which?"

Ask once, at the start. Don't re-prompt on every iteration.

---

## 3. When to ask, when to proceed

Ask a clarifying question when the answer materially changes the work:

- Topic is missing or vague enough that guessing would waste a round.
- Audience is unknown and the right audience would change the shape
  significantly (executive deck vs. engineering deep-dive).
- Format is ambiguous ("make content about X" with no format named).
- The user seems uncertain and needs the question as a prompt to think.

Proceed without asking when:

- The request is clear enough that a reasonable default won't be wrong.
- Prior project state answers the question.
- The cost of being wrong is low (you can fix on iteration).

Never ask more than one question at a time. A six-question
questionnaire kills momentum. If you need multiple pieces of
information, gather them conversationally across the first few turns
rather than upfront.

---

## 4. Multi-format detection

A user who says "launch a campaign about X" or "I need a blog, a deck,
and a LinkedIn post" has implied an anchor-first multi-format
workflow. Even if they don't use the word "campaign" — mentioning two
or more platforms or formats is enough.

Infer the variant set from what was named, and ask about adding
obvious missing ones only when they'd make the campaign noticeably
better ("You mentioned a deck and a blog post — want an Instagram
carousel to match? Say skip if not.").

---

## 5. Bring-your-own-anchor

When the user pastes content, links an article, or says "turn this
into X", they've provided the substance. Skip intake and anchor
authoring. Go straight to distillation.

Before distilling, read the source carefully. If it has clear section
structure, preserve it as anchor-style semantic tagging. If it doesn't,
skim for thesis, points, evidence, CTA — the agent reconstructs the
semantic markers during distillation.

If the source is too thin to distill well (a single paragraph
expanding into a 15-slide deck is a red flag), tell the user:
"This is short for a deck — want me to expand it into an article
first, or compress to a single card?"

---

## 6. What not to do

- **Don't run a fixed questionnaire.** Ask what you actually need; skip
  what you don't.
- **Don't force anchor-first on clearly trivial requests.** "Quick
  tweet about X" becomes a single tweet, not a campaign.
- **Don't re-classify on every iteration.** The first-turn decision
  sticks unless the user explicitly expands scope ("actually, let's
  also make a deck").
- **Don't pick the anchor-first branch silently when the user expected
  fast-path.** If the answer's ambiguous, ask once.

The goal is speed without cutting corners. Anchor-first is the default
for non-trivial work because it produces better content; fast-path is
the exception that stays fast when speed matters more than
multi-format consistency.
