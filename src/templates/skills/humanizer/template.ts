import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Remove AI writing patterns from generated content. Use when the user says
  text sounds robotic, formulaic, AI-generated, too formal, stiff, corporate,
  or "like ChatGPT / Claude". Also activate for phrases like "humanize
  this", "sounds too AI", "dehumanize AI content", "make this natural",
  "remove AI tells", "natural tone", "strip AI voice". Applies a two-pass
  rewrite against 29 documented AI patterns (vocabulary, structure, style,
  communication, filler) plus a Soul Check for substance and point-of-view.
  Do NOT activate for writing new content from scratch (use
  ${PROJECT_NAME}-content-factory), code comments (use
  ${PROJECT_NAME}-refactoring or direct edits), translation, or
  copy-editing for grammar only.
category: ${SKILL_CATEGORY.CONTENT_REFINEMENT}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 8
---

# {{name}} — Content Humanizer

## When to Activate

- User wants to remove AI writing patterns from text
- User says content sounds too formal, stiff, or robotic
- User asks to make content sound more natural or human
- User wants to post or publish content and it sounds AI-generated
- Another skill has finished generating content and asks the user if they want to humanize

## Skip When

- User wants to write new content from scratch — use ${PROJECT_NAME}-content-factory
- User wants to edit code comments — use ${PROJECT_NAME}-refactoring or direct edits
- User wants translation between languages
- User wants grammar-only copy-editing without stylistic rewriting
- The source text is already the user's own voice (not AI-generated)

## Step 1: Gather Input

**[CODING AGENT]** Accept the content to humanize in one of these forms:
- Text pasted directly in the message
- A file path (read the file)
- Ask the user to paste the content if nothing was provided

Also ask (or infer from context):
- What is this content for? (blog post, documentation, email, report, social post, etc.)
- Who is the intended reader?

## Step 2: Voice Calibration (Optional)

