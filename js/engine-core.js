/* ═══════════════════════════════════════════
   VERIDEX — ENGINE-CORE.JS
   10 Forensic Signal Algorithms
═══════════════════════════════════════════ */

// ── UTILITY ──
const lum  = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const pause = (ms) => new Promise(r => setTimeout(r, ms));

// ── SIGNAL 1: PIXEL & SENSOR NOISE ──
async function sigPixel(id) {
  const d = id.data, w = id.width, h = id.height;
  let ns = 0, n = 0;
  for (let y = 2; y < h - 2; y += 3) {
    for (let x = 2; x < w - 2; x += 3) {
      const i = (y * w + x) * 4;
      const c = lum(d, i);
      const nb = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
      const avg = nb.reduce((s,[dy,dx]) => s + lum(d, ((y+dy)*w+(x+dx))*4), 0) / 8;
      ns += Math.abs(c - avg); n++;
    }
  }
  const avg = ns / n;
  const nS = avg < 3.5 ? clamp((3.5 - avg) * 32 + 40, 0, 100) : clamp(30 - avg * 3, 0, 100);
  let sm = 0, gc = 0;
  for (let y = 1; y < Math.min(h - 1, 200); y += 3) {
    for (let x = 1; x < Math.min(w - 1, 200); x += 3) {
      const i = (y * w + x) * 4;
      if (Math.abs(lum(d,i) - lum(d,(y*w+x+1)*4)) < 1.5 &&
          Math.abs(lum(d,i) - lum(d,((y+1)*w+x)*4)) < 1.5) sm++;
      gc++;
    }
  }
  return clamp(nS * 0.55 + (sm / gc) * 100 * 0.45, 0, 100);
}

// ── SIGNAL 2: FFT SPECTRAL PATTERN ──
async function sigFFT(id, w, h) {
  const d = id.data, sz = Math.min(w, h, 128);
  const g = new Float32Array(sz * sz);
  for (let y = 0; y < sz; y++)
    for (let x = 0; x < sz; x++)
      g[y * sz + x] = lum(d, (y * w + x) * 4) / 255;

  // GAN checkerboard
  let cb = 0, cbn = 0;
  for (let y = 0; y < sz - 2; y++) for (let x = 0; x < sz - 2; x++) {
    const a = g[y*sz+x], b = g[y*sz+x+1], c = g[(y+1)*sz+x], dd = g[(y+1)*sz+x+1];
    if (Math.abs((a + dd) - (b + c)) > 0.04) cb++;
    cbn++;
  }
  const cbS = clamp((cb / cbn) * 400, 0, 100);

  // Periodicity
  let ps = 0; const st = 8;
  for (let y = 0; y < sz - st; y++)
    for (let x = 0; x < sz - st; x++)
      ps += (1 - Math.abs(g[y*sz+x] - g[(y+st)*sz+x]) + 1 - Math.abs(g[y*sz+x] - g[y*sz+x+st])) / 2;
  const pS = clamp((ps / (sz - st) ** 2 - 0.6) * 250, 0, 100);
  return clamp(cbS * 0.5 + pS * 0.5, 0, 100);
}

