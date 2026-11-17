/**
 * La page DISTO du capot (2026-11-16, Mika : "quand on clic sur le knob DISTO on tombe sur une page de configuration pour
 * la disto avec tous les parametres AINSI QUE la qualite de Soundtoys Decapitator mais au design de MM-ARP" ; portee le
 * 2026-11-17 de la branche claude/admiring-feynman-5zsgxp, refaite au design d'OPEN : cuir, potards du MM-RYTM, petits
 * knobs, leviers, rotatif a crans). Le DSP : plugin/mm-arp/dsp/Decap.{h,cpp}.
 * - STYLE : MM (l'OVERDRIVE du moteur, le son d'avant : le depart et toute la banque d'usine), A, E, N, T, P ;
 * - DRIVE : le potard DISTO de la face (dist), le meme reglage ; PUNISH (+20 dB) ;
 * - LOW CUT et THUMP, TONE, HIGH CUT et STEEP ; MIX, OUTPUT, AUTO ;
 * - l'ecran de verre noir : la courbe de transfert du style au DRIVE du moment, la reponse des filtres, la lecture ;
 * - PEDAL : l'ancienne DISTORTION de SOUND (xDist, xDistTone), gardee telle quelle (apres CRUSH, dans ArpFx) : les projets
 *   d'avant sonnent comme avant.
 */

import React, { useSyncExternalStore } from 'react';
import { voyParams } from '../../voyager/params';
import { arpExtra } from './extra';
import { PcbFrame, PcbKnob, PcbRotary, PcbToggle } from './pcbui';

const useExtraAll = () => useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);
const ZONE = { x: 44, w: 1012 };

/* ---------------- l'ecran : la courbe du style, la reponse des filtres (le miroir de dsp/Decap.cpp) ---------------- */

const DC_BIAS = [0.22, 0.2, 0.04, 0.08, 0, 0.12];
const DC_KNEE = [0, 0, 0.55, 0, 0, 0.85];
export const DISTO_NAMES = ['MM OVERDRIVE', 'TUBE PREAMP', 'TRANSISTOR', 'TRANSFORMER', 'TRIODE', 'PENTODE'];
function dcRaw(s: number, u: number): number {
  if (s === 2 || s === 5) {
    const a = DC_KNEE[s];
    const v = Math.abs(u);
    if (v <= a) return u;
    if (v >= 2 - a) return Math.sign(u);
    const d = v - a;
    return Math.sign(u) * (v - (d * d) / (4 * (1 - a)));
  }
  if (s === 3) return u > 1.5 ? 1 : u < -1.5 ? -1 : u - (4 / 27) * u * u * u;
  if (s === 4) return u >= 0 ? Math.tanh(0.7 * u) / 0.7 : Math.tanh(1.5 * u) / 1.5;
  return Math.tanh(u);
}
const dcCurve = (s: number, x: number): number => {
  const b = DC_BIAS[s];
  const sl = (dcRaw(s, b + 1e-4) - dcRaw(s, b - 1e-4)) / 2e-4;
  return (dcRaw(s, x + b) - dcRaw(s, b)) / sl;
};
/** La reponse (dB) de LOW CUT (12 dB/oct, THUMP Q 2), TONE (bascule a 700 Hz) et HIGH CUT (6 ou 30 dB/oct) a f Hz. */
function dcResponse(f: number, low: number, thump: boolean, tilt: number, high: number, steep: boolean): number {
  let db = 0;
  if (low > 0) {
    const r = f / low;
    const q = thump ? 2 : Math.SQRT1_2;
    db += 20 * Math.log10((r * r) / Math.sqrt((1 - r * r) ** 2 + (r / q) ** 2));
  }
  if (Math.abs(tilt) > 0.001) {
    const r = f / 700;
    const lo = Math.pow(10, (-6 * tilt) / 20);
    const hi = Math.pow(10, (6 * tilt) / 20);
    db += 20 * Math.log10(Math.hypot((lo + hi * r * r) / (1 + r * r), ((hi - lo) * r) / (1 + r * r)));
  }
  if (high > 0) {
    const r = f / high;
    db += -10 * Math.log10(1 + r * r * (steep ? r ** 8 : 1));
  }
  return db;
}

