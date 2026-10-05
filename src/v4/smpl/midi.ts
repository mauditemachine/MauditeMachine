/**
 * Les cibles MIDI du MM-SMPL (2026-10-05, midi/targets.ts) : ses douze
 * potards, ses onze touches (PLAY, STOP, GRAB A et B, FILE, REC, SLICES,
 * MODE, REV, LOOP, SAVE) et ses seize trigs (tenus : un nuage de grains ou
 * une slice bouclee jouent tant qu'on tient). Inscrites au chargement de
 * son code (state/smplload.ts).
 */

import { registerTargets, type MidiTarget } from '../midi/targets';
import { smplDial, smplPad } from './actions';
import { keyAction } from './gestures';
import { SMPL_KNOBS, smplParams } from './params';
import { SMPL_PADS } from './slices';
import { SMPL_KEYS } from './theme';

function all(): MidiTarget[] {
  const out: MidiTarget[] = [];
  for (const k of SMPL_KNOBS) {
    out.push({ id: `smpl:knob:${k.id}`, scope: 'smpl', label: k.label, kind: 'value', steps: k.steps ?? 0, get: () => smplParams.of(k.id), set: (v) => smplDial(k.id, v) });
  }
  for (const k of SMPL_KEYS) out.push({ id: `smpl:key:${k.kind}`, scope: 'smpl', label: k.label, kind: 'press', down: () => keyAction(k.kind) });
  for (let i = 0; i < SMPL_PADS; i += 1) out.push({ id: `smpl:pad:${i}`, scope: 'smpl', label: `TRIG ${i + 1}`, kind: 'hold', down: () => smplPad(i, true), up: () => smplPad(i, false) });
  return out;
}

const map = new Map(all().map((t) => [t.id, t]));

registerTargets('smpl', () => [...map.values()], (id) => map.get(id));
