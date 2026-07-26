/* ═══════════════════════════════════════════
   VERIDEX — DASHBOARD.JS
   Charts, KPI cards, history table,
   test-data generator, CSV export
   — all data is pulled from the backend API,
     scoped to the logged-in account
═══════════════════════════════════════════ */

const Dashboard = (() => {
  const SIG_KEYS  = ['pixel','fft','ela','face','color','hand','lighting','background','textgeo'];
  const SIG_LABEL = { pixel:'PIXEL', fft:'FFT', ela:'ELA', face:'SKIN', color:'COLOR',
                       hand:'HANDS', lighting:'LIGHT', background:'BG', textgeo:'TEXT/GEO' };
  const DEMO_NAMES = [
    'portrait.jpg','news_photo.png','profile_pic.webp','headshot.jpg',
    'event_photo.png','selfie.jpg','passport.jpg','stock_image.png',
    'midjourney_gen.jpg','dalle_output.png','sd_render.webp','stylegan_face.jpg'
  ];

  let allScans = [];   // most recent page of the account's scans (used for table/histogram/table charts)
  let statsData = null; // server-aggregated totals/trend/signal averages (accurate regardless of page size)
  let filter   = 'ALL';
  let charts   = {};

  // ── LOAD FROM BACKEND ──
  async function load() {
    try {
      const [listRes, statsRes] = await Promise.all([
        API.scans.list(1, 200, filter === 'ALL' ? '' : filter),
        API.scans.stats(),
      ]);
      allScans  = listRes.scans || [];
      statsData = statsRes;
    } catch (e) {
      console.error('Dashboard load failed:', e);
      showToast('⚠ COULD NOT LOAD DASHBOARD DATA');
      allScans = []; statsData = null;
    }
  }

  // ── KPI CARDS ──
  function updateKPI() {
    const stats = statsData?.stats || {};
    document.getElementById('kTotal').textContent = stats.totalScans     ?? 0;
    document.getElementById('kFake').textContent  = stats.deepfakesFound ?? 0;
    document.getElementById('kReal').textContent  = stats.authenticFound ?? 0;

    if (allScans.length) {
      const avgConf = allScans.reduce((s,sc) => s + Math.max(sc.fakeConf, sc.realConf), 0) / allScans.length;
      document.getElementById('kConf').textContent = avgConf.toFixed(1) + '%';
      const hi = Math.max(...allScans.map(sc => sc.fakeConf || 0));
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
      const d  = new Date(s.createdAt || Date.now());
      const dt = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
      const sig = s.signals || {};
      return `<tr>
        <td class="td-file">${s.fileName || '—'}</td>
        <td><span class="badge ${s.isFake?'fake':'real'}">${s.verdict}</span></td>
        <td style="color:${s.isFake?'var(--c2)':'var(--c3)'}">${(s.fakeConf||0).toFixed(1)}%</td>
        <td>${sig.pixel!=null ? sig.pixel.toFixed(1) : '—'}</td>
        <td>${sig.fft!=null   ? sig.fft.toFixed(1)   : '—'}</td>
        <td>${sig.ela!=null   ? sig.ela.toFixed(1)   : '—'}</td>
        <td>${sig.face!=null  ? sig.face.toFixed(1)  : '—'}</td>
        <td style="color:var(--muted2)">${dt}</td>
      </tr>`;
    }).join('');
  }

  function setFilter(f, btn) {
    filter = f;
    document.querySelectorAll('.fchip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    refresh(); // re-fetch scoped by verdict so filtering isn't limited to the loaded page
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
    // Backend returns a sparse 14-day trend: [{ _id:'YYYY-MM-DD', total, fakes }]
    const byDate = {};
    (statsData?.trend || []).forEach(t => { byDate[t._id] = t; });

    const labels=[], fakeD=[], realD=[];
    for (let i=13; i>=0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const key = d.toISOString().slice(0,10);
      labels.push(`${d.getMonth()+1}/${d.getDate()}`);
      const entry = byDate[key];
      fakeD.push(entry ? entry.fakes : 0);
      realD.push(entry ? (entry.total - entry.fakes) : 0);
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
    const stats = statsData?.stats || {};
    const fk = stats.deepfakesFound || 0;
    const rl = stats.authenticFound || 0;
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
    allScans.forEach(s => { const b = Math.min(9,Math.floor((s.fakeConf||0)/10)); buckets[b]++; });
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
    // Server-side per-signal averages across the whole account history
    const avg = statsData?.signalAverages || {};
    const map = {
      pixel: avg.avgPixel, fft: avg.avgFft, ela: avg.avgEla, face: avg.avgFace,
      color: avg.avgColor, hand: avg.avgHand, lighting: avg.avgLight,
      background: avg.avgBg, textgeo: avg.avgText,
    };
    const labels = SIG_KEYS.map(k => SIG_LABEL[k]);
    const vals   = SIG_KEYS.map(k => map[k] || 0);
    if (charts.radar) charts.radar.destroy();
    charts.radar = new Chart(document.getElementById('radarChart'), {
      type: 'radar',
      data: {
        labels,
        datasets: [{ data:vals, backgroundColor:pc(.15), borderColor:pc(1), borderWidth:1.5, pointBackgroundColor:pc(1), pointRadius:3 }]
      },
      options: {
        ...baseOpts({ scales:{ r:{ grid:{ color:gridClr() }, ticks:{ color:textClr(), font:{ family:'Share Tech Mono', size:9 }, backdropColor:'transparent' }, pointLabels:{ color:textClr(), font:{ family:'Share Tech Mono', size:9 } } } } }),
        plugins: { ...baseOpts().plugins }
      }
    });
  }

  function buildBar() {
    const keys   = ['pixel','fft','ela','face','hand'];
    const labels = keys.map(k => SIG_LABEL[k]);
    const counts = keys.map(k => allScans.filter(s => (s.signals?.[k] || 0) > 50).length);
    if (charts.bar) charts.bar.destroy();
    charts.bar = new Chart(document.getElementById('barChart'), {
      type: 'bar',
      data: {
        labels,
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

  // ── TEST SCANS (persisted to the real backend, tied to this account) ──
  function randSignals() {
    const s = {};
    SIG_KEYS.forEach(k => s[k] = parseFloat((Math.random()*90+5).toFixed(1)));
    return s;
  }

  function currentWeights() {
    try { return window.LearnSystem ? LearnSystem.loadWeights() : undefined; }
    catch(e) { return undefined; }
  }

  async function addDemo(n) {
    showToast(`ADDING ${n} TEST SCAN${n>1?'S':''}...`);
    const jobs = [];
    for (let i = 0; i < n; i++) {
      const signals = randSignals();
      const isFake  = Math.random() > 0.45;
      const fake    = isFake ? 35 + Math.random()*60 : Math.random()*30;
      jobs.push({
        fileName: DEMO_NAMES[Math.floor(Math.random()*DEMO_NAMES.length)],
        fileMimeType: 'image/jpeg',
        verdict: isFake ? 'DEEPFAKE' : 'AUTHENTIC',
        isFake,
        fakeConf: parseFloat(fake.toFixed(2)),
        signals,
        weightsUsed: currentWeights(),
        analysisTimeMs: Math.floor(Math.random()*2000+400),
      });
    }
    // Save in small concurrent batches so we don't hammer the API
    const BATCH = 8;
    let failed = 0;
    for (let i = 0; i < jobs.length; i += BATCH) {
      const batch = jobs.slice(i, i+BATCH);
      const results = await Promise.allSettled(batch.map(payload => API.scans.save(payload)));
      results.forEach(r => { if (r.status === 'rejected') failed++; });
    }
    await refresh();
    showToast(failed ? `ADDED ${n-failed}/${n} — ${failed} FAILED` : `+${n} TEST SCAN${n>1?'S':''} ADDED`);
  }

  // ── CLEAR ALL (deletes every scan owned by this account) ──
  async function clearAll() {
    if (!confirm('Clear all scan history for this account? This cannot be undone.')) return;
    showToast('CLEARING HISTORY...');
    try {
      const { scans } = await API.scans.list(1, 1000);
      const BATCH = 10;
      for (let i = 0; i < scans.length; i += BATCH) {
        const batch = scans.slice(i, i+BATCH);
        await Promise.allSettled(batch.map(s => API.scans.delete(s._id)));
      }
      await refresh();
      showToast('HISTORY CLEARED');
    } catch (e) {
      console.error(e);
      showToast('⚠ CLEAR FAILED');
    }
  }

  // ── CSV EXPORT ──
  function exportCSV() {
    if (!allScans.length) { showToast('NO DATA TO EXPORT'); return; }
    const hdr  = 'ID,FILE,VERDICT,FAKE%,PIXEL,FFT,ELA,SKIN,COLOR,HANDS,LIGHT,BG,TEXT/GEO,DATE\n';
    const rows = allScans.map(s => {
      const sig = s.signals || {};
      return [
        s._id, `"${s.fileName}"`, s.verdict, s.fakeConf,
        sig.pixel, sig.fft, sig.ela, sig.face, sig.color, sig.hand, sig.lighting, sig.background, sig.textgeo,
        `"${new Date(s.createdAt).toLocaleString()}"`
      ].join(',');
    }).join('\n');
    const a = document.createElement('a');
    a.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent(hdr + rows);
    a.download = 'veridex_export.csv';
    a.click();
    showToast('CSV EXPORTED');
  }

  // ── FULL REFRESH ──
  async function refresh() {
    await load();
    updateKPI();
    renderTable();
    rebuildCharts();
  }

  // ── INIT ──
  function init() {
    refresh();
    // Re-sync when user returns from the engine tab (new scans may have been saved)
    window.addEventListener('focus', () => refresh());
  }

  return { init, refresh, setFilter, addDemo, clearAll, exportCSV, rebuildCharts };
})();

window.Dashboard = Dashboard;
document.addEventListener('DOMContentLoaded', () => Dashboard.init());
