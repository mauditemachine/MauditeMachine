// Maquettes MM-RYTM v3 : petits constructeurs (tout en position absolue, en px de la fenetre 1400 x 896).
const ROOT = document.getElementById('root');
const px = (n) => (typeof n === 'number' ? n + 'px' : n);
function el(parent, cls, st = {}, html = '') {
  const e = document.createElement('div');
  if (cls) e.className = cls;
  for (const [k, v] of Object.entries(st)) e.style[k] = px(v);
  if (html) e.innerHTML = html;
  (parent || ROOT).appendChild(e);
  return e;
}
const SPEC = {
  k1: { w: 288, h: 288, ax: 142.1, ay: 143.5, R: 120, ref: 30.3, url: 'assets/k1.png' },
  k3: { w: 256, h: 256, ax: 129.83, ay: 128.52, R: 110, ref: 0, url: 'assets/k3.png', cap: 'assets/k3cap.png', cx: 128, cy: 128 },
  sel: { w: 384, h: 384, ax: 190.36, ay: 190.16, R: 172.83, ref: 59.65, url: 'assets/sel.png', cap: 'assets/selcap.png', cx: 190.34, cy: 190.01 },
  tiny: { w: 320, h: 256, ax: 161.5, ay: 120, R: 52.5, ref: 282.7, url: 'assets/tiny.png' },
};

/** Le chassis : joues, panneau alu brosse, vis. */
function chassis() {
  el(ROOT, 'chassis');
  el(ROOT, 'panel');
  const l = el(ROOT, 'cheek l');
  const r = el(ROOT, 'cheek r');
  for (const c of [l, r]) for (const y of [16, 300, 586, 870]) el(c, 'screw', { top: y - 5 });
}

/**
 * Un knob (PNG de Mika) centre en (x, y), diametre d du disque. v 0..1. o : { label, val, ticks, min, max, labGap, big, acc, arc }.
 */
function knob(x, y, kind, d, v, label, o = {}) {
  const S = SPEC[kind];
  const s = d / (2 * S.R);
  const k = el(ROOT, 'knob', { left: x, top: y, width: 0, height: 0 });
  // ombre portee fixe
  const sd = d * 1.22;
  el(k, 'shadow', { left: -sd / 2 + d * 0.05, top: -sd / 2 + d * 0.1, width: sd, height: sd });
  // graduations
  if (o.ticks !== false) {
    const n = o.n || 11;
    const r0 = d / 2 + (o.tg || 5), r1 = r0 + (o.tl || 4);
    let svg = `<svg width="0" height="0" style="left:0;top:0">`;
    for (let i = 0; i < n; i++) {
      const a = ((-135 + (270 * i) / (n - 1)) * Math.PI) / 180;
      const sx = Math.sin(a), sy = -Math.cos(a);
      const big = i === 0 || i === n - 1 || i === (n - 1) / 2;
      svg += `<line x1="${sx * r0}" y1="${sy * r0}" x2="${sx * (r1 + (big ? 1.5 : 0))}" y2="${sy * (r1 + (big ? 1.5 : 0))}" stroke="rgba(235,235,235,${big ? 0.7 : 0.45})" stroke-width="${big ? 1.3 : 1}" stroke-linecap="round"/>`;
    }
    if (o.arc != null) {
      // l'anneau de modulation (LFO, automation) : un arc a l'accent
      const a0 = -135 + 270 * v, a1 = a0 + 270 * o.arc;
      const rr = r0 - 2.5;
      const p = (a) => [Math.sin((a * Math.PI) / 180) * rr, -Math.cos((a * Math.PI) / 180) * rr];
      const [x0, y0] = p(Math.min(a0, a1)), [x1, y1] = p(Math.max(a0, a1));
      const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
      svg += `<path d="M${x0} ${y0} A${rr} ${rr} 0 ${large} 1 ${x1} ${y1}" stroke="#ffd900" stroke-width="2" fill="none" stroke-linecap="round" style="filter:drop-shadow(0 0 3px rgba(255,217,0,.7))"/>`;
    }
    svg += '</svg>';
    k.insertAdjacentHTML('beforeend', svg);
  }
  const rot = -135 + 270 * v - S.ref;
  el(k, 'rot', { left: -S.ax * s, top: -S.ay * s, width: S.w * s, height: S.h * s, backgroundImage: `url(${S.url})`, transformOrigin: `${S.ax * s}px ${S.ay * s}px`, transform: `rotate(${rot}deg)` });
  if (S.cap) el(k, 'cap', { left: -S.cx * s, top: -S.cy * s, width: S.w * s, height: S.h * s, backgroundImage: `url(${S.cap})` });
  const ly = d / 2 + (o.ticks === false ? 7 : (o.tg || 5) + (o.tl || 4) + 5) + (o.labGap || 0);
  if (label) el(k, 'lab' + (o.big ? ' big' : '') + (o.acc ? ' acc' : ''), { top: ly }, label);
  if (o.val) el(k, 'val', { top: ly + (o.big ? 14 : 13) }, o.val);
  if (o.min != null) el(k, 'mm', { right: d * 0.36 + 4, top: d * 0.36 + 2, textAlign: 'right' }, o.min);
  if (o.max != null) el(k, 'mm', { left: d * 0.36 + 4, top: d * 0.36 + 2 }, o.max);
  if (o.marks) for (const [t, a, acc] of o.marks) {
    const r = d / 2 + 16, rad = (a * Math.PI) / 180;
    el(k, 'mm', { left: Math.sin(rad) * r, top: -Math.cos(rad) * r - 4, transform: 'translateX(-50%)', color: acc ? 'var(--acc)' : '#a8a8a8' }, t);
  }
  return k;
}

