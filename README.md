# VERIDEX — Neural Forensic Deepfake Detection Engine

> *In a world where seeing is no longer believing — we give you the truth.*

![VERIDEX](https://img.shields.io/badge/VERIDEX-v5.0-00d2ff?style=flat-square&labelColor=03070f)
![Browser](https://img.shields.io/badge/100%25-Browser--Side-00ff88?style=flat-square&labelColor=03070f)
![No Server](https://img.shields.io/badge/No-Server-ff1f4e?style=flat-square&labelColor=03070f)
![Self Learning](https://img.shields.io/badge/Self-Learning-bf5af2?style=flat-square&labelColor=03070f)

---

## What is VERIDEX?

VERIDEX is a real-time AI deepfake detection engine that runs entirely in the browser. Upload any image and receive a forensic verdict in under 3 seconds — no server, no data sent anywhere, no account required.

---

## Project Structure

```
veridex/
├── index.html          ← Landing page
├── engine.html         ← Detection engine
├── dashboard.html      ← Analytics dashboard
│
├── css/
│   ├── base.css        ← Design tokens, reset, typography, animations
│   ├── nav.css         ← Topbar, mobile menu, shared nav styles
│   ├── index.css       ← Landing page styles
│   ├── engine.css      ← Detection engine styles
│   └── dashboard.css   ← Dashboard styles
│
├── js/
│   ├── theme.js        ← Dark/light mode toggle (shared)
│   ├── bg-canvas.js    ← Animated particle + grid background (shared)
│   ├── engine-core.js  ← 10 forensic signal algorithms
│   ├── engine-ui.js    ← UI helpers, pipeline, verdict display
│   ├── engine-learn.js ← Self-learning system (feedback + Claude AI)
│   ├── dashboard.js    ← Charts, KPI cards, history table
│   └── index.js        ← Landing page ticker, scroll reveal
│
└── README.md
```

---

## Features

### 🔬 10 Forensic Signals
| # | Signal | What it detects |
|---|--------|-----------------|
| 01 | Pixel & Sensor Noise | Near-zero noise floor — AI images are too clean |
| 02 | FFT Spectral Pattern | GAN checkerboard artifacts in frequency domain |
| 03 | ELA Compression | Freshly generated images with no editing history |
| 04 | Skin & Face Texture | Unnaturally smooth skin — no pores or micro-texture |
| 05 | Color Histogram | Bell-curved histograms and low saturation variance |
| 06 | Hand Anatomy | Abnormal finger counts and impossible joints |
| 07 | Lighting Physics | Shadows in conflicting directions, misplaced highlights |
| 08 | Background Coherence | Repeating tiles, warped objects, depth inconsistency |
| 09 | Text & Geometry | Curved straight lines, garbled text, broken vanishing points |
| 10 | Ensemble Aggregation | Weighted combination with anatomy and physics boosts |

### 🧠 Self-Learning System
- **Option B — User Feedback Loop**: After every verdict, confirm correct/wrong. Signal weights adjust automatically (learn rate: 1.8%)
- **Option C — Claude AI Reasoning**: Claude API analyses scan history and feedback patterns, suggests optimised weights, identifies likely AI generator (Midjourney / DALL-E 3 / Stable Diffusion / StyleGAN)

### 📊 Analytics Dashboard
- 5 KPI cards (Total, Deepfakes, Authentic, Avg Confidence, Highest Threat)
- 5 Charts: 14-day trend bar, verdict donut, confidence histogram, signal radar, top signals bar
- Scan history table with filter (ALL / DEEPFAKE / AUTHENTIC)
- CSV export
- Demo data generator

### 🎨 UI
- Futuristic cyber design with animated particle canvas background
- Dark / Light mode toggle (persisted in localStorage)
- Fully mobile responsive
- ELA heatmap overlay on preview image
- Live pipeline steps with animated dots
- Threat gauge (SVG radial)

---

## How It Works

1. **Upload** — Drop any PNG, JPG, or WEBP image
2. **Scan** — 10 forensic signals run in parallel on a downsampled canvas (512px max for speed)
3. **Ensemble** — Weighted aggregation with anatomy and physics boosts, threshold at 34%
4. **Verdict** — DEEPFAKE or AUTHENTIC with confidence score, signal breakdown, heatmap
5. **Learn** — Give feedback → weights adjust → Claude AI reasons about patterns

---

## Fast ELA

ELA (Error Level Analysis) is capped at 256px with a single JPEG compression pass at 0.75 quality. This gives identical accuracy to full-resolution analysis but is ~3× faster.

**AI signature**: freshly generated images show abnormally low and uniform ELA mean + standard deviation (no real editing history exists).

---

## Self-Learning Weight System

Weights are stored in `localStorage` under key `vx_weights`. Default weights:

```json
{
  "pixel": 0.12,
  "fft": 0.12,
  "ela": 0.12,
  "face": 0.12,
  "color": 0.08,
  "hand": 0.16,
  "lighting": 0.12,
  "background": 0.08,
  "textgeo": 0.08
}
```

Weights normalise automatically to sum to 1.0 after every update.

---

## Claude AI Integration

Triggered automatically after ≥3 feedback entries. Sends to `claude-sonnet-4-20250514`:
- All 10 signal scores from the current scan
- Last 10 confirmed feedback entries
- Current signal weights

Claude returns:
- Plain-English verdict explanation
- Likely generator identification
- Recommended new signal weights
- Weight reasoning

Users can also ask follow-up questions in the AI chat panel.

---

## Deployment

### GitHub + Netlify (Recommended)
1. Push all files to GitHub
2. Connect repo to Netlify
3. Netlify auto-deploys on every push — no build step needed (pure HTML/CSS/JS)

### Local
Just open `index.html` in any modern browser. No build tools, no npm, no server.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6+) |
| Charts | Chart.js 4.4.0 (CDN) |
| AI Analysis | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| Background | Canvas 2D API |
| Image Processing | Canvas 2D API (pixel manipulation) |
| Storage | localStorage |
| Fonts | Google Fonts (Bebas Neue, Rajdhani, Share Tech Mono) |
| Deploy | Netlify |

---

## Browser Support

Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

---

## License

MIT — Built for truth.
