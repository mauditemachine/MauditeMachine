// Les pages d'OPEN du MM-RYTM v3 : toute la fenetre, comme l'ARP (onglets en haut, bande LIBRARY / MIDI / LEARN en bas).
function openFrame(active, o = {}) {
  chassis();
  header({ open: true, active, newTab: o.newTab });
  if (o.tracks !== false) trackStrip(72, o.sel || 0);
  // la bande du bas
  el(ROOT, 'foot');
  [['LIBRARY', 70], ['MIDI', 142], ['LEARN', 214]].forEach(([l, x]) => key(x, 846, 50, 22, l, { led: o.foot === l ? 'on' : 'off', lit: o.foot === l ? 'lit' : undefined, labSt: { top: '29px' } }));
  note(300, 852, o.hint || '', { fontSize: '7.5px', color: '#7a7a7a' });
  lcd(1020, 840, 224, 42, `<div class="t8" style="position:absolute;left:10px;top:6px;font-size:7px">MM-RYTM · A01 · 808 SUB BOOM</div><div class="dots w" style="position:absolute;left:10px;top:17px;font-size:17px">${o.lcd || active}</div>`);
  key(1268, 846, 50, 22, 'CLOSE', { led: 'off', labAcc: true, labSt: { top: '29px' } });
}

function trackStrip(y, sel) {
  note(52, y + 8, 'TRACK', { fontSize: '7.5px', color: '#8a8a8a' });
  const x0 = 98, p = (1348 - x0) / 16;
  TRACKS.forEach((t, i) => {
    const tk = el(ROOT, 'trk' + (i === sel ? ' sel' : ''), { left: x0 + i * p, top: y, width: p - 6, height: 24 });
    el(tk, 'n', { top: '6px', fontSize: '9px' }, t);
  });
}

/** Les envois des 16 pistes vers un FX (une rangee de petits knobs) + le knob MASTER du FX. */
function sendStrip(y, fx, vals, o = {}) {
  title(52, y, 1296, `${fx} · PER TRACK`, o.small || 'CHAQUE PISTE Y ENVOIE');
  const x0 = 96, p = (1236 - x0) / 16;
  TRACKS.forEach((t, i) => {
    knob(x0 + i * p + p / 2 - 6, y + 62, 'k3', 34, vals[i], t, { tg: 3, tl: 3, val: vals[i] ? String(Math.round(vals[i] * 127)) : 'OFF', acc: i === 0 });
  });
  vrule(1252, y + 22, 110);
  knob(1300, y + 64, 'k1', 52, o.master != null ? o.master : 0.75, o.mlabel || 'RETURN', { big: true });
}
const SENDS = (seed) => TRACKS.map((_, i) => [0.22, 0.35, 0, 0.5, 0.3, 0.12, 0, 0.6, 0.15, 0.4, 0.05, 0.45, 0.28, 0, 0.2, 0.55][(i + seed) % 16]);

function presetList(x, y, w, h, groups, on) {
  let s = '';
  let n = 1;
  for (const [g, items] of groups) {
    s += `<div class="h"><span>${g}</span><span>${items.length}</span></div>`;
    for (const it of items) { s += `<div class="r${it === on ? ' on' : ''}"><span><em>${String(n).padStart(2, '0')}</em>${it}</span>${it === on ? '<i class="d"></i>' : ''}</div>`; n++; }
  }
  return el(ROOT, 'list', { left: x, top: y, width: w, height: h }, s);
}
function prevNext(x, y, w) {
  const p = w / 3;
  ['PREV', 'NEXT', 'INIT'].forEach((l, i) => key(x + i * p + (p - 44) / 2, y, 44, 20, l, { led: null, labSt: { top: '26px', fontSize: '8px' } }));
}

/* ======================= SAMPLE ======================= */
function page_open_sample() {
  openFrame('SAMPLE', { lcd: 'SAMPLE · BD', hint: 'DRAG S AND E · SHIFT : FINE · WHEEL : ZOOM · DOUBLE CLICK : THE WHOLE SAMPLE' });
  const y = 110;
  key(52, y, 30, 26, '', { led: null, ico: '◀', r: 7 });
  key(88, y, 30, 26, '', { led: null, ico: '▶', r: 7 });
  note(132, y + 3, '<span style="color:#8a8a8a">BD</span> &nbsp;<b style="font-size:17px;letter-spacing:.08em;color:#fff">808 SUB BOOM</b> &nbsp; <span style="color:var(--acc)">06 / 44</span>', { fontSize: '10px' });
  [['LISTEN', 'on'], ['REVERSE', 'off'], ['RESET', 'off'], ['IMPORT…', 'off'], ['FOLDER', 'off']].forEach(([l, led], i) =>
    key(676 + i * 74, y + 1, 66, 24, '', { led: null, inner: `<span style="display:flex;gap:6px;align-items:center"><i class="led ${led === 'on' ? 'on' : ''}" style="position:static;margin:0;display:inline-block"></i>${l}</span>`, inSt: { fontSize: '8px' } }));
  // la forme d'onde
  const W = 988, H = 292;
  const L = lcd(52, y + 40, W, H);
  const eX = W * 0.88;
  let ruler = '';
  for (let i = 0; i <= 14; i++) ruler += `<div class="t8" style="position:absolute;left:${(i * W) / 14 + 4}px;bottom:6px;font-size:7px">${Math.round((i * 1532) / 14)} MS</div><i style="position:absolute;left:${(i * W) / 14}px;top:0;bottom:0;width:1px;background:rgba(255,255,255,.05)"></i>`;
  L.innerHTML = `${ruler}
    <svg style="position:absolute;left:0;top:22px" width="${W}" height="${H - 50}">${waveSvg(W, H - 50, { fill: '#efefef', gain: 0.9 })}
      <rect x="${eX}" y="0" width="${W - eX}" height="${H - 50}" fill="rgba(0,0,0,.62)"/>
      <path d="M0 4 L10 4 C ${W * 0.2} ${(H - 50) * 0.32}, ${W * 0.5} ${(H - 50) * 0.62}, ${eX} ${(H - 50) * 0.74}" stroke="#ffd900" stroke-width="2" fill="none" style="filter:drop-shadow(0 0 4px rgba(255,217,0,.7))"/>
      <line x1="1" y1="0" x2="1" y2="${H - 50}" stroke="#ffd900" stroke-width="2"/><line x1="${eX}" y1="0" x2="${eX}" y2="${H - 50}" stroke="#ffd900" stroke-width="2"/>
      <line x1="0" y1="${(H - 50) / 2}" x2="${W}" y2="${(H - 50) / 2}" stroke="rgba(255,255,255,.12)"/></svg>
    <div style="position:absolute;left:0;top:8px;width:16px;height:16px;background:#ffd900;color:#111;font:800 9px SF;display:grid;place-items:center;border-radius:0 3px 3px 0">S</div>
    <div style="position:absolute;left:${eX - 15}px;top:8px;width:16px;height:16px;background:#ffd900;color:#111;font:800 9px SF;display:grid;place-items:center;border-radius:3px 0 0 3px">E</div>
    <div class="t8" style="position:absolute;left:24px;top:9px">SAMPLE · <span class="w">BD 808 SUB BOOM</span> · <span class="a">AMP ENVELOPE</span></div>
    <div class="t8" style="position:absolute;right:12px;top:9px">ZOOM <span class="w">1 : 1</span></div>`;
  note(52, y + 342, 'START <b>0.0 MS</b> &nbsp; END <b>1349 MS</b> &nbsp; PLAYS <b>1.35 S</b> &nbsp; MONO · 48.0 KHZ');
  note(1040, y + 342, '<i>YELLOW</i> : THE AMP ENVELOPE', { transform: 'translateX(-100%)' });
  // la banque a droite
  const bank = ['808 SUB BOOM', '909 PUNCH', 'DEEP HOUSE THUMP', 'HARDGROOVE DRIVE', 'INDUSTRIAL SLAM', 'WAREHOUSE RUMBLE', 'BD 1', 'BD 2', 'BD 3', 'BD 4', 'BD 5', 'BD 6', 'BD 7'];
  let s = `<div class="h"><span>BANK · BD</span><span>44</span></div>`;
  bank.forEach((b, i) => (s += `<div class="r${i === 0 ? ' on' : ''}"><span><em>${String(i + 1).padStart(2, '0')}</em>${b}</span>${i === 0 ? '<i class="d"></i>' : ''}</div>`));
  s += `<div class="h"><span>MY SAMPLES · ~/MUSIC/MM-RYTM SAMPLES/BD</span><span>3</span></div>`;
  ['KICK ROOM 01', 'KICK TAPE 124', 'SUB DROP'].forEach((b, i) => (s += `<div class="r"><span><em>U${i + 1}</em>${b}</span></div>`));
  el(ROOT, 'list', { left: 1060, top: y, width: 288, height: 334 }, s);

  // les reglages
  const yk = 486;
  hrule(52, yk - 12, 1296);
  title(52, yk, 400, 'SAMPLE');
  [['START', 0, '0 MS'], ['LEN', 0.88, '1349 MS'], ['LEVEL', 0.8, '102 · 0.0 DB']].forEach(([l, v, val], i) => knob(110 + i * 128, yk + 92, 'k1', 64, v, l, { big: true, val }));
  [['TUNE', 0.5, '0 ST'], ['FINE', 0.5, '0 CT']].forEach(([l, v, val], i) => knob(110 + i * 128, yk + 222, 'k3', 46, v, l, { val }));
  toggle(342, yk + 206, 'FWD', 'REV', false, 'PLAY');
  vrule(470, yk + 4, 330);
  title(486, yk, 380, 'AMP ENVELOPE');
  lcd(496, yk + 26, 360, 84, `<svg style="position:absolute;left:10px;top:10px" width="340" height="64"><path d="M0 63 L6 4 L40 4 C120 26 200 52 340 61" stroke="#ffd900" stroke-width="1.8" fill="none" style="filter:drop-shadow(0 0 3px rgba(255,217,0,.6))"/><path d="M0 63 L6 4 L40 4 C120 26 200 52 340 61 L340 64 L0 64Z" fill="rgba(255,217,0,.1)"/></svg><div class="t8" style="position:absolute;right:10px;top:7px">ATK <span class="w">0</span> · HOLD <span class="w">4 MS</span> · DEC <span class="w">4.5 S</span></div>`);
  [['ATK', 0, 'SNAP'], ['HOLD', 0.05, '4 MS'], ['DEC', 0.976, '124 · 4.5 S'], ['PAN', 0.5, 'CENTER']].forEach(([l, v, val], i) => knob(540 + i * 92, yk + 196, 'k1', 54, v, l, { val }));
  vrule(882, yk + 4, 330);
  title(898, yk, 450, 'FILTER');
  lcd(908, yk + 26, 430, 84, `<svg style="position:absolute;left:10px;top:10px" width="410" height="64"><path d="M0 22 L250 22 C285 22 292 6 300 6 C310 6 318 30 345 52 L410 64" stroke="#ffd900" stroke-width="1.8" fill="none" style="filter:drop-shadow(0 0 3px rgba(255,217,0,.6))"/><path d="M0 22 L250 22 C285 22 292 6 300 6 C310 6 318 30 345 52 L410 64 L0 64Z" fill="rgba(255,217,0,.1)"/></svg><div class="t8" style="position:absolute;left:10px;top:7px">LOW PASS · <span class="w">6.9 KHZ</span> · Q <span class="w">1.4</span></div>`);
  knob(950, yk + 196, 'k1', 64, 0.78, 'FREQ', { big: true, val: '6.9 KHZ' });
  knob(1046, yk + 196, 'k3', 46, 0.25, 'RESO', { val: 'Q 1.4' });
  knob(1126, yk + 182, 'tiny', 36, 0.15, '', { ticks: false, marks: [['LP', -60, true], ['BP', 0], ['HP', 60]] });
  note(1126, yk + 216, 'TYPE', { transform: 'translateX(-50%)', color: '#dadada', fontSize: '9px' });
  [['ENV', 0.62, '+40'], ['ATK', 0.05, '0'], ['DEC', 0.45, '210 MS']].forEach(([l, v, val], i) => knob(1196 + i * 58, yk + 196, 'k3', 40, v, l, { val }));
}

