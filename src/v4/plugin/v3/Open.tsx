/**
 * La face v3 du plugin (2026-11-25) : les pages d'OPEN, toute la fenetre, comme le MM-ARP (les onglets en haut, la bande
 * LIBRARY / MIDI / LEARN en bas). SAMPLE (l'editeur du sample garde : Mika, "j'aime le fait d'editer les samples directement
 * de cette maniere"), SEQ (les pas de la piste, voie par voie), LFO (les deux LFO de la piste), DISTO, CHORUS, DELAY,
 * REVERB, HELL (chaque page d'effet : sa rangee PER TRACK, les envois des 16 pistes), MASTER (COMP, BIT, TONE, le mixer des
 * 16 pistes), LIBRARY (les presets) et MIDI (DRAG MIDI, les niveaux). Les reglages sont ceux de la machine (rien de neuf) :
 * les maquettes, docs/maquettes/mm-rytm-v3.
 */

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { anyDial, anyDialReset, clearKey, faceKeyDown, faceKeyUp, fileImport, lockMode, trackMuteFlip, trackSelect, type DialId } from '../../actions';
import { lockOf } from '../../audio/locks';
import { pattern, velocity } from '../../audio/pattern';
import { trigger } from '../../audio/drums';
import { samplePcm, samplesOf } from '../../audio/samples';
import { CONDS } from '../../audio/trig';
import { TRACK_KEYS, TRACK_NAMES, isLegacyTrack, tracks, typedFamily, type TrackKey } from '../../audio/tracks';
import { REVERB_PRESETS, DIST_PRESETS, DIST_STYLE_TEXT, HELL_PRESETS, distLowHz, presetPatch, type LabKnob, type LabPreset } from '../../state/labFx';
import { DIST_DRIVE, DIST_TONE, HELL_ECHO, HELL_LFO, HELL_OUT, HELL_SHIFT } from '../../state/labFx';
import { lcdMessage } from '../../state/lcdMessage';
import { perform } from '../../state/perform';
import { rytmLock } from '../../state/rytmLock';
import { undo } from '../../state/undo';
import { voices } from '../../state/voices';
import { Curve, Spiral, revText } from '../FxTab';
import { meters } from '../meters';
import { Waveform, playWindow, smpLabel } from '../OpenPanel';
import { fxCtl, slotCtl, trackCtl, course, setCourse, shown, type Ctl } from './ctl';
import { Foot, Header } from './Chrome';
import { C, lfoPath, nudge, useTrack } from './parts';
import { isMuted, isSolo, setStepVel } from './Steps';
import { TAP_VEL_DEFAULT, rytmPage } from '../../state/rytmPage';
import { activeTrack } from '../../state/trk';
import { Choice, HRule, Key, Knob, Lcd, Note, Title, Toggle, VRule, useTick, type KnobKind } from './ui';
import { Library, MidiPage } from './Library';
import type { Page } from './view';

/* ---------------- les pieces communes ---------------- */

const TrackStrip: React.FC<{ y?: number }> = ({ y = 72 }) => {
  const t = useTrack();
  useSyncExternalStore(voices.subscribe, () => voices.get());
  const x0 = 98;
  const p = (1348 - x0) / 16;
  return (
    <>
      <Note x={52} y={y + 8} style={{ fontSize: 7.5, color: '#8a8a8a' }}>
        TRACK
      </Note>
      {TRACK_KEYS.map((k, i) => (
        <div
          key={k}
          className={`mm3-trk${k === t ? ' sel' : ''}${isMuted(k) ? ' mute' : ''}`}
          style={{ left: x0 + i * p, top: y, width: p - 6, height: 24 }}
          role="button"
          aria-label={`Track ${i + 1} ${TRACK_NAMES[i]}`}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            trackSelect(k);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            trackMuteFlip(k);
          }}
        >
          <div className="n" style={{ top: 6, fontSize: 9 }}>
            {TRACK_NAMES[i]}
          </div>
        </div>
      ))}
    </>
  );
};

/** Une rangee de knobs d'un groupe de reglages fins (state/labFx.ts), de x0 a x1, a la hauteur y. */
const LabRow: React.FC<{ knobs: readonly LabKnob[]; x0: number; x1: number; y: number; d?: number; kind?: KnobKind; skip?: readonly string[] }> = ({ knobs, x0, x1, y, d = 44, kind = 'tiny', skip = [] }) => {
  const list = knobs.filter((k) => !skip.includes(k.id));
  const p = (x1 - x0) / list.length;
  return (
    <>
      {list.map((k, i) => (
        <Knob key={k.id} x={x0 + p * i + p / 2} y={y} d={d} kind={kind} ctl={fxCtl(k)} label={k.label} title={k.tip} />
      ))}
    </>
  );
};
const lab = (list: readonly LabKnob[], id: string): LabKnob => {
  const k = list.find((x) => x.id === id);
  if (!k) throw new Error(`labFx: ${id}`);
  return k;
};

/** Une liste de presets d'effet (un clic pose la sous-page entiere ; une etape d'UNDO). */
const PresetList: React.FC<{ x: number; y: number; w: number; h: number; title: string; list: readonly (LabPreset | { name: string; tip: string; set: Record<string, number> })[]; patchOf: (i: number) => Record<string, number>; groups?: readonly { name: string; from: number; to: number }[] }> = ({ x, y, w, h, title, list, patchOf, groups }) => {
  useTick();
  const fx = pattern.fx.get() as unknown as Record<string, number>;
  const on = list.findIndex((_, i) => Object.entries(patchOf(i)).every(([k, v]) => Math.abs((fx[k] ?? 0) - v) < 0.002));
  const row = (i: number) => (
    <div
      key={i}
      className={`r${i === on ? ' on' : ''}`}
      title={list[i].tip}
      onPointerDown={(e) => {
        e.preventDefault();
        undo.boundary('mm808', 'step');
        pattern.fx.set(patchOf(i));
        lcdMessage.show(`${title} ${list[i].name}`, 1600);
      }}
    >
      <span>
        <em>{String(i + 1).padStart(2, '0')}</em>
        {list[i].name}
      </span>
      {i === on && <i className="d" />}
    </div>
  );
  return (
    <div className="mm3-list" style={{ left: x, top: y, width: w, height: h }}>
      {(groups ?? [{ name: title, from: 0, to: list.length }]).map((g) => (
        <React.Fragment key={g.name}>
          <div className="h">
            <span>{g.name}</span>
            <span>{g.to - g.from}</span>
          </div>
          {Array.from({ length: g.to - g.from }, (_, k) => row(g.from + k))}
        </React.Fragment>
      ))}
    </div>
  );
};

/**
 * Les envois vers un effet (2026-11-25, Mika : "toutes les voices affichees ca fit pas [...] j'aimais bien le principe de
 * l'autre interface") : comme la page FX de la machine, on choisit la piste (ses 16 pastilles : leur barre dit leur envoi)
 * et un seul knob regle l'envoi de la piste choisie ; a droite, le niveau de l'effet.
 */
const SEND_TARGET = { dist: 'vdist', chorus: 'vchorus', delay: 'vdelay', reverb: 'vreverb', hell: 'vhell' } as const;
const SendRow: React.FC<{ y: number; fx: string; p: 'dist' | 'chorus' | 'delay' | 'reverb' | 'hell'; master: Ctl; mlabel?: string }> = ({ y, fx, p, master, mlabel = 'RETURN' }) => {
  useTick();
  useSyncExternalStore(voices.subscribe, () => voices.get());
  const t = useTrack();
  const ctl = React.useMemo(() => slotCtl('fxv', SEND_TARGET[p]), [p]);
  const x0 = 196;
  const pw = (1236 - x0) / 16;
  return (
    <>
      <HRule x={52} y={y - 14} w={1296} />
      <Title x={52} y={y} w={1296} t={`${fx} · SENDS`} small="PICK A TRACK, TURN ITS SEND" />
      <Knob x={112} y={y + 56} d={46} kind="k1" ctl={ctl} label={`${TRACK_NAMES[TRACK_KEYS.indexOf(t)]} SEND`} acc />
      {TRACK_KEYS.map((k, i) => {
        const v = tracks.vfx(k)[p] as number;
        return (
          <div
            key={k}
            className={`mm3-trk${k === t ? ' sel' : ''}${isMuted(k) ? ' mute' : ''}`}
            style={{ left: x0 + i * pw, top: y + 36, width: pw - 6, height: 40 }}
            role="button"
            aria-label={`${TRACK_NAMES[i]} ${fx} send ${Math.round(v * 127)}`}
            title={`${TRACK_NAMES[i]} : ${v > 0.001 ? Math.round(v * 127) : 'OFF'}`}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              trackSelect(k);
            }}
          >
            <div className="n" style={{ top: 7, fontSize: 9 }}>
              {TRACK_NAMES[i]}
            </div>
            <div className="vu" style={{ bottom: 8, height: 4 }}>
              <b style={{ width: `${Math.round(v * 100)}%`, background: v > 0.001 ? 'linear-gradient(90deg,#8a7400,#ffd900)' : undefined }} />
            </div>
          </div>
        );
      })}
      <VRule x={1252} y={y + 22} h={84} />
      <Knob x={1300} y={y + 56} d={46} kind="k1" ctl={master} label={mlabel} />
    </>
  );
};

const Frame: React.FC<{ page: Page; hint: string; lcd: string; tracks?: boolean; children: React.ReactNode }> = ({ page, hint, lcd, tracks: strip, children }) => (
  <>
    <Header />
    {strip && <TrackStrip />}
    {children}
    <Foot page={page} hint={hint} lcd={lcd} />
  </>
);

/* ======================= SAMPLE ======================= */

