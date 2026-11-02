#!/usr/bin/env node
/**
 * `npm run hw:test` (V.5.0, 2026-10-29, la face facon Digitakt) : les LEDs de la rangee et de la vue PTN que le boitier MMHW
 * v2 recoit (src/v4/hw/rowLeds.ts), sans dependance : node:test et node:assert, le .ts importe tel quel (rowLeds.ts
 * n'importe rien). Les couleurs : celles de la machine noire (docs/v4/digitakt-d1-spec.md section 2).
 *
 * V.6.0 (2026-11-01, la refonte Digitakt II, lane B6, cahier dt2 2.4 et 2.6) : les quatorze touches d'aujourd'hui gardent
 * leur ordre et leurs notes (FACE_KEYS_HW, HW_KEY_NOTES) ; la face DT2 a 25 touches (DT2_KEYS_HW, l'ordre de
 * rytm/dtFaceIds.ts DT2_BUTTONS), leurs LED (faceLeds), les notes proposees des touches nouvelles (celles de DT2_ZONES,
 * "a confirmer avec protocol.js"), les seize pistes en vue TRK et MUTE (trackLeds16, muteLeds16).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DT2_KEYS_HW, FACE_KEYS_HW, HW_KEY_NOTES, HW_SIDE_CCS, ROW_HOME_LEVEL, ROW_KEYS, bankLeds, faceLeds, muteLeds16, ptnLeds, rowLeds, trackLeds16, trigLeds } from '../src/v4/hw/rowLeds.ts';
import { DT2_BUTTONS, DT2_ZONES } from '../src/v4/rytm/dtFaceIds.ts';

const PAL = { red: '#FF2B2B', green: '#3DDC5A', white: '#F4F1EA' };
const REST = { func: 'off', trk: 'off', ptn: false, rec: false, play: 'stop', page: 'voice', home: false };
const at = (leds, id) => leds.find((l) => l.id === id);

test('quatorze touches, dans l ordre de la rangee', () => {
  const l = rowLeds(REST, PAL);
  assert.equal(l.length, 14);
  assert.deepEqual(
    l.map((x) => x.id),
    ['func', 'trk', 'ptn', 'rec', 'play', 'stop', 'trig', 'src', 'fltr', 'amp', 'fx', 'mod', 'yes', 'no']
  );
  assert.deepEqual(l.map((x) => x.id), [...ROW_KEYS]);
});

test('au repos : seule la page affichee (SRC) est allumee, en rouge', () => {
  const l = rowLeds(REST, PAL);
  assert.deepEqual(at(l, 'src'), { id: 'src', color: '#FF2B2B', level: 1, blink: false });
  for (const x of l) if (x.id !== 'src') assert.deepEqual([x.color, x.level], ['', 0], x.id);
});

test('FUNC : blanc plein tenue, clignotant gardee (une touche ou verrouillee)', () => {
  assert.deepEqual(at(rowLeds({ ...REST, func: 'held' }, PAL), 'func'), { id: 'func', color: '#F4F1EA', level: 1, blink: false });
  assert.equal(at(rowLeds({ ...REST, func: 'once' }, PAL), 'func').blink, true);
  assert.equal(at(rowLeds({ ...REST, func: 'locked' }, PAL), 'func').blink, true);
});

test('TRK rouge, clignotante gardee ; PTN et REC rouges', () => {
  const l = rowLeds({ ...REST, trk: 'latched', ptn: true, rec: true }, PAL);
  assert.deepEqual(at(l, 'trk'), { id: 'trk', color: '#FF2B2B', level: 1, blink: true });
  assert.equal(at(rowLeds({ ...REST, trk: 'held' }, PAL), 'trk').blink, false);
  assert.deepEqual([at(l, 'ptn').color, at(l, 'ptn').level], ['#FF2B2B', 1]);
  assert.deepEqual([at(l, 'rec').color, at(l, 'rec').level], ['#FF2B2B', 1]);
});

test('PLAY : vert en lecture, vert clignotant en pause, eteint a l arret', () => {
  assert.deepEqual(at(rowLeds({ ...REST, play: 'run' }, PAL), 'play'), { id: 'play', color: '#3DDC5A', level: 1, blink: false });
  assert.deepEqual(at(rowLeds({ ...REST, play: 'pause' }, PAL), 'play'), { id: 'play', color: '#3DDC5A', level: 1, blink: true });
  assert.equal(at(rowLeds(REST, PAL), 'play').level, 0);
});

test('STOP, YES, NO : l eclair blanc de leur appui', () => {
  const l = rowLeds({ ...REST, flash: { stop: 1, yes: 0.5 } }, PAL);
  assert.deepEqual([at(l, 'stop').color, at(l, 'stop').level], ['#F4F1EA', 1]);
  assert.equal(at(l, 'yes').level, 0.5);
  assert.equal(at(l, 'no').level, 0);
});

test('les pages : AMP pour env, rouge faible en HOME ; les pages de FUNC n allument rien', () => {
  assert.equal(at(rowLeds({ ...REST, page: 'env' }, PAL), 'amp').level, 1);
  assert.equal(at(rowLeds({ ...REST, page: 'trig', home: true }, PAL), 'trig').level, ROW_HOME_LEVEL);
  for (const page of ['tempo', 'sendfx', 'mixer']) {
    const l = rowLeds({ ...REST, page }, PAL);
    assert.ok(['trig', 'src', 'fltr', 'amp', 'fx', 'mod'].every((id) => at(l, id).level === 0), page);
  }
});

test('la vue PTN : qui joue rouge plein, le suivant et la chaine clignotent, un plein blanc faible', () => {
  const filled = Array.from({ length: 16 }, (_, i) => i < 6);
  const g = ptnLeds(0, 2, [0, 1, 3], filled, PAL, { cur: 1, next: 1, chain: 0.6, filled: 0.2 });
  assert.equal(g.length, 16);
  assert.deepEqual(g[0], { i: 0, color: '#FF2B2B', level: 1, blink: false });
  assert.deepEqual(g[2], { i: 2, color: '#FF2B2B', level: 1, blink: true });
  assert.deepEqual(g[1], { i: 1, color: '#FF2B2B', level: 0.6, blink: true });
  assert.deepEqual(g[4], { i: 4, color: '#F4F1EA', level: 0.2, blink: false });
  assert.deepEqual(g[9], { i: 9, color: '', level: 0, blink: false });
});

test('V.5.3 : LIVE REC, la LED de REC clignote (grid rec : fixe)', () => {
  const grid = rowLeds({ ...REST, rec: true }, PAL).find((l) => l.id === 'rec');
  const live = rowLeds({ ...REST, rec: true, live: true }, PAL).find((l) => l.id === 'rec');
  assert.deepEqual([grid.level, grid.blink], [1, false]);
  assert.deepEqual([live.level, live.blink, live.color], [1, true, '#FF2B2B']);
});

test('V.5.2 : la vue BANK, la banque qui joue rouge, l affichee clignote, une pleine blanc faible, 9 a 16 eteints', () => {
  const lv = { cur: 1, next: 1, chain: 0.6, filled: 0.2 };
  // Joue en A, banque C affichee, A B et C ont des patterns
  const g = bankLeds(0, 2, [true, true, true, false, false, false, false, false], PAL, lv);
  assert.equal(g.length, 16);
  assert.deepEqual(g[0], { i: 0, color: '#FF2B2B', level: 1, blink: false });
  assert.deepEqual(g[2], { i: 2, color: '#FF2B2B', level: 1, blink: true });
  assert.deepEqual(g[1], { i: 1, color: '#F4F1EA', level: 0.2, blink: false });
  assert.deepEqual(g[3], { i: 3, color: '', level: 0, blink: false });
  assert.ok(g.slice(8).every((l) => l.level === 0));
  // La banque affichee est celle qui joue : rien ne clignote
  assert.ok(bankLeds(2, 2, [false, false, true], PAL, lv).every((l) => !l.blink));
});

test('V.5.1 : les lock trigs et les pas a condition de la voix choisie, en jaune', () => {
  // Lock trigs sur 5 et 13 (bits 4 et 12), conditions sur 1, 5 et 16 (bits 0, 4, 15)
  const t = trigLeds((1 << 4) | (1 << 12), 1 | (1 << 4) | (1 << 15), '#FFD75E');
  assert.deepEqual(t, { lock: [4, 12], cond: [0, 4, 15], color: '#FFD75E' });
  assert.deepEqual(trigLeds(0, 0, '#FFD75E'), { lock: [], cond: [], color: '#FFD75E' });
});

/* ---------------- V.6.0 : la face Digitakt II ---------------- */