/* ======================= SEQ ======================= */
function page_open_seq() {
  openFrame('SEQ', { lcd: 'SEQ · BD', hint: 'CLICK : TRIG · DRAG : DRAW · RIGHT CLICK : CONDITIONS · DRAG END : TRACK LENGTH', newTab: 'SEQ' });
  const y = 108;
  note(52, y + 4, 'STEP <b style="font-size:13px">05</b> / 16 &nbsp; <i>PLAYING</i>');
  el(ROOT, 'sec', { left: 300, top: y + 2, width: 800, height: 14 }, '<div class="t">STEP SEQUENCER · T1 BD</div>');
  note(1060, y + 4, 'PAGE');
  ['1', '2', '3', '4'].forEach((t, i) => key(1094 + i * 30, y, 24, 20, '', { led: null, inner: t, lit: i === 0 ? 'lit' : undefined, r: 6 }));
  note(1222, y + 4, 'LENGTH');
  key(1268, y, 20, 20, '', { led: null, inner: '−', r: 6 });
  note(1296, y + 2, '<b style="font-size:13px">16</b>');
  key(1322, y, 20, 20, '', { led: null, inner: '+', r: 6 });
  // les voies
  const lanes = [['TRIG', '▮▯▮'], ['VELOCITY', '▁▃▆'], ['PROBABILITY', '%'], ['CONDITION', '1:2'], ['μTIME', '⇆'], ['RETRIG', '•••'], ['LENGTH', '▬▏'], ['P-LOCK', '●']];
  lanes.forEach(([l, ic], i) => {
    const k = key(52, y + 40 + i * 46, 132, 34, '', { led: null, lit: i === 1 ? undefined : undefined });
    if (i === 1) k.querySelector('.cap').style.boxShadow = '0 0 0 1px var(--acc), 0 0 12px rgba(255,217,0,.25), inset 0 1px 0 rgba(255,255,255,.1)';
    el(k, 'in', { justifyContent: 'start', paddingLeft: '12px', display: 'flex', gap: '9px', color: i === 1 ? 'var(--acc)' : '#d8d8d8' }, `<i class="led ${i === 1 ? 'on' : ''}" style="position:static;margin:0;display:inline-block"></i><span style="width:22px;font-size:9px;color:${i === 1 ? 'var(--acc)' : '#aaa'}">${ic}</span>${l}`);
  });
  // la voie VELOCITY
  const x0 = 206, gw = 1142, p = gw / 16, top = y + 40, hh = 340;
  const L = lcd(x0, top, gw, hh);
  let h = '';
  const vel = [100, 0, 0, 0, 92, 0, 70, 0, 100, 0, 64, 0, 96, 0, 45, 0];
  const cond = { 2: '1:2', 10: '3:4', 14: '50%' };
  for (let i = 0; i < 16; i++) {
    const x = i * p;
    h += `<i style="position:absolute;left:${x}px;top:0;bottom:0;width:1px;background:${i % 4 === 0 ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.05)'}"></i>`;
    h += `<div class="t8" style="position:absolute;left:${x}px;width:${p}px;top:8px;text-align:center;color:${i === 4 ? '#ffd900' : '#9a9a9a'}">${i + 1}</div>`;
    const on = vel[i] > 0 || i === 2;
    h += `<div style="position:absolute;left:${x + 12}px;width:${p - 24}px;top:24px;height:14px;border-radius:3px;background:${on ? '#ff3d2e' : '#1a1a1a'};box-shadow:${on ? '0 0 8px rgba(255,61,46,.5)' : 'inset 0 1px 2px #000'}"></div>`;
    if (cond[i]) h += `<div style="position:absolute;left:${x}px;width:${p}px;top:46px;text-align:center"><span class="chip a" style="font-size:7px">${cond[i]}</span></div>`;
    const v = vel[i] || (i === 2 ? 55 : 0);
    if (v) {
      const bh = ((hh - 110) * v) / 127;
      h += `<div style="position:absolute;left:${x + 16}px;width:${p - 32}px;bottom:34px;height:${bh}px;background:linear-gradient(rgba(255,217,0,.55),rgba(255,217,0,.18));border-top:3px solid #ffd900;box-shadow:0 -2px 10px rgba(255,217,0,.35)"></div>`;
      h += `<div class="t8 w" style="position:absolute;left:${x}px;width:${p}px;bottom:${40 + bh}px;text-align:center;font-size:9px">${v}</div>`;
    } else h += `<div style="position:absolute;left:${x + 16}px;width:${p - 32}px;bottom:34px;height:2px;background:rgba(255,255,255,.12)"></div>`;
    if (i === 6 || i === 12) h += `<div style="position:absolute;left:${x + p / 2 - 3}px;bottom:16px;width:6px;height:6px;border-radius:50%;background:#ffd900;box-shadow:0 0 5px rgba(255,217,0,.7)"></div>`;
  }
  h += `<div style="position:absolute;left:${4 * p}px;top:0;bottom:0;width:${p}px;background:rgba(255,217,0,.06);border-left:1px solid rgba(255,217,0,.4);border-right:1px solid rgba(255,217,0,.4)"></div>`;
  h += `<div class="t8" style="position:absolute;left:10px;bottom:6px;font-size:7px">VELOCITY · <span class="w">WHAT EACH STEP HITS</span> &nbsp; <span class="a">●</span> P-LOCK &nbsp; <span class="a">1:2</span> CONDITION</div>`;
  h += `<div style="position:absolute;right:0;top:0;bottom:0;width:3px;background:#ffd900;box-shadow:0 0 8px rgba(255,217,0,.6)"></div><div class="t8 a" style="position:absolute;right:8px;top:24px">END</div>`;
  L.innerHTML = h;
  // dessous : TRIG, VAR, GROOVE
  const yb = 512;
  hrule(52, yb - 10, 1296);
  title(52, yb, 450, 'TRIG', 'DEFAUT DE LA PISTE');
  [['NOTE', 0.5, '0'], ['VEL', 0.78, '100'], ['LEN', 0.3, '1/16'], ['PROB', 1, '100 %'], ['COND', 0.1, 'ALWAYS'], ['μTIME', 0.5, '0'], ['RETRIG', 0, 'OFF'], ['RATE', 0.4, '1/32']].forEach(([l, v, val], i) =>
    knob(96 + (i % 4) * 110, yb + 72 + Math.floor(i / 4) * 112, i === 4 ? 'sel' : 'k3', i === 4 ? 48 : 44, v, l, { val }));
  vrule(518, yb + 4, 300);
  title(534, yb, 450, 'VAR', 'CHAQUE COUP VARIE');
  [['TUNE', 0.2, '±2 ST'], ['FREQ', 0.35, '±30 %'], ['LEV', 0.25, '±3 DB'], ['PAN', 0, 'OFF'], ['DEC', 0.3, '±20 %'], ['START', 0.1, '±5 MS'], ['CHANCE', 0.6, '60 %'], ['SEED', 0.42, '107']].forEach(([l, v, val], i) =>
    knob(578 + (i % 4) * 110, yb + 72 + Math.floor(i / 4) * 112, 'k3', 44, v, l, { val }));
  vrule(1000, yb + 4, 300);
  title(1016, yb, 332, 'GROOVE · RANDOM');
  knob(1080, yb + 84, 'k1', 70, 0.54, 'SWING', { big: true, val: '54 %' });
  knob(1180, yb + 84, 'k3', 46, 0.5, 'STRETCH', { val: '1X' });
  knob(1276, yb + 84, 'k3', 46, 0.25, 'HUMAN', { val: '25 %' });
  [['BEAT', 'on'], ['FILL', 'off'], ['TRACK', 'off'], ['CLEAR', 'off']].forEach(([l, led], i) => key(1030 + i * 80, yb + 214, 64, 26, l, { led }));
  tag(1250, yb + 180, 'HUMAN : NEW');
}

