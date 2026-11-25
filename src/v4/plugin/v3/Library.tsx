/**
 * La face v3 du plugin (2026-11-25) : LIBRARY (les presets d'usine par style, trois variations chacun ; les tiens ; un clic
 * charge, Cmd+Z revient) et MIDI (DRAG MIDI : la pattern qui joue en clip a glisser dans Ableton, SAVE .MID ; NEW et CLEAR ;
 * les niveaux du moteur), les deux pages de la bande du bas de l'OPEN, comme le MM-ARP.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { faceKeyTap, funcDown, funcUp } from '../../actions';
import { pluginClear, pluginNew } from '../../actions/patterns';
import { pattern, velocity } from '../../audio/pattern';
import { TRACK_KEYS, TRACK_NAMES } from '../../audio/tracks';
import { lcdMessage } from '../../state/lcdMessage';
import { pluginMidi } from '../../state/pluginMidi';
import { patterns, slotName } from '../../state/patterns';
import { presets, type Preset } from '../../state/presets';
import { undo } from '../../state/undo';
import { meters } from '../meters';
import { Key, Lcd, Note, Title, useTick } from './ui';

let presetRev = 0;
const subscribePresets = (fn: () => void): (() => void) =>
  presets.subscribe(() => {
    presetRev += 1;
    fn();
  });
/** La liste des presets (presets.list en rend une neuve a chaque appel : la version de la liste, puis la liste). */
const usePresets = (): readonly Preset[] => {
  useSyncExternalStore(subscribePresets, () => presetRev);
  return presets.list('mm808');
};

function load(p: Preset): void {
  undo.boundary('mm808', 'step');
  const got = presets.load('mm808', p.id);
  lcdMessage.show(got ? `LOADED ${p.name}` : `${p.name}: NOT LOADED`, 1600);
}

/** Les presets d'usine par style (DARK DISCO 1, 2, 3 : un style, trois variations). */
function styles(list: readonly Preset[]): { name: string; vars: Preset[] }[] {
  const out: { name: string; vars: Preset[] }[] = [];
  for (const p of list) {
    if (!p.factory) continue;
    const m = /^(.*) (\d)$/.exec(p.name);
    const name = m ? m[1] : p.name;
    const g = out.find((x) => x.name === name);
    if (g) g.vars.push(p);
    else out.push({ name, vars: [p] });
  }
  return out;
}

export const Library: React.FC = () => {
  useTick();
  const list = usePresets();
  const loaded = presets.loaded('mm808');
  const st = styles(list);
  const mine = list.filter((p) => !p.factory);
  const per = 7;
  const cols = Math.ceil(st.length / per);
  const cw = 960 / Math.max(4, cols);
  const bpmOf = (p: Preset): string => {
    const b = (p.data as { bpm?: number }).bpm;
    return typeof b === 'number' ? String(Math.round(b)) : '';
  };
  return (
    <>
      <div className="mm3-title" style={{ left: 52, top: 70, width: 960 }}>
        FACTORY BANK · {st.length} STYLES · {st.reduce((n, s) => n + s.vars.length, 0)} PATTERNS
      </div>
      {st.map((s, i) => {
        const x = 60 + Math.floor(i / per) * cw;
        const y = 104 + (i % per) * 96;
        const isOn = s.vars.some((v) => v.id === loaded?.id);
        return (
          <React.Fragment key={s.name}>
            <Note x={x} y={y} style={{ fontSize: 9.5 }}>
              <b style={{ letterSpacing: '.14em', color: isOn ? 'var(--acc)' : '#e8e8e8' }}>{s.name}</b>
            </Note>
            <Note x={x + cw - 28} y={y} right style={{ fontSize: 8, color: '#6f6f6f' }}>
              {bpmOf(s.vars[0])}
            </Note>
            <div className="mm3-hrule" style={{ left: x, top: y + 16, width: cw - 28 }} />
            {s.vars.map((v, k) => (
              <Key key={v.id} x={x + k * ((cw - 28) / 3)} y={y + 28} w={(cw - 28) / 3 - 8} h={26} r={8} inner={`VAR ${k + 1}`} lit={v.id === loaded?.id ? 'lit' : null} innerStyle={{ fontSize: 8 }} onDown={() => load(v)} title={`${v.name} · ${bpmOf(v)} BPM`} />
            ))}
          </React.Fragment>
        );
      })}
      <Title x={1040} y={70} w={308} t="YOUR PRESETS" small={`${mine.length}`} />
      <Key
        x={1094}
        y={104}
        w={200}
        h={30}
        label="SAVE A PRESET"
        led="off"
        title="Its name, then Enter"
        onTap={() => {
          funcDown('v3save');
          faceKeyTap('settings');
          funcUp('v3save', -1);
        }}
      />
      <div className="mm3-list" style={{ left: 1040, top: 172, width: 308, height: 420 }}>
        <div className="h">
          <span>SAVED IN THE PROJECT</span>
          <span>{mine.length}</span>
        </div>
        {mine.map((p, i) => (
          <div
            key={p.id}
            className={`r${p.id === loaded?.id ? ' on' : ''}`}
            onPointerDown={(e) => {
              e.preventDefault();
              load(p);
            }}
            title={`${p.name}${p.user ? ` · ${p.user}` : ''}`}
          >
            <span>
              <em>{String(i + 1).padStart(2, '0')}</em>
              {p.name}
              {p.user ? <span style={{ color: '#666' }}> · {p.user}</span> : null}
            </span>
            {p.id === loaded?.id && <i className="d" />}
          </div>
        ))}
        {mine.length === 0 && <div className="mm3-t8" style={{ padding: '6px 0', color: '#666' }}>SAVE A PRESET : IT COMES HERE</div>}
      </div>
      <Note x={1040} y={608} style={{ fontSize: 7.5 }}>
        {loaded ? (
          <>
            LOADED <b>{loaded.label}</b>
            {loaded.edited ? <i> · EDITED</i> : ''}
          </>
        ) : (
          'NO PRESET LOADED'
        )}
      </Note>
    </>
  );
};

