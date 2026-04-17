import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// This test is intentionally thin: it verifies that the URL-pinning logic
// in app.js is structurally present and correct. The full browser behavior
// is not exercised — that would require a headless browser which is out of
// scope for the codi test harness. Instead we assert that:
//   1. restoreFromUrl reads ?project=, ?preset=, ?file=, ?card=.
//   2. updateUrlFromState writes those same keys.
//   3. The boot sequence calls restoreFromUrl BEFORE falling back to
//      /api/preset.
//   4. Every state mutation that should update the URL does so.
//
// This is a smoke test on the source code of app.js — it guarantees that
// a refactor cannot silently drop the URL-pin behavior.

// The app was modularized into generators/lib/*.js — read them all so
// structural assertions find functions regardless of which module owns
// them. URL-pinning functions stay in app.js; session/template/card
// helpers that trigger URL updates live in lib/.
const generatorsDir = path.resolve(__dirname, "../../generators");
function readAllGeneratorJs() {
  const files = [path.join(generatorsDir, "app.js")];
  const libDir = path.join(generatorsDir, "lib");
  if (fs.existsSync(libDir)) {
    for (const f of fs.readdirSync(libDir)) {
      if (f.endsWith(".js")) files.push(path.join(libDir, f));
    }
  }
  return files.map((f) => fs.readFileSync(f, "utf-8")).join("\n/* ---- */\n");
}
const APP_JS = readAllGeneratorJs();

describe("URL pinning — app.js source structure", () => {
  it("defines restoreFromUrl that reads the unified query params", () => {
    expect(APP_JS).toContain("async function restoreFromUrl");
    expect(APP_JS).toContain('params.get("kind")');
    expect(APP_JS).toContain('params.get("id")');
    expect(APP_JS).toContain('params.get("card")');
  });

  it("still honors legacy ?project and ?preset params for back-compat", () => {
    expect(APP_JS).toContain("legacyProject");
    expect(APP_JS).toContain("legacyPreset");
  });

  it("defines updateUrlFromState that writes the unified keys", () => {
    expect(APP_JS).toContain("function updateUrlFromState");
    expect(APP_JS).toContain('p.set("kind"');
    expect(APP_JS).toContain('p.set("id"');
    expect(APP_JS).toContain('p.set("file"');
    expect(APP_JS).toContain('p.set("card"');
  });

  it("uses history.replaceState to pin the URL without navigation", () => {
    expect(APP_JS).toContain("history.replaceState");
  });

  it("invokes restoreFromUrl during boot BEFORE the /api/preset fallback", () => {
    const restoreIdx = APP_JS.indexOf("const restored = await restoreFromUrl");
    const presetFallbackIdx = APP_JS.indexOf('fetch("/api/preset")');
    expect(restoreIdx).toBeGreaterThan(-1);
    expect(presetFallbackIdx).toBeGreaterThan(-1);
    // restoreFromUrl must appear before the /api/preset fetch in boot code.
    expect(restoreIdx).toBeLessThan(presetFallbackIdx);
  });

  it("skips the /api/preset fallback when restoreFromUrl succeeds", () => {
    // The boot chain must `return null` when restored is true so the next
    // .then does not process stale /api/preset data.
    expect(APP_JS).toMatch(/if \(restored\) return null/);
  });

  it("calls _cfUpdateUrl from setActiveCard", () => {
    // setActiveCard already exists; we just need to confirm the URL sync.
    const fnStart = APP_JS.indexOf("function setActiveCard");
    const fnSlice = APP_JS.slice(fnStart, fnStart + 800);
    expect(fnSlice).toContain("_cfUpdateUrl");
  });

  it("calls _cfUpdateUrl from loadSessionContent", () => {
    const fnStart = APP_JS.indexOf("async function loadSessionContent");
    const fnEnd = APP_JS.indexOf("async function", fnStart + 20);
    const fnSlice = APP_JS.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 4000);
    expect(fnSlice).toContain("_cfUpdateUrl");
  });

  it("calls _cfUpdateUrl after selectTemplate loads cards", () => {
    const fnStart = APP_JS.indexOf("async function selectTemplate");
    const fnEnd = APP_JS.indexOf("async function", fnStart + 20);
    const fnSlice = APP_JS.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 4000);
    expect(fnSlice).toContain("_cfUpdateUrl");
  });

  it("exposes the URL helpers on window so other code can call them", () => {
    expect(APP_JS).toContain("window._cfUpdateUrl = updateUrlFromState");
    expect(APP_JS).toContain("window._cfRestoreFromUrl = restoreFromUrl");
  });
});
