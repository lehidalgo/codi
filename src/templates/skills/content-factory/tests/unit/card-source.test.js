import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  walk,
  findElement,
  setAttributeInOpenTag,
  removeAttributeInOpenTag,
  upsertStyleRule,
  deleteStyleRule,
  listStyleRules,
  writeAtomic,
  readFileSafe,
} from "#src/templates/skills/content-factory/scripts/lib/card-source.cjs";

const CARD = `<article class="social-card" data-type="cover">
  <style>
    .social-card { background: #000; color: #fff; }
    h1 { font-size: 48px; }
  </style>
  <div class="eyebrow">THE BIG IDEA</div>
  <h1>Your rules, your agents.</h1>
  <p>One config. All AI tools. In sync.</p>
  <em>Here's what that looks like.</em>
  <div class="footer">
    <span>@handle</span>
    <span>Swipe →</span>
  </div>
</article>
`;

describe("card-source.walk", () => {
  it("finds the article, style, and text elements", () => {
    const nodes = walk(CARD);
    const names = nodes.map((n) => n.name);
    expect(names).toContain("article");
    expect(names).toContain("style");
    expect(names).toContain("h1");
    expect(names).toContain("em");
  });

  it("records openStart and openEnd byte positions", () => {
    const nodes = walk(CARD);
    const h1 = nodes.find((n) => n.name === "h1");
    expect(h1).toBeDefined();
    const slice = CARD.slice(h1.openStart, h1.openEnd);
    expect(slice).toBe("<h1>");
  });

  it("does not walk inside a <style> block", () => {
    const nodes = walk(CARD);
    const inside = nodes.filter((n) => n.name === "span");
    // spans exist at footer, two of them
    expect(inside).toHaveLength(2);
  });
});

describe("card-source.findElement", () => {
  it("locates an element by tag", () => {
    const node = findElement(CARD, "h1");
    expect(node).not.toBeNull();
    expect(node.name).toBe("h1");
  });

  it("locates by class", () => {
    const node = findElement(CARD, "div.eyebrow");
    expect(node).not.toBeNull();
    expect(node.attrs.class).toBe("eyebrow");
  });

  it("locates by descendant combinator", () => {
    const node = findElement(CARD, "article > h1");
    expect(node).not.toBeNull();
    expect(node.name).toBe("h1");
  });

  it("locates by nth-of-type", () => {
    const first = findElement(CARD, "article > div.footer > span:nth-of-type(1)");
    const second = findElement(CARD, "article > div.footer > span:nth-of-type(2)");
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first).not.toBe(second);
  });

  it("returns null when no element matches", () => {
    expect(findElement(CARD, "nonexistent")).toBeNull();
  });
});

describe("card-source attribute writes", () => {
  it("adds a new attribute into the opening tag", () => {
    const node = findElement(CARD, "h1");
    const out = setAttributeInOpenTag(CARD, node, "data-cf-id", "cf-abc");
    expect(out).toContain('<h1 data-cf-id="cf-abc">');
    // Everything outside the opening tag is unchanged
    expect(out.replace('<h1 data-cf-id="cf-abc">', "<h1>")).toBe(CARD);
  });

  it("replaces an existing attribute", () => {
    const startHtml = CARD.replace("<h1>", '<h1 data-cf-id="cf-old">');
    const node = findElement(startHtml, "h1");
    const out = setAttributeInOpenTag(startHtml, node, "data-cf-id", "cf-new");
    expect(out).toContain('data-cf-id="cf-new"');
    expect(out).not.toContain("cf-old");
  });

  it("removes an attribute cleanly", () => {
    const startHtml = CARD.replace("<h1>", '<h1 data-cf-id="cf-old">');
    const node = findElement(startHtml, "h1");
    const out = removeAttributeInOpenTag(startHtml, node, "data-cf-id");
    expect(out).toBe(CARD);
  });
});

describe("card-source.upsertStyleRule", () => {
  it("adds the sentinel and a rule to the <style> block", () => {
    const out = upsertStyleRule(CARD, '[data-cf-id="cf-abc"]', { color: "#000" });
    expect(out).toContain("/* === cf:user-edits === */");
    expect(out).toContain('[data-cf-id="cf-abc"] { color: #000; }');
    // Authored .social-card and h1 rules still present
    expect(out).toContain(".social-card { background: #000; color: #fff; }");
    expect(out).toContain("h1 { font-size: 48px; }");
  });

  it("creates a <style> block if the card has none", () => {
    const bare = `<article class="social-card"><h1>Hi</h1></article>`;
    const out = upsertStyleRule(bare, '[data-cf-id="cf-x"]', { color: "red" });
    expect(out).toContain("<style>");
    expect(out).toContain("</style>");
    expect(out).toContain('[data-cf-id="cf-x"] { color: red; }');
  });

  it("round-trips multiple upserts without corrupting unrelated rules", () => {
    let text = CARD;
    text = upsertStyleRule(text, '[data-cf-id="cf-1"]', { color: "#111" });
    text = upsertStyleRule(text, '[data-cf-id="cf-2"]', { color: "#222" });
    text = upsertStyleRule(text, '[data-cf-id="cf-1"]', { "font-weight": "900" });
    expect(text).toContain(".social-card { background: #000; color: #fff; }");
    expect(text).toContain("h1 { font-size: 48px; }");
    const rules = listStyleRules(text);
    expect(rules).toHaveLength(2);
  });
});

describe("card-source.deleteStyleRule", () => {
  it("removes a rule and leaves the rest", () => {
    let text = upsertStyleRule(CARD, '[data-cf-id="cf-1"]', { color: "red" });
    text = upsertStyleRule(text, '[data-cf-id="cf-2"]', { color: "blue" });
    text = deleteStyleRule(text, '[data-cf-id="cf-1"]');
    const rules = listStyleRules(text);
    expect(rules).toHaveLength(1);
    expect(rules[0].selector).toBe('[data-cf-id="cf-2"]');
  });
});

describe("card-source.writeAtomic", () => {
  let tmpFile;
  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), "cf-card-" + process.pid + ".html");
    fs.writeFileSync(tmpFile, CARD);
  });
  afterEach(() => {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
  });

  it("writes new content and reads it back", () => {
    writeAtomic(tmpFile, "new content");
    expect(readFileSafe(tmpFile)).toBe("new content");
  });

  it("skips the write when content is unchanged", () => {
    const result = writeAtomic(tmpFile, CARD);
    expect(result.skipped).toBe(true);
    expect(result.bytesWritten).toBe(0);
  });

  it("preserves the file on write errors (atomic semantics)", () => {
    // Simulate a bad path — directory does not exist
    const bad = path.join(os.tmpdir(), "nope-" + process.pid, "x.html");
    expect(() => writeAtomic(bad, "new")).toThrow();
    // Original file untouched
    expect(readFileSafe(tmpFile)).toBe(CARD);
  });
});
