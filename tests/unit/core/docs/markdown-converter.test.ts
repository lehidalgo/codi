import { describe, it, expect } from "vitest";
import {
  esc,
  slugify,
  inline,
  md2html,
} from "#src/core/docs/markdown-converter.js";

describe("esc", () => {
  it("escapes HTML special characters", () => {
    expect(esc('a < b > c & "d"')).toBe("a &lt; b &gt; c &amp; &quot;d&quot;");
  });

  it("returns empty string for empty input", () => {
    expect(esc("")).toBe("");
  });
});

describe("slugify", () => {
  it("lowercases and replaces non-alphanumeric with dashes", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips leading and trailing dashes", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  it("collapses multiple dashes", () => {
    expect(slugify("a   b   c")).toBe("a-b-c");
  });
});

describe("inline", () => {
  it("converts inline code", () => {
    expect(inline("use `const`")).toBe("use <code>const</code>");
  });

  it("converts bold", () => {
    expect(inline("**bold**")).toBe("<strong>bold</strong>");
  });

  it("converts italic", () => {
    expect(inline("*italic*")).toBe("<em>italic</em>");
  });

  it("converts links", () => {
    expect(inline("[text](url)")).toBe('<a href="url">text</a>');
  });

  it("converts images", () => {
    expect(inline("![alt](src.png)")).toBe('<img src="src.png" alt="alt">');
  });

  it("handles multiple inline elements", () => {
    const result = inline("**bold** and `code`");
    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("<code>code</code>");
  });
});

describe("md2html", () => {
  it("converts headings with id slugs", () => {
    const html = md2html("# Hello World");
    expect(html).toBe('<h1 id="hello-world">Hello World</h1>\n');
  });

  it("converts h1 through h6", () => {
    for (let level = 1; level <= 6; level++) {
      const md = "#".repeat(level) + " Heading";
      const html = md2html(md);
      expect(html).toContain(`<h${level}`);
      expect(html).toContain(`</h${level}>`);
    }
  });

  it("converts paragraphs", () => {
    const html = md2html("Hello world");
    expect(html).toBe("<p>Hello world</p>\n");
  });

  it("converts unordered lists", () => {
    const md = "- item 1\n- item 2";
    const html = md2html(md);
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>item 1</li>");
    expect(html).toContain("<li>item 2</li>");
    expect(html).toContain("</ul>");
  });

  it("converts ordered lists", () => {
    const md = "1. first\n2. second";
    const html = md2html(md);
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>first</li>");
    expect(html).toContain("<li>second</li>");
  });

  it("converts fenced code blocks", () => {
    const md = "```typescript\nconst x = 1;\n```";
    const html = md2html(md);
    expect(html).toContain('<pre><code class="language-typescript">');
    expect(html).toContain("const x = 1;");
    expect(html).toContain("</code></pre>");
  });

  it("converts mermaid blocks to div", () => {
    const md = "```mermaid\ngraph TD\nA-->B\n```";
    const html = md2html(md);
    expect(html).toContain('<div class="mermaid"');
    expect(html).toContain("graph TD");
    expect(html).not.toContain("<pre>");
  });

  it("converts tables", () => {
    const md = "| Name | Age |\n| --- | --- |\n| Alice | 30 |";
    const html = md2html(md);
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Name</th>");
    expect(html).toContain("<td>Alice</td>");
    expect(html).toContain("</table>");
  });

  it("converts horizontal rules", () => {
    const html = md2html("---");
    expect(html).toContain("<hr>");
  });

  it("converts blockquotes", () => {
    const md = "> quoted text";
    const html = md2html(md);
    expect(html).toContain("<blockquote>");
    expect(html).toContain("quoted text");
    expect(html).toContain("</blockquote>");
  });

  it("passes through raw HTML", () => {
    const html = md2html("<div>raw</div>");
    expect(html).toContain("<div>raw</div>");
  });

  it("handles empty input", () => {
    expect(md2html("")).toBe("");
  });

  it("closes unclosed code blocks", () => {
    const md = "```js\ncode here";
    const html = md2html(md);
    expect(html).toContain("<pre><code>");
    expect(html).toContain("code here");
  });

  it("closes unclosed lists on empty line", () => {
    const md = "- item\n\nparagraph";
    const html = md2html(md);
    expect(html).toContain("</ul>");
    expect(html).toContain("<p>paragraph</p>");
  });

  it("handles inline formatting in headings", () => {
    const html = md2html("## **Bold** heading");
    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain("<h2");
  });

  it("handles asterisk-style unordered lists", () => {
    const md = "* item 1\n* item 2";
    const html = md2html(md);
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>item 1</li>");
  });
});
