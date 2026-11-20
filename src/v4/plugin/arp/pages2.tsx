/**
 * Les maquettes v44 des pages OPEN (2026-11-20 ; maquette.ts : ?mq=navA,soundA,seqA ; sans ?mq, la face d'avant).
 *
 * 1. La barre des pages (Mika : "le panneau de selection ... trouve autre chose genre les boutons que tu m'as proposes
 *    tantot") : A les pilules de STYLE (LED au-dessus, nom dessous, la page montree a la couleur d'accent), B des
 *    touches a verrouillage de magnetophone (la touche enfoncee reste basse, sa lampe allumee), C des touches a LED
 *    integree (le nom grave sur la touche, la LED dedans).
 * 2. SOUND en colonnes facon Legend ("occupe l'espace ; le filtre est super cool, garde-lui de l'espace") : A l'EQ en
 *    haut sur presque toute la largeur, les effets en colonnes dessous ; B l'EQ en grande colonne a gauche, les effets en
 *    trois colonnes a droite. Dans les deux : Maj + glisser vertical (ou la molette) sur un point regle son Q
 *    (HoodBoard.tsx EqScreen).
 * 3. SEQ plus simple, sa tete de lecture visible ("on devrait voir l'avancement des pas") : A une piste a la fois, seize
 *    grandes touches de boite a rythmes ; B la piste NOTES et une seconde piste au choix, une colonne lumineuse balaie
 *    les deux. La tete : mm_transport (pos, len, chord), comme avant ; plus visible.
 *
 * Tout est de la face du VST3 seul (gate PLUGIN_ARP, comme HoodBoard.tsx) ; aucun reglage nouveau.
 */

import React, { useRef, useSyncExternalStore } from 'react';
import { arp, arpExternal } from '../../voyager/arp';
import { CHORDS, degreeName } from '../../voyager/chords';
import { voyParams } from '../../voyager/params';
import { seq, SEQ_MIN, SEQ_TOP } from '../../voyager/seq';
import { extHead } from '../head';
import { HOOD_PAGES, hoodPage, hoodPageIndex } from './hoodPage';
import { PcbFrame, PcbKey, PcbKnob, PcbRotary, PcbSelect, PcbStep, PcbToggle } from './pcbui';
import { arpSteps, STEP_TRACKS, STEPS_N, stepName, type StepTrack } from './steps';
import { EqBandKeys, EqScreen, eqBandStore, Frame, FRAME_H, frameW, headKey, Matrix, notesViewStore, qid, RandomBox, RND_W, SEQ_ROW, useExtraAll, useFlash, useSteps, X, ZONE } from './HoodBoard';
import './pages2.css';

/* =====================================================================================================================
   1. la barre des pages
   ===================================================================================================================== */

export const NavKeys2: React.FC<{ v: string; onClose: () => void }> = ({ v, onClose }) => {
  const st = useSyncExternalStore(hoodPage.subscribe, hoodPage.get, hoodPage.get);
  const cur = st.overlay ? -1 : hoodPageIndex(st);
  const go = (i: number): void => {
    const p = HOOD_PAGES[i];
    // un re-clic sur la page montree ramene a la face (comme avant)
    if (i === cur) onClose();
    else hoodPage.set({ tab: p.tab, fx: p.fx ?? st.fx, overlay: null });
  };
  if (v === 'A')
    return (
      <div className="mm-nv mm-nv-a" role="tablist" aria-label="Page">
        {HOOD_PAGES.map((p, i) => (
          <PcbKey key={p.id} role="tab" aria-selected={i === cur} on={i === cur} name={p.label} w={44} h={17} onClick={() => go(i)} />
        ))}
      </div>
    );
  return (
    <div className={`mm-nv mm-nv-${v.toLowerCase()}`} role="tablist" aria-label="Page">
      {HOOD_PAGES.map((p, i) => (
        <button key={p.id} type="button" role="tab" aria-selected={i === cur} className="mm-nv-key" data-on={i === cur ? '1' : undefined} onClick={() => go(i)}>
          <i className="mm-nv-lamp" aria-hidden="true" />
          <span className="mm-nv-label">{p.label}</span>
        </button>
      ))}
    </div>
  );
};

/* =====================================================================================================================
   2. SOUND en colonnes facon Legend
   ===================================================================================================================== */

/** Une section : sa barre de titre (facon Legend), ses pieces en rangees centrees, une rangee tous les PITCH px. */
const PITCH = 84;
const BAR = 24;
const Sect: React.FC<{ title: string; x: number; y: number; w: number; rows: React.ReactNode[]; led?: boolean; h?: number; flash?: string; children?: React.ReactNode }> = ({ title, x, y, w, rows, led, h, flash, children }) => {
  const f = useFlash(flash ?? title);
  return (
    <PcbFrame title={title} x={x} y={y} w={w} h={h ?? BAR + rows.length * PITCH - 8} className="mm-lg" led={led} flash={f}>
      {rows.map((r, i) => (
        <div key={i} className="mm-lg-row" style={{ top: BAR + i * PITCH }}>
          {r}
        </div>
      ))}
      {children}
    </PcbFrame>
  );
};

const fk = (id: string, name: string): React.ReactNode => <PcbKnob key={id} id={id} name={name} ref_="" lo="" hi="" fine />;

