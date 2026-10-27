/**
 * Le partage d'un beat du MM-RYTM (2026-10-21, audit SEO IMP2, Mika : "je veux du monde dans mon site ! ... qu'on parle
 * de ce site partout") : SHARE (l'en-tete, a cote de UNDO, ui/ShareButton.tsx) met le beat du moment dans une adresse,
 * https://mauditemachine.com/?m=rytm&b=<code> (audio/beatcode.ts), et l'ouvre a qui la recoit.
 * - Au telephone, la feuille de partage du systeme (navigator.share : Messages, WhatsApp, Instagram...) ; ailleurs, ou
 *   si elle manque, le lien copie dans le presse-papiers. L'ecran du MM-RYTM le dit (LINK COPIED, BEAT SHARED).
 * - Le lien porte les pas et leurs velocites, le tempo, les FX globaux, STRETCH, le son de chaque voix (sa MACHINE, son
 *   sample du site par son rang et l'empreinte de son nom, ses reglages de couche), les potards du kit et les reglages
 *   de chaque voix. Pas en version 1 : les P-LOCKS (le motif part sans eux) et les samples gardes dans ce navigateur
 *   (jamais publies : la voix part avec sa synthese) ; l'ecran le dit au moment du partage.
 * - A l'arrivee (adopt, au montage de la machine) : un code illisible est ignore (l'ecran dit BEAT LINK UNREADABLE,
 *   rien ne change) ; un bon code devient le beat du MM-RYTM. Le son du moment, s'il n'etait garde nulle part, est mis
 *   de cote d'abord (YOUR SOUND du mode presets, state/presets.ts) et UNDO le rend : rien de ce que le visiteur avait
 *   fait ne se perd. Le parametre b quitte ensuite l'adresse (un rechargement ne repose pas le beat par-dessus ses
 *   changements). Le site s'ouvre sur le MM-RYTM (state/focus.ts).
 * - Un sample du lien absent de ce site (la liste a change) : celui qui porte la meme empreinte de nom, sinon la
 *   synthese de la voix ; un preset d'usine du lien (les pages de motifs du site) absent : les reglages de depart.
 */

import { BPM, INSTRUMENTS, NEUTRAL_FX, type Fx, type Steps } from '../audio/pattern';
import { FAMS_V1, FX_V1, KNOBS_V1, LAYER_DEF_V1, LAYER_V1, MODELS_V1, VOICE_V1, decodeBeat, encodeBeat, sampleHash, type Beat, type BeatFam, type BeatFamily } from '../audio/beatcode';
import { KIT_KNOBS, LAYER_PARAMS, type KitFamily, type Layer } from '../audio/kit';
import { isUserKey, samplesOf } from '../audio/samples';
import { VOICE_FX_DEFAULT, VOICE_PARAMS, type VoiceFx } from '../audio/voicefx';
import type { Inst } from '../theme';
import { track } from './analytics';
import { boot } from './boot';
import { rytmFactory } from './factory';
import { intro } from './intro';
import { lcdMessage } from './lcdMessage';
import { apply, capture, presets } from './presets';
import { undo } from './undo';

/** Le parametre de l'adresse. */
export const BEAT_PARAM = 'b';

type RytmData = ReturnType<typeof rytmFactory>[number]['data'];

/** Les samples du site d'une famille (sans ceux de ce navigateur), dans l'ordre de la liste. */
const siteSamples = (f: KitFamily) => samplesOf(f).filter((s) => !s.user);

/** Ce que le lien ne peut pas porter (version 1), pour le dire a l'ecran. */
export interface Dropped {
  locks: boolean;
  mine: boolean;
  /** les scenes A et B (2026-10-27) : le lien V1 ne les porte pas */
  scenes: boolean;
}

