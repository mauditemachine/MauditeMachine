// La face principale du MM-RYTM v3 (1400 x 896).
const TABS = ['SAMPLE', 'SEQ', 'LFO', 'DISTO', 'CHORUS', 'DELAY', 'REVERB', 'HELL', 'MASTER'];
function header(o = {}) {
  el(ROOT, 'wordmark abs', { left: 58, top: 24 }, 'MAUDITE MACHINE');
  el(ROOT, 'model abs', { left: 322, top: 26 }, 'MM-RYTM');
  if (o.tabs !== false) {
    // les onglets d'OPEN : sur la face (choix C) ils ouvrent leur page ; dans l'OPEN, l'onglet de la page est allume
    if (!o.open) note(458, 30, 'OPEN <span style="color:var(--acc)">›</span>', { fontSize: '8.5px', color: '#bdbdbd', letterSpacing: '.2em' });
    const t = el(ROOT, 'tabs', { left: o.open ? 470 : 504, top: 21 });
    TABS.forEach((n) => el(t, 'tab' + (o.active === n ? ' on' : '') + (o.newTab === n ? ' new' : ''), {}, n));
  }
  el(ROOT, 'cpu abs', { left: o.open ? 1138 : 1168, top: 23 }, 'CPU <i></i> 7 %');
  el(ROOT, 'ham abs' + (o.menuOn ? ' on' : ''), { left: o.open ? 1268 : 1300, top: 21 }, '<i></i><i></i><i></i>');
  if (o.open) el(ROOT, 'xbtn abs', { left: 1308, top: 21 }, '×');
}

