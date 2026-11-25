/**
 * La face v3 du plugin MM-RYTM (2026-11-25, Mika : "redesign MM-RYTM [...] oriente rythmiques", choix valides : les onglets
 * d'OPEN sur la face (C), les pas rouges, 1400 x 896). Les maquettes : docs/maquettes/mm-rytm-v3. En haut le son de la piste
 * choisie (SAMPLE, FILTER, AMP EG, LFO 1 et 2, FX SENDS), au milieu TRIG, l'ecran, les scenes, les touches et MASTER, en bas
 * les 16 pistes et les 16 pas. Chaque knob porte son reglage (plugin/v3/ctl.ts) ; les touches passent par les memes actions
 * que la face d'avant (actions/face.ts faceKeyDown, faceKeyUp), le clavier et le MIDI aussi.
 */

import React, { useMemo, useRef, useSyncExternalStore } from 'react';
import { clearKey, copyKey, faceKeyDown, faceKeyUp, faceKeyTap, funcDown, funcUp, pasteKey, performPads, sceneDown, sceneUp, xfadeGesture, xfadeSet, xfadeValue } from '../../actions';
import type { Dt2ButtonId } from '../../rytm/dtFaceIds';
import { tapTempo } from '../../actions/internal/transport';
import { liveKey, liveOn } from '../../actions/live';
import { trigger } from '../../audio/drums';
import { clock } from '../../audio/clock';
import { samplesOf } from '../../audio/samples';
import { TRACK_KEYS, TRACK_NAMES, tracks, typedFamily, type TrackKey } from '../../audio/tracks';
import { dtFace } from '../../state/dtFace';
import { func } from '../../state/func';
import { sceneCtl } from '../../state/sceneCtl';
import { fileImport } from '../../actions';
import { setCourse, course, shown } from './ctl';
import { C, MiniWave, lfoPath, nudge, useTrack } from './parts';
import { HRule, Key, Knob, Lcd, Note, Title, Toggle, VRule, useTick } from './ui';
import { Header } from './Chrome';
import { Screen } from './Screen';
import { Steps } from './Steps';
import { smpLabel } from '../OpenPanel';

/* ---------------- les rangees ---------------- */

const SampleSection: React.FC<{ t: TrackKey }> = ({ t }) => {
  useTick();
  const i = TRACK_KEYS.indexOf(t);
  const fam = typedFamily(i);
  const skey = tracks.of(t).snd;
  const list = samplesOf(fam);
  const cur = list.findIndex((s) => s.key === skey);
  const smp = cur >= 0 ? list[cur] : undefined;
  const name = smp ? smpLabel(smp) : 'OFF';
  const rev = C.rev.get() >= 0.5;
  const top = 66;
  return (
    <>
      <Title x={52} y={top} w={418} t="SAMPLE" small={`T${i + 1} · ${TRACK_NAMES[i]}`} />
      <Knob x={112} y={top + 112} d={98} kind="sel" ctl={C.snd} label="SAMPLE" big ticks={9} />
      <Lcd x={186} y={top + 28} w={282} h={62}>
        <div className="mm3-t8" style={{ left: 12, top: 9 }}>
          {fam.toUpperCase()} · {cur >= 0 ? `${String(cur + 1).padStart(2, '0')} / ${list.length}` : 'OFF'}
          {smp && skey.includes('/~') ? ' · YOUR FOLDER' : ''}
        </div>
        <div className="mm3-dots mm3-w" style={{ left: 11, top: 24, fontSize: name.length > 14 ? 17 : 22, maxWidth: 196, overflow: 'hidden' }}>
          {name}
        </div>
        <div style={{ right: 10, top: 12 }}>
          <MiniWave skey={skey} w={56} h={38} />
        </div>
      </Lcd>
      <Knob x={214} y={top + 140} d={38} ctl={C.tune} label="TUNE" />
      <Knob x={270} y={top + 140} d={38} ctl={C.fine} label="FINE" />
      <Knob x={326} y={top + 140} d={38} ctl={C.start} label="START" />
      <Knob x={382} y={top + 140} d={38} ctl={C.len} label="LEN" />
      <Knob x={438} y={top + 140} d={38} ctl={C.lev} label="LEVEL" />
      <Toggle x={70} y={top + 220} a="FWD" b="REV" on={rev} label="PLAY" onFlip={() => setCourse(C.rev, rev ? 0 : 1)} />
      <Key x={196} y={top + 216} w={46} h={24} label="PREV" led="off" onDown={() => nudge(C.snd, -1)} title="The sample before, of this type" />
      <Key x={250} y={top + 216} w={46} h={24} label="NEXT" led="off" onDown={() => nudge(C.snd, 1)} title="The next sample of this type" />
      <Key x={304} y={top + 216} w={46} h={24} label="LISTEN" led="off" onDown={() => trigger(t, undefined, false, undefined, 1)} title="Play the track once (the plugin plays it)" />
      <Key x={358} y={top + 216} w={108} h={24} label="IMPORT…" inner="+ FILE" onTap={() => fileImport.plugin?.(t)} title="Load a file of yours on this track" />
    </>
  );
};