const DistoScreen: React.FC<{ x: number; y: number; w: number; h: number }> = ({ x, y, w, h }) => {
  const ex = useExtraAll();
  const v = useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
  const st = Math.round((ex.xDStyle ?? 0) * 5);
  const drive = v.dist;
  const off = drive <= 0;
  const mm = st === 0;
  const punish = (ex.xDPunish ?? 0) >= 0.5;
  const g = 0.5 * (mm ? 1 + 40 * drive * drive : Math.pow(10, (36 * drive + (punish ? 20 : 0)) / 20));
  const peak = Math.max(1e-6, Math.abs(dcCurve(st, g)), Math.abs(dcCurve(st, -g)));
  const PW = 250;
  const PH = h - 30;
  const tr: string[] = [];
  for (let i = 0; i <= 80; i += 1) {
    const u = -1 + (2 * i) / 80;
    const yv = off ? u : dcCurve(st, g * u) / peak;
    tr.push(`${(PW / 2 + u * (PW / 2 - 10)).toFixed(1)},${(PH / 2 - yv * (PH / 2 - 10)).toFixed(1)}`);
  }
  const low = (ex.xDLow ?? 0) < 0.02 ? 0 : 20 * Math.pow(50, ((ex.xDLow ?? 0) - 0.02) / 0.98);
  const high = (ex.xDHigh ?? 1) > 0.98 ? 0 : 1000 * Math.pow(20, (ex.xDHigh ?? 1) / 0.98);
  const eq: string[] = [];
  for (let i = 0; i <= 100; i += 1) {
    const f = 20 * Math.pow(1000, i / 100);
    const db = off || mm ? 0 : dcResponse(f, low, (ex.xDThump ?? 0) >= 0.5, ((ex.xDTone ?? 0.5) - 0.5) * 2, high, (ex.xDSteep ?? 0) >= 0.5);
    eq.push(`${(10 + (i / 100) * (PW - 20)).toFixed(1)},${(10 + ((12 - Math.max(-24, Math.min(12, db))) / 36) * (PH - 20)).toFixed(1)}`);
  }
  const read: [string, string][] = [
    ['STYLE', `${['MM', 'A', 'E', 'N', 'T', 'P'][st]} · ${DISTO_NAMES[st]}`],
    ['DRIVE', off ? 'OFF' : `${Math.round(drive * 100)} %${punish && !mm ? ' + PUNISH' : ''}`],
    ['LEVEL', mm ? 'ENGINE OVERDRIVE' : (ex.xDAuto ?? 1) >= 0.5 ? 'AUTO' : 'MANUAL'],
  ];
  return (
    <div className="mm-disto-screen" style={{ left: x, top: y, width: w, height: h }} aria-hidden="true">
      <svg className="mm-disto-plot" width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`}>
        <path className="grid" d={`M${PW / 2} 4V${PH - 4}M4 ${PH / 2}H${PW - 4}`} />
        <path className="lin" d={`M10 ${PH - 10}L${PW - 10} 10`} />
        <polyline className={off ? 'main off' : 'main'} points={tr.join(' ')} />
        <text x="10" y="16">
          TRANSFER
        </text>
      </svg>
      <div className="mm-disto-read">
        {read.map(([k, val]) => (
          <React.Fragment key={k}>
            <span className="k">{k}</span>
            <span className="v">{val}</span>
          </React.Fragment>
        ))}
      </div>
      <svg className="mm-disto-plot" width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`}>
        {[100, 1000, 10000].map((f) => {
          const gx = 10 + (Math.log10(f / 20) / 3) * (PW - 20);
          return <path key={f} className="grid" d={`M${gx.toFixed(1)} 4V${PH - 4}`} />;
        })}
        <path className="grid" d={`M4 ${(10 + (12 / 36) * (PH - 20)).toFixed(1)}H${PW - 4}`} />
        <polyline className={off || mm ? 'main off' : 'main'} points={eq.join(' ')} />
        <text x="10" y="16">
          FILTERS
        </text>
        <text x={PW - 10} y={PH - 6} textAnchor="end">
          20 HZ - 20 KHZ
        </text>
      </svg>
    </div>
  );
};

