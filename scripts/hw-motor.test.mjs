#!/usr/bin/env node
/**
 * `npm run hw:test` (2026-10-27, la phase 3) : les tests du retour vers les potards motorises du boitier MM-RYTM
 * (src/v4/hw/motor.ts), sans dependance : node:test et node:assert, le .ts importe tel quel (node 22.6 et plus efface les
 * types ; motor.ts n'importe rien). L'horloge est fausse : les tests l'avancent a la main, rien n'attend.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { motorFeed } from '../src/v4/hw/motor.ts';

/** Une horloge a la main : advance(ms) joue les minuteries dans l'ordre de leur heure. */
function fakeClock() {
  let t = 0;
  let id = 0;
  const timers = new Map();
  return {
    now: () => t,
    setTimer(fn, ms) {
      id += 1;
      timers.set(id, { at: t + ms, fn });
      return id;
    },
    clearTimer(i) {
      timers.delete(i);
    },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        let next = null;
        for (const [i, x] of timers) if (x.at <= end && (!next || x.at < next[1].at)) next = [i, x];
        if (!next) break;
        timers.delete(next[0]);
        t = Math.max(t, next[1].at);
        next[1].fn();
      }
      t = end;
    },
    get pending() {
      return timers.size;
    },
  };
}

function setup(o) {
  const clock = fakeClock();
  const feed = motorFeed(clock, o);
  const sent = [];
  feed.subscribe((k, v) => sent.push({ k, v, t: clock.now() }));
  return { clock, feed, sent };
}

test('un changement part tout de suite', () => {
  const { feed, sent } = setup();
  feed.change(2, 0.25);
  assert.deepEqual(sent, [{ k: 2, v: 0.25, t: 0 }]);
});

test('la meme valeur ne repart pas', () => {
  const { feed, sent } = setup();
  feed.change(0, 0.5);
  feed.change(0, 0.5);
  assert.equal(sent.length, 1);
});

test('une rafale : la premiere tout de suite, la derniere a la fin de l intervalle (30 Hz)', () => {
  const { clock, feed, sent } = setup();
  for (let i = 0; i <= 10; i += 1) {
    feed.change(0, i / 10);
    clock.advance(1);
  }
  clock.advance(100);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].v, 0);
  assert.equal(sent[1].v, 1);
  assert.equal(sent[1].t, Math.ceil(1000 / 30), `deuxieme envoi a ${sent[1].t} ms`);
});

test('au plus 30 envois par seconde et par potard, la derniere valeur toujours livree', () => {
  const { clock, feed, sent } = setup();
  let v = 0;
  for (let t = 0; t < 1000; t += 5) {
    v = (t % 200) / 200;
    feed.change(3, v);
    clock.advance(5);
  }
  feed.change(3, 0.777);
  clock.advance(200);
  assert.ok(sent.length <= 32, `${sent.length} envois`);
  for (let i = 1; i < sent.length; i += 1) assert.ok(sent[i].t - sent[i - 1].t >= 1000 / 30 - 1e-9, `ecart ${sent[i].t - sent[i - 1].t}`);
  assert.equal(sent.at(-1).v, 0.777);
});

test('les potards sont independants', () => {
  const { clock, feed, sent } = setup();
  feed.change(0, 0.1);
  feed.change(1, 0.2);
  clock.advance(5);
  feed.change(0, 0.3);
  feed.change(1, 0.4);
  assert.deepEqual(
    sent.map((s) => [s.k, s.v]),
    [
      [0, 0.1],
      [1, 0.2],
    ]
  );
  clock.advance(40);
  assert.deepEqual(
    sent.slice(2).map((s) => [s.k, s.v]),
    [
      [0, 0.3],
      [1, 0.4],
    ]
  );
});

test('le potard lui-meme (fromPot) ne recoit jamais sa valeur', () => {
  const { clock, feed, sent } = setup();
  feed.change(4, 0.6, true);
  clock.advance(500);
  assert.equal(sent.length, 0);
});

test('garde d echo : 150 ms apres un mouvement du potard, rien ne part ; sa propre valeur ne repart pas a la fin', () => {
  const { clock, feed, sent } = setup();
  feed.pot(1, 0.3);
  // l'echo qui revient par une autre voie (le registre MIDI) : ignore
  feed.change(1, 0.3);
  clock.advance(149);
  assert.equal(sent.length, 0);
  clock.advance(10);
  assert.equal(sent.length, 0);
  assert.equal(feed.state(1).guarded, false);
});

test('garde d echo : une autre valeur pendant la garde part a sa fin', () => {
  const { clock, feed, sent } = setup();
  feed.pot(5, 0.3);
  clock.advance(50);
  feed.change(5, 0.8);
  clock.advance(50);
  assert.equal(sent.length, 0);
  clock.advance(60);
  assert.deepEqual(sent, [{ k: 5, v: 0.8, t: 150 }]);
});