/** La courbe de l'enveloppe AMP (ATK, HOLD, DEC) dans son petit ecran. */
const AmpLcd: React.FC = () => {
  // la courbe AMP
  useTick();
  const a = course(C.atk);
  const h = course(C.hold);
  const d = course(C.dec);
  const W = 180;
  const H = 54;
  const xa = 2 + a * 40;
  const xh = xa + 2 + h * 40;
  const xd = Math.min(W, xh + 12 + d * (W - xh - 12));
  const path = `M0 ${H} L${xa.toFixed(1)} 3 L${xh.toFixed(1)} 3 C${(xh + (xd - xh) * 0.3).toFixed(1)} ${H * 0.6} ${(xh + (xd - xh) * 0.6).toFixed(1)} ${H * 0.92} ${xd.toFixed(1)} ${H - 1}`;
  return (
    <Lcd x={726} y={94} w={196} h={80}>
      <div className="mm3-t8" style={{ left: 9, top: 7 }}>
        <span className="mm3-a">AMP</span> · ATK {shown(C.atk)} · DEC {shown(C.dec)}
      </div>
      <svg style={{ left: 8, top: 20 }} width={W} height={H}>
        <path d={`${path} L${xd.toFixed(1)} ${H} Z`} fill="rgba(255,217,0,.12)" />
        <path d={path} stroke="#ffd900" strokeWidth={1.6} fill="none" style={{ filter: 'drop-shadow(0 0 3px rgba(255,217,0,.6))' }} />
      </svg>
    </Lcd>
  );
};

const LfoLcd: React.FC = () => {
  useTick();
  const d1 = C.l1dst.text();
  const d2 = C.l2dst.text();
  const on1 = d1 !== 'OFF' && d1 !== '--';
  const on2 = d2 !== 'OFF' && d2 !== '--';
  return (
    <Lcd x={954} y={94} w={188} h={46}>
      <svg style={{ left: 6, top: 5 }} width={176} height={36}>
        {on2 && <path d={lfoPath(C.l2wav.get(), C.l2dep.get() || 0.5, 176, 36, 2)} stroke="#bdbdbd" strokeWidth={1} strokeDasharray="2 2" fill="none" opacity={0.8} />}
        {on1 && <path d={lfoPath(C.l1wav.get(), C.l1dep.get() || 0.5, 176, 36, 4)} stroke="#ffd900" strokeWidth={1.4} fill="none" />}
      </svg>
      <div className="mm3-t8" style={{ right: 7, top: 4, fontSize: 6.5 }}>
        <span className="mm3-a">1 {on1 ? d1 : 'OFF'}</span> · 2 {on2 ? d2 : 'OFF'}
      </div>
    </Lcd>
  );
};

