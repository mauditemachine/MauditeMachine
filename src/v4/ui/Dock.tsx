/**
 * Dock (spec 11.4, revision 4 ; compact le 2026-10-01) : sur telephone les
 * 16 pas 3D sont a 7 px l'un de l'autre, on programme donc le sequenceur
 * ici, sous la machine. Trois bandes seulement : les instruments (RANDOM,
 * puis BD SD TOM CH OH, le selectionne en jaune ; toucher choisit sans
 * jouer ; coupe en rose, en solo en bleu), les 16 pas en deux rangees de 8
 * cases, le transport (RUN/STOP, CLEAR, MUTE, SOLO, tempo - / valeur / +).
 * La navigation, OPEN et l'apparence sont dans le menu de l'en-tete
 * (ui/MobileHeader.tsx) : Mika trouvait le Dock trop haut. Un pas touche
 * sans instrument : les instruments clignotent une fois (l'ecran dit TAP A
 * PAD FIRST). Icones Font Awesome 6.5.1 (deja chargee par index.html), en
 * aria-hidden ; chaque bouton garde son nom en toutes lettres. Un appui
 * long (400 ms) vide un pas. Memes stores que la machine : les deux
 * changent ensemble. Monte seulement sur la mise en page mobile
 * (index.tsx), jamais dans le repli.
 *
 * KNOBS (2026-10-04) : une seconde page, tous les potards du MM-RYTM en gros
 * (effets, voix, MASTER et TEMPO, kick et sons du kit : ui/KnobPanel.tsx) ;
 * le choix de page est retenu (mm.v4.dock.page).
 *
 * Le LOCK (2026-10-08, l'etape R2 des parameter locks) : l'appui long sur un
 * pas le met en LOCK (il le vidait avant ; une tape passe toujours par vide,
 * l'etude l'a garde par defaut) ; un pas qui a des verrous porte un point,
 * le pas en LOCK clignote ; la page KNOBS regle ses verrous.
 *
 * Repliable (2026-10-01, demande de Mika) : replie par defaut, la machine a
 * tout l'ecran ; une languette a fleche au bord du bas le deplie (et le
 * replie, posee alors sur son bord haut). Le choix est retenu
 * (localStorage mm.v4.dock). Replie, il sort du clavier et des lecteurs
 * d'ecran (inert).
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { clearPattern, randomPattern, muteToggle, runToggle, rytmLockToggle, selectInstrument, setTempo, soloToggle, stepToggle } from '../actions';
import { lockMask } from '../audio/locks';
import { rytmLock } from '../state/rytmLock';
import { clock } from '../audio/clock';
import { BPM, INSTRUMENTS, STEP_COUNT, VEL_BARS, VEL_NAMES, pattern, velocity } from '../audio/pattern';
import type { Stage } from '../scene/renderer';
import { playhead } from '../state/playhead';
import { voices } from '../state/voices';
import { INST_NAMES, STEP_HOLD_MS } from '../theme';
import { DockPages, KnobPanel, useDockInset, useDockPage } from './KnobPanel';

const STEP_INDEXES = Array.from({ length: STEP_COUNT }, (_, i) => i);

const DOCK_KEY = 'mm.v4.dock';
/** La page du Dock (2026-10-04) : le sequenceur, ou les potards en gros (ui/KnobPanel.tsx). */
const PAGE_KEY = 'mm.v4.dock.page';

