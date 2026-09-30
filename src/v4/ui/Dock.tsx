/**
 * Dock (spec 11.4 et 20.1 R2-12) : sur telephone les 16 pas 3D sont a 7 px
 * l'un de l'autre, on programme donc le sequenceur ici, sous la machine.
 * Une rangee d'instruments (le selectionne en jaune ; toucher choisit sans
 * jouer), les 16 pas en deux rangees de 8 cases, puis le transport : RUN,
 * CLEAR, OPEN et le tempo (- / valeur / +). Sur le telephone RUN et CLEAR
 * font 20 x 15 px projetes a 18 px l'un de l'autre, le pad OPEN 30 x 24 px
 * a 20 px de SONAA (revision 2) : ici chaque commande a au moins 48 px de
 * haut (48 x 48 pour le transport, regle 5). En bas, la rangee PAGES
 * (revision 2, R2-12) : les sept pages des pads de navigation (TRACKS a
 * SONAA), 48 px de haut, qui defile de cote comme les onglets de la
 * feuille ; les pads 3D ne font que 30 x 24 px a 20 px l'un de l'autre sur
 * un telephone. Toucher une page l'ouvre (le pad 3D s'enfonce et passe au
 * jaune) ; la feuille qui monte recouvre le Dock, ses onglets prennent le
 * relais. Chaque case de pas montre le pas pour l'instrument selectionne,
 * ou l'union attenuee tant qu'aucun n'est choisi ; la case sous la tete de
 * lecture passe en yellowHi. Memes stores que la machine : les deux
 * changent ensemble. Monte seulement sur la mise en page mobile
 * (index.tsx), jamais dans le repli.
 */

import React, { useState, useSyncExternalStore } from 'react';
import { clearPattern, openToggle, page, runToggle, selectInstrument, setTempo, stepToggle } from '../actions';
import { clock } from '../audio/clock';
import { BPM, INSTRUMENTS, STEP_COUNT, pattern } from '../audio/pattern';
import type { Stage } from '../scene/renderer';
import { explode } from '../state/explode';
import { playhead } from '../state/playhead';
import { section } from '../state/section';
import { INST_NAMES, PAGES } from '../theme';
import { keepInRow } from './sections/common';

const STEP_INDEXES = Array.from({ length: STEP_COUNT }, (_, i) => i);

/** "TRACKS" -> "Tracks" */
const title = (label: string): string => label.charAt(0) + label.slice(1).toLowerCase();

const Glyph: React.FC<{ plus: boolean }> = ({ plus }) => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <path d={plus ? 'M3 8h10M8 3v10' : 'M3 8h10'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

interface Props {
  /** le Stage : une page touchee enfonce aussi son pad 3D */
  getStage: () => Stage | null;
}

export const Dock: React.FC<Props> = ({ getStage }) => {
  const p = useSyncExternalStore(pattern.subscribe, pattern.get, pattern.get);
  const head = useSyncExternalStore(playhead.subscribe, playhead.get, playhead.get);
  const running = useSyncExternalStore(clock.subscribe, () => clock.running, () => clock.running);
  const ex = useSyncExternalStore(explode.subscribe, explode.get, explode.get);
  const open = useSyncExternalStore(section.subscribe, section.get, section.get);
  // Un pas touche sans instrument : l'indication clignote une fois
  const [nudge, setNudge] = useState(0);
  const inst = p.instrument;
  const bpm = p.bpm;
  const opened = ex === 'opening' || ex === 'open';

  const onStep = (i: number): void => {
    if (!stepToggle(i)) setNudge((n) => n + 1);
  };

  return (
    <div className="v4-dock" data-mode={inst ? 'edit' : 'union'}>
      <p key={nudge} className="v4-dock-hint" data-nudge={nudge > 0 ? '1' : '0'} aria-live="polite">
        {inst ? '' : 'Tap a pad, then the steps.'}
      </p>
      <div className="v4-dock-insts" role="group" aria-label="Instrument">
        {INSTRUMENTS.map((k) => (
          <button
            key={k}
            type="button"
            className="v4-dock-inst"
            aria-pressed={inst === k}
            aria-label={`Select ${INST_NAMES[k]}`}
            onClick={() => selectInstrument(k)}
          >
            {k}
          </button>
        ))}
      </div>
      <div className="v4-dock-steps" role="group" aria-label="Steps">
        {STEP_INDEXES.map((i) => {
          const on = inst ? p.steps[inst][i] === '1' : INSTRUMENTS.some((k) => p.steps[k][i] === '1');
          const label = inst
            ? `Step ${i + 1}, ${INST_NAMES[inst]} ${on ? 'on' : 'off'}`
            : `Step ${i + 1}, no instrument selected`;
          return (
            <button
              key={i}
              type="button"
              className="v4-dock-step"
              data-on={on ? '1' : '0'}
              data-head={head === i ? '1' : '0'}
              aria-pressed={inst ? on : false}
              aria-disabled={inst ? undefined : true}
              aria-label={label}
              onClick={() => onStep(i)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      {/* Transport : nom fixe, l'etat passe par aria-pressed (comme les jumeaux) */}
      <div className="v4-dock-transport" role="group" aria-label="Transport">
        <button type="button" className="v4-dock-key" aria-pressed={running} aria-label="Run" onClick={() => runToggle()}>
          RUN
        </button>
        <button type="button" className="v4-dock-key" aria-label="Clear pattern" onClick={() => clearPattern()}>
          CLEAR
        </button>
        <button type="button" className="v4-dock-key" aria-pressed={opened} aria-label="Open the machine" onClick={() => openToggle(getStage())}>
          OPEN
        </button>
        <button
          type="button"
          className="v4-dock-key v4-dock-nudge"
          aria-label="Tempo down"
          disabled={bpm <= BPM.min}
          onClick={() => setTempo(bpm - 1)}
        >
          <Glyph plus={false} />
        </button>
        <span className="v4-dock-bpm">
          {bpm}
          <span className="v4-dock-bpm-unit"> BPM</span>
        </span>
        <button
          type="button"
          className="v4-dock-key v4-dock-nudge"
          aria-label="Tempo up"
          disabled={bpm >= BPM.max}
          onClick={() => setTempo(bpm + 1)}
        >
          <Glyph plus />
        </button>
      </div>
      {/* Les pages (R2-12) : comme les pads de page et leurs jumeaux */}
      <div className="v4-dock-pages" role="group" aria-label="Pages">
        {PAGES.map((k) => (
          <button
            key={k.id}
            type="button"
            className="v4-dock-page"
            aria-label={title(k.label)}
            aria-expanded={open === k.id}
            aria-controls={`v4-section-${k.id}`}
            onFocus={keepInRow}
            onClick={() => page(k.id, getStage())}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Dock;