/** Le beat du MM-RYTM tel qu'il joue, en Beat (audio/beatcode.ts). */
export function beatNow(): { beat: Beat; dropped: Dropped } {
  const r = capture('mm808') as RytmData & { locks?: unknown; scenes?: unknown };
  const dropped: Dropped = { locks: !!r.locks && Object.keys(r.locks as object).length > 0, mine: false, scenes: !!r.scenes };
  const kit = {} as Record<BeatFam, BeatFamily>;
  for (const f of FAMS_V1) {
    const m = MODELS_V1.indexOf((r.machines?.[f] ?? '909') as (typeof MODELS_V1)[number]);
    const layer = { ...LAYER_DEF_V1, ...(r.layers?.[f] ?? {}) } as Record<(typeof LAYER_V1)[number], number>;
    const fam: BeatFamily = { model: m < 0 ? 0 : m };
    const key = r.samples?.[f] ?? '';
    if (key && isUserKey(key)) {
      // Un sample de ce navigateur ne part pas : la voix part avec sa synthese, jamais muette
      dropped.mine = true;
      if (layer.syn <= 0) layer.syn = 1;
    } else if (key) {
      const list = siteSamples(f);
      const j = list.findIndex((s) => s.key === key);
      if (j >= 0 && j < 255) fam.sample = { n: j + 1, hash: sampleHash(list[j].file) };
      else if (layer.syn <= 0) layer.syn = 1;
    }
    const diff: Partial<Record<(typeof LAYER_V1)[number], number>> = {};
    for (const p of LAYER_V1) if (layer[p] !== LAYER_DEF_V1[p]) diff[p] = layer[p];
    if (Object.keys(diff).length) fam.layer = diff;
    kit[f] = fam;
  }
  const voices: NonNullable<Beat['voices']> = {};
  for (const inst of INSTRUMENTS) {
    const v = r.voices?.[inst];
    if (!v) continue;
    const o: Record<string, number> = {};
    for (const p of VOICE_V1) if (typeof v[p] === 'number') o[p] = v[p];
    voices[inst as keyof typeof voices] = o;
  }
  const fx: Record<string, number> = {};
  for (const k of FX_V1) if (typeof r.fx?.[k] === 'number') fx[k] = r.fx[k];
  const knobs: Record<string, number> = {};
  for (const k of KNOBS_V1) if (typeof r.knobs?.[k] === 'number') knobs[k] = r.knobs[k];
  return {
    beat: { bpm: r.bpm, steps: { ...r.steps }, fx, stretch: r.stretch, kit, knobs, voices },
    dropped,
  };
}

/** Le sample d'une famille pour un lien : son rang s'il porte la meme empreinte, sinon le premier qui la porte. */
function sampleKeyOf(f: KitFamily, s: { n: number; hash: number }): string | null {
  const list = siteSamples(f);
  const at = list[s.n - 1];
  if (at && sampleHash(at.file) === s.hash) return at.key;
  return list.find((x) => sampleHash(x.file) === s.hash)?.key ?? null;
}

/** L'etat du MM-RYTM d'un beat lu, tel que presets.apply le prend. */
export function dataOfBeat(beat: Beat): RytmData {
  const steps = Object.fromEntries(INSTRUMENTS.map((i) => [i, beat.steps[i as keyof Beat['steps']] ?? '0'.repeat(16)])) as Steps;
  const bpm = Math.min(BPM.max, Math.max(BPM.min, beat.bpm));
  const factory = beat.base ? rytmFactory()[beat.base - 1]?.data : undefined;
  if (factory) {
    const d = JSON.parse(JSON.stringify(factory)) as RytmData;
    return { ...d, steps, bpm, fx: { ...d.fx, ...(beat.fx ?? {}) } as Fx, ...(beat.stretch !== undefined ? { stretch: beat.stretch } : {}) };
  }
  const fx = { ...NEUTRAL_FX, ...(beat.fx ?? {}) } as Fx;
  const voices = Object.fromEntries(INSTRUMENTS.map((i) => [i, { ...VOICE_FX_DEFAULT, ...(beat.voices?.[i as keyof NonNullable<Beat['voices']>] ?? {}) }])) as Record<Inst, VoiceFx>;
  for (const i of INSTRUMENTS) for (const p of VOICE_PARAMS) if (typeof voices[i][p] !== 'number') voices[i][p] = VOICE_FX_DEFAULT[p];
  const knobs = Object.fromEntries(KIT_KNOBS.map((k) => [k, (beat.knobs as Record<string, number> | undefined)?.[k] ?? KNOB_DEFAULTS[k]])) as Record<string, number>;
  const machines: Partial<Record<KitFamily, string>> = {};
  const samples: Partial<Record<KitFamily, string>> = {};
  const layers: Partial<Record<KitFamily, Layer>> = {};
  for (const f of FAMS_V1) {
    const fam = beat.kit?.[f];
    machines[f] = MODELS_V1[fam?.model ?? 0];
    const layer = Object.fromEntries(LAYER_PARAMS.map((p) => [p, (fam?.layer as Record<string, number> | undefined)?.[p] ?? LAYER_DEF_V1[p as keyof typeof LAYER_DEF_V1]])) as Layer;
    const key = fam?.sample ? sampleKeyOf(f, fam.sample) : null;
    samples[f] = key ?? '';
    // Un sample du lien qui n'est plus sur ce site : la synthese de la voix, jamais une voix muette
    if (fam?.sample && !key && layer.syn <= 0) layer.syn = 1;
    layers[f] = layer;
  }
  return { steps, bpm, fx, stretch: beat.stretch ?? 0, voices, kit: knobs, sounds: {}, machines, samples, layers, knobs } as RytmData;
}

/** Les potards du kit au depart (audio/beatcode.ts KNOB_DEF_V1, les memes que audio/kit.ts). */
const KNOB_DEFAULTS: Record<string, number> = { tune: 0.5, attack: 0.5, decay: 0.45, drive: 0.25, snappy: 0.5, gate: 0, sweep: 0.5, sdtune: 0.5, sddecay: 0.5, sdtone: 0.5 };

