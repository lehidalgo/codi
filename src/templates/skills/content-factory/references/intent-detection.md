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

## 2. Signals to present, not a decision to make alone

**The agent never decides anchor-first vs. fast-path unilaterally.** Every
new content request starts with the Step 1 workflow-choice prompt defined
in SKILL.md — the user picks A (default, full workflow), B (fast-path),
or C (delegate the pick to the agent, with confirmation before
proceeding).

Use the signals below to help the user choose during that conversation, or
— if the user selected C — to justify the pick you report back for
explicit confirmation before running Step 2 or Step 8.

Signals that point at **fast-path** (user is likely to pick B):

- Explicit one-off phrasing ("quick", "just", "simple", "real fast",
  "one tweet").
- Single small artifact request (one tweet, one story, one share card).
- User pastes full substance and wants pure formatting.

Signals that point at **anchor-first** (user is likely to pick A):

- Multiple formats named (campaign-style request).
- Topic requires argument construction (position piece, case study,
  manifesto).
- User plans to iterate, revise, or re-share.
- User expresses uncertainty about what they want — an anchor gives them
  something to react to.

Ambiguous signals are normal. Present the workflow-choice prompt anyway;
never pick silently. The prompt runs once, at the start — don't re-prompt
on every iteration unless the user expands scope.

---

## 3. Clarifying questions during intake (after the path is chosen)

After the user has picked option A or B in Step 1, ask clarifying questions
only when the answer materially changes the work:

- Topic is missing or vague enough that guessing would waste a round.
- Audience is unknown and the right audience would change the shape
  significantly (executive deck vs. engineering deep-dive).
- Format is ambiguous within the chosen path.
- The user seems uncertain and needs the question as a prompt to think.

Never ask more than one question at a time. A six-question questionnaire
kills momentum. If you need multiple pieces of information, gather them
conversationally across the first few turns rather than upfront.

**This section governs intake within a chosen path.** It does NOT authorize
the agent to skip the Step 1 workflow-choice prompt. That prompt is always
presented, even when the request looks obvious — the user makes the call,
not the agent.

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
- **Don't pick either path silently.** The Step 1 workflow-choice prompt
  is always presented. Even a "quick tweet about X" gets the prompt — the
  user will pick B in one word, but the choice is theirs to make.
- **Don't re-classify on every iteration.** The first-turn decision
  sticks unless the user explicitly expands scope ("actually, let's
  also make a deck") — at that point, re-present the workflow-choice
  prompt.
- **Don't treat one-off phrasing as authorization.** "Quick", "just",
  "real fast" are signals, not approvals. Surface the prompt; let the
  user pick B if that's what they want.

Anchor-first is the default the user will usually pick for non-trivial
work, and fast-path is the exception the user picks when speed matters
more than multi-format consistency. In both cases the user picks — not
the agent.
