/**
 * Le menu MACHINE de la face DT2 (V.6.0, lane B5, 2026-11-01, cahier dt2 3.2 et 4.2 ; inv-dt-ui.md 7.5) : FUNC + SRC.
 * LEFT / RIGHT : la categorie (SRC, FLTR) ; UP / DOWN (ou LEVEL/DATA) : la machine ; YES : la piste active la prend ; NO
 * ferme. SRC : ONESHOT (le sample seul), KICK, SNARE, CL HAT, OP HAT, CLAP, LO TOM, HI TOM, CYMBAL (la synthese 909, 808 ou
 * MM et sa couche sample : le son d'une voix d'aujourd'hui) ; n'importe quelle machine sur n'importe quelle piste. FLTR :
 * LEGACY (le filtre d'aujourd'hui) ; MULTI-MODE, LOWPASS 4 et EQ arrivent en V.6.1.
 */

import { SRC_MACHINES, SRC_MACHINE_LABEL, TRACK_NAMES, TYPED_TRACKS, trackIndex, tracks, typedFamily, type SrcMachine, type TrackKey } from '../../../audio/tracks';

const trackLabel = (t: TrackKey): string => TRACK_NAMES[trackIndex(t)] ?? t;
import { resume } from '../../../audio/drums';
import { lcdMessage } from '../../../state/lcdMessage';
import type { Screen } from '../core';
import { BLACK, HALF, INK } from '../consts';
import { registerScreenMenu } from './registry';
import { DIM_TEXT, acting, paintHint, paintList, scrollTop, stepCursor, type MenuRow } from './frame';
import { menuChanged, screenTrack } from './open';

const FLTR = [
  { label: 'LEGACY', soon: false },
  { label: 'MULTI-MODE', soon: true },
  { label: 'LOWPASS 4', soon: true },
  { label: 'EQ', soon: true },
] as const;

let cat: 0 | 1 = 0;
let cursor = 0;
let top = 0;

function rows(): MenuRow[] {
  const t = screenTrack();
  if (cat === 1) return FLTR.map((f, i) => ({ label: f.label, ...(f.soon ? { dim: true, value: 'V.6.1' } : { on: i === 0 }) }));
  const cur = t ? tracks.of(t).mach : null;
  // Le plugin : chaque piste a son type, des samples seulement (audio/tracks.ts TYPED_TRACKS)
  if (TYPED_TRACKS) return [{ label: `ONESHOT  ${t ? typedFamily(trackIndex(t)).toUpperCase() : ''} SAMPLES`, on: true }];
  return SRC_MACHINES.map((m) => ({ label: SRC_MACHINE_LABEL[m], on: m === cur }));
}

function paint(screen: Screen): number {
  const t = screenTrack();
  // Les deux categories en onglets, la courante pleine
  ['SRC', 'FLTR'].forEach((w, i) => {
    const x = 8 + i * 50;
    if (i === cat) screen.pill(x, 25, 44, 12, INK);
    else screen.pill(x, 25, 44, 12, null, HALF, 0.8);
    screen.text(w, x + 22, 34, 7.5, i === cat ? BLACK : HALF, 700, 'center', 0.6);
  });
  screen.text(t ? `TRACK ${trackLabel(t)}` : 'PICK A TRACK', 312, 34, 7.5, t ? INK : DIM_TEXT, 700, 'right', 0.5);
  const r = rows();
  top = scrollTop(top, cursor, r.length, 8);
  body = paintList(screen, r, cursor, top, { x0: 4, x1: 316, y0: 41, y1: 170 });
  paintHint(screen, 'UP/DOWN: MACHINE   YES: SET   LEFT/RIGHT: SRC FLTR   NO: EXIT');
  return 0;
}
let body = '';

function set(): void {
  const t = screenTrack();
  if (!t) {
    lcdMessage.show('PICK A TRACK: TRK + TRIG', 1400);
    return;
  }
  if (cat === 1) {
    lcdMessage.show(cursor === 0 ? `${trackLabel(t)} FILTER: LEGACY` : 'FLTR MACHINES: BIENTOT V.6.1', 1400);
    return;
  }
  if (TYPED_TRACKS) {
    lcdMessage.show(`${trackLabel(t)} : ${typedFamily(trackIndex(t)).toUpperCase()} SAMPLES ONLY`, 1400);
    return;
  }
  const m: SrcMachine = SRC_MACHINES[cursor];
  resume();
  tracks.machine(t, m);
  lcdMessage.show(`${trackLabel(t)} MACHINE ${SRC_MACHINE_LABEL[m]}`, 1400);
}

registerScreenMenu({
  id: 'machine',
  owner: 'B5',
  title: () => (cat === 0 ? 'MACHINE  SRC' : 'MACHINE  FLTR'),
  paint: (screen) => paint(screen),
  onOpen() {
    cat = 0;
    const t = screenTrack();
    cursor = t && !TYPED_TRACKS ? Math.max(0, SRC_MACHINES.indexOf(tracks.of(t).mach)) : 0;
    top = 0;
  },
  info: () => body,
  onInput(i) {
    if (!acting(i)) return true;
    const n = rows().length;
    switch (i.kind) {
      case 'up':
      case 'down':
        cursor = stepCursor(cursor, n, i.kind === 'up' ? -1 : 1, i.func, 8);
        break;
      case 'data':
        cursor = stepCursor(cursor, n, Math.sign(i.delta ?? 0) * Math.max(1, Math.abs(Math.round(i.delta ?? 0))), false);
        break;
      case 'left':
      case 'right':
        cat = cat === 0 ? 1 : 0;
        cursor = 0;
        top = 0;
        break;
      case 'yes':
        set();
        break;
      default:
        return false;
    }
    menuChanged();
    return true;
  },
});
