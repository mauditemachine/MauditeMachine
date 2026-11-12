/**
 * La page MODULATION du panneau d'OPEN du plugin MM-ARP (2026-11-11, Mika : "je veux toutes les fonctions possibles") : la
 * matrice de modulation du VST3 seul (extra.ts section matrix, plugin/mm-arp/extra-params.json : xM1Src, xM1Dst, xM1Amt ...
 * xM6). Six lignes, chacune : sa LED (allumee quand la ligne module : source et destination choisies, quantite non nulle),
 * SOURCE (12 choix), AMOUNT (le potard noir du panneau, zero au centre, -100 a +100 %), DESTINATION (20 choix).
 *
 * XSelect : le selecteur d'un reglage a crans trop nombreux pour un potard lisible. Un afficheur de verre entre deux
 * touches a fleches (le cran d'avant, le cran d'apres, en boucle) ; un clic sur l'afficheur deroule la liste entiere (un
 * menu de verre, en colonnes). Molette et fleches du clavier : un cran ; Debut, Fin ; Echap referme le menu. La valeur
 * part alignee sur son cran (i / (n - 1)) par arpExtra comme les autres reglages (bridge.ts : mm_param, mm_gesture ;
 * mm_knobs le fait bouger sans echo) ; en MIDI LEARN un clic l'arme sans le bouger.
 *
 * ModSources : le rappel des douze sources (ce que chacune mesure) et, pour chacune, les destinations qu'elle module en
 * ce moment. Les valeurs en direct des sources ne remontent pas du C++ : la LED dit seulement que la source est cablee.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { arpBridge } from './bridge';
import { arpExtra, extraParam, extraStepIndex, MATRIX_ROWS, type ExtraParam } from './extra';
import { arpMidi } from './midimap';
import { GRID, openTop } from './scale';
import { Sec, useExtra, XKnob, xTouch } from './SoundPlus';

const useArpMidi = () => useSyncExternalStore(arpMidi.subscribe, arpMidi.get, arpMidi.get);
const useExtraAll = () => useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);

/** La molette : ce deltaY fait un cran. */
const WHEEL_STEP = 40;

interface SelectProps {
  p: ExtraParam;
  /** ce que choisit le selecteur, pour les lecteurs d'ecran : "Matrix 1 source" */
  aria: string;
  /** les colonnes du menu */
  cols: number;
  /** le menu se deroule vers le haut (les lignes du bas du panneau) */
  up?: boolean;
}

