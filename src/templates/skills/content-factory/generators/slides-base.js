/**
 * slides-base.js — Deck navigation engine for Content Factory slide decks.
 *
 * Purpose: Reference script for the CODING AGENT. Copy this file as
 * deck.js in the session's content directory. Do NOT modify — it is
 * overwritten on every session scaffold.
 *
 * Features:
 *   - Keyboard: ArrowRight/Down/Space=next, ArrowLeft/Up=prev, Home, End, 1-9
 *   - Mouse wheel (debounced 300ms)
 *   - Touch / swipe (50px threshold, dominant axis)
 *   - URL hash navigation (#1 … #N) for deep-linking
 *   - CSS animation replay on each slide visit (resetAnimations reflow trick)
 */
(function () {
  "use strict";

  var slides = [];
  var cur = 0;
  var wheelTimer = null;
  var touchStartX = 0;
  var touchStartY = 0;

  // ── Core navigation ──────────────────────────────────────────────────────

  function goto(i) {
    if (i < 0) i = 0;
    if (i >= slides.length) i = slides.length - 1;
    if (i === cur && slides[cur] && slides[cur].classList.contains("active")) return;

    slides.forEach(function (s, j) {
      s.classList.toggle("active", j === i);
    });
    cur = i;
    resetAnimations(slides[cur]);
    updateChrome();
    updateHash();
  }

  function next() {
    goto(cur + 1);
  }
  function prev() {
    goto(cur - 1);
  }

  // ── Animation replay ─────────────────────────────────────────────────────
  // Forces the browser to replay CSS @keyframes on .animate-in children
  // by briefly removing the animation, triggering a reflow, then restoring it.

  function resetAnimations(slide) {
    if (!slide) return;
    var els = slide.querySelectorAll(".animate-in");
    els.forEach(function (el) {
      el.style.animation = "none";
      void el.offsetHeight; // reflow
      el.style.animation = "";
    });
  }

  // ── Chrome update (progress bar + counter) ───────────────────────────────

  function updateChrome() {
    var pb = document.getElementById("progressBar");
    var sc = document.getElementById("slideCounter");
    var pct = slides.length ? ((cur + 1) / slides.length) * 100 : 0;
    if (pb) pb.style.width = pct + "%";
    if (sc) sc.textContent = cur + 1 + " / " + slides.length;
  }

  // ── URL hash ─────────────────────────────────────────────────────────────

  function updateHash() {
    try {
      history.replaceState(null, "", "#" + (cur + 1));
    } catch {
      /* cross-origin iframe or file:// – ignore */
    }
  }

  function readHash() {
    var h = window.location.hash.replace("#", "");
    var n = parseInt(h, 10);
    if (n >= 1 && n <= slides.length) return n - 1;
    return 0;
  }

  // ── Keyboard ─────────────────────────────────────────────────────────────

  document.addEventListener("keydown", function (e) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
      case " ":
        e.preventDefault();
        next();
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        prev();
        break;
      case "Home":
        e.preventDefault();
        goto(0);
        break;
      case "End":
        e.preventDefault();
        goto(slides.length - 1);
        break;
      default:
        // 1-9: jump to slide N
        if (e.key >= "1" && e.key <= "9") {
          goto(parseInt(e.key, 10) - 1);
        }
    }
  });

  // ── Mouse click (advance) ─────────────────────────────────────────────────

  var viewport = document.querySelector(".deck__viewport");
  if (viewport) {
    viewport.addEventListener("click", function () {
      next();
    });
  }

  // ── Mouse wheel (debounced) ───────────────────────────────────────────────

  document.addEventListener(
    "wheel",
    function (e) {
      e.preventDefault();
      if (wheelTimer) return;
      if (e.deltaY > 0 || e.deltaX > 0) {
        next();
      } else {
        prev();
      }
      wheelTimer = setTimeout(function () {
        wheelTimer = null;
      }, 300);
    },
    { passive: false },
  );

  // ── Touch / swipe ─────────────────────────────────────────────────────────

  document.addEventListener(
    "touchstart",
    function (e) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    },
    { passive: true },
  );

  document.addEventListener(
    "touchend",
    function (e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      var dy = e.changedTouches[0].clientY - touchStartY;
      var threshold = 50;
      if (Math.abs(dx) > Math.abs(dy)) {
        // Dominant axis is horizontal
        if (Math.abs(dx) > threshold) {
          if (dx < 0) next();
          else prev();
        }
      } else {
        // Dominant axis is vertical
        if (Math.abs(dy) > threshold) {
          if (dy < 0) next();
          else prev();
        }
      }
    },
    { passive: true },
  );

  // ── Hash change ───────────────────────────────────────────────────────────

  window.addEventListener("hashchange", function () {
    goto(readHash());
  });

  // ── Init ──────────────────────────────────────────────────────────────────

  slides = Array.from(document.querySelectorAll(".slide"));
  goto(readHash());
})();