test('garde d echo : refaite a chaque mouvement, un cran qui happe la valeur part a la fin', () => {
  const { clock, feed, sent } = setup();
  for (let i = 0; i < 15; i += 1) {
    const v = 0.3 + i * 0.01;
    feed.pot(0, v);
    feed.change(0, v, true);
    clock.advance(20);
  }
  assert.equal(sent.length, 0);
  // le reglage a des crans : le site garde 0.5 (pas 0.44)
  feed.change(0, 0.5, true);
  clock.advance(200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].v, 0.5);
  assert.ok(Math.abs(sent[0].t - (14 * 20 + 150)) < 1e-9, `a ${sent[0].t} ms`);
});

test('garde d echo : un ecart de moins d un demi-cran ne fait pas bouger le moteur', () => {
  const { clock, feed, sent } = setup();
  feed.pot(2, 64 / 127);
  feed.change(2, 64 / 127 + 0.001, true);
  clock.advance(300);
  assert.equal(sent.length, 0);
});

test('un mouvement du potard annule un envoi differe (le moteur ne revient pas en arriere)', () => {
  const { clock, feed, sent } = setup();
  feed.change(6, 0.1);
  clock.advance(10);
  feed.change(6, 0.2);
  clock.advance(10);
  feed.pot(6, 0.9);
  feed.change(6, 0.9, true);
  clock.advance(500);
  assert.deepEqual(
    sent.map((s) => s.v),
    [0.1]
  );
});

test('le toucher : rien ne part tant qu il est tenu, la derniere valeur une fois au lacher', () => {
  const { clock, feed, sent } = setup();
  feed.change(7, 0.1);
  clock.advance(100);
  feed.touch(7, true);
  feed.change(7, 0.6);
  clock.advance(50);
  feed.change(7, 0.7);
  clock.advance(500);
  assert.equal(sent.length, 1);
  feed.touch(7, false);
  clock.advance(100);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].v, 0.7);
  clock.advance(500);
  assert.equal(sent.length, 2);
});

test('le toucher : lache sans changement, la valeur part quand meme une fois (le moteur se recale)', () => {
  const { clock, feed, sent } = setup();
  feed.change(3, 0.4);
  clock.advance(100);
  feed.touch(3, true);
  feed.pot(3, 0.45);
  feed.change(3, 0.45, true);
  clock.advance(10);
  feed.touch(3, false);
  clock.advance(100);
  assert.deepEqual(
    sent.map((s) => s.v),
    [0.4, 0.45]
  );
  assert.equal(feed.state(3).guarded, false);
});

test('le toucher : un lacher juste apres un envoi attend l intervalle de 30 Hz', () => {
  const { clock, feed, sent } = setup();
  feed.change(1, 0.2);
  feed.touch(1, true);
  feed.change(1, 0.3);
  clock.advance(5);
  feed.touch(1, false);
  assert.equal(sent.length, 1);
  clock.advance(40);
  assert.deepEqual(
    sent.map((s) => s.v),
    [0.2, 0.3]
  );
});

// La couture de hw/index.ts pendant les presets du desktop (2026-10-27, la revue) : la main fait defiler la liste, la page
// cachee garde sa valeur ; pot(k, v) puis change(k, v, true) : le moteur reste sous la main, rien ne repart en arriere ;
// a la sortie, change(k, page) le remet a sa page
test('les presets : pot puis change(main, fromPot), la fin de la garde ne ramene pas la page cachee ; la sortie la ramene', () => {
  const { clock, feed, sent } = setup();
  feed.change(0, 1);
  sent.length = 0;
  for (const v of [0.3, 0.35, 0.4, 0.45, 0.5]) {
    feed.pot(0, v);
    feed.change(0, v, true);
    clock.advance(30);
  }
  clock.advance(500);
  assert.deepEqual(sent, []);
  feed.touch(0, true);
  feed.pot(0, 0.55);
  feed.change(0, 0.55, true);
  feed.touch(0, false);
  clock.advance(500);
  assert.ok(sent.every((x) => x.v === 0.55));
  sent.length = 0;
  feed.change(0, 1);
  clock.advance(100);
  assert.deepEqual(sent.map((x) => x.v), [1]);
});

test('des valeurs hors course sont bornees, NaN et un potard inconnu ignores', () => {
  const { clock, feed, sent } = setup();
  feed.change(0, 2);
  feed.change(1, -1);
  feed.change(2, Number.NaN);
  feed.change(9, 0.5);
  feed.pot(-1, 0.5);
  clock.advance(10);
  assert.deepEqual(
    sent.map((s) => [s.k, s.v]),
    [
      [0, 1],
      [1, 0],
    ]
  );
});

test('dispose arrete tout', () => {
  const { clock, feed, sent } = setup();
  feed.change(0, 0.1);
  feed.change(0, 0.2);
  feed.pot(1, 0.5);
  feed.dispose();
  assert.equal(clock.pending, 0);
  clock.advance(1000);
  assert.equal(sent.length, 1);
});
