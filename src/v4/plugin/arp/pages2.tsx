/**
 * Les pages OPEN refaites (v46, 2026-11-20 ; les maquettes v44 choisies par Mika, sans drapeau d'URL) :
 *
 * 1. La barre des pages (Mika : l'ancienne "moche") : des touches mates, la LED dans la touche, le nom grave dessus ; la
 *    page montree : sa LED a la couleur d'accent, son nom eclaire (option C).
 * 2. SOUND facon Legend ("occupe l'espace ; le filtre est super cool, garde-lui de l'espace") : l'EQ en haut sur presque
 *    toute la largeur, MASTER et ANALYZER a droite, les effets en cinq colonnes dessous, des barres de titre de metal
 *    (option A). Sur un point de l'EQ : glisser regle FREQ et GAIN, Maj + glisser (ou la molette) son Q, Alt : fin
 *    (HoodBoard.tsx EqScreen). Tout finit a bonne distance du bandeau du bas, la valeur d'un potard touche comprise.
 * 3. SEQ ("trop complexe, on devrait voir l'avancement des pas" ; puis "quelque chose de precis et aussi simple
 *    d'utilisation, meme si nous avons plein de parametres, quelque chose d'intuitif") : une piste a la fois (NOTES,
 *    ACCENT, SLIDE, GATE, RATCHET, CHANCE), seize grandes touches ou chaque valeur est dessinee et ecrite ; au-dessus, une
 *    rangee de seize LED commune a toutes les pistes (la tete, et sous chaque pas une pastille par piste qui y agit). Un
 *    geste par chose : clic = allume ou eteint, glisser vertical = la valeur, glisser sur plusieurs pas = dessiner,
 *    clic droit ou double clic = le pas remis a zero, la poignee END = la longueur de la suite. La tete : mm_transport
 *    (pos, len), plus skip (CHANCE a saute le pas) et dur (la duree du pas) depuis la v46 (steps.ts stepLive).
 *
 * Tout est de la face du VST3 seul (gate PLUGIN_ARP, comme HoodBoard.tsx) ; aucun reglage hote nouveau.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { arp, arpExternal } from '../../voyager/arp';
import { CHORDS, arpKey } from '../../voyager/chords';
import { voyParams } from '../../voyager/params';
import { seq, SEQ_MIN, SEQ_TOP, type SeqStep } from '../../voyager/seq';
import { extHead } from '../head';
import { HOOD_PAGES, hoodPage, hoodPageIndex } from './hoodPage';
import { PcbFrame, PcbKey, PcbKnob, PcbRotary, PcbSelect, PcbStep, PcbToggle } from './pcbui';
import { arpSteps, STEP_TRACKS, STEPS_N, stepLive, type StepTrack } from './steps';
import { EqBandKeys, EqScreen, eqBandStore, Frame, frameW, qid, RandomBox, RND_W, SEQ_ROW, useExtraAll, useFlash, useSteps, X, ZONE } from './HoodBoard';
import { knobNote, lastOn, LEVELS, noteName, notesViewStore, rotate, SOFT_RANDOM, writeNotes } from './seqEdit';
import './pages2.css';

/* =====================================================================================================================
   1. la barre des pages
   ===================================================================================================================== */

