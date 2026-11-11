/**
 * Le module d'extension de la face avant du plugin MM-ARP (2026-11-11, Mika : "sur le VST je voulais encore d'autres
 * fonctions sur le panneau AVANT, donc agrandis la taille generale et fais en sorte de placer plus de choses pour un
 * rendu vraiment hors du commun"). TOUJOURS visible, sous la face 3D (la fenetre passe de 1100 x 704 a 1100 x 880,
 * scale.ts), jamais dans OPEN : le meme panneau anthracite qui continue entre les joues de noyer (prolongees par une
 * texture tiree du rendu de la scene, wood-l.jpg et wood-r.jpg : le bas des joues, raccorde en miroir), la meme
 * serigraphie, les potards SVG, les touches et les LED du panneau d'OPEN (SoundPlus.tsx, face.css). Trois zones :
 *
 * - STEP SEQUENCER : 16 pas, cinq pistes (steps.ts : ACCENT, SLIDE, GATE, RATCHET, PROB), des touches a temoin. Clic :
 *   l'etat suivant ; clic droit ou Maj + clic : le precedent ; glisser : peindre la piste avec l'etat pose. La tete de
 *   lecture court sur la rangee de LED (mm_transport pos, voyager/arp.ts arpExternal.headState) ; les pas au-dela de la
 *   longueur de la suite sont grises. Le potard SWING (xSwing) et INIT (toutes les pistes a leurs valeurs de depart).
 * - OSC / FILTER + : RING MOD, FOLD, NOISE COLOR, UNISON (OFF / 5 / 7), HIGH PASS, COMB, COMB FB.
 * - FX RACK : PHASER, FLANGER, PUMP, CRUSH, SPACE ; une LED par effet, allumee quand il agit.
 *
 * Les potards sont des reglages de extra.ts (plugin/mm-arp/extra-params.json), comme ceux de SOUND+ : memes evenements
 * (mm_param, mm_gesture, mm_knobs sans echo ; un clic en MIDI LEARN arme le reglage). Les pistes partent dans
 * mm_program (bridge.ts). Le VST3 seul : le site ne monte jamais ce module.
 */

import React, { useRef, useSyncExternalStore } from 'react';
import { voyExplode } from '../../state/explode';
import { arp, arpExternal } from '../../voyager/arp';
import { voyParams } from '../../voyager/params';
import { seq } from '../../voyager/seq';
import { extHead } from '../head';
import { arpBridge } from './bridge';
import { arpExtra, extraParam, extraStepIndex, type ExtraParam } from './extra';
import { arpMidi } from './midimap';
import { FACE_H, MODULE_H } from './scale';
import { XKnob, xTouch } from './SoundPlus';
import { arpSteps, STEP_TRACKS, stepName, STEPS_N, type StepTrack } from './steps';
import woodL from './wood-l.jpg';
import woodR from './wood-r.jpg';

const P = (id: string): ExtraParam => extraParam(id) as ExtraParam;

const useExtra = (id: string): number =>
  useSyncExternalStore(
    arpExtra.subscribe,
    () => arpExtra.of(id),
    () => arpExtra.of(id)
  );
const useSteps = () => useSyncExternalStore(arpSteps.subscribe, arpSteps.get, arpSteps.get);
const useArpMidi = () => useSyncExternalStore(arpMidi.subscribe, arpMidi.get, arpMidi.get);

/* ---------------- la tete de lecture et la longueur de la suite ---------------- */

/** La tete (mm_transport) : "pos|len" pendant la lecture, '' a l'arret. Une chaine : React ne repeint qu'a un nouveau pas. */
const headKey = (): string => {
  const h = arpExternal.headState;
  return h.playing && h.pos >= 0 ? `${h.pos}|${h.len}` : '';
};
const useHead = (): { pos: number; len: number } | null => {
  const k = useSyncExternalStore(extHead.onWake, headKey, headKey);
  if (!k) return null;
  const [pos, len] = k.split('|').map(Number);
  return { pos, len };
};

/** La longueur de la suite a l'arret : celle d'EDIT, sinon celle que fabriquent les potards sur le premier accord. */
const idleLen = (): number => {
  const s = seq.get();
  if (s.edit) return s.len;
  const chord = arp.get().prog[0];
  if (chord === undefined) return STEPS_N;
  return seq.steps(chord)?.length ?? STEPS_N;
};
const useIdleLen = (): number => {
  // Trois stores la font : la suite, les potards (MODE, RANGE, NOTES), la progression
  useSyncExternalStore(seq.subscribe, seq.get, seq.get);
  useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
  useSyncExternalStore(arp.subscribe, arp.get, arp.get);
  return idleLen();
};