const SampleBank: React.FC<{ t: TrackKey; skey: string }> = ({ t, skey }) => {
  const i = TRACK_KEYS.indexOf(t);
  const fam = typedFamily(i);
  const list = samplesOf(fam);
  const ref = useRef<HTMLDivElement>(null);
  const cur = list.findIndex((s) => s.key === skey);
  useEffect(() => {
    const el = ref.current?.querySelector('.r.on') as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [cur]);
  const mine = list.filter((s) => s.key.includes('/~'));
  const bank = list.filter((s) => !s.key.includes('/~'));
  const row = (s: (typeof list)[number], n: string) => (
    <div
      key={s.key}
      className={`r${s.key === skey ? ' on' : ''}`}
      onPointerDown={(e) => {
        e.preventDefault();
        tracks.sample(t, s.key);
      }}
    >
      <span>
        <em>{n}</em>
        {smpLabel(s)}
      </span>
      {s.key === skey && <i className="d" />}
    </div>
  );
  return (
    <div ref={ref} className="mm3-list" style={{ left: 1060, top: 110, width: 288, height: 334 }}>
      <div className="h">
        <span>BANK · {fam.toUpperCase()}</span>
        <span>{bank.length}</span>
      </div>
      {bank.map((s, k) => row(s, String(k + 1).padStart(2, '0')))}
      <div className="h">
        <span>MY SAMPLES · MUSIC / MM-RYTM SAMPLES / {fam.toUpperCase()}</span>
        <span>{mine.length}</span>
      </div>
      {mine.map((s, k) => row(s, `U${k + 1}`))}
      {mine.length === 0 && <div className="mm3-t8" style={{ position: 'static', padding: '4px 0', color: '#666' }}>IMPORT… OR FOLDER : YOUR FILES</div>}
    </div>
  );
};

const SamplePage: React.FC = () => {
  const tick = useTick();
  const t = useTrack();
  const i = TRACK_KEYS.indexOf(t);
  const fam = typedFamily(i);
  const skey = tracks.of(t).snd;
  const list = samplesOf(fam);
  const cur = list.findIndex((s) => s.key === skey);
  const smp = cur >= 0 ? list[cur] : undefined;
  const pcm = skey ? samplePcm(skey) : undefined;
  const pw = playWindow();
  const ms = (f: number, heard = false): string => (pcm ? `${(((f * pcm.L.length) / pcm.sr / (heard ? pw.ratio : 1)) * 1000).toFixed(1)} MS` : '--');
  const reset = (): void => {
    for (const id of ['t:sstart', 't:slen', 't:tune', 't:fine', 't:srev'] as const) anyDial(id as DialId, anyDialReset(id as DialId));
    lcdMessage.show(`${TRACK_NAMES[i]} SAMPLE RESET`, 1200);
  };
  const y = 110;
  const yk = 486;
  const key = (l: string, x: number, on: boolean, fn: () => void, title: string) => <Key x={x} y={y + 1} w={66} h={24} ledIn led={on ? 'on' : 'off'} inner={l} innerStyle={{ fontSize: 8, gap: 6 }} onDown={fn} title={title} />;
  return (
    <Frame page="SAMPLE" tracks hint="DRAG S AND E · SHIFT : FINE · WHEEL : ZOOM · DOUBLE CLICK : THE WHOLE SAMPLE" lcd={`SAMPLE · ${TRACK_NAMES[i]}`}>
      <Key x={52} y={y} w={30} h={26} r={7} inner="◀" onDown={() => nudge(C.snd, -1)} title="The sample before" />
      <Key x={88} y={y} w={30} h={26} r={7} inner="▶" onDown={() => nudge(C.snd, 1)} title="The next sample" />
      <Note x={132} y={y + 3} style={{ fontSize: 10 }}>
        <span style={{ color: '#8a8a8a' }}>{TRACK_NAMES[i]}</span> &nbsp;<b style={{ fontSize: 17, letterSpacing: '.08em', color: '#fff' }}>{smp ? smpLabel(smp) : 'OFF'}</b> &nbsp; <i>{cur >= 0 ? `${cur + 1} / ${list.length}` : ''}</i>
      </Note>
      {key('LISTEN', 676, false, () => trigger(t, undefined, false, undefined, 1), 'Play the track once (the plugin plays it)')}
      {key('REVERSE', 750, pw.rev, () => setCourse(C.rev, pw.rev ? 0 : 1), 'Play it backwards')}
      {key('RESET', 824, false, reset, 'START 0, END at the end, TUNE 0, FINE 0, forward')}
      {key('IMPORT…', 898, false, () => fileImport.plugin?.(t), 'Load a file of yours on this track')}
      {key('FOLDER', 972, false, () => fileImport.reveal?.(fam), 'Your samples folder, in the Finder')}
      <Lcd x={52} y={y + 40} w={988} h={292}>
        <Waveform t={t} skey={skey} rev={tick} />
      </Lcd>
      <Note x={52} y={y + 342}>
        START <b>{ms(pw.s)}</b> &nbsp; END <b>{ms(pw.e)}</b> &nbsp; PLAYS <b>{ms(pw.e - pw.s, true)}</b> &nbsp; {pcm ? `${pcm.R ? 'STEREO' : 'MONO'} · ${(pcm.sr / 1000).toFixed(1)} KHZ` : ''}
      </Note>
      <Note x={1040} y={y + 342} right>
        <i>YELLOW</i> : THE AMP ENVELOPE
      </Note>
      <SampleBank t={t} skey={skey} />
      <HRule x={52} y={yk - 12} w={1296} />
      <Title x={52} y={yk} w={400} t="SAMPLE" />
      <Knob x={110} y={yk + 92} d={64} kind="k1" ctl={C.start} label="START" big />
      <Knob x={238} y={yk + 92} d={64} kind="k1" ctl={C.len} label="LEN" big />
      <Knob x={366} y={yk + 92} d={64} kind="k1" ctl={C.lev} label="LEVEL" big />
      <Knob kind="tiny" x={110} y={yk + 222} d={46} ctl={C.tune} label="TUNE" />
      <Knob kind="tiny" x={238} y={yk + 222} d={46} ctl={C.fine} label="FINE" />
      <Toggle x={342} y={yk + 206} a="FWD" b="REV" on={pw.rev} label="PLAY" onFlip={() => setCourse(C.rev, pw.rev ? 0 : 1)} />
      <VRule x={470} y={yk + 4} h={330} />
      <Title x={486} y={yk} w={380} t="AMP ENVELOPE" />
      <EnvLcd x={496} y={yk + 26} w={360} h={84} />
      <Knob x={530} y={yk + 196} d={50} kind="k1" ctl={C.atk} label="ATK" />
      <Knob x={612} y={yk + 196} d={50} kind="k1" ctl={C.hold} label="HOLD" />
      <Knob x={694} y={yk + 196} d={50} kind="k1" ctl={C.dec} label="DEC" />
      <Knob kind="tiny" x={776} y={yk + 196} d={44} ctl={C.vstart} label="START" />
      <Knob kind="tiny" x={846} y={yk + 196} d={44} ctl={C.pan} label="PAN" />
      <VRule x={882} y={yk + 4} h={330} />
      <Title x={898} y={yk} w={450} t="FILTER" />
      <FilterLcd x={908} y={yk + 26} w={430} h={84} />
      <Knob x={950} y={yk + 196} d={64} kind="k1" ctl={C.fcut} label="FREQ" big />
      <Knob kind="tiny" x={1040} y={yk + 196} d={44} ctl={C.freso} label="RESO" />
      <Knob x={1114} y={yk + 186} d={36} kind="tiny" ctl={C.ftype} label="TYPE" ticks={0} />
      <Knob kind="tiny" x={1186} y={yk + 196} d={40} ctl={C.fenv} label="ENV" />
      <Knob kind="tiny" x={1246} y={yk + 196} d={40} ctl={C.fatk} label="ATK" />
      <Knob kind="tiny" x={1306} y={yk + 196} d={40} ctl={C.fdec} label="DEC" />
    </Frame>
  );
};

/** La courbe de l'enveloppe AMP (grand). */
const EnvLcd: React.FC<{ x: number; y: number; w: number; h: number }> = ({ x, y, w, h }) => {
  useTick();
  const W = w - 20;
  const H = h - 24;
  const a = course(C.atk);
  const ho = course(C.hold);
  const d = course(C.dec);
  const xa = 2 + a * W * 0.2;
  const xh = xa + 2 + ho * W * 0.2;
  const xd = Math.min(W, xh + 20 + d * (W - xh - 20));
  const path = `M0 ${H} L${xa} 3 L${xh} 3 C${xh + (xd - xh) * 0.3} ${H * 0.6} ${xh + (xd - xh) * 0.6} ${H * 0.92} ${xd} ${H - 1}`;
  return (
    <Lcd x={x} y={y} w={w} h={h}>
      <div className="mm3-t8" style={{ right: 10, top: 7 }}>
        ATK <span className="mm3-w">{shown(C.atk)}</span> · HOLD <span className="mm3-w">{shown(C.hold)}</span> · DEC <span className="mm3-w">{shown(C.dec)}</span>
      </div>
      <svg style={{ left: 10, top: 18 }} width={W} height={H}>
        <path d={`${path} L${xd} ${H} Z`} fill="rgba(255,217,0,.1)" />
        <path d={path} stroke="#ffd900" strokeWidth={1.8} fill="none" style={{ filter: 'drop-shadow(0 0 3px rgba(255,217,0,.6))' }} />
      </svg>
    </Lcd>
  );
};

/** La courbe du filtre (sa forme a son type, sa coupure, sa resonance). */
const FilterLcd: React.FC<{ x: number; y: number; w: number; h: number }> = ({ x, y, w, h }) => {
  useTick();
  const W = w - 20;
  const H = h - 24;
  const fc = course(C.fcut);
  const q = course(C.freso);
  const type = C.ftype.text();
  const xc = 20 + fc * (W - 30);
  const peak = 4 + (1 - q) * 14;
  const flat = 22;
  let path: string;
  if (/HP/.test(type)) path = `M0 ${H} C${xc - 60} ${H} ${xc - 20} ${flat + 8} ${xc} ${peak} C${xc + 10} ${flat} ${xc + 20} ${flat} ${W} ${flat}`;
  else if (/BP/.test(type)) path = `M0 ${H} C${xc - 70} ${H} ${xc - 20} ${peak + 4} ${xc} ${peak} C${xc + 20} ${peak + 4} ${xc + 70} ${H} ${W} ${H}`;
  else path = `M0 ${flat} L${Math.max(0, xc - 40)} ${flat} C${xc - 14} ${flat} ${xc - 6} ${peak} ${xc} ${peak} C${xc + 10} ${peak} ${xc + 20} ${H * 0.6} ${Math.min(W, xc + 60)} ${H} L${W} ${H}`;
  return (
    <Lcd x={x} y={y} w={w} h={h}>
      <div className="mm3-t8" style={{ left: 10, top: 7 }}>
        {type} · <span className="mm3-w">{shown(C.fcut)}</span> · RESO <span className="mm3-w">{shown(C.freso)}</span>
      </div>
      <svg style={{ left: 10, top: 18 }} width={W} height={H}>
        <path d={`${path} L${W} ${H} L0 ${H} Z`} fill="rgba(255,217,0,.1)" />
        <path d={path} stroke="#ffd900" strokeWidth={1.8} fill="none" style={{ filter: 'drop-shadow(0 0 3px rgba(255,217,0,.6))' }} />
      </svg>
    </Lcd>
  );
};

/* ======================= SEQ ======================= */

type Lane = { id: string; label: string; ico: string; ctl?: Ctl; lock?: string; tip: string };
const LANES: readonly Lane[] = [
  { id: 'vel', label: 'VELOCITY', ico: '▁▃▆', tip: 'How hard each step hits (drag a bar)' },
  { id: 'prob', label: 'PROBABILITY', ico: '%', ctl: slotCtl('trig', 'q:prob'), lock: 'prob', tip: 'The chance each step plays' },
  { id: 'cond', label: 'CONDITION', ico: '1:2', ctl: slotCtl('trig', 'q:cond'), lock: 'cond', tip: 'When each step plays (1:2, 1ST, FILL...)' },
  { id: 'utime', label: 'μTIME', ico: '⇆', ctl: slotCtl('trig', 'q:utime', true), lock: 'utime', tip: 'Each step a little early or late' },
  { id: 'rtrg', label: 'RETRIG', ico: '•••', ctl: slotCtl('trig2', 'q:rtrg'), lock: 'rtrg', tip: 'Each step repeated (rolls)' },
  { id: 'len', label: 'LENGTH', ico: '▬▏', ctl: slotCtl('trig', 'q:len'), lock: 'len', tip: 'How long each step lasts' },
];
let lane = 'vel';
const laneSubs = new Set<() => void>();
const setLane = (id: string): void => {
  lane = id;
  laneSubs.forEach((f) => f());
};
const useLane = (): string =>
  useSyncExternalStore(
    (f) => {
      laneSubs.add(f);
      return () => laneSubs.delete(f);
    },
    () => lane
  );

/** Un reglage pose sur un pas (son verrou), par le P-LOCK de la machine : le pas passe en P-LOCK le temps d'ecrire. */
function writeStep(i: number, c: Ctl, x: number): void {
  const s = rytmLock.get();
  const prev = s.latched ? s.step : -1;
  rytmLock.enter(i, true);
  c.begin?.();
  setCourse(c, x);
  if (prev >= 0) rytmLock.enter(prev, true);
  else rytmLock.leave();
}
/** Ce qu'un verrou du pas vaut en course (0 a 1) et en mots (a la loi de sa voie). */
function lockCourse(c: Ctl, raw: number): number {
  const [lo, hi] = c.range();
  return hi > lo ? Math.max(0, Math.min(1, (raw - lo) / (hi - lo))) : 0;
}
function lockWord(id: string, raw: number): string {
  if (id === 'cond') return CONDS[Math.round(raw)]?.label ?? '';
  if (id === 'prob') return `${Math.round(raw)}%`;
  if (id === 'utime') return raw > 0 ? `+${Math.round(raw)}` : String(Math.round(raw));
  return String(Math.round(raw * 100) / 100);
}

const SeqLanes: React.FC = () => {
  useTick();
  const t = useTrack();
  const ln = useLane();
  const p = pattern.get();
  const L = LANES.find((x) => x.id === ln) ?? LANES[0];
  const x0 = 206;
  const gw = 1142;
  const pw = gw / 16;
  const top = 148;
  const hh = 340;
  const drag = useRef<{ id: number; kind: 'trig' | 'val'; on: boolean; last: number } | null>(null);
  const len = pattern.stepCount();
  const tlen = Math.round(p.trigs?.[t]?.tlen ?? 0);
  const end = tlen > 0 && tlen < len ? tlen : len;
  /** Le pas sous la souris, la hauteur dans la voie, la valeur 0 a 1 qu'elle donne. */
  const at = (e: React.PointerEvent): { i: number; yy: number; x: number } => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const k = r.width / gw;
    const i = Math.floor((e.clientX - r.left) / k / pw);
    const yy = (e.clientY - r.top) / k;
    return { i, yy, x: Math.max(0, Math.min(1, 1 - (yy - 70) / (hh - 110))) };
  };
  /** Le pas pose (on) ou retire, a la velocite des nouveaux pas de la piste. */
  const trigTo = (i: number, on: boolean): void => {
    const k = activeTrack.get();
    if (!k || i < 0 || i > 15) return;
    const cur = velocity(pattern.get().steps, k, i) > 0;
    if (on && !cur) pattern.set(k, i, isLegacyTrack(k) ? rytmPage.tapVel(k) : TAP_VEL_DEFAULT);
    else if (!on && cur) pattern.clearStep(k, i);
  };
  /** La valeur de la voie sur le pas (un pas vide recoit d'abord sa note). */
  const valueAt = (i: number, x: number): void => {
    const k = activeTrack.get();
    if (!k || i < 0 || i > 15) return;
    const vel = Math.max(1, Math.round(1 + x * 8));
    if (velocity(pattern.get().steps, k, i) <= 0) pattern.set(k, i, L.id === 'vel' ? vel : isLegacyTrack(k) ? rytmPage.tapVel(k) : TAP_VEL_DEFAULT);
    if (L.id === 'vel') setStepVel(i, vel);
    else if (L.ctl) writeStep(i, L.ctl, x);
  };
  const bars: React.ReactNode[] = [];
  for (let i = 0; i < 16; i += 1) {
    const x = i * pw;
    const v = velocity(p.steps, t, i);
    const l = lockOf(p.locks, t, i) as Record<string, number> | null;
    const on = v > 0;
    bars.push(<i key={`g${i}`} style={{ left: x, top: 0, bottom: 0, width: 1, background: i % 4 === 0 ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.05)' }} />);
    bars.push(
      <div key={`n${i}`} className="mm3-t8" style={{ left: x, width: pw, top: 8, textAlign: 'center', color: i >= end ? '#444' : '#9a9a9a' }}>
        {i + 1}
      </div>
    );
    bars.push(<div key={`t${i}`} style={{ left: x + 12, width: pw - 24, top: 22, height: 18, borderRadius: 4, background: on ? '#ff3d2e' : '#1a1a1a', boxShadow: on ? '0 0 8px rgba(255,61,46,.5)' : 'inset 0 1px 2px #000', opacity: i >= end ? 0.3 : 1 }} />);
    const cl = l && typeof l.cond === 'number' && l.cond !== 0 ? CONDS[l.cond]?.label : null;
    if (cl) bars.push(<div key={`c${i}`} style={{ left: x, width: pw, top: 46, textAlign: 'center' }}><span className="mm3-chip a" style={{ fontSize: 7 }}>{cl}</span></div>);
    if (!on) {
      bars.push(<div key={`e${i}`} style={{ left: x + 16, width: pw - 32, bottom: 34, height: 2, background: 'rgba(255,255,255,.12)' }} />);
      continue;
    }
    const raw = L.lock ? l?.[L.lock] : undefined;
    const locked = L.id === 'vel' || raw !== undefined;
    // Sans verrou : la valeur de la piste (hors P-LOCK ; en P-LOCK, celle du pas garde : rien)
    const base = L.ctl && !lockMode() ? course(L.ctl) : 0;
    const c = L.id === 'vel' ? v / 9 : L.ctl && raw !== undefined ? lockCourse(L.ctl, raw) : base;
    const bh = Math.max(3, (hh - 110) * c);
    const word = L.id === 'vel' ? String(v) : raw !== undefined ? lockWord(L.id, raw) : L.ctl && !lockMode() ? L.ctl.text() : '';
    bars.push(<div key={`b${i}`} style={{ left: x + 16, width: pw - 32, bottom: 34, height: bh, background: locked ? 'linear-gradient(rgba(255,217,0,.55),rgba(255,217,0,.18))' : 'rgba(255,255,255,.1)', borderTop: `3px solid ${locked ? '#ffd900' : '#8a8a8a'}`, boxShadow: locked ? '0 -2px 10px rgba(255,217,0,.35)' : undefined }} />);
    bars.push(
      <div key={`w${i}`} className="mm3-t8 mm3-w" style={{ left: x, width: pw, bottom: 40 + bh, textAlign: 'center', fontSize: 8.5 }}>
        {word}
      </div>
    );
    if (l && Object.keys(l).some((k) => k !== 'cond' && k !== 'prob')) bars.push(<div key={`d${i}`} style={{ left: x + pw / 2 - 3, bottom: 16, width: 6, height: 6, borderRadius: '50%', background: '#ffd900', boxShadow: '0 0 5px rgba(255,217,0,.7)' }} />);
  }
  if (end < 16) bars.push(<div key="end" style={{ left: end * pw - 2, top: 0, bottom: 0, width: 3, background: '#ffd900', boxShadow: '0 0 8px rgba(255,217,0,.6)' }} />);
  return (
    <>
      {LANES.map((x, k) => (
        <Key
          key={x.id}
          x={52}
          y={top + k * 52}
          w={132}
          h={36}
          ledIn
          led={x.id === ln ? 'on' : 'off'}
          inner={
            <span style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', paddingLeft: 4 }}>
              <span style={{ width: 24, fontSize: 9, color: x.id === ln ? 'var(--acc)' : '#aaa' }}>{x.ico}</span>
              <span style={{ color: x.id === ln ? 'var(--acc)' : undefined }}>{x.label}</span>
            </span>
          }
          innerStyle={{ justifyContent: 'flex-start', paddingLeft: 12 }}
          style={x.id === ln ? { filter: 'drop-shadow(0 0 6px rgba(255,217,0,.3))' } : undefined}
          title={x.tip}
          onDown={() => setLane(x.id)}
        />
      ))}
      <Lcd
        x={x0}
        y={top}
        w={gw}
        h={hh}
        style={{ cursor: 'pointer', touchAction: 'none' }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          const q = at(e);
          if (q.i < 0 || q.i > 15) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          undo.boundary('mm808', 'step');
          // La rangee rouge du haut : le pas pose ou retire (un glisser en fait plusieurs) ; dessous : la valeur de la voie
          if (q.yy < 46) {
            const on = velocity(pattern.get().steps, t, q.i) <= 0;
            drag.current = { id: e.pointerId, kind: 'trig', on, last: q.i };
            trigTo(q.i, on);
          } else {
            drag.current = { id: e.pointerId, kind: 'val', on: true, last: q.i };
            valueAt(q.i, q.x);
          }
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          const q = at(e);
          if (d.kind === 'trig') {
            if (q.i !== d.last) trigTo(q.i, d.on);
          } else valueAt(q.i, q.x);
          d.last = q.i;
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        {bars}
        <div className="mm3-t8" style={{ left: 10, bottom: 6, fontSize: 7 }}>
          <span className="mm3-a">RED ROW</span> : A STEP ON / OFF (DRAG : SEVERAL) &nbsp; <span className="mm3-a">BARS</span> : {L.label}, CLICK OR DRAG (AN EMPTY STEP GETS ITS NOTE) &nbsp; YELLOW : SET ON THE STEP · GREY : THE TRACK
        </div>
      </Lcd>
    </>
  );
};

const SEQ_C = {
  tlen: slotCtl('trig2', 'q:tlen'),
  lfot: slotCtl('trig', 'q:lfot'),
  vfad: slotCtl('trig2', 'q:vfad'),
  rlen: slotCtl('trig2', 'q:rlen'),
  vtun: slotCtl('mod3', 'q:vtun'),
  vflt: slotCtl('mod3', 'q:vflt'),
  vlev: slotCtl('mod3', 'q:vlev'),
  vpan: slotCtl('mod3', 'q:vpan'),
  vdec: slotCtl('mod3', 'q:vdec'),
  vsta: slotCtl('mod3', 'q:vsta'),
  vchn: slotCtl('mod3', 'q:vchn'),
  vsed: slotCtl('mod3', 'q:vsed'),
};

const SeqPage: React.FC = () => {
  useTick();
  const t = useTrack();
  const yb = 512;
  const len = pattern.stepCount();
  const tlen = Math.round(pattern.get().trigs?.[t]?.tlen ?? 0);
  return (
    <Frame page="SEQ" tracks hint="PICK A LANE · CLICK OR DRAG A BAR : THAT STEP · THE STEP KEYS ON THE MACHINE : HOLD = P-LOCK" lcd={`SEQ · ${TRACK_NAMES[TRACK_KEYS.indexOf(t)]}`}>
      <Title x={300} y={112} w={800} t={`STEP SEQUENCER · T${TRACK_KEYS.indexOf(t) + 1} ${TRACK_NAMES[TRACK_KEYS.indexOf(t)]}`} />
      <Note x={52} y={114}>
        PATTERN <b>{len}</b> STEPS · TRACK <b>{tlen > 0 && tlen < len ? tlen : len}</b>
      </Note>
      <Note x={1180} y={114}>
        TRACK LENGTH
      </Note>
      <Key x={1262} y={110} w={20} h={20} r={6} inner="−" onDown={() => nudge(SEQ_C.tlen, -1)} title="The track plays fewer steps (TLEN)" />
      <Note x={1290} y={110}>
        <b style={{ fontSize: 13 }}>{SEQ_C.tlen.text()}</b>
      </Note>
      <Key x={1322} y={110} w={20} h={20} r={6} inner="+" onDown={() => nudge(SEQ_C.tlen, 1)} title="The track plays more steps (TLEN)" />
      <SeqLanes />
      <HRule x={52} y={yb - 10} w={1296} />
      <Title x={52} y={yb} w={450} t="TRIG" small="TRACK DEFAULTS" />
      {(
        [
          ['NOTE', C.note],
          ['VEL', C.vel],
          ['LEN', C.qlen],
          ['PROB', C.prob],
          ['COND', C.cond],
          ['μTIME', C.utime],
          ['RETRIG', C.rtrg],
          ['RATE', C.rate],
        ] as const
      ).map(([l, c], i) => (
        <Knob key={l} x={96 + (i % 4) * 110} y={yb + 72 + Math.floor(i / 4) * 112} d={i === 4 ? 48 : 44} kind={i === 4 ? 'sel' : 'k3'} ctl={c} label={l} />
      ))}
      <VRule x={518} y={yb + 4} h={300} />
      <Title x={534} y={yb} w={450} t="VAR" small="EACH HIT VARIES" />
      {(
        [
          ['TUNE', SEQ_C.vtun],
          ['FREQ', SEQ_C.vflt],
          ['LEV', SEQ_C.vlev],
          ['PAN', SEQ_C.vpan],
          ['DEC', SEQ_C.vdec],
          ['START', SEQ_C.vsta],
          ['CHANCE', SEQ_C.vchn],
          ['SEED', SEQ_C.vsed],
        ] as const
      ).map(([l, c], i) => (
        <Knob kind="tiny" key={l} x={578 + (i % 4) * 110} y={yb + 72 + Math.floor(i / 4) * 112} d={44} ctl={c} label={l} />
      ))}
      <VRule x={1000} y={yb + 4} h={300} />
      <Title x={1016} y={yb} w={332} t="RETRIG · GROOVE" />
      <Knob kind="tiny" x={1066} y={yb + 72} d={44} ctl={SEQ_C.vfad} label="VFAD" />
      <Knob kind="tiny" x={1160} y={yb + 72} d={44} ctl={SEQ_C.rlen} label="RLEN" />
      <Knob kind="tiny" x={1254} y={yb + 72} d={44} ctl={SEQ_C.lfot} label="LFO.T" />
      <Knob x={1110} y={yb + 190} d={62} kind="k1" ctl={C.swing} label="SWING" big />
      <Key x={1222} y={yb + 170} w={64} h={26} label="RANDOM" led="off" onDown={(e) => faceKeyDown('random', `ptr:${e.pointerId}`, null)} onUp={(e, tap) => faceKeyUp('random', `ptr:${e.pointerId}`, null, performance.now(), tap)} title="A new random beat (Cmd+Z: back)" />
      <Key x={1222} y={yb + 226} w={64} h={26} label="CLEAR" led="off" onTap={() => clearKey(null)} title="Clear the pattern (REC on: the track)" />
    </Frame>
  );
};

/* ======================= LFO ======================= */

/**
 * Un seul LFO (2026-11-25, Mika : "les lfos, j'en vois pas l'utilite d'en avoir deux et aussi complexes") : sa forme, ce
 * qu'il fait bouger, sa vitesse (en valeurs musicales) et sa profondeur. Le LFO 2 d'un pattern d'avant : une ligne, son OFF.
 */
const LFO1 = { rate: slotCtl('mod', 'z:l1rate'), dep: slotCtl('mod', 'q:l1dep', true), wav: slotCtl('mod', 'q:l1wav'), dst: slotCtl('mod', 'q:l1dst') };
const LFO2_DST = slotCtl('mod2', 'q:l2dst');

const LfoPage: React.FC = () => {
  useTick();
  const t = useTrack();
  const c = LFO1;
  const dest = c.dst.text();
  const off = dest === 'OFF' || dest === '--';
  const d2 = LFO2_DST.text();
  const lfo2 = d2 !== 'OFF' && d2 !== '--';
  const W = 1276;
  return (
    <Frame page="LFO" tracks hint="ONE LFO PER TRACK · RANDOM DRAWS IT (NEVER THE GATE) · ON THE MACHINE : THE LFO KEY · HOLD A STEP : P-LOCK IT" lcd={`LFO · ${TRACK_NAMES[TRACK_KEYS.indexOf(t)]}`}>
      <Title x={52} y={110} w={1296} t="LFO" small={off ? 'OFF : PICK WHAT IT MOVES' : `→ ${dest}`} />
      <Lcd x={62} y={136} w={W} h={250}>
        {Array.from({ length: 17 }, (_, b) => (
          <i key={b} style={{ left: (b * W) / 16, top: 0, bottom: 0, width: 1, background: b % 4 === 0 ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.05)' }} />
        ))}
        <i style={{ left: 0, right: 0, top: 125, height: 1, background: 'rgba(255,255,255,.1)' }} />
        <svg style={{ left: 0, top: 14 }} width={W} height={222}>
          <path d={lfoPath(c.wav.get(), off ? 0.3 : c.dep.get() || 0.5, W, 222, 4)} stroke={off ? '#444' : '#ffd900'} strokeWidth={2.4} fill="none" style={{ filter: off ? undefined : 'drop-shadow(0 0 5px rgba(255,217,0,.6))' }} />
        </svg>
        <div style={{ left: 16, top: 12 }}>
          <div className="mm3-t8">{off ? 'LFO OFF' : `LFO → ${dest}`}</div>
          <div className="mm3-dots mm3-a" style={{ fontSize: 34, marginTop: 4 }}>
            {shown(c.rate)}
          </div>
        </div>
        <div className="mm3-t8" style={{ right: 16, top: 14 }}>
          {c.wav.text()} · DEPTH <span className="mm3-a">{shown(c.dep)}</span>
        </div>
      </Lcd>
      <HRule x={52} y={404} w={1296} />
      <Title x={52} y={420} w={620} t="WAVE" />
      <Choice x={86} y={452} ctl={c.wav} words={['TRI', 'SINE', 'SQR', 'SAW', 'EXP', 'RMP', 'RND']} w={72} h={28} gap={8} />
      <Title x={52} y={510} w={620} t="DEST" small="WHAT IT MOVES" />
      <Choice x={86} y={542} ctl={c.dst} words={['OFF', 'PITCH', 'FREQ', 'RESO', 'VOL', 'PAN', 'DIST', 'DELAY', 'REVERB', 'TONE', 'DECAY']} w={88} h={28} gap={8} cols={6} />
      <VRule x={690} y={424} h={250} />
      <Title x={706} y={420} w={642} t="SPEED · DEPTH" />
      <Knob x={880} y={540} d={96} kind="k1" ctl={c.rate} label="RATE" big />
      <Knob x={1150} y={540} d={96} kind="k1" ctl={c.dep} label="DEPTH" big />
      {lfo2 && (
        <>
          <HRule x={52} y={700} w={1296} />
          <Note x={62} y={724} style={{ fontSize: 8.5 }}>
            THIS TRACK STILL HAS A <b>SECOND LFO</b> FROM BEFORE (→ <i>{d2}</i>)
          </Note>
          <Key x={420} y={718} w={70} h={22} r={8} inner="OFF" title="Turn the second LFO off" onTap={() => {
            undo.boundary('mm808', 'step');
            LFO2_DST.begin?.();
            setCourse(LFO2_DST, 0);
          }} />
        </>
      )}
    </Frame>
  );
};

/* ======================= DISTO ======================= */

const DISTO_C = { drive: slotCtl('fxdist', 'dist'), xtone: slotCtl('fxdist', 'xtone') };

/** Les reglages de la DIST (state/labFx.ts), un controle chacun. */
const DX = {
  style: fxCtl(lab(DIST_DRIVE, 'xstyle')),
  punish: fxCtl(lab(DIST_DRIVE, 'xpunish')),
  auto: fxCtl(lab(DIST_DRIVE, 'xauto')),
  out: fxCtl(lab(DIST_DRIVE, 'xout')),
  mix: fxCtl(lab(DIST_DRIVE, 'xmix')),
  low: fxCtl(lab(DIST_TONE, 'xlow')),
  thump: fxCtl(lab(DIST_TONE, 'xthump')),
  tilt: fxCtl(lab(DIST_TONE, 'xtilt')),
  high: fxCtl(lab(DIST_TONE, 'xtone')),
  steep: fxCtl(lab(DIST_TONE, 'xsteep')),
};

/**
 * L'EQ de la DIST (avant la saturation ; le HIGH CUT apres), comme celui du MM-ARP (Mika : "regarde ce panneau vraiment
 * cool detaille") : la courbe, et ses trois points qu'on tire. LOW CUT (le rond : a gauche, la coupure ; vers le haut, THUMP),
 * TONE (le cercle : vers le haut, plus clair ; vers le bas, plus sombre), HIGH CUT (le losange : tout a droite, ouvert).
 */
const DistEq: React.FC<{ x: number; y: number; w: number; h: number }> = ({ x, y, w, h }) => {
  useTick();
  const fx = pattern.fx.get();
  const W = w - 20;
  const H = h - 40;
  const lo = Math.log10(20);
  const X = (f: number): number => ((Math.log10(Math.max(20, Math.min(20000, f))) - lo) / 3) * W;
  const F = (px: number): number => Math.pow(10, lo + (Math.max(0, Math.min(W, px)) / W) * 3);
  const lowHz = distLowHz(fx.xlow);
  const highOn = fx.xtone < 0.999;
  const highHz = highOn ? 1000 * Math.pow(16, fx.xtone) : 20000;
  const steep = fx.xsteep >= 0.5;
  const tilt = (fx.xtilt - 0.5) * 2;
  const dbAt = (f: number): number => {
    let db = tilt * 6 * (Math.log10(f / 1000) / 1.3);
    if (lowHz > 0) db -= f < lowHz ? 24 * Math.log2(lowHz / f) : 0;
    if (lowHz > 0 && fx.xthump > 0) db += fx.xthump * 9 * Math.exp(-Math.pow(Math.log2(f / (lowHz * 1.4)), 2) * 2);
    if (highOn && f > highHz) db -= (steep ? 36 : 12) * Math.log2(f / highHz);
    return db;
  };
  const Y = (db: number): number => H / 2 - Math.max(-H / 2 + 2, Math.min(H / 2 - 2, db * (H / 30)));
  let path = '';
  for (let i = 0; i <= 240; i += 1) {
    const f = 20 * Math.pow(1000, i / 240);
    path += `${i ? 'L' : 'M'}${X(f).toFixed(1)} ${Y(dbAt(f)).toFixed(1)}`;
  }
  const pts = {
    low: { px: X(lowHz > 0 ? lowHz : 25), py: Y(dbAt(lowHz > 0 ? lowHz * 1.4 : 40)) },
    tone: { px: X(1000), py: Y(dbAt(1000)) },
    high: { px: X(highOn ? highHz : 18000), py: Y(dbAt(highOn ? highHz : 12000)) },
  };
  const drag = useRef<{ id: number; which: 'low' | 'tone' | 'high'; y0: number; v0: number } | null>(null);
  const local = (e: React.PointerEvent): { px: number; py: number; k: number } => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const k = r.width / w;
    return { px: (e.clientX - r.left) / k - 10, py: (e.clientY - r.top) / k - 30, k };
  };
  const apply = (e: React.PointerEvent): void => {
    const d = drag.current;
    if (!d) return;
    const q = local(e);
    if (d.which === 'low') {
      const f = F(q.px);
      DX.low.set(f < 28 ? 0 : Math.max(0.006, Math.min(1, Math.log(f / 30) / Math.log(500 / 30))));
      DX.thump.set(Math.max(0, Math.min(1, d.v0 + (d.y0 - q.py) / 80)));
    } else if (d.which === 'tone') DX.tilt.set(Math.max(0, Math.min(1, d.v0 + (d.y0 - q.py) / 120)));
    else {
      const f = F(q.px);
      DX.high.set(f >= 16000 ? 1 : Math.max(0, Math.min(0.999, Math.log(f / 1000) / Math.log(16))));
    }
  };
  return (
    <Lcd
      x={x}
      y={y}
      w={w}
      h={h}
      style={{ cursor: 'grab', touchAction: 'none' }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const q = local(e);
        const near = (Object.keys(pts) as ('low' | 'tone' | 'high')[]).map((k) => ({ k, d: Math.hypot(pts[k].px - q.px, pts[k].py - q.py) })).sort((a, b) => a.d - b.d)[0];
        if (!near || near.d > 60) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        undo.boundary('mm808', 'step');
        drag.current = { id: e.pointerId, which: near.k, y0: q.py, v0: near.k === 'low' ? fx.xthump : near.k === 'tone' ? fx.xtilt : 0 };
      }}
      onPointerMove={(e) => {
        if (drag.current?.id === e.pointerId) apply(e);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
    >
      {[50, 100, 200, 500, 1000, 2000, 5000, 10000].map((f) => (
        <React.Fragment key={f}>
          <i style={{ left: 10 + X(f), top: 22, bottom: 18, width: 1, background: 'rgba(255,255,255,.05)' }} />
          <div className="mm3-t8" style={{ left: 13 + X(f), bottom: 4, fontSize: 7 }}>
            {f >= 1000 ? `${f / 1000}K` : f}
          </div>
        </React.Fragment>
      ))}
      {[12, 6, 0, -6, -12].map((db) => (
        <div key={db} className="mm3-t8" style={{ right: 8, top: 30 + Y(db) - 5, fontSize: 7 }}>
          {db > 0 ? `+${db}` : db}
        </div>
      ))}
      <svg style={{ left: 10, top: 30 }} width={W} height={H}>
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="rgba(255,255,255,.1)" />
        <path d={`${path} L${W} ${H / 2} L0 ${H / 2} Z`} fill="rgba(255,217,0,.08)" />
        <path d={path} stroke="#ffd900" strokeWidth={2} fill="none" style={{ filter: 'drop-shadow(0 0 3px rgba(255,217,0,.6))' }} />
        <circle cx={pts.low.px} cy={pts.low.py} r={8} fill={lowHz > 0 ? '#ffd900' : '#3a3a3a'} stroke="#111" strokeWidth={2} />
        <circle cx={pts.tone.px} cy={pts.tone.py} r={7} fill="#111" stroke="#fff" strokeWidth={2} />
        <rect x={pts.high.px - 7} y={pts.high.py - 7} width={14} height={14} transform={`rotate(45 ${pts.high.px} ${pts.high.py})`} fill={highOn ? '#111' : '#2a2a2a'} stroke="#fff" strokeWidth={2} />
      </svg>
      <div className="mm3-t8" style={{ left: 12, top: 8 }}>
        ● LOW CUT + THUMP · ○ TONE · ◇ HIGH CUT · <span className="mm3-w">DRAG A POINT</span>
      </div>
      <div className="mm3-t8 mm3-a" style={{ right: 12, top: 8 }}>
        LOW CUT {DX.low.text()}
        {lowHz > 0 ? ' HZ' : ''} · THUMP {DX.thump.text()} · TONE {DX.tilt.text()} · HIGH CUT {DX.high.text()}
        {steep ? ' · 36 DB' : ''}
      </div>
    </Lcd>
  );
};

/** Le VU-metre creme (comme celui du MM-ARP) : le niveau de sortie de la machine. */
const CreamVu: React.FC<{ x: number; y: number; w: number; h: number; label: string }> = ({ x, y, w, h, label }) => {
  const needle = useRef<SVGLineElement | null>(null);
  useEffect(() => {
    let raf = 0;
    let cur = 0;
    const loop = (): void => {
      const m = meters.seen() ? meters.view() : null;
      const target = m ? Math.max(m.l, m.r) : 0;
      cur += (target - cur) * 0.18;
      const a = ((-48 + 96 * cur) * Math.PI) / 180;
      const cx = w / 2;
      const cy = h - 18;
      const r = h * 0.78;
      if (needle.current) {
        needle.current.setAttribute('x2', String(cx + Math.sin(a) * r));
        needle.current.setAttribute('y2', String(cy - Math.cos(a) * r));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [w, h]);
  const cx = w / 2;
  const cy = h - 18;
  const r0 = h * 0.62;
  const ticks: React.ReactNode[] = [];
  for (let i = 0; i <= 12; i += 1) {
    const a = ((-48 + 8 * i) * Math.PI) / 180;
    const big = i % 3 === 0;
    ticks.push(<line key={i} x1={cx + Math.sin(a) * r0} y1={cy - Math.cos(a) * r0} x2={cx + Math.sin(a) * (r0 + (big ? 12 : 7))} y2={cy - Math.cos(a) * (r0 + (big ? 12 : 7))} stroke={i > 9 ? '#c0281c' : '#1a1a1a'} strokeWidth={big ? 1.6 : 1} />);
  }
  return (
    <div style={{ left: x, top: y, width: w, height: h, borderRadius: 12, background: 'linear-gradient(#1a1a1b,#0b0b0c)', boxShadow: '0 0 0 1px #050505, 0 0 0 2px rgba(255,255,255,.06), 0 8px 16px rgba(0,0,0,.6)', padding: 8 }}>
      <div style={{ position: 'absolute', inset: 8, borderRadius: 8, background: 'radial-gradient(120% 100% at 50% 100%, #f3ecd6, #e3d9bb 60%, #cdbf98)', boxShadow: 'inset 0 2px 8px rgba(0,0,0,.45)' }}>
        <svg width={w - 16} height={h - 16} style={{ position: 'absolute', left: 0, top: 0 }}>
          <g transform="translate(-8,-8)">
            {ticks}
            <path d={`M${cx + Math.sin((24 * Math.PI) / 180) * (r0 + 4)} ${cy - Math.cos((24 * Math.PI) / 180) * (r0 + 4)} A${r0 + 4} ${r0 + 4} 0 0 1 ${cx + Math.sin((48 * Math.PI) / 180) * (r0 + 4)} ${cy - Math.cos((48 * Math.PI) / 180) * (r0 + 4)}`} stroke="#c0281c" strokeWidth={3} fill="none" />
            <line ref={needle} x1={cx} y1={cy} x2={cx} y2={cy - h * 0.78} stroke="#141414" strokeWidth={2} strokeLinecap="round" />
            <circle cx={cx} cy={cy} r={9} fill="#141414" />
          </g>
        </svg>
        <div style={{ position: 'absolute', left: 0, right: 0, top: h * 0.45, textAlign: 'center', font: "800 14px 'SF Pro Display'", letterSpacing: '.18em', color: '#151515' }}>{label}</div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: h * 0.45 + 18, textAlign: 'center', font: "700 6.5px 'SF Pro Display'", letterSpacing: '.2em', color: '#6b6250' }}>MAUDITE MACHINE</div>
      </div>
    </div>
  );
};

const DistoPage: React.FC = () => {
  useTick();
  const fx = pattern.fx.get();
  const cur = Math.round(course(DX.style) * 5);
  const y = 66;
  const flip = (c: Ctl) => () => {
    undo.boundary('mm808', 'step');
    setCourse(c, c.get() >= 0.5 ? 0 : 1);
  };
  return (
    <Frame page="DISTO" hint="THE DIST OF EVERY TRACK AND OF THE MASTER · STYLES OF THE DECAPITATOR KIND · DRAG THE POINTS OF THE EQ" lcd="FX · DISTO">
      <Title x={52} y={y} w={280} t="DRIVE" small="MASTER" />
      <Knob x={120} y={y + 96} d={100} kind="k1" ctl={DISTO_C.drive} label="DIST" big min="OFF" max="FULL" />
      <Toggle x={226} y={y + 72} a="OFF" b="ON" on={DX.punish.get() >= 0.5} onFlip={flip(DX.punish)} title="PUNISH: +20 dB into the saturation" />
      <Note x={248} y={y + 128} center style={{ fontSize: 16, fontWeight: 700, color: DX.punish.get() >= 0.5 ? 'var(--acc)' : '#8a8a8a', letterSpacing: '.18em' }}>
        PUNISH
      </Note>
      <Note x={248} y={y + 150} center style={{ fontSize: 7.5 }}>
        +20 DB
      </Note>
      <Lcd x={62} y={y + 200} w={260} h={104}>
        <div className="mm3-t8" style={{ left: 9, top: 6, fontSize: 7, zIndex: 1 }}>
          TRANSFER
        </div>
        <Curve fx={fx} />
      </Lcd>
      <VRule x={340} y={y + 4} h={310} />
      <Title x={356} y={y} w={440} t="STYLE" small="THE CIRCUIT" />
      {(['MM', 'TAPE', 'DESK', 'IRON', 'TUBE', 'PENT'] as const).map((n, i) => {
        const on = i === cur;
        const yy = y + 30 + i * 46;
        return (
          <div
            key={n}
            style={{ left: 366, top: yy, width: 420, height: 40, borderRadius: 8, cursor: 'pointer', background: on ? 'linear-gradient(90deg, rgba(255,217,0,.16), rgba(255,217,0,.03))' : 'transparent', boxShadow: on ? 'inset 3px 0 0 #ffd900' : 'inset 0 -1px 0 rgba(255,255,255,.05)' }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              undo.boundary('mm808', 'step');
              setCourse(DX.style, i / 5);
            }}
          >
            <div style={{ position: 'absolute', left: 14, top: 7, font: "700 11px 'SF Pro Display'", letterSpacing: '.18em', color: on ? '#fff' : '#d8d8d8' }}>{n}</div>
            <div style={{ position: 'absolute', left: 14, top: 23, font: "600 7px 'SF Pro Display'", letterSpacing: '.12em', color: on ? 'var(--acc)' : '#7d7d7d' }}>{DIST_STYLE_TEXT[n].replace(/^[A-Z]+: /, '').toUpperCase()}</div>
            <div className={`mm3-chip${on ? ' fill' : ''}`} style={{ position: 'absolute', right: 12, top: 11 }}>
              {on ? (n === 'MM' ? 'MM ENGINE' : 'ON') : 'PICK'}
            </div>
          </div>
        );
      })}
      <VRule x={804} y={y + 4} h={310} />
      <Title x={820} y={y} w={200} t="OUTPUT" />
      <Knob x={864} y={y + 92} d={44} kind="tiny" ctl={DX.mix} label="MIX" min="DRY" max="WET" />
      <Knob x={966} y={y + 96} d={62} kind="k1" ctl={DX.out} label="OUTPUT" min="-12" max="+12" />
      <Toggle x={896} y={y + 210} a="OFF" b="ON" on={DX.auto.get() >= 0.5} label="AUTO" onFlip={flip(DX.auto)} title="AUTO: the output follows the input level" />
      <VRule x={1034} y={y + 4} h={610} />
      <Title x={1050} y={y} w={298} t="LEVEL" />
      <CreamVu x={1062} y={y + 26} w={276} h={150} label="OUTPUT" />
      <Title x={1050} y={y + 196} w={298} t="PRESETS" />
      <PresetList x={1062} y={y + 222} w={280} h={380} title="DIST" list={DIST_PRESETS} patchOf={(i) => presetPatch(DIST_PRESETS[i], 'dist') as Record<string, number>} />
      <HRule x={52} y={y + 326} w={970} />
      <Title x={52} y={y + 338} w={970} t="EQ" small="BEFORE THE DRIVE · HIGH CUT AFTER" />
      <DistEq x={62} y={y + 362} w={950} h={162} />
      <Knob x={150} y={y + 560} d={38} kind="tiny" ctl={DX.low} label="LOW CUT" />
      <Knob x={300} y={y + 560} d={38} kind="tiny" ctl={DX.thump} label="THUMP" />
      <Knob x={450} y={y + 560} d={38} kind="tiny" ctl={DX.tilt} label="TONE" />
      <Knob x={600} y={y + 560} d={38} kind="tiny" ctl={DX.high} label="HIGH CUT" />
      <Toggle x={736} y={y + 546} a="12" b="36" on={DX.steep.get() >= 0.5} label="STEEP" onFlip={flip(DX.steep)} title="STEEP: the HIGH CUT at 36 dB per octave" />
      <SendRow y={704} fx="DIST" p="dist" master={DISTO_C.drive} mlabel="MASTER" />
    </Frame>
  );
};

/* ======================= CHORUS ======================= */

const CHORUS_C = { amt: slotCtl('fxchorus', 'chorus'), rate: slotCtl('fxchorus', 'crate'), depth: slotCtl('fxchorus', 'cdepth') };

const ChorusPage: React.FC = () => {
  useTick();
  const W = 900;
  const H = 500;
  const rate = course(CHORUS_C.rate);
  const depth = course(CHORUS_C.depth);
  const cyc = 1 + rate * 5;
  const amp = 40 + depth * 180;
  const wave = (ph: number): string => {
    let p = '';
    for (let i = 0; i <= 400; i += 1) {
      const tt = i / 400;
      p += `${i ? 'L' : 'M'}${(tt * W).toFixed(1)} ${(H / 2 - amp * Math.sin(tt * Math.PI * 2 * cyc + ph)).toFixed(1)}`;
    }
    return p;
  };
  return (
    <Frame page="CHORUS" hint="THE STEREO CHORUS OF THE MM-RYTM · EACH TRACK SENDS INTO IT (ITS FX PAGE ON THE MACHINE)" lcd="FX · CHORUS">
      <Lcd x={52} y={74} w={W} h={H}>
        {Array.from({ length: 17 }, (_, b) => (
          <i key={b} style={{ left: (b * W) / 16, top: 0, bottom: 0, width: 1, background: b % 4 === 0 ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.04)' }} />
        ))}
        <svg style={{ left: 0, top: 0 }} width={W} height={H}>
          <path d={wave(0)} stroke="#ffd900" strokeWidth={2.2} fill="none" style={{ filter: 'drop-shadow(0 0 5px rgba(255,217,0,.6))' }} />
          <path d={wave(Math.PI / 2)} stroke="#e8e8e8" strokeWidth={1.6} fill="none" opacity={0.85} />
        </svg>
        <div className="mm3-t8" style={{ left: 12, top: 10 }}>
          <span className="mm3-a">L</span> · <span className="mm3-w">R</span> &nbsp; THE TWO DELAY LINES OF THE CHORUS
        </div>
        <div style={{ right: 14, top: 8, display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span className="mm3-dots mm3-w" style={{ fontSize: 30 }}>
            {shown(CHORUS_C.rate)}
          </span>
        </div>
      </Lcd>
      <Title x={972} y={66} w={376} t="CHORUS" small="MASTER" />
      <Knob x={1160} y={200} d={110} kind="k1" ctl={CHORUS_C.amt} label="AMOUNT" big />
      <Knob x={1076} y={440} d={76} kind="k1" ctl={CHORUS_C.rate} label="RATE" big />
      <Knob x={1244} y={440} d={76} kind="k1" ctl={CHORUS_C.depth} label="DEPTH" big />
      <SendRow y={704} fx="CHORUS" p="chorus" master={CHORUS_C.amt} mlabel="MASTER" />
    </Frame>
  );
};

/* ======================= DELAY ======================= */

const DELAY_C = { amt: slotCtl('fxdelay', 'delay'), time: slotCtl('fxdelay', 'dtime'), fb: slotCtl('fxdelay', 'dfb'), tone: slotCtl('fxdelay', 'dtone') };

const DelayPage: React.FC = () => {
  useTick();
  const W = 900;
  const H = 250;
  const x0 = 150;
  const fb = course(DELAY_C.fb);
  const tc = course(DELAY_C.time);
  const gap = 18 + tc * 70;
  const taps: React.ReactNode[] = [];
  let a = 1;
  for (let i = 0; i < 14 && a > 0.04; i += 1) {
    const x = x0 + i * gap;
    if (x > W - 30) break;
    const hh = 100 * a;
    taps.push(<div key={i} style={{ left: x, top: 125 - hh, width: 4, height: hh, background: i ? '#ffd900' : '#fff', borderRadius: 2, boxShadow: `0 0 8px ${i ? 'rgba(255,217,0,.6)' : 'rgba(255,255,255,.6)'}` }} />);
    a *= 0.98 * fb;
  }
  return (
    <Frame page="DELAY" hint="THE DELAY OF THE MM-RYTM, ON THE TEMPO · EACH TRACK SENDS INTO IT (ITS FX PAGE ON THE MACHINE)" lcd="FX · DELAY">
      <Lcd x={52} y={70} w={W} h={H}>
        <div style={{ left: 16, top: 16 }}>
          <div className="mm3-t8 mm3-a">TIME</div>
          <div className="mm3-dots mm3-w" style={{ fontSize: 40, lineHeight: 1.1 }}>
            {shown(DELAY_C.time)}
          </div>
          <div className="mm3-t8 mm3-a" style={{ marginTop: 26 }}>
            FEEDBACK
          </div>
          <div className="mm3-dots mm3-w" style={{ fontSize: 30, lineHeight: 1.1 }}>
            {shown(DELAY_C.fb)}
          </div>
        </div>
        <i style={{ left: x0, right: 20, top: 125, height: 1, background: 'rgba(255,255,255,.12)' }} />
        {taps}
        <div className="mm3-t8 mm3-a" style={{ right: 16, top: 10 }}>
          ECHOES
        </div>
      </Lcd>
      <Lcd x={972} y={70} w={376} h={H}>
        <div className="mm3-t8" style={{ left: 14, top: 12 }}>
          ▶ DELAY · <span className="mm3-w">SEND FX</span>
        </div>
        <div className="mm3-dots mm3-w" style={{ left: 14, top: 34, fontSize: 30 }}>
          {shown(DELAY_C.time)}
        </div>
        <div className="mm3-t8" style={{ right: 14, top: 40, lineHeight: 1.9, textAlign: 'right' }}>
          FEEDBACK <span className="mm3-w">{shown(DELAY_C.fb)}</span>
          <br />
          TONE <span className="mm3-w">{shown(DELAY_C.tone)}</span>
          <br />
          AMOUNT <span className="mm3-w">{shown(DELAY_C.amt)}</span>
          <br />
          SENDS <span className="mm3-w">{TRACK_KEYS.filter((k) => (tracks.vfx(k).delay as number) > 0.001).length} / 16</span>
        </div>
      </Lcd>
      <HRule x={52} y={336} w={1296} />
      <Title x={52} y={350} w={420} t="TIME" />
      <Knob x={150} y={448} d={104} kind="sel" ctl={DELAY_C.time} ticks={6} />
      <Note x={150} y={516} center style={{ color: 'var(--acc)', fontSize: 10, fontWeight: 700 }}>
        {shown(DELAY_C.time)}
      </Note>
      <Key x={320} y={434} w={60} h={28} label="TAP" led="off" onDown={() => void import('../../actions/internal/transport').then((m) => m.tapTempo())} title="Tap the tempo" />
      <VRule x={486} y={354} h={220} />
      <Title x={502} y={350} w={440} t="FEEDBACK · TONE" />
      <Knob x={620} y={448} d={90} kind="k1" ctl={DELAY_C.fb} label="FEEDBACK" big min="0" max="FULL" />
      <Knob x={820} y={448} d={76} kind="k1" ctl={DELAY_C.tone} label="TONE" big min="DARK" max="OPEN" />
      <VRule x={958} y={354} h={220} />
      <Title x={974} y={350} w={374} t="AMOUNT" small="MASTER" />
      <Knob x={1160} y={448} d={90} kind="k1" ctl={DELAY_C.amt} label="DELAY" big />
      <SendRow y={704} fx="DELAY" p="delay" master={DELAY_C.amt} mlabel="MASTER" />
    </Frame>
  );
};

/* ======================= REVERB ======================= */

const REVERB_C = { amt: slotCtl('fxreverb', 'reverb'), size: slotCtl('fxreverb', 'rsize'), tone: slotCtl('fxreverb', 'rtone'), pre: slotCtl('fxreverb', 'rpre'), gate: slotCtl('fxreverb', 'rgate') };

const ReverbPage: React.FC = () => {
  useTick();
  const fx = pattern.fx.get();
  const W = 940;
  const H = 300;
  const size = course(REVERB_C.size);
  const gate = course(REVERB_C.gate);
  const gx = gate > 0.004 ? 20 + Math.min(1, 0.06 + gate * 0.7) * 600 : -1;
  const tail = (cut: boolean): string => {
    let p = '';
    for (let i = 0; i <= 300; i += 1) {
      const x = 20 + (i / 300) * 900;
      const tt = i / 300;
      if (cut && gx > 0 && x > gx) {
        p += `L${gx} 260`;
        break;
      }
      const yv = 260 - 210 * Math.exp(-tt * (8 - size * 6.5)) * (tt < 0.01 ? tt / 0.01 : 1);
      p += `${i ? 'L' : 'M'}${x.toFixed(1)} ${yv.toFixed(1)}`;
    }
    return p;
  };
  return (
    <Frame page="REVERB" hint="THE REVERB OF THE MM-RYTM · GATE : THE TAIL CLOSES SHUT AFTER EACH HIT (NEVER IN RANDOM)" lcd="FX · REVERB">
      <Title x={52} y={66} w={340} t="TYPE" small="PRESETS" />
      <PresetList x={70} y={96} w={300} h={120} title="REVERB" list={REVERB_PRESETS} patchOf={(i) => ({ ...REVERB_PRESETS[i].set }) as Record<string, number>} />
      <Note x={70} y={232} style={{ fontSize: 7.5, color: '#9a9a9a', whiteSpace: 'normal', width: 300, lineHeight: 1.6 }}>
        {revText(fx)}
      </Note>
      <Lcd x={408} y={74} w={W} h={H}>
        <svg style={{ left: 0, top: 0 }} width={W} height={H}>
          <path d={tail(false)} stroke="rgba(255,255,255,.35)" strokeDasharray="3 4" fill="none" />
          <path d={`${tail(true)} L20 260Z`} fill="rgba(255,217,0,.12)" />
          <path d={tail(true)} stroke="#ffd900" strokeWidth={2.2} fill="none" style={{ filter: 'drop-shadow(0 0 5px rgba(255,217,0,.6))' }} />
          {gx > 0 && <line x1={gx} y1={30} x2={gx} y2={268} stroke="#ffd900" strokeDasharray="4 3" />}
        </svg>
        <div style={{ right: 18, top: 12, textAlign: 'right' }}>
          <div className="mm3-t8">GATE</div>
          <div className="mm3-dots mm3-a" style={{ fontSize: 34, lineHeight: 1.1 }}>
            {shown(REVERB_C.gate)}
          </div>
          <div className="mm3-t8" style={{ marginTop: 6 }}>
            SIZE <span className="mm3-w">{shown(REVERB_C.size)}</span> · PRE <span className="mm3-w">{shown(REVERB_C.pre)}</span>
          </div>
        </div>
      </Lcd>
      <HRule x={52} y={372} w={1296} />
      <Title x={52} y={386} w={760} t="THE TAIL" />
      <Knob x={130} y={484} d={96} kind="k1" ctl={REVERB_C.size} label="SIZE" big />
      <Knob x={310} y={484} d={76} kind="k1" ctl={REVERB_C.tone} label="TONE" big />
      <Knob x={490} y={484} d={76} kind="k1" ctl={REVERB_C.pre} label="PRE" big />
      <Knob x={670} y={484} d={96} kind="k1" ctl={REVERB_C.gate} label="GATE" big acc min="OFF" max="1 S" />
      <VRule x={820} y={390} h={200} />
      <Title x={836} y={386} w={512} t="AMOUNT" small="MASTER" />
      <Knob x={1092} y={484} d={90} kind="k1" ctl={REVERB_C.amt} label="REVERB" big />
      <SendRow y={704} fx="REVERB" p="reverb" master={REVERB_C.amt} mlabel="MASTER" />
    </Frame>
  );
};

/* ======================= HELL ======================= */

const HellPage: React.FC = () => {
  useTick();
  const fx = { ...pattern.fx.get(), hmix: perform.hell() };
  const y = 66;
  const sync = fxCtl(lab(HELL_ECHO, 'hsync'));
  const lsync = fxCtl(lab(HELL_LFO, 'hlsync'));
  const stereo = fxCtl(lab(HELL_LFO, 'hstereo'));
  const mix = fxCtl(HELL_OUT[0]);
  const flip = (c: Ctl) => () => setCourse(c, c.get() >= 0.5 ? 0 : 1);
  return (
    <Frame page="HELL" hint="A FREQUENCY SHIFTER IN THE LOOP OF A DELAY · EVERY REPEAT CLIMBS OR FALLS · HELL MIX : A PARAMETER IN ABLETON" lcd="FX · HELL">
      <Title x={52} y={y} w={420} t="I · SHIFT" />
      <LabRow knobs={HELL_SHIFT} x0={52} x1={472} y={y + 84} d={46} />
      <HRule x={52} y={y + 170} w={420} />
      <Title x={52} y={y + 186} w={420} t="II · ECHO" />
      <LabRow knobs={HELL_ECHO} x0={52} x1={472} y={y + 270} d={46} skip={['hsync']} />
      <Toggle x={96} y={y + 350} a="FREE" b="SYNC" on={sync.get() >= 0.5} label="SYNC" onFlip={flip(sync)} />
      <Lcd x={560} y={y + 8} w={280} h={300}>
        <Spiral fx={fx} />
      </Lcd>
      <Knob x={700} y={y + 400} d={100} kind="k1" ctl={mix} label="MIX" big acc />
      <Note x={700} y={y + 490} center style={{ fontSize: 7.5 }}>
        <i>RETURN · {TRACK_KEYS.filter((k) => (tracks.vfx(k).hell as number) > 0.001).length} OF 16 TRACKS SEND</i>
      </Note>
      <Title x={928} y={y} w={420} t="III · LFO" />
      <LabRow knobs={HELL_LFO} x0={928} x1={1348} y={y + 84} d={46} skip={['hlsync', 'hstereo']} />
      <Toggle x={970} y={y + 150} a="FREE" b="SYNC" on={lsync.get() >= 0.5} label="SYNC" onFlip={flip(lsync)} />
      <Toggle x={1100} y={y + 150} a="SAME" b="STEREO" on={stereo.get() >= 0.5} label="L / R" onFlip={flip(stereo)} />
      <PresetList
        x={940}
        y={y + 224}
        w={400}
        h={300}
        title="HELL"
        list={HELL_PRESETS}
        patchOf={(i) => presetPatch(HELL_PRESETS[i], 'hell') as Record<string, number>}
        groups={[
          { name: 'HELL PRESETS · A PRESET SETS EVERYTHING BUT MIX', from: 0, to: HELL_PRESETS.length },
        ]}
      />
      <SendRow y={704} fx="HELL" p="hell" master={mix} mlabel="RETURN" />
    </Frame>
  );
};

/* ======================= MASTER ======================= */

const M_C = {
  comp: slotCtl('fxcomp', 'comp'),
  thr: slotCtl('fxcomp', 'cthr'),
  ratio: slotCtl('fxcomp', 'cratio'),
  knee: slotCtl('fxcomp', 'cknee'),
  atk: slotCtl('fxcomp', 'catk'),
  rel: slotCtl('fxcomp', 'crel'),
  make: slotCtl('fxcomp', 'cmake'),
  hpf: slotCtl('fxcomp', 'chpf'),
  bits: slotCtl('fxbit', 'bits'),
  brate: slotCtl('fxbit', 'brate'),
  stretch: slotCtl('fxg', 'stretch', true),
};
/** FILTER (le filtre DJ) et SIDECHAIN de PERFORM, des parametres d'Ableton (le pont les envoie). */
const perfCtl = (k: 'filter' | 'side'): Ctl => ({
  bipolar: k === 'filter',
  get: () => (k === 'filter' ? perform.filter() : perform.side()),
  set: (v) => (k === 'filter' ? perform.setFilter(Math.max(-1, Math.min(1, v))) : perform.setSide(Math.max(0, Math.min(1, v)))),
  reset: () => (k === 'filter' ? perform.setFilter(0) : perform.setSide(0)),
  range: () => (k === 'filter' ? [-1, 1] : [0, 1]),
  steps: () => 0,
  text: () => {
    const v = k === 'filter' ? perform.filter() : perform.side();
    if (k === 'side') return v <= 0.001 ? 'OFF' : `${Math.round(v * 100)} %`;
    return Math.abs(v) < 0.01 ? 'OPEN' : v < 0 ? `LP ${Math.round(-v * 100)}` : `HP ${Math.round(v * 100)}`;
  },
  unit: () => '',
  locked: () => false,
  dead: () => false,
});
export const PERF_C = { filter: perfCtl('filter'), side: perfCtl('side') };

const MasterMeters: React.FC = () => {
  const l = useRef<HTMLElement | null>(null);
  const r = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let raf = 0;
    const loop = (): void => {
      if (meters.seen()) {
        const m = meters.view();
        if (l.current) l.current.style.height = `${Math.round(m.l * 228)}px`;
        if (r.current) r.current.style.height = `${Math.round(m.r * 228)}px`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <>
      {[l, r].map((ref, i) => (
        <div key={i} style={{ left: 1310 + i * 14, top: 96, width: 8, height: 230, borderRadius: 3, background: '#060606', boxShadow: 'inset 0 1px 2px #000, 0 1px 0 rgba(255,255,255,.06)' }}>
          <b
            ref={(el) => {
              ref.current = el;
            }}
            style={{ position: 'absolute', left: 1, right: 1, bottom: 1, height: 0, borderRadius: 2, background: 'linear-gradient(0deg,#9a9a9a 0%,#e8e8e8 70%,#ffd900 88%,#ff3d2e 100%)', backgroundSize: '100% 228px', backgroundPosition: 'bottom' }}
          />
        </div>
      ))}
      <Note x={1308} y={332}>
        L &nbsp; R
      </Note>
    </>
  );
};

const MixerStrip: React.FC = () => {
  useTick();
  useSyncExternalStore(voices.subscribe, () => voices.get());
  const t = useTrack();
  const ym = 370;
  const x0 = 70;
  const p = (1330 - x0) / 16;
  const lev = React.useMemo(() => TRACK_KEYS.map((k) => trackCtl(k, 'level', { def: 0.8 })), []);
  const pan = React.useMemo(() => TRACK_KEYS.map((k) => trackCtl(k, 'pan', { bipolar: true, text: (v) => (Math.abs(v) < 0.01 ? 'C' : v < 0 ? `L${Math.round(-v * 64)}` : `R${Math.round(v * 63)}`) })), []);
  const drag = useRef<{ id: number; i: number; y0: number; v0: number } | null>(null);
  return (
    <>
      <HRule x={52} y={ym - 14} w={1296} />
      <Title x={52} y={ym} w={1296} t="MIXER" small="16 TRACKS · RIGHT CLICK A NAME : MUTE" />
      {TRACK_KEYS.map((k, i) => {
        const fx = x0 + i * p + p / 2 - 4;
        const v = course(lev[i]);
        const muted = isMuted(k);
        return (
          <React.Fragment key={k}>
            <Knob kind="tiny" x={fx} y={ym + 54} d={30} ctl={pan[i]} label="PAN" value={false} />
            <div style={{ left: fx - 3, top: ym + 104, width: 6, height: 200, borderRadius: 3, background: '#050505', boxShadow: 'inset 0 1px 3px #000, 0 1px 0 rgba(255,255,255,.07)' }} />
            {Array.from({ length: 11 }, (_, n) => (
              <div key={n} style={{ left: fx - 12, top: ym + 104 + n * 20, width: 5, height: 1, background: 'rgba(255,255,255,.2)' }} />
            ))}
            <div
              style={{ left: fx - 16, top: ym + 96, width: 32, height: 216, cursor: 'ns-resize', touchAction: 'none' }}
              role="slider"
              aria-label={`${TRACK_NAMES[i]} level`}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                drag.current = { id: e.pointerId, i, y0: e.clientY, v0: course(lev[i]) };
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d || d.id !== e.pointerId) return;
                const z = (e.currentTarget as HTMLElement).getBoundingClientRect().height / 216;
                setCourse(lev[d.i], d.v0 + (d.y0 - e.clientY) / z / 200);
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onDoubleClick={() => lev[i].reset()}
            >
              <div style={{ position: 'absolute', left: 3, top: 8 + 200 * (1 - v) - 9, width: 26, height: 18, borderRadius: 3, background: 'linear-gradient(#3a3a3d,#1a1a1b)', boxShadow: '0 0 0 1px #050505, 0 3px 5px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.15)' }}>
                <div style={{ position: 'absolute', left: 4, right: 4, top: 8, height: 2, background: k === t ? '#ffd900' : '#eee', borderRadius: 1 }} />
              </div>
            </div>
            <Key x={fx - p / 2 + 10} y={ym + 320} w={p / 2 - 8} h={18} r={5} inner="M" lit={muted ? 'red' : null} innerStyle={{ fontSize: 8 }} onDown={() => trackMuteFlip(k)} title={`Mute ${TRACK_NAMES[i]}`} />
            <Key x={fx + 6} y={ym + 320} w={p / 2 - 8} h={18} r={5} inner="S" lit={isSolo(k) ? 'lit' : null} innerStyle={{ fontSize: 8 }} onDown={() => voices.toggleSolo(k)} title={`Solo ${TRACK_NAMES[i]}`} />
            <Note x={fx} y={ym + 346} center style={{ color: k === t ? 'var(--acc)' : '#d8d8d8', fontSize: 8.5, cursor: 'pointer' }}>
              <span
                onPointerDown={() => trackSelect(k)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  trackMuteFlip(k);
                }}
              >
                {TRACK_NAMES[i]}
              </span>
            </Note>
            <Note x={fx} y={ym + 360} center style={{ color: muted ? 'var(--red)' : '#7d7d7d', fontSize: 7 }}>
              {muted ? 'MUTE' : lev[i].text()}
            </Note>
          </React.Fragment>
        );
      })}
    </>
  );
};

const MasterPage: React.FC = () => {
  const y = 66;
  return (
    <Frame page="MASTER" hint="THE BUS OF THE MM-RYTM : COMP, BIT, FILTER, SIDECHAIN, THE MIXER OF THE 16 TRACKS" lcd="MASTER">
      <Title x={52} y={y} w={640} t="COMP" small="BUS" />
      <Knob x={110} y={y + 84} d={76} kind="k1" ctl={M_C.comp} label="COMP" big />
      <Knob kind="tiny" x={230} y={y + 84} d={46} ctl={M_C.thr} label="THRESH" />
      <Knob kind="tiny" x={330} y={y + 84} d={46} ctl={M_C.ratio} label="RATIO" />
      <Knob kind="tiny" x={430} y={y + 84} d={46} ctl={M_C.knee} label="KNEE" />
      <Knob kind="tiny" x={530} y={y + 84} d={46} ctl={M_C.atk} label="ATTACK" />
      <Knob kind="tiny" x={630} y={y + 84} d={46} ctl={M_C.rel} label="RELEASE" />
      <Knob kind="tiny" x={230} y={y + 214} d={46} ctl={M_C.make} label="MAKEUP" />
      <Knob kind="tiny" x={330} y={y + 214} d={46} ctl={M_C.hpf} label="HPF" />
      <VRule x={706} y={y + 4} h={280} />
      <Title x={722} y={y} w={200} t="BIT" />
      <Knob kind="tiny" x={774} y={y + 84} d={50} ctl={M_C.bits} label="BITS" />
      <Knob kind="tiny" x={870} y={y + 84} d={50} ctl={M_C.brate} label="RATE" />
      <Title x={722} y={y + 160} w={200} t="TIME" />
      <Knob kind="tiny" x={774} y={y + 230} d={50} ctl={C.swing} label="SWING" />
      <Knob kind="tiny" x={870} y={y + 230} d={50} ctl={M_C.stretch} label="STRETCH" />
      <VRule x={936} y={y + 4} h={280} />
      <Title x={952} y={y} w={200} t="PERFORM" small="ABLETON" />
      <Knob x={1052} y={y + 96} d={72} kind="k1" ctl={PERF_C.filter} label="FILTER" big min="LP" max="HP" />
      <Knob kind="tiny" x={1052} y={y + 232} d={50} ctl={PERF_C.side} label="SIDECHAIN" />
      <VRule x={1166} y={y + 4} h={280} />
      <Title x={1182} y={y} w={166} t="OUTPUT" />
      <Knob x={1240} y={y + 110} d={80} kind="k1" ctl={C.master} label="VOLUME" big />
      <MasterMeters />
      <MixerStrip />
    </Frame>
  );
};

/* ======================= la page ======================= */

export const OpenPage: React.FC<{ page: Page }> = ({ page }) => {
  switch (page) {
    case 'SAMPLE':
      return <SamplePage />;
    case 'SEQ':
      return <SeqPage />;
    case 'LFO':
      return <LfoPage />;
    case 'DISTO':
      return <DistoPage />;
    case 'CHORUS':
      return <ChorusPage />;
    case 'DELAY':
      return <DelayPage />;
    case 'REVERB':
      return <ReverbPage />;
    case 'HELL':
      return <HellPage />;
    case 'MASTER':
      return <MasterPage />;
    case 'LIBRARY':
      return (
        <Frame page="LIBRARY" hint="IT LOADS AT ONCE · CMD+Z BRINGS YOUR PATTERN BACK · THE TEMPO SHOWN IS THE ONE IT WAS MADE AT" lcd="LIBRARY">
          <Library />
        </Frame>
      );
    case 'MIDI':
      return (
        <Frame page="MIDI" hint="DRAG IT ONTO A MIDI TRACK OR A DRUM RACK (16 PADS, C1 TO D#2) · A CLICK SAVES THE .MID" lcd="MIDI">
          <MidiPage />
        </Frame>
      );
    default:
      return null;
  }
};