function face(o = {}) {
  chassis();
  header(o);
  const top = 66;

  /* ===== RANGEE A : le son de la piste choisie ===== */
  // SAMPLE
  title(52, top, 418, 'SAMPLE', 'T1 · BD');
  knob(112, top + 112, 'sel', 98, 0.38, 'SAMPLE', { big: true, val: '06 / 44', n: 9 });
  lcd(186, top + 28, 282, 62, `
    <div class="t8" style="position:absolute;left:12px;top:9px">BD · 06 / 44 · 1.53 S</div>
    <div class="dots w" style="position:absolute;left:11px;top:22px;font-size:22px;line-height:1">808 SUB BOOM</div>
    <svg style="position:absolute;right:10px;top:12px" width="56" height="38">${waveSvg(56, 38, { from: 0, to: 300, gain: 0.95, fill: '#d9d9d9' })}<line x1="0" y1="0.5" x2="74" y2="42" stroke="#ffd900" stroke-width="1" opacity=".0"/></svg>`);
  const sx = [214, 270, 326, 382, 438];
  [['TUNE', 0.5, '0'], ['FINE', 0.5, '0'], ['START', 0.0, '0 MS'], ['LEN', 1, 'FULL'], ['LEVEL', 0.8, '102']].forEach(([l, v, val], i) =>
    knob(sx[i], top + 140, 'k3', 38, v, l, { val }));
  toggle(70, top + 220, 'FWD', 'REV', false, 'PLAY');
  [['PREV', 196], ['NEXT', 250], ['LISTEN', 304]].forEach(([l, x]) => key(x, top + 216, 46, 24, l, { led: 'off', labSt: { top: '31px' } }));
  key(358, top + 216, 108, 24, 'IMPORT…', { led: null, inner: '+ FILE', labSt: { top: '31px' } });

  vrule(478, top + 4, 250);
  // FILTER
  title(486, top, 214, 'FILTER');
  knob(560, top + 92, 'k1', 82, 0.78, 'CUTOFF', { big: true, val: '6.9 KHZ' });
  knob(658, top + 80, 'tiny', 34, 0.15, '', { ticks: false, marks: [['LP', -60, true], ['BP', 0], ['HP', 60]] });
  el(ROOT, 'note', { left: 658, top: top + 108, transform: 'translateX(-50%)', color: '#dadada', fontSize: '9px' }, 'TYPE');
  [['RESO', 0.25], ['ENV', 0.62], ['F.ATK', 0.05], ['F.DEC', 0.45]].forEach(([l, v], i) => knob(512 + i * 50, top + 200, 'k3', 32, v, l));

  vrule(708, top + 4, 250);
  // AMP EG
  title(716, top, 214, 'AMP EG');
  lcd(726, top + 28, 196, 72, `
    <div class="t8" style="position:absolute;left:9px;top:7px"><span class="a">AMP</span> · FILTER</div>
    <div class="t8" style="position:absolute;right:9px;top:7px">4.5 S</div>
    <svg style="position:absolute;left:8px;top:20px" width="180" height="46">
      <path d="M0 45 L4 3 L22 3 C60 20 100 38 180 44" stroke="#ffd900" stroke-width="1.6" fill="none" style="filter:drop-shadow(0 0 3px rgba(255,217,0,.6))"/>
      <path d="M0 45 L4 3 L22 3 C60 20 100 38 180 44 L180 46 L0 46Z" fill="rgba(255,217,0,.12)"/>
      <path d="M0 45 L10 14 C30 34 60 42 110 45" stroke="#9a9a9a" stroke-width="1" stroke-dasharray="2 2" fill="none"/>
    </svg>`);
  [['ATK', 0, '0'], ['HOLD', 0, '4 MS'], ['DEC', 0.976, '124'], ['PAN', 0.5, 'C']].forEach(([l, v, val], i) => knob(746 + i * 52, top + 156, 'k3', 36, v, l, { val }));
  [['VOL', 0.8], ['ACCENT', 0.5], ['VELO', 0.7]].forEach(([l, v], i) => knob(772 + i * 52, top + 226, 'tiny', 26, v, l, { ticks: true, tg: 3, tl: 3 }));

  vrule(938, top + 4, 250);
  // LFO
  title(946, top, 204, 'LFO', '1 · 2');
  lcd(954, top + 28, 188, 46, `<div class="t8" style="position:absolute;right:7px;top:4px;font-size:6.5px"><span class="a">1 FREQ</span> · 2 PAN</div>
    <svg style="position:absolute;left:6px;top:5px" width="176" height="36">
      <path d="${Array.from({ length: 89 }, (_, i) => `${i ? 'L' : 'M'}${i * 2} ${18 - 13 * Math.sin(i / 7)}`).join('')}" stroke="#ffd900" stroke-width="1.4" fill="none"/>
      <path d="${Array.from({ length: 12 }, (_, i) => `${i ? 'L' : 'M'}${i * 16} ${i % 2 ? 6 : 30}L${i * 16 + 16} ${i % 2 ? 6 : 30}`).join('')}" stroke="#bdbdbd" stroke-width="1" stroke-dasharray="2 2" fill="none" opacity=".8"/>
    </svg>
    `);
  const lx = [968, 1016, 1064, 1114];
  el(ROOT, 'note', { left: 950, top: top + 98, color: 'var(--acc)', fontSize: '8px' }, '1');
  [['RATE', 0.55, '1/8'], ['DEPTH', 0.7, '+46'], ['WAVE', 0.1, 'SINE'], ['DEST', 0.3, 'FREQ']].forEach(([l, v, val], i) => knob(lx[i] + 6, top + 118, i === 3 ? 'tiny' : 'k3', i === 3 ? 26 : 30, v, l, { val, tg: 3, tl: 3 }));
  el(ROOT, 'note', { left: 950, top: top + 180, color: '#bdbdbd', fontSize: '8px' }, '2');
  [['RATE', 0.35, '1 BAR'], ['DEPTH', 0.4, '-20'], ['WAVE', 0.6, 'SQR'], ['DEST', 0.7, 'PAN']].forEach(([l, v, val], i) => knob(lx[i] + 6, top + 200, i === 3 ? 'tiny' : 'k3', i === 3 ? 26 : 30, v, l, { val, tg: 3, tl: 3 }));

  vrule(1158, top + 4, 250);
  // FX SENDS
  title(1166, top, 182, 'FX SENDS');
  [['DIST', 0.12], ['CHORUS', 0], ['DELAY', 0.3], ['REVERB', 0.22], ['HELL', 0.08], ['TONE', 0.5]].forEach(([l, v], i) =>
    knob(1198 + (i % 3) * 60, top + 62 + Math.floor(i / 3) * 86, 'k3', 38, v, l));
  note(1257, top + 230, '<i>OPEN</i> · LES REGLAGES', { transform: 'translateX(-50%)', fontSize: '7.5px' });

  hrule(52, 332, 1296);

  /* ===== RANGEE B : TRIG, l'ecran, les touches, MASTER ===== */
  const yb = 344;
  title(52, yb, 340, 'TRIG', 'DEFAUT DE LA PISTE');
  const tx = [98, 180, 262, 344];
  [['NOTE', 0.5, '0'], ['VEL', 0.78, '100'], ['LEN', 0.3, '1/16'], ['PROB', 1, '100 %']].forEach(([l, v, val], i) => knob(tx[i], yb + 66, 'k3', 42, v, l, { val }));
  knob(tx[0], yb + 166, 'sel', 46, 0.1, 'COND', { val: 'ALWAYS', n: 11 });
  [['μTIME', 0.5, '0'], ['RETRIG', 0, 'OFF'], ['RATE', 0.4, '1/32']].forEach(([l, v, val], i) => knob(tx[i + 1], yb + 166, 'k3', 42, v, l, { val }));

  vrule(404, yb + 4, 262);
  // L'ECRAN
  const L = lcd(418, yb + 6, 548, 206);
  let h = `<div style="position:absolute;left:14px;top:10px;display:flex;gap:8px;align-items:center">
      <span class="chip fill">A01</span><span class="t8 w" style="letter-spacing:.18em">808 SUB BOOM</span><span class="t8">· STYLE 27 · VAR 1</span></div>
    <div style="position:absolute;right:14px;top:6px;display:flex;align-items:baseline;gap:6px"><span class="dots w" style="font-size:22px">124</span><span class="t8">BPM</span><span class="t8" style="margin-left:8px">SW <span class="w">54 %</span></span></div>
    <div style="position:absolute;left:14px;top:38px"><div class="t8">TRACK 01</div><div class="dots a" style="font-size:44px;line-height:1;margin-top:2px">BD</div></div>
    <svg style="position:absolute;left:14px;top:96px" width="196" height="62">${waveSvg(196, 62, { from: 0, to: 330, fill: '#e8e8e8' })}
      <path d="M0 3 L4 3 C60 20 110 40 196 56" stroke="#ffd900" stroke-width="1.3" fill="none"/>
      <line x1="0.5" y1="0" x2="0.5" y2="62" stroke="#ffd900"/><line x1="195.5" y1="0" x2="195.5" y2="62" stroke="#ffd900"/></svg>
    <div class="t8" style="position:absolute;left:96px;top:44px;line-height:1.7">TUNE <span class="w">0</span><br>DEC <span class="w">124</span><br>FREQ <span class="w">6.9K</span></div>
    <div class="t8" style="position:absolute;left:14px;bottom:10px">TAP A STEP · <span class="a">RIGHT CLICK</span> : CONDITIONS · P-LOCK</div>
    <div style="position:absolute;right:14px;bottom:7px;display:flex;gap:6px"><span class="chip">SONG</span><span class="chip a">PRESETS</span></div>`;
  // la grille 16 x 16
  const gx = 262, gy = 40, cw = 16, rh = 8.6;
  for (let r = 0; r < 16; r++) {
    h += `<div class="t8" style="position:absolute;left:${gx - 30}px;top:${gy + r * rh - 1}px;font-size:6.5px;letter-spacing:.06em;color:${r === 0 ? '#ffd900' : '#777'}">${TRACKS[r]}</div>`;
    for (let c = 0; c < 16; c++) {
      const on = GROOVE[r][c] === 'x';
      const ph = c === 4;
      h += `<i style="position:absolute;left:${gx + c * cw}px;top:${gy + r * rh}px;width:${cw - 4}px;height:${rh - 3}px;border-radius:1px;background:${on ? (r === 0 ? '#ffd900' : '#e9e9e9') : ph ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.06)'};${on && ph ? 'box-shadow:0 0 6px rgba(255,255,255,.7)' : ''}"></i>`;
    }
  }
  h += `<div style="position:absolute;left:${gx + 4 * cw - 2}px;top:${gy - 4}px;width:${cw}px;height:${16 * rh + 4}px;border:1px solid rgba(255,217,0,.55);border-radius:2px"></div>`;
  L.innerHTML = h;
  // le crossfader des scenes
  key(418, yb + 226, 34, 28, '', { led: null, inner: 'A', lit: 'lit' });
  const xf = el(ROOT, 'xf', { left: 468, top: yb + 222, width: 448, height: 36 });
  el(xf, 'slot');
  for (let i = 0; i <= 10; i++) el(xf, 'tick', { left: (448 * i) / 10 });
  el(xf, 'cap', { left: 448 * 0.3 });
  key(932, yb + 226, 34, 28, '', { led: null, inner: 'B' });
  note(692, yb + 254, 'SCENES · CROSSFADE', { transform: 'translateX(-50%)', fontSize: '7.5px' });

  vrule(980, yb + 4, 262);
  // LES TOUCHES
  const kx = [994, 1064, 1134], ky = [yb + 26, yb + 98, yb + 170];
  const keys = [
    [['PLAY', '▶', 'on'], ['STOP', '■', 'off'], ['REC', '●', 'off']],
    [['COPY', '', 'off'], ['CLEAR', '', 'off'], ['PASTE', '', 'off']],
    [['RANDOM', '', 'off'], ['TAP', '', 'off'], ['SAVE', '', 'off']],
  ];
  keys.forEach((row, j) => row.forEach(([l, ico, led], i) => key(kx[i], ky[j], 56, 30, l, { led, ico: ico || undefined, icoSt: ico === '●' ? { color: '#ff3d2e' } : {} })));

  vrule(1200, yb + 4, 262);
  // MASTER
  title(1208, yb, 140, 'MASTER');
  knob(1278, yb + 84, 'k1', 84, 0.72, 'VOLUME', { big: true, min: '-∞', max: '+6' });
  knob(1242, yb + 196, 'k3', 32, 0.54, 'SWING');
  knob(1314, yb + 196, 'k3', 32, 0.2, 'COMP');

  hrule(52, 616, 1296);

  /* ===== RANGEE C : les pistes et les pas ===== */
  const yc = 630;
  const col = [52, 160];
  [['FUNC', 'off'], ['MUTE', 'off'], ['SOLO', 'off'], ['PERFORM', 'off']].forEach(([l, led], i) =>
    key(56, yc + 6 + i * 52, 96, 32, '', { led: null, inner: `<span style="display:flex;align-items:center;gap:7px"><i class="led ${led === 'on' ? 'on' : ''}" style="position:static;margin:0;display:inline-block"></i>${l}</span>`, ...(l === 'FUNC' ? { inSt: { color: 'var(--acc)' } } : {}) }));
  note(104, yc + 222, 'SHIFT = FUNC', { transform: 'translateX(-50%)', fontSize: '7px' });

  const p = (1348 - 178) / 16;
  TRACKS.forEach((t, i) => {
    const x = 178 + i * p;
    const tk = el(ROOT, 'trk' + (i === 0 ? ' sel' : '') + (i === 7 ? ' mute' : ''), { left: x, top: yc + 2, width: p - 8, height: 32 });
    el(tk, 'no', {}, String(i + 1).padStart(2, '0'));
    el(tk, 'n', {}, t);
    el(tk, 'm' + (i === 7 ? ' on' : ''));
    const lv = [0.85, 0.5, 0.35, 0.2, 0.55, 0.3, 0.15, 0, 0.4, 0.25, 0.6, 0.1, 0.2, 0.15, 0.3, 0][i];
    el(el(tk, 'vu'), '', { width: `${lv * 100}%`, position: 'absolute', left: 0, top: 0, bottom: 0, background: lv > 0.8 ? 'linear-gradient(90deg,#6c6c6c,#ffd900)' : 'linear-gradient(90deg,#5c5c5c,#cfcfcf)' });
  });
  const conds = { 2: '1:2', 10: '3:4', 14: '50%' };
  const locks = { 6: 1, 12: 1 };
  for (let i = 0; i < 16; i++) {
    const x = 178 + i * p;
    const on = GROOVE[0][i] === 'x' || i === 14 || i === 10;
    const st = el(ROOT, 'step' + (on ? ' on' : ' off') + (i === 4 ? ' ph' : ''), { left: x, top: yc + 54, width: p - 8, height: 84 });
    el(st, 'win');
    el(st, 'num', {}, String(i + 1));
    if (conds[i]) el(st, 'cond', {}, conds[i]);
    if (locks[i]) el(st, 'lockdot');
    if (on) el(el(st, 'vel'), '', { width: `${[100, 0, 0, 0, 80, 0, 0, 0, 100, 0, 60, 0, 90, 0, 45][i] || 70}%` });
  }
  for (let g = 0; g < 4; g++) bracket(178 + g * 4 * p + 4, yc + 146, 4 * p - 16, `BEAT ${g + 1}`);
  // pages de pas, longueur
  const yp = yc + 184;
  note(178, yp + 6, 'PAGE');
  ['1-16', '17-32', '33-48', '49-64'].forEach((t, i) => key(216 + i * 62, yp, 54, 22, '', { led: null, inner: `<span style="display:flex;align-items:center;gap:5px"><i class="led ${i === 0 ? 'on' : ''}" style="position:static;margin:0;display:inline-block"></i>${t}</span>`, inSt: { fontSize: '7.5px', letterSpacing: '.1em' } }));
  note(486, yp + 6, 'LENGTH <b>16</b> · TRACK <b>16</b> · SCALE <b>1/16</b>');
  note(1348, yp + 32, 'FIRMWARE V.3.0 / 2026', { transform: 'translateX(-100%)', color: '#6a6a6a', fontSize: '7px' });
  note(1348, yp + 6, '<i>●</i> P-LOCK &nbsp; <i>1:2</i> CONDITION &nbsp; <b>▬</b> VELOCITY', { transform: 'translateX(-100%)' });
}
