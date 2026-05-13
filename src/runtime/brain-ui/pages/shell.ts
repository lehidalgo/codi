/**
 * Shared HTML shell for every brain-ui page. Owns the sidebar nav, the
 * head section (Tailwind, Alpine, Chart.js), and the small set of escape /
 * format helpers used across pages. Pages return a body fragment; this
 * shell wraps it.
 */

import { marked, Renderer } from "marked";

// XSS-safe markdown renderer (ISSUE-008). Marked v18 does NOT sanitize by
// default — the `sanitize` option was removed in v1.0. Capture content is
// attacker-controllable via Iron Law 9 markers, so we need three
// overrides:
//   1. link() — block `javascript:`, `data:`, `vbscript:` schemes (with a
//      URL-decode pass to catch %6A%61%76… obfuscation).
//   2. image() — same scheme allowlist; downgrade to alt text on reject.
//   3. html() — escape raw HTML blocks instead of passing them through.
const UNSAFE_PROTOCOL_RE = /^\s*(javascript|data|vbscript):/i;

function isUnsafeHref(href: string | null | undefined): boolean {
  if (!href) return true;
  let decoded = href;
  try {
    decoded = decodeURIComponent(href);
  } catch {
    /* keep raw — malformed URI itself is suspicious */
  }
  return UNSAFE_PROTOCOL_RE.test(decoded) || UNSAFE_PROTOCOL_RE.test(href);
}

const safeRenderer = new Renderer();

safeRenderer.link = function ({ href, title, tokens }) {
  if (isUnsafeHref(href)) {
    return this.parser.parseInline(tokens);
  }
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
  return `<a href="${escapeHtml(href ?? "")}"${titleAttr} rel="noopener noreferrer">${this.parser.parseInline(tokens)}</a>`;
};

safeRenderer.image = function ({ href, title, text }) {
  if (isUnsafeHref(href)) {
    return escapeHtml(text);
  }
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
  return `<img src="${escapeHtml(href ?? "")}" alt="${escapeHtml(text)}"${titleAttr}>`;
};

safeRenderer.html = function ({ text }) {
  // Drop raw HTML — emit escaped source instead of verbatim passthrough.
  return escapeHtml(text);
};

marked.setOptions({ gfm: true, breaks: true, renderer: safeRenderer });

const NAV_ITEMS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/", label: "Dashboard" },
  { href: "/sessions", label: "Sessions" },
  { href: "/captures", label: "Captures" },
  { href: "/tool-calls", label: "Tool calls" },
  { href: "/workflows", label: "Workflows" },
  { href: "/artifacts", label: "Artifacts" },
  { href: "/pain-points", label: "Pain points" },
  { href: "/settings", label: "Settings" },
];

export interface ShellOptions {
  readonly title: string;
  readonly active?: string; // href of the active nav entry
  readonly head?: string; // additional <head> snippet (e.g. extra scripts)
}

export function shell(opts: ShellOptions, body: string): string {
  const title = escapeHtml(opts.title);
  const active = opts.active ?? "";
  const navHtml = NAV_ITEMS.map((item) => {
    const isActive = item.href === active;
    const classes = isActive
      ? "block rounded px-3 py-2 text-sm font-medium bg-slate-900 text-white"
      : "block rounded px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100";
    return `<a class="${classes}" href="${item.href}">${escapeHtml(item.label)}</a>`;
  }).join("\n");

  const extraHead = opts.head ?? "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — codi brain</title>
  <script src="https://cdn.tailwindcss.com?plugins=typography"></script>
  <script defer src="https://unpkg.com/htmx.org@2.0.4"></script>
  <script defer src="https://unpkg.com/alpinejs@3.14.1/dist/cdn.min.js"></script>
  <style>
    [x-cloak] { display: none !important; }
    .prose pre { background:#0f172a; color:#e2e8f0; padding:0.75rem; border-radius:0.375rem; overflow-x:auto; font-size:0.8125rem; line-height:1.5; }
    .prose code:not(pre code) { background:#f1f5f9; color:#0f172a; padding:0.125rem 0.375rem; border-radius:0.25rem; font-size:0.875em; }
    .prose table { display:block; overflow-x:auto; max-width:100%; }
  </style>
  ${extraHead}
</head>
<body class="bg-slate-50 text-slate-900 h-screen overflow-hidden">
  <div class="flex h-full">
    <aside class="w-56 shrink-0 border-r border-slate-200 bg-white h-full overflow-y-auto sticky top-0">
      <div class="px-4 py-5 border-b border-slate-200">
        <a href="/" class="text-base font-semibold tracking-tight">codi brain</a>
      </div>
      <nav class="p-3 space-y-1">${navHtml}</nav>
    </aside>
    <main class="flex-1 h-full overflow-y-auto">
      <div class="p-6 max-w-6xl mx-auto">
        ${body}
      </div>
    </main>
  </div>
</body>
</html>`;
}

export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function fmtTs(ts: number): string {
  return new Date(ts)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, "Z");
}

export function fmtRelative(ts: number, now = Date.now()): string {
  const diff = now - ts;
  if (diff < 0) return "in the future";
  const seconds = Math.round(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return new Date(ts).toISOString().slice(0, 10);
}

/**
 * Render a markdown source string into safe HTML wrapped in a `prose`
 * container. The renderer is GFM + breaks with custom overrides for
 * link/image/html that block `javascript:`/`data:`/`vbscript:` schemes
 * and escape raw HTML — see the `safeRenderer` block above for details.
 * Required because capture content is attacker-controllable via Iron
 * Law 9 markers (ISSUE-008).
 */
export function renderMarkdown(src: string): string {
  if (!src) return "";
  const html = marked.parse(src, { async: false }) as string;
  return `<div class="prose prose-slate prose-sm max-w-none break-words">${html}</div>`;
}

/**
 * Pretty-print a JSON-shaped string. If the input is JSON, return it
 * indented; otherwise return the original. The brain stores tool
 * `output_summary` as a stringified JSON envelope (e.g. `{"stdout":"…",
 * "stderr":""}`); plain text passes through untouched.
 */
export function prettyJson(src: string): { isJson: boolean; text: string } {
  if (!src) return { isJson: false, text: "" };
  try {
    const parsed = JSON.parse(src) as unknown;
    return { isJson: true, text: JSON.stringify(parsed, null, 2) };
  } catch {
    return { isJson: false, text: src };
  }
}

/**
 * Decode escape sequences inside a JSON-encoded text field so the
 * timeline / detail views show the original characters (`\n` becomes a
 * real newline) instead of the escaped form. The input is assumed to be
 * a single string; the function does NOT walk JSON objects.
 */
export function unescapeJsonString(src: string): string {
  if (!src) return "";
  return src
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

export function fmtDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds - minutes * 60);
  return `${minutes}m${rest}s`;
}
