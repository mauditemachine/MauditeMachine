/**
 * OPEN dans le plugin (2026-11-09). Mika, apres le premier OPEN (les reglages de toutes les pages) : "le bouton OPEN c'est
 * vraiment pas ce que je souhaitais, je voulais tous les parametres super intenses en sampling ou alors les settings".
 *
 * Un panneau par-dessus la face, que OPEN (la touche, le clavier) ouvre et ferme, comme CLOSE et Echap :
 * - SAMPLE : l'editeur du sample de la piste choisie. Sa forme d'onde en grand (la molette zoome, un glisser deplace la vue,
 *   un double clic la remet entiere) ; START et END se tirent a la souris (Maj : au dixieme) ; ce qui ne joue pas en retrait,
 *   le fondu de la fin, l'enveloppe AMP (ATK, HOLD, DEC) par-dessus, a son echelle de temps ; les reglages du sample (START,
 *   LEN, TUNE, FINE, LEV, REVERSE), de l'enveloppe (ATK, HOLD, DEC, PAN) et du filtre (FREQ, RESO, TYPE) ; le sample d'avant
 *   ou d'apres, IMPORT, le dossier, ECOUTER (le moteur joue la piste une fois) ;
 * - SETTINGS : le pattern (STEPS, BPM, SWING, MASTER), PERSONALIZE (TRK SELECT, les LED, la sous-page), le dossier des
 *   samples, la souris et le clavier, la version.
 * Tout passe par les memes reglages que la face (actions anyDial, le store des pistes) : le moteur les recoit par le programme.
 */

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { anyDial, anyDialReset, dialEdit, dialNudge, dialRange, dialReadout, dialShown, dialSteps, dialUnit, dialValueText, fileImport, subscribeDials, trackSelect, type DialId } from '../actions';
import { trigger } from '../audio/drums';
import { SAMPLE_START_MAX, sampleLenFadeS, sampleLenPart } from '../audio/sampledsp';
import { requestSample, samplePcm, samplesChanged, samplesOf, onSampleStatus, type KitSample } from '../audio/samples';
import { TRACK_KEYS, TRACK_NAMES, tracks, typedFamily, type TrackKey } from '../audio/tracks';
import { decayTau } from '../audio/voicelaw';
import { resolveHit } from '../audio/drums';
import { fwVersion } from '../firmware';
import { pageSlots, type PageSlot, type RytmScreenId } from '../rytm/pages';
import { lcdMessage } from '../state/lcdMessage';
import { LEDS, TRKS, personalize } from '../state/personal';
import { pluginPanel } from '../state/pluginPanel';
import { activeTrack } from '../state/trk';
import { pattern } from '../audio/pattern';
import { FONT_DISPLAY } from '../theme';
import { KnobView, type KnobSpec } from '../ui/KnobPanel';

type Tab = 'sample' | 'settings';
const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'sample', label: 'SAMPLE' },
  { id: 'settings', label: 'SETTINGS' },
];

/** Tout ce qui change ce que le panneau montre : les reglages, le store des 16 pistes, la piste active, les samples. */
function subscribeAll(fn: () => void): () => void {
  const offs = [subscribeDials(fn), tracks.subscribe(() => fn()), activeTrack.subscribe(fn), samplesChanged.subscribe(fn), onSampleStatus(() => fn()), personalize.subscribe(fn)];
  return () => offs.forEach((off) => off());
}
let rev = 0;
const subscribeRev = (fn: () => void): (() => void) =>
  subscribeAll(() => {
    rev += 1;
    fn();
  });
const useRev = (): number => useSyncExternalStore(subscribeRev, () => rev);

/** Un potard du panneau, sur un reglage de la face (sa cible). */
const DialKnob: React.FC<{ id: DialId; label: string }> = ({ id, label }) => {
  const spec = useMemo<KnobSpec>(() => {
    const range = dialRange(id);
    return {
      label,
      get: () => dialEdit(id),
      set: (v) => anyDial(id, v),
      reset: () => anyDialReset(id),
      range,
      steps: dialSteps(id),
      bipolar: range[0] < 0,
      readout: () => dialReadout(id),
      valueText: () => dialValueText(id),
      unit: () => dialUnit(id),
      nudge: (n) => dialNudge(id, n),
      subscribe: subscribeAll,
    };
  }, [id, label]);
  return <KnobView spec={spec} compact />;
};