/* ---------------- STEP SEQUENCER ---------------- */

/** Le temoin d'un pas, selon sa piste (face.css : data-v fait la hauteur, la longueur, le nombre de points). */
const Glyph: React.FC<{ track: StepTrack; v: number }> = ({ track, v }) => {
  if (track === 'rat')
    return (
      <span className="mm-arp-st-dots">
        {Array.from({ length: v }, (_, k) => (
          <i key={k} />
        ))}
      </span>
    );
  return <span className="mm-arp-st-g" />;
};

const StepSeq: React.FC = () => {
  const steps = useSteps();
  const head = useHead();
  const idle = useIdleLen();
  const grid = useRef<HTMLDivElement>(null);
  /** Le glisser en cours : la piste et l'etat poses au premier pas, peints sur les pas survoles. */
  const paint = useRef<{ track: StepTrack; v: number; last: number } | null>(null);

  const len = Math.max(1, head && head.len > 0 ? head.len : idle);
  const at = head ? head.pos % STEPS_N : -1;

  const cellOf = (el: Element | null): { track: StepTrack; i: number } | null => {
    const c = el?.closest<HTMLElement>('[data-st]');
    if (!c || !grid.current?.contains(c)) return null;
    return { track: c.dataset.st as StepTrack, i: Number(c.dataset.i) };
  };
  const touch = (track: StepTrack, i: number, hold: boolean): void => xTouch.set(`step:${track}:${i}`, hold);

  const onDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    const c = cellOf(e.target as Element);
    if (!c) return;
    e.preventDefault();
    (e.target as HTMLElement).closest<HTMLElement>('[data-st]')?.focus({ preventScroll: true });
    const v = arpSteps.next(c.track, c.i, e.button === 2 || e.shiftKey ? -1 : 1);
    arpSteps.set(c.track, c.i, v);
    paint.current = { track: c.track, v, last: c.i };
    touch(c.track, c.i, true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pas de capture : le glisser reste dans la grille tant qu'on y est */
    }
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const p = paint.current;
    if (!p) return;
    const c = cellOf(document.elementFromPoint(e.clientX, e.clientY));
    if (!c || c.track !== p.track || c.i === p.last) return;
    // Un glisser rapide saute des pas : tous ceux entre le dernier et celui-ci
    const d = c.i > p.last ? 1 : -1;
    for (let i = p.last + d; i !== c.i + d; i += d) arpSteps.set(p.track, i, p.v);
    p.last = c.i;
    touch(p.track, c.i, true);
  };
  const onEnd = (): void => {
    const p = paint.current;
    if (!p) return;
    paint.current = null;
    touch(p.track, p.last, false);
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const c = cellOf(e.target as Element);
    if (!c) return;
    const t = STEP_TRACKS.findIndex((x) => x.id === c.track);
    let nt = t;
    let ni = c.i;
    if (e.key === 'Enter' || e.key === ' ') {
      arpSteps.set(c.track, c.i, arpSteps.next(c.track, c.i, e.shiftKey ? -1 : 1));
      touch(c.track, c.i, false);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      arpSteps.set(c.track, c.i, STEP_TRACKS[t].def);
      touch(c.track, c.i, false);
    } else if (e.key === 'ArrowRight') ni = Math.min(STEPS_N - 1, c.i + 1);
    else if (e.key === 'ArrowLeft') ni = Math.max(0, c.i - 1);
    else if (e.key === 'ArrowDown') nt = Math.min(STEP_TRACKS.length - 1, t + 1);
    else if (e.key === 'ArrowUp') nt = Math.max(0, t - 1);
    else if (e.key === 'Home') ni = 0;
    else if (e.key === 'End') ni = STEPS_N - 1;
    else return;
    e.preventDefault();
    e.stopPropagation();
    if (nt !== t || ni !== c.i) grid.current?.querySelector<HTMLElement>(`[data-st="${STEP_TRACKS[nt].id}"][data-i="${ni}"]`)?.focus({ preventScroll: true });
  };

  return (
    <section className="mm-arp-col mm-arp-fz mm-arp-fz-seq" aria-label="Step sequencer">
      <p className="mm-arp-col-title">STEP SEQUENCER</p>
      <div className="mm-arp-seq">
        <div
          ref={grid}
          className="mm-arp-st-grid"
          data-playing={head ? '1' : undefined}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onEnd}
          onPointerCancel={onEnd}
          onLostPointerCapture={onEnd}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={onKey}
        >
          {/* La rangee de la tete : une LED par pas, son numero dessous */}
          <span className="mm-arp-st-name" aria-hidden="true" />
          <div className="mm-arp-st-row mm-arp-st-heads" aria-hidden="true">
            {Array.from({ length: STEPS_N }, (_, i) => (
              <span key={i} className="mm-arp-st-head" data-i={i} data-off={i >= len ? '1' : undefined} data-beat={i % 4 === 0 ? '1' : undefined}>
                <span className="mm-arp-led" data-on={i === at ? '1' : undefined} />
                <b>{i + 1}</b>
              </span>
            ))}
          </div>
          {STEP_TRACKS.map((t, ti) => (
            <React.Fragment key={t.id}>
              <span className="mm-arp-st-name" id={`mm-arp-st-${t.id}`} title={`${t.label} : ${t.names.join(' / ')}`}>
                {t.label}
              </span>
              <div className="mm-arp-st-row" role="group" aria-labelledby={`mm-arp-st-${t.id}`} data-track={t.id}>
                {steps[t.id].map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    className="mm-arp-st"
                    data-st={t.id}
                    data-i={i}
                    data-v={v}
                    data-def={v === t.def ? '1' : undefined}
                    data-off={i >= len ? '1' : undefined}
                    data-head={i === at ? '1' : undefined}
                    tabIndex={ti === 0 && i === 0 ? 0 : -1}
                    title={`${t.label} ${i + 1} : ${stepName(t.id, v)}`}
                    aria-label={`${t.label.charAt(0)}${t.label.slice(1).toLowerCase()} step ${i + 1}, ${stepName(t.id, v).toLowerCase()}`}
                    onPointerEnter={() => {
                      if (!paint.current) touch(t.id, i, false);
                    }}
                  >
                    <Glyph track={t.id} v={v} />
                  </button>
                ))}
              </div>
            </React.Fragment>
          ))}
        </div>
        <div className="mm-arp-seq-side">
          <XKnob p={P('xSwing')} compact />
          <button type="button" className="mm-arp-kb mm-arp-seq-init" data-size="s" disabled={arpSteps.isDefault()} title="All step tracks back to their defaults" onClick={() => arpSteps.reset()}>
            <span className="mm-arp-k" aria-hidden="true" />
            <span className="mm-arp-legend">INIT</span>
          </button>
        </div>
      </div>
    </section>
  );
};

