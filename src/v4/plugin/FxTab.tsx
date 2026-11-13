/**
 * OPEN, onglet FX (2026-11-13, le plugin) : HELL (le decaleur de frequence dans un echo) et la DIST facon Decapitator, leurs
 * reglages fins et leurs presets. Mika : "une 2e page dans OPEN pour afficher des parametres de FX type Echobode, pour avoir
 * des choses vraiment pointues" ; "tu peux appeler cet effet Hell" ; "pour la disto, des sous-parametres a la Decapitator".
 *
 * Les reglages sont des effets du pattern (audio/pattern.ts LAB_FX, DIST, TONE de DIST) : ils partent au moteur par le
 * programme, voyagent avec le pattern et les presets, Cmd+Z les annule. Chaque piste envoie dans HELL depuis sa page FX
 * (HELL, a cote de REVERB). Les dessins : la spirale des echos de HELL (chaque repetition plus haute ou plus basse, plus
 * faible) et la courbe de la DIST (ce qu'elle fait d'un signal, a son STYLE, son DRIVE, PUNISH, MIX et OUTPUT).
 */

import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { pattern, type Fx } from '../audio/pattern';
import { KnobView, type KnobSpec } from '../ui/KnobPanel';
import { lcdMessage } from '../state/lcdMessage';
import { undo } from '../state/undo';
import {
  DIST_DRIVE,
  DIST_PRESETS,
  DIST_STYLES,
  DIST_STYLE_TEXT,
  DIST_TONE,
  HELL_ECHO,
  HELL_LFO,
  HELL_OUT,
  HELL_PRESETS,
  HELL_SHIFT,
  distCurve,
  hellSeconds,
  hellShiftHz,
  notch,
  presetPatch,
  type LabKnob,
  type LabPreset,
} from '../state/labFx';

const INK = '#F4F1EA';
const RED = '#F0463C';
const AMBER = '#FF8A1F';

const subscribeFx = (fn: () => void): (() => void) => {
  const a = pattern.fx.subscribe(fn);
  const b = pattern.subscribe(fn);
  return () => {
    a();
    b();
  };
};
const useFx = (): Readonly<Fx> => useSyncExternalStore(subscribeFx, () => pattern.fx.get());
const bpmNow = (): number => pattern.get().bpm;

/** Un potard de l'onglet, sur un effet du pattern. */
const LabKnobView: React.FC<{ k: LabKnob }> = ({ k }) => {
  const spec = useMemo<KnobSpec>(
    () => ({
      label: k.label,
      get: () => pattern.fx.get()[k.id],
      set: (v) => pattern.fx.set({ [k.id]: k.steps > 1 ? Math.round(v * (k.steps - 1)) / (k.steps - 1) : Math.round(v * 1000) / 1000 }),
      reset: () => {
        const d = k.id === 'drive' ? 0 : k.id === 'xtone' ? 1 : (presetPatch({ name: '', tip: '', set: {} }, k.id.startsWith('h') ? 'hell' : 'dist')[k.id] ?? 0);
        pattern.fx.set({ [k.id]: d });
        return d;
      },
      range: [0, 1],
      steps: k.steps,
      bipolar: k.id === 'xtilt' || k.id === 'xout' || k.id === 'hfreq',
      readout: () => k.read(pattern.fx.get(), bpmNow()),
      valueText: () => k.read(pattern.fx.get(), bpmNow()),
      unit: () => k.unit(pattern.fx.get(), bpmNow()),
      nudge: (n) => {
        const step = k.steps > 1 ? 1 / (k.steps - 1) : 1 / 127;
        pattern.fx.set({ [k.id]: Math.max(0, Math.min(1, pattern.fx.get()[k.id] + n * step)) });
      },
      subscribe: subscribeFx,
    }),
    [k]
  );
  return (
    <div title={k.tip} className="mm-fx-knob">
      <KnobView spec={spec} compact relief />
    </div>
  );
};

const Group: React.FC<{ title: string; knobs: readonly LabKnob[] }> = ({ title, knobs }) => (
  <div className="mm-fx-group">
    <h4>{title}</h4>
    <div className="mm-open-knobs">
      {knobs.map((k) => (
        <LabKnobView key={k.id} k={k} />
      ))}
    </div>
  </div>
);

