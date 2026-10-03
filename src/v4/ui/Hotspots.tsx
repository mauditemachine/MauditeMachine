/**
 * Couche de saisie au-dessus du canvas (spec 6.2, 20.2.3 et 20.7) : un
 * seul element transparent (touch-action none) recoit les pointeurs et
 * interroge la liste explicite des objets interactifs (scene/hit.ts),
 * seulement aux evenements de pointeur et a la molette. La camera orbite
 * (scene/orbit.ts, sur le parent .v4-stage, qui voit chaque evenement
 * APRES cette couche). Regle du brief pour TOUS les objets, pads compris :
 * un objet ne part qu'au relachement, si le pointeur a bouge de moins de
 * 6 px depuis le pointerdown, sans second doigt, et si le relachement tombe
 * sur le meme objet (orbit.isTap) ; un glisser fait tourner la machine et
 * n'active jamais rien. Un appui lent et immobile part aussi (revue de la
 * revision 2, test T1 : la limite de 400 ms ne sert plus qu'a la double
 * tape du fond). Semantique :
 * - pads de voix (le son), pads de page (la section), pad OPEN, touches
 *   trig, RUN/STOP, CLEAR, puces du PCB : la tape ; une puce active son
 *   jumeau (un vrai lien : onglet ou navigation natifs) ;
 * - encodeurs (TEMPO, TONE, LEVEL, SWING, DIST, REVERB) : un glisser parti
 *   d'eux les tourne et ne fait JAMAIS orbiter la vue (orbit.gate) ; l'axe
 *   dominant au seuil de 6 px decide (vers le haut ou vers la droite =
 *   plus ; TEMPO 100 px = 50 BPM, les autres 150 px = toute la course) ;
 *   au doigt, seulement apres 250 ms de repos sur lui : un glisser rapide
 *   qui en part fait tourner la vue (au telephone les encodeurs couvrent
 *   12 % de la machine, orbiter ne doit pas changer le tempo) ;
 *   molette au-dessus d'eux (1 BPM ou 2 % par cran), ailleurs elle zoome ;
 *   une tape ne change rien, une double tape = valeur de depart ;
 * - fond (ni objet ni machine) : une double tape (ou un double clic)
 *   ramene la vue par defaut.
 * Survol a la souris (jamais pendant une orbite) : curseur, LED du pas
 * survole, pad de page plus lumineux, puce soulevee. Les jumeaux HTML
 * (Twins, plus bas) portent le clavier et les lecteurs d'ecran, un par
 * objet. Un appui au pointeur ne leur donne pas le focus (et retire celui
 * d'un jumeau) : Espace reste RUN/STOP apres un clic, au lieu de rejouer le
 * dernier objet touche (section 19).
 */