/* ======================= LFO ======================= */
function lfoPanel(x, n, o) {
  const w = 638;
  title(x, 110, w, `LFO ${n}`, o.dest);
  const L = lcd(x + 10, 136, w - 20, 168);
  let h = '';
  for (let b = 0; b <= 8; b++) h += `<i style="position:absolute;left:${(b * (w - 20)) / 8}px;top:0;bottom:0;width:1px;background:${b % 4 === 0 ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.05)'}"></i>`;
  h += `<i style="position:absolute;left:0;right:0;top:84px;height:1px;background:rgba(255,255,255,.1)"></i>`;
  const pts = [];
  for (let i = 0; i <= 300; i++) { const t = i / 300; pts.push(`${i ? 'L' : 'M'}${t * (w - 20)} ${84 - 58 * o.f(t)}`); }
  h += `<svg style="position:absolute;left:0;top:0" width="${w - 20}" height="168"><path d="${pts.join('')}" stroke="${o.c}" stroke-width="2" fill="none" style="filter:drop-shadow(0 0 4px ${o.c === '#ffd900' ? 'rgba(255,217,0,.6)' : 'rgba(255,255,255,.35)'})"/><circle cx="${(w - 20) * o.ph}" cy="${84 - 58 * o.f(o.ph)}" r="5" fill="#fff"/></svg>`;
  h += `<div class="t8" style="position:absolute;left:10px;top:8px">${o.wave} · <span class="w">${o.rate}</span> · DEPTH <span class="a">${o.depth}</span> · ${o.mode}</div>`;
  h += `<div class="t8" style="position:absolute;left:10px;bottom:7px;font-size:7px">1 BAR</div><div class="t8" style="position:absolute;right:10px;bottom:7px;font-size:7px">2 BARS</div>`;
  L.innerHTML = h;
  note(x + 10, 318, 'WAVE');
  ['TRI', 'SINE', 'SQR', 'SAW', 'EXP', 'RMP', 'RND'].forEach((t, i) => key(x + 52 + i * 52, 314, 44, 20, '', { led: null, inner: t, lit: i === o.wi ? 'lit' : undefined, r: 6, inSt: { fontSize: '8px' } }));
  note(x + 10, 348, 'DEST');
  const dests = ['PITCH', 'FREQ', 'RESO', 'VOL', 'PAN', 'DIST', 'DELAY', 'REVERB', 'TONE', 'DECAY'];
  dests.forEach((t, i) => key(x + 52 + (i % 5) * 78, 344 + Math.floor(i / 5) * 28, 70, 22, '', { led: null, inner: t, lit: t === o.dest ? 'lit' : undefined, r: 6, inSt: { fontSize: '8px' } }));
  note(x + 456, 348, 'MODE');
  ['FREE', 'TRIG', 'HOLD', 'ONE', 'HALF'].forEach((t, i) => key(x + 456 + (i % 3) * 58, 362 + Math.floor(i / 3) * 28, 50, 22, '', { led: null, inner: t, lit: i === o.mi ? 'lit' : undefined, r: 6, inSt: { fontSize: '8px' } }));
  [['RATE', o.rv, o.rate, 'k1', 66], ['DEPTH', o.dv, o.depth, 'k1', 66], ['MULT', 0.4, 'X4', 'k3', 46], ['FADE', 0.5, '0', 'k3', 46], ['PHASE', 0, '0°', 'k3', 46]].forEach(([l, v, val, k, d], i) =>
    knob(x + 66 + i * 126, 488, k, d, v, l, { big: k === 'k1', val }));
}
function page_open_lfo() {
  openFrame('LFO', { lcd: 'LFO · BD', hint: 'TWO LFO PER TRACK · THEIR KNOB SHOWS A YELLOW RING ON THE FACE · RANDOM CHANGES THEM, NEVER THE GATE' });
  lfoPanel(52, 1, { dest: 'FREQ', f: (t) => Math.sin(t * Math.PI * 2 * 4), c: '#ffd900', ph: 0.31, wave: 'SINE', wi: 1, rate: '1/8', rv: 0.55, depth: '+46', dv: 0.68, mode: 'TRIG', mi: 1 });
  vrule(700, 116, 440);
  lfoPanel(710, 2, { dest: 'PAN', f: (t) => (Math.floor(t * 4) % 2 ? 1 : -1) * 0.8, c: '#e8e8e8', ph: 0.31, wave: 'SQR', wi: 2, rate: '1 BAR', rv: 0.35, depth: '-20', dv: 0.4, mode: 'FREE', mi: 0 });
  // LFO 3 (proposition)
  const y = 600;
  hrule(52, y - 14, 1296);
  title(52, y, 1296, 'LFO 3 · FX', 'TOUTE LA MACHINE');
  tag(790, y - 3, 'NEW : A VALIDER');
  const L = lcd(62, y + 26, 340, 120);
  const pts = [];
  for (let i = 0; i <= 200; i++) { const t = i / 200; pts.push(`${i ? 'L' : 'M'}${t * 340} ${60 - 40 * (2 * Math.abs(((t * 2) % 1) - 0.5) * 2 - 1)}`); }
  L.innerHTML = `<svg width="340" height="120"><path d="${pts.join('')}" stroke="#ffd900" stroke-width="2" fill="none"/></svg><div class="t8" style="position:absolute;left:10px;top:7px">TRI · <span class="w">2 BARS</span> · <span class="a">HELL FREQ</span></div>`;
  note(424, y + 32, 'DEST');
  ['DELAY TIME', 'DELAY FB', 'REVERB SIZE', 'HELL FREQ', 'HELL MIX', 'DIST DRIVE', 'CHORUS', 'MASTER FILTER'].forEach((t, i) => key(468 + (i % 4) * 96, y + 28 + Math.floor(i / 4) * 30, 88, 22, '', { led: null, inner: t, lit: t === 'HELL FREQ' ? 'lit' : undefined, r: 6, inSt: { fontSize: '7.5px' } }));
  [['RATE', 0.35, '2 BARS', 'k1', 62], ['DEPTH', 0.62, '+38', 'k1', 62], ['WAVE', 0, 'TRI', 'k3', 44], ['MODE', 0, 'FREE', 'k3', 44]].forEach(([l, v, val, k, d], i) => knob(908 + i * 112, y + 84, k, d, v, l, { big: k === 'k1', val }));
}

