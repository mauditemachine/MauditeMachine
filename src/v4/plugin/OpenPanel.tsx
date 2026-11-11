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
 * - PATTERN (2026-11-10, Mika : "j'aime pas trop en dessous DRAG MIDI etc., la barre, je prefere que ce soit dans OPEN") :
 *   DRAG MIDI (la pattern qui joue, en clip a glisser sur une piste d'Ableton), SAVE .MID, NEW et CLEAR (confirmes ici) ;
 *   la poignee DRAG MIDI est aussi dans l'en-tete, sur chaque onglet ;
 * - SETTINGS : le pattern (STEPS, BPM, SWING, MASTER), PERSONALIZE (TRK SELECT, les LED, la sous-page), le dossier des
 *   samples, la souris et le clavier, la version.
 * Le blanc (2026-11-10, Mika : "quand on clic sur OPEN je veux passer en white mode totale") : tout le panneau, toute la
 * fenetre, en clair ; le rouge des choix, le jaune orange des titres et de l'enveloppe.
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
import { explode } from '../state/explode';
import { openToggle } from '../actions';
import { pluginMidi } from '../state/pluginMidi';
import { meters } from './meters';
import { pluginClear, pluginNew } from '../actions/patterns';
import { activeTrack } from '../state/trk';
import { pattern } from '../audio/pattern';
import { FONT_DISPLAY } from '../theme';
import { KnobView, type KnobSpec } from '../ui/KnobPanel';
import type { Stage } from '../scene/renderer';

type Tab = 'sample' | 'pattern' | 'settings';
const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'sample', label: 'SAMPLE' },
  { id: 'pattern', label: 'PATTERN · MIDI' },
  { id: 'settings', label: 'SETTINGS' },
];

/**
 * L'ecran de la carte (2026-11-11, Mika : "je n'aime pas le OPEN [blanc], je veux que ca se retrouve quand meme dans un PCB,
 * avec un ecran a l'interieur") : le noir et l'encre de l'ecran de la machine, le rouge de ses pas, l'orange de sa face.
 */