/* ---------------- MIDI ---------------- */

const useMidi = (): ReturnType<typeof pluginMidi.get> => useSyncExternalStore(pluginMidi.subscribe, pluginMidi.get, pluginMidi.get);

/** DRAG MIDI : tire de 4 px, le plugin donne le fichier au glisser du Mac ; un clic sans glisser garde le .mid. */
const DragMidi: React.FC = () => {
  useTick();
  const { info, status } = useMidi();
  const press = useRef<{ id: number; x: number; y: number; sent: boolean } | null>(null);
  const off = useRef<(() => void) | null>(null);
  useEffect(() => {
    pluginMidi.request?.();
    return () => off.current?.();
  }, []);
  const onDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) return;
    off.current?.();
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, sent: false };
    const move = (ev: PointerEvent): void => {
      const p = press.current;
      if (!p || p.sent || ev.pointerId !== p.id) return;
      if (ev.pointerType === 'mouse' && (ev.buttons & 1) === 0) return;
      if (Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < 4) return;
      p.sent = true;
      pluginMidi.drag?.();
    };
    const clean = (): void => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', end, true);
      window.removeEventListener('pointercancel', end, true);
      off.current = null;
    };
    const end = (ev: PointerEvent): void => {
      const p = press.current;
      if (!p || ev.pointerId !== p.id) return;
      press.current = null;
      clean();
      if (!p.sent && ev.type === 'pointerup') pluginMidi.save?.();
    };
    off.current = clean;
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
  };
  const can = !!info && info.ok && info.notes > 0;
  return (
    <>
      <div
        className="mm3-drag"
        style={{ left: 62, top: 100, width: 680, height: 300, borderRadius: 12, cursor: 'grab', background: 'linear-gradient(#2a2410,#17140a)', boxShadow: '0 0 0 1px rgba(255,217,0,.6), 0 0 26px rgba(255,217,0,.12), inset 0 1px 0 rgba(255,255,255,.08)', opacity: can ? 1 : 0.6 }}
        onPointerDown={onDown}
        role="button"
        aria-label="DRAG MIDI: drag the playing pattern into Ableton; a click saves the .mid"
      >
        <div style={{ position: 'absolute', left: 20, top: 20, color: '#ffd900', font: "800 22px 'SF Pro Display'", letterSpacing: '.1em' }}>⠿</div>
        <div style={{ position: 'absolute', left: 20, top: 60, color: '#ffd900', font: "700 11px 'SF Pro Display'", letterSpacing: '.18em', lineHeight: 1.6 }}>
          DRAG
          <br />
          ME
          <br />
          INTO
          <br />
          ABLETON
        </div>
        <ClipView />
        <div className="mm3-t8" style={{ position: 'absolute', left: 20, bottom: 16, color: '#d7c27a' }}>
          {info ? (info.ok ? `${info.slot} · ${info.bars} BAR${info.bars > 1 ? 'S' : ''} · ${info.notes} NOTES${info.capped ? ' (CAPPED)' : ''} · C1 TO D#2` : 'NOTHING TO DRAG') : 'WAITING FOR THE PLUGIN…'}
        </div>
      </div>
      <Note x={62} y={418} style={{ color: status ? (status.ok ? 'var(--acc)' : 'var(--red)') : undefined }}>
        {status ? status.msg.toUpperCase() : 'A CLICK SAVES THE .MID IN MUSIC / MM-RYTM MIDI'}
      </Note>
      <Key x={500} y={410} w={100} h={22} r={8} inner="SAVE .MID" onTap={() => pluginMidi.save?.()} title="Save the .mid in Music / MM-RYTM MIDI and show it in the Finder" />
    </>
  );
};