/** Les pages : un clic y va (le volet LIBRARY / MIDI se ferme), un re-clic sur la page montree ramene a la face. */
export const NavKeys: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const st = useSyncExternalStore(hoodPage.subscribe, hoodPage.get, hoodPage.get);
  const cur = st.overlay ? -1 : hoodPageIndex(st);
  const go = (i: number): void => {
    const p = HOOD_PAGES[i];
    if (i === cur) onClose();
    else hoodPage.set({ tab: p.tab, fx: p.fx ?? st.fx, overlay: null });
  };
  return (
    <div className="mm-nv" role="tablist" aria-label="Page">
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
   2. SOUND facon Legend
   ===================================================================================================================== */

/** Une section : sa barre de titre de metal, ses pieces en rangees centrees, une rangee tous les PITCH px. */
const PITCH = 78;
const BAR = 24;
const Sect: React.FC<{ title: string; x: number; y: number; w: number; rows: React.ReactNode[]; led?: boolean; h?: number }> = ({ title, x, y, w, rows, led, h }) => {
  const f = useFlash(title);
  return (
    <PcbFrame title={title} x={x} y={y} w={w} h={h ?? BAR + rows.length * PITCH - 8} className="mm-lg" led={led} flash={f}>
      {rows.map((r, i) => (
        <div key={i} className="mm-lg-row" style={{ top: BAR + i * PITCH }}>
          {r}
        </div>
      ))}
    </PcbFrame>
  );
};

const fk = (id: string, name: string): React.ReactNode => <PcbKnob key={id} id={id} name={name} ref_="" lo="" hi="" fine />;

const eqLed = (): boolean =>
  [1, 2, 3, 4, 5, 6].some((b) => X(qid(b, 'On')) >= 0.5 && (Math.abs(X(qid(b, 'Gain')) - 0.5) > 0.0005 || X(qid(b, 'Type')) === 0 || X(qid(b, 'Type')) === 1 || Math.round(X(qid(b, 'Type')) * 5) === 3));

/** Les sections des effets (les memes reglages que la page d'avant, les memes ids). */
const MASTER_ROWS = (): React.ReactNode[] => [
  <>
    <PcbKnob id="xWarmth" name="WARMTH" ref_="" lo="OFF" hi="FULL" />
    {fk('xBass', 'BASS')}
  </>,
  <>
    {fk('xAir', 'AIR')}
    {fk('xWidth', 'WIDTH')}
  </>,
];
const PHASER_ROWS = (): React.ReactNode[] => [
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
];
const FLANGER_ROWS = (): React.ReactNode[] => [
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
];
const CHORUS_ROWS = (): React.ReactNode[] => [
  <PcbRotary key="m" id="vChMode" name="MODE" ref_="" w={96} />,
  <>
    {fk('xChRate', 'RATE')}
    {fk('xChDepth', 'DEPTH')}
  </>,
  <>
    {fk('xChWidth', 'WIDTH')}
    {fk('xChMix', 'MIX')}
  </>,
];
const CRUSH_ROWS = (): React.ReactNode[] => [
  <>
    {fk('xCrushBits', 'BITS')}
    {fk('xCrushRate', 'RATE')}
  </>,
  <>
    {fk('xCrTone', 'TONE')}
    {fk('xCrMix', 'MIX')}
  </>,
];
const PUMP_ROWS = (): React.ReactNode[] => [
  <>
    {fk('xPumpDepth', 'DEPTH')}
    {fk('xPuAttack', 'ATTACK')}
  </>,
  <PcbStep key="r" id="xPumpRate" name="RATE" ref_="" w={112} />,
  <>
    {fk('xPumpShape', 'RELEASE')}
    {fk('xPuCurve', 'CURVE')}
  </>,
];

/**
 * L'EQ : sa place, son ecran ; les reglages de la bande choisie dessous, l'aide des gestes a gauche. Lu au rendu : ZONE
 * vient de HoodBoard.tsx, qui importe ce fichier (pas au chargement du module).
 */
const eqBox = () => ({ x: ZONE.x, y: 60, w: 776, h: 296, screen: 184 });

export const SoundPage: React.FC = () => {
  const EQ = eqBox();
  useExtraAll();
  useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
  const band = useSyncExternalStore(eqBandStore.subscribe, eqBandStore.get, eqBandStore.get);
  const flashEq = useFlash('EQ');
  const RX = EQ.x + EQ.w + 16;
  const RW = ZONE.x + ZONE.w - RX;
  const anaY = EQ.y + BAR + 2 * PITCH + 4;
  // les effets : cinq colonnes sous l'EQ
  const BY = EQ.y + EQ.h + 12;
  const cols = [
    { t: 'PHASER', w: 232, rows: PHASER_ROWS(), led: X('xPhMix') > 0 },
    { t: 'FLANGER', w: 240, rows: FLANGER_ROWS(), led: X('xFlMix') > 0 },
    { t: 'CHORUS', w: 176, rows: CHORUS_ROWS(), led: voyParams.of('chorus') > 0 },
    { t: 'CRUSH', w: 140, rows: CRUSH_ROWS(), led: X('xCrushBits') > 0 || X('xCrushRate') > 0 },
    { t: 'PUMP', w: 176, rows: PUMP_ROWS(), led: X('xPumpDepth') > 0 },
  ];
  const gap = (ZONE.w - cols.reduce((s, c) => s + c.w, 0)) / (cols.length - 1);
  let x = ZONE.x;
  return (
    <div className="mm-lg-page">
      <PcbFrame title="EQ" x={EQ.x} y={EQ.y} w={EQ.w} h={EQ.h} className="mm-lg mm-lg-eq" led={eqLed()} flash={flashEq}>
        <div className="mm-dm-place" style={{ left: 0, top: BAR }}>
          <EqScreen w={EQ.w} h={EQ.screen} />
        </div>
        <EqBandKeys />
        <div className="mm-lg-row mm-lg-eqrow" style={{ top: BAR + EQ.screen + 6 }}>
          <PcbSelect id={qid(band, 'Type')} name="TYPE" ref_="" w={84} cols={2} />
          <PcbKnob id={qid(band, 'Freq')} name="FREQ" ref_="" lo="" hi="" fine />
          <PcbKnob id={qid(band, 'Gain')} name="GAIN" ref_="" lo="" hi="" fine />
          <PcbKnob id={qid(band, 'Q')} name="Q" ref_="" lo="" hi="" fine />
          <PcbStep id={qid(band, 'Slope')} name="SLOPE" ref_="" w={110} />
          <PcbKnob id="xQOut" name="OUTPUT" ref_="" lo="" hi="" fine />
        </div>
        <p className="mm-lg-hint" style={{ left: 6, top: BAR + EQ.screen + 66, width: 214 }}>
          <b>DRAG A POINT</b> FREQ + GAIN
          <br />
          <b>SHIFT + DRAG</b> OR <b>WHEEL</b> Q <i>·</i> <b>ALT</b> FINE
        </p>
      </PcbFrame>
      <i className="mm-lg-vsep" style={{ left: RX - 8, top: EQ.y, height: EQ.h }} />
      <Sect title="MASTER" x={RX} y={EQ.y} w={RW} rows={MASTER_ROWS()} />
      <Sect title="ANALYZER" x={RX} y={anaY} w={RW} rows={[<PcbStep key="a" id="xQAna" name="ANALYZER" ref_="" w={120} />]} h={EQ.y + EQ.h - anaY} />
      <i className="mm-lg-hsep" style={{ left: ZONE.x, top: BY - 7, width: ZONE.w }} />
      {cols.map((c, i) => {
        const cx = x;
        x += c.w + gap;
        return (
          <React.Fragment key={c.t}>
            {i > 0 && <i className="mm-lg-vsep" style={{ left: cx - gap / 2, top: BY, height: BAR + 3 * PITCH - 8 }} />}
            <Sect title={c.t} x={cx} y={BY} w={c.w} rows={c.rows} led={c.led} />
          </React.Fragment>
        );
      })}
    </div>
  );
};

/* =====================================================================================================================
   3. SEQ : une piste a la fois, la tete sur toutes les pistes
   ===================================================================================================================== */

type Lane = 'notes' | StepTrack;
const LANES: readonly Lane[] = ['notes', ...STEP_TRACKS.map((t) => t.id)];
const LABEL: Record<Lane, string> = { notes: 'NOTES', acc: 'ACCENT', slide: 'SLIDE', gate: 'GATE', rat: 'RATCHET', prob: 'CHANCE' };
/** Ce que fait chaque piste, en clair (sous les pas). */
const HELP: Record<Lane, string> = {
  notes: 'WHICH NOTE EACH STEP PLAYS, OR A REST',
  acc: 'HOW HARD EACH STEP HITS',
  slide: 'GLIDES INTO THE NEXT NOTE',
  gate: 'HOW LONG EACH NOTE HOLDS',
  rat: 'REPEATS THE NOTE INSIDE ITS STEP',
  prob: 'THE CHANCE THAT THE STEP PLAYS',
};
const GESTURE: Record<'notes' | 'track', string> = {
  notes: 'CLICK: NOTE / REST · DRAG UP / DOWN: PITCH · DRAG ACROSS: DRAW · RIGHT OR DOUBLE CLICK: THE KNOB NOTE · DRAG END: LENGTH',
  track: 'CLICK: ON / OFF · DRAG UP / DOWN: VALUE · DRAG ACROSS: DRAW · RIGHT OR DOUBLE CLICK: RESET · DRAG END: LENGTH',
};
const DEF: Record<StepTrack, number> = Object.fromEntries(STEP_TRACKS.map((t) => [t.id, t.def])) as Record<StepTrack, number>;
// v50 : LEVELS et lastOn (le dernier niveau dessine sur une piste) sont partages avec la page SQ de l'encart (seqEdit.ts)
/** Le texte court d'une valeur, sous son dessin. */
const valText = (t: StepTrack, v: number): string => {
  switch (t) {
    case 'acc':
      return ['SOFT', 'NORM', 'ACC'][v] ?? String(v);
    case 'slide':
      return v ? 'SLIDE' : 'OFF';
    case 'gate':
      return ['SHORT', 'NORM', 'LONG', 'TIE'][v] ?? String(v);
    case 'rat':
      return `x${v}`;
    default:
      return `${v}%`;
  }
};

/** La piste montree : gardee entre deux visites de la page. */
let laneSel: Lane = 'notes';
const laneL = new Set<() => void>();
const laneStore = {
  get: (): Lane => laneSel,
  set(a: Lane): void {
    laneSel = a;
    laneL.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    laneL.add(fn);
    return () => {
      laneL.delete(fn);
    };
  },
};

/** La cle de la tete : une nouvelle position (son numero), CHANCE qui saute, l'arret. */
const liveKey = (): string => {
  const h = arpExternal.headState;
  return h.playing && h.pos >= 0 ? `${h.pos}|${h.len}|${h.seq}|${stepLive.skip ? 1 : 0}` : '';
};

/**
 * La tete : le pas joue (pos modulo 16), -1 a l'arret ; skip : CHANCE l'a saute ; lit : allumee le temps du pas (dur, plus
 * 45 ms pour la cadence de 30 Hz du C++ ; sans dur, un C++ d'avant : jusqu'a la position suivante, comme avant).
 */
function useHead(): { at: number; skip: boolean; lit: boolean } {
  const k = useSyncExternalStore(extHead.onWake, liveKey, liveKey);
  const [, tick] = useState(0);
  const h = arpExternal.headState;
  const end = stepLive.dur > 0 ? stepLive.t + stepLive.dur + 45 : Infinity;
  useEffect(() => {
    if (!k || !Number.isFinite(end)) return undefined;
    const left = end - performance.now();
    if (left <= 0) return undefined;
    const t = window.setTimeout(() => tick((n) => n + 1), left + 1);
    return () => window.clearTimeout(t);
  }, [k, end]);
  if (!k) return { at: -1, skip: false, lit: false };
  return { at: h.pos % STEPS_N, skip: stepLive.skip, lit: performance.now() < end };
}

/** L'accord dont on lit les notes : celui qui joue, sinon le premier (un clic sur CHORD en choisit un). */
function useChord(): { chord: number; notes: SeqStep[]; len: number } {
  const sq = useSyncExternalStore(seq.subscribe, seq.get, seq.get);
  const ar = useSyncExternalStore(arp.subscribe, arp.get, arp.get);
  const view = useSyncExternalStore(notesViewStore.subscribe, notesViewStore.get, notesViewStore.get);
  useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
  // v52 : la tonalite (CHORDS sous les pads) : les noms des accords et des notes suivent
  useSyncExternalStore(arpKey.subscribe, arpKey.get, arpKey.get);
  const playing = ar.running && arpExternal.headState.chord >= 0 ? arpExternal.headState.chord : -1;
  const chord = view ?? (playing >= 0 ? playing : (ar.prog[0] ?? 0));
  const notes = seq.shown(chord);
  return { chord, notes, len: Math.max(1, Math.min(STEPS_N, sq.edit ? sq.len : notes.length || STEPS_N)) };
}

// v50 : knobNote, writeNotes, rotate, noteName : seqEdit.ts (la page SQ de l'encart d'EDIT s'en sert aussi)

/* ---------------- la mise en page (le repere du cadre STEP SEQUENCER) ---------------- */

const PW = 44;
const sx = (i: number): number => 136 + i * 53 + Math.floor(i / 4) * 8;
const GRID_R = sx(STEPS_N - 1) + PW;
/** v51 : les touches prennent la hauteur laissee par la matrice (partie dans l'encart d'EDIT en v50) : plus de bande
 * vide sous la rangee RANDOM / ARP / LFO, et plus de precision quand on dessine (108 de haut avant). */
const PAD_H = 298;
const T = { strip: 50, pads: 92, padH: PAD_H, area: PAD_H - 28, foot: 92 + PAD_H + 8 };
/** la hauteur du cadre STEP SEQUENCER (sous les touches : l'aide et les gestes) */
const SEQ_H = T.foot + 42;
/** Le dessin d'une valeur : sa zone dans la touche (le haut : le plus). */
const AREA = { top: 6, h: T.area - 6 };

/** La rangee du haut : CHORD, d'ou viennent les notes, STEPS - + (comme avant). */
const SeqTop: React.FC<{ chord: number; len: number }> = ({ chord, len }) => {
  const sq = useSyncExternalStore(seq.subscribe, seq.get, seq.get);
  const ar = useSyncExternalStore(arp.subscribe, arp.get, arp.get);
  useSyncExternalStore(arpKey.subscribe, arpKey.get, arpKey.get);
  return (
    <div className="mm-sq-top" style={{ top: 20 }}>
      <span className="mm-sq-lab">CHORD</span>
      {CHORDS.map((c, i) => (
        <PcbKey
          key={i}
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
      <PcbKey name="−" cap={<span>−</span>} w={20} h={13} onClick={() => seq.setLen(chord, len - 1)} aria-label="Fewer steps" />
      <b className="mm-sq-n">{len}</b>
      <PcbKey name="+" cap={<span>+</span>} w={20} h={13} onClick={() => seq.setLen(chord, len + 1)} aria-label="More steps" />
    </div>
  );
};

/** L'icone d'une piste (son onglet) : la forme de ses valeurs. */
const LaneIcon: React.FC<{ t: Lane }> = ({ t }) => (
  <svg className="mm-sx-ico" width="16" height="10" viewBox="0 0 16 10" aria-hidden="true">
    {t === 'notes' && (
      <>
        <rect x="1" y="5" width="3" height="5" />
        <rect x="6.5" y="1" width="3" height="9" />
        <rect x="12" y="3" width="3" height="7" />
      </>
    )}
    {t === 'acc' && <path className="ln" d="M2 1.5 L14 5 L2 8.5" />}
    {t === 'slide' && <path className="ln" d="M1 8.5 C 6 8.5, 9 1.5, 15 1.5" />}
    {t === 'gate' && (
      <>
        <rect x="1" y="3.5" width="10" height="3" rx="1" />
        <path className="ln thin" d="M13.5 1.5 V8.5" />
      </>
    )}
    {t === 'rat' && (
      <>
        <circle cx="3" cy="5" r="1.7" />
        <circle cx="8" cy="5" r="1.7" />
        <circle cx="13" cy="5" r="1.7" />
      </>
    )}
    {t === 'prob' && (
      <>
        <circle cx="4" cy="2.6" r="1.6" className="ln thin" />
        <circle cx="12" cy="7.4" r="1.6" className="ln thin" />
        <path className="ln thin" d="M13 1 L3 9" />
      </>
    )}
  </svg>
);

/** Les petits crans d'un niveau (le bord droit de la touche) : ou en est la valeur, glisser vertical les parcourt. */
const Ladder: React.FC<{ n: number; k: number; w: number }> = ({ n, k, w }) => (
  <>
    {Array.from({ length: n }, (_, j) => (
      <rect key={j} className={j === k ? 'tick on' : 'tick'} x={w - 4} y={AREA.top + AREA.h - 2 - (j * (AREA.h - 4)) / Math.max(1, n - 1)} width={4} height={2} rx={1} />
    ))}
  </>
);

/** Le dessin d'une valeur de piste dans sa touche. */
const Val: React.FC<{ t: StepTrack; v: number }> = ({ t, v }) => {
  const w = PW - 6;
  const set = v !== DEF[t];
  const lv = LEVELS[t];
  const k = Math.max(0, lv.indexOf(v));
  const bottom = AREA.top + AREA.h;
  let body: React.ReactNode = null;
  switch (t) {
    case 'acc': {
      const bh = (AREA.h - 8) / 3;
      body = [0, 1, 2].map((j) => (
        <rect key={j} x={w * 0.2} y={bottom - (j + 1) * bh - j * 4 + 2} width={w * 0.52} height={bh} rx={2} className={j <= v ? (v === 2 ? 'hot' : v === 0 ? 'lit dim' : 'lit') : 'off'} />
      ));
      break;
    }
    case 'slide':
      body = v ? (
        <>
          <path className="ln hot" d={`M${w * 0.08} ${bottom - 12} C ${w * 0.55} ${bottom - 12}, ${w * 0.6} ${AREA.top + 14}, ${w + 10} ${AREA.top + 14}`} />
          <circle className="hot" cx={w * 0.08} cy={bottom - 12} r={3} />
        </>
      ) : (
        <path className="ln off" d={`M${w * 0.25} ${bottom - 12}H${w * 0.75}`} />
      );
      break;
    case 'gate': {
      const f = [0.25, 0.5, 0.75, 1][v] ?? 0.5;
      const y = bottom - 10 - (k * (AREA.h - 26)) / 3;
      body = (
        <>
          <rect x={2} y={y - 6} width={(w - 8) * f + (v === 3 ? 14 : 0)} height={12} rx={2} className={set ? 'hot' : 'lit'} />
          <Ladder n={4} k={k} w={w} />
        </>
      );
      break;
    }
    case 'rat': {
      const gap = 3;
      const bw = (w - 10 - gap * (v - 1)) / v;
      const bh = 18 + (k * (AREA.h - 38)) / 3;
      body = (
        <>
          {Array.from({ length: v }, (_, j) => (
            <rect key={j} x={2 + j * (bw + gap)} y={bottom - bh} width={bw} height={bh} rx={2} className={set ? 'hot' : 'lit'} />
          ))}
          <Ladder n={4} k={k} w={w} />
        </>
      );
      break;
    }
    default: {
      const f = v / 100;
      body = (
        <>
          <rect x={w * 0.22} y={AREA.top} width={w * 0.5} height={AREA.h} rx={3} className="tank" />
          {[0.25, 0.5, 0.75].map((q) => (
            <rect key={q} x={w * 0.72 + 2} y={AREA.top + AREA.h * (1 - q) - 0.5} width={4} height={1} className="tick" />
          ))}
          <rect x={w * 0.22} y={AREA.top + AREA.h * (1 - f)} width={w * 0.5} height={AREA.h * f} rx={3} className={set ? 'hot' : 'lit'} />
        </>
      );
    }
  }
  return (
    <svg className={set ? 'mm-sx-val on' : 'mm-sx-val'} width={w} height={T.area} viewBox={`0 0 ${w} ${T.area}`} aria-hidden="true">
      {body}
    </svg>
  );
};

/** Le dessin d'une note : sa hauteur (une barre), les octaves de la racine en fines lignes. */
const NoteVal: React.FC<{ d: number | null }> = ({ d }) => {
  const w = PW - 6;
  const y = (deg: number): number => AREA.top + AREA.h * (1 - (deg - SEQ_MIN) / (SEQ_TOP - SEQ_MIN));
  return (
    <svg className="mm-sx-val mm-sx-note" width={w} height={T.area} viewBox={`0 0 ${w} ${T.area}`} aria-hidden="true">
      {[0, 7, 14, 21].map((o) => (
        <rect key={o} x={1} y={y(o) - 0.5} width={w - 2} height={1} className={o === 0 ? 'oct root' : 'oct'} />
      ))}
      {d !== null ? (
        <>
          <rect x={w * 0.2} y={y(d)} width={w * 0.6} height={AREA.top + AREA.h - y(d)} rx={2} className="bar" />
          <rect x={w * 0.12} y={y(d) - 1.5} width={w * 0.76} height={3} rx={1.5} className="hot" />
        </>
      ) : (
        <path className="ln off" d={`M${w * 0.3} ${AREA.top + AREA.h - 8}H${w * 0.7}`} />
      )}
    </svg>
  );
};

/** Les gestes de la grille : un clic (allume / eteint), glisser (la valeur, dessiner), clic droit ou double clic (zero). */
function useGrid(lane: Lane, chord: number, len: number, notes: SeqStep[]) {
  const ref = useRef<HTMLDivElement>(null);
  const g = useRef<{ pid: number; x0: number; y0: number; i0: number; draw: boolean; last: { i: number; y: number } | null } | null>(null);
  const rest = useRef<(number | null)[]>([]);
  const local = (e: { clientX: number; clientY: number }): { x: number; y: number; k: number } => {
    const el = ref.current!;
    const r = el.getBoundingClientRect();
    const k = r.width / el.offsetWidth || 1;
    return { x: (e.clientX - r.left) / k + sx(0) - 4, y: (e.clientY - r.top) / k, k };
  };
  /** le pas sous x (le plus proche, borne a la suite quand on dessine) */
  const stepAt = (x: number, clamp: boolean): number => {
    let best = -1;
    let dist = Infinity;
    for (let i = 0; i < STEPS_N; i += 1) {
      const c = sx(i) + PW / 2;
      const dd = Math.abs(x - c);
      if (dd < dist) {
        dist = dd;
        best = i;
      }
    }
    if (!clamp && dist > PW / 2 + 4) return -1;
    return clamp ? Math.min(best, len - 1) : best;
  };
  /** la hauteur y (le repere de la rangee des touches) en 0..1 */
  const level = (y: number): number => Math.min(1, Math.max(0, (AREA.top + AREA.h - y) / AREA.h));
  const put = (i: number, t: number): void => {
    if (i < 0 || i >= len) return;
    if (lane === 'notes') {
      seq.setStep(chord, i, Math.round(SEQ_MIN + t * (SEQ_TOP - SEQ_MIN)));
      return;
    }
    const lv = LEVELS[lane];
    const v = lv[Math.round(t * (lv.length - 1))];
    arpSteps.set(lane, i, v);
    if (v !== DEF[lane]) lastOn[lane] = v;
  };
  const toggle = (i: number): void => {
    if (i < 0 || i >= len) return;
    if (lane === 'notes') {
      const cur = notes[i];
      if (cur === null || cur === undefined) seq.setStep(chord, i, rest.current[i] ?? knobNote(chord, i));
      else {
        rest.current[i] = cur;
        seq.setStep(chord, i, null);
      }
      return;
    }
    const v = arpSteps.get()[lane][i];
    arpSteps.set(lane, i, v === DEF[lane] ? lastOn[lane] : DEF[lane]);
  };
  const reset = (i: number): void => {
    if (i < 0 || i >= len) return;
    if (lane === 'notes') seq.setStep(chord, i, knobNote(chord, i));
    else arpSteps.set(lane, i, DEF[lane]);
  };
  const handlers: React.HTMLAttributes<HTMLDivElement> = {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button === 2) {
        e.preventDefault();
        reset(stepAt(local(e).x, false));
        return;
      }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const p = local(e);
      const i = stepAt(p.x, false);
      if (i < 0 || i >= len) return;
      e.preventDefault();
      g.current = { pid: e.pointerId, x0: p.x, y0: p.y, i0: i, draw: false, last: null };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* rien */
      }
    },
    onPointerMove: (e) => {
      const d = g.current;
      if (!d || e.pointerId !== d.pid) return;
      const p = local(e);
      if (!d.draw) {
        if (Math.hypot(p.x - d.x0, p.y - d.y0) < 4) return;
        d.draw = true;
        d.last = { i: d.i0, y: d.y0 };
        put(d.i0, level(p.y));
      }
      const i = stepAt(p.x, true);
      const last = d.last!;
      // le crayon : les pas sautes entre deux evenements prennent la hauteur au prorata
      if (i !== last.i) {
        const dir = i > last.i ? 1 : -1;
        for (let j = last.i + dir; j !== i; j += dir) put(j, level(last.y + ((p.y - last.y) * (j - last.i)) / (i - last.i)));
      }
      put(i, level(p.y));
      d.last = { i, y: p.y };
    },
    onPointerUp: (e) => {
      const d = g.current;
      if (!d || e.pointerId !== d.pid) return;
      g.current = null;
      if (!d.draw) toggle(d.i0);
    },
    onPointerCancel: () => {
      g.current = null;
    },
    onDoubleClick: (e) => reset(stepAt(local(e).x, false)),
    onContextMenu: (e) => e.preventDefault(),
  };
  return { ref, handlers };
}

/** La poignee END : tirer de gauche a droite regle la longueur de la suite (1 a 16 pas). */
function useEndDrag(chord: number, len: number) {
  const g = useRef<{ pid: number; k: number; x0: number; at0: number } | null>(null);
  const [held, setHeld] = useState(false);
  return {
    held,
    handlers: {
      onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const el = e.currentTarget;
        const k = el.getBoundingClientRect().width / el.offsetWidth || 1;
        g.current = { pid: e.pointerId, k, x0: e.clientX, at0: sx(len - 1) + PW };
        setHeld(true);
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* rien */
        }
      },
      onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
        const d = g.current;
        if (!d || e.pointerId !== d.pid) return;
        const x = d.at0 + (e.clientX - d.x0) / d.k;
        // la longueur : le nombre de pas dont le milieu est a gauche de la poignee
        let n = 0;
        for (let i = 0; i < STEPS_N; i += 1) if (sx(i) + PW / 2 < x) n = i + 1;
        n = Math.max(1, Math.min(STEPS_N, n));
        if (n !== seq.shown(chord).length || !seq.get().edit) seq.setLen(chord, n);
      },
      onPointerUp: () => {
        g.current = null;
        setHeld(false);
      },
      onPointerCancel: () => {
        g.current = null;
        setHeld(false);
      },
    },
  };
}

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