/* ======================= DISTO ======================= */
function page_open_disto() {
  openFrame('DISTO', { tracks: false, lcd: 'FX · DISTO', hint: 'THE DIST OF EVERY TRACK AND OF THE MASTER · STYLES OF THE DECAPITATOR KIND' });
  const y = 66;
  title(52, y, 270, 'DRIVE', 'MASTER');
  knob(124, y + 92, 'k1', 96, 0.32, '', {});
  el(ROOT, 'note', { left: 124, top: y + 158, transform: 'translateX(-50%)', color: 'var(--acc)', fontSize: '10px', fontWeight: 700 }, '32 %');
  toggle(222, y + 70, 'OFF', 'ON', false, '');
  el(ROOT, 'note', { left: 244, top: y + 126, transform: 'translateX(-50%)', fontSize: '15px', fontWeight: 700, color: '#8a8a8a', letterSpacing: '.18em' }, 'PUNISH');
  note(244, y + 148, '+20 DB', { transform: 'translateX(-50%)', fontSize: '7.5px' });
  const T = lcd(62, y + 186, 250, 96);
  T.innerHTML = `<div class="t8" style="position:absolute;left:9px;top:6px;font-size:7px">TRANSFER</div><svg width="250" height="96"><path d="M8 88 C70 86 90 70 125 48 C160 26 180 12 242 10" stroke="#ffd900" stroke-width="1.8" fill="none"/><line x1="8" y1="88" x2="242" y2="10" stroke="rgba(255,255,255,.15)" stroke-dasharray="3 3"/></svg><div class="t8 a" style="position:absolute;right:9px;bottom:6px;font-size:7px">MM</div>`;
  vrule(334, y + 4, 290);
  title(350, y, 440, 'STYLE');
  const styles = [['MM', 'THE CIRCUIT OF THE MM-RYTM', 'MM'], ['TAPE', 'SOFT · WARM', 'TAPE'], ['DESK', 'CONSOLE · PUSH', 'DESK'], ['IRON', 'TRANSFORMER · THUMP', 'IRON'], ['TUBE', 'TRIODE · GLOW', 'TUBE'], ['PENT', 'PENTODE · SMASH', 'PENT']];
  styles.forEach(([n, d, k], i) => {
    const yy = y + 28 + i * 42;
    note(362, yy + 2, `<b style="font-size:10px;letter-spacing:.16em">${n}</b>`);
    note(362, yy + 17, d, { fontSize: '6.5px', color: '#7d7d7d' });
    key(560, yy + 1, 104, 26, '', { led: null, inner: k === 'MM' ? `<span style="color:#111">MM ENGINE</span>` : k, lit: k === 'MM' ? 'lit' : undefined, r: 13, inSt: { fontSize: '8px' } });
    key(674, yy + 1, 104, 26, '', { led: null, inner: ['', 'TAPE WARM', 'DESK PUSH', 'IRON THUMP', 'TUBE GLOW', 'PENT SMASH'][i] || 'LO-FI', r: 13, inSt: { fontSize: '8px' } });
  });
  vrule(806, y + 4, 290);
  title(822, y, 190, 'OUTPUT');
  knob(870, y + 84, 'k3', 46, 0.5, 'OUTPUT', { val: '0.0 DB', min: '-12', max: '+12' });
  knob(962, y + 84, 'k1', 58, 1, 'MIX', { val: '100 %', min: 'DRY', max: 'WET' });
  toggle(890, y + 186, 'OFF', 'ON', false, 'AUTO');
  vrule(1026, y + 4, 290);
  // VU
  title(1042, y, 150, 'HEAT');
  const V = el(ROOT, 'lcd', { left: 1050, top: y + 28, width: 136, height: 96, borderRadius: '10px', background: 'radial-gradient(120% 90% at 50% 110%, #1d1d1d, #070707)' });
  let vu = '<svg width="136" height="96">';
  for (let i = 0; i <= 12; i++) { const a = (-50 + (100 * i) / 12) * Math.PI / 180; const r0 = 52, r1 = i % 3 ? 58 : 62; vu += `<line x1="${68 + Math.sin(a) * r0}" y1="${86 - Math.cos(a) * r0}" x2="${68 + Math.sin(a) * r1}" y2="${86 - Math.cos(a) * r1}" stroke="${i > 9 ? '#ffd900' : '#cfcfcf'}" stroke-width="1.2"/>`; }
  const na = 18 * Math.PI / 180;
  vu += `<line x1="68" y1="86" x2="${68 + Math.sin(na) * 64}" y2="${86 - Math.cos(na) * 64}" stroke="#ffd900" stroke-width="1.6" style="filter:drop-shadow(0 0 3px rgba(255,217,0,.8))"/><circle cx="68" cy="86" r="6" fill="#222" stroke="#444"/></svg>`;
  V.innerHTML = vu + '<div class="t8" style="position:absolute;left:0;right:0;top:62px;text-align:center;font-size:6px;color:#9a9a9a">MAUDITE MACHINE</div>';
  key(1092, y + 152, 54, 22, 'CAB', { led: null, inner: 'OFF', r: 11, labSt: { top: '28px' } });
  tag(1086, y + 210, 'HEAT : NEW');
  // presets
  title(1206, y, 142, 'PRESETS');
  presetList(1206, y + 24, 142, 256, [['DIST', ['MM', 'TAPE WARM', 'DESK PUSH', 'IRON THUMP', 'TUBE GLOW', 'PENT SMASH', 'LO-FI', 'CRUNCH']]], 'MM');
  prevNext(1206, y + 290, 142);
  // TONE
  const yt = 400;
  hrule(52, yt - 16, 1296);
  title(52, yt, 1296, 'TONE', 'AVANT LA SATURATION');
  const E = lcd(62, yt + 24, 820, 118);
  let g = '';
  ['50', '100', '200', '500', '1K', '2K', '5K', '10K'].forEach((f, i) => { const x = 50 + i * 100; g += `<i style="position:absolute;left:${x}px;top:0;bottom:0;width:1px;background:rgba(255,255,255,.05)"></i><div class="t8" style="position:absolute;left:${x + 3}px;bottom:5px;font-size:7px">${f}</div>`; });
  E.innerHTML = g + `<svg width="820" height="118"><path d="M0 110 C40 110 70 54 110 44 C130 38 150 40 170 50 L600 52 C680 52 720 58 760 90 L820 118" stroke="#ffd900" stroke-width="2" fill="none" style="filter:drop-shadow(0 0 3px rgba(255,217,0,.6))"/><path d="M0 110 C40 110 70 54 110 44 C130 38 150 40 170 50 L600 52 C680 52 720 58 760 90 L820 118 L820 118 L0 118Z" fill="rgba(255,217,0,.08)"/>
    <circle cx="96" cy="48" r="6" fill="#ffd900"/><circle cx="420" cy="51" r="5" fill="#111" stroke="#fff" stroke-width="1.5"/><rect x="740" y="72" width="11" height="11" transform="rotate(45 745 77)" fill="#111" stroke="#fff" stroke-width="1.5"/></svg>
    <div class="t8" style="position:absolute;left:10px;top:7px">LOW CUT <span class="w">60 HZ</span> · THUMP <span class="w">+4 DB</span> · TONE <span class="w">FLAT</span> · HIGH CUT <span class="a">8.2 KHZ · 36 DB</span></div>`;
  [['LOW CUT', 0.25, '60 HZ'], ['THUMP', 0.4, '+4 DB'], ['TONE', 0.5, 'FLAT'], ['HIGH CUT', 0.7, '8.2 KHZ']].forEach(([l, v, val], i) => knob(946 + i * 102, yt + 64, 'k3', 46, v, l, { val }));
  toggle(1050, yt + 132, '12 DB', '36 DB', true, 'STEEP');
  sendStrip(686, 'DIST', SENDS(3), { master: 0.32, mlabel: 'MASTER' });
}

/* ======================= CHORUS ======================= */
function page_open_chorus() {
  openFrame('CHORUS', { tracks: false, lcd: 'FX · CHORUS', hint: 'THE STEREO CHORUS OF THE MM-RYTM · EACH TRACK SENDS INTO IT' });
  const y = 66;
  const L = lcd(52, y + 8, 900, 290);
  let h = '';
  for (let b = 0; b <= 16; b++) h += `<i style="position:absolute;left:${(b * 900) / 16}px;top:0;bottom:0;width:1px;background:${b % 4 === 0 ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.04)'}"></i>`;
  const wave = (ph, amp, mid) => { const p = []; for (let i = 0; i <= 400; i++) { const t = i / 400; p.push(`${i ? 'L' : 'M'}${t * 900} ${mid - amp * Math.sin(t * Math.PI * 2 * 3 + ph)}`); } return p.join(''); };
  h += `<svg width="900" height="290"><path d="${wave(0, 70, 145)}" stroke="#ffd900" stroke-width="2.2" fill="none" style="filter:drop-shadow(0 0 5px rgba(255,217,0,.6))"/><path d="${wave(Math.PI / 2, 70, 145)}" stroke="#e8e8e8" stroke-width="1.6" fill="none" opacity=".85"/>
    <path d="${wave(0, 70, 145)} L900 290 L0 290Z" fill="rgba(255,217,0,.05)"/></svg>`;
  h += `<div class="t8" style="position:absolute;left:12px;top:10px"><span class="a">L</span> · <span class="w">R</span> &nbsp; THE TWO DELAY LINES OF THE CHORUS</div><div style="position:absolute;right:14px;top:8px;display:flex;align-items:baseline;gap:6px"><span class="dots w" style="font-size:30px">0.8</span><span class="t8">HZ</span></div>`;
  L.innerHTML = h;
  title(972, y, 376, 'CHORUS', 'MASTER');
  knob(1056, y + 96, 'k1', 96, 0.4, 'AMOUNT', { big: true, val: '40 %' });
  knob(1180, y + 84, 'k1', 66, 0.624, 'RATE', { big: true, val: '0.8 HZ' });
  knob(1288, y + 84, 'k1', 66, 0.5, 'DEPTH', { big: true, val: '50 %' });
  title(972, y + 200, 376, 'PRESETS');
  ['SUBTLE', 'WIDE', 'JUNO I', 'JUNO II', 'WOBBLE', 'SEASICK'].forEach((t, i) => key(986 + (i % 3) * 120, y + 230 + Math.floor(i / 3) * 34, 104, 24, '', { led: null, inner: t, lit: i === 1 ? 'lit' : undefined, r: 12, inSt: { fontSize: '8px' } }));
  tag(1250, y + 196, 'PRESETS : NEW');
  sendStrip(420, 'CHORUS', SENDS(5), { master: 0.4, mlabel: 'MASTER' });
  // un coup d'oeil a la stereo
  const yb = 640;
  hrule(52, yb - 14, 1296);
  title(52, yb, 1296, 'STEREO', 'CE QUE LE CHORUS ECARTE');
  const S = lcd(62, yb + 26, 1276, 120);
  let s = '';
  TRACKS.forEach((t, i) => { const x = 20 + i * 78; const w = 10 + SENDS(5)[i] * 52; s += `<div class="t8" style="position:absolute;left:${x}px;top:10px;width:60px;text-align:center;color:${i ? '#9a9a9a' : '#ffd900'}">${t}</div><div style="position:absolute;left:${x + 30 - w / 2}px;top:52px;width:${w}px;height:30px;border-radius:15px;background:rgba(255,217,0,${0.12 + SENDS(5)[i] * 0.5});box-shadow:0 0 10px rgba(255,217,0,${SENDS(5)[i] * 0.4})"></div><i style="position:absolute;left:${x + 29}px;top:44px;width:2px;height:46px;background:#fff"></i>`; });
  S.innerHTML = s + '<div class="t8" style="position:absolute;left:12px;bottom:7px;font-size:7px">L ◀ &nbsp; THE WIDTH OF EACH TRACK &nbsp; ▶ R</div>';
}