/** Les pas de la pattern, en petit, dans la poignee. */
const ClipView: React.FC = () => {
  useTick();
  return <PatternDots x={120} y={40} cw={34} rh={13} />;
};

const PatternDots: React.FC<{ x: number; y: number; cw: number; rh: number }> = ({ x, y, cw, rh }) => {
  const p = pattern.get();
  const out: React.ReactNode[] = [];
  TRACK_KEYS.forEach((k, r) => {
    for (let c = 0; c < 16; c += 1)
      if (velocity(p.steps, k, c) > 0) out.push(<i key={`${k}${c}`} style={{ position: 'absolute', left: x + c * cw, top: y + r * rh, width: cw - 6, height: rh - 5, borderRadius: 2, background: r === 0 ? '#ffd900' : 'rgba(255,255,255,.75)' }} />);
  });
  return <>{out}</>;
};

/** NEW et CLEAR, confirmes d'un second clic (Cmd+Z les annule aussi). */
const Confirm: React.FC<{ x: number; y: number; word: string; title: string; run: () => void }> = ({ x, y, word, title, run }) => {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const id = window.setTimeout(() => setArmed(false), 2500);
    return () => window.clearTimeout(id);
  }, [armed]);
  return (
    <Key
      x={x}
      y={y}
      w={100}
      h={22}
      r={8}
      inner={armed ? 'SURE ?' : word}
      lit={armed ? 'red' : null}
      title={title}
      onTap={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        run();
      }}
    />
  );
};

const Levels: React.FC = () => {
  const bars = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    let raf = 0;
    const loop = (): void => {
      if (meters.seen()) {
        const m = meters.view();
        const v = [...m.t, m.l, m.r];
        v.forEach((x, i) => {
          const el = bars.current[i];
          if (el) el.style.height = `${Math.round(x * 230)}px`;
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const names = [...TRACK_NAMES, 'L', 'R'];
  return (
    <Lcd x={62} y={496} w={680} h={290}>
      {names.map((n, i) => {
        const x = 14 + i * 36 + (i > 15 ? 10 : 0);
        return (
          <React.Fragment key={i}>
            <div style={{ left: x, bottom: 26, width: 24, height: 230, background: 'rgba(255,255,255,.04)' }} />
            <div
              ref={(el) => {
                bars.current[i] = el;
              }}
              style={{ left: x, bottom: 26, width: 24, height: 0, background: 'linear-gradient(0deg,#6a6a6a,#e8e8e8 70%,#ffd900 92%)', backgroundSize: '100% 230px', backgroundPosition: 'bottom' }}
            />
            <div className="mm3-t8" style={{ left: x - 4, width: 32, textAlign: 'center', bottom: 8, fontSize: 6.5 }}>
              {n}
            </div>
          </React.Fragment>
        );
      })}
    </Lcd>
  );
};

export const MidiPage: React.FC = () => {
  const cur = useSyncExternalStore(patterns.subscribe, () => patterns.get().cur);
  return (
    <>
      <Title x={52} y={70} w={700} t="DRAG MIDI" small="THE PLAYING PATTERN AS A CLIP" />
      <DragMidi />
      <Title x={780} y={70} w={568} t="PATTERN" small={slotName(cur)} />
      <Note x={800} y={108} style={{ whiteSpace: 'normal', width: 520, lineHeight: 1.7, color: '#bdbdbd' }}>
        <b>NEW</b> : AN EMPTY PATTERN, THE SOUNDS AT THEIR START. <b>CLEAR</b> : THE STEPS GO, THE SOUNDS STAY. CMD+Z BRINGS IT BACK.
      </Note>
      <Confirm x={800} y={160} word="NEW…" title="An empty pattern (Cmd+Z: back)" run={pluginNew} />
      <Confirm x={920} y={160} word="CLEAR…" title="The steps go, the sounds stay (Cmd+Z: back)" run={pluginClear} />
      <Title x={780} y={230} w={568} t="ABLETON" small="MIDI MAP (CMD+M)" />
      <Note x={800} y={262} style={{ whiteSpace: 'normal', width: 520, lineHeight: 1.8, color: '#bdbdbd' }}>
        THE PARAMETERS OF THE PLUGIN : <b>MASTER</b> · <b>CROSSFADER</b> · <b>FILTER</b> · <b>SIDECHAIN</b> · <b>HELL MIX</b>. MAP THEM TO YOUR CONTROLLER, AUTOMATE THEM. A PROGRAM CHANGE PICKS A01 TO H16 ; THE STEPS PLAY ON THE TEMPO OF ABLETON.
      </Note>
      <Title x={52} y={470} w={700} t="LEVELS" small="THE ENGINE, LIVE" />
      <Levels />
    </>
  );
};
