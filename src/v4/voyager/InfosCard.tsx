/**
 * La carte INFOS du MM-ARP (2026-10-08, Mika : "excellent pour le bouton
 * INFO ! je veux un petit bouton i dans l'ecran a activer et de ce fait on
 * peut voir les infos au survol"). La meme carte que celle du MM-BASS
 * (bass/InfosCard.tsx, ses classes v4-binfo de bass/infos.css, reprises
 * telles quelles : les deux machines se lisent pareil), sur son propre
 * store (state/voyInfos.ts) :
 * - allume (le i du grand ecran, I), une commande survolee (souris) ou
 *   touchee (doigt) : sa carte, la section en petites capitales, le nom, le
 *   dessin en direct (voyager/diagrams.ts, refait des valeurs du moment),
 *   le texte, l'astuce (voyager/infos.ts) ;
 * - desktop : au-dessus de la commande, en dessous ou de cote si elle
 *   sortirait de l'ecran ; 250 ms avant d'apparaitre au survol ;
 * - telephone : une feuille ; toucher ailleurs qu'une commande du MM-ARP
 *   (ou la carte) la range. Elle ne couvre jamais le grand ecran (revue du
 *   2026-10-08 : en bas sur 45 % de la hauteur, elle cachait la bande des
 *   accords, l'echo, et toutes les commandes dessous, a toucher deux fois) :
 *   du cote oppose a la commande touchee, au-dessus de l'ecran pour une
 *   commande du plateau (les commandes voisines restent a portee : les
 *   toucher change la carte), dessous pour une du panneau ; l'ecran hors
 *   champ, en bas comme avant ;
 * - la pastille INFOS: HOVER A CONTROL (au telephone : TAP A CONTROL) et sa
 *   croix tant que le mode est allume et le MM-ARP a l'ecran.
 * Eteint, rien n'ecoute la vue. Montee par index.tsx hors de .v4-stage.
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { pattern } from '../audio/pattern';
import { useMedia } from '../hooks/useMedia';
import type { Stage } from '../scene/renderer';
import { focus } from '../state/focus';
import { voyInfos } from '../state/voyInfos';
import { MOBILE_QUERY } from '../theme';
import { arp } from './arp';
import { CHORDS } from './chords';
import { voyDiagram, type VoyDiagram, type VoyInfoId } from './diagrams';
import { VOY_INFOS } from './infos';
import { voyInfoIdOf } from './infoIds';
import { voyParams, type VoyKnobId } from './params';
import { VOY_LCD } from './theme';
import '../bass/infos.css';
import './infos.css';

const HOVER_IN_MS = 250;
const HOVER_OUT_MS = 120;
const GAP = 12;
const EDGE = 12;
const TOP_EDGE = 64;

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
/** La feuille du telephone : un jour sous ou sur le cadre du grand ecran, une hauteur utile minimale (sinon, en bas comme avant). */
const SHEET_GAP = 8;
const SHEET_MIN = 170;

/** Le cadre du grand ecran projete (px de la fenetre) : son haut et son bas, null s'il n'est pas a l'ecran. */
function screenBand(stage: Stage): { y0: number; y1: number } | null {
  const rig = stage.voy;
  if (!rig) return null;
  const L = VOY_LCD;
  const host = document.querySelector('.v4-canvas-host')?.getBoundingClientRect();
  const off = host ? host.top : 0;
  const o = { x: 0, y: 0 };
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    stage.hit.project(rig.lid, L.x + (sx * L.bezel.w) / 2, L.bezel.h, L.z + (sz * L.bezel.d) / 2, o);
    y0 = Math.min(y0, o.y + off);
    y1 = Math.max(y1, o.y + off);
  }
  if (!Number.isFinite(y0) || !Number.isFinite(y1) || y1 <= 0 || y0 >= window.innerHeight) return null;
  return { y0, y1 };
}

const DiagramSvg: React.FC<{ d: VoyDiagram }> = ({ d }) => (
  <svg className="v4-binfo-svg" viewBox={`0 0 ${d.w} ${d.h}`} aria-hidden="true" focusable="false">
    {d.paths.map((p, i) => (
      <path key={`p${i}`} d={p.d} className={`r-${p.role}${p.fill ? ' f' : ''}`} />
    ))}
    {d.texts.map((t, i) => (
      <text key={`t${i}`} x={t.x} y={t.y} className={`t-${t.role}`} textAnchor={t.anchor ?? 'start'}>
        {t.text}
      </text>
    ))}
  </svg>
);

/** Les potards (face et TWEAKS) : leur valeur ; un pad : son accord ; le reste : l'accord qui joue, sinon le premier. */
const isKnob = (id: VoyInfoId): id is VoyKnobId => id in voyParams.get();

interface CardProps {
  stage: Stage | null;
  hotspot: string;
  id: VoyInfoId;
  sheet: boolean;
  pinned: boolean;
}

