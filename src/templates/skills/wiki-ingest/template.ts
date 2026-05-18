import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: "Ingest sources into the Obsidian wiki vault. Reads a source, extracts entities and concepts, creates or updates wiki pages, cross-references, and logs the operation. Supports files, URLs, and batch mode. Triggers on: ingest, process this source, add this to the wiki, read and file this, batch ingest, ingest all of these, ingest this url."
category: ${SKILL_CATEGORY.PRODUCTIVITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 1
maintainers: ["@lehidalgo"]
---

# wiki-ingest: Source Ingestion

Read the source. Write the wiki. Cross-reference everything. A single source typically touches 8-15 wiki pages.

**Syntax standard**: Write all Obsidian Markdown using proper Obsidian Flavored Markdown. Wikilinks as \`[[Note Name]]\`, callouts as \`> [!type] Title\`, embeds as \`![[file]]\`, properties as YAML frontmatter. If the kepano/obsidian-skills plugin is installed, prefer its canonical obsidian-markdown skill for Obsidian syntax reference. Otherwise, follow the guidance in this skill.

---

## Delta Tracking

Before ingesting any file, check \`.raw/.manifest.json\` to avoid re-processing unchanged sources.

\`\`\`bash
# Check if manifest exists
[ -f .raw/.manifest.json ] && echo "exists" || echo "no manifest yet"
\`\`\`

**Manifest format** (create if missing):
\`\`\`json
{
  "sources": {
    ".raw/articles/article-slug-2026-04-08.md": {
      "hash": "abc123",
      "ingested_at": "2026-04-08",
      "pages_created": ["wiki/sources/article-slug.md", "wiki/entities/Person.md"],
      "pages_updated": ["wiki/index.md"]
    }
  }
}
\`\`\`

**Before ingesting a file:**
1. Compute a hash: \`md5sum [file] | cut -d' ' -f1\` (or \`sha256sum\` on Linux).
2. Check if the path exists in \`.manifest.json\` with the same hash.
3. If hash matches, skip. Report: "Already ingested (unchanged). Use \`force\` to re-ingest."
4. If missing or hash differs, proceed with ingest.

**After ingesting a file:**
1. Record \`{hash, ingested_at, pages_created, pages_updated}\` in \`.manifest.json\`.
2. Write the updated manifest back.

Skip delta checking if the user says "force ingest" or "re-ingest".

---

## URL Ingestion

Trigger: the user passes a URL starting with \`https://\`.

Steps:

1. **Fetch** the page using WebFetch.
2. **Clean** (optional): if \`defuddle\` is available (\`which defuddle 2>/dev/null\`), run \`defuddle [url]\` to strip ads, nav, and clutter. Typically saves 40-60% tokens. Fall back to raw WebFetch output if not installed.
3. **Derive slug** from the URL path (last segment, lowercased, spaces→hyphens, strip query strings).
4. **Save** to \`.raw/articles/[slug]-[YYYY-MM-DD].md\` with a frontmatter header.
5. Proceed with **Single Source Ingest** starting at step 2 (file is now in \`.raw/\`).

---

## Image / Vision Ingestion

Trigger: the user passes an image file path (\`.png\`, \`.jpg\`, \`.jpeg\`, \`.gif\`, \`.webp\`, \`.svg\`, \`.avif\`).

Steps:

1. **Read** the image file using the Read tool. Claude can process images natively.
2. **Describe** the image contents: extract all text (OCR), identify key concepts, entities, diagrams, and data visible in the image.
3. **Save** the description to \`.raw/images/[slug]-[YYYY-MM-DD].md\` with source_type/original_file/fetched frontmatter.
4. Copy the image to \`_attachments/images/[slug].[ext]\` if it's not already in the vault.
5. Proceed with **Single Source Ingest** on the saved description file.

Use cases: whiteboard photos, screenshots, diagrams, infographics, document scans.

---

## Single Source Ingest

Trigger: the user drops a file into \`.raw/\` or pastes content.

Steps:

1. **Read** the source completely. Do not skim.
2. **Discuss** key takeaways with the user. Ask: "What should I emphasize? How granular?" Skip this if the user says "just ingest it."
3. **Create** source summary in \`wiki/sources/\`. Use the source frontmatter schema from \`../wiki/references/frontmatter.md\` (lives in the sibling \`wiki\` skill). Assign an address per the **Address Assignment** section below.
4. **Create or update** entity pages for every person, org, product, and repo mentioned. One page per entity. Assign addresses to new entity pages.
5. **Create or update** concept pages for significant ideas and frameworks. Assign addresses to new concept pages.
6. **Update** relevant domain page(s) and their \`_index.md\` sub-indexes.
7. **Update** \`wiki/overview.md\` if the big picture changed.
8. **Update** \`wiki/index.md\`. Add entries for all new pages.
9. **Update** \`wiki/hot.md\` with this ingest's context.
10. **Append** to \`wiki/log.md\` (new entries at the TOP) with date, source path, summary link, pages created/updated, and a one-sentence key insight.
11. **Check for contradictions.** If new info conflicts with existing pages, add \`> [!contradiction]\` callouts on both pages.

---

## Batch Ingest

Trigger: the user drops multiple files or says "ingest all of these."

Steps:

1. List all files to process. Confirm with the user before starting.
2. Process each source following the single ingest flow. Defer cross-referencing between sources until step 3.
3. After all sources: do a cross-reference pass. Look for connections between the newly ingested sources.
4. Update index, hot cache, and log once at the end (not per-source).
5. Report: "Processed N sources. Created X pages, updated Y pages. Here are the key connections I found."

Batch ingest is less interactive. For 30+ sources, expect significant processing time. Check in with the user after every 10 sources.

---

## Context Window Discipline

Token budget matters. Follow these rules during ingest:

- Read \`wiki/hot.md\` first. If it contains the relevant context, don't re-read full pages.
- Read \`wiki/index.md\` to find existing pages before creating new ones.
- Read only 3-5 existing pages per ingest. If you need 10+, you are reading too broadly.
- Use PATCH for surgical edits. Never re-read an entire file just to update one field.
- Keep wiki pages short. 100-300 lines max. If a page grows beyond 300 lines, split it.

---

## Contradictions

When new info contradicts an existing wiki page, add \`> [!contradiction]\` callouts on BOTH pages: the existing page references the new source, and the new source's summary references the existing page. Do not silently overwrite old claims. Flag and let the user decide.

The \`[!contradiction]\` callout type is a custom callout defined in \`.obsidian/snippets/vault-colors.css\` (auto-installed by \`/wiki\` scaffold). If the snippet is missing, Obsidian falls back to default callout styling, so the page still works.

---

## What Not to Do

- **Source files under \`.raw/\` are immutable.** Do not modify the files that users drop there. The \`.raw/.manifest.json\` delta tracker and its \`address_map\` (DragonScale Mechanism 2) are the only files under \`.raw/\` that \`wiki-ingest\` maintains.
- Do not create duplicate pages. Always check the index and search before creating.
- Do not skip the log entry. Every ingest must be recorded.
- Do not skip the hot cache update. It is what keeps future sessions fast.

---

## Address Assignment (DragonScale Mechanism 2 MVP)

**Opt-in feature**. DragonScale address assignment runs only if \`scripts/allocate-address.sh\` is present AND \`.vault-meta/\` exists. Otherwise, skip this entire section.

Feature detection:

\`\`\`bash
if [ -x ./scripts/allocate-address.sh ] && [ -d ./.vault-meta ]; then
  DRAGONSCALE_ADDRESSES=1
else
  DRAGONSCALE_ADDRESSES=0
fi
\`\`\`

When \`DRAGONSCALE_ADDRESSES=1\`, every newly created non-meta wiki page gets a stable \`address: c-NNNNNN\` in its frontmatter. The helper script \`./scripts/allocate-address.sh\` is the only path to allocate (uses \`flock\` for atomicity). Never use Write/Edit on \`.vault-meta/address-counter.txt\` — the PostToolUse hook fires and can commit unrelated pending wiki changes.

Idempotency: if a page being (re)written already has an \`address:\` field, REUSE it. If a source is re-ingested and \`address_map\` (in \`.raw/.manifest.json\`) has a mapping for the target path, reuse it.

Exclusions: meta files (_index, index, log, hot, overview, dashboard), fold pages, and pre-rollout legacy pages (created < 2026-04-23) do not get addresses.

Concurrency: single-writer only in Phase 2. Sub-agents dispatched for research MUST NOT call the allocator.
`;
