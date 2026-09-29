/**
 * Couche de saisie au-dessus du canvas (spec 6.2) : un seul element
 * transparent (touch-action none) recoit les pointeurs et interroge la
 * liste explicite des objets interactifs (scene/hit.ts), seulement au
 * pointerdown, au pointermove et a la molette. Semantique :
 * - pads : au pointerdown, le son n'attend pas le relachement ; le CH tenu
 *   300 ms relance un charley ouvert ;
 * - pas, RUN/STOP, CLEAR, knobs de navigation, OPEN, puces du PCB : au
 *   relachement, si le pointeur a bouge de moins de 10 px et reste sur le
 *   meme objet ; une puce active son jumeau (un vrai lien : onglet ou
 *   navigation natifs) ;
 * - potards (TEMPO, TONE, LEVEL) : glisser vertical (vers le haut = plus ;
 *   TEMPO 100 px = 50 BPM, TONE et LEVEL 150 px = toute la course), molette
 *   (1 BPM ou 2 % par cran), double tape = valeur de depart.
 * Survol a la souris : curseur, LED du pas survole, knob ou puce souleves.
 * Les jumeaux HTML (Twins, plus bas) portent le clavier et les lecteurs
 * d'ecran, un par objet. Un appui au pointeur ne leur donne pas le focus
 * (et retire celui d'un jumeau) : Espace reste RUN/STOP apres un clic, au
 * lieu de rejouer le dernier objet touche (section 19).
 */