const S_BG = '#050506';
const W_INK = '#F4F1EA';
const W_RED = '#F0463C';
const W_AMBER = '#FF8A1F';
const S_DIM = 'rgba(244,241,234,0.5)';
const S_FAINT = 'rgba(244,241,234,0.14)';

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
  return <KnobView spec={spec} compact relief />;
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
  const [{ w, h: H }, setSize] = useState({ w: 800, h: 180 });
  const [view, setView] = useState<View>({ a: 0, b: 1 });
  const drag = useRef<{ kind: 'start' | 'end' | 'pan'; x0: number; v0: View; f0: number } | null>(null);
  useEffect(() => setView({ a: 0, b: 1 }), [skey]);
  useEffect(() => {
    const el = cv.current?.parentElement;
    if (!el) return undefined;
    const fit = (): void => setSize({ w: Math.max(200, Math.floor(el.clientWidth)), h: Math.max(80, Math.floor(el.clientHeight)) });
    fit();
    const ro = new ResizeObserver(fit);
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
    g.fillStyle = S_BG;
    g.fillRect(0, 0, w, H);
    const top = 18;
    const bot = H - 22;
    const mid = (top + bot) / 2;
    const amp = (bot - top) / 2;
    const X = (f: number): number => ((f - view.a) / (view.b - view.a)) * w;
    g.strokeStyle = S_FAINT;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, mid);
    g.lineTo(w, mid);
    g.stroke();
    if (!pcm) {
      g.fillStyle = S_DIM;
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
      g.strokeStyle = on ? W_INK : 'rgba(244,241,234,0.24)';
      g.beginPath();
      g.moveTo(x + 0.5, mid - Math.max(0.5, hi * amp));
      g.lineTo(x + 0.5, mid - Math.min(-0.5, lo * amp));
      g.stroke();
    }
    // Ce qui ne joue pas : un voile
    g.fillStyle = 'rgba(5,5,6,0.45)';
    g.fillRect(0, top, Math.max(0, X(pw.s)), bot - top);
    g.fillRect(X(pw.e), top, Math.max(0, w - X(pw.e)), bot - top);
    // Le fondu de la fin (LEN < 1)
    const durS = ((pw.e - pw.s) * n) / pcm.sr / pw.ratio;
    if (pw.e < 0.9999) {
      const fadeS = sampleLenFadeS(durS);
      const fF = (fadeS * pw.ratio * pcm.sr) / n;
      const gr = g.createLinearGradient(X(pw.e - fF), 0, X(pw.e), 0);
      gr.addColorStop(0, 'rgba(242,154,0,0)');
      gr.addColorStop(1, 'rgba(242,154,0,0.35)');
      g.fillStyle = gr;
      g.fillRect(X(pw.e - fF), top, X(pw.e) - X(pw.e - fF), bot - top);
    }
    // L'enveloppe AMP (ATK, HOLD, DEC) a l'echelle du temps du coup
    const hp = resolveHit(t, null).hp;
    const tau = decayTau(hp.decay);
    const envAt = (s: number): number => (s < hp.atk ? (hp.atk > 0 ? s / hp.atk : 1) : s < hp.atk + hp.hold ? 1 : tau === null ? 1 : Math.exp(-(s - hp.atk - hp.hold) / tau));
    g.strokeStyle = W_AMBER;
    g.lineWidth = 2;
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
      g.strokeStyle = W_RED;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, top - 4);
      g.lineTo(x, bot + 2);
      g.stroke();
      g.fillStyle = W_RED;
      g.fillRect(label === 'S' ? x : x - 14, top - 16, 14, 13);
      g.fillStyle = S_BG;
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
    g.fillStyle = S_DIM;
    g.font = `600 10px ${FONT_DISPLAY}`;
    g.textAlign = 'left';
    for (let m = Math.ceil((view.a * totalMs) / stepMs) * stepMs; m <= view.b * totalMs; m += stepMs) {
      const x = X(m / totalMs);
      g.fillRect(x, bot + 4, 1, 5);
      g.fillText(`${m >= 1000 ? `${(m / 1000).toFixed(m % 1000 ? 1 : 0)} S` : `${m} MS`}`, x + 3, bot + 17);
    }
  }, [w, H, view, pcm, skey, t, changes]);

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
      <canvas ref={cv} style={{ position: 'absolute', left: 0, top: 0, width: w, height: H, display: 'block', touchAction: 'none' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel} onDoubleClick={() => setView({ a: 0, b: 1 })} />
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
  // START et END : des places dans le fichier ; PLAYS : la part jouee du fichier (comme LEN) ; a TUNE et FINE, sa duree entendue
  const ms = (f: number, heard = false): string => (pcm ? `${(((f * pcm.L.length) / pcm.sr / (heard ? pw.ratio : 1)) * 1000).toFixed(1)} MS` : '--');
  const tuned = Math.abs(pw.ratio - 1) > 1e-4;
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
        {tuned && (
          <span>
            HEARD AT THIS TUNE <b>{ms(pw.e - pw.s, true)}</b>
          </span>
        )}
        <span>{pcm ? `${pcm.R ? 'STEREO' : 'MONO'} · ${(pcm.sr / 1000).toFixed(1)} KHZ · ${((pcm.L.length / pcm.sr) * 1000).toFixed(0)} MS` : ''}</span>
        <span className="mm-open-hint">drag S and E · Shift: fine · wheel: zoom · double click: whole sample · yellow: the AMP envelope</span>
      </div>
      <div className="mm-open-knobrow">
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
  ['Arrows under the screen', 'sub-page, list up / down'],
  ['In the screen', 'click a line: pick; again: YES; right click: NO; wheel: LEVEL/DATA'],
  ['Knobs', 'drag; Shift + drag: fine; double click: back to the start value'],
  ['Scenes A / B', 'tap A or B, turn knobs, tap again: the crossfader goes from A to B'],
  ['PERFORM (first key)', 'the live page: DIST, BIT, CHORUS, DELAY, REVERB, COMP, MASTER and the crossfader; right click: the presets'],
  ['REC twice (double click)', 'LIVE REC: while it plays, a knob you turn is recorded on the steps it crosses (P-LOCKs), a trig key writes its hit; REC again: out'],
  ['Ableton', 'Crossfader parameter (map, automate); a clip Pgm picks A01 to H16'],
  ['DRAG MIDI (OPEN, at the top)', 'drag the playing pattern onto a MIDI track or a Drum Rack: a clip (16 pads, C1 to D#2); a click saves the .mid'],
  ['Levels (OPEN, PATTERN · MIDI)', 'the real level of each track and of the output L and R, from the engine'],
  ['Window', 'drag its corner: the machine grows with your screen (kept with the project)'],
];