const Card: React.FC<CardProps> = ({ stage, hotspot, id, sheet, pinned }) => {
  const values = useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
  const bpm = useSyncExternalStore(pattern.subscribe, () => pattern.get().bpm, () => pattern.get().bpm);
  const prog = useSyncExternalStore(arp.subscribe, () => arp.get().prog, () => arp.get().prog);
  const ref = useRef<HTMLDivElement>(null);
  const info = VOY_INFOS[id];
  const pad = hotspot.startsWith('vpad-') ? Number(hotspot.slice(5)) : -1;
  // Le dessin d'un pad : son accord ; des autres commandes : le premier accord de la progression (F#m sans progression)
  const chord = pad >= 0 ? pad : prog[0] ?? 0;
  const diagram = voyDiagram(id, { v: isKnob(id) ? values[id] : 0, values, bpm, chord });
  const title = pad >= 0 && CHORDS[pad] ? `${info.title}  ${CHORDS[pad].label}` : info.title;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || sheet || !stage) return undefined;
    const i = stage.hit.ids().indexOf(hotspot);
    let cw = el.offsetWidth;
    let ch = el.offsetHeight;
    let last = '';
    const place = (): void => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let t = 'translate(-9999px, 0)';
      if (i >= 0) {
        const r = stage.hit.rects();
        const x = r[i * 4];
        const y = r[i * 4 + 1];
        const w = r[i * 4 + 2];
        const h = r[i * 4 + 3];
        const seen = w > 0 && h > 0 && x + w > 0 && x < vw && y + h > 0 && y < vh;
        if (seen) {
          let left = clamp(x + w / 2 - cw / 2, EDGE, vw - cw - EDGE);
          let top = y - ch - GAP;
          let side = 'above';
          if (top < TOP_EDGE) {
            top = y + h + GAP;
            side = 'below';
            if (top + ch > vh - EDGE) {
              side = 'side';
              top = clamp(y + h / 2 - ch / 2, TOP_EDGE, vh - ch - EDGE);
              left = x + w + GAP;
              if (left + cw > vw - EDGE) left = x - cw - GAP;
              left = clamp(left, EDGE, vw - cw - EDGE);
            }
          }
          t = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
          el.dataset.side = side;
        }
      }
      if (t !== last) {
        el.style.transform = t;
        last = t;
      }
    };
    place();
    const ro = new ResizeObserver(() => {
      cw = el.offsetWidth;
      ch = el.offsetHeight;
      place();
    });
    ro.observe(el);
    const a = stage.onView(place);
    const b = stage.onIdle(place);
    window.addEventListener('resize', place);
    return () => {
      ro.disconnect();
      a();
      b();
      window.removeEventListener('resize', place);
    };
  }, [stage, hotspot, sheet]);

  // Telephone : la feuille du cote oppose a la commande, sans jamais couvrir le grand ecran
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !sheet || !stage) return undefined;
    const i = stage.hit.ids().indexOf(hotspot);
    let last = '';
    const place = (): void => {
      const vh = window.innerHeight;
      const band = screenBand(stage);
      let where: 'top' | 'bottom' | 'dock' = 'dock';
      let top = 0;
      let max = 0;
      if (band && i >= 0) {
        const r = stage.hit.rects();
        const host = document.querySelector('.v4-canvas-host')?.getBoundingClientRect();
        const cy = (host ? host.top : 0) + r[i * 4 + 1] + r[i * 4 + 3] / 2;
        // En haut : sous la pastille INFOS (elle reste a portee pour eteindre) ; en bas : au-dessus de la barre de Safari
        const chip = document.querySelector('.v4-vinfo-chip')?.getBoundingClientRect();
        const upTop = Math.max(TOP_EDGE, chip && chip.height > 0 ? chip.bottom + SHEET_GAP : TOP_EDGE);
        const up = band.y0 - SHEET_GAP - upTop;
        const bar = parseFloat(getComputedStyle(el).getPropertyValue('--ios-bar')) || 0;
        const downTop = band.y1 + SHEET_GAP;
        const down = vh - bar - downTop;
        const below = cy >= band.y1 - 1;
        const above = cy <= band.y0 + 1;
        const useUp = below ? up >= SHEET_MIN : above ? down < SHEET_MIN && up >= SHEET_MIN : up > down && up >= SHEET_MIN;
        if (useUp) {
          where = 'top';
          top = upTop;
          max = up;
        } else if (down >= SHEET_MIN) {
          where = 'bottom';
          max = down;
        }
      }
      const key = `${where}|${Math.round(top)}|${Math.round(max)}`;
      if (key === last) return;
      last = key;
      el.dataset.place = where;
      const parent = el.offsetParent instanceof HTMLElement ? el.offsetParent.getBoundingClientRect().top : 0;
      el.style.top = where === 'top' ? `${Math.round(top - parent)}px` : '';
      el.style.bottom = where === 'top' ? 'auto' : '';
      el.style.maxHeight = where === 'dock' ? '' : `${Math.floor(max)}px`;
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
  }, [stage, hotspot, sheet]);

  // Montree au doigt : toucher ailleurs qu'une commande du MM-ARP la range ; toucher la carte aussi
  useEffect(() => {
    if (!pinned) return undefined;
    const onDown = (e: PointerEvent): void => {
      const t = e.target;
      if (t instanceof Node && ref.current?.contains(t)) {
        voyInfos.hide();
        return;
      }
      if (t instanceof Element && t.closest('.v4-vinfo-chip')) return;
      if (stage && t instanceof Element && t.closest('.v4-stage')) {
        const host = document.querySelector('.v4-canvas-host');
        const r = host?.getBoundingClientRect();
        const h = r ? stage.hit.pick(e.clientX - r.left, e.clientY - r.top, e.pointerType !== 'mouse') : null;
        if (h && voyInfoIdOf(h.id)) return;
      }
      voyInfos.hide();
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [pinned, stage]);

  return (
    <div ref={ref} className="v4-binfo v4-vinfo" data-mode={sheet ? 'sheet' : 'float'} role="note" aria-live="polite" lang="fr">
      {sheet && <span className="v4-binfo-grab" aria-hidden="true" />}
      <div className="v4-binfo-head">
        <span className="v4-binfo-sec">{info.section}</span>
        <span className="v4-binfo-sec">MM-ARP</span>
      </div>
      <div className="v4-binfo-title">{title}</div>
      {diagram && <DiagramSvg d={diagram} />}
      <p className="v4-binfo-text">{info.text}</p>
      {info.tip && (
        <p className="v4-binfo-tip">
          <span className="v4-binfo-tipk">Astuce</span>
          {info.tip}
        </p>
      )}
    </div>
  );
};

/** La pastille du mode : desktop, au-dessus du coin gauche du MM-ARP ; telephone, sous le selecteur des machines. */
const Chip: React.FC<{ stage: Stage | null; sheet: boolean }> = ({ stage, sheet }) => {
  const ref = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || sheet || !stage) return undefined;
    let last = '';
    const place = (): void => {
      const b = stage.hit.machineBox('voy');
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const t = b ? `translate(${Math.round(clamp(b.x + 8, EDGE, vw - el.offsetWidth - EDGE))}px, ${Math.round(clamp(b.y - 44, TOP_EDGE, vh - 44))}px)` : `translate(${EDGE}px, ${TOP_EDGE}px)`;
      if (t !== last) {
        el.style.transform = t;
        last = t;
      }
    };
    place();
    const a = stage.onView(place);
    const c = stage.onIdle(place);
    window.addEventListener('resize', place);
    return () => {
      a();
      c();
      window.removeEventListener('resize', place);
    };
  }, [stage, sheet]);
  return (
    <button ref={ref} type="button" className="v4-binfo-chip v4-vinfo-chip" data-mode={sheet ? 'sheet' : 'float'} aria-label="INFOS on: turn the MM-ARP help off" onClick={() => voyInfos.set(false)}>
      <span className="v4-binfo-dot" aria-hidden="true" />
      {sheet ? 'INFOS: TAP A CONTROL' : 'INFOS: HOVER A CONTROL'}
      <span className="v4-binfo-x" aria-hidden="true">
        <svg viewBox="0 0 10 10" width="8" height="8">
          <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" />
        </svg>
      </span>
    </button>
  );
};

