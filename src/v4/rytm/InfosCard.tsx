/**
 * La carte INFOS du MM-RYTM (2026-10-08, l'etape R4, Mika : "excellent pour
 * le bouton INFO ! je veux un petit bouton i dans l'ecran a activer et de ce
 * fait on peut voir les infos au survol.. et je veux la meme chose pour RYTM
 * aussi !"). La meme carte que celles du MM-BASS et du MM-ARP (les classes
 * v4-binfo de bass/infos.css, reprises telles quelles : les machines se
 * lisent pareil), sur son propre store (state/rytmInfos.ts) :
 * - allume (le i de l'ecran, I, rytm:infos, la touche INFOS du Dock), une
 *   commande survolee (souris) ou touchee (doigt) : sa carte, la section en
 *   petites capitales (la page et la lettre du bloc : SRC B), la voix ou
 *   LOCK 05 a droite, le nom, le dessin en direct (rytm/diagrams.ts, refait
 *   des valeurs du moment ; en LOCK, celles du pas), le texte et l'astuce
 *   (rytm/infos.ts) ; un encodeur de page montre le reglage qu'il tient sur
 *   la page allumee, pour la voix choisie (pageTarget : la meme table que
 *   l'ecran), et l'ecran marque son bloc de quatre coins ;
 * - desktop : au-dessus de la commande (dessous pour les encodeurs de page,
 *   les touches de page, MASTER, TEMPO et l'ecran : la carte ne cache pas
 *   l'ecran dont elle parle), de cote si elle sortirait ; 250 ms avant
 *   d'apparaitre au survol ;
 * - telephone : une feuille du cote oppose a la commande touchee (en bas
 *   pour l'ecran et les encodeurs, en haut pour les pads, le transport et
 *   les pas ; en haut pour le Dock), qui ne la couvre jamais ; toucher
 *   ailleurs qu'une commande du MM-RYTM (ou la carte) la range ;
 * - la pastille INFOS: HOVER A CONTROL (au telephone : TAP A CONTROL) et sa
 *   croix tant que le mode est allume et le MM-RYTM a l'ecran ; capot ouvert
 *   (l'ecran est alors hors champ, avec le panneau leve), une pastille INFOS
 *   l'allume, pour lire la plaque TWEAKS.
 * Eteint (et capot ferme), rien n'ecoute la vue. Montee par index.tsx hors
 * de .v4-stage.
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { anyDialValue, dialValue, lockMode, lockSamples, pageLockView, pageSlotOf, stepPlays, subscribeDials, type DialId } from '../actions';
import { familyOf, kit, kitMachineNames, kitSampleNames, kitSoundIndex, kitSoundNames, type KitFamily, type KitId } from '../audio/kit';
import { lockMask, lockOf } from '../audio/locks';
import { pattern } from '../audio/pattern';
import type { ShotId } from '../audio/shotsdsp';
import { useMedia } from '../hooks/useMedia';
import type { Stage } from '../scene/renderer';
import { editor } from '../state/editor';
import { explode } from '../state/explode';
import { focus } from '../state/focus';
import { presetMode } from '../state/presetMode';
import { rytmInfos } from '../state/rytmInfos';
import { rytmLock } from '../state/rytmLock';
import { rytmPage } from '../state/rytmPage';
import { MOBILE_QUERY, type EncId, type Inst } from '../theme';
import { rytmDiagram, rytmInfoHit, type RytmDiagram, type RytmDiagramCtx } from './diagrams';
import { infoOf, type RytmInfo, type RytmInfoCtx, type RytmLockable } from './infos';
import '../bass/infos.css';
import './infos.css';

const HOVER_IN_MS = 250;
const HOVER_OUT_MS = 120;
const GAP = 12;
const EDGE = 12;
const TOP_EDGE = 64;
/** La feuille du telephone : son jour avec la commande, une hauteur utile minimale (sinon, en bas comme au MM-BASS). */
const SHEET_GAP = 8;
const SHEET_MIN = 170;

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
const two = (n: number): string => (n < 10 ? `0${n}` : String(n));