/* ---------------- OSC / FILTER + et FX RACK ---------------- */

/** UNISON : la touche de CHORUS en petit, ses LED OFF / 5 / 7 au-dessus ; chaque appui passe au cran suivant. */
const Selector: React.FC<{ p: ExtraParam }> = ({ p }) => {
  const v = useExtra(p.id);
  const midi = useArpMidi();
  const steps = p.steps ?? [];
  const idx = extraStepIndex(p.id, v);
  const last = Math.max(1, steps.length - 1);
  const armed = midi.learning && midi.armed === p.id;
  const pick = (i: number): void => {
    if (arpBridge.learnArm(p.id)) return;
    arpExtra.set(p.id, Math.min(last, Math.max(0, i)) / last);
    xTouch.set(p.id, false);
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
    if (!arpMidi.get().learning) pick(i);
  };
  return (
    <div className="mm-arp-x mm-arp-x-switch mm-arp-fsel" data-x={p.id} data-compact="1" data-mm-learn={armed ? 'armed' : undefined} data-learning={midi.learning ? '1' : undefined} title={p.help} onPointerEnter={() => xTouch.set(p.id, false)}>
      <div className="mm-arp-x-sw" role="radiogroup" aria-label={p.label.charAt(0) + p.label.slice(1).toLowerCase()} onKeyDown={onKey}>
        {steps.map((s, i) => (
          <button key={s} type="button" role="radio" aria-checked={i === idx} tabIndex={i === idx ? 0 : -1} className="mm-arp-x-sw-led" data-on={i === idx ? '1' : undefined} onClick={() => pick(i)}>
            <span className="mm-arp-led" data-on={i === idx ? '1' : undefined} aria-hidden="true" />
            {s}
          </button>
        ))}
      </div>
      <button type="button" className="mm-arp-k mm-arp-x-sw-key" tabIndex={-1} aria-hidden="true" onClick={() => pick(idx >= last ? 0 : idx + 1)} />
      <span className="mm-arp-x-label">
        {armed && <span className="mm-arp-led" data-on="1" data-blink="1" aria-hidden="true" />}
        {p.label}
      </span>
      <span className="mm-arp-x-value">{idx === 0 ? 'STACK' : `${steps[idx]} VOICES`}</span>
    </div>
  );
};

