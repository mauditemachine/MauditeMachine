/**
 * La trace (spec 11.2), desktop seulement : une piste de circuit imprime
 * jaune, fine (1.5 px), qui part du knob actif (le centre projete du dessus
 * de son capuchon), sort de la machine vers la droite, se plie a angle
 * droit une ou deux fois et accroche le panneau a hauteur de son titre.
 * Dessinee en 400 ms par stroke-dashoffset (pathLength = 1 : la geometrie
 * peut changer pendant le dessin), puis un point lumineux la parcourt une
 * fois (350 ms). Elle suit le knob a chaque frame rendue par le Stage
 * (cadrage de section, parallaxe, taille) : deux points projetes, sans
 * allocation ni lecture de mise en page ; la boite du panneau est lue a
 * l'ouverture, a chaque changement de taille du panneau et de la fenetre,
 * jamais par frame (elle suivrait les ecritures de style des jumeaux et
 * forcerait un calcul de mise en page). Le chemin n'est reecrit que s'il a
 * change. Fermeture : fondu de 150 ms (CSS).
 * Reduced motion : la trace est posee d'un coup, sans dessin ni point.
 * Aucun draw call : c'est du SVG par-dessus le canvas, sans pointeur.
 */

import React, { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { Stage } from '../scene/renderer';
import { motion } from '../state/motion';
import { section } from '../state/section';
import { KNOB, NAV_KNOBS, NAV_ROW, TRACE, type NavId, type SectionId } from '../theme';

interface Props {
  stage: Stage | null;
  panelRef: React.RefObject<HTMLElement | null>;
  mobile: boolean;
}

export interface TraceDebug {
  on: boolean;
  section: NavId | null;
  /** chemin courant (px CSS de la scene) */
  d: string;
  /** depart (knob), coudes, arrivee (panneau) : [x0, y0, x1, y1, ...] */
  points: number[];
  /** 1 = rien de dessine, 0 = trace complete */
  dashoffset: number;
  dot: 'hidden' | 'running' | 'done';
  /** departs d'animation et routages */
  starts: number;
  routes: number;
}

export const traceDebug: TraceDebug = {
  on: false,
  section: null,
  d: '',
  points: [],
  dashoffset: 1,
  dot: 'hidden',
  starts: 0,
  routes: 0,
};

const NAV_IDS: readonly string[] = NAV_KNOBS.map((k) => k.id);
const isNav = (s: SectionId | null): s is NavId => s !== null && NAV_IDS.includes(s);
const r1 = (n: number): number => Math.round(n * 10) / 10;
/** Dessus du capuchon d'un knob de navigation (le point du picking) */
const KNOB_TOP = NAV_ROW.capY + KNOB.capH;

/** Boite du panneau, lue hors de la boucle : gauche hors transform, ancre (haut + 36), largeur. */
interface PanelBox {
  left: number;
  anchorY: number;
  width: number;
}

/** Points projetes reutilises : aucune allocation par frame. */
const kp = { x: 0, y: 0 };
const ep = { x: 0, y: 0 };

/**
 * Le trace du knob au panneau, ecrit dans out ([x0, y0, x1, y1, ...]) ;
 * renvoie le nombre de nombres ecrits (4 ou 8), 0 si le panneau manque.
 */
function route(stage: Stage, box: PanelBox, knobX: number, out: number[]): number {
  if (box.width === 0) return 0;
  stage.projectPlateau(knobX, KNOB_TOP, NAV_ROW.z, kp);
  const kx = r1(kp.x);
  const ky = r1(kp.y);
  // Bord droit projete de la machine : le coin (7, -4.5) du plateau
  const edge = stage.projectPlateau(TRACE.corner[0], 0, TRACE.corner[1], ep).x;
  const pl = box.left;
  const ay = box.anchorY;
  const x1 = Math.max(kx + TRACE.minRun, Math.min(edge + TRACE.clearance, pl - TRACE.panelGap));
  if (Math.abs(ky - ay) < TRACE.straightTol || x1 >= pl) {
    out[0] = kx;
    out[1] = ky;
    out[2] = r1(pl);
    out[3] = ky;
    return 4;
  }
  out[0] = kx;
  out[1] = ky;
  out[2] = r1(x1);
  out[3] = ky;
  out[4] = r1(x1);
  out[5] = r1(ay);
  out[6] = r1(pl);
  out[7] = r1(ay);
  return 8;
}

/** "M x0 y0 H x1 ..." : une ligne, ou trois segments a angle droit. */
const pathOf = (p: number[], n: number): string =>
  n === 4 ? `M${p[0]} ${p[1]}H${p[2]}` : `M${p[0]} ${p[1]}H${p[2]}V${p[5]}H${p[6]}`;

export const Trace: React.FC<Props> = ({ stage, panelRef, mobile }) => {
  const s = useSyncExternalStore(section.subscribe, section.get, section.get);
  const lineRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGPathElement>(null);
  const padRef = useRef<SVGCircleElement>(null);
  const on = !!stage && isNav(s) && !mobile;

  // Avant la peinture : jamais une frame de l'ancienne trace a la reouverture
  useLayoutEffect(() => {
    traceDebug.on = on;
    traceDebug.section = on && isNav(s) ? s : null;
    const line = lineRef.current;
    const dot = dotRef.current;
    const pad = padRef.current;
    const panel = panelRef.current;
    if (!on || !stage || !isNav(s) || !line || !dot || !pad || !panel) {
      if (dot) dot.style.opacity = '0';
      traceDebug.dot = 'hidden';
      return undefined;
    }
    const id: NavId = s;
    const knobX = NAV_KNOBS.find((k) => k.id === id)?.x ?? 0;
    const t0 = performance.now();
    let raf = 0;
    traceDebug.starts += 1;

    const box: PanelBox = { left: 0, anchorY: 0, width: 0 };
    /** La boite du panneau (seules lectures de mise en page de la trace). */
    const readPanel = (): void => {
      box.width = panel.offsetWidth;
      // Gauche hors transform (il glisse de 16 px en entrant) ; haut reel
      box.left = panel.offsetLeft;
      box.anchorY = panel.getBoundingClientRect().top + TRACE.anchorDy;
    };
    const pts = [0, 0, 0, 0, 0, 0, 0, 0];
    const prev = [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
    let prevN = 0;

    const reroute = (): void => {
      const n = route(stage, box, knobX, pts);
      if (n === 0) return;
      traceDebug.routes += 1;
      // Meme chemin : rien a reecrire, aucune chaine construite
      let same = n === prevN;
      for (let i = 0; same && i < n; i += 1) same = pts[i] === prev[i];
      if (same) return;
      for (let i = 0; i < n; i += 1) prev[i] = pts[i];
      prevN = n;
      const d = pathOf(pts, n);
      traceDebug.d = d;
      traceDebug.points = pts.slice(0, n);
      line.setAttribute('d', d);
      dot.setAttribute('d', d);
      pad.setAttribute('cx', String(pts[0]));
      pad.setAttribute('cy', String(pts[1]));
    };
    const onPanelResize = (): void => {
      readPanel();
      reroute();
    };

    /** Etat de l'animation a t ms du depart ; true tant qu'elle n'est pas finie. */
    const apply = (t: number): boolean => {
      const reduced = motion.reduced();
      const draw = reduced ? 1 : Math.min(1, Math.max(0, t / TRACE.drawMs));
      const off = 1 - draw;
      traceDebug.dashoffset = +off.toFixed(4);
      line.setAttribute('stroke-dashoffset', String(off));
      pad.style.opacity = draw > 0 ? '1' : '0';
      const u = (t - TRACE.dotDelayMs) / TRACE.dotMs;
      if (!reduced && u >= 0 && u < 1) {
        dot.style.opacity = '1';
        dot.setAttribute('stroke-dashoffset', String(-u));
        traceDebug.dot = 'running';
      } else {
        dot.style.opacity = '0';
        traceDebug.dot = reduced || u < 0 ? 'hidden' : 'done';
      }
      return !reduced && u < 1;
    };

    const frame = (now: number): void => {
      raf = 0;
      reroute();
      if (apply(Math.max(0, now - t0))) raf = requestAnimationFrame(frame);
    };

    readPanel();
    reroute();
    if (apply(0)) raf = requestAnimationFrame(frame);
    // La machine bouge (cadrage, parallaxe, taille) : la trace suit
    const offView = stage.onView(reroute);
    // Le panneau change de taille (dates chargees, autre section) ou la
    // fenetre (sa gauche et son haut en dependent) : l'ancre suit
    const ro = new ResizeObserver(onPanelResize);
    ro.observe(panel);
    window.addEventListener('resize', onPanelResize);
    return () => {
      if (raf !== 0) cancelAnimationFrame(raf);
      offView();
      ro.disconnect();
      window.removeEventListener('resize', onPanelResize);
    };
  }, [on, s, stage, panelRef]);

  return (
    <svg className="v4-trace" data-on={on ? '1' : '0'} aria-hidden="true" focusable="false">
      <path ref={lineRef} className="v4-trace-line" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} />
      <circle ref={padRef} className="v4-trace-pad" r={2.5} cx={0} cy={0} />
      <path ref={dotRef} className="v4-trace-dot" pathLength={1} strokeDasharray="0.001 2" />
    </svg>
  );
};

export default Trace;