/* ---------------- la page ---------------- */

const Row: React.FC<{ top: number; w: number; children: React.ReactNode }> = ({ top, w, children }) => (
  <div className="mm-p2-cells mm-hell-row" style={{ top, width: w }}>
    {children}
  </div>
);

type F = { title: string; w: number; led?: boolean; flash?: string; body: React.ReactNode };

/** Une rangee de cadres centree dans la zone. */
const FrameLine: React.FC<{ y: number; h: number; frames: F[]; flash: (t: string) => boolean }> = ({ y, h, frames, flash }) => {
  const GAP = 22;
  const total = frames.reduce((s, f) => s + f.w, 0) + GAP * (frames.length - 1);
  let x = ZONE.x + Math.round((ZONE.w - total) / 2);
  return (
    <>
      {frames.map((f, i) => {
        const fx = x;
        x += f.w + GAP;
        return (
          <PcbFrame key={f.title} title={f.title} x={fx} y={y} w={f.w} h={h} led={f.led} flash={flash(f.flash ?? f.title)} sep={i < frames.length - 1}>
            <Row top={16} w={f.w}>
              {f.body}
            </Row>
          </PcbFrame>
        );
      })}
    </>
  );
};

export const DistoPage: React.FC<{ flash: (title: string) => boolean }> = ({ flash }) => {
  const ex = useExtraAll();
  const v = useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
  const mm = Math.round((ex.xDStyle ?? 0) * 5) === 0;
  return (
    <>
      <FrameLine
        y={62}
        h={124}
        flash={flash}
        frames={[
          { title: 'STYLE', w: 160, body: <PcbRotary id="xDStyle" name="STYLE" ref_="" w={150} /> },
          {
            title: 'DRIVE',
            w: 214,
            led: v.dist > 0,
            body: (
              <>
                <PcbKnob id="dist" name="DRIVE" ref_="" lo="OFF" hi={mm ? 'ENGINE' : '+36 DB'} big />
                <PcbToggle id="xDPunish" name="PUNISH" ref_="" />
              </>
            ),
          },
          {
            title: 'OUTPUT',
            w: 240,
            body: (
              <>
                <PcbKnob id="xDMix" name="MIX" ref_="" lo="" hi="" fine />
                <PcbKnob id="xDOut" name="OUTPUT" ref_="" lo="-18" hi="+18" />
                <PcbToggle id="xDAuto" name="AUTO" ref_="" />
              </>
            ),
          },
        ]}
      />
      <FrameLine
        y={204}
        h={112}
        flash={flash}
        frames={[
          {
            title: 'LOW CUT',
            w: 184,
            body: (
              <>
                <PcbKnob id="xDLow" name="LOW CUT" ref_="" lo="OFF" hi="1 KHZ" />
                <PcbToggle id="xDThump" name="THUMP" ref_="" />
              </>
            ),
          },
          { title: 'TONE', w: 100, body: <PcbKnob id="xDTone" name="TONE" ref_="" lo="DARK" hi="BRIGHT" /> },
          {
            title: 'HIGH CUT',
            w: 184,
            body: (
              <>
                <PcbKnob id="xDHigh" name="HIGH CUT" ref_="" lo="1 KHZ" hi="OFF" />
                <PcbToggle id="xDSteep" name="STEEP" ref_="" />
              </>
            ),
          },
          {
            title: 'PEDAL',
            w: 156,
            led: (ex.xDist ?? 0) > 0,
            flash: 'DISTORTION',
            body: (
              <>
                <PcbKnob id="xDist" name="AMOUNT" ref_="" lo="OFF" hi="FULL" />
                <PcbKnob id="xDistTone" name="TONE" ref_="" lo="" hi="" fine />
              </>
            ),
          },
        ]}
      />
      <DistoScreen x={ZONE.x + Math.round((ZONE.w - 820) / 2)} y={340} w={820} h={190} />
      <p className="mm-disto-flow" style={{ top: 548 }}>
        ENGINE → LOW CUT → TONE → <b>SATURATION</b> (STYLE · DRIVE, x8) → HIGH CUT → MIX · OUTPUT → CRUSH → PEDAL → PHASER → …
      </p>
    </>
  );
};
