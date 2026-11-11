/**
 * Le bandeau du haut de la fenetre du plugin MM-ARP (2026-11-11, le format large), sur toute la largeur entre les joues,
 * sur la face comme sur le panneau d'OPEN : l'identite de la machine et le passage d'un panneau a l'autre.
 * - a gauche : le logotype Maudite Machine, MM-ARP, et une plaque de metal grave qui dit le panneau montre (FRONT PANEL,
 *   OPTIONS PANEL) ;
 * - au milieu : l'afficheur (le verre de l'ecran de la machine). Au repos : le preset d'usine charge (LIBRARY, Library.tsx)
 *   entre deux fleches qui chargent le precedent et le suivant ; sinon, dans l'ordre : MIDI LEARN, le message du clip
 *   (DRAG MIDI, SAVE .MID), le reglage touche (son nom et sa valeur, SoundPlus.tsx xTouch) ou le pas touche du STEP
 *   SEQUENCER ;
 * - a droite : la version du build (firmware.ts ARP_BUILD, celle que la machine serigraphiait dans son en-tete) et la
 *   touche OPEN, sa legende orange comme PRESET et OPEN sur la machine ; panneau ouvert elle dit CLOSE, sa LED allumee.
 */

import React, { useSyncExternalStore } from 'react';
import { openToggle } from '../../actions';
import { ARP_BUILD } from '../../firmware';
import type { Stage } from '../../scene/renderer';
import { voyExplode } from '../../state/explode';
import { VOY_KNOB_IDS, voyKnob, voyParams, voyValueText, type VoyKnobId } from '../../voyager/params';
import { arpExtra, extraParam } from './extra';
import { Key, paramLabel } from './HoodPanel';
import { libCurrent, libStep, libStore, LIB_PRESETS } from './Library';
import { arpMidi } from './midimap';
import { CHEEK_W, HEAD_H, UI_W } from './scale';
import { sectionPrefix, xTouch } from './SoundPlus';
import { arpSteps, STEP_TRACKS, stepName } from './steps';

const isKnob = (id: string): id is VoyKnobId => (VOY_KNOB_IDS as readonly string[]).includes(id);

/** L'afficheur : deux lignes, un titre et une valeur ; mode : la couleur du titre (face.css). */
const Lcd: React.FC<{ open: boolean }> = ({ open }) => {
  const st = useSyncExternalStore(arpMidi.subscribe, arpMidi.get, arpMidi.get);
  const t = useSyncExternalStore(xTouch.subscribe, xTouch.get, xTouch.get);
  const extra = useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);
  const knobs = useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
  const steps = useSyncExternalStore(arpSteps.subscribe, arpSteps.get, arpSteps.get);
  useSyncExternalStore(libStore.subscribe, libStore.get, libStore.get);
  const cur = libCurrent();
  let head: string;
  let line: string;
  let side = '';
  let mode = 'idle';
  const x = t ? extraParam(t.id) : undefined;
  if (st.learning) {
    head = 'MIDI LEARN';
    line = st.armed ? `CC → ${paramLabel(st.armed)}` : 'CLICK A KNOB';
    side = 'ESC';
    mode = 'learn';
  } else if (st.status) {
    head = st.status.ok ? 'CLIP' : 'CLIP · ERROR';
    line = st.status.msg;
    mode = 'status';
  } else if (t && x) {
    head = `${sectionPrefix(x)}${x.label}`;
    line = arpExtra.text(x.id, extra[x.id]);
    mode = t.active ? 'gesture' : 'touch';
  } else if (t && isKnob(t.id)) {
    head = voyKnob(t.id).label;
    line = voyValueText(t.id, knobs[t.id]);
    mode = t.active ? 'gesture' : 'touch';
  } else if (t && t.id.startsWith('step:')) {
    // Un pas du STEP SEQUENCER : sa piste et son numero, son etat
    const [, track, i] = t.id.split(':');
    const spec = STEP_TRACKS.find((s) => s.id === track);
    head = `STEP ${Number(i) + 1} · ${spec?.label ?? ''}`;
    line = spec ? stepName(spec.id, steps[spec.id][Number(i)]) : '';
    mode = t.active ? 'gesture' : 'touch';
  } else if (cur) {
    head = `LIBRARY · ${cur.preset.cat} ${String(cur.at + 1).padStart(2, '0')} / ${String(cur.of).padStart(2, '0')}`;
    line = cur.preset.name;
    side = `${cur.preset.bpm} BPM`;
  } else {
    head = open ? 'OPTIONS PANEL' : 'FACTORY LIBRARY';
    line = open ? 'TWEAKS · SOUND · LIBRARY · TOOLS' : `${LIB_PRESETS.length} SOUNDS · PRESS ▶`;
  }
  return (
    <div className="mm-arp-lcd" data-mode={mode} role="status" aria-live="polite">
      <span className="mm-arp-lcd-head">{head}</span>
      <span className="mm-arp-lcd-line">{line}</span>
      {side && <span className="mm-arp-lcd-side">{side}</span>}
    </div>
  );
};

export const Header: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const hood = useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
  const open = hood === 'opening' || hood === 'open';
  return (
    <header className="mm-arp-head" style={{ position: 'absolute', left: CHEEK_W, top: 0, width: UI_W - 2 * CHEEK_W, height: HEAD_H }} data-open={open ? '1' : undefined}>
      <div className="mm-arp-head-brand">
        <img className="mm-arp-head-logo" src="/logo/mauditemachine-logo-aligned.svg" alt="Maudite Machine" draggable={false} />
        <span className="mm-arp-head-model">MM-ARP</span>
        <span className="mm-arp-plate" aria-live="polite">
          {open ? 'OPTIONS PANEL' : 'FRONT PANEL'}
        </span>
      </div>
      <div className="mm-arp-head-mid">
        <button type="button" className="mm-arp-head-arrow" aria-label="Previous factory preset" title="Previous factory preset" onClick={() => libStep(-1)}>
          <span className="mm-arp-k" aria-hidden="true">
            <span className="mm-arp-k-glyph">◀</span>
          </span>
        </button>
        <Lcd open={open} />
        <button type="button" className="mm-arp-head-arrow" aria-label="Next factory preset" title="Next factory preset" onClick={() => libStep(1)}>
          <span className="mm-arp-k" aria-hidden="true">
            <span className="mm-arp-k-glyph">▶</span>
          </span>
        </button>
      </div>
      <div className="mm-arp-head-right">
        <span className="mm-arp-rev" title={ARP_BUILD}>
          {ARP_BUILD}
        </span>
        <Key
          className="mm-arp-openkey"
          size="s"
          fn
          led={open}
          legend={open ? 'CLOSE' : 'OPEN'}
          aria-label={open ? 'Close the options panel' : 'Open the options panel'}
          aria-pressed={open}
          title={open ? 'Back to the front panel (Esc)' : 'Options panel: tweaks, sound, library, tools (O)'}
          onClick={() => openToggle(stage, 'voy')}
        />
      </div>
    </header>
  );
};
