/**
 * Dock (spec 11.4) : sur telephone les 16 pas 3D sont a 7 px l'un de
 * l'autre, on programme donc le sequenceur ici, sous la machine. Une
 * rangee d'instruments (le selectionne en jaune ; toucher choisit sans
 * jouer), les 16 pas en deux rangees de 8 cases, puis le transport : RUN,
 * CLEAR, OPEN et le tempo (- / valeur / +). Sur le telephone les boutons
 * 3D du transport font 13 a 18 px projetes et CLEAR est a 29 px de TEMPO,
 * OPEN a 22 px du knob CONTACT : ici chaque commande a au moins 48 px de
 * haut (48 x 48 pour le transport, regle 5). Chaque case montre le pas
 * pour l'instrument selectionne, ou l'union attenuee tant qu'aucun n'est
 * choisi ; la case sous la tete de lecture passe en yellowHi. Memes stores
 * que la machine : les deux changent ensemble. Monte seulement sur la mise
 * en page mobile (index.tsx), jamais dans le repli.
 */

import React, { useState, useSyncExternalStore } from 'react';
import { clearPattern, openToggle, runToggle, selectInstrument, setTempo, stepToggle } from '../actions';
import { clock } from '../audio/clock';
import { BPM, INSTRUMENTS, STEP_COUNT, pattern } from '../audio/pattern';
import { explode } from '../state/explode';
import { playhead } from '../state/playhead';
import { INST_NAMES } from '../theme';

const STEP_INDEXES = Array.from({ length: STEP_COUNT }, (_, i) => i);

const Glyph: React.FC<{ plus: boolean }> = ({ plus }) => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <path d={plus ? 'M3 8h10M8 3v10' : 'M3 8h10'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const Dock: React.FC = () => {
  const p = useSyncExternalStore(pattern.subscribe, pattern.get, pattern.get);
  const head = useSyncExternalStore(playhead.subscribe, playhead.get, playhead.get);
  const running = useSyncExternalStore(clock.subscribe, () => clock.running, () => clock.running);
  const ex = useSyncExternalStore(explode.subscribe, explode.get, explode.get);
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
        <button type="button" className="v4-dock-key" aria-pressed={opened} aria-label="Open the machine" onClick={() => openToggle()}>
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
    </div>
  );
};

export default Dock;
