# Promote a My Work Project to a Built-in Template

When the user says "save this as a template", "add this to my presets", "make
this reusable", or "add my project from .codi_output as a new template", use
this workflow to add the project as a new built-in template.

This follows the `codi-improvement-dev` principle: you are both a consumer and
an improver of Codi skills. A user project that is worth reusing belongs in the
skill's template library.

## Steps

### 1. Read state to get the source file

```bash
curl -s <url>/api/state
# {"activeFile":"social.html","activeSessionDir":"/abs/path/.codi_output/20260410_content-factory",...}
```

If the user has not opened the project yet, ask them to click it in the
Gallery → My Work tab first so the server activates it and `/api/state` returns
the correct `activeFilePath`.

### 2. Check document template conventions (document type only)

If the source file uses `.doc-page` containers, verify it follows the DOCX class
conventions from the "Document template conventions — DOCX export" section in
the main skill. If the file is missing `.page-header`, `.page-footer`, or
`.callout` classes, apply them before promoting — a template that does not
follow the conventions will produce unstructured DOCX exports.

### 3. Ask the user for a template name and confirm

> "I'll add this as a new template named '[name]'. It will appear in the Gallery
> Templates tab for all future sessions. Confirm?"

### 4. Copy the HTML file to both the installed skill and the source

```bash
TEMPLATE_NAME="<kebab-case-name>"
# Installed skill (active immediately)
cp "<activeSessionDir>/content/<activeFile>" \
   "${CLAUDE_SKILL_DIR}/generators/templates/${TEMPLATE_NAME}.html"
# Source (persists across codi generate)
cp "<activeSessionDir>/content/<activeFile>" \
   "src/templates/skills/content-factory/generators/templates/${TEMPLATE_NAME}.html"
```

### 5. Update the content identity tag

Update the `<meta name="codi:template">` tag inside the copied file to set a
stable `id` and a clean `name` matching what the user confirmed. The `id` must
be the same kebab-case name as the filename.

### 6. Verify it appears in the Gallery

The server's template watcher broadcasts `reload-templates` within 150ms of the
file being written:

```bash
curl -s <url>/api/templates | grep "${TEMPLATE_NAME}"
```

### 7. Record the improvement

Invoke `codi-skill-feedback-reporter` to log that a new template was added, so
the improvement loop can track what changed.

### 8. Optional — contribute upstream

If the user wants to share or contribute the template upstream, invoke the
`codi-skill-creator` skill to package it as a proper skill improvement with
metadata, then use `codi-artifact-contributor` to submit it as a PR or ZIP
package.

## What NOT to do

**Do not run `codi generate`** unless the user explicitly asks — copying the
source file is sufficient to persist the template. `codi generate` regenerates
the SKILL.md from template.ts, which is a separate concern.
