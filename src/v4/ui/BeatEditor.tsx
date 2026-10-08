/**
 * L'editeur du motif du MM-RYTM (2026-10-04, Mika : "la meme chose pour
 * RYTM, avec des editions de pattern rythmique, avec velocite"). Cache tant
 * que le pad EDIT de la machine ne l'a pas ouvert (ui/editorPanel.ts).
 * - La grille : les dix voix sur seize pas. Taper une case pose un coup
 *   (fort) ou l'enleve ; glisser le long d'une rangee pose ou enleve tous
 *   les pas traverses. La case montre sa velocite (plus pleine, plus
 *   forte). Taper le nom d'une voix la choisit (sur la machine aussi).
 *   Tenir une case (2026-10-07, Mika : "en EDIT, j'aimais bien le principe
 *   de changer la velocite en maintenant le clic de la souris appuye",
 *   comme sur les pas de la machine) : glisser vers le haut ou le bas
 *   change sa velocite (12 px par niveau a la souris, 16 au doigt), son
 *   niveau s'ecrit dans la case ; une case vide se remplit.
 * - VELOCITY : la voix choisie, une barre par coup, neuf niveaux ;
 *   glisser dessus les dessine (les pas traverses suivent la ligne, les pas
 *   vides restent vides).
 * - CLEAR vide la voix choisie ; DONE, EDIT, E ou Echap referment.
 * Au clavier : chaque case est un bouton (Entree pose ou enleve, fleches
 * pour se deplacer), chaque barre un curseur (haut et bas).
 * La tete de lecture suit le sequenceur (state/playhead.ts).
 * 2026-10-05 (Mika : "le contenu de EDIT doit s'ouvrir a l'interieur de la
 * machine, pas en dessous") : les seize patterns en tete (taper : le
 * pattern, d'autres dans les deux secondes : la chaine ; tenir un vide : y
 * copier le courant). Puis (Mika : "avant, EDIT affichait un ecran ou je
 * pouvais ecrire les notes, je ne le vois plus ; je le voulais a la place
 * des steps du bas, je pouvais voir les velocites, le faire a la souris ;
 * garde aussi l'enchainement et le changement de pattern la-dedans") : au
 * desktop, l'editeur revient, pose sur la machine a la place de sa rangee
 * de pas (il la couvre et la suit a chaque image) ; ses seize colonnes
 * tombent sur les seize pas, les patterns sur une rangee au-dessus, les
 * rangees a la hauteur qui tient jusqu'au bas de la fenetre. Le cadrage ne
 * bouge pas. Au telephone, le panneau sous la machine reste.
 * Les verrous (2026-10-08, l'etape R2 des parameter locks) : une case dont le
 * pas a des verrous porte un petit point dans son coin (pale si le pas est
 * vide : ses verrous attendent un coup).
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { gesture, patternHold, patternTap } from '../actions';
import { INSTRUMENTS, STEP_COUNT, VEL_MAX, VEL_NAMES, pattern, velocity } from '../audio/pattern';
import { lockCount } from '../audio/locks';
import type { Stage } from '../scene/renderer';
import { editor } from '../state/editor';
import { PATTERN_SLOTS, patterns, slotName } from '../state/patterns';
import { playhead } from '../state/playhead';
import type { Inst } from '../theme';
import { useEditorPanel } from './editorPanel';

/** Tenir un emplacement vide (ms) : il recoit une copie du pattern courant. */
const HOLD_MS = 500;

/** Les seize patterns (le telephone) : le courant en jaune, la chaine et les pleins en orange. */
const PatternStrip: React.FC = () => {
  const p = useSyncExternalStore(patterns.subscribe, patterns.get, patterns.get);
  const hold = useRef<{ i: number; t: number; fired: boolean } | null>(null);
  return (
    <div className="v4-beat-ptns" role="group" aria-label="Patterns A01 to A16">
      {Array.from({ length: PATTERN_SLOTS }, (_, i) => {
        const inChain = p.chain.length > 1 ? p.chain.indexOf(i) : -1;
        return (
          <button
            key={i}
            type="button"
            className="v4-beat-ptn"
            data-cur={i === p.cur ? '1' : '0'}
            data-next={i === p.next ? '1' : '0'}
            data-chain={inChain >= 0 ? '1' : '0'}
            data-full={patterns.filled(i) ? '1' : '0'}
            aria-pressed={i === p.cur}
            aria-label={`Pattern ${slotName(i)}${patterns.filled(i) ? '' : ', empty'}${inChain >= 0 ? `, chain position ${inChain + 1}` : ''}`}
            onPointerDown={() => {
              const t = window.setTimeout(() => {
                if (hold.current?.i === i) {
                  hold.current.fired = true;
                  patternHold(i);
                }
              }, HOLD_MS);
              hold.current = { i, t, fired: false };
            }}
            onPointerUp={() => {
              const h = hold.current;
              hold.current = null;
              if (!h || h.i !== i) return;
              window.clearTimeout(h.t);
              if (!h.fired) patternTap(i);
            }}
            onPointerCancel={() => {
              if (hold.current) window.clearTimeout(hold.current.t);
              hold.current = null;
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              patternTap(i);
            }}
          >
            {slotName(i).slice(1)}
          </button>
        );
      })}
    </div>
  );
};

