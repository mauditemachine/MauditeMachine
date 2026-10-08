/**
 * Le mode d'emploi d'une machine, en vue d'ensemble (2026-10-05, Mika :
 * "quand on hover sur une machine avant de cliquer, on devrait avoir une
 * description de comment utiliser, en vraiment court, 1 ou 2 paragraphes").
 * Une carte sous la machine survolee (au-dessus si elle sortirait de
 * l'ecran), qui suit la vue ; desktop seulement (il faut une souris).
 */

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import type { Stage } from '../scene/renderer';
import { focus, type MachineId } from '../state/focus';
import { overviewHover } from '../state/overviewHover';

export const MACHINE_HELP: Readonly<Record<MachineId, { name: string; kind: string; text: readonly string[] }>> = {
  mm808: {
    name: 'MM-RYTM',
    kind: 'Drum machine',
    text: [
      'Pick a voice pad (BD, SD, CH...), then tap the 16 steps to write its part; hold a step and drag to set its velocity. RUN/STOP plays, RANDOM writes a groove.',
      'Like an Elektron: press a page key (TRIG SRC SMPL FLTR AMP FX) and the 8 knobs A to H under the screen set the 8 blocks above them, values 0 to 127 on the screen; the lit key again shows the home screen. EDIT turns the steps into 16 patterns; OPEN lifts the hood for the TWEAKS.',
    ],
  },
  voy: {
    name: 'MM-ARP',
    kind: 'Arpeggiator synthesizer',
    text: [
      'Tap chord pads to build a progression in F# minor, one chord per bar; RUN/STOP plays it in time with the MM-RYTM. RATE, MODE and RANGE shape the arpeggio; EDIT raises a screen in place of the pads where you draw your own notes.',
      'Two oscillators, a Moog style filter, two envelopes, a tempo synced LFO and effects. OPEN hides the TWEAKS: CHORD voicings, SIDECHAIN on the kick, stereo width.',
    ],
  },
  bass: {
    name: 'MM-BASS',
    kind: 'Bass synth and sequencer',
    text: [
      'The sound reads left to right like a classic mono synth: OSC, FILTER, ENVELOPE, ACCENT / SLIDE, OUTPUT. GEN writes a line in the chosen STYLE (acid, dark disco, indie dance, minimal, psy prog, techno, house, electro, EBM, italo, sub) and DENSITY; turn them and the fresh line follows. RUN plays in time with the MM-RYTM. Touch the screen for presets.',
      'Tap a step: note, tie, off; drag it to change its note. Hold a step (or press its LOCK) and turn a knob: that step only, like an Elektron. EDIT turns the steps into 16 patterns. OPEN lifts the hood: fine settings and INFOS, a help card on every control.',
    ],
  },
  dj: {
    name: 'MM-DECKS',
    kind: 'DJ decks and mixer',
    text: [
      'Two decks (up to four): search Maudite Machine or SoundCloud tracks in a deck screen and load them. CUE, PLAY, loops, pitch and SYNC, like a club player.',
      'Each deck has a sampler: REC DECK grabs its last beats (or its loop), REC MIX the last beats of the mixer. SMPL shows it on the screen: slices on pads, grain clouds, a 16 step sequence, SAVE as a WAV.',
      'The mixer also takes the three machines on channels 1 to 3 (MM-RYTM, MM-BASS, MM-ARP), with EQ, filter, effects and FX TO; playing decks follow their tempo. ADD DECK sits in its header.',
    ],
  },
};

const CARD_W = 340;

export const OverviewHelp: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const m = useSyncExternalStore(overviewHover.subscribe, overviewHover.get, overviewHover.get);
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!stage || !m) return undefined;
    const bump = (): void => setTick((t) => t + 1);
    const a = stage.onView(bump);
    return () => a();
  }, [stage, m]);
  // Une machine choisie : la carte s'en va
  useEffect(() => {
    if (f !== 'all') overviewHover.set(null);
  }, [f]);
  if (!stage || !m || f !== 'all') return null;
  const box = stage.hit.machineBox(m);
  const help = MACHINE_HELP[m];
  if (!box || !help) return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(16, Math.min(vw - CARD_W - 16, box.x + box.w / 2 - CARD_W / 2));
  // Sous le nom de la machine (MachineNav, une quarantaine de pixels sous elle)
  const below = box.y + box.h + 64;
  const style: React.CSSProperties = below + 220 < vh ? { left, top: below, width: CARD_W } : { left, bottom: Math.max(16, vh - box.y + 14), width: CARD_W };
  return (
    <div className="v4-ovhelp" role="note" aria-live="polite" style={style}>
      <div className="v4-ovhelp-head">
        <span className="v4-ovhelp-name">{help.name}</span>
        <span className="v4-ovhelp-kind">{help.kind}</span>
      </div>
      {help.text.map((p) => (
        <p key={p.slice(0, 24)}>{p}</p>
      ))}
      <span className="v4-ovhelp-cta">Click to play it</span>
    </div>
  );
};

export default OverviewHelp;