const StepsBox: React.FC = () => {
  const st = useSteps();
  const sq = useSyncExternalStore(seq.subscribe, seq.get, seq.get);
  const sel = useSyncExternalStore(laneStore.subscribe, laneStore.get, laneStore.get);
  const head = useHead();
  const { chord, notes, len } = useChord();
  const flash = useFlash('STEP SEQUENCER');
  const grid = useGrid(sel, chord, len, notes);
  const end = useEndDrag(chord, len);
  const at = head.at;
  // ce qui agit a chaque pas, piste par piste (les pastilles de la rangee des LED, les LED des onglets)
  const acts = (t: Lane, i: number): boolean => (t === 'notes' ? typeof notes[i] === 'number' : st[t][i] !== DEF[t]);
  const laneLed = (t: Lane): boolean => {
    if (at >= 0) return at < len && acts(t, at) && !(t === 'notes' && head.skip);
    return t === 'notes' ? sq.edit : !arpSteps.isDefault(t);
  };
  const state = at < 0 ? 'STOPPED' : head.skip ? 'SKIPPED BY CHANCE' : typeof notes[at] === 'number' ? 'PLAYING' : 'REST';
  const endX = sx(len - 1) + PW + (len % 4 === 0 ? 8.5 : 4.5);
  const quick = (k: 'left' | 'right' | 'rnd' | 'clr'): void => {
    if (sel === 'notes') {
      if (k === 'clr') seq.auto();
      else if (k === 'rnd')
        writeNotes(chord, (cur) =>
          cur.map((d, j) => {
            const r = Math.random();
            if (d === null) return r < 0.5 ? knobNote(chord, j) : null;
            if (r < 0.08) return null;
            if (r < 0.4) return d + [-2, -1, 1, 2][Math.floor(Math.random() * 4)];
            return d;
          }),
        );
      else writeNotes(chord, (cur) => rotate(cur, k === 'right' ? 1 : -1));
      return;
    }
    const t = sel;
    if (k === 'clr') {
      arpSteps.reset(t);
      return;
    }
    const row = [...arpSteps.get()[t]];
    let next: number[];
    if (k === 'rnd') {
      // doux : la plupart des pas restent neutres, quelques-uns prennent une valeur voisine (seqEdit.ts)
      next = row.map((v, j) => (j < len ? SOFT_RANDOM[t](Math.random()) : v));
    } else {
      const part = rotate(row.slice(0, len), k === 'right' ? 1 : -1);
      next = row.map((v, j) => (j < len ? part[j] : v));
    }
    arpSteps.load({ ...arpSteps.plain(), [t]: next });
  };
  const isDef = sel === 'notes' ? !sq.edit : arpSteps.isDefault(sel);
  return (
    <PcbFrame title="STEP SEQUENCER" x={ZONE.x} y={60} w={ZONE.w} h={SEQ_H} className="mm-sx" flash={flash}>
      <SeqTop chord={chord} len={len} />
      {/* le pas joue, en clair */}
      <div className="mm-sx-now" style={{ top: T.strip - 2 }} data-state={state === 'PLAYING' ? 'play' : state === 'REST' ? 'rest' : state === 'STOPPED' ? 'stop' : 'skip'} role="status" aria-live="off">
        <span className="mm-sx-now-lab">STEP</span>
        <b>{at >= 0 ? pad2(at + 1) : '--'}</b>
        <i>/ {pad2(len)}</i>
        <span className="mm-sx-now-st">{state}</span>
      </div>
      {/* la rangee des LED, commune a toutes les pistes : le numero, la LED de la tete, une pastille par piste qui agit */}
      <div className="mm-sx-strip" style={{ top: T.strip }} aria-hidden="true">
        {Array.from({ length: STEPS_N }, (_, i) => (
          <span key={i} className="mm-sx-col" style={{ left: sx(i), width: PW }} data-off={i >= len ? '1' : undefined} data-beat={i % 4 === 0 ? '1' : undefined} data-head={i === at ? (head.lit ? (head.skip ? 'skip' : '1') : 'dim') : undefined}>
            <b>{i + 1}</b>
            <i className="mm-sx-led" />
            <span className="mm-sx-dots">
              {LANES.map((t) => (
                <i key={t} data-on={i < len && acts(t, i) ? '1' : undefined} data-sel={t === sel ? '1' : undefined} />
              ))}
            </span>
          </span>
        ))}
      </div>
      {/* les pistes : une touche par piste, son icone, sa LED (elle agit au pas joue ; a l'arret : elle est utilisee) */}
      <div className="mm-sx-tabs" style={{ top: T.pads, height: T.padH }} role="radiogroup" aria-label="Track">
        {LANES.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={t === sel} data-track={t} className="mm-sx-tab" data-sel={t === sel ? '1' : undefined} onClick={() => laneStore.set(t)}>
            <i className="mm-sx-tled" data-on={laneLed(t) ? '1' : undefined} aria-hidden="true" />
            <LaneIcon t={t} />
            <span>{LABEL[t]}</span>
          </button>
        ))}
      </div>
      {/* les seize touches de la piste montree */}
      <div ref={grid.ref} className="mm-sx-grid" data-lane={sel} style={{ left: sx(0) - 4, top: T.pads, width: GRID_R - sx(0) + 8, height: T.padH }} {...grid.handlers}>
        {Array.from({ length: STEPS_N }, (_, i) => {
          const off = i >= len;
          const d = sel === 'notes' ? (i < notes.length ? (notes[i] ?? null) : null) : null;
          const v = sel === 'notes' ? 0 : st[sel][i];
          const text = off ? '' : sel === 'notes' ? (d === null ? 'REST' : noteName(chord, d)) : valText(sel, v);
          return (
            <div
              key={i}
              className="mm-sx-pad"
              data-i={i}
              style={{ left: sx(i) - sx(0) + 4, width: PW, height: T.padH }}
              data-off={off ? '1' : undefined}
              data-head={i === at && head.lit ? (head.skip ? 'skip' : '1') : undefined}
              data-set={!off && (sel === 'notes' ? d !== null : v !== DEF[sel]) ? '1' : undefined}
              role="img"
              aria-label={`${LABEL[sel]} step ${i + 1}: ${off ? 'not played' : text}`}
            >
              {!off && (sel === 'notes' ? <NoteVal d={d} /> : <Val t={sel} v={v} />)}
              <b className="mm-sx-txt">{text}</b>
              {i === at && head.lit && head.skip && <em className="mm-sx-skip">SKIP</em>}
            </div>
          );
        })}
      </div>
      {/* au-dela de la suite : grise, la raison ecrite */}
      {len < STEPS_N && (
        <div className="mm-sx-off" style={{ left: sx(len) - 3, top: T.strip - 4, width: GRID_R - sx(len) + 6, height: T.pads + T.padH - T.strip + 8 }}>
          <b>NOT PLAYED</b>
          <span>
            THE SEQUENCE IS {len} STEP{len > 1 ? 'S' : ''} LONG{STEPS_N - len >= 3 ? ' · DRAG END TO ADD STEPS' : ''}
          </span>
        </div>
      )}
      {/* la poignee END */}
      <div className="mm-sx-end" data-held={end.held ? '1' : undefined} style={{ left: endX - 7, top: T.strip - 6, height: T.pads + T.padH - T.strip + 14 }} role="slider" aria-label="Sequence length" aria-valuemin={1} aria-valuemax={STEPS_N} aria-valuenow={len} tabIndex={0} {...end.handlers}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            seq.setLen(chord, len + (e.key === 'ArrowRight' ? 1 : -1));
          }
        }}
      >
        <i />
        <b>END</b>
      </div>
      {/* dessous : ce que fait la piste, les gestes, les touches rapides */}
      <p className="mm-sx-help" style={{ top: T.foot }}>
        <b>{LABEL[sel]}</b> {HELP[sel]}
      </p>
      <p className="mm-sx-gest" style={{ top: T.foot + 13 }}>
        {GESTURE[sel === 'notes' ? 'notes' : 'track']}
      </p>
      <div className="mm-sx-quick" style={{ top: T.foot + 1, right: ZONE.w - GRID_R }}>
        <button type="button" className="mm-sx-q" onClick={() => quick('left')} aria-label={`Shift ${LABEL[sel]} left`} title="Shift the steps left">
          <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
            <path d="M5.5 1 L2 4 L5.5 7" />
          </svg>
        </button>
        <button type="button" className="mm-sx-q" onClick={() => quick('right')} aria-label={`Shift ${LABEL[sel]} right`} title="Shift the steps right">
          <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
            <path d="M2.5 1 L6 4 L2.5 7" />
          </svg>
        </button>
        <span className="mm-sx-qlab">SHIFT</span>
        <button type="button" className="mm-sx-q mm-sx-qw" onClick={() => quick('rnd')} aria-label={`Gentle random ${LABEL[sel]}`} title="A few gentle changes">
          RANDOM
        </button>
        <button type="button" className="mm-sx-q mm-sx-qw" disabled={isDef} onClick={() => quick('clr')} aria-label={sel === 'notes' ? 'Notes back to the knobs' : `Clear ${LABEL[sel]}`} title={sel === 'notes' ? 'Back to the notes of the knobs' : 'Every step back to neutral'}>
          CLEAR
        </button>
      </div>
    </PcbFrame>
  );
};

/** SEQ : le sequenceur en haut, RANDOM, ARP, les LFO dessous (v50 : la matrice est dans l'encart d'EDIT, page LFO ; v51 : le
 * sequenceur prend sa place, la rangee descend au bas du capot). */
export const SeqPage: React.FC = () => {
  useExtraAll();
  const y = 60 + SEQ_H + 20;
  const GAP = 16;
  const rowW = SEQ_ROW.reduce((s, f) => s + frameW(f), 0) + GAP * SEQ_ROW.length + RND_W;
  let x = ZONE.x + Math.round((ZONE.w - rowW) / 2);
  const rnd = x;
  x += RND_W + GAP;
  return (
    <div className="mm-s2-page">
      <StepsBox />
      <RandomBox x={rnd} y={y} />
      {SEQ_ROW.map((f, i) => {
        const fx = x;
        x += frameW(f) + GAP;
        return <Frame key={f.title} f={f} x={fx} y={y} sep={i < SEQ_ROW.length - 1} />;
      })}
    </div>
  );
};
