/* ═══════════════════════════════════════════
   VERIDEX — ENGINE-UI.JS
   UI helpers: pipeline, verdict, heatmap,
   session stats, file loading, drag & drop
═══════════════════════════════════════════ */

const EngineUI = (() => {
  let curImg = null, hmData = null, hmOn = false;
  let sess = { total: 0, fake: 0, real: 0 };
  let lastScanData = null;

  // ── INIT ──
  async function boot() {
    log('INITIALISING FORENSIC MODULES...', 'i');
    await ForensicSignals.pause(200);
    document.getElementById('statusLbl').textContent = 'ENGINE READY';
    log('ALL 10 SIGNALS ONLINE', 'ok');
    LearnSystem.refreshBadge();
  }

  // ── FILE LOAD ──
  function loadFile(inp) {
    const f = inp.files[0]; if (!f) return;
    log(`FILE: ${f.name} (${(f.size / 1024).toFixed(0)}KB)`, 'i');
    const img = document.getElementById('prevImg');
    img.src = URL.createObjectURL(f);
    img.onload = () => {
      curImg = img;
      document.getElementById('dropZone').style.display = 'none';
      document.getElementById('prevWrap').classList.add('on');
      document.getElementById('pipeWrap').classList.add('on');
      resetPipe();
      log(`LOADED ${img.naturalWidth}×${img.naturalHeight}px`, 'i');
    };
  }

  // ── DRAG & DROP ──
  function initDragDrop() {
    const dz = document.getElementById('dropZone');
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('drag');
      const f = e.dataTransfer.files[0]; if (!f) return;
      const dt = new DataTransfer(); dt.items.add(f);
      document.getElementById('fileIn').files = dt.files;
      loadFile(document.getElementById('fileIn'));
    });
  }

  // ── MAIN ANALYSIS ──
  async function runAnalysis() {
    if (!curImg) return;
    document.getElementById('runBtn').disabled = true;
    document.getElementById('verdWrap').classList.remove('on');
    document.getElementById('expBox').classList.remove('on');
    document.getElementById('fbWrap').classList.remove('on');
    document.getElementById('aiWrap').classList.remove('on');
    document.getElementById('scanLine').classList.add('on');
    resetPipe();
    log('═ ANALYSIS STARTED ═', 'w');

    // Draw to work canvas at 512px max
    const wk = document.getElementById('wkCv');
    const wx = wk.getContext('2d');
    const { sigPixel, sigFFT, sigELA, sigSkin, sigColor, sigHands, sigLight, sigBg, sigTextGeo, pause } = ForensicSignals;
    const SC = Math.min(1, 512 / Math.max(curImg.naturalWidth, curImg.naturalHeight));
    wk.width  = Math.floor(curImg.naturalWidth  * SC);
    wk.height = Math.floor(curImg.naturalHeight * SC);
    wx.drawImage(curImg, 0, 0, wk.width, wk.height);
    const id = wx.getImageData(0, 0, wk.width, wk.height);
    const W = wk.width, H = wk.height;
    const S = {};

    pipe(1,'run'); S.pixel = await sigPixel(id);                      pipe(1,'done',fmt(S.pixel)); setSig(1,S.pixel); log(`PIXEL: ${fmt(S.pixel)}`, S.pixel>50?'w':'ok');
    pipe(2,'run'); S.fft   = await sigFFT(id,W,H);                    pipe(2,'done',fmt(S.fft));   setSig(2,S.fft);   log(`FFT: ${fmt(S.fft)}`, S.fft>50?'w':'ok');
    pipe(3,'run'); const ela=await sigELA(wk,W,H); S.ela=ela.score; hmData=ela.heatmap; drawHeatmap(ela.heatmap,W,H); pipe(3,'done',fmt(S.ela)); setSig(3,S.ela); log(`ELA: ${fmt(S.ela)}`, S.ela>50?'w':'ok');
    pipe(4,'run'); const skin=await sigSkin(id,W,H); S.face=skin.score; pipe(4,'done',skin.lbl); setSig(4,S.face); log(`SKIN: ${skin.lbl}`, S.face>50?'w':'ok');
    pipe(5,'run'); S.color=await sigColor(id);                         pipe(5,'done',fmt(S.color)); setSig(5,S.color); log(`COLOR: ${fmt(S.color)}`, S.color>50?'w':'ok');
    pipe(6,'run'); const hand=await sigHands(id,W,H); S.hand=hand.score; pipe(6,'done',hand.lbl); setSig(6,S.hand); log(`HANDS: ${hand.lbl}`, S.hand>50?'w':'ok');
    pipe(7,'run'); const light=await sigLight(id,W,H); S.lighting=light.score; pipe(7,'done',light.lbl); setSig(7,S.lighting); log(`LIGHT: ${light.lbl}`, S.lighting>50?'w':'ok');
    pipe(8,'run'); const bg=await sigBg(id,W,H); S.background=bg.score; pipe(8,'done',bg.lbl); setSig(8,S.background); log(`BG: ${bg.lbl}`, S.background>50?'w':'ok');
    pipe(9,'run'); const tg=await sigTextGeo(id,W,H); S.textgeo=tg.score; pipe(9,'done',tg.lbl); setSig(9,S.textgeo); log(`TEXT/GEO: ${tg.lbl}`, S.textgeo>50?'w':'ok');

    // ── ENSEMBLE ──
    pipe(10,'run'); await pause(100);
    const weights = LearnSystem.loadWeights();
    const raw = S.pixel*weights.pixel + S.fft*weights.fft + S.ela*weights.ela + S.face*weights.face +
                S.color*weights.color + S.hand*weights.hand + S.lighting*weights.lighting +
                S.background*weights.background + S.textgeo*weights.textgeo;
    const all = Object.values(S);
    const hi    = all.filter(v => v > 45).length;
    const boost = hi >= 5 ? hi*6 : hi >= 3 ? hi*4 : hi >= 2 ? 7 : 0;
    const ab    = (S.hand > 60 || S.lighting > 60) ? 12 : 0;
    const mb    = Math.max(...all) > 70 ? (Math.max(...all) - 70) * 0.6 : 0;
    const fake  = Math.min(99, raw + boost + ab + mb);
    const isFake = fake > 34;
    pipe(10,'done',fmt(fake));
    log(`VERDICT: ${fake.toFixed(1)}% → ${isFake ? 'DEEPFAKE' : 'AUTHENTIC'}`, isFake ? 'e' : 'ok');

    document.getElementById('scanLine').classList.remove('on');
    showResults(isFake, fake, S, [skin, hand, light, bg, tg]);
    document.getElementById('runBtn').disabled = false;

    // Session
    sess.total++; isFake ? sess.fake++ : sess.real++;
    document.getElementById('sTotal').textContent = sess.total;
    document.getElementById('sFake').textContent  = sess.fake;
    document.getElementById('sReal').textContent  = sess.real;

    // Store for learning system
    lastScanData = { isFake, fake, S: { ...S } };
    saveScan(isFake, fake, S);
  }

  // ── SHOW RESULTS ──
  function showResults(isFake, fake, S, details) {
    const real = 100 - fake;
    const vc = document.getElementById('vCard');
    const vt = document.getElementById('vTitle');
    vc.className = 'v-card ' + (isFake ? 'fake' : 'real');
    vt.className = 'v-title ' + (isFake ? 'fake' : 'real');
    vt.textContent = isFake ? 'DEEPFAKE' : 'AUTHENTIC';
    document.getElementById('vMeta').textContent = `CONFIDENCE ${Math.max(fake,real).toFixed(1)}% · ${isFake?'SYNTHETIC MEDIA DETECTED':'GENUINE MEDIA'}`;

    setTimeout(() => {
      document.getElementById('fakeFill').style.width = fake + '%';
      document.getElementById('realFill').style.width = real + '%';
      document.getElementById('fakePct').textContent  = fake.toFixed(1) + '%';
      document.getElementById('realPct').textContent  = real.toFixed(1) + '%';
    }, 120);

    // Grid cells
    const vals = [S.pixel,S.fft,S.ela,S.face,S.color,S.hand,S.lighting,S.background,S.textgeo,fake];
    vals.forEach((v,i) => {
      const el = document.getElementById('m'+(i+1)); if (!el || v===undefined) return;
      if (v>60)      { el.textContent='HIGH RISK'; el.className='fg-v hot'; }
      else if (v>35) { el.textContent='SUSPECT';   el.className='fg-v flag'; }
      else           { el.textContent='NORMAL';    el.className='fg-v safe'; }
    });

    // Gauge
    const C   = 219;
    const col = fake > 65 ? 'var(--c2)' : fake > 40 ? 'var(--warn)' : 'var(--c3)';
    const gf  = document.getElementById('gFill');
    gf.style.stroke = col; gf.style.strokeDasharray = C;
    setTimeout(() => gf.style.strokeDashoffset = C - (fake/100*C), 120);
    document.getElementById('gNum').textContent = fake.toFixed(0) + '%';
    document.getElementById('gNum').style.color = col;

    // Explanations
    const exps = [];
    if (S.pixel>50) exps.push('🔬 Near-zero sensor noise — AI images lack natural camera grain');
    if (S.fft>50)   exps.push('🌊 GAN checkerboard in frequency domain — neural upsampling artifact');
    if (S.ela>50)   exps.push('📊 ELA shows freshly generated content — no editing history');
    details.forEach(d => { if (d && d.score > 50 && d.detail) exps.push(d.detail); });
    if (exps.length) {
      document.getElementById('expList').innerHTML = exps.map(e =>
        `<div class="exp-item"><div class="exp-dot"></div><div class="exp-text">${e}</div></div>`
      ).join('');
      document.getElementById('expBox').classList.add('on');
    }
    document.getElementById('verdWrap').classList.add('on');

    // Show feedback panel
    document.getElementById('fbWrap').classList.add('on');
    document.getElementById('fbCorrect').disabled = false;
    document.getElementById('fbWrong').disabled   = false;
    document.getElementById('fbStatus').classList.remove('on');
    LearnSystem.refreshBadge();

    // Auto-show AI if enough feedback
    const fb = LearnSystem.loadFeedback();
    if (fb.length >= 5) {
      LearnSystem.showAIPanel();
      LearnSystem.runClaudeAnalysis(LearnSystem.loadWeights(), fb.slice(0,10), lastScanData);
    }
  }

  // ── HEATMAP ──
  function drawHeatmap(hm, tw, th) {
    if (!hm) return;
    const cv  = document.getElementById('hmCv');
    const img = document.getElementById('prevImg');
    cv.width = img.offsetWidth || tw; cv.height = img.offsetHeight || th;
    const ctx = cv.getContext('2d'); ctx.clearRect(0,0,cv.width,cv.height);
    const sX = cv.width/tw, sY = cv.height/th;
    for (let y=0;y<th;y++) for (let x=0;x<tw;x++) {
      const v = hm.data[y*tw+x];
      if (v > 0.28) {
        ctx.fillStyle = `rgba(${Math.floor(255*v)},${Math.floor(55*(1-v))},0,${v*0.72})`;
        ctx.fillRect(x*sX, y*sY, sX+1, sY+1);
      }
    }
  }

  function toggleHeatmap() {
    hmOn = !hmOn;
    document.getElementById('hmCv').className = 'hm-cv' + (hmOn ? ' on' : '');
  }

  // ── PIPELINE ──
  function pipe(n, state, val) {
    const el = document.getElementById('p'+n);
    el.className = 'prow ' + state;
    if (val) document.getElementById('pv'+n).textContent = val;
  }
  function resetPipe() { for (let i=1;i<=10;i++) pipe(i,'idle','—'); }

  // ── SIGNAL BARS ──
  function setSig(n, score) {
    const col = score > 60 ? 'var(--c2)' : score > 35 ? 'var(--warn)' : 'var(--c3)';
    const sb  = document.getElementById('sb'+n);
    const sp  = document.getElementById('sp'+n);
    if (sb) { sb.style.width = Math.min(score,100)+'%'; sb.style.background = col; }
    if (sp) { sp.textContent = score.toFixed(0)+'%'; sp.style.color = col; }
  }

  // ── RESET ──
  function resetAll() {
    curImg = null; hmData = null; hmOn = false;
    document.getElementById('dropZone').style.display = '';
    ['prevWrap','pipeWrap'].forEach(id => document.getElementById(id).classList.remove('on'));
    ['verdWrap','expBox','fbWrap','aiWrap'].forEach(id => document.getElementById(id).classList.remove('on'));
    document.getElementById('fileIn').value = '';
    document.getElementById('prevImg').src = '';
    document.getElementById('hmCv').className = 'hm-cv';
    document.getElementById('scanLine').classList.remove('on');
    document.getElementById('gFill').style.strokeDashoffset = '219';
    document.getElementById('gNum').textContent = '—';
    document.getElementById('runBtn').disabled = false;
    for (let i=1;i<=9;i++){const sb=document.getElementById('sb'+i),sp=document.getElementById('sp'+i);if(sb)sb.style.width='0';if(sp){sp.textContent='—';sp.style.color='var(--muted2)';}}
    resetPipe();
    log('SESSION RESET','w');
  }

  // ── LOG ──
  function log(msg, type='i') {
    const el = document.getElementById('logWrap');
    const t  = new Date().toTimeString().slice(0,8);
    const div = document.createElement('div'); div.className = 'log-e';
    div.innerHTML = `<div class="log-t">${t}</div><div class="log-m ${type}">${msg}</div>`;
    el.appendChild(div); el.scrollTop = el.scrollHeight;
  }

  // ── SAVE SCAN ──
  function saveScan(isFake, fake, S) {
    try {
      const raw   = localStorage.getItem('veridex_scans');
      const scans = raw ? JSON.parse(raw) : [];
      const f     = document.getElementById('fileIn').files[0];
      scans.unshift({
        id: Date.now(), ts: Date.now(), file: f?.name||'unknown', type:'IMAGE',
        verdict: isFake?'DEEPFAKE':'AUTHENTIC', isFake,
        confidence: Math.max(fake,100-fake).toFixed(1), fakeConf: fake.toFixed(1),
        models:{ xception:S.pixel.toFixed(1), efficientnet:S.fft.toFixed(1), freq:S.ela.toFixed(1), faceff:S.face.toFixed(1) }
      });
      if (scans.length > 500) scans.length = 500;
      localStorage.setItem('veridex_scans', JSON.stringify(scans));
    } catch(e) {}
  }

  const fmt = v => v.toFixed(1) + '%';

  // ── GETTERS ──
  function getLastScan() { return lastScanData; }

  return { boot, loadFile, initDragDrop, runAnalysis, toggleHeatmap, resetAll, log, getLastScan };
})();

// Expose to HTML
window.EngineUI = EngineUI;
