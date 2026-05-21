/* ═══════════════════════════════════════════
   VERIDEX — THEME.JS
   Dark / Light mode toggle (shared)
═══════════════════════════════════════════ */

const ThemeManager = (() => {
  const STORAGE_KEY = 'vx_theme';

  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    const btn = document.getElementById('themeBtn');
    if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
    localStorage.setItem(STORAGE_KEY, theme);
  }

  function toggle() {
    const current = document.documentElement.dataset.theme;
    apply(current === 'dark' ? 'light' : 'dark');
  }

  function init() {
    const saved = localStorage.getItem(STORAGE_KEY) || 'dark';
    apply(saved);
    const btn = document.getElementById('themeBtn');
    if (btn) btn.addEventListener('click', toggle);
  }

  return { init, apply, toggle };
})();

// Mobile menu toggle
function initMobileMenu() {
  const hbg  = document.getElementById('hbg');
  const menu = document.getElementById('mobMenu');
  if (hbg && menu) {
    hbg.addEventListener('click', () => menu.classList.toggle('on'));
  }
}

// Toast helper
function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), duration);
}

document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  initMobileMenu();
});
