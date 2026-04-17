# Business Documents

Branded reports, proposals, one-pagers, case studies, and executive summaries. Use content-factory's `document` content type (A4 pages) with the templates below.

## When to use this reference

- User asks for a report, proposal, one-pager, case study, executive summary, or other business deliverable
- User needs a formatted deliverable with brand identity (brand skill in the project)
- User wants PDF/DOCX output via content-factory's export pipeline

## Document types

### Report

1. Cover Page — title, date, author, brand logo
2. Executive Summary — 3-5 sentences covering key findings
3. Table of Contents — auto-generated from headings
4. Sections (3-7) — analysis, findings, data
5. Conclusions — summary of findings
6. Next Steps — recommendations and action items
7. Appendix — supporting data, methodology

### Proposal

1. Cover Page — title, client name, date
2. Problem Statement — current situation and pain points
3. Proposed Solution — what you recommend and why
4. Scope & Deliverables — what is included
5. Timeline — phases and milestones
6. Investment — pricing and payment terms
7. About Us — team credentials and relevant experience

### One-Pager

1. Header — logo, title, tagline
2. Problem — one paragraph
3. Solution — one paragraph with key features
4. Key Metrics — 3-4 proof points
5. Call to Action — next step

### Case Study

1. Header — client name, industry, result headline
2. Challenge — what the client faced
3. Solution — what was implemented
4. Results — metrics and outcomes
5. Testimonial — client quote (if available)

### Executive Summary

1. Context — one paragraph framing the decision or situation
2. Key Findings — 3-5 bullets, one line each
3. Recommendation — one paragraph, action-oriented
4. Risks — short list with mitigation
5. Next Steps — decision owner + deadline

## Brand integration

Before writing the HTML, check for a brand skill in the project (`category: brand` in `.codi/skills/`). If found, use its design tokens (CSS variables, fonts, logos, tone of voice). If no brand skill exists, use neutral professional defaults — content-factory's stock templates already handle this.

## HTML skeleton with print CSS

This is the minimal baseline. Content-factory's `generators/document-base.html` carries the same primitives — prefer extending that template over rewriting this from scratch.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document Title</title>
  <style>
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

    .cover {
      text-align: center;
      padding: 120px 0 80px;
      page-break-after: always;
    }
    .cover h1 { font-size: 3rem; border: none; margin-bottom: 0.3em; }
    .cover .subtitle { font-size: 1.3rem; color: var(--brand-text-secondary); }
    .cover .meta { font-size: 1rem; color: var(--brand-text-secondary); margin-top: 2em; }
    .cover .logo { max-height: 60px; margin-bottom: 40px; }

    table { width: 100%; border-collapse: collapse; margin: 1.5em 0; font-size: 0.95rem; }
    th { background: var(--brand-primary); color: #fff; text-align: left; padding: 12px 16px; font-weight: 600; }
    td { padding: 10px 16px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: var(--brand-primary-muted); }

    .callout {
      background: var(--brand-primary-muted);
      border-left: 4px solid var(--brand-primary);
      padding: 20px 24px;
      margin: 1.5em 0;
      border-radius: 0 8px 8px 0;
    }
    .callout-title { font-weight: 700; margin-bottom: 0.3em; color: var(--brand-primary-dark); }

    .metrics-row { display: flex; gap: 24px; margin: 1.5em 0; }
    .metric-box {
      flex: 1; text-align: center; padding: 24px;
      background: var(--brand-primary-muted);
      border-radius: 8px;
    }
    .metric-box .value { font-size: 2rem; font-weight: 800; color: var(--brand-primary); }
    .metric-box .label { font-size: 0.85rem; color: var(--brand-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }

    pre {
      background: #1e293b; color: #e2e8f0;
      padding: 20px; border-radius: 8px;
      font-family: var(--brand-mono-font);
      font-size: 0.9rem; overflow-x: auto;
      margin: 1em 0;
    }
    code { font-family: var(--brand-mono-font); font-size: 0.9em; }

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
```

## Component library

### Callout box

```html
<div class="callout">
  <div class="callout-title">Key Insight</div>
  <p>Important information highlighted for the reader.</p>
</div>
```

### Metrics row

```html
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
```

### Data table

```html
<table>
  <thead>
    <tr><th>Metric</th><th>Q1</th><th>Q2</th><th>Change</th></tr>
  </thead>
  <tbody>
    <tr><td>Users</td><td>10,000</td><td>15,000</td><td>+50%</td></tr>
  </tbody>
</table>
```

## Content guidelines

- **Professional tone** — match the brand's tone of voice if defined
- **Data over opinions** — include numbers, dates, percentages
- **Scannable structure** — use headings, bullets, tables, callouts
- **Consistent formatting** — parallel structure in lists
- **Source attribution** — cite data sources in footnotes or inline

## Validation + Export

Content-factory already handles both for documents:

- Box validation runs via `codi-box-validator` on the document pages (A4 dimensions: 794×1123 portrait, 1123×794 landscape, 816×1056 US Letter)
- Export to PDF/DOCX/HTML/ZIP via the running content-factory server — no separate pandoc invocation needed

## Research support

For technical or factual content, delegate research to the `docs-lookup` subagent prompt at `${CLAUDE_SKILL_DIR}[[/agents/docs-lookup.md]]`.
