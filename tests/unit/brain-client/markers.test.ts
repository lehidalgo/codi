import { describe, it, expect } from "vitest";
import { parseMarkers } from "#src/brain-client/markers.js";

describe("parseMarkers", () => {
  it("parses DECISION marker with JSON body", () => {
    const t = `
before
<CODI-DECISION@v1>
{"title": "use Gemini", "reason": "cheaper", "tags": ["llm"]}
</CODI-DECISION@v1>
after`;
    const m = parseMarkers(t);
    expect(m).toHaveLength(1);
    expect(m[0].type).toBe("DECISION");
    expect(m[0].payload).toEqual({
      title: "use Gemini",
      reason: "cheaper",
      tags: ["llm"],
    });
  });

  it("parses HOT and NOTE markers", () => {
    const t = `<CODI-HOT@v1>{"body":"x"}</CODI-HOT@v1>
<CODI-NOTE@v1>{"title":"n","body":"b","tags":["a"]}</CODI-NOTE@v1>`;
    const m = parseMarkers(t);
    expect(m).toHaveLength(2);
    expect(m[0].type).toBe("HOT");
    expect(m[1].type).toBe("NOTE");
  });

  it("skips malformed JSON and records parseErrors", () => {
    const t = `<CODI-DECISION@v1>not json</CODI-DECISION@v1>`;
    const result = parseMarkers(t);
    expect(result).toHaveLength(0);
    expect(result.parseErrors).toHaveLength(1);
  });

  it("survives content with brackets and pipes inside JSON strings", () => {
    const t = `<CODI-NOTE@v1>
{"title": "Option A | Option B [case]", "body": "uses ]brackets[ in text", "tags": []}
</CODI-NOTE@v1>`;
    const m = parseMarkers(t);
    expect(m).toHaveLength(1);
    expect(m[0].payload.title).toBe("Option A | Option B [case]");
    expect(m[0].payload.body).toBe("uses ]brackets[ in text");
  });

  it("multiple DECISION markers are all captured", () => {
    const t = `<CODI-DECISION@v1>{"title":"a"}</CODI-DECISION@v1>
text
<CODI-DECISION@v1>{"title":"b"}</CODI-DECISION@v1>`;
    const m = parseMarkers(t);
    expect(m).toHaveLength(2);
  });
});
