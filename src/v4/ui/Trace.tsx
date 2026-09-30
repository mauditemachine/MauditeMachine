/**
 * La trace (spec 11.2 et 20.2.7), desktop seulement : une piste de circuit
 * imprime jaune, fine (1.5 px), qui part de l'objet qui a ouvert la section
 * (le dessus du pad de la page, ou de la puce LIVE ou STUDIO), sort de la
 * machine vers la droite, se plie a angle droit une ou deux fois et
 * accroche le panneau a hauteur de son titre. Dessinee en 400 ms par
 * stroke-dashoffset (pathLength = 1 : la geometrie peut changer pendant le
 * dessin), puis un point lumineux la parcourt une fois (350 ms).
 * Revision 2 (l'orbite) : l'ancre est un point 3D reprojete a chaque frame
 * rendue par le Stage (stage.onView : la meme passe que le rendu), avec le
 * bord droit projete de la machine ; quand l'ancre sort du canvas, passe a
 * moins de 12 px du panneau ou se cache derriere la machine (rayon vers la
 * camera contre ses volumes), la trace s'efface (data-visible, fondu CSS
 * de 150 ms) et revient de meme, sans rejouer son dessin. Le panneau ne
 * bouge jamais (mise en page CSS seule). Aucune allocation par frame ; la
 * boite du panneau est lue a l'ouverture, a chaque changement de taille du
 * panneau et de la fenetre, jamais par frame. L'ancre (et son test
 * d'occultation) n'est reprojetee que dans la passe de rendu, et seulement
 * si la vue a change (hit.version : camera, calques, taille) ; la boucle
 * de l'animation du dessin ne fait qu'avancer le trait et le point. Le
 * chemin n'est reecrit que s'il a change. Fermeture : fondu de 150 ms (CSS).
 * Reduced motion : la trace est posee d'un coup, sans dessin ni point.
 * Aucun draw call : c'est du SVG par-dessus le canvas, sans pointeur.
 */

import React, { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { AnchorPoint, Stage } from '../scene/renderer';
import { motion } from '../state/motion';
import { section } from '../state/section';
import { TRACE, type SectionId } from '../theme';

interface Props {
  stage: Stage | null;
  panelRef: React.RefObject<HTMLElement | null>;
  mobile: boolean;
}

export interface TraceDebug {
  on: boolean;
  section: SectionId | null;
  /** section dont l'objet porte l'ancre (pad, puce), ou null */
  anchor: SectionId | null;
  /** ancre dans le canvas, loin du panneau, pas cachee par la machine */
  visible: boolean;
  /** chemin courant (px CSS de la scene) */
  d: string;
  /** depart (ancre), coudes, arrivee (panneau) : [x0, y0, x1, y1, ...] */
  points: number[];
  /** 1 = rien de dessine, 0 = trace complete */
  dashoffset: number;
  dot: 'hidden' | 'running' | 'done';
  /** departs d'animation, routages, bascules de visibilite */
  starts: number;
  routes: number;
  fades: number;
}

export const traceDebug: TraceDebug = {
  on: false,
  section: null,
  anchor: null,
  visible: false,
  d: '',
  points: [],
  dashoffset: 1,
  dot: 'hidden',
  starts: 0,
  routes: 0,
  fades: 0,
};

const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Boite du panneau, lue hors de la boucle : gauche hors transform, ancre (haut + 36), largeur. */
interface PanelBox {
  left: number;
  anchorY: number;
  width: number;
}

/** Ancre reutilisee : aucune allocation par frame. */
const ap: AnchorPoint = { x: 0, y: 0, visible: false };

/**
 * La trace de l'ancre au panneau, ecrite dans out ([x0, y0, x1, y1, ...]) ;
 * renvoie le nombre de nombres ecrits (4 ou 8), 0 si le panneau manque.
 * ap : l'ancre deja projetee.
 */
function route(stage: Stage, box: PanelBox, out: number[]): number {
  if (box.width === 0) return 0;
  const kx = r1(ap.x);
  const ky = r1(ap.y);
  // Bord droit projete de la machine : les coins de ses volumes visibles
  const edge = stage.machineRightEdge();
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
  const svgRef = useRef<SVGSVGElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGPathElement>(null);
  const padRef = useRef<SVGCircleElement>(null);
  const on = !!stage && !mobile && stage.hasAnchor(s);

  // Avant la peinture : jamais une frame de l'ancienne trace a la reouverture
  useLayoutEffect(() => {
    traceDebug.on = on;
    traceDebug.section = on ? s : null;
    traceDebug.anchor = on ? s : null;
    const svg = svgRef.current;
    const line = lineRef.current;
    const dot = dotRef.current;
    const pad = padRef.current;
    const panel = panelRef.current;
    if (!on || !stage || s === null || !svg || !line || !dot || !pad || !panel) {
      if (dot) dot.style.opacity = '0';
      traceDebug.dot = 'hidden';
      traceDebug.visible = false;
      return undefined;
    }
    const id: SectionId = s;
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
    /** visibilite ecrite dans data-visible (-1 : rien encore) */
    let shown = -1;
    /** vue du dernier routage (hit.version) ; -1 : a faire */
    let ver = -1;

    /** Reprojette l'ancre et reroute ; sans force, seulement si la vue a change. */
    const reroute = (force: boolean): void => {
      const v = stage.hit.version();
      if (!force && v === ver) return;
      ver = v;
      stage.projectAnchor(id, ap);
      // Visible : dans le canvas, pas cachee par la machine, et loin du panneau
      const vis = ap.visible && ap.x < box.left - TRACE.panelMargin ? 1 : 0;
      if (vis !== shown) {
        if (shown !== -1) traceDebug.fades += 1;
        shown = vis;
        svg.setAttribute('data-visible', vis ? '1' : '0');
        traceDebug.visible = vis === 1;
      }
      const n = route(stage, box, pts);
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
      // Sur place : aucune allocation par frame, meme pour la revue
      const dp = traceDebug.points;
      dp.length = n;
      for (let i = 0; i < n; i += 1) dp[i] = pts[i];
      line.setAttribute('d', d);
      dot.setAttribute('d', d);
      pad.setAttribute('cx', String(pts[0]));
      pad.setAttribute('cy', String(pts[1]));
    };
    const onPanelResize = (): void => {
      readPanel();
      reroute(true);
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

    // Le dessin seul : la geometrie suit la vue dans la passe de rendu (onView)
    const frame = (now: number): void => {
      raf = 0;
      if (apply(Math.max(0, now - t0))) raf = requestAnimationFrame(frame);
    };

    readPanel();
    reroute(true);
    if (apply(0)) raf = requestAnimationFrame(frame);
    // La vue bouge (orbite, cadrage, eclate, taille) : la trace suit, dans la
    // passe de rendu ; une frame rendue sans changement de vue (pas du
    // sequenceur, flash) ne relance ni projection ni test d'occultation
    const offView = stage.onView(() => reroute(false));
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
      svg.removeAttribute('data-visible');
    };
  }, [on, s, stage, panelRef]);

  return (
    <svg ref={svgRef} className="v4-trace" data-on={on ? '1' : '0'} aria-hidden="true" focusable="false">
      <path ref={lineRef} className="v4-trace-line" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} />
      <circle ref={padRef} className="v4-trace-pad" r={2.5} cx={0} cy={0} />
      <path ref={dotRef} className="v4-trace-dot" pathLength={1} strokeDasharray="0.001 2" />
    </svg>
  );
};

export default Trace;