/** La rangee des presets : un clic pose tous les reglages de la sous-page (une etape d'UNDO). */
const Presets: React.FC<{ list: readonly LabPreset[]; which: 'hell' | 'dist'; fx: Readonly<Fx> }> = ({ list, which, fx }) => {
  const on = list.find((p) => {
    const patch = presetPatch(p, which);
    return Object.entries(patch).every(([k, v]) => Math.abs((fx[k as keyof Fx] as number) - (v as number)) < 0.002);
  });
  return (
    <div className="mm-fx-presets" role="group" aria-label={`${which === 'hell' ? 'HELL' : 'DIST'} presets`}>
      {list.map((p) => (
        <button
          key={p.name}
          type="button"
          aria-pressed={on === p}
          title={p.tip}
          onClick={() => {
            undo.boundary('mm808', 'step');
            pattern.fx.set(presetPatch(p, which));
            lcdMessage.show(`${which === 'hell' ? 'HELL' : 'DIST'} ${p.name}`, 1600);
          }}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
};

/** La spirale de HELL : une note de 1 kHz et ses echos, chacun decale et plus faible (log en frequence, temps en echos). */
const Spiral: React.FC<{ fx: Readonly<Fx> }> = ({ fx }) => {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const bpm = bpmNow();
    const shift = hellShiftHz(fx, bpm);
    const sync = notch(fx.hrange, 3) === 2;
    const t = hellSeconds(fx, bpm);
    const fb = 0.98 * fx.hfb;
    const n = 12;
    const yOf = (f: number): number => h - 6 - ((Math.log10(Math.max(20, Math.min(20000, f))) - Math.log10(20)) / 3) * (h - 12);
    // La grille : 100 Hz, 1 kHz, 10 kHz
    g.strokeStyle = 'rgba(244,241,234,0.1)';
    g.fillStyle = 'rgba(244,241,234,0.35)';
    g.font = `${Math.round(h * 0.075)}px ui-monospace, monospace`;
    for (const f of [100, 1000, 10000]) {
      const y = yOf(f);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
      g.fillText(f >= 1000 ? `${f / 1000}K` : `${f}`, 4, y - 3);
    }
    const bands: { side: number; sign: number }[] = [];
    if (fx.hside > 0.01) bands.push({ side: fx.hside, sign: 1 });
    if (fx.hside < 0.99) bands.push({ side: 1 - fx.hside, sign: -1 });
    const step = (w - 40) / n;
    for (let k = 0; k <= n; k += 1) {
      const a = k === 0 ? 1 : Math.pow(Math.max(fb, 0.0001), k - 1) * Math.min(1, fx.hmix * 1.2);
      if (a < 0.01) break;
      for (const b of bands) {
        // En SYNC le decalage est une rotation de phase (un tremolo) : la note reste, elle pulse
        const f = sync ? 1000 : 1000 + b.sign * shift * k;
        const x = 30 + k * step;
        const y = yOf(Math.abs(f));
        g.fillStyle = k === 0 ? INK : f < 0 ? RED : AMBER;
        g.globalAlpha = Math.max(0.12, Math.min(1, a * b.side * (k === 0 ? 1 : 1.3)));
        g.beginPath();
        g.arc(x, y, Math.max(2.5, 7 * Math.sqrt(a)), 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
    }
    g.fillStyle = 'rgba(244,241,234,0.55)';
    g.textAlign = 'right';
    g.fillText(`ECHO EVERY ${t >= 0.01 ? Math.round(t * 1000) + ' MS' : (t * 1000).toFixed(2) + ' MS'}`, w - 6, h - 8);
    g.textAlign = 'left';
  }, [fx]);
  return <canvas ref={cv} className="mm-fx-canvas" aria-label="HELL: a 1 kHz note and its echoes, each shifted and fainter" />;
};

/** La courbe de la DIST : l'entree en x, la sortie en y (la diagonale : rien ne change). */
const Curve: React.FC<{ fx: Readonly<Fx> }> = ({ fx }) => {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const s = Math.min(w, h) / 2 - 6;
    g.strokeStyle = 'rgba(244,241,234,0.12)';
    g.beginPath();
    g.moveTo(cx - s, cy);
    g.lineTo(cx + s, cy);
    g.moveTo(cx, cy - s);
    g.lineTo(cx, cy + s);
    g.stroke();
    g.setLineDash([3, 4]);
    g.beginPath();
    g.moveTo(cx - s, cy + s);
    g.lineTo(cx + s, cy - s);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = fx.drive > 0 ? RED : 'rgba(244,241,234,0.4)';
    g.lineWidth = 2.2;
    g.beginPath();
    for (let i = 0; i <= 160; i += 1) {
      const x = -1 + (2 * i) / 160;
      const y = Math.max(-1.25, Math.min(1.25, distCurve(fx, x)));
      const px = cx + x * s;
      const py = cy - y * s;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
    g.fillStyle = 'rgba(244,241,234,0.55)';
    g.font = `${Math.round(h * 0.08)}px ui-monospace, monospace`;
    g.fillText(DIST_STYLES[notch(fx.xstyle, 6)], 6, 14);
  }, [fx]);
  return <canvas ref={cv} className="mm-fx-canvas mm-fx-curve" aria-label="DIST: the curve, input across, output up" />;
};

export const FxTab: React.FC = () => {
  const fx = useFx();
  return (
    <div className="mm-fx">
      <section className="mm-open-card mm-fx-hell">
        <div className="mm-fx-head">
          <h3>HELL · FREQUENCY SHIFTER ECHO</h3>
          <span className="mm-fx-note">each track sends into it with HELL on its FX page</span>
        </div>
        <Presets list={HELL_PRESETS} which="hell" fx={fx} />
        <div className="mm-fx-row">
          <Spiral fx={fx} />
          <Group title="SHIFT" knobs={HELL_SHIFT} />
        </div>
        <div className="mm-fx-row">
          <Group title="ECHO" knobs={HELL_ECHO} />
        </div>
        <div className="mm-fx-row">
          <Group title="LFO" knobs={HELL_LFO} />
          <Group title="OUT" knobs={HELL_OUT} />
        </div>
      </section>
      <section className="mm-open-card mm-fx-dist">
        <div className="mm-fx-head">
          <h3>DIST · SATURATION</h3>
          <span className="mm-fx-note" title={DIST_STYLE_TEXT[DIST_STYLES[notch(fx.xstyle, 6)]]}>
            {DIST_STYLE_TEXT[DIST_STYLES[notch(fx.xstyle, 6)]]}
          </span>
        </div>
        <Presets list={DIST_PRESETS} which="dist" fx={fx} />
        <div className="mm-fx-row">
          <Curve fx={fx} />
          <Group title="DRIVE" knobs={DIST_DRIVE.slice(0, 3)} />
        </div>
        <div className="mm-fx-row">
          <Group title="LEVEL" knobs={DIST_DRIVE.slice(3)} />
        </div>
        <div className="mm-fx-row">
          <Group title="TONE" knobs={DIST_TONE} />
        </div>
      </section>
    </div>
  );
};

/** Les styles de l'onglet (ajoutes a ceux d'OPEN). */
export const FX_TAB_CSS = `
.mm-fx{flex:1;min-height:0;display:grid;grid-template-columns:1.25fr 1fr;gap:.6em;overflow:hidden}
.mm-fx>.mm-open-card{display:flex;flex-direction:column;gap:.45em;min-height:0;overflow:hidden}
.mm-fx-head{display:flex;align-items:baseline;gap:1em;min-width:0}
.mm-fx-head h3{margin:0;white-space:nowrap}
.mm-fx-note{font-size:.82em;letter-spacing:.06em;color:rgba(244,241,234,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mm-fx-presets{display:flex;flex-wrap:wrap;gap:.3em}
.mm-fx-presets button{background:rgba(244,241,234,.06);border:1px solid rgba(244,241,234,.2);border-radius:.45em;padding:.32em .6em;font-size:.86em;font-weight:700;letter-spacing:.08em;color:${INK};white-space:nowrap;cursor:pointer}
.mm-fx-presets button:hover{border-color:rgba(244,241,234,.45)}
.mm-fx-presets button[aria-pressed='true']{background:${RED};border-color:${RED};color:#0b0b0c}
.mm-fx-row{display:flex;gap:.5em;min-height:0;align-items:stretch}
.mm-fx-group{flex:1;min-width:0;border-top:1px solid rgba(244,241,234,.08);padding-top:.25em}
.mm-fx-group h4{margin:0 0 .1em;font-size:.78em;font-weight:800;letter-spacing:.16em;color:rgba(255,138,31,.85)}
.mm-fx-knob{flex:1;min-width:0;display:flex}
.mm-fx-knob .v4-knob{flex:1}
.mm-fx .mm-open-knobs .v4-knob-dial{width:4.3em;height:4.3em}
.mm-fx-canvas{flex:0 0 38%;min-width:0;height:auto;min-height:6.5em;border:1px solid rgba(244,241,234,.12);border-radius:.5em;background:#050506}
.mm-fx-curve{flex:0 0 30%}
`;
