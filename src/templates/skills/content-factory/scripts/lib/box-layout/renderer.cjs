'use strict';

// Renders an HTML string (or file) in headless chromium and extracts a
// raw DOM tree with computed geometry and the CSS properties the rule
// engine needs.

const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

async function loadPlaywright() {
  try {
    const mod = await import('playwright');
    return mod;
  } catch (err) {
    const msg =
      'playwright not installed. Run: bash scripts/setup-validation.sh';
    const e = new Error(msg);
    e.cause = err;
    throw e;
  }
}

// Lightweight probe: verifies that the playwright module can be imported,
// without launching a browser. Used by the validator wrapper to decide
// whether to enter degraded mode on startup.
async function probePlaywright() {
  try {
    await import('playwright');
    return true;
  } catch {
    return false;
  }
}

// Persistent browser reused across calls. Launched lazily on first use and
// self-healing: a crashed Chromium (common on macOS — e.g. Mach port
// rendezvous failures) used to strand the singleton in a broken state
// forever, because the cached handle was still returned. Export endpoints
// then served the same stale error until the Node server itself restarted.
// Now every call verifies the cached handle via isConnected() and relaunches
// if the browser is dead. Concurrent calls share a single in-flight launch
// promise to avoid spawning duplicate browsers under parallel export load.
let _browser = null;
let _launchPromise = null;

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;
  if (_launchPromise) return _launchPromise;

  if (_browser) {
    const stale = _browser;
    _browser = null;
    stale.close().catch(() => { /* already dead */ });
  }

  const { chromium } = await loadPlaywright();
  // chromiumSandbox: false disables Chromium's internal sandbox so the
  // browser can boot inside outer sandboxes (Codex Seatbelt, Docker, CI
  // containers) where Chromium would otherwise SIGTRAP at launch. The
  // outer sandbox remains the security boundary.
  const launchOptions = { chromiumSandbox: false };
  // Under Codex's Seatbelt sandbox, Chromium's multi-process model breaks:
  // the renderer/GPU/network helpers talk to the browser process via Mach
  // IPC, and Seatbelt denies `org.chromium.Chromium.MachPortRendezvousServer`
  // lookups. --single-process collapses every Chromium subsystem into a
  // single OS process, eliminating the IPC dependency. Slower (no parallel
  // renderers) but boots reliably inside the sandbox. Gated on CODEX_SANDBOX
  // (set by Codex per its public contract) so Claude Code, Docker, CI, and
  // local terminals keep the faster multi-process default.
  if (process.env.CODEX_SANDBOX) {
    launchOptions.args = ['--single-process'];
  }
  _launchPromise = chromium.launch(launchOptions)
    .then((browser) => {
      _browser = browser;
      // Clear the cache proactively when Chromium exits so the next request
      // relaunches instead of polling isConnected() on a disconnected handle.
      browser.on('disconnected', () => {
        if (_browser === browser) _browser = null;
      });
      return browser;
    })
    .finally(() => { _launchPromise = null; });
  return _launchPromise;
}

async function closeBrowser() {
  if (_browser) {
    try { await _browser.close(); } catch { /* browser may have crashed */ }
    _browser = null;
  }
}

/**
 * Render and extract the annotated tree from the first child of <body>.
 * Accepts either an absolute file path OR an inline HTML string.
 */
async function renderAndExtract({ inputPath, html, width, height }) {
  const browser = await getBrowser();
  const htmlSource = html != null ? html : await fs.readFile(inputPath, 'utf8');

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  try {
    if (html != null) {
      await page.setContent(htmlSource, { waitUntil: 'networkidle' });
    } else {
      await page.goto(pathToFileURL(inputPath).href, { waitUntil: 'networkidle' });
    }

    const tree = await page.evaluate(extractInBrowser);
    if (!tree) {
      throw new Error('no root element found (body has no children)');
    }
    return tree;
  } finally {
    await context.close();
  }
}

// Runs inside the browser context. Must be self-contained.
function extractInBrowser() {
  function ownText(el) {
    let t = '';
    for (const n of el.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) t += n.nodeValue || '';
    }
    return t.trim();
  }

  function measureTextWidth(el) {
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      if (range.detach) range.detach();
      return r.width;
    } catch {
      return 0;
    }
  }

  function walk(el, path) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return null;

    const rect = el.getBoundingClientRect();
    const children = [];
    let idx = 0;
    for (const child of el.children) {
      const childPath = `${path} > ${child.tagName.toLowerCase()}${
        child.id ? '#' + child.id : ''
      }[${idx}]`;
      const walked = walk(child, childPath);
      if (walked) children.push(walked);
      idx += 1;
    }

    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: Array.from(el.classList),
      path,
      rect: {
        x: rect.x,
        y: rect.y,
        w: rect.width,
        h: rect.height,
        scrollW: el.scrollWidth,
        scrollH: el.scrollHeight,
        clientW: el.clientWidth,
        clientH: el.clientHeight,
        textW: measureTextWidth(el),
        justify: cs.justifyContent,
        textAlign: cs.textAlign,
      },
      css: {
        display: cs.display,
        flexDirection: cs.flexDirection,
        flexWrap: cs.flexWrap,
        gridTemplateColumns: cs.gridTemplateColumns,
        gap: parseFloat(cs.rowGap) || parseFloat(cs.gap) || 0,
        columnGap: parseFloat(cs.columnGap) || 0,
        rowGap: parseFloat(cs.rowGap) || 0,
        paddingTop: parseFloat(cs.paddingTop) || 0,
        paddingRight: parseFloat(cs.paddingRight) || 0,
        paddingBottom: parseFloat(cs.paddingBottom) || 0,
        paddingLeft: parseFloat(cs.paddingLeft) || 0,
        justifyContent: cs.justifyContent,
        backgroundColor: cs.backgroundColor,
        borderWidth: parseFloat(cs.borderTopWidth) + parseFloat(cs.borderRightWidth) + parseFloat(cs.borderBottomWidth) + parseFloat(cs.borderLeftWidth),
        boxShadow: cs.boxShadow,
      },
      dataBoxGroup: el.getAttribute('data-box-group'),
      textContent: ownText(el),
      children,
    };
  }

  const root = document.body.firstElementChild;
  if (!root) return null;
  return walk(root, root.tagName.toLowerCase());
}

module.exports = { renderAndExtract, closeBrowser, probePlaywright, getBrowser };