// ── SIGNAL 3: ELA COMPRESSION (FAST) ──
async function sigELA(canvas, w, h) {
  const ECAP = 256, es = Math.min(1, ECAP / Math.max(w, h));
  const tw = Math.floor(w * es), th = Math.floor(h * es);
  const tmp = document.createElement('canvas');
  tmp.width = tw; tmp.height = th;
  const tc = tmp.getContext('2d'); tc.drawImage(canvas, 0, 0, tw, th);
  const orig = tc.getImageData(0, 0, tw, th);

  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const cc = document.createElement('canvas'); cc.width = tw; cc.height = th;
      const cx = cc.getContext('2d'); cx.drawImage(img, 0, 0);
      const comp = cx.getImageData(0, 0, tw, th);
      const od = orig.data, cd = comp.data;
      let total = 0, bDiffs = [], hm = new Float32Array(tw * th);
      const bs = 16;
      for (let by = 0; by < th; by += bs) for (let bx = 0; bx < tw; bx += bs) {
        let bS = 0, cnt = 0;
        for (let dy = 0; dy < bs && by+dy < th; dy++) for (let dx = 0; dx < bs && bx+dx < tw; dx++) {
          const i = ((by+dy)*tw+(bx+dx))*4;
          const diff = (Math.abs(od[i]-cd[i]) + Math.abs(od[i+1]-cd[i+1]) + Math.abs(od[i+2]-cd[i+2])) / 3;
          bS += diff; hm[(by+dy)*tw+(bx+dx)] = diff / 50; cnt++;
        }
        bDiffs.push(bS / cnt); total += bS / cnt;
      }
      const mean = total / bDiffs.length;
      const std  = Math.sqrt(bDiffs.reduce((s,v) => s + (v-mean)**2, 0) / bDiffs.length);
      let score = mean < 5 && std < 3 ? 65 + (5-mean)*5 + (3-std)*3 : mean > 15 ? Math.max(10, 40-mean*1.5) : 30 + mean*2;
      const mx = Math.max(...hm); if (mx > 0) for (let i = 0; i < hm.length; i++) hm[i] /= mx;
      res({ score: clamp(score, 0, 100), heatmap: { data: hm, width: tw, height: th } });
    };
    img.src = tmp.toDataURL('image/jpeg', 0.75);
  });
}

// ── SIGNAL 4: SKIN & FACE TEXTURE ──
async function sigSkin(id, w, h) {
  const d = id.data; let sp = [], sc = 0;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    const i = (y*w+x)*4, r = d[i], g = d[i+1], b = d[i+2];
    if ((r>60&&g>40&&b>20&&r>b&&(Math.max(r,g,b)-Math.min(r,g,b))>10&&r-g>-10&&r-g<60) ||
        (r>200&&g>180&&b>160&&Math.abs(r-g)<20)) { sp.push(lum(d,i)); sc++; }
  }
  if (sc < 80) return { score: 25, lbl: 'NO FACE', detail: 'no skin regions found' };
  const sm = sp.reduce((a,b)=>a+b,0) / sp.length;
  const ss = Math.sqrt(sp.reduce((s,v)=>s+(v-sm)**2,0) / sp.length);
  const skinS = ss < 9 ? clamp((9-ss)*10+35,0,90) : clamp(30-ss,0,90);
  let esh = 0, et = 0;
  for (let y=Math.floor(h*.2);y<Math.floor(h*.8);y+=4) for (let x=Math.floor(w*.2);x<Math.floor(w*.8);x+=4) {
    if (Math.sqrt((lum(d,(y*w+x)*4)-lum(d,(y*w+x+1)*4))**2+(lum(d,(y*w+x)*4)-lum(d,((y+1)*w+x)*4))**2) > 30) esh++;
    et++;
  }
  const eS = (esh/et) > 0.12 ? clamp(((esh/et)-0.12)*500,0,90) : 0;
  return { score: clamp(skinS*0.6+eS*0.4,0,100), lbl: sc>400?'FACE FOUND':'PARTIAL',
    detail: ss<9 ? 'unnaturally smooth skin — AI plasticky texture' : 'skin texture within normal range' };
}

// ── SIGNAL 5: COLOR HISTOGRAM ──
async function sigColor(id) {
  const d = id.data;
  const hR=new Int32Array(256), hG=new Int32Array(256), hB=new Int32Array(256);
  for (let i=0;i<d.length;i+=4){hR[d[i]]++;hG[d[i+1]]++;hB[d[i+2]]++;}
  let hs = 0;
  for (let v=1;v<255;v++) hs += Math.abs(hR[v]-(hR[v-1]+hR[v+1])/2) + Math.abs(hG[v]-(hG[v-1]+hG[v+1])/2) + Math.abs(hB[v]-(hB[v-1]+hB[v+1])/2);
  const hS = hs/254 < 600 ? clamp((600-hs/254)/8,0,90) : 0;
  let sv = [];
  for (let i=0;i<d.length;i+=16){const r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255;sv.push(Math.max(r,g,b)-Math.min(r,g,b));}
  const sm = sv.reduce((a,b)=>a+b,0)/sv.length;
  const ss = Math.sqrt(sv.reduce((s,v)=>s+(v-sm)**2,0)/sv.length);
  return clamp(hS*0.55 + (ss<0.20?clamp((0.20-ss)*400,0,80):0)*0.45, 0, 100);
}