import React, { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import {
  chipAction,
  clearPattern,
  dialLevel,
  dialTone,
  gesture,
  knob,
  openToggle,
  padDown,
  padHold,
  runToggle,
  setTempo,
  stepToggle,
} from '../actions';
import { clock } from '../audio/clock';
import { mix } from '../audio/drums';
import { BPM, STEP_COUNT, pattern } from '../audio/pattern';
import type { HotspotKind, HotspotView } from '../scene/hit';
import type { Stage } from '../scene/renderer';
import { chipsLive, explode } from '../state/explode';
import { section } from '../state/section';
import {
  CHIPS,
  COARSE_QUERY,
  DIAL_KEYS,
  INST_NAMES,
  NAV_KNOBS,
  OPEN_ARIA,
  PADS,
  PAD_ARIA,
  PAD_FX,
  POT_UI,
  PRESS_SLOP_PX,
  TEMPO_UI,
  TWIN_ARIA,
  type ChipId,
  type NavId,
} from '../theme';

const STEP_INDEXES = Array.from({ length: STEP_COUNT }, (_, i) => i);

interface Props {
  getStage: () => Stage | null;
}

/** Appui en attente de son relachement (pas, RUN, CLEAR, knob, OPEN, puce). */
interface Press {
  id: string;
  kind: HotspotKind;
  index?: number;
  section?: NavId;
  chip?: ChipId;
  x: number;
  y: number;
}

/** Jumeaux montes, par id de hotspot : la couche de saisie active ceux des puces. */
const twinEls = new Map<string, HTMLElement>();

/**
 * Puce touchee sur le canvas : son jumeau est active (lien vers VRSTL
 * Records en nouvel onglet, lien /techrider, bouton STUDIO), le geste en
 * cours donne l'activation utilisateur ; sans jumeau, l'action directe.
 */
function activateChip(id: string, chip: ChipId): void {
  const el = twinEls.get(id);
  if (el) el.click();
  else chipAction(chip);
}

type DialKind = 'tempo' | 'tone' | 'level';

/** Glisser sur un potard. */
interface Drag {
  kind: DialKind;
  y0: number;
  v0: number;
  moved: boolean;
}

const isDial = (k: HotspotKind): k is DialKind => k === 'tempo' || k === 'tone' || k === 'level';

/** Valeur courante d'un potard : BPM, ou 0 a 1. */
const dialValue = (k: DialKind): number => (k === 'tempo' ? pattern.get().bpm : k === 'tone' ? mix.tone : mix.level);

/** Pose une valeur (bornee par l'action). */
const setDial = (k: DialKind, v: number): void => {
  if (k === 'tempo') setTempo(v);
  else if (k === 'tone') dialTone(v);
  else dialLevel(v);
};

/** Valeur par unite de glisser vertical (px) : TEMPO 2 px par BPM, TONE et LEVEL 150 px la course. */
const perPx = (k: DialKind): number => (k === 'tempo' ? 1 / TEMPO_UI.pxPerBpm : 1 / POT_UI.pxRange);

/** Double tape : 130 BPM, TONE ouvert, LEVEL 80 %. */
const dialReset = (k: DialKind): number => (k === 'tempo' ? BPM.initial : POT_UI.reset[k]);

interface Point {
  clientX: number;
  clientY: number;
}

export const HitLayer: React.FC<Props> = ({ getStage }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const coarseMql = window.matchMedia(COARSE_QUERY);
    /** pointerId -> minuterie du CH tenu */
    const holds = new Map<number, number>();
    const presses = new Map<number, Press>();
    const drags = new Map<number, Drag>();
    let hover: string | null = null;
    /** derniere tape par potard (double tape = remise a la valeur de depart) */
    const lastTap: Record<DialKind, number> = { tempo: -Infinity, tone: -Infinity, level: -Infinity };
    let wheelAcc = 0;
    let wheelKind: DialKind | null = null;
    // Le rectangle ne change qu'au redimensionnement : pas de lecture de
    // mise en page a la cadence du pointeur
    let rect = el.getBoundingClientRect();
    const ro = new ResizeObserver(() => {
      rect = el.getBoundingClientRect();
    });
    ro.observe(el);

    const isCoarse = (e: PointerEvent): boolean =>
      e.pointerType === 'touch' || e.pointerType === 'pen' || coarseMql.matches;
    const pickAt = (e: Point, stage: Stage, coarse: boolean): HotspotView | null =>
      stage.hit.pick(e.clientX - rect.left, e.clientY - rect.top, coarse);

    const endHold = (id: number): void => {
      const t = holds.get(id);
      if (t === undefined) return;
      window.clearTimeout(t);
      holds.delete(id);
    };

    const setHover = (h: HotspotView | null): void => {
      const id = h ? h.id : null;
      if (id === hover) return;
      hover = id;
      // Les potards se reglent en glissant verticalement
      el.style.cursor = !h ? '' : isDial(h.kind) ? 'ns-resize' : 'pointer';
      getStage()?.setHover(id);
    };

    const capture = (id: number): void => {
      try {
        el.setPointerCapture(id);
      } catch {
        /* evenement synthetique : pas de capture, sans consequence */
      }
    };

    const fire = (p: Press): void => {
      if (p.kind === 'step' && p.index !== undefined) stepToggle(p.index);
      else if (p.kind === 'run') runToggle();
      else if (p.kind === 'clear') clearPattern();
      else if (p.kind === 'knob' && p.section) knob(p.section);
      else if (p.kind === 'open') openToggle();
      else if (p.kind === 'chip' && p.chip) activateChip(p.id, p.chip);
    };

    /** Deux tapes sur un potard en moins de 350 ms : sa valeur de depart. */
    const tapDial = (k: DialKind): void => {
      const t = performance.now();
      if (t - lastTap[k] <= TEMPO_UI.tapMs) {
        lastTap[k] = -Infinity;
        setDial(k, dialReset(k));
      } else {
        lastTap[k] = t;
      }
    };

    const onDown = (e: PointerEvent): void => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      gesture();
      // Le clavier reprend la ou il en etait, mais Espace redevient RUN/STOP
      const a = document.activeElement;
      if (a instanceof HTMLElement && a.classList.contains('v4-twin')) a.blur();
      const stage = getStage();
      if (!stage) return;
      rect = el.getBoundingClientRect();
      const h = pickAt(e, stage, isCoarse(e));
      if (!h) return;
      e.preventDefault();
      capture(e.pointerId);
      if (h.kind === 'pad') {
        if (!h.inst) return;
        const inst = h.inst;
        padDown(inst, stage);
        if (inst === 'CH') {
          const id = e.pointerId;
          endHold(id);
          holds.set(
            id,
            window.setTimeout(() => {
              holds.delete(id);
              padHold('CH', getStage());
            }, PAD_FX.holdMs)
          );
        }
        return;
      }
      if (isDial(h.kind)) {
        drags.set(e.pointerId, { kind: h.kind, y0: e.clientY, v0: dialValue(h.kind), moved: false });
        return;
      }
      presses.set(e.pointerId, { id: h.id, kind: h.kind, index: h.index, section: h.section, chip: h.chip, x: e.clientX, y: e.clientY });
    };

    const onMove = (e: PointerEvent): void => {
      const stage = getStage();
      if (!stage) return;
      const d = drags.get(e.pointerId);
      if (d) {
        const dy = d.y0 - e.clientY;
        if (!d.moved && Math.abs(dy) >= TEMPO_UI.slopPx) d.moved = true;
        if (d.moved) setDial(d.kind, d.v0 + dy * perPx(d.kind));
        return;
      }
      const p = presses.get(e.pointerId);
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > PRESS_SLOP_PX) presses.delete(e.pointerId);
      // Le doigt a quitte le CH avant 300 ms : pas de charley ouvert
      if (holds.has(e.pointerId) && pickAt(e, stage, isCoarse(e))?.id !== 'pad-CH') endHold(e.pointerId);
      if (e.pointerType === 'mouse') setHover(pickAt(e, stage, false));
    };

    const onUp = (e: PointerEvent): void => {
      endHold(e.pointerId);
      const d = drags.get(e.pointerId);
      if (d) {
        drags.delete(e.pointerId);
        if (!d.moved && e.type === 'pointerup') tapDial(d.kind);
      }
      const p = presses.get(e.pointerId);
      if (p) {
        presses.delete(e.pointerId);
        const stage = getStage();
        // Relache a moins de 10 px et sur le meme objet : l'appui compte
        if (
          stage &&
          e.type === 'pointerup' &&
          Math.hypot(e.clientX - p.x, e.clientY - p.y) <= PRESS_SLOP_PX &&
          pickAt(e, stage, isCoarse(e))?.id === p.id
        ) {
          fire(p);
        }
      }
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };

    const onWheel = (e: WheelEvent): void => {
      // Ctrl + molette : le zoom du navigateur (ou le pincement d'un pave)
      if (e.ctrlKey) return;
      const stage = getStage();
      const h = stage ? pickAt(e, stage, false) : null;
      if (!h || !isDial(h.kind)) {
        wheelAcc = 0;
        wheelKind = null;
        return;
      }
      e.preventDefault();
      if (h.kind !== wheelKind) {
        wheelAcc = 0;
        wheelKind = h.kind;
      }
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1;
      // Molette vers le haut = plus ; un cran de 100 px = 1 BPM ou 2 %, les
      // petits deltas d'un pave tactile s'accumulent
      wheelAcc -= e.deltaY * unit;
      const px = h.kind === 'tempo' ? TEMPO_UI.wheelPx : POT_UI.wheelPx;
      const steps = Math.trunc(wheelAcc / px);
      if (steps !== 0) {
        wheelAcc -= steps * px;
        const step = h.kind === 'tempo' ? 1 : POT_UI.wheelStep;
        setDial(h.kind, dialValue(h.kind) + steps * step);
      }
    };

    const onLeave = (): void => setHover(null);
    // Appui long sur un pad : ni menu contextuel ni loupe
    const onMenu = (e: Event): void => e.preventDefault();

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('contextmenu', onMenu);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      for (const t of holds.values()) window.clearTimeout(t);
      holds.clear();
      presses.clear();
      drags.clear();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('contextmenu', onMenu);
      el.removeEventListener('wheel', onWheel);
      el.style.cursor = '';
      getStage()?.setHover(null);
    };
  }, [getStage]);

  return <div ref={ref} className="v4-hit" aria-hidden="true" />;
};