const DiagramSvg: React.FC<{ d: RytmDiagram }> = ({ d }) => (
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

/** Ce que la carte montre : la carte, son dessin, ce qui va a droite de la section (la voix, LOCK 05). */
export interface Model {
  info: RytmInfo;
  diagram: RytmDiagram | null;
  tag: string;
  locked: boolean;
}

/** La famille d'un potard de la plaque TWEAKS (KICK pour TUNE...), la voix sinon. */
function plateFamily(k: string, voice: Inst | null): KitFamily | null {
  if (k === 'bd' || k === 'tune' || k === 'attack' || k === 'decay' || k === 'drive') return 'bd';
  if (k === 'sd' || k === 'snappy') return 'sd';
  if (k === 'cp' || k === 'hh' || k === 'tom') return k;
  if (k === 'gate') return voice === 'CP' ? 'cp' : 'sd';
  return null;
}

/**
 * La carte d'une zone de saisie du MM-RYTM, avec les valeurs du moment (null
 * : pas une commande du MM-RYTM). Lue a chaque changement d'un store (le
 * motif, le kit, la page, le LOCK) ; rendue aussi pour les tests.
 */
export function modelOf(hotspot: string): Model | null {
  const hit = rytmInfoHit(hotspot);
  if (!hit) return null;
  const p = pattern.get();
  const voice = p.instrument;
  const rp = rytmPage.get();
  const lockStep = lockMode() ? rytmLock.get().step : -1;
  const shownLock = voice && lockStep >= 0 ? lockOf(p.locks, voice, lockStep) : null;
  const ctx: RytmInfoCtx = { voice, page: rp.page };
  const dc: RytmDiagramCtx = { v: 0, voice, page: rp.page, bpm: p.bpm, steps: voice ? p.steps[voice] : undefined, lockMask: voice ? lockMask(p.locks, voice) : 0, step: lockStep };
  let id = hit.id;
  let locked = false;
  let tag = '';
  // Le son de la famille de la voix (avec les verrous du pas en LOCK) : le dessin du kick, de la caisse claire
  const f = voice ? familyOf(voice as ShotId) : null;
  const knobs = kit.get().knob;
  dc.kit = { tune: knobs.tune, attack: knobs.attack, decay: knobs.decay, drive: knobs.drive, snappy: knobs.snappy, gate: knobs.gate };
  const plays = voice && f ? stepPlays(voice, shownLock) : null;
  if (plays) {
    dc.model = plays.model;
    // ATTACK, DRIVE, SNAPPY (BOTH) : le dessin du sample quand lui seul s'entend, celui de la machine sinon
    dc.sample = plays.smp && !plays.synth;
  }
  const pe = /^p:([0-7])$/.exec(id);
  if (pe) {
    // Un encodeur de page : le reglage de son bloc (la table de pages.ts, via actions.ts), sa valeur (celle du pas en LOCK)
    const k = Number(pe[1]);
    const slot = pageSlotOf(k);
    const target = slot && slot.label ? slot.target : null;
    ctx.target = target;
    dc.target = target;
    if (slot && target) {
      const lk: RytmLockable = slot.lock === 'vel' ? 'vel' : slot.lock ? 'yes' : slot.scope === 'all' ? 'global' : 'no';
      ctx.lockable = lk;
      dc.v = anyDialValue(`p:${k}` as DialId);
      if (lockStep >= 0) {
        ctx.step = lockStep;
        locked = lk === 'yes' && !!voice && pageLockView(k, lockStep) !== null;
      }
      if (target === 'l:mach') {
        dc.sounds = kitMachineNames();
        dc.synths = dc.sounds.length;
        dc.index = Math.round(dc.v);
      } else if (target === 'smpl:sample') {
        dc.sounds = lockStep >= 0 && voice ? lockSamples(voice).map((x) => x.label) : f ? kitSampleNames(f) : ['OFF'];
        dc.synths = 1;
        dc.index = Math.round(dc.v);
      }
      // La couche de ce reglage se tait (R3) : la carte le dit, comme le bloc en retrait de l'ecran
      const off = !plays ? '' : slot.layer === 'synth' && !plays.synth ? 'SYNTH OFF' : slot.layer === 'sample' && !plays.smp ? 'SAMPLE OFF' : slot.both && !plays.synth && !plays.smp ? 'SILENT' : '';
      tag = slot.scope === 'all' ? 'ALL' : [voice ?? '', off].filter(Boolean).join('  ');
    }
  } else if (hit.plate && id.startsWith('r:')) {
    // La plaque TWEAKS (OPEN) : son potard, la famille qu'il regle
    const k = id.slice(2);
    ctx.plate = true;
    const pf = plateFamily(k, voice);
    if (pf && pf === k) {
      dc.sounds = kitSoundNames(pf);
      dc.synths = 3;
      dc.index = kitSoundIndex(pf);
      dc.v = dc.index;
    } else dc.v = kit.value(k as KitId);
    if (pf) {
      dc.model = kit.get().model[pf];
      dc.sample = !!kit.get().sample[pf] && kit.layerOf(pf).lev > 0 && !(kit.layerOf(pf).syn > 0);
    }
  } else if (id === 'step') {
    const i = hit.step ?? -1;
    // Le pas en LOCK : la carte du LOCK
    if (i >= 0 && i === rytmLock.get().step && editor.get() !== 'mm808') id = 'lock';
    ctx.step = i;
    dc.step = i;
    tag = voice ?? '';
  } else if (id === 'screen') {
    // L'ecran : ce qu'il montre (les presets, EDIT, HOME, la vue PAGE)
    if (presetMode.on('mm808')) id = 'presets';
    else if (editor.get() === 'mm808') id = 'edit';
    else if (rp.view === 'home' && lockStep < 0) id = 'home';
  } else if (id === 'level') dc.v = dialValue('level' as EncId);
  else if (id === 'tempo') dc.v = p.bpm;
  const info = infoOf(id, ctx);
  if (!info) return null;
  return { info, diagram: rytmDiagram(id, dc), tag: locked ? `LOCK ${two(lockStep + 1)}` : tag, locked };
}

/** Un compteur qui suit les stores lus par la carte (les potards, le motif, la page, le LOCK, les presets, EDIT). */
function useRytmTick(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const bump = (): void => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        setN((x) => x + 1);
      });
    };
    const offs = [subscribeDials(bump), rytmPage.subscribe(bump), presetMode.subscribe(bump), editor.subscribe(bump)];
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      for (const off of offs) off();
    };
  }, []);
  return n;
}

