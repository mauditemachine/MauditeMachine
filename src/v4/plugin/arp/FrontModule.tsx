/**
 * Les modules HTML de la face avant du plugin MM-ARP (2026-11-11 ; refaits le meme jour pour le format large, Mika :
 * "carre c'est pas bon, essaie de faire un peu plus en largeur ... fais quelque chose de design, je veux le meilleur
 * synthe de l'histoire"). Autour de la machine 3D (scale.ts : le plan de la fenetre), dans le meme habillage qu'elle
 * (voyager/skin.ts : le simili noir, un bandeau de metal brosse par section, des filets de cadre, les potards a capuchon
 * de metal et leurs graduations chiffrees) :
 *
 * - Rack, a DROITE de la machine, sur toute la hauteur : six rangees a bandeau, OSC +, FILTER +, PHASER, FLANGER, PUMP,
 *   CRUSH et SPACE (les 22 reglages osc, filter, phaser, flanger, pump, crush et space de extra-params.json) ; une LED
 *   rouge dans le bandeau de chaque effet, allumee quand il agit.
 * - StepStrip, SOUS la machine, sur sa largeur : STEP SEQUENCER, 16 pas larges, cinq pistes (steps.ts : ACCENT, SLIDE,
 *   GATE, RATCHET, PROB), des touches a temoin. Clic : l'etat suivant ; clic droit ou Maj + clic : le precedent ;
 *   glisser : peindre la piste avec l'etat pose. La tete de lecture court sur la rangee de LED (mm_transport pos,
 *   voyager/arp.ts arpExternal.headState) ; les pas au-dela de la longueur de la suite sont grises. A droite : le potard
 *   SWING (xSwing) et INIT (toutes les pistes a leurs valeurs de depart).
 * - Cheeks : les joues de noyer, aux deux bords de la fenetre (le noyer fume de voyager/skin.ts woodTile, face.css).
 *
 * Les potards sont des reglages de extra.ts, comme ceux du panneau d'OPEN : memes evenements (mm_param, mm_gesture,
 * mm_knobs sans echo ; un clic en MIDI LEARN arme le reglage). Les pistes partent dans mm_program (bridge.ts). Le VST3
 * seul : le site ne monte jamais ces modules.
 */

import React, { useRef, useSyncExternalStore } from 'react';
import { arp, arpExternal } from '../../voyager/arp';
import { voyParams } from '../../voyager/params';
import { seq } from '../../voyager/seq';
import { extHead } from '../head';
import { arpExtra, extraParam, type ExtraParam } from './extra';
import { CHEEK_W, RACK, SEQ, UI_H } from './scale';
import { XKnob, XSwitch, xTouch } from './SoundPlus';
import { arpSteps, STEP_TRACKS, stepName, STEPS_N, type StepTrack } from './steps';

const P = (id: string): ExtraParam => extraParam(id) as ExtraParam;

const useSteps = () => useSyncExternalStore(arpSteps.subscribe, arpSteps.get, arpSteps.get);

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
    <section className="mm-arp-sec mm-arp-strip" style={{ position: 'absolute', left: SEQ.x, top: SEQ.y, width: SEQ.w, height: SEQ.h }} aria-label="Step sequencer">
      <p className="mm-arp-band">
        <span>STEP SEQUENCER</span>
      </p>
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
          {/* La rangee de la tete : une LED par pas, son numero a cote */}
          <span className="mm-arp-st-name mm-arp-st-name-head" aria-hidden="true">
            STEP
          </span>
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
          <XKnob p={P('xSwing')} />
          <button type="button" className="mm-arp-kb mm-arp-seq-init" data-size="s" disabled={arpSteps.isDefault()} title="All step tracks back to their defaults" onClick={() => arpSteps.reset()}>
            <span className="mm-arp-k" aria-hidden="true" />
            <span className="mm-arp-legend">INIT</span>
          </button>
        </div>
      </div>
    </section>
  );
};

/* ---------------- le rack : OSC +, FILTER +, PHASER, FLANGER, PUMP, CRUSH, SPACE ---------------- */

