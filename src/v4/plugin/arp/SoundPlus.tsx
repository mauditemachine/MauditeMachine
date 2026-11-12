/**
 * Les potards et les commutateurs HTML de la face du plugin MM-ARP (2026-11-10 : SOUND+). Refaits le 2026-11-12 (Mika :
 * "j'ai rarement vu quelque chose d'aussi horrible ... plus EPUREE ou au moins DROITE", puis "peut-etre que je preferais
 * les knobs NOIRS, mais au moins en 3D") : UN potard, celui de la machine 3D (knob.ts : son image rendue par la scene,
 * noir, cannele, bombe, son ombre portee ; l'index blanc tourne en CSS), a UNE taille, partout (rack, sequenceur, OPEN).
 * Autour : des graduations fines et grises, sans chiffre (onze traits, ou un par cran). Dessous : son nom. Sa valeur ne
 * s'ecrit plus sous lui : elle se lit dans l'afficheur du bandeau (Header.tsx) au survol et pendant le geste (xTouch) ;
 * elle reste dans le DOM (.mm-arp-x-value, cachee : les lecteurs d'ecran ont aria-valuetext, les sondes la lisent).
 * Chaque potard est une case de sa rangee (face.css .mm-arp-x) : son centre sur la ligne de la rangee, son nom 30 px
 * dessous (scale.ts GRID). Plus aucune infobulle systeme (attribut title).
 *
 * Deux sources de valeurs, memes gestes :
 * - XKnob, XSwitch : un reglage du VST3 seul (extra.ts, plugin/mm-arp/extra-params.json) ;
 * - VKnob, VSwitch : un TWEAK du site (voyager/params.ts voyParams, les 18 potards de la carte) ; le pont (bridge.ts)
 *   les envoie au C++ sous leurs ids du site, comme ceux de la machine 3D.
 * Le pont envoie tout seul mm_param et mm_gesture quand un store change (bridge.ts) ; mm_knobs les met a jour sans echo.
 *
 * Un potard : glisser vertical (Maj : fin), molette, double-clic = la valeur de depart, fleches (Maj : x10), Debut et
 * Fin. En MIDI LEARN, un clic l'arme (il ne bouge pas : sa LED clignote).
 */

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { stepIndex, voyKnob, voyParams, voyValueText, type VoyKnobId } from '../../voyager/params';
import { arpBridge } from './bridge';
import { arpExtra, extraStepIndex, type ExtraParam } from './extra';
import { KNOB } from './knob';
import { GRID, HEAD_H, openTop, UI_H } from './scale';
import { arpMidi } from './midimap';

/** La course d'un glisser (px) pour tout le potard. */
const DRAG_PX = 170;
/** Le cran du centre des potards a zero au centre, pendant le glisser. */
const CENTER_DETENT = 0.02;
/** La molette : ce deltaY fait un pas. */
const WHEEL_STEP = 40;

/** Les potards dont le centre est le son du site : un cran au centre pendant le glisser. */
const BIPOLAR: ReadonlySet<string> = new Set(['xRevSize', 'xRevTone', 'xBass', 'xAir', 'xWidth', 'xNoiseColor', 'xCombFb', 'xFlFb', 'xEqLow', 'xEqMid', 'xEqHigh', 'xEqAir', 'xM1Amt', 'xM2Amt', 'xM3Amt', 'xM4Amt', 'xM5Amt', 'xM6Amt']);
/** Sous l'interrupteur QUALITY : le surechantillonnage de chaque position. */
const SWITCH_SUB: Record<string, readonly string[]> = { xQuality: ['x4 OVERSAMPLING', 'x8 OVERSAMPLING'], xUnison: ['STACK', '5 VOICES', '7 VOICES'] };
/** Au-dessus des LED d'un interrupteur dont les noms sont trop longs : un nom court par position (le nom entier : la valeur lue dessous). */
const SWITCH_SHORT: Record<string, readonly string[]> = { xAmpMode: ['CLN', 'TRI', 'PEN', 'SAT'] };

/* ---------------- le dessin ---------------- */

const A0 = -135;
const SWEEP = 270;

