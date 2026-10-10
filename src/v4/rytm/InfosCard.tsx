/**
 * La carte INFOS du MM-RYTM (2026-10-08, l'etape R4, Mika : "excellent pour
 * le bouton INFO ! je veux un petit bouton i dans l'ecran a activer et de ce
 * fait on peut voir les infos au survol.. et je veux la meme chose pour RYTM
 * aussi !"). La meme carte que celles du MM-BASS et du MM-ARP (les classes
 * v4-binfo de bass/infos.css, reprises telles quelles : les machines se
 * lisent pareil), sur son propre store (state/rytmInfos.ts) :
 * - allume (le i de l'ecran, I, rytm:infos, la touche INFOS du Dock), une
 *   commande survolee (souris) ou touchee (doigt) : sa carte, la section en
 *   petites capitales (l'ecran et la lettre du bloc : ENV C), la voix ou
 *   P-LOCK 05 a droite, le nom, le dessin en direct (rytm/diagrams.ts, refait
 *   des valeurs du moment ; en P-LOCK, celles du pas), le texte et l'astuce
 *   (rytm/infos.ts) ; un bloc de l'ecran montre le reglage qu'il tient sur
 *   l'ecran affiche, pour la voix choisie (pageSlotOf : la meme table que
 *   l'ecran), et l'ecran marque son bloc de quatre coins ; un encodeur du
 *   desktop, son FX global (2026-10-09) ;
 * - desktop : les encodeurs de page et leurs blocs, les touches de page,
 *   l'ecran (son en-tete, ses onglets, son i) et les pas, LOCK compris : a
 *   cote de l'ecran entier, jamais dessus (revue de R4 : au-dessus d'une
 *   touche de page ou d'un pas, sous l'en-tete, elle cachait l'ecran dont
 *   elle parle), remontee au-dessus de la commande si elle la couvrirait ;
 *   les autres au-dessus de la commande (dessous pour MASTER et TEMPO), de
 *   cote si elle sortirait ; 250 ms avant d'apparaitre au survol ;
 * - telephone : une feuille du cote oppose a la commande touchee (en bas
 *   pour l'ecran et les encodeurs, en haut pour les pads, le transport et
 *   les pas ; en haut pour le Dock), qui ne la couvre jamais ; trop haute
 *   pour sa place, son dessin rapetisse, puis un fondu dit que le texte
 *   defile (revue de R4 : elle s'arretait au milieu d'une ligne) ; toucher
 *   ailleurs qu'une commande du MM-RYTM (ou la carte) la range ;
 * - la pastille INFOS: HOVER A CONTROL (au telephone : TAP A CONTROL) et sa
 *   croix tant que le mode est allume et le MM-RYTM a l'ecran ; capot ouvert
 *   (l'ecran est alors hors champ, avec le panneau leve), une pastille INFOS
 *   l'allume, pour lire la plaque TWEAKS.
 * Eteint (et capot ferme), rien n'ecoute la vue. Montee par index.tsx hors
 * de .v4-stage.
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { anyDialValue, dialValue, lockMode, lockSamples, pageLockView, pageSlotOf, rytmInfoTap, stepPlays, subscribeDials, voiceSounds, type DialId } from '../actions';
import { KIT_MODEL_LABEL, familyOf, kit, kitMachineNames, kitSampleNames, kitSoundIndex, kitSoundNames, type KitFamily, type KitId } from '../audio/kit';
import { voiceFx } from '../audio/voicefx';
import { sampleByKey } from '../audio/samples';
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
import { voices } from '../state/voices';
import { MOBILE_QUERY, type EncId, type Inst } from '../theme';
import { v127Text } from './values';
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

/**
 * La feuille du telephone trop haute pour sa place (revue de R4 : sur le Dock
 * KNOBS, le texte s'arretait au milieu d'une ligne, l'astuce cachee, rien ne
 * disait qu'elle defile) : son dessin rapetisse (tight), et s'il en reste, un
 * fondu en bas dit que le texte continue (more).
 */
function fitSheet(el: HTMLElement): void {
  delete el.dataset.tight;
  delete el.dataset.more;
  if (el.scrollHeight <= el.clientHeight + 2) return;
  el.dataset.tight = '1';
  if (el.scrollHeight > el.clientHeight + 2) el.dataset.more = '1';
}

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