const SoundRow: React.FC<{ t: TrackKey }> = ({ t }) => {
  const top = 66;
  return (
    <>
      <SampleSection t={t} />
      <VRule x={478} y={top + 4} h={250} />
      <Title x={486} y={top} w={214} t="FILTER" />
      <Knob x={560} y={top + 92} d={82} kind="k1" ctl={C.fcut} label="CUTOFF" big />
      <Knob x={658} y={top + 80} d={34} kind="tiny" ctl={C.ftype} ticks={0} value={false} />
      <Note x={658} y={top + 104} center style={{ color: '#dadada', fontSize: 9 }}>
        TYPE
      </Note>
      <FtypeText />
      <Knob x={512} y={top + 200} d={32} ctl={C.freso} label="RESO" />
      <Knob x={562} y={top + 200} d={32} ctl={C.fenv} label="ENV" />
      <Knob x={612} y={top + 200} d={32} ctl={C.fatk} label="F.ATK" />
      <Knob x={662} y={top + 200} d={32} ctl={C.fdec} label="F.DEC" />
      <VRule x={708} y={top + 4} h={250} />
      <Title x={716} y={top} w={214} t="AMP EG" />
      <AmpLcd />
      <Knob x={740} y={top + 166} d={30} ctl={C.atk} label="ATK" />
      <Knob x={782} y={top + 166} d={30} ctl={C.hold} label="HOLD" />
      <Knob x={824} y={top + 166} d={30} ctl={C.dec} label="DEC" />
      <Knob x={866} y={top + 166} d={30} ctl={C.vstart} label="START" />
      <Knob x={908} y={top + 166} d={30} ctl={C.pan} label="PAN" />
      <VRule x={938} y={top + 4} h={250} />
      <Title x={946} y={top} w={204} t="LFO" small="1 · 2" />
      <LfoLcd />
      <Note x={950} y={top + 98} style={{ color: 'var(--acc)' }}>
        1
      </Note>
      <Knob x={974} y={top + 118} d={30} ctl={C.l1rate} label="RATE" />
      <Knob x={1022} y={top + 118} d={30} ctl={C.l1dep} label="DEPTH" />
      <Knob x={1070} y={top + 118} d={30} ctl={C.l1wav} label="WAVE" />
      <Knob x={1120} y={top + 118} d={26} kind="tiny" ctl={C.l1dst} label="DEST" ticks={0} />
      <Note x={950} y={top + 180} style={{ color: '#bdbdbd' }}>
        2
      </Note>
      <Knob x={974} y={top + 200} d={30} ctl={C.l2rate} label="RATE" />
      <Knob x={1022} y={top + 200} d={30} ctl={C.l2dep} label="DEPTH" />
      <Knob x={1070} y={top + 200} d={30} ctl={C.l2wav} label="WAVE" />
      <Knob x={1120} y={top + 200} d={26} kind="tiny" ctl={C.l2dst} label="DEST" ticks={0} />
      <VRule x={1158} y={top + 4} h={250} />
      <Title x={1166} y={top} w={182} t="FX SENDS" />
      <Knob x={1198} y={top + 62} d={38} ctl={C.sdist} label="DIST" />
      <Knob x={1258} y={top + 62} d={38} ctl={C.schorus} label="CHORUS" />
      <Knob x={1318} y={top + 62} d={38} ctl={C.sdelay} label="DELAY" />
      <Knob x={1198} y={top + 148} d={38} ctl={C.sreverb} label="REVERB" />
      <Knob x={1258} y={top + 148} d={38} ctl={C.shell} label="HELL" />
      <Knob x={1318} y={top + 148} d={38} ctl={C.tone} label="TONE" />
      <Note x={1257} y={top + 236} center style={{ fontSize: 7.5 }}>
        <i>OPEN ›</i> THE EFFECTS, ABOVE
      </Note>
    </>
  );
};

/** Le nom du type de filtre sous son selecteur. */
const FtypeText: React.FC = () => {
  useTick();
  return (
    <Note x={658} y={66 + 116} center style={{ color: 'var(--acc)', fontSize: 8 }}>
      {C.ftype.text()}
    </Note>
  );
};

/* ---------------- la rangee du milieu ---------------- */

const useRunning = (): boolean => useSyncExternalStore(clock.subscribe, () => clock.running);