/** Les graduations : n traits fins repartis sur la course (onze pour un potard continu, un par cran sinon), autour du pied. */
const Ticks: React.FC<{ n: number }> = ({ n }) => {
  const T = KNOB.tick;
  const half = KNOB.box / 2;
  return (
    <svg className="mm-arp-x-ticks" viewBox={`${-half} ${-half} ${KNOB.box} ${KNOB.box}`} width={KNOB.box} height={KNOB.box} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const a = ((A0 + (SWEEP * i) / (n - 1) - 90) * Math.PI) / 180;
        const c = Math.cos(a);
        const sn = Math.sin(a);
        return <line key={i} x1={(c * T.r0).toFixed(2)} y1={(KNOB.footY + sn * T.r0).toFixed(2)} x2={(c * T.r1).toFixed(2)} y2={(KNOB.footY + sn * T.r1).toFixed(2)} />;
      })}
    </svg>
  );
};

/** Le potard dessine : ses graduations, l'image du potard 3D (fixe : la lumiere ne tourne pas), l'index qui tourne. */
const Cap: React.FC<{ n: number; deg: number }> = ({ n, deg }) => (
  <span className="mm-arp-x-dial">
    <Ticks n={n > 1 ? n : 11} />
    <img className="mm-arp-x-body" src={KNOB.url} width={KNOB.box} height={KNOB.box} alt="" draggable={false} />
    <span className="mm-arp-x-idx" style={{ transform: `scaleY(0.973) rotate(${deg.toFixed(2)}deg)` }} aria-hidden="true">
      <i />
    </span>
  </span>
);

/* ---------------- le titre d'une section ---------------- */

/**
 * Le titre d'une section, le meme partout (machine 3D : voyager/silk.ts skinBase ; rack, sequenceur, OPEN : ici) : de
 * petites capitales espacees, gris clair, a gauche, un filet fin a leur suite ; side : un etat ecrit au bout du filet ;
 * led : la LED rouge de la section (un effet qui agit, MIDI LEARN) au bout du filet.
 */
export const SecTitle: React.FC<{ text: string; led?: boolean | 'blink'; side?: React.ReactNode; sideOn?: boolean }> = ({ text, led, side, sideOn }) => (
  <p className="mm-arp-title">
    <span className="mm-arp-title-t">{text}</span>
    <i className="mm-arp-title-rule" aria-hidden="true" />
    {side !== undefined && (
      <span className="mm-arp-title-side" data-on={sideOn ? '1' : undefined}>
        {side}
      </span>
    )}
    {led !== undefined && <span className="mm-arp-led" data-on={led ? '1' : undefined} data-blink={led === 'blink' ? '1' : undefined} aria-hidden="true" />}
  </p>
);

/**
 * Une section d'une page d'OPEN (HoodPanel.tsx), posee sur la grille : de la colonne col, sur span colonnes, dans la rangee row (rows : sa
 * hauteur en rangees ; fill : jusqu'au bas du panneau). Son titre et son filet (SecTitle), son contenu.
 * pitch : le pas de ses potards (le titre part du bord gauche du premier).
 */
interface SecProps {
  id: string;
  title: string;
  col: number;
  span: number;
  row: number;
  fill?: boolean;
  pitch?: number;
  className?: string;
  led?: boolean | 'blink';
  side?: React.ReactNode;
  sideOn?: boolean;
  children?: React.ReactNode;
}
export const Sec: React.FC<SecProps> = ({ id, title, col, span, row, fill, pitch = GRID.col, className, led, side, sideOn, children }) => (
  <section
    className={`mm-arp-sec${className ? ` ${className}` : ''}`}
    data-sec={id}
    style={{ position: 'absolute', left: GRID.col * col, top: openTop(row), width: GRID.col * span, height: fill ? UI_H - HEAD_H - openTop(row) : GRID.row, ['--pitch' as string]: `${pitch}px` }}
    aria-label={title}
  >
    <SecTitle text={title} led={led} side={side} sideOn={sideOn} />
    {children}
  </section>
);

/* ---------------- le reglage touche en dernier ---------------- */

