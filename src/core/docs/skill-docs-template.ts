/**
 * Renders the full HTML page for the skill catalog.
 * Self-contained: embedded CSS + JS, no external dependencies.
 */
import type { CategoryGroup, SkillDocEntry } from "./skill-docs-generator.js";
import { esc, slugify, md2html } from "./markdown-converter.js";
import { PROJECT_NAME_DISPLAY } from "#src/constants.js";

function renderBadges(skill: SkillDocEntry): string {
  const badges: string[] = [];
  if (skill.userInvocable)
    badges.push('<span class="badge invocable">user-invocable</span>');
  badges.push(`<span class="badge cat">${esc(skill.category)}</span>`);
  if (skill.compatibility.length > 0) {
    badges.push(
      `<span class="badge compat">${skill.compatibility.join(", ")}</span>`,
    );
  }
  return badges.join(" ");
}

function renderSkillCard(skill: SkillDocEntry): string {
  const id = slugify(skill.name);
  return `
    <article class="skill-card" id="${id}">
      <div class="skill-header" onclick="this.parentElement.classList.toggle('collapsed')">
        <h2>${esc(skill.name)}</h2>
        <div class="badges">${renderBadges(skill)}</div>
        <span class="toggle-icon"></span>
      </div>
      <p class="skill-desc">${esc(skill.description)}</p>
      <div class="skill-body">${md2html(skill.body)}</div>
    </article>`;
}

function renderSidebar(groups: CategoryGroup[]): string {
  let html = "";
  for (const group of groups) {
    const catId = slugify(group.name);
    html += `<div class="nav-group" id="nav-${catId}">
      <h3 class="nav-category">${esc(group.name)}</h3>
      <ul>`;
    for (const skill of group.skills) {
      html += `<li><a href="#${slugify(skill.name)}">${esc(skill.name)}</a></li>`;
    }
    html += `</ul></div>`;
  }
  return html;
}

const CSS = `
:root {
  --bg: #fff; --bg-alt: #f8f9fa; --text: #1a1a2e; --text-muted: #6c757d;
  --border: #dee2e6; --primary: #3b82f6; --primary-light: #dbeafe;
  --sidebar-w: 280px; --card-radius: 8px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1a2e; --bg-alt: #16213e; --text: #e4e4e7; --text-muted: #9ca3af;
    --border: #374151; --primary: #60a5fa; --primary-light: #1e3a5f;
  }
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
a { color: var(--primary); text-decoration: none; }
a:hover { text-decoration: underline; }
.layout { display: flex; min-height: 100vh; }
.sidebar { width: var(--sidebar-w); background: var(--bg-alt); border-right: 1px solid var(--border); padding: 1rem; position: fixed; top: 0; left: 0; bottom: 0; overflow-y: auto; }
.main { margin-left: var(--sidebar-w); flex: 1; padding: 2rem 3rem; max-width: 900px; }
.sidebar h1 { font-size: 1.2rem; margin-bottom: 0.5rem; }
.sidebar .stats { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem; }
.search-box { width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--text); font-size: 0.9rem; margin-bottom: 1rem; }
.nav-category { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin: 1rem 0 0.3rem; }
.nav-group ul { list-style: none; }
.nav-group li { padding: 2px 0; }
.nav-group a { font-size: 0.85rem; display: block; padding: 2px 8px; border-radius: 4px; }
.nav-group a:hover, .nav-group a.active { background: var(--primary-light); text-decoration: none; }
.skill-card { border: 1px solid var(--border); border-radius: var(--card-radius); margin-bottom: 1.5rem; overflow: hidden; }
.skill-header { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem; cursor: pointer; flex-wrap: wrap; background: var(--bg-alt); }
.skill-header h2 { font-size: 1.1rem; flex-shrink: 0; }
.badges { display: flex; gap: 0.4rem; flex-wrap: wrap; flex: 1; }
.badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; white-space: nowrap; }
.badge.cat { background: var(--primary-light); color: var(--primary); }
.badge.invocable { background: #d1fae5; color: #065f46; }
.badge.compat { background: var(--bg); border: 1px solid var(--border); color: var(--text-muted); }
@media (prefers-color-scheme: dark) { .badge.invocable { background: #064e3b; color: #6ee7b7; } }
.toggle-icon { margin-left: auto; width: 20px; text-align: center; transition: transform 0.2s; }
.toggle-icon::after { content: "\\25BC"; font-size: 0.7rem; color: var(--text-muted); }
.collapsed .toggle-icon { transform: rotate(-90deg); }
.skill-desc { padding: 0.75rem 1.25rem; color: var(--text-muted); font-size: 0.9rem; border-bottom: 1px solid var(--border); }
.skill-body { padding: 1rem 1.25rem; }
.collapsed .skill-desc, .collapsed .skill-body { display: none; }
.skill-body h1, .skill-body h2, .skill-body h3 { margin: 1.2rem 0 0.5rem; }
.skill-body h2 { font-size: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.3rem; }
.skill-body h3 { font-size: 0.95rem; }
.skill-body p { margin: 0.5rem 0; }
.skill-body ul, .skill-body ol { padding-left: 1.5rem; margin: 0.5rem 0; }
.skill-body li { margin: 0.25rem 0; }
.skill-body pre { background: var(--bg-alt); border: 1px solid var(--border); border-radius: 4px; padding: 0.75rem; overflow-x: auto; margin: 0.75rem 0; font-size: 0.85rem; }
.skill-body code { font-family: "SF Mono", "Fira Code", monospace; font-size: 0.85em; }
.skill-body :not(pre) > code { background: var(--bg-alt); padding: 1px 4px; border-radius: 3px; }
.skill-body table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; font-size: 0.85rem; }
.skill-body th, .skill-body td { border: 1px solid var(--border); padding: 0.4rem 0.6rem; text-align: left; }
.skill-body th { background: var(--bg-alt); font-weight: 600; }
.skill-body blockquote { border-left: 3px solid var(--primary); padding: 0.5rem 1rem; margin: 0.75rem 0; color: var(--text-muted); }
.skill-body hr { border: none; border-top: 1px solid var(--border); margin: 1rem 0; }
@media (max-width: 768px) {
  .sidebar { position: static; width: 100%; border-right: none; border-bottom: 1px solid var(--border); }
  .main { margin-left: 0; padding: 1rem; }
  .layout { flex-direction: column; }
}
@media print {
  .sidebar { display: none; }
  .main { margin-left: 0; max-width: 100%; }
  .skill-card { break-inside: avoid; }
  .collapsed .skill-desc, .collapsed .skill-body { display: block !important; }
}
.no-results { padding: 2rem; text-align: center; color: var(--text-muted); display: none; }
`;

