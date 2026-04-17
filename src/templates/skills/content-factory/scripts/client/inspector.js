/* html-live-inspect — injected browser inspector
 *
 * Loaded from /__inspect/inspector.js on every HTML response.
 * Responsibilities:
 *   - Draw a hover outline on DOM elements
 *   - Lock a selection on click (Alt+click to unlock)
 *   - Build a full context snapshot and POST it to /__inspect/ingest
 *   - Record interactions (click, input, submit, scroll, navigation)
 *   - Long-poll /__inspect/eval-pull; run received JS; POST result back
 *
 * Communicates only with its own origin. No external network calls.
 */
(function () {
  "use strict";
  if (window.__HLI__) return; // already injected

  // ========== Configuration ==========

  const API = {
    ingest: "/__inspect/ingest",
    pull: "/__inspect/eval-pull",
    push: "/__inspect/eval-push",
  };
  const TEXT_LIMIT = 500;
  const HTML_LIMIT = 2048;
  const PARENT_DEPTH = 5;
  const EVENT_FLUSH_MS = 250;
  const CURATED_STYLES = [
    "display",
    "position",
    "visibility",
    "opacity",
    "z-index",
    "width",
    "height",
    "min-width",
    "min-height",
    "max-width",
    "max-height",
    "margin",
    "padding",
    "border",
    "border-radius",
    "box-sizing",
    "color",
    "background-color",
    "background-image",
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "text-align",
    "text-transform",
    "flex-direction",
    "justify-content",
    "align-items",
    "gap",
    "grid-template-columns",
    "grid-template-rows",
    "cursor",
    "overflow",
  ];

  // ========== Sequence counters ==========

  let selectionSeq = 0;
  let eventQueue = [];
  let flushTimer = null;

  // ========== Selector builder ==========

  function buildSelector(el) {
    if (!el || !(el instanceof Element)) return null;
    if (el === document.body) return "body";
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body && parts.length < 10) {
      let part = node.nodeName.toLowerCase();
      if (node.id) {
        part += "#" + node.id;
        parts.unshift(part);
        break;
      }
      const parent = node.parentNode;
      if (parent && parent.children) {
        const same = Array.from(parent.children).filter((c) => c.nodeName === node.nodeName);
        if (same.length > 1) {
          const idx = same.indexOf(node) + 1;
          part += ":nth-of-type(" + idx + ")";
        }
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    if (parts.length && parts[0] !== "body" && parts[0].indexOf("#") === -1) {
      parts.unshift("body");
    }
    return parts.join(" > ");
  }

  function truncate(s, n) {
    if (s == null) return "";
    const str = String(s);
    return str.length > n ? str.slice(0, n) + "…" : str;
  }

  function attributesOf(el) {
    const out = {};
    if (!el.attributes) return out;
    for (const attr of el.attributes) {
      out[attr.name] = attr.value;
    }
    return out;
  }

  function cfIdOf(el) {
    if (!el) return null;
    if (el.id) return el.id;
    const dataAttr = el.getAttribute ? el.getAttribute("data-cf-id") : null;
    return dataAttr || null;
  }

  function classesOf(el) {
    if (!el.classList) return [];
    return Array.from(el.classList);
  }

  function curatedStyles(el) {
    const cs = getComputedStyle(el);
    const out = {};
    for (const key of CURATED_STYLES) {
      out[key] = cs.getPropertyValue(key);
    }
    return out;
  }

  function parentChain(el) {
    const chain = [];
    let node = el.parentElement;
    while (node && chain.length < PARENT_DEPTH && node !== document.documentElement) {
      chain.push({
        tag: node.nodeName.toLowerCase(),
        id: node.id || "",
        classes: classesOf(node),
        selector: buildSelector(node),
      });
      node = node.parentElement;
    }
    return chain;
  }

  function describe(elOrSelector) {
    let el = elOrSelector;
    if (typeof elOrSelector === "string") {
      try {
        el = document.querySelector(elOrSelector);
      } catch {
        return null;
      }
    }
    if (!el || !(el instanceof Element)) return null;
    const rect = el.getBoundingClientRect();
    selectionSeq++;
    return {
      seq: selectionSeq,
      timestamp: Date.now(),
      selector: buildSelector(el),
      tag: el.nodeName.toLowerCase(),
      id: el.id || "",
      classes: classesOf(el),
      attributes: attributesOf(el),
      cfId: cfIdOf(el),
      parentTag: el.parentElement ? el.parentElement.nodeName.toLowerCase() : "",
      text: truncate(el.textContent, TEXT_LIMIT),
      outerHTMLSnippet: truncate(el.outerHTML, HTML_LIMIT),
      boundingRect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      computedStyles: curatedStyles(el),
      parentChain: parentChain(el),
      childrenCount: el.children ? el.children.length : 0,
      pageUrl: location.href,
      pageTitle: document.title,
    };
  }

  // ========== Overlay ==========

  const overlay = document.createElement("div");
  overlay.setAttribute("data-hli-overlay", "");
  overlay.style.cssText = [
    "position:fixed",
    "pointer-events:none",
    "z-index:2147483646",
    "border:2px dashed #ff00aa",
    "background:rgba(255,0,170,0.08)",
    "transition:all 60ms linear",
    "display:none",
  ].join(";");

  const lockedOverlay = overlay.cloneNode();
  lockedOverlay.style.border = "2px solid #00aaff";
  lockedOverlay.style.background = "rgba(0,170,255,0.12)";

  // Multi-selection overlays (Cmd/Ctrl+click to add)
  const multiOverlays = new Map(); // selector -> div
  const multiBadge = document.createElement("div");
  multiBadge.setAttribute("data-hli-badge", "");
  multiBadge.style.cssText = [
    "position:fixed",
    "right:12px",
    "bottom:12px",
    "z-index:2147483647",
    "background:#0a84ff",
    "color:#fff",
    "font:600 12px/1 system-ui,sans-serif",
    "padding:8px 12px",
    "border-radius:999px",
    "box-shadow:0 4px 12px rgba(0,0,0,0.2)",
    "pointer-events:none",
    "display:none",
  ].join(";");

  function attachOverlays() {
    if (!document.body) return;
    if (!overlay.isConnected) document.body.appendChild(overlay);
    if (!lockedOverlay.isConnected) document.body.appendChild(lockedOverlay);
    if (!multiBadge.isConnected) document.body.appendChild(multiBadge);
  }

  function makeMultiOverlay() {
    const d = document.createElement("div");
    d.setAttribute("data-hli-multi", "");
    d.style.cssText = [
      "position:fixed",
      "pointer-events:none",
      "z-index:2147483645",
      "border:2px solid #ffaa00",
      "background:rgba(255,170,0,0.12)",
      "transition:all 60ms linear",
    ].join(";");
    return d;
  }

  function repositionAllMulti() {
    for (const [sel, node] of multiOverlays) {
      try {
        const el = document.querySelector(sel);
        if (!el) {
          node.style.display = "none";
          continue;
        }
        positionOverlay(node, el);
      } catch {
        node.style.display = "none";
      }
    }
    updateBadge();
  }

  function updateBadge() {
    const n = multiOverlays.size;
    if (n === 0) {
      multiBadge.style.display = "none";
      return;
    }
    multiBadge.style.display = "block";
    multiBadge.textContent = n + " selected — Alt+click to clear";
  }

  function positionOverlay(node, el) {
    if (!el) {
      node.style.display = "none";
      return;
    }
    const r = el.getBoundingClientRect();
    node.style.display = "block";
    node.style.left = r.left + "px";
    node.style.top = r.top + "px";
    node.style.width = r.width + "px";
    node.style.height = r.height + "px";
  }

  // ========== Network ==========

  // Card context injected by the parent app into each srcdoc BEFORE this
  // script runs. Shape: { project, file, cardIndex, templateId }. Any field
  // may be null (e.g. project is null when viewing a built-in template).
  // null in non-content-factory contexts (html-live-inspect has no parent).
  function getCardContext() {
    try {
      return window.__CF_CARD_CONTEXT__ || null;
    } catch {
      return null;
    }
  }

  function post(url, body) {
    const ctx = getCardContext();
    const payload = ctx ? Object.assign({ context: ctx }, body) : body;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "omit",
      keepalive: true,
    }).catch(() => null);
  }

  function enqueueEvent(ev) {
    eventQueue.push(ev);
    if (!flushTimer) {
      flushTimer = setTimeout(flushEvents, EVENT_FLUSH_MS);
    }
  }

  function flushEvents() {
    flushTimer = null;
    if (!eventQueue.length) return;
    const batch = eventQueue;
    eventQueue = [];
    post(API.ingest, { events: batch });
  }

  function sendPage() {
    post(API.ingest, {
      page: {
        url: location.href,
        title: document.title,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        userAgent: navigator.userAgent,
      },
    });
  }

  function sendSelection(snapshot) {
    post(API.ingest, { selection: snapshot });
  }

  // ========== Event handlers ==========

  let hoverTarget = null;
  let lockedTarget = null;

  function isOverlayNode(node) {
    return node === overlay || node === lockedOverlay;
  }

  function isDormant() {
    return window.__HLI_DORMANT__ === true;
  }

  function hideAllOverlays() {
    positionOverlay(overlay, null);
    positionOverlay(lockedOverlay, null);
    for (const node of multiOverlays.values()) node.style.display = "none";
    multiBadge.style.display = "none";
  }

  function restoreOverlays() {
    if (lockedTarget) positionOverlay(lockedOverlay, lockedTarget);
    repositionAllMulti();
  }

  // Public control so the parent frame can flip dormant state at runtime.
  function setDormant(value) {
    window.__HLI_DORMANT__ = Boolean(value);
    if (window.__HLI_DORMANT__) hideAllOverlays();
    else restoreOverlays();
  }

  function onMouseOver(e) {
    if (isDormant()) return;
    if (isOverlayNode(e.target)) return;
    hoverTarget = e.target instanceof Element ? e.target : null;
    positionOverlay(overlay, hoverTarget);
  }

  function onMouseOut() {
    if (isDormant()) return;
    hoverTarget = null;
    positionOverlay(overlay, null);
  }

  function onClick(e) {
    if (isDormant()) return;
    if (isOverlayNode(e.target)) return;
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    // Alt+click = clear EVERYTHING (single + multi)
    if (e.altKey) {
      lockedTarget = null;
      positionOverlay(lockedOverlay, null);
      for (const node of multiOverlays.values()) node.remove();
      multiOverlays.clear();
      updateBadge();
      post(API.ingest, { clearSelection: true, clearSelectionSet: true });
      return;
    }

    const snapshot = describe(target);
    const sel = snapshot ? snapshot.selector : buildSelector(target);

    // Cmd/Ctrl+click = toggle membership in the multi-selection set
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      if (multiOverlays.has(sel)) {
        const node = multiOverlays.get(sel);
        if (node) node.remove();
        multiOverlays.delete(sel);
        post(API.ingest, { selectionSetOp: { op: "remove", selector: sel } });
      } else {
        const node = makeMultiOverlay();
        document.body.appendChild(node);
        positionOverlay(node, target);
        multiOverlays.set(sel, node);
        if (snapshot) post(API.ingest, { selectionSetOp: { op: "add", snapshot } });
      }
      updateBadge();
      return;
    }

    // Plain click = replace the single current selection
    lockedTarget = target;
    positionOverlay(lockedOverlay, target);
    if (snapshot) sendSelection(snapshot);

    enqueueEvent({
      type: "click",
      selector: sel,
      tag: target.nodeName.toLowerCase(),
      id: target.id || null,
      text: truncate(target.textContent, 200),
      pageUrl: location.href,
    });
  }

  function onInput(e) {
    if (isDormant()) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    const tag = t.nodeName.toLowerCase();
    if (tag !== "input" && tag !== "textarea" && tag !== "select") return;
    enqueueEvent({
      type: "input",
      selector: buildSelector(t),
      tag,
      id: t.id || null,
      value: t.value,
      pageUrl: location.href,
    });
  }

  function onSubmit(e) {
    if (isDormant()) return;
    const t = e.target;
    enqueueEvent({
      type: "submit",
      selector: t instanceof Element ? buildSelector(t) : null,
      tag: "form",
      pageUrl: location.href,
    });
  }

  let scrollTimer = null;
  function onScroll() {
    if (scrollTimer) return;
    scrollTimer = setTimeout(() => {
      scrollTimer = null;
      enqueueEvent({
        type: "scroll",
        scrollY: window.scrollY,
        pageUrl: location.href,
      });
    }, 300);
  }

  function onResize() {
    sendPage();
  }

  // ========== Eval long-poll loop ==========

  function runEvalTask(task) {
    let result;
    let ok = true;
    let error = null;
    try {
      const fn = new Function(task.js);
      result = fn();
    } catch (e) {
      ok = false;
      error = e && e.message ? e.message : String(e);
    }
    // Serializability guard
    try {
      JSON.stringify(result);
    } catch {
      try {
        result = String(result);
      } catch {
        result = "[unserializable]";
      }
    }
    post(API.push, { id: task.id, ok, result, error });
  }

  async function evalLoop() {
    // Runs forever; each iteration long-polls for a task.
    while (true) {
      try {
        const res = await fetch(API.pull, { credentials: "omit" });
        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        const data = await res.json();
        if (data && data.task) {
          runEvalTask(data.task);
        }
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  // ========== Boot ==========

  function boot() {
    attachOverlays();
    sendPage();

    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("mouseout", onMouseOut, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener(
      "scroll",
      () => {
        onScroll();
        repositionAllMulti();
        if (lockedTarget) positionOverlay(lockedOverlay, lockedTarget);
      },
      { passive: true },
    );
    window.addEventListener("resize", () => {
      onResize();
      repositionAllMulti();
      if (lockedTarget) positionOverlay(lockedOverlay, lockedTarget);
    });
    window.addEventListener("popstate", sendPage);
    window.addEventListener("beforeunload", () => {
      post(API.ingest, {
        events: [{ type: "navigation", pageUrl: location.href }],
      });
    });

    // Start eval loop (inspector may or may not actually receive work)
    evalLoop();
  }

  // Public handle — used by /api/dom via the eval bridge
  window.__HLI__ = {
    version: 2,
    describe,
    buildSelector,
    setDormant,
    isDormant,
    listSelections() {
      return Array.from(multiOverlays.keys());
    },
    highlight(selectorOrList, ms) {
      const list = Array.isArray(selectorOrList) ? selectorOrList : [selectorOrList];
      const nodes = [];
      for (const sel of list) {
        try {
          const els = document.querySelectorAll(sel);
          for (const el of els) {
            const prev = el.style.outline;
            el.style.outline = "3px solid magenta";
            nodes.push({ el, prev });
          }
        } catch {}
      }
      setTimeout(
        () => {
          for (const { el, prev } of nodes) el.style.outline = prev || "";
        },
        Number.isFinite(ms) ? ms : 1500,
      );
      return nodes.length;
    },
    previewQuery(selector) {
      try {
        return document.querySelectorAll(selector).length;
      } catch {
        return -1;
      }
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