const eqLed = (): boolean =>
  [1, 2, 3, 4, 5, 6].some((b) => X(qid(b, 'On')) >= 0.5 && (Math.abs(X(qid(b, 'Gain')) - 0.5) > 0.0005 || X(qid(b, 'Type')) === 0 || X(qid(b, 'Type')) === 1 || Math.round(X(qid(b, 'Type')) * 5) === 3));

/** Les sections des effets (les memes reglages que la page d'avant, les memes ids). */
const FX = {
  master: (two: boolean): React.ReactNode[] =>
    two
      ? [
          <>
            <PcbKnob id="xWarmth" name="WARMTH" ref_="" lo="OFF" hi="FULL" />
            {fk('xBass', 'BASS')}
          </>,
          <>
            {fk('xAir', 'AIR')}
            {fk('xWidth', 'WIDTH')}
          </>,
        ]
      : [],
  phaser: (): React.ReactNode[] => [
    <>
      {fk('xPhMix', 'MIX')}
      {fk('xPhRate', 'RATE')}
      {fk('xPhDepth', 'DEPTH')}
    </>,
    <>
      {fk('xPhFb', 'FEEDBACK')}
      <PcbRotary id="xPhStages" name="STAGES" ref_="" w={80} />
      {fk('xPhCenter', 'CENTER')}
    </>,
    <>
      {fk('xPhSpread', 'SPREAD')}
      <PcbToggle id="xPhSync" name="SYNC" ref_="" w={62} />
    </>,
  ],
  phaser4: (): React.ReactNode[] => [
    <>
      {fk('xPhMix', 'MIX')}
      {fk('xPhRate', 'RATE')}
    </>,
    <>
      {fk('xPhDepth', 'DEPTH')}
      {fk('xPhFb', 'FEEDBACK')}
    </>,
    <>
      <PcbRotary id="xPhStages" name="STAGES" ref_="" w={80} />
      {fk('xPhCenter', 'CENTER')}
    </>,
    <>
      {fk('xPhSpread', 'SPREAD')}
      <PcbToggle id="xPhSync" name="SYNC" ref_="" w={62} />
    </>,
  ],
  flanger: (): React.ReactNode[] => [
    <>
      {fk('xFlMix', 'MIX')}
      {fk('xFlRate', 'RATE')}
      {fk('xFlDepth', 'DEPTH')}
    </>,
    <>
      {fk('xFlFb', 'FEEDBACK')}
      {fk('xFlDelay', 'DELAY')}
      {fk('xFlSpread', 'SPREAD')}
    </>,
    <>
      <PcbToggle id="xFlSync" name="SYNC" ref_="" w={80} />
      <PcbToggle id="xFlThru" name="THRU-0" ref_="" w={80} />
    </>,
  ],
  flanger4: (): React.ReactNode[] => [
    <>
      {fk('xFlMix', 'MIX')}
      {fk('xFlRate', 'RATE')}
    </>,
    <>
      {fk('xFlDepth', 'DEPTH')}
      {fk('xFlFb', 'FEEDBACK')}
    </>,
    <>
      {fk('xFlDelay', 'DELAY')}
      {fk('xFlSpread', 'SPREAD')}
    </>,
    <>
      <PcbToggle id="xFlSync" name="SYNC" ref_="" w={80} />
      <PcbToggle id="xFlThru" name="THRU-0" ref_="" w={80} />
    </>,
  ],
  chorus3: (): React.ReactNode[] => [
    <PcbRotary key="m" id="vChMode" name="MODE" ref_="" w={96} />,
    <>
      {fk('xChRate', 'RATE')}
      {fk('xChDepth', 'DEPTH')}
    </>,
    <>
      {fk('xChWidth', 'WIDTH')}
      {fk('xChMix', 'MIX')}
    </>,
  ],
  chorus2: (): React.ReactNode[] => [
    <>
      <PcbRotary id="vChMode" name="MODE" ref_="" w={96} />
      {fk('xChRate', 'RATE')}
    </>,
    <>
      {fk('xChDepth', 'DEPTH')}
      {fk('xChWidth', 'WIDTH')}
      {fk('xChMix', 'MIX')}
    </>,
  ],
  crush: (): React.ReactNode[] => [
    <>
      {fk('xCrushBits', 'BITS')}
      {fk('xCrushRate', 'RATE')}
    </>,
    <>
      {fk('xCrTone', 'TONE')}
      {fk('xCrMix', 'MIX')}
    </>,
  ],
  pump3: (): React.ReactNode[] => [
    <>
      {fk('xPumpDepth', 'DEPTH')}
      {fk('xPuAttack', 'ATTACK')}
    </>,
    <PcbStep key="r" id="xPumpRate" name="RATE" ref_="" w={112} />,
    <>
      {fk('xPumpShape', 'RELEASE')}
      {fk('xPuCurve', 'CURVE')}
    </>,
  ],
  pump2: (): React.ReactNode[] => [
    <>
      <PcbStep id="xPumpRate" name="RATE" ref_="" w={112} />
      {fk('xPumpDepth', 'DEPTH')}
    </>,
    <>
      {fk('xPuAttack', 'ATTACK')}
      {fk('xPumpShape', 'RELEASE')}
      {fk('xPuCurve', 'CURVE')}
    </>,
  ],
};

