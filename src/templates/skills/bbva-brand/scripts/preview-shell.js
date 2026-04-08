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

  var STRIP_W = 68; // slides right-strip width (px)

  var sidebarOpen = true;
  var sidebarEl = null;
  var bodyEl = null; // scrollable inner container
  var onReflow = null; // callback set by each mode to reflow content
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
  function capture(target, w, h) {
    return html2canvas(target, {
      scale: EXPORT_SCALE,
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      scrollX: 0,
      scrollY: 0,
      useCORS: true,
      backgroundColor: null,
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

  // Builds a fixed right strip for slides with per-slide nav, select, and export.
  function buildSlideStrip(slides) {
    var strip = el("div", "cf-slide-strip");
    document.body.appendChild(strip);
    var navBtns = [];

    slides.forEach(function (slide, i) {
      var slot = el("div", "cf-strip-slot");

      var topRow = el("div", "cf-strip-nav-row");

      var navBtn = el("button", "cf-strip-nav");
      navBtn.textContent = slide.dataset.index || String(i + 1).padStart(2, "0");
      navBtn.title = "Go to slide " + (i + 1);
      navBtn.addEventListener("click", function () {
        slides.forEach(function (s, j) {
          s.classList.toggle("active", j === i);
        });
        syncActive();
      });
      navBtns.push(navBtn);

      var selBtn = el("button", "cf-strip-sel");
      selBtn.innerHTML = "&#9643;"; // ▣
      selBtn.title = "Select for logo controls";
      selBtn.addEventListener("click", function () {
        var on = selBtn.classList.toggle("cf-active");
        if (on) selectedPages.add(slide);
        else selectedPages.delete(slide);
      });

      topRow.appendChild(navBtn);
      topRow.appendChild(selBtn);

      var expBtn = el("button", "cf-strip-export");
      expBtn.textContent = "PNG";
      expBtn.title = "Export slide " + (i + 1) + " as PNG";
      expBtn.addEventListener("click", function () {
        expBtn.disabled = true;
        exportSingleSlide(slide).then(function () {
          expBtn.disabled = false;
        });
      });

      slot.appendChild(topRow);
      slot.appendChild(expBtn);
      strip.appendChild(slot);
    });

    function syncActive() {
      slides.forEach(function (s, i) {
        navBtns[i].classList.toggle("cf-strip-active", s.classList.contains("active"));
      });
    }

    // Keep strip in sync when the deck engine changes slides (keyboard, etc.)
    if (typeof MutationObserver !== "undefined") {
      var obs = new MutationObserver(syncActive);
      slides.forEach(function (s) {
        obs.observe(s, { attributes: true, attributeFilter: ["class"] });
      });
    }

    syncActive();
    return strip;
  }

  // ── SLIDES MODE ───────────────────────────────────────────────────────────────
  function initSlides() {
    injectStyle(slidesCSS());

    var sb = buildSidebar();
    var body = sb.body;
    var bar = sb.bar;

    var sec = section("Slides");
    sec.appendChild(btn("Export All PNGs", exportAllSlides));
    body.appendChild(sec);

    setSidebarVar(SIDEBAR_W);

    var deck = document.querySelector(".deck");
    var vp = document.querySelector(".deck__viewport");
    if (deck) {
      deck.style.cssText +=
        ";position:fixed;top:0;left:var(--sidebar-w," +
        SIDEBAR_W +
        "px);right:" +
        STRIP_W +
        "px;bottom:0";
    }

    function applySlideZoom(z) {
      if (!vp) return;
      vp.style.transformOrigin = "center center";
      vp.style.transform = z !== 1 ? "scale(" + z + ")" : "";
    }

    addZoomControl(body, applySlideZoom);
    addLogoControls(body);

    onReflow = function (w) {
      if (deck) deck.style.left = w + "px";
    };

    buildSlideStrip(Array.from(document.querySelectorAll(".slide")));

    return bar;
  }

  function getViewportSize() {
    var vp = document.querySelector(".deck__viewport");
    if (!vp) return { w: 960, h: 540 };
    var r = vp.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), el: vp };
  }

  function exportSingleSlide(slide) {
    var vs = getViewportSize();
    if (!vs.el) return Promise.resolve();
    var active = document.querySelector(".slide.active");
    var all = Array.from(document.querySelectorAll(".slide"));
    all.forEach(function (s) {
      s.classList.remove("active");
    });
    slide.classList.add("active");
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        capture(vs.el, vs.w, vs.h).then(function (canvas) {
          all.forEach(function (s) {
            s.classList.remove("active");
          });
          if (active) active.classList.add("active");
          download(canvas, exportName(slide, "slide")).then(resolve);
        });
      });
    });
  }

  function exportAllSlides() {
    var vs = getViewportSize();
    if (!vs.el) return;
    var slides = Array.from(document.querySelectorAll(".slide"));
    var active = document.querySelector(".slide.active");
    var i = 0;
    (function next() {
      if (i >= slides.length) {
        slides.forEach(function (s) {
          s.classList.remove("active");
        });
        if (active) active.classList.add("active");
        return;
      }
      var s = slides[i];
      slides.forEach(function (x) {
        x.classList.remove("active");
      });
      s.classList.add("active");
      requestAnimationFrame(function () {
        capture(vs.el, vs.w, vs.h).then(function (canvas) {
          download(canvas, exportName(s, "slide")).then(function () {
            i++;
            setTimeout(next, EXPORT_DELAY_MS);
          });
        });
      });
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
    page.style.zoom = "";
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        capture(page, DOC_PAGE_W, page.scrollHeight).then(function (canvas) {
          page.style.zoom = origZoom;
          download(canvas, exportName(page, "page")).then(resolve);
        });
      });
    });
  }

  function exportAllDocPages() {
    var pages = Array.from(document.querySelectorAll(".doc-page")),
      i = 0;
    (function next() {
      if (i >= pages.length) return;
      exportDocPage(pages[i]).then(function () {
        i++;
        setTimeout(next, EXPORT_DELAY_MS);
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
    card.style.zoom = "";
    card.style.width = w + "px";
    card.style.height = h + "px";
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        capture(card, w, h).then(function (canvas) {
          card.style.zoom = origZoom;
          download(canvas, exportName(card, "card")).then(resolve);
        });
      });
    });
  }

  function exportAllCards(w, h) {
    var cards = Array.from(document.querySelectorAll(".social-card")),
      i = 0;
    (function next() {
      if (i >= cards.length) return;
      exportCard(cards[i], w, h).then(function () {
        i++;
        setTimeout(next, EXPORT_DELAY_MS);
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
    var sliderMax = Math.max(400, Math.round(formatH * 0.55));
    var curH = Math.round(formatH * 0.07);
    var curW = Math.round(curH * aspect);
    var curX = 85;
    var curY = 85;
    var visible = true;
    var logoScope = "all"; // "all" | "selected"

    function getTargetLogos() {
      if (logoScope === "all" || selectedPages.size === 0) return allLogos;
      // Filter the globally-found allLogos to only those belonging to selected pages.
      // This avoids re-running detection per page (which misses logos without data-role/class).
      var result = allLogos.filter(function (l) {
        var inSelected = false;
        selectedPages.forEach(function (page) {
          if (page.contains(l)) inSelected = true;
        });
        return inSelected;
      });
      return result.length ? result : allLogos;
    }

    function applySize() {
      getTargetLogos().forEach(function (l) {
        l.style.width = curW + "px";
        l.style.height = curH + "px";
      });
    }

    function applyPos() {
      getTargetLogos().forEach(function (l) {
        var page = l.closest(".slide, .doc-page, .social-card");
        if (!page) return;

        // Ensure the page container is positioned so % values resolve against it.
        var cs = window.getComputedStyle(page).position;
        if (cs !== "relative" && cs !== "absolute" && cs !== "fixed") {
          page.style.position = "relative";
        }

        // Reparent the logo to be a DIRECT child of the page container.
        // This guarantees position:absolute anchors to the page, not to any
        // intermediate container that may have its own CSS positioning
        // (e.g. .cover-logo-wrap, .page-header, etc.).
        if (l.parentNode !== page) {
          page.appendChild(l);
        }

        l.style.position = "absolute";
        l.style.left = curX + "%";
        l.style.top = curY + "%";
        l.style.right = "";
        l.style.bottom = "";
        l.style.zIndex = "10";
        l.style.transform = "translate(-50%, -50%)";
      });
    }

    body.appendChild(sep());
    var sec = section("Logo");

    // ── Scope toggle: All / Selected
    var scopeRow = el("div", "cf-scope-row");
    var allBtn = btn(
      "All",
      function () {
        logoScope = "all";
        allBtn.classList.add("cf-active");
        selScopeBtn.classList.remove("cf-active");
      },
      true,
    );
    var selScopeBtn = btn("Selected", function () {
      logoScope = "selected";
      selScopeBtn.classList.add("cf-active");
      allBtn.classList.remove("cf-active");
    });
    scopeRow.appendChild(allBtn);
    scopeRow.appendChild(selScopeBtn);
    sec.appendChild(scopeRow);

    // ── Visibility toggle
    var toggleBtn = btn("Hide logo", function () {
      visible = !visible;
      getTargetLogos().forEach(function (l) {
        l.style.display = visible ? "" : "none";
      });
      toggleBtn.textContent = visible ? "Hide logo" : "Show logo";
      toggleBtn.classList.toggle("cf-active", !visible);
    });
    sec.appendChild(toggleBtn);

    // ── Size / position sliders
    sec.appendChild(
      sliderRow("Size", curH, 10, sliderMax, function (v) {
        curH = v;
        curW = Math.round(v * aspect);
        applySize();
      }),
    );
    sec.appendChild(
      sliderRow("X", curX, 0, 100, function (v) {
        curX = v;
        applyPos();
      }),
    );
    sec.appendChild(
      sliderRow("Y", curY, 0, 100, function (v) {
        curY = v;
        applyPos();
      }),
    );

    body.appendChild(sec);
    applySize();
    applyPos();
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
      ".cf-page-selected>.doc-page,.cf-page-selected>.social-card" +
        "{outline:2px solid #56b6c2;outline-offset:3px}",

      // ── Slides right strip
      ".cf-slide-strip{position:fixed;right:0;top:0;bottom:0;width:" +
        STRIP_W +
        "px;" +
        "z-index:9900;background:#070a0f;border-left:1px solid rgba(255,255,255,0.06);" +
        "display:flex;flex-direction:column;align-items:stretch;" +
        "padding:8px 6px;gap:3px;overflow-y:auto;box-sizing:border-box}",
      ".cf-strip-slot{display:flex;flex-direction:column;gap:3px;" +
        "padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)}",
      ".cf-strip-nav-row{display:flex;gap:3px;align-items:stretch}",
      ".cf-strip-nav{flex:1;padding:5px 0;border:1px solid rgba(255,255,255,0.06);" +
        "border-radius:6px;background:#13181f;color:#8b949e;cursor:pointer;" +
        "font-size:11px;font-variant-numeric:tabular-nums;text-align:center;" +
        "transition:background .15s,border-color .15s}",
      ".cf-strip-nav:hover{background:rgba(86,182,194,0.07);border-color:rgba(86,182,194,0.35);color:#e6edf3}",
      ".cf-strip-nav.cf-strip-active{background:rgba(97,175,239,0.15);color:#61afef;" +
        "border-color:rgba(97,175,239,0.4)}",
      ".cf-strip-sel{width:22px;border:1px solid rgba(255,255,255,0.06);border-radius:5px;" +
        "background:#13181f;color:#3d4450;cursor:pointer;font-size:11px;" +
        "display:flex;align-items:center;justify-content:center;flex-shrink:0;" +
        "transition:background .15s,border-color .15s}",
      ".cf-strip-sel:hover{border-color:rgba(86,182,194,0.35);color:#8b949e}",
      ".cf-strip-sel.cf-active{background:rgba(86,182,194,0.15);border-color:rgba(86,182,194,0.5);color:#56b6c2}",
      ".cf-strip-export{width:100%;padding:4px 0;border:1px solid rgba(255,255,255,0.06);" +
        "border-radius:6px;background:#13181f;color:#3d4450;cursor:pointer;" +
        "font-size:10px;text-align:center;transition:background .15s,border-color .15s}",
      ".cf-strip-export:hover{background:rgba(86,182,194,0.07);border-color:rgba(86,182,194,0.35);color:#56b6c2}",
      ".cf-strip-export:disabled{opacity:.4;cursor:default}",

      // ── Responsive: auto-collapse on narrow screens
      "@media(max-width:640px){.cf-toolbar{width:" +
        MINI_W +
        "px!important}" +
        ".cf-body{display:none}" +
        ".cf-brand-label{display:none}" +
        ".cf-header{padding:0;justify-content:center}" +
        ".cf-brand{justify-content:center}}",
      "@media print{.cf-toolbar,.cf-slide-strip,.cf-page-rail{display:none!important}}",
    ].join("\n");
  }

  function slidesCSS() {
    return baseCSS() + "\nbody{margin:0;overflow:hidden}";
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
