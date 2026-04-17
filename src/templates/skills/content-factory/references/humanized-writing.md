# Humanized Writing — Anti-AI-Sounding Techniques

Every variant Content Factory emits has to pass the sniff test of a human
reader who has read a thousand AI-generated posts this year. Writing that
sounds AI-generated gets throttled by LinkedIn, X, Reddit, and most
newsletter platforms; it loses 40-70% of organic reach; and it erodes
the brand voice the user trusted you to carry.

This reference is the de-robotization layer. Apply it after the plan is
approved and before the HTML is rendered. If the `humanizer` external
skill is installed (see `[[/references/external-skills.md]]`), run that;
if not, the rules below are the manual fallback.

---

## 1. The five AI tells that matter most

Detector-agnostic linguistic markers — these hold regardless of which
tool is scoring the text.

### Tell 1 — Uniform sentence length and rhythm

AI output tends toward 18-22 word sentences stacked with minor variance.
Human prose swings between 4-word punches and 32-word winding
observations. Even just one 4-word sentence in a paragraph cracks the
rhythm enough that the whole block reads human.

> **Before:** "We have optimized our pipeline to deliver exceptional
> results for our customers. This approach has proven effective across
> multiple industries and use cases."
>
> **After:** "The pipeline moves faster now. Three hundred percent
> faster, actually, though the number hides a more important shift: the
> team stopped pretending reliability was optional."

### Tell 2 — Hedge phrases and meta-commentary

AI softens claims with "it's worth noting," "in today's fast-paced
world," "when it comes to," "at the end of the day," "in conclusion,"
"moreover," "furthermore," "however it is important to note that." These
are dead phrases. Cut them; no replacement needed.

### Tell 3 — Triple structures and empty parallelism

AI loves "X, Y, and Z" rhythms where the three items are near-synonyms
("innovative, cutting-edge, and state-of-the-art"). Humans either pick
one precise word or break the parallelism.

> **Before:** "Streamline, optimize, and enhance your workflow."
>
> **After:** "Cut three steps out of your workflow."

### Tell 4 — "Paint-by-numbers" transitions

"First, …", "Next, …", "Finally, …" as paragraph openers. Humans rarely
hold the reader's hand like that. Strip numbered-step transitions from
prose (keep them only in explicit tutorial steps or checklists).

### Tell 5 — Vocabulary drift toward the thesaurus

AI reaches for the elevated synonym: "utilize" instead of "use,"
"leverage" instead of "use," "facilitate" instead of "help,"
"individuals" instead of "people," "robust" instead of "solid." One or
two occurrences read fine. Three or more in a paragraph screams AI.

---

## 2. Words to cut on sight

Banned without exception (replace or delete):

| AI word | Replace with |
|---------|--------------|
| utilize · leverage · facilitate | use · help |
| in today's fast-paced world | (delete entirely; never a true premise) |
| delve into · dive deep into | explore · look at · (often just delete) |
| it is important to note · it's worth mentioning | (delete; assert directly) |
| moreover · furthermore · additionally | (start a new sentence instead) |
| seamless · seamlessly · comprehensive · holistic · cutting-edge | a specific attribute |
| elevate · empower · unlock | a concrete verb |
| navigate (as metaphor) | move through · handle · deal with |
| at the end of the day · when all is said and done | (delete) |
| a myriad of · a plethora of | many · several · (a number) |
| landscape (as in "the marketing landscape") | the market · the field · (delete) |
| journey (as in "your weight-loss journey") | (delete; use the specific activity) |
| game-changer · transformative · revolutionary | a concrete before/after |

Words to use sparingly (fine in moderation, red flag when clustered):
"innovative," "robust," "scalable," "dynamic," "proactive," "synergy."

---

## 3. Techniques that humanize

### Specificity over abstraction

Every adjective is a gamble; every named thing is a win. "Three million
users" is stronger than "large user base." "Six-inch pencil" is stronger
than "useful tool." Replace abstract nouns with concrete examples.

### Shorter plus longer, alternating

Write one short sentence (under 8 words), then one medium, then one
winding. Repeat. Sentence-length variance is the #1 signal of human
rhythm.

### Idioms used WRONG or REVIVED

Humans mash idioms: "biting off more than you can walk." They revive
dead ones. AI uses idioms textbook-correctly. A slightly off idiom reads
more human than a perfect one.

### Opinion with a named stake

