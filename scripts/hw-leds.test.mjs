#!/usr/bin/env node
/**
 * `npm run hw:test` (V.5.0, 2026-10-29, la face facon Digitakt) : les LEDs de la rangee et de la vue PTN que le boitier MMHW
 * v2 recoit (src/v4/hw/rowLeds.ts), sans dependance : node:test et node:assert, le .ts importe tel quel (rowLeds.ts
 * n'importe rien). Les couleurs : celles de la machine noire (docs/v4/digitakt-d1-spec.md section 2).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROW_HOME_LEVEL, ROW_KEYS, ptnLeds, rowLeds } from '../src/v4/hw/rowLeds.ts';

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
