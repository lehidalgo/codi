/**
 * Content Factory Preview Shell
 * Injects aspect-ratio toolbar, CSS scale-to-fit preview, in-browser PNG export,
 * and a right-side chat panel for feedback to the coding agent.
 * Loaded inline into carousel/social-card HTML templates.
 * All DOM elements use .cf-* classes to avoid collisions with template styles.
 */
(function () {
  "use strict";

  var PRESETS = [
    { label: "1:1 LinkedIn", w: 1080, h: 1080 },
    { label: "4:5 Instagram", w: 1080, h: 1350 },
    { label: "9:16 Story", w: 1080, h: 1920 },
    { label: "1200x630 OG", w: 1200, h: 630 },
  ];
  var SCALE_PADDING = 0.82;
  var EXPORT_SCALE = 2;
  var EXPORT_DELAY_MS = 300;
  var PANEL_WIDTH = 320;

  var currentW = PRESETS[0].w;
  var currentH = PRESETS[0].h;
  var selectedSlide = null;
  var panelOpen = true;
  var panelWidth = PANEL_WIDTH;
  var events = [];

  function getSlides() {
    return Array.from(document.querySelectorAll("section[data-index]"));
  }

  /* ---- Styles ---- */
  function injectStyles() {
    var s = document.createElement("style");
    s.textContent = [
      ".cf-toolbar{position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;align-items:center;gap:8px;padding:10px 16px;background:#111119;border-bottom:1px solid #333;font-family:system-ui,sans-serif;font-size:13px;color:#cdd6f4}",
      ".cf-toolbar button{padding:6px 14px;border:1px solid #444;border-radius:6px;background:#1e1e2e;color:#cdd6f4;cursor:pointer;font-size:12px;white-space:nowrap;transition:all .15s}",
      ".cf-toolbar button:hover{background:#2d2d44;border-color:#89b4fa}",
      ".cf-toolbar button.cf-active{background:#89b4fa;color:#0f0f1a;border-color:#89b4fa}",
      ".cf-sep{width:1px;height:24px;background:#444;margin:0 4px}",
      ".cf-label{font-weight:600;margin-right:4px;color:#89b4fa}",
      ".cf-dim{color:#6c7086;font-size:11px;min-width:90px}",
      ".cf-export-btn{position:absolute;top:8px;right:8px;z-index:100;padding:5px 12px;border:1px solid #444;border-radius:4px;background:rgba(30,30,46,.9);color:#89b4fa;cursor:pointer;font-size:11px;font-family:system-ui,sans-serif;opacity:0;transition:opacity .2s;pointer-events:none}",
      "section[data-index]:hover .cf-export-btn{opacity:1;pointer-events:auto}",
      ".cf-export-btn:hover{background:#89b4fa;color:#0f0f1a}",
      "section[data-index].cf-selected{outline:3px solid #89b4fa;outline-offset:-3px;cursor:pointer}",
      "section[data-index]{cursor:pointer;transition:outline .15s}",
      ".cf-layout{display:flex;padding-top:48px;height:calc(100vh - 48px);overflow:hidden}",
      ".cf-slides{flex:1;height:100%;display:flex;flex-direction:column;align-items:center;gap:24px;padding:32px 16px;overflow-y:auto}",
      ".cf-panel{width:" +
        PANEL_WIDTH +
        "px;height:calc(100% - 24px);margin:12px 12px 12px 0;background:#16161e;border:1px solid rgba(137,180,250,.12);border-radius:16px;box-shadow:-4px 0 24px rgba(0,0,0,.4),0 0 0 1px rgba(137,180,250,.06);display:flex;flex-direction:column;font-family:system-ui,sans-serif;z-index:9998;transition:margin-right .2s;overflow:hidden;position:relative;flex-shrink:0}",
      ".cf-panel-header{padding:14px 16px;background:linear-gradient(180deg,#1a1a2e 0%,#16161e 100%);border-bottom:1px solid rgba(137,180,250,.15);border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:center;color:#89b4fa;font-weight:600;font-size:14px;letter-spacing:.3px}",
      ".cf-panel-close{background:none;border:none;color:#6c7086;cursor:pointer;font-size:18px;padding:4px 8px;border-radius:6px;transition:all .15s}",
      ".cf-panel-close:hover{color:#cdd6f4;background:rgba(205,214,244,.08)}",
      ".cf-messages{flex:1;overflow-y:auto;padding:14px 14px;display:flex;flex-direction:column;gap:10px}",
      ".cf-messages::-webkit-scrollbar{width:4px}",
      ".cf-messages::-webkit-scrollbar-track{background:transparent}",
      ".cf-messages::-webkit-scrollbar-thumb{background:#333;border-radius:4px}",
      ".cf-msg{background:linear-gradient(135deg,#1e1e2e 0%,#232336 100%);border:1px solid rgba(137,180,250,.1);border-radius:12px;padding:10px 14px;font-size:12px;color:#cdd6f4;line-height:1.5;box-shadow:0 2px 8px rgba(0,0,0,.2)}",
      ".cf-msg-badge{display:inline-block;background:linear-gradient(135deg,#89b4fa,#7aa8f0);color:#0f0f1a;font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;margin-right:6px}",
      ".cf-msg-text{display:inline}",
      ".cf-msg-time{display:block;color:#6c7086;font-size:10px;margin-top:6px}",
      ".cf-input-area{padding:14px;background:#13131b;border-top:1px solid rgba(137,180,250,.1);display:flex;flex-direction:column;gap:10px;border-radius:0 0 16px 16px}",
      ".cf-input-hint{font-size:11px;color:#6c7086;padding:0 2px}",
      ".cf-input{width:100%;min-height:56px;max-height:120px;resize:vertical;background:#1a1a2e;border:1px solid #2d2d44;border-radius:12px;color:#cdd6f4;padding:10px 14px;font-size:13px;font-family:system-ui,sans-serif;box-sizing:border-box;transition:border-color .15s,box-shadow .15s}",
      ".cf-input:focus{outline:none;border-color:#89b4fa;box-shadow:0 0 0 3px rgba(137,180,250,.15)}",
      ".cf-input::placeholder{color:#555}",
      ".cf-send{align-self:flex-end;padding:8px 20px;background:linear-gradient(135deg,#89b4fa,#7aa8f0);color:#0f0f1a;border:none;border-radius:10px;cursor:pointer;font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(137,180,250,.25);transition:all .15s}",
      ".cf-send:hover{background:linear-gradient(135deg,#9dc4ff,#89b4fa);box-shadow:0 4px 12px rgba(137,180,250,.35);transform:translateY(-1px)}",
      ".cf-resize{position:absolute;left:-3px;top:0;bottom:0;width:6px;cursor:col-resize;z-index:10}",
      '.cf-resize::after{content:"";position:absolute;left:2px;top:50%;transform:translateY(-50%);width:2px;height:40px;border-radius:2px;background:rgba(137,180,250,.2);transition:background .15s,height .15s}',
      ".cf-resize:hover::after,.cf-resize.cf-dragging::after{background:rgba(137,180,250,.5);height:60px}",
      "body{margin:0;overflow:hidden}",
      "@media print{.cf-toolbar,.cf-export-btn,.cf-panel,.cf-layout{display:block!important}section[data-index]{transform:none!important;outline:none!important}}",
    ].join("\n");
    document.head.appendChild(s);
  }

  /* ---- Event storage ---- */
  function getEventStore() {
    var el = document.getElementById("cf-events");
    if (!el) {
      el = document.createElement("script");
      el.type = "application/json";
      el.id = "cf-events";
      el.textContent = "[]";
      document.body.appendChild(el);
    }
    return el;
  }

  function syncEvents() {
    getEventStore().textContent = JSON.stringify(events);
    window.__cfEvents = events;
  }

  function addEvent(slide, type, text) {
    events.push({
      slide: slide,
      type: type,
      text: text,
      timestamp: Date.now(),
    });
    syncEvents();
  }

  /* ---- Toolbar ---- */
  function buildToolbar(onPreset, onExportAll, onTogglePanel) {
    var bar = document.createElement("div");
    bar.className = "cf-toolbar";
    var label = document.createElement("span");
    label.className = "cf-label";
    label.textContent = "Aspect Ratio:";
    bar.appendChild(label);

    var buttons = [];
    PRESETS.forEach(function (p, i) {
      var btn = document.createElement("button");
      btn.textContent = p.label;
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) {
          b.classList.remove("cf-active");
        });
        btn.classList.add("cf-active");
        onPreset(p.w, p.h);
      });
      if (i === 0) btn.classList.add("cf-active");
      buttons.push(btn);
      bar.appendChild(btn);
    });

    bar.appendChild(makeSep());
    var dimLabel = document.createElement("span");
    dimLabel.className = "cf-dim";
    dimLabel.id = "cf-dim-label";
    dimLabel.textContent = PRESETS[0].w + " x " + PRESETS[0].h;
    bar.appendChild(dimLabel);
    bar.appendChild(makeSep());

    var exportBtn = document.createElement("button");
    exportBtn.textContent = "Export All PNGs";
    exportBtn.addEventListener("click", onExportAll);
    bar.appendChild(exportBtn);
    bar.appendChild(makeSep());

    var panelBtn = document.createElement("button");
    panelBtn.textContent = "Chat";
    panelBtn.id = "cf-panel-toggle";
    panelBtn.classList.add("cf-active");
    panelBtn.addEventListener("click", onTogglePanel);
    bar.appendChild(panelBtn);

    document.body.prepend(bar);
  }

  function makeSep() {
    var s = document.createElement("div");
    s.className = "cf-sep";
    return s;
  }

  /* ---- Two-column layout ---- */
  function wrapLayout() {
    var layout = document.createElement("div");
    layout.className = "cf-layout";
    var slidesArea = document.createElement("div");
    slidesArea.className = "cf-slides";
    var slides = getSlides();
    slides.forEach(function (sl) {
      slidesArea.appendChild(sl);
    });
    layout.appendChild(slidesArea);
    document.body.appendChild(layout);
  }

  /* ---- Chat panel ---- */
  function buildPanel() {
    var panel = document.createElement("div");
    panel.className = "cf-panel";
    panel.id = "cf-panel";

    var handle = document.createElement("div");
    handle.className = "cf-resize";
    panel.appendChild(handle);

    var header = document.createElement("div");
    header.className = "cf-panel-header";
    header.innerHTML = "<span>Feedback</span>";
    var closeBtn = document.createElement("button");
    closeBtn.className = "cf-panel-close";
    closeBtn.textContent = "\u00D7";
    closeBtn.addEventListener("click", togglePanel);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    var messages = document.createElement("div");
    messages.className = "cf-messages";
    messages.id = "cf-messages";
    panel.appendChild(messages);

    var inputArea = document.createElement("div");
    inputArea.className = "cf-input-area";
    var hint = document.createElement("div");
    hint.className = "cf-input-hint";
    hint.id = "cf-input-hint";
    hint.textContent = "Click a slide to target feedback";
    inputArea.appendChild(hint);

    var textarea = document.createElement("textarea");
    textarea.className = "cf-input";
    textarea.id = "cf-input";
    textarea.placeholder = "Type feedback... (Enter to send)";
    textarea.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
      if (e.key === "Escape") togglePanel();
    });
    inputArea.appendChild(textarea);

    var sendBtn = document.createElement("button");
    sendBtn.className = "cf-send";
    sendBtn.textContent = "Send";
    sendBtn.addEventListener("click", sendMessage);
    inputArea.appendChild(sendBtn);
    panel.appendChild(inputArea);

    var layout = document.querySelector(".cf-layout");
    var existing = document.getElementById("cf-panel");
    if (existing) {
      existing.replaceWith(panel);
    } else if (layout) {
      layout.appendChild(panel);
    } else {
      document.body.appendChild(panel);
    }
  }

  function setupResize() {
    var handle = document.querySelector(".cf-resize");
    var panel = document.getElementById("cf-panel");
    if (!handle || !panel) return;

    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      handle.classList.add("cf-dragging");
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      function onMove(ev) {
        var newW = window.innerWidth - ev.clientX - 12;
        newW = Math.max(240, Math.min(600, newW));
        panelWidth = newW;
        panel.style.width = newW + "px";
        applyScale(currentW, currentH);
      }

      function onUp() {
        handle.classList.remove("cf-dragging");
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  function togglePanel() {
    panelOpen = !panelOpen;
    var panel = document.getElementById("cf-panel");
    var btn = document.getElementById("cf-panel-toggle");
    if (panel)
      panel.style.marginRight = panelOpen ? "12px" : -panelWidth + "px";
    if (btn) btn.classList.toggle("cf-active", panelOpen);
    applyScale(currentW, currentH);
  }

  function sendMessage() {
    var input = document.getElementById("cf-input");
    var text = (input.value || "").trim();
    if (!text) return;
    var slideIdx = selectedSlide ? selectedSlide.dataset.index : null;
    var slideType = selectedSlide ? selectedSlide.dataset.type : null;
    addEvent(slideIdx ? parseInt(slideIdx, 10) : null, slideType, text);
    renderMessage(events[events.length - 1]);
    input.value = "";
    var msgList = document.getElementById("cf-messages");
    if (msgList) msgList.scrollTop = msgList.scrollHeight;
  }

  function renderMessage(evt) {
    var msgList = document.getElementById("cf-messages");
    if (!msgList) return;
    var div = document.createElement("div");
    div.className = "cf-msg";
    var badge = "";
    if (evt.slide)
      badge = '<span class="cf-msg-badge">Slide ' + evt.slide + "</span>";
    var time = new Date(evt.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    div.innerHTML =
      badge +
      '<span class="cf-msg-text">' +
      escapeHtml(evt.text) +
      "</span>" +
      '<span class="cf-msg-time">' +
      time +
      "</span>";
    msgList.appendChild(div);
  }

  function escapeHtml(str) {
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  /* ---- Slide selection ---- */
  function setupSlideSelection() {
    getSlides().forEach(function (slide) {
      slide.addEventListener("click", function (e) {
        if (e.target.closest(".cf-export-btn")) return;
        if (selectedSlide === slide) {
          slide.classList.remove("cf-selected");
          selectedSlide = null;
          updateHint();
          return;
        }
        if (selectedSlide) selectedSlide.classList.remove("cf-selected");
        selectedSlide = slide;
        slide.classList.add("cf-selected");
        updateHint();
        document.getElementById("cf-input").focus();
      });
    });
  }

  function updateHint() {
    var hint = document.getElementById("cf-input-hint");
    var input = document.getElementById("cf-input");
    if (selectedSlide) {
      var idx = selectedSlide.dataset.index;
      var type = selectedSlide.dataset.type;
      hint.textContent = "Targeting: Slide " + idx + " (" + type + ")";
      input.placeholder = "Feedback for Slide " + idx + "...";
    } else {
      hint.textContent = "Click a slide to target feedback";
      input.placeholder = "Type feedback... (Enter to send)";
    }
  }

  /* ---- Per-slide export buttons ---- */
  function addSlideExportButtons() {
    getSlides().forEach(function (slide) {
      slide.style.position = "relative";
      var btn = document.createElement("button");
      btn.className = "cf-export-btn";
      btn.textContent = "Export PNG";
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        exportSlide(slide);
      });
      slide.appendChild(btn);
    });
  }

  /* ---- Scale slides ---- */
  function applyScale(w, h) {
    currentW = w;
    currentH = h;
    document.documentElement.style.setProperty("--slide-width", w + "px");
    document.documentElement.style.setProperty("--slide-height", h + "px");
    document.documentElement.style.setProperty("--card-width", w + "px");
    document.documentElement.style.setProperty("--card-height", h + "px");

    var pw = panelOpen ? panelWidth + 24 : 0;
    var availW = window.innerWidth - pw;
    var availH = window.innerHeight - 60;
    var scale = Math.min(availW / w, availH / h) * SCALE_PADDING;
    if (scale > 1) scale = 1;

    getSlides().forEach(function (slide) {
      slide.style.width = w + "px";
      slide.style.height = h + "px";
      slide.style.transform = "scale(" + scale + ")";
      slide.style.transformOrigin = "top center";
      slide.style.marginBottom = -(h * (1 - scale)) + "px";
    });

    var lbl = document.getElementById("cf-dim-label");
    if (lbl)
      lbl.textContent =
        w + " x " + h + " (scale " + Math.round(scale * 100) + "%)";
  }

  /* ---- PNG export ---- */
  function exportSlide(slide) {
    var orig = {
      t: slide.style.transform,
      o: slide.style.transformOrigin,
      m: slide.style.marginBottom,
      w: slide.style.width,
      h: slide.style.height,
    };
    var parent = slide.closest(".cf-slides");
    var parentOverflow = parent ? parent.style.overflow : "";

    slide.style.transform = "none";
    slide.style.transformOrigin = "";
    slide.style.marginBottom = "0px";
    slide.style.width = currentW + "px";
    slide.style.height = currentH + "px";
    if (parent) parent.style.overflow = "visible";
    var expBtn = slide.querySelector(".cf-export-btn");
    if (expBtn) expBtn.style.display = "none";
    slide.classList.remove("cf-selected");
    slide.scrollIntoView({ block: "nearest" });

    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        html2canvas(slide, {
          scale: EXPORT_SCALE,
          width: currentW,
          height: currentH,
          windowWidth: currentW,
          windowHeight: currentH,
          scrollX: 0,
          scrollY: 0,
          useCORS: true,
          backgroundColor: null,
        }).then(function (canvas) {
          slide.style.transform = orig.t;
          slide.style.transformOrigin = orig.o;
          slide.style.marginBottom = orig.m;
          slide.style.width = orig.w;
          slide.style.height = orig.h;
          if (parent) parent.style.overflow = parentOverflow;
          if (expBtn) expBtn.style.display = "";
          var fn =
            "slide-" +
            (slide.dataset.index || "0").padStart(2, "0") +
            "-" +
            (slide.dataset.type || "slide") +
            ".png";
          canvas.toBlob(function (blob) {
            var a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = fn;
            a.click();
            URL.revokeObjectURL(a.href);
            resolve();
          }, "image/png");
        });
      });
    });
  }

  function exportAllSlides() {
    var slides = getSlides();
    var i = 0;
    (function next() {
      if (i >= slides.length) return;
      exportSlide(slides[i]).then(function () {
        i++;
        setTimeout(next, EXPORT_DELAY_MS);
      });
    })();
  }

  /* ---- Init ---- */
  function init() {
    if (typeof html2canvas === "undefined") {
      console.warn("[preview-shell] html2canvas not loaded. Export disabled.");
    }
    injectStyles();
    wrapLayout();
    buildToolbar(applyScale, exportAllSlides, togglePanel);
    buildPanel();
    setupResize();
    addSlideExportButtons();
    setupSlideSelection();
    getEventStore();
    syncEvents();
    applyScale(currentW, currentH);
    window.addEventListener("resize", function () {
      applyScale(currentW, currentH);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