/** Une touche pilule. o : { led: 'on'|'off'|'onr'|null, lit: 'lit'|'red', ico, inner, sub, labAcc, ledIn } */
function key(x, y, w, h, label, o = {}) {
  const k = el(ROOT, 'key', { left: x, top: y, width: w, height: h });
  el(k, 'cap' + (o.lit ? ' ' + o.lit : ''), { borderRadius: o.r != null ? o.r : Math.min(11, h / 2) });
  if (o.led !== null && o.led !== undefined) el(k, 'led ' + (o.led === 'off' ? '' : o.led), o.ledIn ? { top: 6 } : { top: -10 });
  if (o.ico) el(k, 'ico' + (o.lit ? ' dark' : ''), o.icoSt || {}, o.ico);
  if (o.inner) el(k, 'in' + (o.lit ? ' dark' : ''), o.inSt || {}, o.inner);
  if (label) el(k, 'lab' + (o.labAcc ? ' acc' : ''), o.labSt || {}, label);
  if (o.sub) el(k, 'sub', { top: `calc(100% + ${label ? 19 : 7}px)` }, o.sub);
  return k;
}

function vrule(x, y, h) { return el(ROOT, 'vrule', { left: x, top: y, height: h }); }
function hrule(x, y, w) { return el(ROOT, 'hrule', { left: x, top: y, width: w }); }
function title(x, y, w, t, small) { return el(ROOT, 'sec', { left: x, top: y, width: w, height: 14 }, `<div class="t">${t}${small ? `<small>${small}</small>` : ''}</div>`); }
function bracket(x, y, w, t) { return el(ROOT, 'bracket', { left: x, top: y, width: w }, t ? `<span>${t}</span>` : ''); }
function note(x, y, html, st = {}) { return el(ROOT, 'note', { left: x, top: y, ...st }, html); }

/** Une bascule (OFF / ON) : on true a droite. */
function toggle(x, y, a, b, on, label) {
  const t = el(ROOT, 'tog', { left: x, top: y, width: 44, height: 18 });
  el(t, 'body', { left: 0, top: 0, width: 44, height: 18 });
  el(t, 'lever', { left: on ? 22 : 3, width: 19 });
  el(t, 'o' + (on ? '' : ' on'), { left: -2, top: 23, transform: 'translateX(-50%)', left: 6 }, a);
  el(t, 'o' + (on ? ' on' : ''), { right: -2, top: 23, transform: 'translateX(50%)', right: 6 }, b);
  // LED a droite
  el(t, 'key', { left: 52, top: 6.5, width: 0, height: 0 }).innerHTML = `<div class="led ${on ? 'on' : ''}" style="top:0;left:0;margin:0"></div>`;
  if (label) el(t, 'o on', { left: 22, top: 40, transform: 'translateX(-50%)', fontSize: '9px', letterSpacing: '.15em', color: '#dadada' }, label);
  return t;
}

/** Un groupe de choix a LED (STRAIGHT / DOTTED / TRIPLET) au-dessus d'une touche. */
function ledChoice(x, y, opts, on, w = 46) {
  opts.forEach((t, i) => {
    const cx = x + i * w;
    el(ROOT, 'note', { left: cx, top: y, transform: 'translateX(-50%)', color: i === on ? '#f2f2f2' : '#8a8a8a', fontSize: '7.5px' }, t);
    el(ROOT, 'key', { left: cx, top: y + 14, width: 0, height: 0 }).innerHTML = `<div class="led ${i === on ? 'on' : ''}" style="top:0"></div>`;
  });
}

function lcd(x, y, w, h, html = '', st = {}) { return el(ROOT, 'lcd', { left: x, top: y, width: w, height: h, ...st }, html); }
function tag(x, y, t) { return el(ROOT, 'tag', { left: x, top: y }, t); }

/* ---------- les donnees de la machine ---------- */
const TRACKS = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY', 'BD2', 'SD2', 'CH2', 'OH2', 'CP2', 'TOM2', 'HT2', 'CY2'];
// un groove (lignes = pistes, 16 pas) : x = coup, a = accent
const GROOVE = [
  'x...x...x...x...',
  '....x.......x...',
  '..x...x...x...xx',
  '..x...x...x...x.',
  '....x.......x..x',
  '.......x......x.',
  '...x.......x....',
  'x...............',
  '..........x.....',
  '.x.....x...x....',
  'x.x.x.x.x.x.x.x.',
  '......x.........',
  '...........x....',
  '...x............',
  '.........x....x.',
  '................',
];
let WAVE = null;
async function loadWave() { WAVE = await (await fetch('assets/wave.json')).json(); }

/** Une forme d'onde en SVG (min/max par colonne). */
function waveSvg(w, h, o = {}) {
  const pts = WAVE.bd.pts;
  const n = pts.length;
  const from = o.from || 0, to = o.to || n;
  const mid = h / 2, amp = (h / 2) * (o.gain || 0.92);
  let top = '', bot = '';
  for (let i = from; i < to; i++) {
    const x = ((i - from) / (to - from)) * w;
    top += `${i === from ? 'M' : 'L'}${x.toFixed(1)} ${(mid - pts[i][1] * amp).toFixed(1)}`;
  }
  for (let i = to - 1; i >= from; i--) {
    const x = ((i - from) / (to - from)) * w;
    bot += `L${x.toFixed(1)} ${(mid - pts[i][0] * amp).toFixed(1)}`;
  }
  return `<path d="${top}${bot}Z" fill="${o.fill || '#ececec'}" ${o.op ? `opacity="${o.op}"` : ''}/>`;
}