const EqControls: React.FC<{ band: number; rows: 1 | 2 }> = ({ band, rows }) =>
  rows === 1 ? (
    <>
      <PcbSelect id={qid(band, 'Type')} name="TYPE" ref_="" w={84} cols={2} />
      <PcbKnob id={qid(band, 'Freq')} name="FREQ" ref_="" lo="" hi="" fine />
      <PcbKnob id={qid(band, 'Gain')} name="GAIN" ref_="" lo="" hi="" fine />
      <PcbKnob id={qid(band, 'Q')} name="Q" ref_="" lo="" hi="" fine />
      <PcbStep id={qid(band, 'Slope')} name="SLOPE" ref_="" w={110} />
      <PcbKnob id="xQOut" name="OUTPUT" ref_="" lo="" hi="" fine />
    </>
  ) : null;

const QHint: React.FC<{ x: number; y: number; w?: number }> = ({ x, y, w }) => (
  <p className="mm-lg-hint" style={{ left: x, top: y, width: w }}>
    <b>DRAG A POINT</b> FREQ + GAIN <i>·</i> <b>SHIFT + DRAG UP / DOWN</b> OR <b>WHEEL</b> Q
  </p>
);

const SoundA: React.FC = () => {
  useExtraAll();
  useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
  const band = useSyncExternalStore(eqBandStore.subscribe, eqBandStore.get, eqBandStore.get);
  const flashEq = useFlash('EQ');
  const EQ = { x: ZONE.x, y: 60, w: 776, h: 300 };
  const RX = EQ.x + EQ.w + 16;
  const RW = ZONE.x + ZONE.w - RX;
  // les effets : cinq colonnes sous l'EQ
  const BY = EQ.y + EQ.h + 14;
  const cols = [
    { t: 'PHASER', w: 232, rows: FX.phaser(), led: X('xPhMix') > 0 },
    { t: 'FLANGER', w: 240, rows: FX.flanger(), led: X('xFlMix') > 0 },
    { t: 'CHORUS', w: 176, rows: FX.chorus3(), led: voyParams.of('chorus') > 0 },
    { t: 'CRUSH', w: 140, rows: FX.crush(), led: X('xCrushBits') > 0 || X('xCrushRate') > 0 },
    { t: 'PUMP', w: 176, rows: FX.pump3(), led: X('xPumpDepth') > 0 },
  ];
  const gap = (ZONE.w - cols.reduce((s, c) => s + c.w, 0)) / (cols.length - 1);
  let x = ZONE.x;
  return (
    <div className="mm-lg-page" data-v="A">
      <PcbFrame title="EQ" x={EQ.x} y={EQ.y} w={EQ.w} h={EQ.h} className="mm-lg mm-lg-eq" led={eqLed()} flash={flashEq}>
        <div className="mm-dm-place" style={{ left: 0, top: BAR }}>
          <EqScreen w={EQ.w} h={186} />
        </div>
        <EqBandKeys />
        <div className="mm-lg-row mm-lg-eqrow" style={{ top: BAR + 192, left: 228 }}>
          <EqControls band={band} rows={1} />
        </div>
        <QHint x={6} y={BAR + 252} w={214} />
      </PcbFrame>
      <i className="mm-lg-vsep" style={{ left: RX - 8, top: 60, height: EQ.h }} />
      <Sect title="MASTER" x={RX} y={60} w={RW} rows={FX.master(true)} />
      <Sect title="ANALYZER" x={RX} y={60 + BAR + 2 * PITCH + 4} w={RW} rows={[<PcbStep key="a" id="xQAna" name="ANALYZER" ref_="" w={120} />]} h={EQ.h - (BAR + 2 * PITCH + 4)} />
      <i className="mm-lg-hsep" style={{ left: ZONE.x, top: BY - 8, width: ZONE.w }} />
      {cols.map((c, i) => {
        const cx = x;
        x += c.w + gap;
        return (
          <React.Fragment key={c.t}>
            {i > 0 && <i className="mm-lg-vsep" style={{ left: cx - gap / 2, top: BY, height: 260 }} />}
            <Sect title={c.t} x={cx} y={BY} w={c.w} rows={c.rows} led={c.led} />
          </React.Fragment>
        );
      })}
    </div>
  );
};