/* ---------------- PATTERN : le MIDI, NEW, CLEAR ---------------- */

const useMidi = (): ReturnType<typeof pluginMidi.get> => useSyncExternalStore(pluginMidi.subscribe, pluginMidi.get, pluginMidi.get);

/**
 * La poignee DRAG MIDI : tenue et tiree (4 px), elle demande au plugin le glisser du Mac (mm_drag_midi, une fois par geste :
 * l'evenement souris courant part avec le fichier) ; un clic sans glisser garde le .mid (SAVE .MID).
 */
const DragMidi: React.FC<{ big?: boolean }> = ({ big }) => {
  const { info } = useMidi();
  const press = useRef<{ id: number; x: number; y: number; sent: boolean } | null>(null);
  const off = useRef<(() => void) | null>(null);
  useEffect(() => () => off.current?.(), []);
  const can = !!info && info.ok && info.notes > 0;
  const onDown = (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Le geste d'avant (le glisser du Mac avale son relacher) : ses ecoutes partent
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
  return (
    <button
      type="button"
      className={big ? 'mm-open-drag mm-open-drag-big' : 'mm-open-drag'}
      data-can={can ? '1' : '0'}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onPointerDown={onDown}
      title="Drag the playing pattern onto a MIDI track or a Drum Rack in Ableton; a click saves the .mid"
      aria-label="Drag MIDI: the playing pattern as a clip, onto an Ableton track"
    >
      <svg viewBox="0 0 12 18" aria-hidden="true">
        {[0, 1, 2].map((i) => [0, 1].map((j) => <circle key={`${i}${j}`} cx={3 + j * 6} cy={3 + i * 6} r={1.6} />))}
      </svg>
      <span>
        <b>DRAG MIDI</b>
        {big && <small>{info ? (info.notes > 0 ? `${info.slot} · ${info.bars} ${info.bars > 1 ? 'BARS' : 'BAR'} · ${info.notes} NOTES` : `${info.slot} · EMPTY`) : 'THE PLAYING PATTERN'}</small>}
      </span>
    </button>
  );
};

/**
 * Les niveaux (2026-11-10, Mika : les VU-metres, "ce genre d'information dans OPEN") : la crete reelle de chaque piste et de la
 * sortie, du moteur (plugin/meters.ts) ; une barre par piste avec son nom, L et R, un pic tenu, rouge au 0 dB. Anime tant que
 * le panneau est ouvert.
 */
const Levels: React.FC = () => {
  const cv = useRef<HTMLCanvasElement>(null);
  const [{ w, h: H }, setSize] = useState({ w: 800, h: 150 });
  useEffect(() => {
    const el = cv.current?.parentElement;
    if (!el) return undefined;
    const fit = (): void => setSize({ w: Math.max(200, Math.floor(el.clientWidth)), h: Math.max(70, Math.floor(el.clientHeight)) });
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    let raf = 0;
    const draw = (): void => {
      raf = window.requestAnimationFrame(draw);
      const c = cv.current;
      const g = c?.getContext('2d');
      if (!c || !g) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(H * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(H * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = S_BG;
      g.fillRect(0, 0, w, H);
      const mv = meters.view();
      const cols = 16 + 3;
      const pitch = w / cols;
      const bw = Math.max(6, Math.round(pitch * 0.55));
      const top = 8;
      const bot = H - 24;
      const mh = bot - top;
      const bar = (i: number, v: number, p: number, name: string, strong: boolean): void => {
        const x = Math.round(i * pitch + (pitch - bw) / 2);
        g.fillStyle = 'rgba(244,241,234,0.08)';
        g.fillRect(x, top, bw, mh);
        if (v > 0) {
          g.fillStyle = strong ? W_INK : 'rgba(244,241,234,0.82)';
          g.fillRect(x, bot - Math.round(v * mh), bw, Math.round(v * mh));
        }
        if (p > 0.02) {
          g.fillStyle = p > 0.97 ? W_RED : W_AMBER;
          g.fillRect(x, bot - Math.round(p * mh) - 2, bw, 3);
        }
        g.fillStyle = S_DIM;
        g.font = `700 10px ${FONT_DISPLAY}`;
        g.textAlign = 'center';
        g.fillText(name, x + bw / 2, H - 8);
      };
      for (let t = 0; t < 16; t += 1) bar(t, mv.t[t], mv.tp[t], TRACK_NAMES[t], false);
      bar(17, mv.l, mv.lp, 'L', true);
      bar(18, mv.r, mv.rp, 'R', true);
      if (mv.clip) {
        g.fillStyle = W_RED;
        g.font = `800 11px ${FONT_DISPLAY}`;
        g.textAlign = 'right';
        g.fillText('CLIP', w - 4, 12);
      }
    };
    raf = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(raf);
  }, [w, H]);
  return (
    <div className="mm-open-wave">
      <canvas ref={cv} style={{ position: 'absolute', left: 0, top: 0, width: w, height: H, display: 'block' }} aria-label="Levels of the 16 tracks and of the output, from the engine" />
    </div>
  );
};

const PatternTab: React.FC = () => {
  const { info, status } = useMidi();
  const [ask, setAsk] = useState<null | 'new' | 'clear'>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    pluginMidi.request?.();
  }, []);
  // Le message du plugin s'efface apres 5 s
  useEffect(() => {
    if (!status) return undefined;
    const left = 5000 - (Date.now() - status.at);
    if (left <= 0) return undefined;
    const id = window.setTimeout(() => tick((n) => n + 1), left + 20);
    return () => window.clearTimeout(id);
  }, [status]);
  const fresh = status && Date.now() - status.at < 5000 ? status : null;
  const doIt = (): void => {
    if (ask === 'new') pluginNew();
    else if (ask === 'clear') pluginClear();
    setAsk(null);
  };
  return (
    <div className="mm-open-pat">
      <section className="mm-open-card">
        <h3>THE PLAYING PATTERN AS A MIDI CLIP</h3>
        <div className="mm-open-midirow">
          <DragMidi big />
          <div className="mm-open-midiinfo">
            <p className="mm-open-big">
              {info ? (
                <>
                  <b>{info.slot}</b> · {info.bars} {info.bars > 1 ? 'BARS' : 'BAR'} · {info.notes} {info.notes === 1 ? 'NOTE' : 'NOTES'}
                  {info.capped ? ' · CUT AT 64 BARS' : ''}
                </>
              ) : (
                'Waiting for the plugin…'
              )}
            </p>
            <p className="mm-open-note">{fresh ? <span className={fresh.ok ? 'mm-open-status' : 'mm-open-status mm-open-status-ko'}>{fresh.msg}</span> : 'Drag it onto a MIDI track or a Drum Rack (16 pads, C1 to D#2). A click saves the file.'}</p>
          </div>
          <button type="button" className="mm-open-btn" onClick={() => pluginMidi.save?.()} title="Save the .mid in Music / MM-RYTM MIDI and show it in the Finder">
            SAVE .MID
          </button>
          <button type="button" className="mm-open-btn" onClick={() => setAsk('new')} title="A blank preset: no steps, the 16 tracks on the first sample of their type, the global FX off, no scene, no mute">
            NEW…
          </button>
          <button type="button" className="mm-open-btn" onClick={() => setAsk('clear')} title="The steps, their P-LOCKs and trig settings go; the sounds, the FX and the scenes stay">
            CLEAR…
          </button>
        </div>
      </section>
      <section className="mm-open-card mm-open-grow">
        <h3>LEVELS · THE ENGINE, LIVE (-48 TO 0 DB)</h3>
        <Levels />
      </section>
      {ask && (
        <div className="mm-open-confirm" role="alertdialog" aria-label={ask === 'new' ? 'New blank preset?' : 'Clear the pattern?'}>
          <div>
            <h4>{ask === 'new' ? 'NEW: a blank preset?' : 'CLEAR the pattern?'}</h4>
            <p>
              {ask === 'new'
                ? 'No steps, the 16 tracks on the first sample of their type, the global FX off, no scene, no mute.'
                : 'The steps, their P-LOCKs and trig settings go; the sounds, the FX and the scenes stay.'}{' '}
              Cmd+Z in the machine undoes it.
            </p>
            <div className="mm-open-row">
              <button type="button" className="mm-open-btn mm-open-btn-red" onClick={doIt}>
                {ask === 'new' ? 'NEW' : 'CLEAR'}
              </button>
              <button type="button" className="mm-open-btn" onClick={() => setAsk(null)}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
      <section className="mm-open-card mm-open-wide">
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
      <p className="mm-open-about mm-open-wide">MM-RYTM VST3 · firmware V.{fwVersion('mm808')} · Maudite Machine, personal use.</p>
    </div>
  );
};

const CSS = `
.mm-open-mod{position:fixed;z-index:40;box-sizing:border-box;padding:1em;border-radius:1.1em;background:linear-gradient(#141416,#0b0b0d);border:.12em solid #2b2b30;box-shadow:0 .1em 0 rgba(244,241,234,.06) inset,0 1em 2.6em rgba(0,0,0,.75);font-family:${FONT_DISPLAY};color:${W_INK};animation:mm-open-in .32s ease-out both}
@keyframes mm-open-in{0%{opacity:0}35%{opacity:1;filter:brightness(1.9)}100%{opacity:1;filter:none}}
.mm-open-screw{position:absolute;width:.56em;height:.56em;border-radius:50%;background:radial-gradient(circle at 35% 30%,#d9dadd,#7c7e84 60%,#3b3c40);box-shadow:0 0 0 .08em rgba(0,0,0,.6)}
.mm-open-screw::after{content:'';position:absolute;left:18%;right:18%;top:44%;height:12%;background:rgba(0,0,0,.55);transform:rotate(35deg)}
.mm-open-tag{position:absolute;right:2.2em;bottom:.18em;font-size:.62em;font-weight:700;letter-spacing:.22em;color:rgba(244,241,234,.38)}
.mm-open{position:relative;width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;background:${S_BG};border-radius:.5em;box-shadow:0 0 0 .1em #000,inset 0 0 4em rgba(244,241,234,.035);overflow:hidden}
.mm-open button{font:inherit;color:inherit;cursor:pointer}
.mm-open-head{display:flex;align-items:center;gap:1em;padding:.6em .9em;border-bottom:1px solid rgba(244,241,234,.12)}
.mm-open-title{font-weight:800;letter-spacing:.14em;font-size:1.15em;white-space:nowrap}
.mm-open-title i{font-style:normal;color:${W_AMBER}}
.mm-open-tabs{display:flex;gap:.35em}
.mm-open-tabs button,.mm-open-close,.mm-open-tracks button,.mm-open-row button,.mm-open-choice button,.mm-open-btn{background:rgba(244,241,234,.06);border:1px solid rgba(244,241,234,.2);border-radius:.5em;padding:.45em .8em;font-size:1em;font-weight:700;letter-spacing:.1em;color:${W_INK};white-space:nowrap}
.mm-open-tabs button[aria-pressed=true],.mm-open-tracks button[aria-pressed=true],.mm-open-choice button[aria-pressed=true],.mm-open-row button[aria-pressed=true]{background:${W_RED};border-color:${W_RED};color:#0b0b0c}
.mm-open-close:hover,.mm-open-tabs button:hover,.mm-open-row button:hover,.mm-open-btn:hover,.mm-open-tracks button:hover,.mm-open-choice button:hover{border-color:${W_AMBER}}
.mm-open-btn{padding:.6em 1em}
.mm-open .mm-open-close{display:flex;align-items:center;gap:.55em;background:${W_RED};border-color:${W_RED};color:#0b0b0c;font-weight:800;font-size:1.08em;padding:.5em 1em;box-shadow:0 0 0 .18em rgba(240,70,60,.22)}
.mm-open .mm-open-close:hover{background:#ff5a4f;border-color:#fff}
.mm-open-close kbd{font:inherit;font-size:.72em;font-weight:800;letter-spacing:.08em;padding:.12em .4em;border-radius:.3em;background:rgba(11,11,12,.22)}
.mm-lid{position:fixed;left:0;right:0;top:0;z-index:41;display:flex;align-items:flex-end;justify-content:center;padding:0;border:0;background:linear-gradient(rgba(5,5,6,0),rgba(5,5,6,.28));cursor:pointer;font-family:${FONT_DISPLAY};animation:mm-open-in .32s ease-out both}
.mm-lid span{margin-bottom:.35em;padding:.2em .9em;border-radius:1em;background:rgba(5,5,6,.72);border:1px solid rgba(244,241,234,.2);font-size:.8em;font-weight:800;letter-spacing:.2em;color:rgba(244,241,234,.6);white-space:nowrap;transition:color .12s,border-color .12s,background .12s}
.mm-lid:hover span,.mm-lid:focus-visible span{color:#0b0b0c;background:${W_AMBER};border-color:${W_AMBER}}
.mm-open .mm-open-btn-red{background:${W_RED};border-color:${W_RED};color:#0b0b0c}
.mm-open-drag{margin-left:auto;display:flex;align-items:center;gap:.6em;background:${W_AMBER};border:1px solid ${W_AMBER};border-radius:.5em;padding:.4em .9em;color:#0b0b0c !important;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}
.mm-open-drag:active{cursor:grabbing}
.mm-open-drag[data-can='0']{opacity:.5}
.mm-open-drag svg{width:.75em;height:1.15em;fill:currentColor}
.mm-open-drag span{display:flex;flex-direction:column;align-items:flex-start;line-height:1.15}
.mm-open-drag b{font-size:1em;font-weight:800;letter-spacing:.1em}
.mm-open-drag small{font-size:.85em;font-weight:600;letter-spacing:.06em;opacity:.8}
.mm-open-drag-big{margin-left:0;padding:1em 1.5em;border-radius:.7em}
.mm-open-drag-big svg{width:1em;height:1.5em}
.mm-open-drag-big b{font-size:1.4em}
.mm-open-tracks{display:grid;grid-template-columns:repeat(16,1fr);gap:.3em;padding:.5em .9em;border-bottom:1px solid rgba(244,241,234,.08)}
.mm-open-tracks button{padding:.35em 0;font-size:.92em}
.mm-open-body{flex:1;min-height:0;display:flex;flex-direction:column;padding:.6em .9em .8em;overflow:hidden}
.mm-open-sampletab,.mm-open-pat{flex:1;min-height:0;display:flex;flex-direction:column;gap:.55em;position:relative}
.mm-open-row{display:flex;align-items:center;gap:.45em;flex-wrap:wrap}
.mm-open-now{font-size:1.05em;letter-spacing:.08em;margin-right:auto;display:flex;align-items:baseline;gap:.6em}
.mm-open-now b{color:${W_RED};font-size:1.3em}
.mm-open-now small{color:rgba(244,241,234,.5);font-size:.9em;letter-spacing:.1em}
.mm-open-wave{position:relative;flex:1;min-height:7em;border:1px solid rgba(244,241,234,.14);border-radius:.6em;overflow:hidden;background:${S_BG}}
.mm-open-wavefoot{display:flex;gap:1.3em;flex-wrap:nowrap;font-size:.95em;letter-spacing:.08em;color:rgba(244,241,234,.55);white-space:nowrap;overflow:hidden}
.mm-open-wavefoot b{color:${W_INK};font-weight:700}
.mm-open-hint{margin-left:auto;color:rgba(244,241,234,.35);overflow:hidden;text-overflow:ellipsis}
.mm-open-knobrow{display:flex;gap:.55em;flex:0 0 auto}
.mm-open-knobrow .mm-open-card:nth-child(1){flex:6}
.mm-open-knobrow .mm-open-card:nth-child(2){flex:4}
.mm-open-knobrow .mm-open-card:nth-child(3){flex:4}
.mm-open-grid2{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:1.05fr 1.35fr .9fr;gap:.6em;align-content:start}
.mm-open-card{min-width:0;background:rgba(244,241,234,.03);border:1px solid rgba(244,241,234,.11);border-radius:.7em;padding:.45em .6em .55em}
.mm-open-grow{flex:1;min-height:0;display:flex;flex-direction:column}
.mm-open-wide{grid-column:1 / -1}
.mm-open-card h3{margin:0 0 .35em;font-size:.88em;font-weight:800;letter-spacing:.16em;color:${W_AMBER}}
.mm-open-knobs{display:flex;gap:.2em}
.mm-open-knobs .v4-knob{flex:1;min-width:0;width:auto;padding:.15em .05em .1em;background:transparent;gap:.05em;cursor:ns-resize}
.mm-open-knobs .v4-knob-dial{width:5.4em;height:5.4em;overflow:visible}
.mm-open .v4-knob-label{font-size:.85em;color:rgba(244,241,234,.7)}
.mm-open .v4-knob-page .v4-knob-value{font-size:1.5em;color:${W_INK}}
.mm-open .v4-knob-seg{stroke:rgba(244,241,234,.16);stroke-width:2.5;stroke-linecap:butt}
.mm-open .v4-knob-seg-on{stroke:${W_INK}}
.mm-open .v4-knob-shadow{fill:rgba(0,0,0,.85);filter:blur(1.6px)}
.mm-open .v4-knob-skirt{fill:url(#mm-knob-skirt);stroke:rgba(0,0,0,.9);stroke-width:.5}
.mm-open .v4-knob-cap{fill:url(#mm-knob-cap);stroke:rgba(255,255,255,.1);stroke-width:.5}
.mm-open .v4-knob-shine{fill:url(#mm-knob-shine);pointer-events:none}
.mm-open .v4-knob-mark{stroke:${W_INK};stroke-width:2.6;stroke-linecap:round}
.mm-open .v4-knob:hover .v4-knob-seg-on{stroke:#fff}
.mm-open .v4-knob:active .v4-knob-mark{stroke:${W_RED}}
.mm-open-knobs .v4-knob-unit{font-size:.78em;color:rgba(244,241,234,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.mm-open-note{font-size:1.05em;color:rgba(244,241,234,.7);margin:.25em 0 .5em}
.mm-open-big{font-size:1.6em;letter-spacing:.06em;margin:.1em 0 .2em}
.mm-open-big b{color:${W_RED}}
.mm-open-midirow{display:flex;align-items:center;gap:1em}
.mm-open-midiinfo{flex:1;min-width:0}
.mm-open-midiinfo .mm-open-note{margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mm-open-status{font-weight:700;color:#5fd08a}
.mm-open-status-ko{color:${W_RED}}
.mm-open-confirm{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;background:rgba(5,5,6,.82);border-radius:.6em}
.mm-open-confirm>div{background:#111214;border:1px solid rgba(244,241,234,.22);border-radius:.9em;padding:1.3em 1.6em;box-shadow:0 1.2em 3em rgba(0,0,0,.6);max-width:36em}
.mm-open-confirm h4{margin:0 0 .5em;font-size:1.3em;letter-spacing:.12em}
.mm-open-confirm p{margin:0 0 1em;font-size:1.1em;color:rgba(244,241,234,.75)}
.mm-open-choices{display:flex;flex-direction:column;gap:.5em}
.mm-open-choice{display:flex;align-items:center;gap:.8em}
.mm-open-choice>span{width:7.5em;font-size:.9em;font-weight:800;letter-spacing:.14em;color:rgba(244,241,234,.7)}
.mm-open-choice>div{display:flex;gap:.3em;flex-wrap:wrap}
.mm-open-help{columns:2;column-gap:1.6em}
.mm-open-help p{margin:0 0 .3em;display:flex;gap:.7em;font-size:.95em;break-inside:avoid}
.mm-open-help b{flex:0 0 12.5em;font-size:.9em;letter-spacing:.08em;color:${W_AMBER}}
.mm-open-help span{color:rgba(244,241,234,.8)}
.mm-open-about{margin:0;font-size:.9em;letter-spacing:.08em;color:rgba(244,241,234,.4)}
`;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const OpenPanel: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const hood = useSyncExternalStore(explode.subscribe, explode.get, explode.get);
  const open = hood === 'open';
  const [tab, setTab] = useState<Tab>('sample');
  const [box, setBox] = useState<Box | null>(null);
  // Le bas du capot ouvert (son bord avant reste en haut de la fenetre) : la bande qui le referme
  const [lid, setLid] = useState<number | null>(null);
  const changes = useRev();
  const t = activeTrack.get() ?? 'BD';

  // La place de l'ecran sur la carte (la vue ouverte est fixe : a l'ouverture, puis quand la fenetre change de taille)
  useEffect(() => {
    if (!open || !stage) {
      setBox(null);
      setLid(null);
      return undefined;
    }
    const place = (): void => {
      setBox(stage.pcbScreenRect());
      setLid(stage.lidEdgeY());
    };
    place();
    const timers = [window.setTimeout(place, 120), window.setTimeout(place, 500)];
    const onResize = (): void => {
      timers.push(window.setTimeout(place, 60), window.setTimeout(place, 400));
    };
    window.addEventListener('resize', onResize);
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('resize', onResize);
    };
  }, [open, stage]);

  // Echap referme le capot (avant les raccourcis de la face)
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      openToggle(stage);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, stage]);

  useEffect(() => {
    if (open) pluginMidi.request?.();
  }, [open]);

  if (!open || !box || box.width < 50) return null;
  // Une marge dans la zone degagee de la carte ; tout le panneau en em : 1 em = sa largeur / 98 (10 px a la taille de depart)
  const pad = box.width * 0.006;
  const width = box.width - 2 * pad;
  const height = box.height - 2 * pad;
  const em = width / 98;
  return (
    <>
      {lid !== null && lid > 6 && (
        <button type="button" className="mm-lid" style={{ height: lid, fontSize: em }} onClick={() => openToggle(stage)} onPointerDown={(e) => e.stopPropagation()} title="The lid: click to close it (Esc)" aria-label="Close the lid: back to the front panel">
          <span>▼ CLOSE THE LID</span>
        </button>
      )}
    <div className="mm-open-mod" style={{ left: box.left + pad, top: box.top + pad, width, height, fontSize: em }} onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      <style>{CSS}</style>
      {/* Les matieres des potards en relief (ui/KnobPanel.tsx relief) : la jupe, le capuchon bombe, son reflet */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <radialGradient id="mm-knob-skirt" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#2c2d31" />
            <stop offset="78%" stopColor="#141518" />
            <stop offset="100%" stopColor="#050506" />
          </radialGradient>
          <radialGradient id="mm-knob-cap" cx="40%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#3b3c41" />
            <stop offset="45%" stopColor="#1c1d20" />
            <stop offset="100%" stopColor="#0a0a0c" />
          </radialGradient>
          <linearGradient id="mm-knob-shine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,.22)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
      </svg>
      {(
        [
          { left: '.22em', top: '.22em' },
          { right: '.22em', top: '.22em' },
          { left: '.22em', bottom: '.22em' },
          { right: '.22em', bottom: '.22em' },
        ] as const
      ).map((at, i) => (
        <i key={i} className="mm-open-screw" style={at} aria-hidden="true" />
      ))}
      <span className="mm-open-tag" aria-hidden="true">
        LCD1 · MM-RYTM
      </span>
      <div className="mm-open" role="dialog" aria-label="MM-RYTM open: sample editor, pattern and settings">
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
          <DragMidi />
          <button type="button" className="mm-open-close" onClick={() => openToggle(stage)} title="Close (Esc): the lid comes back, the front panel">
            ✕ CLOSE <kbd>ESC</kbd>
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
          {tab === 'pattern' && <PatternTab />}
          {tab === 'settings' && <SettingsTab />}
        </div>
      </div>
    </div>
    </>
  );
};