const FPAL = { ...PAL, orange: '#FF6A13', blue: '#4DA3FF', magenta: '#E04DD8' };
const FREST = { func: 'off', trk: 'off', ptn: false, bank: false, keyboard: false, menu: null, perform: false, fill: 'off', rec: 'off', play: 'stop', page: 'voice', home: false };
const fat = (leds, id) => leds.find((l) => l.id === id);

test('V.6.0 : les quatorze touches du boitier d aujourd hui gardent leur ordre et leurs notes (60 a 73)', () => {
  assert.equal(FACE_KEYS_HW.length, 14);
  assert.deepEqual([...FACE_KEYS_HW], ['func', 'trk', 'ptn', 'rec', 'play', 'stop', 'trig', 'src', 'fltr', 'amp', 'fx', 'mod', 'yes', 'no']);
  assert.deepEqual([...FACE_KEYS_HW], [...ROW_KEYS]);
  const today = { trk: [60, 'rytm:trk'], func: [61, 'rytm:func'], ptn: [62, 'rytm:edit'], rec: [63, 'rytm:rec'], play: [64, 'rytm:play'], stop: [65, 'rytm:stop'], trig: [66, 'rytm:page:trig'], src: [67, 'rytm:page:voice'], fltr: [68, 'rytm:page:fltr'], amp: [69, 'rytm:page:env'], fx: [70, 'rytm:page:fx'], mod: [71, 'rytm:page:mod'], yes: [72, 'rytm:yes'], no: [73, 'rytm:no'] };
  for (const id of FACE_KEYS_HW) {
    assert.deepEqual([HW_KEY_NOTES[id].note, HW_KEY_NOTES[id].target], today[id], id);
    assert.equal(HW_KEY_NOTES[id].today, true, id);
  }
  // Seule TRK (note 60) est confirmee par Mika ; le reste est propose, a confirmer avec protocol.js
  assert.deepEqual(Object.entries(HW_KEY_NOTES).filter(([, n]) => n.confirmed).map(([id]) => id), ['trk']);
});