/** Les noms des potards dans le module quand le bloc porte deja celui du JSON (la dose de PHASER : MIX). */
const LABELS: Record<string, string> = { xPhMix: 'MIX', xFlMix: 'MIX', xPumpDepth: 'DEPTH', xCrushBits: 'BITS', xCrushRate: 'DOWNSAMPLE', xDlyMode: 'DELAY MODE' };

interface Group {
  id: string;
  title: string;
  ids: readonly string[];
  /** l'effet agit (sa LED) ; sans : pas de LED (OSC, FILTER) */
  on?: (v: Readonly<Record<string, number>>) => boolean;
}

const OSC_ROWS: readonly (readonly Group[])[] = [[{ id: 'osc', title: 'OSC', ids: ['xRing', 'xFold', 'xNoiseColor', 'xUnison'] }], [{ id: 'filter', title: 'FILTER', ids: ['xHpf', 'xComb', 'xCombFb'] }]];

const FX_ROWS: readonly (readonly Group[])[] = [
  [
    { id: 'phaser', title: 'PHASER', ids: ['xPhMix', 'xPhRate', 'xPhDepth', 'xPhFb'], on: (v) => v.xPhMix > 0 },
    { id: 'flanger', title: 'FLANGER', ids: ['xFlMix', 'xFlRate', 'xFlDepth', 'xFlFb'], on: (v) => v.xFlMix > 0 },
  ],
  [
    { id: 'pump', title: 'PUMP', ids: ['xPumpDepth', 'xPumpRate', 'xPumpShape'], on: (v) => v.xPumpDepth > 0 },
    { id: 'crush', title: 'CRUSH', ids: ['xCrushBits', 'xCrushRate'], on: (v) => v.xCrushBits > 0 || v.xCrushRate > 0 },
    { id: 'space', title: 'SPACE', ids: ['xDlyMode', 'xShimmer'], on: (v) => v.xDlyMode > 0 || v.xShimmer > 0 },
  ],
];

const GroupBox: React.FC<{ g: Group }> = ({ g }) => {
  const values = useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);
  const lit = g.on ? g.on(values) : false;
  return (
    <div className="mm-arp-fg" data-fx={g.id} data-on={lit ? '1' : undefined} style={{ flexGrow: g.ids.length }} role="group" aria-label={g.title}>
      <p className="mm-arp-fg-title">
        <span>
          {g.on && <span className="mm-arp-led" data-on={lit ? '1' : undefined} aria-hidden="true" />}
          {g.title}
        </span>
      </p>
      <div className="mm-arp-fg-row">{g.ids.map((id) => (id === 'xUnison' ? <Selector key={id} p={P(id)} /> : <XKnob key={id} p={P(id)} compact label={LABELS[id]} />))}</div>
    </div>
  );
};

const Zone: React.FC<{ id: string; title: string; rows: readonly (readonly Group[])[] }> = ({ id, title, rows }) => (
  <section className={`mm-arp-col mm-arp-fz mm-arp-fz-${id}`} aria-label={title}>
    <p className="mm-arp-col-title">{title}</p>
    <div className="mm-arp-fz-rows">
      {rows.map((row, i) => (
        <div key={i} className="mm-arp-fz-row">
          {row.map((g) => (
            <GroupBox key={g.id} g={g} />
          ))}
        </div>
      ))}
    </div>
  </section>
);

/* ---------------- le module ---------------- */

/** Le module avant, pose sous la face 3D dans la couche a l'echelle (.mm-arp-ui, ArpFace.tsx). */
export const FrontModule: React.FC = () => {
  const hood = useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
  return (
    <section className="mm-arp-front" style={{ position: 'absolute', top: FACE_H, height: MODULE_H }} data-hood={hood === 'closed' ? undefined : '1'} aria-label="MM-ARP expander">
      {/* Les joues de noyer, prolongees : elles recouvrent le bout des joues de la scene (capot ferme) */}
      <span className="mm-arp-front-wood" data-side="l" style={{ backgroundImage: `url(${woodL})` }} aria-hidden="true" />
      <span className="mm-arp-front-wood" data-side="r" style={{ backgroundImage: `url(${woodR})` }} aria-hidden="true" />
      <div className="mm-arp-front-panel">
        <StepSeq />
        <Zone id="osc" title="OSC / FILTER +" rows={OSC_ROWS} />
        <Zone id="fx" title="FX RACK" rows={FX_ROWS} />
      </div>
    </section>
  );
};