/**
 * Le reglage touche en dernier (survol, geste, molette, clavier) : l'afficheur du bandeau (Header.tsx) montre son nom et
 * sa valeur. active : le geste en cours ; null : rien depuis un moment.
 */
let touch: { id: string; active: boolean } | null = null;
let touchTimer = 0;
const touchListeners = new Set<() => void>();
const emitTouch = (): void => touchListeners.forEach((fn) => fn());
export const xTouch = {
  get: (): { id: string; active: boolean } | null => touch,
  /** hold : le geste continue (le nom reste tant qu'il dure) ; sinon le nom s'efface 1.6 s plus tard */
  set(id: string, hold: boolean): void {
    window.clearTimeout(touchTimer);
    if (!touch || touch.id !== id || touch.active !== hold) {
      touch = { id, active: hold };
      emitTouch();
    }
    if (!hold) touchTimer = window.setTimeout(() => xTouch.clear(id), 1600);
  },
  clear(id?: string): void {
    if (!touch || (id && touch.id !== id)) return;
    window.clearTimeout(touchTimer);
    touch = null;
    emitTouch();
  },
  subscribe(fn: () => void): () => void {
    touchListeners.add(fn);
    return () => {
      touchListeners.delete(fn);
    };
  },
};

const SECTION_NAME: Record<string, string> = {
  engine: 'Engine',
  lfo1: 'LFO 1',
  lfo2: 'LFO 2',
  reverb: 'Reverb',
  master: 'Master',
  seq: 'Sequencer',
  osc: 'Osc',
  filter: 'Filter',
  phaser: 'Phaser',
  flanger: 'Flanger',
  pump: 'Pump',
  crush: 'Crush',
  space: 'Space',
  matrix: 'Matrix',
  voice: 'Voice',
  amp: 'Amp',
  eq: 'EQ',
  dist: 'Distortion',
};
/** Les reglages qui portent deja le nom de leur bloc (la dose PHASER du bloc phaser...) : sans prefixe. */
const OWN_NAME: ReadonlySet<string> = new Set(['xSwing', 'xRing', 'xFold', 'xNoiseColor', 'xUnison', 'xHpf', 'xComb', 'xCombFb', 'xPhMix', 'xFlMix', 'xPumpDepth', 'xCrushBits', 'xCrushRate', 'xDlyMode', 'xShimmer', 'xVoiceMode', 'xPbRange', 'xAmpMode', 'xDist']);
export const ariaName = (p: ExtraParam): string => (OWN_NAME.has(p.id) ? p.label.charAt(0) + p.label.slice(1).toLowerCase() : `${SECTION_NAME[p.section]} ${p.label.toLowerCase()}`);
export const sectionPrefix = (p: ExtraParam): string => (p.section === 'engine' || OWN_NAME.has(p.id) ? '' : `${SECTION_NAME[p.section].toUpperCase()} `);

const useArpMidi = () => useSyncExternalStore(arpMidi.subscribe, arpMidi.get, arpMidi.get);

/* ---------------- le potard ---------------- */

/** (le dessin d'avant le 2026-11-12 : deux allures ; il n'y en a plus qu'une, l'option reste acceptee) */
export type KnobLook = 'metal' | 'black';

interface DialProps {
  id: string;
  look?: KnobLook;
  value: number;
  def: number;
  steps?: readonly string[];
  bipolar?: boolean;
  label: string;
  text: string;
  aria: string;
  set: (v: number) => void;
}