test('V.6.0 : 24 touches de la face DT2 dans l ordre de DT2_BUTTONS, chacune une note, aucune sur SCENE A et B (79, 80)', () => {
  assert.equal(DT2_KEYS_HW.length, 24);
  assert.deepEqual([...DT2_KEYS_HW], DT2_BUTTONS.map((b) => b.id));
  const notes = DT2_KEYS_HW.map((id) => HW_KEY_NOTES[id].note);
  assert.equal(new Set(notes).size, 24);
  assert.ok(!notes.includes(79) && !notes.includes(80));
  assert.ok(notes.every((n) => n >= 60 && n <= 86));
});

test('V.6.0 : les notes proposees des touches nouvelles et les CC des potards de gauche sont ceux du contrat (DT2_ZONES)', () => {
  for (const z of DT2_ZONES) {
    const m = /^(note|CC) (\d+)$/.exec(z.hw);
    assert.ok(m, z.id);
    if (m[1] === 'CC') {
      assert.equal(HW_SIDE_CCS[z.id].cc, Number(m[2]), z.id);
      assert.equal(HW_SIDE_CCS[z.id].target, z.midi[0], z.id);
      continue;
    }
    const n = HW_KEY_NOTES[z.id];
    assert.deepEqual([n.note, n.target, n.today], [Number(m[2]), z.midi[0], false], z.id);
    if (z.midi[1]) assert.equal(n.alt, z.midi[1], z.id);
  }
  assert.equal(HW_SIDE_CCS.data.relative, true);
});

test('V.6.0 : la face DT2 au repos, seule la page affichee (SRC) est allumee', () => {
  const l = faceLeds(FREST, FPAL);
  assert.deepEqual(l.map((x) => x.id), [...DT2_KEYS_HW]);
  assert.deepEqual(fat(l, 'src'), { id: 'src', color: '#FF2B2B', level: 1, blink: false, double: false });
  for (const x of l) if (x.id !== 'src') assert.deepEqual([x.color, x.level], ['', 0], x.id);
});