const SoundB: React.FC = () => {
  useExtraAll();
  useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
  const band = useSyncExternalStore(eqBandStore.subscribe, eqBandStore.get, eqBandStore.get);
  const flashEq = useFlash('EQ');
  const C = [
    { x: 0, w: 150 },
    { x: 0, w: 172 },
    { x: 0, w: 172 },
  ];
  const GAP = 14;
  const EQW = ZONE.w - C.reduce((s, c) => s + c.w, 0) - GAP * 3;
  let cx = ZONE.x + EQW + GAP;
  for (const c of C) {
    c.x = cx;
    cx += c.w + GAP;
  }
  const H = 590;
  const sect2 = (y0: number, a: number): number => y0 + BAR + a * PITCH + 6;
  return (
    <div className="mm-lg-page" data-v="B">
      <PcbFrame title="EQ" x={ZONE.x} y={60} w={EQW} h={H} className="mm-lg mm-lg-eq mm-lg-eqb" led={eqLed()} flash={flashEq}>
        <div className="mm-dm-place" style={{ left: 0, top: BAR }}>
          <EqScreen w={EQW} h={330} />
        </div>
        <EqBandKeys />
        <QHint x={250} y={BAR + 344} w={EQW - 256} />
        <div className="mm-lg-row" style={{ top: BAR + 390 }}>
          <PcbSelect id={qid(band, 'Type')} name="TYPE" ref_="" w={84} cols={2} />
          <PcbKnob id={qid(band, 'Freq')} name="FREQ" ref_="" lo="" hi="" fine />
          <PcbKnob id={qid(band, 'Gain')} name="GAIN" ref_="" lo="" hi="" fine />
          <PcbKnob id={qid(band, 'Q')} name="Q" ref_="" lo="" hi="" fine />
        </div>
        <div className="mm-lg-row" style={{ top: BAR + 390 + PITCH }}>
          <PcbStep id={qid(band, 'Slope')} name="SLOPE" ref_="" w={110} />
          <PcbKnob id="xQOut" name="OUTPUT" ref_="" lo="" hi="" fine />
        </div>
      </PcbFrame>
      {C.map((c) => (
        <i key={c.x} className="mm-lg-vsep" style={{ left: c.x - GAP / 2, top: 60, height: H }} />
      ))}
      <Sect title="MASTER" x={C[0].x} y={60} w={C[0].w} rows={FX.master(true)} />
      <Sect title="CRUSH" x={C[0].x} y={sect2(60, 2)} w={C[0].w} rows={FX.crush()} led={X('xCrushBits') > 0 || X('xCrushRate') > 0} />
      <Sect title="ANALYZER" x={C[0].x} y={sect2(sect2(60, 2), 2)} w={C[0].w} rows={[<PcbStep key="a" id="xQAna" name="ANALYZER" ref_="" w={120} />]} />
      <Sect title="PHASER" x={C[1].x} y={60} w={C[1].w} rows={FX.phaser4()} led={X('xPhMix') > 0} />
      <Sect title="CHORUS" x={C[1].x} y={sect2(60, 4)} w={C[1].w} rows={FX.chorus2()} led={voyParams.of('chorus') > 0} />
      <Sect title="FLANGER" x={C[2].x} y={60} w={C[2].w} rows={FX.flanger4()} led={X('xFlMix') > 0} />
      <Sect title="PUMP" x={C[2].x} y={sect2(60, 4)} w={C[2].w} rows={FX.pump2()} led={X('xPumpDepth') > 0} />
    </div>
  );
};

export const SoundPage2: React.FC<{ v: string }> = ({ v }) => (v === 'B' ? <SoundB /> : <SoundA />);

/* =====================================================================================================================
   3. SEQ : la tete de lecture, une piste a la fois (A), NOTES + une piste (B)
   ===================================================================================================================== */

type Lane = 'notes' | StepTrack;

/** Ce que fait chaque piste, en clair (la ligne d'aide sous les pas). */
const HELP: Record<Lane, string> = {
  notes: 'WHICH NOTE EACH STEP PLAYS',
  acc: 'HOW HARD EACH STEP HITS',
  slide: 'GLIDES INTO THE NEXT NOTE',
  gate: 'HOW LONG EACH NOTE HOLDS',
  rat: 'REPEATS THE NOTE INSIDE ITS STEP',
  prob: 'THE CHANCE THAT THE STEP PLAYS',
};
const GESTURE: Record<'notes' | 'track', string> = {
  notes: 'DRAG UP / DOWN: THE NOTE · CLICK THE NAME: REST',
  track: 'CLICK: NEXT VALUE · RIGHT CLICK: BACK · DRAG ACROSS: PAINT',
};
const LABEL: Record<Lane, string> = { notes: 'NOTES', acc: 'ACCENT', slide: 'SLIDE', gate: 'GATE', rat: 'RATCHET', prob: 'CHANCE' };
const DEF: Record<StepTrack, number> = Object.fromEntries(STEP_TRACKS.map((t) => [t.id, t.def])) as Record<StepTrack, number>;

/** La piste montree (A) ou la seconde piste (B) : la page, gardee entre deux visites. */
let laneSel: Lane = 'notes';
let lane2: StepTrack = 'gate';
const laneL = new Set<() => void>();
const laneStore = {
  get: (): string => `${laneSel}|${lane2}`,
  set(a: Lane | null, b: StepTrack | null): void {
    if (a) laneSel = a;
    if (b) lane2 = b;
    laneL.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    laneL.add(fn);
    return () => {
      laneL.delete(fn);
    };
  },
};

/** La tete : le pas joue (pos modulo 16) et la longueur de la suite, -1 a l'arret. */
function useHead(): { at: number; len: number } {
  const hk = useSyncExternalStore(extHead.onWake, headKey, headKey);
  const h = hk ? hk.split('|').map(Number) : null;
  return { at: h ? h[0] % STEPS_N : -1, len: h && h[1] > 0 ? h[1] : 0 };
}

/** L'accord dont on lit les notes : celui qui joue, sinon le premier (un clic sur CHORD en choisit un). */
function useChord(): { chord: number; notes: (number | null)[]; len: number } {
  const sq = useSyncExternalStore(seq.subscribe, seq.get, seq.get);
  const ar = useSyncExternalStore(arp.subscribe, arp.get, arp.get);
  const view = useSyncExternalStore(notesViewStore.subscribe, notesViewStore.get, notesViewStore.get);
  useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
  const playing = ar.running && arpExternal.headState.chord >= 0 ? arpExternal.headState.chord : -1;
  const chord = view ?? (playing >= 0 ? playing : (ar.prog[0] ?? 0));
  const notes = seq.shown(chord);
  return { chord, notes, len: sq.edit ? sq.len : notes.length || STEPS_N };
}