/** Un coup pose a la main : fort (le niveau d'un appui sur la machine). */
const PEN = VEL_MAX;
/** Tenir une case autant : sa velocite se regle en glissant (comme STEP_HOLD_MS sur la machine). */
const VEL_HOLD_MS = 350;
/** Les pixels par niveau de velocite, et le glisser vertical qui y entre sans attendre. */
const VEL_PX = { mouse: 12, touch: 16 } as const;
const VEL_DRAG_PX = 6;

/** Un geste dans la grille : il attend (tape), peint une rangee, ou regle une velocite. */
interface Grip {
  id: number;
  inst: Inst;
  r: number;
  c: number;
  x0: number;
  y0: number;
  /** la velocite de la case au depart (0 : vide, un coup vient d'y etre pose) */
  had: number;
  /** la velocite de depart du reglage */
  v0: number;
  px: number;
  mode: 'wait' | 'row' | 'vel';
  /** la rangee : la valeur peinte, la derniere colonne */
  v: number;
  last: number;
  timer: number;
}

const STEPS = Array.from({ length: STEP_COUNT }, (_, i) => i);

interface Props {
  variant: 'desk' | 'mobile';
}

export const BeatEditor: React.FC<Props> = ({ variant }) => {
  const p = useSyncExternalStore(pattern.subscribe, pattern.get, pattern.get);
  const head = useSyncExternalStore(playhead.subscribe, playhead.get, playhead.get);
  const [row, setRow] = useState<Inst>(p.instrument ?? 'BD');
  const [cell, setCell] = useState({ r: 0, c: 0 });
  const grid = useRef<HTMLDivElement>(null);
  const lane = useRef<HTMLDivElement>(null);
  /** geste en cours dans la grille (Grip) ou dans VELOCITY */
  const paint = useRef<Grip | null>(null);
  const draw = useRef<{ id: number; i: number; v: number } | null>(null);
  /** la case dont on regle la velocite (son niveau s'y ecrit) */
  const [velCell, setVelCell] = useState<{ r: number; c: number } | null>(null);

  // Le panneau se ferme ou se demonte : plus de minuteur
  useEffect(
    () => () => {
      if (paint.current) window.clearTimeout(paint.current.timer);
    },
    []
  );

  // Un pad frappe sur la machine choisit sa voix ici aussi
  useEffect(() => {
    if (p.instrument) setRow(p.instrument);
  }, [p.instrument]);

  const choose = (inst: Inst): void => {
    setRow(inst);
    pattern.select(inst);
  };

  /** La case sous le pointeur : rangee et pas ; null hors de la grille. */
  const cellAt = (x: number, y: number): { r: number; c: number } | null => {
    const el = grid.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
    const r = Math.min(INSTRUMENTS.length - 1, Math.floor(((y - rect.top) / rect.height) * INSTRUMENTS.length));
    const c = Math.min(STEP_COUNT - 1, Math.floor(((x - rect.left) / rect.width) * STEP_COUNT));
    return { r, c };
  };

  const onGridDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    const at = cellAt(e.clientX, e.clientY);
    if (!at) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointeur deja relache */
    }
    gesture();
    const inst = INSTRUMENTS[at.r];
    const had = velocity(pattern.get().steps, inst, at.c);
    // Une case vide se remplit tout de suite ; une pleine attend : la tape l'enleve, l'appui tenu regle sa velocite
    if (had === 0) pattern.set(inst, at.c, PEN);
    if (paint.current) window.clearTimeout(paint.current.timer);
    const g: Grip = { id: e.pointerId, inst, r: at.r, c: at.c, x0: e.clientX, y0: e.clientY, had, v0: had || PEN, px: e.pointerType === 'mouse' ? VEL_PX.mouse : VEL_PX.touch, mode: 'wait', v: had > 0 ? 0 : PEN, last: at.c, timer: 0 };
    g.timer = window.setTimeout(() => {
      if (paint.current === g && g.mode === 'wait') startVel(g);
    }, VEL_HOLD_MS);
    paint.current = g;
    setCell(at);
    if (inst !== row) choose(inst);
  };

  /** L'appui tenu (ou un glisser vertical sur place) : la case regle sa velocite. */
  const startVel = (g: Grip): void => {
    g.mode = 'vel';
    if (velocity(pattern.get().steps, g.inst, g.c) === 0) pattern.set(g.inst, g.c, g.v0);
    setVelCell({ r: g.r, c: g.c });
  };

  const onGridMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const g = paint.current;
    if (!g || g.id !== e.pointerId) return;
    const el = grid.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const c = Math.max(0, Math.min(STEP_COUNT - 1, Math.floor(((e.clientX - rect.left) / rect.width) * STEP_COUNT)));
    const dy = e.clientY - g.y0;
    if (g.mode === 'wait') {
      if (c !== g.c) {
        // Le long de la rangee : on peint (une case pleine au depart : on efface)
        window.clearTimeout(g.timer);
        g.mode = 'row';
        if (g.had > 0) pattern.set(g.inst, g.c, 0);
      } else if (Math.abs(dy) >= VEL_DRAG_PX) {
        window.clearTimeout(g.timer);
        startVel(g);
      } else return;
    }
    if (g.mode === 'vel') {
      const v = Math.max(1, Math.min(VEL_MAX, g.v0 + Math.round(-dy / g.px)));
      if (velocity(pattern.get().steps, g.inst, g.c) !== v) pattern.set(g.inst, g.c, v);
      return;
    }
    // La rangee du depart : on peint le long d'elle
    if (c === g.last) return;
    const dir = c > g.last ? 1 : -1;
    for (let j = g.last + dir; j !== c + dir; j += dir) pattern.set(g.inst, j, g.v);
    g.last = c;
  };

  /** Le geste finit : une tape sur une case pleine l'enleve. */
  const onGridUp = (e: React.PointerEvent<HTMLDivElement>, cancel: boolean): void => {
    const g = paint.current;
    if (!g || g.id !== e.pointerId) return;
    window.clearTimeout(g.timer);
    paint.current = null;
    if (!cancel && g.mode === 'wait' && g.had > 0) pattern.set(g.inst, g.c, 0);
    setVelCell(null);
  };

  const levelAt = (y: number): number => {
    const el = lane.current;
    if (!el) return PEN;
    const rect = el.getBoundingClientRect();
    return Math.max(1, Math.min(VEL_MAX, Math.ceil(((rect.bottom - y) / rect.height) * VEL_MAX)));
  };

  /** VELOCITY : le niveau des coups traverses (en ligne droite depuis le dernier point). */
  const onLaneMove = (x: number, y: number): void => {
    const el = lane.current;
    const d = draw.current;
    if (!el || !d) return;
    const rect = el.getBoundingClientRect();
    const i = Math.max(0, Math.min(STEP_COUNT - 1, Math.floor(((x - rect.left) / rect.width) * STEP_COUNT)));
    const v = levelAt(y);
    const steps = pattern.get().steps;
    const put = (j: number, lv: number): void => {
      if (velocity(steps, row, j) > 0) pattern.set(row, j, lv);
    };
    if (d.i >= 0 && Math.abs(i - d.i) > 1) {
      const dir = i > d.i ? 1 : -1;
      for (let j = d.i + dir; j !== i; j += dir) put(j, Math.round(d.v + ((v - d.v) * (j - d.i)) / (i - d.i)));
    }
    put(i, v);
    draw.current = { id: d.id, i, v };
  };

  const onCellKey = (e: React.KeyboardEvent, r: number, c: number): void => {
    let nr = r;
    let nc = c;
    if (e.key === 'ArrowLeft') nc = Math.max(0, c - 1);
    else if (e.key === 'ArrowRight') nc = Math.min(STEP_COUNT - 1, c + 1);
    else if (e.key === 'ArrowUp') nr = Math.max(0, r - 1);
    else if (e.key === 'ArrowDown') nr = Math.min(INSTRUMENTS.length - 1, r + 1);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      gesture();
      const inst = INSTRUMENTS[r];
      pattern.set(inst, c, velocity(pattern.get().steps, inst, c) > 0 ? 0 : PEN);
      choose(inst);
      return;
    } else return;
    e.preventDefault();
    setCell({ r: nr, c: nc });
    grid.current?.querySelectorAll<HTMLElement>('.v4-beat-cell')[nr * STEP_COUNT + nc]?.focus();
  };

  const onBarKey = (e: React.KeyboardEvent, i: number): void => {
    const v = velocity(pattern.get().steps, row, i);
    if (v === 0) return;
    let next = v;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = Math.min(VEL_MAX, v + 1);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = Math.max(1, v - 1);
    else if (e.key === 'Home') next = 1;
    else if (e.key === 'End') next = VEL_MAX;
    else return;
    e.preventDefault();
    pattern.set(row, i, next);
  };

  const live = (c: number): boolean => head === c;

  return (
    <div className="v4-seq-body v4-beat-body" data-variant={variant} data-edit="1">
      {variant === 'mobile' && <PatternStrip />}
      {variant === 'desk' && (
        <div className="v4-beat-main v4-beat-ptnrow">
          <span className="v4-beat-lanelabel">PTN</span>
          <PatternStrip />
        </div>
      )}
      <div className="v4-seq-head">
        <span className="v4-seq-title">PATTERN</span>
        <span className="v4-seq-chord" aria-live="polite">
          {row}
        </span>
        <button
          type="button"
          className="v4-seq-mode v4-beat-clear"
          aria-label={`Clear the ${row} row`}
          onClick={() => {
            gesture();
            for (const i of STEPS) pattern.set(row, i, 0);
          }}
        >
          CLEAR {row}
        </button>
        {variant === 'desk' && <span className="v4-seq-hint">Tap or drag to place hits, hold one and drag up or down for its velocity (or draw them below). Patterns: tap to play, tap tap to chain, hold an empty one to copy.</span>}
        <button type="button" className="v4-seq-done" aria-label="Close the pattern editor" onClick={() => editor.close()}>
          DONE
        </button>
      </div>
      <div className="v4-beat-main">
        <div className="v4-beat-names" role="group" aria-label="Voices">
          {INSTRUMENTS.map((inst) => (
            <button key={inst} type="button" className="v4-beat-name" aria-pressed={inst === row} onClick={() => choose(inst)}>
              {inst}
            </button>
          ))}
        </div>
        <div
          ref={grid}
          className="v4-beat-grid"
          role="grid"
          aria-label="Pattern: voices by steps"
          data-vel={velCell ? '1' : '0'}
          onPointerDown={onGridDown}
          onPointerMove={onGridMove}
          onPointerUp={(e) => onGridUp(e, false)}
          onPointerCancel={(e) => onGridUp(e, true)}
        >
          {INSTRUMENTS.map((inst, r) => (
            <div key={inst} className="v4-beat-row" role="row" data-sel={inst === row ? '1' : '0'}>
              {STEPS.map((c) => {
                const v = velocity(p.steps, inst, c);
                const nl = lockCount(p.locks, inst, c);
                return (
                  <div
                    key={c}
                    className="v4-beat-cell"
                    role="gridcell"
                    tabIndex={cell.r === r && cell.c === c ? 0 : -1}
                    aria-label={`${inst} step ${c + 1}${v > 0 ? `, ${VEL_NAMES[v].toLowerCase()}` : ', empty'}${nl > 0 ? `, ${nl} lock${nl > 1 ? 's' : ''}` : ''}`}
                    data-lock={nl > 0 ? (v > 0 ? '1' : 'idle') : undefined}
                    aria-selected={v > 0}
                    data-beat={c % 4 === 0 ? '1' : '0'}
                    data-on={live(c) ? '1' : '0'}
                    onFocus={() => setCell({ r, c })}
                    onKeyDown={(e) => onCellKey(e, r, c)}
                  >
                    {v > 0 && <span className="v4-beat-hit" style={{ opacity: 0.35 + (0.65 * v) / VEL_MAX }} />}
                    {nl > 0 && <span className="v4-beat-lock" aria-hidden="true" />}
                    {velCell && velCell.r === r && velCell.c === c && (
                      <span className="v4-beat-velnum" aria-hidden="true">
                        {v}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="v4-beat-main">
        <span className="v4-beat-lanelabel">VEL</span>
        <div
          ref={lane}
          className="v4-seq-lane v4-beat-lane"
          style={{ '--n': STEP_COUNT } as React.CSSProperties}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* pointeur deja relache */
            }
            gesture();
            draw.current = { id: e.pointerId, i: -1, v: -1 };
            onLaneMove(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (draw.current?.id === e.pointerId) onLaneMove(e.clientX, e.clientY);
          }}
          onPointerUp={() => {
            draw.current = null;
          }}
          onPointerCancel={() => {
            draw.current = null;
          }}
        >
          {STEPS.map((i) => {
            const v = velocity(p.steps, row, i);
            return (
              <div
                key={i}
                className="v4-seq-col"
                role="slider"
                tabIndex={v > 0 ? 0 : -1}
                aria-label={`${row} step ${i + 1} velocity`}
                aria-valuemin={0}
                aria-valuemax={VEL_MAX}
                aria-valuenow={v}
                aria-valuetext={v > 0 ? VEL_NAMES[v].toLowerCase() : 'empty'}
                data-on={live(i) ? '1' : '0'}
                data-rest={v === 0 ? '1' : '0'}
                data-tone="1"
                onKeyDown={(e) => onBarKey(e, i)}
              >
                {v > 0 && <span className="v4-seq-bar" style={{ height: `${(v / VEL_MAX) * 100}%` }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * Desktop : le panneau pose sur la machine, a la place de sa rangee de pas
 * (les LED, les seize touches, leurs numeros) ; sa grille sur les pas 1 a
 * 16, la colonne des voix a gauche du pas 1 ; les rangees a la hauteur qui
 * tient jusqu'au bas de la fenetre. Il suit chaque vue (Stage.onView).
 */
function useOnMachine(stage: Stage | null, on: boolean, ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !stage || !on) return undefined;
    let last = '';
    const place = (): void => {
      const ids = stage.hit.ids();
      const r = stage.hit.rects();
      const i0 = ids.indexOf('step-1');
      const i1 = ids.indexOf('step-16');
      if (i0 < 0 || i1 < 0) return;
      const cr = stage.renderer.domElement.getBoundingClientRect();
      const host = el.offsetParent instanceof HTMLElement ? el.offsetParent.getBoundingClientRect() : { left: 0, top: 0, bottom: window.innerHeight };
      const x0 = r[i0 * 4];
      const y0 = r[i0 * 4 + 1];
      const h0 = r[i0 * 4 + 3];
      const x1 = r[i1 * 4] + r[i1 * 4 + 2];
      const pad = 8;
      const names = ON_MACHINE.names + pad;
      const left = cr.left - host.left + x0 - names;
      const width = x1 - x0 + names + pad;
      // Le haut : au-dessus des LED des pas (une hauteur de touche plus haut)
      const top = Math.max(60, cr.top - host.top + y0 - h0 * 1.15);
      const room = host.bottom - host.top - top - 12;
      const row = Math.max(ON_MACHINE.rowMin, Math.min(ON_MACHINE.rowMax, Math.floor((room - ON_MACHINE.fixed) / INSTRUMENTS.length) - 2));
      const key = `${Math.round(left)}|${Math.round(top)}|${Math.round(width)}|${row}`;
      if (key === last) return;
      last = key;
      el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
      el.style.width = `${Math.round(width)}px`;
      el.style.setProperty('--beat-row', `${row}px`);
    };
    place();
    const a = stage.onView(place);
    const b = stage.onIdle(place);
    window.addEventListener('resize', place);
    return () => {
      a();
      b();
      window.removeEventListener('resize', place);
    };
  }, [stage, on, ref]);
}

/** Les mesures du panneau pose sur la machine (px) : la colonne des voix et son jour (38 + 6), ce qui n'est pas la grille, la hauteur d'une rangee. */
const ON_MACHINE = { names: 44, fixed: 140, rowMin: 10, rowMax: 17 } as const;

/** Le panneau du MM-RYTM ouvert par son pad EDIT : sur la machine au desktop, sous elle au telephone. */
export const BeatPanel: React.FC<{ stage: Stage | null; mobile: boolean }> = ({ stage, mobile }) => {
  const { shown, ref } = useEditorPanel('mm808', stage, { inset: mobile });
  useOnMachine(stage, shown && !mobile, ref);
  return (
    <section ref={ref} className="v4-seq v4-beat" data-place={mobile ? 'below' : 'machine'} data-shown={shown ? '1' : '0'} aria-label="Pattern editor" aria-hidden={!shown}>
      <BeatEditor variant={mobile ? 'mobile' : 'desk'} />
    </section>
  );
};

export default BeatPanel;