test('V.6.0 : KEYBOARD, les menus, PERFORM orange, PAGE en FILL (en attente clignote)', () => {
  assert.equal(fat(faceLeds({ ...FREST, keyboard: true }, FPAL), 'kbd').level, 1);
  for (const m of ['preset', 'settings', 'sounds', 'tempo']) {
    const l = faceLeds({ ...FREST, menu: m }, FPAL);
    assert.deepEqual([fat(l, m).color, fat(l, m).level], ['#FF2B2B', 1], m);
    assert.ok(['preset', 'settings', 'sounds', 'tempo'].filter((x) => x !== m).every((x) => fat(l, x).level === 0), m);
  }
  assert.equal(fat(faceLeds({ ...FREST, perform: true, menu: 'preset' }, FPAL), 'preset').color, '#FF6A13');
  assert.deepEqual(fat(faceLeds({ ...FREST, fill: 'on' }, FPAL), 'ptnpage'), { id: 'ptnpage', color: '#FF2B2B', level: 1, blink: false, double: false });
  assert.equal(fat(faceLeds({ ...FREST, fill: 'armed' }, FPAL), 'ptnpage').blink, true);
});

test('V.6.0 : REC GRID fixe, LIVE clignote, STEP double clignotement, euclidien bleu ; PTN en BANK clignote', () => {
  assert.deepEqual(fat(faceLeds({ ...FREST, rec: 'grid' }, FPAL), 'rec'), { id: 'rec', color: '#FF2B2B', level: 1, blink: false, double: false });
  assert.equal(fat(faceLeds({ ...FREST, rec: 'live' }, FPAL), 'rec').blink, true);
  assert.equal(fat(faceLeds({ ...FREST, rec: 'step' }, FPAL), 'rec').double, true);
  assert.equal(fat(faceLeds({ ...FREST, rec: 'euclid' }, FPAL), 'rec').color, '#4DA3FF');
  assert.deepEqual(fat(faceLeds({ ...FREST, ptn: true, bank: true }, FPAL), 'ptn'), { id: 'ptn', color: '#FF2B2B', level: 1, blink: true, double: false });
});

test('V.6.0 : l eclair blanc des fleches et de toute touche, un trig tenu allume ses pages a verrous', () => {
  const l = faceLeds({ ...FREST, flash: { up: 1, preset: 0.5 } }, FPAL);
  assert.deepEqual([fat(l, 'up').color, fat(l, 'up').level], ['#F4F1EA', 1]);
  assert.deepEqual([fat(l, 'preset').color, fat(l, 'preset').level], ['#F4F1EA', 0.5]);
  assert.equal(fat(l, 'left').level, 0);
  const pl = faceLeds({ ...FREST, pageLocks: ['fltr', 'fx'] }, FPAL);
  assert.deepEqual(['trig', 'src', 'fltr', 'amp', 'fx', 'mod'].map((id) => fat(pl, id).level), [0, 0, 1, 0, 1, 0]);
});

const TR = (over = {}) => ({ cur: -1, muted: Array(16).fill(false), pmuted: Array(16).fill(false), solo: Array(16).fill(false), count: 16, ...over });
const LV = { cur: 1, other: 0.22, muted: 0.07 };

test('V.6.0 : TRK sur seize pistes, la choisie pleine ; la face V.5.3 (8) eteint 9 a 16', () => {
  const muted = Array(16).fill(false);
  muted[9] = true;
  const l = trackLeds16(TR({ cur: 10, muted }), PAL, LV);
  assert.equal(l.length, 16);
  assert.deepEqual(l[10], { i: 10, name: 'T11', color: '#FF2B2B', level: 1, bar: 'mute' });
  assert.deepEqual([l[9].level, l[9].bar], [0.07, null]);
  assert.deepEqual([l[0].level, l[0].bar], [0.22, 'mute']);
  const old = trackLeds16(TR({ cur: 0, count: 8 }), PAL, LV);
  assert.ok(old.slice(8).every((x) => x.level === 0 && x.color === ''));
  assert.equal(old[0].level, 1);
});

test('V.6.0 : MUTE sur seize pistes, global vert, du pattern magenta, solo blanc', () => {
  const muted = Array(16).fill(false);
  muted[12] = true;
  const solo = Array(16).fill(false);
  solo[3] = true;
  const g = muteLeds16('global', TR({ muted, solo }), FPAL);
  assert.equal(g.length, 16);
  assert.deepEqual(g[12], { i: 12, color: '', level: 0, blink: false });
  assert.deepEqual(g[15], { i: 15, color: '#3DDC5A', level: 1, blink: false });
  assert.deepEqual(g[3], { i: 3, color: '#F4F1EA', level: 1, blink: false });
  const pm = Array(16).fill(false);
  pm[1] = true;
  const p = muteLeds16('pattern', TR({ pmuted: pm }), FPAL);
  assert.deepEqual([p[1].level, p[0].color], [0, '#E04DD8']);
});