/** La rangee du haut : CHORD, d'ou viennent les notes, STEPS - + (comme avant). */
const SeqTop: React.FC<{ chord: number; top: number }> = ({ chord, top }) => {
  const sq = useSyncExternalStore(seq.subscribe, seq.get, seq.get);
  const ar = useSyncExternalStore(arp.subscribe, arp.get, arp.get);
  return (
    <div className="mm-sq-top" style={{ top }}>
      <span className="mm-sq-lab">CHORD</span>
      {CHORDS.map((c, i) => (
        <PcbKey
          key={c.label}
          name={c.label}
          cap={<span>{c.label}</span>}
          w={34}
          h={13}
          on={i === chord}
          onClick={() => notesViewStore.set(notesViewStore.get() === i ? null : i)}
          aria-label={`Notes of ${c.aria}${ar.prog.includes(i) ? ', in the progression' : ''}`}
        />
      ))}
      <span className="mm-sq-src" data-edit={sq.edit ? '1' : undefined}>
        {sq.edit ? 'YOUR NOTES' : 'FROM THE KNOBS'}
      </span>
      <span className="mm-sq-lab">STEPS</span>
      <PcbKey name="−" cap={<span>−</span>} w={20} h={13} onClick={() => seq.setLen(chord, Math.min(seq.shown(chord).length, 16) - 1)} aria-label="Fewer steps" />
      <b className="mm-sq-n">{seq.shown(chord).length}</b>
      <PcbKey name="+" cap={<span>+</span>} w={20} h={13} onClick={() => seq.setLen(chord, Math.min(seq.shown(chord).length, 16) + 1)} aria-label="More steps" />
    </div>
  );
};

/** Le dessin d'une valeur de piste (ACCENT : trois niveaux, GATE : sa longueur, RATCHET : ses coups, CHANCE : son niveau). */
const Glyph: React.FC<{ t: StepTrack; v: number; w: number; h: number }> = ({ t, v, w, h }) => {
  const set = v !== DEF[t];
  const cls = set ? 'mm-g on' : 'mm-g';
  switch (t) {
    case 'acc': {
      const n = v + 1;
      const bh = (h - 8) / 3;
      return (
        <svg className={cls} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
          {[0, 1, 2].map((k) => (
            <rect key={k} x={w * 0.22} y={h - (k + 1) * bh - k * 2} width={w * 0.56} height={bh - 1} rx={1.5} className={k < n ? (k === 2 ? 'hot' : 'lit') : 'off'} />
          ))}
        </svg>
      );
    }
    case 'slide':
      return (
        <svg className={cls} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
          {v ? <path className="ln hot" d={`M${w * 0.12} ${h * 0.78} C ${w * 0.5} ${h * 0.78}, ${w * 0.55} ${h * 0.22}, ${w * 1.08} ${h * 0.22}`} /> : <path className="ln off" d={`M${w * 0.3} ${h / 2}H${w * 0.7}`} />}
        </svg>
      );
    case 'gate': {
      const f = [0.28, 0.55, 0.82, 1.12][v] ?? 0.55;
      return (
        <svg className={cls} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ overflow: 'visible' }}>
          <rect x={w * 0.08} y={h / 2 - 5} width={w * f} height={10} rx={2} className={v === 3 || v === 2 ? 'hot' : v === 0 ? 'lit' : 'lit dim'} />
        </svg>
      );
    }
    case 'rat':
      return (
        <svg className={cls} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
          {Array.from({ length: v }, (_, k) => {
            const bw = (w * 0.7) / 4;
            const x0 = w / 2 - (v * bw) / 2;
            return <rect key={k} x={x0 + k * bw + 1} y={h * 0.2} width={bw - 3} height={h * 0.6} rx={1.5} className={v > 1 ? 'hot' : 'lit dim'} />;
          })}
        </svg>
      );
    default: {
      const f = v / 100;
      return (
        <svg className={cls} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
          <rect x={w * 0.3} y={2} width={w * 0.4} height={h - 4} rx={2} className="tank" />
          <rect x={w * 0.3} y={2 + (h - 4) * (1 - f)} width={w * 0.4} height={(h - 4) * f} rx={2} className={v < 100 ? 'hot' : 'lit dim'} />
        </svg>
      );
    }
  }
};

/** Le texte d'une valeur, court et lisible. */
const valText = (t: StepTrack, v: number): string => (t === 'prob' ? `${v}%` : t === 'slide' ? (v ? 'SLIDE' : 'OFF') : stepName(t, v));

/** Les gestes d'une piste : clic (la valeur suivante), clic droit ou Maj (la precedente), glisser (peindre). */
function usePaint(track: StepTrack, len: number): { onPointerDown: React.PointerEventHandler<HTMLDivElement>; onPointerMove: React.PointerEventHandler<HTMLDivElement>; onPointerUp: () => void; onPointerCancel: () => void; onContextMenu: React.MouseEventHandler } {
  const paint = useRef<{ v: number; last: number } | null>(null);
  const at = (el: Element | null): number => {
    const c = el?.closest<HTMLElement>('[data-i]');
    return c ? Number(c.dataset.i) : -1;
  };
  return {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
      const i = at(e.target as Element);
      if (i < 0 || i >= len) return;
      e.preventDefault();
      const v = arpSteps.next(track, i, e.button === 2 || e.shiftKey ? -1 : 1);
      arpSteps.set(track, i, v);
      paint.current = { v, last: i };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* rien */
      }
    },
    onPointerMove: (e) => {
      const p = paint.current;
      if (!p) return;
      const i = at(document.elementFromPoint(e.clientX, e.clientY));
      if (i < 0 || i >= len || i === p.last) return;
      const d = i > p.last ? 1 : -1;
      for (let k = p.last + d; k !== i + d; k += d) arpSteps.set(track, k, p.v);
      p.last = i;
    },
    onPointerUp: () => {
      paint.current = null;
    },
    onPointerCancel: () => {
      paint.current = null;
    },
    onContextMenu: (e) => e.preventDefault(),
  };
}