import React, { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import {
  anyDial,
  anyDialReset,
  anyDialValue,
  chipAction,
  clearPattern,
  randomPattern,
  dial,
  dialValue,
  focusMachine,
  gesture,
  muteToggle,
  openToggle,
  padHit,
  page,
  resetView,
  runToggle,
  soloToggle,
  stepClear,
  stepToggle,
  voyClear,
  voyPad,
  voyRandom,
  voyRun,
  type DialId,
} from '../actions';
import { clock } from '../audio/clock';
import { mix } from '../audio/drums';
import { VOICE_FX_DEFAULT, voiceFx } from '../audio/voicefx';
import { BPM, STEP_COUNT, isOn, pattern } from '../audio/pattern';
import type { HotspotKind, HotspotView } from '../scene/hit';
import type { Stage } from '../scene/renderer';
import { chipsLive, explode } from '../state/explode';
import { focus, VOYAGER } from '../state/focus';
import { section } from '../state/section';
import { voices } from '../state/voices';
import { EXTERNAL_REL } from './ExternalLink';
import {
  CHIPS,
  COARSE_QUERY,
  MOBILE_QUERY,
  DIAL_FINE,
  DIAL_KEYS,
  ENCODERS,
  INST_NAMES,
  OPEN_ARIA,
  ORBIT,
  PADS,
  PAD_ARIA,
  POT_UI,
  potMin,
  isBipolar,
  isVoiceEnc,
  STEP_HOLD_MS,
  TEMPO_UI,
  TWIN_ARIA,
  isPage,
  swingRatio,
  type ChipId,
  type EncId,
  type Inst,
  type SectionId,
} from '../theme';

const STEP_INDEXES = Array.from({ length: STEP_COUNT }, (_, i) => i);

interface Props {
  getStage: () => Stage | null;
  /** le Stage monte : la couche y branche la garde des encodeurs (orbit.gate) */
  stage: Stage | null;
}

/** Un pointeur pose : l'objet sous lui au pointerdown (ou le fond), en attente de son relachement. */
interface Down {
  /** id de l'objet, null = le fond */
  id: string | null;
  kind: HotspotKind | null;
  inst?: Inst;
  index?: number;
  section?: SectionId;
  chip?: ChipId;
  /** MM-VOYAGER : pad d'accord, CLEAR ou RANDOM */
  vpad?: number;
  vbtn?: 'run' | 'clear' | 'random';
  x: number;
  y: number;
  /** encodeur (ou potard du MM-VOYAGER, v:<id>) sous le pointerdown, et sa valeur de depart */
  dial: DialId | null;
  v0: number;
  /** reglage fin (Maj) en cours, et la course a laquelle il a ete pris ou lache */
  fine: boolean;
  a: number;
  /** la garde l'a pris : glisser parti de l'encodeur, qui le tourne */
  turning: boolean;
  /** axe dominant au seuil : y (vers le haut = plus) ou x (vers la droite = plus) */
  axis: 'x' | 'y';
  /** pointeur souris : le curseur suit l'axe pendant qu'il tourne */
  mouse: boolean;
  /** instant du pointerdown (performance.now) */
  t: number;
  /** un autre doigt etait pose (pincement, rotation) : jamais un glisser d'une machine a l'autre */
  multi: boolean;
}

/**
 * Glisser d'une machine a l'autre au telephone (2026-10-03) : un doigt,
 * horizontal (1.4 fois plus que vertical), plus de 56 px, en moins de
 * 700 ms, parti d'ailleurs que d'un potard (un potard tourne).
 */
const SWIPE = { px: 56, ratio: 1.4, ms: 700 } as const;

/** Jumeaux montes, par id de hotspot : la couche de saisie active ceux des puces. */
const twinEls = new Map<string, HTMLElement>();

/**
 * Puce touchee sur le canvas : son jumeau est active (LABEL : lien vers la
 * page Bandcamp du label en nouvel onglet ; LIVE, STUDIO et MERCH : boutons de
 * leur section), le geste en cours donne l'activation utilisateur ; sans
 * jumeau, l'action directe.
 */
function activateChip(id: string, chip: ChipId): void {
  const el = twinEls.get(id);
  if (el) el.click();
  else chipAction(chip, id.startsWith('vchip-') ? 'voy' : 'mm808');
}

/** Les jumeaux des puces du MM-VOYAGER s'inscrivent ici aussi (ui/VoyTwins.tsx). */
export function registerTwin(id: string, el: HTMLElement | null): void {
  if (el) twinEls.set(id, el);
  else twinEls.delete(id);
}

const isVoy = (k: DialId): boolean => k.startsWith('v:');

/** Valeur par px de glisser : TEMPO 2 px par BPM, les autres 150 px la course (TONE : 2 unites). */
const perPx = (k: DialId): number =>
  isVoy(k) ? 1 / POT_UI.pxRange : k === 'tempo' ? 1 / TEMPO_UI.pxPerBpm : (1 - potMin(k as EncId)) / POT_UI.pxRange;

/**
 * L'encodeur d'un glisser qui le tient : valeur de depart + ecart sur son
 * axe, depuis le pointerdown. Maj tenue : dix fois plus fin (DIAL_FINE,
 * comme dans Ableton) ; prise ou lachee en cours de geste, la course repart
 * de la valeur du moment, sans saut.
 */
function turnDial(d: Down, dx: number, dy: number, fine: boolean): void {
  if (!d.dial) return;
  const travel = d.axis === 'y' ? -dy : dx;
  if (fine !== d.fine) {
    d.v0 = anyDialValue(d.dial);
    d.a = travel;
    d.fine = fine;
  }
  anyDial(d.dial, d.v0 + (travel - d.a) * perPx(d.dial) * (fine ? DIAL_FINE.drag : 1));
}

interface Point {
  clientX: number;
  clientY: number;
}

/** Revue : le dernier relachement juge par la couche de saisie. */
export const hitDebug = { lastUp: { id: null as string | null, tap: false, fired: null as string | null, bg: false }, bgResets: 0 };

export const HitLayer: React.FC<Props> = ({ getStage, stage }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !stage) return undefined;
    const coarseMql = window.matchMedia(COARSE_QUERY);
    let disposed = false;
    /** pointerId -> l'objet (ou le fond) sous son pointerdown */
    const downs = new Map<number, Down>();
    let hover: string | null = null;
    /** derniere tape par encodeur (double tape = remise a la valeur de depart) */
    const lastTap = new Map<DialId, number>();
    /** derniere tape du fond (double tape = vue par defaut) */
    let lastBg: { t: number; x: number; y: number } | null = null;
    let wheelAcc = 0;
    let wheelKind: DialId | null = null;
    /** vue d'ensemble, ou le bout de la voisine : une machine sous la souris (curseur doigt, un clic zoome) */
    let hoverMachine = false;
    /** le bout de la machine voisine est survole : il sort un peu */
    let peeking = false;
    const setPeek = (on: boolean): void => {
      if (on === peeking) return;
      peeking = on;
      stage.setPeekHover(on);
    };
    /** Maj tenue au dernier mouvement du pointeur (reglage fin des potards) */
    let shiftHeld = false;
    // Le rectangle ne change qu'au redimensionnement : pas de lecture de
    // mise en page a la cadence du pointeur
    let rect = el.getBoundingClientRect();
    const ro = new ResizeObserver(() => {
      rect = el.getBoundingClientRect();
    });
    ro.observe(el);

    const isCoarse = (e: PointerEvent): boolean =>
      e.pointerType === 'touch' || e.pointerType === 'pen' || coarseMql.matches;
    const pickAt = (e: Point, coarse: boolean): HotspotView | null =>
      stage.hit.pick(e.clientX - rect.left, e.clientY - rect.top, coarse);

    let hoverDial = false;
    /** axe de l'encodeur que la souris tourne, null sinon */
    let turnAxis: 'x' | 'y' | null = null;
    /**
     * Curseur : main ouverte par defaut (CSS), fermee pendant l'orbite,
     * doigt sur un objet, fleches sur un encodeur (celles de son axe pendant
     * qu'on le tourne).
     */
    const setCursor = (): void => {
      el.style.cursor =
        turnAxis !== null
          ? turnAxis === 'y'
            ? 'ns-resize'
            : 'ew-resize'
          : stage.orbit.dragging
            ? 'grabbing'
            : hover === null
              ? hoverMachine
                ? 'pointer'
                : ''
              : hoverDial
                ? 'ns-resize'
                : 'pointer';
    };
    const setHover = (h: HotspotView | null): void => {
      const id = h ? h.id : null;
      hoverDial = !!h && (h.kind === 'encoder' || h.kind === 'vknob');
      if (id !== hover) {
        hover = id;
        stage.setHover(id);
      }
      setCursor();
    };

    const capture = (id: number): void => {
      try {
        el.setPointerCapture(id);
      } catch {
        /* evenement synthetique : pas de capture, sans consequence */
      }
    };

    /** Deux tapes sur un encodeur en moins de 350 ms : sa valeur de depart. */
    const tapDial = (k: DialId): void => {
      const t = performance.now();
      if (t - (lastTap.get(k) ?? -Infinity) <= TEMPO_UI.tapMs) {
        lastTap.delete(k);
        anyDial(k, anyDialReset(k));
      } else {
        lastTap.set(k, t);
      }
    };

    /** L'objet tape (relache sur lui, tape au sens du brief) part ; renvoie son id. */
    const fire = (d: Down): string | null => {
      if (d.kind === 'pad' && d.inst) padHit(d.inst, stage);
      else if (d.kind === 'page' && d.section && isPage(d.section)) page(d.section, stage);
      else if (d.kind === 'open') openToggle(stage, 'mm808');
      else if (d.kind === 'step' && d.index !== undefined) {
        // Appui long (revision 4) : le pas se vide ; sinon il change
        if (stage.orbit.lastTap.ms >= STEP_HOLD_MS) stepClear(d.index, stage);
        else stepToggle(d.index, stage);
      }
      else if (d.kind === 'run') runToggle(stage);
      else if (d.kind === 'clear') clearPattern(stage);
      else if (d.kind === 'mute') muteToggle(stage);
      else if (d.kind === 'solo') soloToggle(stage);
      else if (d.kind === 'random') randomPattern(stage);
      else if (d.kind === 'seek') stage.seekAt(d.x, d.y);
      else if ((d.kind === 'chip' || d.kind === 'vchip') && d.chip && d.id) activateChip(d.id, d.chip);
      else if (d.kind === 'vpad' && d.vpad !== undefined) voyPad(d.vpad, stage);
      else if (d.kind === 'vopen') openToggle(stage, 'voy');
      else if (d.kind === 'vbtn' && d.vbtn === 'clear') voyClear(stage);
      else if (d.kind === 'vbtn' && d.vbtn === 'random') voyRandom(stage);
      else if (d.kind === 'vbtn' && d.vbtn === 'run') voyRun(stage);
      else if (d.dial) tapDial(d.dial);
      else return null;
      return d.id;
    };

    /** Tape sur le fond : la deuxieme en moins de 300 ms et 30 px ramene la vue par defaut. */
    const tapBackground = (e: PointerEvent): boolean => {
      const t = e.timeStamp || performance.now();
      if (lastBg && t - lastBg.t < ORBIT.bgTapMs && Math.hypot(e.clientX - lastBg.x, e.clientY - lastBg.y) < ORBIT.bgTapPx) {
        lastBg = null;
        hitDebug.bgResets += 1;
        resetView(stage);
        return true;
      }
      lastBg = { t, x: e.clientX, y: e.clientY };
      return false;
    };

    // Garde de l'orbite, appelee quand un pointeur passe 6 px : un glisser
    // parti d'un encodeur le tourne et n'orbite jamais (la couche le garde
    // jusqu'au relachement ; l'axe dominant a ce seuil devient le sien),
    // au doigt comme a la souris (un seul doigt ne tourne plus la vue,
    // 2026-10-01) ; tout le reste fait tourner la machine
    stage.orbit.gate = (pointerId, dx, dy) => {
      const d = downs.get(pointerId);
      if (!d || !d.dial) return true;
      d.turning = true;
      d.axis = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
      turnDial(d, dx, dy, shiftHeld);
      if (d.mouse) {
        turnAxis = d.axis;
        setCursor();
      }
      return false;
    };

    const onDown = (e: PointerEvent): void => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      gesture();
      // Le clavier reprend la ou il en etait, mais Espace redevient RUN/STOP
      const a = document.activeElement;
      if (a instanceof HTMLElement && a.classList.contains('v4-twin')) a.blur();
      rect = el.getBoundingClientRect();
      // Chaque pointeur est capture : un glisser continue d'orbiter hors du canvas
      capture(e.pointerId);
      const h = pickAt(e, isCoarse(e));
      const encoder: DialId | null =
        h && h.kind === 'encoder' && h.param ? h.param : h && h.kind === 'vknob' && h.vknob ? (`v:${h.vknob}` as DialId) : null;
      // Un deuxieme doigt : ni l'un ni l'autre ne glisse d'une machine a l'autre
      const multi = downs.size > 0;
      if (multi) for (const o of downs.values()) o.multi = true;
      downs.set(e.pointerId, {
        id: h ? h.id : null,
        kind: h ? h.kind : null,
        inst: h?.inst,
        index: h?.index,
        section: h?.section,
        chip: h?.chip,
        vpad: h?.vpad,
        vbtn: h?.vbtn,
        multi,
        x: e.clientX,
        y: e.clientY,
        dial: encoder,
        v0: encoder ? anyDialValue(encoder) : 0,
        fine: false,
        a: 0,
        turning: false,
        axis: 'y',
        mouse: e.pointerType === 'mouse',
        t: performance.now(),
      });
      // Rien ne part ici : un objet attend la tape (relachement)
      if (h) e.preventDefault();
    };

    /**
     * Un pointeur perdu (capture perdue, bouton relache hors de la page) :
     * oublie sans rien activer, le curseur quitte l'axe de l'encodeur.
     */
    const forget = (id: number): void => {
      const d = downs.get(id);
      if (!d) return;
      downs.delete(id);
      try {
        if (el.hasPointerCapture(id)) el.releasePointerCapture(id);
      } catch {
        /* pointeur deja inactif */
      }
      if (d.turning && d.mouse) {
        turnAxis = null;
        setCursor();
      }
    };

    const onMove = (e: PointerEvent): void => {
      // Lu ici, avant l'orbite (sur le parent) dont la garde prend l'encodeur
      shiftHeld = e.shiftKey;
      const d = downs.get(e.pointerId);
      // Souris sans bouton mais encore tenue ici : son pointerup s'est perdu
      if (d && d.mouse && (e.buttons & 1) === 0) forget(e.pointerId);
      else if (d && d.turning) {
        turnDial(d, e.clientX - d.x, e.clientY - d.y, e.shiftKey);
        return;
      }
      if (e.pointerType !== 'mouse') return;
      // Pendant une orbite : ni survol ni picking
      if (stage.orbit.dragging) {
        if (hover !== null) setHover(null);
        else setCursor();
        return;
      }
      const h = pickAt(e, false);
      // Deux machines : en vue d'ensemble, une machine sous la souris se clique ;
      // une machine utilisee, le bout de l'autre aussi (et il sort un peu)
      const mh = !h && VOYAGER ? stage.hit.machineAt(e.clientX - rect.left, e.clientY - rect.top) : null;
      hoverMachine = mh !== null && mh !== focus.machine();
      setPeek(hoverMachine && focus.get() !== 'all');
      setHover(h);
    };

    const onUp = (e: PointerEvent): void => {
      const d = downs.get(e.pointerId);
      downs.delete(e.pointerId);
      if (d && d.turning && d.mouse) {
        turnAxis = null;
        setCursor();
      }
      // Lu AVANT le pointerup de l'orbite (elle ecoute le parent) : sa fiche existe encore
      if (d && !d.turning && e.type === 'pointerup') {
        const tap = stage.orbit.isTap(e);
        let fired: string | null = null;
        let bg = false;
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        // Une machine touchee hors de ses objets (vue d'ensemble, ou l'autre machine) : on zoome dessus
        const other = VOYAGER && tap && d.id === null ? stage.hit.machineAt(mx, my) : null;
        if (tap && d.id !== null) {
          // Relache sur le meme objet : il part
          if (pickAt(e, isCoarse(e))?.id === d.id) fired = fire(d);
        } else if (other && other !== focus.machine()) {
          fired = `focus-${other}`;
          focusMachine(other);
        } else if (tap && stage.orbit.lastTap.quick && !stage.hit.onMachine(mx, my)) {
          bg = true;
          tapBackground(e);
        } else if (VOYAGER && !tap && !d.multi && e.pointerType !== 'mouse' && window.matchMedia(MOBILE_QUERY).matches) {
          // Au telephone : un glisser horizontal passe d'une machine a l'autre
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (Math.abs(dx) > SWIPE.px && Math.abs(dx) > SWIPE.ratio * Math.abs(dy) && performance.now() - d.t < SWIPE.ms) {
            fired = dx < 0 ? 'swipe-voy' : 'swipe-mm808';
            focusMachine(dx < 0 ? 'voy' : 'mm808');
          }
        }
        hitDebug.lastUp = { id: d.id, tap, fired, bg };
      }
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (e.pointerType === 'mouse' && e.type === 'pointerup') {
        // L'orbite lache ce pointeur juste apres (son ecouteur est sur le
        // parent) : le survol et le curseur se recalculent une fois
        // l'evenement passe. Une tache, pas une microtache : avec de vrais
        // evenements, les microtaches passent apres CHAQUE ecouteur, donc
        // avant celui de l'orbite, et le curseur restait 'grabbing'
        const px = e.clientX;
        const py = e.clientY;
        window.setTimeout(() => {
          if (!disposed) setHover(stage.hit.pick(px - rect.left, py - rect.top, false));
        }, 0);
      }
    };

    const onWheel = (e: WheelEvent): void => {
      // Ctrl + molette (pincement d'un pave tactile) : le zoom de la vue
      if (e.ctrlKey) return;
      const h = pickAt(e, false);
      const k: DialId | null = h && h.kind === 'encoder' && h.param ? h.param : h && h.kind === 'vknob' && h.vknob ? (`v:${h.vknob}` as DialId) : null;
      if (!k) {
        wheelAcc = 0;
        wheelKind = null;
        return;
      }
      // Au-dessus d'un encodeur : il tourne, l'orbite ne zoome pas
      e.preventDefault();
      if (k !== wheelKind) {
        wheelAcc = 0;
        wheelKind = k;
      }
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1;
      // Molette vers le haut = plus ; un cran de 100 px = 1 BPM ou 2 %, les
      // petits deltas d'un pave tactile s'accumulent. Maj : macOS fait de la
      // molette un defilement horizontal (deltaX), lu a sa place
      const delta = e.shiftKey && e.deltaY === 0 ? e.deltaX : e.deltaY;
      wheelAcc -= delta * unit;
      const px = k === 'tempo' ? TEMPO_UI.wheelPx : POT_UI.wheelPx;
      const steps = Math.trunc(wheelAcc / px);
      if (steps !== 0) {
        wheelAcc -= steps * px;
        // Maj : reglage fin, 1 % le cran (TEMPO reste a 1 BPM)
        const step = k === 'tempo' ? 1 : e.shiftKey ? DIAL_FINE.wheelStep : !isVoy(k) && isBipolar(k as EncId) ? POT_UI.bipolarStep : POT_UI.wheelStep;
        anyDial(k, Math.round((anyDialValue(k) + steps * step) * 1000) / 1000);
      }
    };

    const onLost = (e: PointerEvent): void => forget(e.pointerId);

    const onLeave = (e: PointerEvent): void => {
      if (e.pointerType === 'mouse' && !stage.orbit.dragging) setHover(null);
      setPeek(false);
    };
    // Appui long : ni menu contextuel ni loupe
    const onMenu = (e: Event): void => e.preventDefault();

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('lostpointercapture', onLost);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('contextmenu', onMenu);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      disposed = true;
      ro.disconnect();
      downs.clear();
      stage.orbit.gate = () => true;
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('lostpointercapture', onLost);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('contextmenu', onMenu);
      el.removeEventListener('wheel', onWheel);
      el.style.cursor = '';
      getStage()?.setHover(null);
    };
  }, [getStage, stage]);

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
 * Puce LABEL (un vrai lien) : un lien natif ne part qu'avec Entree ; Espace
 * l'active aussi (spec 8 : Entree et Espace activent tous les jumeaux).
 * keydown est une activation utilisateur : le nouvel onglet reste permis.
 */