/** Les reglages vivants d'ecrans de la face, par leur nom (dans l'ordre demande). */
function slotsByLabel(screens: readonly RytmScreenId[], labels: readonly string[]): PageSlot[] {
  const inst = pattern.get().instrument;
  const all = screens.flatMap((sc) => pageSlots(sc, inst));
  return labels.map((l) => all.find((s) => s.label === l && s.target)).filter((s): s is PageSlot => !!s && dialValueText(s.target as DialId) !== '--');
}

const KnobGroup: React.FC<{ title: string; slots: readonly PageSlot[]; k: string }> = ({ title, slots, k }) =>
  slots.length === 0 ? null : (
    <section className="mm-open-card">
      <h3>{title}</h3>
      <div className="mm-open-knobs">
        {slots.map((s) => (
          <DialKnob key={`${k}:${s.target}`} id={s.target as DialId} label={s.label} />
        ))}
      </div>
    </section>
  );

/** La course 0 a 1 d'un reglage (sa valeur dans ses bornes) et son ecriture depuis une course. */
const course = (id: string): number => {
  const [lo, hi] = dialRange(id as DialId);
  return hi > lo ? Math.max(0, Math.min(1, (dialShown(id as DialId) - lo) / (hi - lo))) : 0;
};
const setCourse = (id: string, c: number): void => {
  const [lo, hi] = dialRange(id as DialId);
  anyDial(id as DialId, Math.round((lo + Math.max(0, Math.min(1, c)) * (hi - lo)) * 10000) / 10000);
};

/** Le nom d'un sample comme l'ecran le dit : BD 1 pour ceux de la banque, son fichier pour les tiens. */
const smpLabel = (s: KitSample): string => (s.key.includes('/~') ? s.file.replace(/^~/, '').replace(/\.[a-z0-9]+$/i, '').toUpperCase() : `${s.family.toUpperCase()} ${s.label}`);

/* ---------------- la forme d'onde ---------------- */

interface View {
  a: number;
  b: number;
}

/**
 * Ce que joue la piste, en part du fichier : START (sa part sautee), la fin (LEN), le sens ; et la hauteur (pour l'echelle
 * de temps de l'enveloppe).
 */
function playWindow(): { s: number; e: number; rev: boolean; ratio: number } {
  const st = course('t:sstart');
  const ln = course('t:slen');
  const s = Math.min(1, st) * SAMPLE_START_MAX;
  const e = s + (1 - s) * sampleLenPart(ln);
  // TUNE : -1 a 1 pour +/-24 demi-tons ; FINE : -1 a 1 pour +/-64 cents (actions/internal/kit.ts, ses 49 et 129 crans)
  const semis = dialShown('t:tune' as DialId) * 24 + (dialShown('t:fine' as DialId) * 64) / 100;
  return { s, e, rev: dialShown('t:srev' as DialId) >= 0.5, ratio: Math.pow(2, semis / 12) };
}