/** Les notes : glisser de haut en bas choisit le degre (le haut : le plus aigu), un clic sur le nom fait un silence. */
function useNoteDraw(chord: number, len: number, stepLeft: (i: number) => number, padW: number, padH: number, top0: number): { ref: React.RefObject<HTMLDivElement | null>; handlers: React.HTMLAttributes<HTMLDivElement>; toggleRest: (i: number) => void } {
  const ref = useRef<HTMLDivElement>(null);
  const draw = useRef<{ i: number; d: number } | null>(null);
  const before = useRef<(number | null)[]>([]);
  const LEVELS = SEQ_TOP - SEQ_MIN;
  const noteAt = (e: React.PointerEvent): { i: number; d: number } | null => {
    const el = ref.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const sx = r.width / el.offsetWidth || 1;
    const lx = (e.clientX - r.left) / sx;
    const ly = (e.clientY - r.top) / sx - top0;
    let i = -1;
    for (let k = 0; k < STEPS_N; k += 1) if (lx >= stepLeft(k) - 3 && lx < stepLeft(k) + padW + 3) i = k;
    if (i < 0) return null;
    const t = 1 - Math.min(1, Math.max(0, (ly - 6) / (padH - 24)));
    return { i, d: Math.round(SEQ_MIN + t * LEVELS) };
  };
  return {
    ref,
    toggleRest: (i) => {
      const cur = seq.shown(chord)[i];
      if (cur === null || cur === undefined) seq.setStep(chord, i, before.current[i] ?? 0);
      else {
        before.current[i] = cur;
        seq.setStep(chord, i, null);
      }
    },
    handlers: {
      onPointerDown: (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const n = noteAt(e);
        if (!n || n.i >= len) return;
        e.preventDefault();
        seq.setStep(chord, n.i, n.d);
        draw.current = n;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* rien */
        }
      },
      onPointerMove: (e) => {
        const g = draw.current;
        if (!g) return;
        const n = noteAt(e);
        if (!n || n.i >= len) return;
        if (Math.abs(n.i - g.i) > 1) {
          const dir = n.i > g.i ? 1 : -1;
          for (let j = g.i + dir; j !== n.i; j += dir) seq.setStep(chord, j, Math.round(g.d + ((n.d - g.d) * (j - g.i)) / (n.i - g.i)));
        }
        if (n.i !== g.i || n.d !== g.d) seq.setStep(chord, n.i, n.d);
        draw.current = n;
      },
      onPointerUp: () => {
        draw.current = null;
      },
      onPointerCancel: () => {
        draw.current = null;
      },
    },
  };
}

/** La rangee des numeros de pas : la LED du pas joue s'allume, a la couleur d'accent ; les temps groupes par quatre. */
const StepHeads: React.FC<{ top: number; at: number; len: number; x: (i: number) => number; w: number }> = ({ top, at, len, x, w }) => (
  <div className="mm-s2-heads" style={{ top }} aria-hidden="true">
    {Array.from({ length: STEPS_N }, (_, i) => (
      <span key={i} className="mm-s2-head" style={{ left: x(i), width: w }} data-off={i >= len ? '1' : undefined} data-beat={i % 4 === 0 ? '1' : undefined} data-on={i === at ? '1' : undefined}>
        <b>{i + 1}</b>
        <i />
      </span>
    ))}
  </div>
);

/** La LED d'une piste : allumee si elle agit au pas joue (pendant la lecture), sinon si elle est utilisee. */
const laneLit = (t: Lane, at: number, edit: boolean): boolean => {
  if (t === 'notes') return edit;
  const row = arpSteps.get()[t];
  if (at >= 0) return row[at] !== DEF[t];
  return !arpSteps.isDefault(t);
};

/* ---------------- SEQ A : une piste a la fois, seize grandes touches ---------------- */

const A_PAD = { w: 48, h: 86 };
const aX = (i: number): number => 96 + i * 54 + Math.floor(i / 4) * 12;
const A_TOP = { tabs: 56, heads: 98, pads: 122 };