const linkSpace = (e: React.KeyboardEvent<HTMLAnchorElement>): void => {
  if (e.key !== ' ' || e.altKey || e.ctrlKey || e.metaKey) return;
  e.preventDefault();
  if (!e.repeat) e.currentTarget.click();
};

/** Arrondi au dixieme de px : ce que les jumeaux ecrivent. */
const r1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Encodeur au clavier (jumeau role slider) : fleches 1 BPM ou 2 %, Maj ou
 * Page 5 BPM ou 10 %, Debut et Fin aux butees. Les autres touches passent
 * (A S D F, chiffres, O restent des raccourcis).
 */
const onDialKey =
  (k: EncId) =>
  (e: React.KeyboardEvent<HTMLElement>): void => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const cfg = k === 'tempo' ? DIAL_KEYS.tempo : DIAL_KEYS.pot;
    const min = k === 'tempo' ? BPM.min : potMin(k);
    const max = k === 'tempo' ? BPM.max : 1;
    // TONE et STRETCH : un pas de 0.05 sort du cran du centre (+/-0.04)
    const step = e.shiftKey ? cfg.big : isBipolar(k) ? POT_UI.bipolarStep : cfg.step;
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
    // Au centieme : pas de derive de 0.02 en 0.0199999
    dial(k, k === 'tempo' ? v : Math.round(v * 100) / 100);
  };

