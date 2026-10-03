/**
 * Le Dock du MM-VOYAGER (telephone, 2026-10-03, Mika : "que les boutons
 * soient faciles d'acces") : comme celui de la 808, sous la machine,
 * repliable (sa languette, le choix retenu sous mm.v4.vdock, replie par
 * defaut). Trois bandes de gros boutons :
 * - les huit accords (deux rangees de quatre) : touche = dans la
 *   progression (orange), l'accord qui joue en jaune ;
 * - CLEAR, RANDOM, OCTAVE - / valeur / + ;
 * - RATE, MODE, RANGE : un appui passe au cran suivant.
 * Memes actions et memes stores que la machine : les deux bougent ensemble.
 * Monte seulement sur telephone, quand on utilise le Voyager (index.tsx).
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { voyClear, voyDial, voyPad, voyRandom } from '../actions';
import type { Stage } from '../scene/renderer';
import { arp } from '../voyager/arp';
import { CHORDS } from '../voyager/chords';
import { MODES, OCTAVES, RANGES, RATES, stepIndex, voyParams, type VoyKnobId } from '../voyager/params';

const DOCK_KEY = 'mm.v4.vdock';

function readOpen(): boolean {
  try {
    return window.localStorage.getItem(DOCK_KEY) === 'open';
  } catch {
    return false;
  }
}

const Icon: React.FC<{ name: string }> = ({ name }) => <i className={`${name} v4-fa`} aria-hidden="true" />;

/** Le cran suivant d'un potard a crans (on reboucle). */
function cycle(id: VoyKnobId, n: number): void {
  const i = (stepIndex(id, voyParams.of(id)) + 1) % n;
  voyDial(id, i / (n - 1));
}

export const VoyDock: React.FC<{ getStage: () => Stage | null }> = ({ getStage }) => {
  const a = useSyncExternalStore(arp.subscribe, arp.get, arp.get);
  const p = useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
  const [shown, setShown] = useState(readOpen);
  const ref = useRef<HTMLDivElement>(null);
  // L'accord qui joue : lu sur la machine (l'ecran le montre aussi)
  const [playing, setPlaying] = useState(-1);
  useEffect(() => {
    const t = window.setInterval(() => {
      const s = getStage();
      const v = s?.voy?.keys.info().playing ?? -1;
      setPlaying((old) => (old === v ? old : v));
    }, 120);
    return () => window.clearInterval(t);
  }, [getStage]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (shown) el.removeAttribute('inert');
    else el.setAttribute('inert', '');
    try {
      window.localStorage.setItem(DOCK_KEY, shown ? 'open' : 'closed');
    } catch {
      /* stockage indisponible */
    }
  }, [shown]);
  const oct = stepIndex('octave', p.octave);

  return (
    <>
      <button
        type="button"
        className="v4-dock-tab"
        data-open={shown ? '1' : '0'}
        aria-expanded={shown}
        aria-controls="v4-vdock"
        aria-label={shown ? 'Hide the synth controls' : 'Show the synth controls'}
        onClick={() => setShown((o) => !o)}
      >
        <Icon name={shown ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up'} />
      </button>
      <div ref={ref} id="v4-vdock" className="v4-dock v4-vdock" data-open={shown ? '1' : '0'}>
        <div className="v4-vdock-chords" role="group" aria-label="Chords, tap to add or remove">
          {CHORDS.map((c, i) => (
            <button
              key={c.label}
              type="button"
              className="v4-vdock-chord"
              aria-pressed={a.prog.includes(i)}
              data-playing={playing === i ? '1' : '0'}
              aria-label={`${c.aria} chord`}
              onClick={() => voyPad(i, getStage())}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="v4-vdock-row" role="group" aria-label="Chords and octave">
          <button type="button" className="v4-dock-key" aria-label="Clear the chords" onClick={() => voyClear(getStage())}>
            <Icon name="fa-solid fa-eraser" />
            <span>CLEAR</span>
          </button>
          <button type="button" className="v4-dock-key" aria-label="Random chord progression" onClick={() => voyRandom(getStage())}>
            <Icon name="fa-solid fa-dice" />
            <span>RANDOM</span>
          </button>
          <button type="button" className="v4-dock-key v4-dock-nudge" aria-label="Octave down" disabled={oct <= 0} onClick={() => voyDial('octave', (oct - 1) / 4)}>
            <span>OCT -</span>
          </button>
          <span className="v4-dock-bpm" aria-live="polite">
            {OCTAVES[oct]}
            <span className="v4-dock-bpm-unit"> OCT</span>
          </span>
          <button type="button" className="v4-dock-key v4-dock-nudge" aria-label="Octave up" disabled={oct >= 4} onClick={() => voyDial('octave', (oct + 1) / 4)}>
            <span>OCT +</span>
          </button>
        </div>
        <div className="v4-vdock-row v4-vdock-arp" role="group" aria-label="Arpeggiator">
          <button type="button" className="v4-dock-key" aria-label={`Rate ${RATES[stepIndex('rate', p.rate)]}, tap for the next`} onClick={() => cycle('rate', RATES.length)}>
            <span>RATE</span>
            <span className="v4-vdock-val">{RATES[stepIndex('rate', p.rate)]}</span>
          </button>
          <button type="button" className="v4-dock-key" aria-label={`Mode ${MODES[stepIndex('mode', p.mode)]}, tap for the next`} onClick={() => cycle('mode', MODES.length)}>
            <span>MODE</span>
            <span className="v4-vdock-val">{MODES[stepIndex('mode', p.mode)]}</span>
          </button>
          <button type="button" className="v4-dock-key" aria-label={`Range ${RANGES[stepIndex('range', p.range)]}, tap for the next`} onClick={() => cycle('range', RANGES.length)}>
            <span>RANGE</span>
            <span className="v4-vdock-val">{RANGES[stepIndex('range', p.range)]}</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default VoyDock;