// ── SIGNAL 6: HAND ANATOMY ──
async function sigHands(id, w, h) {
  const d = id.data, mask = new Uint8Array(w*h); let sc = 0;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    const i=(y*w+x)*4,r=d[i],g=d[i+1],b=d[i+2];
    if ((r>95&&g>40&&b>20&&(Math.max(r,g,b)-Math.min(r,g,b))>15&&Math.abs(r-g)>15&&r>g&&r>b)||
        (r>100&&g>60&&b>40&&r-b>30&&r-g>10&&r-g<50)){mask[y*w+x]=1;sc++;}
  }
  if (sc<150) return {score:20,lbl:'NO HANDS',detail:'no hand regions detected'};
  let maxP=0; const sy=Math.max(1,Math.floor(h/20));
  for (let y=sy;y<h-sy;y+=sy){let t=0,inS=false;for(let x=1;x<w;x++){const c=mask[y*w+x]===1;if(c!==inS){t++;inS=c;}}maxP=Math.max(maxP,Math.floor(t/2));}
  let bc=0,bt=0;
  for(let y=1;y<h-1;y+=2)for(let x=1;x<w-1;x+=2){
    if(mask[y*w+x]){const nb=[mask[(y-1)*w+x],mask[(y+1)*w+x],mask[y*w+x-1],mask[y*w+x+1]];const bor=nb.filter(n=>!n).length;if(bor>0&&bor<4)bc++;bt++;}
  }
  const br=bt>0?bc/bt:0;
  const pA=(maxP>7||(maxP>0&&maxP<2))?40:0;
  const sH=br<.15&&sc>400?(.15-br)*250:0;
  return {score:clamp(pA+sH*.5,0,100),lbl:`${maxP} PROTRUSIONS`,detail:pA>0?`abnormal finger count (${maxP}) — AI artifact`:'hand anatomy within normal range'};
}

// ── SIGNAL 7: LIGHTING PHYSICS ──
async function sigLight(id, w, h) {
  const d=id.data; let vecs=[],sp=0,tot=0;
  const st=Math.max(1,Math.floor(Math.min(w,h)/30));
  for(let y=st;y<h-st;y+=st)for(let x=st;x<w-st;x+=st){
    const i=(y*w+x)*4,li=lum(d,i);
    if(li<60){let nx=0,ny=0,bd=Infinity;
      for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){if(!dx&&!dy)continue;const ni=((y+dy*st)*w+(x+dx*st))*4;if(ni<0||ni>=d.length)continue;const nl=lum(d,ni);if(nl>150){const dist=Math.sqrt(dx*dx+dy*dy);if(dist<bd){bd=dist;nx=dx;ny=dy;}}}
      if(bd<Infinity)vecs.push({x:nx,y:ny});
    }
    const r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255,li2=.299*r+.587*g+.114*b,sat=Math.max(r,g,b)-Math.min(r,g,b);
    if(li2>.92&&sat<.08)sp++;tot++;
  }
  let sScore=0;
  if(vecs.length>5){const ax=vecs.reduce((s,v)=>s+v.x,0)/vecs.length,ay=vecs.reduce((s,v)=>s+v.y,0)/vecs.length;sScore=clamp(vecs.reduce((s,v)=>s+(v.x-ax)**2+(v.y-ay)**2,0)/vecs.length*15,0,80);}
  const spS=clamp(((sp/Math.max(tot,1))-.05)*800,0,70);
  return {score:clamp(sScore*.6+spS*.4,0,100),lbl:sScore+spS>50?'INCONSISTENT':'CONSISTENT',detail:sScore>40?'shadows point in conflicting directions':'lighting physics consistent'};
}