/** Un potard : le dessin, son nom (sa valeur, cachee) ; les gestes ; MIDI LEARN. */
const Dial: React.FC<DialProps> = ({ id, value: v, def, steps, bipolar = false, label, text, aria, set }) => {
  const midi = useArpMidi();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; raw: number; moved: boolean } | null>(null);
  const cur = useRef(v);
  cur.current = v;
  const n = steps?.length ?? 0;
  const armed = midi.learning && midi.armed === id;

  // La molette (non passive : la page ne defile pas) : un cran, ou 1 % (Maj : 0.1 %)
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let acc = 0;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      if (arpMidi.get().learning) return;
      acc += e.deltaY;
      const ticks = Math.trunc(acc / WHEEL_STEP);
      if (ticks === 0) return;
      acc -= ticks * WHEEL_STEP;
      const step = n > 1 ? 1 / (n - 1) : e.shiftKey ? 0.001 : 0.01;
      set(cur.current - ticks * step);
      xTouch.set(id, false);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // set est stable pour un id donne (XKnob, VKnob)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, n]);

  const onDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.focus({ preventScroll: true });
    // MIDI LEARN : le clic arme le reglage, il ne bouge pas
    if (arpBridge.learnArm(id)) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pas de capture : le geste reste sur le potard tant qu'on y est */
    }
    drag.current = { y: e.clientY, raw: v, moved: false };
    xTouch.set(id, true);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (!d.moved && Math.abs(dy) < 3) return;
    d.moved = true;
    // Par increments : Maj en cours de geste affine sans saut
    d.raw = Math.min(1, Math.max(0, d.raw + (dy / DRAG_PX) * (e.shiftKey ? 0.25 : 1)));
    d.y = e.clientY;
    let t = d.raw;
    if (bipolar && !e.shiftKey && Math.abs(t - 0.5) < CENTER_DETENT) t = 0.5;
    set(t);
  };
  const onEnd = (): void => {
    if (!drag.current) return;
    drag.current = null;
    xTouch.set(id, false);
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const step = n > 1 ? 1 / (n - 1) : e.shiftKey ? 0.1 : 0.01;
    let t = v;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') t += step;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') t -= step;
    else if (e.key === 'Home') t = 0;
    else if (e.key === 'End') t = 1;
    else if (e.key === 'Delete' || e.key === 'Backspace') t = def;
    else return;
    e.preventDefault();
    e.stopPropagation();
    if (arpMidi.get().learning) return;
    set(t);
    xTouch.set(id, false);
  };

  const idx = n > 1 ? Math.max(0, Math.min(n - 1, Math.round(v * (n - 1)))) : 0;
  return (
    <div
      ref={ref}
      className="mm-arp-x"
      data-x={id}
      data-steps={n > 1 ? '1' : undefined}
      data-mm-learn={armed ? 'armed' : undefined}
      data-learning={midi.learning ? '1' : undefined}
      role="slider"
      tabIndex={0}
      aria-label={aria}
      aria-valuemin={0}
      aria-valuemax={n > 1 ? n - 1 : 100}
      aria-valuenow={n > 1 ? idx : Math.round(v * 100)}
      aria-valuetext={text}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
      onLostPointerCapture={onEnd}
      onPointerEnter={() => xTouch.set(id, false)}
      onDoubleClick={() => {
        if (arpMidi.get().learning) return;
        set(def);
        xTouch.set(id, false);
      }}
      onKeyDown={onKey}
    >
      <Cap n={n} deg={A0 + v * SWEEP} />
      <span className="mm-arp-x-label">
        {armed && <span className="mm-arp-led" data-on="1" data-blink="1" aria-hidden="true" />}
        {label}
      </span>
      <span className="mm-arp-x-value">{text}</span>
    </div>
  );
};

/* ---------------- un reglage du VST3 seul (extra.ts) ---------------- */

export const useExtra = (id: string): number =>
  useSyncExternalStore(
    arpExtra.subscribe,
    () => arpExtra.of(id),
    () => arpExtra.of(id)
  );

/** Un potard d'un reglage du VST3 seul ; label : un autre nom (MIX pour la dose d'un effet titre a part). */
export const XKnob: React.FC<{ p: ExtraParam; look?: KnobLook; label?: string; aria?: string }> = ({ p, look = 'metal', label, aria }) => {
  const v = useExtra(p.id);
  return <Dial id={p.id} look={look} value={v} def={arpExtra.def(p.id)} steps={p.steps} bipolar={BIPOLAR.has(p.id)} label={label ?? p.label} text={arpExtra.text(p.id, v)} aria={aria ?? ariaName(p)} set={(t) => arpExtra.set(p.id, t)} />;
};

/* ---------------- un TWEAK du site (voyager/params.ts) ---------------- */

const useVoy = (id: VoyKnobId): number =>
  useSyncExternalStore(
    voyParams.subscribe,
    () => voyParams.of(id),
    () => voyParams.of(id)
  );

