// Le tempo des presets du MM-RYTM (2026-10-27, la revue des coutures de la V.4.2 et du MIXER SYNC, SEAM-1 a SEAM-4) :
// pendant le SYNC le tempo ne compte pas, hors SYNC il compte au BPM entier, et ce qu'on garde est au BPM entier. node,
// sans dependance : src/v4/state/presetBpm.ts se charge tel quel (node 22 efface les types). npm run presets:test
import assert from 'node:assert/strict';
import { bpmForSig, bpmToKeep } from '../src/v4/state/presetBpm.ts';

/** audio/pattern.ts clampBpm (BPM 100 a 150, 130 au depart) : ce qu'apply pose. */
const clamp = (b) => Math.min(150, Math.max(100, Math.round(Number.isFinite(b) ? b : 130)));
/** L'empreinte d'un etat du MM-RYTM comme presets.ts sig la compare (sans le reste de canon). */
const sig = (d, synced) => JSON.stringify(bpmForSig({ ...d }, synced, clamp));
const steps = { BD: '1000100010001000', SD: '0000100000001000' };

let n = 0;
const test = (name, fn) => {
  fn();
  n += 1;
  console.log(`ok ${n} ${name}`);
};

test('pendant le SYNC, le tempo ne compte pas (SEAM-3 : ni etoile ni EDITED pour le seul tempo suivi)', () => {
  const o = bpmForSig({ steps, bpm: 124.37 }, true, clamp);
  assert.equal('bpm' in o, false);
  assert.deepEqual(o, { steps });
  assert.equal(sig({ steps, bpm: 124.37 }, true), sig({ steps, bpm: 126 }, true));
  // le reste compte toujours
  assert.notEqual(sig({ steps, bpm: 124 }, true), sig({ steps: { ...steps, BD: '1000000010000000' }, bpm: 124 }, true));
});

test('hors SYNC, le BPM compte entier, comme apply le pose (SEAM-4)', () => {
  assert.equal(sig({ steps, bpm: 124.37 }, false), sig({ steps, bpm: 124 }, false));
  assert.notEqual(sig({ steps, bpm: 124.6 }, false), sig({ steps, bpm: 124 }, false));
  assert.equal(bpmForSig({ bpm: 124.6 }, false, clamp).bpm, 125);
  // hors des bornes : celui qu'apply pose
  assert.equal(sig({ steps, bpm: 174 }, false), sig({ steps, bpm: 150 }, false));
  assert.notEqual(sig({ steps, bpm: 126 }, false), sig({ steps, bpm: 124 }, false));
});

test('un etat sans tempo (MM-ARP, MM-BASS, une empreinte deja sans bpm) reste tel quel', () => {
  const voy = { knobs: { cutoff: 0.5 }, prog: [1, 2] };
  assert.equal(bpmForSig(voy, false, clamp), voy);
  assert.equal(bpmForSig(voy, true, clamp), voy);
  const odd = { steps, bpm: 'x' };
  assert.equal(bpmForSig(odd, false, clamp), odd);
  assert.deepEqual(bpmForSig(odd, true, clamp), { steps });
});

test('SAVE, OVERWRITE et un son mis de cote gardent le BPM entier, sans toucher au reste ni a l etat du moment', () => {
  const now = { steps, bpm: 124.37, fx: { swing: 0.3 } };
  const kept = bpmToKeep(now, clamp);
  assert.deepEqual(kept, { steps, bpm: 124, fx: { swing: 0.3 } });
  assert.equal(now.bpm, 124.37);
  assert.equal(bpmToKeep({ steps, bpm: 124.6 }, clamp).bpm, 125);
  const voy = { knobs: {}, prog: [] };
  assert.equal(bpmToKeep(voy, clamp), voy);
});

test('les repros de la revue, en empreintes', () => {
  // SEAM-2 : BASE garde a 124, le SYNC suit 124.37 ; le son du moment est BASE, rien a mettre de cote
  assert.equal(sig({ steps, bpm: 124.37 }, true), sig({ steps, bpm: 124 }, true));
  // SEAM-1 : mon son mis de cote pendant le SYNC (124.37, garde a 124), UNDO apres une derive a 124.6 : le meme son mis
  // de cote, pas KEEPER (126) retouche
  const mine = { steps: { ...steps, CH: '0010001000100010' } };
  const draft = bpmToKeep({ ...mine, bpm: 124.37 }, clamp);
  assert.equal(sig({ ...mine, bpm: 124.6 }, true), sig(draft, true));
  assert.notEqual(sig({ ...mine, bpm: 124.6 }, true), sig({ steps, bpm: 126 }, true));
  // SEAM-4 : garde pendant le SYNC (124.37), recharge hors SYNC (124) : le meme son, pas EDITED
  assert.equal(sig({ steps, bpm: clamp(124.37) }, false), sig(bpmToKeep({ steps, bpm: 124.37 }, clamp), false));
  // un preset garde a 124.37 avant la correction : toujours reconnu une fois recharge
  assert.equal(sig({ steps, bpm: clamp(124.37) }, false), sig({ steps, bpm: 124.37 }, false));
});

console.log(`${n} tests, tous bons`);
