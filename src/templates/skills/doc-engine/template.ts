import {
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
  SUPPORTED_PLATFORMS_YAML,
  SKILL_CATEGORY,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: Document generation engine for branded reports, proposals, one-pagers, and case studies. Use when the user needs a formatted document — HTML with print CSS for PDF export, optional pandoc DOCX. Integrates with ${PROJECT_NAME_DISPLAY} brand artifacts.
category: ${SKILL_CATEGORY.DOCUMENT_GENERATION}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 6
---

# {{name}} — Document Engine

## When to Activate

- User asks to create a report, proposal, one-pager, case study, or executive summary
- User needs a formatted document with brand identity
- User wants to generate DOCX, PDF, or printable HTML documents
- User asks to create a spreadsheet-style table or data export

## Step 1: Gather Requirements

**[HUMAN]** Provide:
- Document type (report, proposal, one-pager, case study, spreadsheet)
- Topic and scope
- Target audience
- Key data or sections to include

**[CODING AGENT]** Check if any skill with **category: brand** is defined in the project. If a brand skill exists, use its design tokens (CSS variables, fonts, logos, tone of voice). If no brand skill exists, use neutral professional defaults.

## Step 2: Document Structure

Choose structure based on document type:

### Report
1. **Cover Page** — Title, date, author, brand logo
2. **Executive Summary** — 3-5 sentences covering key findings
3. **Table of Contents** — Auto-generated from headings
4. **Sections** (3-7) — Analysis, findings, data
5. **Conclusions** — Summary of findings
6. **Next Steps** — Recommendations and action items
7. **Appendix** — Supporting data, methodology

### Proposal
1. **Cover Page** — Title, client name, date
2. **Problem Statement** — Current situation and pain points
3. **Proposed Solution** — What you recommend and why
4. **Scope & Deliverables** — What is included
5. **Timeline** — Phases and milestones
6. **Investment** — Pricing and payment terms
7. **About Us** — Team credentials and relevant experience

### One-Pager
1. **Header** — Logo, title, tagline
2. **Problem** — One paragraph
3. **Solution** — One paragraph with key features
4. **Key Metrics** — 3-4 proof points
5. **Call to Action** — Next step

### Case Study
1. **Header** — Client name, industry, result headline
2. **Challenge** — What the client faced
3. **Solution** — What was implemented
4. **Results** — Metrics and outcomes
5. **Testimonial** — Client quote (if available)

## Step 3: HTML Document Template

\\\`\\\`\\\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document Title</title>
  <style>
    /* Brand tokens — override with brand artifact values */
    :root {
      --brand-primary: #2563eb;
      --brand-primary-dark: #1d4ed8;
      --brand-primary-muted: #2563eb10;
      --brand-bg: #ffffff;
      --brand-text: #1e293b;
      --brand-text-secondary: #64748b;
      --brand-heading-font: system-ui, -apple-system, sans-serif;
      --brand-body-font: system-ui, -apple-system, sans-serif;
      --brand-mono-font: 'SF Mono', 'Fira Code', monospace;
    }

    /* Document layout */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--brand-body-font);
      color: var(--brand-text);
      background: var(--brand-bg);
      line-height: 1.7;
      max-width: 900px;
      margin: 0 auto;
      padding: 60px 40px;
    }
    h1, h2, h3, h4 {
      font-family: var(--brand-heading-font);
      font-weight: 700;
      color: var(--brand-text);
    }
    h1 { font-size: 2.2rem; margin: 1.5em 0 0.5em; }
    h2 { font-size: 1.6rem; margin: 1.5em 0 0.5em; border-bottom: 2px solid var(--brand-primary); padding-bottom: 0.3em; }
    h3 { font-size: 1.25rem; margin: 1.2em 0 0.4em; }
    p { margin: 0.8em 0; font-size: 1rem; }
    ul, ol { margin: 0.8em 0; padding-left: 1.5em; }
    li { margin: 0.3em 0; }

    /* Cover page */
    .cover {
      text-align: center;
      padding: 120px 0 80px;
      page-break-after: always;
    }
    .cover h1 { font-size: 3rem; border: none; margin-bottom: 0.3em; }
    .cover .subtitle { font-size: 1.3rem; color: var(--brand-text-secondary); }
    .cover .meta { font-size: 1rem; color: var(--brand-text-secondary); margin-top: 2em; }
    .cover .logo { max-height: 60px; margin-bottom: 40px; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin: 1.5em 0; font-size: 0.95rem; }
    th { background: var(--brand-primary); color: #fff; text-align: left; padding: 12px 16px; font-weight: 600; }
    td { padding: 10px 16px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: var(--brand-primary-muted); }

    /* Callout boxes */
    .callout {
      background: var(--brand-primary-muted);
      border-left: 4px solid var(--brand-primary);
      padding: 20px 24px;
      margin: 1.5em 0;
      border-radius: 0 8px 8px 0;
    }
    .callout-title { font-weight: 700; margin-bottom: 0.3em; color: var(--brand-primary-dark); }

    /* Metric highlights */
    .metrics-row { display: flex; gap: 24px; margin: 1.5em 0; }
    .metric-box {
      flex: 1; text-align: center; padding: 24px;
      background: var(--brand-primary-muted);
      border-radius: 8px;
    }
    .metric-box .value { font-size: 2rem; font-weight: 800; color: var(--brand-primary); }
    .metric-box .label { font-size: 0.85rem; color: var(--brand-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }

    /* Code blocks */
    pre {
      background: #1e293b; color: #e2e8f0;
      padding: 20px; border-radius: 8px;
      font-family: var(--brand-mono-font);
      font-size: 0.9rem; overflow-x: auto;
      margin: 1em 0;
    }
    code { font-family: var(--brand-mono-font); font-size: 0.9em; }

    /* Print styles */
    @media print {
      body { max-width: none; padding: 0; font-size: 11pt; }
      h2 { page-break-after: avoid; }
      table, .callout, .metrics-row { page-break-inside: avoid; }
      .cover { padding: 200px 0 100px; }
      a { color: var(--brand-text); text-decoration: none; }
      a::after { content: " (" attr(href) ")"; font-size: 0.8em; color: var(--brand-text-secondary); }
    }

    @page {
      size: A4;
      margin: 25mm 20mm;
    }
  </style>
</head>
<body>
  <!-- Document content here -->
</body>
</html>
\\\`\\\`\\\`

## Step 4: Content Guidelines

- **Professional tone** — match the brand's tone of voice if defined
- **Data over opinions** — include numbers, dates, percentages
- **Scannable structure** — use headings, bullets, tables, callouts
- **Consistent formatting** — parallel structure in lists
- **Source attribution** — cite data sources in footnotes or inline

## Step 4b: Validate layout structure

After writing the HTML file, run the Box Layout Validator to catch spacing, hierarchy, and sibling-consistency bugs before delivering:

\\\`\\\`\\\`bash
bash ~/.claude/skills/codi-box-validator/scripts/setup.sh   # first run only
node ~/.claude/skills/codi-box-validator/scripts/validate.mjs \\\\
  --input <absolute-path> --width 794 --height 1123 --threshold 0.85
\\\`\\\`\\\`

For A4 portrait use 794×1123, landscape 1123×794, US Letter 816×1056. If \\\`valid: false\\\`, read the JSON \\\`fixInstructions\\\` field, patch the HTML, revalidate. Max 4 iterations. Only deliver when valid or at final attempt.

## Step 5: Output Formats

### HTML (Primary)
Save as a single \\\`.html\\\` file with embedded CSS. Open in browser for review.

### PDF
Open the HTML in a browser → File → Print → Save as PDF.
The print CSS handles A4 page sizing, page breaks, and link expansion.

### DOCX (via pandoc)
If the user needs a Word document:
\\\`\\\`\\\`bash
pandoc document.html -o document.docx --reference-doc=template.docx
\\\`\\\`\\\`

### Spreadsheet / Data Export
For tabular data, generate:
- **CSV** for raw data import
- **HTML table** for formatted presentation
- User can paste HTML tables directly into Google Sheets

## Available Agents

For content research during document generation, delegate to these agents (see \\\`agents/\\\` directory):
- **${PROJECT_NAME}-docs-lookup** — Research and verify technical content accuracy

## Related Skills

- **${PROJECT_NAME}-theme-factory** — Apply visual themes to generated documents
- **${PROJECT_NAME}-content-factory** — Generate slide presentations from document content

## Step 6: Component Reference

### Callout Box
\\\`\\\`\\\`html
<div class="callout">
  <div class="callout-title">Key Insight</div>
  <p>Important information highlighted for the reader.</p>
</div>
\\\`\\\`\\\`

### Metrics Row
\\\`\\\`\\\`html
<div class="metrics-row">
  <div class="metric-box">
    <div class="value">42%</div>
    <div class="label">Growth Rate</div>
  </div>
  <div class="metric-box">
    <div class="value">$1.2M</div>
    <div class="label">Revenue</div>
  </div>
  <div class="metric-box">
    <div class="value">99.9%</div>
    <div class="label">Uptime</div>
  </div>
</div>
\\\`\\\`\\\`

### Data Table
\\\`\\\`\\\`html
<table>
  <thead>
    <tr><th>Metric</th><th>Q1</th><th>Q2</th><th>Change</th></tr>
  </thead>
  <tbody>
    <tr><td>Users</td><td>10,000</td><td>15,000</td><td>+50%</td></tr>
  </tbody>
</table>
\\\`\\\`\\\`
`;
