/**
 * La face v3 du plugin (2026-11-25) : l'ecran du milieu. En haut le pattern (A01), le preset charge, le tempo et le swing ;
 * a gauche la piste choisie en grand, son sample et sa forme d'onde ; a droite les 16 pistes et leurs 16 pas (la tete de
 * lecture de chaque piste, sa longueur comprise) ; en bas ce que la machine dit (lcdMessage), sinon les gestes des pas.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { trackStepNow } from '../../actions/trackSpan';
import { pattern, velocity } from '../../audio/pattern';
import { samplesOf } from '../../audio/samples';
import { TRACK_KEYS, TRACK_NAMES, tracks, typedFamily } from '../../audio/tracks';
import { lcdMessage } from '../../state/lcdMessage';
import { patterns, slotName } from '../../state/patterns';
import { presets } from '../../state/presets';
import { rytmLock } from '../../state/rytmLock';
import { extHead } from '../head';
import { smpLabel } from '../OpenPanel';
import { C, MiniWave, useTrack } from './parts';
import { isMuted } from './Steps';
import { shown } from './ctl';
import { Lcd, useTick } from './ui';
import { view } from './view';

/** Un rendu par nouvelle position du moteur (et a l'arret). */
function useHeadSeq(): number {
  const [s, setS] = useState(-1);
  useEffect(() => {
    let raf = 0;
    let last = -2;
    const loop = (): void => {
      const h = extHead.get();
      const n = h ? h.seq : -1;
      if (n !== last) {
        last = n;
        setS(n);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return s;
}

/** Le message de la machine, tant qu'il dure. */
function useMessage(): string | null {
  const [, bump] = useState(0);
  useSyncExternalStore(lcdMessage.subscribe, () => lcdMessage.get()?.text ?? '');
  const m = lcdMessage.get();
  useEffect(() => {
    if (!m) return undefined;
    const id = window.setTimeout(() => bump((n) => n + 1), Math.max(30, m.until - performance.now() + 20));
    return () => window.clearTimeout(id);
  }, [m]);
  return m ? m.text : null;
}

/** Le preset charge (son nom ; * : modifie), relu au plus toutes les 400 ms (sa signature coute). */
function usePresetName(): string {
  const t = useTick();
  const cache = useRef<{ at: number; name: string }>({ at: -1e9, name: '' });
  const now = performance.now();
  if (now - cache.current.at > 400) {
    const l = presets.loaded('mm808');
    cache.current = { at: now, name: l ? `${l.label}${l.edited ? ' *' : ''}` : 'INIT' };
  }
  void t;
  return cache.current.name;
}

export const Screen: React.FC = () => {
  useTick();
  useHeadSeq();
  const t = useTrack();
  const cur = useSyncExternalStore(patterns.subscribe, () => patterns.get().cur);
  const msg = useMessage();
  const preset = usePresetName();
  const p = pattern.get();
  const i = TRACK_KEYS.indexOf(t);
  const fam = typedFamily(i);
  const skey = tracks.of(t).snd;
  const smp = samplesOf(fam).find((s) => s.key === skey);
  const lk = rytmLock.get();
  const gx = 262;
  const gy = 40;
  const cw = 16;
  const rh = 8.6;
  const cells: React.ReactNode[] = [];
  TRACK_KEYS.forEach((k, r) => {
    const h = trackStepNow(k);
    const hc = h >= 0 ? h % 16 : -1;
    const dim = isMuted(k);
    cells.push(
      <div key={`n${k}`} className="mm3-t8" style={{ left: gx - 30, top: gy + r * rh - 1, fontSize: 6.5, letterSpacing: '.06em', color: k === t ? '#ffd900' : '#777' }}>
        {TRACK_NAMES[r]}
      </div>
    );
    for (let c = 0; c < 16; c += 1) {
      const on = velocity(p.steps, k, c) > 0;
      const ph = c === hc;
      const bg = on ? (dim ? 'rgba(255,255,255,.22)' : k === t ? '#ffd900' : '#e9e9e9') : ph ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.06)';
      cells.push(<i key={`${k}${c}`} style={{ left: gx + c * cw, top: gy + r * rh, width: cw - 4, height: rh - 3, borderRadius: 1, background: bg, boxShadow: on && ph && !dim ? '0 0 6px rgba(255,255,255,.8)' : undefined }} />);
    }
  });
  const hHead = trackStepNow(t);
  if (hHead >= 0) cells.push(<div key="col" style={{ left: gx + (hHead % 16) * cw - 2, top: gy - 4, width: cw, height: 16 * rh + 4, border: '1px solid rgba(255,217,0,.55)', borderRadius: 2 }} />);
  return (
    <>
      <Lcd x={418} y={350} w={548} h={206} className="mm3-screen">
        <div style={{ left: 14, top: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="mm3-chip fill" onPointerDown={() => view.open('LIBRARY')} title="The presets (LIBRARY)">
            {slotName(cur)}
          </span>
          <span className="mm3-t8 mm3-w" style={{ letterSpacing: '.18em', maxWidth: 250, overflow: 'hidden' }}>
            {preset}
          </span>
          {lk.step >= 0 && <span className="mm3-t8 mm3-a">P-LOCK · STEP {lk.step + 1}</span>}
        </div>
        <div style={{ right: 14, top: 6, display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span className="mm3-dots mm3-w" style={{ fontSize: 22 }}>
            {p.bpm.toFixed(p.bpm % 1 ? 1 : 0)}
          </span>
          <span className="mm3-t8">BPM</span>
          <span className="mm3-t8" style={{ marginLeft: 8 }}>
            SW <span className="mm3-w">{shown(C.swing)}</span>
          </span>
        </div>
        <div style={{ left: 14, top: 38 }}>
          <div className="mm3-t8">TRACK {String(i + 1).padStart(2, '0')}</div>
          <div className="mm3-dots mm3-a" style={{ fontSize: TRACK_NAMES[i].length > 3 ? 34 : 44, marginTop: 2 }}>
            {TRACK_NAMES[i]}
          </div>
        </div>
        <div className="mm3-t8" style={{ left: 118, top: 44, lineHeight: 1.7 }}>
          <span className="mm3-w" style={{ display: 'inline-block', maxWidth: 120, overflow: 'hidden', verticalAlign: 'bottom' }}>
            {smp ? smpLabel(smp) : 'NO SAMPLE'}
          </span>
          <br />
          TUNE <span className="mm3-w">{shown(C.tune)}</span>
          <br />
          DEC <span className="mm3-w">{shown(C.dec)}</span> · FREQ <span className="mm3-w">{shown(C.fcut)}</span>
        </div>
        <div style={{ left: 14, top: 100 }}>
          <MiniWave skey={skey} w={196} h={58} color="#e8e8e8" />
        </div>
        {cells}
        <div className="mm3-t8" style={{ left: 14, bottom: 10, maxWidth: 380, overflow: 'hidden', color: msg ? '#ffd900' : undefined }}>
          {msg ?? (
            <>
              TAP A STEP · <span className="mm3-a">HOLD</span> : P-LOCK · <span className="mm3-a">RIGHT CLICK</span> : CONDITIONS
            </>
          )}
        </div>
        <div style={{ right: 14, bottom: 7, display: 'flex', gap: 6 }}>
          <span className="mm3-chip a" onPointerDown={() => view.open('LIBRARY')}>
            PRESETS
          </span>
        </div>
      </Lcd>
    </>
  );
};