const pct = (v: number): number => Math.round(v * 100);

/** "TRACKS" -> "Tracks" */
const title = (label: string): string => label.charAt(0) + label.slice(1).toLowerCase();

/** Texte lu d'un encodeur : "130 BPM", "80 %", "54 % swing", TONE "+35", STRETCH "-40 %, shorter". */
function dialText(k: EncId, v: number): string {
  if (k === 'tempo') return `${v} BPM`;
  if (k === 'swing') return `${swingRatio(v)} % swing`;
  if (k === 'tone') {
    const n = pct(v);
    return n === 0 ? '0, centre, bypass' : `${n > 0 ? '+' : ''}${n}`;
  }
  if (k === 'stretch' || k === 'vstretch') {
    const n = pct(v);
    return n === 0 ? '0, centre, original length' : `${n > 0 ? '+' : ''}${n} %, ${n > 0 ? 'longer' : 'shorter'}`;
  }
  return `${pct(v)} %`;
}

/**
 * Jumeaux HTML (spec 6.3 et 20.7) : un element transparent par objet
 * interactif, pose sur sa silhouette projetee (rectangle cible de hit.ts :
 * 48 x 48 px au moins au doigt, 32 x 32 a la souris), focusable, nomme par
 * son aria-label ; contour jaune de 2 px au focus clavier. Le clavier et
 * les lecteurs d'ecran passent par eux, le pointeur par la couche de saisie
 * (ils ne prennent aucun pointeur). Ordre du DOM = ordre de tabulation
 * (spec 20.7 et 20.19) : les 4 pads de voix (aria-pressed = instrument
 * selectionne), les 8 pads de navigation en ordre de lecture (pages :
 * aria-expanded et aria-controls ; OPEN : aria-pressed), les puces du PCB
 * juste apres OPEN qui les decouvre (rendues de l'ouverture a la fin de la
 * fermeture, actives pendant l'ouverture et vue ouverte), les six
 * encodeurs (role slider), RUN, CLEAR, les 16 touches trig ; RESET VIEW
 * suit (index.tsx). LABEL est un vrai lien (nouvel onglet, Espace l'active
 * aussi), LIVE et STUDIO des boutons de leur section (aria-expanded,
 * aria-controls) ; le focus clavier d'une puce la souleve comme le survol
 * (LABEL passe aussi au jaune, avec son chevron). RUN et OPEN gardent un
 * nom fixe, leur etat passe par aria-pressed. Positions (spec 20.2.8) : ecrites dans
 * le style sans rendu React, DANS la passe de rendu (stage.onView, juste
 * apres renderer.render) a chaque frame rendue, depuis les rectangles de
 * hit.rects() (projection analytique, sans allocation) : les jumeaux
 * suivent l'orbite et le contour jaune du jumeau qui a le focus reste sur
 * son objet. Seules les valeurs qui ont change (au dixieme de px) sont
 * reecrites ; le montage ecrit tout, onIdle rattrape un rendu hors boucle.
 */