const XFader: React.FC = () => {
  const x = useSyncExternalStore(sceneCtl.subscribe, xfadeValue);
  const drag = useRef<number | null>(null);
  const W = 448;
  const at = (e: React.PointerEvent): number => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return (e.clientX - r.left) / r.width;
  };
  return (
    <div
      className="mm3-xf"
      style={{ left: 468, top: 566, width: W, height: 36 }}
      role="slider"
      aria-label="Crossfader, scene A to scene B"
      aria-valuenow={Math.round(x * 100)}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = e.pointerId;
        xfadeGesture('start', 'ptr');
        xfadeSet(at(e), 'ptr');
      }}
      onPointerMove={(e) => {
        if (drag.current === e.pointerId) xfadeSet(at(e), 'ptr');
      }}
      onPointerUp={(e) => {
        if (drag.current !== e.pointerId) return;
        drag.current = null;
        xfadeGesture('end', 'ptr');
      }}
      onPointerCancel={() => {
        drag.current = null;
        xfadeGesture('end', 'ptr');
      }}
      onDoubleClick={() => xfadeSet(0, 'ptr')}
    >
      <div className="slot" />
      {Array.from({ length: 11 }, (_, i) => (
        <div key={i} className="tick" style={{ left: (W * i) / 10 }} />
      ))}
      <div className="cap" style={{ left: W * x }} />
    </div>
  );
};

/** Une touche de la face DT2 (son appui, son lacher : actions/face.ts). */
const faceKey = (id: Dt2ButtonId) => ({
  onDown: (e: React.PointerEvent) => faceKeyDown(id, `ptr:${e.pointerId}`, null, e.timeStamp || performance.now()),
  onUp: (e: React.PointerEvent, tap: boolean) => faceKeyUp(id, `ptr:${e.pointerId}`, null, e.timeStamp || performance.now(), tap),
});

const MidRow: React.FC = () => {
  useTick();
  const running = useRunning();
  const scene = useSyncExternalStore(sceneCtl.subscribe, () => sceneCtl.get().armed);
  useSyncExternalStore(dtFace.subscribe, () => dtFace.live());
  const yb = 344;
  const kx = [994, 1064, 1134];
  const ky = [yb + 26, yb + 98, yb + 170];
  const live = liveOn();
  return (
    <>
      <Title x={52} y={yb} w={340} t="TRIG" small="TRACK DEFAULTS · HOLD A STEP : P-LOCK" />
      <Knob x={98} y={yb + 66} d={42} ctl={C.note} label="NOTE" />
      <Knob x={180} y={yb + 66} d={42} ctl={C.vel} label="VEL" />
      <Knob x={262} y={yb + 66} d={42} ctl={C.qlen} label="LEN" />
      <Knob x={344} y={yb + 66} d={42} ctl={C.prob} label="PROB" />
      <Knob x={98} y={yb + 166} d={46} kind="sel" ctl={C.cond} label="COND" ticks={9} />
      <Knob x={180} y={yb + 166} d={42} ctl={C.utime} label="μTIME" />
      <Knob x={262} y={yb + 166} d={42} ctl={C.rtrg} label="RETRIG" />
      <Knob x={344} y={yb + 166} d={42} ctl={C.rate} label="RATE" />
      <VRule x={404} y={yb + 4} h={262} />
      <Screen />
      <Key
        x={418}
        y={570}
        w={34}
        h={28}
        inner="A"
        lit={scene === 'a' ? 'lit' : null}
        title="Scene A: hold it and turn knobs (they go into scene A)"
        onDown={(e) => sceneDown('a', `ptr:${e.pointerId}`, e.timeStamp || performance.now())}
        onUp={(e, tap) => sceneUp('a', `ptr:${e.pointerId}`, tap ? e.timeStamp || performance.now() : -1)}
      />
      <XFader />
      <Key
        x={932}
        y={570}
        w={34}
        h={28}
        inner="B"
        lit={scene === 'b' ? 'lit' : null}
        title="Scene B: hold it and turn knobs (they go into scene B)"
        onDown={(e) => sceneDown('b', `ptr:${e.pointerId}`, e.timeStamp || performance.now())}
        onUp={(e, tap) => sceneUp('b', `ptr:${e.pointerId}`, tap ? e.timeStamp || performance.now() : -1)}
      />
      <Note x={692} y={yb + 254} center style={{ fontSize: 7.5 }}>
        SCENES · CROSSFADE
      </Note>
      <VRule x={980} y={yb + 4} h={262} />
      <Key x={kx[0]} y={ky[0]} w={56} h={30} label="PLAY" led={running ? 'on' : 'off'} inner="▶" {...faceKey('play')} title="Play (Ableton playing leads)" />
      <Key x={kx[1]} y={ky[0]} w={56} h={30} label="STOP" led="off" inner="■" {...faceKey('stop')} />
      <Key x={kx[2]} y={ky[0]} w={56} h={30} label={live ? 'LIVE REC' : 'REC'} labAcc={live} led={live ? 'red' : 'off'} lit={live ? 'red' : null} inner={<span style={{ color: live ? '#3a0000' : '#ff3d2e', fontSize: 12 }}>●</span>} onTap={() => liveKey()} title="LIVE REC: while it plays, the knobs you turn and the steps you hit are recorded (the steps are always editable)" />
      <Key x={kx[0]} y={ky[1]} w={56} h={30} label="COPY" led="off" onTap={() => copyKey()} title="Copy the pattern (REC on: the track)" />
      <Key x={kx[1]} y={ky[1]} w={56} h={30} label="CLEAR" led="off" onTap={() => clearKey(null)} title="Clear the pattern (REC on: the track); Cmd+Z brings it back" />
      <Key x={kx[2]} y={ky[1]} w={56} h={30} label="PASTE" led="off" onTap={() => pasteKey()} />
      <Key x={kx[0]} y={ky[2]} w={56} h={30} label="RANDOM" led="off" {...faceKey('random')} title="A new random beat (Cmd+Z: back)" />
      <Key x={kx[1]} y={ky[2]} w={56} h={30} label="TAP" led="off" onDown={() => tapTempo()} title="Tap the tempo (Ableton playing leads)" />
      <Key
        x={kx[2]}
        y={ky[2]}
        w={56}
        h={30}
        label="SAVE"
        led="off"
        title="Save a preset (its name, then Enter)"
        onTap={() => {
          funcDown('v3save');
          faceKeyTap('settings');
          funcUp('v3save', -1);
        }}
      />
      <VRule x={1200} y={yb + 4} h={262} />
      <Title x={1208} y={yb} w={140} t="MASTER" />
      <Knob x={1278} y={yb + 84} d={84} kind="k1" ctl={C.master} label="VOLUME" big min="-∞" max="MAX" />
      <Knob x={1242} y={yb + 196} d={32} ctl={C.swing} label="SWING" />
      <Knob x={1314} y={yb + 196} d={32} ctl={C.comp} label="COMP" />
    </>
  );
};

