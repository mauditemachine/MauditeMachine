/**
 * La face v3 du plugin (2026-11-25) : un reglage = un controle (un knob, une bascule, une touche a choix). Trois sources :
 * - slotCtl : un reglage d'un ecran du MM-RYTM (rytm/pages.ts, la page et sa cible) ; il passe par les potards de page de cet
 *   ecran (actions/kit.ts setFaceScreen) : le P-LOCK d'un pas tenu, LIVE REC, les scenes et CONTROL ALL comme avant ;
 * - fxCtl : un reglage fin d'un effet du pattern (state/labFx.ts : HELL, la DIST, la REVERB), comme l'onglet FX d'avant ;
 * - trackCtl : le reglage d'une piste donnee (les envois PER TRACK, le mixer), sans changer la piste active.
 */

import { anyDial, anyDialReset, dialRange, dialShown, dialSteps, dialUnit, dialValueText, lockMode, pageKnobReset, subscribeDials, type DialId } from '../../actions';
import { setFaceScreen, withFaceScreen } from '../../actions/kit';
import { lockTrack } from '../../actions/internal/locks';
import { lockReadStep } from '../../actions/locks';
import { lockOf } from '../../audio/locks';
import { setVoiceFx } from '../../audio/drums';
import { pattern } from '../../audio/pattern';
import { isLegacyTrack, tracks, type TrackKey } from '../../audio/tracks';
import type { VoiceParam } from '../../audio/voicelaw';
import { pageSlots, type RytmScreenId } from '../../rytm/pages';
import { perform } from '../../state/perform';
import { rytmLock } from '../../state/rytmLock';
import { activeTrack } from '../../state/trk';
import { presetPatch, type LabKnob } from '../../state/labFx';
import { undo } from '../../state/undo';

export interface Ctl {
  /** la valeur, dans range() */
  get(): number;
  set(v: number): void;
  reset(): void;
  range(): readonly [number, number];
  /** 0 : continu ; n : n crans */
  steps(): number;
  /** la valeur lue (6.9K, ALWAYS, 1/8) */
  text(): string;
  /** son unite (KHZ, MS), '' : aucune */
  unit(): string;
  /** zero au milieu */
  bipolar: boolean;
  /** en P-LOCK : ce reglage est verrouille sur le pas */
  locked(): boolean;
  /** rien a regler maintenant (une piste sans ce reglage) */
  dead(): boolean;
  /** au debut d'un geste (le premier cran pose l'ecran du potard) */
  begin?(): void;
}

/** Tout ce qui change ce qu'un controle montre. */
export function subscribeCtl(fn: () => void): () => void {
  const offs = [subscribeDials(fn), tracks.subscribe(() => fn()), activeTrack.subscribe(fn), pattern.subscribe(fn), pattern.fx.subscribe(fn), rytmLock.subscribe(fn), perform.subscribe(fn)];
  return () => offs.forEach((off) => off());
}

/** Le rang du potard de page qui porte cette cible sur cet ecran (-1 : aucun). */
function slotIndex(sc: RytmScreenId, target: string): number {
  return pageSlots(sc, pattern.get().instrument).findIndex((s) => s.target === target && !s.graph);
}

const pk = (k: number): DialId => `p:${k}` as DialId;

/** Un reglage d'un ecran du MM-RYTM (rytm/pages.ts) : la page sc, la cible target (vfcut, t:tune, q:l1dst...). */
export function slotCtl(sc: RytmScreenId, target: string, bipolar = false): Ctl {
  const at = <T>(fn: (k: number) => T, none: () => T): T =>
    withFaceScreen(sc, () => {
      const k = slotIndex(sc, target);
      return k < 0 ? none() : fn(k);
    });
  return {
    bipolar,
    get: () => at((k) => dialShown(pk(k)), () => dialShown(target as DialId)),
    set(v) {
      const k = withFaceScreen(sc, () => slotIndex(sc, target));
      if (k < 0) {
        anyDial(target as DialId, v);
        return;
      }
      // L'ecran du potard reste pose : LIVE REC continue d'ecrire sur lui tant que le geste dure
      setFaceScreen(sc);
      anyDial(pk(k), v);
    },
    reset() {
      const k = withFaceScreen(sc, () => slotIndex(sc, target));
      if (k < 0) return;
      setFaceScreen(sc);
      pageKnobReset(k);
    },
    begin() {
      setFaceScreen(sc);
    },
    range: () => at((k) => dialRange(pk(k)), () => dialRange(target as DialId)),
    steps: () => at((k) => dialSteps(pk(k)), () => dialSteps(target as DialId)),
    text: () => at((k) => dialValueText(pk(k)), () => dialValueText(target as DialId)),
    unit: () => at((k) => dialUnit(pk(k)), () => dialUnit(target as DialId)),
    // Verrouille : le pas lu a un verrou de ce reglage (VEL, la velocite du pas, n'est pas un verrou)
    locked() {
      if (!lockMode()) return false;
      const step = lockReadStep();
      const tk = lockTrack();
      const slot = pageSlots(sc, pattern.get().instrument).find((x) => x.target === target && !x.graph);
      if (step < 0 || !tk || !slot?.lock || slot.lock === 'vel') return false;
      const l = lockOf(pattern.get().locks, tk, step) as Record<string, unknown> | null;
      return !!l && l[slot.lock] !== undefined;
    },
    dead: () => at((k) => dialValueText(pk(k)) === '--', () => false),
  };
}

