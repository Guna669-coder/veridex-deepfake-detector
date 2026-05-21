/* ═══════════════════════════════════════════
   VERIDEX — ENGINE-LEARN.JS
   Self-Learning System
   Option B: User feedback → weight adjustment
   Option C: Claude API → pattern reasoning
═══════════════════════════════════════════ */

const LearnSystem = (() => {
  const STORAGE_WEIGHTS  = 'vx_weights';
  const STORAGE_FEEDBACK = 'vx_feedback';
  const SIG_NAMES = ['pixel','fft','ela','face','color','hand','lighting','background','textgeo'];
  const DEFAULT_WEIGHTS = {
    pixel:.12, fft:.12, ela:.12, face:.12, color:.08,
    hand:.16, lighting:.12, background:.08, textgeo:.08
  };
  const LEARN_RATE = 0.018;

  let aiConvHistory = [];

  // ── WEIGHT STORAGE ──
  function loadWeights() {
    try { return JSON.parse(localStorage.getItem(STORAGE_WEIGHTS) || 'null') || {...DEFAULT_WEIGHTS}; }
    catch(e) { return {...DEFAULT_WEIGHTS}; }
  }

  function saveWeights(w) {
    const total = Object.values(w).reduce((s,v) => s+v, 0);
    const norm  = {};
    SIG_NAMES.forEach(k => norm[k] = parseFloat((w[k]/total).toFixed(4)));
    localStorage.setItem(STORAGE_WEIGHTS, JSON.stringify(norm));
    return norm;
  }

  // ── FEEDBACK STORAGE ──
  function loadFeedback() {
    try { return JSON.parse(localStorage.getItem(STORAGE_FEEDBACK) || '[]'); }
    catch(e) { return []; }
  }

  function saveFeedbackEntry(entry) {
    const fb = loadFeedback();
    fb.unshift(entry);
    if (fb.length > 100) fb.length = 100;
    localStorage.setItem(STORAGE_FEEDBACK, JSON.stringify(fb));
  }

  // ── BADGE ──
  function refreshBadge() {
    const el = document.getElementById('learnCount');
    if (el) el.textContent = loadFeedback().length;
  }

  // ── OPTION B: USER FEEDBACK ──
  function submitFeedback(wasCorrect) {
    const scan = EngineUI.getLastScan();
    if (!scan) return;
    const { isFake, S } = scan;
    const weights = loadWeights();

    SIG_NAMES.forEach(k => {
      const score = S[k] || 0;
      const fired = score > 45;
      if (wasCorrect) {
        if (isFake  &&  fired) weights[k] = Math.min(0.30, weights[k] + LEARN_RATE * (score/100));
        if (!isFake && !fired) weights[k] = Math.min(0.30, weights[k] + LEARN_RATE * 0.5);
      } else {
        if (isFake  &&  fired) weights[k] = Math.max(0.02, weights[k] - LEARN_RATE * (score/100));
        if (!isFake && !fired) weights[k] = Math.max(0.02, weights[k] - LEARN_RATE * 0.5);
      }
    });

    const newW = saveWeights(weights);
    saveFeedbackEntry({ ts:Date.now(), isFake, wasCorrect, signals:{...S}, weightsAfter:newW });

    // Update UI
    document.getElementById('fbCorrect').disabled = true;
    document.getElementById('fbWrong').disabled   = true;
    const st = document.getElementById('fbStatus');
    const firedCount = SIG_NAMES.filter(k => (S[k]||0) > 45).length;
    st.textContent = wasCorrect
      ? `✓ RECORDED — BOOSTED ${firedCount} SIGNAL(S)`
      : `✓ RECORDED — PENALISED MISFIRED SIGNALS`;
    st.classList.add('on');
    refreshBadge();
    EngineUI.log(`FEEDBACK: ${wasCorrect?'CORRECT':'WRONG'} — WEIGHTS UPDATED`, 'ok');

    // Auto-trigger Claude if enough data
    const fb = loadFeedback();
    if (fb.length >= 3) {
      showAIPanel();
      runClaudeAnalysis(newW, fb.slice(0,10), EngineUI.getLastScan());
    }
  }

  // ── OPTION C: CLAUDE API ──
  function showAIPanel() {
    document.getElementById('aiWrap').classList.add('on');
    document.getElementById('aiThinking').style.display = 'block';
    document.getElementById('aiResponse').classList.remove('on');
    document.getElementById('aiWeights').classList.remove('on');
    aiConvHistory = [];
  }

  async function runClaudeAnalysis(currentWeights, feedbackHistory, scanData) {
    const prompt = buildPrompt(currentWeights, feedbackHistory, scanData);
    try {
      const reply = await callClaude([{ role:'user', content:prompt }], 1000,
        'You are VERIDEX AI, a forensic deepfake detection engine. Always respond with valid JSON only.');
      displayAnalysis(reply, currentWeights);
    } catch(e) {
      document.getElementById('aiThinking').style.display = 'none';
      document.getElementById('aiResponse').textContent = '⚠ AI analysis unavailable. Check console.';
      document.getElementById('aiResponse').classList.add('on');
      console.error('Claude API error:', e);
    }
  }

  function buildPrompt(weights, feedback, scan) {
    const sigSummary = SIG_NAMES.map(k =>
      `  ${k.toUpperCase()}: score=${(scan.S[k]||0).toFixed(1)}%, weight=${(weights[k]*100).toFixed(1)}%`
    ).join('\n');
    const fbSummary = feedback.slice(0,8).map((f,i) => {
      const topSig = SIG_NAMES.reduce((a,k)=>(f.signals[k]||0)>(f.signals[a]||0)?k:a,'pixel');
      return `  [${i+1}] verdict=${f.isFake?'FAKE':'REAL'} feedback=${f.wasCorrect?'CORRECT':'WRONG'} top=${topSig.toUpperCase()}=${(f.signals[topSig]||0).toFixed(0)}%`;
    }).join('\n');

    return `Analyse this VERIDEX deepfake detection scan and feedback history.

SCAN SIGNALS:\n${sigSummary}
VERDICT: ${scan.isFake?'DEEPFAKE':'AUTHENTIC'} (${scan.fake.toFixed(1)}% fake)
FEEDBACK HISTORY (${feedback.length} confirmed scans):\n${fbSummary}
CURRENT WEIGHTS:\n${SIG_NAMES.map(k=>`  ${k}: ${(weights[k]*100).toFixed(1)}%`).join('\n')}

Respond ONLY with this exact JSON (no markdown, no extra text):
{
  "verdict_explanation": "2-3 sentence plain English explanation",
  "likely_generator": "Midjourney|DALL-E 3|Stable Diffusion|StyleGAN|Real Photo",
  "generator_reason": "one sentence why",
  "weight_adjustments": {"pixel":0.12,"fft":0.12,"ela":0.12,"face":0.12,"color":0.08,"hand":0.16,"lighting":0.12,"background":0.08,"textgeo":0.08},
  "weight_reasoning": "one sentence explaining key weight change"
}`;
  }

  async function callClaude(messages, maxTokens=600, system='') {
    const body = { model:'claude-sonnet-4-20250514', max_tokens:maxTokens, messages };
    if (system) body.system = system;
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error('API ' + resp.status);
    const data = await resp.json();
    const text = data.content.map(b => b.text||'').join('');
    return JSON.parse(text.replace(/```json|```/g,'').trim());
  }

  function displayAnalysis(data, oldWeights) {
    document.getElementById('aiThinking').style.display = 'none';
    const resp = document.getElementById('aiResponse');
    resp.innerHTML = `
      <div style="margin-bottom:12px;padding:11px;border-left:2px solid var(--purple);background:rgba(191,90,242,.05);font-size:13px;line-height:1.8">
        ${data.verdict_explanation}
      </div>
      <div style="font-family:var(--mono);font-size:10px;letter-spacing:2px;color:var(--muted2);margin-bottom:4px">LIKELY GENERATOR</div>
      <div style="font-family:var(--display);font-size:24px;color:var(--purple);letter-spacing:3px;margin-bottom:7px">${data.likely_generator}</div>
      <div style="font-family:var(--mono);font-size:11px;color:var(--muted2);margin-bottom:12px">${data.generator_reason}</div>
      <div style="font-family:var(--mono);font-size:10px;letter-spacing:1px;color:var(--muted2);border-top:1px solid var(--border);padding-top:9px">
        ⚖ ${data.weight_reasoning}
      </div>`;
    resp.classList.add('on');

    if (data.weight_adjustments) {
      const newW = saveWeights(data.weight_adjustments);
      const container = document.getElementById('aiWeights');
      container.innerHTML = SIG_NAMES.map(k => {
        const ov = (oldWeights[k]*100).toFixed(1);
        const nv = (newW[k]*100).toFixed(1);
        const diff = parseFloat(nv) - parseFloat(ov);
        const cls  = diff > 0.1 ? 'up' : diff < -0.1 ? 'down' : 'same';
        const arr  = diff > 0.1 ? '↑'  : diff < -0.1 ? '↓'    : '=';
        return `<div class="aw-row">
          <div class="aw-name">${k.toUpperCase()}</div>
          <div class="aw-old">${ov}%</div>
          <div class="aw-arrow">${arr}</div>
          <div class="aw-new ${cls}">${nv}%</div>
        </div>`;
      }).join('');
      container.classList.add('on');
      EngineUI.log(`CLAUDE: WEIGHTS UPDATED (${data.likely_generator})`, 'ok');
    }
  }

  // ── FOLLOW-UP Q&A ──
  async function askAI() {
    const inp = document.getElementById('aiInput');
    const q   = inp.value.trim(); if (!q) return;
    inp.value = '';
    document.getElementById('aiAskBtn').disabled = true;

    const scan = EngineUI.getLastScan();
    const ctx  = scan ? `Scan signals=${JSON.stringify(scan.S)}, verdict=${scan.isFake?'DEEPFAKE':'AUTHENTIC'}(${scan.fake.toFixed(1)}%). Weights=${JSON.stringify(loadWeights())}. Question: ${q}` : q;
    aiConvHistory.push({ role:'user', content:ctx });

    const resp = document.getElementById('aiResponse');
    resp.innerHTML += `
      <div style="margin-top:11px;padding:9px 11px;border:1px solid var(--border);background:rgba(0,210,255,.02)">
        <span style="font-family:var(--mono);font-size:10px;letter-spacing:2px;color:var(--muted2)">YOU: </span>
        <span style="font-family:var(--mono);font-size:12px">${q}</span>
      </div>
      <div id="aiReplySlot" style="padding:9px 11px;font-family:var(--mono);font-size:12px;color:var(--muted2);animation:pulse 1s infinite">THINKING...</div>`;
    resp.classList.add('on');

    try {
      const data = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'claude-sonnet-4-20250514', max_tokens:600,
          system:'You are VERIDEX AI, a forensic deepfake detection assistant. Be concise and technical.',
          messages: aiConvHistory
        })
      });
      const json  = await data.json();
      const reply = json.content.map(b=>b.text||'').join('');
      aiConvHistory.push({ role:'assistant', content:reply });
      const slot = document.getElementById('aiReplySlot');
      slot.style.animation = 'none'; slot.style.color = 'var(--text)';
      slot.innerHTML = `<span style="font-family:var(--mono);font-size:10px;letter-spacing:2px;color:var(--purple)">CLAUDE: </span>${reply}`;
    } catch(e) {
      document.getElementById('aiReplySlot').textContent = '⚠ Could not reach Claude API.';
    }
    document.getElementById('aiAskBtn').disabled = false;
  }

  return { loadWeights, saveWeights, loadFeedback, refreshBadge, submitFeedback, showAIPanel, runClaudeAnalysis, askAI };
})();

window.LearnSystem = LearnSystem;