const Waveform: React.FC<{ t: TrackKey; skey: string; rev: number }> = ({ t, skey, rev: changes }) => {
  const cv = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(1100);
  const [view, setView] = useState<View>({ a: 0, b: 1 });
  const drag = useRef<{ kind: 'start' | 'end' | 'pan'; x0: number; v0: View; f0: number } | null>(null);
  const H = 260;
  useEffect(() => setView({ a: 0, b: 1 }), [skey]);
  useEffect(() => {
    const el = cv.current?.parentElement;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setW(Math.max(300, Math.floor(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pcm = skey ? samplePcm(skey) : undefined;
  useEffect(() => {
    if (skey && !pcm) void requestSample(skey);
  }, [skey, pcm]);

  // Le dessin : la forme d'onde (min et max par colonne), ce qui ne joue pas en retrait, START, END, le fondu, l'enveloppe
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr);
    c.height = Math.round(H * dpr);
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0b0b0c';
    g.fillRect(0, 0, w, H);
    const top = 18;
    const bot = H - 22;
    const mid = (top + bot) / 2;
    const amp = (bot - top) / 2;
    const X = (f: number): number => ((f - view.a) / (view.b - view.a)) * w;
    g.strokeStyle = 'rgba(246,241,231,0.12)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, mid);
    g.lineTo(w, mid);
    g.stroke();
    if (!pcm) {
      g.fillStyle = 'rgba(246,241,231,0.6)';
      g.font = `700 14px ${FONT_DISPLAY}`;
      g.textAlign = 'center';
      g.fillText(skey ? 'LOADING…' : 'NO SAMPLE ON THIS TRACK', w / 2, mid + 5);
      return;
    }
    const pw = playWindow();
    const n = pcm.L.length;
    const at = (f: number): number => (pw.rev ? 1 - f : f);
    // Une colonne par pixel : le min et le max du fichier (a l'envers si REVERSE)
    for (let x = 0; x < w; x += 1) {
      const f0 = view.a + ((view.b - view.a) * x) / w;
      const f1 = view.a + ((view.b - view.a) * (x + 1)) / w;
      let i0 = Math.floor(at(f0) * n);
      let i1 = Math.floor(at(f1) * n);
      if (i0 > i1) [i0, i1] = [i1, i0];
      i1 = Math.max(i0 + 1, i1);
      let lo = 0;
      let hi = 0;
      for (let i = Math.max(0, i0); i < Math.min(n, i1); i += i1 - i0 > 4000 ? Math.floor((i1 - i0) / 4000) : 1) {
        const v = pcm.R ? (pcm.L[i] + pcm.R[i]) / 2 : pcm.L[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      const on = f0 >= pw.s - 1e-9 && f0 <= pw.e + 1e-9;
      g.strokeStyle = on ? 'rgba(246,241,231,0.95)' : 'rgba(246,241,231,0.22)';
      g.beginPath();
      g.moveTo(x + 0.5, mid - Math.max(0.5, hi * amp));
      g.lineTo(x + 0.5, mid - Math.min(-0.5, lo * amp));
      g.stroke();
    }
    // Ce qui ne joue pas : un voile
    g.fillStyle = 'rgba(11,11,12,0.45)';
    g.fillRect(0, top, Math.max(0, X(pw.s)), bot - top);
    g.fillRect(X(pw.e), top, Math.max(0, w - X(pw.e)), bot - top);
    // Le fondu de la fin (LEN < 1)
    const durS = ((pw.e - pw.s) * n) / pcm.sr / pw.ratio;
    if (pw.e < 0.9999) {
      const fadeS = sampleLenFadeS(durS);
      const fF = (fadeS * pw.ratio * pcm.sr) / n;
      const gr = g.createLinearGradient(X(pw.e - fF), 0, X(pw.e), 0);
      gr.addColorStop(0, 'rgba(255,120,31,0)');
      gr.addColorStop(1, 'rgba(255,120,31,0.28)');
      g.fillStyle = gr;
      g.fillRect(X(pw.e - fF), top, X(pw.e) - X(pw.e - fF), bot - top);
    }
    // L'enveloppe AMP (ATK, HOLD, DEC) a l'echelle du temps du coup
    const hp = resolveHit(t, null).hp;
    const tau = decayTau(hp.decay);
    const envAt = (s: number): number => (s < hp.atk ? (hp.atk > 0 ? s / hp.atk : 1) : s < hp.atk + hp.hold ? 1 : tau === null ? 1 : Math.exp(-(s - hp.atk - hp.hold) / tau));
    g.strokeStyle = '#FF781F';
    g.lineWidth = 1.6;
    g.beginPath();
    for (let x = Math.max(0, Math.floor(X(pw.s))); x <= Math.min(w, Math.ceil(X(pw.e))); x += 2) {
      const f = view.a + ((view.b - view.a) * x) / w;
      const s = ((f - pw.s) * n) / pcm.sr / pw.ratio;
      const y = bot - envAt(Math.max(0, s)) * (bot - top);
      if (x === Math.max(0, Math.floor(X(pw.s)))) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    // START et END : un trait, un drapeau
    const flag = (f: number, label: string): void => {
      const x = X(f);
      if (x < -2 || x > w + 2) return;
      g.strokeStyle = '#f6f1e7';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, top - 4);
      g.lineTo(x, bot + 2);
      g.stroke();
      g.fillStyle = '#f6f1e7';
      g.fillRect(label === 'S' ? x : x - 14, top - 16, 14, 13);
      g.fillStyle = '#0b0b0c';
      g.font = `800 10px ${FONT_DISPLAY}`;
      g.textAlign = 'center';
      g.fillText(label, label === 'S' ? x + 7 : x - 7, top - 6);
    };
    flag(pw.s, 'S');
    flag(pw.e, 'E');
    // La regle des temps (ms du fichier, a sa vitesse d'origine)
    const totalMs = (n / pcm.sr) * 1000;
    const spanMs = totalMs * (view.b - view.a);
    const stepMs = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find((m) => spanMs / m <= 10) ?? 10000;
    g.fillStyle = 'rgba(246,241,231,0.5)';
    g.font = `600 10px ${FONT_DISPLAY}`;
    g.textAlign = 'left';
    for (let m = Math.ceil((view.a * totalMs) / stepMs) * stepMs; m <= view.b * totalMs; m += stepMs) {
      const x = X(m / totalMs);
      g.fillRect(x, bot + 4, 1, 5);
      g.fillText(`${m >= 1000 ? `${(m / 1000).toFixed(m % 1000 ? 1 : 0)} S` : `${m} MS`}`, x + 3, bot + 17);
    }
  }, [w, view, pcm, skey, t, changes]);

  const fAt = (clientX: number): number => {
    const r = cv.current?.getBoundingClientRect();
    if (!r) return 0;
    return view.a + ((clientX - r.left) / r.width) * (view.b - view.a);
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!pcm) return;
    const r = e.currentTarget.getBoundingClientRect();
    const pw = playWindow();
    const px = (f: number): number => r.left + ((f - view.a) / (view.b - view.a)) * r.width;
    const near = (f: number): boolean => Math.abs(px(f) - e.clientX) < 10;
    const kind = near(pw.s) ? 'start' : near(pw.e) ? 'end' : 'pan';
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { kind, x0: e.clientX, v0: view, f0: kind === 'start' ? pw.s : kind === 'end' ? pw.e : 0 };
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const d = drag.current;
    const r = e.currentTarget.getBoundingClientRect();
    if (!d) {
      const pw = playWindow();
      const px = (f: number): number => r.left + ((f - view.a) / (view.b - view.a)) * r.width;
      e.currentTarget.style.cursor = Math.abs(px(pw.s) - e.clientX) < 10 || Math.abs(px(pw.e) - e.clientX) < 10 ? 'ew-resize' : view.b - view.a < 1 ? 'grab' : 'default';
      return;
    }
    const k = e.shiftKey ? 0.1 : 1;
    const df = ((e.clientX - d.x0) / r.width) * (d.v0.b - d.v0.a) * k;
    if (d.kind === 'pan') {
      const span = d.v0.b - d.v0.a;
      const a = Math.max(0, Math.min(1 - span, d.v0.a - df / k));
      setView({ a, b: a + span });
      return;
    }
    const f = Math.max(0, Math.min(1, d.f0 + df));
    if (d.kind === 'start') setCourse('t:sstart', Math.min(1, f / SAMPLE_START_MAX));
    else {
      const s = playWindow().s;
      const part = (f - s) / Math.max(1e-6, 1 - s);
      setCourse('t:slen', part >= 0.999 ? 1 : (part - 0.12) / 0.88);
    }
  };
  const onUp = (): void => {
    drag.current = null;
  };
  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>): void => {
    const f = fAt(e.clientX);
    const span = view.b - view.a;
    const ns = Math.max(0.005, Math.min(1, span * (e.deltaY > 0 ? 1.25 : 0.8)));
    const ratio = (f - view.a) / span;
    const a = Math.max(0, Math.min(1 - ns, f - ratio * ns));
    setView({ a, b: a + ns });
  };
  return (
    <div className="mm-open-wave">
      <canvas ref={cv} style={{ width: w, height: H, display: 'block', touchAction: 'none' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel} onDoubleClick={() => setView({ a: 0, b: 1 })} />
    </div>
  );
};

/* ---------------- les onglets ---------------- */

const SampleTab: React.FC<{ t: TrackKey; changes: number }> = ({ t, changes }) => {
  const i = TRACK_KEYS.indexOf(t);
  const fam = typedFamily(i);
  const skey = tracks.of(t).snd;
  const list = samplesOf(fam);
  const cur = list.findIndex((s) => s.key === skey);
  const smp = cur >= 0 ? list[cur] : undefined;
  const pcm = skey ? samplePcm(skey) : undefined;
  const pw = playWindow();
  const step = (d: number): void => {
    if (list.length === 0) return;
    const next = list[(cur + d + list.length) % list.length];
    tracks.sample(t, next.key);
  };
  const ms = (f: number): string => (pcm ? `${((f * pcm.L.length) / pcm.sr / pw.ratio * 1000).toFixed(1)} MS` : '--');
  const reset = (): void => {
    for (const id of ['t:sstart', 't:slen', 't:tune', 't:fine', 't:srev'] as const) anyDial(id as DialId, anyDialReset(id as DialId));
    lcdMessage.show(`${TRACK_NAMES[i]} SAMPLE RESET`, 1200);
  };
  return (
    <div className="mm-open-sampletab">
      <div className="mm-open-row">
        <button type="button" onClick={() => step(-1)} title="Previous sample of this type">
          ◀
        </button>
        <span className="mm-open-now">
          {TRACK_NAMES[i]} <b>{smp ? smpLabel(smp) : 'OFF'}</b>
          <small>
            {cur >= 0 ? `${cur + 1} / ${list.length}` : ''}
            {smp && skey.includes('/~') ? ' · YOUR FOLDER' : ''}
          </small>
        </span>
        <button type="button" onClick={() => step(1)} title="Next sample of this type">
          ▶
        </button>
        <button type="button" onClick={() => trigger(t, undefined, false, undefined, 1)} title="Play the track once (the plugin plays it)">
          LISTEN
        </button>
        <button type="button" aria-pressed={pw.rev} onClick={() => setCourse('t:srev', pw.rev ? 0 : 1)}>
          REVERSE
        </button>
        <button type="button" onClick={reset} title="START 0, END at the end, TUNE 0, FINE 0, forward">
          RESET
        </button>
        <button type="button" onClick={() => fileImport.plugin?.(t)}>
          IMPORT…
        </button>
        <button type="button" onClick={() => fileImport.reveal?.(fam)}>
          FOLDER
        </button>
      </div>
      <Waveform t={t} skey={skey} rev={changes} />
      <div className="mm-open-wavefoot">
        <span>
          START <b>{ms(pw.s)}</b>
        </span>
        <span>
          END <b>{ms(pw.e)}</b>
        </span>
        <span>
          PLAYS <b>{ms(pw.e - pw.s)}</b>
        </span>
        <span>{pcm ? `${pcm.R ? 'STEREO' : 'MONO'} · ${(pcm.sr / 1000).toFixed(1)} KHZ · ${((pcm.L.length / pcm.sr) * 1000).toFixed(0)} MS` : ''}</span>
        <span className="mm-open-hint">drag S and E · Shift: fine · wheel: zoom · double click: whole sample · orange: the AMP envelope</span>
      </div>
      <div className="mm-open-grid3">
        <KnobGroup title="SAMPLE" k={`s${t}`} slots={slotsByLabel(['voice', 'synth'], ['STRT', 'LEN', 'TUNE', 'FINE', 'LEV', 'PLAY'])} />
        <KnobGroup title="AMP ENVELOPE" k={`a${t}`} slots={slotsByLabel(['env'], ['ATK', 'HOLD', 'DEC', 'PAN'])} />
        <KnobGroup title="FILTER" k={`f${t}`} slots={slotsByLabel(['fltr'], ['FREQ', 'RESO', 'TYPE', 'ENV'])} />
      </div>
    </div>
  );
};

/** Un choix en boutons. */
function Choice<T extends string | boolean>({ label, options, value, onPick }: { label: string; options: readonly { v: T; t: string }[]; value: T; onPick: (v: T) => void }): React.ReactElement {
  return (
    <div className="mm-open-choice">
      <span>{label}</span>
      <div>
        {options.map((o) => (
          <button key={String(o.v)} type="button" aria-pressed={o.v === value} onClick={() => onPick(o.v)}>
            {o.t}
          </button>
        ))}
      </div>
    </div>
  );
}

const HELP: readonly [string, string][] = [
  ['Right click on a step', 'P-LOCK that step: the knobs lock their value on it; again: out'],
  ['Right click on a key', 'FUNC + that key (its orange function printed under it)'],
  ['Arrows under the screen', 'sub-page, list up / down, the bank in PTN'],
  ['In the screen', 'click a line: pick; again: YES; right click: NO; wheel: LEVEL/DATA'],
  ['Knobs', 'drag; Shift + drag: fine; double click: back to the start value'],
  ['Scenes A / B', 'tap A or B, turn knobs, tap again: the crossfader goes from A to B'],
  ['Ableton', 'Crossfader parameter (map, automate); a clip Pgm picks A01 to H16'],
  ['DRAG MIDI (under the machine)', 'drag the playing pattern onto a MIDI track or a Drum Rack: a clip (16 pads, C1 to D#2); a click saves the .mid'],
];

const SettingsTab: React.FC = () => {
  const p = personalize.get();
  const master = slotsByLabel(['fxm'], ['MASTER']);
  return (
    <div className="mm-open-grid2">
      <section className="mm-open-card">
        <h3>PATTERN</h3>
        <div className="mm-open-knobs">
          <DialKnob id={'z:pg:len' as DialId} label="STEPS" />
          <DialKnob id={'z:bpm' as DialId} label="BPM" />
          <DialKnob id={'z:swing' as DialId} label="SWING" />
          {master.map((s) => (
            <DialKnob key={s.target} id={s.target as DialId} label="MASTER" />
          ))}
        </div>
        <p className="mm-open-note">BPM is the internal clock (PLAY of the machine) ; Ableton playing, its tempo leads.</p>
      </section>
      <section className="mm-open-card">
        <h3>PERSONALIZE</h3>
        <div className="mm-open-choices">
          <Choice label="TRK SELECT" value={p.trkSelect} options={TRKS.map((x) => ({ v: x, t: x.toUpperCase() }))} onPick={(v) => personalize.set({ trkSelect: v })} />
          <Choice label="LED" value={p.led} options={LEDS.map((x) => ({ v: x, t: x.toUpperCase() }))} onPick={(v) => personalize.set({ led: v })} />
          <Choice
            label="BACKLIGHT"
            value={p.backlight}
            options={[
              { v: false, t: 'OFF' },
              { v: true, t: 'ON' },
            ]}
            onPick={(v) => personalize.set({ backlight: v })}
          />
          <Choice
            label="SUBPAGE"
            value={p.subpage}
            options={[
              { v: false, t: 'FIRST' },
              { v: true, t: 'REMEMBER' },
            ]}
            onPick={(v) => personalize.set({ subpage: v })}
          />
        </div>
      </section>
      <section className="mm-open-card">
        <h3>SAMPLES FOLDER</h3>
        <p className="mm-open-note">
          Music / MM-RYTM Samples / bd, sd, ch, oh, cp, tom, ht, cy : WAV, AIFF, FLAC, MP3, 30 s at most. Each type plays its own samples.
        </p>
        <div className="mm-open-row">
          <button type="button" onClick={() => fileImport.reveal?.(null)}>
            OPEN FOLDER
          </button>
          <button type="button" onClick={() => fileImport.rescan?.()}>
            RESCAN
          </button>
        </div>
      </section>
      <section className="mm-open-card">
        <h3>MOUSE AND KEYS</h3>
        <div className="mm-open-help">
          {HELP.map(([k, v]) => (
            <p key={k}>
              <b>{k}</b>
              <span>{v}</span>
            </p>
          ))}
        </div>
      </section>
      <section className="mm-open-card mm-open-wide">
        <h3>ABOUT</h3>
        <p className="mm-open-note">MM-RYTM VST3 · firmware V.{fwVersion('mm808')} · Maudite Machine, personal use.</p>
      </section>
    </div>
  );
};

const CSS = `
.mm-open{position:fixed;inset:10px;z-index:40;display:flex;flex-direction:column;background:#141518;border:1px solid rgba(246,241,231,.14);border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.7);color:#f6f1e7;font-family:${FONT_DISPLAY};overflow:hidden}
.mm-open button{font:inherit;color:inherit;cursor:pointer}
.mm-open-head{display:flex;align-items:center;gap:14px;padding:12px 16px;border-bottom:1px solid rgba(246,241,231,.1);background:linear-gradient(#1b1c20,#16171a)}
.mm-open-title{font-weight:800;letter-spacing:.14em;font-size:13px;white-space:nowrap}
.mm-open-title i{font-style:normal;color:#ff781f}
.mm-open-tabs{display:flex;gap:4px}
.mm-open-tabs button,.mm-open-close,.mm-open-tracks button,.mm-open-row button,.mm-open-choice button{background:rgba(246,241,231,.06);border:1px solid rgba(246,241,231,.16);border-radius:7px;padding:6px 10px;font-size:11px;font-weight:700;letter-spacing:.1em}
.mm-open-tabs button[aria-pressed=true],.mm-open-tracks button[aria-pressed=true],.mm-open-choice button[aria-pressed=true],.mm-open-row button[aria-pressed=true]{background:#ff781f;border-color:#ff781f;color:#141518}
.mm-open-close{margin-left:auto;padding:7px 14px;font-size:12px}
.mm-open-close:hover,.mm-open-tabs button:hover,.mm-open-row button:hover{border-color:#ff781f}
.mm-open-tracks{display:grid;grid-template-columns:repeat(16,1fr);gap:4px;padding:8px 16px;border-bottom:1px solid rgba(246,241,231,.08)}
.mm-open-tracks button{padding:5px 0}
.mm-open-body{flex:1;overflow:auto;padding:10px 16px 16px}
.mm-open-sampletab{display:flex;flex-direction:column;gap:8px}
.mm-open-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.mm-open-now{font-size:12px;letter-spacing:.08em;margin-right:auto;display:flex;align-items:baseline;gap:8px}
.mm-open-now b{color:#ff781f;font-size:15px}
.mm-open-now small{color:rgba(246,241,231,.5);font-size:10px;letter-spacing:.1em}
.mm-open-wave{border:1px solid rgba(246,241,231,.12);border-radius:10px;overflow:hidden;background:#0b0b0c}
.mm-open-wavefoot{display:flex;gap:16px;flex-wrap:wrap;font-size:11px;letter-spacing:.08em;color:rgba(246,241,231,.6)}
.mm-open-wavefoot b{color:#f6f1e7;font-weight:700}
.mm-open-hint{margin-left:auto;color:rgba(246,241,231,.4)}
.mm-open-grid3{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:8px}
.mm-open-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mm-open-card{background:rgba(246,241,231,.035);border:1px solid rgba(246,241,231,.09);border-radius:12px;padding:8px 10px 10px}
.mm-open-wide{grid-column:1 / -1}
.mm-open-card h3{margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:.16em;color:#ff781f}
.mm-open-knobs{display:flex;flex-wrap:wrap;gap:4px}
.mm-open-knobs .v4-knob{width:74px;padding:4px 2px}
.mm-open-knobs .v4-knob-dial{width:44px;height:44px}
.mm-open-knobs .v4-knob-unit{font-size:9px;color:rgba(246,241,231,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.mm-open-note{font-size:12px;color:rgba(246,241,231,.7);margin:4px 0 8px}
.mm-open-choices{display:flex;flex-direction:column;gap:8px}
.mm-open-choice{display:flex;align-items:center;gap:10px}
.mm-open-choice>span{width:84px;font-size:10px;font-weight:800;letter-spacing:.14em;color:rgba(246,241,231,.7)}
.mm-open-choice>div{display:flex;gap:4px;flex-wrap:wrap}
.mm-open-help{display:flex;flex-direction:column;gap:6px}
.mm-open-help p{margin:0;display:flex;gap:10px;font-size:12px}
.mm-open-help b{min-width:150px;font-size:11px;letter-spacing:.1em;color:#ff781f}
.mm-open-help span{color:rgba(246,241,231,.85)}
`;

export const OpenPanel: React.FC = () => {
  const open = useSyncExternalStore(pluginPanel.subscribe, pluginPanel.get, pluginPanel.get);
  const [tab, setTab] = useState<Tab>('sample');
  const changes = useRev();
  const t = activeTrack.get() ?? 'BD';

  // Echap ferme le panneau (avant les raccourcis de la face)
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      pluginPanel.set(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  if (!open) return null;
  return (
    <div className="mm-open" role="dialog" aria-label="MM-RYTM open: sample editor and settings" onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      <style>{CSS}</style>
      <div className="mm-open-head">
        <span className="mm-open-title">
          MM-RYTM <i>OPEN</i>
        </span>
        <div className="mm-open-tabs" role="tablist">
          {TABS.map((x) => (
            <button key={x.id} type="button" role="tab" aria-pressed={tab === x.id} aria-selected={tab === x.id} onClick={() => setTab(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        <button type="button" className="mm-open-close" onClick={() => pluginPanel.set(false)} title="Close (OPEN, Esc): back to the front panel">
          CLOSE ✕
        </button>
      </div>
      {tab === 'sample' && (
        <div className="mm-open-tracks" role="group" aria-label="Track">
          {TRACK_KEYS.map((k, i) => (
            <button key={k} type="button" aria-pressed={k === t} onClick={() => trackSelect(k)}>
              {TRACK_NAMES[i]}
            </button>
          ))}
        </div>
      )}
      <div className="mm-open-body">
        {tab === 'sample' && <SampleTab t={t} changes={changes} />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
};