/** Un potard d'un TWEAK du site : la valeur de voyParams, le texte de l'ecran de la machine (voyValueText). */
export const VKnob: React.FC<{ id: VoyKnobId; look?: KnobLook }> = ({ id, look = 'black' }) => {
  const v = useVoy(id);
  const k = voyKnob(id);
  return <Dial id={id} look={look} value={v} def={voyParams.def(id)} steps={k.steps} label={k.label} text={voyValueText(id, v)} aria={k.aria} set={(t) => voyParams.set(id, t)} />;
};

/* ---------------- les commutateurs : une touche de la machine, une LED par position ---------------- */

interface SwitchProps {
  id: string;
  steps: readonly string[];
  /** les noms ecrits au-dessus des LED, s'ils different des crans (trop longs) */
  names?: readonly string[];
  idx: number;
  label: string;
  sub?: string;
  aria: string;
  pick: (i: number) => void;
}

/** La touche de CHORUS et de SUB OCT, ses LED au-dessus (une par position) ; chaque appui passe a la suivante. */
const Switch: React.FC<SwitchProps> = ({ id, steps, names, idx, label, sub, aria, pick }) => {
  const midi = useArpMidi();
  const last = Math.max(1, steps.length - 1);
  const armed = midi.learning && midi.armed === id;
  const go = (i: number): void => {
    if (arpBridge.learnArm(id)) return;
    pick(Math.min(last, Math.max(0, i)));
    xTouch.set(id, false);
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    let i = idx;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') i += 1;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') i -= 1;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = last;
    else return;
    e.preventDefault();
    e.stopPropagation();
    if (!arpMidi.get().learning) go(i);
  };
  return (
    <div className="mm-arp-x mm-arp-x-switch" data-x={id} data-n={steps.length} data-mm-learn={armed ? 'armed' : undefined} data-learning={midi.learning ? '1' : undefined} onPointerEnter={() => xTouch.set(id, false)}>
      <div className="mm-arp-x-sw" role="radiogroup" aria-label={aria} onKeyDown={onKey}>
        {steps.map((s, i) => (
          <button key={s} type="button" role="radio" aria-checked={i === idx} tabIndex={i === idx ? 0 : -1} className="mm-arp-x-sw-led" data-on={i === idx ? '1' : undefined} aria-label={names ? s : undefined} onClick={() => go(i)}>
            {names?.[i] ?? s}
            <span className="mm-arp-led" data-on={i === idx ? '1' : undefined} aria-hidden="true" />
          </button>
        ))}
      </div>
      <button type="button" className="mm-arp-k mm-arp-x-sw-key" tabIndex={-1} aria-hidden="true" onClick={() => go(idx >= last ? 0 : idx + 1)} />
      <span className="mm-arp-x-label">
        {armed && <span className="mm-arp-led" data-on="1" data-blink="1" aria-hidden="true" />}
        {label}
      </span>
      <span className="mm-arp-x-value">{sub ?? steps[idx]}</span>
    </div>
  );
};

/** QUALITY, UNISON : un reglage a crans du VST3 seul. */
export const XSwitch: React.FC<{ p: ExtraParam }> = ({ p }) => {
  const v = useExtra(p.id);
  const steps = p.steps ?? [];
  const idx = extraStepIndex(p.id, v);
  return <Switch id={p.id} steps={steps} names={SWITCH_SHORT[p.id]} idx={idx} label={p.label} sub={SWITCH_SUB[p.id]?.[idx] ?? (SWITCH_SHORT[p.id] ? steps[idx] : undefined)} aria={ariaName(p)} pick={(i) => arpExtra.set(p.id, i / Math.max(1, steps.length - 1))} />;
};

/** SYNC, POLARITY : un TWEAK a deux positions du site. */
export const VSwitch: React.FC<{ id: VoyKnobId }> = ({ id }) => {
  const v = useVoy(id);
  const k = voyKnob(id);
  const steps = k.steps ?? [];
  return <Switch id={id} steps={steps} idx={stepIndex(id, v)} label={k.label} aria={k.aria} pick={(i) => voyParams.set(id, i / Math.max(1, steps.length - 1))} />;
};
