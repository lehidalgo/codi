/**
 * Shared HTML shell for every brain-ui page. Owns the sidebar nav, the
 * head section (Tailwind, Alpine, Chart.js), and the small set of escape /
 * format helpers used across pages. Pages return a body fragment; this
 * shell wraps it.
 */

const NAV_ITEMS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/", label: "Dashboard" },
  { href: "/sessions", label: "Sessions" },
  { href: "/captures", label: "Captures" },
  { href: "/tool-calls", label: "Tool calls" },
  { href: "/workflows", label: "Workflows" },
  { href: "/proposals", label: "Proposals" },
  { href: "/artifacts", label: "Artifacts" },
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
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://unpkg.com/htmx.org@2.0.4"></script>
  <script defer src="https://unpkg.com/alpinejs@3.14.1/dist/cdn.min.js"></script>
  ${extraHead}
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen">
  <div class="flex min-h-screen">
    <aside class="w-56 shrink-0 border-r border-slate-200 bg-white">
      <div class="px-4 py-5 border-b border-slate-200">
        <a href="/" class="text-base font-semibold tracking-tight">codi brain</a>
      </div>
      <nav class="p-3 space-y-1">${navHtml}</nav>
    </aside>
    <main class="flex-1 p-6 max-w-6xl mx-auto">
      ${body}
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

export function fmtDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds - minutes * 60);
  return `${minutes}m${rest}s`;
}
