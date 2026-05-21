/* ═══════════════════════════════════════════
   VERIDEX — DASHBOARD.JS
   Charts, KPI cards, history table,
   demo data generator, CSV export
═══════════════════════════════════════════ */

const Dashboard = (() => {
  let allScans = [];
  let filter   = 'ALL';
  let charts   = {};

  const DEMO_NAMES = [
    'portrait.jpg','news_photo.png','profile_pic.webp','headshot.jpg',
    'event_photo.png','selfie.jpg','passport.jpg','stock_image.png',
    'midjourney_gen.jpg','dalle_output.png','sd_render.webp','stylegan_face.jpg'
  ];

  // ── STORAGE ──
  function load() {
    try { allScans = JSON.parse(localStorage.getItem('veridex_scans') || '[]'); }
    catch(e) { allScans = []; }
  }

  function save() {
    localStorage.setItem('veridex_scans', JSON.stringify(allScans));
  }

  // ── KPI CARDS ──
  function updateKPI() {
    const fakes = allScans.filter(s =>  s.isFake);
    const reals = allScans.filter(s => !s.isFake);
    document.getElementById('kTotal').textContent = allScans.length;
    document.getElementById('kFake').textContent  = fakes.length;
    document.getElementById('kReal').textContent  = reals.length;
    if (allScans.length) {
      const avg = allScans.reduce((s,sc) => s + parseFloat(sc.confidence||0), 0) / allScans.length;
      document.getElementById('kConf').textContent = avg.toFixed(1) + '%';
      const hi = Math.max(...allScans.map(sc => parseFloat(sc.fakeConf||0)));
      document.getElementById('kHigh').textContent = hi.toFixed(1) + '%';
    } else {
      document.getElementById('kConf').textContent = '—';
      document.getElementById('kHigh').textContent = '—';
    }
  }

  // ── TABLE ──
  function renderTable() {
    const body  = document.getElementById('histBody');
    const empty = document.getElementById('emptyState');
    const rows  = allScans.filter(s => filter === 'ALL' ? true : s.verdict === filter);

    if (!rows.length) {
      body.innerHTML = '';
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';
    body.innerHTML = rows.slice(0, 100).map(s => {
      const d  = new Date(s.ts || Date.now());
      const dt = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
      return `<tr>
        <td class="td-file">${s.file || '—'}</td>
        <td><span class="badge ${s.isFake?'fake':'real'}">${s.verdict}</span></td>
        <td style="color:${s.isFake?'var(--c2)':'var(--c3)'}">${parseFloat(s.fakeConf||0).toFixed(1)}%</td>
        <td>${s.models?.xception    || '—'}</td>
        <td>${s.models?.efficientnet|| '—'}</td>
        <td>${s.models?.freq        || '—'}</td>
        <td>${s.models?.faceff      || '—'}</td>
        <td style="color:var(--muted2)">${dt}</td>
      </tr>`;
    }).join('');
  }

  function setFilter(f, btn) {
    filter = f;
    document.querySelectorAll('.fchip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    renderTable();
  }

  // ── CHART HELPERS ──
  const isDark    = () => document.documentElement.dataset.theme !== 'light';
  const tc = (o=1) => isDark() ? `rgba(0,210,255,${o})`   : `rgba(0,100,180,${o})`;
  const rc = (o=1) => isDark() ? `rgba(255,31,78,${o})`   : `rgba(200,0,50,${o})`;
  const gc = (o=1) => isDark() ? `rgba(0,255,136,${o})`   : `rgba(0,150,100,${o})`;
  const wc = (o=1) => isDark() ? `rgba(255,183,0,${o})`   : `rgba(200,130,0,${o})`;
  const pc = (o=1) => isDark() ? `rgba(191,90,242,${o})`  : `rgba(140,50,200,${o})`;
  const gridClr   = () => isDark() ? 'rgba(0,210,255,0.07)' : 'rgba(0,100,180,0.09)';
  const textClr   = () => isDark() ? 'rgba(197,221,245,0.5)' : 'rgba(13,30,56,0.5)';

  const baseOpts = (extra={}) => ({
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        bodyFont:  { family:'Share Tech Mono', size:11 },
        titleFont: { family:'Bebas Neue', size:14 },
      }
    },
    scales: {
      x: { grid:{ color:gridClr() }, ticks:{ color:textClr(), font:{ family:'Share Tech Mono', size:10 } } },
      y: { grid:{ color:gridClr() }, ticks:{ color:textClr(), font:{ family:'Share Tech Mono', size:10 } } }
    },
    ...extra
  });

  // ── BUILD CHARTS ──
  function buildTrend() {
    const labels=[], fakeD=[], realD=[];
    for (let i=13; i>=0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      labels.push(`${d.getMonth()+1}/${d.getDate()}`);
      const day = allScans.filter(s => new Date(s.ts).toDateString() === d.toDateString());
      fakeD.push(day.filter(s=>s.isFake).length);
      realD.push(day.filter(s=>!s.isFake).length);
    }
    if (charts.trend) charts.trend.destroy();
    charts.trend = new Chart(document.getElementById('trendChart'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label:'DEEPFAKE',  data:fakeD, backgroundColor:rc(.7), borderColor:rc(1), borderWidth:1, borderRadius:1 },
          { label:'AUTHENTIC', data:realD, backgroundColor:gc(.5), borderColor:gc(1), borderWidth:1, borderRadius:1 }
        ]
      },
      options: { ...baseOpts(), plugins:{ ...baseOpts().plugins, legend:{ display:true, labels:{ color:textClr(), font:{ family:'Share Tech Mono', size:10 } } } } }
    });
  }

  function buildDonut() {
    const fk = allScans.filter(s=>s.isFake).length;
    const rl = allScans.length - fk;
    if (charts.donut) charts.donut.destroy();
    charts.donut = new Chart(document.getElementById('donutChart'), {
      type: 'doughnut',
      data: {
        labels: ['DEEPFAKE','AUTHENTIC'],
        datasets: [{ data:[fk||1,rl||1], backgroundColor:[rc(.7),gc(.6)], borderColor:[rc(1),gc(1)], borderWidth:1, hoverOffset:6 }]
      },
      options: {
        ...baseOpts({ scales:{} }), cutout:'68%',
        plugins: { ...baseOpts().plugins, legend:{ display:true, position:'bottom', labels:{ color:textClr(), font:{ family:'Share Tech Mono', size:9 }, boxWidth:10, padding:10 } } }
      }
    });
  }

  function buildHist() {
    const buckets = Array(10).fill(0);
    allScans.forEach(s => { const b = Math.min(9,Math.floor(parseFloat(s.fakeConf||0)/10)); buckets[b]++; });
    if (charts.hist) charts.hist.destroy();
    charts.hist = new Chart(document.getElementById('histChart'), {
      type: 'bar',
      data: {
        labels: ['0-9','10-19','20-29','30-39','40-49','50-59','60-69','70-79','80-89','90+'],
        datasets: [{ data:buckets, backgroundColor:wc(.6), borderColor:wc(1), borderWidth:1, borderRadius:1 }]
      },
      options: baseOpts()
    });
  }

  function buildRadar() {
    const labels = ['PIXEL','FFT','ELA','SKIN','COLOR','HANDS','LIGHTING','BG'];
    const keys   = ['xception','efficientnet','freq','faceff','xception','efficientnet','freq','faceff'];
    const avgs   = labels.map((_,i) => {
      const vals = allScans.map(s => parseFloat(s.models?.[keys[i]]||0)).filter(v=>v>0);
      return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
    });
    if (charts.radar) charts.radar.destroy();
    charts.radar = new Chart(document.getElementById('radarChart'), {
      type: 'radar',
      data: {
        labels,
        datasets: [{ data:avgs, backgroundColor:pc(.15), borderColor:pc(1), borderWidth:1.5, pointBackgroundColor:pc(1), pointRadius:3 }]
      },
      options: {
        ...baseOpts({ scales:{ r:{ grid:{ color:gridClr() }, ticks:{ color:textClr(), font:{ family:'Share Tech Mono', size:9 }, backdropColor:'transparent' }, pointLabels:{ color:textClr(), font:{ family:'Share Tech Mono', size:9 } } } } }),
        plugins: { ...baseOpts().plugins }
      }
    });
  }

  function buildBar() {
    const signals = ['PIXEL','FFT','ELA','SKIN','HANDS'];
    const keys    = ['xception','efficientnet','freq','faceff','xception'];
    const counts  = signals.map((_,i) => allScans.filter(s => parseFloat(s.models?.[keys[i]]||0) > 50).length);
    if (charts.bar) charts.bar.destroy();
    charts.bar = new Chart(document.getElementById('barChart'), {
      type: 'bar',
      data: {
        labels: signals,
        datasets: [{ data:counts, backgroundColor:[tc(.7),rc(.7),wc(.7),gc(.7),pc(.7)], borderColor:[tc(1),rc(1),wc(1),gc(1),pc(1)], borderWidth:1, borderRadius:1 }]
      },
      options: { ...baseOpts(), indexAxis:'y' }
    });
  }

  function rebuildCharts() {
    Chart.defaults.color = textClr();
    buildTrend();
    buildDonut();
    buildHist();
    buildRadar();
    buildBar();
  }

  // ── DEMO DATA ──
  function addDemo(n) {
    for (let i = 0; i < n; i++) {
      const isFake = Math.random() > 0.45;
      const fake   = isFake ? 35 + Math.random()*60 : Math.random()*30;
      const conf   = Math.max(fake, 100-fake);
      const daysAgo = Math.floor(Math.random()*14);
      const ts      = Date.now() - daysAgo*86400000 - Math.random()*86400000;
      allScans.unshift({
        id: Date.now()+i, ts,
        file: DEMO_NAMES[Math.floor(Math.random()*DEMO_NAMES.length)],
        type: 'IMAGE',
        verdict: isFake ? 'DEEPFAKE' : 'AUTHENTIC',
        isFake,
        confidence: conf.toFixed(1),
        fakeConf:   fake.toFixed(1),
        models: {
          xception:    (Math.random()*80+10).toFixed(1),
          efficientnet:(Math.random()*80+10).toFixed(1),
          freq:        (Math.random()*80+10).toFixed(1),
          faceff:      (Math.random()*80+10).toFixed(1),
        }
      });
    }
    if (allScans.length > 500) allScans.length = 500;
    save();
    refresh();
    showToast(`+${n} DEMO SCAN${n>1?'S':''} ADDED`);
  }

  // ── CLEAR ALL ──
  function clearAll() {
    if (!confirm('Clear all scan history? This cannot be undone.')) return;
    allScans = [];
    save();
    refresh();
    showToast('HISTORY CLEARED');
  }

  // ── CSV EXPORT ──
  function exportCSV() {
    if (!allScans.length) { showToast('NO DATA TO EXPORT'); return; }
    const hdr  = 'ID,FILE,VERDICT,FAKE%,CONFIDENCE,PIXEL,FFT,ELA,SKIN,DATE\n';
    const rows = allScans.map(s =>
      `${s.id},"${s.file}",${s.verdict},${s.fakeConf},${s.confidence},${s.models?.xception||''},${s.models?.efficientnet||''},${s.models?.freq||''},${s.models?.faceff||''},"${new Date(s.ts).toLocaleString()}"`
    ).join('\n');
    const a = document.createElement('a');
    a.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent(hdr + rows);
    a.download = 'veridex_export.csv';
    a.click();
    showToast('CSV EXPORTED');
  }

  // ── FULL REFRESH ──
  function refresh() {
    updateKPI();
    renderTable();
    rebuildCharts();
  }

  // ── INIT ──
  function init() {
    load();
    refresh();
    // Re-sync when user returns from engine tab
    window.addEventListener('focus', () => { load(); refresh(); });
  }

  return { init, refresh, setFilter, addDemo, clearAll, exportCSV, rebuildCharts };
})();

window.Dashboard = Dashboard;
document.addEventListener('DOMContentLoaded', () => Dashboard.init());