export const XSelect: React.FC<SelectProps> = ({ p, aria, cols, up }) => {
  const v = useExtra(p.id);
  const midi = useArpMidi();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const face = useRef<HTMLButtonElement>(null);
  const steps = p.steps ?? [];
  const last = Math.max(1, steps.length - 1);
  const idx = extraStepIndex(p.id, v);
  const cur = useRef(idx);
  cur.current = idx;
  const armed = midi.learning && midi.armed === p.id;

  const pick = (i: number): void => {
    arpExtra.set(p.id, Math.min(last, Math.max(0, i)) / last);
    xTouch.set(p.id, false);
  };
  /** Un clic en MIDI LEARN arme le reglage : il ne bouge pas, le menu ne s'ouvre pas. */
  const learn = (): boolean => {
    if (!arpBridge.learnArm(p.id)) return false;
    setOpen(false);
    return true;
  };

  // Le menu ouvert : un clic ailleurs le referme
  useEffect(() => {
    if (!open) return undefined;
    const away = (e: PointerEvent): void => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', away, true);
    return () => window.removeEventListener('pointerdown', away, true);
  }, [open]);

  // La molette (non passive : rien ne defile) : un cran, sans boucle
  useEffect(() => {
    const el = face.current;
    if (!el) return undefined;
    let acc = 0;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      if (arpMidi.get().learning) return;
      acc += e.deltaY;
      const ticks = Math.trunc(acc / WHEEL_STEP);
      if (ticks === 0) return;
      acc -= ticks * WHEEL_STEP;
      pick(cur.current + ticks);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // pick ne depend que de l'id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    let i = idx;
    if (e.key === 'Escape') {
      // Echap referme le menu ; menu ferme, il reste au panneau (il le referme)
      if (!open) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      face.current?.focus({ preventScroll: true });
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') i += 1;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') i -= 1;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = last;
    else if (e.key === 'Delete' || e.key === 'Backspace') i = extraStepIndex(p.id, arpExtra.def(p.id));
    else return;
    e.preventDefault();
    e.stopPropagation();
    if (!arpMidi.get().learning) pick(i);
  };

  const rows = Math.ceil(steps.length / cols);
  return (
    <div
      ref={box}
      className="mm-arp-sel"
      data-x={p.id}
      data-idx={idx}
      data-off={idx === 0 ? '1' : undefined}
      data-open={open ? '1' : undefined}
      data-mm-learn={armed ? 'armed' : undefined}
      data-learning={midi.learning ? '1' : undefined}
      onKeyDown={onKey}
      onPointerEnter={() => xTouch.set(p.id, false)}
    >
      <button type="button" className="mm-arp-sel-arrow" tabIndex={-1} aria-label={`${aria}: previous`} onClick={() => !learn() && pick(idx <= 0 ? last : idx - 1)}>
        <span className="mm-arp-k" aria-hidden="true">
          <span className="mm-arp-k-glyph">◀</span>
        </span>
      </button>
      <button ref={face} type="button" className="mm-arp-sel-face" aria-haspopup="listbox" aria-expanded={open} aria-label={`${aria}: ${steps[idx]}`} onClick={() => !learn() && setOpen((o) => !o)}>
        {armed && <span className="mm-arp-led" data-on="1" data-blink="1" aria-hidden="true" />}
        <span className="mm-arp-sel-text">{steps[idx]}</span>
        <svg className="mm-arp-sel-caret" viewBox="0 0 8 5" width="8" height="5" aria-hidden="true">
          <path d="M0.6 0.6 4 4.2 7.4 0.6" />
        </svg>
      </button>
      <button type="button" className="mm-arp-sel-arrow" tabIndex={-1} aria-label={`${aria}: next`} onClick={() => !learn() && pick(idx >= last ? 0 : idx + 1)}>
        <span className="mm-arp-k" aria-hidden="true">
          <span className="mm-arp-k-glyph">▶</span>
        </span>
      </button>
      {open && (
        <ul className="mm-arp-sel-menu" role="listbox" aria-label={aria} data-up={up ? '1' : undefined} style={{ gridTemplateRows: `repeat(${rows}, auto)` }}>
          {steps.map((s, i) => (
            <li key={s} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={i === idx}
                tabIndex={-1}
                className="mm-arp-sel-item"
                data-i={i}
                data-on={i === idx ? '1' : undefined}
                data-none={i === 0 ? '1' : undefined}
                onClick={() => {
                  pick(i);
                  setOpen(false);
                  face.current?.focus({ preventScroll: true });
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ---------------- la matrice ---------------- */

const ROWS: readonly number[] = Array.from({ length: MATRIX_ROWS }, (_, i) => i + 1);
const param = (id: string): ExtraParam => extraParam(id) as ExtraParam;

/** Une ligne module-t-elle : source et destination choisies, quantite non nulle. */
const rowOn = (x: Readonly<Record<string, number>>, n: number): boolean => extraStepIndex(`xM${n}Src`, x[`xM${n}Src`]) > 0 && extraStepIndex(`xM${n}Dst`, x[`xM${n}Dst`]) > 0 && x[`xM${n}Amt`] !== 0.5;

const MatrixRow: React.FC<{ n: number }> = ({ n }) => {
  const x = useExtraAll();
  const on = rowOn(x, n);
  // Les trois lignes du bas deroulent leur menu vers le haut : il reste dans le panneau
  const up = n > MATRIX_ROWS / 2;
  return (
    <div className="mm-arp-mx-row" data-row={n} data-on={on ? '1' : undefined} style={{ position: 'absolute', left: 0, top: openTop(n - 1), width: GRID.col * 10, height: GRID.row }} role="group" aria-label={`Modulation ${n}${on ? ', active' : ''}`}>
      <span className="mm-arp-mx-slot">
        <span className="mm-arp-led" data-on={on ? '1' : undefined} aria-hidden="true" />
        <span className="mm-arp-mx-n">{n}</span>
      </span>
      <XSelect p={param(`xM${n}Src`)} aria={`Matrix ${n} source`} cols={2} up={up} />
      <XKnob p={param(`xM${n}Amt`)} label="AMOUNT" aria={`Matrix ${n} amount`} />
      <XSelect p={param(`xM${n}Dst`)} aria={`Matrix ${n} destination`} cols={2} up={up} />
    </div>
  );
};

/** Les six lignes, une par rangee de la grille : le numero (colonne 0), SOURCE (1 a 4), AMOUNT (5), DESTINATION (6 a 9). */
export const Matrix: React.FC = () => (
  <>
    {ROWS.map((n) => (
      <MatrixRow key={n} n={n} />
    ))}
  </>
);

/* ---------------- le rappel des sources ---------------- */

/** Ce que mesure chaque source (dans l'ordre des crans de xM1Src, sans OFF). */
const SOURCE_HELP: Record<string, string> = {
  VELOCITY: 'HOW HARD THE NOTE IS PLAYED',
  'MOD WHEEL': 'MIDI CC 1',
  AFTERTOUCH: 'CHANNEL PRESSURE',
  'PITCH BEND': 'THE BEND WHEEL, BOTH WAYS',
  KEY: 'THE NOTE, LOW TO HIGH',
  'LFO 1': 'THE MOD LFO OF THE FRONT PANEL',
  'LFO 2': 'THE SECOND LFO',
  'FILTER ENV': 'THE FILTER ENVELOPE',
  'AMP ENV': 'THE AMP ENVELOPE',
  'S&H': 'A NEW RANDOM VALUE EACH STEP',
  RANDOM: 'A NEW RANDOM VALUE EACH NOTE',
};

/** Les destinations ecrites sur la ligne d'une source ; au-dela : +N. */
const MAX_CHIPS = 2;

/** Les douze sources et ce que chacune module en ce moment ; CLEAR MATRIX remet les six lignes a zero. */
export const ModSources: React.FC = () => {
  const x = useExtraAll();
  const sources = (param('xM1Src').steps ?? []).slice(1);
  const dests = param('xM1Dst').steps ?? [];
  const routes = ROWS.filter((n) => rowOn(x, n)).map((n) => ({ n, src: extraStepIndex(`xM${n}Src`, x[`xM${n}Src`]), dst: dests[extraStepIndex(`xM${n}Dst`, x[`xM${n}Dst`])], amt: arpExtra.text(`xM${n}Amt`, x[`xM${n}Amt`]) }));
  const used = ROWS.some((n) => x[`xM${n}Src`] !== 0 || x[`xM${n}Dst`] !== 0 || x[`xM${n}Amt`] !== 0.5);
  const clear = (): void => {
    for (const n of ROWS) for (const k of ['Src', 'Dst', 'Amt']) arpExtra.set(`xM${n}${k}`, arpExtra.def(`xM${n}${k}`));
  };
  return (
    <>
      <div className="mm-arp-cells" style={{ position: 'absolute', left: GRID.col * 20, top: openTop(0) }}>
        <button type="button" className="mm-arp-kb mm-arp-mx-clear" data-size="s" disabled={!used} onClick={clear}>
          <span className="mm-arp-k" aria-hidden="true" />
          <span className="mm-arp-legend">CLEAR MATRIX</span>
        </button>
      </div>
      <Sec id="sources" title="SOURCES" className="mm-arp-src" col={11} span={11} row={1} fill side={<span role="status">{routes.length === 0 ? 'NO ROUTE ACTIVE' : `${routes.length} / ${MATRIX_ROWS} ROUTES ACTIVE`}</span>}>
        <ul className="mm-arp-list mm-arp-src-list" aria-label="Modulation sources">
          {sources.map((s, i) => {
            const mine = routes.filter((r) => r.src === i + 1);
            return (
              <li key={s} className="mm-arp-src-row" data-src={s} data-on={mine.length > 0 ? '1' : undefined}>
                <span className="mm-arp-led" data-on={mine.length > 0 ? '1' : undefined} aria-hidden="true" />
                <span className="mm-arp-src-name">{s}</span>
                {mine.length === 0 ? (
                  <span className="mm-arp-src-help">{SOURCE_HELP[s] ?? ''}</span>
                ) : (
                  <span className="mm-arp-src-to">
                    {mine.slice(0, MAX_CHIPS).map((r) => (
                      <span key={r.n} className="mm-arp-src-chip">
                        {r.dst} <b>{r.amt}</b>
                      </span>
                    ))}
                    {mine.length > MAX_CHIPS && <span className="mm-arp-src-chip">+{mine.length - MAX_CHIPS}</span>}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Sec>
    </>
  );
};