/** Desktop : la carte sous ces commandes (elle ne cache pas l'ecran dont elle parle). */
const BELOW = /^(penc-|pkey-|lcd-|enc-)/;

interface CardProps {
  stage: Stage | null;
  hotspot: string;
  sheet: boolean;
  pinned: boolean;
  dock: boolean;
}

const Card: React.FC<CardProps> = ({ stage, hotspot, sheet, pinned, dock }) => {
  // Refaite a chaque changement d'un store qu'elle lit (le compteur fait le rendu)
  useRytmTick();
  const ref = useRef<HTMLDivElement>(null);
  const m = modelOf(hotspot);

  // Desktop : la carte suit sa commande, a chaque image rendue (seulement tant qu'elle est la)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || sheet || !stage) return undefined;
    const i = stage.hit.ids().indexOf(hotspot);
    const below = BELOW.test(hotspot);
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
          const left0 = clamp(x + w / 2 - cw / 2, EDGE, vw - cw - EDGE);
          const up = y - ch - GAP;
          const down = y + h + GAP;
          const fitsUp = up >= TOP_EDGE;
          const fitsDown = down + ch <= vh - EDGE;
          let left = left0;
          let top: number;
          let side: string;
          if (below ? fitsDown : !fitsUp && fitsDown) {
            top = down;
            side = 'below';
          } else if (fitsUp) {
            top = up;
            side = 'above';
          } else {
            // Ni dessus ni dessous : de cote (a droite, sinon a gauche)
            side = 'side';
            top = clamp(y + h / 2 - ch / 2, TOP_EDGE, vh - ch - EDGE);
            left = x + w + GAP;
            if (left + cw > vw - EDGE) left = x - cw - GAP;
            left = clamp(left, EDGE, vw - cw - EDGE);
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

  // Telephone : la feuille du cote oppose a la commande touchee, sans jamais la couvrir ; touchee dans le Dock, en haut
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !sheet) return undefined;
    const i = stage ? stage.hit.ids().indexOf(hotspot) : -1;
    let last = '';
    const place = (): void => {
      const vh = window.innerHeight;
      const host = document.querySelector('.v4-canvas-host')?.getBoundingClientRect();
      const off = host ? host.top : 0;
      // En haut : sous la pastille INFOS (elle reste a portee pour eteindre) ; en bas : au-dessus de la barre de Safari
      const chip = document.querySelector('.v4-rinfo-chip')?.getBoundingClientRect();
      const upTop = Math.max(TOP_EDGE, chip && chip.height > 0 ? chip.bottom + SHEET_GAP : TOP_EDGE);
      const bar = parseFloat(getComputedStyle(el).getPropertyValue('--ios-bar')) || 0;
      let where: 'top' | 'bottom' | 'dock' = 'dock';
      let top = 0;
      let max = 0;
      const dockEl = dock ? document.querySelector('.v4-dock[data-open="1"]')?.getBoundingClientRect() : null;
      if (dockEl && dockEl.height > 0) {
        where = 'top';
        top = upTop;
        max = dockEl.top - SHEET_GAP - upTop;
      } else if (stage && i >= 0) {
        const r = stage.hit.rects();
        const y0 = off + r[i * 4 + 1];
        const y1 = y0 + r[i * 4 + 3];
        const up = y0 - SHEET_GAP - upTop;
        const down = vh - bar - (y1 + SHEET_GAP);
        // La commande dans la moitie haute (l'ecran, les encodeurs, les touches de page) : la feuille en bas ; dessous, en haut
        const lowHalf = (y0 + y1) / 2 > vh * 0.5;
        if (lowHalf ? up >= SHEET_MIN : down < SHEET_MIN && up >= SHEET_MIN) {
          where = 'top';
          top = upTop;
          max = up;
        } else if (down >= SHEET_MIN) {
          where = 'bottom';
          max = down;
        }
      }
      if (where === 'top' && max < SHEET_MIN) where = 'dock';
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
    const a = stage ? stage.onView(place) : null;
    const b = stage ? stage.onIdle(place) : null;
    window.addEventListener('resize', place);
    return () => {
      a?.();
      b?.();
      window.removeEventListener('resize', place);
    };
  }, [stage, hotspot, sheet, dock]);

  // Montree au doigt : toucher ailleurs qu'une commande du MM-RYTM la range ; la carte elle-meme attend son clic
  useEffect(() => {
    if (!pinned) return undefined;
    const onDown = (e: PointerEvent): void => {
      const t = e.target;
      if (t instanceof Node && ref.current?.contains(t)) return;
      if (t instanceof Element && t.closest('.v4-rinfo-chip')) return;
      // Le Dock (et ses potards) : sa commande montre sa propre carte au relachement
      if (t instanceof Element && t.closest('.v4-dock[data-open="1"]')) return;
      if (stage && t instanceof Element && t.closest('.v4-stage')) {
        const host = document.querySelector('.v4-canvas-host');
        const r = host?.getBoundingClientRect();
        const h = r ? stage.hit.pick(e.clientX - r.left, e.clientY - r.top, e.pointerType !== 'mouse') : null;
        if (h && rytmInfoHit(h.id)) return;
      }
      rytmInfos.hide();
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [pinned, stage]);

  /**
   * Une tape sur la feuille (le telephone) : la commande du MM-RYTM dessous
   * montre sa carte (la feuille ne coute jamais une tape de plus : au
   * telephone elle couvre souvent les pas ou les pads), sinon elle se range.
   * Au clic seulement : un glisser fait defiler un texte long.
   */
  const onSheetClick = (e: React.MouseEvent): void => {
    if (!sheet) return;
    const host = document.querySelector('.v4-canvas-host')?.getBoundingClientRect();
    const h = stage && host ? stage.hit.pick(e.clientX - host.left, e.clientY - host.top, true) : null;
    if (h && h.id !== hotspot && rytmInfoHit(h.id) && h.kind !== 'rinfo') rytmInfos.show(h.id);
    else if (h && h.kind === 'rinfo') rytmInfos.set(false);
    else rytmInfos.hide();
  };

  if (!m) return null;
  const { info, diagram, tag } = m;
  return (
    <div ref={ref} className="v4-binfo v4-rinfo" data-mode={sheet ? 'sheet' : 'float'} data-id={info.id} role="note" aria-live="polite" lang="fr" onClick={onSheetClick}>
      {sheet && <span className="v4-binfo-grab" aria-hidden="true" />}
      <div className="v4-binfo-head">
        <span className="v4-binfo-sec">{info.section}</span>
        {m.locked ? <span className="v4-binfo-lock">{tag}</span> : info.avail === 'soon' ? <span className="v4-binfo-lock v4-rinfo-soon">BIENTÔT</span> : <span className="v4-binfo-sec">{tag ? `MM-RYTM  ${tag}` : 'MM-RYTM'}</span>}
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

/**
 * La pastille du mode : desktop, au-dessus du coin gauche du MM-RYTM ;
 * telephone, sous le selecteur des machines. Allume : INFOS: HOVER A CONTROL
 * et sa croix (l'eteint) ; capot ouvert et eteint : INFOS, qui l'allume.
 */
const Chip: React.FC<{ stage: Stage | null; sheet: boolean; on: boolean }> = ({ stage, sheet, on }) => {
  const ref = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || sheet || !stage) return undefined;
    let last = '';
    const place = (): void => {
      const b = stage.hit.machineBox('mm808');
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
    <button
      ref={ref}
      type="button"
      className="v4-binfo-chip v4-rinfo-chip"
      data-mode={sheet ? 'sheet' : 'float'}
      data-on={on ? '1' : '0'}
      aria-pressed={on}
      aria-label={on ? 'INFOS on: turn the MM-RYTM help off' : 'INFOS: hover a control of the MM-RYTM (tap on a phone) to read what it does'}
      onClick={() => (on ? rytmInfos.set(false) : rytmInfos.set(true))}
    >
      {on ? (
        <span className="v4-binfo-dot" aria-hidden="true" />
      ) : (
        <span className="v4-rinfo-i" aria-hidden="true">
          i
        </span>
      )}
      {on ? (sheet ? 'INFOS: TAP A CONTROL' : 'INFOS: HOVER A CONTROL') : 'INFOS'}
      {on && (
        <span className="v4-binfo-x" aria-hidden="true">
          <svg viewBox="0 0 10 10" width="8" height="8">
            <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" />
          </svg>
        </span>
      )}
    </button>
  );
};

export const RytmInfosCard: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const st = useSyncExternalStore(rytmInfos.subscribe, rytmInfos.get, rytmInfos.get);
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const hood = useSyncExternalStore(explode.subscribe, explode.get, explode.get);
  const sheet = useMedia(MOBILE_QUERY);
  const want = st.on && st.id && rytmInfoHit(st.id) ? st.id : null;
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
    if (f !== 'mm808') rytmInfos.hide();
  }, [f]);

  const here = f === 'mm808';
  const open = hood === 'open';
  if (!st.on) return here && open ? <Chip stage={stage} sheet={sheet} on={false} /> : null;
  return (
    <>
      {here && <Chip stage={stage} sheet={sheet} on />}
      {here && shown && <Card key={shown} stage={stage} hotspot={shown} sheet={sheet} pinned={st.pinned} dock={st.dock} />}
    </>
  );
};

export default RytmInfosCard;