/** Ce que la carte montre : la carte, son dessin, ce qui va a droite de la section (la voix, P-LOCK 05). */
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
  // L'ecran affiche (2026-10-09 : la page et son onglet, VOICE SYNTH, GLOBAL FX)
  const screen = rytmPage.screen(voice);
  const ctx: RytmInfoCtx = { voice, page: screen };
  const dc: RytmDiagramCtx = { v: 0, voice, page: screen, bpm: p.bpm, steps: voice ? p.steps[voice] : undefined, lockMask: voice ? lockMask(p.locks, voice) : 0, step: lockStep };
  // L'enveloppe, le filtre (ceux du pas en P-LOCK) et le DELAY : un reglage se dessine avec ses voisins
  const vf = voice ? voiceFx.of(voice) : null;
  if (vf) {
    const lk = shownLock;
    dc.env = { atk: lk?.atk ?? vf.atk, hold: lk?.hold ?? vf.hold, decay: lk?.decay ?? vf.decay };
    dc.filt = { ftype: lk?.ftype ?? vf.ftype, fcut: lk?.fcut ?? vf.fcut, freso: lk?.freso ?? vf.freso, fenv: lk?.fenv ?? vf.fenv, fatk: lk?.fatk ?? vf.fatk, fdec: lk?.fdec ?? vf.fdec };
  }
  dc.dtime = pattern.fx.get().dtime;
  dc.dfb = pattern.fx.get().dfb;
  // BIT et son RATE (2026-10-10, la page BIT) : l'un se dessine avec l'autre
  dc.bits = pattern.fx.get().bits;
  dc.brate = pattern.fx.get().brate;
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
      } else if (target === 'voice:sound' && voice) {
        // SOUND (2026-10-09) : la liste unique de VOICE (OFF, les machines, les samples ; en P-LOCK, ceux des autres voix)
        const list = voiceSounds(voice, lockStep >= 0);
        dc.sounds = list.map((x) => x.label);
        dc.synths = list.filter((x) => x.kind !== 'smp').length;
        dc.index = Math.round(dc.v);
      } else if (target === 'voice:mix' && plays) {
        dc.mixLv = { syn: plays.syn, lev: plays.lev, sample: !!plays.sample };
      }
      // La couche de ce reglage se tait (R3) : la carte le dit, comme le bloc en retrait de l'ecran
      // (BOTH, les deux couches : seulement quand la voix se tait)
      const off = !plays ? '' : slot.both ? (!plays.synth && !plays.smp ? 'SILENT' : '') : slot.layer === 'synth' && !plays.synth ? 'SYNTH OFF' : slot.layer === 'sample' && !plays.smp ? 'SAMPLE OFF' : '';
      tag = slot.scope === 'all' ? 'ALL' : [voice ?? '', off].filter(Boolean).join('  ');
    }
  } else if (hit.encoder !== undefined) {
    // Un encodeur du desktop (2026-10-09) : son FX global, a poste fixe, jamais verrouille
    ctx.encoder = hit.encoder;
    ctx.lockable = 'global';
    dc.v = anyDialValue(id as DialId);
    tag = 'ALL';
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
    // Le pas en P-LOCK : la carte du P-LOCK
    if (i >= 0 && i === rytmLock.get().step && editor.get() !== 'mm808') id = 'lock';
    ctx.step = i;
    dc.step = i;
    tag = voice ?? '';
  } else if (id === 'screen') {
    // L'ecran : ce qu'il montre (les presets, EDIT, HOME, la vue PAGE)
    if (presetMode.on('mm808')) id = 'presets';
    else if (editor.get() === 'mm808') id = 'edit';
    else if (rp.view === 'home' && lockStep < 0) id = 'home';
  } else if (id.startsWith('pad:')) {
    // Un pad (revue de R4) : ce que joue SA voix (ses couches, ses pas), pas celle qui est choisie
    const pv = id.slice(4) as Inst;
    dc.steps = p.steps[pv];
    dc.lockMask = lockMask(p.locks, pv);
    dc.muted = voices.get().muted.includes(pv);
    const pf = familyOf(pv as ShotId);
    if (pf) {
      const pl = stepPlays(pv, null);
      const smp = pl.sample ? `${sampleByKey(pl.sample)?.label ?? 'SAMPLE'} ${pl.lev > 0 ? v127Text(pl.lev) : 'OFF'}` : 'OFF';
      dc.layers = [`SYN ${KIT_MODEL_LABEL[pl.model]} ${pl.syn > 0 ? v127Text(pl.syn) : 'OFF'}`, `SMP ${smp}`];
    } else dc.layers = ['ONE SOUND'];
  } else if (id === 'level') dc.v = dialValue('level' as EncId);
  else if (id === 'tempo') dc.v = p.bpm;
  const info = infoOf(id, ctx);
  if (!info) return null;
  return { info, diagram: rytmDiagram(id, dc), tag: locked ? `P-LOCK ${two(lockStep + 1)}` : tag, locked };
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
    const offs = [subscribeDials(bump), rytmPage.subscribe(bump), presetMode.subscribe(bump), editor.subscribe(bump), voices.subscribe(bump)];
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      for (const off of offs) off();
    };
  }, []);
  return n;
}

/** Desktop : la carte sous ces commandes, quand elle ne tient pas a cote de l'ecran (elle ne cache pas l'ecran dont elle parle). */
const BELOW = /^(penc-|pkey-|lcd-|enc-)/;
/** Desktop : la carte a cote de l'ecran entier pour ces commandes (l'ecran montre ce dont elles parlent : blocs, page, LOCK, pas). */
const BESIDE = /^(penc-|pkey-|lcd-|step-)/;

