/**
 * Dock (spec 11.4, revision 4) : sur telephone les 16 pas 3D sont a 7 px
 * l'un de l'autre, on programme donc le sequenceur ici, sous la machine.
 * Une rangee d'instruments (BD SD TOM CH OH, le selectionne en jaune ;
 * toucher choisit sans jouer), les 16 pas en deux rangees de 8 cases, le
 * transport (RUN/STOP, CLEAR, MUTE, SOLO, tempo - / valeur / +), puis la
 * grille de navigation : tous les boutons visibles d'un coup, aucun
 * defilement (6 colonnes x 2 rangees, v4.css) : les cinq pages et RESET,
 * puis OPEN (bouton plein orange) sur toute la rangee ; machine ouverte,
 * GOODIES, MERCH et STUDIO a cote de CLOSE. Un instrument coupe (MUTE)
 * est barre, celui en solo cerne d'orange. Icones Font Awesome 6.5.1 (deja chargee par
 * index.html), en aria-hidden ; chaque bouton garde son nom en toutes
 * lettres. Un appui long (400 ms) vide un pas. Memes
 * stores que la machine : les deux changent ensemble. Monte seulement sur
 * la mise en page mobile (index.tsx), jamais dans le repli.
 */

import React, { useRef, useState, useSyncExternalStore } from 'react';
import {
  clearPattern,
  randomPattern,
  muteToggle,
  openSection,
  openToggle,
  page,
  resetView,
  runToggle,
  selectInstrument,
  setTempo,
  soloToggle,
  stepClear,
  stepToggle,
} from '../actions';
import { clock } from '../audio/clock';
import { BPM, INSTRUMENTS, STEP_COUNT, VEL_BARS, VEL_NAMES, pattern, velocity } from '../audio/pattern';
import type { Stage } from '../scene/renderer';
import { explode } from '../state/explode';
import { playhead } from '../state/playhead';
import { section } from '../state/section';
import { voices } from '../state/voices';
import { INST_NAMES, STEP_HOLD_MS, type SectionId } from '../theme';

const STEP_INDEXES = Array.from({ length: STEP_COUNT }, (_, i) => i);

/** Une cellule de la grille : une section a ouvrir, ou RESET. */
interface Cell {
  id: SectionId | 'reset';
  label: string;
  aria: string;
  icon: string;
}

const PAGE_CELLS: readonly Cell[] = [
  { id: 'tracks', label: 'TRACKS', aria: 'Tracks', icon: 'fa-solid fa-compact-disc' },
  { id: 'mixtapes', label: 'MIXTAPES', aria: 'Mixtapes', icon: 'fa-solid fa-record-vinyl' },
  { id: 'press', label: 'PRESS', aria: 'Press', icon: 'fa-solid fa-file-lines' },
  { id: 'shows', label: 'SHOWS', aria: 'Shows', icon: 'fa-solid fa-calendar-days' },
  { id: 'contact', label: 'CONTACT', aria: 'Contact', icon: 'fa-solid fa-envelope' },
  { id: 'reset', label: 'RESET', aria: 'Reset view', icon: 'fa-solid fa-arrows-rotate' },
];
/** Machine fermee : rien d'autre, OPEN prend toute la rangee */
const CLOSED_CELLS: readonly Cell[] = [];
/** Machine ouverte : les trois puces du PCB */
const OPEN_CELLS: readonly Cell[] = [
  { id: 'goodies', label: 'GOODIES', aria: 'Goodies', icon: 'fa-solid fa-gift' },
  { id: 'merch', label: 'MERCH', aria: 'Merch', icon: 'fa-solid fa-shirt' },
  { id: 'studio', label: 'STUDIO', aria: 'Studio', icon: 'fa-solid fa-microchip' },
];