/** Deplie a la derniere visite ? (replie par defaut ; sans stockage, replie) */
function readDockOpen(): boolean {
  try {
    return window.localStorage.getItem(DOCK_KEY) === 'open';
  } catch {
    return false;
  }
}

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
  const v = useSyncExternalStore(voices.subscribe, voices.get, voices.get);
  // Le pas en LOCK (2026-10-08)
  const lockAt = useSyncExternalStore(rytmLock.subscribe, () => rytmLock.get().step, () => -1);
  // Un pas touche sans instrument : les instruments clignotent une fois
  const [nudge, setNudge] = useState(0);
  const [shown, setShown] = useState(readDockOpen);
  const [page, setPage] = useDockPage(PAGE_KEY);
  const dockRef = useRef<HTMLDivElement>(null);
  useDockInset(getStage(), 'mm808', shown && page === 'knobs', dockRef);
  // Replie : hors du clavier et des lecteurs d'ecran (inert n'est pas encore type par React 18)
  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    if (shown) el.removeAttribute('inert');
    else el.setAttribute('inert', '');
    try {
      window.localStorage.setItem(DOCK_KEY, shown ? 'open' : 'closed');
    } catch {
      /* stockage indisponible : le choix vaut pour la visite */
    }
  }, [shown]);
  // Appui long sur un pas : le pas et l'instant du pointerdown ; le clic qui suit est ignore
  const hold = useRef<{ i: number; t: number } | null>(null);
  const skipClick = useRef(-1);
  const inst = p.instrument;
  const bpm = p.bpm;
  const locks = lockMask(p.locks, inst);

  const onStep = (i: number): void => {
    if (!stepToggle(i, getStage())) setNudge((n) => n + 1);
  };

  return (
    <>
      <button
        type="button"
        className="v4-dock-tab"
        data-open={shown ? '1' : '0'}
        data-page={page}
        aria-expanded={shown}
        aria-controls="v4-dock"
        aria-label={shown ? 'Hide the sequencer' : 'Show the sequencer'}
        onClick={() => setShown((o) => !o)}
      >
        <Icon name={shown ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up'} />
      </button>
      <div ref={dockRef} id="v4-dock" className="v4-dock" data-open={shown ? '1' : '0'} data-mode={inst ? 'edit' : 'union'} data-page={page}>
        <DockPages page={page} onPage={setPage} first="SEQUENCER" />
        {page === 'knobs' ? (
          <KnobPanel machine="mm808" />
        ) : (
          <>
        <div key={nudge} className="v4-dock-insts" data-nudge={nudge > 0 ? '1' : '0'} role="group" aria-label="Instrument, tap one, then the steps">
          {/* RANDOM a gauche des voix, comme sur la machine */}
          <button type="button" className="v4-dock-inst v4-dock-random" aria-label="Random house pattern" onClick={() => randomPattern(getStage())}>
            <Icon name="fa-solid fa-dice" />
          </button>
          {INSTRUMENTS.map((k) => {
            const muted = v.muted.includes(k);
            const solo = v.solo.includes(k);
            return (
              <button
                key={k}
                type="button"
                className="v4-dock-inst"
                data-muted={muted ? '1' : '0'}
                data-solo={solo ? '1' : '0'}
                aria-pressed={v.soloMode ? solo : v.muteMode ? muted : inst === k}
                aria-label={v.soloMode ? `Solo ${INST_NAMES[k]}` : v.muteMode ? `Mute ${INST_NAMES[k]}` : `Select ${INST_NAMES[k]}${muted ? ', muted' : ''}${solo ? ', solo' : ''}`}
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
              ? `Step ${i + 1}, ${INST_NAMES[inst]} ${VEL_NAMES[vel].toLowerCase()}${(locks >> i) & 1 ? ', locked' : ''}${lockAt === i ? ', in lock mode' : ''}. Hold: lock mode`
              : `Step ${i + 1}, no instrument selected`;
            return (
              <button
                key={i}
                type="button"
                className="v4-dock-step"
                data-on={on ? '1' : '0'}
                data-vel={vel}
                data-head={head === i ? '1' : '0'}
                data-locks={(locks >> i) & 1 ? '1' : undefined}
                data-lockstep={lockAt === i ? '1' : undefined}
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
                    // L'appui long (2026-10-08) : le LOCK sur ce pas (encore : hors LOCK), la page KNOBS regle ses verrous
                    if (!inst) setNudge((n) => n + 1);
                    else rytmLockToggle(i);
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
          <button type="button" className="v4-dock-key" aria-pressed={running} aria-label="Run" onClick={() => runToggle(getStage())}>
            <Icon name={running ? 'fa-solid fa-stop' : 'fa-solid fa-play'} />
            <span>{running ? 'STOP' : 'RUN'}</span>
          </button>
          <button type="button" className="v4-dock-key" aria-label="Clear pattern" onClick={() => clearPattern(getStage())}>
            <Icon name="fa-solid fa-eraser" />
            <span>CLEAR</span>
          </button>
          <button
            type="button"
            className="v4-dock-key v4-dock-mute"
            aria-pressed={voices.lit('mute')}
            aria-label="Mute, then tap a voice to mute it; twice: mute several voices; again: all voices back"
            onClick={() => muteToggle(getStage())}
          >
            <Icon name="fa-solid fa-volume-xmark" />
            <span>MUTE</span>
          </button>
          <button type="button" className="v4-dock-key" aria-pressed={voices.lit('solo')} aria-label="Solo, then tap a voice to solo it; twice: solo several voices; again: all voices back" onClick={() => soloToggle(getStage())}>
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
          </>
        )}
      </div>
    </>
  );
};

export default Dock;
