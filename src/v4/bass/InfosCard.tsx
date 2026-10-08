/**
 * La carte INFOS du MM-BASS (2026-10-08, Mika : "un bouton INFOS : quand je
 * survole chaque parametre du BASS, j'ai un descriptif qui vient dessus, du
 * texte et meme une image"). Elle lit le store state/bassInfos.ts :
 * - allume, une commande survolee (souris) ou touchee (doigt) : sa carte,
 *   la section en petites capitales, le nom, le dessin en direct
 *   (bass/diagrams.ts, refait des valeurs du moment ; en LOCK, celle du pas),
 *   le texte, l'astuce (bass/infos.ts) ;
 * - desktop : au-dessus de la commande (son rectangle de picking, celui des
 *   jumeaux), en dessous ou de cote si elle sortirait de l'ecran ; 250 ms
 *   avant d'apparaitre au survol, sans pointeur, un court fondu ;
 * - telephone : une feuille en bas de l'ecran, le meme contenu ; toucher
 *   ailleurs que sur une commande du MM-BASS la range ;
 * - la pastille INFOS ON (et sa croix) tant que le mode est allume et le
 *   MM-BASS a l'ecran : la toucher eteint INFOS.
 * La carte reste sombre dans les deux apparences, comme les ecrans des
 * machines. Eteint, rien n'ecoute la vue (pas de cout par image).
 * Montee par index.tsx hors de .v4-stage (la pastille ne lance pas
 * l'orbite) ; les coordonnees du canvas sont celles de la page.
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { pattern } from '../audio/pattern';
import { useMedia } from '../hooks/useMedia';
import type { Stage } from '../scene/renderer';
import { bassInfos } from '../state/bassInfos';
import { focus } from '../state/focus';
import { MOBILE_QUERY } from '../theme';
import { arp } from '../voyager/arp';
import { CHORDS } from '../voyager/chords';
import { bassKnobValue } from './actions';
import { bassDiagram, type BassDiagram } from './diagrams';
import { BASS_INFOS, bassInfoIdOf, isBassInfoKnob, type BassInfoId } from './infos';
import { bassParams } from './params';
import { bassState, isLockable } from './state';
import './infos.css';

/** Le survol attend un peu (on traverse la machine sans semer des cartes) ; une sortie breve garde la carte. */
const HOVER_IN_MS = 250;
const HOVER_OUT_MS = 120;
/** Les marges de la carte flottante (le haut garde l'en-tete). */
const GAP = 12;
const EDGE = 12;
const TOP_EDGE = 64;

const ROOT_NAMES = ['F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F'] as const;
const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