/* ======================= DELAY ======================= */
function page_open_delay() {
  openFrame('DELAY', { tracks: false, lcd: 'FX · DELAY', hint: 'THE DELAY OF THE MM-RYTM, ON THE TEMPO OF ABLETON · EACH TRACK SENDS INTO IT' });
  const y = 70;
  const W = 900, H = 250;
  const L = lcd(52, y, W, H);
  let h = '<div style="position:absolute;left:16px;top:16px"><div class="t8 a">TIME</div><div class="dots w" style="font-size:40px;line-height:1.1">1/8.</div><div class="t8">363 MS</div><div class="t8 a" style="margin-top:26px">FEEDBACK</div><div class="dots w" style="font-size:30px;line-height:1.1">66 %</div></div>';
  const x0 = 150;
  for (let b = 0; b <= 8; b++) h += `<i style="position:absolute;left:${x0 + (b * (W - x0 - 20)) / 8}px;top:20px;bottom:24px;width:1px;background:${b % 4 === 0 ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.05)'}"></i><div class="t8" style="position:absolute;left:${x0 + (b * (W - x0 - 20)) / 8 + 3}px;bottom:7px;font-size:7px">${b % 4 === 0 ? b / 4 + 1 : ''}</div>`;
  h += `<i style="position:absolute;left:${x0}px;right:20px;top:125px;height:1px;background:rgba(255,255,255,.12)"></i>`;
  let a = 1;
  for (let i = 0; i < 9; i++) {
    const x = x0 + i * ((W - x0 - 20) / 8) * 0.75;
    const hh = 100 * a;
    h += `<div style="position:absolute;left:${x}px;top:${125 - hh}px;width:4px;height:${hh}px;background:${i ? '#ffd900' : '#fff'};border-radius:2px;box-shadow:0 0 8px ${i ? 'rgba(255,217,0,.6)' : 'rgba(255,255,255,.6)'}"></div>`;
    a *= 0.66;
  }
  h += `<svg style="position:absolute;left:0;top:0" width="${W}" height="${H}"><path d="M${x0} 25 C 400 60 600 100 ${W - 20} 118" stroke="rgba(255,217,0,.5)" stroke-dasharray="4 4" fill="none"/></svg>`;
  h += `<div class="t8 a" style="position:absolute;right:16px;top:10px">8 REPEATS · 2 BARS</div>`;
  L.innerHTML = h;
  // mini ecran + presets
  const M = lcd(972, y, 376, 250);
  M.innerHTML = `<div class="t8" style="position:absolute;left:14px;top:12px">▶ DELAY · <span class="w">TAPE ECHO</span></div><div class="dots w" style="position:absolute;left:14px;top:34px;font-size:30px">1/8.</div>
   <div class="t8" style="position:absolute;right:14px;top:40px;line-height:1.9;text-align:right">FEEDBACK <span class="w">66 %</span><br>TONE <span class="w">6.9 KHZ</span><br>RETURN <span class="w">75 %</span><br>SENDS <span class="w">11 / 16</span></div>`;
  presetList(986, y + 100, 348, 136, [['PRESETS', ['DUB 1/8.', 'TIGHT 1/16', 'TAPE ECHO', 'PING 1/4', 'SLAP', 'LONG DARK']]], 'TAPE ECHO');
  // reglages
  const yk = 350;
  hrule(52, yk - 14, 1296);
  title(52, yk, 420, 'TIME');
  knob(130, yk + 98, 'sel', 104, 0.62, '', { n: 6, marks: [['1/32', -135], ['1/16', -81], ['1/16.', -27], ['1/8', 27], ['1/8.', 81, true], ['1/4', 135]] });
  toggle(250, yk + 68, 'FREE', 'SYNC', true, 'SYNC');
  ledChoice(374, yk + 40, ['STRAIGHT', 'DOTTED', 'TRIPLET'], 1, 50);
  key(398, yk + 84, 52, 26, 'TAP', { led: null });
  vrule(486, yk + 4, 220);
  title(502, yk, 440, 'FEEDBACK · TONE');
  knob(590, yk + 98, 'k1', 90, 0.66, 'FEEDBACK', { big: true, val: '66 % · 8 REPEATS', min: '0', max: 'FULL' });
  knob(760, yk + 98, 'k1', 76, 0.638, 'TONE', { big: true, val: '6.9 KHZ', min: 'DARK', max: 'OPEN' });
  knob(880, yk + 98, 'k3', 46, 0, 'WIDTH', { val: 'PING-PONG' });
  tag(842, yk + 160, 'WIDTH : NEW');
  vrule(958, yk + 4, 220);
  title(974, yk, 374, 'RETURN');
  knob(1060, yk + 98, 'k1', 90, 0.75, 'MIX', { big: true, val: '75 %', min: 'DRY', max: 'WET' });
  knob(1230, yk + 98, 'k3', 46, 0.3, 'DUCK', { val: '30 %' });
  tag(1200, yk + 160, 'DUCK : NEW');
  sendStrip(686, 'DELAY', SENDS(1), { master: 0.75 });
}

/* ======================= REVERB ======================= */
function page_open_reverb() {
  openFrame('REVERB', { tracks: false, lcd: 'FX · REVERB', hint: 'THE REVERB OF THE MM-RYTM · GATE : THE TAIL CLOSES SHUT AFTER EACH HIT (NEVER IN RANDOM)' });
  const y = 66;
  title(52, y, 340, 'TYPE');
  ['ROOM', 'HALL', 'GATED', 'TIGHT GATE'].forEach((t, i) => key(70 + (i % 2) * 160, y + 40 + Math.floor(i / 2) * 64, 136, 30, t, { led: i === 2 ? 'on' : 'off', lit: i === 2 ? 'lit' : undefined }));
  note(70, y + 186, 'THE 80S DRUM ROOM : A BIG TAIL, CUT SHORT.', { fontSize: '7.5px', color: '#9a9a9a', letterSpacing: '.08em' });
  const W = 940, H = 300;
  const L = lcd(408, y + 8, W, H);
  let h = '';
  ['0', '100 MS', '200 MS', '300 MS', '400 MS', '500 MS', '1 S', '2 S', '4 S'].forEach((t, i) => (h += `<i style="position:absolute;left:${20 + i * 112}px;top:0;bottom:0;width:1px;background:rgba(255,255,255,.05)"></i><div class="t8" style="position:absolute;left:${24 + i * 112}px;bottom:7px;font-size:7px">${t}</div>`));
  // queue complete en pointilles, queue coupee en jaune
  const tail = (cut) => { const p = []; for (let i = 0; i <= 300; i++) { const x = 20 + (i / 300) * 900; const t = i / 300; const yv = 260 - 210 * Math.exp(-t * 3.2) * (t < 0.01 ? t / 0.01 : 1); if (cut && x > 340) { p.push(`L340 260`); break; } p.push(`${i ? 'L' : 'M'}${x} ${yv}`); } return p.join(''); };
  h += `<svg width="${W}" height="${H}"><path d="${tail(false)}" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 4" fill="none"/><path d="${tail(true)}" stroke="#ffd900" stroke-width="2.2" fill="none" style="filter:drop-shadow(0 0 5px rgba(255,217,0,.6))"/><path d="${tail(true)} L20 260Z" fill="rgba(255,217,0,.12)"/><line x1="340" y1="30" x2="340" y2="268" stroke="#ffd900" stroke-dasharray="4 3"/></svg>`;
  h += `<div style="position:absolute;right:18px;top:12px;text-align:right"><div class="t8">TYPE 03 / 04</div><div class="dots a" style="font-size:40px;line-height:1.1">GATED</div></div><div style="position:absolute;right:18px;top:110px;text-align:right"><div class="t8">GATE</div><div class="dots w" style="font-size:30px;line-height:1.1">280 MS</div><div class="t8" style="margin-top:6px">SIZE <span class="w">4.5 S</span> · PRE <span class="w">8 MS</span></div></div><div class="t8 a" style="position:absolute;left:346px;top:36px">GATE CLOSES</div>`;
  L.innerHTML = h;
  const yk = 386;
  hrule(52, yk - 14, 1296);
  title(52, yk, 760, 'THE TAIL');
  [['SIZE', 0.35, '4.5 S', 96], ['TONE', 0.6, '6 KHZ', 76], ['PRE', 0.08, '8 MS', 76], ['GATE', 0.28, '280 MS', 96]].forEach(([l, v, val, d], i) => knob(130 + i * 180, yk + 98, 'k1', d, v, l, { big: true, val, ...(l === 'GATE' ? { min: 'OFF', max: '1 S', acc: true } : {}) }));
  vrule(820, yk + 4, 200);
  title(836, yk, 512, 'RETURN');
  knob(950, yk + 98, 'k1', 90, 0.8, 'MIX', { big: true, val: '80 %', min: 'DRY', max: 'WET' });
  knob(1100, yk + 98, 'k3', 46, 0.5, 'WIDTH', { val: '100 %' });
  knob(1230, yk + 98, 'k3', 46, 0.2, 'LOW CUT', { val: '120 HZ' });
  tag(1080, yk + 160, 'WIDTH · LOW CUT : NEW');
  sendStrip(686, 'REVERB', SENDS(7), { master: 0.8 });
}