// ── SIGNAL 8: BACKGROUND COHERENCE ──
async function sigBg(id, w, h) {
  const d=id.data,cx2=w/2,cy2=h/2,fr=Math.min(w,h)*.35;
  let fgV=0,bgV=0,fgC=0,bgC=0;const bs=12;
  for(let y=0;y<h-bs;y+=bs)for(let x=0;x<w-bs;x+=bs){
    const dist=Math.sqrt((x+bs/2-cx2)**2+(y+bs/2-cy2)**2);
    let vals=[];
    for(let dy=0;dy<bs;dy++)for(let dx=0;dx<bs;dx++)vals.push(lum(d,((y+dy)*w+(x+dx))*4));
    const m=vals.reduce((a,b)=>a+b,0)/vals.length,v=vals.reduce((s,v)=>s+(v-m)**2,0)/vals.length;
    if(dist<fr){fgV+=v;fgC++;}else{bgV+=v;bgC++;}
  }
  const ratio=(fgC&&bgC&&bgV/bgC>0)?((fgV/fgC)/(bgV/bgC)):1;
  const inco=ratio>4?clamp((ratio-4)*12,0,80):0;
  let tm=0,tt=0;const ts=32;
  if(w>ts*3&&h>ts*3)for(let y=0;y<Math.min(h-ts*2,160);y+=ts)for(let x=0;x<Math.min(w-ts*2,160);x+=ts){
    let diff=0,cnt=0;
    for(let dy=0;dy<ts;dy+=4)for(let dx=0;dx<ts;dx+=4){const i1=((y+dy)*w+(x+dx))*4,i2=((y+dy)*w+(x+dx+ts))*4;if(i2<d.length){diff+=Math.abs(d[i1]-d[i2])+Math.abs(d[i1+1]-d[i2+1])+Math.abs(d[i1+2]-d[i2+2]);cnt++;}}
    if(cnt&&diff/cnt<8)tm++;tt++;
  }
  const tS=tt?clamp((tm/tt)*150,0,70):0;
  return {score:clamp(inco*.55+tS*.45,0,100),lbl:inco+tS>50?'INCOHERENT':'COHERENT',detail:inco>40?'background degraded — AI artifact':tS>35?'repeating tile artifacts':'background coherence normal'};
}

// ── SIGNAL 9: TEXT & GEOMETRY ──
async function sigTextGeo(id, w, h) {
  const d=id.data;let hEdges=[],viol=0;
  for(let y=2;y<h-2;y+=4)for(let x=2;x<w-2;x+=4)if(Math.abs(lum(d,((y-2)*w+x)*4)-lum(d,((y+2)*w+x)*4))>40)hEdges.push({x,y});
  if(hEdges.length>20){
    const yG={};
    hEdges.forEach(e=>{const gy=Math.round(e.y/20)*20;if(!yG[gy])yG[gy]=[];yG[gy].push(e.y);});
    Object.values(yG).forEach(ys=>{if(ys.length<3)return;const m=ys.reduce((a,b)=>a+b,0)/ys.length;if(Math.sqrt(ys.reduce((a,v)=>a+(v-m)**2,0)/ys.length)>8)viol++;});
  }
  const gS=clamp(viol*18,0,80);
  let tr=0,tt=0;const tb=8;
  for(let y=0;y<h-tb;y+=tb)for(let x=0;x<w-tb;x+=tb){
    let maxL=0,minL=255,sw=0,prev=-1;
    for(let dy=0;dy<tb;dy++)for(let dx=0;dx<tb;dx++){const l=lum(d,((y+dy)*w+(x+dx))*4);if(l>maxL)maxL=l;if(l<minL)minL=l;if(prev>=0&&Math.abs(l-prev)>25)sw++;prev=l;}
    if(maxL-minL>100&&sw>6)tr++;tt++;
  }
  const tS=clamp(((tr/Math.max(tt,1))-.08)*350,0,70);
  return {score:clamp(gS*.45+tS*.55,0,100),lbl:gS+tS>50?'ANOMALOUS':'CONSISTENT',detail:gS>35?'straight lines warped — AI fails vanishing points':tS>30?'chaotic text regions':'geometry consistent'};
}

// ── EXPORT ──
window.ForensicSignals = { sigPixel, sigFFT, sigELA, sigSkin, sigColor, sigHands, sigLight, sigBg, sigTextGeo, pause, lum, clamp };