/** Le dessin en SVG : les roles en classes (infos.css), la boite 240 x 120. */
const DiagramSvg: React.FC<{ d: BassDiagram }> = ({ d }) => (
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

interface CardProps {
  stage: Stage | null;
  hotspot: string;
  id: BassInfoId;
  sheet: boolean;
  pinned: boolean;
}

/** La carte d'une commande ; ses abonnements (valeurs, pas, tempo, accords) ne vivent que tant qu'elle est montree. */
const Card: React.FC<CardProps> = ({ stage, hotspot, id, sheet, pinned }) => {
  const values = useSyncExternalStore(bassParams.subscribe, bassParams.get, bassParams.get);
  const s = useSyncExternalStore(bassState.subscribe, bassState.get, bassState.get);
  const bpm = useSyncExternalStore(pattern.subscribe, () => pattern.get().bpm, () => pattern.get().bpm);
  const prog = useSyncExternalStore(arp.subscribe, () => arp.get().prog, () => arp.get().prog);
  const ref = useRef<HTMLDivElement>(null);
  const info = BASS_INFOS[id];
  const knob = isBassInfoKnob(id) ? id : null;
  const lockStep = s.lock >= 0 ? s.steps[s.lock] : undefined;
  const locked = !!knob && !!lockStep && isLockable(knob) && lockStep.locks?.[knob] !== undefined;
  const diagram = bassDiagram(id, {
    v: knob ? bassKnobValue(knob) : 0,
    values: lockStep?.locks ? { ...values, ...lockStep.locks } : values,
    bpm,
    steps: s.steps,
    arpRoots: prog.map((c) => ROOT_NAMES[((CHORDS[c]?.root ?? 0) % 12 + 12) % 12]),
  });

  // Desktop : la carte suit sa commande, a chaque image rendue (seulement tant qu'elle est la)
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
              // Ni dessus ni dessous : de cote (a droite, sinon a gauche)
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

  // Montree au doigt : toucher ailleurs que sur une commande du MM-BASS la range (une autre commande prend la place) ;
  // toucher la carte elle-meme la range aussi (2026-10-08 : au telephone, la feuille couvrait CLOSE et la rangee du bas)
  useEffect(() => {
    if (!pinned) return undefined;
    const onDown = (e: PointerEvent): void => {
      const t = e.target;
      if (t instanceof Node && ref.current?.contains(t)) {
        bassInfos.hide();
        return;
      }
      if (t instanceof Element && t.closest('.v4-binfo-chip')) return;
      if (stage && t instanceof Element && t.closest('.v4-stage')) {
        const host = document.querySelector('.v4-canvas-host');
        const r = host?.getBoundingClientRect();
        const h = r ? stage.hit.pick(e.clientX - r.left, e.clientY - r.top, e.pointerType !== 'mouse') : null;
        if (h && h.id.startsWith('bass-')) return;
      }
      bassInfos.hide();
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [pinned, stage]);

  return (
    <div ref={ref} className="v4-binfo" data-mode={sheet ? 'sheet' : 'float'} role="note" aria-live="polite" lang="fr">
      {sheet && <span className="v4-binfo-grab" aria-hidden="true" />}
      <div className="v4-binfo-head">
        <span className="v4-binfo-sec">{info.section}</span>
        {locked && <span className="v4-binfo-lock">LOCK {String(s.lock + 1).padStart(2, '0')}</span>}
      </div>
      <div className="v4-binfo-title">{info.title}</div>
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

/** La pastille INFOS ON : desktop, au-dessus du coin gauche du MM-BASS ; telephone, sous l'en-tete (infos.css). */
const Chip: React.FC<{ stage: Stage | null; sheet: boolean }> = ({ stage, sheet }) => {
  const ref = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || sheet || !stage) return undefined;
    let last = '';
    const place = (): void => {
      const b = stage.hit.machineBox('bass');
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
    <button ref={ref} type="button" className="v4-binfo-chip" data-mode={sheet ? 'sheet' : 'float'} aria-label="INFOS on: turn the MM-BASS help off" onClick={() => bassInfos.set(false)}>
      <span className="v4-binfo-dot" aria-hidden="true" />
      INFOS ON
      <span className="v4-binfo-x" aria-hidden="true">
        <svg viewBox="0 0 10 10" width="8" height="8">
          <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" />
        </svg>
      </span>
    </button>
  );
};

export const BassInfosCard: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const st = useSyncExternalStore(bassInfos.subscribe, bassInfos.get, bassInfos.get);
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const sheet = useMedia(MOBILE_QUERY);
  const want = st.on && st.id && bassInfoIdOf(st.id) ? st.id : null;
  const [shown, setShown] = useState<string | null>(null);
  const shownRef = useRef<string | null>(null);
  shownRef.current = shown;

  useEffect(() => {
    if (!want) {
      if (!shownRef.current) return undefined;
      const t = window.setTimeout(() => setShown(null), st.on ? HOVER_OUT_MS : 0);
      return () => window.clearTimeout(t);
    }
    // Deja une carte, un toucher, le telephone : tout de suite ; un survol neuf : apres un instant
    if (shownRef.current || st.pinned || sheet) {
      setShown(want);
      return undefined;
    }
    const t = window.setTimeout(() => setShown(want), HOVER_IN_MS);
    return () => window.clearTimeout(t);
  }, [want, st.pinned, st.on, sheet]);

  if (!st.on) return null;
  const id = shown ? bassInfoIdOf(shown) : null;
  return (
    <>
      {f === 'bass' && <Chip stage={stage} sheet={sheet} />}
      {shown && id && <Card key={shown} stage={stage} hotspot={shown} id={id} sheet={sheet} pinned={st.pinned} />}
    </>
  );
};

export default BassInfosCard;