const StepsA: React.FC = () => {
  const st = useSteps();
  const sq = useSyncExternalStore(seq.subscribe, seq.get, seq.get);
  const sel = useSyncExternalStore(laneStore.subscribe, laneStore.get, laneStore.get).split('|')[0] as Lane;
  const head = useHead();
  const { chord, notes, len: len0 } = useChord();
  const len = Math.max(1, head.len || len0);
  const flash = useFlash('STEP SEQUENCER');
  const paint = usePaint(sel === 'notes' ? 'acc' : sel, len);
  const nd = useNoteDraw(chord, len, aX, A_PAD.w, A_PAD.h, A_TOP.pads);
  const W = ZONE.w;
  const lanes: Lane[] = ['notes', ...STEP_TRACKS.map((t) => t.id)];
  return (
    <PcbFrame title="STEP SEQUENCER" x={ZONE.x} y={60} w={W} h={250} className="mm-s2 mm-s2-a" flash={flash}>
      <SeqTop chord={chord} top={20} />
      <div className="mm-s2-tabs" style={{ top: A_TOP.tabs }} role="radiogroup" aria-label="Track">
        <span className="mm-s2-tablab">TRACK</span>
        {lanes.map((t) => (
          <span key={t} className="mm-s2-tw">
            <i className="mm-p2-led mm-s2-tled" data-on={laneLit(t, head.at, sq.edit) ? '1' : undefined} aria-hidden="true" />
            <PcbKey role="radio" data-track={t} aria-checked={t === sel} on={t === sel} className={t === sel ? 'mm-s2-tab is-sel' : 'mm-s2-tab'} name={LABEL[t]} w={50} h={16} onClick={() => laneStore.set(t, null)} />
          </span>
        ))}
        <span className="mm-s2-help">
          <b>{LABEL[sel]}</b> {HELP[sel]}
        </span>
      </div>
      <StepHeads top={A_TOP.heads} at={head.at} len={len} x={aX} w={A_PAD.w} />
      {sel === 'notes' ? (
        <div ref={nd.ref} className="mm-s2-pads mm-s2-notes" {...nd.handlers}>
          {Array.from({ length: STEPS_N }, (_, i) => {
            const d = i < notes.length ? notes[i] : undefined;
            const on = typeof d === 'number';
            const t = on ? ((d as number) - SEQ_MIN) / (SEQ_TOP - SEQ_MIN) : 0;
            return (
              <div key={i} className="mm-s2-pad" style={{ left: aX(i), top: A_TOP.pads, width: A_PAD.w, height: A_PAD.h }} data-off={i >= len ? '1' : undefined} data-head={i === head.at ? '1' : undefined} data-rest={on ? undefined : '1'}>
                {on && i < len && <i className="mm-s2-bar" style={{ height: 8 + t * (A_PAD.h - 30) }} />}
                <b
                  className="mm-s2-val"
                  role="button"
                  tabIndex={i < len ? 0 : -1}
                  onPointerDown={(e) => {
                    if (i >= len) return;
                    e.stopPropagation();
                    e.preventDefault();
                    nd.toggleRest(i);
                  }}
                >
                  {i >= len ? '' : on ? degreeName(chord, d as number) : 'REST'}
                </b>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mm-s2-pads" {...paint}>
          {st[sel].map((v, i) => (
            <button
              key={i}
              type="button"
              className="mm-s2-pad"
              data-i={i}
              style={{ left: aX(i), top: A_TOP.pads, width: A_PAD.w, height: A_PAD.h }}
              data-off={i >= len ? '1' : undefined}
              data-head={i === head.at ? '1' : undefined}
              data-set={v !== DEF[sel] ? '1' : undefined}
              aria-label={`${LABEL[sel]} step ${i + 1}: ${valText(sel, v)}`}
            >
              <Glyph t={sel} v={v} w={A_PAD.w - 8} h={A_PAD.h - 34} />
              <b className="mm-s2-val">{i >= len ? '' : valText(sel, v)}</b>
            </button>
          ))}
        </div>
      )}
      <p className="mm-s2-gest" style={{ top: A_TOP.pads + A_PAD.h + 10 }}>
        {GESTURE[sel === 'notes' ? 'notes' : 'track']}
      </p>
      {sel !== 'notes' ? (
        <PcbKey className="mm-s2-clr" style={{ right: 20, top: A_TOP.pads + A_PAD.h + 8 }} w={24} h={11} name={`CLEAR ${LABEL[sel]}`} disabled={arpSteps.isDefault(sel)} onClick={() => arpSteps.reset(sel)} />
      ) : (
        <PcbKey className="mm-s2-clr" style={{ right: 20, top: A_TOP.pads + A_PAD.h + 8 }} w={24} h={11} name="NOTES FROM THE KNOBS" disabled={!sq.edit} onClick={() => seq.auto()} />
      )}
    </PcbFrame>
  );
};

/* ---------------- SEQ B : NOTES et une seconde piste, une colonne qui balaie ---------------- */

const B_PAD = 50;
const bX = (i: number): number => 112 + i * 52 + Math.floor(i / 4) * 12;
const B_TOP = { heads: 44, notes: 64, notesH: 88, keys: 170, lane: 198, laneH: 58 };

const StepsB: React.FC = () => {
  const st = useSteps();
  const sq = useSyncExternalStore(seq.subscribe, seq.get, seq.get);
  const l2 = useSyncExternalStore(laneStore.subscribe, laneStore.get, laneStore.get).split('|')[1] as StepTrack;
  const head = useHead();
  const { chord, notes, len: len0 } = useChord();
  const len = Math.max(1, head.len || len0);
  const flash = useFlash('STEP SEQUENCER');
  const paint = usePaint(l2, len);
  const nd = useNoteDraw(chord, len, bX, B_PAD, B_TOP.notesH, B_TOP.notes);
  const W = ZONE.w;
  return (
    <PcbFrame title="STEP SEQUENCER" x={ZONE.x} y={60} w={W} h={282} className="mm-s2 mm-s2-b" flash={flash}>
      <SeqTop chord={chord} top={20} />
      {head.at >= 0 && (
        <>
          <i className="mm-s2-sweep" style={{ left: bX(head.at) - 5, top: B_TOP.heads - 6, width: B_PAD + 10, height: B_TOP.notes + B_TOP.notesH - B_TOP.heads + 12 }} aria-hidden="true" />
          <i className="mm-s2-sweep" style={{ left: bX(head.at) - 5, top: B_TOP.lane - 6, width: B_PAD + 10, height: B_TOP.laneH + 12 }} aria-hidden="true" />
        </>
      )}
      <StepHeads top={B_TOP.heads} at={head.at} len={len} x={bX} w={B_PAD} />
      <span className="mm-s2-lname" style={{ top: B_TOP.notes + 30 }}>
        NOTES
        <i className="mm-p2-led" data-on={sq.edit ? '1' : undefined} />
      </span>
      <div ref={nd.ref} className="mm-s2-pads mm-s2-notes" {...nd.handlers}>
        {Array.from({ length: STEPS_N }, (_, i) => {
          const d = i < notes.length ? notes[i] : undefined;
          const on = typeof d === 'number';
          const t = on ? ((d as number) - SEQ_MIN) / (SEQ_TOP - SEQ_MIN) : 0;
          return (
            <div key={i} className="mm-s2-pad mm-s2-lanecell" style={{ left: bX(i), top: B_TOP.notes, width: B_PAD, height: B_TOP.notesH }} data-off={i >= len ? '1' : undefined} data-head={i === head.at ? '1' : undefined}>
              {on && i < len && <i className="mm-s2-bar" style={{ height: 8 + t * (B_TOP.notesH - 30) }} />}
              <b
                className="mm-s2-val"
                role="button"
                tabIndex={i < len ? 0 : -1}
                onPointerDown={(e) => {
                  if (i >= len) return;
                  e.stopPropagation();
                  e.preventDefault();
                  nd.toggleRest(i);
                }}
              >
                {i >= len ? '' : on ? degreeName(chord, d as number) : 'REST'}
              </b>
            </div>
          );
        })}
      </div>
      <div className="mm-s2-keys" style={{ top: B_TOP.keys, left: bX(0) }} role="radiogroup" aria-label="Second track">
        {STEP_TRACKS.map((t) => (
          <PcbKey
            key={t.id}
            role="radio"
            data-track={t.id}
            aria-checked={t.id === l2}
            on={t.id === l2}
            className={t.id === l2 ? 'mm-s2-tab is-sel' : 'mm-s2-tab'}
            name={LABEL[t.id]}
            cap={
              <>
                <i className="mm-p2-led mm-s2-cled" data-on={laneLit(t.id, head.at, sq.edit) ? '1' : undefined} />
                <span>{LABEL[t.id]}</span>
              </>
            }
            w={66}
            h={15}
            onClick={() => laneStore.set(null, t.id)}
          />
        ))}
        <span className="mm-s2-help">
          <b>{LABEL[l2]}</b> {HELP[l2]} <i>·</i> {GESTURE.track}
        </span>
      </div>
      <span className="mm-s2-lname" style={{ top: B_TOP.lane + 22 }}>
        {LABEL[l2]}
      </span>
      <div className="mm-s2-pads" {...paint}>
        {st[l2].map((v, i) => (
          <button
            key={i}
            type="button"
            className="mm-s2-pad mm-s2-lanecell"
            data-i={i}
            style={{ left: bX(i), top: B_TOP.lane, width: B_PAD, height: B_TOP.laneH }}
            data-off={i >= len ? '1' : undefined}
            data-head={i === head.at ? '1' : undefined}
            data-set={v !== DEF[l2] ? '1' : undefined}
            aria-label={`${LABEL[l2]} step ${i + 1}: ${valText(l2, v)}`}
          >
            <Glyph t={l2} v={v} w={B_PAD - 10} h={B_TOP.laneH - 26} />
            <b className="mm-s2-val">{i >= len ? '' : valText(l2, v)}</b>
          </button>
        ))}
      </div>
      <PcbKey className="mm-s2-clr" style={{ left: 20, top: B_TOP.lane + 40 }} w={24} h={11} name="CLEAR" disabled={arpSteps.isDefault(l2)} onClick={() => arpSteps.reset(l2)} aria-label={`Clear ${LABEL[l2]}`} />
    </PcbFrame>
  );
};

/** SEQ : le sequenceur en haut, RANDOM, ARP, les LFO et la matrice dessous (les memes qu'avant, remontes). */
export const SeqPage2: React.FC<{ v: string }> = ({ v }) => {
  useExtraAll();
  const y = v === 'B' ? 360 : 330;
  const GAP = 16;
  const rowW = SEQ_ROW.reduce((s, f) => s + frameW(f), 0) + GAP * SEQ_ROW.length + RND_W;
  let x = ZONE.x + Math.round((ZONE.w - rowW) / 2);
  const rnd = x;
  x += RND_W + GAP;
  return (
    <div className="mm-s2-page" data-v={v}>
      {v === 'B' ? <StepsB /> : <StepsA />}
      <RandomBox x={rnd} y={y} />
      {SEQ_ROW.map((f, i) => {
        const fx = x;
        x += frameW(f) + GAP;
        return <Frame key={f.title} f={f} x={fx} y={y} sep={i < SEQ_ROW.length - 1} />;
      })}
      <Matrix y={y + FRAME_H + 8} />
    </div>
  );
};