interface TwinsProps {
  stage: Stage | null;
}

/** Enter tenu ne rejoue pas un jumeau : une frappe, une activation. */
const noRepeat = (e: React.KeyboardEvent): void => {
  if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault();
};

/**
 * Puces LABEL et LIVE (de vrais liens) : un lien natif ne part qu'avec
 * Entree ; Espace l'active aussi (spec 8 : Entree et Espace activent tous
 * les jumeaux). keydown est une activation utilisateur : le nouvel onglet
 * de LABEL reste permis.
 */
const linkSpace = (e: React.KeyboardEvent<HTMLAnchorElement>): void => {
  if (e.key !== ' ' || e.altKey || e.ctrlKey || e.metaKey) return;
  e.preventDefault();
  if (!e.repeat) e.currentTarget.click();
};

/** Le jumeau qui a le focus clavier (son contour doit suivre l'objet), ou null. */
const focusedTwin = (): HTMLElement | null => {
  const a = document.activeElement;
  return a instanceof HTMLElement && a.classList.contains('v4-twin') ? a : null;
};

/** Pose un jumeau sur le rectangle cible de son objet. */
const writeTwin = (el: HTMLElement, v: HotspotView): void => {
  el.style.transform = `translate(${v.x}px, ${v.y}px)`;
  el.style.width = `${v.w}px`;
  el.style.height = `${v.h}px`;
};