export const Twins: React.FC<TwinsProps> = ({ stage }) => {
  const s = useSyncExternalStore(explode.subscribe, explode.get, explode.get);
  const p = useSyncExternalStore(pattern.subscribe, pattern.get, pattern.get);
  const running = useSyncExternalStore(clock.subscribe, () => clock.running, () => clock.running);
  const v = useSyncExternalStore(voices.subscribe, voices.get, voices.get);
  const muteOn = p.instrument ? v.muted.includes(p.instrument) : v.muted.length > 0;
  const open = useSyncExternalStore(section.subscribe, section.get, section.get);
  const stretch = useSyncExternalStore(mix.subscribe, () => mix.stretch, () => mix.stretch);
  const level = useSyncExternalStore(mix.subscribe, () => mix.level, () => mix.level);
  const swing = useSyncExternalStore(mix.subscribe, () => mix.swing, () => mix.swing);
  const drive = useSyncExternalStore(mix.subscribe, () => mix.drive, () => mix.drive);
  const reverb = useSyncExternalStore(mix.subscribe, () => mix.reverb, () => mix.reverb);
  const delay = useSyncExternalStore(mix.subscribe, () => mix.delay, () => mix.delay);
  const chorus = useSyncExternalStore(mix.subscribe, () => mix.chorus, () => mix.chorus);
  // Rangee VOICE : la voix du pad selectionne, sinon ses valeurs de depart
  const vfx = useSyncExternalStore(voiceFx.subscribe, voiceFx.get, voiceFx.get);
  const els = useRef(new Map<string, HTMLElement>());
  const refs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const stageRef = useRef(stage);
  stageRef.current = stage;
  // Deux machines (2026-10-03) : les jumeaux de la 808 ne repondent que quand on l'utilise
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const off = VOYAGER && f !== 'mm808';
  const groupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = groupRef.current;
    if (!el) return;
    if (off) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  }, [off]);
  const showChips = s !== 'closed';
  const live = chipsLive(s);
  const pressed = s === 'opening' || s === 'open';
  const inst = p.instrument;
  const sel = p.instrument ? vfx[p.instrument] : VOICE_FX_DEFAULT;
  const values: Record<EncId, number> = {
    tempo: p.bpm,
    level,
    swing,
    stretch,
    dist: drive,
    chorus,
    delay,
    reverb,
    vol: sel.level,
    tone: sel.tone,
    vstretch: sel.stretch,
    vdist: sel.dist,
    vchorus: sel.chorus,
    vdelay: sel.delay,
    vreverb: sel.reverb,
  };

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
    const ids = stage.hit.ids();
    // Dernieres valeurs ecrites par jumeau (x, y, w, h au dixieme de px) : NaN = a ecrire
    const last = new Float64Array(ids.length * 4).fill(NaN);
    /** Ecrit les jumeaux dont le rectangle a change ; force : tous (montage). */
    const place = (force: boolean): void => {
      const r = stage.hit.rects();
      for (let i = 0; i < ids.length; i += 1) {
        const el = els.current.get(ids[i]);
        if (!el) continue;
        const o = i * 4;
        const x = r1(r[o]);
        const y = r1(r[o + 1]);
        const w = r1(r[o + 2]);
        const h = r1(r[o + 3]);
        if (force || x !== last[o] || y !== last[o + 1]) {
          el.style.transform = `translate(${x}px, ${y}px)`;
          last[o] = x;
          last[o + 1] = y;
        }
        if (force || w !== last[o + 2] || h !== last[o + 3]) {
          el.style.width = `${w}px`;
          el.style.height = `${h}px`;
          last[o + 2] = w;
          last[o + 3] = h;
        }
      }
    };
    // Dans la passe de rendu : les jumeaux suivent l'orbite, frame par frame
    const onView = (): void => place(false);
    // La boucle s'arrete (ou un redimensionnement hors boucle) : recalage
    const onIdle = (): void => place(false);
    place(true);
    const offView = stage.onView(onView);
    const offIdle = stage.onIdle(onIdle);
    return () => {
      offView();
      offIdle();
    };
  }, [stage, showChips]);

  // La vue se referme : un focus clavier sur une puce revient au pad OPEN
  useEffect(() => {
    if (live) return;
    const a = document.activeElement;
    if (a instanceof HTMLElement && a.dataset.twin === 'chip') els.current.get('pad-open')?.focus({ preventScroll: true });
  }, [live]);

  // Les puces : juste apres OPEN, qui les decouvre (motif d'un bouton de divulgation)
  const chips =
    showChips &&
    CHIPS.map((c) => {
      const id = `chip-${c.id}`;
      const tab = live ? 0 : -1;
      // Focus clavier (focus-visible) : la puce reagit comme au survol
      const onFocus = (e: React.FocusEvent<HTMLElement>): void => {
        if (e.currentTarget.matches(':focus-visible')) stageRef.current?.setChipFocus(c.id);
      };
      const onBlur = (): void => stageRef.current?.setChipFocus(null);
      return c.href ? (
        <a
          key={id}
          ref={refFor(id)}
          className="v4-twin"
          data-twin="chip"
          data-chip={c.id}
          data-hotspot={id}
          href={c.href}
          target="_blank"
          rel={EXTERNAL_REL}
          aria-label={c.aria}
          tabIndex={tab}
          onKeyDown={linkSpace}
          onFocus={onFocus}
          onBlur={onBlur}
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
          aria-expanded={c.section !== null && open === c.section}
          aria-controls={c.section ? `v4-section-${c.section}` : undefined}
          tabIndex={tab}
          onKeyDown={noRepeat}
          onFocus={onFocus}
          onBlur={onBlur}
          onClick={() => chipAction(c.id)}
        />
      );
    });

  return (
    <div ref={groupRef} className="v4-twins" role="group" aria-label={TWIN_ARIA.group} aria-hidden={off || undefined}>
      {PADS.map((pad) => {
        const id = `pad-${pad.id}`;
        if (pad.kind === 'voice') {
          return (
            <button
              key={id}
              ref={refFor(id)}
              type="button"
              className="v4-twin"
              data-twin="pad"
              data-hotspot={id}
              aria-label={PAD_ARIA[pad.id]}
              aria-pressed={inst === pad.id}
              onKeyDown={noRepeat}
              onClick={() => padHit(pad.id, stageRef.current)}
            />
          );
        }
        if (pad.kind === 'page') {
          return (
            <button
              key={id}
              ref={refFor(id)}
              type="button"
              className="v4-twin"
              data-twin="page"
              data-hotspot={id}
              aria-label={`${title(pad.label)}, key ${pad.key}`}
              aria-expanded={open === pad.id}
              aria-controls={`v4-section-${pad.id}`}
              onKeyDown={noRepeat}
              onClick={() => page(pad.id, stageRef.current)}
            />
          );
        }
        return (
          <button
            key={id}
            ref={refFor(id)}
            type="button"
            className="v4-twin"
            data-twin="open"
            data-hotspot={id}
            aria-pressed={pressed}
            aria-label={OPEN_ARIA}
            onKeyDown={noRepeat}
            onClick={() => openToggle(stageRef.current, 'mm808')}
          />
        );
      })}
      {chips}
      {ENCODERS.map((enc) => {
        const id = `enc-${enc.id}`;
        const v = values[enc.id];
        const tempo = enc.id === 'tempo';
        return (
          <div
            key={id}
            ref={refFor(id)}
            className="v4-twin"
            data-twin="encoder"
            data-hotspot={id}
            role="slider"
            tabIndex={0}
            aria-label={isVoiceEnc(enc.id) ? (p.instrument ? `${enc.aria}, ${INST_NAMES[p.instrument]}` : `${enc.aria}, tap a pad first`) : enc.aria}
            aria-orientation="vertical"
            aria-valuemin={tempo ? BPM.min : potMin(enc.id) * 100}
            aria-valuemax={tempo ? BPM.max : 100}
            aria-valuenow={tempo ? v : pct(v)}
            aria-valuetext={dialText(enc.id, v)}
            onKeyDown={onDialKey(enc.id)}
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
        onClick={() => runToggle(stageRef.current)}
      />
      <button
        ref={refFor('clear')}
        type="button"
        className="v4-twin"
        data-twin="clear"
        data-hotspot="clear"
        aria-label={TWIN_ARIA.clear}
        onKeyDown={noRepeat}
        onClick={() => clearPattern(stageRef.current)}
      />
      <button
        ref={refFor('random')}
        type="button"
        className="v4-twin"
        data-twin="random"
        data-hotspot="random"
        aria-label={TWIN_ARIA.random}
        onKeyDown={noRepeat}
        onClick={() => randomPattern(stageRef.current)}
      />
      <button
        ref={refFor('mute')}
        type="button"
        className="v4-twin"
        data-twin="mute"
        data-hotspot="mute"
        aria-label={TWIN_ARIA.mute}
        aria-pressed={muteOn}
        onKeyDown={noRepeat}
        onClick={() => muteToggle(stageRef.current)}
      />
      <button
        ref={refFor('solo')}
        type="button"
        className="v4-twin"
        data-twin="solo"
        data-hotspot="solo"
        aria-label={TWIN_ARIA.solo}
        aria-pressed={v.solo !== null}
        onKeyDown={noRepeat}
        onClick={() => soloToggle(stageRef.current)}
      />
      {STEP_INDEXES.map((i) => {
        const on = inst ? isOn(p.steps, inst, i) : false;
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
            onKeyDown={(e) => {
              // Suppr ou retour arriere : le pas se vide (l'appui long du clavier)
              if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                stepClear(i, stage);
              } else noRepeat(e);
            }}
            onClick={() => stepToggle(i, stage)}
          />
        );
      })}
    </div>
  );
};

export default HitLayer;