**[CODING AGENT]** Check \`references/voice-samples/\` for any \`.md\` or \`.txt\` files.

If samples exist:
- Read all files in the directory
- Analyze: sentence length distribution, punctuation habits (Oxford comma, em vs en dash, semicolons), formality level, use of first person, characteristic phrases, and rhythm
- Build a voice profile to apply during rewriting

If no samples exist:
- Ask: "Do you have 2-3 paragraphs of your own writing I can use to match your voice? (Optional — skip to use universal rules)"
- If the user provides samples, analyze them the same way
- If the user skips, proceed with universal rules only

> **To calibrate for your voice in future runs:** Save writing samples as \`.md\` or \`.txt\` files in \`.codi/skills/{{name}}/references/voice-samples/\`

## Step 3: Pass 1 — Pattern Detection & Rewrite

**[CODING AGENT]** Scan the content for these 29 AI writing patterns. For each pattern found, rewrite the affected text.

### Content Patterns (6)
1. **Significance inflation** — Treating every finding as groundbreaking. Rewrite to match actual importance.
2. **Overblown notability** — Claims like "X has become increasingly important" without evidence. Cut or ground with specifics.
3. **Superficial -ing analyses** — "By implementing X, organizations can achieve Y." Rewrite with direct cause-and-effect.
4. **Promotional language** — "Cutting-edge", "state-of-the-art", "revolutionary". Replace with factual descriptions.
5. **Vague attributions** — "Experts say", "studies show", "many believe". Name the source or remove the claim.
6. **Formulaic challenge sections** — "While X offers benefits, it also presents challenges such as…". Rewrite to be specific.

### Language Patterns (7)
7. **AI vocabulary** — Words overused by LLMs: *landscape*, *pivotal*, *underscore*, *testament*, *delve*, *tapestry*, *nuanced*, *comprehensive*, *robust*, *utilize*, *leverage* (as a verb). Replace with plain alternatives.
8. **Copula avoidance** — "serves as", "functions as", "acts as" instead of "is". Use "is" when that's what you mean.
9. **Negative parallelisms** — "not only X but also Y" constructions. Rewrite as direct statements.
10. **Rule-of-three forcing** — Padding to hit three items when one or two suffice. Cut the padding.
11. **Synonym cycling** — Using different words for the same concept to avoid repetition. Pick one term and stick with it.
12. **False ranges** — "anywhere from X to Y" when a single number is known. Use the specific number.
13. **Passive voice overuse** — Rewrite to active voice where the agent is known and relevant.

### Style Patterns (6)
14. **Em dash overuse** — More than one or two per page. Replace with commas, colons, or restructure.
15. **Excessive bold** — Bolding phrases that don't need emphasis. Remove bold except for genuinely critical terms.
16. **Inline-header lists** — "**Key benefits:** X, Y, Z" on the same line. Restructure as prose or a proper list.
17. **Title-case headings** — Capitalizing Every Word In Headings. Use sentence case.
18. **Emoji in professional content** — Remove unless the target platform (social media) expects them.
19. **Curly quotation marks in code/technical contexts** — Replace with straight quotes where appropriate.

### Communication Patterns (4)
20. **Chatbot pleasantries** — "I hope this helps!", "Feel free to ask!", "Certainly!". Cut these entirely.
21. **Knowledge-cutoff disclaimers** — "As of my training data…", "I cannot verify current…". Remove or rewrite as a factual caveat.
22. **Sycophantic opener** — "Great question!", "That's a fascinating topic". Cut.
23. **Excessive hedging** — "It's worth noting that", "It's important to mention", "One could argue". Cut the hedge, state the point.

### Filler & Hedging (6)
24. **Transitional padding** — "In conclusion", "To summarize", "In essence". Cut or rewrite the sentence without the opener.
25. **Meta-commentary** — "This section will explore…", "We have examined…". Start with the content, not the commentary about content.
26. **Generic conclusions** — "The future of X is bright", "X continues to evolve". Rewrite with a specific, useful takeaway.
27. **Qualifiers on obvious statements** — "It is generally accepted that water is wet." Remove the qualifier.
28. **Over-explanation** — Restating the same point three times at different levels of detail. Keep the clearest version, cut the rest.
29. **Unnecessary context-setting** — Opening paragraphs that explain what the reader already knows. Cut to the first sentence that adds value.

After rewriting, produce the revised text.

## Step 4: Pass 2 — Anti-AI Audit

**[CODING AGENT]** Read the revised text and ask yourself: "What still makes this obviously AI-generated?"

Check for:
- Does every sentence start with a different structure, or do they follow the same subject-verb-object rhythm?
- Does the text have any opinions, or is it relentlessly neutral?
- Are there any specific details (numbers, names, dates, anecdotes), or is it all generic?
- Does the text ever acknowledge complexity, trade-offs, or uncertainty in a human way?
- Is there any personality — humor, frustration, enthusiasm — or is it uniformly polished?

Apply a second round of edits to address remaining tells.

## Step 5: Soul Check

**[CODING AGENT]** Before finalizing, verify the rewritten text has substance:

- At least one concrete, specific detail (not just abstract claims)
- At least one sentence with a clear point of view or stance
- Varied sentence lengths — mix of short punchy sentences and longer ones
- First-person voice where appropriate and not forced
- If voice samples were used: cross-check that the output matches the user's style profile

If the text passes as clean but feels soulless, add one or two specific details or opinions based on the content's actual substance.

## Step 6: Output

**[CODING AGENT]** Present:
1. The humanized text (in a code block or clearly delimited)
2. A brief summary: how many patterns were found by category and the most impactful changes made
3. If writing to a file: confirm the file was updated

If the user wants to iterate, accept feedback and revise — do not restart the full process.

## Related Skills

- **${PROJECT_NAME}-content-factory** — Generate blog posts, social content, slide decks, and branded business documents (includes opt-in humanizer step)
- **${PROJECT_NAME}-project-documentation** — Write technical documentation (includes opt-in humanizer step)
`;