/* ---------------- la rangee du bas : les modes, les pistes, les pas ---------------- */

const ModeKeys: React.FC = () => {
  useTick();
  const f = useSyncExternalStore(func.subscribe, () => func.engaged());
  const mute = useSyncExternalStore(dtFace.subscribe, () => dtFace.mute() !== 'off');
  const solo = useSyncExternalStore(dtFace.subscribe, () => dtFace.solo());
  const perf = useSyncExternalStore(dtFace.subscribe, () => performPads());
  const yc = 630;
  const row = (id: Dt2ButtonId, word: string, on: boolean, i: number, title: string, red = false) => (
    <Key
      key={id}
      x={56}
      y={yc + 6 + i * 52}
      w={96}
      h={32}
      led={on ? (red ? 'red' : 'on') : 'off'}
      ledIn
      inner={word}
      innerStyle={id === 'func' ? { color: 'var(--acc)' } : undefined}
      title={title}
      {...faceKey(id)}
    />
  );
  return (
    <>
      {row('func', 'FUNC', f, 0, 'FUNC: hold it (or Shift) and press a key or a step (a step: mutes its track)')}
      {row('mute', 'MUTE', mute, 1, 'MUTE: the steps are the tracks, a tap mutes one', true)}
      {row('solo', 'SOLO', solo, 2, 'SOLO: the steps are the tracks, a tap solos one (Shift: one more)')}
      {row('preset', 'PERFORM', perf, 3, 'PERFORM: the steps are live pads (cuts, repeats, throws, tape stop); Shift + click keeps one')}
      <Note x={104} y={yc + 214} center style={{ fontSize: 7 }}>
        SHIFT = FUNC
      </Note>
    </>
  );
};

export const Face: React.FC = () => {
  const t = useTrack();
  // Les morceaux de la face ne changent pas d'un rendu a l'autre : seuls leurs knobs se redessinent (useTick)
  const sound = useMemo(() => <SoundRow t={t} />, [t]);
  return (
    <>
      <Header />
      {sound}
      <HRule x={52} y={332} w={1296} />
      <MidRow />
      <HRule x={52} y={616} w={1296} />
      <ModeKeys />
      <Steps />
    </>
  );
};