/* ======================= HELL ======================= */
function page_open_hell() {
  openFrame('HELL', { tracks: false, lcd: 'FX · HELL', hint: 'A FREQUENCY SHIFTER IN THE LOOP OF A DELAY · EVERY REPEAT CLIMBS OR FALLS' });
  const y = 66;
  title(52, y, 420, 'I · SHIFT');
  knob(110, y + 80, 'sel', 64, 0.15, 'RANGE', { n: 3, marks: [['FINE', -60, true], ['WIDE', 0], ['SYNC', 60]] });
  knob(220, y + 80, 'k1', 66, 0.587, 'FREQ', { big: true, val: '+6.1 HZ' });
  knob(330, y + 80, 'k3', 46, 0, 'PHASE', { val: '0°' });
  knob(420, y + 80, 'k3', 46, 1, 'BAND', { val: 'UP' });
  knob(110, y + 210, 'k3', 46, 0.5, 'ANTI', { val: '50 %' });
  note(260, y + 220, 'EVERY REPEAT CLIMBS OR FALLS', { transform: 'translateX(-50%)', fontSize: '7.5px', color: '#8a8a8a' });
  hrule(52, y + 270, 420);
  title(52, y + 286, 420, 'II · ECHO');
  [['TIME', 0.545, '1/8'], ['FEEDBACK', 0.6, '60 %'], ['FILTER', 0.8, '6.9 KHZ']].forEach(([l, v, val], i) => knob(110 + i * 120, y + 366, i === 1 ? 'k1' : 'k3', i === 1 ? 62 : 48, v, l, { val, big: i === 1 }));
  toggle(96, y + 448, 'FREE', 'SYNC', true, 'SYNC');
  [['CROSS', 0, 'OFF'], ['SMEAR', 0, '0 %']].forEach(([l, v, val], i) => knob(230 + i * 120, y + 470, 'k3', 46, v, l, { val }));
  // le vortex
  const cx = 700, cy = y + 210;
  const vx = el(ROOT, 'abs', { left: cx - 190, top: cy - 190, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,217,0,.32), rgba(255,170,0,.12) 38%, rgba(255,217,0,.03) 62%, transparent 70%)' });
  let rings = '<svg width="380" height="380" style="position:absolute">';
  for (let i = 0; i < 6; i++) rings += `<circle cx="190" cy="190" r="${70 + i * 20}" stroke="rgba(255,217,0,${0.55 - i * 0.07})" stroke-width="1" fill="none" stroke-dasharray="${i % 2 ? '2 5' : '1 3'}"/>`;
  rings += `<path d="${Array.from({ length: 220 }, (_, i) => { const a = i * 0.12, r = 50 + i * 0.6; return `${i ? 'L' : 'M'}${190 + Math.cos(a) * r} ${190 + Math.sin(a) * r}`; }).join('')}" stroke="rgba(255,217,0,.45)" fill="none" stroke-width="1.2"/></svg>`;
  vx.innerHTML = rings;
  ['I', 'II', 'III', 'IV', 'V', 'VI'].forEach((t, i) => note(cx, cy - 76 - i * 20 - 4, t, { transform: 'translateX(-50%)', fontSize: '6.5px', color: '#bdbdbd' }));
  knob(cx, cy, 'k1', 100, 0.75, '', { ticks: false });
  note(cx, cy + 196, '<b style="font-size:12px">MIX</b>', { transform: 'translateX(-50%)' });
  note(cx, cy + 214, '<i>RETURN 75 % · 9 OF 16 TRACKS SEND</i>', { transform: 'translateX(-50%)', fontSize: '7.5px' });
  // presets
  const P = lcd(560, y + 460, 280, 76);
  P.innerHTML = '<div class="t8" style="position:absolute;left:12px;top:9px">07 / 12</div><div class="dots a" style="position:absolute;left:12px;top:24px;font-size:22px">DUB SIREN</div><div class="t8" style="position:absolute;left:12px;bottom:8px;font-size:7px">A PRESET SETS EVERYTHING BUT MIX</div>';
  prevNext(560, y + 546, 280);
  // droite : LFO + liste
  title(928, y, 420, 'III · LFO');
  knob(986, y + 80, 'sel', 64, 0.33, 'TARGET', { n: 4, marks: [['OFF', -90], ['FREQ', -30, true], ['PHASE', 30], ['DELAY', 90]] });
  [['RATE', 0.5, '1/4'], ['AMOUNT', 0.35, '35 %']].forEach(([l, v, val], i) => knob(1110 + i * 110, y + 80, 'k1', 58, v, l, { val, big: true }));
  toggle(1300, y + 60, 'FREE', 'SYNC', true, '');
  toggle(1300, y + 120, 'SAME', 'STEREO', false, '');
  presetList(940, y + 250, 400, 352, [['SPIRALS', ['SPIRAL UP', 'SPIRAL DN', 'BARBER', 'PING SHIFT']], ['METALS', ['METAL', 'RING', 'AM 1/16', 'DUB SIREN']], ['SPACES', ['GHOST', 'WASH', 'CHORUS', 'INFERNO']]], 'DUB SIREN');
  sendStrip(690, 'HELL', SENDS(9), { master: 0.75 });
}

/* ======================= MASTER ======================= */
function page_open_master() {
  openFrame('MASTER', { tracks: false, lcd: 'MASTER', hint: 'THE BUS OF THE MM-RYTM : COMP, BIT, TONE, THE MIXER OF THE 16 TRACKS' });
  const y = 66;
  title(52, y, 640, 'COMP', 'BUS');
  const V = el(ROOT, 'lcd', { left: 62, top: y + 26, width: 170, height: 118, borderRadius: '10px', background: 'radial-gradient(120% 90% at 50% 110%, #1d1d1d, #070707)' });
  let vu = '<svg width="170" height="118">';
  for (let i = 0; i <= 10; i++) { const a = (50 - (100 * i) / 10) * Math.PI / 180; vu += `<line x1="${85 + Math.sin(a) * 64}" y1="${106 - Math.cos(a) * 64}" x2="${85 + Math.sin(a) * (i % 5 ? 70 : 76)}" y2="${106 - Math.cos(a) * (i % 5 ? 70 : 76)}" stroke="#cfcfcf" stroke-width="1.2"/>`; }
  const na = 22 * Math.PI / 180;
  vu += `<line x1="85" y1="106" x2="${85 + Math.sin(na) * 78}" y2="${106 - Math.cos(na) * 78}" stroke="#ffd900" stroke-width="1.6" style="filter:drop-shadow(0 0 3px rgba(255,217,0,.8))"/><circle cx="85" cy="106" r="7" fill="#222" stroke="#444"/></svg>`;
  V.innerHTML = vu + '<div class="t8" style="position:absolute;left:0;right:0;top:64px;text-align:center;font-size:7px">GAIN REDUCTION</div><div class="t8 a" style="position:absolute;left:0;right:0;top:76px;text-align:center">-3.2 DB</div>';
  knob(296, y + 84, 'k1', 76, 0.2, 'COMP', { big: true, val: '20 %' });
  [['THRESH', 0.45, '-18 DB'], ['RATIO', 0.571, '4:1'], ['KNEE', 0.5, '6 DB'], ['ATTACK', 0.742, '30 MS'], ['RELEASE', 1, 'AUTO'], ['MAKEUP', 0, 'AUTO'], ['HPF', 0.5, '60 HZ']].forEach(([l, v, val], i) =>
    knob(i < 3 ? 410 + i * 92 : 100 + (i - 3) * 156, i < 3 ? y + 84 : y + 214, 'k3', 46, v, l, { val }));
  vrule(706, y + 4, 280);
  title(722, y, 200, 'BIT');
  knob(774, y + 84, 'k3', 50, 0.0, 'BITS', { val: 'OFF' });
  knob(870, y + 84, 'k3', 50, 0.0, 'RATE', { val: '48 KHZ' });
  title(722, y + 160, 200, 'TONE');
  knob(822, y + 230, 'k1', 60, 0.5, 'TILT', { big: true, val: 'FLAT', min: 'DARK', max: 'BRIGHT' });
  vrule(936, y + 4, 280);
  title(952, y, 200, 'TIME');
  knob(1004, y + 84, 'k3', 50, 0.54, 'SWING', { val: '54 %' });
  knob(1100, y + 84, 'k3', 50, 0.5, 'STRETCH', { val: '1X' });
  knob(1052, y + 230, 'k1', 60, 0.45, 'BPM', { big: true, val: '124 · ABLETON' });
  vrule(1166, y + 4, 280);
  title(1182, y, 166, 'OUTPUT');
  knob(1240, y + 110, 'k1', 84, 0.72, 'VOLUME', { big: true, val: '-3.9 DB' });
  [0.72, 0.66].forEach((v, i) => {
    const m = el(ROOT, 'abs', { left: 1306 + i * 14, top: y + 30, width: 8, height: 230, borderRadius: '3px', background: '#060606', boxShadow: 'inset 0 1px 2px #000, 0 1px 0 rgba(255,255,255,.06)' });
    el(m, 'abs', { left: 1, right: 1, bottom: 1, height: 228 * v, borderRadius: '2px', background: 'linear-gradient(0deg,#9a9a9a 0%,#e8e8e8 70%,#ffd900 88%,#ff3d2e 100%)', backgroundSize: '100% 228px', backgroundPosition: 'bottom' });
  });
  note(1304, y + 266, 'L &nbsp; R', { fontSize: '7px' });
  // le mixer des 16 pistes
  const ym = 370;
  hrule(52, ym - 14, 1296);
  title(52, ym, 1296, 'MIXER', '16 TRACKS');
  const x0 = 70, p = (1330 - x0) / 16;
  const lev = [0.86, 0.72, 0.55, 0.5, 0.66, 0.6, 0.48, 0.0, 0.7, 0.6, 0.52, 0.45, 0.6, 0.55, 0.5, 0.4];
  const vu2 = [0.8, 0.5, 0.35, 0.2, 0.55, 0.3, 0.15, 0, 0.4, 0.25, 0.6, 0.1, 0.2, 0.15, 0.3, 0];
  TRACKS.forEach((t, i) => {
    const x = x0 + i * p;
    knob(x + p / 2 - 4, ym + 54, 'k3', 30, [0.5, 0.45, 0.62, 0.38, 0.5, 0.3, 0.7, 0.5, 0.5, 0.55, 0.42, 0.6, 0.5, 0.35, 0.65, 0.5][i], 'PAN', { tg: 3, tl: 3 });
    const fx = x + p / 2 - 4;
    el(ROOT, 'abs', { left: fx - 3, top: ym + 104, width: 6, height: 200, borderRadius: '3px', background: '#050505', boxShadow: 'inset 0 1px 3px #000, 0 1px 0 rgba(255,255,255,.07)' });
    for (let k = 0; k <= 10; k++) el(ROOT, 'abs', { left: fx - 12, top: ym + 104 + k * 20, width: 5, height: 1, background: 'rgba(255,255,255,.2)' });
    el(ROOT, 'abs', { left: fx + 9, top: ym + 104 + 200 * (1 - vu2[i]), width: 4, height: 200 * vu2[i], borderRadius: '2px', background: 'linear-gradient(#ffd900,#8a8a8a)', opacity: 0.9 });
    const cap = el(ROOT, 'abs', { left: fx - 13, top: ym + 104 + 200 * (1 - lev[i]) - 9, width: 26, height: 18, borderRadius: '3px', background: 'linear-gradient(#3a3a3d,#1a1a1b)', boxShadow: '0 0 0 1px #050505, 0 3px 5px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.15)' });
    el(cap, 'abs', { left: 4, right: 4, top: 8, height: 2, background: i === 0 ? '#ffd900' : '#eee', borderRadius: '1px' });
    key(x + 6, ym + 320, p / 2 - 8, 18, '', { led: null, inner: 'M', lit: i === 7 ? 'red' : undefined, r: 5, inSt: { fontSize: '8px' } });
    key(x + p / 2 + 2, ym + 320, p / 2 - 8, 18, '', { led: null, inner: 'S', r: 5, inSt: { fontSize: '8px' } });
    note(fx, ym + 346, t, { transform: 'translateX(-50%)', color: i === 0 ? 'var(--acc)' : '#d8d8d8', fontSize: '8.5px' });
    note(fx, ym + 360, i === 7 ? 'MUTE' : `${Math.round(lev[i] * 127)}`, { transform: 'translateX(-50%)', color: i === 7 ? 'var(--red)' : '#7d7d7d', fontSize: '7px' });
  });
}

