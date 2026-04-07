/**
 * Codi Deck Engine — Navigation & Controls
 *
 * Paste or <script> this inside your deck.html after the slides markup.
 * Provides keyboard navigation, progress bar, slide counter, and viewport scaling.
 */

(function () {
  "use strict";

  // ========== State ==========

  var slides = [];
  var current = 0;

  // ========== DOM References ==========

  var progressBar = document.getElementById("progressBar");
  var slideCounter = document.getElementById("slideCounter");
  var viewport = document.querySelector(".deck__viewport");

  // ========== Init ==========

  function init() {
    slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
    if (slides.length === 0) return;

    // Activate first slide if none is active
    var hasActive = slides.some(function (s) {
      return s.classList.contains("active");
    });
    if (!hasActive) {
      slides[0].classList.add("active");
    }

    current = slides.findIndex(function (s) {
      return s.classList.contains("active");
    });
    if (current < 0) current = 0;

    updateUI();
    scaleViewport();
    window.addEventListener("resize", scaleViewport);
  }

  // ========== Navigation ==========

  function goTo(index) {
    if (index < 0 || index >= slides.length) return;
    slides[current].classList.remove("active");
    current = index;
    slides[current].classList.add("active");
    updateUI();
  }

  function next() {
    goTo(current + 1);
  }
  function prev() {
    goTo(current - 1);
  }

  // ========== UI Updates ==========

  function updateUI() {
    var total = slides.length;
    var pct = total > 1 ? ((current + 1) / total) * 100 : 100;

    if (progressBar) {
      progressBar.style.width = pct + "%";
    }
    if (slideCounter) {
      slideCounter.textContent = current + 1 + " / " + total;
    }

    // Update page title
    var heading = slides[current].querySelector("h1, h2, .title--xl, .title--lg");
    if (heading) {
      document.title = heading.textContent.trim() + " — Deck";
    }
  }

  // ========== Viewport Scaling ==========

  function scaleViewport() {
    if (!viewport) return;
    var slideW = 960;
    var slideH = 540;
    var winW = window.innerWidth;
    var winH = window.innerHeight;
    var scale = Math.min(winW / slideW, winH / slideH);
    viewport.style.transform = "scale(" + scale + ")";
    viewport.style.width = slideW + "px";
    viewport.style.height = slideH + "px";
  }

  // ========== Keyboard Shortcuts ==========

  document.addEventListener("keydown", function (e) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
      case "PageDown":
      case " ":
        e.preventDefault();
        next();
        break;
      case "ArrowLeft":
      case "ArrowUp":
      case "PageUp":
        e.preventDefault();
        prev();
        break;
      case "Home":
        e.preventDefault();
        goTo(0);
        break;
      case "End":
        e.preventDefault();
        goTo(slides.length - 1);
        break;
      case "f":
      case "F":
        if (!e.ctrlKey && !e.metaKey) toggleFullscreen();
        break;
    }
  });

  // ========== Touch & Click Navigation ==========

  var touchStartX = 0;

  document.addEventListener(
    "touchstart",
    function (e) {
      touchStartX = e.touches[0].clientX;
    },
    { passive: true },
  );

  document.addEventListener(
    "touchend",
    function (e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) {
        if (dx < 0) next();
        else prev();
      }
    },
    { passive: true },
  );

  // Click on right 2/3 = next, left 1/3 = prev
  document.addEventListener("click", function (e) {
    var target = e.target;
    // Ignore clicks on interactive elements
    if (target.tagName === "A" || target.tagName === "BUTTON" || target.closest("a, button"))
      return;
    var x = e.clientX / window.innerWidth;
    if (x > 0.33) next();
    else prev();
  });

  // ========== Fullscreen ==========

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function () {});
    } else {
      document.exitFullscreen().catch(function () {});
    }
  }

  // ========== Public API ==========

  window.deck = {
    next: next,
    prev: prev,
    goTo: goTo,
    current: function () {
      return current;
    },
    total: function () {
      return slides.length;
    },
  };

  // ========== Bootstrap ==========

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