/** Les noms des potards quand le bandeau porte deja celui du JSON (la dose de PHASER : MIX). */
const LABELS: Record<string, string> = { xPhMix: 'MIX', xFlMix: 'MIX', xPumpDepth: 'DEPTH', xCrushBits: 'BITS', xCrushRate: 'DOWNSAMPLE', xDlyMode: 'DELAY MODE' };

interface Group {
  id: string;
  title: string;
  ids: readonly string[];
  /** l'effet agit (sa LED) ; sans : pas de LED (OSC +, FILTER +) */
  on?: (v: Readonly<Record<string, number>>) => boolean;
}

/** Les rangees du rack, de haut en bas ; la derniere porte deux sections cote a cote. */
const RACK_ROWS: readonly (readonly Group[])[] = [
  [{ id: 'osc', title: 'OSC +', ids: ['xRing', 'xFold', 'xNoiseColor', 'xUnison'] }],
  [{ id: 'filter', title: 'FILTER +', ids: ['xHpf', 'xComb', 'xCombFb'] }],
  [{ id: 'phaser', title: 'PHASER', ids: ['xPhMix', 'xPhRate', 'xPhDepth', 'xPhFb'], on: (v) => v.xPhMix > 0 }],
  [{ id: 'flanger', title: 'FLANGER', ids: ['xFlMix', 'xFlRate', 'xFlDepth', 'xFlFb'], on: (v) => v.xFlMix > 0 }],
  [{ id: 'pump', title: 'PUMP', ids: ['xPumpDepth', 'xPumpRate', 'xPumpShape'], on: (v) => v.xPumpDepth > 0 }],
  [
    { id: 'crush', title: 'CRUSH', ids: ['xCrushBits', 'xCrushRate'], on: (v) => v.xCrushBits > 0 || v.xCrushRate > 0 },
    { id: 'space', title: 'SPACE', ids: ['xDlyMode', 'xShimmer'], on: (v) => v.xDlyMode > 0 || v.xShimmer > 0 },
  ],
];

const GroupBox: React.FC<{ g: Group }> = ({ g }) => {
  const values = useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);
  const lit = g.on ? g.on(values) : false;
  return (
    <div className="mm-arp-sec mm-arp-fg" data-fx={g.id} data-on={lit ? '1' : undefined} style={{ flexGrow: g.ids.length }} role="group" aria-label={g.title}>
      <p className="mm-arp-band">
        {g.on && <span className="mm-arp-led mm-arp-band-led" data-on={lit ? '1' : undefined} aria-hidden="true" />}
        <span>{g.title}</span>
      </p>
      <div className="mm-arp-fg-row">{g.ids.map((id) => (id === 'xUnison' ? <XSwitch key={id} p={P(id)} /> : <XKnob key={id} p={P(id)} label={LABELS[id]} />))}</div>
    </div>
  );
};

/** Le rack, a droite de la machine. */
export const Rack: React.FC = () => (
  <section className="mm-arp-rack" style={{ position: 'absolute', left: RACK.x, top: RACK.y, width: RACK.w, height: RACK.h }} aria-label="MM-ARP expander rack">
    {RACK_ROWS.map((row, i) => (
      <div key={i} className="mm-arp-rack-row">
        {row.map((g) => (
          <GroupBox key={g.id} g={g} />
        ))}
      </div>
    ))}
  </section>
);

/** Le sequenceur par pas, sous la machine. */
export const StepStrip = StepSeq;

/** Les joues de noyer, aux deux bords de la fenetre, sur toute sa hauteur. */
export const Cheeks: React.FC = () => (
  <>
    <span className="mm-arp-cheek" data-side="l" style={{ position: 'absolute', left: 0, top: 0, width: CHEEK_W, height: UI_H }} aria-hidden="true" />
    <span className="mm-arp-cheek" data-side="r" style={{ position: 'absolute', right: 0, top: 0, width: CHEEK_W, height: UI_H }} aria-hidden="true" />
  </>
);
