/**
 * Codi Preview Shell — resizable left sidebar, mode-aware.
 *
 * Structure: fixed sidebar (header + scrollable body + resize handle)
 *   slides   — deck engine owns navigation; shell adds sidebar + PNG export
 *   document — full vertical scroll; shell offsets body margin with sidebar width
 *   social   — aspect-ratio switcher + scale-to-fit scrollable card list
 */
(function () {
  "use strict";

  var EXPORT_SCALE = 2;
  var EXPORT_DELAY_MS = 300;
  var SIDEBAR_W = 260; // initial expanded width (px)
  var MINI_W = 44; // collapsed icon-strip width (px)
  var SIDEBAR_MIN = 180; // drag minimum
  var SIDEBAR_MAX = 420; // drag maximum
  var DOC_PAGE_W = 794; // A4 reference width (px)

  var SOCIAL_PRESETS = [
    { label: "1:1  LinkedIn", w: 1080, h: 1080 },
    { label: "4:5  Instagram", w: 1080, h: 1350 },
    { label: "9:16 Story", w: 1080, h: 1920 },
    { label: "1200\xd7630 OG", w: 1200, h: 630 },
  ];

  var SLIDE_W = 1280; // slide reference width (px)
  var SLIDE_H = 720; // slide reference height (px)

  var sidebarOpen = true;
  var sidebarEl = null;
  var bodyEl = null; // scrollable inner container
  var onReflow = null; // callback set by each mode to reflow content
  var onSelectionChange = null; // callback fired when selectedPages changes
  var userZoom = 1; // user-controlled zoom multiplier (0.25 – 2.0)
  var selectedPages = new Set(); // pages/slides selected for scoped logo ops

  // ── Mode detection ────────────────────────────────────────────────────────────
  function detectMode() {
    if (document.querySelector(".deck")) return "slides";
    if (document.querySelector(".doc-page")) return "document";
    return "social";
  }

  // ── DOM helpers ───────────────────────────────────────────────────────────────
  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function sep() {
    return el("hr", "cf-sep");
  }

  function section(title) {
    var wrap = el("div", "cf-section");
    if (title) {
      var h = el("div", "cf-section-title");
      h.textContent = title;
      wrap.appendChild(h);
    }
    return wrap;
  }

  function btn(label, onClick, active) {
    var b = el("button", "cf-btn");
    b.textContent = label;
    if (active) b.classList.add("cf-active");
    b.addEventListener("click", onClick);
    return b;
  }

  function sidebarWidth() {
    return sidebarOpen ? SIDEBAR_W : MINI_W;
  }

  function setSidebarVar(w) {
    document.documentElement.style.setProperty("--sidebar-w", w + "px");
  }

  // ── Sidebar factory ───────────────────────────────────────────────────────────
  function buildSidebar() {
    var bar = el("div", "cf-toolbar");
    document.body.prepend(bar);
    sidebarEl = bar;

    // ── Header: Codi brand + collapse toggle
    var header = el("div", "cf-header");

    var brand = el("div", "cf-brand");
    var brandIcon = el("span", "cf-brand-icon");
    brandIcon.textContent = "\u25c6"; // ◆ solid diamond
    var brandLabel = el("span", "cf-brand-label");
    brandLabel.textContent = "codi";
    brand.appendChild(brandIcon);
    brand.appendChild(brandLabel);

    var toggleBtn = el("button", "cf-toggle-btn");
    toggleBtn.innerHTML = "&#8249;"; // ‹ left chevron
    toggleBtn.title = "Collapse sidebar";
    toggleBtn.addEventListener("click", function () {
      sidebarOpen = !sidebarOpen;
      var w = sidebarWidth();
      bar.style.width = w + "px";
      bar.classList.toggle("cf-collapsed", !sidebarOpen);
      toggleBtn.innerHTML = sidebarOpen ? "&#8249;" : "&#8250;"; // ‹ / ›
      toggleBtn.title = sidebarOpen ? "Collapse sidebar" : "Expand sidebar";
      setSidebarVar(w);
      if (onReflow) onReflow(w);
    });

    header.appendChild(brand);
    header.appendChild(toggleBtn);
    bar.appendChild(header);

    // ── Scrollable body
    var body = el("div", "cf-body");
    bar.appendChild(body);
    bodyEl = body;

    // ── Resize handle (drag right edge)
    var handle = el("div", "cf-resize-handle");
    bar.appendChild(handle);

    var isResizing = false,
      startX,
      startW;
    handle.addEventListener("mousedown", function (e) {
      if (!sidebarOpen) return;
      isResizing = true;
      startX = e.clientX;
      startW = bar.offsetWidth;
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onDrag);
      document.addEventListener("mouseup", stopDrag, { once: true });
    });
    function onDrag(e) {
      if (!isResizing) return;
      var newW = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startW + (e.clientX - startX)));
      SIDEBAR_W = newW;
      bar.style.width = newW + "px";
      setSidebarVar(newW);
      if (onReflow) onReflow(newW);
    }
    function stopDrag() {
      isResizing = false;
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onDrag);
    }

    return { bar: bar, body: body };
  }

  // ── PNG export helpers ────────────────────────────────────────────────────────

  // html2canvas clones the DOM before rendering and serialises SVGs as data-URI
  // images — but this clone loses the page's stylesheets, so CSS-only fill/stroke
  // colours (e.g. .logo path { fill:#001391 }) disappear.
  //
  // Fix: snapshot computed fill/stroke/opacity from every SVG child in the LIVE
  // DOM (getComputedStyle only works there), then use the onclone callback to
  // apply those values as explicit XML attributes in the cloned document before
  // html2canvas serialises it.  No live-DOM mutation required.
  // Pre-render one live SVG to an <img> with computed fills inlined as attributes.
  // Strips style= and class= from the clone root so CSS positioning rules
  // (e.g. position:absolute; left:85%) don't push content off-screen when the
  // SVG is loaded as a standalone data-URI image.
  function svgToImg(svg) {
    return new Promise(function (resolve) {
      var rect = svg.getBoundingClientRect();
      var clone = svg.cloneNode(true);
      clone.removeAttribute("class");
      clone.removeAttribute("style");

      // Render at export scale for crisp output
      var rw = Math.round(rect.width * EXPORT_SCALE) || 100;
      var rh = Math.round(rect.height * EXPORT_SCALE) || 100;
      clone.setAttribute("width", rw);
      clone.setAttribute("height", rh);

      // Inline computed fill/stroke onto every descendant element
      var livePaths = svg.querySelectorAll("*");
      var clonePaths = clone.querySelectorAll("*");
      livePaths.forEach(function (lp, i) {
        var cp = clonePaths[i];
        if (!cp) return;
        var cs = window.getComputedStyle(lp);
        if (cs.fill && cs.fill !== "none" && !cs.fill.startsWith("url")) {
          cp.setAttribute("fill", cs.fill);
          cp.style.fill = cs.fill;
        }
        if (cs.stroke && cs.stroke !== "none" && !cs.stroke.startsWith("url")) {
          cp.setAttribute("stroke", cs.stroke);
          cp.style.stroke = cs.stroke;
        }
        if (cs.opacity && cs.opacity !== "1") cp.setAttribute("opacity", cs.opacity);
        if (cs.fillOpacity && cs.fillOpacity !== "1")
          cp.setAttribute("fill-opacity", cs.fillOpacity);
        if (cs.strokeOpacity && cs.strokeOpacity !== "1")
          cp.setAttribute("stroke-opacity", cs.strokeOpacity);
      });

      var xml = new XMLSerializer().serializeToString(clone);
      var uri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = uri;
    });
  }

  // Capture target as a PNG canvas, compositing SVGs via data-URI images to
  // preserve CSS-only fills that html2canvas strips when serializing SVGs.
  function capture(target, w, h) {
    // Record each visible SVG's position relative to target BEFORE hiding
    var targetRect = target.getBoundingClientRect();
    var svgEntries = Array.from(target.querySelectorAll("svg"))
      .filter(function (svg) {
        var r = svg.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map(function (svg) {
        var r = svg.getBoundingClientRect();
        return {
          svg: svg,
          cx: (r.left - targetRect.left) * EXPORT_SCALE,
          cy: (r.top - targetRect.top) * EXPORT_SCALE,
          cw: r.width * EXPORT_SCALE,
          ch: r.height * EXPORT_SCALE,
        };
      });

    // Pre-render SVG images before hiding anything
    return Promise.all(
      svgEntries.map(function (e) {
        return svgToImg(e.svg).then(function (img) {
          e.img = img;
          return e;
        });
      }),
    ).then(function (entries) {
      // Hide SVGs so html2canvas captures the slide/page background only
      svgEntries.forEach(function (e) {
        e.svg.style.visibility = "hidden";
      });

      return html2canvas(target, {
        scale: EXPORT_SCALE,
        width: w,
        height: h,
        windowWidth: w,
        windowHeight: h,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
      }).then(function (h2cCanvas) {
        // Restore SVGs
        svgEntries.forEach(function (e) {
          e.svg.style.visibility = "";
        });

        // html2canvas returns a GPU-backed canvas that is read-only after render.
        // Copy to a fresh CPU canvas so we can composite SVG images on top.
        var fresh = document.createElement("canvas");
        fresh.width = h2cCanvas.width;
        fresh.height = h2cCanvas.height;
        var ctx = fresh.getContext("2d");
        ctx.drawImage(h2cCanvas, 0, 0);

        // Composite each pre-rendered SVG image at the correct canvas coordinates
        entries.forEach(function (e) {
          if (e.img && e.cw > 0 && e.ch > 0) {
            ctx.drawImage(e.img, e.cx, e.cy, e.cw, e.ch);
          }
        });

        return fresh;
      });
    });
  }

  function download(canvas, filename) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        resolve();
      }, "image/png");
    });
  }

  // Collect {canvas, name} entries and bundle into a single ZIP download.
  // Falls back to sequential individual downloads if JSZip is unavailable.
  function downloadAsZip(entries, zipName) {
    if (typeof JSZip === "undefined") {
      // Fallback: download individually
      return entries.reduce(function (chain, entry) {
        return chain.then(function () {
          return download(entry.canvas, entry.name);
        });
      }, Promise.resolve());
    }
    var zip = new JSZip();
    return Promise.all(
      entries.map(function (entry) {
        return new Promise(function (resolve) {
          entry.canvas.toBlob(function (blob) {
            zip.file(entry.name, blob);
            resolve();
          }, "image/png");
        });
      }),
    )
      .then(function () {
        return zip.generateAsync({ type: "blob" });
      })
      .then(function (blob) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = zipName;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  }

  function exportName(node, prefix) {
    return (
      prefix +
      "-" +
      String(node.dataset.index || "01").padStart(2, "0") +
      "-" +
      (node.dataset.type || "item") +
      ".png"
    );
  }

  // Wraps a page/card in a flex row and appends a right rail with select + export buttons.
  function attachPageRail(page, onExport) {
    var wrapper = el("div", "cf-page-wrapper");
    page.parentNode.insertBefore(wrapper, page);
    wrapper.appendChild(page);

    var rail = el("div", "cf-page-rail");

    var selBtn = el("button", "cf-rail-btn");
    selBtn.innerHTML = "&#9643;"; // ▣
    selBtn.title = "Select for logo controls";
    selBtn.addEventListener("click", function () {
      var on = wrapper.classList.toggle("cf-page-selected");
      selBtn.classList.toggle("cf-active", on);
      if (on) selectedPages.add(page);
      else selectedPages.delete(page);
      if (onSelectionChange) onSelectionChange();
    });

    var expBtn = el("button", "cf-rail-btn");
    expBtn.textContent = "PNG";
    expBtn.title = "Export as PNG";
    expBtn.addEventListener("click", function () {
      expBtn.disabled = true;
      onExport(page).then(function () {
        expBtn.disabled = false;
      });
    });

    rail.appendChild(selBtn);
    rail.appendChild(expBtn);
    wrapper.appendChild(rail);
  }

  // ── SLIDES MODE ───────────────────────────────────────────────────────────────
  // Design: keep deck engine layout intact (one slide at a time, keyboard nav).
  // Only shift .deck rightward past the sidebar. Prev/Next/Export live in the sidebar.
  function initSlides() {
    injectStyle(slidesCSS());

    var sb = buildSidebar();
    var body = sb.body;
    var bar = sb.bar;

    // Navigation row
    var navSec = section("Navigation");
    var rowDiv = el("div", "cf-scope-row");
    rowDiv.appendChild(
      btn("\u2190 Prev", function () {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
      }),
    );
    rowDiv.appendChild(
      btn("Next \u2192", function () {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      }),
    );
    navSec.appendChild(rowDiv);
    body.appendChild(navSec);

    // Export
    var expSec = section("Export");
    expSec.appendChild(btn("Export Current PNG", exportCurrentSlide));
    expSec.appendChild(btn("Export All PNGs", exportAllSlides));
    body.appendChild(expSec);

    addZoomControl(body, function () {
      fitSlideZoom();
    });
    addLogoControls(body);

    setSidebarVar(SIDEBAR_W);

    onReflow = function (w) {
      setSidebarVar(w);
      fitSlideZoom();
    };

    fitSlideZoom();
    window.addEventListener("resize", fitSlideZoom);
    addSlideRail();

    return bar;
  }

  function fitSlideZoom() {
    var vp = document.querySelector(".deck__viewport");
    if (!vp) return;
    vp.style.zoom = userZoom >= 0.999 && userZoom <= 1.001 ? "" : userZoom;
  }

  // Fixed rail on the right edge of the viewport — tracks the active slide.
  // Slides are position:absolute so they can't be wrapped like doc pages.
  function addSlideRail() {
    var rail = el("div", "cf-page-rail cf-slide-rail");
    document.body.appendChild(rail);

    function syncRail() {
      var active = document.querySelector(".slide.active");
      rail.innerHTML = "";
      if (!active) return;

      var selBtn = el("button", "cf-rail-btn");
      selBtn.innerHTML = "&#9643;";
      selBtn.title = "Select for logo controls";
      selBtn.classList.toggle("cf-active", selectedPages.has(active));
      selBtn.addEventListener("click", function () {
        var on = !selectedPages.has(active);
        if (on) selectedPages.add(active);
        else selectedPages.delete(active);
        selBtn.classList.toggle("cf-active", on);
        if (onSelectionChange) onSelectionChange();
      });

      var expBtn = el("button", "cf-rail-btn");
      expBtn.textContent = "PNG";
      expBtn.title = "Export as PNG";
      expBtn.addEventListener("click", function () {
        expBtn.disabled = true;
        exportCurrentSlide().then(function () {
          expBtn.disabled = false;
        });
      });

      rail.appendChild(selBtn);
      rail.appendChild(expBtn);
    }

    // Observe active class changes on every slide
    var observer = new MutationObserver(syncRail);
    document.querySelectorAll(".slide").forEach(function (s) {
      observer.observe(s, { attributes: true, attributeFilter: ["class"] });
    });

    syncRail();
  }

  // Forces .deck__viewport to SLIDE_W × SLIDE_H (no zoom), captures the slide
  // element at design resolution, then restores the viewport to its previous state.
  function captureSlideAtDesignSize(slide) {
    var vp = document.querySelector(".deck__viewport");
    if (!vp) return Promise.resolve(null);
    var saved = {
      zoom: vp.style.zoom,
      width: vp.style.width,
      height: vp.style.height,
      maxWidth: vp.style.maxWidth,
      maxHeight: vp.style.maxHeight,
    };
    vp.style.zoom = "";
    vp.style.width = SLIDE_W + "px";
    vp.style.height = SLIDE_H + "px";
    vp.style.maxWidth = SLIDE_W + "px";
    vp.style.maxHeight = SLIDE_H + "px";
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        capture(slide, SLIDE_W, SLIDE_H).then(function (canvas) {
          vp.style.zoom = saved.zoom;
          vp.style.width = saved.width;
          vp.style.height = saved.height;
          vp.style.maxWidth = saved.maxWidth;
          vp.style.maxHeight = saved.maxHeight;
          resolve(canvas);
        });
      });
    });
  }

  function exportCurrentSlide() {
    var slide = document.querySelector(".slide.active");
    if (!slide) return Promise.resolve();
    return captureSlideAtDesignSize(slide).then(function (canvas) {
      if (canvas) return download(canvas, exportName(slide, "slide"));
    });
  }

  function exportAllSlides() {
    var slides = Array.from(document.querySelectorAll(".slide"));
    var origActive = document.querySelector(".slide.active");
    var entries = [];
    var i = 0;

    function restore() {
      slides.forEach(function (s) {
        s.classList.remove("active");
      });
      if (origActive) origActive.classList.add("active");
    }

    (function next() {
      if (i >= slides.length) {
        restore();
        downloadAsZip(entries, "slides.zip");
        return;
      }
      slides.forEach(function (s, j) {
        s.classList.toggle("active", j === i);
      });
      setTimeout(function () {
        var cur = slides[i];
        captureSlideAtDesignSize(cur).then(function (canvas) {
          if (canvas) entries.push({ canvas: canvas, name: exportName(cur, "slide") });
          i++;
          setTimeout(next, EXPORT_DELAY_MS);
        });
      }, 150);
    })();
  }

  // ── DOCUMENT MODE ─────────────────────────────────────────────────────────────
  function initDocument() {
    injectStyle(docCSS());

    var sb = buildSidebar();
    var body = sb.body;
    var bar = sb.bar;

    var sec = section("Document");
    sec.appendChild(btn("Export All PNGs", exportAllDocPages));
    body.appendChild(sec);

    addZoomControl(body, function () {
      fitDocPages();
    });
    addLogoControls(body);

    setSidebarVar(SIDEBAR_W);
    document.body.style.marginLeft = SIDEBAR_W + "px";

    onReflow = function (w) {
      document.body.style.marginLeft = w + "px";
      fitDocPages();
    };

    fitDocPages();
    window.addEventListener("resize", fitDocPages);

    document.querySelectorAll(".doc-page").forEach(function (page) {
      attachPageRail(page, exportDocPage);
    });

    return bar;
  }

  function fitDocPages() {
    var available = window.innerWidth - sidebarWidth() - 48;
    var fitScale = Math.min(1, available / DOC_PAGE_W);
    var scale = fitScale * userZoom;
    document.querySelectorAll(".doc-page").forEach(function (p) {
      p.style.zoom = scale >= 0.999 && scale <= 1.001 ? "" : scale;
    });
  }

  function exportDocPage(page) {
    var origZoom = page.style.zoom;
    var origOverflow = page.style.overflow;
    page.style.zoom = "";
    page.style.overflow = "visible"; // ensure absolute logo is not clipped
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        var h = Math.max(page.offsetHeight, page.scrollHeight);
        capture(page, DOC_PAGE_W, h).then(function (canvas) {
          page.style.zoom = origZoom;
          page.style.overflow = origOverflow;
          download(canvas, exportName(page, "page")).then(resolve);
        });
      });
    });
  }

  function exportAllDocPages() {
    var pages = Array.from(document.querySelectorAll(".doc-page"));
    var entries = [];
    var i = 0;
    (function next() {
      if (i >= pages.length) {
        downloadAsZip(entries, "pages.zip");
        return;
      }
      var page = pages[i];
      var origZoom = page.style.zoom;
      var origOverflow = page.style.overflow;
      page.style.zoom = "";
      page.style.overflow = "visible";
      requestAnimationFrame(function () {
        var h = Math.max(page.offsetHeight, page.scrollHeight);
        capture(page, DOC_PAGE_W, h).then(function (canvas) {
          page.style.zoom = origZoom;
          page.style.overflow = origOverflow;
          entries.push({ canvas: canvas, name: exportName(page, "page") });
          i++;
          setTimeout(next, EXPORT_DELAY_MS);
        });
      });
    })();
  }

  // ── SOCIAL MODE ───────────────────────────────────────────────────────────────
  function initSocial() {
    injectStyle(socialCSS());

    var currentW = SOCIAL_PRESETS[0].w;
    var currentH = SOCIAL_PRESETS[0].h;

    var sb = buildSidebar();
    var body = sb.body;
    var bar = sb.bar;

    var sec = section("Format");

    var presetBtns = [];
    SOCIAL_PRESETS.forEach(function (p, i) {
      var b = btn(
        p.label,
        function () {
          presetBtns.forEach(function (x) {
            x.classList.remove("cf-active");
          });
          b.classList.add("cf-active");
          currentW = p.w;
          currentH = p.h;
          applyCardScale(currentW, currentH);
          updateDimLabel(currentW, currentH);
        },
        i === 0,
      );
      presetBtns.push(b);
      sec.appendChild(b);
    });

    var dimLbl = el("div", "cf-dim");
    dimLbl.id = "cf-dim-label";
    sec.appendChild(dimLbl);

    body.appendChild(sec);
    body.appendChild(sep());

    var exportSec = section("Export");
    exportSec.appendChild(
      btn("Export All PNGs", function () {
        exportAllCards(currentW, currentH);
      }),
    );
    body.appendChild(exportSec);

    addZoomControl(body, function () {
      applyCardScale(currentW, currentH);
    });
    addLogoControls(body);

    setSidebarVar(SIDEBAR_W);
    document.body.style.marginLeft = SIDEBAR_W + "px";

    onReflow = function (w) {
      document.body.style.marginLeft = w + "px";
      applyCardScale(currentW, currentH);
    };

    applyCardScale(currentW, currentH);
    updateDimLabel(currentW, currentH);
    window.addEventListener("resize", function () {
      applyCardScale(currentW, currentH);
    });

    document.querySelectorAll(".social-card").forEach(function (card) {
      attachPageRail(card, function (c) {
        return exportCard(c, currentW, currentH);
      });
    });

    return bar;
  }

  function updateDimLabel(w, h) {
    var lbl = document.getElementById("cf-dim-label");
    if (lbl) lbl.textContent = w + " \xd7 " + h + " px";
  }

  function applyCardScale(w, h) {
    document.documentElement.style.setProperty("--social-w", w + "px");
    document.documentElement.style.setProperty("--social-h", h + "px");
    var available = window.innerWidth - sidebarWidth() - 24;
    var scale = Math.min(1, available / w) * userZoom;
    document.querySelectorAll(".social-card").forEach(function (card) {
      card.style.width = w + "px";
      card.style.height = h + "px";
      card.style.zoom = scale >= 0.999 && scale <= 1.001 ? "" : scale;
      card.style.transform = "";
      card.style.marginBottom = "";
    });
  }

  function exportCard(card, w, h) {
    var origZoom = card.style.zoom;
    var origOverflow = card.style.overflow;
    card.style.zoom = "";
    card.style.width = w + "px";
    card.style.height = h + "px";
    card.style.overflow = "visible"; // ensure absolute logo is not clipped
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        capture(card, w, h).then(function (canvas) {
          card.style.zoom = origZoom;
          card.style.overflow = origOverflow;
          download(canvas, exportName(card, "card")).then(resolve);
        });
      });
    });
  }

  function exportAllCards(w, h) {
    var cards = Array.from(document.querySelectorAll(".social-card"));
    var entries = [];
    var i = 0;
    (function next() {
      if (i >= cards.length) {
        downloadAsZip(entries, "cards.zip");
        return;
      }
      var card = cards[i];
      var origZoom = card.style.zoom;
      var origOverflow = card.style.overflow;
      card.style.zoom = "";
      card.style.width = w + "px";
      card.style.height = h + "px";
      card.style.overflow = "visible";
      requestAnimationFrame(function () {
        capture(card, w, h).then(function (canvas) {
          card.style.zoom = origZoom;
          card.style.overflow = origOverflow;
          entries.push({ canvas: canvas, name: exportName(card, "card") });
          i++;
          setTimeout(next, EXPORT_DELAY_MS);
        });
      });
    })();
  }

  // ── Zoom control ──────────────────────────────────────────────────────────────
  function addZoomControl(body, applyZoom) {
    var sec = section("View");

    // Zoom slider: 25 – 200 %, step 5
    var row = el("div", "cf-slider-row");
    var lbl = el("span", "cf-field-lbl");
    lbl.textContent = "Zoom";
    var valLbl = el("span", "cf-zoom-val");
    valLbl.textContent = "100%";
    var inp = document.createElement("input");
    inp.type = "range";
    inp.min = "25";
    inp.max = "200";
    inp.step = "5";
    inp.value = "100";
    inp.className = "cf-slider";
    inp.addEventListener("input", function () {
      var pct = parseInt(inp.value);
      valLbl.textContent = pct + "%";
      userZoom = pct / 100;
      applyZoom(userZoom);
    });

    // Double-click label to reset to 100%
    valLbl.title = "Double-click to reset";
    valLbl.style.cursor = "pointer";
    valLbl.addEventListener("dblclick", function () {
      inp.value = "100";
      valLbl.textContent = "100%";
      userZoom = 1;
      applyZoom(1);
    });

    row.appendChild(lbl);
    row.appendChild(inp);
    row.appendChild(valLbl);
    sec.appendChild(row);
    body.appendChild(sec);
  }

  // ── Logo controls ─────────────────────────────────────────────────────────────
  function findLogos() {
    var seen = new Set();
    // 1. Canonical data-role attribute
    document.querySelectorAll("[data-role='brand-logo']").forEach(function (e) {
      seen.add(e);
    });
    // 2. img/svg whose own class contains "logo"
    document.querySelectorAll("[class*='logo']").forEach(function (e) {
      var t = e.tagName.toLowerCase();
      if (t === "img" || t === "svg") seen.add(e);
    });
    // 3. img/svg nested inside a container with "logo" in class
    document.querySelectorAll("[class*='logo'] img,[class*='logo'] svg").forEach(function (e) {
      seen.add(e);
    });
    // 4. img whose src contains "logo" or a brand name
    document
      .querySelectorAll("img[src*='logo'],img[src*='Logo'],img[src*='BBVA']")
      .forEach(function (e) {
        seen.add(e);
      });
    // 5. SVGs repeated across page containers (same viewBox = brand logo used on every page)
    var pages = document.querySelectorAll(".doc-page,.slide,.social-card");
    if (pages.length > 1) {
      var vbMap = {};
      document.querySelectorAll("svg[viewBox]").forEach(function (s) {
        var vb = s.getAttribute("viewBox");
        if (!vbMap[vb]) vbMap[vb] = [];
        vbMap[vb].push(s);
      });
      Object.keys(vbMap).forEach(function (vb) {
        if (vbMap[vb].length >= 2)
          vbMap[vb].forEach(function (s) {
            seen.add(s);
          });
      });
    }
    return Array.from(seen);
  }

  function getFormatHeight() {
    var vp = document.querySelector(".deck__viewport");
    if (vp) {
      var r = vp.getBoundingClientRect();
      return r.height > 10 ? r.height : 540;
    }
    var page = document.querySelector(".doc-page");
    if (page) return DOC_PAGE_W;
    var card = document.querySelector(".social-card");
    if (card) {
      var h = parseFloat(card.style.height) || card.offsetHeight;
      return h > 10 ? h : 1080;
    }
    return 600;
  }

  function sliderRow(labelText, initVal, min, max, onChange) {
    var row = el("div", "cf-slider-row");
    var lbl = el("span", "cf-field-lbl");
    lbl.textContent = labelText;
    var valLbl = el("span", "cf-slider-val");
    valLbl.textContent = initVal;
    var inp = document.createElement("input");
    inp.type = "range";
    inp.min = String(min);
    inp.max = String(max);
    inp.value = String(initVal);
    inp.className = "cf-slider";
    inp.addEventListener("input", function () {
      valLbl.textContent = inp.value;
      onChange(parseInt(inp.value));
    });
    row.appendChild(lbl);
    row.appendChild(inp);
    row.appendChild(valLbl);
    return row;
  }

  function findLogosIn(container) {
    var seen = new Set();
    container.querySelectorAll("[data-role='brand-logo']").forEach(function (e) {
      seen.add(e);
    });
    container.querySelectorAll("[class*='logo']").forEach(function (e) {
      var t = e.tagName.toLowerCase();
      if (t === "img" || t === "svg") seen.add(e);
    });
    container.querySelectorAll("[class*='logo'] img,[class*='logo'] svg").forEach(function (e) {
      seen.add(e);
    });
    return Array.from(seen);
  }

  function addLogoControls(body) {
    var allLogos = findLogos();
    if (!allLogos.length) return;

    // All page containers in the document
    var allPages = Array.from(document.querySelectorAll(".doc-page,.slide,.social-card"));
    if (!allPages.length) allPages = [document.body];

    // Compute aspect ratio from first logo
    var first = allLogos[0];
    var aspect = 0;
    if (first.tagName.toLowerCase() === "svg") {
      var vb = first.getAttribute("viewBox");
      if (vb) {
        var parts = vb.trim().split(/[\s,]+/);
        if (parts.length >= 4) aspect = parseFloat(parts[2]) / parseFloat(parts[3]);
      }
    }
    if (!(aspect > 0) && first.naturalWidth && first.naturalHeight) {
      aspect = first.naturalWidth / first.naturalHeight;
    }
    if (!(aspect > 0)) aspect = 2;

    var formatH = getFormatHeight();
    var defaultH = Math.round(formatH * 0.07);
    var defaultW = Math.round(defaultH * aspect);
    var defaultX = 85;
    var defaultY = 85;

    // ── Per-page state (WeakMap so pages can be GC'd)
    var pageStates = new WeakMap();

    function getState(page) {
      if (!pageStates.has(page)) {
        pageStates.set(page, {
          h: defaultH,
          w: defaultW,
          x: defaultX,
          y: defaultY,
          visible: true,
        });
      }
      return pageStates.get(page);
    }

    function getTargetPages() {
      return selectedPages.size > 0 ? Array.from(selectedPages) : allPages;
    }

    function applyToPage(page) {
      var st = getState(page);
      findLogosIn(page).forEach(function (l) {
        l.style.display = st.visible ? "" : "none";
        if (!st.visible) return;
        l.style.width = st.w + "px";
        l.style.height = st.h + "px";
        var cs = window.getComputedStyle(page).position;
        if (cs !== "relative" && cs !== "absolute" && cs !== "fixed") {
          page.style.position = "relative";
        }
        if (l.parentNode !== page) page.appendChild(l);
        l.style.position = "absolute";
        l.style.left = st.x + "%";
        l.style.top = st.y + "%";
        l.style.right = "";
        l.style.bottom = "";
        l.style.zIndex = "10";
        l.style.transform = "translate(-50%, -50%)";
      });
    }

    // ── Slider DOM refs (populated below, used by syncSlidersTo)
    var sizeInp, sizeValLbl, xInp, xValLbl, yInp, yValLbl, toggleBtn, hintLbl;

    function syncSlidersTo(page) {
      var st = getState(page);
      if (sizeInp) {
        sizeInp.value = st.h;
        sizeValLbl.textContent = st.h;
      }
      if (xInp) {
        xInp.value = st.x;
        xValLbl.textContent = st.x;
      }
      if (yInp) {
        yInp.value = st.y;
        yValLbl.textContent = st.y;
      }
      if (toggleBtn) {
        toggleBtn.textContent = st.visible ? "Hide logo" : "Show logo";
        toggleBtn.classList.toggle("cf-active", !st.visible);
      }
    }

    function updateHint() {
      if (!hintLbl) return;
      hintLbl.textContent =
        selectedPages.size === 0
          ? "Applies to all"
          : selectedPages.size === 1
            ? "1 page selected"
            : selectedPages.size + " pages selected";
    }

    // ── Register selection-change callback
    onSelectionChange = function () {
      updateHint();
      if (selectedPages.size >= 1) {
        // Sync sliders to the first selected page's stored state
        syncSlidersTo(Array.from(selectedPages)[0]);
      }
      // When selection is cleared keep sliders at current values (next move = all pages)
    };

    // ── Build UI
    body.appendChild(sep());
    var sec = section("Logo");

    hintLbl = el("div", "cf-dim");
    hintLbl.textContent = "Applies to all";
    sec.appendChild(hintLbl);

    // Visibility toggle
    toggleBtn = btn("Hide logo", function () {
      var targets = getTargetPages();
      var allVis = targets.every(function (p) {
        return getState(p).visible;
      });
      var next = !allVis;
      targets.forEach(function (p) {
        getState(p).visible = next;
        applyToPage(p);
      });
      toggleBtn.textContent = next ? "Hide logo" : "Show logo";
      toggleBtn.classList.toggle("cf-active", !next);
    });
    sec.appendChild(toggleBtn);

    // Size slider
    var sizeRow = sliderRow("Size", defaultH, 10, 800, function (v) {
      getTargetPages().forEach(function (p) {
        var st = getState(p);
        st.h = v;
        st.w = Math.round(v * aspect);
        applyToPage(p);
      });
    });
    sizeInp = sizeRow.querySelector("input");
    sizeValLbl = sizeRow.querySelector(".cf-slider-val");
    sec.appendChild(sizeRow);

    // X slider
    var xRow = sliderRow("X", defaultX, 0, 100, function (v) {
      getTargetPages().forEach(function (p) {
        getState(p).x = v;
        applyToPage(p);
      });
    });
    xInp = xRow.querySelector("input");
    xValLbl = xRow.querySelector(".cf-slider-val");
    sec.appendChild(xRow);

    // Y slider
    var yRow = sliderRow("Y", defaultY, 0, 100, function (v) {
      getTargetPages().forEach(function (p) {
        getState(p).y = v;
        applyToPage(p);
      });
    });
    yInp = yRow.querySelector("input");
    yValLbl = yRow.querySelector(".cf-slider-val");
    sec.appendChild(yRow);

    body.appendChild(sec);

    // Apply initial defaults to all pages
    allPages.forEach(applyToPage);
  }

  // ── CSS ───────────────────────────────────────────────────────────────────────
  function injectStyle(css) {
    var s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
  }

  function baseCSS() {
    return [
      // ── Sidebar shell (Codi site palette)
      ".cf-toolbar{position:fixed;left:0;top:0;bottom:0;width:" +
        SIDEBAR_W +
        "px;" +
        "z-index:9999;display:flex;flex-direction:column;overflow:hidden;" +
        "background:#070a0f;border-right:1px solid rgba(255,255,255,0.06);box-sizing:border-box;" +
        "font-family:'Outfit',system-ui,-apple-system,sans-serif;font-size:13px;color:#8b949e;" +
        "transition:width .18s cubic-bezier(.4,0,.2,1)}",

      // ── Header
      ".cf-header{display:flex;align-items:center;justify-content:space-between;" +
        "padding:0 10px 0 14px;height:48px;flex-shrink:0;" +
        "border-bottom:1px solid rgba(255,255,255,0.06);background:#0d1117}",
      ".cf-brand{display:flex;align-items:center;gap:7px;overflow:hidden}",
      // ◆ icon + "codi" text — both use the site gradient
      ".cf-brand-icon{font-size:14px;flex-shrink:0;line-height:1;" +
        "background:linear-gradient(135deg,#56b6c2,#61afef);" +
        "-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}",
      ".cf-brand-label{font-family:'Geist Mono',monospace;font-size:13px;font-weight:500;" +
        "white-space:nowrap;overflow:hidden;" +
        "background:linear-gradient(135deg,#56b6c2,#61afef);" +
        "-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}",
      ".cf-toggle-btn{background:none;border:1px solid rgba(255,255,255,0.08);border-radius:6px;" +
        "color:#56b6c2;cursor:pointer;font-size:16px;line-height:1;padding:4px 8px;" +
        "flex-shrink:0;transition:background .15s,border-color .15s}",
      ".cf-toggle-btn:hover{background:rgba(86,182,194,0.07);border-color:rgba(86,182,194,0.4)}",

      // ── Scrollable body
      ".cf-body{flex:1;overflow-y:auto;overflow-x:hidden;padding-bottom:12px}",
      ".cf-body::-webkit-scrollbar{width:4px}",
      ".cf-body::-webkit-scrollbar-track{background:transparent}",
      ".cf-body::-webkit-scrollbar-thumb{background:#1c2128;border-radius:2px}",

      // ── Collapsed state — hide body content
      ".cf-toolbar.cf-collapsed .cf-body{display:none}",
      ".cf-toolbar.cf-collapsed .cf-brand{display:none}",
      ".cf-toolbar.cf-collapsed .cf-header{padding:0;justify-content:center}",

      // ── Resize handle
      ".cf-resize-handle{position:absolute;right:0;top:0;bottom:0;width:5px;" +
        "cursor:col-resize;z-index:1;transition:background .15s}",
      ".cf-resize-handle:hover{background:rgba(86,182,194,.25)}",

      // ── Sections
      ".cf-section{padding:12px 14px 4px;display:flex;flex-direction:column;gap:7px}",
      ".cf-section-title{font-size:10px;font-weight:600;letter-spacing:.1em;" +
        "text-transform:uppercase;color:#3d4450;margin-bottom:2px}",
      ".cf-sep{border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;flex-shrink:0}",

      // ── Buttons
      ".cf-btn{width:100%;padding:7px 10px;border:1px solid rgba(255,255,255,0.06);border-radius:7px;" +
        "background:#13181f;color:#8b949e;cursor:pointer;font-size:12px;text-align:left;" +
        "box-sizing:border-box;transition:background .15s,border-color .15s;" +
        "white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".cf-btn:hover{background:rgba(86,182,194,0.07);border-color:rgba(86,182,194,0.35);color:#e6edf3}",
      ".cf-btn.cf-active{background:rgba(86,182,194,0.15);color:#56b6c2;" +
        "border-color:rgba(86,182,194,0.5)}",
      ".cf-btn.cf-active:hover{background:rgba(86,182,194,0.22)}",
      ".cf-btn:disabled{opacity:.4;cursor:default}",
      ".cf-scope-row{display:flex;gap:6px}",
      ".cf-scope-row .cf-btn{width:50%;text-align:center}",

      // ── Dim label
      ".cf-dim{color:#3d4450;font-size:11px;padding:0 2px}",

      // ── Sliders
      ".cf-slider-row{display:flex;align-items:center;gap:8px;padding:0 2px}",
      ".cf-field-lbl{font-size:11px;color:#3d4450;white-space:nowrap;min-width:30px}",
      ".cf-slider-val{font-size:11px;color:#3d4450;min-width:30px;text-align:right;font-variant-numeric:tabular-nums}",
      ".cf-zoom-val{font-size:11px;color:#3d4450;min-width:36px;text-align:right;font-variant-numeric:tabular-nums;cursor:pointer}",
      ".cf-zoom-val:hover{color:#56b6c2}",
      ".cf-slider{flex:1;min-width:0;accent-color:#56b6c2;cursor:pointer;height:4px}",

      // ── File picker
      ".cf-file-select{width:100%;box-sizing:border-box;background:#13181f;color:#8b949e;" +
        "border:1px solid rgba(255,255,255,0.06);border-radius:7px;padding:7px 10px;font-size:12px;" +
        "cursor:pointer;appearance:auto}",
      ".cf-file-select:hover{border-color:rgba(86,182,194,0.35);color:#e6edf3}",

      // ── Page wrapper + right rail (document & social modes)
      ".cf-page-wrapper{display:flex;align-items:flex-start;gap:8px}",
      ".cf-page-rail{display:flex;flex-direction:column;gap:7px;padding-top:8px;flex-shrink:0}",
      ".cf-rail-btn{width:38px;height:34px;border:1px solid rgba(255,255,255,0.08);border-radius:7px;" +
        "background:#13181f;color:#8b949e;cursor:pointer;font-size:11px;display:flex;" +
        "align-items:center;justify-content:center;box-sizing:border-box;" +
        "transition:background .15s,border-color .15s}",
      ".cf-rail-btn:hover{background:rgba(86,182,194,0.07);border-color:rgba(86,182,194,0.35);color:#e6edf3}",
      ".cf-rail-btn.cf-active{background:rgba(86,182,194,0.15);border-color:rgba(86,182,194,0.5);color:#56b6c2}",
      ".cf-rail-btn:disabled{opacity:.4;cursor:default}",
      ".cf-page-selected>.doc-page,.cf-page-selected>.social-card,.cf-page-selected>.slide" +
        "{outline:2px solid #56b6c2;outline-offset:3px}",

      // ── Responsive: auto-collapse on narrow screens
      "@media(max-width:640px){.cf-toolbar{width:" +
        MINI_W +
        "px!important}" +
        ".cf-body{display:none}" +
        ".cf-brand-label{display:none}" +
        ".cf-header{padding:0;justify-content:center}" +
        ".cf-brand{justify-content:center}}",
      "@media print{.cf-toolbar,.cf-page-rail{display:none!important}}",
    ].join("\n");
  }

  function slidesCSS() {
    // Minimal override: shift .deck rightward past the sidebar.
    // The deck engine keeps its own layout (one slide, keyboard nav, centered viewport).
    return (
      baseCSS() +
      "\n.deck{" +
      "margin-left:var(--sidebar-w," +
      SIDEBAR_W +
      "px)!important;" +
      "width:calc(100% - var(--sidebar-w," +
      SIDEBAR_W +
      "px))!important" +
      "}" +
      // Fixed rail anchored to the right edge, vertically centered on the viewport
      "\n.cf-slide-rail{position:fixed;right:8px;top:50%;transform:translateY(-50%);" +
      "z-index:9900;padding-top:0}"
    );
  }
  function docCSS() {
    return baseCSS() + "\nbody{margin:0;overflow-y:auto}";
  }
  function socialCSS() {
    return baseCSS() + "\nbody{margin:0;overflow-y:auto}";
  }

  // ── File Picker ───────────────────────────────────────────────────────────────
  function addFilePicker(bar) {
    fetch("/api/files")
      .then(function (r) {
        return r.json();
      })
      .then(function (files) {
        if (!files || files.length < 2) return;
        var body = bar.querySelector(".cf-body");
        if (!body) return;
        var current = new URLSearchParams(window.location.search).get("file") || files[0];
        var sec = section("File");
        var select = document.createElement("select");
        select.className = "cf-file-select";
        files.forEach(function (name) {
          var opt = document.createElement("option");
          opt.value = name;
          opt.textContent = name;
          if (name === current) opt.selected = true;
          select.appendChild(opt);
        });
        select.addEventListener("change", function () {
          window.location.href = "/?file=" + encodeURIComponent(select.value);
        });
        sec.appendChild(select);
        // Prepend file picker at top of body
        body.insertBefore(sep(), body.firstChild);
        body.insertBefore(sec, body.firstChild);
      })
      .catch(function () {});
  }

  // ── Init ──────────────────────────────────────────────────────────────────────
  function init() {
    if (typeof html2canvas === "undefined") {
      console.warn("[codi preview-shell] html2canvas not loaded — PNG export disabled.");
    }
    if (window.innerWidth <= 640) sidebarOpen = false;

    var mode = detectMode(),
      bar;
    switch (mode) {
      case "slides":
        bar = initSlides();
        break;
      case "document":
        bar = initDocument();
        break;
      default:
        bar = initSocial();
    }
    if (bar) addFilePicker(bar);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