const Icon: React.FC<{ name: string }> = ({ name }) => <i className={`${name} v4-fa`} aria-hidden="true" />;

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
  const v = useSyncExternalStore(voices.subscribe, voices.get, voices.get);
  // Un pas touche sans instrument : l'indication clignote une fois
  const [nudge, setNudge] = useState(0);
  // Appui long sur un pas : le pas et l'instant du pointerdown ; le clic qui suit est ignore
  const hold = useRef<{ i: number; t: number } | null>(null);
  const skipClick = useRef(-1);
  const inst = p.instrument;
  const bpm = p.bpm;
  const opened = ex === 'opening' || ex === 'open';

  const onStep = (i: number): void => {
    if (!stepToggle(i, getStage())) setNudge((n) => n + 1);
  };
  const onCell = (c: Cell): void => {
    if (c.id === 'reset') resetView(getStage());
    else if (c.id === 'goodies' || c.id === 'merch' || c.id === 'studio') {
      if (open === c.id) section.set(null);
      else openSection(c.id);
    } else page(c.id, getStage());
  };
  const cells = [...PAGE_CELLS, ...(opened ? OPEN_CELLS : CLOSED_CELLS)];
  const hint = inst ? '' : 'Tap a pad, then the steps.';

  return (
    <div className="v4-dock" data-mode={inst ? 'edit' : 'union'}>
      <p key={nudge} className="v4-dock-hint" data-nudge={nudge > 0 ? '1' : '0'} aria-live="polite">
        {hint}
      </p>
      <div className="v4-dock-insts" role="group" aria-label="Instrument">
        {/* RANDOM a gauche des voix, comme sur la machine */}
        <button type="button" className="v4-dock-inst v4-dock-random" aria-label="Random house pattern" onClick={() => randomPattern(getStage())}>
          <Icon name="fa-solid fa-dice" />
        </button>
        {INSTRUMENTS.map((k) => {
          const muted = v.muted.includes(k);
          const solo = v.solo === k;
          return (
            <button
              key={k}
              type="button"
              className="v4-dock-inst"
              data-muted={muted ? '1' : '0'}
              data-solo={solo ? '1' : '0'}
              aria-pressed={inst === k}
              aria-label={`Select ${INST_NAMES[k]}${muted ? ', muted' : ''}${solo ? ', solo' : ''}`}
              onClick={() => selectInstrument(k)}
            >
              {k}
            </button>
          );
        })}
      </div>
      <div className="v4-dock-steps" role="group" aria-label="Steps">
        {STEP_INDEXES.map((i) => {
          // Velocite : 1 fort, 2 moyen, 3 doux ; sans selection, la plus forte des voix
          const vel = inst
            ? velocity(p.steps, inst, i)
            : INSTRUMENTS.reduce((b, k) => {
                const v = velocity(p.steps, k, i);
                return v > 0 && (b === 0 || v < b) ? v : b;
              }, 0);
          const on = vel > 0;
          const label = inst
            ? `Step ${i + 1}, ${INST_NAMES[inst]} ${VEL_NAMES[vel].toLowerCase()}`
            : `Step ${i + 1}, no instrument selected`;
          return (
            <button
              key={i}
              type="button"
              className="v4-dock-step"
              data-on={on ? '1' : '0'}
              data-vel={vel}
              data-head={head === i ? '1' : '0'}
              aria-pressed={inst ? on : false}
              aria-disabled={inst ? undefined : true}
              aria-label={label}
              onPointerDown={(e) => {
                hold.current = { i, t: e.timeStamp };
              }}
              onPointerUp={(e) => {
                const h = hold.current;
                hold.current = null;
                if (h && h.i === i && e.timeStamp - h.t >= STEP_HOLD_MS) {
                  skipClick.current = i;
                  if (!stepClear(i, getStage())) setNudge((n) => n + 1);
                }
              }}
              onPointerCancel={() => {
                hold.current = null;
              }}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => {
                if (skipClick.current === i) {
                  skipClick.current = -1;
                  return;
                }
                onStep(i);
              }}
            >
              {/* Velocite : fort trois traits, moyen deux, doux un */}
              {on && (
                <span className="v4-dock-vel" aria-hidden="true">
                  {Array.from({ length: VEL_BARS[vel] }, (_, b) => (
                    <i key={b} />
                  ))}
                </span>
              )}
              <span className="v4-dock-num">{i + 1}</span>
            </button>
          );
        })}
      </div>
      {/* Transport : nom fixe, l'etat passe par aria-pressed (comme les jumeaux) */}
      <div className="v4-dock-transport" role="group" aria-label="Transport">
        <button type="button" className="v4-dock-key" aria-pressed={running} aria-label="Run" onClick={() => runToggle()}>
          <Icon name={running ? 'fa-solid fa-stop' : 'fa-solid fa-play'} />
          <span>{running ? 'STOP' : 'RUN'}</span>
        </button>
        <button type="button" className="v4-dock-key" aria-label="Clear pattern" onClick={() => clearPattern()}>
          <Icon name="fa-solid fa-eraser" />
          <span>CLEAR</span>
        </button>
        <button
          type="button"
          className="v4-dock-key v4-dock-mute"
          aria-pressed={inst ? v.muted.includes(inst) : v.muted.length > 0}
          aria-label="Mute the selected voice"
          onClick={() => muteToggle()}
        >
          <Icon name="fa-solid fa-volume-xmark" />
          <span>MUTE</span>
        </button>
        <button type="button" className="v4-dock-key" aria-pressed={v.solo !== null} aria-label="Solo the selected voice" onClick={() => soloToggle()}>
          <Icon name="fa-solid fa-headphones" />
          <span>SOLO</span>
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
      {/* Navigation : tous les boutons visibles d'un coup, OPEN / CLOSE a part */}
      <div className="v4-dock-grid" role="group" aria-label="Navigation">
        {cells.map((c) => (
          <button
            key={c.id}
            type="button"
            className="v4-dock-cell"
            data-active={open === c.id ? '1' : '0'}
            aria-label={c.aria}
            aria-expanded={c.id === 'reset' ? undefined : open === c.id}
            aria-controls={c.id === 'reset' ? undefined : `v4-section-${c.id}`}
            data-press-button={c.id === 'press' ? '' : undefined}
            onClick={() => onCell(c)}
          >
            <Icon name={c.icon} />
            <span className="v4-dock-cell-label">{c.label}</span>
          </button>
        ))}
        <button
          type="button"
          className="v4-dock-open"
          data-open={opened ? '1' : '0'}
          aria-pressed={opened}
          aria-label={opened ? 'Close the machine' : 'Open the machine'}
          onClick={() => openToggle(getStage())}
        >
          {opened ? 'CLOSE' : 'OPEN'}
        </button>
      </div>
    </div>
  );
};

export default Dock;
