// Shared card overflow menu — one button, one dropdown, N items per card.
//
// Replaces the old dedicated per-card action buttons. Extensible for
// future actions (rename, duplicate, export all, etc.). Only one popup
// can be open at a time.

import { log } from "./dom.js";

let _activeCardMenu = null;

export function closeCardMenu() {
  if (!_activeCardMenu) return;
  const { popup, button, onDocClick, onEsc, onResize } = _activeCardMenu;
  if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
  if (button) button.classList.remove("is-open");
  document.removeEventListener("mousedown", onDocClick, true);
  document.removeEventListener("keydown", onEsc, true);
  window.removeEventListener("resize", onResize);
  window.removeEventListener("scroll", onResize, true);
  _activeCardMenu = null;
}

export function openCardMenu(button, items) {
  closeCardMenu();
  const popup = document.createElement("div");
  popup.className = "card-menu-popup";
  popup.setAttribute("role", "menu");

  items.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-menu-item" + (item.danger ? " danger" : "");
    btn.setAttribute("role", "menuitem");
    const glyph = document.createElement("span");
    glyph.className = "card-menu-item-glyph";
    glyph.innerHTML = item.glyph || "";
    const label = document.createElement("span");
    label.textContent = item.label;
    btn.append(glyph, label);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeCardMenu();
      try {
        if (item.handler) item.handler(e);
      } catch (err) {
        log("Menu action failed: " + (err.message || err), "err");
      }
    });
    popup.appendChild(btn);
  });

  document.body.appendChild(popup);

  // Position popup just below the button (or above if it would overflow).
  function place() {
    const r = button.getBoundingClientRect();
    const pw = popup.offsetWidth;
    const ph = popup.offsetHeight;
    let left = r.right - pw;
    if (left < 8) left = 8;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    let top = r.bottom + 6;
    if (top + ph > window.innerHeight - 8) top = r.top - ph - 6;
    popup.style.left = left + "px";
    popup.style.top = Math.max(8, top) + "px";
  }
  place();

  button.classList.add("is-open");

  const onDocClick = (e) => {
    if (popup.contains(e.target) || button.contains(e.target)) return;
    closeCardMenu();
  };
  const onEsc = (e) => {
    if (e.key === "Escape") closeCardMenu();
  };
  const onResize = () => closeCardMenu();
  document.addEventListener("mousedown", onDocClick, true);
  document.addEventListener("keydown", onEsc, true);
  window.addEventListener("resize", onResize);
  window.addEventListener("scroll", onResize, true);

  _activeCardMenu = { popup, button, onDocClick, onEsc, onResize };
}

export function createCardMenuButton(items) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "card-menu-btn";
  btn.title = "More actions";
  btn.setAttribute("aria-label", "More actions");
  btn.setAttribute("aria-haspopup", "menu");
  // Vertical three-dots glyph (U+22EE) — classic overflow affordance.
  btn.innerHTML = "&#x22EE;";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (btn.classList.contains("is-open")) {
      closeCardMenu();
    } else {
      openCardMenu(btn, items);
    }
  });
  return btn;
}