/** Un reglage fin d'un effet du pattern (state/labFx.ts), 0 a 1, ses crans. */
export function fxCtl(k: LabKnob): Ctl {
  const read = (): number => (k.id === 'hmix' ? perform.hell() : pattern.fx.get()[k.id]);
  const fxNow = () => ({ ...pattern.fx.get(), hmix: perform.hell() });
  return {
    bipolar: k.id === 'xtilt' || k.id === 'xout' || k.id === 'hfreq',
    get: read,
    set: (v) => pattern.fx.set({ [k.id]: k.steps > 1 ? Math.round(v * (k.steps - 1)) / (k.steps - 1) : Math.round(v * 1000) / 1000 }),
    reset() {
      const d = k.id === 'drive' ? 0 : k.id === 'xtone' ? 1 : (presetPatch({ name: '', tip: '', set: {} }, k.id.startsWith('h') ? 'hell' : 'dist')[k.id] ?? 0);
      undo.boundary('mm808', 'step');
      pattern.fx.set({ [k.id]: d });
    },
    range: () => [0, 1],
    steps: () => (k.steps > 1 ? k.steps : 0),
    text: () => k.read(fxNow(), pattern.get().bpm),
    unit: () => k.unit(fxNow(), pattern.get().bpm),
    locked: () => false,
    dead: () => false,
  };
}

/** Le reglage d'une piste donnee (un envoi, son niveau, son panoramique), sans la choisir. */
export function trackCtl(t: TrackKey, p: VoiceParam, o: { bipolar?: boolean; def?: number; text?: (v: number) => string } = {}): Ctl {
  const get = (): number => tracks.vfx(t)[p] as number;
  return {
    bipolar: !!o.bipolar,
    get,
    set(v) {
      const c = o.bipolar ? Math.max(-1, Math.min(1, v)) : Math.max(0, Math.min(1, v));
      if (isLegacyTrack(t)) setVoiceFx(t, p, c);
      else tracks.set(t, p, c);
    },
    reset() {
      const d = o.def ?? 0;
      if (isLegacyTrack(t)) setVoiceFx(t, p, d);
      else tracks.set(t, p, d);
    },
    range: () => (o.bipolar ? [-1, 1] : [0, 1]),
    steps: () => 0,
    text: () => (o.text ? o.text(get()) : get() <= 0.001 ? 'OFF' : String(Math.round(get() * 127))),
    unit: () => '',
    locked: () => false,
    dead: () => false,
  };
}

/** La course 0 a 1 d'un controle. */
export function course(c: Ctl): number {
  const [lo, hi] = c.range();
  return hi > lo ? Math.max(0, Math.min(1, (c.get() - lo) / (hi - lo))) : 0;
}

/** Un controle pose a une course 0 a 1 (ses crans : le plus proche). */
export function setCourse(c: Ctl, x: number): void {
  const [lo, hi] = c.range();
  const n = c.steps();
  const cx = Math.max(0, Math.min(1, x));
  const v = n > 1 ? lo + (Math.round(cx * (n - 1)) / (n - 1)) * (hi - lo) : lo + cx * (hi - lo);
  c.set(Math.round(v * 10000) / 10000);
}

/** Un reglage par son id seul (les reglages de la machine sans potard de page : STEPS, BPM du menu). */
export function dialCtl(id: string, bipolar = false): Ctl {
  return {
    bipolar,
    get: () => dialShown(id as DialId),
    set: (v) => anyDial(id as DialId, v),
    reset: () => anyDial(id as DialId, anyDialReset(id as DialId)),
    range: () => dialRange(id as DialId),
    steps: () => dialSteps(id as DialId),
    text: () => dialValueText(id as DialId),
    unit: () => dialUnit(id as DialId),
    locked: () => false,
    dead: () => dialValueText(id as DialId) === '--',
  };
}

/**
 * Ce qu'un knob montre sous lui : la valeur mesuree quand le reglage en a une (DEC 124 : 4.5 S ; LEVEL 102 : 0.0 DB ; FREQ :
 * 20 KHZ), sinon son mot (1/16, OFF, TRI, ALWAYS, 1/8D).
 */
export function shown(c: Ctl): string {
  const t = c.text();
  const u = c.unit();
  if (/^[-+]?[0-9.]+$/.test(t) && u && /^[-+]?[0-9.]/.test(u) && u.length <= 10) return u;
  return t;
}