/** Deux rectangles (x, y, w, h) se couvrent-ils ? */
const overlaps = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean =>
  ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;

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
    const ids = stage.hit.ids();
    const i = ids.indexOf(hotspot);
    const below = BELOW.test(hotspot);
    // Un bloc de l'ecran ou son encodeur, une touche de page, l'ecran, un pas : la carte a cote de l'ecran entier (les huit
    // blocs), jamais dessus (au-dessus d'un encodeur du bas, d'une touche de page ou d'un pas, elle cachait l'ecran dont elle parle)
    const blocks = BESIDE.test(hotspot) ? Array.from({ length: 8 }, (_, k) => ids.indexOf(`lcd-blk-${k}`)).filter((j) => j >= 0) : [];
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
        // Les blocs : leurs rectangles meme eteints (hors INFOS ils ne prennent rien, mais se projettent)
        let sx0 = Infinity;
        let sy0 = Infinity;
        let sx1 = -Infinity;
        for (const j of blocks) {
          if (!(r[j * 4 + 2] > 0)) continue;
          sx0 = Math.min(sx0, r[j * 4]);
          sy0 = Math.min(sy0, r[j * 4 + 1]);
          sx1 = Math.max(sx1, r[j * 4] + r[j * 4 + 2]);
        }
        const right = sx1 + GAP * 2;
        const leftOf = sx0 - cw - GAP * 2;
        let beside = seen && Number.isFinite(sx1) && (right + cw <= vw - EDGE || leftOf >= EDGE);
        const bLeft = right + cw <= vw - EDGE ? right : leftOf;
        let bTop = clamp(sy0 - 8, TOP_EDGE, vh - ch - EDGE);
        // A cote de l'ecran mais sur sa commande (un pas sous une carte haute) : remontee au-dessus d'elle, sinon comme les autres
        if (beside && overlaps(bLeft, bTop, cw, ch, x, y, w, h)) {
          const up = y - ch - GAP;
          if (up >= TOP_EDGE) bTop = up;
          else beside = false;
        }
        if (beside) {
          t = `translate(${Math.round(bLeft)}px, ${Math.round(bTop)}px)`;
          el.dataset.side = 'screen';
        } else if (seen) {
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
      fitSheet(el);
    };
    place();
    const a = stage ? stage.onView(place) : null;
    const b = stage ? stage.onIdle(place) : null;
    window.addEventListener('resize', place);
    // Le Dock change de hauteur (SEQUENCER, KNOBS, LOCK) : la feuille du haut suit son bord
    const dockEl = dock ? document.querySelector('.v4-dock[data-open="1"]') : null;
    const ro = dockEl && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    if (dockEl) ro?.observe(dockEl);
    return () => {
      a?.();
      b?.();
      ro?.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [stage, hotspot, sheet, dock]);

  // Telephone : la carte refaite (une valeur, une autre page) se mesure encore contre sa place
  useLayoutEffect(() => {
    if (sheet && ref.current) fitSheet(ref.current);
  });

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
   * Comme une tape directe (revue de R4) : une touche de page sous la
   * feuille tourne aussi la page, un pad choisit sa voix (actions.ts
   * rytmInfoTap). Au clic seulement : un glisser fait defiler un texte long.
   */
  const onSheetClick = (e: React.MouseEvent): void => {
    if (!sheet) return;
    const host = document.querySelector('.v4-canvas-host')?.getBoundingClientRect();
    const h = stage && host ? stage.hit.pick(e.clientX - host.left, e.clientY - host.top, true) : null;
    if (h && h.id !== hotspot && rytmInfoHit(h.id) && h.kind !== 'rinfo') rytmInfoTap(h.id);
    else if (h && h.kind === 'rinfo') rytmInfos.set(false);
    else rytmInfos.hide();
  };

  /** La feuille defilee jusqu'au bout : plus de fondu (il cachait la derniere ligne). */
  const onSheetScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const el = e.currentTarget;
    if (!sheet || !el.dataset.tight) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) delete el.dataset.more;
    else el.dataset.more = '1';
  };

  if (!m) return null;
  const { info, diagram, tag } = m;
  return (
    <div ref={ref} className="v4-binfo v4-rinfo" data-mode={sheet ? 'sheet' : 'float'} data-id={info.id} role="note" aria-live="polite" lang="fr" onClick={onSheetClick} onScroll={onSheetScroll}>
      {sheet && <span className="v4-binfo-grab" aria-hidden="true" />}
      <div className="v4-binfo-head">
        <span className="v4-binfo-sec">{info.section}</span>
        {m.locked ? <span className="v4-binfo-lock">{tag}</span> : info.avail === 'soon' ? <span className="v4-binfo-lock v4-rinfo-soon">BIENTÔT</span> : <span className="v4-binfo-sec">{tag ? `MM-RYTM  ${tag}` : 'MM-RYTM'}</span>}
      </div>
      <div className="v4-binfo-title">{info.title}</div>
      {/* La recette d'abord (revue de R4 : une carte se lit en deux secondes), le dessin ensuite */}
      {info.steps && (
        <ol className="v4-rinfo-steps">
          {info.steps.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ol>
      )}
      {diagram && <DiagramSvg d={diagram} />}
      {/* La touche du clavier : au desktop seulement (revue de R4) */}
      <p className="v4-binfo-text">{info.key && !sheet ? `${info.text} ${info.key}` : info.text}</p>
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