/* ======================= LIBRARY ======================= */
function page_open_library() {
  openFrame('', { tracks: false, foot: 'LIBRARY', lcd: 'LIBRARY', hint: 'IT LOADS AT ONCE · UNDO BRINGS YOUR PATTERN BACK · THE TEMPO SHOWN IS THE ONE IT WAS MADE AT' });
  const styles = ['DARK DISCO', 'INDIE DANCE', 'MINIMAL', 'ITALO', 'EBM', 'ELECTRO', 'HOUSE', 'TECHNO', 'ACID', 'ROLLING', 'BREAKBEAT', 'D&B', 'NU DISCO', 'COSMIC DISCO', 'NEW BEAT', 'ELECTROCLASH', 'HYPNOTIC', 'DUB TECHNO', 'DEEP HOUSE', 'AFRO HOUSE', 'UK GARAGE', 'LO-FI HIP HOP', 'INDUSTRIAL', 'TRIBAL', 'INDUSTRIAL SLAM', 'DEEP HOUSE THUMP', '808 SUB BOOM'];
  const bpm = [118, 122, 124, 120, 128, 126, 124, 130, 132, 128, 132, 174, 118, 112, 110, 128, 130, 122, 121, 122, 132, 86, 138, 126, 138, 121, 122];
  el(ROOT, 'sec', { left: 52, top: 70, width: 960, height: 14 }, '<div class="t">FACTORY BANK · 27 STYLES · 81 PATTERNS</div>');
  const col = 4, per = 7;
  for (let c = 0; c < col; c++) {
    const x = 60 + c * 240;
    for (let r = 0; r < per; r++) {
      const i = c * per + r;
      if (i >= styles.length) break;
      const yy = 104 + r * 96;
      const on = i === 26;
      note(x, yy, `<b style="letter-spacing:.14em;color:${on ? 'var(--acc)' : '#e8e8e8'}">${styles[i]}</b>`, { fontSize: '9.5px' });
      note(x + 212, yy, `${bpm[i]}`, { transform: 'translateX(-100%)', fontSize: '8px', color: '#6f6f6f' });
      hrule(x, yy + 16, 212);
      [1, 2, 3].forEach((v) => key(x + (v - 1) * 72, yy + 28, 64, 26, '', { led: null, inner: `VAR ${v}`, lit: on && v === 1 ? 'lit' : undefined, r: 8, inSt: { fontSize: '8px' } }));
    }
  }
  title(1040, 70, 308, 'DISK');
  key(1080, 104, 96, 30, 'SAVE TO DISK', { led: 'off' });
  key(1212, 104, 96, 30, 'OPEN FROM DISK', { led: 'off' });
  presetList(1040, 172, 308, 420, [['~/MUSIC/MAUDITE MACHINE/MM-RYTM PRESETS', ['SET MTL 01', 'SET MTL 02', 'VRSTL WARMUP', 'PEAK TIME 124', 'DARK DISCO JAM', 'CLOSING TRACK']]], 'VRSTL WARMUP');
  key(1080, 620, 64, 26, 'PREV', { led: null });
  key(1164, 620, 64, 26, 'NEXT', { led: null });
  key(1248, 620, 64, 26, 'RANDOM', { led: null });
}

/* ======================= MIDI ======================= */
function page_open_midi() {
  openFrame('', { tracks: false, foot: 'MIDI', lcd: 'MIDI', hint: 'DRAG IT ONTO A MIDI TRACK OR A DRUM RACK (16 PADS, C1 TO D#2) · A CLICK SAVES THE .MID' });
  title(52, 70, 700, 'DRAG MIDI', 'LE PATTERN QUI JOUE EN CLIP');
  const D = el(ROOT, 'abs', { left: 62, top: 100, width: 680, height: 300, borderRadius: '12px', background: 'linear-gradient(#2a2410,#17140a)', boxShadow: '0 0 0 1px rgba(255,217,0,.6), 0 0 26px rgba(255,217,0,.12), inset 0 1px 0 rgba(255,255,255,.08)' });
  let g = '';
  for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) if (GROOVE[r][c] === 'x') g += `<i style="position:absolute;left:${120 + c * 34}px;top:${40 + r * 13}px;width:28px;height:8px;border-radius:2px;background:${r === 0 ? '#ffd900' : 'rgba(255,255,255,.75)'}"></i>`;
  D.innerHTML = g + `<div style="position:absolute;left:20px;top:20px;color:#ffd900;font:800 22px SF;letter-spacing:.1em">⠿</div><div style="position:absolute;left:20px;top:60px;color:#ffd900;font:700 11px SF;letter-spacing:.18em;line-height:1.6">DRAG<br>ME<br>INTO<br>ABLETON</div>
   <div class="t8" style="position:absolute;left:20px;bottom:16px;color:#d7c27a">A01 · 1 BAR · 25 NOTES · C1 TO D#2</div>`;
  note(62, 418, 'LENGTH');
  ['X1', 'X2', 'X4', 'SONG'].forEach((t, i) => key(120 + i * 70, 414, 60, 22, '', { led: null, inner: t, lit: i === 0 ? 'lit' : undefined, r: 8 }));
  key(500, 414, 100, 22, '', { led: null, inner: 'SAVE .MID', r: 8 });
  key(620, 414, 100, 22, '', { led: null, inner: 'OPEN FOLDER', r: 8 });
  title(780, 70, 568, 'MIDI IN · OUT');
  [['NOTES IN', 'C1 = BD … D#2 = CY2', true], ['PROGRAM CHANGE', 'A01 TO H16', true], ['CLOCK', 'ABLETON LEADS', true], ['NOTES OUT', 'THE STEPS AS NOTES', false]].forEach(([a, b, on], i) => {
    note(800, 108 + i * 52, `<b>${a}</b>`, { fontSize: '9px' });
    note(800, 124 + i * 52, b, { fontSize: '7.5px' });
    toggle(1220, 104 + i * 52, 'OFF', 'ON', on, '');
  });
  tag(1100, 264, 'NOTES OUT : NEW');
  title(780, 330, 568, 'MIDI LEARN', 'LEARN : TOURNE UN KNOB');
  presetList(790, 356, 548, 200, [['MAPPINGS', ['CC 21 → CUTOFF (T1)', 'CC 22 → RESO (T1)', 'CC 23 → DELAY SEND (T3)', 'CC 24 → HELL MIX', 'CC 64 → FILL', 'CC 1 → CROSSFADE']]], 'CC 21 → CUTOFF (T1)');
  // niveaux
  const ym = 470;
  title(52, ym, 700, 'LEVELS', 'LE MOTEUR, EN DIRECT');
  const M = lcd(62, ym + 26, 680, 290);
  let m = '';
  const lv = [0.85, 0.6, 0.4, 0.3, 0.55, 0.35, 0.2, 0, 0.5, 0.3, 0.65, 0.15, 0.25, 0.2, 0.35, 0.05, 0.72, 0.68];
  lv.forEach((v, i) => { const x = 14 + i * 36 + (i > 15 ? 10 : 0); m += `<div style="position:absolute;left:${x}px;bottom:26px;width:24px;height:230px;background:rgba(255,255,255,.04)"></div><div style="position:absolute;left:${x}px;bottom:26px;width:24px;height:${230 * v}px;background:linear-gradient(0deg,#6a6a6a,#e8e8e8 70%,#ffd900 92%)"></div><div class="t8" style="position:absolute;left:${x - 4}px;width:32px;text-align:center;bottom:8px;font-size:6.5px">${i < 16 ? TRACKS[i] : i === 16 ? 'L' : 'R'}</div>`; });
  M.innerHTML = m;
}

