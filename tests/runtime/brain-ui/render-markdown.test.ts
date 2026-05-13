/**
 * ISSUE-008 regression: renderMarkdown sanitizes attacker-controllable
 * capture content. Marked v18 does not sanitize by default; capture
 * content arrives via Iron Law 9 markers which any agent (or, post-sync,
 * any team member) can author. The custom renderer must reject
 * `javascript:` / `data:` / `vbscript:` URLs and escape raw HTML.
 */

import { describe, it, expect } from "vitest";
import { renderMarkdown } from "#src/runtime/brain-ui/pages/shell.js";

describe("renderMarkdown — XSS hardening (ISSUE-008)", () => {
  it("blocks javascript: links — emits text only", () => {
    const html = renderMarkdown("[click](javascript:alert(1))");
    expect(html).not.toMatch(/href\s*=\s*"?javascript:/i);
    expect(html).toContain("click");
  });

  it("blocks case-variant javascript: links", () => {
    const html = renderMarkdown("[click](JaVaScRiPt:alert(1))");
    expect(html).not.toMatch(/href\s*=\s*"?javascript:/i);
  });

  it("blocks data: links", () => {
    const html = renderMarkdown(`[click](data:text/html,<script>alert(1)</script>)`);
    expect(html).not.toMatch(/href\s*=\s*"?data:/i);
  });

  it("blocks vbscript: links", () => {
    const html = renderMarkdown(`[click](vbscript:msgbox)`);
    expect(html).not.toMatch(/href\s*=\s*"?vbscript:/i);
  });

  it("blocks URL-encoded javascript: links (decode-pass)", () => {
    const html = renderMarkdown("[click](javascript%3Aalert(1))");
    // The renderer decodes once and rejects.
    expect(html).not.toMatch(/href\s*=\s*"?javascript:/i);
  });

  it("blocks javascript: image src — emits alt text only", () => {
    const html = renderMarkdown("![evil](javascript:alert(1))");
    expect(html).not.toContain("<img");
    expect(html).toContain("evil");
  });

  it("blocks data: image src", () => {
    const html = renderMarkdown("![evil](data:image/svg+xml,<svg onload=alert(1)/>)");
    expect(html).not.toMatch(/<img[^>]+src\s*=\s*"?data:/i);
  });

  it("escapes raw HTML <script> tags (marked v18 passes them through by default)", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes raw HTML <img onerror=...>", () => {
    const html = renderMarkdown(`<img src=x onerror="alert(1)">`);
    expect(html).not.toMatch(/<img[^>]+onerror/i);
  });

  it("preserves safe https links (regression check)", () => {
    const html = renderMarkdown("[safe](https://example.com)");
    expect(html).toMatch(/<a[^>]+href\s*=\s*"https:\/\/example\.com"/);
    expect(html).toContain("safe");
  });

  it("preserves safe mailto: links", () => {
    const html = renderMarkdown("[email](mailto:x@example.com)");
    expect(html).toMatch(/<a[^>]+href\s*=\s*"mailto:x@example\.com"/);
  });

  it("preserves safe relative + hash links", () => {
    const html = renderMarkdown("[anchor](#section)");
    expect(html).toMatch(/<a[^>]+href\s*=\s*"#section"/);
  });

  it("emits rel=noopener on safe external links", () => {
    const html = renderMarkdown("[safe](https://example.com)");
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
