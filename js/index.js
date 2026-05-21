/* ═══════════════════════════════════════════
   VERIDEX — INDEX.JS
   Landing page: ticker, scroll reveal
═══════════════════════════════════════════ */

// ── TICKER ──
function initTicker() {
  const items = [
    '<em>MIDJOURNEY</em> DETECTED',
    '<em>DALLE-3</em> DETECTED',
    '<em>STABLE DIFFUSION</em> DETECTED',
    '<em>STYLEGAN</em> DETECTED',
    '<em>PIXEL NOISE</em> ANALYSIS',
    '<em>FFT SPECTRAL</em> SCAN',
    '<em>ELA COMPRESSION</em> CHECK',
    '<em>HAND ANATOMY</em> VERIFIED',
    '<em>10 SIGNALS</em> ACTIVE',
    '<em>LIGHTING PHYSICS</em> CHECKED',
    '<em>BACKGROUND</em> SCANNED',
    '<em>SKIN TEXTURE</em> ANALYZED',
  ];
  const doubled = [...items, ...items];
  const track = document.getElementById('tickerTrack');
  if (track) {
    track.innerHTML = doubled
      .map(s => `<span class="ticker-item">${s}</span>`)
      .join('');
  }
}

// ── SCROLL REVEAL ──
function initScrollReveal() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.animation = 'riseIn 0.6s ease both';
        e.target.style.opacity   = '1';
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.step-card, .sig-card').forEach(el => {
    el.style.opacity = '0';
    io.observe(el);
  });
}

// ── SMOOTH ANCHOR SCROLL ──
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initTicker();
  initScrollReveal();
  initSmoothScroll();
});