/**
 * Potard au clavier (jumeau role slider) : fleches 1 BPM ou 2 %, Maj ou
 * Page 5 BPM ou 10 %, Debut et Fin aux butees. Les autres touches passent
 * (A S D F, chiffres, O restent des raccourcis).
 */
const onDialKey =
  (k: DialKind) =>
  (e: React.KeyboardEvent<HTMLElement>): void => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const cfg = k === 'tempo' ? DIAL_KEYS.tempo : DIAL_KEYS.pot;
    const min = k === 'tempo' ? BPM.min : 0;
    const max = k === 'tempo' ? BPM.max : 1;
    const step = e.shiftKey ? cfg.big : cfg.step;
    let v = dialValue(k);
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        v += step;
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        v -= step;
        break;
      case 'PageUp':
        v += cfg.big;
        break;
      case 'PageDown':
        v -= cfg.big;
        break;
      case 'Home':
        v = min;
        break;
      case 'End':
        v = max;
        break;
      default:
        return;
    }
    e.preventDefault();
    // TONE et LEVEL au centieme : pas de derive de 0.02 en 0.0199999
    setDial(k, k === 'tempo' ? v : Math.round(v * 100) / 100);
  };

const pct = (v: number): number => Math.round(v * 100);

/** "TRACKS" -> "Tracks" */
const title = (label: string): string => label.charAt(0) + label.slice(1).toLowerCase();

/**
 * Jumeaux HTML (spec 6.3) : un element transparent par objet interactif,
 * pose sur sa silhouette projetee (rectangle cible de hit.ts : 48 x 48 px
 * au moins au doigt, 32 x 32 a la souris), focusable, nomme par son
 * aria-label ; contour jaune de 2 px au focus clavier. Le clavier et les
 * lecteurs d'ecran passent par eux, le pointeur par la couche de saisie
 * (ils ne prennent aucun pointeur). Ordre du DOM = ordre de tabulation
 * (spec 6.1) : pads, pas, RUN, CLEAR, TEMPO, knobs de navigation, OPEN,
 * TONE, LEVEL, puis les puces du PCB, rendues de l'ouverture a la fin de
 * la fermeture (actives pendant l'ouverture et vue ouverte) ; LABEL et
 * LIVE sont de vrais liens (Espace les active aussi). Boutons : Entree et
 * Espace natifs ; potards : role slider et fleches. RUN et OPEN gardent un
 * nom fixe, leur etat passe par aria-pressed. Positions : ecrites dans le
 * style sans rendu React, seulement quand la projection a change, et
 * seulement une fois la vue posee (fin d'un mouvement : boucle au repos ou
 * frame suivante a signature identique) ; pendant un mouvement (cadrage,
 * parallaxe, intro, eclate) les jumeaux transparents attendent, sauf celui
 * qui a le focus clavier : son contour suit chaque frame (lui seul).
 */
