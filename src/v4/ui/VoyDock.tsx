/**
 * Le Dock du MM-VOYAGER (telephone, 2026-10-03, Mika : "que les boutons
 * soient faciles d'acces") : comme celui de la 808, sous la machine,
 * repliable (sa languette, le choix retenu sous mm.v4.vdock, replie par
 * defaut). Trois bandes de gros boutons :
 * - les huit accords (deux rangees de quatre) : touche = dans la
 *   progression (orange), l'accord qui joue en jaune ;
 * - CLEAR, RANDOM, OCTAVE - / valeur / + ;
 * - RUN/STOP (l'arpege, cale sur la 808), RATE, MODE, RANGE, NOTES : un
 *   appui passe au cran suivant ;
 * - WAVE 1 et WAVE 2 (2026-10-03) : la forme de chaque oscillateur, dessinee
 *   comme sur la machine ; un appui passe a la suivante. FM a cote (la
 *   quantite de modulation, OFF 25 50 75 100 %) et RATIO (le rapport de
 *   l'operateur, 1/2 a 7).
 * - deux pages (2026-10-04) : CONTROLS (tout ce qui precede) et SEQUENCE,
 *   la suite de l'arpege a dessiner au doigt (ui/SeqLane.tsx) ; la page
 *   choisie est retenue (mm.v4.vdock.page). La languette suit la hauteur
 *   du Dock, mesuree.
 * Memes actions et memes stores que la machine : les deux bougent ensemble.
 * Monte seulement sur telephone, quand on utilise le Voyager (index.tsx).
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { voyClear, voyDial, voyPad, voyRandom, voyRun } from '../actions';
import type { Stage } from '../scene/renderer';
import { arp } from '../voyager/arp';
import { CHORDS } from '../voyager/chords';
import { wavePoints } from '../voyager/glyphs';
import { SeqLane } from './SeqLane';
import { MODES, NOTES, OCTAVES, RANGES, RATES, RATIOS, WAVES1, WAVES2, morphText, stepIndex, voyParams, type VoyKnobId } from '../voyager/params';

const DOCK_KEY = 'mm.v4.vdock';
const PAGE_KEY = 'mm.v4.vdock.page';
type DockPage = 'controls' | 'seq';

function readPage(): DockPage {
  try {
    return window.localStorage.getItem(PAGE_KEY) === 'seq' ? 'seq' : 'controls';
  } catch {
    return 'controls';
  }
}

function readOpen(): boolean {
  try {
    return window.localStorage.getItem(DOCK_KEY) === 'open';
  } catch {
    return false;
  }
}

const Icon: React.FC<{ name: string }> = ({ name }) => <i className={`${name} v4-fa`} aria-hidden="true" />;

/** Le dessin d'une forme d'onde (celui de la machine), ou FM ecrit. */
const WaveGlyph: React.FC<{ name: string }> = ({ name }) => {
  const pts = wavePoints(name);
  if (!pts) return <span className="v4-vdock-fm" aria-hidden="true">FM</span>;
  const d = pts.map(([u, v], i) => `${i === 0 ? 'M' : 'L'}${(u * 13 + 14).toFixed(2)} ${(v * 6 + 8).toFixed(2)}`).join(' ');
  return (
    <svg className="v4-vdock-wave" viewBox="0 0 28 16" width="28" height="16" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/** Le cran suivant d'un potard a crans (on reboucle). */
function cycle(id: VoyKnobId, n: number): void {
  const i = (stepIndex(id, voyParams.of(id)) + 1) % n;
  voyDial(id, i / (n - 1));
}

/** FM au Dock : cinq crans (0, 25, 50, 75, 100 %), un appui passe au suivant. */
const FM_STEPS = 4;
const fmStep = (v: number): number => Math.round(v * FM_STEPS);

export const VoyDock: React.FC<{ getStage: () => Stage | null }> = ({ getStage }) => {
  const a = useSyncExternalStore(arp.subscribe, arp.get, arp.get);
  const p = useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
  const [shown, setShown] = useState(readOpen);
  const ref = useRef<HTMLDivElement>(null);
  const [pg, setPg] = useState<DockPage>(readPage);
  // La hauteur du Dock (ses deux pages n'ont pas la meme) : la languette se pose sur son bord
  const [dockH, setDockH] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const apply = (): void => setDockH(el.offsetHeight);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const choose = (next: DockPage): void => {
    setPg(next);
    try {
      window.localStorage.setItem(PAGE_KEY, next);
    } catch {
      /* stockage indisponible */
    }
  };
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
  // Le dessin et le nom : la forme la plus proche ; le nom lu : le morphing en cours
  const w1 = WAVES1[stepIndex('wave1', p.wave1)];
  const w2 = WAVES2[stepIndex('wave2', p.wave2)];
  const w1Text = morphText('wave1', p.wave1);
  const w2Text = morphText('wave2', p.wave2);
  const fm = fmStep(p.fm);
  const fmText = fm === 0 ? 'OFF' : `${fm * 25}%`;
  const ratio = RATIOS[stepIndex('ratio', p.ratio)];

  return (
    <>
      <button
        type="button"
        className="v4-dock-tab"
        data-open={shown ? '1' : '0'}
        aria-expanded={shown}
        aria-controls="v4-vdock"
        aria-label={shown ? 'Hide the synth controls' : 'Show the synth controls'}
        style={dockH > 0 ? ({ '--vdock-h-mobile': `${dockH}px` } as React.CSSProperties) : undefined}
        onClick={() => setShown((o) => !o)}
      >
        <Icon name={shown ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up'} />
      </button>
      <div ref={ref} id="v4-vdock" className="v4-dock v4-vdock" data-open={shown ? '1' : '0'} data-page={pg}>
        <div className="v4-vdock-pages" role="group" aria-label="Dock page">
          <button type="button" className="v4-vdock-page" aria-pressed={pg === 'controls'} onClick={() => choose('controls')}>
            CONTROLS
          </button>
          <button type="button" className="v4-vdock-page" aria-pressed={pg === 'seq'} onClick={() => choose('seq')}>
            SEQUENCE
          </button>
        </div>
        {pg === 'seq' && <SeqLane variant="dock" />}
        {pg === 'controls' && (
          <>
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
            <div className="v4-vdock-row v4-vdock-waves" role="group" aria-label="Oscillator waves">
              <button type="button" className="v4-dock-key" aria-label={`Wave 1 ${w1Text.toLowerCase()}, tap for the next shape`} onClick={() => cycle('wave1', WAVES1.length)}>
                <span>WAVE 1</span>
                <span className="v4-vdock-wv">
                  <WaveGlyph name={w1} />
                  <span className="v4-vdock-val">{w1}</span>
                </span>
              </button>
              <button type="button" className="v4-dock-key" aria-label={`Wave 2 ${w2Text.toLowerCase()}, tap for the next shape`} onClick={() => cycle('wave2', WAVES2.length)}>
                <span>WAVE 2</span>
                <span className="v4-vdock-wv">
                  <WaveGlyph name={w2} />
                  <span className="v4-vdock-val">{w2}</span>
                </span>
              </button>
              <button
                type="button"
                className="v4-dock-key v4-vdock-fmkey"
                aria-label={`FM amount ${fm === 0 ? 'off' : fmText}, tap for more`}
                onClick={() => voyDial('fm', ((fmStep(voyParams.of('fm')) + 1) % (FM_STEPS + 1)) / FM_STEPS)}
              >
                <span>FM</span>
                <span className="v4-vdock-val">{fmText}</span>
              </button>
              <button type="button" className="v4-dock-key" aria-label={`FM ratio ${ratio}, tap for the next`} onClick={() => cycle('ratio', RATIOS.length)}>
                <span>RATIO</span>
                <span className="v4-vdock-val">{ratio}</span>
              </button>
            </div>
            <div className="v4-vdock-row v4-vdock-arp" role="group" aria-label="Arpeggiator">
              <button
                type="button"
                className="v4-dock-key v4-vdock-run"
                aria-pressed={a.running}
                aria-label={a.running ? 'Stop the arpeggiator' : 'Run the arpeggiator'}
                onClick={() => voyRun(getStage())}
              >
                <Icon name={a.running ? 'fa-solid fa-stop' : 'fa-solid fa-play'} />
                <span>{a.running ? 'STOP' : 'RUN'}</span>
              </button>
              <button type="button" className="v4-dock-key" aria-label={`Rate ${RATES[stepIndex('rate', p.rate)]}, tap for the next`} onClick={() => cycle('rate', RATES.length)}>
                <span>RATE</span>
                <span className="v4-vdock-val">{RATES[stepIndex('rate', p.rate)]}</span>
              </button>
              <button type="button" className="v4-dock-key" aria-label={`Mode ${MODES[stepIndex('mode', p.mode)]}, tap for the next`} onClick={() => cycle('mode', MODES.length)}>
                <span>MODE</span>
                <span className="v4-vdock-val">{MODES[stepIndex('mode', p.mode)]}</span>
              </button>
              <button
                type="button"
                className="v4-dock-key"
                aria-label={`Range ${RANGES[stepIndex('range', p.range)]}, tap for the next`}
                onClick={() => cycle('range', RANGES.length)}
              >
                <span>RANGE</span>
                <span className="v4-vdock-val">{RANGES[stepIndex('range', p.range)]}</span>
              </button>
              <button
                type="button"
                className="v4-dock-key"
                aria-label={`Notes ${NOTES[stepIndex('notes', p.notes)]}, tap for the next`}
                onClick={() => cycle('notes', NOTES.length)}
              >
                <span>NOTES</span>
                <span className="v4-vdock-val">{NOTES[stepIndex('notes', p.notes)]}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default VoyDock;
