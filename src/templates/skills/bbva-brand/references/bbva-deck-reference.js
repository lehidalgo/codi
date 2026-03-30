(() => {
  const slides = document.querySelectorAll(".slide");
  const progressBar = document.getElementById("progressBar");
  const slideCounter = document.getElementById("slideCounter");
  const globalLogo = document.getElementById("globalLogo");
  const total = slides.length;
  let current = 0;
  let wheelCooldown = false;

  function goto(index) {
    if (index < 0 || index >= total || index === current) return;
    slides[current].classList.remove("active");
    resetAnimations(slides[current]);
    current = index;
    slides[current].classList.add("active");
    updateProgress();
    updateHash();
    updateLogoColor();
  }

  function next() {
    goto(current + 1);
  }
  function prev() {
    goto(current - 1);
  }

  function updateProgress() {
    const pct = ((current + 1) / total) * 100;
    progressBar.style.width = pct + "%";
    slideCounter.textContent = current + 1 + " / " + total;
  }

  function updateHash() {
    history.replaceState(null, "", "#slide-" + (current + 1));
  }

  function updateLogoColor() {
    const isBlue = slides[current].classList.contains("slide--blue");
    globalLogo.classList.toggle("global-logo--inverted", isBlue);
  }

  function resetAnimations(slide) {
    const items = slide.querySelectorAll(".animate-in");
    items.forEach((el) => {
      el.style.animation = "none";
      el.offsetHeight; // force reflow
      el.style.animation = "";
    });
  }

  function readHash() {
    const match = location.hash.match(/^#slide-(\d+)$/);
    if (match) {
      const idx = parseInt(match[1], 10) - 1;
      if (idx >= 0 && idx < total) {
        slides[current].classList.remove("active");
        current = idx;
        slides[current].classList.add("active");
      }
    }
    updateProgress();
  }

  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
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
        goto(total - 1);
        break;
      default:
        if (e.key >= "1" && e.key <= "9") {
          const target = parseInt(e.key, 10) - 1;
          if (target < total) goto(target);
        }
    }
  });

  // Mouse wheel navigation (debounced)
  document.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (wheelCooldown) return;
      wheelCooldown = true;
      if (e.deltaY > 0) next();
      else if (e.deltaY < 0) prev();
      setTimeout(() => {
        wheelCooldown = false;
      }, 300);
    },
    { passive: false },
  );

  // Touch / swipe navigation
  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    },
    { passive: true },
  );

  document.addEventListener(
    "touchend",
    (e) => {
      const dx = e.changedTouches[0].screenX - touchStartX;
      const dy = e.changedTouches[0].screenY - touchStartY;

      // Only navigate if horizontal swipe is dominant
      if (Math.abs(dx) < 50 && Math.abs(dy) < 50) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx < -50) next();
        else if (dx > 50) prev();
      } else {
        if (dy < -50) next();
        else if (dy > 50) prev();
      }
    },
    { passive: true },
  );

  // Initialize
  readHash();
  updateLogoColor();
})();