const JS = `
const search = document.getElementById("search");
const cards = document.querySelectorAll(".skill-card");
const noResults = document.getElementById("no-results");
const navLinks = document.querySelectorAll(".nav-group a");

search.addEventListener("input", () => {
  const q = search.value.toLowerCase();
  let visible = 0;
  cards.forEach(card => {
    const match = card.textContent.toLowerCase().includes(q);
    card.style.display = match ? "" : "none";
    if (match) visible++;
  });
  noResults.style.display = visible === 0 ? "block" : "none";
  navLinks.forEach(a => {
    const id = a.getAttribute("href").slice(1);
    const card = document.getElementById(id);
    a.parentElement.style.display = card && card.style.display !== "none" ? "" : "none";
  });
  document.querySelectorAll(".nav-group").forEach(g => {
    const items = g.querySelectorAll("li");
    let anyVisible = false;
    items.forEach(li => { if (li.style.display !== "none") anyVisible = true; });
    g.style.display = anyVisible || q === "" ? "" : "none";
  });
});

const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      navLinks.forEach(a => a.classList.remove("active"));
      const link = document.querySelector('.nav-group a[href="#' + e.target.id + '"]');
      if (link) link.classList.add("active");
    }
  });
}, { threshold: 0.3 });
cards.forEach(c => observer.observe(c));
`;

export function renderSkillDocsPage(
  groups: CategoryGroup[],
  totalSkills: number,
): string {
  const sidebar = renderSidebar(groups);
  const content = groups
    .flatMap((g) => g.skills.map(renderSkillCard))
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${PROJECT_NAME_DISPLAY} Skills Catalog</title>
<style>${CSS}</style>
</head>
<body>
<div class="layout">
  <nav class="sidebar">
    <h1>${PROJECT_NAME_DISPLAY} Skills</h1>
    <p class="stats">${totalSkills} skills</p>
    <input type="text" class="search-box" placeholder="Search skills..." id="search">
    ${sidebar}
  </nav>
  <main class="main">
    <h1>${PROJECT_NAME_DISPLAY} Skills Catalog</h1>
    <p style="color:var(--text-muted);margin-bottom:2rem">
      ${totalSkills} skills across ${groups.length} categories.
      Click a skill header to expand/collapse.
    </p>
    ${content}
    <div class="no-results" id="no-results">No skills match your search.</div>
  </main>
</div>
<script>${JS}</script>
</body>
</html>`;
}