/** L'adresse de partage du beat du moment (l'origine de la page : mauditemachine.com en ligne). */
export function shareUrl(): { url: string; bpm: number; dropped: Dropped } {
  const { beat, dropped } = beatNow();
  const url = `${window.location.origin}/?m=rytm&${BEAT_PARAM}=${encodeBeat(beat)}`;
  return { url, bpm: beat.bpm, dropped };
}

/** Le code de l'adresse d'arrivee : la chaine, null sans parametre (lu une fois). */
const arrival: string | null = (() => {
  if (typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search).get(BEAT_PARAM);
  } catch {
    return null;
  }
})();
let adopted = false;

/** Le parametre b retire de l'adresse (les autres restent). */
function dropParam(): void {
  try {
    const u = new URL(window.location.href);
    if (!u.searchParams.has(BEAT_PARAM)) return;
    u.searchParams.delete(BEAT_PARAM);
    window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}${u.hash}`);
  } catch {
    /* l'adresse reste telle quelle */
  }
}

/**
 * Un message de l'ecran du MM-RYTM une fois l'intro finie (avant, elle l'aurait recouvert). Pas avant la premiere image
 * (2026-10-22, revue INT-1) : adopt tourne au montage, avant que le Stage ne pose l'intro a 'pending' (state/intro.ts
 * part de 'done'), et le message passait pendant l'intro sans qu'on le voie. boot.onReady vient apres la premiere image
 * (l'intro est alors 'pending', ou 'done' sous reduced motion), le repli sans WebGL et l'arrivee par un panneau.
 */
function sayAfterIntro(text: string, ms: number): void {
  boot.onReady(() => {
    if (intro.get() === 'done') {
      lcdMessage.show(text, ms);
      return;
    }
    const off = intro.subscribe(() => {
      if (intro.get() !== 'done') return;
      off();
      lcdMessage.show(text, ms);
    });
  });
}

/**
 * Le beat de l'adresse d'arrivee pose sur le MM-RYTM (au montage de la machine, une fois). Rend 'none' (pas de
 * lien), 'bad' (illisible, rien ne change) ou 'ok'.
 */
export function adoptSharedBeat(): 'none' | 'bad' | 'ok' {
  if (arrival === null || adopted) return 'none';
  adopted = true;
  const beat = decodeBeat(arrival.trim());
  dropParam();
  if (!beat) {
    sayAfterIntro('BEAT LINK UNREADABLE', 3200);
    track('open_shared_beat', { ok: false });
    return 'bad';
  }
  // Le son du moment, garde nulle part : de cote (YOUR SOUND), et une etape d'UNDO a lui
  presets.setAside('mm808');
  undo.boundary('mm808', 'step');
  apply('mm808', dataOfBeat(beat));
  sayAfterIntro(`SHARED BEAT ${beat.bpm} BPM: PRESS RUN`, 4500);
  track('open_shared_beat', { ok: true, bpm: beat.bpm, base: beat.base ?? 0 });
  return 'ok';
}

/** Le lien est-il dans l'adresse d'arrivee (state/focus.ts : le site s'ouvre alors sur le MM-RYTM) ? */
export const arrivedWithBeat = (): boolean => arrival !== null;

type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Copie un texte : le presse-papiers, sinon l'ancienne commande de copie ; false si rien n'a marche. */
async function copy(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* refuse : l'ancienne commande */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * SHARE : la feuille de partage au telephone (pointeur grossier), sinon le lien copie ; l'ecran du MM-RYTM le dit.
 * Rend ce qui s'est passe (le bouton le montre un instant).
 */
export async function shareBeat(coarse: boolean): Promise<ShareResult> {
  const { url, bpm, dropped } = shareUrl();
  // Les scenes (2026-10-27) : le lien V1 part sans elles, l'ecran le dit a cote des P-LOCKS
  const note = (dropped.locks ? ' (NO P-LOCKS)' : dropped.mine ? ' (YOUR SAMPLES STAY HERE)' : '') + (dropped.scenes ? ' · SHARE: NO SCENES (V1)' : '');
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean };
  const data: ShareData = { title: 'My beat on MM-RYTM', text: `A ${bpm} BPM beat I made on MM-RYTM, the free drum machine of MM-STUDIO by Maudite Machine`, url };
  if (coarse && typeof nav.share === 'function' && (!nav.canShare || nav.canShare(data))) {
    try {
      await nav.share(data);
      lcdMessage.show(`BEAT SHARED${note}`, 2600);
      track('share_beat', { method: 'share', bpm });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // La feuille n'a pas pu s'ouvrir : le lien copie
    }
  }
  if (await copy(url)) {
    lcdMessage.show(`LINK COPIED${note}`, 2600);
    track('share_beat', { method: 'copy', bpm });
    return 'copied';
  }
  // Ni partage ni copie (navigateur qui refuse tout) : le lien a la main
  lcdMessage.show('COPY THE LINK BY HAND', 2600);
  try {
    window.prompt('Copy the link of your beat', url);
  } catch {
    /* pas de boite de dialogue */
  }
  track('share_beat', { method: 'prompt', bpm });
  return 'failed';
}