/* ======================= le menu hamburger (sur la face) ======================= */
function page_menu() {
  face({ menuOn: true });
  const m = el(ROOT, 'menu', { left: 1078, top: 52, width: 290 });
  m.innerHTML = `<h4>SETTINGS <span>RESET</span></h4>
   <div class="row">PANEL LIGHT</div><div class="row"><div class="sl"><i style="width:55%"></i><b style="left:55%"></b></div><span class="num">55</span></div>
   <div class="row">ACCENT COLOR</div><div class="row"><div class="sl" style="background:linear-gradient(90deg,#ff2d2d,#ff9a00,#ffd900,#5bff5b,#2de0ff,#5b6bff,#ff2dd8)"><b style="left:31%"></b></div><span style="width:14px;height:14px;border-radius:3px;background:#ffd900;box-shadow:0 0 8px rgba(255,217,0,.6)"></span></div>
   <div class="row">STEP COLOR</div><div class="row" style="gap:6px">${['RED', 'YELLOW', 'WHITE'].map((t, i) => `<span class="chip${i === 0 ? ' fill' : ''}" style="${i === 0 ? 'background:#ff3d2e;border-color:#ff3d2e;color:#fff' : ''}">${t}</span>`).join('')}</div>
   <div class="row">WINDOW</div><div class="row" style="gap:6px">${['100 %', '125 %', '150 %', 'FIT'].map((t, i) => `<span class="chip${i === 0 ? ' a' : ''}">${t}</span>`).join('')}</div>
   <div class="div"></div>
   <div class="item">TRK SELECT <em>NORMAL</em></div>
   <div class="item">LED <em>MAX</em></div>
   <div class="item">SAMPLES FOLDER <em>OPEN · RESCAN</em></div>
   <div class="item hl">MOUSE AND KEYS <em>HELP</em></div>
   <div class="item">LATENCY <em>ZERO</em></div>
   <div class="div"></div>
   <div class="item" style="color:#8a8a8a">MM-RYTM VST3 · FIRMWARE V.3.0 <em>ABOUT</em></div>`;
}

/* ======================= la feuille des choix ======================= */
function page_choices() {
  chassis();
  el(ROOT, 'sec', { left: 52, top: 22, width: 1296, height: 14 }, '<div class="t" style="font-size:13px">MM-RYTM V3 · LES CHOIX A VALIDER</div>');
  // 1 : le bouton OPEN
  title(52, 62, 1296, '1 · LE BOUTON OPEN');
  const box = (x, y, w, h, t, s) => { el(ROOT, 'abs', { left: x, top: y, width: w, height: h, borderRadius: '10px', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)', background: 'rgba(0,0,0,.18)' }); note(x + 14, y + 12, `<b style="font-size:12px;color:var(--acc)">${t}</b>`); note(x + 14, y + h - 22, s, { fontSize: '7.5px', color: '#a0a0a0', whiteSpace: 'normal', width: (w - 28) + 'px', lineHeight: '1.5' }); };
  box(52, 86, 420, 230, 'A · UNE TOUCHE', 'UNE TOUCHE OPEN DANS LE BLOC DES TOUCHES (ET LA LETTRE O) : ELLE OUVRE LA DERNIERE PAGE VUE.');
  key(198, 166, 128, 42, 'OPEN', { led: 'on', inner: '<span style="font-size:15px">⌃</span>', labSt: { fontSize: '10px' } });
  key(138, 166, 46, 42, 'RANDOM', { led: 'off' });
  key(340, 166, 46, 42, 'TAP', { led: 'off' });
  box(490, 86, 420, 230, 'B · LE LOQUET', 'UN GRAND LOQUET OPEN EN HAUT A DROITE, A LA PLACE DU CAPOT : IL DEVIENT CLOSE DANS L\'OPEN, AU MEME ENDROIT.');
  const latch = el(ROOT, 'abs', { left: 560, top: 150, width: 280, height: 64, borderRadius: '32px', background: 'linear-gradient(#2d2d30,#141415)', boxShadow: '0 0 0 1px #050505, inset 0 1px 0 rgba(255,255,255,.12), 0 6px 12px rgba(0,0,0,.6)' });
  latch.innerHTML = '<div style="position:absolute;left:8px;top:8px;width:48px;height:48px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff6b0,#ffd900 45%,#b39800);box-shadow:0 0 18px rgba(255,217,0,.6);display:grid;place-items:center;color:#2a2200;font:900 18px SF">⌃</div><div style="position:absolute;left:74px;top:14px;font:700 17px SF;letter-spacing:.3em;color:#eee">OPEN</div><div style="position:absolute;left:75px;top:38px;font:600 7.5px SF;letter-spacing:.16em;color:#9a9a9a">SAMPLE · SEQ · LFO · FX · MASTER</div>';
  box(928, 86, 420, 230, 'C · LES ONGLETS SUR LA FACE (CONSEILLE)', 'LES 9 ONGLETS DE L\'ARP SONT SUR LA FACE, EN HAUT : UN CLIC OUVRE DIRECTEMENT SA PAGE. DANS L\'OPEN, LES MEMES ONGLETS, AU MEME ENDROIT.');
  const t = el(ROOT, 'tabs', { left: 948, top: 160, flexWrap: 'wrap', width: 380, rowGap: '8px' });
  TABS.forEach((n) => el(t, 'tab' + (n === 'DELAY' ? ' on' : ''), {}, n));
  // 2 : la couleur des pas
  title(52, 340, 1296, '2 · LA COULEUR DES PAS ALLUMES');
  [['A · ROUGE (COMME AUJOURD\'HUI)', 'on', ''], ['B · JAUNE #FFD900', 'on', 'y'], ['C · BLANC RETROECLAIRE', 'on', 'w']].forEach(([n, , c], j) => {
    const x0 = 52 + j * 438;
    box(x0, 364, 420, 170, n, '');
    for (let i = 0; i < 4; i++) {
      const on = i === 0 || i === 2;
      const s = el(ROOT, 'step' + (on ? ' on' : ' off') + (i === 1 ? ' ph' : ''), { left: x0 + 30 + i * 92, top: 406, width: 80, height: 96 });
      if (on && c === 'y') { s.style.background = 'linear-gradient(180deg,#fff07a 0%,#ffd900 55%,#d9b500 100%)'; s.style.boxShadow = '0 0 0 1px #4a3d00, inset 0 1px 0 rgba(255,255,255,.6), 0 0 18px rgba(255,217,0,.35), 0 4px 6px rgba(0,0,0,.55)'; }
      if (on && c === 'w') { s.style.background = 'linear-gradient(180deg,#ffffff 0%,#e9e9e9 55%,#c9c9c9 100%)'; s.style.boxShadow = '0 0 0 1px #2a2a2a, inset 0 1px 0 rgba(255,255,255,.9), 0 0 18px rgba(255,255,255,.3), 0 4px 6px rgba(0,0,0,.55)'; }
      el(s, 'win');
      const nm = el(s, 'num', {}, String(i + 1));
      if (on && c) nm.style.color = '#222';
    }
  });
  // 3 : la taille
  title(52, 556, 1296, '3 · LA TAILLE DE LA FENETRE (ELLE S\'AGRANDIT TOUJOURS AU COIN)');
  [['A · 1200 X 731', 'AUJOURD\'HUI', 1200, 731], ['B · 1320 X 845', '+10 %', 1320, 845], ['C · 1400 X 896 (CONSEILLE)', 'CES MAQUETTES', 1400, 896]].forEach(([n, s, w, h], j) => {
    const x0 = 52 + j * 438;
    box(x0, 580, 420, 230, n, s);
    const k = 0.16;
    el(ROOT, 'abs', { left: x0 + 210 - (w * k) / 2, top: 700 - (h * k) / 2, width: w * k, height: h * k, borderRadius: '4px', background: 'url(assets/alu.jpg) center/cover', boxShadow: `0 0 0 1px ${j === 2 ? 'var(--acc)' : 'rgba(255,255,255,.25)'}` });
  });
  note(1348, 836, 'ET LE RESTE : LES PAGES SUIVANTES · LES ETIQUETTES <span style="background:#ff2d87;color:#fff;padding:1px 4px;border-radius:3px">NEW</span> SONT DES AJOUTS PROPOSES, A VALIDER UN PAR UN', { transform: 'translateX(-100%)', fontSize: '8px' });
}