export const Twins: React.FC<TwinsProps> = ({ stage }) => {
  const s = useSyncExternalStore(explode.subscribe, explode.get, explode.get);
  const p = useSyncExternalStore(pattern.subscribe, pattern.get, pattern.get);
  const running = useSyncExternalStore(clock.subscribe, () => clock.running, () => clock.running);
  const open = useSyncExternalStore(section.subscribe, section.get, section.get);
  const tone = useSyncExternalStore(mix.subscribe, () => mix.tone, () => mix.tone);
  const level = useSyncExternalStore(mix.subscribe, () => mix.level, () => mix.level);
  const els = useRef(new Map<string, HTMLElement>());
  const refs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const showChips = s !== 'closed';
  const live = chipsLive(s);
  const pressed = s === 'opening' || s === 'open';
  const inst = p.instrument;

  /** Ref stable par id : l'element entre et sort des deux registres. */
  const refFor = (id: string): ((el: HTMLElement | null) => void) => {
    let fn = refs.current.get(id);
    if (!fn) {
      fn = (el) => {
        if (el) {
          els.current.set(id, el);
          twinEls.set(id, el);
        } else {
          els.current.delete(id);
          twinEls.delete(id);
        }
      };
      refs.current.set(id, fn);
    }
    return fn;
  };

  useLayoutEffect(() => {
    if (!stage) return undefined;
    // hit.list() rend le meme tableau tant que rien n'a bouge : rien a ecrire
    let last: HotspotView[] | null = null;
    // numero de vue de la frame precedente (hit.version())
    let seen = -1;
    const place = (): void => {
      const list = stage.hit.list();
      if (list === last) return;
      last = list;
      for (let i = 0; i < list.length; i += 1) {
        const v = list[i];
        const el = els.current.get(v.id);
        if (el) writeTwin(el, v);
      }
    };
    // Apres chaque frame rendue : posee (meme numero de vue), un recalage
    // (gratuit sans changement) ; en mouvement, seul le jumeau qui a le
    // focus suit, les autres attendent la fin du mouvement
    const onView = (): void => {
      const v = stage.hit.version();
      const moving = v !== seen;
      seen = v;
      if (!moving) {
        place();
        return;
      }
      const el = focusedTwin();
      const id = el?.dataset.hotspot;
      if (!el || !id) return;
      const list = stage.hit.list();
      for (let i = 0; i < list.length; i += 1) {
        if (list[i].id === id) {
          writeTwin(el, list[i]);
          return;
        }
      }
    };
    // La boucle s'arrete (ou un redimensionnement hors boucle) : recalage
    const onIdle = (): void => {
      seen = stage.hit.version();
      place();
    };
    place();
    const offView = stage.onView(onView);
    const offIdle = stage.onIdle(onIdle);
    return () => {
      offView();
      offIdle();
    };
  }, [stage, showChips]);

  // La vue se referme : un focus clavier sur une puce revient a OPEN
  useEffect(() => {
    if (live) return;
    const a = document.activeElement;
    if (a instanceof HTMLElement && a.dataset.twin === 'chip') els.current.get('open')?.focus({ preventScroll: true });
  }, [live]);

  const bpm = p.bpm;
  return (
    <div className="v4-twins" role="group" aria-label={TWIN_ARIA.group}>
      {PADS.map((pad) => (
        <button
          key={pad.id}
          ref={refFor(`pad-${pad.id}`)}
          type="button"
          className="v4-twin"
          data-twin="pad"
          data-hotspot={`pad-${pad.id}`}
          aria-label={PAD_ARIA[pad.id]}
          aria-pressed={inst === pad.id}
          onKeyDown={noRepeat}
          onClick={() => padDown(pad.id, stageRef.current)}
        />
      ))}
      {STEP_INDEXES.map((i) => {
        const on = inst ? p.steps[inst][i] === '1' : false;
        return (
          <button
            key={i}
            ref={refFor(`step-${i + 1}`)}
            type="button"
            className="v4-twin"
            data-twin="step"
            data-hotspot={`step-${i + 1}`}
            aria-label={inst ? `Step ${i + 1}, ${INST_NAMES[inst]} ${on ? 'on' : 'off'}` : `Step ${i + 1}, no instrument selected`}
            aria-pressed={on}
            onKeyDown={noRepeat}
            onClick={() => stepToggle(i)}
          />
        );
      })}
      <button
        ref={refFor('run')}
        type="button"
        className="v4-twin"
        data-twin="run"
        data-hotspot="run"
        aria-label={TWIN_ARIA.run}
        aria-pressed={running}
        onKeyDown={noRepeat}
        onClick={() => runToggle()}
      />
      <button
        ref={refFor('clear')}
        type="button"
        className="v4-twin"
        data-twin="clear"
        data-hotspot="clear"
        aria-label={TWIN_ARIA.clear}
        onKeyDown={noRepeat}
        onClick={() => clearPattern()}
      />
      <div
        ref={refFor('tempo')}
        className="v4-twin"
        data-twin="tempo"
        data-hotspot="tempo"
        role="slider"
        tabIndex={0}
        aria-label={TWIN_ARIA.tempo}
        aria-orientation="vertical"
        aria-valuemin={BPM.min}
        aria-valuemax={BPM.max}
        aria-valuenow={bpm}
        aria-valuetext={`${bpm} BPM`}
        onKeyDown={onDialKey('tempo')}
      />
      {NAV_KNOBS.map((k) => (
        <button
          key={k.id}
          ref={refFor(`knob-${k.id}`)}
          type="button"
          className="v4-twin"
          data-twin="knob"
          data-hotspot={`knob-${k.id}`}
          aria-label={`${title(k.label)}, key ${k.key}`}
          aria-expanded={open === k.id}
          aria-controls={`v4-section-${k.id}`}
          onKeyDown={noRepeat}
          onClick={() => knob(k.id)}
        />
      ))}
      <button
        ref={refFor('open')}
        type="button"
        className="v4-twin"
        data-twin="open"
        data-hotspot="open"
        aria-pressed={pressed}
        aria-label={OPEN_ARIA}
        onKeyDown={noRepeat}
        onClick={() => openToggle()}
      />
      {(['tone', 'level'] as const).map((k) => {
        const v = pct(k === 'tone' ? tone : level);
        return (
          <div
            key={k}
            ref={refFor(k)}
            className="v4-twin"
            data-twin={k}
            data-hotspot={k}
            role="slider"
            tabIndex={0}
            aria-label={TWIN_ARIA[k]}
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={v}
            aria-valuetext={`${v} %`}
            onKeyDown={onDialKey(k)}
          />
        );
      })}
      {showChips &&
        CHIPS.map((c) => {
          const id = `chip-${c.id}`;
          const tab = live ? 0 : -1;
          return c.href ? (
            <a
              key={id}
              ref={refFor(id)}
              className="v4-twin"
              data-twin="chip"
              data-chip={c.id}
              data-hotspot={id}
              href={c.href}
              target={c.external ? '_blank' : undefined}
              rel={c.external ? 'noopener' : undefined}
              aria-label={c.aria}
              tabIndex={tab}
              onKeyDown={linkSpace}
              onClick={(e) => {
                // La vue se referme : plus de lien
                if (!chipsLive(explode.get())) e.preventDefault();
              }}
            />
          ) : (
            <button
              key={id}
              ref={refFor(id)}
              type="button"
              className="v4-twin"
              data-twin="chip"
              data-chip={c.id}
              data-hotspot={id}
              aria-label={c.aria}
              tabIndex={tab}
              onKeyDown={noRepeat}
              onClick={() => chipAction(c.id)}
            />
          );
        })}
    </div>
  );
};

export default HitLayer;
