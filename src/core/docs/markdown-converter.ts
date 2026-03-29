/**
 * Minimal Markdown → HTML converter.
 * Handles the disciplined subset of Markdown used in Codi skill templates:
 * headings, paragraphs, lists, code blocks, tables, links, bold/italic, inline code.
 */

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function renderTable(tableLines: string[]): string {
  const rows = tableLines.filter((l) => !/^\|[\s\-:|]+\|$/.test(l));
  if (rows.length === 0) return "";
  const parseRow = (r: string) =>
    r
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
  const headerRow = rows[0] ?? "";
  let h = "<table><thead><tr>";
  for (const c of parseRow(headerRow)) {
    h += `<th>${inline(c)}</th>`;
  }
  h += "</tr></thead><tbody>";
  for (let r = 1; r < rows.length; r++) {
    h += "<tr>";
    for (const c of parseRow(rows[r] ?? "")) {
      h += `<td>${inline(c)}</td>`;
    }
    h += "</tr>";
  }
  return h + "</tbody></table>\n";
}

export function md2html(md: string): string {
  let html = "";
  const lines = md.split("\n");
  let i = 0;
  let inList = false;
  let inCode = false;
  let codeLang = "";
  const codeBlock: string[] = [];

  while (i < lines.length) {
    const line = lines[i] ?? "";

    // Fenced code blocks
    if (line.startsWith("```")) {
      if (inCode) {
        html += `<pre><code class="language-${esc(codeLang)}">${esc(codeBlock.join("\n"))}</code></pre>\n`;
        inCode = false;
        codeBlock.length = 0;
        codeLang = "";
      } else {
        if (inList) {
          html += "</ul>\n";
          inList = false;
        }
        inCode = true;
        codeLang = line.slice(3).trim();
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBlock.push(line);
      i++;
      continue;
    }

    // Headings
    const hMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      if (inList) {
        html += "</ul>\n";
        inList = false;
      }
      const level = (hMatch[1] ?? "").length;
      const text = inline(hMatch[2] ?? "");
      const id = slugify(hMatch[2] ?? "");
      html += `<h${level} id="${id}">${text}</h${level}>\n`;
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      if (inList) {
        html += "</ul>\n";
        inList = false;
      }
      html += "<hr>\n";
      i++;
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) {
        html += "<ul>\n";
        inList = true;
      }
      html += `<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>\n`;
      i++;
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      if (!inList) {
        html += "<ol>\n";
        inList = true;
      }
      html += `<li>${inline(line.replace(/^\s*\d+\.\s+/, ""))}</li>\n`;
      i++;
      continue;
    }

    // Table
    if (line.includes("|") && line.trim().startsWith("|")) {
      if (inList) {
        html += "</ul>\n";
        inList = false;
      }
      const tblLines: string[] = [];
      while (i < lines.length) {
        const tblLine = lines[i] ?? "";
        if (!tblLine.includes("|") || !tblLine.trim().startsWith("|")) break;
        tblLines.push(tblLine);
        i++;
      }
      html += renderTable(tblLines);
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      if (inList) {
        html += "</ul>\n";
        inList = false;
      }
      html += `<blockquote><p>${inline(line.replace(/^>\s*/, ""))}</p></blockquote>\n`;
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      if (inList) {
        html += "</ul>\n";
        inList = false;
      }
      i++;
      continue;
    }

    // Paragraph
    if (inList) {
      html += "</ul>\n";
      inList = false;
    }
    html += `<p>${inline(line)}</p>\n`;
    i++;
  }

  if (inList) html += "</ul>\n";
  if (inCode) html += `<pre><code>${esc(codeBlock.join("\n"))}</code></pre>\n`;
  return html;
}