A human writes "I think X because Y" or "we learned X the hard way after
Z happened to us in 2024." AI writes "many believe" or "it is widely
understood." Name a source or stake.

### Contractions and contractions-inside-contractions

AI often writes out "do not," "it is," "cannot." Humans contract
aggressively: "it's," "don't," "can't," "I'd've," "y'know." Use them in
conversational variants (LinkedIn posts, tweets, IG captions). Skip
contractions only for formal business documents.

### Fragment sentences. When they work.

Strategic fragments. Used sparingly. Break the grammar rule deliberately.
One or two per 500 words.

### Direct address and second-person

"You already know this" lands harder than "readers will be aware that."
Most platforms reward the second person; AI defaults to third.

---

## 4. Per-platform AI tolerance

| Platform | Tolerance | Specifics |
|----------|-----------|-----------|
| LinkedIn | **Very low** (2026) | AI-signal posts get demoted. Humanizer pass mandatory. Em-dash paragraphs with perfect spelling are an AI tell unto themselves |
| Twitter / X | **Very low** | Short-form exposes AI rhythm faster than long form. A single "it is important to note" in a tweet costs it |
| Instagram (caption) | Low | Hashtag-heavy text masks some AI signal, but the first line must sound human |
| TikTok (caption) | Medium | Audience is more forgiving IF the video is authentic; but TikTok captions should read like a friend texting |
| Facebook | Medium | Older demographic notices formality over AI-ness; pass if readable |
| Blog / long-form | Medium | AI signal is less punished on blogs IF the post has specific data and named sources |
| Slide deck | Medium-high tolerance | Slides are already terse; AI rhythm matters less. Voice still matters on cover + CTA slides |
| A4 document / report | High | Formal docs ARE supposed to sound uniform. Minimize humanization beyond cutting banned words |

---

## 5. The pass itself — a concrete checklist

Before setting `status: approved` on a plan, run the variant through
this checklist:

- [ ] Every banned word removed or replaced
- [ ] At least one sentence under 8 words in each paragraph
- [ ] At least one sentence over 25 words per 300 words of body
- [ ] No paragraph uses "First/Next/Finally" as openers
- [ ] No triple-synonym structures ("innovative, cutting-edge, best-in-class")
- [ ] At least one specific number, named person, or dated event per 200 words
- [ ] Contractions used where tone allows
- [ ] No "it is important to note," "moreover," "furthermore," "in conclusion"
- [ ] Hooks and CTAs use direct address (you / we / I)
- [ ] The opening line passes the "would a human actually type this" test out loud

Ship only when every box is checked. If the `humanizer` external skill
is installed, run it AFTER this manual pass for a second layer — the
two catches are complementary, not redundant.

---

## 6. What NOT to do in the humanization pass

- **Do not add typos.** "Authentic typos" are a trick that doesn't work
  — platforms strip or auto-correct, and it reads as careless to the
  reader.
- **Do not swap every word for a synonym.** Synonym-swapping is the
  most-detected "humanization" pattern. It replaces AI cadence with
  weirdo cadence.
- **Do not invent data or quotes.** Humanization is about rhythm and
  word choice, not fabrication.
- **Do not strip all formality.** Business documents and reports are
  supposed to read formally. Humanization ≠ casualization.

---

## 7. Before-and-after reference examples

### LinkedIn carousel slide — from AI to human

> **Before:** "In today's rapidly evolving digital landscape, it is
> important to note that businesses must leverage innovative, cutting-edge
> solutions to streamline their workflows and unlock transformative
> results for their teams and customers."
>
> **After:** "Your team already knows the five tools you ship with. What
> they don't know is why the CEO keeps bringing up a sixth one in
> planning. Spoiler: nobody tested it. Here's what happened when we
> did."

### Twitter post — same move

> **Before:** "Streamline, optimize, and enhance your workflow with our
> revolutionary new platform that delivers seamless integration and
> robust performance."
>
> **After:** "We rewrote the deploy pipeline over a weekend. It's twice
> as fast now. The old one was not well."

### Blog intro — same move

> **Before:** "Delving into the complexities of modern content strategy
> can feel overwhelming. However, by following these comprehensive best
> practices, you can navigate the landscape effectively."
>
> **After:** "Most content strategy advice assumes you have six months
> and a team. You don't. Here's what to do this Friday if all you have
> is a blog, a calendar, and forty-five minutes."
