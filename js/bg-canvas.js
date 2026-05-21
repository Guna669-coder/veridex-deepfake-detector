/* ═══════════════════════════════════════════
   VERIDEX — BG-CANVAS.JS
   Animated particle + grid background
═══════════════════════════════════════════ */

const BgCanvas = (() => {
  let canvas, ctx, W, H, pts = [];
  const PARTICLE_COUNT = 55;
  const CONNECT_DIST   = 130;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function spawnParticles() {
    pts = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pts.push({
        x:  Math.random() * 1920,
        y:  Math.random() * 1080,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r:  Math.random() * 1.4 + 0.4,
        o:  Math.random() * 0.45 + 0.1,
      });
    }
  }

  function isDark() {
    return document.documentElement.dataset.theme !== 'light';
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    const dark = isDark();
    const gc   = dark ? '0,210,255' : '0,100,180';

    // Grid lines
    ctx.lineWidth = 1;
    ctx.strokeStyle = dark ? 'rgba(0,210,255,0.035)' : 'rgba(0,100,180,0.05)';
    for (let x = 0; x < W; x += 52) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 52) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Move & draw particles
    pts.forEach(p => {
      p.x = (p.x + p.vx + W) % W;
      p.y = (p.y + p.vy + H) % H;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${gc},${p.o})`;
      ctx.fill();
    });

    // Connection lines
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < CONNECT_DIST) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(${gc},${(1 - d / CONNECT_DIST) * 0.1})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(draw);
  }

  function init(canvasId = 'bgc') {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    spawnParticles();
    draw();
    window.addEventListener('resize', resize);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => BgCanvas.init());