export const VoyInfosCard: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const st = useSyncExternalStore(voyInfos.subscribe, voyInfos.get, voyInfos.get);
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const sheet = useMedia(MOBILE_QUERY);
  const want = st.on && st.id && voyInfoIdOf(st.id) ? st.id : null;
  const [shown, setShown] = useState<string | null>(null);
  const shownRef = useRef<string | null>(null);
  shownRef.current = shown;

  useEffect(() => {
    if (!want) {
      if (!shownRef.current) return undefined;
      const t = window.setTimeout(() => setShown(null), st.on ? HOVER_OUT_MS : 0);
      return () => window.clearTimeout(t);
    }
    if (shownRef.current || st.pinned || sheet) {
      setShown(want);
      return undefined;
    }
    const t = window.setTimeout(() => setShown(want), HOVER_IN_MS);
    return () => window.clearTimeout(t);
  }, [want, st.pinned, st.on, sheet]);

  // Une autre machine a l'ecran : la carte se range (le mode reste, le i aussi)
  useEffect(() => {
    if (f !== 'voy') voyInfos.hide();
  }, [f]);

  if (!st.on) return null;
  const id = shown ? voyInfoIdOf(shown) : null;
  return (
    <>
      {f === 'voy' && <Chip stage={stage} sheet={sheet} />}
      {f === 'voy' && shown && id && <Card key={shown} stage={stage} hotspot={shown} id={id} sheet={sheet} pinned={st.pinned} />}
    </>
  );
};

export default VoyInfosCard;
